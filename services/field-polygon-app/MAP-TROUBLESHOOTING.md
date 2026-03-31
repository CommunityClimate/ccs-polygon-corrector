# 🗺️ MAP TROUBLESHOOTING GUIDE

## Issue: Map/Polygons Not Showing

### Quick Diagnostic Checklist:

1. **Test Map Display First:**
   - Open `MAP-TEST.html` in your browser
   - You should see a world map with a red square polygon
   - If this works, Leaflet is fine and the issue is with data loading

2. **Check Browser Console:**
   - Press F12 to open Developer Tools
   - Go to "Console" tab
   - Look for messages:
     - ✅ "Map initialized successfully" = Map is working
     - ❌ Red errors = Something is broken

3. **Verify Data is Loaded:**
   - Did you import a CSV/GeoJSON file?
   - Check statistics panel - does it show total fields > 0?
   - If total = 0, you need to import data first

4. **Load a Field:**
   - After importing, select a field from dropdown
   - Click "Load Field" button
   - Map should update and show polygon

---

## Common Issues & Solutions:

### Issue 1: "Map is blank/gray"
**Likely Cause:** No field has been loaded yet

**Solution:**
1. Import your CSV/GeoJSON data
2. Select a field from the dropdown
3. Click "Load Field" button
4. Map should show polygon

### Issue 2: "Map shows tiles but no polygon"
**Likely Cause:** Field has invalid coordinates

**Console Message:** "Cannot draw polygon: insufficient coordinates"

**Solution:**
1. Check that your CSV has a "Field GeoJSON" column with valid GeoJSON
2. Open browser console (F12) to see specific errors
3. Try importing the sample data file to test

### Issue 3: "Map doesn't show at all (not even tiles)"
**Likely Cause:** Leaflet failed to load

**Solutions:**
1. Check internet connection (Leaflet loads from CDN)
2. Check browser console for errors
3. Try MAP-TEST.html to verify Leaflet works
4. If MAP-TEST.html works, the issue is in app initialization

### Issue 4: "Console shows 'Initializing map...' but nothing appears"
**Likely Cause:** CSS height issue

**Solution:**
1. Open browser Developer Tools (F12)
2. Right-click on the map area → Inspect Element
3. Check if `#map` div has height > 0
4. If height = 0, there's a CSS issue

---

## Step-by-Step Testing:

### Step 1: Test Basic Map
```
1. Open MAP-TEST.html
2. Expected: See world map with red square
3. If YES: Leaflet works, proceed to Step 2
4. If NO: Check internet connection
```

### Step 2: Test Main App
```
1. Open index.html
2. Open Console (F12)
3. Look for: "✅ Map initialized successfully"
4. If YES: Map is working, proceed to Step 3
5. If NO: Check console for errors
```

### Step 3: Import Data
```
1. Click "Choose File" 
2. Select your CSV file
3. Wait for import to complete
4. Check statistics panel shows total > 0
5. If NO fields imported, check CSV format
```

### Step 4: Load Field
```
1. Select field from dropdown
2. Click "Load Field" button
3. Console should show: "Drawing original polygon"
4. Console should show: "✅ Original polygon drawn successfully"
5. Map should zoom to polygon
```

---

## Console Messages Explained:

### ✅ Good Messages:
```
"Initializing map..."
"✅ Map initialized successfully at [0, 20]"
"Drawing original polygon with 25 vertices"
"✅ Original polygon drawn successfully"
```
**Meaning:** Everything is working!

### ⚠️ Warning Messages:
```
"⚠️ Cannot draw polygon: insufficient coordinates"
```
**Meaning:** Field has invalid coordinates (< 3 vertices)

### ❌ Error Messages:
```
"❌ Map initialization failed: [error]"
"❌ Error drawing original polygon: [error]"
```
**Meaning:** Something is broken - report the full error

---

## Quick Fixes:

### Fix 1: Hard Refresh
```
Windows: Ctrl + F5
Mac: Cmd + Shift + R
```
Clears cache and reloads

### Fix 2: Clear Browser Storage
```
1. F12 → Application tab
2. Storage → Local Storage
3. Clear all
4. Refresh page
```

### Fix 3: Try Different Browser
```
- Chrome (recommended)
- Firefox
- Edge
- Safari
```

### Fix 4: Disable Browser Extensions
```
Ad blockers or privacy extensions 
might block map tiles
```

---

## What to Report if Still Broken:

If map still doesn't work, provide:

1. **Browser & Version:**
   - Chrome 120, Firefox 115, etc.

2. **Console Errors:**
   - Copy full error messages from console

3. **MAP-TEST.html Result:**
   - Does it show the red square? YES/NO

4. **Screenshot:**
   - Show what you see (blank, gray, etc.)

5. **Data Format:**
   - CSV with "Field GeoJSON" column? YES/NO
   - Sample of your GeoJSON data

---

## Expected Behavior:

### When Everything Works:

1. **On Page Load:**
   - Map appears with OpenStreetMap tiles
   - Center of map at [0, 20] zoom level 2
   - Message: "📍 No field loaded yet"

2. **After Importing Data:**
   - Statistics panel shows totals
   - Field dropdown populated
   - Message still shows: "No field loaded yet"

3. **After Loading Field:**
   - Message disappears
   - Map zooms to polygon
   - Red dashed polygon appears
   - If corrected: Green polygon also appears

4. **After Clicking "Enable Edit Mode":**
   - Numbered blue dots appear on vertices
   - Original polygon fades to background
   - Editable green polygon appears

---

## Common CSV Issues:

### Issue: "No fields imported"

Check your CSV has this column:
```
Field GeoJSON
```

NOT:
- "GeoJSON"
- "field geojson" 
- "FieldGeoJSON"

Exact match required: "Field GeoJSON"

### Issue: "Empty GeoJSON rows"

Your GeoJSON column might have invalid data:

**Valid:**
```json
{"type":"Polygon","coordinates":[[[1,2],[3,4],[5,6],[1,2]]]}
```

**Invalid:**
```
empty
null
""
```

---

## Testing with Sample Data:

Use included sample files:

1. **sample-data-geojson-column.csv**
   - Has "Field GeoJSON" column
   - Ready to import
   - Should work immediately

2. **sample-data.geojson**
   - Pure GeoJSON format
   - Smaller file for quick test

**Test Steps:**
```
1. Import sample-data-geojson-column.csv
2. Should see "Successfully imported X fields"
3. Select any field from dropdown
4. Click "Load Field"
5. Map should show polygon
```

If sample data works but your data doesn't:
→ Your CSV format has an issue

---

## Need More Help?

**Provide these details:**

1. Operating System (Windows/Mac/Linux)
2. Browser & version
3. Console error messages
4. Does MAP-TEST.html work? (YES/NO)
5. Does sample data work? (YES/NO)
6. Screenshot of browser console
7. First few rows of your CSV (if possible)

---

**Last Updated:** 2025-02-03  
**Purpose:** Diagnose map display issues
