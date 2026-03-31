// Verra Compliance Checker - Carbon Credit Standards
import { APP_CONFIG } from '../config/app-config.js';
import { GeoUtils } from '../utils/geo-utils.js';

export class VerraCompliance {
    
    // Check Verra compliance
    static check(coordinates, fieldData = {}) {
        const compliance = {
            compliant: true,
            issues: [],
            warnings: [],
            metrics: {},
            score: 100
        };
        
        // Calculate metrics
        const areaHa = GeoUtils.calculateArea(coordinates);
        const vertices = coordinates.length;
        const hasSelfIntersection = GeoUtils.hasSelfIntersection(coordinates);
        const sharpAngles = GeoUtils.detectSharpAngles(coordinates, APP_CONFIG.VERRA.MAX_SPIKE_ANGLE_DEG);
        
        compliance.metrics = {
            areaHa,
            vertices,
            hasSelfIntersection,
            sharpAnglesCount: sharpAngles.length
        };
        
        // Rule 1: Minimum area requirement
        if (areaHa < APP_CONFIG.VERRA.MIN_AREA_HA) {
            compliance.compliant = false;
            compliance.issues.push({
                rule: 'VR-001',
                severity: 'critical',
                message: `Area ${areaHa.toFixed(4)} ha is below minimum ${APP_CONFIG.VERRA.MIN_AREA_HA} ha`,
                requirement: 'Minimum 0.1 hectare per field'
            });
            compliance.score -= 25;
        }
        
        // Rule 2: Maximum area check
        if (areaHa > APP_CONFIG.VERRA.MAX_AREA_HA) {
            compliance.warnings.push({
                rule: 'VR-002',
                severity: 'warning',
                message: `Large area ${areaHa.toFixed(2)} ha (max recommended ${APP_CONFIG.VERRA.MAX_AREA_HA} ha)`,
                requirement: 'Consider splitting into smaller fields'
            });
            compliance.score -= 5;
        }
        
        // Rule 3: Minimum vertices
        if (vertices < APP_CONFIG.VERRA.MIN_VERTICES) {
            compliance.compliant = false;
            compliance.issues.push({
                rule: 'VR-003',
                severity: 'critical',
                message: `${vertices} vertices is below minimum ${APP_CONFIG.VERRA.MIN_VERTICES}`,
                requirement: 'Minimum 4 vertices required for valid polygon'
            });
            compliance.score -= 20;
        }
        
        // Rule 4: Self-intersections not allowed
        if (hasSelfIntersection) {
            compliance.compliant = false;
            compliance.issues.push({
                rule: 'VR-004',
                severity: 'critical',
                message: 'Polygon has self-intersections',
                requirement: 'Polygons must not cross themselves'
            });
            compliance.score -= 30;
        }
        
        // Rule 5: Sharp angles (spikes)
        if (sharpAngles.length > 0) {
            compliance.compliant = false;
            compliance.issues.push({
                rule: 'VR-005',
                severity: 'major',
                message: `${sharpAngles.length} sharp angle(s) detected (< ${APP_CONFIG.VERRA.MAX_SPIKE_ANGLE_DEG}°)`,
                requirement: 'Angles should be > 10° to avoid GPS artifacts'
            });
            compliance.score -= (sharpAngles.length * 5);
        }
        
        // Rule 6: Polygon closure
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            compliance.warnings.push({
                rule: 'VR-006',
                severity: 'warning',
                message: 'Polygon not properly closed',
                requirement: 'First and last coordinates should match'
            });
            compliance.score -= 5;
        }
        
        // Rule 7: Minimum side length (check for tiny segments)
        const tinySegments = this.checkMinimumSideLength(coordinates, APP_CONFIG.VERRA.MIN_SIDE_LENGTH_M);
        if (tinySegments.length > 0) {
            compliance.warnings.push({
                rule: 'VR-007',
                severity: 'warning',
                message: `${tinySegments.length} segment(s) shorter than ${APP_CONFIG.VERRA.MIN_SIDE_LENGTH_M}m`,
                requirement: 'Segments should be > 5m to ensure GPS accuracy'
            });
            compliance.score -= (tinySegments.length * 2);
        }
        
        // Rule 8: Field ownership (if provided)
        if (fieldData.fieldOwner) {
            compliance.metrics.ownershipVerified = true;
        } else {
            compliance.warnings.push({
                rule: 'VR-008',
                severity: 'info',
                message: 'Field owner not specified',
                requirement: 'Owner information required for carbon credit registration'
            });
        }
        
        // Rule 9: Coordinates precision
        const precisionIssues = this.checkCoordinatePrecision(coordinates);
        if (precisionIssues > 0) {
            compliance.warnings.push({
                rule: 'VR-009',
                severity: 'info',
                message: `${precisionIssues} coordinate(s) with low precision`,
                requirement: 'Use at least 6 decimal places for GPS coordinates'
            });
        }
        
        // Ensure score doesn't go below 0
        compliance.score = Math.max(0, compliance.score);
        
        // Overall assessment
        compliance.assessment = this.getAssessment(compliance.score);
        
        return compliance;
    }
    
    // Check minimum side length
    static checkMinimumSideLength(coordinates, minLength) {
        const tinySegments = [];
        
        for (let i = 0; i < coordinates.length - 1; i++) {
            const distance = GeoUtils.distance(coordinates[i], coordinates[i + 1]);
            if (distance < minLength) {
                tinySegments.push({
                    index: i,
                    length: distance
                });
            }
        }
        
        return tinySegments;
    }
    
    // Check coordinate precision
    static checkCoordinatePrecision(coordinates, minDecimals = 6) {
        let lowPrecisionCount = 0;
        
        for (const coord of coordinates) {
            const lngDecimals = (coord[0].toString().split('.')[1] || '').length;
            const latDecimals = (coord[1].toString().split('.')[1] || '').length;
            
            if (lngDecimals < minDecimals || latDecimals < minDecimals) {
                lowPrecisionCount++;
            }
        }
        
        return lowPrecisionCount;
    }
    
    // Get assessment based on score
    static getAssessment(score) {
        if (score >= 95) return { level: 'excellent', message: 'Excellent - Fully compliant' };
        if (score >= 80) return { level: 'good', message: 'Good - Minor issues only' };
        if (score >= 60) return { level: 'fair', message: 'Fair - Some improvements needed' };
        if (score >= 40) return { level: 'poor', message: 'Poor - Major issues present' };
        return { level: 'critical', message: 'Critical - Not suitable for registration' };
    }
    
    // Generate compliance report
    static generateReport(compliance, fieldData = {}) {
        return {
            timestamp: new Date().toISOString(),
            fieldId: fieldData.ccsFieldId || 'Unknown',
            complianceScore: compliance.score,
            assessment: compliance.assessment,
            status: compliance.compliant ? 'PASS' : 'FAIL',
            criticalIssues: compliance.issues.filter(i => i.severity === 'critical').length,
            majorIssues: compliance.issues.filter(i => i.severity === 'major').length,
            warnings: compliance.warnings.length,
            details: {
                areaHa: compliance.metrics.areaHa,
                vertices: compliance.metrics.vertices,
                issues: compliance.issues,
                warnings: compliance.warnings
            }
        };
    }
    
    // Batch check multiple fields
    static batchCheck(fields) {
        return fields.map(field => ({
            fieldId: field.ccsFieldId,
            compliance: this.check(field.coordinates || field.originalCoordinates, field)
        }));
    }
}
