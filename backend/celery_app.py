import os
import sys

# Ensure /app is on the Python path for prefork child processes
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from celery import Celery

celery = Celery("firescroll")

celery.conf.update(
    broker_url=os.environ.get("REDIS_URL", "redis://redis:6379/0"),
    result_backend=None,
    task_serializer="json",
    accept_content=["json"],
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    broker_connection_retry_on_startup=True,
)


@celery.task(name="firescroll.generate_single", bind=True,
             max_retries=0, reject_on_worker_lost=True,
             soft_time_limit=600, time_limit=660)
def generate_single_task(self, segment, mode, caption, output_dir, job_id, **kwargs):
    from batch_generate import _generate_single
    return _generate_single(segment, mode, caption, output_dir, job_id, **kwargs)


@celery.task(name="firescroll.remotion_generate", bind=True,
             max_retries=0, reject_on_worker_lost=True,
             soft_time_limit=900, time_limit=960)
def remotion_generate_task(self, segment, output_dir, job_id, **kwargs):
    from db import update_remotion_job
    update_remotion_job(job_id, celery_task_id=self.request.id)
    from remotion_pipeline import run_remotion_pipeline
    return run_remotion_pipeline(segment, job_id, output_dir, **kwargs)



# chat_agent_task removed — chat agent now runs in its own async service (agent/)
