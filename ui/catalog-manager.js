// Catalog Manager - Field Catalog System
import { StorageService } from '../services/storage-service.js';
import { PolygonValidator } from '../core/polygon-validator.js';
import { VerraCompliance } from '../core/verra-compliance.js';
import { GeoUtils } from '../utils/geo-utils.js';
import { APP_CONFIG } from '../config/app-config.js';

export class CatalogManager {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 10; // Fixed at 10 per page like original
        this.sortBy = 'newest';
        this.filterBy = 'all';
        this.searchQuery = '';
        this.selectedFieldId = null;
        this.onFieldSelectCallback = null;
    }
    
    // Set callback for field selection
    onFieldSelect(callback) {
        this.onFieldSelectCallback = callback;
    }
    
    // Render field cards to DOM
    renderFieldCards(fields) {
        const container = document.getElementById('fieldList');
        if (!container) {
            console.error('Field list container not found');
            return;
        }
        
        if (!fields || fields.length === 0) {
            container.innerHTML = '<p class="text-muted text-center">No fields found</p>';
            this.updatePaginationInfo(0, 0, 1);
            return;
        }
        
        // Calculate pagination
        const totalPages = Math.ceil(fields.length / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = Math.min(startIndex + this.itemsPerPage, fields.length);
        const pageFields = fields.slice(startIndex, endIndex);
        
        // Build HTML for field cards
        let html = '';
        
        pageFields.forEach(field => {
            const isSelected = field.ccsFieldId === this.selectedFieldId;
            const validation = field.validation || {};
            const verraCheck = field.verraCompliance || { compliant: true, issues: [] };
            
            // Determine size class
            const areaHa = validation.areaHa || 0;
            let sizeClass = 'size-normal';
            let sizeText = 'OK';
            if (areaHa < 0.2) {
                sizeClass = 'size-too-small';
                sizeText = 'XS';
            } else if (areaHa > 20) {
                sizeClass = 'size-too-large';
                sizeText = 'XL';
            }
            
            // Review status
            const reviewStatus = field.correction?.reviewStatus || 'pending';
            
            html += `
                <div class="field-card ${isSelected ? 'selected' : ''}" data-field-id="${field.ccsFieldId}">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <strong>${field.ccsFieldId}</strong><br>
                            <small class="text-muted">${field.fieldOwner || 'No owner'}</small>
                        </div>
                        <div>
                            <span class="correction-status status-${reviewStatus}">
                                ${reviewStatus.toUpperCase()}
                            </span>
                            <span class="${sizeClass} size-indicator" title="${areaHa.toFixed(3)} ha">
                                ${sizeText}
                            </span>
                            ${verraCheck.compliant ? 
                                '<span class="badge-verra-ok" title="Compliant with Verra">VERRA OK</span>' :
                                '<span class="badge-verra-issue" title="' + verraCheck.issues.join(', ') + '">VERRA ISSUE</span>'
                            }
                        </div>
                    </div>
                    <div class="mt-2">
                        <small>Vertices: ${field.originalCoordinates?.length || 0}</small> |
                        <small class="${validation.isValid ? 'validation-ok' : 'validation-critical'}">
                            ${validation.isValid ? 'Valid' : 'Invalid'}
                        </small> |
                        <small>${areaHa.toFixed(2)} ha</small>
                    </div>
                    <div class="mt-1">
                        <small class="winding-indicator winding-${validation.windingDirection || 'cw'}">
                            ${(validation.windingDirection || 'CW').toUpperCase()}
                        </small>
                    </div>
                    ${!validation.isValid ? 
                        '<div class="mt-1"><small class="validation-critical"><i class="bi bi-exclamation-triangle"></i> Self-intersections</small></div>' : 
                        ''}
                    ${validation.enhancedIssues?.warnings?.length > 0 ? 
                        `<div class="mt-1"><small class="validation-warning">Warnings: ${validation.enhancedIssues.warnings.length}</small></div>` : 
                        ''}
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        // Add click listeners to cards
        container.querySelectorAll('.field-card').forEach(card => {
            card.addEventListener('click', () => {
                const fieldId = card.dataset.fieldId;
                this.selectField(fieldId);
            });
        });
        
        // Update pagination info
        this.updatePaginationInfo(fields.length, totalPages, this.currentPage);
        this.updatePaginationButtons(totalPages);
        
        console.log(`✅ Rendered ${pageFields.length} field cards (page ${this.currentPage} of ${totalPages})`);
    }
    
    // Select a field
    selectField(fieldId) {
        this.selectedFieldId = fieldId;
        
        // Update card styling
        document.querySelectorAll('.field-card').forEach(card => {
            if (card.dataset.fieldId === fieldId) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });
        
        // Trigger callback
        if (this.onFieldSelectCallback) {
            const field = StorageService.getField(fieldId);
            this.onFieldSelectCallback(field);
        }
        
        console.log(`Selected field: ${fieldId}`);
    }
    
    // Update pagination info display
    updatePaginationInfo(totalFields, totalPages, currentPage) {
        const fieldCountEl = document.getElementById('fieldCount');
        const filteredCountEl = document.getElementById('filteredCount');
        const currentPageEl = document.getElementById('currentPage');
        const totalPagesEl = document.getElementById('totalPages');
        
        const allFields = StorageService.getAllFields().length;
        
        if (fieldCountEl) fieldCountEl.textContent = allFields;
        if (filteredCountEl) filteredCountEl.textContent = totalFields;
        if (currentPageEl) currentPageEl.textContent = currentPage;
        if (totalPagesEl) totalPagesEl.textContent = totalPages || 1;
    }
    
    // Update pagination button states
    updatePaginationButtons(totalPages) {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
    }
    
    // Navigate to page
    goToPage(page) {
        const fields = this.getFilteredFields();
        const totalPages = Math.ceil(fields.length / this.itemsPerPage);
        
        if (page < 1) page = 1;
        if (page > totalPages) page = totalPages;
        
        this.currentPage = page;
        this.renderFieldCards(fields);
    }
    
    // Get filtered fields
    getFilteredFields() {
        let fields = StorageService.getAllFields();
        
        // Apply search
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            fields = fields.filter(field => 
                field.ccsFieldId.toLowerCase().includes(query) ||
                (field.fieldOwner && field.fieldOwner.toLowerCase().includes(query))
            );
        }
        
        // Apply any active filters
        // (This will be extended based on filter checkboxes)
        
        return fields;
    }
    
    // Generate catalog
    generateCatalog() {
        const fields = StorageService.getAllFields();
        
        const catalog = fields.map(field => {
            const coords = field.correctedCoordinates || field.originalCoordinates;
            
            return {
                ...field,
                validation: field.validation || PolygonValidator.validate(field.originalCoordinates),
                correctionValidation: field.correctedCoordinates ? 
                    PolygonValidator.validate(field.correctedCoordinates) : null,
                verraCompliance: VerraCompliance.check(coords, field)
            };
        });
        
        return catalog;
    }
    
    // Get paginated catalog
    getPaginatedCatalog() {
        let catalog = this.generateCatalog();
        
        // Apply search
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            catalog = catalog.filter(field => 
                field.ccsFieldId.toLowerCase().includes(query) ||
                (field.fieldOwner && field.fieldOwner.toLowerCase().includes(query))
            );
        }
        
        // Apply filter
        catalog = this.applyFilter(catalog);
        
        // Apply sort
        catalog = this.applySort(catalog);
        
        // Calculate pagination
        const totalItems = catalog.length;
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const items = catalog.slice(startIndex, endIndex);
        
        return {
            items,
            currentPage: this.currentPage,
            totalPages,
            totalItems,
            itemsPerPage: this.itemsPerPage
        };
    }
    
    // Apply filter
    applyFilter(catalog) {
        switch (this.filterBy) {
            case 'corrected':
                return catalog.filter(f => f.correction?.applied);
            case 'pending':
                return catalog.filter(f => f.correction?.reviewStatus === 'pending' || !f.correction?.reviewStatus);
            case 'self_intersect':
                return catalog.filter(f => f.validation?.metrics?.hasSelfIntersection);
            case 'verra_issues':
                return catalog.filter(f => !f.verraCompliance?.compliant);
            case 'approved':
                return catalog.filter(f => f.correction?.reviewStatus === 'approved');
            default:
                return catalog;
        }
    }
    
    // Apply sort
    applySort(catalog) {
        switch (this.sortBy) {
            case 'newest':
                return catalog.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
            case 'oldest':
                return catalog.sort((a, b) => new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt));
            case 'area_large':
                return catalog.sort((a, b) => (b.validation?.areaHa || 0) - (a.validation?.areaHa || 0));
            case 'area_small':
                return catalog.sort((a, b) => (a.validation?.areaHa || 0) - (b.validation?.areaHa || 0));
            case 'issues':
                return catalog.sort((a, b) => {
                    const issuesA = (a.validation?.errors?.length || 0) + (a.verraCompliance?.issues?.length || 0);
                    const issuesB = (b.validation?.errors?.length || 0) + (b.verraCompliance?.issues?.length || 0);
                    return issuesB - issuesA;
                });
            default:
                return catalog;
        }
    }
    
    // Render catalog grid
    renderGrid(container, items) {
        if (!container) return;
        
        if (items.length === 0) {
            container.innerHTML = '<p class="text-center py-5">No fields match your criteria</p>';
            return;
        }
        
        let html = '<div class="row g-3">';
        
        items.forEach(field => {
            const coords = field.correctedCoordinates || field.originalCoordinates;
            const validation = field.validation || {};
            const verraCompliance = field.verraCompliance || {};
            
            html += '<div class="col-md-4">';
            html += '<div class="card h-100">';
            html += '<div class="card-body">';
            
            // Header
            html += `<h6 class="card-title">${field.ccsFieldId}</h6>`;
            html += `<p class="text-muted small mb-2">${field.fieldOwner || 'No owner'}</p>`;
            
            // Metrics
            html += '<div class="mb-2">';
            html += `<small><strong>Area:</strong> ${validation.areaHa?.toFixed(2) || 'N/A'} ha</small><br>`;
            html += `<small><strong>Vertices:</strong> ${coords?.length || 0}</small>`;
            html += '</div>';
            
            // Badges
            html += '<div class="d-flex gap-1 flex-wrap">';
            html += `<span class="badge ${validation.isValid ? 'bg-success' : 'bg-danger'}">`;
            html += validation.isValid ? 'Valid' : 'Invalid';
            html += '</span>';
            
            if (field.correction?.applied) {
                html += '<span class="badge bg-info">Corrected</span>';
            }
            
            html += `<span class="badge ${verraCompliance.compliant ? 'bg-success' : 'bg-warning'}">`;
            html += `Verra: ${verraCompliance.score || 0}`;
            html += '</span>';
            html += '</div>';
            
            // Actions
            html += '<div class="mt-3">';
            html += `<button class="btn btn-sm btn-outline-primary" onclick="app.viewField('${field.ccsFieldId}')">`;
            html += '<i class="bi bi-eye"></i> View';
            html += '</button>';
            html += '</div>';
            
            html += '</div></div></div>';
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // Get catalog statistics
    getStatistics() {
        const catalog = this.generateCatalog();
        
        return {
            total: catalog.length,
            valid: catalog.filter(f => f.validation?.isValid).length,
            corrected: catalog.filter(f => f.correction?.applied).length,
            verraCompliant: catalog.filter(f => f.verraCompliance?.compliant).length,
            selfIntersecting: catalog.filter(f => f.validation?.metrics?.hasSelfIntersection).length,
            avgArea: catalog.reduce((sum, f) => sum + (f.validation?.areaHa || 0), 0) / (catalog.length || 1)
        };
    }
    
    // Update settings
    setItemsPerPage(count) {
        this.itemsPerPage = count;
        this.currentPage = 1;
    }
    
    setSortBy(sortBy) {
        this.sortBy = sortBy;
        this.currentPage = 1;
    }
    
    setFilterBy(filterBy) {
        this.filterBy = filterBy;
        this.currentPage = 1;
    }
    
    setSearchQuery(query) {
        this.searchQuery = query;
        this.currentPage = 1;
    }
    
    nextPage() {
        this.currentPage++;
    }
    
    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }
    
    goToPage(page) {
        this.currentPage = page;
    }

    /**
     * Create HTML for a single field card (matching original HTML style)
     */
    createFieldCard(field) {
        const sizeClass = `size-${field.validation.sizeCategory.replace('_', '-')}`;
        const sizeText = field.validation.sizeCategory === 'too_small' ? 'XS' : 
                       field.validation.sizeCategory === 'too_large' ? 'XL' : 'OK';
        
        const verraCheck = VerraCompliance.check(
            field.correctedCoordinates || field.originalCoordinates, 
            field
        );
        
        const card = document.createElement('div');
        card.className = `field-card`;
        card.dataset.fieldId = field.ccsFieldId;
        
        card.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>${field.ccsFieldId}</strong><br>
                    <small class="text-muted">${field.fieldOwner || 'Unknown'}</small>
                </div>
                <div>
                    <span class="correction-status status-${field.correction?.reviewStatus || 'pending'}">
                        ${(field.correction?.reviewStatus || 'pending').toUpperCase()}
                    </span>
                    <span class="${sizeClass} size-indicator" title="${field.validation.areaHa.toFixed(3)} ha">
                        ${sizeText}
                    </span>
                    ${verraCheck.compliant ? 
                        `<span class="badge-verra-ok" style="margin-left: 5px;" title="Compliant with Verra">VERRA OK</span>` : 
                        `<span class="badge-verra-issue" style="margin-left: 5px;" title="${verraCheck.issues.join(', ')}">VERRA ISSUE</span>`
                    }
                </div>
            </div>
            <div class="mt-2">
                <small>Vertices: ${field.originalCoordinates.length}</small> | 
                <small class="${field.validation.isValid ? 'validation-ok' : 'validation-critical'}">
                    ${field.validation.isValid ? 'Valid' : 'Invalid'}
                </small> |
                <small>${field.validation.areaHa.toFixed(2)} ha</small>
            </div>
            <div class="mt-1">
                <small class="winding-indicator winding-${field.validation.windingDirection}">
                    ${field.validation.windingDirection.toUpperCase()}
                </small>
            </div>
            ${!field.validation.isValid ? 
                `<div class="mt-1"><small class="validation-critical"><i class="bi bi-exclamation-triangle"></i> SELF-INTERSECTIONS</small></div>` : ''}
            ${field.validation.enhancedIssues && field.validation.enhancedIssues.warnings.length > 0 ? 
                `<div class="mt-1"><small class="validation-warning">Warnings: ${field.validation.enhancedIssues.warnings.length}</small></div>` : ''}
        `;
        
        return card;
    }
    
    /**
     * Update field list display with pagination (matching original HTML)
     */
    updateFieldList(fields, currentPage = 1) {
        console.log(`Updating field list: ${fields.length} fields, page ${currentPage}`);
        
        const fieldListContainer = document.getElementById('field-list');
        const fieldCountEl = document.getElementById('field-count');
        const filteredCountEl = document.getElementById('filtered-count');
        const currentPageEl = document.getElementById('current-page');
        const totalPagesEl = document.getElementById('total-pages');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (!fieldListContainer) {
            console.warn('Field list container not found');
            return;
        }
        
        // Update counts
        const totalFields = StorageService.getAllFields().length;
        if (fieldCountEl) fieldCountEl.textContent = totalFields;
        if (filteredCountEl) filteredCountEl.textContent = fields.length;
        
        // Calculate pagination
        const fieldsPerPage = 10;
        const totalPages = Math.ceil(fields.length / fieldsPerPage);
        const startIndex = (currentPage - 1) * fieldsPerPage;
        const endIndex = Math.min(startIndex + fieldsPerPage, fields.length);
        const currentPageFields = fields.slice(startIndex, endIndex);
        
        // Update pagination info
        if (currentPageEl) currentPageEl.textContent = currentPage;
        if (totalPagesEl) totalPagesEl.textContent = totalPages || 1;
        
        // Clear and populate field list
        fieldListContainer.innerHTML = '';
        
        if (currentPageFields.length === 0) {
            fieldListContainer.innerHTML = '<p class="text-muted" style="padding: 20px; text-align: center;">No fields found</p>';
        } else {
            currentPageFields.forEach(field => {
                const card = this.createFieldCard(field);
                
                // Add click handler
                card.addEventListener('click', () => {
                    this.selectFieldCard(field.ccsFieldId);
                });
                
                fieldListContainer.appendChild(card);
            });
        }
        
        // Update pagination buttons
        if (prevBtn) {
            prevBtn.disabled = currentPage <= 1;
        }
        if (nextBtn) {
            nextBtn.disabled = currentPage >= totalPages;
        }
        
        // Store current page
        this.currentPage = currentPage;
        
        console.log(`✅ Field list updated: showing ${currentPageFields.length} of ${fields.length} fields (page ${currentPage}/${totalPages})`);
    }
    
    /**
     * Select a field card and trigger app to zoom to it
     */
    selectFieldCard(fieldId) {
        console.log(`Field card selected: ${fieldId}`);
        
        // Highlight selected card
        document.querySelectorAll('.field-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        const selectedCard = document.querySelector(`.field-card[data-field-id="${fieldId}"]`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }
        
        // Dispatch event for app to handle
        document.dispatchEvent(new CustomEvent('fieldSelected', { 
            detail: { fieldId } 
        }));
    }
    
    /**
     * Go to next page
     */
    nextPage() {
        const fields = StorageService.getAllFields();
        const totalPages = Math.ceil(fields.length / 10);
        
        if (this.currentPage < totalPages) {
            this.updateFieldList(fields, this.currentPage + 1);
        }
    }
    
    /**
     * Go to previous page
     */
    previousPage() {
        const fields = StorageService.getAllFields();
        
        if (this.currentPage > 1) {
            this.updateFieldList(fields, this.currentPage - 1);
        }
    }
}
