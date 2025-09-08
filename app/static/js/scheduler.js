/**
 * CloudNap Scheduler and Cron Management
 * Handles scheduled jobs, cron expressions, and time display
 */

// Global variables for scheduler
// Language is fixed to English

// Global state for job filters
const JobFilterManager = {
    activeFilters: {
        search: '',
        type: ''
    }
};

/**
 * Trigger a scheduled job
 */
function triggerJob(jobId) {
    if (confirm('Trigger job ' + jobId + ' now?')) {
        fetch(`${CONFIG.ENDPOINTS.SCHEDULER_JOBS}/${jobId}/trigger`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast(CONFIG.TOAST_TYPES.SUCCESS, 'Job triggered successfully');
                // Reload page after a short delay to show updated status
                setTimeout(() => {
                    location.reload();
                }, 1000);
            } else {
                showToast(CONFIG.TOAST_TYPES.ERROR, 'Failed to trigger job: ' + data.error);
            }
        })
        .catch(error => {
            showToast(CONFIG.TOAST_TYPES.ERROR, 'Error triggering job: ' + error);
        });
    }
}

/**
 * Initialize schedule info icons click handlers
 */
function initializeScheduleInfoIcons() {
    // Wait a bit for external libraries to load
    setTimeout(() => {
        // Check if cronstrue loaded successfully
        if (typeof cronstrue !== 'undefined') {
            debugLog('SCHEDULER', 'cronstrue library loaded successfully');
        } else {
            debugLog('SCHEDULER', 'cronstrue library failed to load, using fallback parser');
        }
        
        const infoIcons = document.querySelectorAll('.schedule-info');
        infoIcons.forEach(icon => {
            icon.addEventListener('click', function() {
                const cronExpr = this.getAttribute('data-cron');
                const type = this.getAttribute('data-type');
                const description = parseCronExpression(cronExpr);
                
                // Find or create description element
                let descElement = this.parentElement.querySelector('.schedule-description');
                if (!descElement) {
                    descElement = document.createElement('div');
                    descElement.className = 'schedule-description';
                    this.parentElement.appendChild(descElement);
                }
                
                // Toggle description
                if (descElement.classList.contains(CONFIG.CLASSES.SHOW)) {
                    descElement.classList.remove(CONFIG.CLASSES.SHOW);
                    this.classList.remove(CONFIG.CLASSES.TEXT_PRIMARY);
                } else {
                    // Hide all other descriptions first
                    document.querySelectorAll('.schedule-description.show').forEach(el => {
                        el.classList.remove(CONFIG.CLASSES.SHOW);
                    });
                    document.querySelectorAll('.schedule-info.text-primary').forEach(el => {
                        el.classList.remove(CONFIG.CLASSES.TEXT_PRIMARY);
                    });
                    
                    // Show this description with timezone info
                    const iconClass = type === 'wake_up' ? CONFIG.ICONS.SUNRISE : CONFIG.ICONS.MOON;
                    const actionText = type === 'wake_up' ? 'Wake up' : 'Shutdown';
                    
                    descElement.innerHTML = `
                        <i class="bi ${iconClass} me-1"></i>
                        <strong>${actionText}:</strong> ${description}<br>
                        <small class="text-muted">
                            <i class="bi ${CONFIG.ICONS.CLOCK}"></i> Timezone: <strong>${window.timezone}</strong>
                        </small>
                    `;
                    descElement.setAttribute('data-cron', cronExpr);
                    descElement.classList.add(CONFIG.CLASSES.SHOW);
                    this.classList.add(CONFIG.CLASSES.TEXT_PRIMARY);
                }
            });
        });
    }, CONFIG.LIBRARY_LOAD_DELAY);
}

/**
 * Initialize time display
 */
function initializeTimeDisplay() {
    // Update current time immediately and then every second
    updateCurrentTime();
    setInterval(updateCurrentTime, CONFIG.CLOCK_UPDATE_INTERVAL);
}

/**
 * Initialize job filters functionality
 */
function initializeJobFilters() {
    debugLog('SCHEDULER', 'Initializing job filters...');
    
    // Add event listeners for job filters
    const jobSearchInput = safeQuerySelector('#jobSearch');
    if (jobSearchInput) {
        const debouncedJobSearch = debounce(handleJobSearch, 300);
        jobSearchInput.addEventListener('input', debouncedJobSearch);
        debugLog('SCHEDULER', 'Job search input event listener added');
    }
    
    const jobTypeFilter = safeQuerySelector('#jobTypeFilter');
    if (jobTypeFilter) {
        jobTypeFilter.addEventListener('change', handleJobTypeFilter);
        debugLog('SCHEDULER', 'Job type filter event listener added');
    }
    
    
    debugLog('SCHEDULER', 'Job filters initialized successfully');
}

/**
 * Handle job search input
 */
function handleJobSearch(event) {
    JobFilterManager.activeFilters.search = event.target.value.toLowerCase();
    applyJobFilters();
}

/**
 * Handle job type filter change
 */
function handleJobTypeFilter(event) {
    JobFilterManager.activeFilters.type = event.target.value.toLowerCase();
    applyJobFilters();
}


/**
 * Apply filters to job items
 */
function applyJobFilters() {
    const jobItems = safeQuerySelectorAll('.job-item');
    let visibleCount = 0;
    
    if (CONFIG.DEBUG.SHOW_FILTER_LOGS) {
        debugLog('SCHEDULER', `Applying job filters to ${jobItems.length} job items`);
        debugLog('SCHEDULER', 'Active job filters:', JobFilterManager.activeFilters);
    }
    
    jobItems.forEach(item => {
        const jobName = item.dataset.jobName;
        const jobType = item.dataset.jobType;
        
        let matchesSearch = true;
        let matchesType = true;
        
        // Check search filter
        if (JobFilterManager.activeFilters.search) {
            matchesSearch = jobName.includes(JobFilterManager.activeFilters.search);
        }
        
        // Check type filter
        if (JobFilterManager.activeFilters.type) {
            matchesType = jobType === JobFilterManager.activeFilters.type;
        }
        
        // Show/hide item
        if (matchesSearch && matchesType) {
            item.classList.remove(CONFIG.CLASSES.HIDDEN);
            item.style.display = '';
            visibleCount++;
        } else {
            item.classList.add(CONFIG.CLASSES.HIDDEN);
            item.style.display = 'none';
        }
    });
    
    if (CONFIG.DEBUG.SHOW_FILTER_LOGS) {
        debugLog('SCHEDULER', `Visible jobs after filtering: ${visibleCount}`);
    }
    
    // Update active filters display
    updateActiveJobFiltersDisplay();
    
    // Show message if no jobs match
    showNoJobResultsMessage(visibleCount === 0);
}

/**
 * Update active job filters display
 */
function updateActiveJobFiltersDisplay() {
    const activeFiltersContainer = safeQuerySelector('#activeJobFilters');
    if (!activeFiltersContainer) return;
    
    activeFiltersContainer.innerHTML = '';
    
    if (JobFilterManager.activeFilters.search) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary filter-badge me-1';
        badge.innerHTML = `<i class="bi ${CONFIG.ICONS.SEARCH} me-1"></i>Search: "${JobFilterManager.activeFilters.search}" <i class="bi ${CONFIG.ICONS.X_CIRCLE} ms-1" onclick="clearJobSearch()"></i>`;
        activeFiltersContainer.appendChild(badge);
    }
    
    if (JobFilterManager.activeFilters.type) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-info filter-badge me-1';
        badge.innerHTML = `<i class="bi ${CONFIG.ICONS.TAG} me-1"></i>Type: "${JobFilterManager.activeFilters.type}" <i class="bi ${CONFIG.ICONS.X_CIRCLE} ms-1" onclick="clearJobTypeFilter()"></i>`;
        activeFiltersContainer.appendChild(badge);
    }
    
}

/**
 * Clear job search filter
 */
function clearJobSearch() {
    const searchInput = safeQuerySelector('#jobSearch');
    if (searchInput) {
        searchInput.value = '';
    }
    JobFilterManager.activeFilters.search = '';
    applyJobFilters();
}

/**
 * Clear job type filter
 */
function clearJobTypeFilter() {
    const typeFilter = safeQuerySelector('#jobTypeFilter');
    if (typeFilter) {
        typeFilter.value = '';
    }
    JobFilterManager.activeFilters.type = '';
    applyJobFilters();
}


/**
 * Clear all job filters
 */
function clearAllJobFilters() {
    clearJobSearch();
    clearJobTypeFilter();
}

/**
 * Show no job results message
 */
function showNoJobResultsMessage(show) {
    let noResultsMsg = document.getElementById('noJobResultsMessage');
    
    if (show && !noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.id = 'noJobResultsMessage';
        noResultsMsg.className = 'text-center text-muted py-4';
        noResultsMsg.innerHTML = `
            <i class="bi ${CONFIG.ICONS.SEARCH} display-4"></i>
            <p class="mt-3">No jobs match your filters</p>
            <button class="btn btn-sm btn-outline-secondary" onclick="clearAllJobFilters()">
                <i class="bi ${CONFIG.ICONS.X_CIRCLE}"></i> Clear all filters
            </button>
        `;
        
        const jobsTable = safeQuerySelector('.table-responsive');
        if (jobsTable) {
            jobsTable.appendChild(noResultsMsg);
        }
    } else if (!show && noResultsMsg) {
        noResultsMsg.remove();
    }
}

/**
 * Refresh scheduled jobs
 */
function refreshScheduledJobs() {
    // Reload the page to refresh scheduled jobs data
    location.reload();
}

/**
 * Initialize scheduler functionality
 */
function initializeScheduler() {
    debugLog('SCHEDULER', 'Initializing scheduler functionality...');
    
    initializeTimeDisplay();
    initializeScheduleInfoIcons();
    initializeJobFilters();
    
    debugLog('SCHEDULER', 'Scheduler functionality initialized successfully');
}

// Export functions for global access
window.triggerJob = triggerJob;
window.initializeScheduler = initializeScheduler;
window.refreshScheduledJobs = refreshScheduledJobs;
window.clearJobSearch = clearJobSearch;
window.clearJobTypeFilter = clearJobTypeFilter;
window.clearAllJobFilters = clearAllJobFilters;
