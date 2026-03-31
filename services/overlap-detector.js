// Overlap Detector - Detect overlapping polygons with spatial indexing
// VERSION: 1.0
console.log("🔄 OverlapDetector loaded");

import { GeoUtils } from '../utils/geo-utils.js';

export class OverlapDetector {
    
    /**
     * Detect overlaps among all fields using spatial indexing for performance
     * @param {Array} allFields - Array of all field objects
     * @returns {Map} - Map of fieldId -> array of overlapping field IDs
     */
    static detectOverlaps(allFields) {
        console.log(`🔄 Starting overlap detection for ${allFields.length} fields...`);
        const startTime = performance.now();
        
        // Result: Map of fieldId -> [overlapping field IDs]
        const overlaps = new Map();
        
        try {
            // Step 1: Build spatial index (grid-based)
            const spatialIndex = this.buildSpatialIndex(allFields);
            
            // Step 2: Check each field against nearby fields only
            let comparisons = 0;
            let overlapsFound = 0;
            
            allFields.forEach((fieldA, indexA) => {
                const fieldIdA = fieldA.ccsFieldId;
                const coordsA = fieldA.originalCoordinates || fieldA.coordinates;
                
                // Safety check
                if (!coordsA || !Array.isArray(coordsA) || coordsA.length < 3) {
                    return;
                }
                
                // Validate coordinate format
                if (!this.validateCoordinates(coordsA)) {
                    return;
                }
                
                // Get bounding box for field A
                const bboxA = this.getBoundingBox(coordsA);
                
                // Get nearby fields from spatial index
                const nearbyFields = this.getNearbyFields(fieldIdA, bboxA, spatialIndex);
                
                // Check against nearby fields only
                nearbyFields.forEach(fieldB => {
                    const fieldIdB = fieldB.ccsFieldId;
                    
                    // Skip if same field or already checked (A vs B == B vs A)
                    if (fieldIdA === fieldIdB) return;
                    if (overlaps.has(fieldIdB) && overlaps.get(fieldIdB).includes(fieldIdA)) return;
                    
                    const coordsB = fieldB.originalCoordinates || fieldB.coordinates;
                    if (!coordsB || !Array.isArray(coordsB) || coordsB.length < 3) return;
                    
                    // Validate coordinate format
                    if (!this.validateCoordinates(coordsB)) {
                        return;
                    }
                    
                    comparisons++;
                    
                    // Get bounding box for field B
                    const bboxB = this.getBoundingBox(coordsB);
                    
                    // Quick bounding box check first
                    if (this.bboxOverlap(bboxA, bboxB)) {
                        // Bounding boxes overlap - do detailed polygon check
                        if (this.polygonsOverlap(coordsA, coordsB)) {
                            // Found overlap!
                            overlapsFound++;
                            
                            // Store bidirectional overlap
                            if (!overlaps.has(fieldIdA)) {
                                overlaps.set(fieldIdA, []);
                            }
                            overlaps.get(fieldIdA).push(fieldIdB);
                            
                            if (!overlaps.has(fieldIdB)) {
                                overlaps.set(fieldIdB, []);
                            }
                            overlaps.get(fieldIdB).push(fieldIdA);
                        }
                    }
                });
            });
            
            const endTime = performance.now();
            const duration = ((endTime - startTime) / 1000).toFixed(2);
            
            console.log(`✅ Overlap detection complete in ${duration}s`);
            console.log(`   Comparisons: ${comparisons.toLocaleString()} (vs ${(allFields.length * allFields.length).toLocaleString()} naive)`);
            console.log(`   Overlaps found: ${overlapsFound}`);
            console.log(`   Fields affected: ${overlaps.size}`);
            
        } catch (error) {
            console.error('❌ Error during overlap detection:', error);
            console.error('   Stack:', error.stack);
            // Return empty map on error
        }
        
        return overlaps;
    }
    
    /**
     * Validate coordinate format
     */
    static validateCoordinates(coords) {
        if (!coords || !Array.isArray(coords)) return false;
        
        for (let i = 0; i < coords.length; i++) {
            const coord = coords[i];
            if (!Array.isArray(coord) || coord.length !== 2) return false;
            if (typeof coord[0] !== 'number' || typeof coord[1] !== 'number') return false;
            if (isNaN(coord[0]) || isNaN(coord[1])) return false;
        }
        
        return true;
    }
    
    /**
     * Build spatial index - divide map into grid cells
     */
    static buildSpatialIndex(allFields) {
        const GRID_SIZE = 0.01; // ~1km at equator
        const index = new Map();
        
        allFields.forEach(field => {
            try {
                const coords = field.originalCoordinates || field.coordinates;
                if (!coords || !Array.isArray(coords) || coords.length < 3) return;
                
                // Validate coordinates
                if (!this.validateCoordinates(coords)) return;
                
                const bbox = this.getBoundingBox(coords);
                
                // Get all grid cells this field touches
                const minCellX = Math.floor(bbox.minLng / GRID_SIZE);
                const maxCellX = Math.floor(bbox.maxLng / GRID_SIZE);
                const minCellY = Math.floor(bbox.minLat / GRID_SIZE);
                const maxCellY = Math.floor(bbox.maxLat / GRID_SIZE);
                
                // Add field to all cells it touches
                for (let x = minCellX; x <= maxCellX; x++) {
                    for (let y = minCellY; y <= maxCellY; y++) {
                        const cellKey = `${x},${y}`;
                        if (!index.has(cellKey)) {
                            index.set(cellKey, []);
                        }
                        index.get(cellKey).push(field);
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Error indexing field ${field.ccsFieldId}:`, error.message);
            }
        });
        
        return index;
    }
    
    /**
     * Get nearby fields from spatial index
     */
    static getNearbyFields(excludeFieldId, bbox, spatialIndex) {
        const GRID_SIZE = 0.01;
        const nearby = new Set();
        
        const minCellX = Math.floor(bbox.minLng / GRID_SIZE);
        const maxCellX = Math.floor(bbox.maxLng / GRID_SIZE);
        const minCellY = Math.floor(bbox.minLat / GRID_SIZE);
        const maxCellY = Math.floor(bbox.maxLat / GRID_SIZE);
        
        for (let x = minCellX; x <= maxCellX; x++) {
            for (let y = minCellY; y <= maxCellY; y++) {
                const cellKey = `${x},${y}`;
                const cellFields = spatialIndex.get(cellKey) || [];
                cellFields.forEach(field => {
                    if (field.ccsFieldId !== excludeFieldId) {
                        nearby.add(field);
                    }
                });
            }
        }
        
        return Array.from(nearby);
    }
    
    /**
     * Get bounding box for coordinates
     */
    static getBoundingBox(coords) {
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        
        coords.forEach(coord => {
            // Safe access - handle both [lat, lng] and [lng, lat] formats
            const lat = coord[0];
            const lng = coord[1];
            
            if (typeof lat === 'number' && typeof lng === 'number' && 
                !isNaN(lat) && !isNaN(lng)) {
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
            }
        });
        
        return { minLat, maxLat, minLng, maxLng };
    }
    
    /**
     * Check if two bounding boxes overlap
     */
    static bboxOverlap(bboxA, bboxB) {
        return !(bboxA.maxLat < bboxB.minLat || 
                 bboxA.minLat > bboxB.maxLat || 
                 bboxA.maxLng < bboxB.minLng || 
                 bboxA.minLng > bboxB.maxLng);
    }
    
    /**
     * Check if two polygons overlap (TRUE overlap, not just touching)
     * Returns true only if polygons share interior area
     */
    static polygonsOverlap(coordsA, coordsB) {
        // Strategy: A polygon truly overlaps if ANY interior vertex of one 
        // is inside the other (not on boundary)
        
        // Check if any INTERIOR points of A are inside B
        const numPointsToCheck = Math.min(coordsA.length, 5); // Check first 5 points
        for (let i = 0; i < numPointsToCheck; i++) {
            const point = coordsA[i];
            const isInside = this.pointInPolygonStrict(point, coordsB);
            if (isInside) {
                return true; // True overlap - point of A is inside B
            }
        }
        
        // Check if any INTERIOR points of B are inside A
        for (let i = 0; i < numPointsToCheck; i++) {
            const point = coordsB[i];
            const isInside = this.pointInPolygonStrict(point, coordsA);
            if (isInside) {
                return true; // True overlap - point of B is inside A
            }
        }
        
        // No interior points inside each other = no true overlap
        return false;
    }
    
    /**
     * STRICT point-in-polygon test
     * Returns true ONLY if point is in interior (not on boundary)
     */
    static pointInPolygonStrict(point, polygon) {
        const x = point[0];
        const y = point[1];
        
        // First check if point is ON any edge (boundary)
        // If so, return false (not interior)
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            const xi = polygon[i][0];
            const yi = polygon[i][1];
            const xj = polygon[j][0];
            const yj = polygon[j][1];
            
            // Check if point is on this edge
            if (this.pointOnSegment(point, polygon[i], polygon[j])) {
                return false; // On boundary, not interior
            }
        }
        
        // Now do standard ray casting for interior check
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0];
            const yi = polygon[i][1];
            const xj = polygon[j][0];
            const yj = polygon[j][1];
            
            const intersect = ((yi > y) !== (yj > y)) &&
                            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
    
    /**
     * Check if point is on a line segment
     */
    static pointOnSegment(point, segStart, segEnd) {
        const px = point[0];
        const py = point[1];
        const x1 = segStart[0];
        const y1 = segStart[1];
        const x2 = segEnd[0];
        const y2 = segEnd[1];
        
        // Calculate distance from point to line segment
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;
        
        if (lengthSquared === 0) {
            // Segment is a point
            return Math.abs(px - x1) < 1e-9 && Math.abs(py - y1) < 1e-9;
        }
        
        // Calculate parameter t (projection of point onto line)
        const t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        
        // Check if projection is on segment (not beyond endpoints)
        if (t < 0 || t > 1) {
            return false; // Projection is outside segment
        }
        
        // Calculate closest point on segment
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;
        
        // Check if point is very close to segment (within tolerance)
        const distance = Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
        return distance < 1e-9; // Very small tolerance for "on boundary"
    }
}
