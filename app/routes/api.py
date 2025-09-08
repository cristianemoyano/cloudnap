"""API routes for CloudNap application."""

import logging
import os
from flask import Blueprint, jsonify, request, abort
from typing import Dict, Any

from app.config import config
from app.services.huawei_cloud_service import HuaweiCloudService
# SchedulerService is now accessed via current_app.scheduler_service
from app.services.logging_service import LoggingService
from app.services.cache_service import cluster_cache

logger = logging.getLogger(__name__)

# Create blueprints
api_bp = Blueprint('api', __name__, url_prefix='/api')

# Initialize services
logging_service = LoggingService(config.logging)


@api_bp.route('/clusters', methods=['GET'])
def get_clusters():
    """Get list of all clusters with their status."""
    try:
        from flask import current_app
        clusters_status = current_app.huawei_service.get_all_clusters_status(config.clusters)
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
        
        from flask import current_app
        cluster_status = current_app.huawei_service.get_cluster_status(cluster)
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
        
        from flask import current_app
        result = current_app.huawei_service.stop_cluster(cluster)
        
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
        from flask import current_app
        jobs = current_app.scheduler_service.get_scheduled_jobs()
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
        from flask import current_app
        success = current_app.scheduler_service.trigger_job_now(job_id)
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
    """Get recent application logs - Only available in development."""
    # In production, return 404
    if os.getenv('FLASK_ENV') == 'production':
        abort(404)
    
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
        from flask import current_app
        scheduler_running = current_app.scheduler_service.scheduler.running if current_app.scheduler_service.scheduler else False
        
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


@api_bp.route('/config/reload', methods=['POST'])
def reload_config():
    """Reload configuration from file."""
    try:
        # Reload configuration
        config.reload()
        
        # Restart scheduler with new configuration
        from flask import current_app
        current_app.scheduler_service.restart_scheduler()
        
        logger.info("Configuration reloaded successfully")
        return jsonify({
            'success': True,
            'message': 'Configuration reloaded successfully'
        })
    except Exception as e:
        logger.error(f"Failed to reload config: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/clusters/status', methods=['GET'])
def get_clusters_status_async():
    """Get clusters status asynchronously (for fast UI loading)."""
    try:
        # Check if we should force refresh (bypass cache)
        force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'
        use_cache = not force_refresh
        
        from flask import current_app
        clusters_status = current_app.huawei_service.get_all_clusters_status(config.clusters, use_cache=use_cache)
        return jsonify({
            'success': True,
            'data': clusters_status,
            'cached': not force_refresh
        })
    except Exception as e:
        logger.error(f"Failed to get clusters status: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/cache/stats', methods=['GET'])
def get_cache_stats():
    """Get cache statistics."""
    try:
        stats = cluster_cache.get_stats()
        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        logger.error(f"Failed to get cache stats: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Clear all cache entries."""
    try:
        cluster_cache.clear()
        logger.info("Cache cleared via API")
        return jsonify({
            'success': True,
            'message': 'Cache cleared successfully'
        })
    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/cache/cleanup', methods=['POST'])
def cleanup_cache():
    """Remove expired entries from cache."""
    try:
        removed_count = cluster_cache.cleanup_expired()
        return jsonify({
            'success': True,
            'message': f'Cleaned up {removed_count} expired entries',
            'removed_count': removed_count
        })
    except Exception as e:
        logger.error(f"Failed to cleanup cache: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@api_bp.route('/cache/cluster/<cluster_name>/invalidate', methods=['POST'])
def invalidate_cluster_cache(cluster_name: str):
    """Invalidate cache for a specific cluster."""
    try:
        cluster_cache.invalidate_cluster_cache(cluster_name)
        logger.info(f"Cache invalidated for cluster {cluster_name}")
        return jsonify({
            'success': True,
            'message': f'Cache invalidated for cluster {cluster_name}'
        })
    except Exception as e:
        logger.error(f"Failed to invalidate cache for cluster {cluster_name}: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
