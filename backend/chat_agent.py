"""AI Chat Agent for Motion Studio.

Uses OpenAI Agents SDK with function tools to drive scene composition
through conversational interaction. State stored in Redis.
"""
import asyncio
import json
import os
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
    for suffix in ("messages", "scene_config", "state", "chunks", "custom_code",
                    "ui_events", "ui_state"):
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
    set_ui_state(cid, {"phase": "setup", "active_tools": {}, "pending_input": None})
    _refresh_ttl(r, cid)


def delete_conversation(cid):
    r = _get_redis()
    for suffix in ("messages", "scene_config", "state", "chunks", "custom_code",
                    "ui_events", "ui_state"):
        r.delete(_key(cid, suffix))


# ── Tool UI Protocol ──
# Structured event system for rendering interactive UI components from tool calls.
# Tools push events → SSE streams them → frontend renders from flags (not text markers).

VALID_PHASE_TRANSITIONS = {
    "setup": ["configuring", "composing"],
    "configuring": ["composing", "configuring"],
    "composing": ["reviewing", "configuring", "rendering", "composing"],
    "reviewing": ["rendering", "composing"],
    "rendering": ["reviewing", "done", "composing"],
    "done": ["composing"],
}


def _generate_tool_id():
    return f"tc_{uuid.uuid4().hex[:8]}"


def push_ui_event(cid, event):
    """Push a structured UI event for real-time SSE streaming."""
    r = _get_redis()
    r.rpush(_key(cid, "ui_events"), json.dumps(event))


def get_ui_state(cid):
    """Get persistent UI state for recovery on page reload."""
    r = _get_redis()
    raw = r.get(_key(cid, "ui_state"))
    if not raw:
        return {"phase": "setup", "active_tools": {}, "pending_input": None}
    return json.loads(raw)


def set_ui_state(cid, state):
    r = _get_redis()
    r.set(_key(cid, "ui_state"), json.dumps(state))
    r.expire(_key(cid, "ui_state"), CONV_TTL)


def transition_phase(cid, new_phase):
    """Transition agent phase with validation. Returns True if transition is valid."""
    ui = get_ui_state(cid)
    current = ui.get("phase", "setup")
    allowed = VALID_PHASE_TRANSITIONS.get(current, [])
    if new_phase not in allowed and current != new_phase:
        return False
    ui["phase"] = new_phase
    set_ui_state(cid, ui)
    push_ui_event(cid, {"type": "phase_change", "from": current, "to": new_phase})
    return True


def register_tool_ui(cid, tool_name, component, props=None, awaiting_input=False):
    """Register a tool's UI artifact for frontend rendering. Returns tool_id."""
    tool_id = _generate_tool_id()
    ui = get_ui_state(cid)
    status = "awaiting_input" if awaiting_input else "completed"
    tool_obj = {
        "tool_id": tool_id,
        "tool_name": tool_name,
        "status": status,
        "component": component,
        "props": props or {},
    }
    ui["active_tools"][tool_id] = tool_obj
    if awaiting_input:
        ui["pending_input"] = {"tool_id": tool_id, "component": component}
    set_ui_state(cid, ui)
    push_ui_event(cid, {
        "type": "tool_ui",
        "tool_id": tool_id,
        "action": "show",
        "component": component,
        "props": props or {},
        "status": status,
    })
    return tool_id


def complete_tool_ui(cid, tool_id):
    """Mark a tool's UI as completed and dismiss it from the frontend."""
    ui = get_ui_state(cid)
    if tool_id in ui["active_tools"]:
        del ui["active_tools"][tool_id]
    if ui.get("pending_input", {}).get("tool_id") == tool_id:
        ui["pending_input"] = None
    set_ui_state(cid, ui)
    push_ui_event(cid, {"type": "tool_ui", "tool_id": tool_id, "action": "dismiss"})


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

## BEHAVIOR RULES

1. GUIDED SETUP (first message):
   a) Greet the user in 1 sentence, mentioning the segment title.
   b) Call list_voices — this automatically shows the voice picker UI to the user.
   c) Say "Pick a voice and tell me your creative direction, or say 'surprise me' to jump right in."
   d) Do NOT create any scenes until the user responds with a preference or says "go"/"surprise me".

2. COMPOSE PHASE (after user provides input or picks a voice):
   a) Acknowledge briefly if user selected a voice.
   b) Create 4-5 scenes with create_scene and write code for each with write_scene_code.
      Base scenes on segment content: hook → opening, script → middle, visual_cue → creative direction.
      Default durations: opening 4s (120f), content 5s (150f), closing 3s (90f). Total ~25-30s.
   c) Show :::scene_config::: after composing. Keep text to 1-2 sentences.
   d) Ask "Want to adjust anything, or should I render?"

3. ACTION OVER TALK: When user requests ANY change, act immediately:
   - Visual change → read_scene_code → modify → write_scene_code
   - Global change ("all scenes white") → loop through each scene index
   - Structural change → use remove_scene/reorder_scenes/create_scene
   - Timing change → set_scene_timing
   - Voice/language → list_voices/set_voice or list_languages/set_language
   DO NOT just acknowledge — use the tool, THEN confirm in 1-2 sentences.

4. ERROR RECOVERY: If write_scene_code fails, fix and retry up to 3x silently.

5. AFTER TOOL CALLS: Show :::scene_config::: for layout changes. Keep text minimal. NEVER list scene details, timing, or descriptions as text — the scene config card shows everything. No "Scene 0: ...", no frame counts.

6. RENDER FLOW: Before rendering, check voice is set. If not, call list_voices first. When user says "go"/"render"/"start" → trigger_render.

7. ITERATION: For post-render changes, modify scenes and trigger_render again without asking.

8. PICKERS: Do NOT write :::voice_picker::: or :::language_picker::: in your text. Picker UIs appear automatically when you call list_voices or list_languages. Just call the tool — the frontend handles display.

9. GUARDRAILS: Always 1080×1920 vertical, 30fps. 3-6 scenes. Sequential timing. Min font 28. Use width/height for responsive positioning."""


# ── Agent tools ──

def _make_tools(cid):
    """Create tool functions bound to a conversation ID."""
    from agents import function_tool

    @function_tool
    def create_scene(duration_frames: int, position: int) -> str:
        """Create an empty scene slot at the given position. Shifts subsequent scenes.
        After creating, use write_scene_code to fill it with animation code.
        Duration is in frames (30fps). E.g. 120 = 4 seconds, 150 = 5 seconds."""
        config = get_scene_config(cid) or {"fps": 30, "width": 1080, "height": 1920, "scenes": []}
        scenes = config["scenes"]
        pos = max(0, min(position, len(scenes)))
        if pos == 0:
            start = 0
        elif pos >= len(scenes):
            start = (scenes[-1]["from"] + scenes[-1]["durationInFrames"]) if scenes else 0
        else:
            start = scenes[pos]["from"]
        # Shift subsequent scenes
        for s in scenes[pos:]:
            s["from"] += duration_frames
        new_scene = {"template": "custom_code", "from": start,
                     "durationInFrames": duration_frames, "props": {}}
        scenes.insert(pos, new_scene)
        config["scenes"] = scenes
        set_scene_config(cid, config)
        transition_phase(cid, "composing")
        return f"Scene {pos} created ({duration_frames}f = {duration_frames/30:.1f}s). Now write code with write_scene_code({pos}, code)."

    @function_tool
    def read_scene_code(scene_index: int) -> str:
        """Read the current code for a scene. Use this before modifying existing scenes."""
        r = _get_redis()
        raw = r.get(_key(cid, "custom_code"))
        if not raw:
            return "No scene code exists yet."
        code_map = json.loads(raw)
        code = code_map.get(str(scene_index))
        if not code:
            return f"No code found for scene {scene_index}."
        return code

    @function_tool
    def set_scene_timing(scene_index: int, duration_frames: int) -> str:
        """Change a scene's duration and recalculate timing for all subsequent scenes."""
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene index {scene_index} out of range."
        old_dur = config["scenes"][scene_index]["durationInFrames"]
        config["scenes"][scene_index]["durationInFrames"] = duration_frames
        diff = duration_frames - old_dur
        for s in config["scenes"][scene_index + 1:]:
            s["from"] += diff
        set_scene_config(cid, config)
        return f"Scene {scene_index} duration set to {duration_frames}f ({duration_frames/30:.1f}s)."

    @function_tool
    def remove_scene(scene_index: int) -> str:
        """Remove a scene by index."""
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene index {scene_index} out of range."
        removed = config["scenes"].pop(scene_index)
        dur = removed["durationInFrames"]
        for s in config["scenes"][scene_index:]:
            s["from"] = max(0, s["from"] - dur)
        set_scene_config(cid, config)
        _reindex_custom_code(cid, scene_index)
        return f"Removed scene {scene_index}. Include :::scene_config::: to show."

    @function_tool
    def reorder_scenes(new_order_json: str) -> str:
        """Reorder scenes. Pass JSON array of indices, e.g. '[2,0,1,3]'."""
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
        return "Scenes reordered. Include :::scene_config::: to show."

    @function_tool
    def write_scene_code(scene_index: int, code: str) -> str:
        """Write React/Remotion code for a scene. The code is a JS function body that must return
        a React element via React.createElement() (NOT JSX).

        Available: React, AbsoluteFill, spring, interpolate, useCurrentFrame, useVideoConfig,
        frame, fps (30), width (1080), height (1920).

        The scene must already exist (use create_scene first)."""
        config = get_scene_config(cid)
        if not config or scene_index >= len(config.get("scenes", [])):
            return f"Error: scene {scene_index} doesn't exist. Use create_scene first."

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

        # Store in Redis
        r = _get_redis()
        custom_key = _key(cid, "custom_code")
        existing = r.get(custom_key)
        custom_map = json.loads(existing) if existing else {}
        custom_map[str(scene_index)] = code
        r.set(custom_key, json.dumps(custom_map))
        r.expire(custom_key, CONV_TTL)

        # Mark scene as custom_code
        config["scenes"][scene_index]["template"] = "custom_code"
        set_scene_config(cid, config)
        transition_phase(cid, "composing")

        return f"Scene {scene_index} code saved. Preview updates automatically."

    @function_tool
    def set_voice(voice_id: str, voice_name: str) -> str:
        """Select an ElevenLabs voice for narration."""
        r = _get_redis()
        state = get_conversation_state(cid) or {}
        state["voice_id"] = voice_id
        state["voice_name"] = voice_name
        r.set(_key(cid, "state"), json.dumps(state))
        # Dismiss any active voice picker
        ui = get_ui_state(cid)
        for tid, t in list(ui["active_tools"].items()):
            if t["component"] == "voice_picker":
                complete_tool_ui(cid, tid)
        return f"Voice set to '{voice_name}'."

    @function_tool
    def set_language(language_code: str) -> str:
        """Set the translation language. Use 'en' for English (no translation)."""
        from batch_generate import ELEVENLABS_LANGUAGES
        if language_code not in ELEVENLABS_LANGUAGES:
            return f"Error: unsupported language '{language_code}'."
        r = _get_redis()
        state = get_conversation_state(cid) or {}
        state["language"] = language_code
        r.set(_key(cid, "state"), json.dumps(state))
        name = ELEVENLABS_LANGUAGES[language_code]["name"]
        # Dismiss any active language picker
        ui = get_ui_state(cid)
        for tid, t in list(ui["active_tools"].items()):
            if t["component"] == "language_picker":
                complete_tool_ui(cid, tid)
        return f"Language set to {name} ({language_code})."

    @function_tool
    def list_voices() -> str:
        """Get available voices and show the voice picker UI to the user."""
        try:
            from voice import get_provider
            tts = get_provider("elevenlabs")
            voices = tts.list_voices()
            state = get_conversation_state(cid) or {}
            register_tool_ui(cid, "list_voices", "voice_picker",
                props={"current": state.get("voice_id", "")},
                awaiting_input=True)
            transition_phase(cid, "configuring")
            voice_text = "\n".join(f"  - {v['name']}" for v in voices[:15])
            return f"Voices available:\n{voice_text}\nVoice picker is shown to the user. Wait for their selection."
        except Exception as e:
            return f"Could not load voices: {e}"

    @function_tool
    def list_languages() -> str:
        """Get available translation languages and show the language picker UI."""
        from batch_generate import ELEVENLABS_LANGUAGES
        state = get_conversation_state(cid) or {}
        register_tool_ui(cid, "list_languages", "language_picker",
            props={"current": state.get("language", "en")},
            awaiting_input=True)
        lang_text = "\n".join(f"  - {v['name']} ({k})" for k, v in ELEVENLABS_LANGUAGES.items())
        return f"Languages available:\n{lang_text}\nLanguage picker is shown to the user. Wait for their selection."

    @function_tool
    def trigger_render() -> str:
        """Start rendering the final video with audio."""
        config = get_scene_config(cid)
        if not config or not config.get("scenes"):
            return "Error: no scenes to render. Create scenes first."
        r = _get_redis()
        r.set(_key(cid, "render_requested"), "1")
        r.expire(_key(cid, "render_requested"), 300)
        transition_phase(cid, "rendering")
        return "Render requested! Video will generate with current scenes + voice."

    @function_tool
    def get_render_status() -> str:
        """Check render progress."""
        state = get_conversation_state(cid)
        if not state:
            return "No conversation state."
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
            return "Render COMPLETE. Modify and re-render, or user can watch."
        else:
            return f"FAILED: {latest.get('error', 'unknown')[:200]}"

    return [create_scene, read_scene_code, set_scene_timing, write_scene_code,
            remove_scene, reorder_scenes,
            set_voice, set_language, list_voices, list_languages,
            trigger_render, get_render_status]


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
        system_prompt = _build_system_prompt(seg_data, state, scene_config, cid=cid)
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
