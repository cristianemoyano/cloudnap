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
            
            // Refresh cluster statuses after a short delay
            setTimeout(() => {
                loadClusterStatuses(true);
            }, CONFIG.CLUSTER_STATUS_REFRESH_DELAY);
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
    
    // Re-enable all buttons for this cluster
    const clusterButtons = safeQuerySelectorAll(`[data-cluster="${clusterName}"]${CONFIG.SELECTORS.CLUSTER_ACTION_BTNS}`);
    clusterButtons.forEach(button => {
        button.disabled = false;
        button.classList.remove(CONFIG.CLASSES.DISABLED);
        
        // Reset button text and icon
        const btnText = button.querySelector('.btn-text');
        const icon = button.querySelector('i');
        const actionType = button.dataset.action;
        
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
    });
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
 * Update cluster statuses in the UI
 */
function updateClusterStatuses(clustersData) {
    clustersData.forEach(clusterData => {
        const clusterCard = safeQuerySelector(`[data-cluster-name="${clusterData.name.toLowerCase()}"] .cluster-card`);
        if (!clusterCard) return;
        
        // Update overall status badge
        const statusBadge = clusterCard.querySelector(CONFIG.SELECTORS.STATUS_BADGES);
        if (statusBadge) {
            let badgeClass = `badge bg-${CONFIG.STATUS_COLORS.UNKNOWN}`;
            let statusText = 'UNKNOWN';
            
            if (clusterData.overall_status === 'running') {
                badgeClass = `badge bg-${CONFIG.STATUS_COLORS.RUNNING}`;
                statusText = 'RUNNING';
            } else if (clusterData.overall_status === 'stopped') {
                badgeClass = `badge bg-${CONFIG.STATUS_COLORS.STOPPED}`;
                statusText = 'STOPPED';
            } else if (clusterData.overall_status === 'error') {
                badgeClass = `badge bg-${CONFIG.STATUS_COLORS.ERROR}`;
                statusText = 'ERROR';
            }
            
            statusBadge.className = badgeClass;
            statusBadge.textContent = statusText;
        }
        
        // Update instance statuses
        const instanceContainer = clusterCard.querySelector('.instance-statuses');
        if (instanceContainer && clusterData.instances) {
            instanceContainer.innerHTML = '';
            clusterData.instances.forEach(instance => {
                const instanceElement = document.createElement('small');
                instanceElement.className = 'd-block';
                
                let statusIcon = CONFIG.ICONS.CIRCLE_FILL;
                let statusClass = CONFIG.CLASSES.STATUS_UNKNOWN;
                
                if (instance.status === 'running') {
                    statusIcon = CONFIG.ICONS.CIRCLE_FILL;
                    statusClass = CONFIG.CLASSES.STATUS_RUNNING;
                } else if (instance.status === 'stopped') {
                    statusIcon = CONFIG.ICONS.CIRCLE_FILL;
                    statusClass = CONFIG.CLASSES.STATUS_STOPPED;
                } else if (instance.status === 'error') {
                    statusIcon = CONFIG.ICONS.EXCLAMATION_TRIANGLE;
                    statusClass = CONFIG.CLASSES.STATUS_ERROR;
                }
                
                instanceElement.innerHTML = `
                    <i class="bi ${statusIcon} ${statusClass}"></i>
                    ${instance.id}: ${instance.status || 'unknown'}
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
