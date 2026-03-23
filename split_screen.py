import os
import random
import subprocess
import sys

from PIL import Image

WIDTH = 1080
HEIGHT = 1920
HALF_H = HEIGHT // 2
VIDEO_DIR = os.path.join(os.path.dirname(__file__), "assets", "videos")


def pick_video(name=None):
    if name:
        path = os.path.join(VIDEO_DIR, name)
        if os.path.exists(path):
            return path
        raise FileNotFoundError(f"Video not found: {path}")

    clips = [f for f in os.listdir(VIDEO_DIR) if f.endswith(".mp4")]
    if not clips:
        raise FileNotFoundError(f"No video files in {VIDEO_DIR}")
    return os.path.join(VIDEO_DIR, random.choice(clips))


def extract_frames(video_path, output_dir, fps, total_duration, *,
                    target_h=HALF_H, total_frames=None):
    if total_frames is None:
        total_frames = int(total_duration * fps)
    result = subprocess.run([
        "ffmpeg", "-y",
        "-stream_loop", "-1",
        "-i", video_path,
        "-t", str(total_duration),
        "-vf", f"fps={fps},scale={WIDTH}:{target_h}:force_original_aspect_ratio=increase,"
               f"crop={WIDTH}:{target_h}",
        "-frames:v", str(total_frames),
        os.path.join(output_dir, "bg_%05d.png"),
    ], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        print("FFmpeg extract error:\n", result.stderr)
        sys.exit(1)
    return total_frames


def compose_split_frame(text_frame, video_frame_path, bg_bottom=None):
    video_half = Image.open(video_frame_path).convert("RGB")
    text_rgba = text_frame.convert("RGBA")

    canvas = Image.new("RGB", (WIDTH, HEIGHT), (0, 0, 0))
    canvas.paste(video_half, (0, 0))

    if bg_bottom:
        bottom_bg = bg_bottom.copy().convert("RGBA")
        bottom_bg = bottom_bg.crop((0, HALF_H, WIDTH, HEIGHT))
        canvas.paste(bottom_bg.convert("RGB"), (0, HALF_H))

    bottom_text = text_rgba.crop((0, HALF_H, WIDTH, HEIGHT))
    bg_color = (0, 0, 0, 0) if bg_bottom else (15, 15, 20, 255)
    bottom_layer = Image.new("RGBA", (WIDTH, HALF_H), bg_color)
    bottom_layer.paste(bottom_text, (0, 0), bottom_text)
    canvas.paste(bottom_layer.convert("RGB"), (0, HALF_H), bottom_text)

    return canvas


def compose_video_fullscreen(text_frame, video_frame_path):
    video_bg = Image.open(video_frame_path).convert("RGB")
    text_rgba = text_frame.convert("RGBA")
    video_bg.paste(text_rgba, (0, 0), text_rgba)
    return video_bg
