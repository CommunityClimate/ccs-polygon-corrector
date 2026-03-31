// Storage Service - Data Persistence
import { APP_CONFIG } from '../config/app-config.js';

export class StorageService {
    
    // In-memory fallback storage
    static memoryStorage = {};
    static storageAvailable = null;
    
    // PERFORMANCE MODE: Store in memory only (like original HTML)
    static memoryOnlyMode = true; // Set to false to enable localStorage
    static inMemoryFields = [];
    
    // Check if localStorage is available
    static isStorageAvailable() {
        if (this.memoryOnlyMode) return false; // Force memory-only mode
        
        if (this.storageAvailable !== null) {
            return this.storageAvailable;
        }
        
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            this.storageAvailable = true;
            return true;
        } catch (e) {
            console.warn('localStorage not available, using in-memory storage. Data will be lost on page refresh.');
            this.storageAvailable = false;
            
            // Show warning to user
            if (typeof window !== 'undefined') {
                setTimeout(() => {
                    alert('⚠️ Storage Warning\n\nYour browser\'s tracking prevention is blocking data storage.\n\nTo fix this:\n• Disable tracking prevention for this site\n• Turn off private browsing mode\n• Allow cookies for localhost\n\nData will be lost when you refresh the page.');
                }, 1000);
            }
            return false;
        }
    }
    
    // Get item from storage
    static getItem(key) {
        if (this.isStorageAvailable()) {
            return localStorage.getItem(key);
        } else {
            return this.memoryStorage[key] || null;
        }
    }
    
    // Set item in storage
    static setItem(key, value) {
        if (this.isStorageAvailable()) {
            localStorage.setItem(key, value);
        } else {
            this.memoryStorage[key] = value;
        }
    }
    
    // Remove item from storage
    static removeItem(key) {
        if (this.isStorageAvailable()) {
            localStorage.removeItem(key);
        } else {
            delete this.memoryStorage[key];
        }
    }
    
    // Save field data
    static saveField(field) {
        const fields = this.getAllFields();
        
        // Add timestamp
        field.updatedAt = new Date().toISOString();
        
        // Find existing or add new
        const index = fields.findIndex(f => f.ccsFieldId === field.ccsFieldId);
        if (index >= 0) {
            fields[index] = field;
        } else {
            field.createdAt = new Date().toISOString();
            fields.push(field);
        }
        
        this.setItem(APP_CONFIG.STORAGE_KEYS.FIELDS, JSON.stringify(fields));
        return field;
    }
    
    // PERFORMANCE: Bulk save multiple fields at once (MUCH faster for large imports)
    static bulkSaveFields(newFields) {
        const timestamp = new Date().toISOString();
        
        // Memory-only mode (like original HTML) - NO storage quota issues!
        if (this.memoryOnlyMode) {
            // Track duplicates
            const existingIds = new Set(this.inMemoryFields.map(f => f.ccsFieldId));
            let duplicateCount = 0;
            
            // Add timestamp to all new fields
            newFields.forEach(field => {
                field.updatedAt = timestamp;
                if (!existingIds.has(field.ccsFieldId)) {
                    field.createdAt = timestamp;
                    existingIds.add(field.ccsFieldId);
                } else {
                    duplicateCount++;
                    // Mark as duplicate but still keep it
                    field.isDuplicate = true;
                    field.createdAt = timestamp;
                }
            });
            
            // Append all new fields (including duplicates)
            this.inMemoryFields.push(...newFields);
            
            console.log(`✅ Bulk saved ${newFields.length} fields in MEMORY (total: ${this.inMemoryFields.length})`);
            if (duplicateCount > 0) {
                console.warn(`⚠️ Found ${duplicateCount} duplicate field IDs (kept all records)`);
            }
            console.log(`⚠️ Memory-only mode: Data will be lost on page refresh. Export to save!`);
            return this.inMemoryFields.length;
        }
        
        // localStorage mode (with quota limits)
        const existingFields = this.getAllFields();
        
        // Create a map for faster lookups
        const fieldMap = new Map();
        existingFields.forEach(f => fieldMap.set(f.ccsFieldId, f));
        
        // Add or update all new fields
        newFields.forEach(field => {
            field.updatedAt = timestamp;
            if (!fieldMap.has(field.ccsFieldId)) {
                field.createdAt = timestamp;
            }
            fieldMap.set(field.ccsFieldId, field);
        });
        
        // Update storage
        const updatedFields = Array.from(fieldMap.values());
        this.setItem(APP_CONFIG.STORAGE_KEYS.FIELDS, JSON.stringify(updatedFields));
        return updatedFields.length;
    }
    
    // ==================== FAILED RECORDS MANAGEMENT ====================
    
    static inMemoryFailedRecords = []; // In-memory storage for failed records
    
    // Bulk save failed records (parse failures)
    static bulkSaveFailedRecords(failedRecords) {
        const timestamp = new Date().toISOString();
        
        // Memory-only mode
        if (this.memoryOnlyMode) {
            // Add timestamp to all failed records
            failedRecords.forEach(record => {
                record.updatedAt = timestamp;
                if (!record.createdAt) {
                    record.createdAt = timestamp;
                }
            });
            
            // Append all failed records
            this.inMemoryFailedRecords.push(...failedRecords);
            
            console.log(`✅ Saved ${failedRecords.length} failed records in MEMORY (total: ${this.inMemoryFailedRecords.length})`);
            return this.inMemoryFailedRecords.length;
        }
        
        // localStorage mode
        const existing = this.getFailedRecords();
        failedRecords.forEach(record => {
            record.updatedAt = timestamp;
            if (!record.createdAt) {
                record.createdAt = timestamp;
            }
        });
        
        const combined = [...existing, ...failedRecords];
        this.setItem('failedRecords', JSON.stringify(combined));
        return combined.length;
    }
    
    // Get all failed records
    static getFailedRecords() {
        if (this.memoryOnlyMode) {
            return this.inMemoryFailedRecords;
        }
        
        const data = this.getItem('failedRecords');
        return data ? JSON.parse(data) : [];
    }
    
    // Clear all failed records
    static clearFailedRecords() {
        if (this.memoryOnlyMode) {
            this.inMemoryFailedRecords = [];
            console.log('✅ Cleared all failed records from memory');
            return;
        }
        
        this.removeItem('failedRecords');
        console.log('✅ Cleared all failed records from storage');
    }
    
    // Get failed records statistics
    static getFailedRecordsStats() {
        const failed = this.getFailedRecords();
        
        const stats = {
            total: failed.length,
            byType: {}
        };
        
        failed.forEach(record => {
            const type = record.parseErrorType || 'UNKNOWN';
            stats.byType[type] = (stats.byType[type] || 0) + 1;
        });
        
        return stats;
    }
    
    // ==================== END FAILED RECORDS MANAGEMENT ====================
    
    // PERFORMANCE: Bulk UPDATE existing fields (for batch processing)
    // This is faster than bulkSaveFields for updates because fields are already in memory
    static bulkUpdateFields(fieldsToUpdate) {
        if (!fieldsToUpdate || fieldsToUpdate.length === 0) return;
        
        const timestamp = new Date().toISOString();
        
        if (this.memoryOnlyMode) {
            // Create lookup map of updates
            const updateMap = new Map();
            fieldsToUpdate.forEach(field => {
                field.updatedAt = timestamp;
                updateMap.set(field.ccsFieldId, field);
            });
            
            // Update in-memory array in place (FAST!)
            for (let i = 0; i < this.inMemoryFields.length; i++) {
                const field = this.inMemoryFields[i];
                if (updateMap.has(field.ccsFieldId)) {
                    // Merge updated data into existing field
                    Object.assign(this.inMemoryFields[i], updateMap.get(field.ccsFieldId));
                }
            }
            
            // No console log here for performance
            return this.inMemoryFields.length;
        }
        
        // localStorage mode
        const allFields = this.getAllFields();
        const updateMap = new Map();
        fieldsToUpdate.forEach(field => {
            field.updatedAt = timestamp;
            updateMap.set(field.ccsFieldId, field);
        });
        
        // Update in place
        for (let i = 0; i < allFields.length; i++) {
            if (updateMap.has(allFields[i].ccsFieldId)) {
                Object.assign(allFields[i], updateMap.get(allFields[i].ccsFieldId));
            }
        }
        
        this.setItem(APP_CONFIG.STORAGE_KEYS.FIELDS, JSON.stringify(allFields));
        return allFields.length;
    }
    
    // Get all fields
    static getAllFields() {
        // Memory-only mode (like original HTML)
        if (this.memoryOnlyMode) {
            return this.inMemoryFields;
        }
        
        try {
            const data = this.getItem(APP_CONFIG.STORAGE_KEYS.FIELDS);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading fields:', error);
            return [];
        }
    }
    
    // Get field by ID
    static getField(fieldId) {
        const fields = this.getAllFields();
        return fields.find(f => f.ccsFieldId === fieldId);
    }
    
    // Delete field
    static deleteField(fieldId) {
        const fields = this.getAllFields();
        const filtered = fields.filter(f => f.ccsFieldId !== fieldId);
        this.setItem(APP_CONFIG.STORAGE_KEYS.FIELDS, JSON.stringify(filtered));
        return filtered.length < fields.length;
    }
    
    // Save catalog data
    static saveCatalog(catalogData) {
        this.setItem(APP_CONFIG.STORAGE_KEYS.CATALOG, JSON.stringify({
            data: catalogData,
            timestamp: new Date().toISOString()
        }));
    }
    
    // Get catalog data
    static getCatalog() {
        try {
            const data = this.getItem(APP_CONFIG.STORAGE_KEYS.CATALOG);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Error loading catalog:', error);
            return null;
        }
    }
    
    // Save user preferences
    static savePreferences(preferences) {
        this.setItem(APP_CONFIG.STORAGE_KEYS.PREFERENCES, JSON.stringify(preferences));
    }
    
    // Get user preferences
    static getPreferences() {
        try {
            const data = this.getItem(APP_CONFIG.STORAGE_KEYS.PREFERENCES);
            return data ? JSON.parse(data) : this.getDefaultPreferences();
        } catch (error) {
            return this.getDefaultPreferences();
        }
    }
    
    // Default preferences
    static getDefaultPreferences() {
        return {
            theme: 'light',
            autoSave: true,
            showVertices: true,
            showIntersections: true,
            itemsPerPage: 12
        };
    }
    
    // Import data from JSON
    static importFromJSON(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
            
            // Handle GeoJSON FeatureCollection
            if (data.type === 'FeatureCollection') {
                const fields = data.features.map(feature => ({
                    ccsFieldId: feature.properties.ccsFieldId || `FIELD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    fieldOwner: feature.properties.fieldOwner || '',
                    originalCoordinates: feature.geometry.coordinates[0],
                    createdAt: new Date().toISOString(),
                    validation: {},
                    correction: {}
                }));
                
                // Save all fields
                fields.forEach(field => this.saveField(field));
                return { success: true, count: fields.length };
            }
            
            // Handle array of fields
            if (Array.isArray(data)) {
                data.forEach(field => this.saveField(field));
                return { success: true, count: data.length };
            }
            
            // Handle single field
            this.saveField(data);
            return { success: true, count: 1 };
            
        } catch (error) {
            console.error('Import error:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Export all fields as GeoJSON
    static exportAsGeoJSON(fields = null) {
        const fieldsToExport = fields || this.getAllFields();
        
        return {
            type: 'FeatureCollection',
            features: fieldsToExport.map(field => ({
                type: 'Feature',
                properties: {
                    ccsFieldId: field.ccsFieldId,
                    fieldOwner: field.fieldOwner,
                    areaHa: field.validation?.metrics?.areaHa || field.validation?.areaHa || 0,
                    vertices: field.originalCoordinates?.length || 0,
                    isValid: field.validation?.isValid || false,
                    corrected: field.correction?.applied || false,
                    createdAt: field.createdAt,
                    updatedAt: field.updatedAt
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [field.correctedCoordinates || field.originalCoordinates]
                }
            }))
        };
    }
    
    // Clear all data
    static clearAll() {
        // Clear memory arrays (for memory-only mode)
        this.inMemoryFields = [];
        this.inMemoryFailedRecords = [];
        
        // Clear localStorage (if not in memory-only mode)
        this.removeItem(APP_CONFIG.STORAGE_KEYS.FIELDS);
        this.removeItem(APP_CONFIG.STORAGE_KEYS.CATALOG);
        this.removeItem(APP_CONFIG.STORAGE_KEYS.CACHE);
        this.removeItem('failedRecords');
        
        console.log('✅ All data cleared (fields, failed records, catalog, cache)');
    }
    
    // Get storage stats
    static getStats() {
        const fields = this.getAllFields();
        return {
            totalFields: fields.length,
            validFields: fields.filter(f => f.validation?.isValid).length,
            correctedFields: fields.filter(f => f.correction?.applied).length,
            storageUsed: new Blob([JSON.stringify(fields)]).size,
            lastUpdated: fields.length > 0 ? 
                new Date(Math.max(...fields.map(f => new Date(f.updatedAt || f.createdAt)))).toISOString() : 
                null
        };
    }
    
    // Search fields
    static searchFields(query) {
        const fields = this.getAllFields();
        const lowerQuery = query.toLowerCase();
        
        return fields.filter(field => 
            field.ccsFieldId?.toLowerCase().includes(lowerQuery) ||
            field.fieldOwner?.toLowerCase().includes(lowerQuery)
        );
    }
    
    // Filter fields by date range
    static filterByDateRange(startDate, endDate) {
        const fields = this.getAllFields();
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return fields.filter(field => {
            const fieldDate = new Date(field.createdAt || field.updatedAt);
            return fieldDate >= start && fieldDate <= end;
        });
    }
}
