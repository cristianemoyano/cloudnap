/**
 * CloudNap Configuration Constants
 * Centralized configuration for easy maintenance and updates
 */

// Timing Configuration
const CONFIG = {
    // Auto-refresh intervals (in milliseconds)
    AUTO_REFRESH_INTERVAL: 30000,        // 30 seconds - UI auto-refresh
    CLOCK_UPDATE_INTERVAL: 1000,         // 1 second - Clock update
    // Action timeouts (in milliseconds)
    BUTTON_RESET_DELAY: 3000,            // 3 seconds - Button reset after action
    CLUSTER_STATUS_REFRESH_DELAY: 2000,  // 2 seconds - Cluster status refresh after action
    TOAST_DISPLAY_DURATION: 5000,        // 5 seconds - Toast notification duration
    
    // UI Delays (in milliseconds)
    PAGE_LOAD_DELAY: 500,                // 500ms - Initial page load delay
    LIBRARY_LOAD_DELAY: 100,             // 100ms - External library load delay
    FILTER_INIT_DELAY: 100,              // 100ms - Filter initialization delay
    FILTER_TEST_DELAY: 200,              // 200ms - Filter test delay
    SCROLL_UPDATE_DELAY: 100,            // 100ms - Scroll indicator update delay
    
    // API Endpoints
    ENDPOINTS: {
        CLUSTER_STATUS: '/api/clusters/status',
        CLUSTER_ACTION: '/api/clusters',
        CONFIG_RELOAD: '/api/config/reload',
        SCHEDULER_JOBS: '/api/scheduler/jobs',
        CACHE_STATS: '/api/cache/stats',
        CACHE_CLEAR: '/api/cache/clear'
    },
    
    // UI Selectors
    SELECTORS: {
        CLUSTER_CARDS: '.cluster-card',
        CLUSTER_ITEMS: '.cluster-item',
        CLUSTER_ACTION_BTNS: '.cluster-action-btn',
        STATUS_BADGES: '.badge',
        INSTANCE_STATUSES: '.status-loading',
        SEARCH_INPUT: '#clusterSearch',
        TAG_FILTER: '#tagFilter',
        ACTIVE_FILTERS: '#activeFilters',
        CLUSTERS_LIST: '#clustersList',
        CURRENT_TIME: '#currentTime',
        REFRESH_BTN: 'button[onclick="refreshClusters()"]',
        TOAST_CONTAINER: '#toast-container'
    },
    
    // CSS Classes
    CLASSES: {
        DISABLED: 'disabled',
        HIDDEN: 'hidden',
        SHOW: 'show',
        SPIN: 'spin',
        TEXT_PRIMARY: 'text-primary',
        STATUS_RUNNING: 'status-running',
        STATUS_STOPPED: 'status-stopped',
        STATUS_ERROR: 'status-error',
        STATUS_UNKNOWN: 'status-unknown'
    },
    
    // Bootstrap Icons
    ICONS: {
        PLAY: 'bi-play-fill',
        STOP: 'bi-stop-fill',
        REFRESH: 'bi-arrow-clockwise',
        HOURGLASS: 'bi-hourglass-split',
        CHECK_CIRCLE: 'bi-check-circle-fill',
        EXCLAMATION_TRIANGLE: 'bi-exclamation-triangle-fill',
        CIRCLE_FILL: 'bi-circle-fill',
        SUNRISE: 'bi-sunrise',
        MOON: 'bi-moon',
        CLOCK: 'bi-clock',
        SEARCH: 'bi-search',
        TAG: 'bi-tag',
        X_CIRCLE: 'bi-x-circle',
        CALENDAR: 'bi-calendar',
    },
    
    // Button States
    BUTTON_STATES: {
        LOADING: {
            START: 'Starting...',
            STOP: 'Stopping...'
        },
        SUCCESS: {
            START: 'Started!',
            STOP: 'Stopped!'
        },
        ERROR: 'Error'
    },
    
    // Status Colors
    STATUS_COLORS: {
        RUNNING: 'success',
        STOPPED: 'danger',
        ERROR: 'warning',
        UNKNOWN: 'secondary',
        LOADING: 'secondary'
    },
    
    // Toast Types
    TOAST_TYPES: {
        SUCCESS: 'success',
        ERROR: 'error'
    },
    
    // Debug Configuration
    DEBUG: {
        ENABLED: true,                   // Enable console logging
        SHOW_CACHE_STATUS: true,         // Show cache hit/miss in console
        SHOW_FILTER_LOGS: true           // Show filter operation logs
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
