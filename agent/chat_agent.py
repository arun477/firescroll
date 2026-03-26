"""Async Chat Agent for Motion Director.

Fully async: AsyncOpenAI for streaming, redis.asyncio for state,
native await Runner.run() for sub-agent, asyncio.gather for parallel scenes.
"""
import asyncio
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone

import redis.asyncio as aioredis

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
CONV_TTL = 86400
REMOTION_API_URL = os.environ.get("REMOTION_API_URL", "http://remotion-studio:3600")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://backend:8500")

_api_key_cache = {}


async def _get_openai_key():
    """Fetch OpenAI API key from backend's keystore."""
    if _api_key_cache.get("openai"):
        return _api_key_cache["openai"]
    # Try env first
    env_key = os.environ.get("OPENAI_API_KEY")
    if env_key:
        _api_key_cache["openai"] = env_key
        return env_key
    # Fetch from backend keystore API
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{BACKEND_URL}/api/keys", timeout=5.0)
            keys = resp.json()
            # keys is a dict: {"openai": "sk-...", "elevenlabs": "..."}
            if isinstance(keys, dict) and keys.get("openai"):
                _api_key_cache["openai"] = keys["openai"]
                return keys["openai"]
    except Exception as e:
        print(f"[Agent] Failed to fetch API key: {e}")
    return None

_redis_pool = None


def _get_redis():
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis_pool


def _now():
    return datetime.now(timezone.utc).isoformat()


def _key(cid, suffix):
    return f"chat:{cid}:{suffix}"


async def _refresh_ttl(r, cid):
    for suffix in ("messages", "scene_config", "state", "chunks", "custom_code", "ui_events"):
        await r.expire(_key(cid, suffix), CONV_TTL)


# ── Async Redis helpers ──

async def get_conversation_state(cid):
    r = _get_redis()
    raw = await r.get(_key(cid, "state"))
    return json.loads(raw) if raw else None


async def get_conversation_history(cid):
    r = _get_redis()
    raw = await r.get(_key(cid, "messages"))
    return json.loads(raw) if raw else []


async def get_scene_config(cid):
    r = _get_redis()
    raw = await r.get(_key(cid, "scene_config"))
    return json.loads(raw) if raw else None


async def set_scene_config(cid, config):
    r = _get_redis()
    await r.set(_key(cid, "scene_config"), json.dumps(config))
    await _refresh_ttl(r, cid)


async def set_status(cid, new_status):
    r = _get_redis()
    key = _key(cid, "state")
    raw = await r.get(key)
    state = json.loads(raw) if raw else {}
    state["status"] = new_status
    await r.set(key, json.dumps(state))


async def push_chunk(cid, text):
    r = _get_redis()
    await r.rpush(_key(cid, "chunks"), text)


async def push_tool_event(cid, event_type, tool_name, **kwargs):
    r = _get_redis()
    event = {"type": event_type, "tool": tool_name, **kwargs}
    await r.rpush(_key(cid, "ui_events"), json.dumps(event))


async def clear_chunks(cid):
    r = _get_redis()
    await r.delete(_key(cid, "chunks"))
    await r.delete(_key(cid, "ui_events"))


async def append_message(cid, role, content, tool_steps=None):
    r = _get_redis()
    msgs = await get_conversation_history(cid)
    msg = {"role": role, "content": content, "timestamp": _now()}
    if tool_steps:
        msg["tool_steps"] = tool_steps
    msgs.append(msg)
    if len(msgs) > 40:
        msgs = msgs[-40:]
    await r.set(_key(cid, "messages"), json.dumps(msgs))
    await _refresh_ttl(r, cid)


async def init_conversation(cid, topic_id, segment_id, style="cinematic",
                            voice_id="", language=""):
    r = _get_redis()
    state = {
        "topic_id": topic_id, "segment_id": segment_id,
        "style": style, "voice_id": voice_id, "voice_name": "",
        "language": language, "status": "idle",
    }
    await r.set(_key(cid, "state"), json.dumps(state))
    await r.set(_key(cid, "messages"), "[]")
    await _refresh_ttl(r, cid)


async def delete_conversation(cid):
    r = _get_redis()
    for suffix in ("messages", "scene_config", "state", "chunks", "custom_code", "ui_events"):
        await r.delete(_key(cid, suffix))


# ── Low-level scene helpers (async) ──

async def _create_scene(cid, duration_frames, position):
    config = await get_scene_config(cid) or {"fps": 30, "width": 1080, "height": 1920, "scenes": []}
    scenes = config["scenes"]
    pos = max(0, min(int(position), len(scenes)))
    duration_frames = int(duration_frames)
    start = 0
    if pos > 0 and scenes:
        if pos >= len(scenes):
            start = scenes[-1]["from"] + scenes[-1]["durationInFrames"]
        else:
            start = scenes[pos]["from"]
    for s in scenes[pos:]:
        s["from"] += duration_frames
    scenes.insert(pos, {"template": "custom_code", "from": start,
                         "durationInFrames": duration_frames, "props": {}})
    config["scenes"] = scenes
    await set_scene_config(cid, config)
    return f"Scene {pos} created."


async def _read_scene_code(cid, scene_index):
    r = _get_redis()
    raw = await r.get(_key(cid, "custom_code"))
    if not raw:
        return "No scene code exists yet."
    code_map = json.loads(raw)
    return code_map.get(str(int(scene_index)), f"No code for scene {scene_index}.")


async def _write_scene_code(cid, scene_index, code):
    """Write + validate scene code against Remotion."""
    scene_index = int(scene_index)
    config = await get_scene_config(cid)
    if not config or scene_index >= len(config.get("scenes", [])):
        return f"Error: scene {scene_index} doesn't exist."
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{REMOTION_API_URL}/validate-code",
                                     json={"code": code, "scene_index": scene_index},
                                     timeout=15.0)
            result = resp.json()
    except Exception as e:
        return f"Error: Remotion unreachable: {e}"
    if not result.get("valid"):
        return f"Code validation FAILED ({result.get('phase','?')}): {result.get('error','?')}"
    r = _get_redis()
    custom_key = _key(cid, "custom_code")
    existing = await r.get(custom_key)
    custom_map = json.loads(existing) if existing else {}
    custom_map[str(scene_index)] = code
    await r.set(custom_key, json.dumps(custom_map))
    await r.expire(custom_key, CONV_TTL)
    config["scenes"][scene_index]["template"] = "custom_code"
    await set_scene_config(cid, config)
    return f"Scene {scene_index} code saved."


async def _get_code_summary(cid):
    r = _get_redis()
    raw = await r.get(_key(cid, "custom_code"))
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


# ── System prompt builder ──

async def _build_system_prompt(segment, state, scene_config, cid=None):
    has_scenes = bool(scene_config and scene_config.get("scenes"))
    config_block = json.dumps(scene_config, indent=2) if has_scenes else "NONE"
    code_summary = await _get_code_summary(cid) if cid else "No scenes written yet."

    return f"""You are the Motion Director — an AI creative director for animated video scenes.

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

## BEHAVIOR
You are a creative collaborator. Chat naturally.

- If the user greets or asks a question, respond conversationally. Don't immediately call tools.
- If the user asks to create/compose scenes, call compose_scenes with a creative brief.
- If the user asks to change something, call update_scenes.
- If the user says "render"/"go"/"start", call trigger_render.
- If the user asks about voices/languages, call list_voices/list_languages.

After scene tools complete, show :::scene_config::: to display the layout. Keep text to 1-2 sentences after tool calls.

Use your judgment — not every message needs a tool call. Be helpful and concise.

Guardrails: 1080x1920 vertical, 30fps, 3-6 scenes, min font 28."""


# ── Tool schemas for OpenAI function calling ──

TOOL_SCHEMAS = [
    {"type": "function", "function": {
        "name": "compose_scenes",
        "description": "Compose multiple animated scenes. The sub-agent creates scenes, generates React/Remotion code, and validates each.",
        "parameters": {"type": "object", "properties": {
            "creative_brief": {"type": "string", "description": "Creative direction for the scenes."},
            "num_scenes": {"type": "integer", "description": "Number of scenes (3-6)", "default": 5},
        }, "required": ["creative_brief"]},
    }},
    {"type": "function", "function": {
        "name": "update_scenes",
        "description": "Update existing scenes based on user feedback.",
        "parameters": {"type": "object", "properties": {
            "creative_brief": {"type": "string", "description": "What to change."},
            "scene_indices_json": {"type": "string", "description": "JSON array of indices or 'all'", "default": "all"},
        }, "required": ["creative_brief"]},
    }},
    {"type": "function", "function": {
        "name": "set_voice", "description": "Set narration voice.",
        "parameters": {"type": "object", "properties": {
            "voice_id": {"type": "string"}, "voice_name": {"type": "string"},
        }, "required": ["voice_id", "voice_name"]},
    }},
    {"type": "function", "function": {
        "name": "set_language", "description": "Set translation language.",
        "parameters": {"type": "object", "properties": {
            "language_code": {"type": "string"},
        }, "required": ["language_code"]},
    }},
    {"type": "function", "function": {
        "name": "list_voices", "description": "Get available voices.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "list_languages", "description": "Get available languages.",
        "parameters": {"type": "object", "properties": {}},
    }},
    {"type": "function", "function": {
        "name": "trigger_render", "description": "Start final video render.",
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
        "name": "set_scene_timing", "description": "Change scene duration in frames.",
        "parameters": {"type": "object", "properties": {
            "scene_index": {"type": "integer"},
            "duration_frames": {"type": "integer"},
        }, "required": ["scene_index", "duration_frames"]},
    }},
]

_TOOL_DISPLAY = {
    "compose_scenes": lambda a: f"Composing {a.get('num_scenes', 5)} scenes...",
    "update_scenes": lambda a: f"Updating scenes...",
    "set_voice": lambda a: f"Setting voice: {a.get('voice_name', '?')}",
    "set_language": lambda a: f"Setting language: {a.get('language_code', '?')}",
    "list_voices": lambda _: "Loading voices",
    "list_languages": lambda _: "Loading languages",
    "trigger_render": lambda _: "Starting render",
    "get_render_status": lambda _: "Checking render",
    "remove_scene": lambda a: f"Removing scene {a.get('scene_index', '?')}",
    "set_scene_timing": lambda a: f"Timing scene {a.get('scene_index', '?')}",
}


# ── Tool execution (async) ──

async def _execute_tool(cid, tool_name, args):
    """Execute a tool call. Returns result string."""
    r = _get_redis()

    if tool_name == "compose_scenes":
        return await _run_scene_subagent(
            cid, args.get("creative_brief", ""),
            num_scenes=int(args.get("num_scenes", 5)), mode="create")

    elif tool_name == "update_scenes":
        config = await get_scene_config(cid)
        if not config or not config.get("scenes"):
            return "Error: no scenes to update."
        indices_raw = args.get("scene_indices_json", "all")
        if indices_raw == "all":
            indices = list(range(len(config["scenes"])))
        else:
            try:
                indices = json.loads(indices_raw)
            except (json.JSONDecodeError, TypeError):
                indices = list(range(len(config["scenes"])))
        return await _run_scene_subagent(
            cid, args.get("creative_brief", ""),
            scene_indices=indices, mode="update")

    elif tool_name == "set_voice":
        state = await get_conversation_state(cid) or {}
        state["voice_id"] = args.get("voice_id", "")
        state["voice_name"] = args.get("voice_name", "")
        await r.set(_key(cid, "state"), json.dumps(state))
        return f"Voice set to '{state['voice_name']}'."

    elif tool_name == "set_language":
        state = await get_conversation_state(cid) or {}
        state["language"] = args.get("language_code", "en")
        await r.set(_key(cid, "state"), json.dumps(state))
        return f"Language set to {state['language']}."

    elif tool_name == "list_voices":
        # Return voice names — the frontend has the full list already
        return "Available voices: Bella, Roger, Sarah, Laura, Charlie, George, Callum, River, Harry, Liam. User can pick from the Voice button."

    elif tool_name == "list_languages":
        return "Available languages: English, Spanish, French, German, Portuguese, Hindi, Japanese, Chinese, Korean, Arabic, and more. User can pick from the Language button."

    elif tool_name == "trigger_render":
        config = await get_scene_config(cid)
        if not config or not config.get("scenes"):
            return "Error: no scenes to render."
        await r.set(_key(cid, "render_requested"), "1")
        await r.expire(_key(cid, "render_requested"), 300)
        return "Render requested."

    elif tool_name == "get_render_status":
        return "Check the render panel for current status."

    elif tool_name == "remove_scene":
        idx = int(args.get("scene_index", 0))
        config = await get_scene_config(cid)
        if not config or idx >= len(config.get("scenes", [])):
            return f"Error: scene {idx} out of range."
        removed = config["scenes"].pop(idx)
        dur = removed["durationInFrames"]
        for s in config["scenes"][idx:]:
            s["from"] = max(0, s["from"] - dur)
        await set_scene_config(cid, config)
        return f"Removed scene {idx}."

    elif tool_name == "set_scene_timing":
        idx = int(args.get("scene_index", 0))
        dur = int(args.get("duration_frames", 150))
        config = await get_scene_config(cid)
        if not config or idx >= len(config.get("scenes", [])):
            return f"Error: scene {idx} out of range."
        old_dur = config["scenes"][idx]["durationInFrames"]
        config["scenes"][idx]["durationInFrames"] = dur
        diff = dur - old_dur
        for s in config["scenes"][idx + 1:]:
            s["from"] += diff
        await set_scene_config(cid, config)
        return f"Scene {idx} duration set to {dur}f."

    return f"Unknown tool: {tool_name}"


# ── Scene sub-agent (parallel, native async) ──

SCENE_CODE_INSTRUCTIONS = """You write React/Remotion animation code and validate it.

WORKFLOW: Write code, then call submit_scene_code to validate. If it fails, fix and retry.

RULES:
- 1080x1920 vertical, 30fps
- React.createElement() only, NO JSX
- Must return a React element
- Available: React, AbsoluteFill, spring, interpolate, frame, fps (30), width (1080), height (1920)
- spring({ frame, fps, config: { damping: 15 } }) returns 0..1
- interpolate(value, [inMin, inMax], [outMin, outMax]) returns number
- Min font 28, dark backgrounds (#0a0a0f)
- No markdown fences. Raw function body only."""


async def _run_scene_for_index(cid, scene_idx, brief, mode, existing_code=None):
    """Run sub-agent for a single scene. Returns (scene_idx, 'OK'|'failed')."""
    from agents import Agent, Runner, function_tool

    call_id = f"code_{scene_idx}_{uuid.uuid4().hex[:6]}"
    action = "Writing" if mode == "create" else "Updating"
    await push_tool_event(cid, "tool_call", "scene_code",
                          display=f"{action} scene {scene_idx} code...", call_id=call_id)

    # Bound tool for this scene
    @function_tool
    def submit_scene_code(code: str) -> str:
        """Validate and save scene code to the Remotion renderer."""
        clean = re.sub(r'^```\w*\n?', '', code.strip())
        clean = re.sub(r'\n?```$', '', clean.strip())
        # Sync wrapper — Agents SDK tools are sync
        import requests as _req
        try:
            resp = _req.post(f"{REMOTION_API_URL}/validate-code",
                             json={"code": clean, "scene_index": scene_idx}, timeout=15)
            result = resp.json()
        except Exception as e:
            return f"Error: Remotion unreachable: {e}"
        if not result.get("valid"):
            return f"FAILED ({result.get('phase','?')}): {result.get('error','?')}"
        # Save to Redis (sync — inside function_tool)
        import redis as sync_redis
        sr = sync_redis.from_url(REDIS_URL, decode_responses=True)
        custom_key = _key(cid, "custom_code")
        existing = sr.get(custom_key)
        custom_map = json.loads(existing) if existing else {}
        custom_map[str(scene_idx)] = clean
        sr.set(custom_key, json.dumps(custom_map))
        sr.expire(custom_key, CONV_TTL)
        config_raw = sr.get(_key(cid, "scene_config"))
        if config_raw:
            config = json.loads(config_raw)
            if scene_idx < len(config.get("scenes", [])):
                config["scenes"][scene_idx]["template"] = "custom_code"
                sr.set(_key(cid, "scene_config"), json.dumps(config))
        return f"Scene {scene_idx} code saved."

    existing_block = f"Existing code:\n{existing_code}" if existing_code else ""
    prompt = f"Creative brief: {brief}\nScene {scene_idx}. {existing_block}\nWrite the code and call submit_scene_code."

    agent = Agent(
        name="SceneCodeWriter",
        instructions=SCENE_CODE_INSTRUCTIONS,
        tools=[submit_scene_code],
        model="gpt-5.4",
    )

    try:
        # Ensure API key is set for Agents SDK
        key = await _get_openai_key()
        if key:
            os.environ["OPENAI_API_KEY"] = key
        result = await Runner.run(agent, input=prompt, max_turns=6)
        final = result.final_output or ""
        if "saved" in final.lower() or "FAILED" not in final:
            await push_tool_event(cid, "tool_result", "scene_code",
                                  status="completed", label=f"Scene {scene_idx} saved",
                                  call_id=call_id)
            return (scene_idx, "OK")
    except Exception as e:
        print(f"[SubAgent] Scene {scene_idx} error: {e}")

    await push_tool_event(cid, "tool_result", "scene_code",
                          status="failed", label=f"Scene {scene_idx} failed",
                          call_id=call_id)
    return (scene_idx, "failed")


async def _run_scene_subagent(cid, brief, num_scenes=5, scene_indices=None, mode="create"):
    """Orchestrate parallel scene generation using OpenAI Agents SDK."""

    # Create scene slots first (fast, no LLM)
    if mode == "create":
        scene_indices = list(range(num_scenes))
        durations = [120, 150, 150, 150, 90]
        for i in range(num_scenes):
            dur = durations[i] if i < len(durations) else 150
            await push_tool_event(cid, "tool_call", "scene_code",
                                  display=f"Creating scene {i}...", call_id=f"sc_{i}")
            await _create_scene(cid, duration_frames=dur, position=i)
            await push_tool_event(cid, "tool_result", "scene_code",
                                  status="completed", label=f"Scene {i} slot ready",
                                  call_id=f"sc_{i}")

    # Read existing code for updates
    existing_codes = {}
    if mode == "update":
        for idx in scene_indices:
            code = await _read_scene_code(cid, idx)
            if not code.startswith("No "):
                existing_codes[idx] = code

    # Run ALL scenes in parallel
    tasks = [
        _run_scene_for_index(cid, idx, brief, mode,
                             existing_code=existing_codes.get(idx))
        for idx in scene_indices
    ]
    results = await asyncio.gather(*tasks)

    total_frames = 0
    config = await get_scene_config(cid)
    if config and config.get("scenes"):
        total_frames = sum(s["durationInFrames"] for s in config["scenes"])

    summary = "; ".join(f"Scene {idx}: {status}" for idx, status in results)
    verb = "Composed" if mode == "create" else "Updated"
    return f"{verb} {len(results)} scenes ({total_frames/30:.0f}s total). {summary}"


# ── Main agent runner (async, direct OpenAI API) ──

MAX_TURNS = 15


async def run_chat_agent(conversation_id, message, topic_id,
                         segment_id=None, style=None, voice_id=None, language=None):
    """Main creative director agent. Fully async."""
    from openai import AsyncOpenAI

    api_key = await _get_openai_key()
    if not api_key:
        await set_status(conversation_id, "error")
        await push_chunk(conversation_id, "[Error: No OpenAI API key]")
        return

    client = AsyncOpenAI(api_key=api_key)
    cid = conversation_id
    r = _get_redis()

    state = await get_conversation_state(cid)
    if not state:
        await init_conversation(cid, topic_id, segment_id or "",
                                style=style or "cinematic",
                                voice_id=voice_id or "",
                                language=language or "")
        state = await get_conversation_state(cid)
        await set_status(cid, "thinking")

    if style:
        state["style"] = style
    if voice_id:
        state["voice_id"] = voice_id
    if language:
        state["language"] = language
    await r.set(_key(cid, "state"), json.dumps(state))

    try:
        # Load segment data — HTTP call to main backend
        import httpx
        backend_url = os.environ.get("BACKEND_URL", "http://backend:8500")
        async with httpx.AsyncClient() as http:
            seg_resp = await http.get(f"{backend_url}/api/topics/{state['topic_id']}/segments",
                                      timeout=10.0)
            segments = seg_resp.json() if seg_resp.status_code == 200 else []
            topic_resp = await http.get(f"{backend_url}/api/topics/{state['topic_id']}",
                                        timeout=10.0)
            topic = topic_resp.json() if topic_resp.status_code == 200 else {}

        segment = None
        if state.get("segment_id"):
            segment = next((s for s in segments if s.get("id") == state["segment_id"]), None)
        if not segment:
            segment = next((s for s in segments if s.get("status") == "ready"), None)
        if not segment:
            await set_status(cid, "error")
            await push_chunk(cid, "No ready segments found.")
            return

        seg_data = {
            "title": segment.get("title", ""),
            "hook": segment.get("hook", ""),
            "script": segment.get("script", ""),
            "visual_cue": segment.get("visual_cue", ""),
            "series_title": topic.get("series_title", topic.get("title", "")),
        }

        scene_config = await get_scene_config(cid)
        system_prompt = await _build_system_prompt(seg_data, state, scene_config, cid=cid)

        # Build messages
        messages = [{"role": "system", "content": system_prompt}]
        history = await get_conversation_history(cid)
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})

        if message:
            messages.append({"role": "user", "content": message})
            await append_message(cid, "user", message)
        else:
            messages.append({"role": "user", "content": "Hello, I'd like to create a video for this segment."})
            await append_message(cid, "user", "[Started new conversation]")

        # ── Multi-turn loop ──
        full_response = ""
        collected_tool_steps = []

        for turn in range(MAX_TURNS):
            remaining = MAX_TURNS - turn
            use_tools = TOOL_SCHEMAS if remaining > 1 else None

            if remaining <= 3 and turn > 0:
                messages.append({"role": "system",
                    "content": f"[{remaining} turns left. Wrap up and respond to the user now.]"})

            # Async streaming
            stream = await client.chat.completions.create(
                model="gpt-5.4",
                messages=messages,
                tools=use_tools,
                stream=True,
            )

            turn_text = ""
            tool_calls_accum = {}

            async for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta

                if delta.content:
                    turn_text += delta.content
                    full_response += delta.content
                    await push_chunk(cid, delta.content)

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

            if not tool_calls_accum:
                break

            # Append assistant message with tool calls
            assistant_msg = {"role": "assistant", "content": turn_text or None, "tool_calls": []}
            for idx in sorted(tool_calls_accum.keys()):
                tc = tool_calls_accum[idx]
                assistant_msg["tool_calls"].append({
                    "id": tc["id"], "type": "function",
                    "function": {"name": tc["name"], "arguments": tc["arguments"]},
                })
            messages.append(assistant_msg)

            # Execute tools
            for idx in sorted(tool_calls_accum.keys()):
                tc = tool_calls_accum[idx]
                tool_name = tc["name"]
                tool_call_id = tc["id"]
                try:
                    args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                except json.JSONDecodeError:
                    args = {}

                display = _TOOL_DISPLAY.get(tool_name, lambda _: tool_name)(args)
                await push_tool_event(cid, "tool_call", tool_name,
                                      display=display, call_id=tool_call_id)
                step = {"id": tool_call_id, "tool": tool_name,
                        "displayMessage": display, "status": "running"}

                result = await _execute_tool(cid, tool_name, args)

                await push_tool_event(cid, "tool_result", tool_name,
                                      status="completed", label=result[:100],
                                      call_id=tool_call_id)
                step["status"] = "completed"
                step["resultLabel"] = result[:100]
                collected_tool_steps.append(step)

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call_id,
                    "content": result,
                })

        await append_message(cid, "assistant", full_response,
                             tool_steps=collected_tool_steps if collected_tool_steps else None)
        await set_status(cid, "done")

    except Exception as exc:
        err = f"{type(exc).__name__}: {str(exc)[:300]}"
        await set_status(cid, "error")
        await push_chunk(cid, f"\n\n[Error: {err}]")
        await append_message(cid, "assistant", f"[Error: {err}]")
        print(f"[ChatAgent] ERROR: {err}")
