/**
 * Catalog State Manager
 * Preserves catalog position when navigating to field detail view
 * 
 * Features:
 * - Saves current page number
 * - Saves active filters
 * - Saves scroll position
 * - Saves grid size preference
 * - Restores state when returning to catalog
 */

class CatalogStateManager {
    constructor() {
        this.stateKey = 'catalog_navigation_state';
        this.returnUrlKey = 'catalog_return_url';
    }

    /**
     * Save current catalog state before navigating to detail view
     * Call this BEFORE navigating to field detail
     */
    saveCurrentState() {
        const state = {
            // Pagination
            currentPage: this.getCurrentPage(),
            itemsPerPage: this.getItemsPerPage(),
            
            // Filters
            statusFilter: this.getActiveStatusFilter(),
            flagTypeFilters: this.getActiveFlagTypeFilters(),
            issueFilters: this.getActiveIssueFilters(),
            sizeFilter: this.getActiveSizeFilter(),
            dateFilter: this.getActiveDateFilter(),
            searchQuery: this.getSearchQuery(),
            
            // View preferences
            viewMode: this.getViewMode(), // grid, list, or side-by-side
            gridSize: this.getGridSize(), // small, medium, large
            sortOrder: this.getSortOrder(),
            
            // Scroll position
            scrollTop: window.pageYOffset || document.documentElement.scrollTop,
            
            // Timestamp
            savedAt: new Date().toISOString()
        };

        // Save to sessionStorage (persists during browser session)
        sessionStorage.setItem(this.stateKey, JSON.stringify(state));
        
        console.log('Catalog state saved:', state);
        return state;
    }

    /**
     * Restore catalog state when returning from detail view
     * Call this when catalog page loads
     */
    restoreState() {
        const savedState = sessionStorage.getItem(this.stateKey);
        
        if (!savedState) {
            console.log('No saved state found');
            return null;
        }

        try {
            const state = JSON.parse(savedState);
            console.log('Restoring catalog state:', state);

            // Restore filters first (affects which items are shown)
            this.restoreFilters(state);
            
            // Then restore pagination (depends on filtered results)
            this.restorePagination(state);
            
            // Restore view preferences
            this.restoreViewPreferences(state);
            
            // Finally, restore scroll position (after content is rendered)
            setTimeout(() => {
                this.restoreScrollPosition(state);
            }, 100);

            return state;
        } catch (error) {
            console.error('Error restoring catalog state:', error);
            return null;
        }
    }

    /**
     * Clear saved state (call after successful restoration)
     */
    clearSavedState() {
        sessionStorage.removeItem(this.stateKey);
        console.log('Catalog state cleared');
    }

    /**
     * Check if we're returning from detail view
     * Useful for showing "Returned to previous position" message
     */
    isReturningFromDetail() {
        return sessionStorage.getItem(this.stateKey) !== null;
    }

    // ============================================
    // GETTER METHODS - Extract current state
    // ============================================

    getCurrentPage() {
        // Extract from pagination display or URL parameter
        const pageMatch = document.querySelector('.pagination-info')?.textContent.match(/Page (\d+)/);
        return pageMatch ? parseInt(pageMatch[1]) : 1;
    }

    getItemsPerPage() {
        // Extract from grid size selector
        const sizeBtn = document.querySelector('.grid-size-btn.active');
        if (sizeBtn?.textContent.includes('Small')) return 150;
        if (sizeBtn?.textContent.includes('Large')) return 75;
        return 120; // Medium (default)
    }

    getActiveStatusFilter() {
        const activeBtn = document.querySelector('[data-filter-type="status"].active');
        return activeBtn?.dataset.filterValue || 'all';
    }

    getActiveFlagTypeFilters() {
        const activeButtons = document.querySelectorAll('[data-filter-type="flag-type"].active');
        return Array.from(activeButtons).map(btn => btn.dataset.filterValue);
    }

    getActiveIssueFilters() {
        const activeButtons = document.querySelectorAll('[data-filter-type="issue"].active');
        return Array.from(activeButtons).map(btn => btn.dataset.filterValue);
    }

    getActiveSizeFilter() {
        const activeBtn = document.querySelector('[data-filter-type="size"].active');
        return activeBtn?.dataset.filterValue || 'all';
    }

    getActiveDateFilter() {
        const fromDate = document.querySelector('[name="date-from"]')?.value;
        const toDate = document.querySelector('[name="date-to"]')?.value;
        return { from: fromDate, to: toDate };
    }

    getSearchQuery() {
        return document.querySelector('[name="search"]')?.value || '';
    }

    getViewMode() {
        if (document.querySelector('[data-view="grid"]')?.classList.contains('active')) return 'grid';
        if (document.querySelector('[data-view="list"]')?.classList.contains('active')) return 'list';
        if (document.querySelector('[data-view="side-by-side"]')?.classList.contains('active')) return 'side-by-side';
        return 'grid';
    }

    getGridSize() {
        const sizeBtn = document.querySelector('.grid-size-btn.active');
        if (sizeBtn?.textContent.includes('Small')) return 'small';
        if (sizeBtn?.textContent.includes('Large')) return 'large';
        return 'medium';
    }

    getSortOrder() {
        const sortSelect = document.querySelector('[name="sort"]');
        return sortSelect?.value || 'field-id-asc';
    }

    // ============================================
    // SETTER METHODS - Restore saved state
    // ============================================

    restoreFilters(state) {
        // Status filter
        if (state.statusFilter) {
            const statusBtn = document.querySelector(`[data-filter-type="status"][data-filter-value="${state.statusFilter}"]`);
            statusBtn?.click();
        }

        // Flag type filters
        if (state.flagTypeFilters?.length) {
            state.flagTypeFilters.forEach(value => {
                const btn = document.querySelector(`[data-filter-type="flag-type"][data-filter-value="${value}"]`);
                btn?.click();
            });
        }

        // Issue filters
        if (state.issueFilters?.length) {
            state.issueFilters.forEach(value => {
                const btn = document.querySelector(`[data-filter-type="issue"][data-filter-value="${value}"]`);
                btn?.click();
            });
        }

        // Size filter
        if (state.sizeFilter) {
            const sizeBtn = document.querySelector(`[data-filter-type="size"][data-filter-value="${state.sizeFilter}"]`);
            sizeBtn?.click();
        }

        // Date filter
        if (state.dateFilter) {
            const fromInput = document.querySelector('[name="date-from"]');
            const toInput = document.querySelector('[name="date-to"]');
            if (fromInput && state.dateFilter.from) fromInput.value = state.dateFilter.from;
            if (toInput && state.dateFilter.to) toInput.value = state.dateFilter.to;
        }

        // Search query
        if (state.searchQuery) {
            const searchInput = document.querySelector('[name="search"]');
            if (searchInput) {
                searchInput.value = state.searchQuery;
                // Trigger search
                const searchEvent = new Event('input', { bubbles: true });
                searchInput.dispatchEvent(searchEvent);
            }
        }
    }

    restorePagination(state) {
        if (!state.currentPage || state.currentPage === 1) return;

        // Navigate to saved page
        this.navigateToPage(state.currentPage);
    }

    restoreViewPreferences(state) {
        // View mode
        if (state.viewMode) {
            const viewBtn = document.querySelector(`[data-view="${state.viewMode}"]`);
            viewBtn?.click();
        }

        // Grid size
        if (state.gridSize) {
            const sizeBtn = document.querySelector(`.grid-size-btn[data-size="${state.gridSize}"]`);
            sizeBtn?.click();
        }

        // Sort order
        if (state.sortOrder) {
            const sortSelect = document.querySelector('[name="sort"]');
            if (sortSelect) sortSelect.value = state.sortOrder;
        }
    }

    restoreScrollPosition(state) {
        if (state.scrollTop) {
            window.scrollTo({
                top: state.scrollTop,
                behavior: 'smooth'
            });
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    navigateToPage(pageNumber) {
        // Find pagination controls
        const pageInput = document.querySelector('[name="page-number"]');
        const goButton = document.querySelector('[data-action="go-to-page"]');

        if (pageInput && goButton) {
            pageInput.value = pageNumber;
            goButton.click();
        } else {
            // Fallback: Use direct page link if available
            const pageLink = document.querySelector(`[data-page="${pageNumber}"]`);
            pageLink?.click();
        }
    }

    /**
     * Show a notification that position was restored
     */
    showRestoredNotification(state) {
        const notification = document.createElement('div');
        notification.className = 'position-restored-notification';
        notification.innerHTML = `
            <span>↺ Returned to Page ${state.currentPage}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => notification.remove(), 3000);
    }
}

// ============================================
// USAGE EXAMPLE
// ============================================

// Initialize manager
const catalogState = new CatalogStateManager();

// WHEN OPENING FIELD DETAIL:
// Save state before navigating
function openFieldDetail(fieldId) {
    catalogState.saveCurrentState();
    // Then navigate to detail view
    window.location.href = `/field-detail.html?id=${fieldId}`;
}

// WHEN CATALOG PAGE LOADS:
// Restore state if returning from detail
document.addEventListener('DOMContentLoaded', () => {
    if (catalogState.isReturningFromDetail()) {
        const restored = catalogState.restoreState();
        
        if (restored) {
            // Show success notification
            catalogState.showRestoredNotification(restored);
            
            // Clear state after successful restoration
            setTimeout(() => catalogState.clearSavedState(), 1000);
        }
    }
});

// WHEN CLICKING "BACK TO CATALOG" BUTTON:
// Just navigate - state is already saved
document.querySelector('#back-to-catalog')?.addEventListener('click', () => {
    window.location.href = '/catalog.html';
    // State will be restored automatically on load
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CatalogStateManager;
}
