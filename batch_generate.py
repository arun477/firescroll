import json
import math
import os
import random
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from multiprocessing import Pool, cpu_count

from audio_utils import (
    mix_voice_and_music,
    pick_music,
    prepare_music,
    probe_duration,
    stitch_audio,
)
from compositor import load_background
from db import (
    STATUS_AUDIO,
    STATUS_BACKGROUNDS,
    STATUS_DONE,
    STATUS_ENCODING,
    STATUS_FAILED,
    STATUS_RENDERING,
    STATUS_TRANSCRIBING,
    create_job,
    create_topic,
    update_job,
)
from imagegen import get_provider as get_image_provider
from karaoke_renderer import render_karaoke_frame
from split_screen import (
    compose_split_frame,
    compose_video_fullscreen,
    extract_frames,
    pick_video,
)
from text_renderer import FPS, HEIGHT, render_frame, render_thumbnail
from transcribe import get_word_timestamps
from voice import get_provider as get_voice_provider

MODES = ["full", "video", "split"]
CAPTIONS = ["default", "karaoke"]


def load_topic(json_path):
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)
    for seg in data["segments"]:
        seg["series_title"] = data["series_title"]
    return data


def _run_ffmpeg(cmd):
    import subprocess
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg error: {result.stderr[:500]}")


def _phase_audio(segment, output_dir):
    tts = get_voice_provider("openai")
    sid = segment["id"]
    hook_path = os.path.join(output_dir, f"seg{sid}_hook.mp3")
    script_path = os.path.join(output_dir, f"seg{sid}_script.mp3")
    voice_path = os.path.join(output_dir, f"seg{sid}_voice.mp3")
    final_path = os.path.join(output_dir, f"seg{sid}_final.mp3")

    tts.generate(segment["hook"], hook_path)
    hook_dur = probe_duration(hook_path)

    tts.generate(segment["script"], script_path)
    script_dur = probe_duration(script_path)

    stitch_audio([hook_path, script_path], voice_path)
    total_dur = probe_duration(voice_path)

    music_src = pick_music()
    music_path = os.path.join(output_dir, f"seg{sid}_music.mp3")
    prepare_music(music_src, total_dur, music_path)
    mix_voice_and_music(voice_path, music_path, final_path)

    timing = {
        "hook_duration": hook_dur,
        "script_duration": script_dur,
        "total_duration": total_dur,
    }
    return {
        "audio_path": final_path,
        "voice_path": voice_path,
        "timing": timing,
        "music": os.path.basename(music_src),
    }


def _phase_backgrounds(segment, output_dir, count=4):
    img_gen = get_image_provider("openai")
    sid = segment["id"]
    bg_dir = os.path.join(output_dir, f"bg_seg{sid}")
    os.makedirs(bg_dir, exist_ok=True)

    visual_cue = segment.get("visual_cue", "")
    topic = segment.get("series_title", "educational")
    title = segment["title"]

    prompt = (
        f"Cinematic vertical background for short educational video about {topic}: {title}. "
        f"Scene: {visual_cue}. "
        "Vivid colors, cinematic lighting, no text, no words, photorealistic."
    )
    paths = img_gen.generate_bulk(prompt, bg_dir, count)
    return [load_background(p) for p in paths]


def _phase_transcribe(voice_path):
    return get_word_timestamps(voice_path)


def _text_layer(segment, frame_num, total_frames, timing, word_ts=None):
    if word_ts:
        return render_karaoke_frame(segment, frame_num, total_frames, timing, word_ts)
    return render_frame(segment, frame_num, total_frames, timing)


def _render_frame_worker(args):
    mode, segment, frame_num, total_frames, timing, extra = args
    word_ts = extra.get("word_ts")
    text = _text_layer(segment, frame_num, total_frames, timing, word_ts)

    if mode == "full":
        from compositor import _get_bg_at_time
        t = frame_num / FPS
        bg = _get_bg_at_time(extra["bg_images"], t, timing["total_duration"])
        bg_copy = bg.copy()
        text_rgba = text.convert("RGBA")
        bg_copy.paste(text_rgba, (0, 0), text_rgba)
        final = bg_copy.convert("RGB")

    elif mode == "video":
        vid_path = _safe_vid(extra["vid_dir"], frame_num)
        final = compose_video_fullscreen(text, vid_path)

    elif mode == "split":
        vid_path = _safe_vid(extra["vid_dir"], frame_num)
        from compositor import _get_bg_at_time
        t = frame_num / FPS
        bg_bottom = _get_bg_at_time(extra["bg_images"], t, timing["total_duration"])
        final = compose_split_frame(text, vid_path, bg_bottom)

    else:
        final = text.convert("RGB")

    final.save(os.path.join(extra["frame_dir"], f"frame_{frame_num:05d}.png"))
    return frame_num


def _safe_vid(vid_dir, frame_num):
    path = os.path.join(vid_dir, f"bg_{frame_num + 1:05d}.png")
    if os.path.exists(path):
        return path
    idx = frame_num
    while idx > 0:
        idx -= 1
        fallback = os.path.join(vid_dir, f"bg_{idx + 1:05d}.png")
        if os.path.exists(fallback):
            return fallback
    return path


def _generate_single(segment, mode, caption, output_dir, job_id):
    try:
        sid = segment["id"]
        topic = segment.get("series_title", "topic").lower().replace(" ", "_")
        seg_dir = os.path.join(output_dir, f"{topic}_part{sid}")
        os.makedirs(seg_dir, exist_ok=True)

        suffix = {"full": "", "video": "_video", "split": "_split"}[mode]
        if caption == "karaoke":
            suffix += "_karaoke"
        video_path = os.path.join(seg_dir, f"part{sid}{suffix}.mp4")
        thumb_path = os.path.join(seg_dir, f"part{sid}{suffix}_thumb.png")

        update_job(job_id, status=STATUS_AUDIO)
        print(f"  [Seg {sid}] Audio...")
        audio_result = _phase_audio(segment, seg_dir)
        timing = audio_result["timing"]
        update_job(job_id, audio_path=audio_result["audio_path"],
                   duration_seconds=timing["total_duration"])

        word_ts = None
        if caption == "karaoke":
            update_job(job_id, status=STATUS_TRANSCRIBING)
            print(f"  [Seg {sid}] Transcribing...")
            word_ts = _phase_transcribe(audio_result["voice_path"])

        total_frames = math.ceil(timing["total_duration"] * FPS)
        extra = {"word_ts": word_ts}

        needs_bg = mode in ("full", "split")
        needs_vid = mode in ("video", "split")

        if needs_bg:
            update_job(job_id, status=STATUS_BACKGROUNDS)
            print(f"  [Seg {sid}] Backgrounds...")
            extra["bg_images"] = _phase_backgrounds(segment, seg_dir)

        if needs_vid:
            print(f"  [Seg {sid}] Extracting video frames...")
            vid_src = pick_video()
            vid_dir = os.path.join(seg_dir, "vid_frames")
            os.makedirs(vid_dir, exist_ok=True)
            target_h = HEIGHT if mode == "video" else HEIGHT // 2
            extract_frames(vid_src, vid_dir, FPS, timing["total_duration"],
                           target_h=target_h, total_frames=total_frames)
            extra["vid_dir"] = vid_dir

        update_job(job_id, status=STATUS_RENDERING, progress=0)
        print(f"  [Seg {sid}] Rendering {total_frames} frames...")

        with tempfile.TemporaryDirectory() as tmp_dir:
            extra["frame_dir"] = tmp_dir

            tasks = [
                (mode, segment, i, total_frames, timing, extra)
                for i in range(total_frames)
            ]

            workers = min(cpu_count(), 8)
            with Pool(workers) as pool:
                done = 0
                for _ in pool.imap_unordered(_render_frame_worker, tasks, chunksize=16):
                    done += 1
                    if done % (FPS * 2) == 0 or done == total_frames:
                        pct = int(done / total_frames * 100)
                        update_job(job_id, progress=pct)

            update_job(job_id, status=STATUS_ENCODING, progress=95)
            print(f"  [Seg {sid}] Encoding...")
            _run_ffmpeg([
                "ffmpeg", "-y",
                "-framerate", str(FPS),
                "-i", os.path.join(tmp_dir, "frame_%05d.png"),
                "-i", audio_result["audio_path"],
                "-c:v", "libx264", "-pix_fmt", "yuv420p",
                "-c:a", "aac", "-shortest",
                video_path,
            ])

        thumb = render_thumbnail(segment)
        thumb.save(thumb_path)

        update_job(job_id, status=STATUS_DONE, progress=100,
                   video_path=video_path, thumb_path=thumb_path)
        print(f"  [Seg {sid}] Done! → {video_path}")
        return job_id, video_path

    except Exception as exc:  # pylint: disable=broad-exception-caught
        update_job(job_id, status=STATUS_FAILED, error=str(exc))
        print(f"  [Seg {sid}] FAILED: {exc}")
        return job_id, None


def batch_generate(json_path, output_dir="output", max_parallel=2, topic_id=None):
    data = load_topic(json_path)
    segments = data["segments"]

    if topic_id is None:
        topic_id = create_topic(
            title=data["topic"],
            series_title=data["series_title"],
            json_path=os.path.abspath(json_path),
            total_segments=len(segments),
        )
    print(f"Topic: {data['topic']} ({data['series_title']}) — {len(segments)} segments")
    print(f"Topic ID: {topic_id}")

    jobs = []
    for seg in segments:
        mode = random.choice(MODES)
        caption = random.choice(CAPTIONS)
        job_id = create_job(topic_id, seg["id"], mode, caption)
        if job_id is None:
            print(f"  Seg {seg['id']}: skipped (already exists)")
            continue
        jobs.append((seg, mode, caption, job_id))
        print(f"  Seg {seg['id']}: {mode}/{caption} → Job {job_id}")

    if not jobs:
        print("\nAll segments already generated. Nothing to do.")
        return {"topic_id": topic_id, "segments": []}

    print(f"\nStarting generation ({max_parallel} segments at a time)...\n")

    results = []
    with ThreadPoolExecutor(max_workers=max_parallel) as executor:
        futures = {}
        for seg, mode, caption, job_id in jobs:
            fut = executor.submit(_generate_single, seg, mode, caption, output_dir, job_id)
            futures[fut] = (seg["id"], job_id)

        for fut in as_completed(futures):
            seg_id, job_id = futures[fut]
            result_job_id, video_path = fut.result()
            results.append({
                "segment_id": seg_id,
                "job_id": result_job_id,
                "video_path": video_path,
            })

    manifest = {
        "topic_id": topic_id,
        "topic": data["topic"],
        "series_title": data["series_title"],
        "segments": sorted(results, key=lambda r: r["segment_id"]),
    }
    manifest_path = os.path.join(output_dir, f"{data['topic'].lower()}_manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    done_count = sum(1 for r in results if r["video_path"])
    print(f"\nComplete: {done_count}/{len(segments)} videos generated")
    print(f"Manifest: {manifest_path}")
    print(f"Topic ID: {topic_id}")
    return manifest


def main():
    json_path = sys.argv[1] if len(sys.argv) > 1 else "data/topics/dna.json"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "output"
    max_parallel = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    batch_generate(json_path, output_dir, max_parallel)


if __name__ == "__main__":
    main()
