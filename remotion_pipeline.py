"""Remotion Agent Pipeline — completely separate from the existing video pipeline.

Orchestrates: translate → TTS audio → AI scene config → Remotion render → merge audio.
"""
import json
import os
import subprocess
import time

import requests

from audio_utils import mix_voice_and_music, pick_music, prepare_music, probe_duration, stitch_audio
from remotion_templates import build_scene_gen_prompt

REMOTION_API_URL = os.environ.get("REMOTION_API_URL", "http://remotion-studio:3600")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")


def _get_openai():
    from openai import OpenAI
    from keystore import get_key
    api_key = get_key("openai")
    return OpenAI(api_key=api_key) if api_key else OpenAI()


def _translate_text(text, target_language):
    """Translate text to target language using OpenAI."""
    client = _get_openai()
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": (
            f"Translate the following text to {target_language}. "
            f"Keep it natural and conversational — this is for a video narration. "
            f"Return ONLY the translated text, nothing else.\n\n{text}"
        )}],
    )
    return response.choices[0].message.content.strip()


def generate_audio(segment, output_dir, voice_provider=None, voice_id=None,
                   language=None, voice_style=None, voice_settings=None,
                   music_track=None, music_source=None):
    """Generate TTS audio + music. Returns (final_audio_path, duration)."""
    from voice import get_provider as get_voice_provider
    from batch_generate import ELEVENLABS_LANGUAGES

    tts = get_voice_provider(voice_provider)
    sid = segment.get("id", "r")
    hook_path = os.path.join(output_dir, f"rseg{sid}_hook.mp3")
    script_path = os.path.join(output_dir, f"rseg{sid}_script.mp3")
    voice_path = os.path.join(output_dir, f"rseg{sid}_voice.mp3")
    final_path = os.path.join(output_dir, f"rseg{sid}_final.mp3")

    # Translate if needed
    hook_text = segment["hook"]
    script_text = segment["script"]
    if language and language != "en" and language in ELEVENLABS_LANGUAGES:
        lang_name = ELEVENLABS_LANGUAGES[language]["name"]
        print(f"  [Remotion] Translating to {lang_name}...")
        hook_text = _translate_text(hook_text, lang_name)
        script_text = _translate_text(script_text, lang_name)

    # Build voice kwargs
    voice_kwargs = {}
    if voice_id:
        voice_kwargs["voice"] = voice_id
    if language and language in ELEVENLABS_LANGUAGES:
        voice_kwargs["language_code"] = language
    if voice_style and voice_style != "custom":
        from voice import VOICE_PRESETS
        preset = VOICE_PRESETS.get(voice_style, {})
        voice_kwargs.update(preset)
    elif voice_settings and isinstance(voice_settings, dict):
        voice_kwargs.update(voice_settings)

    # Generate TTS
    tts.generate(hook_text, hook_path, **voice_kwargs)
    tts.generate(script_text, script_path, **voice_kwargs)
    stitch_audio([hook_path, script_path], voice_path)
    total_dur = probe_duration(voice_path)

    # Music
    music_path = os.path.join(output_dir, f"rseg{sid}_music.mp3")
    music_src = pick_music(music_track)
    prepare_music(music_src, total_dur, music_path)
    mix_voice_and_music(voice_path, music_path, final_path)

    return final_path, total_dur


def generate_scene_config(segment, user_prompt, style, audio_duration):
    """Use GPT-4o to generate a Remotion scene config JSON."""
    system, user_msg = build_scene_gen_prompt(segment, user_prompt, style, audio_duration)

    client = _get_openai()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_msg},
        ],
        response_format={"type": "json_object"},
    )
    config = json.loads(response.choices[0].message.content)

    # Validate basic structure
    if "scenes" not in config or not config["scenes"]:
        raise ValueError("GPT returned empty scene config")
    config.setdefault("fps", 30)
    config.setdefault("width", 1080)
    config.setdefault("height", 1920)

    return config


def render_remotion_video(scene_config, job_id):
    """POST scene config to Remotion render server, return MP4 path."""
    url = f"{REMOTION_API_URL}/render"
    print(f"  [Remotion] Sending render request: {job_id}")

    resp = requests.post(url, json={
        "job_id": job_id,
        "scene_config": scene_config,
    }, timeout=600)

    if resp.status_code != 200:
        raise RuntimeError(f"Remotion render failed: {resp.text[:500]}")

    data = resp.json()
    if data.get("status") == "cancelled":
        raise RuntimeError("Render cancelled")

    return data["path"]


def merge_audio_video(video_path, audio_path, output_path):
    """Merge Remotion video with ElevenLabs audio track."""
    result = subprocess.run([
        "ffmpeg", "-y",
        "-i", video_path,
        "-i", audio_path,
        "-map", "0:v:0",       # video from first input
        "-map", "1:a:0",       # audio from second input (ElevenLabs)
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        output_path,
    ], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg merge failed: {result.stderr[:500]}")


def run_remotion_pipeline(segment, job_id, output_dir,
                          user_prompt="", style="cinematic",
                          voice_provider=None, voice_id=None,
                          language=None, voice_style=None,
                          voice_settings=None, music_track=None,
                          music_source=None):
    """Full Remotion pipeline: audio → scene config → render → merge."""
    from db import update_remotion_job

    sid = segment.get("id", "?")
    seg_dir = os.path.join(output_dir, f"remotion_{job_id}")
    os.makedirs(seg_dir, exist_ok=True)

    try:
        # Phase 1: Audio
        update_remotion_job(job_id, status="audio", progress=5)
        print(f"  [Remotion Seg {sid}] Audio...")
        audio_path, duration = generate_audio(
            segment, seg_dir,
            voice_provider=voice_provider, voice_id=voice_id,
            language=language, voice_style=voice_style,
            voice_settings=voice_settings, music_track=music_track,
            music_source=music_source,
        )
        update_remotion_job(job_id, progress=20, audio_path=audio_path,
                           duration_seconds=duration)

        # Phase 2: AI Scene Composition
        update_remotion_job(job_id, status="composing", progress=25)
        print(f"  [Remotion Seg {sid}] Composing scenes...")
        scene_config = generate_scene_config(segment, user_prompt, style, duration)
        update_remotion_job(job_id, scene_config=json.dumps(scene_config), progress=35)

        # Phase 3: Remotion Render
        update_remotion_job(job_id, status="rendering", progress=40)
        print(f"  [Remotion Seg {sid}] Rendering...")
        video_path = render_remotion_video(scene_config, job_id)
        update_remotion_job(job_id, video_path=video_path, progress=85)

        # Phase 4: Merge audio + video
        update_remotion_job(job_id, status="encoding", progress=90)
        final_path = os.path.join(seg_dir, f"remotion_{sid}_final.mp4")
        print(f"  [Remotion Seg {sid}] Merging audio...")
        merge_audio_video(video_path, audio_path, final_path)

        update_remotion_job(job_id, status="done", progress=100,
                           final_path=final_path)
        print(f"  [Remotion Seg {sid}] Done! → {final_path}")
        return job_id, final_path

    except Exception as exc:
        err_msg = f"{type(exc).__name__}: {exc}"
        if len(err_msg) > 500:
            err_msg = err_msg[:500]
        update_remotion_job(job_id, status="failed", error=err_msg)
        print(f"  [Remotion Seg {sid}] FAILED: {err_msg}")
        return job_id, None
