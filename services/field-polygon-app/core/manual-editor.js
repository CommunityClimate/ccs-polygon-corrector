// Manual Editor - Interactive Vertex Editing
import { GeoUtils } from '../utils/geo-utils.js';

export class ManualEditor {
    constructor(mapManager) {
        this.mapManager = mapManager;
        this.isEditMode = false;
        this.addVertexMode = false;
        this.removeVertexMode = false;
        this.originalCoordinates = null;
        this.editedCoordinates = null;
        this.vertexMarkers = [];
        this.editPolygon = null;
        this.changeHistory = [];
        this.edgeMarkers = []; // For midpoint markers when adding vertices
    }
    
    /**
     * Enable manual editing mode
     */
    enableEditMode(coordinates) {
        if (this.isEditMode) {
            console.log('Edit mode already active');
            return;
        }
        
        // Store original coordinates
        this.originalCoordinates = JSON.parse(JSON.stringify(coordinates));
        this.editedCoordinates = JSON.parse(JSON.stringify(coordinates));
        
        // Clear existing layers
        this.mapManager.clearAll();
        
        // Draw original polygon (faded)
        this.drawOriginalPolygon();
        
        // Create editable polygon
        this.createEditablePolygon();
        
        // Create draggable vertex markers
        this.createVertexMarkers();
        
        this.isEditMode = true;
        
        // Log entry
        this.addChangeLog('Manual editing enabled');
        
        console.log('Manual edit mode enabled');
    }
    
    /**
     * Disable manual editing mode
     */
    disableEditMode() {
        if (!this.isEditMode) return;
        
        // Remove vertex markers
        this.removeVertexMarkers();
        
        // Remove edit polygon
        if (this.editPolygon) {
            this.mapManager.map.removeLayer(this.editPolygon);
            this.editPolygon = null;
        }
        
        // Clear map
        this.mapManager.clearAll();
        
        this.isEditMode = false;
        this.changeHistory = [];
        
        console.log('Manual edit mode disabled');
    }
    
    /**
     * Draw original polygon (faded background)
     */
    drawOriginalPolygon() {
        if (!this.originalCoordinates) return;
        
        // Coordinates are already in Leaflet format [lat, lng]
        const originalPolygon = L.polygon(this.originalCoordinates, {
            color: '#dc3545',
            fillColor: '#dc3545',
            weight: 1,
            opacity: 0.3,
            fillOpacity: 0.1
        }).addTo(this.mapManager.map);
        
        // Store reference (optional - for cleanup)
        this.originalPolygon = originalPolygon;
    }
    
    /**
     * Create editable polygon layer
     */
    createEditablePolygon() {
        if (!this.editedCoordinates) return;
        
        const latlngs = this.editedCoordinates;
        
        this.editPolygon = L.polygon(latlngs, {
            color: '#28a745',
            fillColor: '#28a745',
            weight: 2,
            opacity: 0.8,
            fillOpacity: 0.3
        }).addTo(this.mapManager.map);
        
        // Fit bounds
        this.mapManager.map.fitBounds(this.editPolygon.getBounds());
    }
    
    /**
     * Create draggable vertex markers
     */
    createVertexMarkers() {
        this.removeVertexMarkers(); // Clear existing
        
        this.editedCoordinates.forEach((coord, index) => {
            const marker = L.marker(coord, {
                draggable: true,
                icon: this.createVertexIcon(index),
                zIndexOffset: 1000
            }).addTo(this.mapManager.map);
            
            // Handle drag events
            marker.on('drag', (e) => this.onVertexDrag(e, index));
            marker.on('dragend', (e) => this.onVertexDragEnd(e, index));
            
            // Store marker
            this.vertexMarkers.push(marker);
        });
    }
    
    /**
     * Create custom vertex icon
     */
    createVertexIcon(index) {
        return L.divIcon({
            className: 'vertex-marker',
            html: `<div class="vertex-marker-inner" title="Vertex ${index + 1}">
                      <div class="vertex-number">${index + 1}</div>
                   </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }
    
    /**
     * Handle vertex drag event
     */
    onVertexDrag(event, index) {
        const newLatLng = event.target.getLatLng();
        
        // Update coordinates in Leaflet format [lat, lng]
        this.editedCoordinates[index] = [newLatLng.lat, newLatLng.lng];
        
        // Redraw polygon
        this.updateEditPolygon();
        
        console.log(`🖱️ Dragging vertex ${index + 1} to [${newLatLng.lat.toFixed(6)}, ${newLatLng.lng.toFixed(6)}]`);
    }
    
    /**
     * Handle vertex drag end event
     */
    onVertexDragEnd(event, index) {
        const newLatLng = event.target.getLatLng();
        const oldCoord = this.originalCoordinates[index];
        const newCoord = [newLatLng.lat, newLatLng.lng]; // Leaflet format [lat, lng]
        
        // Calculate distance moved
        const distance = this.calculateDistance(oldCoord, newCoord);
        
        // Log change
        this.addChangeLog(`Moved vertex ${index + 1} by ${distance.toFixed(2)}m`);
        
        console.log(`✅ Vertex ${index + 1} moved to [${newCoord[0].toFixed(6)}, ${newCoord[1].toFixed(6)}] - Distance: ${distance.toFixed(2)}m`);
    }
    
    /**
     * Update edit polygon with current coordinates
     */
    updateEditPolygon() {
        if (!this.editPolygon) return;
        
        const latlngs = this.editedCoordinates;
        this.editPolygon.setLatLngs(latlngs);
    }
    
    /**
     * Remove all vertex markers
     */
    removeVertexMarkers() {
        this.vertexMarkers.forEach(marker => {
            this.mapManager.map.removeLayer(marker);
        });
        this.vertexMarkers = [];
    }
    
    /**
     * Save edited coordinates
     */
    saveEdits() {
        if (!this.isEditMode) {
            console.log('Not in edit mode');
            return null;
        }
        
        // Return edited coordinates
        const saved = JSON.parse(JSON.stringify(this.editedCoordinates));
        
        this.addChangeLog('Changes saved');
        
        return saved;
    }
    
    /**
     * Reset to original coordinates
     */
    resetEdits() {
        if (!this.isEditMode) return;
        
        // Reset to original
        this.editedCoordinates = JSON.parse(JSON.stringify(this.originalCoordinates));
        
        // Redraw
        this.updateEditPolygon();
        this.createVertexMarkers();
        
        this.addChangeLog('Reset to original');
        
        console.log('Reset to original coordinates');
    }
    
    /**
     * Get current edited coordinates
     */
    getEditedCoordinates() {
        return this.editedCoordinates;
    }
    
    /**
     * Get change history
     */
    getChangeHistory() {
        return this.changeHistory;
    }
    
    /**
     * Add entry to change log
     */
    addChangeLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        this.changeHistory.push({
            time: timestamp,
            message: message
        });
    }
    
    /**
     * Calculate distance between two coordinates (rough estimate in meters)
     */
    calculateDistance(coord1, coord2) {
        const lat1 = coord1[1];
        const lon1 = coord1[0];
        const lat2 = coord2[1];
        const lon2 = coord2[0];
        
        const R = 6371000; // Earth radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
    
    /**
     * Check if currently in edit mode
     */
    isInEditMode() {
        return this.isEditMode;
    }
    
    // === ADD/REMOVE VERTEX METHODS ===
    
    /**
     * Enable add vertex mode
     */
    enableAddVertexMode() {
        if (!this.isEditMode) {
            console.log('Must be in edit mode first');
            return false;
        }
        
        // Disable remove mode if active
        if (this.removeVertexMode) {
            this.disableRemoveVertexMode();
        }
        
        this.addVertexMode = true;
        
        // Create midpoint markers on polygon edges
        this.createMidpointMarkers();
        
        // Make vertex markers non-draggable during add mode
        this.setVertexMarkersDraggable(false);
        
        this.addChangeLog('Add vertex mode enabled');
        console.log('Add vertex mode enabled - click on polygon edges');
        
        return true;
    }
    
    /**
     * Disable add vertex mode
     */
    disableAddVertexMode() {
        this.addVertexMode = false;
        
        // Remove midpoint markers
        this.removeMidpointMarkers();
        
        // Make vertex markers draggable again
        this.setVertexMarkersDraggable(true);
        
        console.log('Add vertex mode disabled');
    }
    
    /**
     * Enable remove vertex mode
     */
    enableRemoveVertexMode() {
        if (!this.isEditMode) {
            console.log('Must be in edit mode first');
            return false;
        }
        
        // Disable add mode if active
        if (this.addVertexMode) {
            this.disableAddVertexMode();
        }
        
        this.removeVertexMode = true;
        
        // Make vertex markers non-draggable during remove mode
        this.setVertexMarkersDraggable(false);
        
        // Update vertex markers to show remove icon
        this.updateVertexMarkersForRemove();
        
        this.addChangeLog('Remove vertex mode enabled');
        console.log('Remove vertex mode enabled - click on vertices to remove');
        
        return true;
    }
    
    /**
     * Disable remove vertex mode
     */
    disableRemoveVertexMode() {
        this.removeVertexMode = false;
        
        // Make vertex markers draggable again
        this.setVertexMarkersDraggable(true);
        
        // Recreate normal vertex markers
        this.createVertexMarkers();
        
        console.log('Remove vertex mode disabled');
    }
    
    /**
     * Create midpoint markers on polygon edges
     */
    createMidpointMarkers() {
        this.removeMidpointMarkers(); // Clear existing
        
        for (let i = 0; i < this.editedCoordinates.length; i++) {
            const current = this.editedCoordinates[i];
            const next = this.editedCoordinates[(i + 1) % this.editedCoordinates.length];
            
            // Calculate midpoint - coordinates are [lat, lng] format
            const midLat = (current[0] + next[0]) / 2;
            const midLng = (current[1] + next[1]) / 2;
            
            const midMarker = L.marker([midLat, midLng], {
                icon: this.createMidpointIcon(),
                zIndexOffset: 500
            }).addTo(this.mapManager.map);
            
            // Store the index where this vertex will be inserted
            const insertIndex = i + 1;
            
            // Click to add vertex - store in Leaflet format [lat, lng]
            midMarker.on('click', () => this.addVertexAt(insertIndex, [midLat, midLng]));
            
            this.edgeMarkers.push(midMarker);
        }
    }
    
    /**
     * Remove midpoint markers
     */
    removeMidpointMarkers() {
        this.edgeMarkers.forEach(marker => {
            this.mapManager.map.removeLayer(marker);
        });
        this.edgeMarkers = [];
    }
    
    /**
     * Create midpoint icon
     */
    createMidpointIcon() {
        return L.divIcon({
            className: 'midpoint-marker',
            html: '<div class="midpoint-marker-inner">+</div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
    }
    
    /**
     * Add vertex at specific index
     */
    addVertexAt(index, coord) {
        if (!this.addVertexMode) return;
        
        // Insert new coordinate
        this.editedCoordinates.splice(index, 0, coord);
        
        // Log change
        this.addChangeLog(`Added vertex at position ${index + 1}`);
        
        // Redraw everything
        this.updateEditPolygon();
        this.removeMidpointMarkers();
        this.createMidpointMarkers();
        this.createVertexMarkers();
        
        console.log(`Added vertex at index ${index}: [${coord[1].toFixed(6)}, ${coord[0].toFixed(6)}]`);
    }
    
    /**
     * Update vertex markers for remove mode
     */
    updateVertexMarkersForRemove() {
        this.removeVertexMarkers();
        
        this.editedCoordinates.forEach((coord, index) => {
            const marker = L.marker(coord, {
                draggable: false,
                icon: this.createRemoveVertexIcon(index),
                zIndexOffset: 1000
            }).addTo(this.mapManager.map);
            
            // Click to remove vertex
            marker.on('click', () => this.removeVertexAt(index));
            
            this.vertexMarkers.push(marker);
        });
    }
    
    /**
     * Create remove vertex icon
     */
    createRemoveVertexIcon(index) {
        return L.divIcon({
            className: 'vertex-marker vertex-marker-remove',
            html: `<div class="vertex-marker-inner vertex-remove-inner" title="Click to remove vertex ${index + 1}">
                      <div class="vertex-number">✕</div>
                   </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }
    
    /**
     * Remove vertex at specific index
     */
    removeVertexAt(index) {
        if (!this.removeVertexMode) return;
        
        // Check minimum vertex count (Verra requires at least 4)
        if (this.editedCoordinates.length <= 4) {
            alert('Cannot remove vertex: Minimum 4 vertices required for Verra compliance');
            return;
        }
        
        // Remove coordinate
        const removed = this.editedCoordinates.splice(index, 1);
        
        // Log change
        this.addChangeLog(`Removed vertex ${index + 1}`);
        
        // Redraw everything
        this.updateEditPolygon();
        this.updateVertexMarkersForRemove();
        
        console.log(`Removed vertex at index ${index}: [${removed[0][1].toFixed(6)}, ${removed[0][0].toFixed(6)}]`);
    }
    
    /**
     * Set vertex markers draggable state
     */
    setVertexMarkersDraggable(draggable) {
        this.vertexMarkers.forEach(marker => {
            if (marker.dragging) {
                if (draggable) {
                    marker.dragging.enable();
                } else {
                    marker.dragging.disable();
                }
            }
        });
    }
}
