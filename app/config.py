"""Configuration management for CloudNap application."""

import os
import yaml
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from dotenv import load_dotenv
from .services.secrets_service import secrets_service

# Load environment variables
load_dotenv()


@dataclass
class HuaweiCloudConfig:
    """Huawei Cloud configuration."""
    region: str
    access_key: str
    secret_key: str
    project_id: str


@dataclass
class ClusterConfig:
    """Cluster configuration."""
    name: str
    instance_ids: List[str]
    region: str
    description: str
    tags: List[str]
    schedule: Dict[str, str]
    enabled: bool


@dataclass
class AppConfig:
    """Application configuration."""
    debug: bool
    host: str
    port: int
    log_level: str


@dataclass
class LoggingConfig:
    """Logging configuration."""
    level: str
    format: str
    file: str
    max_size: str
    backup_count: int


@dataclass
class SchedulerConfig:
    """Scheduler configuration."""
    timezone: str
    max_workers: int
    coalesce: bool
    misfire_grace_time: int


class Config:
    """Main configuration class."""
    
    def __init__(self, config_path: str = "config.yaml"):
        """Initialize configuration from YAML file."""
        self.config_path = config_path
        self._config_data = self._load_config()
        self._setup_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from YAML file."""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as file:
                config_data = yaml.safe_load(file)
                return config_data or {}
        except FileNotFoundError:
            raise FileNotFoundError(f"Configuration file {self.config_path} not found")
        except yaml.YAMLError as e:
            raise ValueError(f"Invalid YAML configuration: {e}")
    
    def _setup_config(self) -> None:
        """Setup configuration objects."""
        # Huawei Cloud configuration
        huawei_config = self._config_data.get('huawei_cloud', {})
        self.huawei_cloud = HuaweiCloudConfig(
            region=huawei_config.get('region', 'ap-southeast-1'),
            access_key=self._resolve_secret_or_env(huawei_config.get('access_key', '')),
            secret_key=self._resolve_secret_or_env(huawei_config.get('secret_key', '')),
            project_id=self._resolve_secret_or_env(huawei_config.get('project_id', ''))
        )
        
        # Application configuration
        app_config = self._config_data.get('app', {})
        self.app = AppConfig(
            debug=app_config.get('debug', False),
            host=app_config.get('host', '0.0.0.0'),
            port=app_config.get('port', 5000),
            log_level=app_config.get('log_level', 'INFO')
        )
        
        # Logging configuration
        logging_config = self._config_data.get('logging', {})
        self.logging = LoggingConfig(
            level=logging_config.get('level', 'INFO'),
            format=logging_config.get('format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s'),
            file=logging_config.get('file', 'logs/cloudnap.log'),
            max_size=logging_config.get('max_size', '10MB'),
            backup_count=logging_config.get('backup_count', 5)
        )
        
        # Scheduler configuration
        scheduler_config = self._config_data.get('scheduler', {})
        self.scheduler = SchedulerConfig(
            timezone=scheduler_config.get('timezone', 'UTC'),
            max_workers=scheduler_config.get('max_workers', 4),
            coalesce=scheduler_config.get('coalesce', True),
            misfire_grace_time=scheduler_config.get('misfire_grace_time', 60)
        )
        
        # Clusters configuration
        self.clusters = []
        clusters_data = self._config_data.get('clusters', [])
        for cluster_data in clusters_data:
            cluster = ClusterConfig(
                name=cluster_data.get('name', ''),
                instance_ids=cluster_data.get('instance_ids', []),
                region=cluster_data.get('region', self.huawei_cloud.region),
                description=cluster_data.get('description', ''),
                tags=cluster_data.get('tags', []),
                schedule=cluster_data.get('schedule', {}),
                enabled=cluster_data.get('enabled', True)
            )
            self.clusters.append(cluster)
    
    def _resolve_secret_or_env(self, value: str) -> str:
        """Resolve Docker secret or environment variable references in configuration.
        
        Priority:
        1. Docker secret (if secrets are available)
        2. Environment variable (if value starts with ${})
        3. Direct value
        """
        # First try to get from Docker secrets if available
        if secrets_service.is_secrets_available():
            secret_value = secrets_service.get_secret(value)
            if secret_value is not None:
                return secret_value
        
        # Fallback to environment variable resolution
        if value.startswith('${') and value.endswith('}'):
            env_var = value[2:-1]
            return os.getenv(env_var, '')
        
        return value
    
    def _resolve_env_var(self, value: str) -> str:
        """Resolve environment variable references in configuration."""
        if value.startswith('${') and value.endswith('}'):
            env_var = value[2:-1]
            return os.getenv(env_var, '')
        return value
    
    def get_cluster_by_name(self, name: str) -> Optional[ClusterConfig]:
        """Get cluster configuration by name."""
        for cluster in self.clusters:
            if cluster.name == name:
                return cluster
        return None
    
    def get_enabled_clusters(self) -> List[ClusterConfig]:
        """Get list of enabled clusters."""
        return [cluster for cluster in self.clusters if cluster.enabled]
    
    def reload(self) -> None:
        """Reload configuration from file."""
        self._config_data = self._load_config()
        self._setup_config()


# Global configuration instance
config = Config()
