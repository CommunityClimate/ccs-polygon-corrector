// Map Manager - Leaflet Map Operations
import { APP_CONFIG } from '../config/app-config.js';
import { GeoUtils } from '../utils/geo-utils.js';

export class MapManager {
    constructor(elementId) {
        this.elementId = elementId;
        this.map = null;
        
        // Layer groups for organizing polygons
        this.layerGroups = {
            original: null,      // Original polygons (all fields)
            corrected: null,     // Corrected polygons
            vertices: null,      // Vertex markers
            vertexLabels: null,  // Vertex number labels
            recommended: null,   // Recommended corrections
            intersections: null  // Self-intersection markers
        };
        
        // Individual layers for currently selected field
        this.currentLayers = {
            original: null,
            corrected: null,
            markers: [],
            intersections: []
        };
        
        this.editMode = false;
    }
    
    // Initialize map
    initialize() {
        console.log('Initializing map...');
        
        try {
            this.map = L.map(this.elementId, {
                center: APP_CONFIG.MAP.DEFAULT_CENTER,
                zoom: APP_CONFIG.MAP.DEFAULT_ZOOM,
                minZoom: APP_CONFIG.MAP.MIN_ZOOM,
                maxZoom: APP_CONFIG.MAP.MAX_ZOOM,
                zoomControl: true
            });
            
            // Add tile layer
            L.tileLayer(APP_CONFIG.MAP.TILE_LAYER, {
                attribution: APP_CONFIG.MAP.ATTRIBUTION,
                maxZoom: APP_CONFIG.MAP.MAX_ZOOM
            }).addTo(this.map);
            
            // Initialize layer groups
            this.initializeLayerGroups();
            
            console.log('✅ Map initialized successfully at', APP_CONFIG.MAP.DEFAULT_CENTER);
            console.log('✅ Layer groups created');
            
            return this.map;
        } catch (error) {
            console.error('❌ Map initialization failed:', error);
            throw error;
        }
    }
    
    // Initialize all layer groups
    initializeLayerGroups() {
        // Create layer groups
        this.layerGroups.original = L.layerGroup().addTo(this.map);
        this.layerGroups.corrected = L.layerGroup().addTo(this.map);
        this.layerGroups.vertices = L.layerGroup().addTo(this.map);
        this.layerGroups.vertexLabels = L.layerGroup().addTo(this.map);
        this.layerGroups.recommended = L.layerGroup().addTo(this.map);
        this.layerGroups.intersections = L.layerGroup().addTo(this.map);
        
        // Base layers with error handling
        this.baseLayers = {
            osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 18,  // Reduced from 19 to avoid tile errors
                maxNativeZoom: 18,  // Native tile resolution limit
                errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' // Transparent 1x1 pixel
            }),
            satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Tiles © <a href="https://www.arcgis.com/">Esri</a>',
                maxZoom: 18,  // Reduced from 19 to avoid tile errors
                maxNativeZoom: 18,  // Native tile resolution limit
                errorTileUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' // Transparent 1x1 pixel
            }),
            hybrid: null // Will be created on demand
        };
        
        // Set default base layer (already added in initialize())
        this.currentBaseLayer = 'osm';
        
        console.log('Layer groups initialized:', Object.keys(this.layerGroups));
    }
    
    // Switch base layer (OSM, Satellite, Hybrid)
    switchBaseLayer(layerType) {
        console.log(`Switching to ${layerType} layer...`);
        
        // Remove current base layer
        this.map.eachLayer((layer) => {
            if (layer instanceof L.TileLayer && !this.layerGroups[layer._leaflet_id]) {
                this.map.removeLayer(layer);
            }
        });
        
        // Add new base layer
        switch(layerType) {
            case 'satellite':
                this.baseLayers.satellite.addTo(this.map);
                this.currentBaseLayer = 'satellite';
                break;
            case 'hybrid':
                // Create hybrid if not exists
                if (!this.baseLayers.hybrid) {
                    this.baseLayers.hybrid = L.layerGroup([
                        this.baseLayers.satellite,
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            opacity: 0.3,
                            maxZoom: 19
                        })
                    ]);
                }
                this.baseLayers.hybrid.addTo(this.map);
                this.currentBaseLayer = 'hybrid';
                break;
            default: // OSM / standard
                this.baseLayers.osm.addTo(this.map);
                this.currentBaseLayer = 'osm';
        }
        
        console.log(`✅ Switched to ${layerType} layer`);
    }
    
    // Wrapper for basemap switching (called from app.js)
    switchBasemap(type) {
        this.switchBaseLayer(type);
    }
    
    // Wrapper for layer toggling (called from app.js)
    toggleLayer(layerName, visible) {
        this.toggleLayerGroup(layerName, visible);
    }
    
    // Refresh all polygon layers (bring to front after basemap change)
    refreshLayers() {
        // Bring all polygon layer groups to front
        Object.values(this.layerGroups).forEach(layerGroup => {
            if (layerGroup && this.map.hasLayer(layerGroup)) {
                // LayerGroups don't have bringToFront() method
                // Instead, we need to iterate through individual layers
                if (typeof layerGroup.eachLayer === 'function') {
                    layerGroup.eachLayer(layer => {
                        if (typeof layer.bringToFront === 'function') {
                            layer.bringToFront();
                        }
                    });
                }
            }
        });
    }
    
    // Toggle layer group visibility
    toggleLayerGroup(groupName, visible) {
        if (this.layerGroups[groupName]) {
            if (visible) {
                this.layerGroups[groupName].addTo(this.map);
            } else {
                this.map.removeLayer(this.layerGroups[groupName]);
            }
            console.log(`${groupName} layer: ${visible ? 'visible' : 'hidden'}`);
        }
    }
    
    // Draw ALL polygons from fields array (for overview map)
    drawAllPolygons(fields, layerGroupName = 'original') {
        console.log(`Drawing ${fields.length} polygons to ${layerGroupName} layer...`);
        
        if (!this.layerGroups[layerGroupName]) {
            console.error(`Layer group ${layerGroupName} not found`);
            return;
        }
        
        // Clear the layer group
        this.layerGroups[layerGroupName].clearLayers();
        
        let drawnCount = 0;
        let skippedCount = 0;
        const polygons = [];
        
        fields.forEach((field, index) => {
            if (!field.originalCoordinates || field.originalCoordinates.length < 3) {
                skippedCount++;
                return;
            }
            
            try {
                // Choose color based on validation status
                let color = '#999999';
                let weight = 2;
                let opacity = 0.6;
                
                if (field.validation) {
                    if (field.validation.isValid) {
                        color = '#51cf66'; // Green for valid
                    } else {
                        color = '#ff6b6b'; // Red for invalid
                        weight = 3;
                        opacity = 0.8;
                    }
                }
                
                // Create polygon
                const polygon = L.polygon(field.originalCoordinates, {
                    color: color,
                    weight: weight,
                    opacity: opacity,
                    fillColor: color,
                    fillOpacity: 0.2,
                    dashArray: layerGroupName === 'original' ? '5, 5' : null
                });
                
                // Add comprehensive popup with field info
                polygon.bindPopup(this.generateFieldPopupHTML(field, false));
                
                // Add to layer group
                polygon.addTo(this.layerGroups[layerGroupName]);
                polygons.push(polygon);
                drawnCount++;
                
            } catch (error) {
                console.error(`Error drawing field ${index}:`, error);
                skippedCount++;
            }
        });
        
        console.log(`✅ Drew ${drawnCount} polygons, skipped ${skippedCount}`);
        
        // Fit map to show all polygons
        if (polygons.length > 0) {
            const group = L.featureGroup(polygons);
            this.map.fitBounds(group.getBounds(), { 
                padding: [50, 50],
                maxZoom: 12
            });
            console.log('✅ Map fitted to all polygons');
        }
        
        return drawnCount;
    }
    
    // Draw original polygon
    drawOriginal(coordinates, options = {}) {
        console.log('Drawing original polygon with', coordinates?.length, 'vertices');
        
        this.clearLayer('original');
        
        if (!coordinates || coordinates.length < 3) {
            console.warn('⚠️ Cannot draw polygon: insufficient coordinates');
            return;
        }
        
        try {
            // Coordinates are now stored in Leaflet format [lat, lng]
            // NO conversion needed!
            const polygon = L.polygon(coordinates, {
                color: options.color || APP_CONFIG.COLORS.ORIGINAL,
                weight: 2,
                fillOpacity: 0.2,
                dashArray: '5, 5'
            });
            
            // Add to BOTH currentLayers AND layerGroups
            this.currentLayers.original = polygon;
            polygon.addTo(this.layerGroups.original);
            
            // Bind popup if field data provided
            if (options.field) {
                const popupHTML = this.generateFieldPopupHTML(options.field, false);
                polygon.bindPopup(popupHTML, {
                    maxWidth: 300,
                    className: 'custom-popup'
                });
                console.log('✅ Popup bound to original polygon');
            } else if (options.popup) {
                polygon.bindPopup(options.popup);
            }
            
            // Fit map to polygon bounds
            this.map.fitBounds(polygon.getBounds());
            
            console.log('✅ Original polygon drawn successfully');
        } catch (error) {
            console.error('❌ Error drawing original polygon:', error);
        }
        
        if (options.fitBounds !== false && coordinates) {
            this.fitBounds(coordinates);
        }
        
        return this.currentLayers.original;
    }
    
    // Draw corrected polygon
    drawCorrected(coordinates, options = {}) {
        this.clearLayer('corrected');
        
        if (!coordinates || coordinates.length < 3) return;
        
        // Coordinates are already in Leaflet format [lat, lng]
        const polygon = L.polygon(coordinates, {
            color: options.color || APP_CONFIG.COLORS.CORRECTED,
            weight: 3,
            fillOpacity: 0.3
        });
        
        // Add to BOTH currentLayers AND layerGroups
        this.currentLayers.corrected = polygon;
        polygon.addTo(this.layerGroups.corrected);
        
        // Bind popup if field data provided
        if (options.field) {
            const popupHTML = this.generateFieldPopupHTML(options.field, true);
            polygon.bindPopup(popupHTML, {
                maxWidth: 300,
                className: 'custom-popup'
            });
            console.log('✅ Popup bound to corrected polygon');
        } else if (options.popup) {
            polygon.bindPopup(options.popup);
        }
        
        return this.currentLayers.corrected;
    }
    
    // Draw both polygons (comparison view)
    drawComparison(original, corrected) {
        this.drawOriginal(original, { fitBounds: true });
        this.drawCorrected(corrected, { fitBounds: false });
    }
    
    // Draw markers for self-intersections
    drawIntersectionPoints(points) {
        this.clearLayer('intersections');
        
        points.forEach(point => {
            const marker = L.circleMarker(this.toLeafletCoord(point), {
                radius: 6,
                color: '#e74c3c',
                fillColor: '#e74c3c',
                fillOpacity: 0.8
            }).addTo(this.map);
            
            marker.bindPopup('Self-intersection point');
            this.currentLayers.intersections.push(marker);
        });
    }
    
    // Draw vertex markers
    drawVertices(coordinates, options = {}) {
        this.clearLayer('markers');
        
        coordinates.forEach((coord, index) => {
            const marker = L.circleMarker(this.toLeafletCoord(coord), {
                radius: 4,
                color: options.color || '#3498db',
                fillColor: '#fff',
                fillOpacity: 1,
                weight: 2
            }).addTo(this.map);
            
            marker.bindPopup(`Vertex ${index + 1}<br>${GeoUtils.formatCoordinate(coord)}`);
            this.currentLayers.markers.push(marker);
        });
    }
    
    // Clear specific layer
    clearLayer(layerName) {
        // Clear from currentLayers (individual field)
        if (layerName === 'markers') {
            this.currentLayers.markers.forEach(m => this.map.removeLayer(m));
            this.currentLayers.markers = [];
        } else if (layerName === 'intersections') {
            this.currentLayers.intersections.forEach(m => this.map.removeLayer(m));
            this.currentLayers.intersections = [];
        } else if (this.currentLayers[layerName]) {
            // Remove from map if added directly
            if (this.currentLayers[layerName]) {
                // Remove from layer group if it's there
                if (this.layerGroups[layerName]) {
                    this.layerGroups[layerName].removeLayer(this.currentLayers[layerName]);
                }
                // Also remove from map directly (in case it's there)
                if (this.map.hasLayer(this.currentLayers[layerName])) {
                    this.map.removeLayer(this.currentLayers[layerName]);
                }
                this.currentLayers[layerName] = null;
            }
        }
    }
    
    // Clear all layers (both layer groups and current layers)
    clearAll() {
        // Clear layer groups (all fields)
        this.clearAllLayers();
        
        // Clear current layers (individual field)
        this.clearLayer('original');
        this.clearLayer('corrected');
        this.clearLayer('markers');
        this.clearLayer('intersections');
    }
    
    // Fit map to coordinates
    fitBounds(coordinates) {
        if (!coordinates || coordinates.length === 0) return;
        
        // Coordinates are already in Leaflet format [lat, lng]
        const bounds = L.latLngBounds(coordinates);
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Convert GeoJSON coordinates to Leaflet format [lat, lng]
    toLeafletCoords(coords) {
        return coords.map(c => [c[1], c[0]]);
    }
    
    toLeafletCoord(coord) {
        return [coord[1], coord[0]];
    }
    
    // Convert Leaflet coordinates to GeoJSON format [lng, lat]
    fromLeafletCoords(coords) {
        return coords.map(c => [c.lng, c.lat]);
    }
    
    // Get map instance
    getMap() {
        return this.map;
    }
    
    /**
     * Draw vertices with numbers for a field
     */
    drawFieldVertices(field, showNumbers = true) {
        if (!field.originalCoordinates || field.originalCoordinates.length < 3) {
            return;
        }
        
        const coords = field.correctedCoordinates || field.originalCoordinates;
        
        coords.forEach((coord, index) => {
            // Skip the last coordinate if it's a duplicate (closing vertex)
            if (index === coords.length - 1 && 
                coord[0] === coords[0][0] && 
                coord[1] === coords[0][1]) {
                return;
            }
            
            // Draw vertex marker (small circle)
            const marker = L.circleMarker(coord, {
                radius: 5,
                color: '#3498db',
                fillColor: '#fff',
                fillOpacity: 1,
                weight: 2
            });
            
            marker.addTo(this.layerGroups.vertices);
            
            // Draw vertex number label if enabled
            if (showNumbers) {
                const label = L.marker(coord, {
                    icon: L.divIcon({
                        className: 'vertex-label',
                        html: `<div style="
                            background: #3498db;
                            color: white;
                            border-radius: 50%;
                            width: 20px;
                            height: 20px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 11px;
                            font-weight: bold;
                            border: 2px solid white;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        ">${index + 1}</div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                });
                
                label.addTo(this.layerGroups.vertexLabels);
            }
        });
    }
    
    /**
     * Toggle vertex display for all fields
     */
    toggleVertices(show) {
        if (show) {
            this.map.addLayer(this.layerGroups.vertices);
        } else {
            this.map.removeLayer(this.layerGroups.vertices);
        }
    }
    
    /**
     * Toggle vertex numbers for all fields
     */
    toggleVertexNumbers(show) {
        if (show) {
            this.map.addLayer(this.layerGroups.vertexLabels);
        } else {
            this.map.removeLayer(this.layerGroups.vertexLabels);
        }
    }
    
    /**
     * Draw all fields on map at once (like original HTML)
     * This creates ALL polygons immediately after import
     */
    drawAllFields(fields) {
        console.log(`=== DRAWING ALL FIELDS ON MAP ===`);
        console.log(`Total fields to draw: ${fields.length}`);
        
        // Clear all layer groups first
        this.clearAllLayers();
        
        let drawnCount = 0;
        let skippedCount = 0;
        const allPolygons = [];
        
        fields.forEach((field, index) => {
            if (!field.originalCoordinates || field.originalCoordinates.length < 3) {
                skippedCount++;
                return;
            }
            
            try {
                // Draw original polygon (coordinates already in [lat, lng] format)
                const originalPolygon = L.polygon(field.originalCoordinates, {
                    color: '#dc3545',  // RED for original
                    weight: 2,
                    opacity: 0.8,
                    fillColor: '#dc3545',
                    fillOpacity: 0.15,
                    dashArray: '5, 5'
                });
                
                // Add comprehensive popup with field info
                try {
                    const popupHTML = this.generateFieldPopupHTML(field, false);
                    console.log(`Generated popup HTML length: ${popupHTML.length} chars`);
                    originalPolygon.bindPopup(popupHTML, {
                        maxWidth: 300,
                        className: 'custom-popup'
                    });
                    
                    // Add click listener for debugging
                    originalPolygon.on('click', function(e) {
                        console.log(`🖱️ Polygon clicked: ${field.ccsFieldId}`);
                    });
                    
                    console.log(`✅ Popup bound to polygon ${field.ccsFieldId}`);
                } catch (popupError) {
                    console.error('❌ Error creating popup for', field.ccsFieldId, popupError);
                    // Fallback simple popup
                    originalPolygon.bindPopup(`
                        <div style="padding: 10px;">
                            <strong>${field.ccsFieldId || 'Unknown'}</strong><br>
                            Owner: ${field.fieldOwner || 'N/A'}<br>
                            Click to load field
                        </div>
                    `);
                }
                
                // Add to original layer group
                originalPolygon.addTo(this.layerGroups.original);
                allPolygons.push(originalPolygon);
                drawnCount++;
                
                // If field has corrected coordinates, draw those too
                if (field.correctedCoordinates && field.correctedCoordinates.length >= 3) {
                    const correctedPolygon = L.polygon(field.correctedCoordinates, {
                        color: '#28a745',  // GREEN for corrected
                        weight: 2,
                        opacity: 0.8,
                        fillColor: '#28a745',
                        fillOpacity: 0.2
                    });
                    
                    // Add comprehensive popup for corrected version
                    try {
                        const popupHTML = this.generateFieldPopupHTML(field, true);
                        correctedPolygon.bindPopup(popupHTML, {
                            maxWidth: 300,
                            className: 'custom-popup'
                        });
                    } catch (popupError) {
                        console.error('Error creating corrected popup:', popupError);
                        correctedPolygon.bindPopup(`
                            <strong>✅ ${field.ccsFieldId}</strong><br>
                            Corrected polygon
                        `);
                    }
                    
                    correctedPolygon.addTo(this.layerGroups.corrected);
                    allPolygons.push(correctedPolygon);
                }
                
            } catch (error) {
                console.error(`Error drawing field ${index} (${field.ccsFieldId}):`, error);
                skippedCount++;
            }
        });
        
        console.log(`✅ Drew ${drawnCount} polygons, Skipped ${skippedCount}`);
        
        // Fit map to show all polygons
        if (allPolygons.length > 0) {
            try {
                const group = L.featureGroup(allPolygons);
                const bounds = group.getBounds();
                this.map.fitBounds(bounds, { 
                    padding: [50, 50],
                    maxZoom: 16
                });
                
                const center = this.map.getCenter();
                const zoom = this.map.getZoom();
                
                console.log(`✅ Map fitted to all fields`);
                console.log(`   Center: [${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}]`);
                console.log(`   Zoom: ${zoom}`);
            } catch (error) {
                console.error('Error fitting bounds:', error);
            }
        }
        
        return {
            drawn: drawnCount,
            skipped: skippedCount,
            total: fields.length
        };
    }
    
    /**
     * Generate comprehensive popup HTML for a field
     */
    generateFieldPopupHTML(field, isCorrectVersion = false) {
        console.log('🔍 Generating popup for field:', field.ccsFieldId);
        
        const validation = field.validation || {};
        const verra = validation.verra || {};
        const correction = field.correction || {};
        
        console.log('  - Has validation:', !!validation);
        console.log('  - Has metrics:', !!validation.metrics);
        
        // Determine status
        let status = 'UNKNOWN';
        let statusClass = 'secondary';
        let statusIcon = '❓';
        
        if (verra.overallStatus === 'PASS') {
            status = 'VERRA OK';
            statusClass = 'success';
            statusIcon = '✅';
        } else if (verra.overallStatus === 'FIXABLE') {
            status = correction.applied ? 'AUTO-CORRECTED' : 'CAN BE FIXED';
            statusClass = correction.applied ? 'info' : 'warning';
            statusIcon = correction.applied ? '🔧' : '⚠️';
        } else if (verra.overallStatus === 'NEEDS_MANUAL_FIX') {
            status = 'NEEDS MANUAL';
            statusClass = 'danger';
            statusIcon = '✗';
        }
        
        // Get coordinates info
        const coords = isCorrectVersion ? field.correctedCoordinates : field.originalCoordinates;
        const vertexCount = coords ? coords.length : 0;
        
        // FIX: Use validation.metrics.areaHa instead of validation.areaHa
        const metrics = validation.metrics || {};
        const area = metrics.areaHa || 0;
        const perimeter = metrics.perimeterMeters || 0;
        
        console.log('  - Area:', area, 'ha');
        console.log('  - Perimeter:', perimeter, 'm');
        
        // Build issues list
        let issuesList = '';
        if (verra.checks) {
            const issues = [];
            if (!verra.checks.simple?.pass) issues.push('Self-intersections');
            if (!verra.checks.closed?.pass) issues.push('Not closed');
            if (!verra.checks.minVertices?.pass) issues.push('Too few vertices');
            if (!verra.checks.positiveArea?.pass) issues.push('No area');
            if (!verra.checks.duplicateVertices?.pass) issues.push('Duplicate vertices');
            
            if (issues.length > 0) {
                issuesList = `
                    <div style="margin-top: 8px; padding: 6px; background: #fff3cd; border-radius: 4px;">
                        <strong style="color: #856404;">⚠️ Issues:</strong><br>
                        <small style="color: #856404;">${issues.join(', ')}</small>
                    </div>
                `;
            }
        }
        
        // Build correction info
        let correctionInfo = '';
        if (correction.applied) {
            correctionInfo = `
                <div style="margin-top: 8px; padding: 6px; background: #d1ecf1; border-radius: 4px;">
                    <strong style="color: #0c5460;">🔧 Auto-Corrected</strong><br>
                    <small style="color: #0c5460;">Method: ${correction.method || 'Unknown'}</small><br>
                    <small style="color: #0c5460;">Date: ${new Date(correction.timestamp).toLocaleString()}</small>
                </div>
            `;
        }
        
        // Main popup HTML (NO HTML COMMENTS - they break Leaflet popups!)
        return `
            <div style="min-width: 250px; font-family: system-ui, -apple-system, sans-serif;">
                <div style="background: #f8f9fa; padding: 10px; margin: -10px -10px 10px -10px; border-bottom: 2px solid #dee2e6;">
                    <strong style="font-size: 14px; color: #212529;">${statusIcon} ${field.ccsFieldId || 'Unknown'}</strong>
                    <div style="margin-top: 4px;">
                        <span class="badge bg-${statusClass}" style="font-size: 10px; padding: 2px 6px; background-color: ${this.getStatusColor(statusClass)}; color: white; border-radius: 3px;">${status}</span>
                    </div>
                </div>
                
                <table style="width: 100%; font-size: 12px; margin-bottom: 8px;">
                    <tr>
                        <td style="color: #6c757d; padding: 3px 0;"><strong>Owner:</strong></td>
                        <td style="padding: 3px 0;">${field.fieldOwner || 'Unknown'}</td>
                    </tr>
                    <tr>
                        <td style="color: #6c757d; padding: 3px 0;"><strong>Area:</strong></td>
                        <td style="padding: 3px 0;">${area ? area.toFixed(4) : '0.0000'} ha</td>
                    </tr>
                    <tr>
                        <td style="color: #6c757d; padding: 3px 0;"><strong>Perimeter:</strong></td>
                        <td style="padding: 3px 0;">${perimeter ? perimeter.toFixed(2) : '0.00'} m</td>
                    </tr>
                    <tr>
                        <td style="color: #6c757d; padding: 3px 0;"><strong>Vertices:</strong></td>
                        <td style="padding: 3px 0;">${vertexCount}</td>
                    </tr>
                    ${field.createdAt ? `
                    <tr>
                        <td style="color: #6c757d; padding: 3px 0;"><strong>Created:</strong></td>
                        <td style="padding: 3px 0;"><small>${new Date(field.createdAt).toLocaleDateString()}</small></td>
                    </tr>
                    ` : ''}
                </table>
                
                ${issuesList}
                ${correctionInfo}
                
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #dee2e6; font-size: 11px; color: #6c757d;">
                    💡 Click "Load Field" to edit this polygon
                </div>
            </div>
        `;
    }
    
    /**
     * Get color for status badge
     */
    getStatusColor(statusClass) {
        const colors = {
            'success': '#28a745',
            'info': '#17a2b8',
            'warning': '#ffc107',
            'danger': '#dc3545',
            'secondary': '#6c757d'
        };
        return colors[statusClass] || '#6c757d';
    }

    /**
     * Clear all layer groups
     */
    clearAllLayers() {
        console.log('Clearing all layer groups...');
        Object.values(this.layerGroups).forEach(layerGroup => {
            if (layerGroup) {
                layerGroup.clearLayers();
            }
        });
    }
    
    /**
     * Toggle layer group visibility
     */
    toggleLayer(layerName, visible) {
        console.log(`🔄 toggleLayer called: ${layerName}, visible: ${visible}`);
        
        const layerGroup = this.layerGroups[layerName];
        if (!layerGroup) {
            console.warn(`❌ Layer group "${layerName}" not found`);
            console.log('Available layer groups:', Object.keys(this.layerGroups));
            return;
        }
        
        console.log(`Layer group "${layerName}" exists, has ${layerGroup.getLayers().length} layers`);
        
        if (visible) {
            if (!this.map.hasLayer(layerGroup)) {
                this.map.addLayer(layerGroup);
                console.log(`✅ Layer "${layerName}" added to map`);
            } else {
                console.log(`ℹ️ Layer "${layerName}" already on map`);
            }
        } else {
            if (this.map.hasLayer(layerGroup)) {
                this.map.removeLayer(layerGroup);
                console.log(`✅ Layer "${layerName}" removed from map`);
            } else {
                console.log(`ℹ️ Layer "${layerName}" already removed`);
            }
        }
    }
    
    /**
     * Zoom to specific field
     */
    zoomToField(field) {
        if (!field || !field.originalCoordinates || field.originalCoordinates.length < 3) {
            console.warn('Cannot zoom to field: invalid coordinates');
            return;
        }
        
        try {
            const bounds = L.latLngBounds(field.originalCoordinates);
            this.map.fitBounds(bounds, { 
                padding: [100, 100],
                maxZoom: 18
            });
            
            console.log(`✅ Zoomed to field: ${field.ccsFieldId}`);
        } catch (error) {
            console.error('Error zooming to field:', error);
        }
    }
    
    // Get map instance
    getMap() {
        return this.map;
    }
    
    // Destroy map
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }
    
    // Add drawing tools (optional, for future enhancement)
    enableDrawing() {
        // Placeholder for drawing functionality
        this.editMode = true;
    }
    
    disableDrawing() {
        this.editMode = false;
    }
}
