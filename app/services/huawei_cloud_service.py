"""Huawei Cloud service for managing ECS instances."""

import logging
import requests
import hashlib
import hmac
import base64
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode

from app.config import HuaweiCloudConfig, ClusterConfig
from app.services.cache_service import cluster_cache

logger = logging.getLogger(__name__)


class HuaweiCloudService:
    """Service for interacting with Huawei Cloud ECS API."""
    
    def __init__(self, config: HuaweiCloudConfig):
        """Initialize Huawei Cloud service."""
        self.config = config
        self.base_url = f"https://ecs.{config.region}.myhuaweicloud.com"
        self.api_version = "v2.1"
    
    def _generate_signature(self, method: str, uri: str, query_params: Dict[str, str], 
                          headers: Dict[str, str], body: str = "") -> str:
        """Generate signature for Huawei Cloud API authentication."""
        # Create canonical request
        canonical_headers = []
        signed_headers = []
        
        for key in sorted(headers.keys()):
            canonical_headers.append(f"{key.lower()}:{headers[key]}")
            signed_headers.append(key.lower())
        
        canonical_headers_str = "\n".join(canonical_headers)
        signed_headers_str = ";".join(signed_headers)
        
        # Create query string
        query_string = urlencode(sorted(query_params.items()))
        
        # Create canonical request
        canonical_request = f"{method}\n{uri}\n{query_string}\n{canonical_headers_str}\n\n{signed_headers_str}\n{hashlib.sha256(body.encode()).hexdigest()}"
        
        # Create string to sign
        algorithm = "SDK-HMAC-SHA256"
        credential_scope = f"{datetime.utcnow().strftime('%Y%m%d')}/{self.config.region}/ecs/sdk_request"
        string_to_sign = f"{algorithm}\n{datetime.utcnow().isoformat()}Z\n{credential_scope}\n{hashlib.sha256(canonical_request.encode()).hexdigest()}"
        
        # Calculate signature
        signing_key = hmac.new(
            self.config.secret_key.encode(),
            credential_scope.encode(),
            hashlib.sha256
        ).digest()
        
        signature = hmac.new(
            signing_key,
            string_to_sign.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"{algorithm} Credential={self.config.access_key}/{credential_scope}, SignedHeaders={signed_headers_str}, Signature={signature}"
    
    def _make_request(self, method: str, endpoint: str, params: Dict[str, Any] = None, 
                     data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Make authenticated request to Huawei Cloud API."""
        url = f"{self.base_url}/{self.api_version}/{self.config.project_id}/{endpoint}"
        query_params = params or {}
        body = json.dumps(data) if data else ""
        
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "X-Sdk-Date": datetime.utcnow().isoformat() + "Z",
            "X-Project-Id": self.config.project_id,
            "Host": f"ecs.{self.config.region}.myhuaweicloud.com"
        }
        
        # Generate signature
        signature = self._generate_signature(method, f"/{self.api_version}/{self.config.project_id}/{endpoint}", 
                                           query_params, headers, body)
        headers["Authorization"] = signature
        
        try:
            response = requests.request(
                method=method,
                url=url,
                params=query_params,
                data=body,
                headers=headers,
                timeout=5  # Reduced timeout for faster failure in development
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            raise
    
    def get_instance_status(self, instance_id: str) -> Dict[str, Any]:
        """Get status of a specific ECS instance."""
        try:
            response = self._make_request(
                "GET",
                f"servers/{instance_id}"
            )
            return response.get("server", {})
        except Exception as e:
            logger.error(f"Failed to get status for instance {instance_id}: {e}")
            return {"id": instance_id, "status": "unknown", "error": str(e)}
    
    def get_cluster_status(self, cluster: ClusterConfig, use_cache: bool = True) -> Dict[str, Any]:
        """Get status of all instances in a cluster."""
        cache_key = f"cluster_status:{cluster.name}"
        
        # Try to get from cache first
        if use_cache:
            cached_status = cluster_cache.get(cache_key)
            if cached_status is not None:
                logger.debug(f"Using cached status for cluster {cluster.name}")
                return cached_status
        
        logger.debug(f"Fetching fresh status for cluster {cluster.name}")
        
        cluster_status = {
            "name": cluster.name,
            "description": cluster.description,
            "region": cluster.region,
            "tags": cluster.tags,
            "enabled": cluster.enabled,
            "schedule": cluster.schedule,
            "instances": [],
            "overall_status": "unknown"
        }
        
        instance_statuses = []
        for instance_id in cluster.instance_ids:
            instance_status = self.get_instance_status(instance_id)
            cluster_status["instances"].append(instance_status)
            instance_statuses.append(instance_status.get("status", "unknown"))
        
        # Determine overall cluster status
        if all(status == "ACTIVE" for status in instance_statuses):
            cluster_status["overall_status"] = "running"
        elif all(status == "SHUTOFF" for status in instance_statuses):
            cluster_status["overall_status"] = "stopped"
        elif any(status == "ACTIVE" for status in instance_statuses):
            cluster_status["overall_status"] = "partial"
        else:
            cluster_status["overall_status"] = "unknown"
        
        # Cache the result
        if use_cache:
            cluster_cache.set(cache_key, cluster_status)
        
        return cluster_status
    
    def start_instance(self, instance_id: str) -> bool:
        """Start an ECS instance."""
        try:
            self._make_request(
                "POST",
                f"servers/{instance_id}/action",
                data={"os-start": ""}
            )
            logger.info(f"Successfully started instance {instance_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to start instance {instance_id}: {e}")
            return False
    
    def stop_instance(self, instance_id: str) -> bool:
        """Stop an ECS instance."""
        try:
            self._make_request(
                "POST",
                f"servers/{instance_id}/action",
                data={"os-stop": ""}
            )
            logger.info(f"Successfully stopped instance {instance_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to stop instance {instance_id}: {e}")
            return False
    
    def start_cluster(self, cluster: ClusterConfig) -> Dict[str, Any]:
        """Start all instances in a cluster."""
        result = {
            "cluster_name": cluster.name,
            "action": "start",
            "success": True,
            "instances": [],
            "errors": []
        }
        
        for instance_id in cluster.instance_ids:
            instance_result = {
                "instance_id": instance_id,
                "success": False
            }
            
            if self.start_instance(instance_id):
                instance_result["success"] = True
            else:
                result["success"] = False
                result["errors"].append(f"Failed to start instance {instance_id}")
            
            result["instances"].append(instance_result)
        
        # Invalidate cache after cluster action
        cluster_cache.invalidate_cluster_cache(cluster.name)
        
        return result
    
    def stop_cluster(self, cluster: ClusterConfig) -> Dict[str, Any]:
        """Stop all instances in a cluster."""
        result = {
            "cluster_name": cluster.name,
            "action": "stop",
            "success": True,
            "instances": [],
            "errors": []
        }
        
        for instance_id in cluster.instance_ids:
            instance_result = {
                "instance_id": instance_id,
                "success": False
            }
            
            if self.stop_instance(instance_id):
                instance_result["success"] = True
            else:
                result["success"] = False
                result["errors"].append(f"Failed to stop instance {instance_id}")
            
            result["instances"].append(instance_result)
        
        # Invalidate cache after cluster action
        cluster_cache.invalidate_cluster_cache(cluster.name)
        
        return result
    
    def get_all_clusters_status(self, clusters: List[ClusterConfig], use_cache: bool = True) -> List[Dict[str, Any]]:
        """Get status of all clusters with error handling."""
        cache_key = "all_clusters_status"
        
        # Try to get from cache first
        if use_cache:
            cached_results = cluster_cache.get(cache_key)
            if cached_results is not None:
                logger.debug("Using cached status for all clusters")
                return cached_results
        
        logger.debug("Fetching fresh status for all clusters")
        
        results = []
        for cluster in clusters:
            try:
                cluster_status = self.get_cluster_status(cluster, use_cache=use_cache)
                results.append(cluster_status)
            except Exception as e:
                logger.warning(f"Failed to get status for cluster {cluster.name}: {e}")
                # Return basic cluster info with error status
                error_status = {
                    "name": cluster.name,
                    "description": cluster.description,
                    "region": cluster.region,
                    "tags": cluster.tags,
                    "enabled": cluster.enabled,
                    "schedule": cluster.schedule,
                    "instances": [{"id": instance_id, "status": "error"} for instance_id in cluster.instance_ids],
                    "overall_status": "error",
                    "error": str(e)
                }
                results.append(error_status)
        
        # Cache the results
        if use_cache:
            cluster_cache.set(cache_key, results)
        
        return results
