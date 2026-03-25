"""AI Chat Agent for Motion Studio.

Uses OpenAI Agents SDK with function tools to drive scene composition
through conversational interaction. State stored in Redis.
"""
import asyncio
import json
import os
import time
from datetime import datetime, timezone

import redis

from remotion_templates import TEMPLATES, STYLES

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
CONV_TTL = 86400  # 24 hours

_redis = None


def _get_redis():
    global _redis
    if _redis is None:
        _redis = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    return _redis


def _now():
    return datetime.now(timezone.utc).isoformat()


# ── Redis helpers ──

def _key(cid, suffix):
    return f"chat:{cid}:{suffix}"


def _refresh_ttl(r, cid):
    for suffix in ("messages", "scene_config", "state", "chunks", "chunk_count"):
        r.expire(_key(cid, suffix), CONV_TTL)


def get_conversation_state(cid):
    r = _get_redis()
    state_raw = r.get(_key(cid, "state"))
    return json.loads(state_raw) if state_raw else None


def get_conversation_history(cid):
    r = _get_redis()
    raw = r.get(_key(cid, "messages"))
    return json.loads(raw) if raw else []


def get_scene_config(cid):
    r = _get_redis()
    raw = r.get(_key(cid, "scene_config"))
    return json.loads(raw) if raw else None


def set_scene_config(cid, config):
    r = _get_redis()
    r.set(_key(cid, "scene_config"), json.dumps(config))
    _refresh_ttl(r, cid)


def set_status(cid, status):
    r = _get_redis()
    state = get_conversation_state(cid) or {}
    state["status"] = status
    r.set(_key(cid, "state"), json.dumps(state))


def push_chunk(cid, text):
    r = _get_redis()
    r.rpush(_key(cid, "chunks"), text)
    r.incr(_key(cid, "chunk_count"))


def clear_chunks(cid):
    r = _get_redis()
    r.delete(_key(cid, "chunks"))
    r.set(_key(cid, "chunk_count"), 0)


def append_message(cid, role, content):
    r = _get_redis()
    msgs = get_conversation_history(cid)
    msgs.append({"role": role, "content": content, "timestamp": _now()})
    # Cap history at 40 messages
    if len(msgs) > 40:
        msgs = msgs[-40:]
    r.set(_key(cid, "messages"), json.dumps(msgs))
    _refresh_ttl(r, cid)


def init_conversation(cid, topic_id, segment_id, style="cinematic",
                      voice_id="", language=""):
    r = _get_redis()
    state = {
        "topic_id": topic_id,
        "segment_id": segment_id,
        "style": style,
        "voice_id": voice_id,
        "voice_name": "",
        "language": language,
        "status": "idle",
    }
    r.set(_key(cid, "state"), json.dumps(state))
    r.set(_key(cid, "messages"), "[]")
    r.set(_key(cid, "chunk_count"), 0)
    _refresh_ttl(r, cid)


def delete_conversation(cid):
    r = _get_redis()
    for suffix in ("messages", "scene_config", "state", "chunks", "chunk_count"):
        r.delete(_key(cid, suffix))


# ── Build system prompt ──

def _build_system_prompt(segment, state, scene_config):
    template_docs = ""
    for tid, t in TEMPLATES.items():
        props = ", ".join(f"{k}: {v}" for k, v in t["props"].items())
        template_docs += f'  • {tid} — {t["description"]} Props: {props}\n'

    style_docs = "\n".join(f'  • {k} — {v}' for k, v in STYLES.items())

    from batch_generate import ELEVENLABS_LANGUAGES
    lang_list = ", ".join(f'{v["name"]} ({k})' for k, v in ELEVENLABS_LANGUAGES.items())

    config_block = json.dumps(scene_config, indent=2) if scene_config else "No scenes composed yet."

    return f"""You are the Motion Director for FireScroll — a creative AI that helps users compose animated video scenes.

CURRENT SEGMENT:
- Title: {segment.get("title", "")}
- Hook: {segment.get("hook", "")}
- Script: {segment.get("script", "")}
- Visual Direction: {segment.get("visual_cue", "")}
- Series: {segment.get("series_title", "")}

CURRENT SCENE CONFIG:
{config_block}

CURRENT SETTINGS:
- Style: {state.get("style", "cinematic")}
- Voice: {state.get("voice_name") or state.get("voice_id") or "Default"}
- Language: {state.get("language") or "English"}

AVAILABLE TEMPLATES:
{template_docs}

AVAILABLE STYLES:
{style_docs}

AUDIO CAPABILITIES:
- ElevenLabs TTS with 10+ premium voices
- Translation to 30 languages: {lang_list}
- AI background music generation
- Voice style presets (natural, dramatic, energetic, calm, storyteller)

SCENE CONFIG FORMAT:
{{
  "fps": 30, "width": 1080, "height": 1920,
  "scenes": [
    {{"template": "<id>", "from": <frame>, "durationInFrames": <frames>, "props": {{...}}}}
  ]
}}

RULES:
- Be concise and conversational. You are a creative collaborator.
- ALWAYS use tools when modifying scenes, voice, style, or language.
- After composing scenes, include :::scene_config:::  to show the visual layout.
- When suggesting voices, include :::voice_picker::: to show the selection UI.
- When suggesting languages, include :::language_picker::: to show options.
- When discussing styles, include :::style_picker::: to show choices.
- When showing template options, include :::template_showcase["id1","id2"]::: blocks.
- Ask smart follow-up questions — don't overwhelm with all options at once.
- Proactively suggest voice/language AFTER scenes are composed.
- fps=30, vertical 1080x1920. Scenes must not overlap in time.
- Use 3-6 scenes. Start with title_reveal or fact_card, end with cta_outro.
- Keep narrative scenes under 50 words each.
- On first message, introduce yourself briefly, propose initial scenes based on the segment content, and ask for creative direction."""


# ── Agent tools ──

def _make_tools(cid):
    """Create tool functions bound to a conversation ID."""
    from agents import function_tool

    @function_tool
    def compose_scenes(scene_config: dict) -> str:
        """Replace the entire scene composition. Use when proposing a full video layout."""
        if "scenes" not in scene_config or not scene_config["scenes"]:
            return "Error: scene_config must have a non-empty 'scenes' array."
        scene_config.setdefault("fps", 30)
        scene_config.setdefault("width", 1080)
        scene_config.setdefault("height", 1920)
        set_scene_config(cid, scene_config)
        n = len(scene_config["scenes"])
        total_s = max(s["from"] + s["durationInFrames"] for s in scene_config["scenes"]) / 30
        return f"Scene config updated: {n} scenes, {total_s:.1f}s total. Include :::scene_config::: in your response to show it."

    @function_tool
    def update_scene(scene_index: int, updates: dict) -> str:
        """Update a specific scene's properties. Pass only the fields to change."""
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene index {scene_index} out of range."
        config["scenes"][scene_index].update(updates)
        set_scene_config(cid, config)
        return f"Scene {scene_index} updated. Include :::scene_config::: to show changes."

    @function_tool
    def add_scene(position: int, template: str, duration_frames: int, props: dict) -> str:
        """Insert a new scene at the given position (0-indexed)."""
        if template not in TEMPLATES:
            return f"Error: unknown template '{template}'. Available: {list(TEMPLATES.keys())}"
        config = get_scene_config(cid) or {"fps": 30, "width": 1080, "height": 1920, "scenes": []}
        scenes = config["scenes"]
        # Calculate 'from' based on position
        if position <= 0:
            start = 0
        elif position >= len(scenes):
            start = scenes[-1]["from"] + scenes[-1]["durationInFrames"] if scenes else 0
        else:
            start = scenes[position]["from"]
            # Shift subsequent scenes forward
            for s in scenes[position:]:
                s["from"] += duration_frames
        new_scene = {"template": template, "from": start,
                     "durationInFrames": duration_frames, "props": props}
        scenes.insert(position, new_scene)
        set_scene_config(cid, config)
        return f"Added {template} at position {position}. Include :::scene_config::: to show."

    @function_tool
    def remove_scene(scene_index: int) -> str:
        """Remove a scene by index."""
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene index {scene_index} out of range."
        removed = config["scenes"].pop(scene_index)
        # Close the gap — shift subsequent scenes back
        dur = removed["durationInFrames"]
        for s in config["scenes"][scene_index:]:
            s["from"] = max(0, s["from"] - dur)
        set_scene_config(cid, config)
        return f"Removed scene {scene_index} ({removed['template']}). Include :::scene_config::: to show."

    @function_tool
    def reorder_scenes(new_order: list) -> str:
        """Reorder scenes. Provide list of current indices in desired order, e.g. [2,0,1,3]."""
        config = get_scene_config(cid)
        if not config:
            return "Error: no scene config exists."
        scenes = config["scenes"]
        if sorted(new_order) != list(range(len(scenes))):
            return f"Error: new_order must be a permutation of [0..{len(scenes)-1}]."
        reordered = [scenes[i] for i in new_order]
        # Recalculate 'from' values sequentially
        cursor = 0
        for s in reordered:
            s["from"] = cursor
            cursor += s["durationInFrames"]
        config["scenes"] = reordered
        set_scene_config(cid, config)
        return "Scenes reordered. Include :::scene_config::: to show."

    @function_tool
    def set_style(style: str) -> str:
        """Change the visual style for the video."""
        if style not in STYLES:
            return f"Error: unknown style '{style}'. Available: {list(STYLES.keys())}"
        r = _get_redis()
        state = get_conversation_state(cid) or {}
        state["style"] = style
        r.set(_key(cid, "state"), json.dumps(state))
        return f"Style set to '{style}'. Include :::style_picker::: if showing options."

    @function_tool
    def set_voice(voice_id: str, voice_name: str) -> str:
        """Select an ElevenLabs voice for narration."""
        r = _get_redis()
        state = get_conversation_state(cid) or {}
        state["voice_id"] = voice_id
        state["voice_name"] = voice_name
        r.set(_key(cid, "state"), json.dumps(state))
        return f"Voice set to '{voice_name}' ({voice_id})."

    @function_tool
    def set_language(language_code: str) -> str:
        """Set the translation language. Use 'en' for English (no translation)."""
        from batch_generate import ELEVENLABS_LANGUAGES
        if language_code not in ELEVENLABS_LANGUAGES:
            return f"Error: unsupported language '{language_code}'. Available: {list(ELEVENLABS_LANGUAGES.keys())}"
        r = _get_redis()
        state = get_conversation_state(cid) or {}
        state["language"] = language_code
        r.set(_key(cid, "state"), json.dumps(state))
        name = ELEVENLABS_LANGUAGES[language_code]["name"]
        return f"Language set to {name} ({language_code}). Text will be translated before TTS."

    @function_tool
    def list_voices() -> str:
        """Get available ElevenLabs voices. Returns voice list and triggers voice picker UI."""
        try:
            from voice import get_provider
            tts = get_provider("elevenlabs")
            voices = tts.list_voices()
            voice_text = "\n".join(f"  • {v['name']} ({v['id']})" for v in voices[:15])
            return f"Available voices:\n{voice_text}\n\nInclude :::voice_picker::: to show the selection UI."
        except Exception as e:
            return f"Could not load voices: {e}"

    @function_tool
    def list_languages() -> str:
        """Get available translation languages. Triggers language picker UI."""
        from batch_generate import ELEVENLABS_LANGUAGES
        lang_text = "\n".join(f"  • {v['name']} ({k})" for k, v in ELEVENLABS_LANGUAGES.items())
        return f"Available languages:\n{lang_text}\n\nInclude :::language_picker::: to show the selection UI."

    return [compose_scenes, update_scene, add_scene, remove_scene,
            reorder_scenes, set_style, set_voice, set_language,
            list_voices, list_languages]


# ── Main agent runner ──

def run_chat_agent(conversation_id, user_message, topic_id, segment_id=None,
                   style=None, voice_id=None, language=None):
    """Run the chat agent for one turn. Called by Celery task."""
    from agents import Agent, Runner
    from openai.types.responses import ResponseTextDeltaEvent

    cid = conversation_id
    r = _get_redis()

    # Initialize conversation if new
    state = get_conversation_state(cid)
    if not state:
        init_conversation(cid, topic_id, segment_id or "",
                          style=style or "cinematic",
                          voice_id=voice_id or "",
                          language=language or "")
        state = get_conversation_state(cid)

    # Update settings if provided
    if style:
        state["style"] = style
    if voice_id:
        state["voice_id"] = voice_id
    if language:
        state["language"] = language
    r.set(_key(cid, "state"), json.dumps(state))

    set_status(cid, "thinking")
    clear_chunks(cid)

    try:
        # Load segment data
        from db import get_segments_for_topic, get_topic
        topic = get_topic(state["topic_id"])
        segments = get_segments_for_topic(state["topic_id"])

        segment = None
        if state.get("segment_id"):
            segment = next((s for s in segments if s["id"] == state["segment_id"]), None)
        if not segment:
            segment = next((s for s in segments if s["status"] == "ready"), None)
        if not segment:
            set_status(cid, "error")
            push_chunk(cid, "No ready segments found.")
            return

        seg_data = {
            "title": segment["title"],
            "hook": segment["hook"],
            "script": segment["script"],
            "visual_cue": segment.get("visual_cue") or "",
            "series_title": topic.get("series_title") or topic["title"],
            "source_urls": segment.get("source_urls") or "",
        }

        # Load current scene config
        scene_config = get_scene_config(cid)

        # Build agent
        system_prompt = _build_system_prompt(seg_data, state, scene_config)
        tools = _make_tools(cid)

        agent = Agent(
            name="Motion Director",
            instructions=system_prompt,
            tools=tools,
            model="gpt-4o",
        )

        # Build input messages
        history = get_conversation_history(cid)
        input_msgs = []
        for msg in history:
            input_msgs.append({"role": msg["role"], "content": msg["content"]})

        # Add current user message
        if user_message:
            input_msgs.append({"role": "user", "content": user_message})
            append_message(cid, "user", user_message)
        else:
            # Empty message = initialization, agent sends greeting
            input_msgs.append({"role": "user", "content": "Hello, I'd like to create a video for this segment."})
            append_message(cid, "user", "[Started new conversation]")

        # Run agent with streaming
        full_response = ""

        async def _run():
            nonlocal full_response
            result = Runner.run_streamed(agent, input=input_msgs)
            async for event in result.stream_events():
                if event.type == "raw_response_event" and isinstance(event.data, ResponseTextDeltaEvent):
                    delta = event.data.delta
                    if delta:
                        push_chunk(cid, delta)
                        full_response += delta

        asyncio.run(_run())

        # Save complete assistant message
        append_message(cid, "assistant", full_response)
        set_status(cid, "done")

    except Exception as exc:
        err = f"{type(exc).__name__}: {str(exc)[:300]}"
        set_status(cid, "error")
        push_chunk(cid, f"\n\n[Error: {err}]")
        append_message(cid, "assistant", f"[Error: {err}]")
        print(f"[ChatAgent] ERROR: {err}")
