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


def get_conn(db_path=DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
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
    if has_active_job(topic_id, segment_id):
        return None
    conn = get_conn()
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
