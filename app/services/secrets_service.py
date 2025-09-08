"""Docker Secrets Service for CloudNap application."""

import os
import logging
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class DockerSecretsService:
    """Service to read Docker secrets from mounted secret files."""
    
    def __init__(self, secrets_path: str = "/run/secrets"):
        """Initialize the Docker secrets service.
        
        Args:
            secrets_path: Path where Docker secrets are mounted (default: /run/secrets)
        """
        self.secrets_path = Path(secrets_path)
        self._secrets_cache: Dict[str, str] = {}
    
    def get_secret(self, secret_name: str, default: Optional[str] = None) -> Optional[str]:
        """Get a Docker secret value by name.
        
        Args:
            secret_name: Name of the secret file
            default: Default value if secret is not found
            
        Returns:
            Secret value as string, or default if not found
        """
        # Check cache first
        if secret_name in self._secrets_cache:
            return self._secrets_cache[secret_name]
        
        secret_file = self.secrets_path / secret_name
        
        try:
            if secret_file.exists() and secret_file.is_file():
                # Read secret value and strip whitespace
                secret_value = secret_file.read_text(encoding='utf-8').strip()
                # Cache the secret
                self._secrets_cache[secret_name] = secret_value
                logger.debug(f"Successfully read secret: {secret_name}")
                return secret_value
            else:
                logger.warning(f"Secret file not found: {secret_file}")
                return default
                
        except Exception as e:
            logger.error(f"Error reading secret {secret_name}: {e}")
            return default
    
    def get_secret_or_raise(self, secret_name: str) -> str:
        """Get a Docker secret value or raise an exception if not found.
        
        Args:
            secret_name: Name of the secret file
            
        Returns:
            Secret value as string
            
        Raises:
            FileNotFoundError: If secret file is not found
            ValueError: If secret file cannot be read
        """
        secret_value = self.get_secret(secret_name)
        if secret_value is None:
            raise FileNotFoundError(f"Required secret '{secret_name}' not found at {self.secrets_path}")
        return secret_value
    
    def list_available_secrets(self) -> list[str]:
        """List all available secret files.
        
        Returns:
            List of secret names
        """
        try:
            if not self.secrets_path.exists():
                return []
            
            secrets = []
            for secret_file in self.secrets_path.iterdir():
                if secret_file.is_file():
                    secrets.append(secret_file.name)
            
            return sorted(secrets)
            
        except Exception as e:
            logger.error(f"Error listing secrets: {e}")
            return []
    
    def clear_cache(self) -> None:
        """Clear the secrets cache."""
        self._secrets_cache.clear()
        logger.debug("Secrets cache cleared")
    
    def is_secrets_available(self) -> bool:
        """Check if Docker secrets are available (secrets path exists).
        
        Returns:
            True if secrets path exists, False otherwise
        """
        return self.secrets_path.exists() and self.secrets_path.is_dir()


# Global instance
secrets_service = DockerSecretsService()
