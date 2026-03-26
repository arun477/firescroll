import json
import os
import threading
import time
from typing import Optional

from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from db import (
    API_KEY_NAMES,
    create_topic,
    delete_api_key,
    get_all_api_keys,
    get_all_topics,
    get_completed_videos,
    get_job,
    get_jobs_for_topic,
    get_research_tasks,
    get_segments_for_topic,
    get_topic,
    set_api_key,
    update_topic,
)

app = FastAPI(title="FireScroll")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=OUTPUT_DIR), name="static")

# Recover any jobs/media stuck in active states from a previous crash
from db import recover_stuck_on_startup
recover_stuck_on_startup()


class CreateTopicRequest(BaseModel):
    topic: str
    description: str = ""


class GenerateRequest(BaseModel):
    mode: str = "full"
    caption: str = "default"
    voice_provider: Optional[str] = None
    voice_id: Optional[str] = None
    music_track: Optional[str] = None
    music_source: Optional[str] = None
    music_prompt: Optional[str] = None
    voice_style: Optional[str] = None
    voice_settings: Optional[dict] = None
    intro_sfx_prompt: Optional[str] = None
    bg_video_id: Optional[str] = None
    segment_ids: Optional[list] = None
    language: Optional[str] = None


class GenerateAllRequest(BaseModel):
    voice_provider: Optional[str] = None
    voice_id: Optional[str] = None
    music_track: Optional[str] = None
    music_source: Optional[str] = None
    music_prompt: Optional[str] = None
    voice_style: Optional[str] = None
    voice_settings: Optional[dict] = None
    intro_sfx_prompt: Optional[str] = None
    bg_video_id: Optional[str] = None
    language: Optional[str] = None


# ── ElevenLabs Agent Webhook ──
class ElevenLabsToolRequest(BaseModel):
    topic: str
    description: str = ""
    num_segments: int = 6

@app.post("/api/elevenlabs/webhook")
def elevenlabs_webhook(req: ElevenLabsToolRequest):
    topic_id = create_topic(req.topic, req.description)
    update_topic(topic_id, research_status="pending")

    def run():
        from research import research_all_firecrawl
        research_all_firecrawl(topic_id, req.topic, req.num_segments,
                               description=req.description)
    threading.Thread(target=run, daemon=True).start()

    return {
        "topic_id": topic_id,
        "message": f"Created '{req.topic}' with {req.num_segments} segments. Research started — check your dashboard."
    }


@app.get("/api/topics")
def list_topics(page: int = 1, page_size: int = 12):
    from db import get_topics_page
    return get_topics_page(page=page, page_size=page_size)


@app.get("/api/topics/{topic_id}")
def topic_detail(topic_id: str):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}
    jobs = get_jobs_for_topic(topic_id)
    for job in jobs:
        if job.get("video_path") and os.path.exists(job["video_path"]):
            job["video_url"] = f"/static/{os.path.relpath(job['video_path'], OUTPUT_DIR)}"
    segments = get_segments_for_topic(topic_id)
    research = get_research_tasks(topic_id)
    from db import get_firecrawl_jobs, get_research_sources, get_source_stats
    from db import get_all_segment_configs
    sources = get_research_sources(topic_id)
    source_stats = get_source_stats(topic_id)
    fc_jobs = get_firecrawl_jobs(topic_id)
    seg_configs = get_all_segment_configs(topic_id)
    return {
        "topic": topic, "jobs": jobs, "segments": segments,
        "research": research, "sources": sources,
        "source_stats": source_stats, "fc_jobs": fc_jobs,
        "segment_configs": seg_configs,
    }


@app.post("/api/topics/create")
def create_topic_endpoint(req: CreateTopicRequest):
    topic_id = create_topic(
        title=req.topic,
        description=req.description,
    )
    update_topic(topic_id, research_status="pending")
    return {"topic_id": topic_id}


class UpdateTopicRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


@app.put("/api/topics/{topic_id}")
def update_topic_ep(topic_id: str, req: UpdateTopicRequest):
    updates = {}
    if req.title is not None:
        updates["title"] = req.title
    if req.description is not None:
        updates["description"] = req.description
    if updates:
        update_topic(topic_id, **updates)
    return {"status": "updated"}


class ResearchRequest(BaseModel):
    method: str = "ai"
    num_segments: int = 6
    instruction: str = ""


@app.get("/api/languages")
def list_languages():
    from batch_generate import ELEVENLABS_LANGUAGES
    return [{"code": k, "name": v["name"]} for k, v in ELEVENLABS_LANGUAGES.items()]


@app.post("/api/topics/{topic_id}/research")
def start_research(topic_id: str, req: ResearchRequest):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}

    if topic.get("research_status") == "generating":
        return {"status": "already_running"}

    description = topic.get("description", "")

    def run():
        from research import (generate_all_ai, research_all_firecrawl,
                              research_deep_firecrawl, research_agent_firecrawl)
        if req.method == "firecrawl":
            research_all_firecrawl(topic_id, topic["title"], req.num_segments,
                                   description=description,
                                   instruction=req.instruction)
        elif req.method == "deep":
            research_deep_firecrawl(topic_id, topic["title"], req.num_segments,
                                    description=description,
                                    instruction=req.instruction)
        elif req.method == "agent":
            research_agent_firecrawl(topic_id, topic["title"], req.num_segments,
                                     description=description,
                                     instruction=req.instruction)
        else:
            generate_all_ai(topic_id, topic["title"], req.num_segments,
                           description=description,
                           instruction=req.instruction)

    threading.Thread(target=run, daemon=True).start()
    return {"status": "started", "method": req.method}


class SegmentResearchRequest(BaseModel):
    segment_id: str
    method: str = "ai"


@app.post("/api/topics/{topic_id}/research/segment")
def research_single_segment(topic_id: str, req: SegmentResearchRequest):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}

    segments = get_segments_for_topic(topic_id)
    seg = next((s for s in segments if s["id"] == req.segment_id), None)
    if not seg:
        return {"error": "segment not found"}

    if seg["status"] == "researching":
        return {"status": "already_running"}

    def run():
        from research import (generate_segment_content, research_with_firecrawl,
                              research_segment_deep, research_segment_agent)
        if req.method == "firecrawl":
            research_with_firecrawl(topic_id, req.segment_id, topic["title"], seg["title"])
        elif req.method == "deep":
            research_segment_deep(topic_id, req.segment_id, topic["title"], seg["title"])
        elif req.method == "agent":
            research_segment_agent(topic_id, req.segment_id, topic["title"], seg["title"])
        else:
            generate_segment_content(topic_id, req.segment_id, topic["title"], seg["title"])

    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


def _segments_to_gen_data(topic, segments):
    result = []
    for seg in segments:
        if seg["status"] != "ready":
            continue
        result.append({
            "id": seg["segment_num"],
            "title": seg["title"],
            "hook": seg["hook"],
            "script": seg["script"],
            "visual_cue": seg["visual_cue"] or "",
            "series_title": topic["series_title"] or topic["title"],
            "source_urls": seg.get("source_urls") or "",
            "duration": {"min_seconds": 15, "max_seconds": 45},
        })
    return result


@app.post("/api/topics/{topic_id}/generate")
def generate_segment(topic_id: str, req: GenerateRequest):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}

    from celery_app import generate_single_task
    from db import create_job, has_active_job, update_job
    segments = get_segments_for_topic(topic_id)
    gen_data = _segments_to_gen_data(topic, segments)
    dispatched = []
    for seg in gen_data:
        if req.segment_ids and seg["id"] not in req.segment_ids:
            continue
        if has_active_job(topic_id, seg["id"]):
            continue
        job_id = create_job(topic_id, seg["id"], req.mode, req.caption,
                            voice_provider=req.voice_provider or "",
                            voice_id=req.voice_id or "",
                            music_track=req.music_track or "")
        if job_id:
            result = generate_single_task.delay(
                seg, req.mode, req.caption, OUTPUT_DIR, job_id,
                voice_provider=req.voice_provider,
                voice_id=req.voice_id,
                music_track=req.music_track,
                music_source=req.music_source,
                music_prompt=req.music_prompt,
                voice_style=req.voice_style,
                voice_settings=req.voice_settings,
                intro_sfx_prompt=req.intro_sfx_prompt,
                bg_video_id=req.bg_video_id,
                language=req.language,
            )
            update_job(job_id, celery_task_id=result.id)
            dispatched.append(job_id)
        if not req.segment_ids:
            break

    return {"status": "started", "jobs": dispatched}


@app.post("/api/topics/{topic_id}/generate-all")
def generate_all(topic_id: str, req: GenerateAllRequest = None):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}
    if req is None:
        req = GenerateAllRequest()

    import random
    from celery_app import generate_single_task
    from db import create_job, update_job
    segments = get_segments_for_topic(topic_id)
    gen_data = _segments_to_gen_data(topic, segments)
    modes = ["full", "video", "split"]
    captions = ["default", "karaoke"]

    dispatched = []
    for seg in gen_data:
        mode = random.choice(modes)
        caption = random.choice(captions)
        job_id = create_job(topic_id, seg["id"], mode, caption,
                            voice_provider=req.voice_provider or "",
                            voice_id=req.voice_id or "",
                            music_track=req.music_track or "")
        if job_id:
            result = generate_single_task.delay(
                seg, mode, caption, OUTPUT_DIR, job_id,
                voice_provider=req.voice_provider,
                voice_id=req.voice_id,
                music_track=req.music_track,
                music_source=req.music_source,
                music_prompt=req.music_prompt,
                voice_style=req.voice_style,
                voice_settings=req.voice_settings,
                language=req.language,
            )
            update_job(job_id, celery_task_id=result.id)
            dispatched.append(job_id)

    return {"status": "started", "jobs": dispatched}


class FcSearchRequest(BaseModel):
    query: str
    segment_id: Optional[str] = None
    limit: int = 5


class FcScrapeRequest(BaseModel):
    url: str
    segment_id: Optional[str] = None


class FcExtractRequest(BaseModel):
    url: str
    prompt: str
    segment_id: Optional[str] = None


class FcCrawlRequest(BaseModel):
    url: str
    segment_id: Optional[str] = None
    limit: int = 10
    max_depth: int = 2


class FcMapRequest(BaseModel):
    url: str


class FcAgentRequest(BaseModel):
    prompt: str
    segment_id: Optional[str] = None


class FcBatchScrapeRequest(BaseModel):
    urls: list


class UpdateSegmentRequest(BaseModel):
    title: Optional[str] = None
    hook: Optional[str] = None
    script: Optional[str] = None
    visual_cue: Optional[str] = None


@app.post("/api/topics/{topic_id}/fc/search")
def fc_search_ep(topic_id: str, req: FcSearchRequest):
    def run():
        from research import fc_search
        fc_search(topic_id, req.segment_id, req.query, req.limit)
    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


@app.post("/api/topics/{topic_id}/fc/scrape")
def fc_scrape_ep(topic_id: str, req: FcScrapeRequest):
    def run():
        from research import fc_scrape
        fc_scrape(topic_id, req.segment_id, req.url)
    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


@app.post("/api/topics/{topic_id}/fc/extract")
def fc_extract_ep(topic_id: str, req: FcExtractRequest):
    def run():
        from research import fc_extract
        fc_extract(topic_id, req.segment_id, req.url, req.prompt)
    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


@app.post("/api/topics/{topic_id}/fc/crawl")
def fc_crawl_ep(topic_id: str, req: FcCrawlRequest):
    def run():
        from research import fc_crawl
        fc_crawl(topic_id, req.segment_id, req.url, req.limit,
                 req.max_depth)
    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


@app.post("/api/topics/{topic_id}/fc/map")
def fc_map_ep(topic_id: str, req: FcMapRequest):
    from research import fc_map
    result = fc_map(topic_id, req.url)
    return result


@app.post("/api/topics/{topic_id}/fc/agent")
def fc_agent_ep(topic_id: str, req: FcAgentRequest):
    def run():
        from research import fc_agent
        fc_agent(topic_id, req.segment_id, req.prompt)
    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


@app.post("/api/topics/{topic_id}/fc/batch-scrape")
def fc_batch_scrape_ep(topic_id: str, req: FcBatchScrapeRequest):
    def run():
        from research import fc_batch_scrape
        fc_batch_scrape(topic_id, req.urls)
    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


@app.get("/api/fc/status")
def fc_status_ep():
    from research import fc_status
    return fc_status()


@app.get("/api/topics/{topic_id}/sources")
def get_sources_ep(topic_id: str, page: int = 1, per_page: int = 8,
                   type: str = "all"):
    from db import get_research_sources_paginated, get_source_stats
    source_type = type if type != "all" else None
    data = get_research_sources_paginated(topic_id, page, per_page, source_type)
    stats = get_source_stats(topic_id)
    return {**data, "stats": stats}


@app.get("/api/topics/{topic_id}/sources/{source_id}")
def get_source_ep(topic_id: str, source_id: str):  # noqa: ARG001
    from db import get_conn
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM research_sources WHERE id = ?", (source_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Source not found")
    return dict(row)


@app.get("/api/topics/{topic_id}/segments/{segment_id}/sources")
def get_segment_sources_ep(topic_id: str, segment_id: str):  # noqa: ARG001
    from db import get_sources_for_segment
    sources = get_sources_for_segment(segment_id)
    return {"sources": sources}


@app.delete("/api/topics/{topic_id}/sources/{source_id}")
def delete_source_ep(topic_id: str, source_id: str):  # noqa: ARG001
    from db import delete_research_source
    delete_research_source(source_id)
    return {"status": "deleted"}


@app.put("/api/topics/{topic_id}/segments/{segment_id}")
def edit_segment_ep(topic_id: str, segment_id: str,  # noqa: ARG001
                    req: UpdateSegmentRequest):
    from db import update_segment
    updates = {}
    if req.title is not None:
        updates["title"] = req.title
    if req.hook is not None:
        updates["hook"] = req.hook
    if req.script is not None:
        updates["script"] = req.script
    if req.visual_cue is not None:
        updates["visual_cue"] = req.visual_cue
    if updates:
        update_segment(segment_id, **updates)
    return {"status": "updated"}


@app.delete("/api/topics/{topic_id}/segments/{segment_id}")
def delete_segment_ep(topic_id: str, segment_id: str):  # noqa: ARG001
    from db import delete_segment, get_conn
    # Check if videos reference this segment
    conn = get_conn()
    job_count = conn.execute(
        "SELECT COUNT(*) FROM jobs WHERE segment_id = ?", (segment_id,)
    ).fetchone()[0]
    conn.close()
    if job_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"This segment has {job_count} generated video(s). Delete those from the Studio tab first."
        )
    try:
        delete_segment(segment_id)
    except Exception:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete — other data references this segment. Try deleting associated videos first."
        )
    return {"status": "deleted"}


class AddSegmentRequest(BaseModel):
    title: str


@app.post("/api/topics/{topic_id}/segments")
def add_segment_ep(topic_id: str, req: AddSegmentRequest):
    from db import create_segment
    segments = get_segments_for_topic(topic_id)
    next_num = max((s["segment_num"] for s in segments), default=0) + 1
    seg_id = create_segment(topic_id, next_num, title=req.title)
    topic = get_topic(topic_id)
    if topic:
        update_topic(topic_id, total_segments=next_num)
    return {"status": "created", "id": seg_id, "segment_num": next_num}


class GenerateFromSourcesRequest(BaseModel):
    source_ids: list
    num_segments: int = 0


@app.post("/api/topics/{topic_id}/generate-from-sources")
def generate_from_sources_ep(topic_id: str, req: GenerateFromSourcesRequest):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}

    def run():
        from research import generate_segments_from_sources
        generate_segments_from_sources(
            topic_id, topic["title"], req.source_ids, req.num_segments
        )

    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


@app.get("/api/topics/{topic_id}/segments")
def list_segments_ep(topic_id: str, q: str = "", page: int = 1,
                     per_page: int = 20):
    segments = get_segments_for_topic(topic_id)
    if q:
        q_lower = q.lower()
        segments = [s for s in segments
                    if q_lower in (s.get("title") or "").lower()
                    or q_lower in (s.get("hook") or "").lower()
                    or q_lower in (s.get("script") or "").lower()]
    total = len(segments)
    start = (page - 1) * per_page
    paged = segments[start:start + per_page]
    return {"segments": paged, "total": total, "page": page,
            "pages": (total + per_page - 1) // per_page}


@app.get("/api/topics/{topic_id}/activity")
def get_activity_ep(topic_id: str, page: int = 1, page_size: int = 20, status: str = "all"):
    from db import get_activity_page
    return get_activity_page(topic_id, page=page, page_size=page_size, status_filter=status)


@app.delete("/api/topics/{topic_id}/research/{task_id}")
def delete_research_ep(topic_id: str, task_id: str):  # noqa: ARG001
    from db import delete_research_task
    delete_research_task(task_id)
    return {"status": "deleted"}


@app.get("/api/topics/{topic_id}/fc/jobs")
def get_fc_jobs_ep(topic_id: str):
    from db import get_firecrawl_jobs
    return get_firecrawl_jobs(topic_id)


@app.post("/api/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    from db import get_job, update_job, STATUS_FAILED, ACTIVE_STATUSES
    job = get_job(job_id)
    if not job:
        return {"error": "not found"}
    if job["status"] in ACTIVE_STATUSES:
        update_job(job_id, status=STATUS_FAILED, error="Cancelled by user")
        # Revoke the Celery task to hard-kill the worker process
        celery_task_id = job.get("celery_task_id")
        if celery_task_id:
            from celery_app import celery
            celery.control.revoke(celery_task_id, terminate=True, signal="SIGTERM")
        return {"status": "cancelled"}
    return {"status": "not_active"}


@app.delete("/api/jobs/{job_id}")
def delete_job_ep(job_id: str):
    from db import get_job, delete_job, ACTIVE_STATUSES
    import os
    job = get_job(job_id)
    if not job:
        return {"error": "not found"}
    if job["status"] in ACTIVE_STATUSES:
        return {"error": "cannot delete active job"}
    for path_key in ("video_path", "thumb_path", "audio_path"):
        path = job.get(path_key)
        if path and os.path.exists(path):
            os.remove(path)
    delete_job(job_id)
    return {"status": "deleted"}


class SegmentConfigRequest(BaseModel):
    config: dict


@app.put("/api/topics/{topic_id}/segments/{segment_id}/config")
def save_segment_config_ep(topic_id: str, segment_id: str, req: SegmentConfigRequest):
    from db import save_segment_config
    save_segment_config(segment_id, topic_id, req.config)
    return {"status": "saved"}


@app.get("/api/topics/{topic_id}/segment-configs")
def get_segment_configs_ep(topic_id: str):
    from db import get_all_segment_configs
    return {"configs": get_all_segment_configs(topic_id)}


@app.get("/api/voice-presets")
def list_voice_presets():
    from voice import VOICE_PRESETS
    return {"presets": VOICE_PRESETS}


@app.get("/api/voice-providers")
def list_voice_providers():
    from keystore import get_key
    providers = []
    has_eleven = bool(get_key("elevenlabs"))
    has_openai = bool(get_key("openai"))
    if has_eleven:
        providers.append({"id": "elevenlabs", "name": "ElevenLabs", "default": True})
    if has_openai or not has_eleven:
        providers.append({"id": "openai", "name": "OpenAI", "default": not has_eleven})
    return {"providers": providers}


@app.get("/api/voices/{provider}")
def list_voices_ep(provider: str):
    from voice import get_provider as get_voice_provider
    try:
        vp = get_voice_provider(provider)
        return {"provider": provider, "voices": vp.list_voices()}
    except Exception as e:
        return {"provider": provider, "voices": [], "error": str(e)}


class VoicePreviewRequest(BaseModel):
    voice_id: str
    provider: str = "elevenlabs"
    text: str = "Welcome to FireScroll. Let me show you how this voice sounds."
    voice_style: Optional[str] = None


@app.post("/api/voice-preview")
def voice_preview(req: VoicePreviewRequest):
    import tempfile
    from fastapi.responses import FileResponse
    from voice import get_provider as get_voice_provider, VOICE_PRESETS
    try:
        vp = get_voice_provider(req.provider)
        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        kwargs = {"voice": req.voice_id}
        if req.voice_style and req.voice_style in VOICE_PRESETS:
            kwargs.update(VOICE_PRESETS[req.voice_style])
        vp.generate(req.text, tmp.name, **kwargs)
        return FileResponse(tmp.name, media_type="audio/mpeg",
                            filename="preview.mp3")
    except Exception as e:
        return {"error": str(e)}


class SfxGenerateRequest(BaseModel):
    prompt: str
    duration_seconds: float = 5.0


@app.post("/api/sfx/generate")
def generate_sfx(req: SfxGenerateRequest):
    import tempfile
    from fastapi.responses import FileResponse
    from audio_utils import generate_sfx_elevenlabs
    try:
        tmp = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
        generate_sfx_elevenlabs(req.prompt, req.duration_seconds, tmp.name)
        return FileResponse(tmp.name, media_type="audio/mpeg",
                            filename="sfx.mp3")
    except Exception as e:
        return {"error": str(e)}


MEDIA_DIR = os.path.join(os.path.dirname(__file__), "media_library")
os.makedirs(MEDIA_DIR, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


def _process_uploaded_video(media_id, file_path):
    """Strip audio, generate thumbnail, probe metadata."""
    import subprocess
    import json as _json
    from db import update_media

    try:
        # Probe video info
        probe = subprocess.run([
            "ffprobe", "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", file_path,
        ], capture_output=True, text=True, check=False)

        if probe.returncode != 0:
            update_media(media_id, status="failed",
                         meta=_json.dumps({"error": "Not a valid video file"}))
            print(f"[Media] Invalid file: {media_id}")
            return

        info = _json.loads(probe.stdout)
        duration = float(info.get("format", {}).get("duration", 0))
        width, height = 0, 0
        has_video_stream = False
        for s in info.get("streams", []):
            if s.get("codec_type") == "video":
                width = int(s.get("width", 0))
                height = int(s.get("height", 0))
                has_video_stream = True
                break

        if not has_video_stream:
            update_media(media_id, status="failed",
                         meta=_json.dumps({"error": "No video stream found"}))
            print(f"[Media] No video stream: {media_id}")
            return

        base, ext = os.path.splitext(file_path)
        silent_path = base + "_silent" + ext
        thumb_path = base + "_thumb.jpg"

        # Strip audio
        subprocess.run([
            "ffmpeg", "-y", "-i", file_path,
            "-an", "-c:v", "copy", silent_path,
        ], capture_output=True, check=False)
        if os.path.exists(silent_path):
            os.replace(silent_path, file_path)

        # Generate thumbnail — try 2s in, fall back to first frame for short videos
        seek = "2" if duration > 3 else "0"
        subprocess.run([
            "ffmpeg", "-y", "-i", file_path,
            "-ss", seek, "-vframes", "1",
            "-vf", "scale=480:-1:flags=lanczos",
            thumb_path,
        ], capture_output=True, check=False)

        file_size = os.path.getsize(file_path)

        update_media(media_id,
                     status="ready",
                     duration_seconds=duration,
                     width=width, height=height,
                     file_size=file_size,
                     thumb_path=thumb_path if os.path.exists(thumb_path) else "")

        print(f"[Media] Processed: {media_id} ({duration:.1f}s, {width}x{height})")

    except Exception as e:
        update_media(media_id, status="failed",
                     meta=_json.dumps({"error": str(e)[:200]}))
        print(f"[Media] Processing failed: {media_id} — {e}")


MAX_UPLOAD_SIZE = 500 * 1024 * 1024  # 500MB
ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


@app.post("/api/media/upload")
async def upload_media(file: UploadFile = File(...)):
    import uuid
    from db import create_media

    # Validate extension
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        return {"error": f"Unsupported format. Allowed: {', '.join(ALLOWED_VIDEO_EXTS)}"}

    media_id = uuid.uuid4().hex[:12]
    filename = f"{media_id}{ext}"
    file_path = os.path.join(MEDIA_DIR, filename)

    # Stream to disk in chunks (handles large files without memory issues)
    total_size = 0
    too_large = False
    chunk_size = 1024 * 1024  # 1MB chunks
    with open(file_path, "wb") as f:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > MAX_UPLOAD_SIZE:
                too_large = True
                break
            f.write(chunk)

    if too_large:
        os.remove(file_path)
        return {"error": f"File too large. Maximum size: {MAX_UPLOAD_SIZE // (1024*1024)}MB"}

    create_media(media_id, filename, file.filename or "upload", file_path)

    # Process in background
    threading.Thread(
        target=_process_uploaded_video,
        args=(media_id, file_path),
        daemon=True,
    ).start()

    return {"id": media_id, "filename": filename, "status": "processing",
            "size": total_size}


@app.get("/api/media/{media_id}/status")
def media_status(media_id: str):
    from db import get_media
    m = get_media(media_id)
    if not m:
        return {"error": "not found"}
    return {"id": m["id"], "status": m["status"]}


@app.get("/api/media")
def list_media():
    from db import get_all_media
    items = get_all_media()
    result = []
    for m in items:
        item = {**m}
        item["video_url"] = f"/media/{m['filename']}"
        if m.get("thumb_path") and os.path.exists(m["thumb_path"]):
            item["thumb_url"] = f"/media/{os.path.basename(m['thumb_path'])}"
        else:
            item["thumb_url"] = None
        result.append(item)
    return {"media": result}


@app.delete("/api/media/{media_id}")
def delete_media_ep(media_id: str):
    from db import delete_media
    delete_media(media_id)
    return {"status": "deleted"}


@app.get("/api/music")
def list_music():
    from audio_utils import MUSIC_DIR
    if not os.path.isdir(MUSIC_DIR):
        return {"tracks": []}
    tracks = sorted(f for f in os.listdir(MUSIC_DIR) if f.endswith(".mp3"))
    return {"tracks": tracks}


@app.get("/api/feed")
def feed(topic_id: str = None, cursor: str = None, limit: int = 6):
    from db import get_feed_page, get_remotion_jobs_for_topic, get_topic

    # Standard pipeline videos
    data = get_feed_page(topic_id=topic_id, cursor=cursor, limit=limit)
    feed_items = []
    for v in data["items"]:
        if not v["video_path"] or not os.path.exists(v["video_path"]):
            continue
        rel_video = os.path.relpath(v["video_path"], OUTPUT_DIR)
        rel_thumb = ""
        if v["thumb_path"] and os.path.exists(v["thumb_path"]):
            rel_thumb = os.path.relpath(v["thumb_path"], OUTPUT_DIR)
        feed_items.append({
            "id": v["id"],
            "segment_id": v["segment_id"],
            "topic": v["topic_title"],
            "series": v["series_title"],
            "mode": v["mode"],
            "caption": v.get("caption", ""),
            "duration": v["duration_seconds"],
            "video_url": f"/static/{rel_video}",
            "thumb_url": f"/static/{rel_thumb}" if rel_thumb else None,
            "created_at": v["created_at"],
            "pipeline": "studio",
        })

    # Motion Studio videos
    from db import get_conn
    conn = get_conn()
    rquery = "SELECT r.*, t.title as topic_title, t.series_title FROM remotion_jobs r JOIN topics t ON r.topic_id = t.id WHERE r.status = 'done'"
    rparams = []
    if topic_id:
        rquery += " AND r.topic_id = ?"
        rparams.append(topic_id)
    rquery += " ORDER BY r.created_at DESC LIMIT ?"
    rparams.append(limit)
    rrows = conn.execute(rquery, rparams).fetchall()
    conn.close()

    for v in [dict(r) for r in rrows]:
        fp = v.get("final_path")
        if not fp or not os.path.exists(fp):
            continue
        feed_items.append({
            "id": v["id"],
            "segment_id": v["segment_id"],
            "topic": v["topic_title"],
            "series": v["series_title"],
            "mode": "motion",
            "caption": v.get("style", ""),
            "duration": v.get("duration_seconds"),
            "video_url": f"/static/{os.path.relpath(fp, OUTPUT_DIR)}",
            "thumb_url": None,
            "created_at": v["created_at"],
            "pipeline": "motion",
        })

    # Sort combined results by date, newest first
    feed_items.sort(key=lambda x: x["created_at"], reverse=True)
    feed_items = feed_items[:limit]

    return {
        "items": feed_items,
        "total": data["total"] + len(rrows),
        "next_cursor": data["next_cursor"],
        "has_more": data["has_more"],
    }


@app.get("/api/video/{job_id}")
def serve_video(job_id: str):
    job = get_job(job_id)
    if not job or not job["video_path"]:
        return {"error": "not found"}
    return FileResponse(job["video_path"], media_type="video/mp4")


class ApiKeyRequest(BaseModel):
    key_name: str
    key_value: str


@app.get("/api/settings/keys")
def list_api_keys():
    return get_all_api_keys()


@app.post("/api/settings/keys")
def save_api_key(req: ApiKeyRequest):
    if req.key_name not in API_KEY_NAMES:
        return {"error": f"Invalid key name. Valid: {API_KEY_NAMES}"}
    set_api_key(req.key_name, req.key_value)
    return {"status": "saved", "key_name": req.key_name}


@app.delete("/api/settings/keys/{key_name}")
def remove_api_key(key_name: str):
    if key_name not in API_KEY_NAMES:
        return {"error": f"Invalid key name. Valid: {API_KEY_NAMES}"}
    delete_api_key(key_name)
    return {"status": "deleted", "key_name": key_name}


@app.get("/api/internal/key/{key_name}")
def get_raw_api_key(key_name: str):
    """Internal endpoint for agent service to fetch raw API keys. Not exposed to frontend."""
    from keystore import get_key
    val = get_key(key_name)
    if not val:
        return {"error": "Key not found"}
    return {"key": val}


# ══════════════════════════════════════════════════════
# REMOTION AGENT PIPELINE (completely separate from existing pipeline)
# ══════════════════════════════════════════════════════

class RemotionGenerateRequest(BaseModel):
    user_prompt: str = ""
    style: str = "cinematic"
    segment_ids: Optional[list] = None
    voice_provider: Optional[str] = None
    voice_id: Optional[str] = None
    language: Optional[str] = None
    voice_style: Optional[str] = None
    voice_settings: Optional[dict] = None
    music_track: Optional[str] = None
    conversation_id: Optional[str] = None  # pull pre-composed scene config from chat agent


class RemotionPreviewRequest(BaseModel):
    user_prompt: str = ""
    style: str = "cinematic"
    segment_id: Optional[str] = None


@app.get("/api/remotion/templates")
def remotion_templates():
    from remotion_templates import TEMPLATES
    return {"templates": [
        {"id": k, "name": v["name"], "description": v["description"]}
        for k, v in TEMPLATES.items()
    ]}


@app.get("/api/remotion/styles")
def remotion_styles():
    from remotion_templates import STYLES
    return {"styles": [
        {"id": k, "name": k.capitalize(), "description": v}
        for k, v in STYLES.items()
    ]}


@app.post("/api/topics/{topic_id}/remotion/generate")
def remotion_generate(topic_id: str, req: RemotionGenerateRequest):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}

    from celery_app import remotion_generate_task
    from db import create_remotion_job, update_remotion_job

    # Pull pre-composed scene config + custom code + settings from chat agent
    pre_scene_config = None
    pre_custom_code = None
    if req.conversation_id:
        from chat_agent import (
            get_scene_config as get_chat_scene_config,
            get_conversation_state as get_chat_state,
            _get_redis, _key,
        )
        pre_scene_config = get_chat_scene_config(req.conversation_id)
        r = _get_redis()
        custom_raw = r.get(_key(req.conversation_id, "custom_code"))
        if custom_raw:
            pre_custom_code = json.loads(custom_raw)
        # Use voice/language from conversation state if not provided in request
        chat_state = get_chat_state(req.conversation_id)
        if chat_state:
            if not req.voice_id and chat_state.get("voice_id"):
                req.voice_id = chat_state["voice_id"]
            if not req.language and chat_state.get("language"):
                req.language = chat_state["language"]

    segments = get_segments_for_topic(topic_id)
    gen_data = _segments_to_gen_data(topic, segments)
    dispatched = []

    for seg in gen_data:
        if req.segment_ids and seg["id"] not in req.segment_ids:
            continue

        job_id = create_remotion_job(
            topic_id, seg["id"],
            user_prompt=req.user_prompt,
            style=req.style,
            voice_provider=req.voice_provider or "",
            voice_id=req.voice_id or "",
            language=req.language or "",
        )
        if job_id:
            result = remotion_generate_task.delay(
                seg, OUTPUT_DIR, job_id,
                user_prompt=req.user_prompt,
                style=req.style,
                voice_provider=req.voice_provider,
                voice_id=req.voice_id,
                language=req.language,
                voice_style=req.voice_style,
                voice_settings=req.voice_settings,
                music_track=req.music_track,
                scene_config=pre_scene_config,
                custom_code=pre_custom_code,
            )
            update_remotion_job(job_id, celery_task_id=result.id)
            dispatched.append(job_id)

        if not req.segment_ids:
            break

    return {"status": "started", "jobs": dispatched}


@app.get("/api/topics/{topic_id}/remotion/jobs")
def remotion_jobs_list(topic_id: str):
    """Returns per-segment status: active job, latest video, latest error."""
    from db import get_remotion_jobs_for_topic, REMOTION_ACTIVE
    jobs = get_remotion_jobs_for_topic(topic_id)

    # Build per-segment map: {segment_id: {active, done, failed}}
    seg_map = {}
    for j in jobs:
        sid = j["segment_id"]
        if sid not in seg_map:
            seg_map[sid] = {"active": None, "done": None, "failed": None}

        if j["status"] in REMOTION_ACTIVE and seg_map[sid]["active"] is None:
            seg_map[sid]["active"] = {
                "id": j["id"], "status": j["status"],
                "progress": j["progress"],
            }
        elif j["status"] == "done" and seg_map[sid]["done"] is None:
            video_url = None
            if j.get("final_path") and os.path.exists(j["final_path"]):
                video_url = f"/static/{os.path.relpath(j['final_path'], OUTPUT_DIR)}"
            if video_url:
                seg_map[sid]["done"] = {
                    "id": j["id"], "video_url": video_url,
                    "scene_config": j.get("scene_config"),
                }
        elif j["status"] == "failed" and seg_map[sid]["failed"] is None:
            seg_map[sid]["failed"] = {
                "id": j["id"], "error": j.get("error", ""),
            }

    return {"segments": seg_map}


@app.get("/api/remotion/jobs/{job_id}")
def remotion_job_detail(job_id: str):
    from db import get_remotion_job
    job = get_remotion_job(job_id)
    if not job:
        return {"error": "not found"}
    if job.get("final_path") and os.path.exists(job["final_path"]):
        job["video_url"] = f"/static/{os.path.relpath(job['final_path'], OUTPUT_DIR)}"
    else:
        job["video_url"] = None
    return job


@app.post("/api/remotion/jobs/{job_id}/cancel")
def remotion_cancel(job_id: str):
    from db import get_remotion_job, update_remotion_job, REMOTION_ACTIVE
    job = get_remotion_job(job_id)
    if not job:
        return {"error": "not found"}
    if job["status"] in REMOTION_ACTIVE:
        update_remotion_job(job_id, status="failed", error="Cancelled by user")
        celery_task_id = job.get("celery_task_id")
        if celery_task_id:
            from celery_app import celery
            celery.control.revoke(celery_task_id, terminate=True, signal="SIGTERM")
        return {"status": "cancelled"}
    return {"status": "not_active"}


@app.delete("/api/remotion/jobs/{job_id}")
def remotion_delete(job_id: str):
    from db import get_remotion_job, delete_remotion_job, REMOTION_ACTIVE
    job = get_remotion_job(job_id)
    if not job:
        return {"error": "not found"}
    if job["status"] in REMOTION_ACTIVE:
        return {"error": "cannot delete active job"}
    for path_key in ("video_path", "audio_path", "final_path"):
        path = job.get(path_key)
        if path and os.path.exists(path):
            os.remove(path)
    delete_remotion_job(job_id)
    return {"status": "deleted"}


@app.post("/api/topics/{topic_id}/remotion/preview-config")
def remotion_preview_config(topic_id: str, req: RemotionPreviewRequest):
    """Generate scene config without rendering — for live preview."""
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}

    segments = get_segments_for_topic(topic_id)
    seg = None
    if req.segment_id:
        seg = next((s for s in segments if s["id"] == req.segment_id), None)
    if not seg:
        seg = next((s for s in segments if s["status"] == "ready"), None)
    if not seg:
        return {"error": "no ready segment"}

    seg_data = {
        "id": seg["segment_num"],
        "title": seg["title"],
        "hook": seg["hook"],
        "script": seg["script"],
        "visual_cue": seg.get("visual_cue") or "",
        "series_title": topic.get("series_title") or topic["title"],
    }

    from remotion_pipeline import generate_scene_config
    # Estimate duration from text length (~150 words per minute)
    word_count = len(seg["hook"].split()) + len(seg["script"].split())
    est_duration = max(15, min(60, word_count / 2.5))

    config = generate_scene_config(seg_data, req.user_prompt, req.style, est_duration)
    return {"scene_config": config, "estimated_duration": est_duration}


# ══════════════════════════════════════════════════════
# CHAT AGENT (AI-driven Motion Director)
# ══════════════════════════════════════════════════════

class ChatSendRequest(BaseModel):
    conversation_id: str
    message: str = ""
    topic_id: str
    segment_id: Optional[str] = None
    style: Optional[str] = None
    voice_id: Optional[str] = None
    language: Optional[str] = None


@app.post("/api/chat/send")
async def chat_send(req: ChatSendRequest):
    """Forward chat message to the async agent service via HTTP."""
    import httpx

    agent_url = os.environ.get("AGENT_SERVICE_URL", "http://agent:8100")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{agent_url}/chat/send",
                json={
                    "conversation_id": req.conversation_id,
                    "message": req.message,
                    "topic_id": req.topic_id,
                    "segment_id": req.segment_id,
                    "style": req.style,
                    "voice_id": req.voice_id,
                    "language": req.language,
                },
                timeout=10.0,
            )
            return resp.json()
    except httpx.ConnectError:
        return {"error": "Agent service unavailable. Please try again."}
    except Exception as e:
        return {"error": f"Agent service error: {str(e)[:100]}"}


@app.get("/api/chat/{conversation_id}/stream")
async def chat_stream(conversation_id: str, request: Request):
    """SSE endpoint — streams chat events in real-time.

    Supports resume via Last-Event-ID header (chunk offset).
    Sends heartbeats every 10s to keep proxies/browsers alive.
    """
    from chat_agent import (
        get_conversation_state, get_scene_config, _get_redis, _key
    )
    from fastapi.responses import StreamingResponse
    import asyncio

    # Resume from Last-Event-ID if client reconnects
    last_event_id = request.headers.get("Last-Event-ID", "")
    resume_offset = 0
    if last_event_id:
        try:
            resume_offset = int(last_event_id.split(":")[1])
        except (ValueError, IndexError):
            pass

    async def event_generator():
        r = _get_redis()
        offset = resume_offset
        event_seq = 0
        last_config_hash = ""
        last_custom_hash = ""
        started = time.time()
        last_heartbeat = time.time()
        SSE_TIMEOUT = 420      # 7 min — exceeds Celery time_limit (360s)
        HEARTBEAT_INTERVAL = 10  # seconds between keepalive pings
        POLL_INTERVAL = 0.1    # 100ms for smooth streaming

        # Initial connection acknowledgment
        yield f"id: evt:{offset}\ndata: {json.dumps({'type': 'connected'})}\n\n"

        while True:
            now = time.time()

            # Check if client disconnected
            if await request.is_disconnected():
                return

            # Timeout guard — prevent infinite hang if worker crashes
            if now - started > SSE_TIMEOUT:
                from chat_agent import set_status as _set_status
                _set_status(conversation_id, "error")
                yield f"data: {json.dumps({'type': 'error', 'timeout': True})}\n\n"
                return

            state = get_conversation_state(conversation_id)
            if not state:
                yield f"data: {json.dumps({'type': 'idle'})}\n\n"
                return

            status = state.get("status", "idle")
            emitted = False

            # Stream new text chunks
            chunks = r.lrange(_key(conversation_id, "chunks"), offset, -1)
            if chunks:
                text = "".join(chunks)
                offset += len(chunks)
                event_seq += 1
                yield f"id: evt:{offset}\ndata: {json.dumps({'type': 'text', 'content': text})}\n\n"
                emitted = True

            # Stream scene config changes
            config = get_scene_config(conversation_id)
            config_str = json.dumps(config, sort_keys=True) if config else ""
            if config_str and config_str != last_config_hash:
                last_config_hash = config_str
                event_seq += 1
                yield f"id: evt:{offset}\ndata: {json.dumps({'type': 'scene_config', 'config': config})}\n\n"
                emitted = True

            # Stream custom code changes
            custom_raw = r.get(_key(conversation_id, "custom_code"))
            if custom_raw and custom_raw != last_custom_hash:
                last_custom_hash = custom_raw
                event_seq += 1
                yield f"id: evt:{offset}\ndata: {json.dumps({'type': 'custom_code', 'code': json.loads(custom_raw)})}\n\n"
                emitted = True

            # Check render requested
            render_req = r.get(_key(conversation_id, "render_requested"))
            if render_req:
                r.delete(_key(conversation_id, "render_requested"))
                yield f"data: {json.dumps({'type': 'render_requested'})}\n\n"
                emitted = True

            # Drain tool UI events (tool_call, tool_result, etc.)
            while True:
                raw_evt = r.lpop(_key(conversation_id, "ui_events"))
                if not raw_evt:
                    break
                evt = json.loads(raw_evt)
                event_seq += 1
                yield f"data: {json.dumps(evt)}\n\n"
                emitted = True

            # Stream settings
            settings = {
                "style": state.get("style", "cinematic"),
                "voice_id": state.get("voice_id", ""),
                "voice_name": state.get("voice_name", ""),
                "language": state.get("language", ""),
            }

            # Done or error — send final event and close
            if status == "done":
                yield f"data: {json.dumps({'type': 'done', 'settings': settings})}\n\n"
                return
            elif status == "error":
                yield f"data: {json.dumps({'type': 'error', 'settings': settings})}\n\n"
                return
            elif status == "idle":
                yield f"data: {json.dumps({'type': 'idle', 'settings': settings})}\n\n"
                return

            # Heartbeat — keep connection alive through proxies/browsers
            if not emitted and (now - last_heartbeat) >= HEARTBEAT_INTERVAL:
                yield f": heartbeat {int(now)}\n\n"
                last_heartbeat = now

            await asyncio.sleep(POLL_INTERVAL)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable nginx buffering
        },
    )


@app.get("/api/chat/{conversation_id}/history")
def chat_history(conversation_id: str):
    from chat_agent import (
        get_conversation_history, get_scene_config, get_conversation_state,
        _get_redis, _key
    )
    r = _get_redis()
    state = get_conversation_state(conversation_id)
    custom_raw = r.get(_key(conversation_id, "custom_code"))
    return {
        "messages": get_conversation_history(conversation_id),
        "scene_config": get_scene_config(conversation_id),
        "custom_code": json.loads(custom_raw) if custom_raw else None,
        "status": state.get("status", "idle") if state else "idle",
        "settings": {
            "style": state.get("style", "cinematic") if state else "cinematic",
            "voice_id": state.get("voice_id", "") if state else "",
            "voice_name": state.get("voice_name", "") if state else "",
            "language": state.get("language", "") if state else "",
        },
    }


class ChatSelectRequest(BaseModel):
    picker: str
    value: str
    label: str = ""


@app.post("/api/chat/{conversation_id}/select")
def chat_select(conversation_id: str, req: ChatSelectRequest):
    """Direct config update from picker selection — no chat message needed."""
    from chat_agent import get_conversation_state, _get_redis, _key
    r = _get_redis()
    state = get_conversation_state(conversation_id)
    if not state:
        return {"error": "Conversation not found"}
    if req.picker == "voice":
        state["voice_id"] = req.value
        state["voice_name"] = req.label
    elif req.picker == "language":
        state["language"] = req.value
    elif req.picker == "style":
        state["style"] = req.value
    r.set(_key(conversation_id, "state"), json.dumps(state))
    return {
        "status": "ok",
        "settings": {
            "style": state.get("style", "cinematic"),
            "voice_id": state.get("voice_id", ""),
            "voice_name": state.get("voice_name", ""),
            "language": state.get("language", ""),
        },
    }


@app.delete("/api/chat/{conversation_id}")
def chat_delete(conversation_id: str):
    from chat_agent import delete_conversation
    delete_conversation(conversation_id)
    return {"status": "deleted"}


# ══════════════════════════════════════════════════════
# REMOTION PREVIEW PROXY (scalable, backend-routed)
# ══════════════════════════════════════════════════════

REMOTION_API = os.environ.get("REMOTION_API_URL", "http://remotion-studio:3600")


@app.get("/api/preview")
def preview_page():
    """Proxy the Remotion preview HTML page."""
    import requests as _req
    try:
        resp = _req.get(f"{REMOTION_API}/preview", timeout=10)
        from fastapi.responses import HTMLResponse
        return HTMLResponse(content=resp.text, status_code=resp.status_code)
    except Exception as e:
        from fastapi.responses import HTMLResponse
        return HTMLResponse(
            content=f"<html><body style='background:#0a0a0f;color:#fff;padding:40px;font-family:sans-serif'>"
                    f"<h2>Preview unavailable</h2><p>{e}</p></body></html>",
            status_code=502)


@app.get("/api/preview-bundle.js")
def preview_bundle():
    """Proxy the Remotion preview JS bundle."""
    import requests as _req
    try:
        resp = _req.get(f"{REMOTION_API}/preview-bundle.js", timeout=10)
        from fastapi.responses import Response
        return Response(
            content=resp.content,
            media_type="application/javascript",
            status_code=resp.status_code)
    except Exception as e:
        return {"error": str(e)}
