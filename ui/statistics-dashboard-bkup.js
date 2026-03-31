// Statistics Dashboard - Manager-Friendly Summary
import { StorageService } from '../services/storage-service.js';

export class StatisticsDashboard {
    
    /**
     * Calculate and display overall statistics
     * Returns simple counts for manager dashboard
     */
    static calculateStatistics() {
        const allFields = StorageService.getAllFields();
        
        console.log(`📊 Calculating statistics for ${allFields.length} fields...`);
        
        const stats = {
            total: allFields.length,
            valid: 0,
            invalid: 0,
            canBeFixed: 0,
            needsManual: 0,
            duplicates: 0,
            parseFailed: 0,  // NEW: Parse failures
            notValidatedYet: 0,  // NEW: Fields without Verra validation
            autoCorrected: 0,  // NEW: Auto-corrected fields
            manuallyCorrected: 0,  // NEW: Manually corrected fields
            
            // NEW: Manual flags breakdown
            manualFlags: {
                total: 0,
                selfIntersection: 0,
                straightLine: 0,
                bowTie: 0,
                overlapping: 0,  // NEW
                otherIssue: 0
            },
            
            // Issue breakdown
            issues: {
                selfIntersections: 0,
                notClosed: 0,
                tooFewVertices: 0,
                noArea: 0,
                duplicateVertices: 0
            }
        };
        
        let hasValidation = 0;
        let hasVerraStatus = 0;
        
        // Count duplicates by field ID IN FINAL DATA (should be 0 after deduplication)
        const fieldIdCounts = new Map();
        allFields.forEach(field => {
            const id = field.ccsFieldId;
            fieldIdCounts.set(id, (fieldIdCounts.get(id) || 0) + 1);
        });
        
        // Count how many fields have duplicate IDs in final data
        let duplicatesInFinalData = 0;
        allFields.forEach(field => {
            if (fieldIdCounts.get(field.ccsFieldId) > 1) {
                duplicatesInFinalData++;
            }
        });
        
        // NEW: Get duplicates found during import (from source CSV)
        const importStats = StorageService.getImportStats();
        console.log('📊 Statistics: Retrieved import stats:', importStats);
        stats.duplicates = importStats.duplicatesFound || 0;
        console.log('📊 Statistics: Setting duplicates to:', stats.duplicates);
        
        // If there are ALSO duplicates in final data (shouldn't happen), add them
        if (duplicatesInFinalData > 0) {
            console.warn(`⚠️ Found ${duplicatesInFinalData} duplicates in final stored data! This shouldn't happen.`);
            stats.duplicates = Math.max(stats.duplicates, duplicatesInFinalData);
        }
        
        // Analyze each field
        allFields.forEach(field => {
            // NEW: Count manual flags (independent of validation status)
            if (field.manualFlags) {
                let hasFlag = false;
                if (field.manualFlags.selfIntersection) {
                    stats.manualFlags.selfIntersection++;
                    hasFlag = true;
                }
                if (field.manualFlags.straightLine) {
                    stats.manualFlags.straightLine++;
                    hasFlag = true;
                }
                if (field.manualFlags.bowTie) {
                    stats.manualFlags.bowTie++;
                    hasFlag = true;
                }
                if (field.manualFlags.otherIssue) {
                    stats.manualFlags.otherIssue++;
                    hasFlag = true;
                }
                if (hasFlag) {
                    stats.manualFlags.total++;
                }
            }
            
            // NEW: Count overlapping polygons (from overlap detection)
            if (field.hasOverlaps && field.overlaps && field.overlaps.length > 0) {
                stats.manualFlags.overlapping++;
                if (!stats.manualFlags.total || (field.manualFlags && Object.keys(field.manualFlags).length === 0)) {
                    stats.manualFlags.total++;
                }
            }
            
            // NEW: Count parse failures first
            if (field.parseError === true) {
                stats.parseFailed++;
                return; // Skip validation checks for parse failures
            }
            
            if (!field.validation) {
                // Not validated yet
                stats.invalid++;
                return;
            }
            
            hasValidation++;
            
            const validation = field.validation;
            
            // CRITICAL: Check correction status FIRST (mutually exclusive counting)
            // Priority: Corrections > Validation Status
            
            // 1. Check if correction was applied
            if (field.correction?.applied && field.correctedCoordinates) {
                if (field.correction.method === 'auto_correct') {
                    stats.autoCorrected++;
                    // Field is corrected, NOT counted in canBeFixed
                } else if (field.correction.method === 'manual_edit') {
                    stats.manuallyCorrected++;
                    // Field is corrected, NOT counted in canBeFixed or needsManual
                }
                // Don't check validation status - field is already corrected
                return;
            }
            
            // 2. Only if NOT corrected, check validation status
            if (validation.verra) {
                hasVerraStatus++;
                
                if (validation.verra.overallStatus === 'PASS') {
                    stats.valid++;
                } else if (validation.verra.overallStatus === 'FIXABLE') {
                    stats.canBeFixed++;  // Only counted if NOT yet corrected
                    stats.invalid++;
                } else if (validation.verra.overallStatus === 'NEEDS_MANUAL_FIX') {
                    stats.needsManual++;  // Only counted if NOT yet corrected
                    stats.invalid++;
                } else {
                    // Unknown status, treat as invalid
                    stats.invalid++;
                }
                
                // Count specific issues
                if (!validation.verra.checks.simple.pass) {
                    stats.issues.selfIntersections++;
                }
                if (!validation.verra.checks.closed.pass) {
                    stats.issues.notClosed++;
                }
                if (!validation.verra.checks.minVertices.pass) {
                    stats.issues.tooFewVertices++;
                }
                if (!validation.verra.checks.positiveArea.pass) {
                    stats.issues.noArea++;
                }
            } else {
                // No Verra validation present - count as NOT VALIDATED YET
                // Don't try to categorize without proper validation!
                stats.notValidatedYet++;
                
                // For backwards compatibility, also count in invalid
                // (but don't categorize as fixable/manual)
                if (!validation.isValid) {
                    stats.invalid++;
                }
            }
        });
        
        // Log validation status
        console.log(`   Fields with validation: ${hasValidation}/${allFields.length}`);
        console.log(`   Fields with Verra status: ${hasVerraStatus}/${allFields.length}`);
        if (hasValidation === 0) {
            console.warn('   ⚠️ No fields have been validated yet!');
            console.warn('   ⚠️ Click "Process All Fields" to validate and populate statistics.');
        }
        
        // Calculate percentages
        stats.validPercent = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;
        stats.canBeFixedPercent = stats.total > 0 ? Math.round((stats.canBeFixed / stats.total) * 100) : 0;
        stats.needsManualPercent = stats.total > 0 ? Math.round((stats.needsManual / stats.total) * 100) : 0;
        stats.invalidPercent = stats.total > 0 ? Math.round((stats.invalid / stats.total) * 100) : 0;
        stats.duplicatePercent = stats.total > 0 ? Math.round((stats.duplicates / stats.total) * 100) : 0;
        stats.parseFailedPercent = stats.total > 0 ? Math.round((stats.parseFailed / stats.total) * 100) : 0;
        
        return stats;
    }
    
    /**
     * Display statistics in manager-friendly format
     * Updates the colored statistics cards
     */
    static displayStatistics(containerId = 'statisticsDashboard') {
        const stats = this.calculateStatistics();
        
        // Update the stat cards that are already in the HTML
        const totalEl = document.getElementById('totalFieldsCount');
        const validEl = document.getElementById('validFieldsCount');
        const validPercentEl = document.getElementById('validPercentage');
        const fixableEl = document.getElementById('fixableFieldsCount');
        const fixablePercentEl = document.getElementById('fixablePercentage');
        const autoCorrectedEl = document.getElementById('autoCorrectedCount');  // NEW
        const autoCorrectedPercentEl = document.getElementById('autoCorrectedPercentage');  // NEW
        const manuallyCorrectedEl = document.getElementById('manuallyCorrectedCount');  // NEW
        const manuallyCorrectedPercentEl = document.getElementById('manuallyCorrectedPercentage');  // NEW
        const manualEl = document.getElementById('manualFieldsCount');
        const manualPercentEl = document.getElementById('manualPercentage');
        const duplicateEl = document.getElementById('duplicateFieldsCount');
        const duplicatePercentEl = document.getElementById('duplicatePercentage');
        const parseFailedEl = document.getElementById('parseFailedCount');  // NEW
        const parseFailedPercentEl = document.getElementById('parseFailedPercentage');  // NEW
        
        // Update numbers
        // Total includes duplicates found in source CSV
        const totalWithDuplicates = stats.total + stats.duplicates;
        if (totalEl) {
            totalEl.textContent = totalWithDuplicates.toLocaleString();
            console.log(`📊 Total Fields display: ${totalWithDuplicates} (${stats.total} unique + ${stats.duplicates} duplicates)`);
        }
        
        if (validEl) validEl.textContent = stats.valid.toLocaleString();
        if (validPercentEl) validPercentEl.textContent = `${stats.validPercent}%`;
        
        if (fixableEl) fixableEl.textContent = stats.canBeFixed.toLocaleString();
        if (fixablePercentEl) fixablePercentEl.textContent = `${stats.canBeFixedPercent}%`;
        
        // NEW: Update auto-corrected count (applied corrections)
        if (autoCorrectedEl) autoCorrectedEl.textContent = stats.autoCorrected.toLocaleString();
        if (autoCorrectedPercentEl) {
            const autoCorrectedPercent = stats.total > 0 ? Math.round((stats.autoCorrected / stats.total) * 100) : 0;
            autoCorrectedPercentEl.textContent = `${autoCorrectedPercent}%`;
        }
        
        // NEW: Update manually-corrected count (applied manual edits)
        if (manuallyCorrectedEl) manuallyCorrectedEl.textContent = stats.manuallyCorrected.toLocaleString();
        if (manuallyCorrectedPercentEl) {
            const manuallyCorrectedPercent = stats.total > 0 ? Math.round((stats.manuallyCorrected / stats.total) * 100) : 0;
            manuallyCorrectedPercentEl.textContent = `${manuallyCorrectedPercent}%`;
        }
        
        if (manualEl) manualEl.textContent = stats.needsManual.toLocaleString();
        if (manualPercentEl) manualPercentEl.textContent = `${stats.needsManualPercent}%`;
        
        if (duplicateEl) {
            console.log('📊 Updating duplicateEl:', {
                before: duplicateEl.textContent,
                stats_value: stats.duplicates,
                formatted: stats.duplicates.toLocaleString()
            });
            duplicateEl.textContent = stats.duplicates.toLocaleString();
            console.log('📊 After update:', duplicateEl.textContent);
        } else {
            console.error('❌ duplicateEl not found!');
        }
        if (duplicatePercentEl) duplicatePercentEl.textContent = `${stats.duplicatePercent}%`;
        
        // NEW: Update parse failed stats
        if (parseFailedEl) parseFailedEl.textContent = stats.parseFailed.toLocaleString();
        if (parseFailedPercentEl) parseFailedPercentEl.textContent = `${stats.parseFailedPercent}%`;
        
        // Update VERRA READY count (Valid + Auto-Corrected + Manually Corrected)
        const verraReadyEl = document.getElementById('verraReadyCount');
        const verraReadyPercentEl = document.getElementById('verraReadyPercentage');
        const verraReadyCount = stats.valid + stats.canBeFixed + stats.manuallyCorrected;  // UPDATED!
        const verraReadyPercent = stats.total > 0 ? Math.round((verraReadyCount / stats.total) * 100) : 0;
        
        if (verraReadyEl) verraReadyEl.textContent = verraReadyCount.toLocaleString();
        if (verraReadyPercentEl) verraReadyPercentEl.textContent = `${verraReadyPercent}%`;
        
        // NEW: Update VERRA READY breakdown
        const verraBreakdownEl = document.getElementById('verraReadyBreakdown');
        if (verraBreakdownEl) {
            const breakdownHTML = `
                <div style="font-size: 11px; color: #6c757d; margin-top: 6px; line-height: 1.4;">
                    • Valid (original): ${stats.valid.toLocaleString()}<br>
                    • Auto-Corrected: ${stats.autoCorrected.toLocaleString()}<br>
                    • Manually Corrected: ${stats.manuallyCorrected.toLocaleString()}
                </div>
            `;
            verraBreakdownEl.innerHTML = breakdownHTML;
        }
        
        // Show/hide NOT VALIDATED box
        const notValidatedBox = document.getElementById('notValidatedBox');
        const notValidatedEl = document.getElementById('notValidatedCount');
        const notValidatedPercentEl = document.getElementById('notValidatedPercentage');
        
        if (stats.notValidatedYet > 0) {
            // Show NOT VALIDATED box
            if (notValidatedBox) notValidatedBox.style.display = 'block';
            if (notValidatedEl) notValidatedEl.textContent = stats.notValidatedYet.toLocaleString();
            if (notValidatedPercentEl) {
                const notValidatedPercent = stats.total > 0 ? Math.round((stats.notValidatedYet / stats.total) * 100) : 0;
                notValidatedPercentEl.textContent = `${notValidatedPercent}%`;
            }
        } else {
            // Hide NOT VALIDATED box after processing
            if (notValidatedBox) notValidatedBox.style.display = 'none';
        }
        
        // Show/hide MANUAL FLAGS box
        const manualFlagsBox = document.getElementById('manualFlagsBox');
        const totalManualFlagsCount = document.getElementById('totalManualFlagsCount');
        const selfIntersectionFlagsCount = document.getElementById('selfIntersectionFlagsCount');
        const straightLineFlagsCount = document.getElementById('straightLineFlagsCount');
        const bowTieFlagsCount = document.getElementById('bowTieFlagsCount');
        const overlappingFlagsCount = document.getElementById('overlappingFlagsCount');  // NEW
        const otherIssueFlagsCount = document.getElementById('otherIssueFlagsCount');
        
        if (stats.manualFlags.total > 0) {
            // Show MANUAL FLAGS box
            if (manualFlagsBox) manualFlagsBox.style.display = 'block';
            if (totalManualFlagsCount) totalManualFlagsCount.textContent = stats.manualFlags.total.toLocaleString();
            if (selfIntersectionFlagsCount) selfIntersectionFlagsCount.textContent = stats.manualFlags.selfIntersection.toLocaleString();
            if (straightLineFlagsCount) straightLineFlagsCount.textContent = stats.manualFlags.straightLine.toLocaleString();
            if (bowTieFlagsCount) bowTieFlagsCount.textContent = stats.manualFlags.bowTie.toLocaleString();
            if (overlappingFlagsCount) overlappingFlagsCount.textContent = stats.manualFlags.overlapping.toLocaleString();  // NEW
            if (otherIssueFlagsCount) otherIssueFlagsCount.textContent = stats.manualFlags.otherIssue.toLocaleString();
        } else {
            // Hide MANUAL FLAGS box if no flags
            if (manualFlagsBox) manualFlagsBox.style.display = 'none';
        }
        
        // ============================================================
        // UPDATE HERO SECTION (for redesigned dashboard)
        // ============================================================
        if (typeof updateHeroSection === 'function') {
            updateHeroSection(stats);
        }
        
        console.log('✅ Statistics dashboard updated:');
        console.log('   Total:', stats.total);
        console.log('   Valid:', stats.valid, `(${stats.validPercent}%)`);
        console.log('   Can Be Auto-Fixed:', stats.canBeFixed, `(${stats.canBeFixedPercent}%)`);
        console.log('   🤖 Auto-Corrected (applied):', stats.autoCorrected);
        console.log('   ✋ Manually Corrected (applied):', stats.manuallyCorrected);
        console.log('   Needs Manual:', stats.needsManual, `(${stats.needsManualPercent}%)`);
        console.log('   Duplicates:', stats.duplicates, `(${stats.duplicatePercent}%)`);
        console.log('   Parse Failed:', stats.parseFailed, `(${stats.parseFailedPercent}%)`);
        console.log('   ✅ VERRA READY:', verraReadyCount, `(${verraReadyPercent}%)`);
        if (stats.notValidatedYet > 0) {
            console.log('   ⚠️ Not Validated Yet:', stats.notValidatedYet);
        }
        
        return stats;
    }
    
    /**
     * Get plain English explanation for why field is invalid
     */
    static getInvalidReason(field) {
        if (!field.validation) {
            return 'Not validated yet';
        }
        
        const validation = field.validation;
        const reasons = [];
        
        if (validation.verra) {
            // Check Verra validation results
            if (!validation.verra.checks.simple.pass) {
                reasons.push('Lines cross each other');
            }
            if (!validation.verra.checks.closed.pass) {
                reasons.push('Field boundary is not closed');
            }
            if (!validation.verra.checks.minVertices.pass) {
                reasons.push('Not enough points to make a field');
            }
            if (!validation.verra.checks.positiveArea.pass) {
                reasons.push('Field has no area');
            }
        } else {
            // Fallback to regular validation
            if (validation.errors && validation.errors.length > 0) {
                // Convert technical errors to plain English
                validation.errors.forEach(error => {
                    if (error.includes('self-intersect')) {
                        reasons.push('Lines cross each other');
                    } else if (error.includes('vertices')) {
                        reasons.push('Not enough points');
                    } else if (error.includes('area')) {
                        reasons.push('Area too small');
                    } else {
                        reasons.push(error);
                    }
                });
            }
        }
        
        return reasons.length > 0 ? reasons : ['Unknown issue'];
    }
    
    /**
     * Get plain English fix instructions
     */
    static getFixInstructions(field) {
        if (!field.validation) {
            return ['Click "Validate" to check this field'];
        }
        
        const validation = field.validation;
        const instructions = [];
        
        if (validation.verra) {
            if (validation.verra.overallStatus === 'PASS') {
                return ['✅ Field is valid! Ready to export.'];
            } else if (validation.verra.overallStatus === 'FIXABLE') {
                instructions.push('1. Click "Auto-Correct" button below');
                instructions.push('2. System will fix the issues automatically');
                instructions.push('3. Validate again to confirm');
            } else if (validation.verra.overallStatus === 'NEEDS_MANUAL_FIX') {
                instructions.push('1. Click "Manual Edit" button below');
                instructions.push('2. Drag the red dots (vertices) to fix');
                instructions.push('3. Make sure lines don\'t cross');
                instructions.push('4. Click "Save" when done');
            }
        } else {
            if (validation.isValid) {
                return ['✅ Field is valid! Ready to export.'];
            } else {
                instructions.push('1. Click "Validate" to see detailed issues');
                instructions.push('2. Click "Auto-Correct" to try automatic fix');
                instructions.push('3. If that doesn\'t work, use "Manual Edit"');
            }
        }
        
        return instructions.length > 0 ? instructions : ['Click "Validate" first'];
    }
}
