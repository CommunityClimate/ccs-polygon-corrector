// Export Service - Import/Export Handlers
import { APP_CONFIG } from '../config/app-config.js';
import { StorageService } from './storage-service.js';
import { GeoUtils } from '../utils/geo-utils.js';

export class ExportService {
    
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
        
        // Add Polygon Created column (from original CSV "Created On")
        let csv = 'Field ID,Owner,Area (ha),Vertices,Valid,Corrected,Polygon Created,System Imported,Last Updated,GeoJSON\n';
        
        data.forEach(field => {
            const coords = field.correctedCoordinates || field.originalCoordinates;
            
            // Create GeoJSON geometry object
            const geojson = {
                type: 'Polygon',
                coordinates: [coords]
            };
            
            csv += `"${field.ccsFieldId}",`;
            csv += `"${field.fieldOwner || ''}",`;
            csv += `${field.validation?.areaHa?.toFixed(4) || ''},`;
            csv += `${field.originalCoordinates?.length || 0},`;
            csv += `${field.validation?.isValid ? 'Yes' : 'No'},`;
            csv += `${field.correction?.applied ? 'Yes' : 'No'},`;
            csv += `${field.polygonCreatedOn || ''},`; // ADDED: Polygon creation date from CSV
            csv += `${field.createdAt || ''},`; // System import date
            csv += `${field.updatedAt || ''},`; // Last update date
            csv += `"${JSON.stringify(geojson).replace(/"/g, '""')}"\n`; // Escape quotes for CSV
        });
        
        this.downloadFile(
            csv,
            `${APP_CONFIG.EXPORT.FILENAME_PREFIX}_${this.getTimestamp()}.csv`,
            'text/csv'
        );
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
    static async importFromFile(file, onProgress = null) {
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
                        const result = await this.parseCSV(content, onProgress);
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
    static async parseCSV(content, onProgress = null) {
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length === 0) {
            return { success: false, error: 'Empty CSV file' };
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, '').toLowerCase());
        
        console.log('CSV Headers detected:', headers);
        console.log(`Total rows to process: ${lines.length - 1}`);
        
        // Detect CSV format based on column names from original HTML
        const geoJsonColumns = ['field geojson', 'field esrijson', 'geojson', 'geometry', 'field_geojson', 'geojson data'];
        const hasGeoJSON = headers.some(h => geoJsonColumns.includes(h) || h.includes('geojson') || h.includes('geometry'));
        
        const hasCoordinates = headers.includes('latitude') && headers.includes('longitude');
        const hasWKT = headers.includes('wkt');
        
        // Format 1: GeoJSON format (PRIORITY - matches original HTML)
        if (hasGeoJSON) {
            console.log('Detected CSV format: GeoJSON/Geometry column');
            return await this.parseCSVGeoJSONFormat(lines, headers, onProgress);
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
    static async parseCSVGeoJSONFormat(lines, headers, onProgress = null) {
        const fieldIdIdx = headers.findIndex(h => h.includes('field') && h.includes('id') || h === 'ccs_field_id' || h === 'ccs field id' || h === 'fieldid');
        const ownerIdx = headers.findIndex(h => h.includes('owner') || h === 'field_owner' || h === 'fieldowner' || h === 'field owner');
        
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
        
        console.log(`Column indices - Field ID: ${fieldIdIdx}, Owner: ${ownerIdx}, Created On: ${createdOnIdx}`);
        
        // Look for GeoJSON column with exact names from original HTML
        const geoJsonColumnNames = ['field geojson', 'field esrijson', 'geojson', 'geometry', 'field_geojson', 'geojson data'];
        let geoIdx = -1;
        
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
        
        const totalRows = lines.length - 1; // Exclude header
        let successCount = 0;
        let errorCount = 0;
        let emptyCount = 0;
        
        const parsedFields = []; // PERFORMANCE: Accumulate all fields
        const failedRecords = []; // NEW: Track parse failures with details
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
                        
                        // NEW: Capture empty GeoJSON as failed record
                        const failedRecord = {
                            ccsFieldId: fieldIdIdx >= 0 ? values[fieldIdIdx] : `UNKNOWN_ROW_${i}`,
                            fieldOwner: ownerIdx >= 0 ? values[ownerIdx] : '',
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
                        
                        failedRecords.push(failedRecord);
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
                        
                        // NEW: Capture invalid coordinates as failed record
                        const failedRecord = {
                            ccsFieldId: fieldIdIdx >= 0 ? values[fieldIdIdx] : `UNKNOWN_ROW_${i}`,
                            fieldOwner: ownerIdx >= 0 ? values[ownerIdx] : '',
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
                        
                        failedRecords.push(failedRecord);
                        continue;
                    }
                    
                    // CRITICAL: Convert GeoJSON [lng, lat] to Leaflet [lat, lng] format
                    // This matches the original HTML behavior
                    const leafletCoordinates = coordinates.map(coord => [coord[1], coord[0]]);
                    
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
                    
                    const field = {
                        ccsFieldId: fieldIdIdx >= 0 ? values[fieldIdIdx] : `FIELD_${Date.now()}_${i}`,
                        fieldOwner: ownerIdx >= 0 ? values[ownerIdx] : '',
                        originalCoordinates: leafletCoordinates,  // NOW IN LEAFLET FORMAT
                        polygonCreatedOn: polygonCreatedOn,  // ADDED: Actual polygon creation date
                        createdAt: new Date().toISOString(),  // System import date
                        validation: {},
                        correction: {}
                    };
                    
                    parsedFields.push(field);
                    successCount++;
                } catch (error) {
                    errorCount++;
                    
                    // NEW: Capture the failed record with error details
                    const errorInfo = categorizeError(error, values[geoIdx], null);
                    
                    const failedRecord = {
                        ccsFieldId: fieldIdIdx >= 0 ? values[fieldIdIdx] : `UNKNOWN_ROW_${i}`,
                        fieldOwner: ownerIdx >= 0 ? values[ownerIdx] : '',
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
                    
                    failedRecords.push(failedRecord);
                    
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
        
        console.log(`CSV Import complete: ${successCount} successful, ${errorCount} errors, ${emptyCount} empty`);
        console.log(`Failed records captured: ${failedRecords.length}`);
        
        // Bulk save all parsed fields at once
        console.log(`Bulk saving ${parsedFields.length} fields...`);
        StorageService.bulkSaveFields(parsedFields);
        
        // NEW: Save failed records separately
        if (failedRecords.length > 0) {
            console.log(`Saving ${failedRecords.length} failed records...`);
            StorageService.bulkSaveFailedRecords(failedRecords);
        }
        
        return { 
            success: true, 
            count: successCount, 
            errors: errorCount,
            empty: emptyCount,
            total: totalRows,
            failedRecords: failedRecords  // NEW: Include failed records in result
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
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            // Handle quote characters
            if ((char === '"' || char === "'") && !inQuotes) {
                // Start of quoted field
                inQuotes = true;
                quoteChar = char;
            } else if (char === quoteChar && inQuotes) {
                // Check if it's an escaped quote (two quotes in a row)
                if (nextChar === quoteChar) {
                    current += quoteChar;
                    i++; // Skip the next quote
                } else {
                    // End of quoted field
                    inQuotes = false;
                    quoteChar = null;
                }
            } else if (char === ',' && !inQuotes) {
                // Field separator
                result.push(current.trim());
                current = '';
            } else {
                // Regular character
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
