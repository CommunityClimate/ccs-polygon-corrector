# CCS FieldForce Polygon Intelligence Corrector - Modular Version

## Overview
A modular, browser-based application for validating and correcting field polygons for carbon credit compliance (Verra standards). Built with ES6 modules for easy testing and future Microsoft Dynamics 365 integration.

## Features
- **Polygon Validation**: Comprehensive validation including self-intersections, area, vertices
- **Auto-Correction**: Intelligent algorithms to fix common polygon issues
- **Verra Compliance**: Check against Verra carbon credit standards
- **Interactive Map**: Leaflet-based visualization
- **Import/Export**: Support for GeoJSON, KML, CSV, Excel formats
- **Catalog System**: Browse and manage all field polygons
- **Browser Storage**: LocalStorage for data persistence

## Project Structure
```
field-polygon-app/
├── index.html                      # Main HTML entry point
├── app.js                          # Main application controller
├── config/
│   └── app-config.js              # Configuration and constants
├── core/
│   ├── map-manager.js             # Leaflet map operations
│   ├── polygon-validator.js       # Validation logic
│   ├── polygon-corrector.js       # Correction algorithms
│   └── verra-compliance.js        # Verra standards checker
├── services/
│   ├── storage-service.js         # LocalStorage management
│   └── export-service.js          # Import/Export handlers
├── ui/
│   ├── ui-manager.js              # UI interactions
│   └── catalog-manager.js         # Catalog system
├── utils/
│   └── geo-utils.js               # Geospatial utilities
└── styles/
    └── main.css                   # Application styles
```

## Quick Start

### Option 1: Run Directly in Browser (Recommended for Testing)

1. **Extract all files** to a folder on your computer

2. **Open with a local web server** (required for ES6 modules):

   **Using Python:**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```

   **Using Node.js (npx):**
   ```bash
   npx http-server -p 8000
   ```

   **Using VS Code:**
   - Install "Live Server" extension
   - Right-click `index.html` → "Open with Live Server"

3. **Open in browser**: http://localhost:8000

### Option 2: Double-Click to Open (File Protocol - Limited)

⚠️ **Note:** Some browsers restrict ES6 modules over `file://` protocol. Use Option 1 for best results.

If you want to try anyway:
1. Double-click `index.html`
2. If modules don't load, use a local server instead

## Usage Guide

### 1. Import Field Data

**Supported Formats:**
- GeoJSON (`.geojson`, `.json`)
- CSV (`.csv`)

**Steps:**
1. Click "Choose File" under "Import Data"
2. Select your file
3. Fields will be automatically imported and listed

### 2. Load and Validate

1. Select a field from the dropdown
2. Click "Load Field" to display on map
3. Click "Validate Polygon" to check for issues

### 3. Auto-Correct

1. With a field loaded, click "Auto-Correct"
2. System will attempt to fix:
   - Self-intersections
   - Sharp angles
   - Duplicate points
   - Polygon closure
3. Review corrected polygon (shown in green)

### 4. Export Data

Click any export button:
- **GeoJSON**: Standard geospatial format
- **KML**: Google Earth compatible
- **CSV**: Spreadsheet format (summary)
- **Excel**: Excel-compatible HTML table

### 5. Browse Catalog

1. Click "View Catalog" (bottom-right)
2. Search, filter, and sort all fields
3. View before/after comparisons
4. Click "View" on any field to load it

## Configuration

Edit `config/app-config.js` to customize:

```javascript
export const APP_CONFIG = {
    // Map settings
    MAP: {
        DEFAULT_CENTER: [-1.2921, 36.8219], // Your location
        DEFAULT_ZOOM: 7
    },
    
    // Validation rules
    VALIDATION: {
        MIN_AREA_HA: 0.01,
        MIN_VERTICES: 3
    },
    
    // Verra compliance
    VERRA: {
        MIN_AREA_HA: 0.1,
        MAX_SPIKE_ANGLE_DEG: 10
    }
}
```

## Future: Microsoft Dynamics 365 Integration

This modular structure is designed for easy Dynamics 365 integration:

### 1. As Web Resource
- Upload all files to D365 as web resources
- Reference in custom entity forms
- Use Dynamics Web API for data storage

### 2. As Power Apps Component (PCF)
- Convert modules to TypeScript
- Build as PCF control
- Embed in model-driven apps

### 3. Integration Points Already Prepared

**In `config/app-config.js`:**
```javascript
DYNAMICS: {
    ENABLED: false,          // Set to true when ready
    BASE_URL: null,          // Your D365 URL
    API_VERSION: '9.2',
    ENTITY_NAME: 'ccs_fieldpolygon'
}
```

**To enable D365:**
1. Set `DYNAMICS.ENABLED = true`
2. Add `DYNAMICS.BASE_URL`
3. Create `services/dynamics-service.js` for Web API calls
4. Replace `StorageService` calls with Dynamics API calls

## Data Storage

Currently uses **browser LocalStorage**:
- Persists across sessions
- ~5-10MB limit per domain
- Automatically saves all changes

**Data is stored under keys:**
- `ccs_field_polygons`: All field data
- `ccs_catalog_data`: Catalog cache
- `ccs_user_preferences`: User settings

**To clear all data:**
```javascript
localStorage.clear()
// or through browser DevTools → Application → Storage
```

## Browser Compatibility

✅ **Tested and working:**
- Chrome 90+
- Edge 90+
- Firefox 88+
- Safari 14+

⚠️ **Requirements:**
- ES6 module support
- LocalStorage enabled
- JavaScript enabled

## Troubleshooting

### "Failed to load module" error
**Cause:** Opening via `file://` protocol  
**Solution:** Use a local web server (see Quick Start)

### Map not loading
**Cause:** Internet connection required for map tiles  
**Solution:** Check connection or configure offline tiles

### Import not working
**Cause:** Invalid file format  
**Solution:** Ensure GeoJSON has proper structure:
```json
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[lng, lat], ...]]
            },
            "properties": {
                "ccsFieldId": "FIELD_001",
                "fieldOwner": "Owner Name"
            }
        }
    ]
}
```

### Data lost on refresh
**Cause:** LocalStorage cleared or browser privacy mode  
**Solution:** Export data regularly; avoid private/incognito mode

## Development

### Adding New Features

1. **Create new module** in appropriate folder
2. **Import in `app.js`**:
   ```javascript
   import { NewFeature } from './path/to-feature.js';
   ```
3. **Initialize in app constructor**
4. **Add UI elements** in `index.html`
5. **Wire up events** in `setupEventListeners()`

### Modifying Validation Rules

Edit `core/polygon-validator.js`:
```javascript
static validate(coordinates) {
    // Add custom validation logic
    if (yourCondition) {
        validation.errors.push('Your error message');
    }
}
```

### Customizing Map Appearance

Edit `core/map-manager.js`:
```javascript
drawOriginal(coordinates, options = {}) {
    L.polygon(coordinates, {
        color: '#your-color',
        weight: 3,
        // ... more styling
    })
}
```

## Technical Details

### Dependencies
- **Leaflet 1.9.4**: Interactive maps
- **Turf.js 6.5.0**: Geospatial calculations
- **Bootstrap 5.3.0**: UI framework

### Key Technologies
- **ES6 Modules**: Clean, maintainable code structure
- **LocalStorage API**: Browser-based persistence
- **GeoJSON**: Standard geospatial format
- **FileReader API**: Client-side file handling

## Support & Contribution

### Known Limitations
- Max ~1000 vertices per polygon (browser performance)
- LocalStorage size limit (~5MB)
- Requires internet for map tiles
- No real-time collaboration (yet)

### Future Enhancements
- [ ] Dynamics 365 integration
- [ ] Power BI dashboard connector
- [ ] Batch processing for large datasets
- [ ] Offline map tiles
- [ ] User authentication
- [ ] Multi-language support

## License
Internal use for CCS FieldForce carbon credit operations.

## Version
**2.0-Modular** - Refactored for modularity and D365 integration

---

**Need help?** Contact your development team or refer to the inline code comments.
