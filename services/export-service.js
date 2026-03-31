// Export Service - Import/Export Handlers
// VERSION: 2.5-DUPLICATE-EXPORT
console.log("🔧 ExportService VERSION 2.5 loaded - Duplicate Field IDs export added");

import { APP_CONFIG } from '../config/app-config.js';
import { StorageService } from './storage-service.js';
import { GeoUtils } from '../utils/geo-utils.js';

export class ExportService {
    
    // Static property to store detected CSV separator
    static csvSeparator = ',';  // Default to comma, auto-detected during parsing
    
    // NEW: Export duplicate Field IDs list
    static exportDuplicateFieldIds() {
        const importStats = StorageService.getImportStats();
        const duplicateFieldIds = importStats.duplicateFieldIds || [];
        
        console.log(`📥 Exporting ${duplicateFieldIds.length} duplicate Field IDs`);
        
        if (duplicateFieldIds.length === 0) {
            alert('No duplicate Field IDs found in last import.\n\nThis export is only available after importing a file with duplicates.');
            return;
        }
        
        // Create CSV with duplicate Field IDs
        let csv = 'Field ID,Status,Import Date\n';
        duplicateFieldIds.forEach(fieldId => {
            csv += `"${fieldId}","Duplicate found in source CSV","${importStats.lastImportDate || ''}"\n`;
        });
        
        this.downloadFile(
            csv,
            `duplicate_field_ids_${this.getTimestamp()}.csv`,
            'text/csv'
        );
        
        console.log(`✅ Duplicate Field IDs export complete: ${duplicateFieldIds.length} records`);
    }
    
    // Export as GeoJSON
    static exportGeoJSON(fields = null) {
        const fieldsToExport = fields || StorageService.getAllFields();
        const totalFields = StorageService.getAllFields().length;
        
        console.log(`📥 Exporting GeoJSON: ${fieldsToExport.length} of ${totalFields} fields${fields ? ' (filtered)' : ' (all)'}`);
        
        const geojson = StorageService.exportAsGeoJSON(fieldsToExport);
        
        this.downloadFile(
            JSON.stringify(geojson, null, 2),
            `${APP_CONFIG.EXPORT.FILENAME_PREFIX}_${this.getTimestamp()}.geojson`,
            'application/json'
        );
        
        console.log(`✅ GeoJSON export complete`);
    }
    
    // Export as KML
    static exportKML(fields = null) {
        const data = fields || StorageService.getAllFields();
        const totalFields = StorageService.getAllFields().length;
        
        console.log(`📥 Exporting KML: ${data.length} of ${totalFields} fields${fields ? ' (filtered)' : ' (all)'}`);
        
        let kml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        kml += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
        kml += '  <Document>\n';
        kml += '    <name>Field Polygons</name>\n';
        
        data.forEach(field => {
            const coords = field.correctedCoordinates || field.originalCoordinates;
            const area = field.validation?.metrics?.areaHa || field.validation?.areaHa || 0;
            kml += '    <Placemark>\n';
            kml += `      <name>${field.ccsFieldId}</name>\n`;
            kml += '      <description>\n';
            kml += `        Owner: ${field.fieldOwner || 'N/A'}\n`;
            kml += `        Area: ${area.toFixed(2)} ha\n`;
            kml += `        Valid: ${field.validation?.isValid ? 'Yes' : 'No'}\n`;
            kml += '      </description>\n';
            kml += '      <Polygon>\n';
            kml += '        <outerBoundaryIs>\n';
            kml += '          <LinearRing>\n';
            kml += '            <coordinates>\n';
            
            coords.forEach(coord => {
                kml += `              ${coord[0]},${coord[1]},0\n`;
            });
            
            kml += '            </coordinates>\n';
            kml += '          </LinearRing>\n';
            kml += '        </outerBoundaryIs>\n';
            kml += '      </Polygon>\n';
            kml += '    </Placemark>\n';
        });
        
        kml += '  </Document>\n';
        kml += '</kml>';
        
        this.downloadFile(
            kml,
            `${APP_CONFIG.EXPORT.FILENAME_PREFIX}_${this.getTimestamp()}.kml`,
            'application/vnd.google-earth.kml+xml'
        );
        
        console.log(`✅ KML export complete`);
    }
    
    // Export as CSV
    static exportCSV(fields = null) {
        const data = fields || StorageService.getAllFields();
        
        // UPDATED: Add Overlaps_With column
        let csv = 'Field ID,Owner,Area (ha),Vertices,Valid,Corrected,Correction_Method,Overlaps_With,Polygon Created,System Imported,Last Updated,Manual_Flag_Self_Intersection,Manual_Flag_Straight_Line,Manual_Flag_Bow_Tie,Manual_Flag_Other,Manual_Flag_Notes,Original_GeoJSON,Corrected_GeoJSON\n';
        
        data.forEach(field => {
            // CRITICAL: Always export BOTH original and corrected coordinates
            // This preserves the complete history and enables side-by-side comparison
            
            // Original coordinates (ALWAYS exported)
            const originalCoords = field.originalCoordinates;
            const originalGeoJsonCoords = originalCoords.map(coord => [coord[1], coord[0]]);
            const originalGeoJson = {
                type: 'Polygon',
                coordinates: [originalGeoJsonCoords]
            };
            
            // Corrected coordinates (exported if they exist)
            let correctedGeoJson = null;
            if (field.correctedCoordinates && field.correctedCoordinates.length >= 3) {
                const correctedGeoJsonCoords = field.correctedCoordinates.map(coord => [coord[1], coord[0]]);
                correctedGeoJson = {
                    type: 'Polygon',
                    coordinates: [correctedGeoJsonCoords]
                };
            }
            
            csv += `"${field.ccsFieldId}",`;
            csv += `"${field.fieldOwner || ''}",`;
            csv += `${field.validation?.areaHa?.toFixed(4) || ''},`;
            csv += `${field.originalCoordinates?.length || 0},`;
            csv += `${field.validation?.isValid ? 'Yes' : 'No'},`;
            csv += `${field.correction?.applied ? 'Yes' : 'No'},`;
            csv += `${field.correction?.method || ''},`; // Correction method (auto_correct or manual_edit)
            
            // NEW: Overlaps_With column
            const overlapsStr = (field.overlaps && field.overlaps.length > 0) 
                ? field.overlaps.join('; ') 
                : '';
            csv += `"${overlapsStr}",`;
            
            csv += `${field.polygonCreatedOn || ''},`; // Polygon creation date from CSV
            csv += `${field.createdAt || ''},`; // System import date
            csv += `${field.updatedAt || ''},`; // Last update date
            
            // Manual flags columns
            csv += `${field.manualFlags?.selfIntersection ? 'TRUE' : 'FALSE'},`;
            csv += `${field.manualFlags?.straightLine ? 'TRUE' : 'FALSE'},`;
            csv += `${field.manualFlags?.bowTie ? 'TRUE' : 'FALSE'},`;
            csv += `${field.manualFlags?.otherIssue ? 'TRUE' : 'FALSE'},`;
            csv += `"${(field.manualFlags?.notes || '').replace(/"/g, '""')}",`; // Escape quotes
            
            // NEW: Both original and corrected GeoJSON
            csv += `"${JSON.stringify(originalGeoJson).replace(/"/g, '""')}",`; // Original GeoJSON (always)
            csv += correctedGeoJson ? `"${JSON.stringify(correctedGeoJson).replace(/"/g, '""')}"` : ''; // Corrected GeoJSON (if exists)
            csv += '\n';
        });
        
        const filename = `${APP_CONFIG.EXPORT.FILENAME_PREFIX}_${this.getTimestamp()}.csv`;
        const blob = new Blob([csv], { type: 'text/csv' });
        
        this.downloadFile(
            csv,
            filename,
            'text/csv'
        );
        
        // Track export in progress tracker
        if (window.ProgressTracker) {
            // Count flagged and corrected fields
            let flaggedCount = 0;
            let correctedCount = 0;
            
            data.forEach(field => {
                if (field.manualFlags?.selfIntersection || 
                    field.manualFlags?.straightLine || 
                    field.manualFlags?.bowTie || 
                    field.manualFlags?.otherIssue) {
                    flaggedCount++;
                }
                if (field.correction?.applied && field.correctedCoordinates) {
                    correctedCount++;
                }
            });
            
            window.ProgressTracker.logExport({
                filename: filename,
                totalFields: data.length,
                flaggedFields: flaggedCount,
                correctedFields: correctedCount,
                fileSize: blob.size
            });
        }
    }
    
    // Export detailed CSV with coordinates
    static exportDetailedCSV(field) {
        const coords = field.correctedCoordinates || field.originalCoordinates;
        
        let csv = 'Field ID,Vertex,Latitude,Longitude\n';
        
        coords.forEach((coord, index) => {
            csv += `"${field.ccsFieldId}",${index + 1},${coord[1]},${coord[0]}\n`;
        });
        
        this.downloadFile(
            csv,
            `${field.ccsFieldId}_coordinates_${this.getTimestamp()}.csv`,
            'text/csv'
        );
    }
    
    // Export as Excel (using HTML table that Excel can open)
    static exportExcel(fields = null) {
        const data = fields || StorageService.getAllFields();
        
        let html = '<html><head><meta charset="utf-8"></head><body>';
        html += '<table border="1">';
        html += '<tr>';
        html += '<th>Field ID</th>';
        html += '<th>Owner</th>';
        html += '<th>Area (ha)</th>';
        html += '<th>Vertices</th>';
        html += '<th>Perimeter (m)</th>';
        html += '<th>Valid</th>';
        html += '<th>Corrected</th>';
        html += '<th>Verra Compliant</th>';
        html += '<th>Created</th>';
        html += '<th>Updated</th>';
        html += '</tr>';
        
        data.forEach(field => {
            html += '<tr>';
            html += `<td>${field.ccsFieldId}</td>`;
            html += `<td>${field.fieldOwner || ''}</td>`;
            html += `<td>${field.validation?.areaHa?.toFixed(4) || ''}</td>`;
            html += `<td>${field.originalCoordinates?.length || 0}</td>`;
            html += `<td>${field.validation?.perimeterM?.toFixed(2) || ''}</td>`;
            html += `<td>${field.validation?.isValid ? 'Yes' : 'No'}</td>`;
            html += `<td>${field.correction?.applied ? 'Yes' : 'No'}</td>`;
            html += `<td>${field.verraCompliance?.compliant ? 'Yes' : 'No'}</td>`;
            html += `<td>${field.createdAt || ''}</td>`;
            html += `<td>${field.updatedAt || ''}</td>`;
            html += '</tr>';
        });
        
        html += '</table></body></html>';
        
        this.downloadFile(
            html,
            `${APP_CONFIG.EXPORT.FILENAME_PREFIX}_${this.getTimestamp()}.xls`,
            'application/vnd.ms-excel'
        );
    }
    
    // Import from file
    static async importFromFile(file, onProgress = null, existingFieldsMap = null) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const content = e.target.result;
                    
                    // Try to parse as JSON/GeoJSON
                    if (file.name.endsWith('.json') || file.name.endsWith('.geojson')) {
                        const result = StorageService.importFromJSON(content);
                        resolve(result);
                    }
                    // Try to parse as CSV
                    else if (file.name.endsWith('.csv')) {
                        const result = await this.parseCSV(content, onProgress, existingFieldsMap);
                        resolve(result);
                    }
                    else {
                        reject(new Error('Unsupported file format'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }
    
    // Parse CSV
    static async parseCSV(content, onProgress = null, existingFieldsMap = null) {
        // CRITICAL FIX: Properly split CSV lines respecting quoted fields with newlines
        // Simple split('\n') breaks multi-line GeoJSON fields
        const lines = this.splitCSVLines(content);
        
        if (lines.length === 0) {
            return { success: false, error: 'Empty CSV file' };
        }
        
        // AUTO-DETECT SEPARATOR (Excel can save as tab-separated even with .csv extension!)
        const firstLine = lines[0];
        const tabCount = (firstLine.match(/\t/g) || []).length;
        const commaCount = (firstLine.match(/,/g) || []).length;
        
        // Determine separator
        this.csvSeparator = tabCount > commaCount ? '\t' : ',';
        const separatorName = this.csvSeparator === '\t' ? 'TAB' : 'COMMA';
        
        console.log(`🔍 Detected separator: ${separatorName} (tabs: ${tabCount}, commas: ${commaCount})`);
        
        // CRITICAL: Use parseCSVLine to handle commas inside quoted fields!
        const headers = this.parseCSVLine(lines[0]).map(h => h.trim().replace(/"/g, '').toLowerCase());
        
        console.log('CSV Headers detected:', headers);
        console.log(`Header count: ${headers.length} columns`);
        console.log(`Total rows to process: ${lines.length - 1}`);
        console.log(`⚠️ If this number seems wrong, your CSV may have embedded newlines in quoted fields`);
        
        // Detect CSV format based on column names from original HTML
        const geoJsonColumns = ['field geojson', 'field esrijson', 'geojson', 'geometry', 'field_geojson', 'geojson data'];
        const hasGeoJSON = headers.some(h => geoJsonColumns.includes(h) || h.includes('geojson') || h.includes('geometry'));
        
        const hasCoordinates = headers.includes('latitude') && headers.includes('longitude');
        const hasWKT = headers.includes('wkt');
        
        // Format 1: GeoJSON format (PRIORITY - matches original HTML)
        if (hasGeoJSON) {
            console.log('Detected CSV format: GeoJSON/Geometry column');
            return await this.parseCSVGeoJSONFormat(lines, headers, onProgress, existingFieldsMap);
        }
        
        // Format 2: One row per vertex (Field ID, Vertex, Latitude, Longitude)
        else if (hasCoordinates && (headers.includes('vertex') || headers.includes('point'))) {
            console.log('Detected CSV format: Vertex format (one row per coordinate)');
            return this.parseCSVVertexFormat(lines, headers);
        }
        
        // Format 3: One row per field with WKT geometry
        else if (hasWKT) {
            console.log('Detected CSV format: WKT format');
            return this.parseCSVWKTFormat(lines, headers);
        }
        
        // Format 4: Simple metadata only (no coordinates)
        else {
            console.log('Detected CSV format: Metadata only (no coordinates)');
            return this.parseCSVMetadataOnly(lines, headers);
        }
    }
    
    // NEW: Properly split CSV into lines, respecting quoted fields with newlines
    static splitCSVLines(content) {
        const lines = [];
        let currentLine = '';
        let inQuotes = false;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const nextChar = content[i + 1];
            
            if (char === '"') {
                // Check for escaped quote ("")
                if (nextChar === '"') {
                    currentLine += '""';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                    currentLine += char;
                }
            } else if (char === '\n' && !inQuotes) {
                // End of line (only if not inside quotes)
                if (currentLine.trim()) {
                    lines.push(currentLine);
                }
                currentLine = '';
            } else if (char === '\r') {
                // Skip carriage return (handle both \r\n and \n)
                continue;
            } else {
                currentLine += char;
            }
        }
        
        // Add last line if not empty
        if (currentLine.trim()) {
            lines.push(currentLine);
        }
        
        console.log(`✅ CSV properly split into ${lines.length} lines (respecting quoted multi-line fields)`);
        return lines;
    }
    
    // Parse CSV with one row per vertex
    static parseCSVVertexFormat(lines, headers) {
        const fieldIdIdx = headers.findIndex(h => h.includes('field') || h.includes('id'));
        const latIdx = headers.findIndex(h => h === 'latitude' || h === 'lat');
        const lngIdx = headers.findIndex(h => h === 'longitude' || h === 'lng' || h === 'lon');
        const ownerIdx = headers.findIndex(h => h.includes('owner'));
        
        const fieldsMap = new Map();
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = this.parseCSVLine(lines[i]);
            const fieldId = values[fieldIdIdx];
            const lat = parseFloat(values[latIdx]);
            const lng = parseFloat(values[lngIdx]);
            
            if (!fieldId || isNaN(lat) || isNaN(lng)) continue;
            
            if (!fieldsMap.has(fieldId)) {
                fieldsMap.set(fieldId, {
                    ccsFieldId: fieldId,
                    fieldOwner: ownerIdx >= 0 ? values[ownerIdx] : '',
                    originalCoordinates: [],
                    createdAt: new Date().toISOString(),
                    validation: {},
                    correction: {}
                });
            }
            
            fieldsMap.get(fieldId).originalCoordinates.push([lng, lat]);
        }
        
        // Close polygons and save
        const fields = Array.from(fieldsMap.values());
        fields.forEach(field => {
            // Close polygon if not closed
            const coords = field.originalCoordinates;
            if (coords.length > 0) {
                const first = coords[0];
                const last = coords[coords.length - 1];
                if (first[0] !== last[0] || first[1] !== last[1]) {
                    coords.push([first[0], first[1]]);
                }
            }
        });
        
        // Bulk save all fields at once
        StorageService.bulkSaveFields(fields);
        
        return { success: true, count: fields.length };
    }
    
    // Parse CSV with WKT geometry column
    static parseCSVWKTFormat(lines, headers) {
        const fieldIdIdx = headers.findIndex(h => h.includes('field') || h.includes('id'));
        const wktIdx = headers.findIndex(h => h === 'wkt' || h === 'geometry');
        const ownerIdx = headers.findIndex(h => h.includes('owner'));
        
        const fields = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = this.parseCSVLine(lines[i]);
            const wkt = values[wktIdx];
            
            // Parse WKT POLYGON format: POLYGON((lng lat, lng lat, ...))
            const coordsMatch = wkt.match(/POLYGON\s*\(\((.*?)\)\)/i);
            if (!coordsMatch) continue;
            
            const coordPairs = coordsMatch[1].split(',').map(pair => {
                const [lng, lat] = pair.trim().split(/\s+/).map(parseFloat);
                return [lng, lat];
            });
            
            const field = {
                ccsFieldId: values[fieldIdIdx] || `FIELD_${Date.now()}_${i}`,
                fieldOwner: ownerIdx >= 0 ? values[ownerIdx] : '',
                originalCoordinates: coordPairs,
                createdAt: new Date().toISOString(),
                validation: {},
                correction: {}
            };
            
            fields.push(field);
        }
        
        // Bulk save all fields at once
        StorageService.bulkSaveFields(fields);
        
        return { success: true, count: fields.length };
    }
    
    // Parse CSV with GeoJSON coordinates column
    static async parseCSVGeoJSONFormat(lines, headers, onProgress = null, existingFieldsMap = null) {
        const fieldIdIdx = headers.findIndex(h => h.includes('field') && h.includes('id') || h === 'ccs_field_id' || h === 'ccs field id' || h === 'fieldid');
        const ownerIdx = headers.findIndex(h => h.includes('owner') || h === 'field_owner' || h === 'fieldowner' || h === 'field owner');
        
        // NEW: Track preservation stats
        const preservationEnabled = existingFieldsMap && existingFieldsMap.size > 0;
        let preservedCount = 0;
        let newFieldsCount = 0;
        
        console.log(`🔄 Preservation mode: ${preservationEnabled ? 'ENABLED' : 'DISABLED'}`);
        if (preservationEnabled) {
            console.log(`📋 ${existingFieldsMap.size} existing fields available for preservation`);
        }
        
        // Helper function to categorize parse errors
        const categorizeError = (error, geoJsonStr, coordinates) => {
            if (!geoJsonStr || !geoJsonStr.trim()) {
                return { type: 'EMPTY_GEOJSON', message: 'No GeoJSON data provided' };
            }
            if (error.name === 'SyntaxError' || error.message.includes('JSON')) {
                return { type: 'INVALID_JSON', message: error.message };
            }
            if (coordinates !== undefined && (!coordinates || coordinates.length < 3)) {
                return { type: 'INVALID_COORDINATES', message: `Only ${coordinates?.length || 0} coordinate points (minimum 3 required)` };
            }
            if (error.message.includes('geometry') || error.message.includes('coordinates')) {
                return { type: 'UNKNOWN_STRUCTURE', message: error.message };
            }
            return { type: 'UNKNOWN_ERROR', message: error.message };
        };
        
        // ADDED: Find the "Created On" or "Polygon Created" column for polygon creation date
        const createdOnIdx = headers.findIndex(h => 
            h === 'created on' || 
            h === 'createdon' || 
            h === 'creation date' || 
            h === 'creationdate' ||
            h === 'polygon created' ||  // From our CSV exports
            h === 'polygoncreated' ||
            (h.includes('created') && h.includes('on')) ||
            (h.includes('polygon') && h.includes('created'))
        );
        
        // NEW: Find manual flags columns
        const manualFlagSelfIntersectionIdx = headers.findIndex(h => 
            h === 'manual_flag_self_intersection' || h === 'manual flag self intersection'
        );
        const manualFlagStraightLineIdx = headers.findIndex(h => 
            h === 'manual_flag_straight_line' || h === 'manual flag straight line'
        );
        const manualFlagBowTieIdx = headers.findIndex(h => 
            h === 'manual_flag_bow_tie' || h === 'manual flag bow tie'
        );
        const manualFlagOtherIdx = headers.findIndex(h => 
            h === 'manual_flag_other' || h === 'manual flag other'
        );
        const manualFlagNotesIdx = headers.findIndex(h => 
            h === 'manual_flag_notes' || h === 'manual flag notes'
        );
        
        const hasManualFlags = manualFlagSelfIntersectionIdx >= 0 || 
                               manualFlagStraightLineIdx >= 0 || 
                               manualFlagBowTieIdx >= 0 || 
                               manualFlagOtherIdx >= 0;
        
        console.log(`Column indices - Field ID: ${fieldIdIdx}, Owner: ${ownerIdx}, Created On: ${createdOnIdx}`);
        console.log(`Manual flags columns - SI: ${manualFlagSelfIntersectionIdx}, Line: ${manualFlagStraightLineIdx}, BowTie: ${manualFlagBowTieIdx}, Other: ${manualFlagOtherIdx}, Notes: ${manualFlagNotesIdx}`);
        
        if (hasManualFlags) {
            console.log('✅ Manual flags columns detected in CSV - will restore flags');
        }
        
        // NEW: Check for dual coordinate columns (Original_GeoJSON and Corrected_GeoJSON)
        const originalGeoJsonIdx = headers.findIndex(h => 
            h === 'original_geojson' || h === 'original geojson' || h === 'originalgeojson'
        );
        const correctedGeoJsonIdx = headers.findIndex(h => 
            h === 'corrected_geojson' || h === 'corrected geojson' || h === 'correctedgeojson'
        );
        const correctionMethodIdx = headers.findIndex(h => 
            h === 'correction_method' || h === 'correction method' || h === 'correctionmethod'
        );
        
        const hasDualCoordinates = originalGeoJsonIdx >= 0 && correctedGeoJsonIdx >= 0;
        
        if (hasDualCoordinates) {
            console.log('✅ Dual coordinate columns detected (Original + Corrected) - preserving both!');
            console.log(`   Original GeoJSON index: ${originalGeoJsonIdx}`);
            console.log(`   Corrected GeoJSON index: ${correctedGeoJsonIdx}`);
            console.log(`   Correction Method index: ${correctionMethodIdx}`);
        }
        
        // Look for GeoJSON column (only if NOT using dual coordinates)
        const geoJsonColumnNames = ['field geojson', 'field esrijson', 'geojson', 'geometry', 'field_geojson', 'geojson data'];
        let geoIdx = -1;
        
        // Skip single GeoJSON search if we have dual coordinates
        if (!hasDualCoordinates) {
            for (const colName of geoJsonColumnNames) {
                const idx = headers.findIndex(h => h === colName);
                if (idx >= 0) {
                    geoIdx = idx;
                    console.log(`Found GeoJSON column: "${headers[idx]}" at index ${idx}`);
                    break;
                }
            }
            
            if (geoIdx < 0) {
                geoIdx = headers.findIndex(h => h.includes('geojson') || h.includes('geometry') || h.includes('coordinates'));
            }
            
            if (geoIdx < 0) {
                return { success: false, error: 'No GeoJSON column found' };
            }
        }
        
        const totalRows = lines.length - 1; // Exclude header
        let successCount = 0;
        let errorCount = 0;
        let emptyCount = 0;
        let duplicateCount = 0;  // NEW: Track duplicates in source CSV
        
        const parsedFields = []; // PERFORMANCE: Accumulate all fields
        const failedRecords = []; // NEW: Track parse failures with details
        const seenFieldIds = new Set();  // NEW: Track Field IDs to detect duplicates
        const duplicateFieldIds = [];  // NEW: Track WHICH Field IDs are duplicates
        // Batch processing to prevent browser freeze
        const BATCH_SIZE = 100;
        const batches = Math.ceil(totalRows / BATCH_SIZE);
        
        console.log(`Processing ${totalRows} rows in ${batches} batches of ${BATCH_SIZE}...`);
        
        for (let batchNum = 0; batchNum < batches; batchNum++) {
            const startIdx = batchNum * BATCH_SIZE + 1; // +1 to skip header
            const endIdx = Math.min(startIdx + BATCH_SIZE, lines.length);
            
            // Process batch
            for (let i = startIdx; i < endIdx; i++) {
                if (!lines[i].trim()) continue;
                
                const values = this.parseCSVLine(lines[i]);
                
                try {
                    // NEW: Check if we're using dual coordinate columns
                    let originalCoordinates = null;
                    let correctedCoordinates = null;
                    let correctionMethod = null;
                    
                    if (hasDualCoordinates) {
                        // DUAL COORDINATE MODE: Parse both Original_GeoJSON and Corrected_GeoJSON
                        
                        // Parse Original GeoJSON (required)
                        const originalGeoJsonStr = values[originalGeoJsonIdx];
                        if (!originalGeoJsonStr || !originalGeoJsonStr.trim()) {
                            emptyCount++;
                            const failedRecord = {
                                ccsFieldId: (fieldIdIdx >= 0 && values[fieldIdIdx]) ? values[fieldIdIdx] : `UNKNOWN_ROW_${i}`,
                                fieldOwner: (ownerIdx >= 0 && values[ownerIdx]) ? values[ownerIdx] : '',
                                parseError: true,
                                parseErrorType: 'EMPTY_GEOJSON',
                                parseErrorMessage: 'No Original GeoJSON data provided',
                                rawGeoJsonString: '',
                                csvRowNumber: i,
                                polygonCreatedOn: createdOnIdx >= 0 && values[createdOnIdx] ? values[createdOnIdx] : null,
                                createdAt: new Date().toISOString(),
                                originalCoordinates: null,
                                validation: { isValid: false, errors: ['EMPTY_GEOJSON'] }
                            };
                            parsedFields.push(failedRecord);
                            failedRecords.push(failedRecord);
                            continue;
                        }
                        
                        // Parse original GeoJSON
                        const originalGeoData = JSON.parse(originalGeoJsonStr.trim());
                        let originalGeoCoords = null;
                        if (originalGeoData.type === 'Polygon') {
                            originalGeoCoords = originalGeoData.coordinates[0];
                        } else if (originalGeoData.type === 'Feature') {
                            originalGeoCoords = originalGeoData.geometry.coordinates[0];
                        }
                        
                        if (!originalGeoCoords || originalGeoCoords.length < 3) {
                            throw new Error('Invalid original coordinates');
                        }
                        
                        // Convert to Leaflet format
                        originalCoordinates = originalGeoCoords.map(coord => [coord[1], coord[0]]);
                        
                        // Parse Corrected GeoJSON (optional)
                        const correctedGeoJsonStr = values[correctedGeoJsonIdx];
                        if (correctedGeoJsonStr && correctedGeoJsonStr.trim()) {
                            const correctedGeoData = JSON.parse(correctedGeoJsonStr.trim());
                            let correctedGeoCoords = null;
                            if (correctedGeoData.type === 'Polygon') {
                                correctedGeoCoords = correctedGeoData.coordinates[0];
                            } else if (correctedGeoData.type === 'Feature') {
                                correctedGeoCoords = correctedGeoData.geometry.coordinates[0];
                            }
                            
                            if (correctedGeoCoords && correctedGeoCoords.length >= 3) {
                                correctedCoordinates = correctedGeoCoords.map(coord => [coord[1], coord[0]]);
                            }
                        }
                        
                        // Get correction method if available
                        if (correctionMethodIdx >= 0 && values[correctionMethodIdx]) {
                            correctionMethod = values[correctionMethodIdx].trim();
                        }
                        
                    } else {
                        // SINGLE COORDINATE MODE: Parse legacy GeoJSON column
                    
                    let geoJsonStr = values[geoIdx];
                    
                    // DIAGNOSTIC: Log first few empty cases
                    if ((!geoJsonStr || !geoJsonStr.trim()) && emptyCount < 5) {
                        console.log(`Row ${i} marked as empty GeoJSON:`, {
                            rowNumber: i,
                            geoJsonValue: geoJsonStr,
                            geoJsonType: typeof geoJsonStr,
                            allValues: values.length,
                            firstFewValues: values.slice(0, 3)
                        });
                    }
                    
                    if (!geoJsonStr || !geoJsonStr.trim()) {
                        emptyCount++;
                        
                        // NEW: Create failed record and ADD TO MAIN ARRAY
                        const failedRecord = {
                            ccsFieldId: (fieldIdIdx >= 0 && values[fieldIdIdx]) ? values[fieldIdIdx] : `UNKNOWN_ROW_${i}`,
                            fieldOwner: (ownerIdx >= 0 && values[ownerIdx]) ? values[ownerIdx] : '',
                            parseError: true,
                            parseErrorType: 'EMPTY_GEOJSON',
                            parseErrorMessage: 'No GeoJSON data provided in this field',
                            rawGeoJsonString: '',
                            csvRowNumber: i,
                            polygonCreatedOn: createdOnIdx >= 0 && values[createdOnIdx] ? values[createdOnIdx] : null,
                            createdAt: new Date().toISOString(),
                            originalCoordinates: null,
                            validation: {
                                isValid: false,
                                errors: ['EMPTY_GEOJSON']
                            }
                        };
                        
                        parsedFields.push(failedRecord);  // ADD TO MAIN ARRAY
                        failedRecords.push(failedRecord);  // Also track for statistics
                        continue;
                    }
                    
                    // Clean the JSON string
                    geoJsonStr = geoJsonStr.trim();
                    
                    // Remove BOM if present
                    if (geoJsonStr.charCodeAt(0) === 0xFEFF) {
                        geoJsonStr = geoJsonStr.substring(1);
                    }
                    
                    // Fix common JSON issues
                    geoJsonStr = geoJsonStr.replace(/[\u201C\u201D]/g, '"');
                    geoJsonStr = geoJsonStr.replace(/[\u2018\u2019]/g, "'");
                    
                    if (geoJsonStr.startsWith("'") && geoJsonStr.endsWith("'")) {
                        geoJsonStr = geoJsonStr.slice(1, -1).replace(/'/g, '"');
                    }
                    
                    if (geoJsonStr.startsWith('""') && geoJsonStr.endsWith('""')) {
                        geoJsonStr = geoJsonStr.slice(1, -1);
                    }
                    
                    // Parse the GeoJSON
                    const geoData = JSON.parse(geoJsonStr);
                    let coordinates = null;
                    
                    // Handle different GeoJSON structures
                    if (geoData.type === 'Feature') {
                        coordinates = geoData.geometry.coordinates[0];
                    } else if (geoData.type === 'Polygon') {
                        coordinates = geoData.coordinates[0];
                    } else if (geoData.type === 'FeatureCollection' && geoData.features && geoData.features.length > 0) {
                        coordinates = geoData.features[0].geometry.coordinates[0];
                    } else if (Array.isArray(geoData)) {
                        coordinates = geoData;
                    } else if (geoData.rings && Array.isArray(geoData.rings) && geoData.rings.length > 0) {
                        coordinates = geoData.rings[0];
                    }
                    
                    if (!coordinates || coordinates.length < 3) {
                        errorCount++;
                        
                        // NEW: Create failed record and ADD TO MAIN ARRAY
                        const failedRecord = {
                            ccsFieldId: (fieldIdIdx >= 0 && values[fieldIdIdx]) ? values[fieldIdIdx] : `UNKNOWN_ROW_${i}`,
                            fieldOwner: (ownerIdx >= 0 && values[ownerIdx]) ? values[ownerIdx] : '',
                            parseError: true,
                            parseErrorType: 'INVALID_COORDINATES',
                            parseErrorMessage: `Only ${coordinates?.length || 0} coordinate points (minimum 3 required for polygon)`,
                            rawGeoJsonString: geoJsonStr?.substring(0, 200) || '',
                            csvRowNumber: i,
                            polygonCreatedOn: createdOnIdx >= 0 && values[createdOnIdx] ? values[createdOnIdx] : null,
                            createdAt: new Date().toISOString(),
                            originalCoordinates: null,
                            validation: {
                                isValid: false,
                                errors: ['INVALID_COORDINATES']
                            }
                        };
                        
                        parsedFields.push(failedRecord);  // ADD TO MAIN ARRAY
                        failedRecords.push(failedRecord);  // Also track for statistics
                        continue;
                    }
                    
                    // CRITICAL: Convert GeoJSON [lng, lat] to Leaflet [lat, lng] format
                    // This matches the original HTML behavior
                    const leafletCoordinates = coordinates.map(coord => [coord[1], coord[0]]);
                    
                    // If not using dual coordinates, set original from parsed GeoJSON
                    if (!hasDualCoordinates) {
                        originalCoordinates = leafletCoordinates;
                    }
                    
                    } // END of single coordinate mode else block
                    
                    // Parse the Created On date if available
                    let polygonCreatedOn = null;
                    if (createdOnIdx >= 0 && values[createdOnIdx]) {
                        const dateStr = values[createdOnIdx].trim();
                        // Try to parse various date formats
                        // Format: "23.10.2025 15:37" or "27.01.2026 17:29"
                        const parsed = this.parseDate(dateStr);
                        if (parsed) {
                            polygonCreatedOn = parsed.toISOString();
                        }
                    }
                    
                    const fieldId = fieldIdIdx >= 0 ? values[fieldIdIdx] : `FIELD_${Date.now()}_${i}`;
                    
                    // NEW: Track duplicates in source CSV
                    if (seenFieldIds.has(fieldId)) {
                        duplicateCount++;
                        duplicateFieldIds.push(fieldId);  // Save which Field ID is duplicate
                        console.log(`⚠️ Duplicate Field ID in CSV: ${fieldId} (row ${i})`);
                    } else {
                        seenFieldIds.add(fieldId);
                    }
                    
                    // NEW: Parse manual flags from CSV if columns exist
                    let manualFlagsFromCSV = null;
                    if (hasManualFlags) {
                        const parseBool = (val) => {
                            if (!val) return false;
                            const str = val.toString().trim().toLowerCase();
                            return str === 'true' || str === '1' || str === 'yes';
                        };
                        
                        const selfIntersection = manualFlagSelfIntersectionIdx >= 0 ? parseBool(values[manualFlagSelfIntersectionIdx]) : false;
                        const straightLine = manualFlagStraightLineIdx >= 0 ? parseBool(values[manualFlagStraightLineIdx]) : false;
                        const bowTie = manualFlagBowTieIdx >= 0 ? parseBool(values[manualFlagBowTieIdx]) : false;
                        const otherIssue = manualFlagOtherIdx >= 0 ? parseBool(values[manualFlagOtherIdx]) : false;
                        const notes = manualFlagNotesIdx >= 0 ? (values[manualFlagNotesIdx] || '') : '';
                        
                        // Only create manualFlags object if at least one flag is set
                        if (selfIntersection || straightLine || bowTie || otherIssue || notes) {
                            manualFlagsFromCSV = {
                                selfIntersection,
                                straightLine,
                                bowTie,
                                otherIssue,
                                notes,
                                flaggedAt: new Date().toISOString(),
                                flaggedBy: 'csv_import'
                            };
                        }
                    }
                    
                    // NEW: Check if this field already exists (preservation mode)
                    let field;
                    const existingField = preservationEnabled ? existingFieldsMap.get(fieldId) : null;
                    
                    if (existingField) {
                        // PRESERVE existing field data
                        field = {
                            ...existingField,  // Keep ALL existing data
                            // Only update these fields from CSV:
                            fieldOwner: ownerIdx >= 0 ? values[ownerIdx] : existingField.fieldOwner,
                            originalCoordinates: originalCoordinates || existingField.originalCoordinates,  // Update if provided
                            correctedCoordinates: correctedCoordinates !== null ? correctedCoordinates : existingField.correctedCoordinates,  // Update if provided
                            correction: correctedCoordinates !== null ? {
                                applied: true,
                                method: correctionMethod || 'imported',
                                timestamp: new Date().toISOString()
                            } : existingField.correction,
                            polygonCreatedOn: polygonCreatedOn || existingField.polygonCreatedOn,
                            updatedAt: new Date().toISOString(),  // Mark as updated
                            // PRESERVE: validation, manualFlags, etc.
                            // BUT: Override with CSV manual flags if present
                            manualFlags: manualFlagsFromCSV || existingField.manualFlags
                        };
                        preservedCount++;
                        if (manualFlagsFromCSV) {
                            console.log(`✅ Preserved data for ${fieldId} (with manual flags from CSV)`);
                        } else {
                            console.log(`✅ Preserved data for ${fieldId}`);
                        }
                    } else {
                        // NEW FIELD - create fresh
                        field = {
                            ccsFieldId: fieldId,
                            fieldOwner: ownerIdx >= 0 ? values[ownerIdx] : '',
                            originalCoordinates: originalCoordinates,  // Original coordinates
                            correctedCoordinates: correctedCoordinates,  // Corrected coordinates (if exists)
                            correction: correctedCoordinates ? {
                                applied: true,
                                method: correctionMethod || 'imported',
                                timestamp: new Date().toISOString()
                            } : {},
                            polygonCreatedOn: polygonCreatedOn,  // ADDED: Actual polygon creation date
                            createdAt: new Date().toISOString(),  // System import date
                            validation: {},
                            isNewField: preservationEnabled ? true : undefined,  // Mark as new if in preservation mode
                            manualFlags: manualFlagsFromCSV  // Add manual flags if present in CSV
                        };
                        if (preservationEnabled) {
                            newFieldsCount++;
                            console.log(`🆕 New field: ${fieldId}`);
                        }
                    }
                    
                    parsedFields.push(field);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    
                    // NEW: Capture the failed record with error details
                    const errorInfo = categorizeError(error, values[geoIdx], null);
                    
                    const failedRecord = {
                        ccsFieldId: (fieldIdIdx >= 0 && values[fieldIdIdx]) ? values[fieldIdIdx] : `UNKNOWN_ROW_${i}`,
                        fieldOwner: (ownerIdx >= 0 && values[ownerIdx]) ? values[ownerIdx] : '',
                        parseError: true,
                        parseErrorType: errorInfo.type,
                        parseErrorMessage: errorInfo.message,
                        rawGeoJsonString: values[geoIdx]?.substring(0, 200) || '', // First 200 chars
                        csvRowNumber: i,
                        polygonCreatedOn: createdOnIdx >= 0 && values[createdOnIdx] ? values[createdOnIdx] : null,
                        createdAt: new Date().toISOString(),
                        originalCoordinates: null,
                        validation: {
                            isValid: false,
                            errors: ['PARSE_FAILED']
                        }
                    };
                    
                    parsedFields.push(failedRecord);  // ADD TO MAIN ARRAY
                    failedRecords.push(failedRecord);  // Also track for statistics
                    
                    // Log first few errors for debugging
                    if (errorCount <= 5) {
                        console.warn(`Parse error at row ${i}:`, errorInfo.type, errorInfo.message);
                    }
                }
            }
            
            // Update progress
            const progress = Math.round(((batchNum + 1) / batches) * 100);
            if (onProgress) {
                onProgress(progress, successCount, errorCount, emptyCount);
            }
            
            // Yield to browser to prevent freeze
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        console.log(`CSV Import complete: ${successCount} successful, ${errorCount} errors, ${emptyCount} empty, ${duplicateCount} duplicates`);
        console.log(`Failed records captured: ${failedRecords.length}`);
        console.log(`Total records to save: ${parsedFields.length} (including ${failedRecords.length} failed)`);
        
        // NEW: Log preservation stats
        if (preservationEnabled) {
            console.log(`🔄 Preservation stats: ${preservedCount} preserved, ${newFieldsCount} new`);
        }
        
        if (duplicateCount > 0) {
            console.log(`⚠️ Found ${duplicateCount} duplicate Field IDs in source CSV (last occurrence kept)`);
        }
        
        // Bulk save ALL records at once (successful + failed)
        console.log(`Bulk saving ${parsedFields.length} fields (success + failures)...`);
        StorageService.bulkSaveFields(parsedFields);
        
        // OPTIONAL: Also save failed records separately for quick access/statistics
        if (failedRecords.length > 0) {
            console.log(`Also tracking ${failedRecords.length} failed records separately for statistics...`);
            StorageService.bulkSaveFailedRecords(failedRecords);
        }
        
        return { 
            success: true, 
            count: successCount, 
            errors: errorCount,
            empty: emptyCount,
            total: totalRows,
            totalSaved: parsedFields.length,  // NEW: Total including failures
            failedRecords: failedRecords,  // NEW: Include failed records in result
            duplicates: duplicateCount,  // NEW: Duplicate Field IDs found in source CSV
            duplicateFieldIds: duplicateFieldIds,  // NEW: LIST of which Field IDs are duplicates
            // NEW: Preservation stats
            preserved: preservationEnabled ? preservedCount : undefined,
            newFields: preservationEnabled ? newFieldsCount : undefined
        };
    }
    
    // Parse CSV with metadata only (no coordinates)
    static parseCSVMetadataOnly(lines, headers) {
        console.warn('CSV does not contain coordinate data. Only importing metadata.');
        
        // Look for field ID column - match original HTML names
        const fieldIdColumns = ['ccs_field_id', 'ccs field id', 'field id', 'fieldid', 'id', 'field_id'];
        let fieldIdIdx = -1;
        for (const colName of fieldIdColumns) {
            const idx = headers.findIndex(h => h === colName);
            if (idx >= 0) {
                fieldIdIdx = idx;
                break;
            }
        }
        if (fieldIdIdx < 0) {
            fieldIdIdx = headers.findIndex(h => h.includes('field') || h.includes('id'));
        }
        
        // Look for owner column
        const ownerColumns = ['field_owner', 'field owner', 'fieldowner', 'owner'];
        let ownerIdx = -1;
        for (const colName of ownerColumns) {
            const idx = headers.findIndex(h => h === colName);
            if (idx >= 0) {
                ownerIdx = idx;
                break;
            }
        }
        if (ownerIdx < 0) {
            ownerIdx = headers.findIndex(h => h.includes('owner'));
        }
        
        const fields = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            
            const values = this.parseCSVLine(lines[i]);
            const field = {
                ccsFieldId: fieldIdIdx >= 0 ? values[fieldIdIdx] : (values[0] || `FIELD_${i}`),
                fieldOwner: ownerIdx >= 0 ? values[ownerIdx] : (values[1] || ''),
                originalCoordinates: [],
                createdAt: new Date().toISOString(),
                validation: {},
                correction: {}
            };
            
            fields.push(field);
        }
        
        // Bulk save all fields at once
        StorageService.bulkSaveFields(fields);
        
        return { success: true, count: fields.length, warning: 'No coordinate data found in CSV' };
    }
    
    // Helper: Parse CSV line handling quotes and complex data
    static parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = null;
        
        // Use detected separator (comma or tab)
        const separator = this.csvSeparator || ',';
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            const prevChar = line[i - 1];
            
            // Handle quote characters - ONLY at start of field!
            // A quote starts a quoted field if:
            // 1. We're not already in quotes, AND
            // 2. Current field is empty (quote is first char of field), AND
            // 3. Previous char was separator or we're at start of line
            if ((char === '"' || char === "'") && !inQuotes && current === '' && (i === 0 || prevChar === separator)) {
                // Start of quoted field - don't add the quote to current
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar && inQuotes) {
                // Check if it's an escaped quote (two quotes in a row)
                if (nextChar === quoteChar) {
                    current += quoteChar;
                    i++; // Skip the next quote
                } else {
                    // End of quoted field - don't add the quote to current
                    inQuotes = false;
                    quoteChar = null;
                }
            } else if (char === separator && !inQuotes) {
                // Field separator
                result.push(current.trim());
                current = '';
            } else {
                // Regular character (including apostrophes in unquoted fields)
                current += char;
            }
        }
        
        // Push the last field
        result.push(current.trim());
        
        return result;
    }
    
    /**
     * Generate Auto-Correction Report (Internal Use Only)
     * Shows what was auto-corrected for each field
     * This is NOT for Verra - it's for internal tracking only
     */
    static exportAutoCorrectionReport() {
        console.log('📊 Generating Auto-Correction Report...');
        
        const allFields = StorageService.getAllFields();
        
        // Filter only auto-corrected fields
        const autoCorrected = allFields.filter(field => 
            field.correction && field.correction.applied === true
        );
        
        if (autoCorrected.length === 0) {
            alert('No auto-corrected fields found. Run "Process All Fields" first.');
            return;
        }
        
        console.log(`Found ${autoCorrected.length} auto-corrected fields`);
        
        // Create detailed CSV report
        let csv = 'Field ID,Field Owner,Correction Method,Issues Fixed,Original Vertices,Corrected Vertices,Area (ha),Correction Date\n';
        
        autoCorrected.forEach(field => {
            const issuesFixed = [];
            
            // Determine what was fixed based on validation checks
            if (field.validation && field.validation.verra && field.validation.verra.checks) {
                const checks = field.validation.verra.checks;
                
                // Check what issues existed before correction
                if (checks.duplicateVertices && !checks.duplicateVertices.pass) {
                    issuesFixed.push('Duplicate vertices');
                }
                if (checks.closed && !checks.closed.pass) {
                    issuesFixed.push('Not closed');
                }
                if (checks.excessiveVertices && !checks.excessiveVertices.pass) {
                    issuesFixed.push('Excessive vertices');
                }
                if (checks.simple && !checks.simple.pass) {
                    issuesFixed.push('Simple self-intersection');
                }
            }
            
            // If no specific issues identified, use the correction method
            if (issuesFixed.length === 0 && field.correction.method) {
                issuesFixed.push(field.correction.method);
            }
            
            csv += `"${field.ccsFieldId}",`;
            csv += `"${field.fieldOwner || 'N/A'}",`;
            csv += `"${field.correction.method || 'Auto-correction'}",`;
            csv += `"${issuesFixed.join('; ')}",`;
            csv += `${field.originalCoordinates?.length || 0},`;
            csv += `${field.correctedCoordinates?.length || 0},`;
            csv += `${field.validation?.metrics?.areaHa?.toFixed(4) || 'N/A'},`;
            csv += `"${field.correction.timestamp || field.updatedAt || 'N/A'}"\n`;
        });
        
        // Add summary at the end
        csv += '\n\n--- SUMMARY ---\n';
        csv += `Total Auto-Corrected Fields,${autoCorrected.length}\n`;
        
        // Count correction methods
        const methodCounts = {};
        autoCorrected.forEach(field => {
            const method = field.correction.method || 'Unknown';
            methodCounts[method] = (methodCounts[method] || 0) + 1;
        });
        
        csv += '\nCorrection Methods:\n';
        Object.entries(methodCounts).forEach(([method, count]) => {
            csv += `${method},${count}\n`;
        });
        
        // Download the report
        this.downloadFile(
            csv,
            `auto_correction_report_${this.getTimestamp()}.csv`,
            'text/csv'
        );
        
        console.log('✅ Auto-Correction Report generated');
        console.log(`   Total auto-corrected: ${autoCorrected.length}`);
        console.log('   Methods used:', Object.keys(methodCounts).join(', '));
        
        // Show success message to user
        alert(`✅ Auto-Correction Report Downloaded!\n\n` +
              `Total auto-corrected fields: ${autoCorrected.length}\n\n` +
              `⚠️ INTERNAL USE ONLY - Do not share with Verra\n` +
              `This report is for your tracking purposes only.`);
    }
    
    // Download file helper
    static downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(link.href);
    }
    
    // Get timestamp for filenames
    static getTimestamp() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    }
    
    // Parse date from various CSV formats
    static parseDate(dateStr) {
        if (!dateStr) return null;
        
        // Format 1: "23.10.2025 15:37" (dd.mm.yyyy hh:mm)
        const ddmmyyyyMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})/);
        if (ddmmyyyyMatch) {
            const [_, day, month, year, hour, minute] = ddmmyyyyMatch;
            return new Date(year, month - 1, day, hour, minute);
        }
        
        // Format 2: ISO format "2025-10-23T15:37:00"
        const isoDate = new Date(dateStr);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }
        
        // Format 3: "10/23/2025 15:37" (mm/dd/yyyy hh:mm)
        const mmddyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
        if (mmddyyyyMatch) {
            const [_, month, day, year, hour, minute] = mmddyyyyMatch;
            return new Date(year, month - 1, day, hour, minute);
        }
        
        // Format 4: "2025-10-23" (yyyy-mm-dd)
        const yyyymmddMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (yyyymmddMatch) {
            const [_, year, month, day] = yyyymmddMatch;
            return new Date(year, month - 1, day);
        }
        
        return null;
    }
    
    // Export single field report
    static exportFieldReport(field) {
        const html = this.generateFieldReportHTML(field);
        this.downloadFile(
            html,
            `${field.ccsFieldId}_report_${this.getTimestamp()}.html`,
            'text/html'
        );
    }
    
    // Generate field report HTML
    static generateFieldReportHTML(field) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Field Report - ${field.ccsFieldId}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #2c3e50; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #34495e; color: white; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; }
        .badge-success { background: #27ae60; color: white; }
        .badge-danger { background: #e74c3c; color: white; }
    </style>
</head>
<body>
    <h1>Field Polygon Report</h1>
    <h2>${field.ccsFieldId}</h2>
    
    <table>
        <tr><th>Property</th><th>Value</th></tr>
        <tr><td>Owner</td><td>${field.fieldOwner || 'N/A'}</td></tr>
        <tr><td>Area</td><td>${field.validation?.areaHa?.toFixed(4)} ha</td></tr>
        <tr><td>Vertices</td><td>${field.originalCoordinates?.length || 0}</td></tr>
        <tr><td>Perimeter</td><td>${field.validation?.perimeterM?.toFixed(2)} m</td></tr>
        <tr><td>Valid</td><td><span class="badge ${field.validation?.isValid ? 'badge-success' : 'badge-danger'}">
            ${field.validation?.isValid ? 'Yes' : 'No'}</span></td></tr>
        <tr><td>Corrected</td><td>${field.correction?.applied ? 'Yes' : 'No'}</td></tr>
        <tr><td>Created</td><td>${new Date(field.createdAt).toLocaleString()}</td></tr>
    </table>
    
    <h3>Validation Details</h3>
    ${field.validation?.errors?.length > 0 ? 
        '<ul>' + field.validation.errors.map(e => `<li>${e}</li>`).join('') + '</ul>' : 
        '<p>No errors</p>'}
    
    ${field.validation?.warnings?.length > 0 ? 
        '<h4>Warnings:</h4><ul>' + field.validation.warnings.map(w => `<li>${w}</li>`).join('') + '</ul>' : 
        ''}
</body>
</html>`;
    }
}
