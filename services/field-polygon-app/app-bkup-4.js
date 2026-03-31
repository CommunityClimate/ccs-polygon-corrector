// Main Application - Initializes and coordinates all modules
import { APP_CONFIG } from './config/app-config.js';
import { MapManager } from './core/map-manager.js';
import { PolygonValidator } from './core/polygon-validator.js';
import { PolygonCorrector } from './core/polygon-corrector.js';
import { VerraCompliance } from './core/verra-compliance.js';
import { ManualEditor } from './core/manual-editor.js';
import { StorageService } from './services/storage-service.js';
import { ExportService } from './services/export-service.js';
import { UIManager } from './ui/ui-manager.js';
import { CatalogManager } from './ui/catalog-manager.js';
import { StatisticsDashboard } from './ui/statistics-dashboard.js';
import { FilterManager } from './ui/filter-manager.js';
import { LegendManager } from './ui/legend-manager.js';
import { GeoUtils } from './utils/geo-utils.js';

class FieldPolygonApp {
    constructor() {
        this.mapManager = null;
        this.legendManager = null;
        this.manualEditor = null;
        this.uiManager = new UIManager();
        this.catalogManager = new CatalogManager();
        this.filterManager = new FilterManager();
        this.currentField = null;
        this.filteredFields = null; // Track currently filtered fields for export
    }
    
    // Initialize application
    async initialize() {
        console.log(`${APP_CONFIG.APP_NAME} v${APP_CONFIG.VERSION}`);
        
        try {
            // Initialize map
            this.mapManager = new MapManager('map');
            this.mapManager.initialize();
            
            // Initialize legend manager
            this.legendManager = new LegendManager(this.mapManager);
            
            // Initialize manual editor
            this.manualEditor = new ManualEditor(this.mapManager);
            
            // Initialize manager-friendly dashboard
            this.initializeDashboard();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Load initial data
            this.loadStoredFields();
            
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.uiManager.showToast('Error initializing application', 'error');
        }
    }
    
    // Initialize dashboard and filters
    initializeDashboard() {
        // Display initial statistics
        StatisticsDashboard.displayStatistics();
        
        // Display filter controls
        this.filterManager.displayFilterControls();
        
        // Listen for filter changes
        document.addEventListener('filtersApplied', (e) => {
            this.handleFiltersApplied(e.detail);
        });
        
        // Listen for field load from search
        document.addEventListener('loadFieldFromSearch', (e) => {
            const { field } = e.detail;
            console.log(`📥 Loading field from search: ${field.ccsFieldId}`);
            this.loadField(field);
        });
        
        // Listen for catalog request - provide data via memory
        document.addEventListener('requestFieldsForCatalog', () => {
            console.log('📊 Preparing data for Polygon Catalog (memory mode)...');
            const allFields = StorageService.getAllFields();
            console.log(`   - Loading ${allFields.length} fields into memory`);
            
            // Store in window object for catalog to access
            window.catalogData = allFields;
            console.log('   ✅ Data loaded successfully (memory mode - no localStorage quota limits)');
        });
        
        // Listen for map layer switching
        document.addEventListener('switchMapLayer', (e) => {
            const { layerType } = e.detail;
            console.log(`🗺️ Switching map to ${layerType} layer...`);
            this.mapManager.switchBaseLayer(layerType);
        });
        
        // Listen for window focus - check if catalog sent us a field to load
        window.addEventListener('focus', () => {
            const selectedFieldId = localStorage.getItem('selectedFieldId');
            if (selectedFieldId) {
                console.log(`📥 Auto-loading field from catalog: ${selectedFieldId}`);
                
                // Clear the stored ID
                localStorage.removeItem('selectedFieldId');
                
                // Find and load the field
                const allFields = StorageService.getAllFields();
                const field = allFields.find(f => f.ccsFieldId === selectedFieldId);
                
                if (field) {
                    console.log(`   ✅ Found field, loading...`);
                    this.loadField(field);
                } else {
                    console.warn(`   ⚠️ Field not found: ${selectedFieldId}`);
                    this.uiManager.showToast(`Field ${selectedFieldId} not found`, 'warning');
                }
            }
        });
    }
    
    // Setup all event listeners
    setupEventListeners() {
        // File input
        document.getElementById('fileInput')?.addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Load field button
        document.getElementById('loadFieldBtn')?.addEventListener('click', () => this.loadSelectedField());
        
        // Validate button
        document.getElementById('validateBtn')?.addEventListener('click', () => this.validateCurrentField());
        
        // Correct button
        document.getElementById('correctBtn')?.addEventListener('click', () => this.correctCurrentField());
        
        // Process All button (BATCH)
        document.getElementById('processAllBtn')?.addEventListener('click', () => this.processAllFields());
        
        // Auto-Correction Report button (INTERNAL USE)
        document.getElementById('autoCorrectionReportBtn')?.addEventListener('click', () => ExportService.exportAutoCorrectionReport());
        
        // Export buttons
        document.getElementById('exportGeoJSONBtn')?.addEventListener('click', () => ExportService.exportGeoJSON(this.filteredFields));
        document.getElementById('exportKMLBtn')?.addEventListener('click', () => ExportService.exportKML(this.filteredFields));
        document.getElementById('exportCSVBtn')?.addEventListener('click', () => ExportService.exportCSV(this.filteredFields));
        
        // Clear button
        document.getElementById('clearBtn')?.addEventListener('click', () => this.clearMap());
        
        // Manual editing buttons
        document.getElementById('enableEditBtn')?.addEventListener('click', () => this.enableManualEditMode());
        document.getElementById('addVertexBtn')?.addEventListener('click', () => this.toggleAddVertexMode());
        document.getElementById('removeVertexBtn')?.addEventListener('click', () => this.toggleRemoveVertexMode());
        document.getElementById('saveChangesBtn')?.addEventListener('click', () => this.saveManualEdits());
        document.getElementById('cancelEditBtn')?.addEventListener('click', () => this.cancelManualEditMode());
        
        // Map legend toggle button
        document.getElementById('toggleMapLegend')?.addEventListener('click', () => {
            this.legendManager.toggle();
        });
    }
    
    // Handle file upload
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        console.log('=== FILE UPLOAD STARTED ===');
        console.log('File name:', file.name);
        console.log('File size:', (file.size / 1024).toFixed(2), 'KB');
        console.log('File type:', file.type);
        
        this.uiManager.showLoading('Reading file...');
        
        try {
            // Progress callback for large CSV imports
            const onProgress = (percent, successCount, errorCount, emptyCount) => {
                console.log(`Import progress: ${percent}% - Success: ${successCount}, Errors: ${errorCount}, Empty: ${emptyCount}`);
                this.uiManager.updateLoadingProgress(
                    percent,
                    `Imported: ${successCount} | Errors: ${errorCount} | Empty: ${emptyCount}`
                );
            };
            
            console.log('Calling ExportService.importFromFile...');
            const result = await ExportService.importFromFile(file, onProgress);
            
            console.log('Import result:', result);
            
            if (result.success) {
                let message = `✅ Import Complete!\n\n`;
                message += `• Successfully imported: ${result.count} field(s)\n`;
                
                // Show info if some rows had errors
                if (result.errors && result.errors > 0) {
                    message += `• Errors/Invalid: ${result.errors} row(s)\n`;
                }
                
                if (result.empty && result.empty > 0) {
                    message += `• Empty GeoJSON: ${result.empty} row(s)\n`;
                }
                
                if (result.total) {
                    message += `• Total rows processed: ${result.total}`;
                }
                
                console.log('Import successful:', message);
                
                console.log('Calling loadStoredFields...');
                this.loadStoredFields();
                
                // Show detailed import summary
                const actualCount = StorageService.getAllFields().length;
                const failedStats = StorageService.getFailedRecordsStats();
                
                let summaryMessage = `
✅ Import Complete!

IMPORT SUMMARY:
• Total CSV rows: ${result.total || 0}
• Successfully parsed: ${result.count || 0} field(s) with valid polygons
• Total saved in system: ${actualCount} field(s) (includes failures)`;

                // Add failed records breakdown if any exist
                if (failedStats.total > 0) {
                    summaryMessage += `\n\n⚠️ PARSE FAILURES: ${failedStats.total} record(s)`;
                    Object.entries(failedStats.byType).forEach(([type, count]) => {
                        const typeLabel = type.replace(/_/g, ' ');
                        summaryMessage += `\n   • ${typeLabel}: ${count}`;
                    });
                    summaryMessage += `\n\n💡 Filter by "Parse Failed" to view failed records`;
                }
                
                summaryMessage = summaryMessage.trim();
                
                console.log(summaryMessage);
                
                // Determine message type
                const messageType = result.errors > 0 || result.empty > 0 ? 'warning' : 'success';
                this.uiManager.showToast(summaryMessage, messageType);
                
                console.log('Updating statistics dashboard...');
                StatisticsDashboard.displayStatistics();
                
                console.log('Calling displayAllFieldsOnMap...');
                // Display all fields on map immediately
                this.displayAllFieldsOnMap();
                
                console.log('=== FILE UPLOAD COMPLETE ===');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('=== FILE UPLOAD ERROR ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            this.uiManager.showToast(`Import failed: ${error.message}`, 'error');
            console.error('Import error:', error);
        } finally {
            this.uiManager.hideLoading();
        }
    }
    
    // Load stored fields into list
    loadStoredFields() {
        const fields = StorageService.getAllFields();
        console.log(`Loading ${fields.length} fields into UI...`);
        
        // Populate simple dropdown
        this.populateFieldDropdown(fields);
        
        // Refresh statistics dashboard
        StatisticsDashboard.displayStatistics();
        
        console.log(`✅ UI updated with ${fields.length} fields`);
    }
    
    // Populate the field dropdown (SIMPLE for managers)
    populateFieldDropdown(fields) {
        const dropdown = document.getElementById('fieldSelect');
        if (!dropdown) {
            console.warn('⚠️ Field dropdown not found');
            return;
        }
        
        console.log(`Populating dropdown with ${fields.length} fields...`);
        
        // Clear existing options
        dropdown.innerHTML = '<option value="">Choose a field...</option>';
        
        // PERFORMANCE: Use DocumentFragment for batch DOM operations (much faster!)
        const fragment = document.createDocumentFragment();
        
        fields.forEach(field => {
            const option = document.createElement('option');
            option.value = field.ccsFieldId;
            option.textContent = `${field.ccsFieldId}${field.fieldOwner ? ' - ' + field.fieldOwner : ''}`;
            fragment.appendChild(option);
        });
        
        // Single DOM append instead of 22,533 individual appends!
        dropdown.appendChild(fragment);
        
        console.log(`✅ Dropdown populated with ${fields.length} options`);
    }
    
    // Handle filter changes
    handleFiltersApplied(detail) {
        const { filtered, count, filter, activeFilters } = detail;
        
        // Store filtered fields for export
        this.filteredFields = filtered;
        
        // Update dropdown with filtered fields
        this.populateFieldDropdown(filtered);
        
        // Update export button labels to show filtered count
        this.updateExportButtonLabels(count, filter, activeFilters);
        
        // Log active filters for debugging
        if (activeFilters && activeFilters.length > 0) {
            console.log(`✅ Active filters (${activeFilters.length}):`, activeFilters.join(', '));
            console.log(`📊 Filtered result: ${count} of ${StorageService.getAllFields().length} fields`);
        } else {
            console.log(`📊 Showing all ${count} fields (no filters active)`);
        }
    }
    
    // Update export button labels to show filtered/all mode
    updateExportButtonLabels(filteredCount, filterType, activeFilters = []) {
        const geojsonBtn = document.getElementById('exportGeoJSONBtn');
        const kmlBtn = document.getElementById('exportKMLBtn');
        const csvBtn = document.getElementById('exportCSVBtn');
        
        const totalFields = StorageService.getAllFields().length;
        
        // Check if ANY filters are active (not just status filter)
        if (activeFilters.length === 0 && filteredCount === totalFields) {
            // Truly showing all fields - no filters of any type active
            if (geojsonBtn) geojsonBtn.innerHTML = '<i class="bi bi-download"></i> Export GeoJSON (All)';
            if (kmlBtn) kmlBtn.innerHTML = '<i class="bi bi-download"></i> Export KML (All)';
            if (csvBtn) csvBtn.innerHTML = '<i class="bi bi-download"></i> Export CSV (All)';
            this.filteredFields = null; // Clear filter for export
        } else {
            // Exporting filtered fields
            const percentage = ((filteredCount / totalFields) * 100).toFixed(1);
            const filterLabel = `${filteredCount.toLocaleString()} filtered`;
            
            if (geojsonBtn) {
                geojsonBtn.innerHTML = `<i class="bi bi-download"></i> Export GeoJSON (${filterLabel})`;
                geojsonBtn.title = `Export ${filteredCount} of ${totalFields} fields (${percentage}%)`;
            }
            if (kmlBtn) {
                kmlBtn.innerHTML = `<i class="bi bi-download"></i> Export KML (${filterLabel})`;
                kmlBtn.title = `Export ${filteredCount} of ${totalFields} fields (${percentage}%)`;
            }
            if (csvBtn) {
                csvBtn.innerHTML = `<i class="bi bi-download"></i> Export CSV (${filterLabel})`;
                csvBtn.title = `Export ${filteredCount} of ${totalFields} fields (${percentage}%)`;
            }
            
            console.log(`✅ Export buttons updated: ${filteredCount} fields (${percentage}% of total)`);
        }
    }
    
    // Load selected field from list
    loadSelectedField() {
        const fieldId = document.getElementById('fieldSelect')?.value;
        if (!fieldId) {
            this.uiManager.showToast('Please select a field', 'error');
            return;
        }
        
        const field = StorageService.getField(fieldId);
        if (field) {
            this.loadField(field);
        }
    }
    
    // Load field data
    loadField(field) {
        this.currentField = field;
        this.uiManager.setCurrentField(field);
        
        // Hide map status message
        const mapStatus = document.getElementById('mapStatusMessage');
        if (mapStatus) mapStatus.style.display = 'none';
        
        // Show single field action buttons
        const singleFieldActions = document.getElementById('singleFieldActions');
        if (singleFieldActions) {
            singleFieldActions.style.display = 'block';
        }
        
        // Draw on map with popup
        this.mapManager.clearAll();
        this.mapManager.drawOriginal(field.originalCoordinates, { field: field });
        
        if (field.correctedCoordinates) {
            this.mapManager.drawCorrected(field.correctedCoordinates, { field: field });
        }
        
        // Draw vertices and vertex numbers for the loaded field
        this.mapManager.drawFieldVertices(field, true);
        
        // Update UI
        this.uiManager.updateStatistics(field);
        
        // Show validation if exists
        if (field.validation) {
            this.uiManager.updateValidationResults(field.validation);
            
            // Show plain English explanations
            this.displayPlainEnglishExplanations(field);
        } else {
            // Hide explanation sections if not validated
            this.hidePlainEnglishExplanations();
        }
        
        // Show Verra compliance if exists
        if (field.verraCompliance) {
            this.uiManager.updateVerraCompliance(field.verraCompliance);
        }
    }
    
    /**
     * Handle field selection from card click
     */
    handleFieldSelected(fieldId) {
        console.log(`Field selected: ${fieldId}`);
        
        const field = StorageService.getField(fieldId);
        if (!field) {
            console.error(`Field not found: ${fieldId}`);
            return;
        }
        
        // Store as current field
        this.currentField = field;
        
        // Zoom map to field
        this.mapManager.zoomToField(field);
        
        // Update field details panel
        this.updateFieldDetails(field);
        
        // Show success toast
        this.uiManager.showToast(`Field loaded: ${fieldId}`, 'info');
    }
    
    /**
     * Update field details panel
     */
    updateFieldDetails(field) {
        const detailsContainer = document.getElementById('fieldDetails');
        if (!detailsContainer) return;
        
        const validation = field.validation || {};
        
        detailsContainer.innerHTML = `
            <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                <strong style="font-size: 14px;">${field.ccsFieldId}</strong><br>
                <small class="text-muted">Owner: ${field.fieldOwner || 'Unknown'}</small>
            </div>
            <div style="font-size: 13px;">
                <p style="margin: 5px 0;"><strong>Vertices:</strong> ${field.originalCoordinates.length}</p>
                <p style="margin: 5px 0;"><strong>Area:</strong> ${validation.areaHa?.toFixed(2) || '0'} ha</p>
                <p style="margin: 5px 0;"><strong>Status:</strong> 
                    <span class="${validation.isValid ? 'validation-ok' : 'validation-critical'}">
                        ${validation.isValid ? 'Valid' : 'Invalid'}
                    </span>
                </p>
                <p style="margin: 5px 0;"><strong>Winding:</strong> ${validation.windingDirection?.toUpperCase() || 'Unknown'}</p>
                ${field.correctedCoordinates ? 
                    `<p style="margin: 5px 0;"><strong>Corrected:</strong> Yes (${field.correctedCoordinates.length} vertices)</p>` : 
                    ''}
            </div>
        `;
    }
    
    // Validate current field
    validateCurrentField() {
        if (!this.currentField) {
            this.uiManager.showToast('No field loaded', 'error');
            return;
        }
        
        this.uiManager.showLoading('Validating polygon...');
        
        setTimeout(() => {
            // Validate
            const validation = PolygonValidator.validate(this.currentField.originalCoordinates);
            this.currentField.validation = validation;
            
            // Check Verra compliance
            const verraCompliance = VerraCompliance.check(this.currentField.originalCoordinates, this.currentField);
            this.currentField.verraCompliance = verraCompliance;
            
            // Save
            StorageService.saveField(this.currentField);
            
            // Update UI
            this.uiManager.updateValidationResults(validation);
            this.uiManager.updateVerraCompliance(verraCompliance);
            UIManager.displayManualFixGuidance(validation, 'manual-fix-guidance');
            this.uiManager.updateStatistics(this.currentField);
            
            // Show intersection points if any
            if (validation.metrics?.selfIntersectionPoints?.length > 0) {
                this.mapManager.drawIntersectionPoints(validation.metrics.selfIntersectionPoints);
            }
            
            this.uiManager.hideLoading();
            
            const message = validation.isValid ? 
                'Validation successful - Polygon is valid!' : 
                'Validation complete - Issues found';
            this.uiManager.showToast(message, validation.isValid ? 'success' : 'error');
        }, 500);
    }
    
    // Correct current field
    correctCurrentField() {
        if (!this.currentField) {
            this.uiManager.showToast('No field loaded', 'error');
            return;
        }
        
        this.uiManager.showLoading('Correcting polygon...');
        
        setTimeout(() => {
            // Correct
            const correctionResult = PolygonCorrector.autoCorrect(this.currentField.originalCoordinates);
            
            if (correctionResult.success) {
                this.currentField.correctedCoordinates = correctionResult.corrected;
                this.currentField.correction = {
                    applied: true,
                    timestamp: new Date().toISOString(),
                    strategy: correctionResult.strategy,
                    steps: correctionResult.steps,
                    iterations: correctionResult.iterations
                };
                
                // Validate corrected version
                this.currentField.correctionValidation = PolygonValidator.validate(correctionResult.corrected);
                
                // Draw corrected polygon
                this.mapManager.drawCorrected(correctionResult.corrected);
                
                // Save
                StorageService.saveField(this.currentField);
                
                // Update UI
                this.uiManager.updateStatistics(this.currentField);
                
                this.uiManager.showToast('Correction successful!', 'success');
            } else {
                this.uiManager.showToast('Correction failed - manual intervention needed', 'error');
            }
            
            this.uiManager.hideLoading();
        }, 1000);
    }
    
    // Clear map
    clearMap() {
        this.mapManager.clearAll();
        this.currentField = null;
        this.uiManager.setCurrentField(null);
        this.uiManager.showToast('Map cleared', 'info');
    }
    
    // Toggle catalog view
    toggleCatalog() {
        const catalogContainer = document.getElementById('catalogContainer');
        const mainContainer = document.getElementById('mainContainer');
        
        if (catalogContainer.style.display === 'none') {
            // Show catalog
            this.renderCatalog();
            catalogContainer.style.display = 'block';
            mainContainer.style.display = 'none';
        } else {
            // Hide catalog
            catalogContainer.style.display = 'none';
            mainContainer.style.display = 'grid';
        }
    }
    
    // Render catalog
    renderCatalog() {
        const result = this.catalogManager.getPaginatedCatalog();
        const container = document.getElementById('catalogContent');
        
        this.catalogManager.renderGrid(container, result.items);
        
        // Update pagination
        const pageInfo = document.getElementById('catalogPageInfo');
        if (pageInfo) {
            pageInfo.textContent = `Page ${result.currentPage} of ${result.totalPages} (${result.totalItems} fields)`;
        }
        
        // Update stats
        const stats = this.catalogManager.getStatistics();
        const statsEl = document.getElementById('catalogStats');
        if (statsEl) {
            statsEl.textContent = `Total: ${stats.total} | Valid: ${stats.valid} | Corrected: ${stats.corrected}`;
        }
    }
    
    // View field from catalog
    viewField(fieldId) {
        const field = StorageService.getField(fieldId);
        if (field) {
            this.toggleCatalog(); // Close catalog
            this.loadField(field);
        }
    }
    
    // Handle search
    handleSearch(query) {
        this.catalogManager.setSearchQuery(query);
        this.renderCatalog();
    }
    
    // Handle date search
    handleDateSearch() {
        const startDate = document.getElementById('dateFrom')?.value;
        const endDate = document.getElementById('dateTo')?.value;
        
        if (startDate && endDate) {
            const fields = StorageService.filterByDateRange(startDate, endDate);
            this.uiManager.updateFieldList(fields);
            this.uiManager.showToast(`Found ${fields.length} field(s) in date range`, 'info');
        }
    }
    
    // Display plain English explanations (Manager-Friendly)
    displayPlainEnglishExplanations(field) {
        if (!field.validation) return;
        
        const isValid = field.validation.verra 
            ? field.validation.verra.overallStatus === 'PASS' 
            : field.validation.isValid;
        
        if (isValid) {
            // Hide explanation sections for valid fields
            this.hidePlainEnglishExplanations();
            return;
        }
        
        // Show "WHY INVALID" section
        const whySection = document.getElementById('whyInvalidSection');
        const whyList = document.getElementById('whyInvalidList');
        
        if (whySection && whyList) {
            const reasons = StatisticsDashboard.getInvalidReason(field);
            whyList.innerHTML = reasons.map(r => `<li>${r}</li>`).join('');
            whySection.style.display = 'block';
        }
        
        // Show "HOW TO FIX" section
        const howSection = document.getElementById('howToFixSection');
        const howList = document.getElementById('howToFixList');
        
        if (howSection && howList) {
            const instructions = StatisticsDashboard.getFixInstructions(field);
            howList.innerHTML = instructions.map(i => `<li>${i}</li>`).join('');
            howSection.style.display = 'block';
        }
    }
    
    // Hide plain English explanation sections
    hidePlainEnglishExplanations() {
        const whySection = document.getElementById('whyInvalidSection');
        const howSection = document.getElementById('howToFixSection');
        
        if (whySection) whySection.style.display = 'none';
        if (howSection) howSection.style.display = 'none';
    }
    
    // === MANUAL EDITING METHODS ===
    
    /**
     * Enable manual edit mode
     */
    enableManualEditMode() {
        if (!this.currentField) {
            this.uiManager.showToast('Please load a field first', 'error');
            return;
        }
        
        if (!this.currentField.originalCoordinates) {
            this.uiManager.showToast('No coordinates to edit', 'error');
            return;
        }
        
        // Enable edit mode with current coordinates
        this.manualEditor.enableEditMode(this.currentField.originalCoordinates);
        
        // Update UI
        this.toggleEditModeUI(true);
        
        this.uiManager.showToast('Edit mode enabled - Drag the numbered dots to adjust', 'info');
    }
    
    /**
     * Save manual edits
     */
    saveManualEdits() {
        if (!this.manualEditor.isInEditMode()) {
            this.uiManager.showToast('Not in edit mode', 'error');
            return;
        }
        
        // Get edited coordinates
        const editedCoords = this.manualEditor.saveEdits();
        
        if (!editedCoords) {
            this.uiManager.showToast('No edits to save', 'error');
            return;
        }
        
        // Save to current field as corrected coordinates
        this.currentField.correctedCoordinates = editedCoords;
        this.currentField.correction = {
            applied: true,
            method: 'manual_edit',
            timestamp: new Date().toISOString()
        };
        
        // Validate the edited polygon
        const validation = PolygonValidator.validate(editedCoords);
        this.currentField.correctionValidation = validation;
        
        // Save to storage
        StorageService.saveField(this.currentField);
        
        // Disable edit mode
        this.cancelManualEditMode();
        
        // Reload field to show results
        this.loadField(this.currentField);
        
        // Validate to check if fixes worked
        this.validateCurrentField();
        
        this.uiManager.showToast('✅ Manual edits saved successfully!', 'success');
        
        // Refresh statistics
        StatisticsDashboard.displayStatistics();
    }
    
    /**
     * Reset manual edits to original
     */
    resetManualEdits() {
        if (!this.manualEditor.isInEditMode()) {
            this.uiManager.showToast('Not in edit mode', 'error');
            return;
        }
        
        if (confirm('Reset all changes and return to original polygon?')) {
            this.manualEditor.resetEdits();
            this.uiManager.showToast('Reset to original coordinates', 'info');
            
            // Clear change log
            this.updateChangeLog();
        }
    }
    
    /**
     * Cancel manual edit mode without saving
     */
    cancelManualEditMode() {
        if (!this.manualEditor.isInEditMode()) {
            return;
        }
        
        // Disable edit mode
        this.manualEditor.disableEditMode();
        
        // Update UI
        this.toggleEditModeUI(false);
        
        // Reload current field to restore display
        if (this.currentField) {
            this.loadField(this.currentField);
        }
        
        this.uiManager.showToast('Edit mode cancelled', 'info');
    }
    
    /**
     * Toggle add vertex mode
     */
    toggleAddVertexMode() {
        if (!this.manualEditor.isInEditMode()) {
            this.uiManager.showToast('Not in edit mode', 'error');
            return;
        }
        
        if (this.manualEditor.addVertexMode) {
            // Disable add mode
            this.manualEditor.disableAddVertexMode();
            this.updateModeIndicator('drag');
            this.uiManager.showToast('Add vertex mode disabled - drag mode restored', 'info');
        } else {
            // Enable add mode
            if (this.manualEditor.enableAddVertexMode()) {
                this.updateModeIndicator('add');
                this.uiManager.showToast('Add vertex mode - click on polygon edges (+ symbols)', 'info');
            }
        }
        
        // Update change log
        this.updateChangeLog();
    }
    
    /**
     * Toggle remove vertex mode
     */
    toggleRemoveVertexMode() {
        if (!this.manualEditor.isInEditMode()) {
            this.uiManager.showToast('Not in edit mode', 'error');
            return;
        }
        
        if (this.manualEditor.removeVertexMode) {
            // Disable remove mode
            this.manualEditor.disableRemoveVertexMode();
            this.updateModeIndicator('drag');
            this.uiManager.showToast('Remove vertex mode disabled - drag mode restored', 'info');
        } else {
            // Enable remove mode
            if (this.manualEditor.enableRemoveVertexMode()) {
                this.updateModeIndicator('remove');
                this.uiManager.showToast('Remove vertex mode - click on vertices (✕ symbols) to delete', 'info');
            }
        }
        
        // Update change log
        this.updateChangeLog();
    }
    
    /**
     * Update mode indicator display
     */
    updateModeIndicator(mode) {
        const indicator = document.getElementById('editModeIndicator');
        const modeText = document.getElementById('modeText');
        const addBtn = document.getElementById('addVertexBtn');
        const removeBtn = document.getElementById('removeVertexBtn');
        
        if (!indicator || !modeText) return;
        
        indicator.style.display = 'block';
        
        // Remove active class from both buttons
        if (addBtn) addBtn.classList.remove('active');
        if (removeBtn) removeBtn.classList.remove('active');
        
        switch(mode) {
            case 'add':
                modeText.textContent = '➕ ADD MODE: Click + on edges to add vertices';
                indicator.className = 'alert alert-success';
                if (addBtn) addBtn.classList.add('active');
                break;
                
            case 'remove':
                modeText.textContent = '➖ REMOVE MODE: Click ✕ on vertices to delete (min 4)';
                indicator.className = 'alert alert-danger';
                if (removeBtn) removeBtn.classList.add('active');
                break;
                
            case 'drag':
            default:
                modeText.textContent = '🖱️ DRAG MODE: Drag numbered dots to move';
                indicator.className = 'alert alert-secondary';
                break;
        }
    }
    
    /**
     * Toggle edit mode UI elements
     */
    toggleEditModeUI(enabled) {
        const enableBtn = document.getElementById('enableEditBtn');
        const controls = document.getElementById('editControls');
        const changeLogSection = document.getElementById('changeLogSection');
        
        console.log(`🔄 Toggle Edit Mode UI: ${enabled ? 'ON' : 'OFF'}`);
        
        if (enableBtn) {
            enableBtn.style.display = enabled ? 'none' : 'block';
            enableBtn.disabled = enabled;
            console.log(`✅ Enable button ${enabled ? 'hidden' : 'shown'}`);
        } else {
            console.error('❌ Enable button not found (enableEditBtn)');
        }
        
        if (controls) {
            controls.style.display = enabled ? 'block' : 'none';
            console.log(`✅ Edit controls ${enabled ? 'shown' : 'hidden'}`);
        } else {
            console.error('❌ Edit controls not found (editControls)');
        }
        
        if (changeLogSection) {
            changeLogSection.style.display = enabled ? 'block' : 'none';
            
            // Update change log if enabled
            if (enabled) {
                this.updateChangeLog();
            }
        }
        
        // Initialize mode indicator to drag mode
        if (enabled) {
            this.updateModeIndicator('drag');
        } else {
            // Hide mode indicator
            const indicator = document.getElementById('editModeIndicator');
            if (indicator) indicator.style.display = 'none';
        }
        
        // Disable other action buttons during edit mode
        const actionButtons = ['validateBtn', 'correctBtn', 'loadFieldBtn'];
        actionButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.disabled = enabled;
        });
    }
    
    /**
     * Update change log display
     */
    updateChangeLog() {
        const changeLogList = document.getElementById('changeLogList');
        if (!changeLogList) return;
        
        const history = this.manualEditor.getChangeHistory();
        
        if (history.length === 0) {
            changeLogList.innerHTML = '<div class="text-muted" style="font-size: 12px;">No changes yet</div>';
            return;
        }
        
        let html = '<ul class="list-unstyled mb-0" style="font-size: 12px;">';
        history.forEach(entry => {
            html += `<li><span class="text-muted">${entry.time}:</span> ${entry.message}</li>`;
        });
        html += '</ul>';
        
        changeLogList.innerHTML = html;
    }
    
    // === BATCH PROCESSING ===
    
    /**
     * Process all fields - validate and auto-correct
     */
    async processAllFields() {
        console.log('🚀 ========================================');
        console.log('🚀 PROCESS ALL FIELDS STARTED');
        console.log('🚀 ========================================');
        
        const allFields = StorageService.getAllFields();
        console.log(`📊 Total fields to process: ${allFields.length}`);
        
        if (allFields.length === 0) {
            console.error('❌ No fields found to process');
            this.uiManager.showToast('Please import field data first', 'error');
            return;
        }
        
        if (!confirm(`Process ${allFields.length} fields?\n\n• Validate all polygons\n• Auto-correct what we can\n• Flag self-intersections for manual editing\n\nThis may take a few minutes for large datasets.`)) {
            console.log('⚠️ User cancelled processing');
            return;
        }
        
        console.log('✅ User confirmed - starting batch processing...');
        
        // Show progress section
        const progressSection = document.getElementById('batchProgressSection');
        if (progressSection) {
            console.log('✅ Progress section found - showing...');
            progressSection.style.display = 'block';
        } else {
            console.error('❌ Progress section not found in HTML!');
        }
        
        let processed = 0;
        let validated = 0;
        let autoCorrected = 0;
        let needsManual = 0;
        
        // Process in batches to avoid freezing
        const batchSize = 100; // Increased from 20 for MUCH better performance
        const totalBatches = Math.ceil(allFields.length / batchSize);
        
        console.log(`📦 Processing in ${totalBatches} batches of ${batchSize} fields each`);
        console.log(`⏱️  Estimated time: ${Math.round(totalBatches * 0.5)} seconds`);
        
        const startTime = Date.now();
        
        for (let i = 0; i < allFields.length; i += batchSize) {
            const batchNum = Math.floor(i / batchSize) + 1;
            const batch = allFields.slice(i, Math.min(i + batchSize, allFields.length));
            
            console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} fields)...`);
            
            await this.processBatch(batch, (stats) => {
                processed += stats.processed;
                validated += stats.validated;
                autoCorrected += stats.corrected;
                needsManual += stats.manual;
                
                // Update progress
                const percent = Math.round((processed / allFields.length) * 100);
                this.updateBatchProgress(percent, processed, allFields.length);
                
                // Log less frequently for performance (every 50 batches = 5,000 fields)
                if (batchNum % 50 === 0 || batchNum === totalBatches) {
                    console.log(`   ✓ Batch ${batchNum}/${totalBatches}: ${processed}/${allFields.length} (${percent}%)`);
                }
            });
            
            // Minimal delay to let UI update (reduced from 10ms to 1ms)
            await new Promise(resolve => setTimeout(resolve, 1));
        }
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(1);
        
        console.log('\n🎉 ========================================');
        console.log('🎉 BATCH PROCESSING COMPLETE!');
        console.log('🎉 ========================================');
        console.log(`⏱️  Duration: ${duration} seconds`);
        console.log(`📊 Total processed: ${processed}`);
        console.log(`✅ Valid: ${validated}`);
        console.log(`⚠️  Auto-corrected: ${autoCorrected}`);
        console.log(`🔧 Needs manual: ${needsManual}`);
        
        // Hide progress
        if (progressSection) {
            progressSection.style.display = 'none';
        }
        
        // Show results
        const message = `✅ Batch Processing Complete!\n\n` +
                       `• Total processed: ${processed}\n` +
                       `• Valid: ${validated}\n` +
                       `• Auto-corrected: ${autoCorrected}\n` +
                       `• Needs manual edit: ${needsManual}\n\n` +
                       `⏱️ Completed in ${duration} seconds`;
        
        this.uiManager.showToast(message, 'success');
        
        console.log('🔄 Refreshing statistics and catalog...');
        
        // Refresh statistics and catalog
        StatisticsDashboard.displayStatistics();
        this.loadStoredFields();
        
        // CRITICAL: Refresh filter counts after processing!
        console.log('🔄 Refreshing filter controls...');
        this.filterManager.displayFilterControls();
        
        // Refresh map to show corrected polygons
        this.displayAllFieldsOnMap();
        
        console.log('✅ All done! Statistics updated.');
    }
    
    /**
     * Process a batch of fields
     */
    async processBatch(batch, onProgress) {
        let processed = 0;
        let validated = 0;
        let corrected = 0;
        let manual = 0;
        
        const fieldsToSave = []; // Collect fields for bulk save
        
        for (const field of batch) {
            try {
                // Validate
                const validation = PolygonValidator.validate(field.originalCoordinates);
                field.validation = validation;
                
                if (validation.verra) {
                    if (validation.verra.overallStatus === 'PASS') {
                        validated++;
                    } else if (validation.verra.overallStatus === 'FIXABLE') {
                        // Try auto-correction
                        const correction = PolygonCorrector.correct(field.originalCoordinates);
                        
                        if (correction.success) {
                            field.correctedCoordinates = correction.corrected;  // FIX: was correction.correctedCoordinates
                            field.correction = {
                                applied: true,
                                method: correction.method,  // Track which correction method worked
                                shapeChangePercent: correction.shapeChangePercent || 0,  // Track shape change
                                steps: correction.steps,  // Full correction log for transparency
                                timestamp: new Date().toISOString()
                            };
                            
                            // Validate correction
                            const correctionValidation = PolygonValidator.validate(correction.corrected);  // FIX: was correction.correctedCoordinates
                            field.correctionValidation = correctionValidation;
                            
                            if (correctionValidation.verra?.overallStatus === 'PASS') {
                                corrected++;
                            } else {
                                manual++;
                            }
                        } else {
                            manual++;
                        }
                    } else if (validation.verra.overallStatus === 'NEEDS_MANUAL_FIX') {
                        manual++;
                    }
                }
                
                // Collect for bulk save (MUCH faster!)
                fieldsToSave.push(field);
                processed++;
                
            } catch (error) {
                console.error(`❌ Error processing field ${field.ccsFieldId}:`, error);
                processed++;
                manual++; // Count errors as needing manual attention
            }
        }
        
        // PERFORMANCE: Bulk update entire batch at once (MUCH faster than individual saves!)
        if (fieldsToSave.length > 0) {
            StorageService.bulkUpdateFields(fieldsToSave);
        }
        
        // Report progress
        if (onProgress) {
            onProgress({ processed, validated, corrected, manual });
        }
    }
    
    /**
     * Update batch progress UI
     */
    updateBatchProgress(percent, current, total) {
        const progressBar = document.getElementById('batchProgressBar');
        const statusText = document.getElementById('batchStatusText');
        
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.textContent = `${percent}%`;
        }
        
        if (statusText) {
            statusText.textContent = `Processing: ${current} / ${total} fields...`;
        }
    }
    
    // === MAP DISPLAY ===
    
    /**
     * Display all fields on map (using layer groups like original HTML)
     */
    displayAllFieldsOnMap() {
        console.log('=== DISPLAY ALL FIELDS ON MAP ===');
        
        const allFields = StorageService.getAllFields();
        console.log('Total fields in storage:', allFields.length);
        
        if (allFields.length === 0) {
            console.log('⚠️ No fields to display on map');
            return;
        }
        
        console.log(`Drawing ALL ${allFields.length} fields on map...`);
        
        // Hide "no field loaded" message
        const mapStatus = document.getElementById('mapStatusMessage');
        if (mapStatus) {
            mapStatus.style.display = 'none';
        }
        
        // Use MapManager's drawAllFields method
        const result = this.mapManager.drawAllFields(allFields);
        
        console.log(`✅ Map display complete:`);
        console.log(`   - Drew: ${result.drawn} polygons`);
        console.log(`   - Skipped: ${result.skipped}`);
        console.log(`   - Total: ${result.total} fields`);
        
        // Show toast notification
        this.uiManager.showToast(
            `✅ ${result.drawn} fields displayed on map!`,
            'success'
        );
    }
}

// Initialize app when DOM is ready
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new FieldPolygonApp();
    app.initialize();
    
    // Make app and services available globally for debugging
    window.app = app;
    window.StorageService = StorageService;
    console.log('✅ Debugging enabled: window.app and window.StorageService available in console');
});

export default FieldPolygonApp;
