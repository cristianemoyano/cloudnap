"""Main web routes for CloudNap application."""

import logging
import os
from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify

from app.config import config
from app.services.huawei_cloud_service import HuaweiCloudService
from app.services.scheduler_service import SchedulerService
from app.services.logging_service import LoggingService
from app.services.health_service import HealthService

logger = logging.getLogger(__name__)

# Create blueprint
main_bp = Blueprint('main', __name__)

# Initialize services
logging_service = LoggingService(config.logging)
health_service = HealthService()


@main_bp.route('/')
def index():
    """Main dashboard page."""
    try:
        # Get basic cluster info without API calls (fast loading)
        clusters_basic = []
        for cluster in config.clusters:
            cluster_basic = {
                "name": cluster.name,
                "description": cluster.description,
                "region": cluster.region,
                "tags": cluster.tags,
                "enabled": cluster.enabled,
                "schedule": cluster.schedule,
                "instances": [{"id": instance_id, "status": "loading"} for instance_id in cluster.instance_ids],
                "overall_status": "loading"
            }
            clusters_basic.append(cluster_basic)
        
        # Get scheduled jobs from the app's scheduler service
        from flask import current_app
        scheduled_jobs = current_app.scheduler_service.get_scheduled_jobs()
        
        # Get recent logs (last 10)
        recent_logs = logging_service.get_recent_logs(10)
        
        # Check if we're in production mode
        is_production = os.getenv('FLASK_ENV') == 'production'
        
        return render_template('index.html', 
                             clusters=clusters_basic,
                             scheduled_jobs=scheduled_jobs,
                             recent_logs=recent_logs,
                             timezone=config.scheduler.timezone,
                             is_production=is_production)
    except Exception as e:
        logger.error(f"Failed to load dashboard: {e}")
        flash(f'Error loading dashboard: {e}', 'error')
        return render_template('index.html', 
                             clusters=[], 
                             scheduled_jobs=[], 
                             recent_logs=[],
                             timezone=config.scheduler.timezone,
                             is_production=os.getenv('FLASK_ENV') == 'production')


@main_bp.route('/cluster/<cluster_name>/start', methods=['POST'])
def start_cluster_web(cluster_name: str):
    """Start a cluster from web interface."""
    try:
        cluster = config.get_cluster_by_name(cluster_name)
        if not cluster:
            flash(f'Cluster {cluster_name} not found', 'error')
            return redirect(url_for('main.index'))
        
        from flask import current_app
        result = current_app.huawei_service.start_cluster(cluster)
        
        # Log the action
        logging_service.log_cluster_action(
            cluster_name, 
            'start', 
            result['success'],
            f"Instances: {len(result['instances'])}"
        )
        
        if result['success']:
            flash(f'Cluster {cluster_name} started successfully', 'success')
        else:
            flash(f'Failed to start cluster {cluster_name}: {", ".join(result["errors"])}', 'error')
        
    except Exception as e:
        logger.error(f"Failed to start cluster {cluster_name}: {e}")
        logging_service.log_cluster_action(cluster_name, 'start', False, str(e))
        flash(f'Error starting cluster {cluster_name}: {e}', 'error')
    
    return redirect(url_for('main.index'))


@main_bp.route('/cluster/<cluster_name>/stop', methods=['POST'])
def stop_cluster_web(cluster_name: str):
    """Stop a cluster from web interface."""
    try:
        cluster = config.get_cluster_by_name(cluster_name)
        if not cluster:
            flash(f'Cluster {cluster_name} not found', 'error')
            return redirect(url_for('main.index'))
        
        from flask import current_app
        result = current_app.huawei_service.stop_cluster(cluster)
        
        # Log the action
        logging_service.log_cluster_action(
            cluster_name, 
            'stop', 
            result['success'],
            f"Instances: {len(result['instances'])}"
        )
        
        if result['success']:
            flash(f'Cluster {cluster_name} stopped successfully', 'success')
        else:
            flash(f'Failed to stop cluster {cluster_name}: {", ".join(result["errors"])}', 'error')
        
    except Exception as e:
        logger.error(f"Failed to stop cluster {cluster_name}: {e}")
        logging_service.log_cluster_action(cluster_name, 'stop', False, str(e))
        flash(f'Error stopping cluster {cluster_name}: {e}', 'error')
    
    return redirect(url_for('main.index'))


@main_bp.route('/logs')
def logs():
    """Logs page - Only available in development."""
    # In production, return 404
    if os.getenv('FLASK_ENV') == 'production':
        from flask import abort
        abort(404)
    
    try:
        lines = request.args.get('lines', 100, type=int)
        logs = logging_service.get_recent_logs(lines)
        return render_template('logs.html', logs=logs, lines=lines)
    except Exception as e:
        logger.error(f"Failed to load logs: {e}")
        flash(f'Error loading logs: {e}', 'error')
        return render_template('logs.html', logs=[], lines=100)


@main_bp.route('/api/cluster/<cluster_name>/status')
def cluster_status_ajax(cluster_name: str):
    """Get cluster status via AJAX."""
    try:
        cluster = config.get_cluster_by_name(cluster_name)
        if not cluster:
            return jsonify({'error': f'Cluster {cluster_name} not found'}), 404
        
        from flask import current_app
        cluster_status = current_app.huawei_service.get_cluster_status(cluster)
        return jsonify(cluster_status)
    except Exception as e:
        logger.error(f"Failed to get cluster status for {cluster_name}: {e}")
        return jsonify({'error': str(e)}), 500


@main_bp.route('/health')
def health():
    """Health check page."""
    try:
        # Run all health checks
        health_results = health_service.run_all_health_checks()
        
        # Check if we're in production mode
        is_production = os.getenv('FLASK_ENV') == 'production'
        
        return render_template('health.html', 
                             health_data=health_results,
                             timezone=config.scheduler.timezone,
                             is_production=is_production)
    except Exception as e:
        logger.error(f"Failed to load health page: {e}")
        flash(f'Error loading health page: {e}', 'error')
        return render_template('health.html', 
                             health_data=None,
                             timezone=config.scheduler.timezone,
                             is_production=os.getenv('FLASK_ENV') == 'production')
