import json
import os
import random
import subprocess
import sys

MUSIC_DIR = os.path.join(os.path.dirname(__file__), "assets", "music")


def _run_ffmpeg(cmd):
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        print("FFmpeg error:\n", result.stderr)
        sys.exit(1)


def probe_duration(audio_path):
    result = subprocess.run(
        [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            audio_path,
        ],
        capture_output=True, text=True, check=False,
    )
    if result.returncode != 0:
        print("ffprobe error:\n", result.stderr)
        sys.exit(1)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])


def stitch_audio(parts, output_path):
    if len(parts) == 1:
        return parts[0]

    filter_parts = [f"[{i}:a]" for i in range(len(parts))]
    filter_str = "".join(filter_parts) + f"concat=n={len(parts)}:v=0:a=1[out]"

    cmd = ["ffmpeg", "-y"]
    for part in parts:
        cmd.extend(["-i", part])
    cmd.extend(["-filter_complex", filter_str, "-map", "[out]", output_path])

    _run_ffmpeg(cmd)
    return output_path


def pick_music(track_name=None):
    if track_name:
        path = os.path.join(MUSIC_DIR, track_name)
        if os.path.exists(path):
            return path
        raise FileNotFoundError(f"Track not found: {path}")

    tracks = [f for f in os.listdir(MUSIC_DIR) if f.endswith(".mp3")]
    if not tracks:
        raise FileNotFoundError(f"No music files in {MUSIC_DIR}")
    return os.path.join(MUSIC_DIR, random.choice(tracks))


def prepare_music(music_path, target_duration, output_path, *, volume=0.15):
    music_dur = probe_duration(music_path)

    if music_dur >= target_duration:
        fade_out_start = target_duration - 2.0
        filter_str = (
            f"afade=t=in:st=0:d=1.5,"
            f"afade=t=out:st={fade_out_start}:d=2.0,"
            f"volume={volume}"
        )
        _run_ffmpeg([
            "ffmpeg", "-y",
            "-i", music_path,
            "-t", str(target_duration),
            "-af", filter_str,
            output_path,
        ])
    else:
        loops = int(target_duration / music_dur) + 1
        fade_out_start = target_duration - 2.0
        filter_str = (
            f"aloop=loop={loops}:size={int(music_dur * 48000)},"
            f"atrim=0:{target_duration},"
            f"afade=t=in:st=0:d=1.5,"
            f"afade=t=out:st={fade_out_start}:d=2.0,"
            f"volume={volume}"
        )
        _run_ffmpeg([
            "ffmpeg", "-y",
            "-i", music_path,
            "-af", filter_str,
            output_path,
        ])

    return output_path


def _get_elevenlabs_client():
    from elevenlabs.client import ElevenLabs
    from keystore import get_key
    return ElevenLabs(api_key=get_key("elevenlabs"))


def _write_audio_stream(audio_iter, output_path):
    with open(output_path, "wb") as f:
        for chunk in audio_iter:
            f.write(chunk)
    return output_path


def generate_music_elevenlabs(prompt, duration_seconds, output_path):
    client = _get_elevenlabs_client()
    length_ms = max(3000, min(600000, int(duration_seconds * 1000)))
    print(f"[ElevenLabs Music] Generating {length_ms}ms: {prompt[:60]}...")
    track = client.music.compose(
        prompt=prompt,
        music_length_ms=length_ms,
        output_format="mp3_44100_128",
        force_instrumental=True,
    )
    _write_audio_stream(track, output_path)
    print(f"[ElevenLabs Music] Saved: {output_path}")
    return output_path


def generate_sfx_elevenlabs(prompt, duration_seconds, output_path):
    client = _get_elevenlabs_client()
    duration = max(0.5, min(30.0, duration_seconds))
    print(f"[ElevenLabs SFX] Generating {duration}s: {prompt[:60]}...")
    audio = client.text_to_sound_effects.convert(
        text=prompt,
        duration_seconds=duration,
        prompt_influence=0.5,
    )
    _write_audio_stream(audio, output_path)
    print(f"[ElevenLabs SFX] Saved: {output_path}")
    return output_path


def mix_voice_and_music(voice_path, music_path, output_path):
    _run_ffmpeg([
        "ffmpeg", "-y",
        "-i", voice_path,
        "-i", music_path,
        "-filter_complex",
        "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[out]",
        "-map", "[out]",
        output_path,
    ])
    return output_path
