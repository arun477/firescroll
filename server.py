import os
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from db import (
    API_KEY_NAMES,
    delete_api_key,
    get_all_api_keys,
    get_all_topics,
    get_completed_videos,
    get_job,
    get_jobs_for_topic,
    get_topic,
    set_api_key,
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
    return {"topic": topic, "jobs": jobs}


@app.post("/api/topics/create")
def create_topic_endpoint(req: CreateTopicRequest):
    from db import create_topic, find_topic_by_json

    slug = req.topic.lower().replace(" ", "_")
    json_path = os.path.abspath(f"data/topics/{slug}.json")

    existing = find_topic_by_json(json_path)
    if existing:
        return {"topic_id": existing["id"], "json_path": json_path}

    from topic_generator import generate_topic_json
    json_path = generate_topic_json(req.topic, req.segments)

    from batch_generate import load_topic
    data = load_topic(json_path)
    topic_id = create_topic(
        title=data["topic"],
        series_title=data["series_title"],
        json_path=os.path.abspath(json_path),
        total_segments=len(data["segments"]),
    )
    return {"topic_id": topic_id, "json_path": json_path}


@app.post("/api/topics/{topic_id}/generate")
def generate_segment(topic_id: str, req: GenerateRequest):
    topic = get_topic(topic_id)
    if not topic:
        return {"error": "not found"}

    def run():
        from batch_generate import _generate_single, load_topic
        from db import create_job, has_active_job
        data = load_topic(topic["json_path"])
        for seg in data["segments"]:
            seg["series_title"] = data["series_title"]
        for seg in data["segments"]:
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
        from batch_generate import batch_generate
        batch_generate(topic["json_path"], OUTPUT_DIR, max_parallel=2,
                       topic_id=topic_id)

    threading.Thread(target=run, daemon=True).start()
    return {"status": "started"}


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
