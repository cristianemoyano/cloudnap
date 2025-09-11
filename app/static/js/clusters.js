/**
 * CloudNap Cluster Management
 * Handles cluster operations, status updates, and UI interactions
 */

// Global state
const ClusterManager = {
    activeActions: new Set(),
    allTags: new Set(),
    activeFilters: {
        search: '',
        tag: ''
    }
};

/**
 * Handle cluster action (start/stop)
 */
function handleClusterAction(button, action, clusterName) {
    const actionKey = `${clusterName}-${action}`;
    
    // Check if this action is already in progress
    if (ClusterManager.activeActions.has(actionKey)) {
        debugLog('CLUSTER', `Action ${action} for cluster ${clusterName} is already in progress`);
        return;
    }
    
    // Check if action is valid for current cluster status
    if (!isActionValidForCluster(clusterName, action)) {
        const actionText = action === 'start' ? 'Start' : 'Stop';
        const currentStatus = getCurrentClusterStatus(clusterName);
        showToast(CONFIG.TOAST_TYPES.ERROR, `Cannot ${actionText.toLowerCase()} cluster ${clusterName}. Current status: ${currentStatus}`);
        return;
    }
    
    // Show confirmation dialog
    const actionText = action === 'start' ? 'Start' : 'Stop';
    if (!confirm(`${actionText} cluster ${clusterName}?`)) {
        return; // User cancelled
    }
    
    // Mark action as active
    ClusterManager.activeActions.add(actionKey);
    
    // Update button state
    updateButtonLoadingState(button, action);
    
    // Disable both buttons for this cluster
    disableClusterButtons(clusterName);
    
    // Make AJAX request to the API
    const apiUrl = `${CONFIG.ENDPOINTS.CLUSTER_ACTION}/${clusterName}/${action}`;
    
    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        debugLog('CLUSTER', `Response received for ${action} ${clusterName}:`, response.status, response.statusText);
        return response.json();
    })
    .then(data => {
        debugLog('CLUSTER', `Response data for ${action} ${clusterName}:`, data);
        
        // Remove action from active set
        ClusterManager.activeActions.delete(actionKey);
        
        if (data.success) {
            // Show success state
            debugLog('CLUSTER', `Success response for ${action} ${clusterName}:`, data.message);
            showClusterActionResult(clusterName, action, true, data.message);
            
            // Start monitoring for status change with multiple retries
            monitorClusterStatusChange(clusterName, action);
        } else {
            // Show error state
            debugLog('CLUSTER', `Error response for ${action} ${clusterName}:`, data.error);
            showClusterActionResult(clusterName, action, false, data.error || 'Unknown error');
        }
        
        // Re-enable buttons after showing result
        setTimeout(() => {
            resetClusterActionButtons(clusterName, action);
        }, CONFIG.BUTTON_RESET_DELAY);
    })
    .catch(error => {
        debugLog('CLUSTER', `Network error ${action} cluster ${clusterName}:`, error);
        
        // Remove action from active set
        ClusterManager.activeActions.delete(actionKey);
        
        // Show error state
        showClusterActionResult(clusterName, action, false, `Network error: ${error.message}`);
        
        // Re-enable buttons after showing error
        setTimeout(() => {
            resetClusterActionButtons(clusterName, action);
        }, CONFIG.BUTTON_RESET_DELAY);
    });
}

/**
 * Update button to loading state
 */
function updateButtonLoadingState(button, action) {
    const btnText = button.querySelector('.btn-text');
    const icon = button.querySelector('i');
    
    // Show loading state
    button.disabled = true;
    button.classList.add(CONFIG.CLASSES.DISABLED);
    btnText.textContent = action === 'start' ? 
        CONFIG.BUTTON_STATES.LOADING.START : 
        CONFIG.BUTTON_STATES.LOADING.STOP;
    icon.className = CONFIG.ICONS.HOURGLASS;
}

/**
 * Disable all buttons for a cluster
 */
function disableClusterButtons(clusterName) {
    const clusterButtons = safeQuerySelectorAll(`[data-cluster="${clusterName}"]${CONFIG.SELECTORS.CLUSTER_ACTION_BTNS}`);
    clusterButtons.forEach(btn => {
        btn.disabled = true;
        btn.classList.add(CONFIG.CLASSES.DISABLED);
    });
}

/**
 * Show cluster action result
 */
function showClusterActionResult(clusterName, action, success, message) {
    debugLog('CLUSTER', `showClusterActionResult called: ${clusterName}, ${action}, ${success}, ${message}`);
    
    const clusterButtons = safeQuerySelectorAll(`[data-cluster="${clusterName}"]${CONFIG.SELECTORS.CLUSTER_ACTION_BTNS}`);
    debugLog('CLUSTER', `Found ${clusterButtons.length} buttons for cluster ${clusterName}`);
    
    clusterButtons.forEach(button => {
        const btnText = button.querySelector('.btn-text');
        const icon = button.querySelector('i');
        
        if (success) {
            // Show success state
            button.classList.remove('btn-success', 'btn-danger');
            button.classList.add('btn-success');
            btnText.textContent = action === 'start' ? 
                CONFIG.BUTTON_STATES.SUCCESS.START : 
                CONFIG.BUTTON_STATES.SUCCESS.STOP;
            icon.className = CONFIG.ICONS.CHECK_CIRCLE;
            debugLog('CLUSTER', `Button updated to success state: ${btnText.textContent}`);
        } else {
            // Show error state
            button.classList.remove('btn-success', 'btn-danger');
            button.classList.add('btn-danger');
            btnText.textContent = CONFIG.BUTTON_STATES.ERROR;
            icon.className = CONFIG.ICONS.EXCLAMATION_TRIANGLE;
            debugLog('CLUSTER', `Button updated to error state: ${btnText.textContent}`);
        }
    });
    
    // Show toast notification
    const toastType = success ? CONFIG.TOAST_TYPES.SUCCESS : CONFIG.TOAST_TYPES.ERROR;
    debugLog('CLUSTER', `Calling showToast with: ${toastType}, ${message}`);
    showToast(toastType, message);
}

/**
 * Reset cluster action buttons to normal state
 */
function resetClusterActionButtons(clusterName, action) {
    const actionKey = `${clusterName}-${action}`;
    ClusterManager.activeActions.delete(actionKey);
    
    // Get current cluster status to determine button states
    const currentStatus = getCurrentClusterStatus(clusterName);
    
    // Reset all buttons for this cluster
    const clusterButtons = safeQuerySelectorAll(`[data-cluster="${clusterName}"]${CONFIG.SELECTORS.CLUSTER_ACTION_BTNS}`);
    clusterButtons.forEach(button => {
        const actionType = button.dataset.action;
        
        // Reset button text and icon
        const btnText = button.querySelector('.btn-text');
        const icon = button.querySelector('i');
        
        if (btnText) {
            btnText.textContent = actionType === 'start' ? 'Start' : 'Stop';
        }
        
        if (icon) {
            icon.className = actionType === 'start' ? CONFIG.ICONS.PLAY : CONFIG.ICONS.STOP;
        }
        
        // Reset button colors
        button.classList.remove('btn-success', 'btn-danger');
        if (actionType === 'start') {
            button.classList.add('btn-success');
        } else {
            button.classList.add('btn-danger');
        }
        
        // Update button state based on current cluster status
        const isValidAction = isActionValidForCluster(clusterName, actionType);
        button.disabled = !isValidAction;
        button.classList.toggle(CONFIG.CLASSES.DISABLED, !isValidAction);
        
        // Update tooltip
        if (!isValidAction) {
            button.title = `Cannot ${actionType} cluster. Current status: ${currentStatus}`;
        } else {
            button.title = `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} cluster`;
        }
    });
}

/**
 * Check if an action is valid for the current cluster status
 */
function isActionValidForCluster(clusterName, action) {
    const clusterCard = safeQuerySelector(`[data-cluster-name="${clusterName.toLowerCase()}"] .cluster-card`);
    if (!clusterCard) return false;
    
    const statusBadge = clusterCard.querySelector(CONFIG.SELECTORS.STATUS_BADGES);
    if (!statusBadge) return false;
    
    const currentStatus = statusBadge.textContent.trim().toLowerCase();
    
    // Define valid actions for each status
    const validActions = {
        'running': ['stop'],
        'stopped': ['start'],
        'starting': [], // No actions allowed while starting
        'stopping': [], // No actions allowed while stopping
        'powering_off': [], // No actions allowed while powering off
        'powering_on': [], // No actions allowed while powering on
        'rebooting': [], // No actions allowed while rebooting
        'transitioning': [], // No actions allowed while transitioning
        'partial': ['start', 'stop'], // Both actions allowed for partial state
        'error': ['start', 'stop'], // Both actions allowed for error state
        'unknown': ['start', 'stop'] // Both actions allowed for unknown state
    };
    
    return validActions[currentStatus]?.includes(action) || false;
}

/**
 * Get current cluster status text
 */
function getCurrentClusterStatus(clusterName) {
    const clusterCard = safeQuerySelector(`[data-cluster-name="${clusterName.toLowerCase()}"] .cluster-card`);
    if (!clusterCard) return 'UNKNOWN';
    
    const statusBadge = clusterCard.querySelector(CONFIG.SELECTORS.STATUS_BADGES);
    if (!statusBadge) return 'UNKNOWN';
    
    return statusBadge.textContent.trim();
}

/**
 * Update button states based on cluster status
 */
function updateClusterButtonStates(clusterName, clusterStatus) {
    const clusterCard = safeQuerySelector(`[data-cluster-name="${clusterName.toLowerCase()}"] .cluster-card`);
    if (!clusterCard) return;
    
    const startButton = clusterCard.querySelector('[data-action="start"]');
    const stopButton = clusterCard.querySelector('[data-action="stop"]');
    
    if (startButton) {
        const canStart = isActionValidForCluster(clusterName, 'start');
        startButton.disabled = !canStart;
        startButton.classList.toggle(CONFIG.CLASSES.DISABLED, !canStart);
        
        // Add visual indicator for disabled state
        if (!canStart) {
            startButton.title = `Cannot start cluster. Current status: ${clusterStatus}`;
        } else {
            startButton.title = 'Start cluster';
        }
    }
    
    if (stopButton) {
        const canStop = isActionValidForCluster(clusterName, 'stop');
        stopButton.disabled = !canStop;
        stopButton.classList.toggle(CONFIG.CLASSES.DISABLED, !canStop);
        
        // Add visual indicator for disabled state
        if (!canStop) {
            stopButton.title = `Cannot stop cluster. Current status: ${clusterStatus}`;
        } else {
            stopButton.title = 'Stop cluster';
        }
    }
}

/**
 * Monitor cluster status change after an action
 */
function monitorClusterStatusChange(clusterName, action) {
    const expectedStatus = action === 'start' ? 'running' : 'stopped';
    let retryCount = 0;
    
    debugLog('CLUSTER', `Starting status monitoring for ${clusterName} (${action}) - expecting ${expectedStatus}`);
    
    const checkStatus = () => {
        retryCount++;
        debugLog('CLUSTER', `Status check attempt ${retryCount}/${CONFIG.CLUSTER_STATUS_MAX_RETRIES} for ${clusterName}`);
        
        // Show monitoring indicator
        showStatusMonitoringIndicator(clusterName, retryCount);
        
        // Fetch fresh status
        fetch(`${CONFIG.ENDPOINTS.CLUSTER_STATUS}?force_refresh=true`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const clusterData = data.data.find(c => c.name === clusterName);
                    if (clusterData) {
                        // Determine current cluster status based on instances
                        const currentStatus = determineClusterStatus(clusterData.instances);
                        debugLog('CLUSTER', `Current status for ${clusterName}: ${currentStatus}`);
                        
                        // Check if we've reached the expected final status
                        if (currentStatus === expectedStatus) {
                            // Status changed as expected
                            debugLog('CLUSTER', `Status change confirmed for ${clusterName}: ${expectedStatus}`);
                            updateClusterStatuses(data.data);
                            hideStatusMonitoringIndicator(clusterName);
                            return; // Stop monitoring
                        }
                        
                        // Update UI with current status (including intermediate states)
                        updateClusterStatuses(data.data);
                    }
                }
                
                // Check if we should retry
                if (retryCount < CONFIG.CLUSTER_STATUS_MAX_RETRIES) {
                    debugLog('CLUSTER', `Status not yet changed for ${clusterName}, retrying in ${CONFIG.CLUSTER_STATUS_RETRY_DELAY}ms`);
                    setTimeout(checkStatus, CONFIG.CLUSTER_STATUS_RETRY_DELAY);
                } else {
                    debugLog('CLUSTER', `Max retries reached for ${clusterName}, updating UI with current status`);
                    updateClusterStatuses(data.data);
                    hideStatusMonitoringIndicator(clusterName);
                }
            })
            .catch(error => {
                debugLog('CLUSTER', `Error monitoring status for ${clusterName}:`, error);
                hideStatusMonitoringIndicator(clusterName);
            });
    };
    
    // Start monitoring after initial delay
    setTimeout(checkStatus, CONFIG.CLUSTER_STATUS_REFRESH_DELAY);
}

/**
 * Show status monitoring indicator
 */
function showStatusMonitoringIndicator(clusterName, retryCount) {
    const clusterCard = safeQuerySelector(`[data-cluster-name="${clusterName.toLowerCase()}"] .cluster-card`);
    if (!clusterCard) return;
    
    const statusBadge = clusterCard.querySelector(CONFIG.SELECTORS.STATUS_BADGES);
    if (statusBadge) {
        statusBadge.className = `badge bg-${CONFIG.STATUS_COLORS.LOADING}`;
        statusBadge.textContent = `UPDATING... (${retryCount}/${CONFIG.CLUSTER_STATUS_MAX_RETRIES})`;
    }
}

/**
 * Hide status monitoring indicator
 */
function hideStatusMonitoringIndicator(clusterName) {
    const clusterCard = safeQuerySelector(`[data-cluster-name="${clusterName.toLowerCase()}"] .cluster-card`);
    if (!clusterCard) return;
    
    const statusBadge = clusterCard.querySelector(CONFIG.SELECTORS.STATUS_BADGES);
    if (statusBadge) {
        // Status will be updated by updateClusterStatuses
        debugLog('CLUSTER', `Hiding monitoring indicator for ${clusterName}`);
    }
}

/**
 * Load cluster statuses asynchronously
 */
function loadClusterStatuses(forceRefresh = false) {
    const clusterCards = safeQuerySelectorAll(CONFIG.SELECTORS.CLUSTER_CARDS);
    
    // Show loading indicators only if not using cache
    if (forceRefresh) {
        clusterCards.forEach(card => {
            const statusBadge = card.querySelector(CONFIG.SELECTORS.STATUS_BADGES);
            if (statusBadge) {
                statusBadge.className = `badge bg-${CONFIG.STATUS_COLORS.LOADING}`;
                statusBadge.textContent = 'LOADING...';
            }
            
            // Show loading for instances
            const instanceStatuses = card.querySelectorAll(CONFIG.SELECTORS.INSTANCE_STATUSES);
            instanceStatuses.forEach(status => {
                status.innerHTML = `<i class="bi ${CONFIG.ICONS.HOURGLASS}"></i> Loading...`;
            });
        });
    }
    
    // Build URL with force refresh parameter
    const url = forceRefresh ? 
        `${CONFIG.ENDPOINTS.CLUSTER_STATUS}?force_refresh=true` : 
        CONFIG.ENDPOINTS.CLUSTER_STATUS;
    
    // Fetch cluster statuses
    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateClusterStatuses(data.data);
                
                // Show cache status in console for debugging
                if (CONFIG.DEBUG.SHOW_CACHE_STATUS && data.cached !== undefined) {
                    debugLog('CACHE', `Cluster statuses loaded from ${data.cached ? 'cache' : 'API'}`);
                }
            } else {
                showClusterStatusError(data.error);
            }
        })
        .catch(error => {
            debugLog('CLUSTER', 'Failed to load cluster statuses:', error);
            showClusterStatusError('Failed to load cluster statuses');
        });
}

/**
 * Map Huawei Cloud instance status to UI status
 */
function mapInstanceStatus(huaweiStatus) {
    const statusMap = {
        'ACTIVE': 'running',
        'SHUTOFF': 'stopped',
        'BUILD': 'starting',
        'REBOOT': 'rebooting',
        'HARD_REBOOT': 'rebooting',
        'MIGRATING': 'starting',
        'RESIZE': 'starting',
        'VERIFY_RESIZE': 'starting',
        'REVERT_RESIZE': 'starting',
        'PASSWORD': 'starting',
        'REBUILD': 'starting',
        'RESCUE': 'starting',
        'UNRESCUE': 'starting',
        'SUSPENDED': 'stopped',
        'PAUSED': 'stopped',
        'SHELVED': 'stopped',
        'SHELVED_OFFLOADED': 'stopped',
        'ERROR': 'error'
    };
    
    return statusMap[huaweiStatus] || 'unknown';
}

/**
 * Map instance status to display text and color
 */
function getStatusDisplayInfo(status) {
    const statusInfo = {
        'running': { text: 'RUNNING', color: CONFIG.STATUS_COLORS.RUNNING, icon: CONFIG.ICONS.CIRCLE_FILL },
        'stopped': { text: 'STOPPED', color: CONFIG.STATUS_COLORS.STOPPED, icon: CONFIG.ICONS.CIRCLE_FILL },
        'starting': { text: 'STARTING', color: CONFIG.STATUS_COLORS.STARTING, icon: CONFIG.ICONS.HOURGLASS },
        'stopping': { text: 'STOPPING', color: CONFIG.STATUS_COLORS.STOPPING, icon: CONFIG.ICONS.HOURGLASS },
        'powering_off': { text: 'POWERING OFF', color: CONFIG.STATUS_COLORS.POWERING_OFF, icon: CONFIG.ICONS.HOURGLASS },
        'powering_on': { text: 'POWERING ON', color: CONFIG.STATUS_COLORS.POWERING_ON, icon: CONFIG.ICONS.HOURGLASS },
        'rebooting': { text: 'REBOOTING', color: CONFIG.STATUS_COLORS.REBOOTING, icon: CONFIG.ICONS.HOURGLASS },
        'transitioning': { text: 'TRANSITIONING', color: CONFIG.STATUS_COLORS.TRANSITIONING, icon: CONFIG.ICONS.HOURGLASS },
        'partial': { text: 'PARTIAL', color: CONFIG.STATUS_COLORS.PARTIAL, icon: CONFIG.ICONS.EXCLAMATION_TRIANGLE },
        'error': { text: 'ERROR', color: CONFIG.STATUS_COLORS.ERROR, icon: CONFIG.ICONS.EXCLAMATION_TRIANGLE },
        'unknown': { text: 'UNKNOWN', color: CONFIG.STATUS_COLORS.UNKNOWN, icon: CONFIG.ICONS.CIRCLE_FILL }
    };
    
    return statusInfo[status] || statusInfo['unknown'];
}

/**
 * Determine overall cluster status based on instance statuses
 */
function determineClusterStatus(instances) {
    if (!instances || instances.length === 0) {
        return 'unknown';
    }
    
    const statuses = instances.map(instance => mapInstanceStatus(instance.status));
    
    // If any instance is in error state
    if (statuses.includes('error')) {
        return 'error';
    }
    
    // If any instance is starting/stopping/rebooting
    if (statuses.some(status => ['starting', 'stopping', 'powering_off', 'powering_on', 'rebooting'].includes(status))) {
        return 'transitioning';
    }
    
    // If all instances are running
    if (statuses.every(status => status === 'running')) {
        return 'running';
    }
    
    // If all instances are stopped
    if (statuses.every(status => status === 'stopped')) {
        return 'stopped';
    }
    
    // Mixed states
    return 'partial';
}

/**
 * Update cluster statuses in the UI
 */
function updateClusterStatuses(clustersData) {
    clustersData.forEach(clusterData => {
        const clusterCard = safeQuerySelector(`[data-cluster-name="${clusterData.name.toLowerCase()}"] .cluster-card`);
        if (!clusterCard) return;
        
        // Determine cluster status based on instances
        const clusterStatus = determineClusterStatus(clusterData.instances);
        const statusInfo = getStatusDisplayInfo(clusterStatus);
        
        // Update overall status badge
        const statusBadge = clusterCard.querySelector(CONFIG.SELECTORS.STATUS_BADGES);
        if (statusBadge) {
            statusBadge.className = `badge bg-${statusInfo.color}`;
            statusBadge.textContent = statusInfo.text;
        }
        
        // Update button states based on cluster status
        updateClusterButtonStates(clusterData.name, statusInfo.text);
        
        // Update instance statuses
        const instanceContainer = clusterCard.querySelector('.instance-statuses');
        if (instanceContainer && clusterData.instances) {
            instanceContainer.innerHTML = '';
            clusterData.instances.forEach(instance => {
                const instanceElement = document.createElement('small');
                instanceElement.className = 'd-block';
                
                // Map Huawei Cloud status to UI status
                const mappedStatus = mapInstanceStatus(instance.status);
                const statusInfo = getStatusDisplayInfo(mappedStatus);
                
                // Add spinning animation for transitional states
                const isTransitional = ['starting', 'stopping', 'powering_off', 'powering_on', 'rebooting'].includes(mappedStatus);
                const spinClass = isTransitional ? CONFIG.CLASSES.SPIN : '';
                
                instanceElement.innerHTML = `
                    <i class="bi ${statusInfo.icon} ${spinClass}" style="color: var(--bs-${statusInfo.color})"></i>
                    ${instance.id}: ${statusInfo.text}
                `;
                instanceContainer.appendChild(instanceElement);
            });
        }
        
        // Show error message if there's an error
        if (clusterData.overall_status === 'error' && clusterData.error) {
            const errorElement = clusterCard.querySelector('.cluster-error');
            if (!errorElement) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'alert alert-warning alert-sm mt-2 cluster-error';
                errorDiv.innerHTML = `
                    <i class="bi ${CONFIG.ICONS.EXCLAMATION_TRIANGLE}"></i>
                    <small>API Error: ${clusterData.error}</small>
                `;
                clusterCard.querySelector('.card-body').appendChild(errorDiv);
            }
        }
    });
}

/**
 * Show cluster status error
 */
function showClusterStatusError(errorMessage) {
    const clusterCards = safeQuerySelectorAll(CONFIG.SELECTORS.CLUSTER_CARDS);
    clusterCards.forEach(card => {
        const statusBadge = card.querySelector(CONFIG.SELECTORS.STATUS_BADGES);
        if (statusBadge) {
            statusBadge.className = `badge bg-${CONFIG.STATUS_COLORS.ERROR}`;
            statusBadge.textContent = 'ERROR';
        }
        
        // Show error for instances
        const instanceStatuses = card.querySelectorAll(CONFIG.SELECTORS.INSTANCE_STATUSES);
        instanceStatuses.forEach(status => {
            status.innerHTML = `<i class="bi ${CONFIG.ICONS.EXCLAMATION_TRIANGLE} text-warning"></i> API Error`;
        });
    });
    
    // Show global error message
    const errorAlert = document.createElement('div');
    errorAlert.className = 'alert alert-warning alert-dismissible fade show';
    errorAlert.innerHTML = `
        <i class="bi ${CONFIG.ICONS.EXCLAMATION_TRIANGLE}"></i>
        <strong>Warning:</strong> Failed to load cluster statuses. ${errorMessage}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    const container = document.querySelector('.container-fluid');
    if (container) {
        container.insertBefore(errorAlert, container.firstChild);
    }
}

/**
 * Refresh clusters (manual refresh)
 */
function refreshClusters(forceRefresh = false) {
    // Show loading state
    const refreshBtn = safeQuerySelector(CONFIG.SELECTORS.REFRESH_BTN);
    if (!refreshBtn) return;
    
    const originalText = refreshBtn.innerHTML;
    refreshBtn.innerHTML = `<i class="bi ${CONFIG.ICONS.REFRESH} ${CONFIG.CLASSES.SPIN}"></i> Reloading...`;
    refreshBtn.disabled = true;
    
    // Reload configuration first
    fetch(CONFIG.ENDPOINTS.CONFIG_RELOAD, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Configuration reloaded successfully, now reload cluster statuses
            loadClusterStatuses(forceRefresh);
            
            // Restore button after a short delay
            setTimeout(() => {
                refreshBtn.innerHTML = originalText;
                refreshBtn.disabled = false;
            }, 1000);
        } else {
            // Show error and restore button
            alert('Failed to reload configuration: ' + data.error);
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }
    })
    .catch(error => {
        debugLog('CLUSTER', 'Error:', error);
        alert('Failed to reload configuration: ' + error.message);
        refreshBtn.innerHTML = originalText;
        refreshBtn.disabled = false;
    });
}

/**
 * Initialize cluster management
 */
function initializeClusterManagement() {
    debugLog('CLUSTER', 'Initializing cluster management...');
    
    // Reset any active cluster actions on page load
    ClusterManager.activeActions.clear();
    
    // Load cluster statuses after page loads
    setTimeout(() => {
        loadClusterStatuses();
    }, CONFIG.PAGE_LOAD_DELAY);
    
    // Auto-refresh every configured interval
    setInterval(() => {
        // Only refresh if user is on the page and not interacting
        if (document.visibilityState === 'visible') {
            loadClusterStatuses(false); // Use cache for auto-refresh
        }
    }, CONFIG.AUTO_REFRESH_INTERVAL);
    
    debugLog('CLUSTER', 'Cluster management initialized successfully');
}

// Export functions for global access
window.handleClusterAction = handleClusterAction;
window.refreshClusters = refreshClusters;
window.loadClusterStatuses = loadClusterStatuses;
window.initializeClusterManagement = initializeClusterManagement;
