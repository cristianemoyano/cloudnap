"""Huawei Cloud service for managing ECS instances."""

import logging
import requests
import json
from datetime import datetime
from typing import Dict, List, Optional, Any
from urllib.parse import urlparse

from app.config import HuaweiCloudConfig, ClusterConfig
from app.services.cache_service import cluster_cache

logger = logging.getLogger(__name__)

# Try to import Huawei Cloud SDK, fallback to manual implementation if not available
try:
    import sys
    import os
    # Add the gateway SDK to the path
    gateway_path = os.path.join(os.path.dirname(__file__), '..', 'gateway', 'ApiGateway-python-sdk-2.0.6')
    sys.path.insert(0, gateway_path)
    from apig_sdk import signer
    SDK_AVAILABLE = True
    logger.info("Huawei Cloud SDK loaded successfully")
except ImportError as e:
    SDK_AVAILABLE = False
    logger.warning(f"Huawei Cloud SDK not available, using manual implementation: {e}")
    import hashlib
    import hmac
    from urllib.parse import urlencode


class HuaweiCloudService:
    """Service for interacting with Huawei Cloud ECS API."""
    
    def __init__(self, config: HuaweiCloudConfig):
        """Initialize Huawei Cloud service."""
        self.config = config
        self.base_url = f"https://ecs.{config.region}.myhuaweicloud.com"
        self.api_version = "v2.1"
    
    def _generate_signature(self, method: str, uri: str, query_params: Dict[str, str], 
                          headers: Dict[str, str], body: str = "", timestamp: str = None) -> str:
        """Generate signature for Huawei Cloud API authentication."""
        # Use provided timestamp or generate new one
        if timestamp is None:
            now = datetime.utcnow()
            timestamp = now.strftime('%Y%m%dT%H%M%SZ')
            date_stamp = now.strftime('%Y%m%d')
        else:
            # Extract date from timestamp
            date_stamp = timestamp[:8]  # YYYYMMDD from YYYYMMDDTHHMMSSZ
        
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
        credential_scope = f"{date_stamp}/{self.config.region}/ecs/sdk_request"
        string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashlib.sha256(canonical_request.encode()).hexdigest()}"
        
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
        
        if SDK_AVAILABLE:
            return self._make_request_with_sdk(method, url, query_params, body)
        else:
            return self._make_request_manual(method, url, query_params, body)
    
    def _make_request_with_sdk(self, method: str, url: str, query_params: Dict[str, Any], body: str) -> Dict[str, Any]:
        """Make request using Huawei Cloud SDK."""
        try:
            # Create signer instance
            sig = signer.Signer()
            sig.Key = self.config.access_key
            sig.Secret = self.config.secret_key
            
            # Create HTTP request
            r = signer.HttpRequest(method, url)
            
            # Set headers
            r.headers = {
                "Content-Type": "application/json;charset=UTF-8",
                "X-Project-Id": self.config.project_id
            }
            
            # Set body
            r.body = body
            
            # Sign the request
            sig.Sign(r)
            
            # Log request details for debugging
            logger.info(f"SDK Request: {method} {url}")
            logger.info(f"SDK Headers: {r.headers}")
            logger.info(f"SDK Body: {r.body}")
            logger.info(f"SDK URL: {r.scheme}://{r.host}{r.uri}")
            
            # Make the request
            response = requests.request(
                method=r.method,
                url=f"{r.scheme}://{r.host}{r.uri}",
                headers=r.headers,
                data=r.body,
                timeout=5
            )
            
            # Log response details
            logger.info(f"Response status: {response.status_code}")
            logger.info(f"Response headers: {dict(response.headers)}")
            logger.info(f"Response text: {response.text[:500]}...")  # First 500 chars
            
            if response.status_code >= 400:
                logger.error(f"API Error {response.status_code}: {response.text}")
                try:
                    error_data = response.json()
                    logger.error(f"Error details: {error_data}")
                except Exception as json_error:
                    logger.error(f"JSON parse error: {json_error}")
                    logger.error(f"Raw error response: {response.text}")
            
            response.raise_for_status()
            
            # Handle empty response
            if not response.text.strip():
                logger.warning("Empty response received")
                return {}
                
            return response.json()
            
        except Exception as e:
            logger.error(f"SDK request failed: {e}")
            logger.error(f"Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
    
    def _make_request_manual(self, method: str, url: str, query_params: Dict[str, Any], body: str) -> Dict[str, Any]:
        """Make request using manual signature implementation (fallback)."""
        # Get consistent timestamp for headers and signature
        now = datetime.utcnow()
        timestamp = now.strftime('%Y%m%dT%H%M%SZ')
        
        headers = {
            "Content-Type": "application/json;charset=UTF-8",
            "X-Sdk-Date": timestamp,
            "X-Project-Id": self.config.project_id,
            "Host": f"ecs.{self.config.region}.myhuaweicloud.com"
        }
        
        # Generate signature with consistent timestamp
        # Extract endpoint from URL for signature
        parsed_url = urlparse(url)
        endpoint_path = parsed_url.path
        signature = self._generate_signature(method, endpoint_path, 
                                           query_params, headers, body, timestamp)
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
            
            # Log detailed response information for debugging
            logger.debug(f"API Request: {method} {url}")
            logger.debug(f"Request headers: {headers}")
            logger.debug(f"Request body: {body}")
            logger.debug(f"Response status: {response.status_code}")
            logger.debug(f"Response headers: {dict(response.headers)}")
            
            if response.status_code >= 400:
                logger.error(f"API Error {response.status_code}: {response.text}")
                # Try to parse error response
                try:
                    error_data = response.json()
                    logger.error(f"Error details: {error_data}")
                except:
                    logger.error(f"Raw error response: {response.text}")
            
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed: {e}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"Response status: {e.response.status_code}")
                logger.error(f"Response text: {e.response.text}")
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
            
            # Get the actual status - check task_state first, then status
            task_state = instance_status.get("OS-EXT-STS:task_state")
            vm_state = instance_status.get("status", "unknown")
            
            # Use task_state if available and not null, otherwise use vm_state
            if task_state and task_state != "null":
                huawei_status = task_state
            else:
                huawei_status = vm_state
                
            instance_statuses.append(huawei_status)
            logger.info(f"Instance {instance_id} - vm_state: {vm_state}, task_state: {task_state}, using: {huawei_status}")
        
        # Determine overall cluster status with intermediate states
        cluster_status["overall_status"] = self._determine_cluster_status(instance_statuses)
        logger.info(f"Cluster {cluster.name} overall status: {cluster_status['overall_status']} (from statuses: {instance_statuses})")
        
        # Cache the result
        if use_cache:
            cluster_cache.set(cache_key, cluster_status)
        
        return cluster_status
    
    def _determine_cluster_status(self, instance_statuses: List[str]) -> str:
        """Determine cluster status based on instance statuses."""
        if not instance_statuses:
            return "unknown"
        
        # Check for error states first
        if any(status == "ERROR" for status in instance_statuses):
            return "error"
        
        # Check for transitional states
        transitional_states = {
            "BUILD", "REBOOT", "HARD_REBOOT", "MIGRATING", "RESIZE", 
            "VERIFY_RESIZE", "REVERT_RESIZE", "PASSWORD", "REBUILD", 
            "RESCUE", "UNRESCUE"
        }
        
        if any(status in transitional_states for status in instance_statuses):
            return "transitioning"
        
        # Check for powering off/on states
        if any(status in ["powering-off", "stopping", "POWERING_OFF", "STOPPING"] for status in instance_statuses):
            return "stopping"
        
        if any(status in ["powering-on", "starting", "POWERING_ON", "STARTING"] for status in instance_statuses):
            return "starting"
        
        # Check for suspended/paused states
        if any(status in ["SUSPENDED", "PAUSED", "SHELVED", "SHELVED_OFFLOADED"] for status in instance_statuses):
            return "stopped"
        
        # Check for final states
        if all(status in ["ACTIVE", "active"] for status in instance_statuses):
            return "running"
        elif all(status in ["SHUTOFF", "shutoff"] for status in instance_statuses):
            return "stopped"
        elif any(status in ["ACTIVE", "active"] for status in instance_statuses):
            return "partial"
        else:
            return "unknown"
    
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
