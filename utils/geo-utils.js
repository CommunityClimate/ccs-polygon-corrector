// Geospatial Utilities - TurfJS Wrappers and Helpers
import { APP_CONFIG } from '../config/app-config.js';

// Access Turf.js from global scope (loaded via CDN in HTML)
const turf = window.turf;

export class GeoUtils {
    
    // Calculate area in hectares
    static calculateArea(coordinates) {
        try {
            // Validate coordinates before calculating area
            if (!coordinates || coordinates.length < 3) {
                // Silently return 0 for invalid polygons (too few vertices)
                return 0;
            }
            
            const polygon = turf.polygon([coordinates]);
            const areaM2 = turf.area(polygon);
            return areaM2 / 10000; // Convert to hectares
        } catch (error) {
            // Gracefully handle polygons that don't meet Turf.js requirements
            if (error.message && error.message.includes('4 or more Positions')) {
                // Polygon has too few vertices (< 4) - this is a data quality issue
                // Don't log each one to avoid console spam
                return 0;
            }
            // Log other unexpected errors
            console.error('Error calculating area:', error);
            return 0;
        }
    }
    
    // Calculate perimeter in meters
    static calculatePerimeter(coordinates) {
        try {
            const lineString = turf.lineString([...coordinates, coordinates[0]]);
            return turf.length(lineString, { units: 'meters' });
        } catch (error) {
            console.error('Error calculating perimeter:', error);
            return 0;
        }
    }
    
    // Check if polygon is self-intersecting
    static hasSelfIntersection(coordinates) {
        try {
            const polygon = turf.polygon([coordinates]);
            const kinks = turf.kinks(polygon);
            return kinks.features.length > 0;
        } catch (error) {
            return false;
        }
    }
    
    // Get self-intersection points
    static getSelfIntersectionPoints(coordinates) {
        try {
            const polygon = turf.polygon([coordinates]);
            const kinks = turf.kinks(polygon);
            return kinks.features.map(f => f.geometry.coordinates);
        } catch (error) {
            return [];
        }
    }
    
    // Calculate centroid
    static getCentroid(coordinates) {
        try {
            const polygon = turf.polygon([coordinates]);
            const centroid = turf.centroid(polygon);
            return centroid.geometry.coordinates;
        } catch (error) {
            return null;
        }
    }
    
    // Simplify polygon using Douglas-Peucker
    static simplifyPolygon(coordinates, tolerance = APP_CONFIG.CORRECTION.DOUGLAS_PEUCKER_TOLERANCE) {
        try {
            const polygon = turf.polygon([coordinates]);
            const simplified = turf.simplify(polygon, { tolerance, highQuality: true });
            return simplified.geometry.coordinates[0];
        } catch (error) {
            console.error('Error simplifying polygon:', error);
            return coordinates;
        }
    }
    
    // Buffer polygon
    static bufferPolygon(coordinates, distance = APP_CONFIG.CORRECTION.BUFFER_DISTANCE) {
        try {
            const polygon = turf.polygon([coordinates]);
            const buffered = turf.buffer(polygon, distance, { units: 'degrees' });
            return buffered.geometry.coordinates[0];
        } catch (error) {
            console.error('Error buffering polygon:', error);
            return coordinates;
        }
    }
    
    // Clean polygon (remove duplicates and ensure closure)
    static cleanPolygon(coordinates) {
        let cleaned = [...coordinates];
        
        // Remove duplicate consecutive points
        cleaned = cleaned.filter((coord, index, arr) => {
            if (index === 0) return true;
            const prev = arr[index - 1];
            return !(coord[0] === prev[0] && coord[1] === prev[1]);
        });
        
        // Ensure polygon is closed
        if (cleaned.length > 0) {
            const first = cleaned[0];
            const last = cleaned[cleaned.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                cleaned.push([first[0], first[1]]);
            }
        }
        
        return cleaned;
    }
    
    // Check if polygon is valid
    static isValidPolygon(coordinates) {
        try {
            const polygon = turf.polygon([coordinates]);
            return turf.booleanValid(polygon);
        } catch (error) {
            return false;
        }
    }
    
    // Calculate angle between three points
    static calculateAngle(p1, p2, p3) {
        const angle1 = Math.atan2(p1[1] - p2[1], p1[0] - p2[0]);
        const angle2 = Math.atan2(p3[1] - p2[1], p3[0] - p2[0]);
        let angle = Math.abs(angle1 - angle2) * (180 / Math.PI);
        if (angle > 180) angle = 360 - angle;
        return angle;
    }
    
    // Detect sharp angles (spikes)
    static detectSharpAngles(coordinates, thresholdDegrees = 10) {
        const spikes = [];
        
        for (let i = 1; i < coordinates.length - 1; i++) {
            const angle = this.calculateAngle(
                coordinates[i - 1],
                coordinates[i],
                coordinates[i + 1]
            );
            
            if (angle < thresholdDegrees) {
                spikes.push({
                    index: i,
                    angle: angle,
                    coordinate: coordinates[i]
                });
            }
        }
        
        return spikes;
    }
    
    // Calculate distance between two coordinates
    static distance(coord1, coord2) {
        const from = turf.point(coord1);
        const to = turf.point(coord2);
        return turf.distance(from, to, { units: 'meters' });
    }
    
    // Convert coordinates to GeoJSON
    static toGeoJSON(coordinates, properties = {}) {
        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [coordinates]
            },
            properties: properties
        };
    }
    
    // Convert GeoJSON to coordinates
    static fromGeoJSON(geojson) {
        if (geojson.type === 'Feature') {
            return geojson.geometry.coordinates[0];
        } else if (geojson.type === 'Polygon') {
            return geojson.coordinates[0];
        }
        return null;
    }
    
    // Get bounding box
    static getBoundingBox(coordinates) {
        try {
            const polygon = turf.polygon([coordinates]);
            const bbox = turf.bbox(polygon);
            return {
                minLng: bbox[0],
                minLat: bbox[1],
                maxLng: bbox[2],
                maxLat: bbox[3]
            };
        } catch (error) {
            return null;
        }
    }
    
    // Format coordinate for display
    static formatCoordinate(coord, precision = 6) {
        return `${coord[1].toFixed(precision)}, ${coord[0].toFixed(precision)}`;
    }
    
    // Parse coordinate string
    static parseCoordinate(str) {
        const parts = str.split(',').map(p => parseFloat(p.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return [parts[1], parts[0]]; // [lng, lat]
        }
        return null;
    }
    
    /**
     * Buffer correction - fixes self-intersections using small buffer
     * Returns corrected coordinates or null if correction fails
     */
    static bufferCorrection(coordinates, bufferSize = 0.00001) {
        try {
            // Ensure polygon is closed
            const closedCoords = this.ensureClosed(coordinates);
            const polygon = turf.polygon([closedCoords]);
            
            // Apply small buffer (shrink and expand)
            const buffered = turf.buffer(polygon, -bufferSize, { units: 'degrees' });
            if (!buffered) return null;
            
            const expanded = turf.buffer(buffered, bufferSize, { units: 'degrees' });
            if (!expanded) return null;
            
            // Extract coordinates from buffered polygon
            const correctedCoords = expanded.geometry.coordinates[0];
            
            // Remove last point if it's a duplicate of first (turf adds closure)
            if (correctedCoords.length > 1) {
                const first = correctedCoords[0];
                const last = correctedCoords[correctedCoords.length - 1];
                if (first[0] === last[0] && first[1] === last[1]) {
                    return correctedCoords.slice(0, -1);
                }
            }
            
            return correctedCoords;
        } catch (error) {
            console.error('Buffer correction failed:', error);
            return null;
        }
    }
    
    /**
     * Ensure polygon is closed (first point = last point)
     */
    static ensureClosed(coordinates) {
        if (coordinates.length < 2) return coordinates;
        
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        
        if (first[0] === last[0] && first[1] === last[1]) {
            return coordinates;
        }
        
        return [...coordinates, [first[0], first[1]]];
    }
    
    /**
     * Check if polygon is clockwise (uses signed area method)
     * Counter-clockwise = positive area (standard for outer rings)
     * Clockwise = negative area (standard for holes)
     */
    static isClockwise(coordinates) {
        if (coordinates.length < 3) return false;
        
        // Shoelace formula for polygon area (signed)
        // IMPORTANT: Our coordinates are [lat, lng] (Leaflet format)
        // Standard formula expects [x, y] or [lng, lat]
        // So we need to use lat as y and lng as x, which means swap indices
        let sum = 0;
        for (let i = 0; i < coordinates.length - 1; i++) {
            const curr = coordinates[i];
            const next = coordinates[i + 1];
            // Use [1] for x (lng) and [0] for y (lat) since our format is [lat, lng]
            sum += (next[1] - curr[1]) * (next[0] + curr[0]);
        }
        
        // Positive sum = clockwise in standard coordinate system
        // Negative sum = counter-clockwise
        return sum > 0;
    }
    
    /**
     * Reverse polygon coordinates (flips winding direction)
     */
    static reverseWinding(coordinates) {
        return [...coordinates].reverse();
    }
    
    /**
     * Ensure corrected polygon has same winding direction as original
     * CRITICAL for carbon credit validation!
     */
    static preserveWindingDirection(original, corrected) {
        const originalClockwise = this.isClockwise(original);
        const correctedClockwise = this.isClockwise(corrected);
        
        // If winding directions match, return as-is
        if (originalClockwise === correctedClockwise) {
            return corrected;
        }
        
        // If they don't match, reverse the corrected polygon
        return this.reverseWinding(corrected);
    }
}
