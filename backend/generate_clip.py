import json
import math
import os
import subprocess
import sys
import tempfile
from multiprocessing import Pool, cpu_count

from audio_utils import (
    mix_voice_and_music,
    pick_music,
    prepare_music,
    probe_duration,
    stitch_audio,
)
from compositor import compose_frame, load_background
from imagegen import get_provider as get_image_provider
from split_screen import (
    compose_split_frame,
    compose_video_fullscreen,
    extract_frames,
    pick_video,
)
from karaoke_renderer import render_karaoke_frame
from text_renderer import FPS, HEIGHT, render_frame, render_thumbnail
from transcribe import get_word_timestamps
from voice import get_provider as get_voice_provider

MODE_FULL = "full"
MODE_VIDEO = "video"
MODE_SPLIT = "split"
VALID_MODES = [MODE_FULL, MODE_VIDEO, MODE_SPLIT]

CAPTION_DEFAULT = "default"
CAPTION_KARAOKE = "karaoke"
VALID_CAPTIONS = [CAPTION_DEFAULT, CAPTION_KARAOKE]


def load_segment(json_path, segment_id):
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)
    for seg in data["segments"]:
        if seg["id"] == segment_id:
            seg["series_title"] = data["series_title"]
            return data["topic"], seg
    raise ValueError(f"Segment {segment_id} not found")


def run_ffmpeg(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        print("FFmpeg error:\n", result.stderr)
        sys.exit(1)


def generate_audio(segment, output_dir):
    tts = get_voice_provider("openai")
    slug = "tts_temp"

    hook_path = os.path.join(output_dir, f"{slug}_hook.mp3")
    script_path = os.path.join(output_dir, f"{slug}_script.mp3")
    voice_path = os.path.join(output_dir, f"{slug}_voice.mp3")
    final_path = os.path.join(output_dir, f"{slug}_final.mp3")

    print("  Generating hook audio...")
    tts.generate(segment["hook"], hook_path)
    hook_dur = probe_duration(hook_path)

    print("  Generating script audio...")
    tts.generate(segment["script"], script_path)
    script_dur = probe_duration(script_path)

    print("  Stitching voice...")
    stitch_audio([hook_path, script_path], voice_path)
    total_dur = probe_duration(voice_path)

    print("  Adding background music...")
    music_src = pick_music()
    music_path = os.path.join(output_dir, f"{slug}_music.mp3")
    prepare_music(music_src, total_dur, music_path)
    mix_voice_and_music(voice_path, music_path, final_path)
    print(f"  Music track: {os.path.basename(music_src)}")

    timing = {
        "hook_duration": hook_dur,
        "script_duration": script_dur,
        "total_duration": total_dur,
    }
    print(f"  Timing: hook={hook_dur:.1f}s script={script_dur:.1f}s total={total_dur:.1f}s")
    return final_path, timing


def generate_backgrounds(segment, output_dir, count=4):
    img_gen = get_image_provider("openai")
    bg_dir = os.path.join(output_dir, "backgrounds")
    os.makedirs(bg_dir, exist_ok=True)

    visual_cue = segment.get("visual_cue", "")
    topic = segment.get("series_title", "educational")
    title = segment["title"]

    prompt = (
        f"Cinematic vertical background for short educational video about {topic}: {title}. "
        f"Scene: {visual_cue}. "
        "Vivid colors, cinematic lighting, no text, no words, no letters, photorealistic."
    )

    print(f"  Generating {count} backgrounds in bulk...")
    paths = img_gen.generate_bulk(prompt, bg_dir, count)
    return [load_background(p) for p in paths]


def _text_layer(segment, frame_num, total_frames, timing, word_ts=None):
    if word_ts:
        return render_karaoke_frame(segment, frame_num, total_frames, timing, word_ts)
    return render_frame(segment, frame_num, total_frames, timing)


def _render_full(args):
    segment, frame_num, total_frames, timing, bg_data, word_ts, out_path = args
    text = _text_layer(segment, frame_num, total_frames, timing, word_ts)
    t = frame_num / FPS
    final = compose_frame(text, bg_data, t, timing)
    final.save(out_path)
    return frame_num


def _safe_vid_path(vid_frame_dir, frame_num):
    path = os.path.join(vid_frame_dir, f"bg_{frame_num + 1:05d}.png")
    if not os.path.exists(path):
        idx = frame_num
        while idx > 0 and not os.path.exists(path):
            idx -= 1
            path = os.path.join(vid_frame_dir, f"bg_{idx + 1:05d}.png")
    return path


def _render_video(args):
    segment, frame_num, total_frames, timing, vid_frame_dir, word_ts, out_path = args
    text = _text_layer(segment, frame_num, total_frames, timing, word_ts)
    vid_path = _safe_vid_path(vid_frame_dir, frame_num)
    final = compose_video_fullscreen(text, vid_path)
    final.save(out_path)
    return frame_num


def _render_split(args):
    segment, frame_num, total_frames, timing, vid_dir, bg_data, word_ts, out_path = args
    text = _text_layer(segment, frame_num, total_frames, timing, word_ts)
    vid_path = _safe_vid_path(vid_dir, frame_num)
    bg_bottom = _get_bg_for_frame(bg_data, frame_num, total_frames, timing)
    final = compose_split_frame(text, vid_path, bg_bottom)
    final.save(out_path)
    return frame_num


def _get_bg_for_frame(bg_images, frame_num, _total_frames, timing):
    if not bg_images:
        return None
    from compositor import _get_bg_at_time
    t = frame_num / FPS
    return _get_bg_at_time(bg_images, t, timing["total_duration"])


def _encode_video(tmp_dir, audio_path, video_path):
    run_ffmpeg([
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", os.path.join(tmp_dir, "frame_%05d.png"),
        "-i", audio_path,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-shortest",
        video_path,
    ])


def _run_parallel(tasks, render_fn, total_frames):
    workers = min(cpu_count(), 8)
    print(f"  Using {workers} workers...")
    with Pool(workers) as pool:
        done = 0
        for _ in pool.imap_unordered(render_fn, tasks, chunksize=16):
            done += 1
            if done % (FPS * 2) == 0 or done == total_frames:
                print(f"  {done}/{total_frames} frames")


def generate_clip(json_path, segment_id, output_dir="output",
                  mode=MODE_FULL, caption=CAPTION_DEFAULT):
    topic, segment = load_segment(json_path, segment_id)
    os.makedirs(output_dir, exist_ok=True)

    suffix = {"full": "", "video": "_video", "split": "_split"}[mode]
    if caption == CAPTION_KARAOKE:
        suffix += "_karaoke"
    slug = f"{topic.lower()}_part{segment_id}"
    video_path = os.path.join(output_dir, f"{slug}{suffix}.mp4")
    thumb_path = os.path.join(output_dir, f"{slug}{suffix}_thumb.png")

    print(f"Mode: {mode.upper()} | Captions: {caption.upper()}")
    print("Step 1: Audio + Music")
    audio_path, timing = generate_audio(segment, output_dir)

    word_ts = None
    if caption == CAPTION_KARAOKE:
        voice_path = os.path.join(output_dir, "tts_temp_voice.mp3")
        print("  Transcribing for word timestamps...")
        word_ts = get_word_timestamps(voice_path)

    total_frames = math.ceil(timing["total_duration"] * FPS)

    with tempfile.TemporaryDirectory() as tmp_dir:

        if mode == MODE_FULL:
            print("Step 2: AI Backgrounds")
            bg_images = generate_backgrounds(segment, output_dir)
            print(f"Step 3: Rendering {total_frames} frames")
            tasks = [
                (segment, i, total_frames, timing, bg_images, word_ts,
                 os.path.join(tmp_dir, f"frame_{i:05d}.png"))
                for i in range(total_frames)
            ]
            _run_parallel(tasks, _render_full, total_frames)

        elif mode == MODE_VIDEO:
            print("Step 2: Extracting video frames (fullscreen)")
            vid_src = pick_video()
            print(f"  Video: {os.path.basename(vid_src)}")
            vid_dir = os.path.join(tmp_dir, "vid")
            os.makedirs(vid_dir)
            extract_frames(vid_src, vid_dir, FPS, timing["total_duration"],
                           target_h=HEIGHT, total_frames=total_frames)
            print(f"Step 3: Rendering {total_frames} frames")
            tasks = [
                (segment, i, total_frames, timing, vid_dir, word_ts,
                 os.path.join(tmp_dir, f"frame_{i:05d}.png"))
                for i in range(total_frames)
            ]
            _run_parallel(tasks, _render_video, total_frames)

        elif mode == MODE_SPLIT:
            print("Step 2a: Extracting video frames (top half)")
            vid_src = pick_video()
            print(f"  Video: {os.path.basename(vid_src)}")
            vid_dir = os.path.join(tmp_dir, "vid")
            os.makedirs(vid_dir)
            extract_frames(vid_src, vid_dir, FPS, timing["total_duration"],
                           total_frames=total_frames)

            print("Step 2b: AI Backgrounds (bottom half)")
            bg_images = generate_backgrounds(segment, output_dir)

            print(f"Step 3: Rendering {total_frames} split frames")
            tasks = [
                (segment, i, total_frames, timing, vid_dir, bg_images,
                 word_ts, os.path.join(tmp_dir, f"frame_{i:05d}.png"))
                for i in range(total_frames)
            ]
            _run_parallel(tasks, _render_split, total_frames)

        print("Step 4: Encoding")
        _encode_video(tmp_dir, audio_path, video_path)

    print("Step 5: Thumbnail")
    thumb = render_thumbnail(segment)
    thumb.save(thumb_path)

    return video_path, thumb_path


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "data/topics/dna.json"
    sid = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    mode = sys.argv[3] if len(sys.argv) > 3 else MODE_FULL
    caption = sys.argv[4] if len(sys.argv) > 4 else CAPTION_DEFAULT

    if mode not in VALID_MODES:
        print(f"Invalid mode: {mode}. Choose from: {VALID_MODES}")
        sys.exit(1)
    if caption not in VALID_CAPTIONS:
        print(f"Invalid caption: {caption}. Choose from: {VALID_CAPTIONS}")
        sys.exit(1)

    video, thumb = generate_clip(path, sid, mode=mode, caption=caption)
    print(f"\nDone! Video: {video} | Thumbnail: {thumb}")


if __name__ == "__main__":
    main()
