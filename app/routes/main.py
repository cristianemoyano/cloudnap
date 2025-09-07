"""Main web routes for CloudNap application."""

import logging
from flask import Blueprint, render_template, request, flash, redirect, url_for, jsonify

from app.config import config
from app.services.huawei_cloud_service import HuaweiCloudService
from app.services.scheduler_service import SchedulerService
from app.services.logging_service import LoggingService

logger = logging.getLogger(__name__)

# Create blueprint
main_bp = Blueprint('main', __name__)

# Initialize services
huawei_service = HuaweiCloudService(config.huawei_cloud)
scheduler_service = SchedulerService(config, huawei_service)
logging_service = LoggingService(config.logging)


@main_bp.route('/')
def index():
    """Main dashboard page."""
    try:
        # Get clusters status
        clusters_status = huawei_service.get_all_clusters_status(config.clusters)
        
        # Get scheduled jobs
        scheduled_jobs = scheduler_service.get_scheduled_jobs()
        
        # Get recent logs (last 10)
        recent_logs = logging_service.get_recent_logs(10)
        
        return render_template('index.html', 
                             clusters=clusters_status,
                             scheduled_jobs=scheduled_jobs,
                             recent_logs=recent_logs,
                             timezone=config.scheduler.timezone)
    except Exception as e:
        logger.error(f"Failed to load dashboard: {e}")
        flash(f'Error loading dashboard: {e}', 'error')
        return render_template('index.html', 
                             clusters=[], 
                             scheduled_jobs=[], 
                             recent_logs=[],
                             timezone=config.scheduler.timezone)


@main_bp.route('/cluster/<cluster_name>/start', methods=['POST'])
def start_cluster_web(cluster_name: str):
    """Start a cluster from web interface."""
    try:
        cluster = config.get_cluster_by_name(cluster_name)
        if not cluster:
            flash(f'Cluster {cluster_name} not found', 'error')
            return redirect(url_for('main.index'))
        
        result = huawei_service.start_cluster(cluster)
        
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
        
        result = huawei_service.stop_cluster(cluster)
        
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
    """Logs page."""
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
        
        cluster_status = huawei_service.get_cluster_status(cluster)
        return jsonify(cluster_status)
    except Exception as e:
        logger.error(f"Failed to get cluster status for {cluster_name}: {e}")
        return jsonify({'error': str(e)}), 500
