// Legend Manager - Map Legend with Layer Controls
export class LegendManager {
    
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.isVisible = false;
    }
    
    /**
     * Create and display map legend
     */
    createLegend() {
        // Check if legend already exists
        let legendDiv = document.getElementById('mapLegend');
        if (legendDiv) return legendDiv;
        
        // Create legend container
        legendDiv = document.createElement('div');
        legendDiv.id = 'mapLegend';
        legendDiv.className = 'map-legend';
        legendDiv.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            z-index: 1000;
            max-width: 250px;
            font-size: 13px;
        `;
        
        legendDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">
                <strong style="font-size: 14px;">🗺️ Map Legend</strong>
                <button id="closeLegend" style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 0; line-height: 1;">×</button>
            </div>
            
            <!-- Basemap Selection -->
            <div style="margin-bottom: 12px;">
                <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">MAP LAYERS</label>
                <div style="display: flex; gap: 5px;">
                    <label style="flex: 1; cursor: pointer;">
                        <input type="radio" name="basemap" value="standard" checked style="margin-right: 4px;">
                        <span style="font-size: 11px;">Standard</span>
                    </label>
                    <label style="flex: 1; cursor: pointer;">
                        <input type="radio" name="basemap" value="satellite" style="margin-right: 4px;">
                        <span style="font-size: 11px;">Satellite</span>
                    </label>
                    <label style="flex: 1; cursor: pointer;">
                        <input type="radio" name="basemap" value="hybrid" style="margin-right: 4px;">
                        <span style="font-size: 11px;">Hybrid</span>
                    </label>
                </div>
            </div>
            
            <!-- Layer Toggles -->
            <div style="margin-bottom: 12px;">
                <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">POLYGON LAYERS</label>
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <label style="cursor: pointer; font-size: 12px;">
                        <input type="checkbox" id="toggleOriginal" checked style="margin-right: 6px;">
                        <span style="color: #dc3545;">━━</span> Original Polygon
                    </label>
                    <label style="cursor: pointer; font-size: 12px;">
                        <input type="checkbox" id="toggleCorrected" checked style="margin-right: 6px;">
                        <span style="color: #28a745;">━━</span> Corrected Polygon
                    </label>
                    <div style="margin-left: 20px; font-size: 11px; color: #666;">
                        <div style="margin: 3px 0;">
                            <span style="color: #ffc107;">━━</span> Auto-Corrected
                        </div>
                        <div style="margin: 3px 0;">
                            <span style="color: #667eea;">━━</span> Manually-Corrected
                        </div>
                    </div>
                    <label style="cursor: pointer; font-size: 12px;">
                        <input type="checkbox" id="toggleVertices" checked style="margin-right: 6px;">
                        <span style="color: #007bff;">●</span> Vertices
                    </label>
                    <label style="cursor: pointer; font-size: 12px;">
                        <input type="checkbox" id="toggleVertexLabels" checked style="margin-right: 6px;">
                        <span style="color: #6c757d;">①</span> Vertex Numbers
                    </label>
                </div>
            </div>
            
            <!-- Field Size Legend -->
            <div>
                <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">FIELD SIZE</label>
                <div style="display: flex; flex-direction: column; gap: 4px; font-size: 11px;">
                    <div><span style="background: #ffebee; padding: 2px 6px; border-radius: 3px; margin-right: 4px;">XS</span> Too Small (&lt; 0.2 ha)</div>
                    <div><span style="background: #e8f5e9; padding: 2px 6px; border-radius: 3px; margin-right: 4px;">OK</span> Normal (0.2-20 ha)</div>
                    <div><span style="background: #e3f2fd; padding: 2px 6px; border-radius: 3px; margin-right: 4px;">XL</span> Too Large (&gt; 20 ha)</div>
                </div>
            </div>
        `;
        
        // Add to map container
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.appendChild(legendDiv);
        }
        
        // Attach event listeners
        this.attachEventListeners(legendDiv);
        
        return legendDiv;
    }
    
    /**
     * Attach event listeners to legend controls
     */
    attachEventListeners(legendDiv) {
        // Close button
        const closeBtn = legendDiv.querySelector('#closeLegend');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        // Basemap switcher
        const basemapRadios = legendDiv.querySelectorAll('input[name="basemap"]');
        basemapRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.switchBasemap(e.target.value);
            });
        });
        
        // Layer toggles
        const toggleOriginal = legendDiv.querySelector('#toggleOriginal');
        const toggleCorrected = legendDiv.querySelector('#toggleCorrected');
        const toggleVertices = legendDiv.querySelector('#toggleVertices');
        const toggleVertexLabels = legendDiv.querySelector('#toggleVertexLabels');
        
        if (toggleOriginal) {
            toggleOriginal.addEventListener('change', (e) => {
                this.mapManager.toggleLayer('original', e.target.checked);
            });
        }
        
        if (toggleCorrected) {
            toggleCorrected.addEventListener('change', (e) => {
                this.mapManager.toggleLayer('corrected', e.target.checked);
            });
        }
        
        if (toggleVertices) {
            toggleVertices.addEventListener('change', (e) => {
                this.mapManager.toggleLayer('vertices', e.target.checked);
            });
        }
        
        if (toggleVertexLabels) {
            toggleVertexLabels.addEventListener('change', (e) => {
                this.mapManager.toggleLayer('vertexLabels', e.target.checked);
            });
        }
    }
    
    /**
     * Switch basemap
     */
    switchBasemap(type) {
        console.log('Switching basemap to:', type);
        
        const map = this.mapManager.map;
        
        // Remove current tile layer
        map.eachLayer(layer => {
            if (layer instanceof L.TileLayer) {
                map.removeLayer(layer);
            }
        });
        
        // Add new tile layer
        let tileLayer;
        switch (type) {
            case 'satellite':
                tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles © Esri',
                    maxZoom: 18
                });
                break;
                
            case 'hybrid':
                // Satellite base
                L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                    attribution: 'Tiles © Esri',
                    maxZoom: 18
                }).addTo(map);
                
                // Labels overlay
                tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    opacity: 0.5,
                    maxZoom: 19
                });
                break;
                
            case 'standard':
            default:
                tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19
                });
                break;
        }
        
        tileLayer.addTo(map);
        
        // Re-add all polygon layers on top
        this.mapManager.refreshLayers();
    }
    
    /**
     * Show legend
     */
    show() {
        let legendDiv = document.getElementById('mapLegend');
        if (!legendDiv) {
            legendDiv = this.createLegend();
        }
        legendDiv.style.display = 'block';
        this.isVisible = true;
    }
    
    /**
     * Hide legend
     */
    hide() {
        const legendDiv = document.getElementById('mapLegend');
        if (legendDiv) {
            legendDiv.style.display = 'none';
        }
        this.isVisible = false;
    }
    
    /**
     * Toggle legend visibility
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}
