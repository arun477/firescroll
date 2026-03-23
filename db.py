import os
import sqlite3
import uuid
from datetime import datetime, timezone

DB_PATH = os.path.join(os.path.dirname(__file__), "firescroll.db")

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
            series_title TEXT,
            json_path TEXT NOT NULL,
            total_segments INTEGER DEFAULT 0,
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
            error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (topic_id) REFERENCES topics(id)
        );

        CREATE INDEX IF NOT EXISTS idx_jobs_topic ON jobs(topic_id);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    """)
    conn.commit()
    conn.close()


def find_topic_by_json(json_path):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM topics WHERE json_path = ?", (json_path,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def create_topic(title, series_title, json_path, total_segments):
    existing = find_topic_by_json(json_path)
    if existing:
        return existing["id"]

    conn = get_conn()
    topic_id = uuid.uuid4().hex[:12]
    conn.execute(
        "INSERT INTO topics (id, title, series_title, json_path, total_segments, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (topic_id, title, series_title, json_path, total_segments, _now()),
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


def create_job(topic_id, segment_id, mode, caption):
    if has_active_job(topic_id, segment_id):
        return None

    conn = get_conn()
    job_id = uuid.uuid4().hex[:12]
    now = _now()
    conn.execute(
        "INSERT INTO jobs (id, topic_id, segment_id, mode, caption, status, "
        "created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (job_id, topic_id, segment_id, mode, caption, STATUS_PENDING, now, now),
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


init_db()
