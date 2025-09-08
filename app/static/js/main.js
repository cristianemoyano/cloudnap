/**
 * CloudNap Main Application
 * Main entry point and initialization
 */

/**
 * Initialize the entire application
 */
function initializeApp() {
    debugLog('APP', 'Initializing CloudNap application...');
    
    try {
        // Initialize core functionality
        initializeClusterManagement();
        initializeScheduler();
        initializeFilters();
        initializeScrollIndicators();
        initializeDebugTools();
        
        // Initialize timezone conversion and tooltips
        initializeTimezoneConversion();
        initializeTooltips();
        
        debugLog('APP', '✅ CloudNap application initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize CloudNap application:', error);
    }
}

/**
 * Initialize scroll indicators functionality
 */
function initializeScrollIndicators() {
    setTimeout(() => {
        const container = document.querySelector('.clusters-container');
        if (container) {
            // Initial check
            updateScrollIndicators();
            
            // Update on scroll
            container.addEventListener('scroll', throttle(updateScrollIndicators, 100));
            
            // Update on window resize
            window.addEventListener('resize', throttle(updateScrollIndicators, 100));
            
            // Update when filters change
            const originalApplyFilters = window.applyFilters;
            if (originalApplyFilters) {
                window.applyFilters = function() {
                    originalApplyFilters();
                    setTimeout(updateScrollIndicators, CONFIG.SCROLL_UPDATE_DELAY);
                };
            }
        }
    }, CONFIG.FILTER_INIT_DELAY);
}

/**
 * Update scroll indicators
 */
function updateScrollIndicators() {
    const container = document.querySelector('.clusters-container');
    if (!container) return;
    
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Remove existing classes
    container.classList.remove('scrollable-top', 'scrollable-bottom');
    
    // Add appropriate classes
    if (scrollTop > 0) {
        container.classList.add('scrollable-top');
    }
    
    if (scrollTop < scrollHeight - clientHeight - 1) {
        container.classList.add('scrollable-bottom');
    }
}

/**
 * Initialize debug tools
 */
function initializeDebugTools() {
    // Utility function to check cache stats (for debugging)
    window.getCacheStats = function() {
        fetch(CONFIG.ENDPOINTS.CACHE_STATS)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    debugLog('CACHE', 'Cache Statistics:', data.data);
                    return data.data;
                } else {
                    debugLog('CACHE', 'Failed to get cache stats:', data.error);
                }
            })
            .catch(error => {
                debugLog('CACHE', 'Error getting cache stats:', error);
            });
    };

    // Utility function to clear cache (for debugging)
    window.clearCache = function() {
        fetch(CONFIG.ENDPOINTS.CACHE_CLEAR, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    debugLog('CACHE', 'Cache cleared successfully');
                    loadClusterStatuses(true); // Force refresh after clearing
                } else {
                    debugLog('CACHE', 'Failed to clear cache:', data.error);
                }
            })
            .catch(error => {
                debugLog('CACHE', 'Error clearing cache:', error);
            });
    };

    // Test function for notifications (for debugging)
    window.testNotifications = function() {
        debugLog('DEBUG', 'Testing notifications...');
        showToast(CONFIG.TOAST_TYPES.SUCCESS, 'This is a test success notification');
        setTimeout(() => {
            showToast(CONFIG.TOAST_TYPES.ERROR, 'This is a test error notification');
        }, 2000);
    };
    
    // Test function for filters (for debugging)
    window.testFilters = function() {
        setTimeout(() => {
            testFilters();
        }, CONFIG.FILTER_TEST_DELAY);
    };
}

/**
 * Initialize filters when page loads
 */
function initializeFiltersWithDelay() {
    setTimeout(() => {
        initializeFilters();
        
        // Test filters after initialization
        setTimeout(() => {
            testFilters();
        }, CONFIG.FILTER_TEST_DELAY);
    }, CONFIG.FILTER_INIT_DELAY);
}

/**
 * Handle page visibility changes
 */
function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
        debugLog('APP', 'Page became visible, refreshing data...');
        // Optionally refresh data when page becomes visible
        // loadClusterStatuses(false);
    } else {
        debugLog('APP', 'Page became hidden');
    }
}

/**
 * Handle page unload
 */
function handlePageUnload() {
    debugLog('APP', 'Page unloading, cleaning up...');
    // Clean up any active timers or connections if needed
}

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Page visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Page unload
    window.addEventListener('beforeunload', handlePageUnload);
    
    // Window resize
    window.addEventListener('resize', throttle(() => {
        updateScrollIndicators();
    }, 250));
}

/**
 * Main initialization when DOM is ready
 */
document.addEventListener('DOMContentLoaded', function() {
    debugLog('APP', 'DOM Content Loaded, starting initialization...');
    
    // Set global timezone variable
    window.timezone = document.querySelector('meta[name="timezone"]')?.content || 'UTC';
    
    // Initialize event listeners
    initializeEventListeners();
    
    // Initialize the application
    initializeApp();
    
    // Initialize filters with delay
    initializeFiltersWithDelay();
    
    debugLog('APP', 'Application startup completed');
});

/**
 * Handle errors globally
 */
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    debugLog('ERROR', 'Global error caught:', event.error);
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    debugLog('ERROR', 'Unhandled promise rejection:', event.reason);
});

// Export main initialization function
window.initializeApp = initializeApp;
