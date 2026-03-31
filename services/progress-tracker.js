// Progress Tracker - Session and Historical Progress Tracking
// VERSION: 1.0
console.log("📊 ProgressTracker loaded");

export class ProgressTracker {
    
    static STORAGE_KEYS = {
        SESSION: 'current_session',
        HISTORY: 'work_history',
        EXPORTS: 'export_history'
    };
    
    /**
     * Start a new session
     */
    static startSession() {
        const session = {
            startTime: new Date().toISOString(),
            fieldsReviewed: 0,
            flagsAdded: 0,
            correctionsApplied: 0,
            exportsCount: 0,
            lastActivity: new Date().toISOString()
        };
        
        localStorage.setItem(this.STORAGE_KEYS.SESSION, JSON.stringify(session));
        console.log('📊 New session started:', session);
        return session;
    }
    
    /**
     * Get current session or create new one
     */
    static getCurrentSession() {
        const stored = localStorage.getItem(this.STORAGE_KEYS.SESSION);
        if (!stored) {
            return this.startSession();
        }
        
        const session = JSON.parse(stored);
        
        // Check if session is from today
        const sessionDate = new Date(session.startTime);
        const today = new Date();
        const isToday = sessionDate.toDateString() === today.toDateString();
        
        if (!isToday) {
            // Save yesterday's session to history
            this.saveSessionToHistory(session);
            // Start new session
            return this.startSession();
        }
        
        return session;
    }
    
    /**
     * Update session statistics
     */
    static updateSession(updates) {
        const session = this.getCurrentSession();
        
        // Update fields
        if (updates.fieldsReviewed !== undefined) {
            session.fieldsReviewed += updates.fieldsReviewed;
        }
        if (updates.flagsAdded !== undefined) {
            session.flagsAdded += updates.flagsAdded;
        }
        if (updates.correctionsApplied !== undefined) {
            session.correctionsApplied += updates.correctionsApplied;
        }
        if (updates.exportsCount !== undefined) {
            session.exportsCount += updates.exportsCount;
        }
        
        session.lastActivity = new Date().toISOString();
        
        localStorage.setItem(this.STORAGE_KEYS.SESSION, JSON.stringify(session));
        
        // Trigger UI update
        this.notifyUpdate();
        
        return session;
    }
    
    /**
     * Get session duration in minutes
     */
    static getSessionDuration() {
        const session = this.getCurrentSession();
        const start = new Date(session.startTime);
        const now = new Date();
        const durationMs = now - start;
        const durationMinutes = Math.floor(durationMs / 1000 / 60);
        return durationMinutes;
    }
    
    /**
     * Format duration as "Xh Ym"
     */
    static formatDuration(minutes) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        } else {
            return `${mins}m`;
        }
    }
    
    /**
     * Save session to history
     */
    static saveSessionToHistory(session) {
        const history = this.getHistory();
        
        const entry = {
            date: new Date(session.startTime).toISOString().split('T')[0], // YYYY-MM-DD
            duration: this.getSessionDuration(),
            fieldsReviewed: session.fieldsReviewed,
            flagsAdded: session.flagsAdded,
            correctionsApplied: session.correctionsApplied,
            exportsCount: session.exportsCount
        };
        
        // Add to history (keep last 30 days)
        history.unshift(entry);
        if (history.length > 30) {
            history.pop();
        }
        
        localStorage.setItem(this.STORAGE_KEYS.HISTORY, JSON.stringify(history));
        console.log('📊 Session saved to history:', entry);
    }
    
    /**
     * Get work history
     */
    static getHistory() {
        const stored = localStorage.getItem(this.STORAGE_KEYS.HISTORY);
        return stored ? JSON.parse(stored) : [];
    }
    
    /**
     * Log an export
     */
    static logExport(details) {
        const exports = this.getExportHistory();
        
        const exportEntry = {
            timestamp: new Date().toISOString(),
            filename: details.filename || 'export.csv',
            totalFields: details.totalFields || 0,
            flaggedFields: details.flaggedFields || 0,
            correctedFields: details.correctedFields || 0,
            fileSize: details.fileSize || 0
        };
        
        // Add to export history (keep last 50)
        exports.unshift(exportEntry);
        if (exports.length > 50) {
            exports.pop();
        }
        
        localStorage.setItem(this.STORAGE_KEYS.EXPORTS, JSON.stringify(exports));
        
        // Update session export count
        this.updateSession({ exportsCount: 1 });
        
        console.log('📤 Export logged:', exportEntry);
        return exportEntry;
    }
    
    /**
     * Get export history
     */
    static getExportHistory() {
        const stored = localStorage.getItem(this.STORAGE_KEYS.EXPORTS);
        return stored ? JSON.parse(stored) : [];
    }
    
    /**
     * Get overall statistics from all fields
     */
    static getOverallStats(allFields) {
        const stats = {
            totalFields: allFields.length,
            totalFlagged: 0,
            totalCorrected: 0,
            flaggedByType: {
                selfIntersection: 0,
                straightLine: 0,
                bowTie: 0,
                otherIssue: 0
            }
        };
        
        allFields.forEach(field => {
            // Count flagged
            if (field.manualFlags?.selfIntersection || 
                field.manualFlags?.straightLine || 
                field.manualFlags?.bowTie || 
                field.manualFlags?.otherIssue) {
                stats.totalFlagged++;
                
                if (field.manualFlags.selfIntersection) stats.flaggedByType.selfIntersection++;
                if (field.manualFlags.straightLine) stats.flaggedByType.straightLine++;
                if (field.manualFlags.bowTie) stats.flaggedByType.bowTie++;
                if (field.manualFlags.otherIssue) stats.flaggedByType.otherIssue++;
            }
            
            // Count corrected
            if (field.correction?.applied && field.correctedCoordinates) {
                stats.totalCorrected++;
            }
        });
        
        return stats;
    }
    
    /**
     * Clear all history (for reset/testing)
     */
    static clearHistory() {
        localStorage.removeItem(this.STORAGE_KEYS.SESSION);
        localStorage.removeItem(this.STORAGE_KEYS.HISTORY);
        localStorage.removeItem(this.STORAGE_KEYS.EXPORTS);
        console.log('📊 History cleared');
    }
    
    /**
     * Notify UI to update
     */
    static notifyUpdate() {
        const event = new CustomEvent('progressUpdate', {
            detail: {
                session: this.getCurrentSession(),
                duration: this.getSessionDuration()
            }
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Export progress report as CSV
     */
    static exportProgressReport() {
        const history = this.getHistory();
        const exports = this.getExportHistory();
        
        let csv = 'WORK HISTORY\n';
        csv += 'Date,Duration (min),Fields Reviewed,Flags Added,Corrections Applied,Exports\n';
        
        history.forEach(entry => {
            csv += `${entry.date},${entry.duration},${entry.fieldsReviewed},${entry.flagsAdded},${entry.correctionsApplied},${entry.exportsCount}\n`;
        });
        
        csv += '\n\nEXPORT HISTORY\n';
        csv += 'Timestamp,Filename,Total Fields,Flagged,Corrected,File Size (KB)\n';
        
        exports.forEach(exp => {
            const timestamp = new Date(exp.timestamp).toLocaleString();
            const sizeKB = (exp.fileSize / 1024).toFixed(2);
            csv += `${timestamp},${exp.filename},${exp.totalFields},${exp.flaggedFields},${exp.correctedFields},${sizeKB}\n`;
        });
        
        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `progress_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('📊 Progress report exported');
    }
}
