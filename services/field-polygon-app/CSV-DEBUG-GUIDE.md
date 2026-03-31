# 🔍 CSV GeoJSON Debugging Guide

If you're getting JSON parsing errors when importing your CSV, this guide will help you fix it.

## Common Error Messages

### "Expected property name or '}' in JSON at position 2"
**Cause:** Invalid JSON syntax - likely single quotes instead of double quotes

**Your CSV might have:**
```csv
Field GeoJSON
'{type:Polygon, coordinates:[...]}'
```

**Should be:**
```csv
Field GeoJSON
"{""type"":""Polygon"",""coordinates"":[[...]]}"
```

---

## 🔧 Quick Fixes

### Fix 1: Check Quote Types

**❌ WRONG (single quotes):**
```json
{'type':'Polygon','coordinates':[[[36.8,-1.2]]]}
```

**✅ CORRECT (double quotes):**
```json
{"type":"Polygon","coordinates":[[[36.8,-1.2]]]}
```

### Fix 2: Escape Quotes in CSV

When putting JSON in a CSV cell, quotes must be doubled:

**In Excel/CSV:**
```csv
CCS_Field_ID,Field GeoJSON
FIELD_001,"{""type"":""Polygon"",""coordinates"":[[[36.8219,-1.2921]]]}"
```

**The actual JSON (what the app will see):**
```json
{"type":"Polygon","coordinates":[[[36.8219,-1.2921]]]}
```

### Fix 3: ESRI JSON Format

If your data is from ESRI/ArcGIS, it might use `rings` instead of `coordinates`:

**ESRI Format (also supported):**
```json
{"rings":[[[36.8219,-1.2921],[36.8319,-1.2921]]]}
```

---

## 🛠️ How to Fix Your CSV

### Method 1: Fix in Excel

1. **Open your CSV in Excel**
2. **Find the "Field GeoJSON" column**
3. **For each cell:**
   - Select the cell
   - Press F2 to edit
   - Check if quotes are single (') or double (")
   - If single quotes: use Find & Replace:
     - Find: `'`
     - Replace: `"`
   - Make sure the whole JSON is wrapped in quotes
4. **Save as CSV**

### Method 2: Fix with Find & Replace (Text Editor)

1. **Open CSV in Notepad/VS Code**
2. **Find:** `'type'`
3. **Replace with:** `"type"`
4. **Repeat for all keys:**
   - `'coordinates'` → `"coordinates"`
   - `'Polygon'` → `"Polygon"`
   - `'rings'` → `"rings"`

### Method 3: Export Fresh from Source

If possible, re-export from your source system:
- **ArcGIS/ESRI:** Export as GeoJSON, not ESRI JSON
- **QGIS:** Save as GeoJSON format
- **Database:** Use `ST_AsGeoJSON()` function
- **Python:** Use `json.dumps()` not `str()`

---

## 📋 Checklist for Valid GeoJSON

Your "Field GeoJSON" column should have:

- [ ] **Double quotes** around all keys and string values
- [ ] **No single quotes** anywhere
- [ ] **Proper nesting** of brackets: `{...}` for objects, `[...]` for arrays
- [ ] **Complete structure:**
  ```json
  {"type":"Polygon","coordinates":[[[lng,lat],[lng,lat],...]]}
  ```
- [ ] **Coordinates format:** `[longitude, latitude]` NOT `[latitude, longitude]`
- [ ] **First = Last point** (closed polygon)

---

## 🧪 Test Your JSON

### Online JSON Validator:
1. Copy ONE GeoJSON value from your CSV
2. Go to: https://jsonlint.com
3. Paste and click "Validate JSON"
4. Fix any errors shown

### Browser Console Test:
1. Open browser console (F12)
2. Paste: `JSON.parse('YOUR_GEOJSON_HERE')`
3. If error: see what character is at the position mentioned

---

## 📊 Example: Before & After

### ❌ BEFORE (Broken):
```csv
CCS_Field_ID,Field_Owner,Field GeoJSON
FIELD_001,John Kamau,'{type:Polygon,coordinates:[[[36.8,-1.2]]]}'
```
**Problems:**
- Single quotes around JSON
- No quotes around property names
- No quotes around `Polygon`

### ✅ AFTER (Fixed):
```csv
CCS_Field_ID,Field_Owner,Field GeoJSON
FIELD_001,John Kamau,"{""type"":""Polygon"",""coordinates"":[[[36.8,-1.2]]]}"
```

---

## 🔍 Debugging in Browser

After import attempt, open Browser Console (F12) and look for:

```
Error parsing GeoJSON in CSV row 1: SyntaxError...
Problematic data (first 200 chars): {YOUR_DATA_HERE}
```

This shows you EXACTLY what the parser received. Copy this and:
1. Check quote types
2. Validate on jsonlint.com
3. Compare to working example above

---

## ✅ Working Examples

### Example 1: Simple Polygon
```csv
CCS_Field_ID,Field GeoJSON
FIELD_001,"{""type"":""Polygon"",""coordinates"":[[[36.8219,-1.2921],[36.8319,-1.2921],[36.8319,-1.3021],[36.8219,-1.3021],[36.8219,-1.2921]]]}"
```

### Example 2: ESRI Format
```csv
CCS_Field_ID,Field EsriJSON
FIELD_002,"{""rings"":[[[36.7,-1.2],[36.71,-1.2],[36.71,-1.21],[36.7,-1.21],[36.7,-1.2]]]}"
```

### Example 3: Feature Format
```csv
CCS_Field_ID,Field GeoJSON
FIELD_003,"{""type"":""Feature"",""geometry"":{""type"":""Polygon"",""coordinates"":[[[36.8,-1.2],[36.81,-1.2],[36.81,-1.21],[36.8,-1.21],[36.8,-1.2]]]}}"
```

---

## 🆘 Still Not Working?

1. **Check browser console** for the exact error
2. **Copy first 3 rows** of your CSV and share them
3. **Verify file encoding** is UTF-8 (not UTF-16 or other)
4. **Try importing sample file** first to confirm app works
5. **Use sample-data-geojson-column.csv** as template

---

## 💡 Pro Tips

### Avoid Excel Auto-Formatting:
- Excel sometimes mangles JSON
- Use a text editor (VS Code, Notepad++) instead
- Or save Excel as "CSV UTF-8"

### Check Encoding:
- File should be UTF-8
- In Notepad: Save As → Encoding → UTF-8
- In VS Code: Bottom right shows encoding

### Test Small First:
- Import just first 2-3 rows to test
- Once working, import full file
- Easier to debug small files

---

**Version:** 2.0-Final  
**Last Updated:** 2026-02-03
