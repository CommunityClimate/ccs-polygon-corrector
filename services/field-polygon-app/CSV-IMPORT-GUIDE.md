# 📊 CSV Import Guide

## Supported CSV Formats

The Field Polygon App now supports **4 different CSV formats** for importing polygon data:

---

## ✅ Format 1: Vertex Format (Recommended)
**One row per coordinate point**

### Example:
```csv
Field ID,Vertex,Latitude,Longitude,Owner
FIELD_001,1,-1.2921,36.8219,John Kamau
FIELD_001,2,-1.2921,36.8319,John Kamau
FIELD_001,3,-1.3021,36.8319,John Kamau
FIELD_001,4,-1.3021,36.8219,John Kamau
FIELD_001,5,-1.2921,36.8219,John Kamau
```

### Required Columns:
- `Field ID` (or any column with "field" or "id")
- `Latitude` (or "lat")
- `Longitude` (or "lng", "lon")

### Optional Columns:
- `Vertex` (or "point") - Point number
- `Owner` - Field owner name

### Notes:
- ✅ First and last coordinates should match (closed polygon)
- ✅ Coordinates in decimal degrees
- ✅ Longitude first, then Latitude (internally converted)
- ✅ Multiple fields supported (group by Field ID)

**Sample File:** `sample-data-vertex.csv`

---

## ✅ Format 2: WKT Format
**One row per field with Well-Known Text geometry**

### Example:
```csv
Field ID,Owner,WKT
FIELD_001,John Kamau,"POLYGON((36.8219 -1.2921, 36.8319 -1.2921, 36.8319 -1.3021, 36.8219 -1.3021, 36.8219 -1.2921))"
FIELD_002,Mary Wanjiku,"POLYGON((36.7000 -1.2000, 36.7100 -1.2000, 36.7100 -1.2100, 36.7000 -1.2100, 36.7000 -1.2000))"
```

### Required Columns:
- `WKT` (or "Geometry")
- `Field ID` (or any column with "field" or "id")

### WKT Format:
```
POLYGON((lng lat, lng lat, lng lat, lng lat))
```

### Notes:
- ✅ Coordinates in WKT are: `longitude latitude` (space-separated)
- ✅ Wrap WKT in quotes if it contains commas
- ✅ One polygon per row

**Sample File:** `sample-data-wkt.csv`

---

## ✅ Format 3: GeoJSON Coordinates
**One row per field with GeoJSON coordinate array**

### Example:
```csv
Field ID,Owner,Coordinates
FIELD_001,John Kamau,"[[36.8219,-1.2921],[36.8319,-1.2921],[36.8319,-1.3021],[36.8219,-1.3021],[36.8219,-1.2921]]"
```

### Required Columns:
- `Coordinates` (or "GeoJSON")
- `Field ID`

### Format:
```json
[[lng,lat],[lng,lat],[lng,lat]]
```

### Notes:
- ✅ Valid JSON array format
- ✅ Coordinates as `[longitude, latitude]`
- ✅ Wrap in quotes

---

## ⚠️ Format 4: Metadata Only
**CSV without coordinate data (imports IDs and owners only)**

### Example:
```csv
Field ID,Owner,Area
FIELD_001,John Kamau,5.2 ha
FIELD_002,Mary Wanjiku,3.8 ha
```

### Notes:
- ⚠️ **No polygons imported** - only field metadata
- ⚠️ You'll get a warning message
- ⚠️ You'll need to manually add coordinates later

---

## 🎯 Quick Start

### 1. Choose Your Format
Pick the format that matches your data source:
- **GPS/Survey data?** → Use Vertex Format
- **From GIS software?** → Use WKT Format
- **From web API?** → Use GeoJSON Format

### 2. Prepare Your CSV
- Ensure headers match (case-insensitive)
- Check coordinate order (longitude, latitude)
- Verify polygons are closed (first = last point)

### 3. Import
1. Click **"Choose File"**
2. Select your `.csv` file
3. Wait for success message
4. Check imported fields in dropdown

---

## 📝 Creating CSV from Excel

### Method 1: Export as CSV
1. Prepare your data in Excel with correct columns
2. File → Save As → CSV (Comma delimited)
3. Import into the app

### Method 2: Export from App
1. Import data in any supported format (GeoJSON, etc.)
2. Click **"Export CSV"** to get template
3. Modify the CSV as needed
4. Re-import

---

## 🔧 Troubleshooting

### ❌ "Import failed: Unsupported file format"
**Solution:** File is not `.csv` - check file extension

### ⚠️ "No coordinate data found in CSV"
**Cause:** CSV doesn't have Latitude/Longitude, WKT, or Coordinates columns
**Solution:** 
- Add coordinate columns
- Use one of the sample files as template
- Or use this CSV for metadata only

### ❌ "Polygon has self-intersections" after import
**Cause:** Coordinates are in wrong order or format
**Solution:**
- Check longitude comes before latitude
- Verify polygon winds correctly (clockwise/counterclockwise)
- Use **"Auto-Correct"** button after loading

### ❌ No polygons showing on map
**Cause:** 
- Empty coordinate arrays
- Invalid coordinate format
- Coordinates outside visible area

**Solution:**
1. Check browser console (F12) for errors
2. Verify coordinate values are reasonable
   - Longitude: -180 to 180
   - Latitude: -90 to 90
3. Try zooming out on map

---

## 💡 Tips

### Best Practices:
✅ Always close polygons (first point = last point)
✅ Use at least 4 vertices (3 unique + 1 closing)
✅ Keep coordinates to 6 decimal places
✅ Test with small sample first
✅ Use UTF-8 encoding for special characters

### Coordinate Precision:
- **6 decimals** ≈ 0.1 meters (recommended)
- **5 decimals** ≈ 1 meter
- **4 decimals** ≈ 10 meters

### Large Datasets:
- Import in batches of 100-500 fields
- Export regularly as backup
- Use WKT or GeoJSON format (faster than vertex format)

---

## 📦 Sample Files Included

Test the import feature with these sample files:

1. **`sample-data.geojson`** - GeoJSON format (5 fields)
2. **`sample-data-vertex.csv`** - Vertex format CSV (2 fields)
3. **`sample-data-wkt.csv`** - WKT format CSV (3 fields)

---

## 🆘 Still Need Help?

Check the full documentation:
- `README.md` - Complete app documentation
- `TROUBLESHOOTING.md` - Common issues and fixes
- Browser Console (F12) - See detailed error messages

---

**Version:** 2.0-Modular  
**Last Updated:** 2026-02-03
