/**
 * CloudNap Scheduler and Cron Management
 * Handles scheduled jobs, cron expressions, and time display
 */

// Global variables for scheduler
// Language is fixed to English

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
 * Initialize scheduler functionality
 */
function initializeScheduler() {
    debugLog('SCHEDULER', 'Initializing scheduler functionality...');
    
    initializeTimeDisplay();
    initializeScheduleInfoIcons();
    
    debugLog('SCHEDULER', 'Scheduler functionality initialized successfully');
}

// Export functions for global access
window.triggerJob = triggerJob;
window.initializeScheduler = initializeScheduler;
