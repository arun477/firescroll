"""AI Chat Agent for Motion Studio.

Direct OpenAI API with main agent + sub-agent pattern.
Main agent: creative director (talks to user, lean context).
Sub-agent: Remotion specialist (iterates scene code with validation).
"""
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone

import redis

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
    for suffix in ("messages", "scene_config", "state", "chunks", "custom_code", "ui_events"):
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


def set_status(cid, new_status):
    """Atomically update only the status field using WATCH/MULTI for safety."""
    r = _get_redis()
    key = _key(cid, "state")
    # Retry loop for optimistic locking
    for _ in range(3):
        try:
            with r.pipeline() as pipe:
                pipe.watch(key)
                raw = pipe.get(key)
                state = json.loads(raw) if raw else {}
                state["status"] = new_status
                pipe.multi()
                pipe.set(key, json.dumps(state))
                pipe.execute()
                return
        except redis.WatchError:
            continue
    # Fallback: non-atomic write (better than losing the update entirely)
    state = get_conversation_state(cid) or {}
    state["status"] = new_status
    r.set(key, json.dumps(state))


def push_chunk(cid, text):
    r = _get_redis()
    r.rpush(_key(cid, "chunks"), text)


def push_tool_event(cid, event_type, tool_name, **kwargs):
    """Emit tool_call/tool_result event for SSE activity card."""
    r = _get_redis()
    event = {"type": event_type, "tool": tool_name, **kwargs}
    r.rpush(_key(cid, "ui_events"), json.dumps(event))


def clear_chunks(cid):
    r = _get_redis()
    r.delete(_key(cid, "chunks"))
    r.delete(_key(cid, "ui_events"))


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
    _refresh_ttl(r, cid)


def delete_conversation(cid):
    r = _get_redis()
    for suffix in ("messages", "scene_config", "state", "chunks", "custom_code", "ui_events"):
        r.delete(_key(cid, suffix))


# ── Code-first helpers ──

def _get_code_summary(cid):
    """Return a summary of existing scene code for the system prompt."""
    r = _get_redis()
    raw = r.get(_key(cid, "custom_code"))
    if not raw:
        return "No scenes written yet."
    code_map = json.loads(raw)
    if not code_map:
        return "No scenes written yet."
    lines = []
    for idx in sorted(code_map.keys(), key=int):
        snippet = code_map[idx].replace("\n", " ")[:80]
        lines.append(f"  Scene {idx}: {snippet}...")
    return "\n".join(lines)


def _reindex_custom_code(cid, removed_index):
    """Shift custom_code keys down after a scene is removed."""
    r = _get_redis()
    raw = r.get(_key(cid, "custom_code"))
    if not raw:
        return
    old_map = json.loads(raw)
    new_map = {}
    for k, v in old_map.items():
        i = int(k)
        if i == removed_index:
            continue
        new_key = i - 1 if i > removed_index else i
        new_map[str(new_key)] = v
    r.set(_key(cid, "custom_code"), json.dumps(new_map))
    r.expire(_key(cid, "custom_code"), CONV_TTL)


def _reindex_custom_code_reorder(cid, new_order):
    """Remap custom_code keys according to a new scene order."""
    r = _get_redis()
    raw = r.get(_key(cid, "custom_code"))
    if not raw:
        return
    old_map = json.loads(raw)
    new_map = {}
    for new_idx, old_idx in enumerate(new_order):
        code = old_map.get(str(old_idx))
        if code:
            new_map[str(new_idx)] = code
    r.set(_key(cid, "custom_code"), json.dumps(new_map))
    r.expire(_key(cid, "custom_code"), CONV_TTL)


# ── Build system prompt ──

def _build_system_prompt(segment, state, scene_config, cid=None):
    from batch_generate import ELEVENLABS_LANGUAGES
    lang_list = ", ".join(f'{v["name"]} ({k})' for k, v in list(ELEVENLABS_LANGUAGES.items())[:10])

    has_scenes = bool(scene_config and scene_config.get("scenes"))
    config_block = json.dumps(scene_config, indent=2) if has_scenes else "NONE — create scenes first."

    code_summary = _get_code_summary(cid) if cid else "No scenes written yet."

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

    return f"""You are the Motion Director — an AI creative director that composes animated video scenes by writing React/Remotion code. You have FULL creative control. Every scene is code you write.

## SEGMENT CONTENT
Title: {segment.get("title", "")}
Hook: {segment.get("hook", "")}
Script: {segment.get("script", "")}
Visual Direction: {segment.get("visual_cue", "")}
Series: {segment.get("series_title", "")}

## CURRENT STATE
Scene Config: {config_block}
Scene Code:
{code_summary}
Voice: {state.get("voice_name") or state.get("voice_id") or "Not set"} | Language: {state.get("language") or "English"}
Render Status: {render_status}

## CODE ENVIRONMENT
Format: 1080×1920 vertical, 30fps
Syntax: React.createElement() only — NO JSX
Must return: a React element

Available in scope:
  React, AbsoluteFill, spring, interpolate, useCurrentFrame, useVideoConfig,
  frame (current frame 0,1,2...), fps (30), width (1080), height (1920)

spring({{ frame, fps, config: {{ damping: 15, mass: 0.8 }} }}) → 0..1 physics ease
interpolate(value, [inMin, inMax], [outMin, outMax]) → mapped value

## CODE PATTERNS (adapt freely)

PATTERN: Animated title with spring entrance
```
var progress = spring({{ frame, fps, config: {{ damping: 14 }} }});
var titleY = interpolate(progress, [0, 1], [100, 0]);
var titleOp = interpolate(progress, [0, 1], [0, 1]);
return React.createElement(AbsoluteFill, {{style: {{background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center'}}}},
  React.createElement('div', {{style: {{fontSize: 72, fontWeight: 800, color: '#fff', textAlign: 'center', transform: 'translateY(' + titleY + 'px)', opacity: titleOp, padding: '0 60px'}}}}, 'Your Title')
);
```

PATTERN: Counter/stat animation
```
var target = 92;
var count = Math.min(Math.floor(frame * 1.5), target);
return React.createElement(AbsoluteFill, {{style: {{background: '#0a0a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}}},
  React.createElement('div', {{style: {{fontSize: 140, fontWeight: 900, color: '#E63250'}}}}, count + 'M'),
  React.createElement('div', {{style: {{fontSize: 32, color: '#ffffffaa', marginTop: 20}}}}, 'Active Users')
);
```

PATTERN: Word-by-word text reveal
```
var words = 'Your text goes here and reveals word by word'.split(' ');
var wordsPerSec = 3;
var visibleCount = Math.min(Math.floor(frame / fps * wordsPerSec), words.length);
var children = words.map(function(w, i) {{
  var op = i < visibleCount ? 1 : 0.15;
  var color = i < visibleCount ? '#ffffff' : '#ffffff33';
  return React.createElement('span', {{key: i, style: {{opacity: op, color: color, transition: 'opacity 0.1s'}}}}, w + ' ');
}});
return React.createElement(AbsoluteFill, {{style: {{background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 80px'}}}},
  React.createElement('div', {{style: {{fontSize: 44, fontWeight: 600, lineHeight: 1.5, textAlign: 'center'}}}}, children)
);
```

PATTERN: Staggered bullet points
```
var points = ['Point one', 'Point two', 'Point three'];
var items = points.map(function(p, i) {{
  var delay = i * 12;
  var prog = spring({{ frame: Math.max(0, frame - delay), fps, config: {{ damping: 14 }} }});
  var x = interpolate(prog, [0, 1], [60, 0]);
  return React.createElement('div', {{key: i, style: {{fontSize: 36, color: '#fff', opacity: prog, transform: 'translateX(' + x + 'px)', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16}}}},
    React.createElement('div', {{style: {{width: 10, height: 10, borderRadius: '50%', background: '#E63250'}}}}, null),
    p
  );
}});
return React.createElement(AbsoluteFill, {{style: {{background: '#0a0a0f', padding: '200px 100px', justifyContent: 'center'}}}},
  React.createElement('div', {{style: {{fontSize: 52, fontWeight: 800, color: '#fff', marginBottom: 60}}}}, 'Heading'),
  React.createElement('div', null, items)
);
```

PATTERN: CTA outro with pulsing ring
```
var pulse = Math.sin(frame / 15) * 0.15 + 1;
var prog = spring({{ frame, fps, config: {{ damping: 12 }} }});
return React.createElement(AbsoluteFill, {{style: {{background: '#0a0a0f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}}},
  React.createElement('div', {{style: {{width: 200, height: 200, borderRadius: '50%', border: '3px solid #E63250', transform: 'scale(' + pulse + ')', opacity: prog * 0.6, position: 'absolute'}}}}, null),
  React.createElement('div', {{style: {{fontSize: 56, fontWeight: 800, color: '#fff', textAlign: 'center', opacity: prog, padding: '0 60px'}}}}, 'Call to Action'),
  React.createElement('div', {{style: {{fontSize: 24, color: '#ffffff88', marginTop: 20, opacity: prog}}}}, 'Supporting text')
);
```

## AUDIO
Voices: 10+ ElevenLabs voices (use list_voices to show picker)
Languages: {lang_list}... and 20 more (use list_languages to show picker)

## BEHAVIOR

You are a creative collaborator. Chat naturally — respond to what the user says.

- If the user greets or asks a question, respond conversationally. Don't immediately call tools.
- If the user asks to create/compose scenes, call compose_scenes with a creative brief based on the segment content and their direction.
- If the user asks to change something ("white background", "bigger text"), call update_scenes.
- If the user says "render" / "go" / "start", call trigger_render.
- If the user asks about voices, call list_voices. If they pick one, call set_voice.
- If the user asks about languages, call list_languages.

After scene tools complete, show :::scene_config::: to display the layout. Keep text to 1-2 sentences after tool calls.

Use your judgment — not every message needs a tool call. Be helpful and concise.

Guardrails: 1080×1920 vertical, 30fps, 3-6 scenes, min font 28."""


# ── Low-level scene helpers (used by sub-agent directly) ──

def _create_scene_for_cid(cid, duration_frames, position):
    """Create a scene slot. Used by sub-agent."""
    config = get_scene_config(cid) or {"fps": 30, "width": 1080, "height": 1920, "scenes": []}
    scenes = config["scenes"]
    pos = max(0, min(int(position), len(scenes)))
    duration_frames = int(duration_frames)
    if pos == 0:
        start = 0
    elif pos >= len(scenes):
        start = (scenes[-1]["from"] + scenes[-1]["durationInFrames"]) if scenes else 0
    else:
        start = scenes[pos]["from"]
    for s in scenes[pos:]:
        s["from"] += duration_frames
    scenes.insert(pos, {"template": "custom_code", "from": start,
                         "durationInFrames": duration_frames, "props": {}})
    config["scenes"] = scenes
    set_scene_config(cid, config)
    return f"Scene {pos} created."


def _read_scene_code_for_cid(cid, scene_index):
    """Read scene code. Used by sub-agent."""
    r = _get_redis()
    raw = r.get(_key(cid, "custom_code"))
    if not raw:
        return "No scene code exists yet."
    code_map = json.loads(raw)
    return code_map.get(str(int(scene_index)), f"No code for scene {scene_index}.")


def _write_scene_code_for_cid(cid, scene_index, code):
    """Write + validate scene code. Used by sub-agent."""
    scene_index = int(scene_index)
    config = get_scene_config(cid)
    if not config or scene_index >= len(config.get("scenes", [])):
        return f"Error: scene {scene_index} doesn't exist."
    import requests as _req
    remotion_url = os.environ.get("REMOTION_API_URL", "http://remotion-studio:3600")
    try:
        resp = _req.post(f"{remotion_url}/validate-code",
                         json={"code": code, "scene_index": scene_index}, timeout=10)
        result = resp.json()
    except Exception as e:
        return f"Error: Remotion server unreachable: {e}"
    if not result.get("valid"):
        return f"Code validation FAILED ({result.get('phase','?')}): {result.get('error','?')}"
    r = _get_redis()
    custom_key = _key(cid, "custom_code")
    existing = r.get(custom_key)
    custom_map = json.loads(existing) if existing else {}
    custom_map[str(scene_index)] = code
    r.set(custom_key, json.dumps(custom_map))
    r.expire(custom_key, CONV_TTL)
    config["scenes"][scene_index]["template"] = "custom_code"
    set_scene_config(cid, config)
    return f"Scene {scene_index} code saved."


# ── Tool functions (plain functions, no SDK decorators) ──

def _make_tools(cid):
    """Create tool functions bound to a conversation ID. Returns (tool_map, tool_schemas)."""

    def create_scene(duration_frames, position):
        config = get_scene_config(cid) or {"fps": 30, "width": 1080, "height": 1920, "scenes": []}
        scenes = config["scenes"]
        pos = max(0, min(int(position), len(scenes)))
        duration_frames = int(duration_frames)
        if pos == 0:
            start = 0
        elif pos >= len(scenes):
            start = (scenes[-1]["from"] + scenes[-1]["durationInFrames"]) if scenes else 0
        else:
            start = scenes[pos]["from"]
        for s in scenes[pos:]:
            s["from"] += duration_frames
        new_scene = {"template": "custom_code", "from": start,
                     "durationInFrames": duration_frames, "props": {}}
        scenes.insert(pos, new_scene)
        config["scenes"] = scenes
        set_scene_config(cid, config)
        return f"Scene {pos} created ({duration_frames}f = {duration_frames/30:.1f}s)."

    def read_scene_code(scene_index):
        r = _get_redis()
        raw = r.get(_key(cid, "custom_code"))
        if not raw:
            return "No scene code exists yet."
        code_map = json.loads(raw)
        return code_map.get(str(int(scene_index)), f"No code for scene {scene_index}.")

    def set_scene_timing(scene_index, duration_frames):
        scene_index, duration_frames = int(scene_index), int(duration_frames)
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene {scene_index} out of range."
        old_dur = config["scenes"][scene_index]["durationInFrames"]
        config["scenes"][scene_index]["durationInFrames"] = duration_frames
        diff = duration_frames - old_dur
        for s in config["scenes"][scene_index + 1:]:
            s["from"] += diff
        set_scene_config(cid, config)
        return f"Scene {scene_index} duration set to {duration_frames}f ({duration_frames/30:.1f}s)."

    def remove_scene(scene_index):
        scene_index = int(scene_index)
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene {scene_index} out of range."
        removed = config["scenes"].pop(scene_index)
        dur = removed["durationInFrames"]
        for s in config["scenes"][scene_index:]:
            s["from"] = max(0, s["from"] - dur)
        set_scene_config(cid, config)
        _reindex_custom_code(cid, scene_index)
        return f"Removed scene {scene_index}."

    def reorder_scenes(new_order_json):
        try:
            new_order = json.loads(new_order_json)
        except (json.JSONDecodeError, TypeError):
            return "Error: invalid JSON."
        config = get_scene_config(cid)
        if not config:
            return "Error: no scene config."
        scenes = config["scenes"]
        if sorted(new_order) != list(range(len(scenes))):
            return f"Error: must be permutation of [0..{len(scenes)-1}]."
        reordered = [scenes[i] for i in new_order]
        cursor = 0
        for s in reordered:
            s["from"] = cursor
            cursor += s["durationInFrames"]
        config["scenes"] = reordered
        set_scene_config(cid, config)
        _reindex_custom_code_reorder(cid, new_order)
        return "Scenes reordered."

    def write_scene_code(scene_index, code):
        scene_index = int(scene_index)
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene {scene_index} doesn't exist."
        import requests as _req
        remotion_url = os.environ.get("REMOTION_API_URL", "http://remotion-studio:3600")
        try:
            resp = _req.post(f"{remotion_url}/validate-code",
                             json={"code": code, "scene_index": scene_index}, timeout=5)
            result = resp.json()
        except Exception as e:
            return f"Error: Remotion server unreachable: {e}"
        if not result.get("valid"):
            return f"Code validation FAILED ({result.get('phase','?')}): {result.get('error','?')}"
        r = _get_redis()
        custom_key = _key(cid, "custom_code")
        existing = r.get(custom_key)
        custom_map = json.loads(existing) if existing else {}
        custom_map[str(scene_index)] = code
        r.set(custom_key, json.dumps(custom_map))
        r.expire(custom_key, CONV_TTL)
        config["scenes"][scene_index]["template"] = "custom_code"
        set_scene_config(cid, config)
        return f"Scene {scene_index} code saved."

    def set_voice(voice_id, voice_name):
        r = _get_redis()
        state = get_conversation_state(cid) or {}
        state["voice_id"] = voice_id
        state["voice_name"] = voice_name
        r.set(_key(cid, "state"), json.dumps(state))
        return f"Voice set to '{voice_name}'."

    def set_language(language_code):
        from batch_generate import ELEVENLABS_LANGUAGES
        if language_code not in ELEVENLABS_LANGUAGES:
            return f"Error: unsupported language '{language_code}'."
        r = _get_redis()
        state = get_conversation_state(cid) or {}
        state["language"] = language_code
        r.set(_key(cid, "state"), json.dumps(state))
        return f"Language set to {ELEVENLABS_LANGUAGES[language_code]['name']}."

    def list_voices():
        try:
            from voice import get_provider
            tts = get_provider("elevenlabs")
            voices = tts.list_voices()
            voice_text = "\n".join(f"  - {v['name']} ({v['id']})" for v in voices[:15])
            return f"Available voices:\n{voice_text}"
        except Exception as e:
            return f"Could not load voices: {e}"

    def list_languages():
        from batch_generate import ELEVENLABS_LANGUAGES
        lang_text = "\n".join(f"  - {v['name']} ({k})" for k, v in ELEVENLABS_LANGUAGES.items())
        return f"Available languages:\n{lang_text}"

    def trigger_render():
        config = get_scene_config(cid)
        if not config or not config.get("scenes"):
            return "Error: no scenes to render."
        r = _get_redis()
        r.set(_key(cid, "render_requested"), "1")
        r.expire(_key(cid, "render_requested"), 300)
        return "Render requested."

    def get_render_status():
        state = get_conversation_state(cid)
        if not state:
            return "No conversation."
        from db import get_remotion_jobs_for_topic, REMOTION_ACTIVE, get_segments_for_topic
        jobs = get_remotion_jobs_for_topic(state["topic_id"])
        segs = get_segments_for_topic(state["topic_id"])
        seg = next((s for s in segs if s["id"] == state.get("segment_id")), None)
        if not seg:
            return "Segment not found."
        seg_jobs = [j for j in jobs if j["segment_id"] == seg["segment_num"]]
        if not seg_jobs:
            return "No renders yet."
        latest = seg_jobs[0]
        if latest["status"] in REMOTION_ACTIVE:
            return f"Rendering: {latest['status']} ({latest.get('progress', 0)}%)"
        elif latest["status"] == "done":
            return "Render COMPLETE."
        return f"FAILED: {latest.get('error', 'unknown')[:200]}"

    def compose_scenes(creative_brief, num_scenes=5):
        """Compose multiple scenes using the Remotion sub-agent. Handles create + code generation + validation."""
        return _run_scene_subagent(cid, creative_brief, num_scenes=int(num_scenes), mode="create")

    def update_scenes(creative_brief, scene_indices_json="all"):
        """Update existing scenes using the Remotion sub-agent. Pass 'all' or JSON array of indices."""
        config = get_scene_config(cid)
        if not config or not config.get("scenes"):
            return "Error: no scenes to update."
        if scene_indices_json == "all":
            indices = list(range(len(config["scenes"])))
        else:
            try:
                indices = json.loads(scene_indices_json)
            except (json.JSONDecodeError, TypeError):
                indices = list(range(len(config["scenes"])))
        return _run_scene_subagent(cid, creative_brief, scene_indices=indices, mode="update")

    tool_map = {
        "compose_scenes": compose_scenes,
        "update_scenes": update_scenes,
        "set_voice": set_voice,
        "set_language": set_language,
        "list_voices": list_voices,
        "list_languages": list_languages,
        "trigger_render": trigger_render,
        "get_render_status": get_render_status,
        "remove_scene": remove_scene,
        "reorder_scenes": reorder_scenes,
        "set_scene_timing": set_scene_timing,
    }
    return tool_map


# ── Tool schemas for OpenAI function calling ──

TOOL_SCHEMAS = [
    {"type": "function", "function": {
        "name": "compose_scenes", "description": "Compose multiple animated scenes for the video. The Remotion sub-agent creates scenes, generates React code, and validates each against the renderer. Use this for initial scene creation.",
        "parameters": {"type": "object", "properties": {
            "creative_brief": {"type": "string", "description": "Creative direction for the scenes. Include visual style, mood, colors, what each scene should show."},
            "num_scenes": {"type": "integer", "description": "Number of scenes (3-6)", "default": 5},
        }, "required": ["creative_brief"]},
    }},
    {"type": "function", "function": {
        "name": "update_scenes", "description": "Update existing scenes based on user feedback. The sub-agent reads current code, modifies it, and validates. Use for 'change background', 'bigger text', etc.",
        "parameters": {"type": "object", "properties": {
            "creative_brief": {"type": "string", "description": "What to change. E.g. 'white background on all scenes', 'make title text bigger'."},
            "scene_indices_json": {"type": "string", "description": "JSON array of scene indices to update, or 'all'", "default": "all"},
        }, "required": ["creative_brief"]},
    }},
    {"type": "function", "function": {
        "name": "set_voice", "description": "Set the narration voice.",
        "parameters": {"type": "object", "properties": {
            "voice_id": {"type": "string"}, "voice_name": {"type": "string"},
        }, "required": ["voice_id", "voice_name"]},
    }},
    {"type": "function", "function": {
        "name": "set_language", "description": "Set translation language. Use 'en' for English.",
        "parameters": {"type": "object", "properties": {
            "language_code": {"type": "string"},
        }, "required": ["language_code"]},
    }},
    {"type": "function", "function": {
        "name": "list_voices", "description": "Get available ElevenLabs voices.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "list_languages", "description": "Get available languages.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "trigger_render", "description": "Start final video render with audio.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "get_render_status", "description": "Check render progress.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "remove_scene", "description": "Remove a scene by index.",
        "parameters": {"type": "object", "properties": {
            "scene_index": {"type": "integer"},
        }, "required": ["scene_index"]},
    }},
    {"type": "function", "function": {
        "name": "reorder_scenes", "description": "Reorder scenes. Pass JSON array of indices.",
        "parameters": {"type": "object", "properties": {
            "new_order_json": {"type": "string", "description": "JSON array like '[2,0,1,3]'"},
        }, "required": ["new_order_json"]},
    }},
    {"type": "function", "function": {
        "name": "set_scene_timing", "description": "Change a scene's duration in frames.",
        "parameters": {"type": "object", "properties": {
            "scene_index": {"type": "integer"},
            "duration_frames": {"type": "integer", "description": "Duration in frames (30fps). 120=4s, 150=5s."},
        }, "required": ["scene_index", "duration_frames"]},
    }},
]

# ── Tool display labels for SSE activity card ──

_TOOL_DISPLAY = {
    "compose_scenes": lambda a: f"Composing {a.get('num_scenes', 5)} scenes...",
    "update_scenes": lambda a: f"Updating scenes: {a.get('creative_brief', '?')[:50]}",
    "set_voice": lambda a: f"Setting voice: {a.get('voice_name', '?')}",
    "set_language": lambda a: f"Setting language: {a.get('language_code', '?')}",
    "list_voices": lambda _: "Loading voices",
    "list_languages": lambda _: "Loading languages",
    "trigger_render": lambda _: "Starting render",
    "get_render_status": lambda _: "Checking render",
    "remove_scene": lambda a: f"Removing scene {a.get('scene_index', '?')}",
    "reorder_scenes": lambda _: "Reordering scenes",
    "set_scene_timing": lambda a: f"Timing scene {a.get('scene_index', '?')}",
}


def _tool_display_label(name, args):
    fn = _TOOL_DISPLAY.get(name)
    return fn(args) if fn else f"Running {name}"


# ── Remotion sub-agent (OpenAI Agents SDK — handles generate→validate→retry natively) ──

SCENE_CODE_INSTRUCTIONS = """You are a Remotion scene code writer. You write React/Remotion animation code and validate it.

WORKFLOW: Write the code, then call submit_scene_code to validate and save it. If validation fails, fix the errors and call submit_scene_code again.

CODE RULES:
- Format: 1080x1920 vertical, 30fps
- Syntax: React.createElement() only — NO JSX
- Must return a React element
- Available: React, AbsoluteFill, spring, interpolate, frame, fps (30), width (1080), height (1920)
- spring({ frame, fps, config: { damping: 15 } }) returns 0..1
- interpolate(value, [inMin, inMax], [outMin, outMax]) returns mapped number
- Min font size 28. Dark backgrounds (#0a0a0f).
- Do NOT wrap in markdown fences. Just the raw function body."""


def _run_scene_subagent(cid, brief, num_scenes=5, scene_indices=None, mode="create"):
    """Uses OpenAI Agents SDK for iterative code generation + Remotion validation."""
    import asyncio
    from keystore import get_key
    from agents import Agent, Runner, function_tool

    os.environ["OPENAI_API_KEY"] = get_key("openai") or ""

    results = []

    # Create scene slots first (fast, no LLM needed)
    if mode == "create":
        scene_indices = list(range(num_scenes))
        durations = [120, 150, 150, 150, 90]
        for i in range(num_scenes):
            dur = durations[i] if i < len(durations) else 150
            push_tool_event(cid, "tool_call", "scene_code",
                            display=f"Creating scene {i}...", call_id=f"sc_{i}")
            _create_scene_for_cid(cid, duration_frames=dur, position=i)
            push_tool_event(cid, "tool_result", "scene_code",
                            status="completed", label=f"Scene {i} slot ready",
                            call_id=f"sc_{i}")

    # For each scene, run an SDK agent that writes + validates code
    for scene_idx in (scene_indices or []):
        call_id = f"code_{scene_idx}_{uuid.uuid4().hex[:6]}"
        action = "Writing" if mode == "create" else "Updating"
        push_tool_event(cid, "tool_call", "scene_code",
                        display=f"{action} scene {scene_idx} code...", call_id=call_id)

        # Create a submit tool bound to this scene
        @function_tool
        def submit_scene_code(code: str) -> str:
            """Validate and save scene code to the Remotion renderer. Call this with your generated code."""
            clean = re.sub(r'^```\w*\n?', '', code.strip())
            clean = re.sub(r'\n?```$', '', clean.strip())
            return _write_scene_code_for_cid(cid, scene_idx, clean)

        # Build context
        existing_code = None
        if mode == "update":
            existing_code = _read_scene_code_for_cid(cid, scene_idx)
            if existing_code.startswith("No "):
                existing_code = None

        existing_block = f"Existing code to modify:\n{existing_code}" if existing_code else ""
        prompt = f"Creative brief: {brief}\nScene {scene_idx}. {existing_block}\nWrite the code and call submit_scene_code."

        agent = Agent(
            name="SceneCodeWriter",
            instructions=SCENE_CODE_INSTRUCTIONS,
            tools=[submit_scene_code],
            model="gpt-5.4",
        )

        try:
            run_result = asyncio.run(Runner.run(agent, input=prompt, max_turns=6))
            final = run_result.final_output or ""
            if "saved" in final.lower() or "FAILED" not in final:
                results.append(f"Scene {scene_idx}: OK")
                push_tool_event(cid, "tool_result", "scene_code",
                                status="completed", label=f"Scene {scene_idx} saved",
                                call_id=call_id)
            else:
                results.append(f"Scene {scene_idx}: failed")
                push_tool_event(cid, "tool_result", "scene_code",
                                status="failed", label=f"Scene {scene_idx} failed",
                                call_id=call_id)
        except Exception as e:
            print(f"[SubAgent] Scene {scene_idx} error: {e}")
            results.append(f"Scene {scene_idx}: error")
            push_tool_event(cid, "tool_result", "scene_code",
                            status="failed", label=f"Scene {scene_idx}: {str(e)[:50]}",
                            call_id=call_id)

    total_frames = 0
    config = get_scene_config(cid)
    if config and config.get("scenes"):
        total_frames = sum(s["durationInFrames"] for s in config["scenes"])

    return f"{'Composed' if mode == 'create' else 'Updated'} {len(results)} scenes ({total_frames/30:.0f}s total). {'; '.join(results)}"


# ── Main agent runner (direct OpenAI API, multi-turn loop) ──

MAX_TURNS = 15  # Main agent only — sub-agent handles heavy iteration separately


def run_chat_agent(conversation_id, user_message, topic_id, segment_id=None,
                   style=None, voice_id=None, language=None):
    """Run the main creative director agent. Called by Celery task."""
    from keystore import get_key
    from openai import OpenAI

    api_key = get_key("openai")
    if not api_key:
        set_status(conversation_id, "error")
        push_chunk(conversation_id, "[Error: No OpenAI API key]")
        return

    client = OpenAI(api_key=api_key)
    cid = conversation_id
    r = _get_redis()

    state = get_conversation_state(cid)
    if not state:
        init_conversation(cid, topic_id, segment_id or "",
                          style=style or "cinematic",
                          voice_id=voice_id or "",
                          language=language or "")
        state = get_conversation_state(cid)
        set_status(cid, "thinking")

    if style:
        state["style"] = style
    if voice_id:
        state["voice_id"] = voice_id
    if language:
        state["language"] = language
    r.set(_key(cid, "state"), json.dumps(state))

    try:
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

        scene_config = get_scene_config(cid)
        system_prompt = _build_system_prompt(seg_data, state, scene_config, cid=cid)
        tool_map = _make_tools(cid)

        # Build messages for OpenAI API
        messages = [{"role": "system", "content": system_prompt}]
        history = get_conversation_history(cid)
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})

        if user_message:
            messages.append({"role": "user", "content": user_message})
            append_message(cid, "user", user_message)
        else:
            messages.append({"role": "user", "content": "Hello, I'd like to create a video for this segment."})
            append_message(cid, "user", "[Started new conversation]")

        # ── Multi-turn loop ──
        full_response = ""

        for turn in range(MAX_TURNS):
            remaining = MAX_TURNS - turn

            # Force-answer nudge near limit
            use_tools = TOOL_SCHEMAS if remaining > 1 else None
            if remaining <= 3 and turn > 0:
                messages.append({"role": "system",
                    "content": f"[{remaining} turns left. Wrap up and respond to the user now.]"})

            # Stream from OpenAI
            stream = client.chat.completions.create(
                model="gpt-5.4",
                messages=messages,
                tools=use_tools,
                stream=True,
            )

            turn_text = ""
            tool_calls_accum = {}

            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                # Text content → stream to frontend
                if delta.content:
                    turn_text += delta.content
                    full_response += delta.content
                    push_chunk(cid, delta.content)

                # Tool calls → accumulate incrementally
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_accum:
                            tool_calls_accum[idx] = {"id": "", "name": "", "arguments": ""}
                        if tc.id:
                            tool_calls_accum[idx]["id"] = tc.id
                        if tc.function and tc.function.name:
                            tool_calls_accum[idx]["name"] = tc.function.name
                        if tc.function and tc.function.arguments:
                            tool_calls_accum[idx]["arguments"] += tc.function.arguments

            # No tool calls → final answer, done
            if not tool_calls_accum:
                break

            # Append assistant message with tool_calls
            assistant_msg = {"role": "assistant", "content": turn_text or None, "tool_calls": []}
            for idx in sorted(tool_calls_accum.keys()):
                tc = tool_calls_accum[idx]
                assistant_msg["tool_calls"].append({
                    "id": tc["id"], "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments"]},
                })
            messages.append(assistant_msg)

            # Execute tool calls
            for idx in sorted(tool_calls_accum.keys()):
                tc = tool_calls_accum[idx]
                tool_name = tc["name"]
                tool_call_id = tc["id"]
                try:
                    args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                except json.JSONDecodeError:
                    args = {}

                # Emit tool_call event to SSE
                display = _tool_display_label(tool_name, args)
                push_tool_event(cid, "tool_call", tool_name,
                                display=display, call_id=tool_call_id)

                # Execute (dispatcher pattern — safer than func(**args))
                func = tool_map.get(tool_name)
                if func:
                    try:
                        import inspect
                        sig = inspect.signature(func)
                        # Only pass args that the function accepts
                        valid_args = {k: v for k, v in args.items() if k in sig.parameters}
                        result = str(func(**valid_args))
                    except Exception as e:
                        import traceback
                        result = f"Error: {type(e).__name__}: {e}"
                        print(f"[ChatAgent] Tool {tool_name} failed: {traceback.format_exc()}")
                else:
                    result = f"Unknown tool: {tool_name}"

                # Emit tool_result event
                push_tool_event(cid, "tool_result", tool_name,
                                status="completed", label=result[:100],
                                call_id=tool_call_id)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "content": result,
                })

        # Save final response
        append_message(cid, "assistant", full_response)
        set_status(cid, "done")

    except Exception as exc:
        err = f"{type(exc).__name__}: {str(exc)[:300]}"
        set_status(cid, "error")
        push_chunk(cid, f"\n\n[Error: {err}]")
        append_message(cid, "assistant", f"[Error: {err}]")
        print(f"[ChatAgent] ERROR: {err}")
