// ============================================
// DATA DIAGNOSTIC SCRIPT
// Copy and paste this into browser console
// ============================================

console.log("🔍 RUNNING DIAGNOSTIC...\n");

// 1. Check memory mode
console.log("1️⃣ STORAGE MODE:");
console.log(`   Memory-only mode: ${StorageService.memoryOnlyMode}`);
console.log(`   Storage available: ${StorageService.isStorageAvailable()}`);

// 2. Check memory arrays
console.log("\n2️⃣ MEMORY ARRAYS:");
console.log(`   inMemoryFields: ${StorageService.inMemoryFields.length} records`);
console.log(`   inMemoryFailedRecords: ${StorageService.inMemoryFailedRecords.length} records`);

// 3. Check localStorage
console.log("\n3️⃣ LOCALSTORAGE:");
try {
    const lsFields = localStorage.getItem('fields');
    const lsFailedRecords = localStorage.getItem('failedRecords');
    console.log(`   localStorage 'fields': ${lsFields ? JSON.parse(lsFields).length : 0} records`);
    console.log(`   localStorage 'failedRecords': ${lsFailedRecords ? JSON.parse(lsFailedRecords).length : 0} records`);
} catch (e) {
    console.log(`   localStorage error: ${e.message}`);
}

// 4. Check what getAllFields returns
console.log("\n4️⃣ GETALLFIELDS RETURNS:");
const allFields = StorageService.getAllFields();
console.log(`   Total: ${allFields.length} records`);

// 5. Break down by parseError
console.log("\n5️⃣ BREAKDOWN:");
const successful = allFields.filter(f => !f.parseError);
const failed = allFields.filter(f => f.parseError);
console.log(`   Successful: ${successful.length}`);
console.log(`   Failed: ${failed.length}`);

// 6. Failed records by type
console.log("\n6️⃣ FAILED RECORDS BY TYPE:");
const failureTypes = {};
failed.forEach(f => {
    const type = f.parseErrorType || 'UNKNOWN';
    failureTypes[type] = (failureTypes[type] || 0) + 1;
});
Object.entries(failureTypes).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
});

// 7. Check for duplicates
console.log("\n7️⃣ DUPLICATE CHECK:");
const fieldIds = allFields.map(f => f.ccsFieldId);
const uniqueIds = new Set(fieldIds);
console.log(`   Total field IDs: ${fieldIds.length}`);
console.log(`   Unique field IDs: ${uniqueIds.size}`);
console.log(`   Duplicates: ${fieldIds.length - uniqueIds.size}`);

// 8. Sample failed records
console.log("\n8️⃣ SAMPLE FAILED RECORDS:");
if (failed.length > 0) {
    console.log("First 3 failed records:");
    failed.slice(0, 3).forEach((f, i) => {
        console.log(`   ${i+1}. ${f.ccsFieldId} - ${f.parseErrorType}: ${f.parseErrorMessage?.substring(0, 50)}`);
    });
}

// 9. Check clearAll function
console.log("\n9️⃣ CLEARALL FUNCTION CHECK:");
console.log(`   Function exists: ${typeof StorageService.clearAll === 'function'}`);
console.log(`   Source code preview:`);
console.log(`   ${StorageService.clearAll.toString().substring(0, 200)}...`);

console.log("\n✅ DIAGNOSTIC COMPLETE");
console.log("\n💡 TO FIX: Run the following:");
console.log("   StorageService.clearAll();");
console.log("   Then re-import your CSV file ONCE");
