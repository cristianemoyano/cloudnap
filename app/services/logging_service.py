"""Logging service for CloudNap application."""

import logging
import logging.handlers
import os
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path

from app.config import LoggingConfig


class LoggingService:
    """Service for managing application logs."""
    
    def __init__(self, config: LoggingConfig):
        """Initialize logging service."""
        self.config = config
        self._setup_logging()
    
    def _setup_logging(self) -> None:
        """Setup logging configuration."""
        # Create logs directory if it doesn't exist
        log_file_path = Path(self.config.file)
        log_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Configure root logger
        logging.basicConfig(
            level=getattr(logging, self.config.level.upper()),
            format=self.config.format,
            handlers=[
                logging.StreamHandler(),  # Console output
                logging.handlers.RotatingFileHandler(
                    filename=self.config.file,
                    maxBytes=self._parse_size(self.config.max_size),
                    backupCount=self.config.backup_count
                )
            ]
        )
        
        # Set specific loggers
        logging.getLogger('apscheduler').setLevel(logging.WARNING)
        logging.getLogger('urllib3').setLevel(logging.WARNING)
        logging.getLogger('requests').setLevel(logging.WARNING)
    
    def _parse_size(self, size_str: str) -> int:
        """Parse size string (e.g., '10MB') to bytes."""
        size_str = size_str.upper()
        if size_str.endswith('KB'):
            return int(size_str[:-2]) * 1024
        elif size_str.endswith('MB'):
            return int(size_str[:-2]) * 1024 * 1024
        elif size_str.endswith('GB'):
            return int(size_str[:-2]) * 1024 * 1024 * 1024
        else:
            return int(size_str)
    
    def get_recent_logs(self, lines: int = 100) -> List[Dict[str, Any]]:
        """Get recent log entries from the log file."""
        logs = []
        try:
            if os.path.exists(self.config.file):
                with open(self.config.file, 'r', encoding='utf-8') as file:
                    all_lines = file.readlines()
                    recent_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
                    
                    for line in recent_lines:
                        if line.strip():
                            logs.append({
                                'timestamp': datetime.now().isoformat(),
                                'message': line.strip(),
                                'raw': line.strip()
                            })
        except Exception as e:
            logging.error(f"Failed to read log file: {e}")
        
        return logs
    
    def log_cluster_action(self, cluster_name: str, action: str, success: bool, 
                          details: str = "") -> None:
        """Log a cluster action."""
        status = "SUCCESS" if success else "FAILED"
        message = f"CLUSTER_ACTION: {cluster_name} - {action.upper()} - {status}"
        if details:
            message += f" - {details}"
        
        if success:
            logging.info(message)
        else:
            logging.error(message)
    
    def log_scheduler_event(self, event_type: str, job_id: str, details: str = "") -> None:
        """Log a scheduler event."""
        message = f"SCHEDULER_EVENT: {event_type} - Job: {job_id}"
        if details:
            message += f" - {details}"
        logging.info(message)
