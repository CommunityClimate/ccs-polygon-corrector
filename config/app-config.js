// Application Configuration
export const APP_CONFIG = {
    APP_NAME: "CCS FieldForce Polygon Intelligence Corrector",
    VERSION: "2.0-Modular",
    
    // Map Configuration
    MAP: {
        DEFAULT_CENTER: [-1.2921, 36.8219], // Kenya
        DEFAULT_ZOOM: 7,
        MIN_ZOOM: 3,
        MAX_ZOOM: 18,  // Reduced from 20 to prevent tile loading errors
        TILE_LAYER: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    
    // Polygon Validation Rules
    VALIDATION: {
        MIN_AREA_HA: 0.01,
        MIN_VERTICES: 3,
        MAX_VERTICES: 1000,
        MIN_PERIMETER_M: 10,
        MAX_AREA_HA: 10000
    },
    
    // Verra Compliance Standards
    VERRA: {
        MIN_AREA_HA: 0.1,
        MAX_AREA_HA: 1000,
        MIN_VERTICES: 4,
        MAX_SELF_INTERSECTIONS: 0,
        MAX_SPIKE_ANGLE_DEG: 10,
        MIN_SIDE_LENGTH_M: 5,
        MAX_GAP_CLOSURE_M: 0.5,              // Maximum gap tolerance for auto-closing (Verra standard)
        REQUIRED_CLOSURE: true
    },
    
    // Correction Algorithms
    CORRECTION: {
        DOUGLAS_PEUCKER_TOLERANCE: 0.00001,
        BUFFER_DISTANCE: 0.00001,
        MAX_ITERATIONS: 10,
        SMOOTHING_FACTOR: 0.5
    },
    
    // UI Settings
    UI: {
        ITEMS_PER_PAGE: 12,
        MAX_UNDO_STACK: 50,
        AUTO_SAVE_INTERVAL: 30000, // 30 seconds
        ANIMATION_DURATION: 300
    },
    
    // Storage Keys
    STORAGE_KEYS: {
        FIELDS: 'ccs_field_polygons',
        CATALOG: 'ccs_catalog_data',
        PREFERENCES: 'ccs_user_preferences',
        CACHE: 'ccs_cache'
    },
    
    // Export Formats
    EXPORT: {
        FORMATS: ['GeoJSON', 'KML', 'CSV', 'Excel'],
        DATE_FORMAT: 'YYYY-MM-DD',
        FILENAME_PREFIX: 'field_polygons'
    },
    
    // Colors for Map
    COLORS: {
        ORIGINAL: '#e74c3c',
        CORRECTED: '#27ae60',
        SELECTED: '#3498db',
        INVALID: '#c0392b',
        VALID: '#16a085'
    },
    
    // Future: Dynamics 365 Integration
    DYNAMICS: {
        ENABLED: false,
        BASE_URL: null,
        API_VERSION: '9.2',
        ENTITY_NAME: 'ccs_fieldpolygon'
    }
};

// Utility function to get config value
export function getConfig(path) {
    return path.split('.').reduce((obj, key) => obj?.[key], APP_CONFIG);
}

// Utility function to update config (for runtime changes)
export function updateConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((obj, key) => obj[key], APP_CONFIG);
    target[lastKey] = value;
}
