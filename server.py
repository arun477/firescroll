import os
import threading
from typing import Optional

from fastapi import FastAPI, UploadFile, File
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


class CreateTopicRequest(BaseModel):
    topic: str
    segments: int = 6


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


@app.get("/api/topics")
def list_topics():
    topics = get_all_topics()
    for topic in topics:
        jobs = get_jobs_for_topic(topic["id"])
        topic["done"] = sum(1 for j in jobs if j["status"] == "done")
        topic["total"] = len(jobs)
    return topics


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
        series_title="",
        json_path="",
        total_segments=req.segments,
    )
    update_topic(topic_id, research_status="pending")
    return {"topic_id": topic_id}


class ResearchRequest(BaseModel):
    method: str = "ai"
    num_segments: int = 6


@app.post("/api/topics/{topic_id}/research")
def start_research(topic_id: str, req: ResearchRequest):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}

    if topic.get("research_status") == "generating":
        return {"status": "already_running"}

    def run():
        from research import generate_all_ai, research_all_firecrawl
        if req.method == "firecrawl":
            research_all_firecrawl(topic_id, topic["title"], req.num_segments)
        else:
            generate_all_ai(topic_id, topic["title"], req.num_segments)

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
        from research import generate_segment_content, research_with_firecrawl
        if req.method == "firecrawl":
            research_with_firecrawl(topic_id, req.segment_id, topic["title"], seg["title"])
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
            "duration": {"min_seconds": 15, "max_seconds": 45},
        })
    return result


@app.post("/api/topics/{topic_id}/generate")
def generate_segment(topic_id: str, req: GenerateRequest):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}

    def run():
        from batch_generate import _generate_single
        from db import create_job, has_active_job
        segments = get_segments_for_topic(topic_id)
        gen_data = _segments_to_gen_data(topic, segments)
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
                _generate_single(seg, req.mode, req.caption, OUTPUT_DIR, job_id,
                                 voice_provider=req.voice_provider,
                                 voice_id=req.voice_id,
                                 music_track=req.music_track,
                                 music_source=req.music_source,
                                 music_prompt=req.music_prompt,
                                 voice_style=req.voice_style,
                                 voice_settings=req.voice_settings,
                                 intro_sfx_prompt=req.intro_sfx_prompt,
                                 bg_video_id=req.bg_video_id)
            if not req.segment_ids:
                break

    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


@app.post("/api/topics/{topic_id}/generate-all")
def generate_all(topic_id: str, req: GenerateAllRequest = None):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}
    if req is None:
        req = GenerateAllRequest()

    def run():
        import random
        from concurrent.futures import ThreadPoolExecutor
        from batch_generate import _generate_single
        from db import create_job
        segments = get_segments_for_topic(topic_id)
        gen_data = _segments_to_gen_data(topic, segments)
        modes = ["full", "video", "split"]
        captions = ["default", "karaoke"]

        planned = []
        for seg in gen_data:
            mode = random.choice(modes)
            caption = random.choice(captions)
            job_id = create_job(topic_id, seg["id"], mode, caption,
                                voice_provider=req.voice_provider or "",
                                voice_id=req.voice_id or "",
                                music_track=req.music_track or "")
            if job_id:
                planned.append((seg, mode, caption, job_id))

        with ThreadPoolExecutor(max_workers=2) as pool:
            for seg, mode, caption, job_id in planned:
                pool.submit(_generate_single, seg, mode, caption, OUTPUT_DIR,
                            job_id, voice_provider=req.voice_provider,
                            voice_id=req.voice_id,
                            music_track=req.music_track,
                            music_source=req.music_source,
                            music_prompt=req.music_prompt,
                            voice_style=req.voice_style,
                            voice_settings=req.voice_settings)

    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


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
def get_sources_ep(topic_id: str):
    from db import get_research_sources as _get_src
    from db import get_source_stats as _get_stats
    return {"sources": _get_src(topic_id), "stats": _get_stats(topic_id)}


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
    from db import delete_segment
    delete_segment(segment_id)
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
        return {"status": "cancelled"}
    return {"status": "not_active"}


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

        # Generate thumbnail
        subprocess.run([
            "ffmpeg", "-y", "-i", file_path,
            "-ss", "2", "-vframes", "1",
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
    safe_name = file.filename.replace(" ", "_").replace("/", "_")
    filename = f"{media_id}{ext}"
    file_path = os.path.join(MEDIA_DIR, filename)

    # Stream to disk in chunks (handles large files without memory issues)
    total_size = 0
    chunk_size = 1024 * 1024  # 1MB chunks
    with open(file_path, "wb") as f:
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > MAX_UPLOAD_SIZE:
                f.close()
                os.remove(file_path)
                return {"error": f"File too large. Maximum size: {MAX_UPLOAD_SIZE // (1024*1024)}MB"}
            f.write(chunk)

    create_media(media_id, filename, file.filename, file_path)

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
def feed(topic_id: str = None):
    videos = get_completed_videos(topic_id)
    feed_items = []
    for v in videos:
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
            "caption": v["caption"],
            "duration": v["duration_seconds"],
            "video_url": f"/static/{rel_video}",
            "thumb_url": f"/static/{rel_thumb}" if rel_thumb else None,
        })
    return feed_items


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
