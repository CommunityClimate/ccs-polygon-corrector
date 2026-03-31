// Progress Panel - Display session and historical progress
// VERSION: 1.0
console.log("📊 ProgressPanel loaded");

import { ProgressTracker } from '../services/progress-tracker.js';
import { StorageService } from '../services/storage-service.js';

export class ProgressPanel {
    
    constructor() {
        this.panelElement = null;
        this.updateInterval = null;
        
        // Listen for progress updates
        document.addEventListener('progressUpdate', () => {
            this.updateDisplay();
        });
    }
    
    /**
     * Create and display progress panel in right sidebar
     */
    createPanel() {
        // Find the statistics dashboard container
        let container = document.getElementById('statisticsDashboard');
        
        // If not found, try to find any panel in the right sidebar
        if (!container) {
            const panels = document.querySelectorAll('.panel');
            panels.forEach(panel => {
                const heading = panel.querySelector('h5, h6');
                if (heading && (heading.textContent.includes('Field Summary') || 
                               heading.textContent.includes('Statistics') ||
                               heading.textContent.includes('MANUAL FLAGS'))) {
                    container = panel;
                }
            });
        }
        
        // Last resort - find the right sidebar column
        if (!container) {
            container = document.querySelector('.col-md-3:last-child');
        }
        
        if (!container) {
            console.error('❌ Progress panel container not found - tried statisticsDashboard, panels, and right column');
            return;
        }
        
        console.log('✅ Progress panel container found:', container.id || container.className);
        
        // Create panel element
        this.panelElement = document.createElement('div');
        this.panelElement.id = 'progressPanel';
        this.panelElement.className = 'stat-box';
        this.panelElement.style.cssText = `
            background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
            border-left: 4px solid #43a047;
            color: #1b5e20;
            margin-top: 15px;
        `;
        
        // Insert at end of container
        container.appendChild(this.panelElement);
        
        console.log('✅ Progress panel element created and appended');
        
        // Initial display
        this.updateDisplay();
        
        // Update every minute
        this.updateInterval = setInterval(() => {
            this.updateDisplay();
        }, 60000); // 1 minute
        
        console.log('📊 Progress panel created');
    }
    
    /**
     * Update panel display
     */
    updateDisplay() {
        if (!this.panelElement) return;
        
        const session = ProgressTracker.getCurrentSession();
        const duration = ProgressTracker.getSessionDuration();
        const durationFormatted = ProgressTracker.formatDuration(duration);
        
        // Get overall stats
        const allFields = StorageService.getAllFields();
        const overall = ProgressTracker.getOverallStats(allFields);
        
        // Calculate progress percentages
        const flaggedPercent = overall.totalFields > 0 
            ? Math.round((overall.totalFlagged / overall.totalFields) * 100) 
            : 0;
        const correctedPercent = overall.totalFields > 0 
            ? Math.round((overall.totalCorrected / overall.totalFields) * 100) 
            : 0;
        
        this.panelElement.innerHTML = `
            <h6 style="font-size: 13px; margin-bottom: 12px;">
                <i class="bi bi-clock-history"></i> YOUR PROGRESS
            </h6>
            
            <!-- Session Stats -->
            <div style="background: rgba(255,255,255,0.7); padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                <div style="font-size: 11px; font-weight: 600; color: #2e7d32; margin-bottom: 6px;">TODAY'S SESSION:</div>
                <div style="font-size: 11px; line-height: 1.6;">
                    ⏱️ Duration: <strong>${durationFormatted}</strong><br>
                    🚩 Flagged: <strong>${session.flagsAdded.toLocaleString()}</strong><br>
                    ✏️ Corrected: <strong>${session.correctionsApplied.toLocaleString()}</strong><br>
                    📤 Exports: <strong>${session.exportsCount}</strong>
                </div>
            </div>
            
            <!-- Overall Progress -->
            <div style="background: rgba(255,255,255,0.7); padding: 10px; border-radius: 6px;">
                <div style="font-size: 11px; font-weight: 600; color: #2e7d32; margin-bottom: 6px;">OVERALL PROGRESS:</div>
                <div style="font-size: 11px; line-height: 1.6;">
                    🚩 Total Flagged: <strong>${overall.totalFlagged.toLocaleString()} / ${overall.totalFields.toLocaleString()}</strong> (${flaggedPercent}%)<br>
                    ✏️ Total Corrected: <strong>${overall.totalCorrected.toLocaleString()} / ${overall.totalFields.toLocaleString()}</strong> (${correctedPercent}%)
                </div>
                
                <!-- Progress Bar -->
                <div style="margin-top: 8px;">
                    <div style="font-size: 10px; color: #666; margin-bottom: 3px;">Flagging Progress:</div>
                    <div style="width: 100%; height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${flaggedPercent}%; height: 100%; background: linear-gradient(90deg, #4caf50, #43a047); transition: width 0.3s;"></div>
                    </div>
                    <div style="font-size: 9px; color: #666; text-align: right; margin-top: 2px;">${flaggedPercent}% Complete</div>
                </div>
            </div>
            
            <!-- Quick Actions -->
            <div style="margin-top: 10px; display: flex; gap: 5px;">
                <button class="btn btn-sm btn-outline-success" id="viewHistoryBtn" style="flex: 1; font-size: 10px;">
                    📊 History
                </button>
                <button class="btn btn-sm btn-outline-primary" id="exportProgressBtn" style="flex: 1; font-size: 10px;">
                    📤 Export
                </button>
            </div>
        `;
        
        // Attach event listeners
        document.getElementById('viewHistoryBtn')?.addEventListener('click', () => {
            this.showHistoryModal();
        });
        
        document.getElementById('exportProgressBtn')?.addEventListener('click', () => {
            ProgressTracker.exportProgressReport();
        });
    }
    
    /**
     * Show history modal
     */
    showHistoryModal() {
        const history = ProgressTracker.getHistory();
        const exports = ProgressTracker.getExportHistory();
        
        // Create modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 25px; border-radius: 12px; max-width: 700px; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h5 style="margin: 0;"><i class="bi bi-clock-history"></i> Work History</h5>
                    <button class="btn btn-sm btn-outline-secondary" id="closeHistoryModal">✕</button>
                </div>
                
                <!-- Work History Table -->
                <h6 style="font-size: 13px; margin-top: 15px; margin-bottom: 10px;">Daily Progress:</h6>
                <table class="table table-sm table-striped" style="font-size: 12px;">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Duration</th>
                            <th>Flagged</th>
                            <th>Corrected</th>
                            <th>Exports</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${history.length > 0 
                            ? history.map(entry => `
                                <tr>
                                    <td>${new Date(entry.date).toLocaleDateString()}</td>
                                    <td>${ProgressTracker.formatDuration(entry.duration)}</td>
                                    <td>${entry.flagsAdded.toLocaleString()}</td>
                                    <td>${entry.correctionsApplied.toLocaleString()}</td>
                                    <td>${entry.exportsCount}</td>
                                </tr>
                            `).join('')
                            : '<tr><td colspan="5" style="text-align: center; color: #999;">No history yet</td></tr>'
                        }
                    </tbody>
                </table>
                
                <!-- Export History -->
                <h6 style="font-size: 13px; margin-top: 20px; margin-bottom: 10px;">Recent Exports:</h6>
                <table class="table table-sm table-striped" style="font-size: 12px;">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Fields</th>
                            <th>Flagged</th>
                            <th>Corrected</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${exports.slice(0, 10).length > 0 
                            ? exports.slice(0, 10).map(exp => `
                                <tr>
                                    <td>${new Date(exp.timestamp).toLocaleString()}</td>
                                    <td>${exp.totalFields.toLocaleString()}</td>
                                    <td>${exp.flaggedFields.toLocaleString()}</td>
                                    <td>${exp.correctedFields.toLocaleString()}</td>
                                </tr>
                            `).join('')
                            : '<tr><td colspan="4" style="text-align: center; color: #999;">No exports yet</td></tr>'
                        }
                    </tbody>
                </table>
                
                <div style="margin-top: 20px; text-align: right;">
                    <button class="btn btn-sm btn-primary" id="exportReportBtn">
                        📥 Download Full Report
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal handlers
        document.getElementById('closeHistoryModal')?.addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('exportReportBtn')?.addEventListener('click', () => {
            ProgressTracker.exportProgressReport();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    /**
     * Destroy panel
     */
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.panelElement) {
            this.panelElement.remove();
        }
    }
}
