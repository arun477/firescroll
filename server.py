import os
import threading
from typing import Optional

from fastapi import FastAPI
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
    sources = get_research_sources(topic_id)
    source_stats = get_source_stats(topic_id)
    fc_jobs = get_firecrawl_jobs(topic_id)
    return {
        "topic": topic, "jobs": jobs, "segments": segments,
        "research": research, "sources": sources,
        "source_stats": source_stats, "fc_jobs": fc_jobs,
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
            if has_active_job(topic_id, seg["id"]):
                continue
            job_id = create_job(topic_id, seg["id"], req.mode, req.caption)
            if job_id:
                _generate_single(seg, req.mode, req.caption, OUTPUT_DIR, job_id)
            break

    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


@app.post("/api/topics/{topic_id}/generate-all")
def generate_all(topic_id: str):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}

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
            job_id = create_job(topic_id, seg["id"], mode, caption)
            if job_id:
                planned.append((seg, mode, caption, job_id))

        with ThreadPoolExecutor(max_workers=2) as pool:
            for seg, mode, caption, job_id in planned:
                pool.submit(_generate_single, seg, mode, caption, OUTPUT_DIR, job_id)

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


@app.delete("/api/topics/{topic_id}/research/{task_id}")
def delete_research_ep(topic_id: str, task_id: str):  # noqa: ARG001
    from db import delete_research_task
    delete_research_task(task_id)
    return {"status": "deleted"}


@app.get("/api/topics/{topic_id}/fc/jobs")
def get_fc_jobs_ep(topic_id: str):
    from db import get_firecrawl_jobs
    return get_firecrawl_jobs(topic_id)


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
