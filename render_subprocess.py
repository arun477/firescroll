"""Standalone rendering + encoding subprocess.

Spawned by batch_generate.py via subprocess.Popen. Runs as a fresh,
non-daemon process that can use multiprocessing.Pool freely.

Renders frames in parallel via Pool, then pipes them in order to FFmpeg
— no temp PNGs written to disk.

Protocol:
  Input:  JSON args file path as sys.argv[1]
  Output: "PROGRESS:<pct>" on stdout, "DONE" on completion
  Exit:   0 = success, non-zero = failure (stderr has details)
"""
import io
import json
import os
import subprocess
import sys
from multiprocessing import Pool, cpu_count

from compositor import load_background, _get_bg_at_time
from karaoke_renderer import render_karaoke_frame
from split_screen import compose_split_frame, compose_video_fullscreen
from text_renderer import FPS, WIDTH, HEIGHT, render_frame

# Module-level shared state — populated in main() before Pool fork,
# inherited by child workers via copy-on-write
_bg_images = []


def _render_one(frame_args):
    """Render a single frame, return (frame_num, raw_rgb_bytes)."""
    frame_num, mode, segment, total_frames, timing, word_ts, vid_dir = frame_args

    # Text layer
    if word_ts:
        text = render_karaoke_frame(segment, frame_num, total_frames, timing, word_ts)
    else:
        text = render_frame(segment, frame_num, total_frames, timing)

    # Composite
    if mode == "full":
        t = frame_num / FPS
        bg = _get_bg_at_time(_bg_images, t, timing["total_duration"])
        bg_copy = bg.copy()
        text_rgba = text.convert("RGBA")
        bg_copy.paste(text_rgba, (0, 0), text_rgba)
        final = bg_copy.convert("RGB")

    elif mode == "video":
        vid_path = _safe_vid(vid_dir, frame_num)
        final = compose_video_fullscreen(text, vid_path)

    elif mode == "split":
        vid_path = _safe_vid(vid_dir, frame_num)
        t = frame_num / FPS
        bg_bottom = _get_bg_at_time(_bg_images, t, timing["total_duration"])
        final = compose_split_frame(text, vid_path, bg_bottom)

    else:
        final = text.convert("RGB")

    return frame_num, final.tobytes()


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


def main():
    args_path = sys.argv[1]
    with open(args_path) as f:
        args = json.load(f)

    mode = args["mode"]
    segment = args["segment"]
    total_frames = args["total_frames"]
    timing = args["timing"]
    word_ts = args.get("word_ts")
    vid_dir = args.get("vid_dir")
    video_out = args["video_out"]
    audio_path = args["audio_path"]

    # Load backgrounds before forking — children inherit via copy-on-write
    global _bg_images
    bg_paths = args.get("bg_paths", [])
    _bg_images = [load_background(p) for p in bg_paths] if bg_paths else []

    tasks = [
        (i, mode, segment, total_frames, timing, word_ts, vid_dir)
        for i in range(total_frames)
    ]

    workers = min(cpu_count(), 8)
    report_interval = FPS * 3

    # Start FFmpeg — pipe raw RGB frames directly, no temp PNGs
    ffmpeg_cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{WIDTH}x{HEIGHT}",
        "-pix_fmt", "rgb24",
        "-r", str(FPS),
        "-i", "pipe:0",
        "-i", audio_path,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-shortest",
        video_out,
    ]
    ffmpeg = subprocess.Popen(
        ffmpeg_cmd, stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )

    # Render in parallel, but feed to FFmpeg in frame order.
    # Pool.imap() preserves order (unlike imap_unordered).
    # We use a moderate chunksize for throughput while maintaining order.
    print(f"Rendering {total_frames} frames with {workers} workers → FFmpeg pipe", flush=True)

    done = 0
    with Pool(workers) as pool:
        for frame_num, rgb_bytes in pool.imap(_render_one, tasks, chunksize=8):
            ffmpeg.stdin.write(rgb_bytes)
            done += 1
            if done % report_interval == 0 or done == total_frames:
                pct = int(done / total_frames * 100)
                print(f"PROGRESS:{pct}", flush=True)

    ffmpeg.stdin.close()
    ffmpeg.wait()

    if ffmpeg.returncode != 0:
        raise RuntimeError(f"FFmpeg encoding failed with exit code {ffmpeg.returncode}")

    print("DONE", flush=True)


if __name__ == "__main__":
    main()
