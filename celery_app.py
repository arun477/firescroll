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
