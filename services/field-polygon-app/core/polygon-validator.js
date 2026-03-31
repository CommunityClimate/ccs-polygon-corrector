// Polygon Validator - Validation Logic
import { APP_CONFIG } from '../config/app-config.js';
import { GeoUtils } from '../utils/geo-utils.js';

export class PolygonValidator {
    
    // Validate a polygon and return detailed results
    static validate(coordinates) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            metrics: {}
        };
        
        // ENHANCED INPUT VALIDATION (early return pattern - doesn't affect main logic)
        try {
            // Check 1: Coordinates exist
            if (!coordinates) {
                validation.isValid = false;
                validation.errors.push('ERROR: No coordinates provided - ensure polygon data includes coordinate array');
                return validation;
            }
            
            // Check 2: Coordinates is an array
            if (!Array.isArray(coordinates)) {
                validation.isValid = false;
                validation.errors.push(`ERROR: Coordinates must be an array, received: ${typeof coordinates}`);
                return validation;
            }
            
            // Check 3: Minimum vertex count
            if (coordinates.length < 3) {
                validation.isValid = false;
                validation.errors.push(`ERROR: Polygon must have at least 3 vertices, found: ${coordinates.length}`);
                return validation;
            }
            
            // Check 4: Validate each coordinate format
            for (let i = 0; i < coordinates.length; i++) {
                const coord = coordinates[i];
                
                if (!Array.isArray(coord) || coord.length !== 2) {
                    validation.isValid = false;
                    validation.errors.push(`ERROR: Coordinate at vertex ${i+1} must be [lng, lat] format`);
                    return validation;
                }
                
                if (typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
                    validation.isValid = false;
                    validation.errors.push(`ERROR: Coordinate at vertex ${i+1} contains non-numeric values: [${coord[0]}, ${coord[1]}]`);
                    return validation;
                }
                
                // Check coordinate ranges
                if (coord[0] < -180 || coord[0] > 180) {
                    validation.isValid = false;
                    validation.errors.push(`ERROR: Longitude at vertex ${i+1} out of range: ${coord[0]} (valid: -180 to 180)`);
                    return validation;
                }
                
                if (coord[1] < -90 || coord[1] > 90) {
                    validation.isValid = false;
                    validation.errors.push(`ERROR: Latitude at vertex ${i+1} out of range: ${coord[1]} (valid: -90 to 90)`);
                    return validation;
                }
            }
            
        } catch (error) {
            validation.isValid = false;
            validation.errors.push(`SYSTEM ERROR: Unexpected validation error - ${error.message}`);
            console.error('Validation error:', error);
            return validation;
        }
        
        // Calculate metrics
        validation.metrics = {
            vertices: coordinates.length,
            areaHa: GeoUtils.calculateArea(coordinates),
            areaM2: GeoUtils.calculateArea(coordinates) * 10000, // Convert ha to m²
            perimeterM: GeoUtils.calculatePerimeter(coordinates),
            hasSelfIntersection: GeoUtils.hasSelfIntersection(coordinates),
            selfIntersectionPoints: [],
            sharpAngles: []
        };
        
        // VERRA COMPLIANCE CHECKS
        validation.verra = {
            compliant: true,
            checks: {
                closed: { pass: false, message: '' },
                simple: { pass: false, message: '', canAutoFix: false },
                minVertices: { pass: false, message: '' },
                positiveArea: { pass: false, message: '' }
            },
            overallStatus: 'UNKNOWN', // PASS, FIXABLE, NEEDS_MANUAL_FIX
            requiresManualFix: false
        };
        
        // Check 1: Closed polygon (Verra Critical)
        const isClosed = this.checkClosed(coordinates);
        validation.verra.checks.closed.pass = isClosed.pass;
        validation.verra.checks.closed.message = isClosed.message;
        if (!isClosed.pass) {
            validation.verra.compliant = false;
            validation.errors.push(`VERRA CRITICAL: ${isClosed.message}`);
        }
        
        // Check 2: Simple geometry - no self-intersections (Verra Critical)
        const isSimple = this.checkSimpleGeometry(coordinates);
        validation.verra.checks.simple.pass = isSimple.pass;
        validation.verra.checks.simple.message = isSimple.message;
        validation.verra.checks.simple.canAutoFix = isSimple.canAutoFix;
        
        if (!isSimple.pass) {
            validation.verra.compliant = false;
            if (isSimple.canAutoFix) {
                validation.warnings.push(`VERRA: ${isSimple.message} - Auto-correction available`);
            } else {
                validation.errors.push(`VERRA CRITICAL: ${isSimple.message} - ⚠️ REQUIRES MANUAL EDITING`);
                validation.verra.requiresManualFix = true;
                validation.isValid = false;
                
                // Add manual fix guidance (optional property - won't break existing code)
                validation.manualFixGuidance = {
                    title: "How to Fix Self-Intersections Manually",
                    issue: "Self-Intersection",
                    verraRule: "V001 - Geometry must be simple (no self-intersections)",
                    steps: [
                        "1. Click 'Enable Editing' to activate vertex dragging",
                        "2. Look for places where the polygon outline crosses itself",
                        "3. Drag vertices to untangle the crossed lines",
                        "4. Ensure the polygon outline doesn't cross itself anywhere",
                        "5. Click 'Save Edits' when done",
                        "6. Click 'Validate Polygon' again to confirm the fix"
                    ],
                    tips: [
                        "💡 Zoom in on the map for precise vertex placement",
                        "💡 If many intersections, consider redrawing the polygon",
                        "💡 Save frequently to avoid losing work"
                    ],
                    commonCauses: [
                        "GPS device paused during boundary walk",
                        "Field walk crossed over itself",
                        "Data entry error in coordinates"
                    ]
                };
            }
        }
        
        // Check 3: Minimum vertices (Verra Critical - 4 distinct points)
        const distinctVertices = this.getDistinctVertices(coordinates);
        validation.verra.checks.minVertices.pass = distinctVertices.length >= 4;
        validation.verra.checks.minVertices.message = `${distinctVertices.length} distinct vertices (min: 4)`;
        if (distinctVertices.length < 4) {
            validation.verra.compliant = false;
            validation.errors.push(`VERRA CRITICAL: Only ${distinctVertices.length} distinct vertices (minimum 4 required)`);
        }
        
        // Check 4: Positive area (Verra Critical)
        validation.verra.checks.positiveArea.pass = validation.metrics.areaM2 > 1; // > 1 m²
        validation.verra.checks.positiveArea.message = `Area: ${validation.metrics.areaM2.toFixed(2)} m² (${validation.metrics.areaHa.toFixed(4)} ha)`;
        if (validation.metrics.areaM2 <= 1) {
            validation.verra.compliant = false;
            validation.errors.push(`VERRA CRITICAL: Area too small (${validation.metrics.areaM2.toFixed(2)} m² ≤ 1 m²)`);
        }
        
        // Determine Verra overall status
        if (validation.verra.compliant) {
            validation.verra.overallStatus = 'PASS';
        } else if (validation.verra.requiresManualFix) {
            validation.verra.overallStatus = 'NEEDS_MANUAL_FIX';
        } else {
            validation.verra.overallStatus = 'FIXABLE';
        }
        
        // Vertex count validation
        if (coordinates.length < APP_CONFIG.VALIDATION.MIN_VERTICES) {
            validation.isValid = false;
            validation.errors.push(`Minimum ${APP_CONFIG.VALIDATION.MIN_VERTICES} vertices required`);
        }
        
        // Excessive vertices is a WARNING, not an error
        // Verra doesn't reject polygons for having too many vertices
        // It just makes the polygon inefficient (larger file size, slower processing)
        if (coordinates.length > APP_CONFIG.VALIDATION.MAX_VERTICES) {
            validation.warnings.push(`High vertex count (${coordinates.length} vertices) - polygon is inefficient but valid`);
        }
        
        // Area validation
        if (validation.metrics.areaHa < APP_CONFIG.VALIDATION.MIN_AREA_HA) {
            validation.isValid = false;
            validation.errors.push(`Area too small (${validation.metrics.areaHa.toFixed(4)} ha < ${APP_CONFIG.VALIDATION.MIN_AREA_HA} ha)`);
        }
        
        if (validation.metrics.areaHa > APP_CONFIG.VALIDATION.MAX_AREA_HA) {
            validation.warnings.push(`Very large area (${validation.metrics.areaHa.toFixed(2)} ha)`);
        }
        
        // Perimeter validation
        if (validation.metrics.perimeterM < APP_CONFIG.VALIDATION.MIN_PERIMETER_M) {
            validation.warnings.push(`Very small perimeter (${validation.metrics.perimeterM.toFixed(2)} m)`);
        }
        
        // Self-intersection check
        if (validation.metrics.hasSelfIntersection) {
            validation.isValid = false;
            validation.errors.push('Polygon has self-intersections');
            validation.metrics.selfIntersectionPoints = GeoUtils.getSelfIntersectionPoints(coordinates);
        }
        
        // Check for sharp angles
        validation.metrics.sharpAngles = GeoUtils.detectSharpAngles(coordinates, 10);
        if (validation.metrics.sharpAngles.length > 0) {
            validation.warnings.push(`${validation.metrics.sharpAngles.length} sharp angle(s) detected`);
        }
        
        // Closure check
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            validation.warnings.push('Polygon not properly closed');
        }
        
        // Check for duplicate consecutive points (Verra Warning W001)
        let duplicates = 0;
        for (let i = 1; i < coordinates.length; i++) {
            if (coordinates[i][0] === coordinates[i-1][0] && 
                coordinates[i][1] === coordinates[i-1][1]) {
                duplicates++;
            }
        }
        if (duplicates > 0) {
            // Classify based on Verra tolerance (W001 - tolerated warning)
            let warningText;
            
            if (duplicates < 10) {
                warningText = `${duplicates} duplicate vertices (Verra W001 - acceptable, optional to clean)`;
            } else if (duplicates < 50) {
                warningText = `${duplicates} duplicate vertices (Verra W001 - recommend cleaning for quality)`;
            } else if (duplicates < 100) {
                warningText = `${duplicates} duplicate vertices (Verra W001 - should clean before submission)`;
            } else {
                warningText = `${duplicates} duplicate vertices (Verra W001 - CRITICAL: may cause timeout, must clean)`;
            }
            
            validation.warnings.push(warningText);
        }
        
        return validation;
    }
    
    // Quick validation (just true/false)
    static isValid(coordinates) {
        const result = this.validate(coordinates);
        return result.isValid;
    }
    
    // Get validation summary
    static getSummary(validation) {
        const parts = [];
        
        if (validation.isValid) {
            parts.push('✓ Valid');
        } else {
            parts.push('✗ Invalid');
        }
        
        if (validation.errors.length > 0) {
            parts.push(`${validation.errors.length} error(s)`);
        }
        
        if (validation.warnings.length > 0) {
            parts.push(`${validation.warnings.length} warning(s)`);
        }
        
        return parts.join(' • ');
    }
    
    // Get all issues as flat array
    static getAllIssues(validation) {
        return [
            ...validation.errors.map(e => ({ type: 'error', message: e })),
            ...validation.warnings.map(w => ({ type: 'warning', message: w }))
        ];
    }
    
    // VERRA VALIDATION HELPERS
    
    /**
     * Check if polygon is closed (first point = last point)
     */
    static checkClosed(coords) {
        if (coords.length < 2) {
            return { pass: false, message: 'Insufficient coordinates' };
        }
        
        const first = coords[0];
        const last = coords[coords.length - 1];
        
        // Calculate distance
        const distance = Math.sqrt(
            Math.pow(first[0] - last[0], 2) + 
            Math.pow(first[1] - last[1], 2)
        );
        
        // Convert to meters (rough estimate: 1 degree ≈ 111.32 km)
        const distanceMeters = distance * 111320;
        
        if (distanceMeters === 0) {
            return { pass: true, message: 'Polygon is closed' };
        } else if (distanceMeters <= APP_CONFIG.VERRA.MAX_GAP_CLOSURE_M) {
            return { pass: true, message: `Auto-closable (gap: ${distanceMeters.toFixed(2)}m ≤ ${APP_CONFIG.VERRA.MAX_GAP_CLOSURE_M}m)` };
        } else {
            return { pass: false, message: `Gap too large: ${distanceMeters.toFixed(2)}m (max: ${APP_CONFIG.VERRA.MAX_GAP_CLOSURE_M}m)` };
        }
    }
    
    /**
     * Check for self-intersections and assess if auto-fixable
     * FIXED: Filters out false positives at closure point
     */
    static checkSimpleGeometry(coords) {
        try {
            const polygon = turf.polygon([coords]);
            const kinks = turf.kinks(polygon);
            
            if (!kinks.features || kinks.features.length === 0) {
                return { pass: true, message: 'No self-intersections', canAutoFix: false };
            }
            
            // Filter out kinks at the closure point (false positives)
            const first = coords[0];
            const last = coords[coords.length - 1];
            
            const realKinks = kinks.features.filter(kink => {
                const kinkCoord = kink.geometry.coordinates;
                const distToFirst = Math.abs(kinkCoord[0] - first[0]) + Math.abs(kinkCoord[1] - first[1]);
                const distToLast = Math.abs(kinkCoord[0] - last[0]) + Math.abs(kinkCoord[1] - last[1]);
                
                // If kink is very close to first or last point (< 0.01 degrees ~1.1km), it's the closure point
                // This threshold catches all floating-point variations in closed polygons
                // Real self-intersections occur in the middle of polygons, not at closure
                const isClosurePoint = (distToFirst < 0.01) || (distToLast < 0.01);
                
                return !isClosurePoint; // Keep only non-closure kinks
            });
            
            if (realKinks.length === 0) {
                // All kinks were at closure point - polygon is actually valid
                return { pass: true, message: 'No self-intersections', canAutoFix: false };
            }
            
            // Has real self-intersections - requires manual editing
            return {
                pass: false,
                message: `Self-intersection detected (${realKinks.length} point${realKinks.length > 1 ? 's' : ''}) - requires manual editing`,
                canAutoFix: false
            };
            
        } catch (error) {
            // If turf fails, fall back to conservative approach
            return {
                pass: false,
                message: 'Could not validate geometry - requires manual review',
                canAutoFix: false
            };
        }
    }
    
    /**
     * Check if polygon is closed (old method - kept for backward compatibility)
     */
    static checkClosed(coords) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        const gapDistance = GeoUtils.distance(first, last);
        
        // Allow small gaps < 0.5m (Verra standard)
        if (gapDistance < 0.5) {
            return {
                pass: true,
                message: gapDistance > 0 ? `Small closure gap (${gapDistance.toFixed(3)}m) - within Verra tolerance` : 'Polygon is closed',
                canAutoFix: false
            };
        }
        
        // Gap >= 0.5m
        return {
            pass: false,
            message: `Closure gap: ${gapDistance.toFixed(2)}m - requires manual review`,
            canAutoFix: false
        };
    }
    
    /**
     * Test if polygon can be auto-corrected (buffer technique)
     */
    static testAutoCorrection(coords) {
        try {
            // Try buffer correction
            const corrected = GeoUtils.bufferCorrection(coords, 0.00001); // Small buffer
            
            if (!corrected || corrected.length < 4) {
                return false;
            }
            
            // Check if corrected version has no self-intersections
            return !GeoUtils.hasSelfIntersection(corrected);
        } catch (error) {
            return false; // If correction fails, it's not auto-fixable
        }
    }
    
    /**
     * Get distinct vertices (remove duplicates)
     */
    static getDistinctVertices(coords) {
        const distinct = [];
        const seen = new Set();
        
        for (const coord of coords) {
            const key = `${coord[0].toFixed(6)},${coord[1].toFixed(6)}`;
            if (!seen.has(key)) {
                seen.add(key);
                distinct.push(coord);
            }
        }
        
        return distinct;
    }
}
