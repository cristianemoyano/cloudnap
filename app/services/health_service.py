"""Health check service for CloudNap application."""

import logging
import time
import os
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

from app.config import config
from app.services.huawei_cloud_service import HuaweiCloudService
from app.services.secrets_service import DockerSecretsService

logger = logging.getLogger(__name__)


class HealthService:
    """Service for performing health checks on various components."""
    
    def __init__(self):
        """Initialize health service."""
        # Use the same secrets path as the main application (secrets/ directory)
        self.secrets_service = DockerSecretsService(secrets_path="secrets")
    
    def check_huawei_cloud_connection(self) -> Dict[str, Any]:
        """Check Huawei Cloud API connection and credentials."""
        result = {
            "service": "Huawei Cloud API",
            "status": "unknown",
            "details": {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "response_time_ms": 0
        }
        
        try:
            start_time = time.time()
            
            # Check if secrets are available
            access_key = self.secrets_service.get_secret("huawei_access_key")
            secret_key = self.secrets_service.get_secret("huawei_secret_key")
            project_id = self.secrets_service.get_secret("huawei_project_id")
            
            if not all([access_key, secret_key, project_id]):
                result["status"] = "error"
                result["details"] = {
                    "error": "Missing credentials",
                    "access_key_available": bool(access_key),
                    "secret_key_available": bool(secret_key),
                    "project_id_available": bool(project_id)
                }
                return result
            
            # Create Huawei Cloud service instance
            huawei_config = config.huawei_cloud
            huawei_service = HuaweiCloudService(huawei_config)
            
            # Test API connection by making a simple request
            # We'll try to list instances (this is a lightweight operation)
            try:
                # Make a test request to the ECS API
                response = huawei_service._make_request(
                    "GET",
                    "cloudservers",
                    {"project_id": project_id, "limit": 1}
                )
                
                end_time = time.time()
                response_time = int((end_time - start_time) * 1000)
                
                result["status"] = "healthy"
                result["response_time_ms"] = response_time
                result["details"] = {
                    "region": huawei_config.region,
                    "project_id": project_id[:8] + "..." if project_id else "N/A",
                    "api_response": "success",
                    "total_servers": response.get("count", 0) if response else 0
                }
                
            except Exception as api_error:
                end_time = time.time()
                response_time = int((end_time - start_time) * 1000)
                
                result["status"] = "error"
                result["response_time_ms"] = response_time
                result["details"] = {
                    "region": huawei_config.region,
                    "project_id": project_id[:8] + "..." if project_id else "N/A",
                    "error": str(api_error),
                    "error_type": type(api_error).__name__
                }
                
        except Exception as e:
            result["status"] = "error"
            result["details"] = {
                "error": str(e),
                "error_type": type(e).__name__
            }
        
        return result
    
    def check_secrets_service(self) -> Dict[str, Any]:
        """Check if secrets service is working properly."""
        result = {
            "service": "Secrets Service",
            "status": "unknown",
            "details": {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            # Check if secrets directory exists
            secrets_dir = "secrets"
            if not os.path.exists(secrets_dir):
                result["status"] = "error"
                result["details"] = {
                    "error": "Secrets directory not found",
                    "secrets_dir": secrets_dir
                }
                return result
            
            # Check if required secret files exist
            required_secrets = ["huawei_access_key", "huawei_secret_key", "huawei_project_id"]
            available_secrets = {}
            missing_secrets = []
            
            for secret_name in required_secrets:
                try:
                    secret_value = self.secrets_service.get_secret(secret_name)
                    available_secrets[secret_name] = bool(secret_value)
                    if not secret_value:
                        missing_secrets.append(secret_name)
                except Exception as e:
                    available_secrets[secret_name] = False
                    missing_secrets.append(secret_name)
            
            if missing_secrets:
                result["status"] = "error"
                result["details"] = {
                    "error": f"Missing secrets: {', '.join(missing_secrets)}",
                    "available_secrets": available_secrets,
                    "secrets_dir": secrets_dir
                }
            else:
                result["status"] = "healthy"
                result["details"] = {
                    "secrets_dir": secrets_dir,
                    "available_secrets": available_secrets,
                    "total_secrets": len(required_secrets)
                }
                
        except Exception as e:
            result["status"] = "error"
            result["details"] = {
                "error": str(e),
                "error_type": type(e).__name__
            }
        
        return result
    
    def check_configuration(self) -> Dict[str, Any]:
        """Check application configuration."""
        result = {
            "service": "Configuration",
            "status": "unknown",
            "details": {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            # Check basic configuration
            config_checks = {
                "app_config": bool(config.app),
                "huawei_config": bool(config.huawei_cloud),
                "scheduler_config": bool(config.scheduler),
                "clusters_configured": len(config.clusters) > 0,
                "logging_config": bool(config.logging)
            }
            
            # Check cluster configuration
            cluster_details = []
            for cluster in config.clusters:
                cluster_info = {
                    "name": cluster.name,
                    "enabled": cluster.enabled,
                    "instance_count": len(cluster.instance_ids),
                    "has_schedule": bool(cluster.schedule),
                    "region": cluster.region
                }
                cluster_details.append(cluster_info)
            
            # Check if all required configs are present
            all_configs_present = all(config_checks.values())
            
            if all_configs_present:
                result["status"] = "healthy"
            else:
                result["status"] = "warning"
            
            result["details"] = {
                "config_checks": config_checks,
                "clusters": cluster_details,
                "total_clusters": len(config.clusters),
                "enabled_clusters": len([c for c in config.clusters if c.enabled])
            }
            
        except Exception as e:
            result["status"] = "error"
            result["details"] = {
                "error": str(e),
                "error_type": type(e).__name__
            }
        
        return result
    
    def check_scheduler_service(self) -> Dict[str, Any]:
        """Check scheduler service status."""
        result = {
            "service": "Scheduler Service",
            "status": "unknown",
            "details": {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            from flask import current_app
            
            if not hasattr(current_app, 'scheduler_service'):
                result["status"] = "error"
                result["details"] = {
                    "error": "Scheduler service not initialized"
                }
                return result
            
            scheduler_service = current_app.scheduler_service
            scheduler = scheduler_service.scheduler
            
            if not scheduler:
                result["status"] = "error"
                result["details"] = {
                    "error": "Scheduler not initialized"
                }
                return result
            
            # Get scheduler status
            is_running = scheduler.running
            job_count = len(scheduler.get_jobs())
            
            # Get job details
            jobs = scheduler_service.get_scheduled_jobs()
            
            result["status"] = "healthy" if is_running else "warning"
            result["details"] = {
                "running": is_running,
                "job_count": job_count,
                "jobs": jobs,
                "timezone": config.scheduler.timezone,
                "max_workers": config.scheduler.max_workers
            }
            
        except Exception as e:
            result["status"] = "error"
            result["details"] = {
                "error": str(e),
                "error_type": type(e).__name__
            }
        
        return result
    
    def check_logging_service(self) -> Dict[str, Any]:
        """Check logging service status."""
        result = {
            "service": "Logging Service",
            "status": "unknown",
            "details": {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            # Check if log file exists and is writable
            log_file = config.logging.file
            log_dir = os.path.dirname(log_file)
            
            log_checks = {
                "log_file_exists": os.path.exists(log_file),
                "log_dir_exists": os.path.exists(log_dir),
                "log_file_writable": False,
                "log_file_size": 0
            }
            
            if os.path.exists(log_file):
                log_checks["log_file_size"] = os.path.getsize(log_file)
                # Check if file is writable
                try:
                    with open(log_file, 'a') as f:
                        f.write("")
                    log_checks["log_file_writable"] = True
                except:
                    log_checks["log_file_writable"] = False
            
            # Check logging configuration
            logging_config = {
                "level": config.logging.level,
                "format": config.logging.format,
                "max_size": config.logging.max_size,
                "backup_count": config.logging.backup_count
            }
            
            all_checks_pass = all([
                log_checks["log_dir_exists"],
                log_checks["log_file_writable"]
            ])
            
            result["status"] = "healthy" if all_checks_pass else "warning"
            result["details"] = {
                "log_checks": log_checks,
                "logging_config": logging_config,
                "log_file": log_file
            }
            
        except Exception as e:
            result["status"] = "error"
            result["details"] = {
                "error": str(e),
                "error_type": type(e).__name__
            }
        
        return result
    
    def run_all_health_checks(self) -> Dict[str, Any]:
        """Run all health checks and return comprehensive results."""
        start_time = time.time()
        
        # Run all health checks
        checks = [
            self.check_secrets_service(),
            self.check_configuration(),
            self.check_huawei_cloud_connection(),
            self.check_scheduler_service(),
            self.check_logging_service()
        ]
        
        end_time = time.time()
        total_time = int((end_time - start_time) * 1000)
        
        # Calculate overall status
        statuses = [check["status"] for check in checks]
        if "error" in statuses:
            overall_status = "error"
        elif "warning" in statuses:
            overall_status = "warning"
        else:
            overall_status = "healthy"
        
        # Count services by status
        status_counts = {
            "healthy": len([s for s in statuses if s == "healthy"]),
            "warning": len([s for s in statuses if s == "warning"]),
            "error": len([s for s in statuses if s == "error"]),
            "unknown": len([s for s in statuses if s == "unknown"])
        }
        
        return {
            "overall_status": overall_status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_check_time_ms": total_time,
            "status_counts": status_counts,
            "checks": checks,
            "summary": {
                "total_services": len(checks),
                "healthy_services": status_counts["healthy"],
                "warning_services": status_counts["warning"],
                "error_services": status_counts["error"]
            }
        }
