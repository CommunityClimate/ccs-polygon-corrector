/**
 * Before/After Map Display Component
 * 
 * Displays original (red) and corrected (green) polygons side-by-side
 * Auto-detects when both geometries are available
 */

export class BeforeAfterDisplay {
    /**
     * Check if field has before/after capability
     * @param {Object} field - Field object
     * @returns {boolean}
     */
    static hasBeforeAfter(field) {
        return !!(field.originalGeometry && field.correctedGeometry);
    }

    /**
     * Display before/after comparison on map
     * @param {Object} map - Leaflet map instance
     * @param {Object} field - Field with original and corrected geometry
     * @returns {Object} Layer group with both polygons
     */
    static displayComparison(map, field) {
        if (!this.hasBeforeAfter(field)) {
            console.warn('Field does not have both original and corrected geometry');
            return null;
        }

        const layerGroup = L.layerGroup();

        try {
            // Display ORIGINAL polygon (RED - before correction)
            const originalCoords = this.convertGeoJSONToLeaflet(field.originalGeometry);
            const originalPolygon = L.polygon(originalCoords, {
                color: '#e74c3c',
                fillColor: '#e74c3c',
                fillOpacity: 0.2,
                weight: 2,
                dashArray: '5, 5'
            });

            originalPolygon.bindTooltip('Before Correction', {
                permanent: false,
                direction: 'top'
            });

            layerGroup.addLayer(originalPolygon);

            // Display CORRECTED polygon (GREEN - after correction)
            const correctedCoords = this.convertGeoJSONToLeaflet(field.correctedGeometry);
            const correctedPolygon = L.polygon(correctedCoords, {
                color: '#27ae60',
                fillColor: '#27ae60',
                fillOpacity: 0.3,
                weight: 3
            });

            correctedPolygon.bindTooltip('After Correction', {
                permanent: false,
                direction: 'bottom'
            });

            layerGroup.addLayer(correctedPolygon);

            // Add to map
            layerGroup.addTo(map);

            // Fit bounds to show both polygons
            const allCoords = [...originalCoords, ...correctedCoords];
            const bounds = L.latLngBounds(allCoords);
            map.fitBounds(bounds, { padding: [50, 50] });

            return layerGroup;

        } catch (err) {
            console.error('Error displaying before/after comparison:', err);
            return null;
        }
    }

    /**
     * Display only original polygon (when no correction exists)
     * @param {Object} map - Leaflet map instance
     * @param {Object} field - Field with original geometry
     * @returns {Object} Polygon layer
     */
    static displayOriginal(map, field) {
        if (!field.originalGeometry) {
            console.warn('Field does not have original geometry');
            return null;
        }

        try {
            const coords = this.convertGeoJSONToLeaflet(field.originalGeometry);
            const polygon = L.polygon(coords, {
                color: '#e67e22',
                fillColor: '#e67e22',
                fillOpacity: 0.2,
                weight: 2
            });

            polygon.bindTooltip('Original (Not Corrected)', {
                permanent: false,
                direction: 'top'
            });

            polygon.addTo(map);

            map.fitBounds(polygon.getBounds(), { padding: [50, 50] });

            return polygon;

        } catch (err) {
            console.error('Error displaying original polygon:', err);
            return null;
        }
    }

    /**
     * Convert GeoJSON coordinates to Leaflet format
     * @param {Object} geojson - GeoJSON geometry object
     * @returns {Array} Leaflet coordinates [lat, lng]
     */
    static convertGeoJSONToLeaflet(geojson) {
        if (!geojson || !geojson.coordinates) {
            throw new Error('Invalid GeoJSON geometry');
        }

        // Handle Polygon type
        if (geojson.type === 'Polygon') {
            // GeoJSON format: [[[lng, lat], ...]]
            // Leaflet format: [[lat, lng], ...]
            return geojson.coordinates[0].map(coord => [coord[1], coord[0]]);
        }

        throw new Error(`Unsupported geometry type: ${geojson.type}`);
    }

    /**
     * Create comparison info HTML
     * @param {Object} field - Field object
     * @returns {string} HTML string
     */
    static createComparisonInfo(field) {
        if (!this.hasBeforeAfter(field)) {
            return `
                <div class="comparison-info">
                    <p><strong>⚠️ Before/After Not Available</strong></p>
                    <p>This field only has ${field.hasOriginal ? 'original' : 'corrected'} geometry.</p>
                </div>
            `;
        }

        const originalVertices = field.originalGeometry.coordinates[0].length - 1;
        const correctedVertices = field.correctedGeometry.coordinates[0].length - 1;
        const vertexChange = correctedVertices - originalVertices;

        return `
            <div class="comparison-info" style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 10px;">
                <h4 style="margin-top: 0; color: #2c3e50;">📊 Before/After Comparison</h4>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                    <div style="padding: 10px; background: #fee; border-left: 3px solid #e74c3c;">
                        <strong style="color: #c0392b;">Before Correction</strong><br>
                        <span style="color: #7f8c8d;">Vertices: ${originalVertices}</span>
                    </div>
                    <div style="padding: 10px; background: #efe; border-left: 3px solid #27ae60;">
                        <strong style="color: #27ae60;">After Correction</strong><br>
                        <span style="color: #7f8c8d;">Vertices: ${correctedVertices}</span>
                    </div>
                </div>

                ${vertexChange !== 0 ? `
                    <p style="margin: 5px 0; color: #7f8c8d;">
                        <strong>Change:</strong> ${vertexChange > 0 ? '+' : ''}${vertexChange} vertices
                    </p>
                ` : ''}

                <p style="margin: 5px 0; color: #7f8c8d;">
                    <strong>Correction Method:</strong> ${field.correctionMethod || 'Not specified'}
                </p>

                ${field.manualFlags && Object.values(field.manualFlags).some(v => v) ? `
                    <p style="margin: 5px 0; color: #7f8c8d;">
                        <strong>Flagged Issues:</strong> 
                        ${field.manualFlags.selfIntersection ? '🔴 Self-Intersection ' : ''}
                        ${field.manualFlags.straightLine ? '📏 Straight-Line ' : ''}
                        ${field.manualFlags.bowTie ? '🎀 Bow-Tie ' : ''}
                        ${field.manualFlags.otherIssue ? '⚠️ Other ' : ''}
                    </p>
                ` : ''}

                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #dee2e6;">
                    <small style="color: #95a5a6;">
                        <span style="color: #e74c3c;">●</span> Red (dashed) = Original<br>
                        <span style="color: #27ae60;">●</span> Green (solid) = Corrected
                    </small>
                </div>
            </div>
        `;
    }

    /**
     * Add before/after toggle to field card
     * @param {Object} field - Field object
     * @param {HTMLElement} cardElement - Card DOM element
     * @param {Object} map - Leaflet map instance
     */
    static addToggleButton(field, cardElement, map) {
        if (!this.hasBeforeAfter(field)) {
            return;
        }

        const buttonContainer = cardElement.querySelector('.field-actions') || cardElement;
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'btn btn-sm btn-info';
        toggleBtn.innerHTML = '🔄 View Before/After';
        toggleBtn.style.marginLeft = '5px';

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Clear existing layers
            map.eachLayer(layer => {
                if (layer instanceof L.Polygon) {
                    map.removeLayer(layer);
                }
            });

            // Display comparison
            this.displayComparison(map, field);

            // Show info
            const infoContainer = cardElement.querySelector('.comparison-info-container');
            if (infoContainer) {
                infoContainer.innerHTML = this.createComparisonInfo(field);
            }
        });

        buttonContainer.appendChild(toggleBtn);
    }
}

// Make available globally
window.BeforeAfterDisplay = BeforeAfterDisplay;
