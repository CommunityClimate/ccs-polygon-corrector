// Polygon Corrector - Automatic Correction Algorithms
import { APP_CONFIG } from '../config/app-config.js';
import { GeoUtils } from '../utils/geo-utils.js';
import { PolygonValidator } from './polygon-validator.js';

export class PolygonCorrector {

    /**
     * Ensure a polygon ring is correctly closed WITHOUT inventing geometry.
     * - Removes an existing closing point if present (last === first)
     * - Removes consecutive duplicate points
     * - If there are >= 3 distinct vertices, appends first point as the closing point
     *
     * Returns:
     * - a valid closed ring when possible, or
     * - an open ring if there aren't enough distinct points yet
     */
    static normalizeRingClosure(coordinates) {
        if (!Array.isArray(coordinates)) return coordinates;

        const pointsEqual = (a, b) =>
            Array.isArray(a) && Array.isArray(b) && a[0] === b[0] && a[1] === b[1];

        // Work on a shallow copy of points
        let ring = coordinates.map(p => Array.isArray(p) ? [...p] : p);

        // 1) If already closed, remove the closing point (we'll re-add cleanly later)
        if (ring.length >= 2 && pointsEqual(ring[0], ring[ring.length - 1])) {
            ring = ring.slice(0, -1);
        }

        // 2) Remove consecutive duplicates
        const deduped = [];
        for (const p of ring) {
            if (!deduped.length || !pointsEqual(deduped[deduped.length - 1], p)) {
                deduped.push(p);
            }
        }
        ring = deduped;

        // 3) Must have at least 3 distinct vertices to be closable as a polygon ring
        const distinct = new Set(ring.map(p => `${p[0]},${p[1]}`));
        if (distinct.size < 3) return ring;

        // 4) Close by repeating the first vertex
        return ring.concat([[...ring[0]]]);
    }

    // Main correction function (BEST PRACTICE: Conservative approach)
    static correct(coordinates, options = {}) {
        const result = {
            success: false,
            corrected: null,
            original: [...coordinates],
            steps: [],
            iterations: 0,
            method: null,  // Track which method succeeded
            shapeChangePercent: 0  // Track how much shape changed
        };

        const maxIterations = options.maxIterations || APP_CONFIG.CORRECTION.MAX_ITERATIONS;

        // NEW Step 0: Normalize closure based on remaining vertices (safe, no shape invention)
        result.steps.push('Step 0: Normalizing ring closure (re-close from remaining vertices if possible)');
        let current = this.normalizeRingClosure(coordinates);

        // Step 1: Clean polygon (SAFE - removes duplicates, ensures closure)
        result.steps.push('Step 1: Cleaning polygon (removing duplicates, ensuring closure)');
        const cleaned = GeoUtils.cleanPolygon(current);

        // PRESERVE DIRECTION relative to the (normalized) input ring to avoid winding flips
        current = GeoUtils.preserveWindingDirection(current, cleaned);

        // Step 2: Check if cleaning alone fixed it (best case!)
        let validation = PolygonValidator.validate(current);
        if (validation.isValid) {
            result.success = true;
            result.corrected = current;
            result.method = 'clean_only';
            result.steps.push('✓ Fixed by cleaning alone (no shape change, winding preserved)');
            return result;
        }

        // Step 2.5: Try closing small gaps (< 0.5m)
        // IMPORTANT: Check gap distance FIRST, close it, THEN check for remaining intersections
        // This is because gaps at closure often CAUSE self-intersections when polygon is force-closed
        const gapDistance = GeoUtils.distance(current[0], current[current.length - 1]);

        if (gapDistance > 0 && gapDistance < 0.5) {
            result.steps.push(`Step 2.5: Closing small gap (${gapDistance.toFixed(3)}m)`);
            const gapClosed = this.closeGap(current);

            // Preserve winding relative to the current (already normalized/cleaned) ring
            const gapClosedPreserved = GeoUtils.preserveWindingDirection(current, gapClosed);

            // Now check if closing the gap resolved all issues
            validation = PolygonValidator.validate(gapClosedPreserved);

            if (validation.isValid) {
                result.success = true;
                result.corrected = gapClosedPreserved;
                result.method = 'gap_closure';
                result.steps.push('✓ Fixed by closing small gap (Verra compliant < 0.5m, winding preserved)');
                result.shapeChangePercent = this.calculateShapeChange(current, gapClosedPreserved);
                return result;
            } else {
                // Gap closure didn't fix it - check why
                const stillHasIntersection = GeoUtils.hasSelfIntersection(gapClosedPreserved);
                if (stillHasIntersection) {
                    result.steps.push('⚠ Self-intersection persists after closing gap - requires manual editing');
                } else {
                    result.steps.push('⚠ Other validation issues remain after closing gap');
                }
                current = gapClosedPreserved;  // Keep the closed version for logging
            }
        }

        // Step 3: Check if polygon still has issues after gap closure attempt
        if (GeoUtils.hasSelfIntersection(current)) {
            result.steps.push('⚠ Self-intersection detected - REQUIRES MANUAL EDITING');
            result.steps.push('For carbon credits: self-intersections need human judgment with satellite imagery');
            result.success = false;
            return result;
        }

        // Check if there are other issues (too few vertices, negative area, etc.)
        validation = PolygonValidator.validate(current);
        if (!validation.isValid) {
            result.steps.push('⚠ Additional validation issues detected - REQUIRES MANUAL EDITING');
            result.steps.push(...validation.errors);
            result.success = false;
            return result;
        }

        // ====================================================================
        // DISABLED: The following risky correction methods are NO LONGER USED
        // They caused vertex bloat, area loss, and unreliable results
        // ====================================================================

        // DISABLED: Step 3 - Remove spike vertices (can alter shape unpredictably)
        // DISABLED: Step 4 - Unkink (can cut off real field area)
        // DISABLED: Step 5 - Buffer (causes massive vertex bloat)
        // DISABLED: Step 6 - Convex hull (drastically changes shape)

        // If we reach here, correction failed
        result.steps.push('✗ Auto-correction failed - manual editing required');
        result.success = false;

        return result;
    }

    // Smooth sharp angles
    static smoothSharpAngles(coordinates, sharpAngles) {
        let smoothed = [...coordinates];

        // Remove points with very sharp angles (working backwards to maintain indices)
        for (let i = sharpAngles.length - 1; i >= 0; i--) {
            const spike = sharpAngles[i];
            if (spike.angle < 5 && spike.index > 0 && spike.index < smoothed.length - 1) {
                // Remove the spike point
                smoothed.splice(spike.index, 1);
            }
        }

        return smoothed;
    }

    /**
     * Close small gaps by ensuring last point equals first point.
     * For gaps < 0.5m (Verra compliant)
     *
     * Updated to use normalizeRingClosure so it also handles cases where the
     * closing vertex was deleted (or first/last changed).
     */
    static closeGap(coordinates) {
        return this.normalizeRingClosure(coordinates);
    }

    // Auto-correct with different strategies
    static autoCorrect(coordinates) {
        // Try different correction strategies
        const strategies = [
            { name: 'Standard', options: {} },
            { name: 'Aggressive', options: { maxIterations: 15 } },
            { name: 'Conservative', options: { maxIterations: 5 } }
        ];

        for (const strategy of strategies) {
            const result = this.correct(coordinates, strategy.options);
            if (result.success) {
                result.strategy = strategy.name;
                return result;
            }
        }

        // Return last attempt even if not fully successful
        const lastAttempt = this.correct(coordinates);
        lastAttempt.strategy = 'Best Effort';
        return lastAttempt;
    }

    // Calculate correction quality score (0-100)
    static getQualityScore(original, corrected) {
        const originalArea = GeoUtils.calculateArea(original);
        const correctedArea = GeoUtils.calculateArea(corrected);

        // Area preservation (40%)
        const areaScore = Math.min(correctedArea / originalArea, originalArea / correctedArea) * 40;

        // Vertex preservation (30%)
        const vertexRatio = Math.min(corrected.length / original.length, original.length / corrected.length);
        const vertexScore = vertexRatio * 30;

        // Validation (30%)
        const validation = PolygonValidator.validate(corrected);
        const validationScore = validation.isValid ? 30 : (30 - validation.errors.length * 5);

        return Math.max(0, Math.round(areaScore + vertexScore + validationScore));
    }

    // Remove spike vertices that cause self-intersections (CONSERVATIVE)
    static removeSpikeVertices(coordinates) {
        if (coordinates.length < 4) return coordinates;

        let cleaned = [...coordinates];
        let removedAny = true;

        // Iteratively remove vertices that create spikes
        while (removedAny && cleaned.length > 3) {
            removedAny = false;

            for (let i = 1; i < cleaned.length - 1; i++) {
                const prev = cleaned[i - 1];
                const curr = cleaned[i];
                const next = cleaned[i + 1];

                // Calculate angle at this vertex
                const angle = this.calculateAngle(prev, curr, next);

                // If angle is very sharp (< 10 degrees), it's likely a spike
                if (angle < 10) {
                    // Remove this vertex
                    cleaned.splice(i, 1);
                    removedAny = true;
                    break;  // Re-check from start after removal
                }
            }
        }

        return cleaned;
    }

    // Calculate angle at a vertex (in degrees)
    static calculateAngle(p1, p2, p3) {
        const v1 = [p1[0] - p2[0], p1[1] - p2[1]];
        const v2 = [p3[0] - p2[0], p3[1] - p2[1]];

        const dot = v1[0] * v2[0] + v1[1] * v2[1];
        const mag1 = Math.sqrt(v1[0] * v1[0] + v1[1] * v1[1]);
        const mag2 = Math.sqrt(v2[0] * v2[0] + v2[1] * v2[1]);

        if (mag1 === 0 || mag2 === 0) return 0;

        const cos = dot / (mag1 * mag2);
        const radians = Math.acos(Math.max(-1, Math.min(1, cos)));
        return radians * (180 / Math.PI);
    }

    // Calculate percentage of shape change between original and corrected
    static calculateShapeChange(original, corrected) {
        const originalArea = GeoUtils.calculateArea(original);
        const correctedArea = GeoUtils.calculateArea(corrected);

        if (originalArea === 0) return 100;

        const areaChange = Math.abs(correctedArea - originalArea);
        const percentChange = (areaChange / originalArea) * 100;

        return percentChange;
    }

    // Compare original vs corrected
    static compare(original, corrected) {
        return {
            original: {
                vertices: original.length,
                areaHa: GeoUtils.calculateArea(original),
                perimeterM: GeoUtils.calculatePerimeter(original),
                validation: PolygonValidator.validate(original)
            },
            corrected: {
                vertices: corrected.length,
                areaHa: GeoUtils.calculateArea(corrected),
                perimeterM: GeoUtils.calculatePerimeter(corrected),
                validation: PolygonValidator.validate(corrected)
            },
            changes: {
                verticesDiff: corrected.length - original.length,
                areaChangePct: ((GeoUtils.calculateArea(corrected) - GeoUtils.calculateArea(original)) / GeoUtils.calculateArea(original) * 100).toFixed(2),
                qualityScore: this.getQualityScore(original, corrected)
            }
        };
    }
}