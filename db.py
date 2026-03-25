import hashlib
import os
import sqlite3
import uuid
from datetime import datetime, timezone

_db_dir = os.path.join(os.path.dirname(__file__), "dbdata")
os.makedirs(_db_dir, exist_ok=True)
DB_PATH = os.path.join(_db_dir, "firescroll.db")

STATUS_PENDING = "pending"
STATUS_AUDIO = "audio"
STATUS_BACKGROUNDS = "backgrounds"
STATUS_TRANSCRIBING = "transcribing"
STATUS_RENDERING = "rendering"
STATUS_ENCODING = "encoding"
STATUS_DONE = "done"
STATUS_FAILED = "failed"

ACTIVE_STATUSES = (
    STATUS_PENDING, STATUS_AUDIO, STATUS_BACKGROUNDS,
    STATUS_TRANSCRIBING, STATUS_RENDERING, STATUS_ENCODING,
)


def _now():
    return datetime.now(timezone.utc).isoformat()


_wal_initialized = set()


def get_conn(db_path=DB_PATH):
    conn = sqlite3.connect(db_path, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    # WAL mode persists on the database file — only needs to be set once
    if db_path not in _wal_initialized:
        conn.execute("PRAGMA journal_mode=WAL")
        _wal_initialized.add(db_path)
    return conn


def init_db(db_path=DB_PATH):
    conn = get_conn(db_path)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS topics (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            series_title TEXT,
            json_path TEXT DEFAULT '',
            total_segments INTEGER DEFAULT 0,
            research_status TEXT DEFAULT 'pending',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            segment_id INTEGER NOT NULL,
            mode TEXT NOT NULL DEFAULT 'full',
            caption TEXT NOT NULL DEFAULT 'default',
            status TEXT NOT NULL DEFAULT 'pending',
            progress INTEGER DEFAULT 0,
            video_path TEXT,
            thumb_path TEXT,
            audio_path TEXT,
            duration_seconds REAL,
            voice_provider TEXT DEFAULT '',
            voice_id TEXT DEFAULT '',
            music_track TEXT DEFAULT '',
            error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );

        CREATE INDEX IF NOT EXISTS idx_jobs_topic ON jobs(topic_id);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

        CREATE TABLE IF NOT EXISTS segments (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            segment_num INTEGER NOT NULL,
            title TEXT,
            hook TEXT,
            script TEXT,
            visual_cue TEXT,
            source TEXT DEFAULT 'ai',
            source_urls TEXT,
            raw_research TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );

        CREATE INDEX IF NOT EXISTS idx_segments_topic ON segments(topic_id);

        CREATE TABLE IF NOT EXISTS research_tasks (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            task_type TEXT NOT NULL,
            query TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            result TEXT,
            error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );

        CREATE INDEX IF NOT EXISTS idx_research_topic ON research_tasks(topic_id);

        CREATE TABLE IF NOT EXISTS api_keys (
            key_name TEXT PRIMARY KEY,
            key_value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS research_sources (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            url TEXT NOT NULL,
            title TEXT,
            content TEXT,
            content_hash TEXT,
            source_type TEXT,
            screenshot_url TEXT,
            word_count INTEGER DEFAULT 0,
            metadata TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );
        CREATE INDEX IF NOT EXISTS idx_sources_topic ON research_sources(topic_id);

        CREATE TABLE IF NOT EXISTS segment_source_links (
            segment_id TEXT NOT NULL,
            source_id TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (segment_id, source_id),
            FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE,
            FOREIGN KEY (source_id) REFERENCES research_sources(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_ssl_segment ON segment_source_links(segment_id);
        CREATE INDEX IF NOT EXISTS idx_ssl_source ON segment_source_links(source_id);

        CREATE TABLE IF NOT EXISTS firecrawl_jobs (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            segment_id TEXT,
            job_type TEXT NOT NULL,
            target TEXT,
            config TEXT,
            status TEXT DEFAULT 'pending',
            pages_found INTEGER DEFAULT 0,
            credits_used INTEGER DEFAULT 0,
            result_preview TEXT,
            error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );
        CREATE INDEX IF NOT EXISTS idx_fc_jobs_topic ON firecrawl_jobs(topic_id);

        CREATE TABLE IF NOT EXISTS segment_config (
            segment_id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            config TEXT NOT NULL DEFAULT '{}',
            meta TEXT NOT NULL DEFAULT '{}',
            updated_at TEXT NOT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id),
            FOREIGN KEY (segment_id) REFERENCES segments(id)
        );
        CREATE INDEX IF NOT EXISTS idx_segcfg_topic ON segment_config(topic_id);

        CREATE TABLE IF NOT EXISTS media_library (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            original_name TEXT,
            file_path TEXT NOT NULL,
            thumb_path TEXT,
            duration_seconds REAL,
            width INTEGER,
            height INTEGER,
            file_size INTEGER,
            media_type TEXT DEFAULT 'video',
            status TEXT DEFAULT 'processing',
            meta TEXT DEFAULT '{}',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_media_status ON media_library(status);

        CREATE TABLE IF NOT EXISTS remotion_jobs (
            id TEXT PRIMARY KEY,
            topic_id TEXT NOT NULL,
            segment_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            progress INTEGER DEFAULT 0,
            scene_config TEXT,
            user_prompt TEXT DEFAULT '',
            style TEXT DEFAULT 'cinematic',
            video_path TEXT,
            audio_path TEXT,
            final_path TEXT,
            duration_seconds REAL,
            voice_provider TEXT DEFAULT '',
            voice_id TEXT DEFAULT '',
            language TEXT DEFAULT '',
            error TEXT,
            celery_task_id TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );
        CREATE INDEX IF NOT EXISTS idx_remotion_jobs_topic ON remotion_jobs(topic_id);
        CREATE INDEX IF NOT EXISTS idx_remotion_jobs_status ON remotion_jobs(status);
    """)
    conn.commit()

    # Migration: add celery_task_id to jobs table
    try:
        conn.execute("ALTER TABLE jobs ADD COLUMN celery_task_id TEXT DEFAULT ''")
        conn.commit()
    except Exception:
        pass  # Column already exists

    conn.close()


def find_topic_by_json(json_path):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM topics WHERE json_path = ?", (json_path,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def create_topic(title, series_title="", json_path="", total_segments=0,
                  description=""):
    if json_path:
        existing = find_topic_by_json(json_path)
        if existing:
            return existing["id"]

    conn = get_conn()
    topic_id = uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO topics (id, title, description, series_title, json_path, "
        "total_segments, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (topic_id, title, description, series_title, json_path, total_segments, _now()),
    )
    conn.commit()
    conn.close()
    return topic_id


def has_active_job(topic_id, segment_id):
    conn = get_conn()
    row = conn.execute(
        "SELECT id FROM jobs WHERE topic_id = ? AND segment_id = ? "
        "AND status IN (?, ?, ?, ?, ?, ?)",
        (topic_id, segment_id, *ACTIVE_STATUSES),
    ).fetchone()
    conn.close()
    return row is not None


def create_job(topic_id, segment_id, mode, caption,
               voice_provider="", voice_id="", music_track=""):
    conn = get_conn()
    # Atomic check-and-insert: check + insert in one transaction to avoid race
    row = conn.execute(
        "SELECT id FROM jobs WHERE topic_id = ? AND segment_id = ? "
        "AND status IN (?, ?, ?, ?, ?, ?)",
        (topic_id, segment_id, *ACTIVE_STATUSES),
    ).fetchone()
    if row:
        conn.close()
        return None
    job_id = uuid.uuid4().hex[:12]
    now = _now()
    conn.execute(
        "INSERT INTO jobs (id, topic_id, segment_id, mode, caption, "
        "voice_provider, voice_id, music_track, status, "
        "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (job_id, topic_id, segment_id, mode, caption,
         voice_provider, voice_id, music_track, STATUS_PENDING, now, now),
    )
    conn.commit()
    conn.close()
    return job_id


def update_job(job_id, **kwargs):
    conn = get_conn()
    kwargs["updated_at"] = _now()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [job_id]
    conn.execute(f"UPDATE jobs SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def get_job(job_id):
    conn = get_conn()
    row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_job(job_id):
    conn = get_conn()
    conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()


def get_jobs_for_topic(topic_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM jobs WHERE topic_id = ? ORDER BY segment_id",
        (topic_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_topic(topic_id):
    conn = get_conn()
    row = conn.execute("SELECT * FROM topics WHERE id = ?", (topic_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_topics():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM topics ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_topics_page(page=1, page_size=12):
    conn = get_conn()
    total = conn.execute("SELECT COUNT(*) FROM topics").fetchone()[0]
    offset = (page - 1) * page_size
    rows = conn.execute(
        "SELECT * FROM topics ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (page_size, offset),
    ).fetchall()
    topics = [dict(r) for r in rows]

    for t in topics:
        tid = t["id"]
        # Segment stats
        seg_total = conn.execute(
            "SELECT COUNT(*) FROM segments WHERE topic_id = ?", (tid,)
        ).fetchone()[0]
        seg_ready = conn.execute(
            "SELECT COUNT(*) FROM segments WHERE topic_id = ? AND status = 'ready'",
            (tid,),
        ).fetchone()[0]
        # Video stats
        vid_total = conn.execute(
            "SELECT COUNT(*) FROM jobs WHERE topic_id = ?", (tid,)
        ).fetchone()[0]
        vid_done = conn.execute(
            "SELECT COUNT(*) FROM jobs WHERE topic_id = ? AND status = 'done'",
            (tid,),
        ).fetchone()[0]
        # Source count
        src_count = conn.execute(
            "SELECT COUNT(*) FROM research_sources WHERE topic_id = ?", (tid,)
        ).fetchone()[0]

        t["segments_total"] = seg_total
        t["segments_ready"] = seg_ready
        t["videos_total"] = vid_total
        t["videos_done"] = vid_done
        t["source_count"] = src_count

    conn.close()
    return {
        "topics": topics,
        "total": total,
        "page": page,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


def get_completed_videos(topic_id=None):
    conn = get_conn()
    if topic_id:
        rows = conn.execute(
            "SELECT j.*, t.title as topic_title, t.series_title "
            "FROM jobs j JOIN topics t ON j.topic_id = t.id "
            "WHERE j.status = ? AND j.topic_id = ? ORDER BY j.segment_id",
            (STATUS_DONE, topic_id),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT j.*, t.title as topic_title, t.series_title "
            "FROM jobs j JOIN topics t ON j.topic_id = t.id "
            "WHERE j.status = ? ORDER BY t.created_at DESC, j.segment_id",
            (STATUS_DONE,),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_feed_page(topic_id=None, cursor=None, limit=6):
    """Cursor-based paginated feed. Cursor is a job created_at timestamp."""
    conn = get_conn()
    params = [STATUS_DONE]
    where = "j.status = ?"

    if topic_id:
        where += " AND j.topic_id = ?"
        params.append(topic_id)

    if cursor:
        where += " AND j.created_at < ?"
        params.append(cursor)

    # Total count (without cursor filter)
    count_params = [STATUS_DONE]
    count_where = "j.status = ?"
    if topic_id:
        count_where += " AND j.topic_id = ?"
        count_params.append(topic_id)
    total = conn.execute(
        f"SELECT COUNT(*) FROM jobs j WHERE {count_where}", count_params
    ).fetchone()[0]

    rows = conn.execute(
        f"SELECT j.*, t.title as topic_title, t.series_title "
        f"FROM jobs j JOIN topics t ON j.topic_id = t.id "
        f"WHERE {where} "
        f"ORDER BY j.created_at DESC "
        f"LIMIT ?",
        params + [limit + 1],  # fetch one extra to know if there's more
    ).fetchall()
    conn.close()

    items = [dict(r) for r in rows]
    has_more = len(items) > limit
    if has_more:
        items = items[:limit]

    next_cursor = items[-1]["created_at"] if items and has_more else None

    return {
        "items": items,
        "total": total,
        "next_cursor": next_cursor,
        "has_more": has_more,
    }


def create_segment(topic_id, segment_num, *, title="", hook="", script="",
                    visual_cue="", source="ai"):
    conn = get_conn()
    seg_id = uuid.uuid4().hex[:12]
    now = _now()
    conn.execute(
        "INSERT INTO segments (id, topic_id, segment_num, title, hook, script, "
        "visual_cue, source, status, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
        (seg_id, topic_id, segment_num, title, hook, script, visual_cue, source,
         now, now),
    )
    conn.commit()
    conn.close()
    return seg_id


def update_segment(seg_id, **kwargs):
    conn = get_conn()
    kwargs["updated_at"] = _now()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [seg_id]
    conn.execute(f"UPDATE segments SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def get_segments_for_topic(topic_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM segments WHERE topic_id = ? ORDER BY segment_num DESC",
        (topic_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_segment(seg_id):
    conn = get_conn()
    conn.execute("DELETE FROM segment_source_links WHERE segment_id = ?", (seg_id,))
    conn.execute("DELETE FROM segment_config WHERE segment_id = ?", (seg_id,))
    conn.execute("DELETE FROM segments WHERE id = ?", (seg_id,))
    conn.commit()
    conn.close()


def create_research_task(topic_id, task_type, query=""):
    conn = get_conn()
    task_id = uuid.uuid4().hex[:12]
    now = _now()
    conn.execute(
        "INSERT INTO research_tasks (id, topic_id, task_type, query, status, "
        "created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
        (task_id, topic_id, task_type, query, now, now),
    )
    conn.commit()
    conn.close()
    return task_id


def update_research_task(task_id, **kwargs):
    conn = get_conn()
    kwargs["updated_at"] = _now()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [task_id]
    conn.execute(f"UPDATE research_tasks SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def get_research_tasks(topic_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM research_tasks WHERE topic_id = ? ORDER BY created_at",
        (topic_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_activity_page(topic_id, page=1, page_size=20, status_filter=None):
    """Return paginated activity (research tasks + firecrawl jobs merged by time)."""
    conn = get_conn()

    status_clause_rt = ""
    status_clause_fc = ""
    params_rt = [topic_id]
    params_fc = [topic_id]
    if status_filter and status_filter != "all":
        if status_filter == "running":
            status_clause_rt = " AND status NOT IN ('done','failed','pending')"
            status_clause_fc = " AND status NOT IN ('done','failed','pending')"
        else:
            status_clause_rt = " AND status = ?"
            status_clause_fc = " AND status = ?"
            params_rt.append(status_filter)
            params_fc.append(status_filter)

    # Count totals
    total_rt = conn.execute(
        f"SELECT COUNT(*) FROM research_tasks WHERE topic_id = ?{status_clause_rt}",
        params_rt,
    ).fetchone()[0]
    total_fc = conn.execute(
        f"SELECT COUNT(*) FROM firecrawl_jobs WHERE topic_id = ?{status_clause_fc}",
        params_fc,
    ).fetchone()[0]
    total = total_rt + total_fc

    # Fetch both sets, union and sort by time desc, then paginate
    offset = (page - 1) * page_size
    rows = conn.execute(
        f"""
        SELECT id, 'research' AS kind, task_type AS type, query, status, error,
               updated_at AS time, NULL AS pages, NULL AS result_preview, NULL AS segment_id
        FROM research_tasks WHERE topic_id = ?{status_clause_rt}
        UNION ALL
        SELECT id, 'firecrawl' AS kind, job_type AS type, target AS query, status, error,
               updated_at AS time, pages_found AS pages, result_preview, segment_id
        FROM firecrawl_jobs WHERE topic_id = ?{status_clause_fc}
        ORDER BY time DESC
        LIMIT ? OFFSET ?
        """,
        params_rt + params_fc + [page_size, offset],
    ).fetchall()
    conn.close()

    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "page": page,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


def delete_research_task(task_id):
    conn = get_conn()
    conn.execute("DELETE FROM research_tasks WHERE id = ?", (task_id,))
    conn.commit()
    conn.close()


def update_topic(topic_id, **kwargs):
    conn = get_conn()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [topic_id]
    conn.execute(f"UPDATE topics SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def add_research_source(topic_id, url, title, content, source_type, *,
                         screenshot_url=""):
    content_hash = hashlib.sha256((content or "").encode()).hexdigest()
    word_count = len((content or "").split())
    source_id = uuid.uuid4().hex[:12]
    conn = get_conn()
    conn.execute(
        "INSERT INTO research_sources "
        "(id, topic_id, url, title, content, content_hash, source_type, "
        "screenshot_url, word_count, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (source_id, topic_id, url, title, content,
         content_hash, source_type, screenshot_url, word_count, _now()),
    )
    conn.commit()
    conn.close()
    return source_id


def get_research_sources(topic_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, topic_id, url, title, source_type, screenshot_url, "
        "word_count, created_at, substr(content, 1, 200) as content_preview "
        "FROM research_sources "
        "WHERE topic_id = ? ORDER BY created_at DESC",
        (topic_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def link_segment_sources(segment_id, source_ids):
    if not source_ids:
        return
    conn = get_conn()
    now = _now()
    conn.executemany(
        "INSERT OR IGNORE INTO segment_source_links "
        "(segment_id, source_id, created_at) VALUES (?, ?, ?)",
        [(segment_id, sid, now) for sid in source_ids],
    )
    conn.commit()
    conn.close()


def get_sources_for_segment(segment_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT rs.id, rs.url, rs.title, rs.source_type, rs.word_count, "
        "rs.created_at, substr(rs.content, 1, 200) as content_preview "
        "FROM segment_source_links ssl "
        "JOIN research_sources rs ON ssl.source_id = rs.id "
        "WHERE ssl.segment_id = ? ORDER BY rs.created_at",
        (segment_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_research_source(source_id):
    conn = get_conn()
    conn.execute("DELETE FROM research_sources WHERE id = ?", (source_id,))
    conn.commit()
    conn.close()


def get_source_stats(topic_id):
    conn = get_conn()
    total = conn.execute(
        "SELECT COUNT(*) FROM research_sources WHERE topic_id = ?", (topic_id,)
    ).fetchone()[0]
    total_words = conn.execute(
        "SELECT COALESCE(SUM(word_count),0) FROM research_sources WHERE topic_id = ?",
        (topic_id,)
    ).fetchone()[0]
    type_rows = conn.execute(
        "SELECT source_type, COUNT(*) as cnt FROM research_sources "
        "WHERE topic_id = ? GROUP BY source_type",
        (topic_id,),
    ).fetchall()
    conn.close()
    type_counts = {r["source_type"]: r["cnt"] for r in type_rows}
    return {"total": total, "total_words": total_words, "type_counts": type_counts}


def get_research_sources_paginated(topic_id, page=1, per_page=8, source_type=None):
    conn = get_conn()
    where = "WHERE topic_id = ?"
    params = [topic_id]
    if source_type:
        where += " AND source_type = ?"
        params.append(source_type)

    total = conn.execute(
        f"SELECT COUNT(*) FROM research_sources {where}", params
    ).fetchone()[0]

    offset = (page - 1) * per_page
    rows = conn.execute(
        f"SELECT id, topic_id, url, title, source_type, word_count, created_at, "
        f"substr(content, 1, 200) as content_preview "
        f"FROM research_sources {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
        params + [per_page, offset],
    ).fetchall()
    conn.close()

    pages = max(1, (total + per_page - 1) // per_page)
    return {"sources": [dict(r) for r in rows], "total": total,
            "page": page, "pages": pages}


def create_firecrawl_job(topic_id, job_type, target, *,
                          segment_id=None, config=""):
    conn = get_conn()
    job_id = uuid.uuid4().hex[:12]
    now = _now()
    conn.execute(
        "INSERT INTO firecrawl_jobs (id, topic_id, segment_id, job_type, "
        "target, config, status, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, 'running', ?, ?)",
        (job_id, topic_id, segment_id, job_type, target, config, now, now),
    )
    conn.commit()
    conn.close()
    return job_id


def update_firecrawl_job(job_id, **kwargs):
    conn = get_conn()
    kwargs["updated_at"] = _now()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [job_id]
    conn.execute(f"UPDATE firecrawl_jobs SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def get_firecrawl_jobs(topic_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM firecrawl_jobs WHERE topic_id = ? "
        "ORDER BY created_at DESC",
        (topic_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


API_KEY_NAMES = ["openai", "firecrawl", "elevenlabs"]


def set_api_key(key_name, key_value):
    conn = get_conn()
    conn.execute(
        "INSERT INTO api_keys (key_name, key_value, updated_at) "
        "VALUES (?, ?, ?) "
        "ON CONFLICT(key_name) DO UPDATE SET key_value = ?, updated_at = ?",
        (key_name, key_value, _now(), key_value, _now()),
    )
    conn.commit()
    conn.close()


def get_api_key(key_name):
    conn = get_conn()
    row = conn.execute(
        "SELECT key_value FROM api_keys WHERE key_name = ?", (key_name,)
    ).fetchone()
    conn.close()
    return row["key_value"] if row else None


def get_all_api_keys():
    conn = get_conn()
    rows = conn.execute(
        "SELECT key_name, key_value, updated_at FROM api_keys"
    ).fetchall()
    conn.close()
    keys = {}
    for r in rows:
        val = r["key_value"]
        keys[r["key_name"]] = {
            "masked": val[:8] + "..." + val[-4:] if len(val) > 12 else "***",
            "is_set": True,
            "updated_at": r["updated_at"],
        }
    for name in API_KEY_NAMES:
        if name not in keys:
            keys[name] = {"masked": "", "is_set": False, "updated_at": None}
    return keys


def delete_api_key(key_name):
    conn = get_conn()
    conn.execute("DELETE FROM api_keys WHERE key_name = ?", (key_name,))
    conn.commit()
    conn.close()


def create_media(media_id, filename, original_name, file_path):
    conn = get_conn()
    conn.execute(
        "INSERT INTO media_library (id, filename, original_name, file_path, "
        "status, created_at) VALUES (?, ?, ?, ?, 'processing', ?)",
        (media_id, filename, original_name, file_path, _now()),
    )
    conn.commit()
    conn.close()
    return media_id


def update_media(media_id, **kwargs):
    conn = get_conn()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [media_id]
    conn.execute(f"UPDATE media_library SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def get_all_media(status=None):
    conn = get_conn()
    if status:
        rows = conn.execute(
            "SELECT * FROM media_library WHERE status = ? ORDER BY created_at DESC",
            (status,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM media_library ORDER BY created_at DESC"
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_media(media_id):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM media_library WHERE id = ?", (media_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_media(media_id):
    import os as _os
    conn = get_conn()
    row = conn.execute(
        "SELECT file_path, thumb_path FROM media_library WHERE id = ?",
        (media_id,),
    ).fetchone()
    # Clear any segment configs referencing this media
    configs = conn.execute(
        "SELECT segment_id, config FROM segment_config WHERE config LIKE ?",
        (f'%{media_id}%',),
    ).fetchall()
    for cfg in configs:
        import json as _json
        try:
            data = _json.loads(cfg["config"])
            if data.get("bg_video_id") == media_id:
                data["bg_video_id"] = ""
                conn.execute(
                    "UPDATE segment_config SET config = ?, updated_at = ? WHERE segment_id = ?",
                    (_json.dumps(data), _now(), cfg["segment_id"]),
                )
        except Exception:
            pass
    conn.execute("DELETE FROM media_library WHERE id = ?", (media_id,))
    conn.commit()
    conn.close()
    # Remove files after DB commit
    if row:
        for p in [row["file_path"], row["thumb_path"]]:
            if p and _os.path.exists(p):
                try:
                    _os.remove(p)
                except OSError:
                    pass


def save_segment_config(segment_id, topic_id, config):
    import json as _json
    conn = get_conn()
    config_str = _json.dumps(config) if isinstance(config, dict) else config
    conn.execute(
        "INSERT INTO segment_config (segment_id, topic_id, config, updated_at) "
        "VALUES (?, ?, ?, ?) "
        "ON CONFLICT(segment_id) DO UPDATE SET config = ?, updated_at = ?",
        (segment_id, topic_id, config_str, _now(), config_str, _now()),
    )
    conn.commit()
    conn.close()


def get_segment_config(segment_id):
    import json as _json
    conn = get_conn()
    row = conn.execute(
        "SELECT config FROM segment_config WHERE segment_id = ?", (segment_id,)
    ).fetchone()
    conn.close()
    if not row:
        return {}
    try:
        return _json.loads(row["config"])
    except Exception:
        return {}


def get_all_segment_configs(topic_id):
    import json as _json
    conn = get_conn()
    rows = conn.execute(
        "SELECT segment_id, config FROM segment_config WHERE topic_id = ?",
        (topic_id,),
    ).fetchall()
    conn.close()
    result = {}
    for r in rows:
        try:
            result[r["segment_id"]] = _json.loads(r["config"])
        except Exception:
            result[r["segment_id"]] = {}
    return result


init_db()


# ══════════════════════════════════════════════════════
# REMOTION JOBS (completely separate from standard jobs)
# ══════════════════════════════════════════════════════

REMOTION_ACTIVE = ("pending", "audio", "composing", "rendering", "encoding")


def create_remotion_job(topic_id, segment_id, user_prompt="", style="cinematic",
                        voice_provider="", voice_id="", language=""):
    conn = get_conn()
    # Check for existing active remotion job
    row = conn.execute(
        "SELECT id FROM remotion_jobs WHERE topic_id = ? AND segment_id = ? "
        "AND status IN (?, ?, ?, ?, ?)",
        (topic_id, segment_id, *REMOTION_ACTIVE),
    ).fetchone()
    if row:
        conn.close()
        return None
    job_id = uuid.uuid4().hex[:12]
    now = _now()
    conn.execute(
        "INSERT INTO remotion_jobs (id, topic_id, segment_id, user_prompt, style, "
        "voice_provider, voice_id, language, status, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
        (job_id, topic_id, segment_id, user_prompt, style,
         voice_provider, voice_id, language, now, now),
    )
    conn.commit()
    conn.close()
    return job_id


def update_remotion_job(job_id, **kwargs):
    conn = get_conn()
    kwargs["updated_at"] = _now()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [job_id]
    conn.execute(f"UPDATE remotion_jobs SET {sets} WHERE id = ?", vals)
    conn.commit()
    conn.close()


def get_remotion_job(job_id):
    conn = get_conn()
    row = conn.execute("SELECT * FROM remotion_jobs WHERE id = ?", (job_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_remotion_jobs_for_topic(topic_id):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM remotion_jobs WHERE topic_id = ? ORDER BY created_at DESC",
        (topic_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def delete_remotion_job(job_id):
    conn = get_conn()
    conn.execute("DELETE FROM remotion_jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()


def recover_stuck_on_startup():
    """Mark orphaned jobs/media as failed on startup.
    Only resets jobs with no celery_task_id (never dispatched to a worker)
    or stuck in 'pending' (dispatched but worker died before picking up).
    """
    conn = get_conn()
    # Recover orphaned jobs: pending with no celery task, or any status
    # with empty celery_task_id (never reached a worker)
    n_jobs = conn.execute(
        "UPDATE jobs SET status = ?, error = 'Server restarted', "
        "updated_at = ? WHERE status IN (?, ?, ?, ?, ?, ?) "
        "AND (celery_task_id IS NULL OR celery_task_id = '')",
        (STATUS_FAILED, _now(), *ACTIVE_STATUSES),
    ).rowcount
    # Recover orphaned remotion jobs
    n_rjobs = conn.execute(
        "UPDATE remotion_jobs SET status = 'failed', error = 'Server restarted', "
        "updated_at = ? WHERE status IN (?, ?, ?, ?, ?) "
        "AND (celery_task_id IS NULL OR celery_task_id = '')",
        (_now(), *REMOTION_ACTIVE),
    ).rowcount
    # Recover stuck media uploads
    n_media = conn.execute(
        "UPDATE media_library SET status = 'failed', "
        "meta = '{\"error\": \"Server restarted during processing\"}' "
        "WHERE status = 'processing'",
    ).rowcount
    conn.commit()
    conn.close()
    if n_jobs or n_media:
        print(f"[Recovery] Reset {n_jobs} orphaned jobs, {n_media} stuck media")
