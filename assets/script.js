// Main Application - Optimized with Sticky Notes
class QuakePHMap {
    constructor() {
        // Cache DOM elements in a single pass
        this.cacheDOMElements();
        
        // Initialize state
        this.state = {
            map: null,
            quakeMarkers: [],
            faultLines: null,
            earthquakeData: [],
            currentLayer: 'earthquake',
            autoRefreshInterval: null,
            drawings: [],
            nextDrawingId: 1,
            isDrawingActive: false,
            isDrawingEnabled: false,
            selectedDrawing: null,
            drawingMode: null,
            hasShownDrawingPopup: false,
            textModalLatLng: null
        };
        
        // Layer groups
        this.layers = {
            quake: L.layerGroup(),
            fault: L.layerGroup(),
            drawnItems: new L.FeatureGroup()
        };
        
        // Initialize
        this.init();
    }
    
    cacheDOMElements() {
        // Use object destructuring for cleaner code
        const elements = {
            sidebar: 'sidebar',
            toggleSidebar: 'toggleSidebar',
            mobileToggle: 'mobileToggle',
            layerButtons: '.layer-btn',
            mapLayers: { base: 'baseMap', hazard: 'hazardMap', risk: 'riskMap' },
            currentLayerTitle: 'currentLayerTitle',
            legendContent: 'legendContent',
            lastUpdate: 'lastUpdate',
            quakeList: 'quakeList',
            quakePanel: 'quakePanel',
            closeQuakePanel: 'closeQuakePanel',
            toggleQuakePanel: 'toggleQuakePanel',
            refreshBtn: 'refreshBtn',
            locateBtn: 'locateBtn',
            fullscreenBtn: 'fullscreenBtn',
            loadingOverlay: 'loadingOverlay',
            quakeCount: 'quakeCount',
            toggleLayers: 'toggleLayers',
            toggleDrawing: 'toggleDrawing'
        };
        
        // Create DOM element cache
        this.dom = {};
        Object.entries(elements).forEach(([key, value]) => {
            if (typeof value === 'string') {
                this.dom[key] = document.getElementById(value);
            }
        });
        
        // Handle layer buttons separately
        this.dom.layerButtons = document.querySelectorAll('.layer-btn');
        
        // Map layers
        this.dom.mapLayers = {};
        Object.entries(elements.mapLayers).forEach(([key, id]) => {
            this.dom.mapLayers[key] = document.getElementById(id);
        });
        
        // Drawing tools
        this.cacheDrawingElements();
    }
    
    cacheDrawingElements() {
        const drawIds = {
            marker: 'drawMarker',
            line: 'drawLine',
            polygon: 'drawPolygon',
            rectangle: 'drawRectangle',
            circle: 'drawCircle',
            text: 'drawText',
            delete: 'deleteSelected',
            clear: 'clearAllDrawings',
            export: 'exportDrawings'
        };
        
        this.drawButtons = {};
        Object.entries(drawIds).forEach(([key, id]) => {
            this.drawButtons[key] = document.getElementById(id);
        });
        
        // Drawing controls
        this.drawColor = document.getElementById('drawColor');
        this.lineWidth = document.getElementById('lineWidth');
        this.widthValue = document.getElementById('widthValue');
        this.fillOpacity = document.getElementById('fillOpacity');
        this.opacityValue = document.getElementById('opacityValue');
        this.drawingsList = document.getElementById('drawingsList');
        
        // Modal elements
        const modalIds = {
            textModal: 'textModal',
            textContent: 'textContent',
            textSize: 'textSize',
            textSizeValue: 'textSizeValue',
            textColor: 'textColor',
            textBackground: 'textBackground',
            closeTextModal: 'closeTextModal',
            cancelText: 'cancelText',
            saveText: 'saveText'
        };
        
        this.modal = {};
        Object.entries(modalIds).forEach(([key, id]) => {
            this.modal[key] = document.getElementById(id);
        });
        
        this.drawingToolsPanel = document.querySelector('.drawing-tools-panel');
    }
    
    init() {
        this.initMap();
        this.initEventListeners();
        this.loadFaultLines();
        this.loadEarthquakeData();
        this.setupAutoRefresh();
        this.updateLegend();
        this.loadSavedDrawings();
        
        // Initialize Sticky Notes
        this.notesManager = new StickyNotesManager(this);
    }
    
    initMap() {
        this.state.map = L.map('baseMap', {
            center: [12.8797, 121.7740],
            zoom: 6,
            zoomControl: true,
            attributionControl: false
        });
        
        // Add base tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.state.map);
        
        // Add controls
        L.control.scale({ imperial: false }).addTo(this.state.map);
        L.control.attribution({ position: 'bottomright' })
            .addTo(this.state.map)
            .addAttribution('QuakePH | Philippine Earthquake Monitor');
        
        // Add layer groups to map
        this.layers.quake.addTo(this.state.map);
        this.layers.drawnItems.addTo(this.state.map);
    }
    
    initEventListeners() {
        // Sidebar events
        this.dom.toggleSidebar?.addEventListener('click', () => this.toggleSidebar());
        this.dom.mobileToggle?.addEventListener('click', () => this.toggleSidebar());
        
        // Layer buttons
        this.dom.layerButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchLayer(e.currentTarget));
        });
        
        // Panel events
        this.dom.toggleQuakePanel?.addEventListener('click', () => this.toggleEarthquakePanel());
        this.dom.closeQuakePanel?.addEventListener('click', () => this.toggleEarthquakePanel());
        
        // Control buttons
        this.dom.refreshBtn?.addEventListener('click', () => this.loadEarthquakeData());
        this.dom.locateBtn?.addEventListener('click', () => this.locateUser());
        this.dom.fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());
        this.dom.toggleLayers?.addEventListener('click', () => this.toggleSidebar());
        this.dom.toggleDrawing?.addEventListener('click', () => this.toggleDrawingTools());
        
        // Drawing events
        this.initDrawingEvents();
        
        // Map click for text drawing
        this.state.map.on('click', (e) => {
            if (this.state.drawingMode === 'text') {
                this.openTextModal(e.latlng);
            }
        });
        
        // Escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.isDrawingActive) {
                this.exitDrawingMode();
            }
        });
        
        // Window resize handler (debounced)
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.state.map?.invalidateSize(), 250);
        });
        
        // Fullscreen change
        document.addEventListener('fullscreenchange', () => {
            setTimeout(() => this.state.map?.invalidateSize(), 300);
        });
    }
    
    initDrawingEvents() {
        // Drawing buttons
        Object.entries(this.drawButtons).forEach(([mode, btn]) => {
            if (!btn) return;
            
            const handlers = {
                marker: () => this.enterDrawingMode('marker'),
                line: () => this.enterDrawingMode('polyline'),
                polygon: () => this.enterDrawingMode('polygon'),
                rectangle: () => this.enterDrawingMode('rectangle'),
                circle: () => this.enterDrawingMode('circle'),
                text: () => this.startTextDrawing(),
                delete: () => this.deleteSelectedDrawing(),
                clear: () => this.clearAllDrawings(),
                export: () => this.exportDrawings()
            };
            
            if (handlers[mode]) {
                btn.addEventListener('click', handlers[mode]);
            }
        });
        
        // Drawing property controls
        this.lineWidth?.addEventListener('input', (e) => {
            this.widthValue.textContent = e.target.value + 'px';
        });
        
        this.fillOpacity?.addEventListener('input', (e) => {
            this.opacityValue.textContent = e.target.value + '%';
        });
        
        this.modal.textSize?.addEventListener('input', (e) => {
            this.modal.textSizeValue.textContent = e.target.value + 'px';
        });
        
        // Modal events
        this.modal.closeTextModal?.addEventListener('click', () => this.closeTextModal());
        this.modal.cancelText?.addEventListener('click', () => this.closeTextModal());
        this.modal.saveText?.addEventListener('click', () => this.saveTextAnnotation());
    }
    
    switchLayer(button) {
        const layerId = button.dataset.layer;
        if (!layerId) return;
        
        // Update button states
        this.dom.layerButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Hide all layers
        Object.values(this.dom.mapLayers).forEach(layer => layer?.classList.remove('active'));
        
        // Remove fault lines if present
        if (this.layers.fault && this.state.map.hasLayer(this.layers.fault)) {
            this.state.map.removeLayer(this.layers.fault);
        }
        
        // Exit drawing mode
        this.exitDrawingMode();
        
        // Update based on layer
        const layerConfig = {
            earthquake: {
                title: 'Philippine Earthquake Map',
                activeLayer: 'base',
                showFault: false
            },
            hazard: {
                title: 'Seismic Hazard Map',
                activeLayer: 'hazard',
                showFault: false
            },
            risk: {
                title: 'Seismic Risk Map',
                activeLayer: 'risk',
                showFault: false
            },
            fault: {
                title: 'Philippine Fault Lines',
                activeLayer: 'base',
                showFault: true
            }
        };
        
        const config = layerConfig[layerId];
        if (config) {
            this.dom.mapLayers[config.activeLayer]?.classList.add('active');
            this.dom.currentLayerTitle.textContent = config.title;
            this.state.currentLayer = layerId;
            
            if (config.showFault && this.state.faultLines) {
                this.state.map.addLayer(this.layers.fault);
            }
            
            this.state.map.invalidateSize();
            this.updateLegend();
            this.updateDrawingButtonsState();
        }
    }
    
    toggleSidebar() {
        this.dom.sidebar?.classList.toggle('collapsed');
        this.dom.sidebar?.classList.toggle('active');
        
        const icon = this.dom.toggleSidebar?.querySelector('i');
        if (icon) {
            icon.className = this.dom.sidebar?.classList.contains('collapsed') 
                ? 'fas fa-chevron-right' 
                : 'fas fa-chevron-left';
        }
        
        setTimeout(() => this.state.map?.invalidateSize(), 300);
    }
    
    toggleEarthquakePanel() {
        this.dom.quakePanel?.classList.toggle('active');
    }
    
    toggleDrawingTools() {
        this.drawingToolsPanel?.classList.toggle('active');
        this.dom.toggleDrawing?.classList.toggle('active');
        
        if (this.drawingToolsPanel?.classList.contains('active')) {
            this.showNotification('Drawing tools activated. Drawings are only available on Earthquake Map and Fault Lines layers.', 'info');
        }
    }
    
    loadFaultLines() {
        fetch('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json')
            .then(response => response.json())
            .then(data => {
                this.state.faultLines = L.geoJSON(data, {
                    style: {
                        color: '#facc15',
                        weight: 2,
                        opacity: 0.7,
                        dashArray: '5, 5'
                    },
                    onEachFeature: (feature, layer) => {
                        if (feature.properties?.Name) {
                            layer.bindPopup(`<b>Fault Line:</b> ${feature.properties.Name}`);
                        }
                    }
                });
                this.layers.fault.addLayer(this.state.faultLines);
            })
            .catch(error => console.error('Error loading fault lines:', error));
    }
    
    loadEarthquakeData() {
        this.showLoading(true);
        
        fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson')
            .then(response => response.json())
            .then(data => {
                this.state.earthquakeData = data.features;
                this.displayEarthquakes();
                this.updateEarthquakeList();
                this.updateLastUpdateTime();
                this.showLoading(false);
            })
            .catch(error => {
                console.error('Error loading earthquake data:', error);
                this.showLoading(false);
                this.showNotification('Failed to load earthquake data. Please try again.', 'error');
            });
    }
    
    displayEarthquakes() {
        this.layers.quake.clearLayers();
        this.state.quakeMarkers = [];
        
        this.state.earthquakeData.forEach(feature => {
            const coords = feature.geometry.coordinates;
            const latlng = [coords[1], coords[0]];
            const mag = feature.properties.mag;
            
            const marker = L.circleMarker(latlng, {
                radius: this.getMarkerRadius(mag),
                fillColor: this.getMagnitudeColor(mag),
                color: '#ffffff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.7
            });
            
            marker.bindPopup(this.createPopupContent(feature));
            marker.addTo(this.layers.quake);
            
            this.state.quakeMarkers.push({
                marker,
                magnitude: mag,
                time: new Date(feature.properties.time)
            });
        });
        
        this.dom.quakeCount.textContent = this.state.earthquakeData.length;
    }
    
    createPopupContent(feature) {
        const coords = feature.geometry.coordinates;
        return `
            <div class="quake-popup">
                <h3>M ${feature.properties.mag.toFixed(1)}</h3>
                <p><strong>Location:</strong> ${feature.properties.place}</p>
                <p><strong>Time:</strong> ${new Date(feature.properties.time).toLocaleString()}</p>
                <p><strong>Depth:</strong> ${coords[2].toFixed(1)} km</p>
                <p><strong>Status:</strong> ${feature.properties.status}</p>
                <button onclick="quakeMap.zoomToEarthquake(${coords[1]}, ${coords[0]})" 
                        style="margin-top: 10px; padding: 5px 10px; background: #00b4d8; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Zoom to Location
                </button>
            </div>
        `;
    }
    
    updateEarthquakeList() {
        if (!this.dom.quakeList) return;
        
        const sortedQuakes = [...this.state.earthquakeData]
            .sort((a, b) => b.properties.mag - a.properties.mag);
        
        this.dom.quakeList.innerHTML = sortedQuakes.map(feature => {
            const mag = feature.properties.mag;
            const color = this.getMagnitudeColor(mag);
            const time = new Date(feature.properties.time);
            const coords = feature.geometry.coordinates;
            
            return `
                <div class="quake-item" style="border-left-color: ${color}" data-lat="${coords[1]}" data-lng="${coords[0]}">
                    <div class="quake-magnitude" style="color: ${color}">M ${mag.toFixed(1)}</div>
                    <div class="quake-location">${feature.properties.place}</div>
                    <div class="quake-time">
                        <i class="far fa-clock"></i>
                        ${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        this.dom.quakeList.querySelectorAll('.quake-item').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                this.zoomToEarthquake(lat, lng);
            });
        });
    }
    
    zoomToEarthquake(lat, lng) {
        this.state.map.setView([lat, lng], 8);
        
        const marker = this.state.quakeMarkers.find(m => 
            m.marker.getLatLng().lat === lat && m.marker.getLatLng().lng === lng
        );
        
        if (marker) {
            marker.marker.openPopup();
            this.highlightEarthquakeMarker(lat, lng);
        }
    }
    
    highlightEarthquakeMarker(lat, lng) {
        this.state.quakeMarkers.forEach(m => {
            const markerLat = m.marker.getLatLng().lat;
            const markerLng = m.marker.getLatLng().lng;
            
            if (markerLat === lat && markerLng === lng) {
                m.marker.setStyle({ color: '#ffffff', weight: 3, fillOpacity: 0.9 });
                setTimeout(() => m.marker.setStyle({ color: '#ffffff', weight: 1, fillOpacity: 0.7 }), 3000);
            }
        });
    }
    
    getMagnitudeColor(magnitude) {
        if (magnitude < 3) return '#4cd964';
        if (magnitude < 4) return '#ffcc00';
        if (magnitude < 5) return '#ff9500';
        if (magnitude < 6) return '#ff3b30';
        return '#8b0000';
    }
    
    getMarkerRadius(magnitude) {
        return Math.max(magnitude * 3, 8);
    }
    
    updateLegend() {
        if (!this.dom.legendContent) return;
        
        const legends = {
            earthquake: `
                ${[3,4,5,6].map(mag => `
                    <div class="legend-item">
                        <div class="legend-color" style="background: ${this.getMagnitudeColor(mag-0.1)}"></div>
                        <span>Magnitude ${mag-1}.0 - ${mag-0.1}</span>
                    </div>
                `).join('')}
                <div class="legend-item">
                    <div class="legend-color" style="background: #8b0000"></div>
                    <span>Magnitude ≥ 6.0</span>
                </div>
            `,
            hazard: '<div class="legend-item"><div class="legend-info">Seismic Hazard Map shows probability of strong ground shaking. Colors indicate Peak Ground Acceleration (PGA).</div></div>',
            risk: '<div class="legend-item"><div class="legend-info">Seismic Risk Map shows estimated economic losses. Darker colors indicate higher risk areas.</div></div>',
            fault: '<div class="legend-item"><div class="legend-color" style="background: #facc15"></div><span>Major Fault Lines</span></div>'
        };
        
        this.dom.legendContent.innerHTML = legends[this.state.currentLayer] || '';
    }
    
    updateLastUpdateTime() {
        if (this.dom.lastUpdate) {
            this.dom.lastUpdate.textContent = new Date().toLocaleTimeString([], { 
                hour: '2-digit', minute: '2-digit', second: '2-digit' 
            });
        }
    }
    
    showLoading(show) {
        if (this.dom.loadingOverlay) {
            this.dom.loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }
    
    setupAutoRefresh() {
        if (this.state.autoRefreshInterval) {
            clearInterval(this.state.autoRefreshInterval);
        }
        this.state.autoRefreshInterval = setInterval(() => this.loadEarthquakeData(), 5 * 60 * 1000);
    }
    
    locateUser() {
        if (!navigator.geolocation) {
            this.showNotification('Geolocation is not supported by your browser', 'error');
            return;
        }
        
        this.showLoading(true);
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                this.state.map.setView([latitude, longitude], 10);
                this.showLoading(false);
                
                L.marker([latitude, longitude], {
                    icon: L.divIcon({
                        className: 'user-marker',
                        html: '<i class="fas fa-user" style="color: #00b4d8; font-size: 24px;"></i>',
                        iconSize: [30, 30]
                    })
                }).addTo(this.state.map).bindPopup('Your Location').openPopup();
            },
            () => {
                this.showLoading(false);
                this.showNotification('Unable to retrieve your location', 'error');
            }
        );
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.error);
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    
    // Drawing methods
    enterDrawingMode(mode) {
        if (!this.isDrawingAvailable()) {
            this.showNotification('Drawing is only available on Earthquake Map and Fault Lines layers', 'error');
            return;
        }
        
        this.showDrawingPopup();
        this.exitDrawingMode();
        this.state.drawingMode = mode;
        
        if (!this.drawControl) {
            this.initDrawingSystem();
        }
        
        // Activate draw control
        const drawOptions = {
            marker: L.Draw.Marker,
            polyline: L.Draw.Polyline,
            polygon: L.Draw.Polygon,
            rectangle: L.Draw.Rectangle,
            circle: L.Draw.Circle
        };
        
        if (drawOptions[mode]) {
            new drawOptions[mode](this.state.map, this.drawControl.options.draw[mode]).enable();
        }
        
        this.updateDrawButtonStates(mode);
        this.state.isDrawingActive = true;
        this.showDrawingModeIndicator(mode);
    }
    
    isDrawingAvailable() {
        return ['earthquake', 'fault'].includes(this.state.currentLayer);
    }
    
    updateDrawButtonStates(activeMode = null) {
        Object.entries(this.drawButtons).forEach(([mode, btn]) => {
            if (btn) {
                btn.classList.toggle('active', mode === activeMode);
            }
        });
    }
    
    initDrawingSystem() {
        this.drawControl = new L.Control.Draw({
            position: 'topleft',
            draw: this.getDrawOptions(),
            edit: { featureGroup: this.layers.drawnItems, remove: false }
        });
        
        this.state.map.addControl(this.drawControl);
        
        // Handle drawing events
        this.state.map.on(L.Draw.Event.CREATED, (e) => {
            this.styleDrawnItem(e.layer, e.layerType);
            this.layers.drawnItems.addLayer(e.layer);
            this.saveDrawing(e.layer, e.layerType);
            this.exitDrawingMode();
            this.selectDrawing(e.layer);
        });
        
        this.state.map.on(L.Draw.Event.EDITED, (e) => {
            e.layers.eachLayer(layer => this.updateDrawing(layer));
        });
        
        this.state.map.on('click', (e) => {
            if (!e.originalEvent.propagatedFromDrawing) {
                this.deselectAllDrawings();
            }
        });
    }
    
    getDrawOptions() {
        return {
            polyline: { shapeOptions: this.getShapeOptions() },
            polygon: { shapeOptions: this.getShapeOptions(true) },
            rectangle: { shapeOptions: this.getShapeOptions(true) },
            circle: { shapeOptions: this.getShapeOptions(true) },
            marker: { icon: this.getMarkerIcon() }
        };
    }
    
    getShapeOptions(fill = false) {
        const options = {
            color: this.drawColor.value,
            weight: parseInt(this.lineWidth.value),
            opacity: 0.8
        };
        
        if (fill) {
            options.fillColor = this.drawColor.value;
            options.fillOpacity = parseInt(this.fillOpacity.value) / 100;
        }
        
        return options;
    }
    
    getMarkerIcon() {
        return L.divIcon({
            className: 'custom-marker',
            html: `<div style="background: ${this.drawColor.value}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }
    
    styleDrawnItem(layer, type) {
        const color = this.drawColor.value;
        const width = parseInt(this.lineWidth.value);
        const opacity = parseInt(this.fillOpacity.value) / 100;
        
        if (type !== 'marker') {
            const style = { color, weight: width, opacity: 0.8 };
            if (['polygon', 'rectangle', 'circle'].includes(type)) {
                style.fillColor = color;
                style.fillOpacity = type === 'circle' ? opacity * 0.5 : opacity;
            }
            layer.setStyle(style);
        }
        
        // Store properties
        layer.drawingId = this.state.nextDrawingId++;
        layer.drawingType = type;
        layer.drawingProperties = {
            color,
            width,
            opacity,
            createdAt: new Date().toISOString()
        };
        
        layer.on('click', (e) => {
            e.originalEvent.propagatedFromDrawing = true;
            this.selectDrawing(layer);
        });
    }
    
    saveDrawing(layer, type) {
        const drawing = {
            id: layer.drawingId,
            type,
            layer,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${this.state.drawings.length + 1}`,
            color: layer.drawingProperties.color,
            createdAt: layer.drawingProperties.createdAt
        };
        
        this.state.drawings.push(drawing);
        this.updateDrawingsList();
        this.saveDrawingsToStorage();
    }
    
    updateDrawing(layer) {
        const drawing = this.state.drawings.find(d => d.id === layer.drawingId);
        if (drawing) {
            drawing.layer = layer;
            this.saveDrawingsToStorage();
        }
    }
    
    removeDrawing(layer) {
        this.state.drawings = this.state.drawings.filter(d => d.id !== layer.drawingId);
        this.updateDrawingsList();
        this.saveDrawingsToStorage();
        this.state.selectedDrawing = null;
    }
    
    selectDrawing(layer) {
        this.deselectAllDrawings();
        
        if (layer.setStyle && layer.drawingProperties) {
            layer.setStyle({
                color: '#ffeb3b',
                weight: (layer.drawingProperties.width || 3) + 2,
                fillColor: layer.drawingProperties.color
            });
        }
        
        if (layer._path) {
            layer._path.classList.add('selected-drawing');
        }
        
        this.state.selectedDrawing = layer;
        
        // Highlight in list
        const listItem = document.querySelector(`.drawing-item[data-id="${layer.drawingId}"]`);
        if (listItem) {
            listItem.classList.add('active');
            listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    deselectAllDrawings() {
        this.layers.drawnItems.eachLayer((layer) => {
            if (layer.drawingProperties && layer.setStyle) {
                layer.setStyle({
                    color: layer.drawingProperties.color,
                    weight: layer.drawingProperties.width,
                    fillColor: layer.drawingProperties.color,
                    fillOpacity: layer.drawingProperties.opacity
                });
            }
            if (layer._path) {
                layer._path.classList.remove('selected-drawing');
            }
        });
        
        document.querySelectorAll('.drawing-item').forEach(item => {
            item.classList.remove('active');
        });
        
        this.state.selectedDrawing = null;
    }
    
    updateDrawingsList() {
        if (!this.drawingsList) return;
        
        if (this.state.drawings.length === 0) {
            this.drawingsList.innerHTML = '<div class="no-drawings" style="color: rgba(255,255,255,0.5); text-align: center; padding: 1rem; font-style: italic;">No drawings yet</div>';
            return;
        }
        
        const sortedDrawings = [...this.state.drawings]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        this.drawingsList.innerHTML = sortedDrawings.map(drawing => `
            <div class="drawing-item" data-id="${drawing.id}">
                <div class="drawing-info">
                    <div class="drawing-color" style="background: ${drawing.color}"></div>
                    <span class="drawing-name">${drawing.name}</span>
                </div>
                <div class="drawing-actions">
                    <button class="drawing-action-btn delete-btn" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        this.drawingsList.querySelectorAll('.drawing-item').forEach(item => {
            const id = parseInt(item.dataset.id);
            const drawing = this.state.drawings.find(d => d.id === id);
            
            if (!drawing) return;
            
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.drawing-actions')) {
                    if (drawing.layer.getBounds) {
                        this.state.map.setView(drawing.layer.getBounds().getCenter(), this.state.map.getZoom());
                    } else if (drawing.layer.getLatLng) {
                        this.state.map.setView(drawing.layer.getLatLng(), this.state.map.getZoom());
                    }
                    this.selectDrawing(drawing.layer);
                }
            });
            
            const deleteBtn = item.querySelector('.delete-btn');
            deleteBtn?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.layers.drawnItems.removeLayer(drawing.layer);
                this.removeDrawing(drawing.layer);
                this.showNotification('Drawing deleted', 'success');
            });
        });
    }
    
    saveDrawingsToStorage() {
        try {
            const drawingsData = this.state.drawings.map(drawing => ({
                id: drawing.id,
                type: drawing.type,
                name: drawing.name,
                color: drawing.color,
                createdAt: drawing.createdAt,
                geojson: drawing.layer.toGeoJSON()
            }));
            localStorage.setItem('quakeph_drawings', JSON.stringify(drawingsData));
        } catch (error) {
            console.error('Error saving drawings:', error);
        }
    }
    
    loadSavedDrawings() {
        try {
            const savedDrawings = localStorage.getItem('quakeph_drawings');
            if (!savedDrawings) return;
            
            const drawingsData = JSON.parse(savedDrawings);
            
            drawingsData.forEach(data => {
                const layer = L.geoJSON(data.geojson).getLayers()[0];
                if (!layer) return;
                
                layer.drawingId = data.id;
                layer.drawingType = data.type;
                layer.drawingProperties = {
                    color: data.color,
                    width: 3,
                    opacity: 0.3,
                    createdAt: data.createdAt
                };
                
                this.styleDrawnItem(layer, data.type);
                this.layers.drawnItems.addLayer(layer);
                
                this.state.drawings.push({
                    id: data.id,
                    type: data.type,
                    layer,
                    name: data.name,
                    color: data.color,
                    createdAt: data.createdAt
                });
                
                this.state.nextDrawingId = Math.max(this.state.nextDrawingId, data.id + 1);
            });
            
            this.updateDrawingsList();
        } catch (error) {
            console.error('Error loading drawings:', error);
        }
    }
    
    exitDrawingMode() {
        if (this.state.drawingMode) {
            this.state.map.fire('draw:drawstop');
            this.state.drawingMode = null;
            this.state.isDrawingActive = false;
            this.updateDrawButtonStates();
            this.hideDrawingModeIndicator();
        }
    }
    
    showDrawingModeIndicator(mode) {
        let indicator = document.querySelector('.drawing-mode-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'drawing-mode-indicator';
            document.querySelector('.map-container')?.appendChild(indicator);
        }
        
        const modeNames = {
            marker: 'Marker',
            polyline: 'Line',
            polygon: 'Polygon',
            rectangle: 'Rectangle',
            circle: 'Circle'
        };
        
        indicator.innerHTML = `
            <i class="fas fa-pencil-alt"></i>
            <span>Drawing Mode: ${modeNames[mode] || mode}</span>
            <button class="exit-drawing-btn">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        indicator.classList.add('active');
        
        indicator.querySelector('.exit-drawing-btn')?.addEventListener('click', () => {
            this.exitDrawingMode();
        });
    }
    
    hideDrawingModeIndicator() {
        document.querySelector('.drawing-mode-indicator')?.classList.remove('active');
    }
    
    showDrawingPopup() {
        if (this.state.hasShownDrawingPopup) return;
        
        this.state.hasShownDrawingPopup = true;
        
        const popup = document.createElement('div');
        popup.className = 'drawing-instruction-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <h3><i class="fas fa-pencil-alt"></i> Drawing Tools Activated</h3>
                <p>Please close the text panel on the right of the drawing tool to access the map fully.</p>
                <p><small>Click the earthquake panel toggle button to close it.</small></p>
                <button class="popup-close-btn">Got it</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        const closePopup = () => {
            popup.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => popup.remove(), 300);
        };
        
        popup.querySelector('.popup-close-btn')?.addEventListener('click', closePopup);
        setTimeout(closePopup, 5000);
    }
    
    startTextDrawing() {
        if (!this.isDrawingAvailable()) {
            this.showNotification('Drawing is only available on Earthquake Map and Fault Lines layers', 'error');
            return;
        }
        
        this.showDrawingPopup();
        this.state.drawingMode = 'text';
        this.showNotification('Click on the map to add text annotation', 'info');
        this.updateDrawButtonStates('text');
    }
    
    openTextModal(latlng) {
        if (!this.isDrawingAvailable()) {
            this.showNotification('Drawing is only available on Earthquake Map and Fault Lines layers', 'error');
            return;
        }
        
        if (this.modal.textContent) {
            this.modal.textContent.value = '';
            this.modal.textSize.value = '16';
            this.modal.textSizeValue.textContent = '16px';
            this.modal.textColor.value = '#ffffff';
            this.modal.textBackground.value = '#000000';
        }
        
        this.state.textModalLatLng = latlng;
        this.modal.textModal?.classList.add('active');
        this.modal.textContent?.focus();
    }
    
    closeTextModal() {
        this.modal.textModal?.classList.remove('active');
        this.state.textModalLatLng = null;
    }
    
    saveTextAnnotation() {
        const text = this.modal.textContent?.value.trim();
        if (!text || !this.state.textModalLatLng) return;
        
        const fontSize = parseInt(this.modal.textSize?.value || '16');
        const textColor = this.modal.textColor?.value || '#ffffff';
        const backgroundColor = this.modal.textBackground?.value || '#000000';
        
        const textDiv = L.divIcon({
            className: 'text-annotation',
            html: `
                <div style="
                    color: ${textColor};
                    background: ${backgroundColor};
                    padding: 5px 10px;
                    border-radius: 4px;
                    font-size: ${fontSize}px;
                    font-weight: 500;
                    max-width: 200px;
                    word-wrap: break-word;
                ">
                    ${text}
                </div>
            `,
            iconSize: null,
            iconAnchor: [0, 0]
        });
        
        const marker = L.marker(this.state.textModalLatLng, {
            icon: textDiv,
            draggable: true,
            autoPan: true
        }).addTo(this.layers.drawnItems);
        
        marker.drawingId = this.state.nextDrawingId++;
        marker.drawingType = 'text';
        marker.drawingProperties = {
            text,
            fontSize,
            textColor,
            backgroundColor,
            createdAt: new Date().toISOString()
        };
        
        marker.on('click', (e) => {
            e.originalEvent.propagatedFromDrawing = true;
            this.selectDrawing(marker);
        });
        
        const drawing = {
            id: marker.drawingId,
            type: 'text',
            layer: marker,
            name: `Text ${this.state.drawings.filter(d => d.type === 'text').length + 1}`,
            color: textColor,
            createdAt: marker.drawingProperties.createdAt
        };
        
        this.state.drawings.push(drawing);
        this.updateDrawingsList();
        this.saveDrawingsToStorage();
        this.closeTextModal();
        this.exitDrawingMode();
        this.showNotification('Text annotation added', 'success');
    }
    
    deleteSelectedDrawing() {
        if (this.state.selectedDrawing) {
            this.layers.drawnItems.removeLayer(this.state.selectedDrawing);
            this.removeDrawing(this.state.selectedDrawing);
            this.showNotification('Drawing deleted', 'success');
        } else {
            this.showNotification('No drawing selected', 'error');
        }
    }
    
    clearAllDrawings() {
        if (this.state.drawings.length > 0 && confirm('Are you sure you want to clear all drawings? This cannot be undone.')) {
            this.layers.drawnItems.clearLayers();
            this.state.drawings = [];
            this.updateDrawingsList();
            localStorage.removeItem('quakeph_drawings');
            this.showNotification('All drawings cleared', 'success');
        } else if (this.state.drawings.length === 0) {
            this.showNotification('No drawings to clear', 'info');
        }
    }
    
    exportDrawings() {
        if (this.state.drawings.length === 0) {
            this.showNotification('No drawings to export', 'info');
            return;
        }
        
        try {
            const featureCollection = {
                type: "FeatureCollection",
                features: []
            };
            
            this.layers.drawnItems.eachLayer((layer) => {
                const geojson = layer.toGeoJSON();
                geojson.properties = {
                    ...geojson.properties,
                    drawingId: layer.drawingId,
                    drawingType: layer.drawingType,
                    ...layer.drawingProperties
                };
                featureCollection.features.push(geojson);
            });
            
            const dataStr = JSON.stringify(featureCollection, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', `quakeph_drawings_${new Date().toISOString().slice(0,10)}.geojson`);
            linkElement.click();
            
            this.showNotification('Drawings exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting drawings:', error);
            this.showNotification('Error exporting drawings', 'error');
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    updateDrawingButtonsState() {
        const isAvailable = this.isDrawingAvailable();
        
        Object.entries(this.drawButtons).forEach(([key, btn]) => {
            if (btn && !['clear', 'export'].includes(key)) {
                btn.classList.toggle('disabled', !isAvailable);
                btn.disabled = !isAvailable;
            }
        });
    }
}

// Sticky Notes Manager Class
class StickyNotesManager {
    constructor(mainApp) {
        this.mainApp = mainApp;
        this.notes = [];
        this.nextId = 1;
        this.panelVisible = false;
        this.currentEditId = null;
        this.noteMarkers = new Map(); // Store map markers for notes
        
        this.init();
    }
    
    init() {
        this.cacheElements();
        this.loadNotes();
        this.setupEventListeners();
        this.updateNotesList();
        this.updateNotesCount();
    }
    
    cacheElements() {
        this.toggleBtn = document.getElementById('toggleNotesPanel');
        this.panel = document.getElementById('notesPanel');
        this.closeBtn = document.getElementById('closeNotesPanel');
        this.notesList = document.getElementById('notesList');
        this.addBtn = document.getElementById('addNoteBtn');
        this.deleteAllBtn = document.getElementById('deleteAllNotesBtn');
        this.notesCount = document.getElementById('notesCount');
        
        // Edit modal elements
        this.editModal = document.getElementById('noteEditModal');
        this.closeEditModal = document.getElementById('closeNoteEditModal');
        this.cancelEdit = document.getElementById('cancelNoteEdit');
        this.saveNote = document.getElementById('saveNote');
        this.noteTitle = document.getElementById('noteTitle');
        this.noteContent = document.getElementById('noteContent');
        this.noteColor = document.getElementById('noteColor');
    }
    
    setupEventListeners() {
        if (this.toggleBtn) {
            this.toggleBtn.addEventListener('click', () => this.togglePanel());
        }
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.hidePanel());
        }
        
        if (this.addBtn) {
            this.addBtn.addEventListener('click', () => this.openNewNoteModal());
        }
        
        if (this.deleteAllBtn) {
            this.deleteAllBtn.addEventListener('click', () => this.deleteAllNotes());
        }
        
        if (this.closeEditModal) {
            this.closeEditModal.addEventListener('click', () => this.closeModal());
        }
        
        if (this.cancelEdit) {
            this.cancelEdit.addEventListener('click', () => this.closeModal());
        }
        
        if (this.saveNote) {
            this.saveNote.addEventListener('click', () => this.saveNoteFromModal());
        }
        
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.editModal?.classList.contains('active')) {
                this.closeModal();
            }
        });
        
        // Click outside to close modal
        if (this.editModal) {
            this.editModal.addEventListener('click', (e) => {
                if (e.target === this.editModal) {
                    this.closeModal();
                }
            });
        }
    }
    
    togglePanel() {
        if (this.panelVisible) {
            this.hidePanel();
        } else {
            this.showPanel();
        }
    }
    
    showPanel() {
        if (this.panel) {
            this.panel.classList.add('active');
            this.panelVisible = true;
        }
    }
    
    hidePanel() {
        if (this.panel) {
            this.panel.classList.remove('active');
            this.panelVisible = false;
        }
    }
    
    openNewNoteModal() {
        this.currentEditId = null;
        if (this.noteTitle) this.noteTitle.value = '';
        if (this.noteContent) this.noteContent.value = '';
        if (this.noteColor) this.noteColor.value = '#ffd966';
        if (this.editModal) {
            this.editModal.classList.add('active');
            if (this.noteTitle) this.noteTitle.focus();
        }
    }
    
    openEditNoteModal(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        
        this.currentEditId = id;
        if (this.noteTitle) this.noteTitle.value = note.title;
        if (this.noteContent) this.noteContent.value = note.content;
        if (this.noteColor) this.noteColor.value = note.color || '#ffd966';
        if (this.editModal) {
            this.editModal.classList.add('active');
            if (this.noteTitle) this.noteTitle.focus();
        }
    }
    
    closeModal() {
        if (this.editModal) {
            this.editModal.classList.remove('active');
        }
        this.currentEditId = null;
    }
    
    saveNoteFromModal() {
        if (!this.noteTitle || !this.noteContent || !this.noteColor) return;
        
        const title = this.noteTitle.value.trim() || 'Untitled Note';
        const content = this.noteContent.value.trim();
        
        if (!content) {
            alert('Please enter some content for the note.');
            return;
        }
        
        const color = this.noteColor.value;
        
        if (this.currentEditId) {
            // Update existing note
            this.updateNote(this.currentEditId, title, content, color);
        } else {
            // Create new note
            this.createNote(title, content, color);
        }
        
        this.closeModal();
    }
    
    createNote(title, content, color = '#ffd966') {
        const now = new Date().toISOString();
        const note = {
            id: this.nextId++,
            title,
            content,
            color,
            createdAt: now,
            updatedAt: now,
            position: this.mainApp && this.mainApp.state.map ? 
                this.mainApp.state.map.getCenter() : null // Save map position
        };
        
        this.notes.push(note);
        this.saveNotes();
        this.updateNotesList();
        this.updateNotesCount();
        
        // Add to map if map exists
        if (note.position) {
            this.addNoteMarkerToMap(note);
        }
        
        this.showNotification('Note created successfully!', 'success');
    }
    
    updateNote(id, title, content, color) {
        const note = this.notes.find(n => n.id === id);
        if (note) {
            note.title = title;
            note.content = content;
            note.color = color;
            note.updatedAt = new Date().toISOString();
            
            this.saveNotes();
            this.updateNotesList();
            
            // Update marker on map if it exists
            this.updateNoteMarkerOnMap(note);
            
            this.showNotification('Note updated successfully!', 'success');
        }
    }
    
    deleteNote(id) {
        if (confirm('Are you sure you want to delete this note?')) {
            const note = this.notes.find(n => n.id === id);
            if (note) {
                // Remove from map
                this.removeNoteMarkerFromMap(id);
            }
            
            this.notes = this.notes.filter(n => n.id !== id);
            this.saveNotes();
            this.updateNotesList();
            this.updateNotesCount();
            this.showNotification('Note deleted', 'info');
        }
    }
    
    deleteAllNotes() {
        if (this.notes.length === 0) {
            this.showNotification('No notes to delete', 'info');
            return;
        }
        
        if (confirm('Are you sure you want to delete ALL notes? This cannot be undone.')) {
            // Remove all markers from map
            this.noteMarkers.forEach((marker, id) => {
                if (this.mainApp && this.mainApp.state.map) {
                    this.mainApp.state.map.removeLayer(marker);
                }
            });
            this.noteMarkers.clear();
            
            this.notes = [];
            this.saveNotes();
            this.updateNotesList();
            this.updateNotesCount();
            this.showNotification('All notes deleted', 'info');
        }
    }
    
    saveNotes() {
        try {
            localStorage.setItem('quakeph_notes', JSON.stringify(this.notes));
            localStorage.setItem('quakeph_notes_nextid', this.nextId.toString());
        } catch (error) {
            console.error('Error saving notes:', error);
            this.showNotification('Error saving notes', 'error');
        }
    }
    
    loadNotes() {
        try {
            const savedNotes = localStorage.getItem('quakeph_notes');
            if (savedNotes) {
                this.notes = JSON.parse(savedNotes);
            }
            
            const savedNextId = localStorage.getItem('quakeph_notes_nextid');
            if (savedNextId) {
                this.nextId = parseInt(savedNextId);
            } else {
                // Set nextId based on existing notes
                this.nextId = this.notes.length > 0 
                    ? Math.max(...this.notes.map(n => n.id)) + 1 
                    : 1;
            }
            
            // Restore markers on map after map is ready
            setTimeout(() => {
                if (this.mainApp && this.mainApp.state.map) {
                    this.notes.forEach(note => {
                        if (note.position) {
                            this.addNoteMarkerToMap(note);
                        }
                    });
                }
            }, 1000);
        } catch (error) {
            console.error('Error loading notes:', error);
            this.notes = [];
            this.nextId = 1;
        }
    }
    
    updateNotesList() {
        if (!this.notesList) return;
        
        if (this.notes.length === 0) {
            this.notesList.innerHTML = '<div class="no-notes"><i class="far fa-sticky-note"></i> No notes yet. Click + to add one!</div>';
            return;
        }
        
        // Sort notes by updatedAt (most recent first)
        const sortedNotes = [...this.notes].sort((a, b) => 
            new Date(b.updatedAt) - new Date(a.updatedAt)
        );
        
        this.notesList.innerHTML = sortedNotes.map(note => `
            <div class="note-item" style="background: ${note.color}" data-id="${note.id}">
                <div class="note-header">
                    <div class="note-title">${this.escapeHtml(note.title)}</div>
                    <div class="note-actions">
                        <button class="note-action-btn edit-btn" title="Edit note">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="note-action-btn delete-btn" title="Delete note">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="note-content">${this.escapeHtml(note.content).replace(/\n/g, '<br>')}</div>
                <div class="note-timestamp">
                    ${this.formatDate(note.updatedAt)}
                    ${note.position ? '<i class="fas fa-map-marker-alt" style="margin-left: 5px;" title="Placed on map"></i>' : ''}
                </div>
            </div>
        `).join('');
        
        // Add event listeners
        this.notesList.querySelectorAll('.note-item').forEach(item => {
            const id = parseInt(item.dataset.id);
            
            item.addEventListener('click', (e) => {
                if (!e.target.closest('.note-actions')) {
                    this.openEditNoteModal(id);
                }
            });
            
            const editBtn = item.querySelector('.edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openEditNoteModal(id);
                });
            }
            
            const deleteBtn = item.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteNote(id);
                });
            }
        });
    }
    
    updateNotesCount() {
        if (this.notesCount) {
            this.notesCount.textContent = this.notes.length;
            this.notesCount.style.display = this.notes.length > 0 ? 'flex' : 'none';
        }
    }
    
    addNoteMarkerToMap(note) {
        if (!this.mainApp || !this.mainApp.state.map || !note.position) return;
        
        const map = this.mainApp.state.map;
        
        // Create custom marker for the note
        const marker = L.marker([note.position.lat, note.position.lng], {
            icon: L.divIcon({
                className: 'map-note-marker',
                html: `
                    <div class="note-bubble" style="background: ${note.color}">
                        <div class="bubble-title">${this.escapeHtml(note.title)}</div>
                        <div class="bubble-preview">${this.escapeHtml(note.content.substring(0, 30))}${note.content.length > 30 ? '...' : ''}</div>
                    </div>
                `,
                iconSize: [150, 50],
                iconAnchor: [75, 25]
            }),
            draggable: true
        }).addTo(map);
        
        // Store marker reference
        this.noteMarkers.set(note.id, marker);
        
        // Add popup with full note
        marker.bindPopup(`
            <div style="max-width: 250px;">
                <h4 style="margin:0 0 5px 0; color: #333;">${this.escapeHtml(note.title)}</h4>
                <p style="margin:0 0 5px 0; color: #555;">${this.escapeHtml(note.content).replace(/\n/g, '<br>')}</p>
                <small style="color: #777;">Updated: ${this.formatDate(note.updatedAt)}</small>
                <div style="display: flex; gap: 5px; margin-top: 8px;">
                    <button class="map-note-edit" data-id="${note.id}" style="flex:1; padding: 3px; background: #00b4d8; color: white; border: none; border-radius: 3px; cursor: pointer;">Edit</button>
                    <button class="map-note-delete" data-id="${note.id}" style="flex:1; padding: 3px; background: #ff3b30; color: white; border: none; border-radius: 3px; cursor: pointer;">Delete</button>
                </div>
            </div>
        `);
        
        // Handle popup button clicks
        marker.on('popupopen', () => {
            // Use setTimeout to ensure DOM elements are rendered
            setTimeout(() => {
                const editBtn = document.querySelector('.map-note-edit');
                const deleteBtn = document.querySelector('.map-note-delete');
                
                if (editBtn) {
                    editBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.openEditNoteModal(parseInt(e.target.dataset.id));
                        map.closePopup();
                    });
                }
                
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.deleteNote(parseInt(e.target.dataset.id));
                        map.closePopup();
                    });
                }
            }, 100);
        });
        
        // Update note position when marker is dragged
        marker.on('dragend', (e) => {
            const newPos = e.target.getLatLng();
            note.position = { lat: newPos.lat, lng: newPos.lng };
            this.saveNotes();
        });
    }
    
    updateNoteMarkerOnMap(note) {
        const marker = this.noteMarkers.get(note.id);
        if (marker && this.mainApp && this.mainApp.state.map) {
            // Update marker appearance
            marker.setIcon(L.divIcon({
                className: 'map-note-marker',
                html: `
                    <div class="note-bubble" style="background: ${note.color}">
                        <div class="bubble-title">${this.escapeHtml(note.title)}</div>
                        <div class="bubble-preview">${this.escapeHtml(note.content.substring(0, 30))}${note.content.length > 30 ? '...' : ''}</div>
                    </div>
                `,
                iconSize: [150, 50],
                iconAnchor: [75, 25]
            }));
            
            // Update popup content
            marker.setPopupContent(`
                <div style="max-width: 250px;">
                    <h4 style="margin:0 0 5px 0; color: #333;">${this.escapeHtml(note.title)}</h4>
                    <p style="margin:0 0 5px 0; color: #555;">${this.escapeHtml(note.content).replace(/\n/g, '<br>')}</p>
                    <small style="color: #777;">Updated: ${this.formatDate(note.updatedAt)}</small>
                    <div style="display: flex; gap: 5px; margin-top: 8px;">
                        <button class="map-note-edit" data-id="${note.id}" style="flex:1; padding: 3px; background: #00b4d8; color: white; border: none; border-radius: 3px; cursor: pointer;">Edit</button>
                        <button class="map-note-delete" data-id="${note.id}" style="flex:1; padding: 3px; background: #ff3b30; color: white; border: none; border-radius: 3px; cursor: pointer;">Delete</button>
                    </div>
                </div>
            `);
        }
    }
    
    removeNoteMarkerFromMap(id) {
        const marker = this.noteMarkers.get(id);
        if (marker && this.mainApp && this.mainApp.state.map) {
            this.mainApp.state.map.removeLayer(marker);
            this.noteMarkers.delete(id);
        }
    }
    
    toggleNoteOnMap(id) {
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        
        if (this.noteMarkers.has(id)) {
            // Remove from map
            this.removeNoteMarkerFromMap(id);
            note.position = null;
        } else {
            // Add to map at current center
            if (this.mainApp && this.mainApp.state.map) {
                note.position = this.mainApp.state.map.getCenter();
                this.addNoteMarkerToMap(note);
            }
        }
        this.saveNotes();
        this.updateNotesList();
    }
    
    focusNoteOnMap(id) {
        const marker = this.noteMarkers.get(id);
        if (marker && this.mainApp && this.mainApp.state.map) {
            this.mainApp.state.map.setView(marker.getLatLng(), 12);
            marker.openPopup();
        }
    }
    
    getNotesOnMap() {
        return Array.from(this.noteMarkers.keys()).map(id => 
            this.notes.find(n => n.id === id)
        ).filter(note => note);
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        
        return date.toLocaleDateString();
    }
    
    showNotification(message, type = 'info') {
        if (this.mainApp && this.mainApp.showNotification) {
            this.mainApp.showNotification(message, type);
        } else {
            // Fallback notification
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.quakeMap = new QuakePHMap();
});