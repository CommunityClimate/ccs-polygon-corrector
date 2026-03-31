/**
 * Enhanced CSV Parser for Before/After GeoJSON Support
 * 
 * Handles CSV files with Original_GeoJSON and Corrected_GeoJSON columns
 * Automatically detects and parses both for before/after comparison views
 */

export class EnhancedCSVParser {
    /**
     * Parse CSV with GeoJSON columns
     * @param {string} csvText - Raw CSV text
     * @returns {Array} Parsed field objects with before/after geometry
     */
    static parseCSVWithGeoJSON(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV file is empty or invalid');
        }

        // Parse header
        const headers = this.parseCSVLine(lines[0]);
        
        // Check for GeoJSON columns
        const hasOriginalGeoJSON = headers.includes('Original_GeoJSON');
        const hasCorrect edGeoJSON = headers.includes('Corrected_GeoJSON');
        
        console.log('📊 CSV Structure detected:', {
            hasOriginalGeoJSON,
            hasCorrectedGeoJSON,
            totalColumns: headers.length
        });

        const fields = [];
        let parseErrors = 0;
        let beforeAfterCount = 0;

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            try {
                const values = this.parseCSVLine(lines[i]);
                if (values.length === 0 || !values[0]) continue;

                const field = {};
                
                // Map all columns
                headers.forEach((header, index) => {
                    field[header] = values[index] || '';
                });

                // Parse Original_GeoJSON
                if (hasOriginalGeoJSON && field.Original_GeoJSON) {
                    try {
                        const cleanJSON = this.cleanGeoJSON(field.Original_GeoJSON);
                        const geojson = JSON.parse(cleanJSON);
                        field.originalGeometry = geojson;
                        field.hasOriginal = true;
                    } catch (err) {
                        console.warn(`Failed to parse Original_GeoJSON for ${field['Field ID']}:`, err.message);
                        field.hasOriginal = false;
                    }
                }

                // Parse Corrected_GeoJSON
                if (hasCorrectedGeoJSON && field.Corrected_GeoJSON) {
                    try {
                        const cleanJSON = this.cleanGeoJSON(field.Corrected_GeoJSON);
                        const geojson = JSON.parse(cleanJSON);
                        field.correctedGeometry = geojson;
                        field.hasCorrected = true;
                    } catch (err) {
                        console.warn(`Failed to parse Corrected_GeoJSON for ${field['Field ID']}:`, err.message);
                        field.hasCorrected = false;
                    }
                }

                // Determine if this field has before/after capability
                field.hasBeforeAfter = field.hasOriginal && field.hasCorrected;
                if (field.hasBeforeAfter) {
                    beforeAfterCount++;
                }

                // Parse manual flags
                field.manualFlags = {
                    selfIntersection: field.Manual_Flag_Self_Intersection === 'TRUE',
                    straightLine: field.Manual_Flag_Straight_Line === 'TRUE',
                    bowTie: field.Manual_Flag_Bow_Tie === 'TRUE',
                    otherIssue: field.Manual_Flag_Other === 'TRUE'
                };

                // Store original CSV data
                field.ccsFieldId = field['Field ID'];
                field.owner = field['Owner'];
                field.area = field['Area (ha)'];
                field.vertices = parseInt(field['Vertices']) || 0;
                field.valid = field['Valid'] === 'Yes';
                field.corrected = field['Corrected'] === 'Yes';
                field.correctionMethod = field['Correction_Method'];

                fields.push(field);

            } catch (err) {
                parseErrors++;
                console.error(`Error parsing line ${i + 1}:`, err.message);
            }
        }

        console.log('✅ CSV Parsing complete:', {
            totalFields: fields.length,
            beforeAfterCapable: beforeAfterCount,
            parseErrors
        });

        return fields;
    }

    /**
     * Clean GeoJSON string (remove CSV escaping)
     * @param {string} geoJsonStr - Raw GeoJSON string from CSV
     * @returns {string} Clean JSON string
     */
    static cleanGeoJSON(geoJsonStr) {
        if (!geoJsonStr || geoJsonStr.trim() === '') {
            return null;
        }

        // Remove outer quotes if present
        let clean = geoJsonStr.trim();
        if (clean.startsWith('"') && clean.endsWith('"')) {
            clean = clean.slice(1, -1);
        }

        // Replace double-double quotes with single quotes (CSV escaping)
        clean = clean.replace(/""/g, '"');

        return clean;
    }

    /**
     * Parse a CSV line handling quoted fields
     * @param {string} line - CSV line
     * @returns {Array} Parsed values
     */
    static parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote
                    current += '"';
                    i++; // Skip next quote
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // Field separator
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }

        // Push last value
        values.push(current);

        return values;
    }

    /**
     * Get statistics about the parsed data
     * @param {Array} fields - Parsed fields
     * @returns {Object} Statistics
     */
    static getStatistics(fields) {
        const stats = {
            total: fields.length,
            hasOriginal: 0,
            hasCorrected: 0,
            hasBeforeAfter: 0,
            flags: {
                selfIntersection: 0,
                straightLine: 0,
                bowTie: 0,
                otherIssue: 0
            }
        };

        fields.forEach(field => {
            if (field.hasOriginal) stats.hasOriginal++;
            if (field.hasCorrected) stats.hasCorrected++;
            if (field.hasBeforeAfter) stats.hasBeforeAfter++;

            if (field.manualFlags?.selfIntersection) stats.flags.selfIntersection++;
            if (field.manualFlags?.straightLine) stats.flags.straightLine++;
            if (field.manualFlags?.bowTie) stats.flags.bowTie++;
            if (field.manualFlags?.otherIssue) stats.flags.otherIssue++;
        });

        return stats;
    }
}

// Console logging helper
window.logCSVStats = function(fields) {
    const stats = EnhancedCSVParser.getStatistics(fields);
    console.log('📊 CSV Data Statistics:');
    console.log(`   Total fields: ${stats.total}`);
    console.log(`   Has Original GeoJSON: ${stats.hasOriginal}`);
    console.log(`   Has Corrected GeoJSON: ${stats.hasCorrected}`);
    console.log(`   Before/After Capable: ${stats.hasBeforeAfter} ✅`);
    console.log(`   Manual Flags:`);
    console.log(`     Self-Intersection: ${stats.flags.selfIntersection}`);
    console.log(`     Straight-Line: ${stats.flags.straightLine}`);
    console.log(`     Bow-Tie: ${stats.flags.bowTie}`);
    console.log(`     Other: ${stats.flags.otherIssue}`);
    return stats;
};
