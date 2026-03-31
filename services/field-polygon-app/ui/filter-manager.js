// Filter Manager - Simple, Manager-Friendly Filtering
import { StorageService } from '../services/storage-service.js';

export class FilterManager {
    
    constructor() {
        this.currentFilter = 'all'; // all, valid, invalid, fixable, manual
        this.searchFieldId = '';
        this.searchOwner = '';
        this.filteredFields = [];
        this.fieldSizeFilters = {
            xs: false,  // < 0.2 ha
            ok: false,  // 0.2 - 20 ha
            xl: false   // > 20 ha
        };
        this.manualCorrectionFilters = {
            selfIntersection: false,  // Crossing edges
            notClosed: false,         // Gap > 0.5m
            tooFewVertices: false,    // < 4 distinct vertices
            zeroArea: false,          // No area
            duplicateVertices: false  // Duplicate consecutive vertices
        };
        this.dateFilters = {
            fromDate: '',  // ISO date string (YYYY-MM-DD)
            toDate: ''     // ISO date string (YYYY-MM-DD)
        };
        this.filterDebounceTimer = null;
        this.filterDebounceDelay = 300; // 300ms delay to prevent UI freeze
    }
    
    /**
     * Apply filters and return filtered field list
     */
    applyFilters() {
        const allFields = StorageService.getAllFields();
        
        let filtered = allFields;
        
        // Apply status filter
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(field => this.matchesStatusFilter(field));
        }
        
        // Apply field size filters
        if (this.fieldSizeFilters.xs || this.fieldSizeFilters.ok || this.fieldSizeFilters.xl) {
            filtered = filtered.filter(field => this.matchesFieldSizeFilter(field));
        }
        
        // Apply manual correction type filters
        if (this.manualCorrectionFilters.selfIntersection || 
            this.manualCorrectionFilters.notClosed ||
            this.manualCorrectionFilters.tooFewVertices ||
            this.manualCorrectionFilters.zeroArea ||
            this.manualCorrectionFilters.duplicateVertices) {
            filtered = filtered.filter(field => this.matchesManualCorrectionFilter(field));
        }
        
        // Apply date filters
        if (this.dateFilters.fromDate || this.dateFilters.toDate) {
            filtered = filtered.filter(field => this.matchesDateFilter(field));
        }
        
        // Apply Field ID search
        if (this.searchFieldId && this.searchFieldId.trim() !== '') {
            const searchTerm = this.searchFieldId.trim().toLowerCase();
            filtered = filtered.filter(field => 
                field.ccsFieldId && field.ccsFieldId.toLowerCase().includes(searchTerm)
            );
        }
        
        // Apply Owner search
        if (this.searchOwner && this.searchOwner.trim() !== '') {
            const searchTerm = this.searchOwner.trim().toLowerCase();
            filtered = filtered.filter(field => 
                field.fieldOwner && field.fieldOwner.toLowerCase().includes(searchTerm)
            );
        }
        
        this.filteredFields = filtered;
        return filtered;
    }
    
    /**
     * Apply filters with debouncing to prevent UI freeze on large datasets
     */
    applyFiltersDebounced() {
        // Clear existing timer
        if (this.filterDebounceTimer) {
            clearTimeout(this.filterDebounceTimer);
        }
        
        // Show loading immediately
        const loadingOverlay = document.getElementById('filterLoadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
        
        // Set new timer
        this.filterDebounceTimer = setTimeout(() => {
            this.applyAndUpdate();
        }, this.filterDebounceDelay);
    }
    
    /**
     * Check if field matches field size filters
     */
    matchesFieldSizeFilter(field) {
        if (!field.validation || !field.validation.metrics) {
            return false;
        }
        
        const area = field.validation.metrics.areaHa || 0;
        
        // If any filter is active, field must match at least one
        const matchesXS = this.fieldSizeFilters.xs && area < 0.2;
        const matchesOK = this.fieldSizeFilters.ok && area >= 0.2 && area <= 20;
        const matchesXL = this.fieldSizeFilters.xl && area > 20;
        
        return matchesXS || matchesOK || matchesXL;
    }
    
    /**
     * Check if field matches manual correction type filters
     */
    matchesManualCorrectionFilter(field) {
        if (!field.validation || !field.validation.verra) {
            return false;
        }
        
        const verra = field.validation.verra;
        const checks = verra.checks || {};
        const errors = field.validation.errors || [];
        const warnings = field.validation.warnings || [];
        
        // Check for self-intersection
        const hasSelfIntersection = !checks.simple?.pass || 
            errors.some(e => e.toLowerCase().includes('self-intersection')) ||
            field.validation.metrics?.hasSelfIntersection;
        
        // Check for not closed
        const notClosed = !checks.closed?.pass || 
            errors.some(e => e.toLowerCase().includes('not properly closed')) ||
            warnings.some(w => w.toLowerCase().includes('not properly closed'));
        
        // Check for too few vertices
        const tooFewVertices = !checks.minVertices?.pass ||
            errors.some(e => e.toLowerCase().includes('distinct vertices'));
        
        // Check for zero/no area
        const zeroArea = !checks.positiveArea?.pass ||
            (field.validation.metrics?.areaM2 || 0) <= 1;
        
        // Check for duplicate vertices
        const hasDuplicates = warnings.some(w => w.toLowerCase().includes('duplicate'));
        
        // Match if any selected filter matches
        const matchesSelfIntersection = this.manualCorrectionFilters.selfIntersection && hasSelfIntersection;
        const matchesNotClosed = this.manualCorrectionFilters.notClosed && notClosed;
        const matchesTooFewVertices = this.manualCorrectionFilters.tooFewVertices && tooFewVertices;
        const matchesZeroArea = this.manualCorrectionFilters.zeroArea && zeroArea;
        const matchesDuplicates = this.manualCorrectionFilters.duplicateVertices && hasDuplicates;
        
        return matchesSelfIntersection || matchesNotClosed || matchesTooFewVertices || 
               matchesZeroArea || matchesDuplicates;
    }
    
    /**
     * Check if field matches date filter
     */
    matchesDateFilter(field) {
        // PRIORITY: Use polygonCreatedOn (from CSV "Created On" column) if available
        // FALLBACK: Use updatedAt or createdAt (system import dates)
        const timestamp = field.polygonCreatedOn || field.updatedAt || field.createdAt;
        
        if (!timestamp) {
            // If no timestamp, EXCLUDE from date filter
            console.log(`⚠️ Field ${field.ccsFieldId} has no timestamp, excluding from date filter`);
            return false;
        }
        
        // Parse field date (just the date part, ignore time)
        const fieldDate = timestamp.split('T')[0]; // "2026-02-06" or "2025-10-23"
        
        // DEBUG: Log first 5 fields to see what dates we're comparing
        if (!this._debugLogged || this._debugCount < 5) {
            console.log(`🔍 Field ${field.ccsFieldId}:`);
            console.log(`   - Polygon created: ${field.polygonCreatedOn || 'N/A'}`);
            console.log(`   - System imported: ${field.createdAt || 'N/A'}`);
            console.log(`   - Using timestamp: ${timestamp}`);
            console.log(`   - Field date: ${fieldDate}`);
            console.log(`   - Filter FROM: ${this.dateFilters.fromDate || 'none'}`);
            console.log(`   - Filter TO: ${this.dateFilters.toDate || 'none'}`);
            console.log(`   - Comparison: ${fieldDate} >= ${this.dateFilters.fromDate} AND ${fieldDate} <= ${this.dateFilters.toDate}`);
            
            const passesFrom = !this.dateFilters.fromDate || fieldDate >= this.dateFilters.fromDate;
            const passesTo = !this.dateFilters.toDate || fieldDate <= this.dateFilters.toDate;
            console.log(`   - Passes FROM check: ${passesFrom}`);
            console.log(`   - Passes TO check: ${passesTo}`);
            console.log(`   - RESULT: ${passesFrom && passesTo ? '✅ PASSES' : '❌ FAILS'}`);
            console.log('---');
            
            this._debugCount = (this._debugCount || 0) + 1;
            if (this._debugCount >= 5) this._debugLogged = true;
        }
        
        // Check from date
        if (this.dateFilters.fromDate && fieldDate < this.dateFilters.fromDate) {
            return false;
        }
        
        // Check to date
        if (this.dateFilters.toDate && fieldDate > this.dateFilters.toDate) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Check if field matches the current status filter
     */
    matchesStatusFilter(field) {
        // Duplicates filter
        if (this.currentFilter === 'duplicates') {
            const allFields = StorageService.getAllFields();
            const fieldIdCounts = new Map();
            allFields.forEach(f => {
                const id = f.ccsFieldId;
                fieldIdCounts.set(id, (fieldIdCounts.get(id) || 0) + 1);
            });
            return fieldIdCounts.get(field.ccsFieldId) > 1;
        }
        
        if (!field.validation) {
            // Not validated - consider as invalid
            return this.currentFilter === 'invalid';
        }
        
        // CRITICAL: Check correctionValidation first (post-correction status)
        // If correction was attempted and succeeded, use that status instead
        if (field.correctionValidation && field.correctionValidation.verra) {
            const correctionStatus = field.correctionValidation.verra.overallStatus;
            switch (this.currentFilter) {
                case 'valid':
                    return correctionStatus === 'PASS';
                    
                case 'invalid':
                    return correctionStatus !== 'PASS';
                    
                case 'fixable':
                    // Field was corrected but still fixable (shouldn't happen)
                    return correctionStatus === 'FIXABLE';
                    
                case 'manual':
                    // Field was corrected but still needs manual fix
                    return correctionStatus === 'NEEDS_MANUAL_FIX' || correctionStatus === 'FIXABLE';
                    
                default:
                    return true;
            }
        }
        
        // Use original validation status (before correction)
        const validation = field.validation;
        
        // Use Verra status if available
        if (validation.verra) {
            switch (this.currentFilter) {
                case 'valid':
                    return validation.verra.overallStatus === 'PASS';
                    
                case 'invalid':
                    return validation.verra.overallStatus !== 'PASS';
                    
                case 'fixable':
                    return validation.verra.overallStatus === 'FIXABLE';
                    
                case 'manual':
                    return validation.verra.overallStatus === 'NEEDS_MANUAL_FIX';
                    
                default:
                    return true;
            }
        } else {
            // Fallback to basic validation
            switch (this.currentFilter) {
                case 'valid':
                    return validation.isValid === true;
                    
                case 'invalid':
                    return validation.isValid === false;
                    
                case 'fixable':
                case 'manual':
                    // Can't determine without Verra validation
                    return validation.isValid === false;
                    
                default:
                    return true;
            }
        }
    }
    
    /**
     * Get counts for each filter option
     */
    getCounts() {
        const allFields = StorageService.getAllFields();
        
        console.log(`🔢 FilterManager.getCounts() called - Total fields: ${allFields.length}`);
        
        const counts = {
            all: allFields.length,
            valid: 0,
            invalid: 0,
            fixable: 0,
            manual: 0,
            duplicates: 0,
            sizeXS: 0,  // < 0.2 ha
            sizeOK: 0,  // 0.2 - 20 ha
            sizeXL: 0,  // > 20 ha
            manualSelfIntersection: 0,
            manualNotClosed: 0,
            manualTooFewVertices: 0,
            manualZeroArea: 0,
            manualDuplicateVertices: 0
        };
        
        // Count duplicates by field ID
        const fieldIdCounts = new Map();
        allFields.forEach(field => {
            const id = field.ccsFieldId;
            fieldIdCounts.set(id, (fieldIdCounts.get(id) || 0) + 1);
        });
        
        allFields.forEach(field => {
            // Count duplicates
            if (fieldIdCounts.get(field.ccsFieldId) > 1) {
                counts.duplicates++;
            }
            
            // Count by field size
            if (field.validation && field.validation.metrics) {
                const area = field.validation.metrics.areaHa || 0;
                if (area < 0.2) {
                    counts.sizeXS++;
                } else if (area <= 20) {
                    counts.sizeOK++;
                } else {
                    counts.sizeXL++;
                }
            }
            
            // Count by manual correction type
            if (field.validation && field.validation.verra) {
                const verra = field.validation.verra;
                const checks = verra.checks || {};
                const errors = field.validation.errors || [];
                const warnings = field.validation.warnings || [];
                
                // Self-intersection
                if (!checks.simple?.pass || 
                    errors.some(e => e.toLowerCase().includes('self-intersection')) ||
                    field.validation.metrics?.hasSelfIntersection) {
                    counts.manualSelfIntersection++;
                }
                
                // Not closed
                if (!checks.closed?.pass || 
                    errors.some(e => e.toLowerCase().includes('not properly closed')) ||
                    warnings.some(w => w.toLowerCase().includes('not properly closed'))) {
                    counts.manualNotClosed++;
                }
                
                // Too few vertices
                if (!checks.minVertices?.pass ||
                    errors.some(e => e.toLowerCase().includes('distinct vertices'))) {
                    counts.manualTooFewVertices++;
                }
                
                // Zero/no area
                if (!checks.positiveArea?.pass ||
                    (field.validation.metrics?.areaM2 || 0) <= 1) {
                    counts.manualZeroArea++;
                }
                
                // Duplicate vertices
                if (warnings.some(w => w.toLowerCase().includes('duplicate'))) {
                    counts.manualDuplicateVertices++;
                }
            }
            
            if (!field.validation) {
                counts.invalid++;
                return;
            }
            
            // MATCH STATISTICS DASHBOARD: Always use ORIGINAL validation status
            // This ensures left sidebar counts match right sidebar counts
            if (field.validation.verra) {
                if (field.validation.verra.overallStatus === 'PASS') {
                    counts.valid++;
                } else {
                    counts.invalid++;
                    if (field.validation.verra.overallStatus === 'FIXABLE') {
                        counts.fixable++;  // Matches StatisticsDashboard's canBeFixed count
                    } else if (field.validation.verra.overallStatus === 'NEEDS_MANUAL_FIX') {
                        counts.manual++;
                    }
                }
            } else {
                if (field.validation.isValid) {
                    counts.valid++;
                } else {
                    counts.invalid++;
                }
            }
        });
        
        console.log('🔢 Filter counts calculated:', counts);
        
        return counts;
    }
    
    /**
     * Display filter controls in UI
     */
    displayFilterControls(containerId = 'filterControls') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Filter container not found:', containerId);
            return;
        }
        
        const counts = this.getCounts();
        
        const html = `
                <!-- STATUS FILTERS -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                    <label class="form-label fw-bold" style="font-size: 11px; margin-bottom: 8px;">Show:</label>
                    
                    <div class="form-check" style="margin-bottom: 5px;">
                        <input class="form-check-input" type="radio" name="statusFilter" 
                               id="filterAll" value="all" ${this.currentFilter === 'all' ? 'checked' : ''}>
                        <label class="form-check-label" for="filterAll" style="font-size: 12px;">
                            All Fields <span class="count-badge all">${counts.all.toLocaleString()}</span>
                        </label>
                    </div>
                    
                    <div class="form-check" style="margin-bottom: 5px;">
                        <input class="form-check-input" type="radio" name="statusFilter" 
                               id="filterValid" value="valid" ${this.currentFilter === 'valid' ? 'checked' : ''}>
                        <label class="form-check-label" for="filterValid" style="font-size: 12px;">
                            ✅ Valid Only <span class="count-badge valid">${counts.valid.toLocaleString()}</span>
                        </label>
                    </div>
                    
                    <div class="form-check" style="margin-bottom: 5px;">
                        <input class="form-check-input" type="radio" name="statusFilter" 
                               id="filterInvalid" value="invalid" ${this.currentFilter === 'invalid' ? 'checked' : ''}>
                        <label class="form-check-label" for="filterInvalid" style="font-size: 12px;">
                            ❌ Invalid Only <span class="count-badge invalid">${counts.invalid.toLocaleString()}</span>
                        </label>
                    </div>
                    
                    <div class="form-check" style="margin-bottom: 5px;">
                        <input class="form-check-input" type="radio" name="statusFilter" 
                               id="filterFixable" value="fixable" ${this.currentFilter === 'fixable' ? 'checked' : ''}>
                        <label class="form-check-label" for="filterFixable" style="font-size: 12px;">
                            ✅ Auto-Corrected <span class="count-badge fixable">${counts.fixable.toLocaleString()}</span>
                        </label>
                    </div>
                    
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="statusFilter" 
                               id="filterManual" value="manual" ${this.currentFilter === 'manual' ? 'checked' : ''}>
                        <label class="form-check-label" for="filterManual" style="font-size: 12px;">
                            🔧 Needs Manual Edit <span class="count-badge manual">${counts.manual.toLocaleString()}</span>
                        </label>
                    </div>
                    
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="statusFilter" 
                               id="filterDuplicates" value="duplicates" ${this.currentFilter === 'duplicates' ? 'checked' : ''}>
                        <label class="form-check-label" for="filterDuplicates" style="font-size: 12px;">
                            📋 Duplicate Field IDs <span class="count-badge" style="background: #e3f2fd; color: #0d47a1;">${counts.duplicates.toLocaleString()}</span>
                        </label>
                    </div>
                </div>
                
                <!-- FIELD SIZE FILTERS -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                    <label class="form-label fw-bold" style="font-size: 11px; margin-bottom: 8px;">FIELD SIZE:</label>
                    
                    <div class="form-check" style="margin-bottom: 5px;">
                        <input class="form-check-input" type="checkbox" 
                               id="filterSizeXS" ${this.fieldSizeFilters.xs ? 'checked' : ''}>
                        <label class="form-check-label" for="filterSizeXS" style="font-size: 12px;">
                            XS Too Small (&lt; 0.2 ha) <span class="count-badge" style="background: #ffecb3; color: #f57c00;">${counts.sizeXS.toLocaleString()}</span>
                        </label>
                    </div>
                    
                    <div class="form-check" style="margin-bottom: 5px;">
                        <input class="form-check-input" type="checkbox" 
                               id="filterSizeOK" ${this.fieldSizeFilters.ok ? 'checked' : ''}>
                        <label class="form-check-label" for="filterSizeOK" style="font-size: 12px;">
                            OK Normal (0.2-20 ha) <span class="count-badge" style="background: #c8e6c9; color: #2e7d32;">${counts.sizeOK.toLocaleString()}</span>
                        </label>
                    </div>
                    
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" 
                               id="filterSizeXL" ${this.fieldSizeFilters.xl ? 'checked' : ''}>
                        <label class="form-check-label" for="filterSizeXL" style="font-size: 12px;">
                            XL Too Large (&gt; 20 ha) <span class="count-badge" style="background: #ffcdd2; color: #c62828;">${counts.sizeXL.toLocaleString()}</span>
                        </label>
                    </div>
                </div>
                
                <!-- ISSUE TYPE FILTERS -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                    <label class="form-label fw-bold" style="font-size: 11px; margin-bottom: 4px;">ISSUE TYPE FILTERS:</label>
                    <div style="font-size: 10px; color: #6c757d; margin-bottom: 8px; font-style: italic;">
                        Shows all fields with these issues (includes auto-corrected)
                    </div>
                    
                    <div class="form-check" style="margin-bottom: 5px;">
                        <input class="form-check-input" type="checkbox" 
                               id="filterManualSelfIntersection" ${this.manualCorrectionFilters.selfIntersection ? 'checked' : ''}>
                        <label class="form-check-label" for="filterManualSelfIntersection" style="font-size: 12px;">
                            ✗ Self-Intersections <span class="count-badge" style="background: #ffcdd2; color: #c62828;">${counts.manualSelfIntersection.toLocaleString()}</span><br>
                            <small style="color: #6c757d; font-size: 10px; margin-left: 20px;">Polygon edges cross each other</small>
                        </label>
                    </div>
                    
                    <div class="form-check" style="margin-bottom: 5px;">
                        <input class="form-check-input" type="checkbox" 
                               id="filterManualTooFewVertices" ${this.manualCorrectionFilters.tooFewVertices ? 'checked' : ''}>
                        <label class="form-check-label" for="filterManualTooFewVertices" style="font-size: 12px;">
                            ▽ Too Few Vertices <span class="count-badge" style="background: #ffe0b2; color: #e65100;">${counts.manualTooFewVertices.toLocaleString()}</span><br>
                            <small style="color: #6c757d; font-size: 10px; margin-left: 20px;">Less than 4 distinct vertices required by Verra</small>
                        </label>
                    </div>
                    
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" 
                               id="filterManualZeroArea" ${this.manualCorrectionFilters.zeroArea ? 'checked' : ''}>
                        <label class="form-check-label" for="filterManualZeroArea" style="font-size: 12px;">
                            ◻ Zero/Negative Area <span class="count-badge" style="background: #f8bbd0; color: #880e4f;">${counts.manualZeroArea.toLocaleString()}</span><br>
                            <small style="color: #6c757d; font-size: 10px; margin-left: 20px;">Area ≤ 1 m² (likely data error)</small>
                        </label>
                    </div>
                </div>
                
                <!-- SEARCH BY FIELD ID -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                    <label class="form-label fw-bold" style="font-size: 11px; margin-bottom: 6px;">Search by Field ID:</label>
                    <div class="input-group input-group-sm" style="margin-bottom: 6px;">
                        <input type="text" class="form-control" id="searchFieldId" 
                               placeholder="Enter Field ID..." 
                               value="${this.searchFieldId}"
                               style="font-size: 11px;">
                        <button class="btn btn-outline-secondary" type="button" id="clearFieldIdSearch" title="Clear search">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                    <button class="btn btn-primary btn-sm w-100" type="button" id="loadFieldById" 
                            style="font-size: 11px;"
                            title="Load first matching field from filtered results. Clear filters to search all fields.">
                        <i class="bi bi-box-arrow-in-down"></i> Load Field
                    </button>
                    <div style="font-size: 9px; color: #6c757d; margin-top: 4px; font-style: italic;">
                        Searches within filtered results
                    </div>
                </div>
                
                <!-- SEARCH BY OWNER -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                    <label class="form-label fw-bold" style="font-size: 11px; margin-bottom: 6px;">Search by Owner:</label>
                    <div class="input-group input-group-sm" style="margin-bottom: 6px;">
                        <input type="text" class="form-control" id="searchOwner" 
                               placeholder="Enter Owner..." 
                               value="${this.searchOwner}"
                               style="font-size: 11px;">
                        <button class="btn btn-outline-secondary" type="button" id="clearOwnerSearch" title="Clear search">
                            <i class="bi bi-x"></i>
                        </button>
                    </div>
                    <button class="btn btn-primary btn-sm w-100" type="button" id="loadFieldByOwner" 
                            style="font-size: 11px;"
                            title="Load first matching field from filtered results. Clear filters to search all fields.">
                        <i class="bi bi-box-arrow-in-down"></i> Load First Match
                    </button>
                    <div style="font-size: 9px; color: #6c757d; margin-top: 4px; font-style: italic;">
                        Searches within filtered results
                    </div>
                </div>
                
                <!-- DATE FILTER -->
                <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                    <label class="form-label fw-bold" style="font-size: 11px; margin-bottom: 6px;">
                        📅 FILTER BY DATE:
                    </label>
                    <div style="font-size: 10px; color: #6c757d; margin-bottom: 8px; font-style: italic;">
                        Filter by last modified date
                    </div>
                    
                    <div style="margin-bottom: 8px;">
                        <label for="dateFilterFrom" style="font-size: 11px; font-weight: 500;">From:</label>
                        <input type="date" class="form-control form-control-sm" id="dateFilterFrom" 
                               value="${this.dateFilters.fromDate}"
                               style="font-size: 11px;">
                    </div>
                    
                    <div style="margin-bottom: 8px;">
                        <label for="dateFilterTo" style="font-size: 11px; font-weight: 500;">To:</label>
                        <input type="date" class="form-control form-control-sm" id="dateFilterTo" 
                               value="${this.dateFilters.toDate}"
                               style="font-size: 11px;">
                    </div>
                    
                    ${this.dateFilters.fromDate || this.dateFilters.toDate ? `
                        <div style="background: #e3f2fd; padding: 6px; border-radius: 4px; font-size: 10px; margin-bottom: 6px;">
                            <strong>Active:</strong> 
                            ${this.dateFilters.fromDate ? `From ${this.dateFilters.fromDate}` : ''}
                            ${this.dateFilters.fromDate && this.dateFilters.toDate ? ' | ' : ''}
                            ${this.dateFilters.toDate ? `To ${this.dateFilters.toDate}` : ''}
                        </div>
                    ` : ''}
                    
                    <button class="btn btn-outline-secondary btn-sm w-100" id="clearDateFilter" 
                            style="font-size: 11px;">
                        <i class="bi bi-x-circle"></i> Clear Date Filter
                    </button>
                </div>
                
                <!-- APPLY/CLEAR BUTTONS -->
                <button class="btn btn-primary btn-sm w-100 mb-2" id="applyFiltersBtn" style="font-size: 12px;">
                    <i class="bi bi-funnel"></i> Apply Filters
                </button>
                
                <button class="btn btn-outline-secondary btn-sm w-100" id="clearFiltersBtn" style="font-size: 12px;">
                    <i class="bi bi-x-circle"></i> Clear All Filters
                </button>
                
                </div><!-- End of collapse -->
        `;
        
        container.innerHTML = html;
        
        // Add loading overlay (hidden by default)
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'filterLoadingOverlay';
        loadingOverlay.className = 'loading-overlay';
        loadingOverlay.style.display = 'none';
        loadingOverlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-overlay-text">Filtering fields...</div>
            <div class="loading-overlay-subtext" id="filterLoadingStatus">Please wait...</div>
        `;
        container.style.position = 'relative'; // For absolute positioning of overlay
        container.appendChild(loadingOverlay);
        
        // Attach event listeners
        this.attachEventListeners();
    }
    
    /**
     * Attach event listeners to filter controls
     */
    attachEventListeners() {
        // Radio buttons
        document.querySelectorAll('input[name="statusFilter"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentFilter = e.target.value;
                // Auto-apply when radio button changes
                this.applyAndUpdate();
            });
        });
        
        // Field size checkboxes
        const sizeXSCheckbox = document.getElementById('filterSizeXS');
        const sizeOKCheckbox = document.getElementById('filterSizeOK');
        const sizeXLCheckbox = document.getElementById('filterSizeXL');
        
        if (sizeXSCheckbox) {
            sizeXSCheckbox.addEventListener('change', (e) => {
                this.fieldSizeFilters.xs = e.target.checked;
                this.applyAndUpdate();
            });
        }
        
        if (sizeOKCheckbox) {
            sizeOKCheckbox.addEventListener('change', (e) => {
                this.fieldSizeFilters.ok = e.target.checked;
                this.applyAndUpdate();
            });
        }
        
        if (sizeXLCheckbox) {
            sizeXLCheckbox.addEventListener('change', (e) => {
                this.fieldSizeFilters.xl = e.target.checked;
                this.applyAndUpdate();
            });
        }
        
        // Manual correction type checkboxes
        const manualSelfIntersectionCheckbox = document.getElementById('filterManualSelfIntersection');
        const manualTooFewVerticesCheckbox = document.getElementById('filterManualTooFewVertices');
        const manualZeroAreaCheckbox = document.getElementById('filterManualZeroArea');
        
        if (manualSelfIntersectionCheckbox) {
            manualSelfIntersectionCheckbox.addEventListener('change', (e) => {
                this.manualCorrectionFilters.selfIntersection = e.target.checked;
                this.applyAndUpdate();
            });
        }
        
        if (manualTooFewVerticesCheckbox) {
            manualTooFewVerticesCheckbox.addEventListener('change', (e) => {
                this.manualCorrectionFilters.tooFewVertices = e.target.checked;
                this.applyAndUpdate();
            });
        }
        
        if (manualZeroAreaCheckbox) {
            manualZeroAreaCheckbox.addEventListener('change', (e) => {
                this.manualCorrectionFilters.zeroArea = e.target.checked;
                this.applyAndUpdate();
            });
        }
        
        // Search inputs
        const fieldIdInput = document.getElementById('searchFieldId');
        const ownerInput = document.getElementById('searchOwner');
        
        if (fieldIdInput) {
            fieldIdInput.addEventListener('input', (e) => {
                this.searchFieldId = e.target.value;
            });
            
            fieldIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyAndUpdate();
                }
            });
        }
        
        if (ownerInput) {
            ownerInput.addEventListener('input', (e) => {
                this.searchOwner = e.target.value;
            });
            
            ownerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.applyAndUpdate();
                }
            });
        }
        
        // Clear buttons
        const clearFieldIdBtn = document.getElementById('clearFieldIdSearch');
        const clearOwnerBtn = document.getElementById('clearOwnerSearch');
        
        if (clearFieldIdBtn) {
            clearFieldIdBtn.addEventListener('click', () => {
                this.searchFieldId = '';
                if (fieldIdInput) fieldIdInput.value = '';
                this.applyAndUpdate();
            });
        }
        
        if (clearOwnerBtn) {
            clearOwnerBtn.addEventListener('click', () => {
                this.searchOwner = '';
                if (ownerInput) ownerInput.value = '';
                this.applyAndUpdate();
            });
        }
        
        // Load buttons
        const loadFieldByIdBtn = document.getElementById('loadFieldById');
        const loadFieldByOwnerBtn = document.getElementById('loadFieldByOwner');
        
        if (loadFieldByIdBtn) {
            loadFieldByIdBtn.addEventListener('click', () => {
                if (!this.searchFieldId || !this.searchFieldId.trim()) {
                    alert('Please enter a Field ID to search');
                    return;
                }
                
                // Get ALL fields first to check if field exists at all
                const allFields = StorageService.getAllFields();
                const searchTerm = this.searchFieldId.trim().toLowerCase();
                const existsInAll = allFields.some(f => 
                    f.ccsFieldId && f.ccsFieldId.toLowerCase().includes(searchTerm)
                );
                
                // Apply filter to get matching fields within current filters
                const filtered = this.applyFilters();
                
                if (filtered.length === 0) {
                    // Check if field exists but is filtered out
                    if (existsInAll) {
                        const activeFilters = this.getActiveFiltersSummary();
                        let message = `Field ID "${this.searchFieldId}" exists but is excluded by active filters:\n\n`;
                        
                        if (activeFilters.length > 0) {
                            message += '• ' + activeFilters.join('\n• ');
                            message += '\n\nTip: Click "Clear All Filters" to search all fields.';
                        } else {
                            message += 'No active filters detected.';
                        }
                        
                        alert(message);
                    } else {
                        alert(`No field found with ID containing: "${this.searchFieldId}"\n\nTip: Check spelling or try a partial ID like "B0Q2F"`);
                    }
                    return;
                }
                
                // Load first matching field
                const fieldToLoad = filtered[0];
                console.log(`🔍 Loading field from ID search: ${fieldToLoad.ccsFieldId}`);
                
                // Dispatch event for app to handle
                const event = new CustomEvent('loadFieldFromSearch', {
                    detail: { field: fieldToLoad }
                });
                document.dispatchEvent(event);
            });
        }
        
        if (loadFieldByOwnerBtn) {
            loadFieldByOwnerBtn.addEventListener('click', () => {
                if (!this.searchOwner || !this.searchOwner.trim()) {
                    alert('Please enter an Owner name to search');
                    return;
                }
                
                // Get ALL fields first to check if owner exists at all
                const allFields = StorageService.getAllFields();
                const searchTerm = this.searchOwner.trim().toLowerCase();
                const existsInAll = allFields.some(f => 
                    f.fieldOwner && f.fieldOwner.toLowerCase().includes(searchTerm)
                );
                
                // Apply filter to get matching fields within current filters
                const filtered = this.applyFilters();
                
                if (filtered.length === 0) {
                    // Check if owner exists but is filtered out
                    if (existsInAll) {
                        const activeFilters = this.getActiveFiltersSummary();
                        let message = `Owner "${this.searchOwner}" exists but fields are excluded by active filters:\n\n`;
                        
                        if (activeFilters.length > 0) {
                            message += '• ' + activeFilters.join('\n• ');
                            message += '\n\nTip: Click "Clear All Filters" to search all fields.';
                        } else {
                            message += 'No active filters detected.';
                        }
                        
                        alert(message);
                    } else {
                        alert(`No fields found for owner containing: "${this.searchOwner}"\n\nTip: Check spelling or try a partial name`);
                    }
                    return;
                }
                
                // Load first matching field
                const fieldToLoad = filtered[0];
                console.log(`🔍 Loading field from owner search: ${fieldToLoad.ccsFieldId} (Owner: ${fieldToLoad.fieldOwner})`);
                
                // Dispatch event for app to handle
                const event = new CustomEvent('loadFieldFromSearch', {
                    detail: { field: fieldToLoad }
                });
                document.dispatchEvent(event);
            });
        }
        
        // Date filter inputs
        const dateFromInput = document.getElementById('dateFilterFrom');
        const dateToInput = document.getElementById('dateFilterTo');
        const clearDateBtn = document.getElementById('clearDateFilter');
        
        if (dateFromInput) {
            dateFromInput.addEventListener('change', (e) => {
                this.dateFilters.fromDate = e.target.value;
                this._debugLogged = false; // Reset debug flag to see new logs
                this._debugCount = 0;
                this.applyFiltersDebounced(); // Use debounced version for performance
            });
        }
        
        if (dateToInput) {
            dateToInput.addEventListener('change', (e) => {
                this.dateFilters.toDate = e.target.value;
                this._debugLogged = false; // Reset debug flag to see new logs
                this._debugCount = 0;
                this.applyFiltersDebounced(); // Use debounced version for performance
            });
        }
        
        if (clearDateBtn) {
            clearDateBtn.addEventListener('click', () => {
                this.dateFilters.fromDate = '';
                this.dateFilters.toDate = '';
                
                // Clear the input fields visually
                if (dateFromInput) dateFromInput.value = '';
                if (dateToInput) dateToInput.value = '';
                
                this.applyAndUpdate();
            });
        }
        
        // Apply button
        const applyBtn = document.getElementById('applyFiltersBtn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyAndUpdate();
            });
        }
        
        // Clear all button
        const clearAllBtn = document.getElementById('clearFiltersBtn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }
    }
    
    /**
     * Apply filters and update UI
     */
    applyAndUpdate() {
        console.log('🔄 Applying filters...');
        
        // Show loading overlay
        const loadingOverlay = document.getElementById('filterLoadingOverlay');
        const loadingStatus = document.getElementById('filterLoadingStatus');
        
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
        
        // Use setTimeout to let UI update (show overlay) before heavy processing
        setTimeout(() => {
            try {
                // Update status
                if (loadingStatus) loadingStatus.textContent = 'Filtering fields...';
                
                const filtered = this.applyFilters();
                
                console.log(`✅ Filter applied: ${filtered.length} fields found`);
                
                // Update status
                if (loadingStatus) loadingStatus.textContent = `Updating dropdown (${filtered.length} fields)...`;
                
                // Get active filters summary
                const activeFilters = this.getActiveFiltersSummary();
                
                // Small delay to show status update
                setTimeout(() => {
                    // Trigger custom event that UI can listen to
                    const event = new CustomEvent('filtersApplied', {
                        detail: {
                            filtered: filtered,
                            count: filtered.length,
                            filter: this.currentFilter,
                            activeFilters: activeFilters
                        }
                    });
                    document.dispatchEvent(event);
                    
                    // Show toast with results
                    const message = activeFilters.length > 0 
                        ? `Found ${filtered.length.toLocaleString()} field(s) with ${activeFilters.length} filter(s) active`
                        : `Showing all ${filtered.length.toLocaleString()} fields`;
                    this.showFilterToast(message);
                    
                    // Hide loading overlay after everything is done
                    if (loadingOverlay) {
                        loadingOverlay.style.display = 'none';
                    }
                }, 10);
                
            } catch (error) {
                console.error('Error applying filters:', error);
                // Hide loading overlay on error
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                }
            }
        }, 10); // Small delay to let overlay appear
    }
    
    /**
     * Clear all filters
     */
    /**
     * Get summary of active filters
     */
    getActiveFiltersSummary() {
        const active = [];
        
        // Status filter
        if (this.currentFilter !== 'all') {
            const labels = {
                'valid': 'Valid Only',
                'invalid': 'Invalid Only',
                'fixable': 'Auto-Corrected',
                'manual': 'Needs Manual',
                'duplicates': 'Duplicates'
            };
            active.push(labels[this.currentFilter] || this.currentFilter);
        }
        
        // Field size filters
        if (this.fieldSizeFilters.xs) active.push('Size: XS');
        if (this.fieldSizeFilters.ok) active.push('Size: OK');
        if (this.fieldSizeFilters.xl) active.push('Size: XL');
        
        // Manual correction type filters
        if (this.manualCorrectionFilters.selfIntersection) active.push('Self-Intersections');
        if (this.manualCorrectionFilters.tooFewVertices) active.push('Too Few Vertices');
        if (this.manualCorrectionFilters.zeroArea) active.push('Zero Area');
        
        // Search filters
        if (this.searchFieldId) active.push(`ID: "${this.searchFieldId}"`);
        if (this.searchOwner) active.push(`Owner: "${this.searchOwner}"`);
        
        // Date filters
        if (this.dateFilters.fromDate && this.dateFilters.toDate) {
            active.push(`Date: ${this.dateFilters.fromDate} to ${this.dateFilters.toDate}`);
        } else if (this.dateFilters.fromDate) {
            active.push(`Date: From ${this.dateFilters.fromDate}`);
        } else if (this.dateFilters.toDate) {
            active.push(`Date: To ${this.dateFilters.toDate}`);
        }
        
        return active;
    }
    
    clearAllFilters() {
        this.currentFilter = 'all';
        this.searchFieldId = '';
        this.searchOwner = '';
        this.fieldSizeFilters = {
            xs: false,
            ok: false,
            xl: false
        };
        this.manualCorrectionFilters = {
            selfIntersection: false,
            notClosed: false,
            tooFewVertices: false,
            zeroArea: false,
            duplicateVertices: false
        };
        this.dateFilters = {
            fromDate: '',
            toDate: ''
        };
        
        // Re-display filter controls
        this.displayFilterControls();
        
        // Apply and update
        this.applyAndUpdate();
    }
    
    /**
     * Show toast notification
     */
    showFilterToast(message) {
        // Simple toast - can be enhanced
        const toastContainer = document.getElementById('toastContainer');
        if (toastContainer) {
            const toast = document.createElement('div');
            toast.className = 'toast align-items-center text-white bg-primary border-0';
            toast.setAttribute('role', 'alert');
            toast.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            `;
            toastContainer.appendChild(toast);
            
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
            
            setTimeout(() => toast.remove(), 3000);
        }
    }
}
