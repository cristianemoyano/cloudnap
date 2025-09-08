/**
 * CloudNap Filters and Search
 * Handles cluster filtering, searching, and tag management
 */

/**
 * Initialize filters functionality
 */
function initializeFilters() {
    debugLog('FILTERS', 'Initializing filters...');
    
    // Collect all unique tags
    const clusterItems = safeQuerySelectorAll(CONFIG.SELECTORS.CLUSTER_ITEMS);
    debugLog('FILTERS', `Found ${clusterItems.length} cluster items`);
    
    clusterItems.forEach(item => {
        const tags = item.dataset.clusterTags.split(',').filter(tag => tag.trim() !== '');
        tags.forEach(tag => ClusterManager.allTags.add(tag));
    });
    
    debugLog('FILTERS', 'Found tags:', Array.from(ClusterManager.allTags));
    
    // Populate tag filter dropdown
    const tagFilter = safeQuerySelector(CONFIG.SELECTORS.TAG_FILTER);
    if (tagFilter) {
        ClusterManager.allTags.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag.charAt(0).toUpperCase() + tag.slice(1);
            tagFilter.appendChild(option);
        });
    }
    
    // Add event listeners
    const searchInput = safeQuerySelector(CONFIG.SELECTORS.SEARCH_INPUT);
    if (searchInput) {
        // Use debounced search for better performance
        const debouncedSearch = debounce(handleSearch, 300);
        searchInput.addEventListener('input', debouncedSearch);
        debugLog('FILTERS', 'Search input event listener added');
    }
    
    if (tagFilter) {
        tagFilter.addEventListener('change', handleTagFilter);
        debugLog('FILTERS', 'Tag filter event listener added');
    }
    
    debugLog('FILTERS', 'Filters initialized successfully');
}

/**
 * Handle search input
 */
function handleSearch(event) {
    ClusterManager.activeFilters.search = event.target.value.toLowerCase();
    applyFilters();
}

/**
 * Handle tag filter change
 */
function handleTagFilter(event) {
    ClusterManager.activeFilters.tag = event.target.value.toLowerCase();
    applyFilters();
}

/**
 * Apply filters to cluster items
 */
function applyFilters() {
    const clusterItems = safeQuerySelectorAll(CONFIG.SELECTORS.CLUSTER_ITEMS);
    let visibleCount = 0;
    
    if (CONFIG.DEBUG.SHOW_FILTER_LOGS) {
        debugLog('FILTERS', `Applying filters to ${clusterItems.length} cluster items`);
        debugLog('FILTERS', 'Active filters:', ClusterManager.activeFilters);
    }
    
    clusterItems.forEach(item => {
        const clusterName = item.dataset.clusterName;
        const clusterTags = item.dataset.clusterTags;
        
        let matchesSearch = true;
        let matchesTag = true;
        
        // Check search filter
        if (ClusterManager.activeFilters.search) {
            matchesSearch = clusterName.includes(ClusterManager.activeFilters.search);
        }
        
        // Check tag filter
        if (ClusterManager.activeFilters.tag) {
            matchesTag = clusterTags.includes(ClusterManager.activeFilters.tag);
        }
        
        // Show/hide item
        if (matchesSearch && matchesTag) {
            item.classList.remove(CONFIG.CLASSES.HIDDEN);
            item.style.display = 'block';
            visibleCount++;
        } else {
            item.classList.add(CONFIG.CLASSES.HIDDEN);
            item.style.display = 'none';
        }
    });
    
    if (CONFIG.DEBUG.SHOW_FILTER_LOGS) {
        debugLog('FILTERS', `Visible clusters after filtering: ${visibleCount}`);
    }
    
    // Update active filters display
    updateActiveFiltersDisplay();
    
    // Show message if no clusters match
    showNoResultsMessage(visibleCount === 0);
}

/**
 * Update active filters display
 */
function updateActiveFiltersDisplay() {
    const activeFiltersContainer = safeQuerySelector(CONFIG.SELECTORS.ACTIVE_FILTERS);
    if (!activeFiltersContainer) return;
    
    activeFiltersContainer.innerHTML = '';
    
    if (ClusterManager.activeFilters.search) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-primary filter-badge me-1';
        badge.innerHTML = `<i class="bi ${CONFIG.ICONS.SEARCH} me-1"></i>Search: "${ClusterManager.activeFilters.search}" <i class="bi ${CONFIG.ICONS.X_CIRCLE} ms-1" onclick="clearSearch()"></i>`;
        activeFiltersContainer.appendChild(badge);
    }
    
    if (ClusterManager.activeFilters.tag) {
        const badge = document.createElement('span');
        badge.className = 'badge bg-info filter-badge me-1';
        badge.innerHTML = `<i class="bi ${CONFIG.ICONS.TAG} me-1"></i>Tag: "${ClusterManager.activeFilters.tag}" <i class="bi ${CONFIG.ICONS.X_CIRCLE} ms-1" onclick="clearTagFilter()"></i>`;
        activeFiltersContainer.appendChild(badge);
    }
}

/**
 * Clear search filter
 */
function clearSearch() {
    const searchInput = safeQuerySelector(CONFIG.SELECTORS.SEARCH_INPUT);
    if (searchInput) {
        searchInput.value = '';
    }
    ClusterManager.activeFilters.search = '';
    applyFilters();
}

/**
 * Clear tag filter
 */
function clearTagFilter() {
    const tagFilter = safeQuerySelector(CONFIG.SELECTORS.TAG_FILTER);
    if (tagFilter) {
        tagFilter.value = '';
    }
    ClusterManager.activeFilters.tag = '';
    applyFilters();
}

/**
 * Clear all filters
 */
function clearAllFilters() {
    clearSearch();
    clearTagFilter();
}

/**
 * Show no results message
 */
function showNoResultsMessage(show) {
    let noResultsMsg = document.getElementById('noResultsMessage');
    
    if (show && !noResultsMsg) {
        noResultsMsg = document.createElement('div');
        noResultsMsg.id = 'noResultsMessage';
        noResultsMsg.className = 'text-center text-muted py-4';
        noResultsMsg.innerHTML = `
            <i class="bi ${CONFIG.ICONS.SEARCH} display-4"></i>
            <p class="mt-3">No clusters match your filters</p>
            <button class="btn btn-sm btn-outline-secondary" onclick="clearAllFilters()">
                <i class="bi ${CONFIG.ICONS.X_CIRCLE}"></i> Clear all filters
            </button>
        `;
        
        const clustersList = safeQuerySelector(CONFIG.SELECTORS.CLUSTERS_LIST);
        if (clustersList) {
            clustersList.appendChild(noResultsMsg);
        }
    } else if (!show && noResultsMsg) {
        noResultsMsg.remove();
    }
}

/**
 * Test filters functionality
 */
function testFilters() {
    debugLog('FILTERS', 'Testing filters...');
    const searchInput = safeQuerySelector(CONFIG.SELECTORS.SEARCH_INPUT);
    const tagFilter = safeQuerySelector(CONFIG.SELECTORS.TAG_FILTER);
    const clusterItems = safeQuerySelectorAll(CONFIG.SELECTORS.CLUSTER_ITEMS);
    
    debugLog('FILTERS', `Search input found: ${!!searchInput}`);
    debugLog('FILTERS', `Tag filter found: ${!!tagFilter}`);
    debugLog('FILTERS', `Cluster items found: ${clusterItems.length}`);
    
    if (searchInput && tagFilter && clusterItems.length > 0) {
        debugLog('FILTERS', '✅ Filters are properly initialized');
    } else {
        debugLog('FILTERS', '❌ Filters initialization failed');
    }
}

// Export functions for global access
window.clearSearch = clearSearch;
window.clearTagFilter = clearTagFilter;
window.clearAllFilters = clearAllFilters;
window.testFilters = testFilters;
