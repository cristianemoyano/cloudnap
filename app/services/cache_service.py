"""Cache service for storing cluster statuses in memory."""

import logging
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from threading import Lock

logger = logging.getLogger(__name__)


class ClusterStatusCache:
    """In-memory cache for cluster statuses with TTL support."""
    
    def __init__(self, default_ttl: int = 60):
        """
        Initialize the cache.
        
        Args:
            default_ttl: Default time-to-live in seconds (default: 60 seconds)
        """
        self.default_ttl = default_ttl
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()
    
    def _is_expired(self, cache_entry: Dict[str, Any]) -> bool:
        """Check if a cache entry has expired."""
        if 'expires_at' not in cache_entry:
            return True
        
        return datetime.utcnow() > cache_entry['expires_at']
    
    def _create_cache_entry(self, data: Any, ttl: Optional[int] = None) -> Dict[str, Any]:
        """Create a cache entry with expiration time."""
        ttl = ttl or self.default_ttl
        expires_at = datetime.utcnow() + timedelta(seconds=ttl)
        
        return {
            'data': data,
            'created_at': datetime.utcnow(),
            'expires_at': expires_at,
            'ttl': ttl
        }
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get a value from the cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached data if found and not expired, None otherwise
        """
        with self._lock:
            if key not in self._cache:
                return None
            
            cache_entry = self._cache[key]
            
            if self._is_expired(cache_entry):
                # Remove expired entry
                del self._cache[key]
                logger.debug(f"Cache entry '{key}' expired and removed")
                return None
            
            logger.debug(f"Cache hit for key '{key}'")
            return cache_entry['data']
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Set a value in the cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (optional, uses default if not provided)
        """
        with self._lock:
            cache_entry = self._create_cache_entry(value, ttl)
            self._cache[key] = cache_entry
            logger.debug(f"Cached data for key '{key}' with TTL {cache_entry['ttl']}s")
    
    def delete(self, key: str) -> bool:
        """
        Delete a value from the cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if key was deleted, False if key didn't exist
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                logger.debug(f"Deleted cache entry '{key}'")
                return True
            return False
    
    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()
            logger.info("Cache cleared")
    
    def cleanup_expired(self) -> int:
        """
        Remove all expired entries from the cache.
        
        Returns:
            Number of expired entries removed
        """
        with self._lock:
            expired_keys = []
            for key, cache_entry in self._cache.items():
                if self._is_expired(cache_entry):
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self._cache[key]
            
            if expired_keys:
                logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
            
            return len(expired_keys)
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        with self._lock:
            total_entries = len(self._cache)
            expired_entries = sum(1 for entry in self._cache.values() if self._is_expired(entry))
            active_entries = total_entries - expired_entries
            
            return {
                'total_entries': total_entries,
                'active_entries': active_entries,
                'expired_entries': expired_entries,
                'default_ttl': self.default_ttl,
                'keys': list(self._cache.keys())
            }
    
    def invalidate_cluster_cache(self, cluster_name: str) -> None:
        """
        Invalidate cache for a specific cluster.
        
        Args:
            cluster_name: Name of the cluster to invalidate
        """
        cluster_key = f"cluster_status:{cluster_name}"
        all_clusters_key = "all_clusters_status"
        
        self.delete(cluster_key)
        self.delete(all_clusters_key)  # Also invalidate the all clusters cache
        
        logger.info(f"Invalidated cache for cluster '{cluster_name}'")


# Global cache instance
cluster_cache = ClusterStatusCache(default_ttl=60)  # 1 minute TTL
