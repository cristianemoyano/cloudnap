/**
 * CloudNap Utility Functions
 * Common utility functions used across the application
 */

/**
 * Debug logging utility
 */
function debugLog(category, message, data = null) {
    if (CONFIG.DEBUG.ENABLED) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${category}] ${message}`;
        
        if (data) {
            console.log(logMessage, data);
        } else {
            console.log(logMessage);
        }
    }
}

/**
 * Show toast notification
 */
function showToast(type, message) {
    debugLog('TOAST', `Showing ${type} toast: ${message}`);
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');
    
    const icon = type === CONFIG.TOAST_TYPES.SUCCESS ? 
        CONFIG.ICONS.CHECK_CIRCLE : CONFIG.ICONS.EXCLAMATION_TRIANGLE;
    
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi ${icon} me-2"></i>
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    
    // Add to toast container or create one
    let toastContainer = document.getElementById(CONFIG.SELECTORS.TOAST_CONTAINER.replace('#', ''));
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = CONFIG.SELECTORS.TOAST_CONTAINER.replace('#', '');
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '1055';
        document.body.appendChild(toastContainer);
        debugLog('TOAST', 'Created toast container');
    }
    
    toastContainer.appendChild(toast);
    debugLog('TOAST', 'Toast element added to container');
    
    // Check if Bootstrap is available
    if (typeof bootstrap === 'undefined') {
        console.error('Bootstrap is not loaded!');
        // Fallback: show a simple alert
        alert(`${type.toUpperCase()}: ${message}`);
        return;
    }
    
    try {
        // Initialize and show toast
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: CONFIG.TOAST_DISPLAY_DURATION
        });
        bsToast.show();
        debugLog('TOAST', 'Toast shown successfully');
        
        // Remove toast element after it's hidden
        toast.addEventListener('hidden.bs.toast', () => {
            debugLog('TOAST', 'Toast hidden, removing element');
            toast.remove();
        });
    } catch (error) {
        console.error('Error showing toast:', error);
        // Fallback: show a simple alert
        alert(`${type.toUpperCase()}: ${message}`);
    }
}

/**
 * Parse and display cron expression in human readable format
 */
function parseCronExpression(cronExpr) {
    // Check if cronstrue is available
    if (typeof cronstrue === 'undefined') {
        debugLog('CRON', 'cronstrue library not loaded, using fallback parser');
        return parseCronExpressionFallback(cronExpr);
    }
    
    try {
        // Use cronstrue library for professional cron parsing (English only for now)
        return cronstrue.toString(cronExpr, {
            throwExceptionOnParseError: false,
            use24HourTimeFormat: false,
            locale: 'en'
        });
    } catch (error) {
        debugLog('CRON', `Failed to parse cron expression with cronstrue: ${cronExpr}`, error);
        return parseCronExpressionFallback(cronExpr);
    }
}

/**
 * Fallback parser for when cronstrue is not available
 */
function parseCronExpressionFallback(cronExpr) {
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return cronExpr;
    
    const [minute, hour, day, month, dayOfWeek] = parts;
    let description = '';
    
    // Parse time
    if (minute === '0' && hour !== '*') {
        const hourInt = parseInt(hour);
        if (hourInt === 0) {
            description += 'At midnight (12:00 AM)';
        } else if (hourInt < 12) {
            description += `At ${hourInt}:00 AM`;
        } else if (hourInt === 12) {
            description += 'At noon (12:00 PM)';
        } else {
            description += `At ${hourInt - 12}:00 PM`;
        }
    } else if (minute !== '*' && hour !== '*') {
        const hourInt = parseInt(hour);
        if (hourInt === 0) {
            description += `At 12:${minute.padStart(2, '0')} AM`;
        } else if (hourInt < 12) {
            description += `At ${hourInt}:${minute.padStart(2, '0')} AM`;
        } else if (hourInt === 12) {
            description += `At 12:${minute.padStart(2, '0')} PM`;
        } else {
            description += `At ${hourInt - 12}:${minute.padStart(2, '0')} PM`;
        }
    } else {
        description += 'At specified time';
    }
    
    // Parse day of week
    if (dayOfWeek === '1-5') {
        description += ' on weekdays (Monday to Friday)';
    } else if (dayOfWeek === '0' || dayOfWeek === '7') {
        description += ' on Sundays';
    } else if (dayOfWeek === '1') {
        description += ' on Mondays';
    } else if (dayOfWeek === '6') {
        description += ' on Saturdays';
    } else if (dayOfWeek === '0,6') {
        description += ' on weekends (Saturday and Sunday)';
    } else if (dayOfWeek !== '*') {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        description += ` on ${dayNames[parseInt(dayOfWeek)] || `day ${dayOfWeek}`}`;
    }
    
    return description || cronExpr;
}

/**
 * Update current time display
 */
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString('en-US', {
        timeZone: window.timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    
    const currentTimeElement = document.querySelector(CONFIG.SELECTORS.CURRENT_TIME);
    if (currentTimeElement) {
        currentTimeElement.textContent = timeString;
    }
}

/**
 * Debounce function to limit function calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function to limit function calls
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Safe query selector with error handling
 */
function safeQuerySelector(selector) {
    try {
        return document.querySelector(selector);
    } catch (error) {
        debugLog('DOM', `Error querying selector: ${selector}`, error);
        return null;
    }
}

/**
 * Safe query selector all with error handling
 */
function safeQuerySelectorAll(selector) {
    try {
        return document.querySelectorAll(selector);
    } catch (error) {
        debugLog('DOM', `Error querying selector all: ${selector}`, error);
        return [];
    }
}

/**
 * Check if element is visible in viewport
 */
function isElementInViewport(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format duration in milliseconds to human readable format
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Generate unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Deep clone object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
}

/**
 * Initialize timezone conversion for scheduled jobs
 */
function initializeTimezoneConversion() {
    const nextRunElements = document.querySelectorAll('.next-run-time');
    
    nextRunElements.forEach(function(element) {
        const originalTime = element.getAttribute('data-utc-time');
        if (originalTime) {
            try {
                // Parse the time (it already includes timezone offset)
                const date = new Date(originalTime);
                
                // Get timezone info
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const localTime = date.toLocaleString('en-US', {
                    timeZone: timezone,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                
                // Format original time for display (remove timezone offset for cleaner look)
                const originalTimeFormatted = originalTime.replace(/[+-]\d{2}:\d{2}$/, '');
                
                // Update tooltip with local time
                element.setAttribute('title', `Local time (${timezone}): ${localTime}`);
                
                // Add click handler to toggle between original time and local time
                element.style.cursor = 'pointer';
                element.addEventListener('click', function() {
                    if (element.getAttribute('data-showing-local') === 'true') {
                        // Show original time (without timezone offset for cleaner display)
                        element.textContent = originalTimeFormatted;
                        element.setAttribute('title', `Click to see local time (${timezone})`);
                        element.setAttribute('data-showing-local', 'false');
                    } else {
                        // Show local time
                        element.textContent = localTime;
                        element.setAttribute('title', `Click to see original time`);
                        element.setAttribute('data-showing-local', 'true');
                    }
                });
            } catch (error) {
                console.error('Error parsing time:', originalTime, error);
            }
        }
    });
}

/**
 * Initialize Bootstrap tooltips
 */
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Make functions available globally
window.initializeTimezoneConversion = initializeTimezoneConversion;
window.initializeTooltips = initializeTooltips;
