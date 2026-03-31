// UI Manager - User Interface Interactions
import { APP_CONFIG } from '../config/app-config.js';
import { StorageService } from '../services/storage-service.js';
import { ExportService } from '../services/export-service.js';

export class UIManager {
    constructor() {
        this.currentField = null;
        this.searchQuery = '';
        this.filterOptions = {
            status: 'all',
            dateFrom: null,
            dateTo: null
        };
    }
    
    // Update statistics panel
    updateStatistics(field) {
        if (!field) return;
        
        const stats = {
            fieldId: field.ccsFieldId,
            owner: field.fieldOwner || 'N/A',
            originalVertices: field.originalCoordinates?.length || 0,
            correctedVertices: field.correctedCoordinates?.length || 0,
            originalArea: field.validation?.metrics?.areaHa || field.validation?.areaHa || 0,
            originalAreaM2: field.validation?.metrics?.areaM2 || (field.validation?.areaHa * 10000) || 0,
            correctedArea: field.correctionValidation?.areaHa || 0,
            correctedAreaM2: field.correctionValidation?.metrics?.areaM2 || (field.correctionValidation?.areaHa * 10000) || 0,
            perimeter: field.validation?.metrics?.perimeterM || field.validation?.perimeterM || 0,
            isValid: field.validation?.isValid || false,
            isCorrected: field.correction?.applied || false,
            verraCompliant: field.validation?.verra?.compliant !== false, // Default to true if not checked
            verraStatus: field.validation?.verra?.overallStatus || 'UNKNOWN'
        };
        
        // Update DOM elements
        this.setElementText('fieldIdDisplay', stats.fieldId);
        this.setElementText('ownerDisplay', stats.owner);
        this.setElementText('verticesDisplay', stats.originalVertices);
        
        // Show BOTH m² and hectares for area
        this.setElementText('areaDisplay', `${stats.originalAreaM2.toFixed(2)} m² (${stats.originalArea.toFixed(4)} ha)`);
        this.setElementText('perimeterDisplay', `${stats.perimeter.toFixed(2)} m`);
        
        // Update status badges
        this.updateStatusBadge('validationStatus', stats.isValid);
        this.updateStatusBadge('verraStatus', stats.verraCompliant);
        
        // Update comparison if corrected
        if (stats.isCorrected) {
            this.setElementText('correctedVerticesDisplay', stats.correctedVertices);
            this.setElementText('correctedAreaDisplay', `${stats.correctedAreaM2.toFixed(2)} m² (${stats.correctedArea.toFixed(4)} ha)`);
            
            const areaChange = ((stats.correctedArea - stats.originalArea) / stats.originalArea * 100).toFixed(2);
            this.setElementText('areaChangeDisplay', `${areaChange}%`);
        }
    }
    
    // Update validation results
    updateValidationResults(validation) {
        const container = document.getElementById('validationResults');
        if (!container) return;
        
        let html = '<div class="validation-results">';
        
        // VERRA COMPLIANCE STATUS (if available)
        if (validation.verra) {
            const statusColors = {
                'PASS': 'success',
                'FIXABLE': 'warning',
                'NEEDS_MANUAL_FIX': 'danger'
            };
            const statusColor = statusColors[validation.verra.overallStatus] || 'secondary';
            
            html += `<div class="alert alert-${statusColor} mb-3">`;
            html += `<h6 class="mb-2"><i class="bi bi-shield-check"></i> VERRA COMPLIANCE</h6>`;
            html += `<strong>Status: ${validation.verra.overallStatus}</strong>`;
            
            // Show individual Verra checks
            html += '<div class="mt-2" style="font-size: 0.9em;">';
            html += `<div>${validation.verra.checks.closed.pass ? '✓' : '✗'} Closed: ${validation.verra.checks.closed.message}</div>`;
            html += `<div>${validation.verra.checks.simple.pass ? '✓' : '✗'} Simple: ${validation.verra.checks.simple.message}</div>`;
            
            // HIGHLIGHT IF MANUAL FIX REQUIRED
            if (validation.verra.requiresManualFix) {
                html += '<div class="alert alert-danger mt-2 mb-0" style="padding: 8px;">';
                html += '<strong>⚠️ MANUAL EDITING REQUIRED</strong><br>';
                html += 'Self-intersections cannot be corrected automatically.';
                html += '</div>';
            }
            
            html += `<div>${validation.verra.checks.minVertices.pass ? '✓' : '✗'} Min Vertices: ${validation.verra.checks.minVertices.message}</div>`;
            html += `<div>${validation.verra.checks.positiveArea.pass ? '✓' : '✗'} Area: ${validation.verra.checks.positiveArea.message}</div>`;
            html += '</div>';
            html += '</div>';
        }
        
        // General Validation Status
        html += `<div class="alert ${validation.isValid ? 'alert-success' : 'alert-danger'}">`;
        html += `<strong>${validation.isValid ? '✓ Valid' : '✗ Invalid'}</strong>`;
        html += '</div>';
        
        // Show metrics (including area in m²)
        if (validation.metrics) {
            html += '<div class="validation-metrics mb-3">';
            html += '<h6>Metrics:</h6>';
            html += '<table class="table table-sm table-borderless">';
            html += `<tr><td>Vertices:</td><td><strong>${validation.metrics.vertices || 0}</strong></td></tr>`;
            
            // Show BOTH m² and hectares
            if (validation.metrics.areaM2 !== undefined) {
                html += `<tr><td>Area:</td><td><strong>${validation.metrics.areaM2.toFixed(2)} m²</strong> (${validation.metrics.areaHa.toFixed(4)} ha)</td></tr>`;
            } else if (validation.metrics.areaHa !== undefined) {
                html += `<tr><td>Area:</td><td><strong>${validation.metrics.areaHa.toFixed(4)} ha</strong></td></tr>`;
            }
            
            if (validation.metrics.perimeterM) {
                html += `<tr><td>Perimeter:</td><td><strong>${validation.metrics.perimeterM.toFixed(2)} m</strong></td></tr>`;
            }
            html += '</table>';
            html += '</div>';
        }
        
        // Errors
        if (validation.errors && validation.errors.length > 0) {
            html += '<div class="validation-errors"><h6>Errors:</h6><ul>';
            validation.errors.forEach(error => {
                // Highlight critical Verra errors
                const isCritical = error.includes('VERRA CRITICAL');
                const cssClass = isCritical ? 'text-danger fw-bold' : 'text-danger';
                html += `<li class="${cssClass}">${error}</li>`;
            });
            html += '</ul></div>';
        }
        
        // Warnings
        if (validation.warnings && validation.warnings.length > 0) {
            html += '<div class="validation-warnings"><h6>Warnings:</h6><ul>';
            validation.warnings.forEach(warning => {
                html += `<li class="text-warning">${warning}</li>`;
            });
            html += '</ul></div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // Update Verra compliance panel
    updateVerraCompliance(compliance) {
        const container = document.getElementById('verraCompliance');
        if (!container) return;
        
        let html = '<div class="verra-compliance">';
        
        // Score
        html += `<div class="compliance-score mb-3">`;
        html += `<h6>Compliance Score</h6>`;
        html += `<div class="progress" style="height: 25px;">`;
        html += `<div class="progress-bar ${this.getScoreClass(compliance.score)}" `;
        html += `style="width: ${compliance.score}%">${compliance.score}/100</div>`;
        html += `</div>`;
        html += `<p class="mt-2">${compliance.assessment?.message || ''}</p>`;
        html += `</div>`;
        
        // Issues
        if (compliance.issues && compliance.issues.length > 0) {
            html += '<div class="compliance-issues"><h6>Issues:</h6><ul>';
            compliance.issues.forEach(issue => {
                html += `<li class="${issue.severity === 'critical' ? 'text-danger' : 'text-warning'}">`;
                html += `<strong>${issue.rule}:</strong> ${issue.message}`;
                html += '</li>';
            });
            html += '</ul></div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    // Show loading overlay
    showLoading(message = 'Loading...') {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-3" id="loadingMessage">${message}</p>
                    <div class="progress-container" id="loadingProgress" style="display: none; width: 400px; margin-top: 20px;">
                        <div class="progress" style="height: 25px;">
                            <div class="progress-bar progress-bar-striped progress-bar-animated" 
                                 role="progressbar" 
                                 id="loadingProgressBar" 
                                 style="width: 0%">0%</div>
                        </div>
                        <small class="text-light mt-2" id="loadingStats"></small>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            const msgEl = overlay.querySelector('#loadingMessage');
            if (msgEl) msgEl.textContent = message;
        }
        overlay.style.display = 'flex';
    }
    
    // Update loading progress
    updateLoadingProgress(percent, stats = null) {
        const progressContainer = document.getElementById('loadingProgress');
        const progressBar = document.getElementById('loadingProgressBar');
        const statsEl = document.getElementById('loadingStats');
        
        if (progressContainer) progressContainer.style.display = 'block';
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.textContent = `${percent}%`;
        }
        if (statsEl && stats) {
            statsEl.textContent = stats;
        }
    }
    
    // Hide loading overlay
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.textContent = message;
        
        // Determine background color
        let bgColor = '#3498db'; // info (blue)
        if (type === 'success') bgColor = '#27ae60'; // green
        else if (type === 'error') bgColor = '#e74c3c'; // red
        else if (type === 'warning') bgColor = '#f39c12'; // orange
        
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${bgColor};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
            max-width: 400px;
            white-space: pre-wrap;
        `;
        
        document.body.appendChild(toast);
        
        // Auto-dismiss after longer for warnings
        const duration = type === 'warning' ? 5000 : 3000;
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    // Show confirmation dialog
    showConfirmDialog(message, onConfirm, onCancel) {
        if (confirm(message)) {
            if (onConfirm) onConfirm();
        } else {
            if (onCancel) onCancel();
        }
    }
    
    // Update field list
    updateFieldList(fields) {
        const container = document.getElementById('fieldList');
        if (!container) return;
        
        if (fields.length === 0) {
            container.innerHTML = '<p class="text-muted">No fields found</p>';
            return;
        }
        
        let html = '<div class="list-group">';
        fields.forEach(field => {
            html += `<a href="#" class="list-group-item list-group-item-action" data-field-id="${field.ccsFieldId}">`;
            html += `<div class="d-flex justify-content-between align-items-start">`;
            html += `<div>`;
            html += `<h6 class="mb-1">${field.ccsFieldId}</h6>`;
            html += `<small class="text-muted">${field.fieldOwner || 'No owner'}</small>`;
            html += `</div>`;
            html += `<div>`;
            html += `<span class="badge ${field.validation?.isValid ? 'bg-success' : 'bg-danger'}">`;
            html += field.validation?.isValid ? 'Valid' : 'Invalid';
            html += `</span>`;
            html += `</div>`;
            html += `</div>`;
            html += `</a>`;
        });
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    // Helper methods
    setElementText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    }
    
    updateStatusBadge(id, isValid) {
        const element = document.getElementById(id);
        if (!element) return;
        
        element.className = `badge ${isValid ? 'bg-success' : 'bg-danger'}`;
        element.textContent = isValid ? '✓ Valid' : '✗ Invalid';
    }
    
    getScoreClass(score) {
        if (score >= 80) return 'bg-success';
        if (score >= 60) return 'bg-warning';
        return 'bg-danger';
    }
    
    // Toggle panel visibility
    togglePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    // Clear form
    clearForm(formId) {
        const form = document.getElementById(formId);
        if (form) form.reset();
    }
    
    // Set current field
    setCurrentField(field) {
        this.currentField = field;
    }
    
    getCurrentField() {
        return this.currentField;
    }
    
    /**
     * Display manual fix guidance when validation requires manual intervention
     * NEW METHOD - Doesn't modify existing functionality
     */
    static displayManualFixGuidance(validation, containerId = 'manual-fix-guidance') {
        const container = document.getElementById(containerId);
        
        if (!container) {
            console.warn('Manual fix guidance container not found');
            return;
        }
        
        // Hide if no guidance available
        if (!validation.manualFixGuidance) {
            container.style.display = 'none';
            return;
        }
        
        // Show and populate guidance
        container.style.display = 'block';
        const guidance = validation.manualFixGuidance;
        
        let html = '<div class="alert alert-warning" style="border-left: 4px solid #ffc107;">';
        html += `<h5 class="alert-heading"><i class="fas fa-tools"></i> ${guidance.title}</h5>`;
        html += `<p><strong>Issue:</strong> ${guidance.issue}<br>`;
        html += `<strong>Verra Rule:</strong> ${guidance.verraRule}</p>`;
        
        // Steps
        html += '<h6>Steps to Fix:</h6><ol style="line-height: 1.8;">';
        guidance.steps.forEach(step => {
            html += `<li>${step}</li>`;
        });
        html += '</ol>';
        
        // Tips (if available)
        if (guidance.tips && guidance.tips.length > 0) {
            html += '<h6 style="margin-top: 15px;">Tips:</h6><ul>';
            guidance.tips.forEach(tip => {
                html += `<li>${tip}</li>`;
            });
            html += '</ul>';
        }
        
        // Common causes (if available)
        if (guidance.commonCauses && guidance.commonCauses.length > 0) {
            html += '<h6 style="margin-top: 15px;">Common Causes:</h6><ul style="font-style: italic;">';
            guidance.commonCauses.forEach(cause => {
                html += `<li>${cause}</li>`;
            });
            html += '</ul>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
}
