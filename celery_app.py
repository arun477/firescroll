import os

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
)


@celery.task(name="firescroll.generate_single", bind=True)
def generate_single_task(self, segment, mode, caption, output_dir, job_id, **kwargs):
    from db import update_job
    update_job(job_id, celery_task_id=self.request.id)

    from batch_generate import _generate_single
    return _generate_single(segment, mode, caption, output_dir, job_id, **kwargs)
