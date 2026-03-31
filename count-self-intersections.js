// SELF-INTERSECTION DIAGNOSTIC SCRIPT
// Paste this into the browser console on the main app page

console.log('🔍 SELF-INTERSECTION ANALYSIS');
console.log('═══════════════════════════════════════\n');

const allFields = StorageService.getAllFields();

let totalFields = allFields.length;
let selfIntersectionCount = 0;
let autoFixedSelfInt = 0;
let manualNeededSelfInt = 0;
let validSelfInt = 0;

// Track self-intersection fields
const selfIntFields = [];

allFields.forEach(field => {
    if (!field.validation || !field.validation.verra) {
        return;
    }
    
    const checks = field.validation.verra.checks;
    const errors = field.validation.errors || [];
    const hasSelfIntersection = field.validation.metrics?.hasSelfIntersection;
    
    // Check for self-intersection using EXACT same logic as FilterManager
    const isSelfIntersecting = !checks?.simple?.pass || 
                               errors.some(e => e.toLowerCase().includes('self-intersection')) ||
                               hasSelfIntersection;
    
    if (isSelfIntersecting) {
        selfIntersectionCount++;
        
        const overallStatus = field.validation.verra.overallStatus;
        
        // Track what happened to this field
        if (overallStatus === 'PASS') {
            validSelfInt++;
        } else if (overallStatus === 'FIXABLE') {
            autoFixedSelfInt++;
        } else if (overallStatus === 'NEEDS_MANUAL_FIX') {
            manualNeededSelfInt++;
        }
        
        selfIntFields.push({
            id: field.ccsFieldId,
            status: overallStatus,
            area: field.validation.metrics?.areaHa?.toFixed(2) || '0.00',
            vertices: field.originalCoordinates?.length || 0
        });
    }
});

console.log('📊 RESULTS:');
console.log('─────────────────────────────────────');
console.log(`Total Fields:                    ${totalFields.toLocaleString()}`);
console.log(`\nFields with Self-Intersections:  ${selfIntersectionCount.toLocaleString()}`);
console.log(`  ├─ Valid (auto-fixed):         ${validSelfInt.toLocaleString()}`);
console.log(`  ├─ Auto-Fixable:               ${autoFixedSelfInt.toLocaleString()}`);
console.log(`  └─ Needs Manual:               ${manualNeededSelfInt.toLocaleString()}`);
console.log('─────────────────────────────────────\n');

// Verify math
const total = validSelfInt + autoFixedSelfInt + manualNeededSelfInt;
if (total === selfIntersectionCount) {
    console.log('✅ Math verified:', total, '=', selfIntersectionCount);
} else {
    console.warn('⚠️ Math mismatch:', total, '≠', selfIntersectionCount);
}

console.log('\n📋 BREAKDOWN BY STATUS:');
console.log('─────────────────────────────────────');
console.log(`PASS:              ${validSelfInt.toLocaleString()} (${(validSelfInt/selfIntersectionCount*100).toFixed(1)}%)`);
console.log(`FIXABLE:           ${autoFixedSelfInt.toLocaleString()} (${(autoFixedSelfInt/selfIntersectionCount*100).toFixed(1)}%)`);
console.log(`NEEDS_MANUAL_FIX:  ${manualNeededSelfInt.toLocaleString()} (${(manualNeededSelfInt/selfIntersectionCount*100).toFixed(1)}%)`);

console.log('\n🎯 RELATIONSHIP TO RIGHT SIDEBAR:');
console.log('─────────────────────────────────────');
console.log(`Auto-Corrected panel (1,762) includes:`);
console.log(`  ✓ ${autoFixedSelfInt.toLocaleString()} self-intersections (FIXABLE)`);
console.log(`  ✓ ~${(1762 - autoFixedSelfInt).toLocaleString()} other fixable issues (Not Closed, Duplicates)`);

console.log(`\nNeeds Manual panel (350) includes:`);
console.log(`  ✓ ${manualNeededSelfInt.toLocaleString()} self-intersections (complex)`);
console.log(`  ✓ ~${(350 - manualNeededSelfInt).toLocaleString()} other issues (Too Few Vertices, Zero Area, etc.)`);

console.log('\n💡 KEY INSIGHT:');
console.log('─────────────────────────────────────');
console.log(`Of ${selfIntersectionCount.toLocaleString()} self-intersection fields:`);
console.log(`  • ${validSelfInt.toLocaleString()} were auto-corrected to VALID`);
console.log(`  • ${autoFixedSelfInt.toLocaleString()} are auto-fixable but not yet valid`);
console.log(`  • ${manualNeededSelfInt.toLocaleString()} are too complex for auto-correction`);

// Store for further analysis
window.selfIntFields = selfIntFields;
console.log('\n📁 Stored field list in: window.selfIntFields');
console.log('   View with: console.table(selfIntFields.slice(0, 10))');
