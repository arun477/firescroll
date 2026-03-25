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
    for suffix in ("messages", "scene_config", "state", "chunks", "chunk_count", "custom_code"):
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
    for suffix in ("messages", "scene_config", "state", "chunks", "chunk_count", "custom_code"):
        r.delete(_key(cid, suffix))


# ── Build system prompt ──

def _build_system_prompt(segment, state, scene_config):
    template_docs = ""
    for tid, t in TEMPLATES.items():
        props = ", ".join(f"{k}: {v}" for k, v in t["props"].items())
        template_docs += f'  • {tid} — {t["description"]}\n    Props: {props}\n'

    style_docs = "\n".join(f'  • {k} — {v}' for k, v in STYLES.items())

    from batch_generate import ELEVENLABS_LANGUAGES
    lang_list = ", ".join(f'{v["name"]} ({k})' for k, v in list(ELEVENLABS_LANGUAGES.items())[:10])

    has_scenes = bool(scene_config and scene_config.get("scenes"))
    config_block = json.dumps(scene_config, indent=2) if has_scenes else "NONE — compose scenes first."

    # Get render status
    render_status = "No renders yet"
    try:
        from db import get_remotion_jobs_for_topic, get_segments_for_topic, REMOTION_ACTIVE
        if state.get("topic_id") and state.get("segment_id"):
            jobs = get_remotion_jobs_for_topic(state["topic_id"])
            segs = get_segments_for_topic(state["topic_id"])
            seg = next((s for s in segs if s["id"] == state["segment_id"]), None)
            if seg:
                seg_jobs = [j for j in jobs if j["segment_id"] == seg["segment_num"]]
                if seg_jobs:
                    latest = seg_jobs[0]
                    if latest["status"] in REMOTION_ACTIVE:
                        render_status = f"RENDERING ({latest['status']}, {latest.get('progress', 0)}%)"
                    elif latest["status"] == "done":
                        render_status = "COMPLETE — video is ready. User can iterate."
                    else:
                        render_status = f"FAILED: {(latest.get('error') or '')[:100]}"
    except Exception:
        pass

    return f"""You are the Motion Director — an AI creative collaborator that composes animated video scenes.

## SEGMENT CONTENT
Title: {segment.get("title", "")}
Hook: {segment.get("hook", "")}
Script: {segment.get("script", "")}
Visual Direction: {segment.get("visual_cue", "")}
Series: {segment.get("series_title", "")}

## CURRENT STATE
Scene Config: {config_block}
Style: {state.get("style", "cinematic")} | Voice: {state.get("voice_name") or state.get("voice_id") or "Not set"} | Language: {state.get("language") or "English"}
Render Status: {render_status}

## TEMPLATES
{template_docs}

## STYLES
{style_docs}

## AUDIO
Voices: 10+ ElevenLabs voices (use list_voices to show picker)
Languages: {lang_list}... and 20 more (use list_languages to show picker)

## BEHAVIOR RULES

1. FIRST MESSAGE: Briefly greet (1 sentence), compose 4-5 scenes using compose_scenes, show :::scene_config:::, then ask "Want to adjust anything or pick a voice?" Keep it SHORT — the scene card shows the details. Do NOT list every template/prop in text.

2. ACTION OVER TALK: When user requests ANY change, IMMEDIATELY use the right tool:
   - "change background to white" → expand_to_generic if needed → set_scene_prop(0, "props.backgroundColor", '"#ffffff"')
   - "make text bigger" → set_scene_prop(0, "props.textLayers.0.fontSize", '96')
   - "change text color to red" → set_scene_prop(0, "props.textLayers.0.color", '"#E63250"')
   - "add particles" → set_scene_prop(0, "props.particles", 'true')
   - "remove particles" → set_scene_prop(0, "props.particles", 'false')
   - "make it longer" → set_scene_prop(0, "durationInFrames", '180')
   - "add a stat" → add_scene with fact_card template
   - "remove the CTA" → remove_scene
   - "use Spanish" → set_language
   - "change voice" → list_voices to show picker, then set_voice when they pick
   For VISUAL changes: expand_to_generic first (if not already generic), then set_scene_prop.
   For STRUCTURAL changes: use add_scene/remove_scene/reorder_scenes.
   The live preview updates AUTOMATICALLY — no need to trigger_render for preview.
   Only trigger_render when user wants the FINAL video with audio.
   DO NOT just acknowledge — ALWAYS use the tool, THEN confirm what you did.

3. AFTER TOOL CALLS: Include :::scene_config::: to show the updated layout. Keep your text to 1-2 sentences MAX — the visual card speaks for itself. NEVER list scene details as text when the card shows them.

4. RENDER FLOW: After composing scenes, ask about voice/language. When user says "go"/"render"/"start" → trigger_render. After render completes, tell user "Video is ready! Want to make any changes?"

5. ITERATION: When render_status is COMPLETE and user requests changes, modify scenes with tools and CALL trigger_render to re-render. Don't ask "should I render?" — just do it. The user asked for the change, they want to see it.

6. PICKERS: Use :::voice_picker::: :::language_picker::: :::style_picker::: to show interactive UI. Don't list options as text when a picker is available.

7. SCENE FORMAT: fps=30, 1080x1920 vertical. Scenes must not overlap. 3-6 scenes. Start with title_reveal or fact_card, end with cta_outro. Max 50 words per narrative scene. Total duration should be ~30s for short, ~60s for long.

8. CUSTOM ANIMATIONS: When user requests creative animations that templates can't handle (bouncing ball, particle effects, physics, spinning shapes, creative motion graphics), use write_scene_code to write React/Remotion code. The code is a JS function body receiving: React, AbsoluteFill, spring, interpolate, frame, fps, width, height. Return React.createElement() calls (NOT JSX). Code is validated server-side — if it fails, you'll see the error. Fix and retry. The user won't see failed attempts.
   When writing custom code, tell the user: "Writing animation code..." before the first attempt. If it takes multiple tries, say "Refining the animation..." When it succeeds: "Animation ready! Check the preview."
   Use frame-based math: frame increments each frame at 30fps. Always use width/height for responsive positioning."""


# ── Agent tools ──

def _make_tools(cid):
    """Create tool functions bound to a conversation ID."""
    from agents import function_tool

    @function_tool
    def compose_scenes(scene_config_json: str) -> str:
        """Replace the entire scene composition. Pass the full scene config as a JSON string.
        Format: {"fps":30,"width":1080,"height":1920,"scenes":[{"template":"...","from":0,"durationInFrames":120,"props":{...}}]}"""
        try:
            scene_config = json.loads(scene_config_json)
        except (json.JSONDecodeError, TypeError):
            return "Error: invalid JSON. Pass a valid scene config JSON string."
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
    def update_scene(scene_index: int, updates_json: str) -> str:
        """Update a specific scene's properties. Pass updates as JSON string, e.g. '{"props":{"title":"New Title"}}'"""
        try:
            updates = json.loads(updates_json)
        except (json.JSONDecodeError, TypeError):
            return "Error: invalid JSON for updates."
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene index {scene_index} out of range."
        scene = config["scenes"][scene_index]
        if "props" in updates and "props" in scene:
            scene["props"].update(updates.pop("props"))
        scene.update(updates)
        set_scene_config(cid, config)
        return f"Scene {scene_index} updated. Include :::scene_config::: to show changes."

    @function_tool
    def add_scene(position: int, template: str, duration_frames: int, props_json: str) -> str:
        """Insert a new scene. props_json is a JSON string of the template props."""
        if template not in TEMPLATES:
            return f"Error: unknown template '{template}'. Available: {list(TEMPLATES.keys())}"
        try:
            props = json.loads(props_json)
        except (json.JSONDecodeError, TypeError):
            return "Error: invalid JSON for props."
        config = get_scene_config(cid) or {"fps": 30, "width": 1080, "height": 1920, "scenes": []}
        scenes = config["scenes"]
        if position <= 0:
            start = 0
        elif position >= len(scenes):
            start = scenes[-1]["from"] + scenes[-1]["durationInFrames"] if scenes else 0
        else:
            start = scenes[position]["from"]
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
    def reorder_scenes(new_order_json: str) -> str:
        """Reorder scenes. Pass JSON array of indices in desired order, e.g. '[2,0,1,3]'."""
        try:
            new_order = json.loads(new_order_json)
        except (json.JSONDecodeError, TypeError):
            return "Error: invalid JSON. Pass a JSON array of indices."
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

    @function_tool
    def trigger_render() -> str:
        """Start rendering the video with the current scene config, voice, and language settings.
        Call this when the user confirms they want to render, OR when they request changes after a previous render (re-render)."""
        config = get_scene_config(cid)
        if not config or not config.get("scenes"):
            return "Error: no scene config to render. Compose scenes first."
        r = _get_redis()
        r.set(_key(cid, "render_requested"), "1")
        r.expire(_key(cid, "render_requested"), 300)
        return "Render requested! The video will start generating with the current scene config."

    @function_tool
    def get_render_status() -> str:
        """Check the current render status for this segment."""
        state = get_conversation_state(cid)
        if not state:
            return "No conversation state found."
        from db import get_remotion_jobs_for_topic, REMOTION_ACTIVE
        jobs = get_remotion_jobs_for_topic(state["topic_id"])
        seg_id = state.get("segment_id")
        # Find segment number from segment id
        from db import get_segments_for_topic
        segs = get_segments_for_topic(state["topic_id"])
        seg = next((s for s in segs if s["id"] == seg_id), None)
        if not seg:
            return "Segment not found."
        seg_num = seg["segment_num"]
        seg_jobs = [j for j in jobs if j["segment_id"] == seg_num]
        if not seg_jobs:
            return "No renders found for this segment. Compose scenes and trigger a render."
        latest = seg_jobs[0]  # ordered by created_at DESC
        if latest["status"] in REMOTION_ACTIVE:
            return f"Render in progress: {latest['status']} ({latest.get('progress', 0)}%)"
        elif latest["status"] == "done":
            return "Latest render is COMPLETE. You can modify scenes and re-render, or the user can watch the video."
        else:
            return f"Latest render FAILED: {latest.get('error', 'unknown error')[:200]}"

    @function_tool
    def set_scene_prop(scene_index: int, prop_path: str, value_json: str) -> str:
        """Set any property on a scene using a dot-path.
        Examples:
          set_scene_prop(0, "props.backgroundColor", '"#ffffff"')
          set_scene_prop(0, "props.textLayers.0.fontSize", '96')
          set_scene_prop(0, "props.particles", 'false')
          set_scene_prop(0, "props.textLayers.0.color", '"#E63250"')
          set_scene_prop(0, "durationInFrames", '180')
        """
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene index {scene_index} out of range."
        try:
            value = json.loads(value_json)
        except (json.JSONDecodeError, TypeError):
            return f"Error: invalid JSON value: {value_json}"
        # Navigate the dot path
        parts = prop_path.split(".")
        obj = config["scenes"][scene_index]
        for part in parts[:-1]:
            if part.isdigit():
                idx = int(part)
                if not isinstance(obj, list) or idx >= len(obj):
                    return f"Error: index {idx} out of range in path '{prop_path}'"
                obj = obj[idx]
            else:
                if part not in obj:
                    obj[part] = {}
                obj = obj[part]
        final_key = parts[-1]
        if final_key.isdigit() and isinstance(obj, list):
            obj[int(final_key)] = value
        else:
            obj[final_key] = value
        set_scene_config(cid, config)
        return f"Set {prop_path} = {value_json} on scene {scene_index}. The live preview will update automatically."

    @function_tool
    def expand_to_generic(scene_index: int) -> str:
        """Convert a template-based scene (title_reveal, fact_card, etc.) to a generic scene
        with direct visual properties. This enables fine-grained control over every visual element.
        Call this before using set_scene_prop on template scenes."""
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene index {scene_index} out of range."
        scene = config["scenes"][scene_index]
        if scene["template"] == "generic":
            return f"Scene {scene_index} is already generic. You can modify any property with set_scene_prop."
        from remotion_templates import expand_template_to_generic
        state = get_conversation_state(cid)
        style = state.get("style", "cinematic") if state else "cinematic"
        expanded = expand_template_to_generic(scene["template"], scene.get("props", {}), style)
        if not expanded:
            return f"Error: cannot expand template '{scene['template']}'."
        # Preserve timing
        expanded["from"] = scene["from"]
        expanded["durationInFrames"] = scene["durationInFrames"]
        config["scenes"][scene_index] = expanded
        set_scene_config(cid, config)
        props_summary = json.dumps(list(expanded["props"].keys()))
        return f"Scene {scene_index} expanded to generic. Available props: {props_summary}. Use set_scene_prop to modify any property."

    @function_tool
    def write_scene_code(scene_index: int, code: str) -> str:
        """Write custom React/Remotion animation code for a scene.
        The code is a JavaScript function body that must return a React element using React.createElement().

        Available in scope:
        - React (use React.createElement, NOT JSX)
        - AbsoluteFill — full-screen container element tag
        - spring({frame, fps, config}) — Remotion spring physics animation
        - interpolate(value, inputRange, outputRange) — map values between ranges
        - useCurrentFrame() — returns current frame number
        - useVideoConfig() — returns {fps, width, height, durationInFrames}
        - frame (number) — current frame (0, 1, 2... at 30fps)
        - fps (number) — 30
        - width (number) — 1080
        - height (number) — 1920

        Example — bouncing ball:
        var y = height/2 - 40 + Math.sin(frame / 10 * Math.PI) * 200;
        return React.createElement(AbsoluteFill, {style: {background: '#0a0a0f'}},
          React.createElement('div', {style: {
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #E63250, #f97316)',
            position: 'absolute', left: width/2 - 40, top: y,
            boxShadow: '0 0 40px rgba(230,50,80,0.6)'
          }})
        );
        """
        import requests as _req
        remotion_url = os.environ.get("REMOTION_API_URL", "http://remotion-studio:3600")

        try:
            resp = _req.post(
                f"{remotion_url}/validate-code",
                json={"code": code, "scene_index": scene_index},
                timeout=5,
            )
            result = resp.json()
        except Exception as e:
            return f"Error: could not reach Remotion server: {e}"

        if not result.get("valid"):
            error = result.get("error", "Unknown error")
            phase = result.get("phase", "unknown")
            return f"Code validation FAILED ({phase}): {error}\n\nFix the error and call write_scene_code again."

        # Valid — store in Redis
        r = _get_redis()
        custom_key = _key(cid, "custom_code")
        existing = r.get(custom_key)
        custom_map = json.loads(existing) if existing else {}
        custom_map[str(scene_index)] = code
        r.set(custom_key, json.dumps(custom_map))
        r.expire(custom_key, CONV_TTL)

        # Ensure scene_config has a slot for this scene
        config = get_scene_config(cid)
        if config:
            scenes = config.get("scenes", [])
            if scene_index < len(scenes):
                scenes[scene_index]["template"] = "custom_code"
            else:
                last_end = max((s["from"] + s["durationInFrames"] for s in scenes), default=0)
                scenes.append({
                    "template": "custom_code",
                    "from": last_end,
                    "durationInFrames": 150,
                    "props": {},
                })
            config["scenes"] = scenes
            set_scene_config(cid, config)

        return f"Custom code validated and saved for scene {scene_index}. The live preview will update automatically."

    return [compose_scenes, update_scene, add_scene, remove_scene,
            reorder_scenes, set_style, set_voice, set_language,
            list_voices, list_languages, trigger_render, get_render_status,
            set_scene_prop, expand_to_generic, write_scene_code]


# ── Main agent runner ──

def run_chat_agent(conversation_id, user_message, topic_id, segment_id=None,
                   style=None, voice_id=None, language=None):
    """Run the chat agent for one turn. Called by Celery task."""
    # Set OpenAI API key for the Agents SDK
    from keystore import get_key
    api_key = get_key("openai")
    if api_key:
        os.environ["OPENAI_API_KEY"] = api_key

    from agents import Agent, Runner
    from openai.types.responses import ResponseTextDeltaEvent

    cid = conversation_id
    r = _get_redis()

    # Server already set status="thinking" and cleared chunks before dispatch.
    # Ensure conversation exists (defensive — server should have init'd).
    state = get_conversation_state(cid)
    if not state:
        init_conversation(cid, topic_id, segment_id or "",
                          style=style or "cinematic",
                          voice_id=voice_id or "",
                          language=language or "")
        state = get_conversation_state(cid)
        set_status(cid, "thinking")

    # Update settings if provided
    if style:
        state["style"] = style
    if voice_id:
        state["voice_id"] = voice_id
    if language:
        state["language"] = language
    r.set(_key(cid, "state"), json.dumps(state))

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
            model="gpt-5.4",
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
