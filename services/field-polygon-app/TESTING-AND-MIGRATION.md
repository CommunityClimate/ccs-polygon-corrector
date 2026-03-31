# 🧪 Testing Guide & Storage Migration Plan

## ✅ **Phase 1: Memory-Only Testing (NOW)**

### **What You Have:**
- ✅ Import 22,525+ records (no quota errors)
- ✅ Fast bulk import (~10-15 seconds)
- ✅ CSV parsing (Field GeoJSON column)
- ✅ Polygon validation
- ✅ Auto-correction
- ✅ Verra compliance checking
- ✅ Export (GeoJSON, CSV, KML, Excel)
- ✅ Catalog view with search/filter
- ⚠️ Data lost on page refresh (EXPECTED)

### **What's Missing (for later):**
- ❌ Manual drag-to-align vertices
- ❌ Add/remove vertices
- ❌ Persistent storage
- ❌ Microsoft D365 integration

---

## 📋 **Testing Checklist**

### **Test 1: Import Your Full Dataset**
```
□ Start server: python -m http.server 8080
□ Open http://localhost:8080
□ Import your 22,525-record CSV
□ Check progress bar reaches 100%
□ Verify success message shows correct count
□ Check browser console (F12) for errors
```

**Expected Result:**
```
✅ Import Complete!
• Successfully imported: 22,525 field(s)
• Errors/Invalid: 64 row(s)
• Empty GeoJSON: 3,767 row(s)
• Total rows processed: 26,356
```

### **Test 2: Field Selection & Display**
```
□ Click field dropdown - should show all 22,525 fields
□ Select a field (e.g., "FLD-F8D1V-F2Z5K-001")
□ Click "Load Field"
□ Map should display the polygon
□ Check polygon appears in correct location
```

**Expected Result:**
- Polygon appears on map
- Coordinates visible in info panel
- No errors in console

### **Test 3: Validation**
```
□ With field loaded, click "Validate Polygon"
□ Check validation results panel appears
□ Review errors/warnings
□ Check Verra compliance score
```

**Expected Result:**
- Validation panel shows results
- Issues listed (if any)
- Verra score displayed (0-100)

### **Test 4: Auto-Correction**
```
□ Load a field with issues (e.g., self-intersections)
□ Click "Validate" to see errors
□ Click "Auto-Correct"
□ Check before/after comparison
□ Green polygon (corrected) overlays red (original)
```

**Expected Result:**
- Corrected polygon appears green
- Original polygon shows red dashed
- Validation re-runs automatically
- Issues reduced/eliminated

### **Test 5: Catalog View**
```
□ Click "View Catalog" (bottom right)
□ Browse through pages
□ Use search box (search by field ID)
□ Try filters (corrected/pending/issues)
□ Test sorting options
```

**Expected Result:**
- All 22,525 fields browsable
- Search works
- Filters work
- Pagination works

### **Test 6: Export Functions**
```
□ Load and correct a field
□ Click "Export GeoJSON"
□ Verify file downloads
□ Open file - check data is correct
□ Test other export formats (CSV, KML, Excel)
```

**Expected Result:**
- Files download successfully
- Data is complete and accurate
- Can re-import exported files

### **Test 7: Memory-Only Behavior**
```
□ Import your dataset
□ Make some corrections
□ Refresh the page (Ctrl+R or F5)
□ Check if data is gone
```

**Expected Result:**
- ⚠️ All data SHOULD be lost (this is correct!)
- Warning banner reminds you to export
- Page loads fresh

### **Test 8: Performance with Large Dataset**
```
□ Import all 22,525 records
□ Note import time (should be ~15 seconds)
□ Test field dropdown responsiveness
□ Load different fields (should be instant)
□ Check browser memory usage (Task Manager)
```

**Expected Result:**
- Import: 10-20 seconds
- Field switching: <1 second
- Browser memory: 200-500 MB
- No freezing or crashes

---

## 🐛 **If You Find Issues:**

### **Issue: Import Fails**
**Check:**
1. Browser console (F12) for errors
2. CSV format matches expected columns
3. Internet connection (for map tiles)

**Solution:**
- See CSV-DEBUG-GUIDE.md
- Try sample-data-geojson-column.csv first

### **Issue: Map Doesn't Load**
**Check:**
1. Internet connection
2. Browser console for tile errors

**Solution:**
- Check firewall settings
- Try different browser

### **Issue: Validation Errors**
**Expected:**
- Some fields will have errors (this is normal!)
- That's why you need auto-correction

### **Issue: Performance Slow**
**Check:**
1. Close other browser tabs
2. Check memory usage
3. Try smaller dataset first (1,000 records)

---

## 🔄 **Phase 2: Storage Migration (LATER)**

When testing is complete and you want persistence:

### **Option A: Enable IndexedDB**

**Step 1: Create IndexedDB Module**
Create `services/indexeddb-service.js`:
```javascript
// IndexedDB wrapper for large datasets
export class IndexedDBService {
    static dbName = 'FieldPolygonDB';
    static storeName = 'fields';
    static db = null;
    
    static async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'ccsFieldId' });
                }
            };
        });
    }
    
    static async saveFields(fields) {
        await this.init();
        const tx = this.db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        
        for (const field of fields) {
            store.put(field);
        }
        
        return tx.complete;
    }
    
    static async getAllFields() {
        await this.init();
        const tx = this.db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
```

**Step 2: Update Storage Service**
In `services/storage-service.js`:
```javascript
// Line 8-9:
static memoryOnlyMode = false;  // ← Change to false
static useIndexedDB = true;     // ← Add this

// In bulkSaveFields():
if (this.useIndexedDB) {
    await IndexedDBService.saveFields(newFields);
    return newFields.length;
}
```

**Step 3: Test**
- Import dataset
- Refresh page
- Data should persist!

### **Option B: Enable Dynamics 365 Integration**

**Step 1: Create D365 Custom Entity**
```xml
Entity: ccs_fieldpolygon
Fields:
- ccs_fieldpolygonid (Primary Key - GUID)
- ccs_fieldid (Text, 100 chars)
- ccs_fieldowner (Text, 200 chars)
- ccs_originalgeojson (Multiple Lines of Text, 100,000 chars)
- ccs_correctedgeojson (Multiple Lines of Text, 100,000 chars)
- ccs_areahaectares (Decimal, 2 decimals)
- ccs_vertexcount (Whole Number)
- ccs_isvalid (Two Options - Yes/No)
- ccs_iscorrected (Two Options - Yes/No)
- ccs_verracompliant (Two Options - Yes/No)
- ccs_verrascore (Whole Number, 0-100)
- ccs_zone (Text, 50 chars)
- ccs_correctionstatus (Option Set: Pending, Approved, Rejected)
```

**Step 2: Create Dynamics Service**
Create `services/dynamics-service.js`:
```javascript
export class DynamicsService {
    static baseUrl = '';  // Set from config
    static entityName = 'ccs_fieldpolygons';
    
    static async authenticate() {
        // Authentication handled by D365 context
        return true;
    }
    
    static async saveFields(fields) {
        const requests = fields.map(field => ({
            method: 'POST',
            url: `${this.baseUrl}/api/data/v9.2/${this.entityName}`,
            headers: {
                'Content-Type': 'application/json',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0'
            },
            body: JSON.stringify({
                ccs_fieldid: field.ccsFieldId,
                ccs_fieldowner: field.fieldOwner,
                ccs_originalgeojson: JSON.stringify(field.originalCoordinates),
                ccs_correctedgeojson: field.correctedCoordinates ? 
                    JSON.stringify(field.correctedCoordinates) : null,
                ccs_areahaectares: field.validation?.areaHa || 0,
                ccs_vertexcount: field.originalCoordinates?.length || 0,
                ccs_isvalid: field.validation?.isValid || false,
                ccs_iscorrected: !!field.correctedCoordinates,
                ccs_verracompliant: field.verra?.compliant || false,
                ccs_verrascore: field.verra?.score || 0,
                ccs_zone: field.zone || ''
            })
        }));
        
        // Execute batch request
        const response = await fetch(`${this.baseUrl}/api/data/v9.2/$batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'multipart/mixed; boundary=batch_boundary',
                'OData-MaxVersion': '4.0',
                'OData-Version': '4.0'
            },
            body: this.createBatchBody(requests)
        });
        
        return response.ok;
    }
    
    static async getAllFields() {
        const response = await fetch(
            `${this.baseUrl}/api/data/v9.2/${this.entityName}?$select=ccs_fieldid,ccs_originalgeojson,ccs_correctedgeojson`,
            {
                headers: {
                    'OData-MaxVersion': '4.0',
                    'OData-Version': '4.0'
                }
            }
        );
        
        const data = await response.json();
        
        return data.value.map(record => ({
            ccsFieldId: record.ccs_fieldid,
            originalCoordinates: JSON.parse(record.ccs_originalgeojson),
            correctedCoordinates: record.ccs_correctedgeojson ? 
                JSON.parse(record.ccs_correctedgeojson) : null
        }));
    }
}
```

**Step 3: Update Config**
In `config/app-config.js`:
```javascript
DYNAMICS: {
    ENABLED: true,  // ← Change to true
    BASE_URL: 'https://yourorg.crm.dynamics.com',  // ← Your D365 URL
    API_VERSION: 'v9.2',
    ENTITY_NAME: 'ccs_fieldpolygons'
}
```

**Step 4: Update Storage Service**
In `services/storage-service.js`:
```javascript
import { DynamicsService } from './dynamics-service.js';

static memoryOnlyMode = false;  // ← Change to false
static useDynamics365 = true;   // ← Add this

// In bulkSaveFields():
if (this.useDynamics365) {
    await DynamicsService.saveFields(newFields);
    return newFields.length;
}
```

**Step 5: Deploy to D365**
1. Upload all files as web resources
2. Create model-driven app page
3. Add web resource to form
4. Configure security roles

---

## 🎯 **Migration Decision Matrix**

| Requirement | Memory-Only | IndexedDB | Dynamics 365 |
|-------------|-------------|-----------|--------------|
| **No quota errors** | ✅ | ✅ | ✅ |
| **Persist data** | ❌ | ✅ | ✅ |
| **Multi-user** | ❌ | ❌ | ✅ |
| **Cloud backup** | ❌ | ❌ | ✅ |
| **Team collaboration** | ❌ | ❌ | ✅ |
| **Setup time** | ✅ Done | 1-2 hours | 4-6 hours |
| **Complexity** | Low | Medium | High |
| **Best for** | Testing | Single user | Production |

---

## 📊 **Recommended Path**

### **Week 1: Testing (Memory-Only)**
✅ Current version
- Import your full dataset
- Test all features
- Validate workflow
- Export results
- Confirm everything works

### **Week 2: Add Missing Features**
⚠️ Still need to add:
- Manual drag-to-align vertices
- Add/remove vertices functionality
- Intelligence level selection
- Reset corrections button

### **Week 3: Storage Decision**
Based on testing results:
- **If single-user:** IndexedDB
- **If team/production:** Dynamics 365

### **Week 4: Production Deployment**
- Final testing
- Documentation
- Team training
- Go live

---

## ⚠️ **Critical Reminders**

### **During Memory-Only Testing:**
1. ⚠️ **Export regularly** - Data is lost on refresh
2. ⚠️ **Don't refresh** during work
3. ⚠️ **Export before closing**
4. ⚠️ **Keep CSV backups**

### **When Switching Storage:**
1. Test with small dataset first (100 records)
2. Verify persistence works
3. Then test with full 22,525 records
4. Monitor performance and quota

---

## 🆘 **Support Information**

**If issues during testing:**
1. Check browser console (F12)
2. Review TROUBLESHOOTING.md
3. Check CSV-DEBUG-GUIDE.md
4. Verify memory mode is active

**When ready for storage migration:**
1. Review this document
2. Choose: IndexedDB or D365
3. Follow step-by-step instructions
4. Test incrementally

---

## ✅ **Current Status Summary**

**✅ Ready for Testing:**
- Memory-only mode active
- Handles 22,525+ records
- No quota errors
- Fast import (~15 seconds)
- All core features work

**⚠️ Remember:**
- Data not persistent (export to save!)
- Missing manual editing features
- Storage migration ready when needed

**🎯 Next:**
- Test with your full dataset
- Report any issues
- Plan manual editing features
- Plan storage migration

---

**Good luck with testing! The memory-only mode should handle your 22,525 records perfectly.** 🚀

---

**Version:** 2.0-Memory-Testing  
**Last Updated:** 2026-02-03
