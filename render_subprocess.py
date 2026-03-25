"""Standalone frame rendering subprocess.

Spawned by batch_generate.py via subprocess.Popen so it runs as a fresh,
non-daemon process that can freely use multiprocessing.Pool.

Protocol:
  - Input: JSON args file path as sys.argv[1]
  - Output: "PROGRESS:<pct>" lines on stdout, "DONE" on completion
  - Exit code 0 = success, non-zero = failure (stderr has details)
"""
import json
import os
import sys
from multiprocessing import Pool, cpu_count

from compositor import load_background, _get_bg_at_time
from karaoke_renderer import render_karaoke_frame
from split_screen import compose_split_frame, compose_video_fullscreen
from text_renderer import FPS, render_frame

# Module-level shared state — populated in main() before Pool fork,
# inherited by child workers via copy-on-write
_bg_images = []


def _render_one(frame_args):
    frame_num, mode, segment, total_frames, timing, word_ts, frame_dir, vid_dir = frame_args

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

    final.save(os.path.join(frame_dir, f"frame_{frame_num:05d}.png"))
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


def main():
    args_path = sys.argv[1]
    with open(args_path) as f:
        args = json.load(f)

    mode = args["mode"]
    segment = args["segment"]
    total_frames = args["total_frames"]
    timing = args["timing"]
    frame_dir = args["frame_dir"]
    word_ts = args.get("word_ts")
    vid_dir = args.get("vid_dir")

    # Load background images into module-level list — fork() gives
    # child workers copy-on-write access without pickling overhead
    global _bg_images
    bg_paths = args.get("bg_paths", [])
    _bg_images = [load_background(p) for p in bg_paths] if bg_paths else []

    tasks = [
        (i, mode, segment, total_frames, timing, word_ts, frame_dir, vid_dir)
        for i in range(total_frames)
    ]

    workers = min(cpu_count(), 8)
    report_interval = FPS * 3  # report every ~3 seconds of video

    with Pool(workers) as pool:
        done = 0
        for _ in pool.imap_unordered(_render_one, tasks, chunksize=16):
            done += 1
            if done % report_interval == 0 or done == total_frames:
                pct = int(done / total_frames * 100)
                print(f"PROGRESS:{pct}", flush=True)

    print("DONE", flush=True)


if __name__ == "__main__":
    main()
