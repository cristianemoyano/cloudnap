"""API routes for CloudNap application."""

import logging
from flask import Blueprint, jsonify, request
from typing import Dict, Any

from app.config import config
from app.services.huawei_cloud_service import HuaweiCloudService
from app.services.scheduler_service import SchedulerService
from app.services.logging_service import LoggingService

logger = logging.getLogger(__name__)

# Create blueprints
api_bp = Blueprint('api', __name__, url_prefix='/api')

# Initialize services
huawei_service = HuaweiCloudService(config.huawei_cloud)
scheduler_service = SchedulerService(config, huawei_service)
logging_service = LoggingService(config.logging)


@api_bp.route('/clusters', methods=['GET'])
def get_clusters():
    """Get list of all clusters with their status."""
    try:
        clusters_status = huawei_service.get_all_clusters_status(config.clusters)
        return jsonify({
            'success': True,
            'data': clusters_status,
            'count': len(clusters_status)
        })
    except Exception as e:
        logger.error(f"Failed to get clusters: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/clusters/<cluster_name>', methods=['GET'])
def get_cluster(cluster_name: str):
    """Get status of a specific cluster."""
    try:
        cluster = config.get_cluster_by_name(cluster_name)
        if not cluster:
            return jsonify({
                'success': False,
                'error': f'Cluster {cluster_name} not found'
            }), 404
        
        cluster_status = huawei_service.get_cluster_status(cluster)
        return jsonify({
            'success': True,
            'data': cluster_status
        })
    except Exception as e:
        logger.error(f"Failed to get cluster {cluster_name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/clusters/<cluster_name>/start', methods=['POST'])
def start_cluster(cluster_name: str):
    """Start a cluster (wake up all instances)."""
    try:
        cluster = config.get_cluster_by_name(cluster_name)
        if not cluster:
            return jsonify({
                'success': False,
                'error': f'Cluster {cluster_name} not found'
            }), 404
        
        result = huawei_service.start_cluster(cluster)
        
        # Log the action
        logging_service.log_cluster_action(
            cluster_name, 
            'start', 
            result['success'],
            f"Instances: {len(result['instances'])}"
        )
        
        return jsonify({
            'success': result['success'],
            'data': result,
            'message': f"Cluster {cluster_name} {'started successfully' if result['success'] else 'failed to start'}"
        })
    except Exception as e:
        logger.error(f"Failed to start cluster {cluster_name}: {e}")
        logging_service.log_cluster_action(cluster_name, 'start', False, str(e))
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/clusters/<cluster_name>/stop', methods=['POST'])
def stop_cluster(cluster_name: str):
    """Stop a cluster (shutdown all instances)."""
    try:
        cluster = config.get_cluster_by_name(cluster_name)
        if not cluster:
            return jsonify({
                'success': False,
                'error': f'Cluster {cluster_name} not found'
            }), 404
        
        result = huawei_service.stop_cluster(cluster)
        
        # Log the action
        logging_service.log_cluster_action(
            cluster_name, 
            'stop', 
            result['success'],
            f"Instances: {len(result['instances'])}"
        )
        
        return jsonify({
            'success': result['success'],
            'data': result,
            'message': f"Cluster {cluster_name} {'stopped successfully' if result['success'] else 'failed to stop'}"
        })
    except Exception as e:
        logger.error(f"Failed to stop cluster {cluster_name}: {e}")
        logging_service.log_cluster_action(cluster_name, 'stop', False, str(e))
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/scheduler/jobs', methods=['GET'])
def get_scheduled_jobs():
    """Get list of all scheduled jobs."""
    try:
        jobs = scheduler_service.get_scheduled_jobs()
        return jsonify({
            'success': True,
            'data': jobs,
            'count': len(jobs)
        })
    except Exception as e:
        logger.error(f"Failed to get scheduled jobs: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/scheduler/jobs/<job_id>/trigger', methods=['POST'])
def trigger_job(job_id: str):
    """Trigger a scheduled job immediately."""
    try:
        success = scheduler_service.trigger_job_now(job_id)
        if success:
            logging_service.log_scheduler_event('manual_trigger', job_id)
            return jsonify({
                'success': True,
                'message': f'Job {job_id} triggered successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': f'Job {job_id} not found or failed to trigger'
            }), 404
    except Exception as e:
        logger.error(f"Failed to trigger job {job_id}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/logs', methods=['GET'])
def get_logs():
    """Get recent application logs."""
    try:
        lines = request.args.get('lines', 100, type=int)
        logs = logging_service.get_recent_logs(lines)
        return jsonify({
            'success': True,
            'data': logs,
            'count': len(logs)
        })
    except Exception as e:
        logger.error(f"Failed to get logs: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    try:
        # Check if services are running
        scheduler_running = scheduler_service.scheduler.running if scheduler_service.scheduler else False
        
        return jsonify({
            'success': True,
            'status': 'healthy',
            'services': {
                'scheduler': 'running' if scheduler_running else 'stopped',
                'huawei_cloud': 'connected'
            },
            'timestamp': logging_service.get_recent_logs(1)[0]['timestamp'] if logging_service.get_recent_logs(1) else None
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'success': False,
            'status': 'unhealthy',
            'error': str(e)
        }), 500


@api_bp.route('/config', methods=['GET'])
def get_config():
    """Get current configuration (without sensitive data)."""
    try:
        safe_config = {
            'app': {
                'debug': config.app.debug,
                'host': config.app.host,
                'port': config.app.port,
                'log_level': config.app.log_level
            },
            'huawei_cloud': {
                'region': config.huawei_cloud.region,
                'project_id': config.huawei_cloud.project_id
            },
            'scheduler': {
                'timezone': config.scheduler.timezone,
                'max_workers': config.scheduler.max_workers,
                'coalesce': config.scheduler.coalesce,
                'misfire_grace_time': config.scheduler.misfire_grace_time
            },
            'clusters': [
                {
                    'name': cluster.name,
                    'description': cluster.description,
                    'region': cluster.region,
                    'tags': cluster.tags,
                    'enabled': cluster.enabled,
                    'instance_count': len(cluster.instance_ids),
                    'schedule': cluster.schedule
                }
                for cluster in config.clusters
            ]
        }
        
        return jsonify({
            'success': True,
            'data': safe_config
        })
    except Exception as e:
        logger.error(f"Failed to get config: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
