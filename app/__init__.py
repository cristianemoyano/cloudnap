"""CloudNap - Huawei Cloud Cluster Management Application."""

import logging
from flask import Flask

from app.config import config
from app.routes.api import api_bp
from app.routes.main import main_bp
from app.services.scheduler_service import SchedulerService
from app.services.huawei_cloud_service import HuaweiCloudService
from app.services.logging_service import LoggingService


def create_app() -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)
    
    # Configure Flask
    app.config['SECRET_KEY'] = 'cloudnap-secret-key-change-in-production'
    app.config['DEBUG'] = config.app.debug
    
    # Setup logging
    logging_service = LoggingService(config.logging)
    
    # Initialize services
    huawei_service = HuaweiCloudService(config.huawei_cloud)
    scheduler_service = SchedulerService(config, huawei_service)
    
    # Start scheduler
    scheduler_service.start()
    
    # Register blueprints
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp)
    
    # Store services in app context for access in routes
    app.huawei_service = huawei_service
    app.scheduler_service = scheduler_service
    app.logging_service = logging_service
    
    # Log application startup
    logging.info("CloudNap application started successfully")
    
    return app


# Create the application instance
app = create_app()


@app.teardown_appcontext
def cleanup_app_context(error):
    """Cleanup app context when torn down."""
    # Don't shutdown scheduler here - it should run for the entire app lifetime
    pass


if __name__ == '__main__':
    app.run(
        host=config.app.host,
        port=config.app.port,
        debug=config.app.debug
    )