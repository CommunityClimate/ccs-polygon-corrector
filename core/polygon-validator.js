// Polygon Validator - Validation Logic
import { APP_CONFIG } from '../config/app-config.js';
import { GeoUtils } from '../utils/geo-utils.js';
import { PolygonCorrector } from './polygon-corrector.js';

export class PolygonValidator {

    // Validate a polygon and return detailed results
    static validate(coordinates) {
        const validation = {
            isValid: true,
            errors: [],
            warnings: [],
            metrics: {}
        };

        // ✅ NEW: Always normalize closure first.
        // If the user deleted the first/last vertex (or the closing vertex),
        // this will re-close the ring from remaining vertices when possible.
        let coords = coordinates;
        try {
            coords = PolygonCorrector.normalizeRingClosure(coordinates);
        } catch (e) {
            coords = coordinates;
        }

        // Enhanced input validation
        try {
            if (!coords) {
                validation.isValid = false;
                validation.errors.push('ERROR: No coordinates provided - ensure polygon data includes coordinate array');
                return validation;
            }

            if (!Array.isArray(coords)) {
                validation.isValid = false;
                validation.errors.push(`ERROR: Coordinates must be an array, received: ${typeof coords}`);
                return validation;
            }

            if (coords.length < 3) {
                validation.isValid = false;
                validation.errors.push(`ERROR: Polygon must have at least 3 vertices, found: ${coords.length}`);
                return validation;
            }

            for (let i = 0; i < coords.length; i++) {
                const coord = coords[i];

                if (!Array.isArray(coord) || coord.length !== 2) {
                    validation.isValid = false;
                    validation.errors.push(`ERROR: Coordinate at vertex ${i + 1} must be [lng, lat] format`);
                    return validation;
                }

                if (typeof coord[0] !== 'number' || typeof coord[1] !== 'number') {
                    validation.isValid = false;
                    validation.errors.push(`ERROR: Coordinate at vertex ${i + 1} contains non-numeric values: [${coord[0]}, ${coord[1]}]`);
                    return validation;
                }

                if (coord[0] < -180 || coord[0] > 180) {
                    validation.isValid = false;
                    validation.errors.push(`ERROR: Longitude at vertex ${i + 1} out of range: ${coord[0]} (valid: -180 to 180)`);
                    return validation;
                }

                if (coord[1] < -90 || coord[1] > 90) {
                    validation.isValid = false;
                    validation.errors.push(`ERROR: Latitude at vertex ${i + 1} out of range: ${coord[1]} (valid: -90 to 90)`);
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
            vertices: coords.length,
            areaHa: GeoUtils.calculateArea(coords),
            areaM2: GeoUtils.calculateArea(coords) * 10000,
            perimeterM: GeoUtils.calculatePerimeter(coords),
            hasSelfIntersection: GeoUtils.hasSelfIntersection(coords),
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
            overallStatus: 'UNKNOWN',
            requiresManualFix: false
        };

        // Check 1: Closed polygon (Verra Critical)
        const isClosed = this.checkClosed(coords);
        validation.verra.checks.closed.pass = isClosed.pass;
        validation.verra.checks.closed.message = isClosed.message;
        if (!isClosed.pass) {
            validation.verra.compliant = false;
            validation.errors.push(`VERRA CRITICAL: ${isClosed.message}`);
            validation.isValid = false;
        }

        // Check 2: Simple geometry - no self-intersections (Verra Critical)
        const isSimple = this.checkSimpleGeometry(coords);
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
            }
        }

        // Check 3: Minimum vertices (Verra Critical - 4 distinct points)
        const distinctVertices = this.getDistinctVertices(coords);
        validation.verra.checks.minVertices.pass = distinctVertices.length >= 4;
        validation.verra.checks.minVertices.message = `${distinctVertices.length} distinct vertices (min: 4)`;
        if (distinctVertices.length < 4) {
            validation.verra.compliant = false;
            validation.errors.push(`VERRA CRITICAL: Only ${distinctVertices.length} distinct vertices (minimum 4 required)`);
            validation.isValid = false;
        }

        // Check 4: Positive area (Verra Critical)
        validation.verra.checks.positiveArea.pass = validation.metrics.areaM2 > 1;
        validation.verra.checks.positiveArea.message = `Area: ${validation.metrics.areaM2.toFixed(2)} m² (${validation.metrics.areaHa.toFixed(4)} ha)`;
        if (validation.metrics.areaM2 <= 1) {
            validation.verra.compliant = false;
            validation.errors.push(`VERRA CRITICAL: Area too small (${validation.metrics.areaM2.toFixed(2)} m² ≤ 1 m²)`);
            validation.isValid = false;
        }

        if (validation.verra.compliant) {
            validation.verra.overallStatus = 'PASS';
        } else if (validation.verra.requiresManualFix) {
            validation.verra.overallStatus = 'NEEDS_MANUAL_FIX';
        } else {
            validation.verra.overallStatus = 'FIXABLE';
        }

        // App config checks
        if (coords.length < APP_CONFIG.VALIDATION.MIN_VERTICES) {
            validation.isValid = false;
            validation.errors.push(`Minimum ${APP_CONFIG.VALIDATION.MIN_VERTICES} vertices required`);
        }

        if (coords.length > APP_CONFIG.VALIDATION.MAX_VERTICES) {
            validation.warnings.push(`High vertex count (${coords.length} vertices) - polygon is inefficient but valid`);
        }

        if (validation.metrics.areaHa < APP_CONFIG.VALIDATION.MIN_AREA_HA) {
            validation.isValid = false;
            validation.errors.push(`Area too small (${validation.metrics.areaHa.toFixed(4)} ha < ${APP_CONFIG.VALIDATION.MIN_AREA_HA} ha)`);
        }

        if (validation.metrics.areaHa > APP_CONFIG.VALIDATION.MAX_AREA_HA) {
            validation.warnings.push(`Very large area (${validation.metrics.areaHa.toFixed(2)} ha)`);
        }

        if (validation.metrics.perimeterM < APP_CONFIG.VALIDATION.MIN_PERIMETER_M) {
            validation.warnings.push(`Very small perimeter (${validation.metrics.perimeterM.toFixed(2)} m)`);
        }

        // Self-intersection detail
        if (validation.metrics.hasSelfIntersection) {
            validation.isValid = false;
            validation.errors.push('Polygon has self-intersections');
            validation.metrics.selfIntersectionPoints = GeoUtils.getSelfIntersectionPoints(coords);
        }

        // Sharp angles
        validation.metrics.sharpAngles = GeoUtils.detectSharpAngles(coords, 10);
        if (validation.metrics.sharpAngles.length > 0) {
            validation.warnings.push(`${validation.metrics.sharpAngles.length} sharp angle(s) detected`);
        }

        // Duplicate consecutive points warning
        let duplicates = 0;
        for (let i = 1; i < coords.length; i++) {
            if (coords[i][0] === coords[i - 1][0] && coords[i][1] === coords[i - 1][1]) {
                duplicates++;
            }
        }
        if (duplicates > 0) {
            validation.warnings.push(`${duplicates} duplicate vertices (Verra W001 - optional to clean)`);
        }

        return validation;
    }

    static isValid(coordinates) {
        return this.validate(coordinates).isValid;
    }

    /**
     * Single, consistent closure check (meters via GeoUtils.distance)
     * Allows small gaps < 0.5m (Verra standard)
     */
    static checkClosed(coords) {
        if (!coords || coords.length < 2) {
            return { pass: false, message: 'Insufficient coordinates', canAutoFix: false };
        }

        const first = coords[0];
        const last = coords[coords.length - 1];
        const gapDistance = GeoUtils.distance(first, last);

        if (gapDistance < 0.5) {
            return {
                pass: true,
                message: gapDistance > 0
                    ? `Small closure gap (${gapDistance.toFixed(3)}m) - within Verra tolerance`
                    : 'Polygon is closed',
                canAutoFix: gapDistance > 0
            };
        }

        return {
            pass: false,
            message: `Closure gap: ${gapDistance.toFixed(2)}m - requires manual review`,
            canAutoFix: false
        };
    }

    static checkSimpleGeometry(coords) {
        try {
            if (!coords || coords.length < 4) {
                return { pass: true, message: 'Not enough vertices to evaluate self-intersections', canAutoFix: false };
            }

            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) {
                return { pass: false, message: 'Polygon is not closed', canAutoFix: true };
            }

            const polygon = turf.polygon([coords]);
            const kinks = turf.kinks(polygon);

            if (!kinks.features || kinks.features.length === 0) {
                return { pass: true, message: 'No self-intersections', canAutoFix: false };
            }

            // Keep your existing closure-point filtering logic if desired
            return {
                pass: false,
                message: `Self-intersection detected (${kinks.features.length}) - requires manual editing`,
                canAutoFix: false
            };
        } catch (error) {
            return { pass: false, message: 'Could not validate geometry - requires manual review', canAutoFix: false };
        }
    }

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