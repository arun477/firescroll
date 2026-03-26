"""Agent Service — Async FastAPI for Motion Director chat agent.

Standalone service, no Celery. Native async with AsyncOpenAI.
Communicates with the main backend via shared Redis state.
"""
import asyncio
import json
import os
import time

from dotenv import load_dotenv
load_dotenv()  # Load .env for API keys

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="FireScroll Agent Service")

# Concurrency cap — prevent overloading OpenAI API
_semaphore = asyncio.Semaphore(int(os.environ.get("AGENT_MAX_CONCURRENT", "20")))
_active_tasks: dict[str, asyncio.Task] = {}


class ChatSendRequest(BaseModel):
    conversation_id: str
    message: str = ""
    topic_id: str
    segment_id: str | None = None
    style: str | None = None
    voice_id: str | None = None
    language: str | None = None


@app.post("/chat/send")
async def chat_send(req: ChatSendRequest):
    """Accept a chat message and spawn an async agent task. Returns immediately."""
    from chat_agent import (
        get_conversation_state, set_status, init_conversation, clear_chunks,
        _get_redis, _key,
    )

    r = _get_redis()

    # Check if already thinking — with stuck-state recovery
    state = await get_conversation_state(req.conversation_id)
    if state and state.get("status") == "thinking":
        thinking_since = await r.get(_key(req.conversation_id, "thinking_since"))
        if thinking_since and (time.time() - float(thinking_since)) > 180:
            await set_status(req.conversation_id, "idle")
            state["status"] = "idle"
        else:
            return {"error": "Agent is still thinking. Wait for completion."}

    # Initialize conversation if needed
    if not state:
        await init_conversation(
            req.conversation_id, req.topic_id, req.segment_id or "",
            style=req.style or "cinematic",
            voice_id=req.voice_id or "",
            language=req.language or "",
        )

    # Set status before spawning task
    await set_status(req.conversation_id, "thinking")
    await clear_chunks(req.conversation_id)
    await r.set(_key(req.conversation_id, "thinking_since"), str(time.time()))
    await r.expire(_key(req.conversation_id, "thinking_since"), 300)

    # Cancel any existing task for this conversation
    existing = _active_tasks.get(req.conversation_id)
    if existing and not existing.done():
        existing.cancel()

    # Spawn async task
    from chat_agent import run_chat_agent
    task = asyncio.create_task(
        _run_with_semaphore(req.conversation_id, req.message, req.topic_id,
                            segment_id=req.segment_id, style=req.style,
                            voice_id=req.voice_id, language=req.language)
    )
    _active_tasks[req.conversation_id] = task

    return {"conversation_id": req.conversation_id, "status": "thinking"}


async def _run_with_semaphore(cid, message, topic_id, **kwargs):
    """Run agent with concurrency semaphore."""
    from chat_agent import run_chat_agent
    async with _semaphore:
        try:
            await run_chat_agent(cid, message, topic_id, **kwargs)
        except Exception as e:
            from chat_agent import set_status, push_chunk, append_message
            print(f"[Agent] Task failed: {e}")
            await set_status(cid, "error")
            await push_chunk(cid, f"\n\n[Error: {e}]")
            await append_message(cid, "assistant", f"[Error: {e}]")
        finally:
            _active_tasks.pop(cid, None)


@app.get("/health")
async def health():
    return {"status": "ok", "active_tasks": len(_active_tasks)}
