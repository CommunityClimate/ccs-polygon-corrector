// Enhanced Verra Validator - Minimum Acceptance Criteria
import * as turf from 'https://cdn.jsdelivr.net/npm/@turf/turf@6.5.0/+esm';

export class VerraValidator {
    
    // Verra minimum acceptance criteria
    static CRITERIA = {
        MIN_VERTICES: 4,           // At least 4 distinct points
        MIN_AREA_M2: 1,            // > 0.0001 ha = 1 m²
        MAX_CLOSURE_GAP_M: 0.5,    // Auto-close if gap ≤ 0.5m
        MAX_DUPLICATE_TOLERANCE: 0.0001  // Degrees (~11cm)
    };
    
    /**
     * Complete Verra validation with auto-correction assessment
     * Returns detailed report with PASS/FAIL and auto-correction status
     */
    static validateForVerra(field) {
        const results = {
            fieldId: field.ccsFieldId,
            timestamp: new Date().toISOString(),
            overallStatus: 'UNKNOWN', // PASS, FAIL, NEEDS_MANUAL_FIX
            
            // Verra Critical Checks
            checks: {
                closed: { status: false, message: '', autoFixable: false },
                simple: { status: false, message: '', autoFixable: false },
                minVertices: { status: false, message: '', autoFixable: false },
                positiveArea: { status: false, message: '', autoFixable: false },
                duplicates: { status: true, message: '', autoFixable: false, count: 0 },
                excessiveVertices: { status: true, message: '', autoFixable: false, count: 0 }
            },
            
            // Calculated values
            area: {
                m2: 0,
                hectares: 0,
                calculated: false
            },
            
            // Auto-correction assessment
            autoCorrection: {
                possible: false,
                confidence: 0, // 0-100
                method: '',
                issues: []
            },
            
            // Actions required
            actions: []
        };
        
        const coords = field.originalCoordinates || field.correctedCoordinates || [];
        
        if (!coords || coords.length === 0) {
            results.overallStatus = 'FAIL';
            results.actions.push('ERROR: No coordinates found');
            return results;
        }
        
        // Run all checks
        this.checkClosure(coords, results);
        this.checkSimpleGeometry(coords, results);
        this.checkMinimumVertices(coords, results);
        this.calculateArea(coords, results);
        this.checkPositiveArea(results);
        this.checkDuplicateVertices(coords, results);
        this.checkExcessiveVertices(coords, results);
        
        // Assess auto-correction capability
        this.assessAutoCorrection(coords, results);
        
        // Determine overall status
        this.determineOverallStatus(results);
        
        // Generate action items
        this.generateActions(results);
        
        return results;
    }
    
    /**
     * Check if polygon is closed (first point = last point)
     */
    static checkClosure(coords, results) {
        if (coords.length < 2) {
            results.checks.closed.status = false;
            results.checks.closed.message = 'Insufficient coordinates';
            return;
        }
        
        const first = coords[0];
        const last = coords[coords.length - 1];
        
        // Calculate distance between first and last point
        const distance = Math.sqrt(
            Math.pow(first[0] - last[0], 2) + 
            Math.pow(first[1] - last[1], 2)
        );
        
        // Convert to approximate meters (rough estimate)
        const distanceMeters = distance * 111320; // 1 degree ≈ 111.32 km
        
        if (distanceMeters <= this.CRITERIA.MAX_CLOSURE_GAP_M) {
            results.checks.closed.status = true;
            results.checks.closed.message = distanceMeters === 0 
                ? 'Polygon is closed' 
                : `Auto-closable (gap: ${distanceMeters.toFixed(2)}m)`;
            results.checks.closed.autoFixable = distanceMeters > 0;
        } else {
            results.checks.closed.status = false;
            results.checks.closed.message = `Gap too large: ${distanceMeters.toFixed(2)}m (max: ${this.CRITERIA.MAX_CLOSURE_GAP_M}m)`;
            results.checks.closed.autoFixable = false;
        }
    }
    
    /**
     * Check for self-intersections and assess if auto-correctable
     */
    static checkSimpleGeometry(coords, results) {
        try {
            // Close polygon if needed for turf
            const closedCoords = this.ensureClosed(coords);
            const polygon = turf.polygon([closedCoords]);
            
            // Check for self-intersections using turf kinks
            const kinks = turf.kinks(polygon);
            
            if (!kinks.features || kinks.features.length === 0) {
                results.checks.simple.status = true;
                results.checks.simple.message = 'No self-intersections';
                results.checks.simple.autoFixable = false;
                return;
            }
            
            // Has self-intersections - ALWAYS require manual editing
            const intersectionCount = kinks.features.length;
            
            // IMPORTANT: Self-intersections require human judgment because:
            // 1. Auto-correction adds too many vertices (vertex bloat)
            // 2. Auto-correction may cut off real field area (revenue loss)
            // 3. Only humans can see satellite imagery to determine correct boundary
            // 4. For carbon credits, losing area = losing revenue (unacceptable risk)
            
            results.checks.simple.status = false;
            results.checks.simple.message = `${intersectionCount} self-intersection(s) detected`;
            results.checks.simple.autoFixable = false;  // NEVER auto-fix self-intersections
            results.checks.simple.intersectionCount = intersectionCount;
            results.autoCorrection.issues.push('Self-intersections require manual editing - auto-correction disabled for safety');
            
        } catch (error) {
            results.checks.simple.status = false;
            results.checks.simple.message = `Geometry error: ${error.message}`;
            results.checks.simple.autoFixable = false;
        }
    }
    
    /**
     * Test if buffer technique can fix self-intersections
     */
    static testBufferCorrection(polygon) {
        try {
            // Try small buffer (0.00001 degrees ≈ 1.1m)
            const buffered = turf.buffer(polygon, 0.00001, { units: 'degrees' });
            if (!buffered) return false;
            
            // Check if buffered polygon is valid
            const kinks = turf.kinks(buffered);
            return !kinks.features || kinks.features.length === 0;
        } catch (error) {
            return false;
        }
    }
    
    /**
     * Check minimum vertex requirement (4 distinct points)
     */
    static checkMinimumVertices(coords, results) {
        // Get distinct coordinates
        const distinct = this.getDistinctVertices(coords);
        
        if (distinct.length >= this.CRITERIA.MIN_VERTICES) {
            results.checks.minVertices.status = true;
            results.checks.minVertices.message = `${distinct.length} distinct vertices (minimum: ${this.CRITERIA.MIN_VERTICES})`;
            results.checks.minVertices.count = distinct.length;
        } else {
            results.checks.minVertices.status = false;
            results.checks.minVertices.message = `Only ${distinct.length} distinct vertices (minimum: ${this.CRITERIA.MIN_VERTICES})`;
            results.checks.minVertices.count = distinct.length;
            results.checks.minVertices.autoFixable = false;
        }
    }
    
    /**
     * Calculate area in m² and hectares from coordinates
     */
    static calculateArea(coords, results) {
        try {
            const closedCoords = this.ensureClosed(coords);
            const polygon = turf.polygon([closedCoords]);
            
            // Get area in square meters
            const areaM2 = turf.area(polygon);
            const areaHa = areaM2 / 10000;
            
            results.area.m2 = Math.round(areaM2 * 100) / 100; // Round to 2 decimals
            results.area.hectares = Math.round(areaHa * 10000) / 10000; // Round to 4 decimals
            results.area.calculated = true;
            
        } catch (error) {
            results.area.m2 = 0;
            results.area.hectares = 0;
            results.area.calculated = false;
            results.area.error = error.message;
        }
    }
    
    /**
     * Check positive area requirement
     */
    static checkPositiveArea(results) {
        if (!results.area.calculated) {
            results.checks.positiveArea.status = false;
            results.checks.positiveArea.message = 'Could not calculate area';
            return;
        }
        
        if (results.area.m2 >= this.CRITERIA.MIN_AREA_M2) {
            results.checks.positiveArea.status = true;
            results.checks.positiveArea.message = `Area: ${results.area.m2.toFixed(2)} m² (${results.area.hectares.toFixed(4)} ha)`;
        } else {
            results.checks.positiveArea.status = false;
            results.checks.positiveArea.message = `Area too small: ${results.area.m2.toFixed(2)} m² (minimum: ${this.CRITERIA.MIN_AREA_M2} m²)`;
            results.checks.positiveArea.autoFixable = false;
        }
    }
    
    /**
     * Detect and count duplicate vertices
     */
    static checkDuplicateVertices(coords, results) {
        const duplicates = [];
        
        for (let i = 1; i < coords.length; i++) {
            const prev = coords[i - 1];
            const curr = coords[i];
            
            const distance = Math.sqrt(
                Math.pow(curr[0] - prev[0], 2) + 
                Math.pow(curr[1] - prev[1], 2)
            );
            
            if (distance <= this.CRITERIA.MAX_DUPLICATE_TOLERANCE) {
                duplicates.push(i);
            }
        }
        
        results.checks.duplicates.count = duplicates.length;
        
        if (duplicates.length > 0) {
            results.checks.duplicates.status = true; // Verra tolerates duplicates
            results.checks.duplicates.message = `${duplicates.length} duplicate vertices detected (Verra tolerates, but should clean)`;
            results.checks.duplicates.autoFixable = true;
        } else {
            results.checks.duplicates.status = true;
            results.checks.duplicates.message = 'No duplicate vertices';
        }
    }
    
    /**
     * Check for excessive vertices (>1000)
     */
    static checkExcessiveVertices(coords, results) {
        const vertexCount = coords.length;
        
        if (vertexCount > 1000) {
            results.checks.excessiveVertices.status = true; // Verra tolerates
            results.checks.excessiveVertices.message = `${vertexCount} vertices (excessive, recommend simplification)`;
            results.checks.excessiveVertices.count = vertexCount;
            results.checks.excessiveVertices.autoFixable = true;
        } else {
            results.checks.excessiveVertices.status = true;
            results.checks.excessiveVertices.message = `${vertexCount} vertices (acceptable)`;
            results.checks.excessiveVertices.count = vertexCount;
        }
    }
    
    /**
     * Assess if polygon can be auto-corrected
     */
    static assessAutoCorrection(coords, results) {
        const issues = [];
        let fixableCount = 0;
        let totalIssues = 0;
        
        // Check each issue
        Object.keys(results.checks).forEach(key => {
            const check = results.checks[key];
            if (!check.status && key !== 'duplicates' && key !== 'excessiveVertices') {
                totalIssues++;
                if (check.autoFixable) {
                    fixableCount++;
                } else {
                    issues.push(key);
                }
            }
        });
        
        // Auto-correction is possible if all critical issues are fixable
        results.autoCorrection.possible = totalIssues > 0 && issues.length === 0;
        results.autoCorrection.confidence = totalIssues > 0 
            ? Math.round((fixableCount / totalIssues) * 100)
            : 100;
        results.autoCorrection.issues = issues;
        
        // Determine method
        if (results.autoCorrection.possible) {
            if (!results.checks.simple.status) {
                results.autoCorrection.method = 'Buffer technique';
            } else if (!results.checks.closed.status) {
                results.autoCorrection.method = 'Auto-close';
            } else {
                results.autoCorrection.method = 'Clean & simplify';
            }
        } else if (issues.length > 0) {
            results.autoCorrection.method = 'MANUAL EDITING REQUIRED';
        } else {
            results.autoCorrection.method = 'No correction needed';
        }
    }
    
    /**
     * Determine overall Verra compliance status
     */
    static determineOverallStatus(results) {
        const criticalChecks = ['closed', 'simple', 'minVertices', 'positiveArea'];
        const failedCritical = criticalChecks.filter(key => !results.checks[key].status);
        
        if (failedCritical.length === 0) {
            results.overallStatus = 'PASS';
        } else if (results.autoCorrection.possible) {
            results.overallStatus = 'FIXABLE';
        } else {
            results.overallStatus = 'NEEDS_MANUAL_FIX';
        }
    }
    
    /**
     * Generate action items
     */
    static generateActions(results) {
        if (results.overallStatus === 'PASS') {
            // Check for quality improvements
            if (results.checks.duplicates.count > 0) {
                results.actions.push(`Clean ${results.checks.duplicates.count} duplicate vertices`);
            }
            if (results.checks.excessiveVertices.count > 1000) {
                results.actions.push(`Simplify ${results.checks.excessiveVertices.count} vertices`);
            }
            if (results.actions.length === 0) {
                results.actions.push('✓ Ready for Verra submission');
            }
        } else if (results.overallStatus === 'FIXABLE') {
            results.actions.push(`⚡ Auto-correct using ${results.autoCorrection.method}`);
        } else {
            // NEEDS_MANUAL_FIX
            results.autoCorrection.issues.forEach(issue => {
                switch (issue) {
                    case 'simple':
                        results.actions.push('🔧 MANUAL FIX REQUIRED: Self-intersections cannot be auto-corrected');
                        break;
                    case 'closed':
                        results.actions.push('🔧 MANUAL FIX REQUIRED: Gap too large to auto-close');
                        break;
                    case 'minVertices':
                        results.actions.push('🔧 MANUAL FIX REQUIRED: Add more vertices (need at least 4 distinct points)');
                        break;
                    case 'positiveArea':
                        results.actions.push('🔧 MANUAL FIX REQUIRED: Polygon has no area');
                        break;
                }
            });
        }
    }
    
    /**
     * Helper: Get distinct vertices (remove duplicates)
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
    
    /**
     * Helper: Ensure polygon is closed
     */
    static ensureClosed(coords) {
        if (coords.length < 2) return coords;
        
        const first = coords[0];
        const last = coords[coords.length - 1];
        
        if (first[0] === last[0] && first[1] === last[1]) {
            return coords;
        }
        
        return [...coords, [first[0], first[1]]];
    }
    
    /**
     * Remove duplicate vertices from polygon
     */
    static removeDuplicates(coords) {
        const cleaned = [];
        
        for (let i = 0; i < coords.length; i++) {
            if (i === 0) {
                cleaned.push(coords[i]);
                continue;
            }
            
            const prev = coords[i - 1];
            const curr = coords[i];
            
            const distance = Math.sqrt(
                Math.pow(curr[0] - prev[0], 2) + 
                Math.pow(curr[1] - prev[1], 2)
            );
            
            if (distance > this.CRITERIA.MAX_DUPLICATE_TOLERANCE) {
                cleaned.push(curr);
            }
        }
        
        return cleaned;
    }
    
    /**
     * Auto-close polygon if gap is small enough
     */
    static autoClose(coords) {
        if (coords.length < 2) return coords;
        
        const first = coords[0];
        const last = coords[coords.length - 1];
        
        const distance = Math.sqrt(
            Math.pow(first[0] - last[0], 2) + 
            Math.pow(first[1] - last[1], 2)
        );
        
        const distanceMeters = distance * 111320;
        
        if (distanceMeters > 0 && distanceMeters <= this.CRITERIA.MAX_CLOSURE_GAP_M) {
            return [...coords, [first[0], first[1]]];
        }
        
        return coords;
    }
}
