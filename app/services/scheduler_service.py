"""Scheduler service for automated cluster management."""

import logging
from datetime import datetime
from typing import Dict, Any, List
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.memory import MemoryJobStore
from apscheduler.executors.pool import ThreadPoolExecutor

from app.config import Config, ClusterConfig
from app.services.huawei_cloud_service import HuaweiCloudService

logger = logging.getLogger(__name__)


class SchedulerService:
    """Service for managing scheduled cluster operations."""
    
    def __init__(self, config: Config, huawei_service: HuaweiCloudService):
        """Initialize scheduler service."""
        self.config = config
        self.huawei_service = huawei_service
        self.scheduler = None
        self._setup_scheduler()
    
    def _setup_scheduler(self) -> None:
        """Setup the APScheduler instance."""
        jobstores = {
            'default': MemoryJobStore()
        }
        
        executors = {
            'default': ThreadPoolExecutor(max_workers=self.config.scheduler.max_workers)
        }
        
        job_defaults = {
            'coalesce': self.config.scheduler.coalesce,
            'max_instances': 1,
            'misfire_grace_time': self.config.scheduler.misfire_grace_time
        }
        
        self.scheduler = BackgroundScheduler(
            jobstores=jobstores,
            executors=executors,
            job_defaults=job_defaults,
            timezone=self.config.scheduler.timezone
        )
    
    def start(self) -> None:
        """Start the scheduler."""
        if not self.scheduler.running:
            self.scheduler.start()
            logger.info("Scheduler started")
            self._schedule_cluster_jobs()
    
    def stop(self) -> None:
        """Stop the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown()
            logger.info("Scheduler stopped")
    
    def _schedule_cluster_jobs(self) -> None:
        """Schedule jobs for all enabled clusters."""
        for cluster in self.config.get_enabled_clusters():
            self._schedule_cluster_job(cluster)
    
    def _schedule_cluster_job(self, cluster: ClusterConfig) -> None:
        """Schedule wake up and shutdown jobs for a cluster."""
        cluster_name = cluster.name
        
        # Schedule wake up job
        if 'wake_up' in cluster.schedule:
            cron_expr = cluster.schedule['wake_up']
            try:
                self.scheduler.add_job(
                    func=self._wake_up_cluster,
                    trigger=CronTrigger.from_crontab(cron_expr),
                    args=[cluster],
                    id=f"{cluster_name}_wake_up",
                    name=f"Wake up {cluster_name}",
                    replace_existing=True
                )
                logger.info(f"Scheduled wake up job for {cluster_name}: {cron_expr}")
            except Exception as e:
                logger.error(f"Failed to schedule wake up job for {cluster_name}: {e}")
        
        # Schedule shutdown job
        if 'shutdown' in cluster.schedule:
            cron_expr = cluster.schedule['shutdown']
            try:
                self.scheduler.add_job(
                    func=self._shutdown_cluster,
                    trigger=CronTrigger.from_crontab(cron_expr),
                    args=[cluster],
                    id=f"{cluster_name}_shutdown",
                    name=f"Shutdown {cluster_name}",
                    replace_existing=True
                )
                logger.info(f"Scheduled shutdown job for {cluster_name}: {cron_expr}")
            except Exception as e:
                logger.error(f"Failed to schedule shutdown job for {cluster_name}: {e}")
    
    def _wake_up_cluster(self, cluster: ClusterConfig) -> None:
        """Wake up a cluster (start all instances)."""
        logger.info(f"Executing scheduled wake up for cluster: {cluster.name}")
        try:
            result = self.huawei_service.start_cluster(cluster)
            if result['success']:
                logger.info(f"Successfully woke up cluster {cluster.name}")
            else:
                logger.error(f"Failed to wake up cluster {cluster.name}: {result['errors']}")
        except Exception as e:
            logger.error(f"Error waking up cluster {cluster.name}: {e}")
    
    def _shutdown_cluster(self, cluster: ClusterConfig) -> None:
        """Shutdown a cluster (stop all instances)."""
        logger.info(f"Executing scheduled shutdown for cluster: {cluster.name}")
        try:
            result = self.huawei_service.stop_cluster(cluster)
            if result['success']:
                logger.info(f"Successfully shutdown cluster {cluster.name}")
            else:
                logger.error(f"Failed to shutdown cluster {cluster.name}: {result['errors']}")
        except Exception as e:
            logger.error(f"Error shutting down cluster {cluster.name}: {e}")
    
    def get_scheduled_jobs(self) -> List[Dict[str, Any]]:
        """Get list of all scheduled jobs."""
        jobs = []
        for job in self.scheduler.get_jobs():
            jobs.append({
                'id': job.id,
                'name': job.name,
                'next_run_time': job.next_run_time.isoformat() if job.next_run_time else None,
                'trigger': str(job.trigger)
            })
        return jobs
    
    def add_cluster_schedule(self, cluster: ClusterConfig) -> None:
        """Add schedule for a new cluster."""
        if cluster.enabled:
            self._schedule_cluster_job(cluster)
    
    def remove_cluster_schedule(self, cluster_name: str) -> None:
        """Remove schedule for a cluster."""
        try:
            self.scheduler.remove_job(f"{cluster_name}_wake_up")
            self.scheduler.remove_job(f"{cluster_name}_shutdown")
            logger.info(f"Removed schedule for cluster {cluster_name}")
        except Exception as e:
            logger.warning(f"Failed to remove schedule for cluster {cluster_name}: {e}")
    
    def trigger_job_now(self, job_id: str) -> bool:
        """Trigger a scheduled job immediately."""
        try:
            job = self.scheduler.get_job(job_id)
            if job:
                job.modify(next_run_time=datetime.now())
                logger.info(f"Triggered job {job_id} to run now")
                return True
            else:
                logger.warning(f"Job {job_id} not found")
                return False
        except Exception as e:
            logger.error(f"Failed to trigger job {job_id}: {e}")
            return False
    
    def restart_scheduler(self) -> None:
        """Restart scheduler with current configuration."""
        try:
            # Shutdown current scheduler
            if self.scheduler.running:
                self.scheduler.shutdown(wait=True)
            
            # Reinitialize scheduler
            self._setup_scheduler()
            self._schedule_cluster_jobs()
            
            logger.info("Scheduler restarted successfully")
        except Exception as e:
            logger.error(f"Failed to restart scheduler: {e}")
            raise
