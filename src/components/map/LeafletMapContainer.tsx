// src/components/map/LeafletMapContainer.tsx - Conteneur Leaflet optimisé

'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GRID_CONFIG } from '@/lib/gridConfig';
import { type Pixel, type Bounds } from '@/lib/pixelGridSystem';
import PixelOverlayOptimized from './PixelOverlayOptimized';

// Fix pour les icônes Leaflet en Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
});

interface LeafletMapContainerProps {
    onMapReady: (map: L.Map) => void;
    onMapChange: (bounds: Bounds, zoom: number) => void;
    pixels: Pixel[];
    selectedColor?: string;
    user?: {
        id: number;
        username: string;
        isPremium: boolean;
        lastPixelTime?: Date;
    };
    onPixelPlace?: (pixel: Omit<Pixel, 'id'>) => Promise<void>;
    onPixelHover?: (pixel: Pixel | null) => void;
    zoom: number;
    mapBounds: Bounds;
}

const LeafletMapContainer: React.FC<LeafletMapContainerProps> = ({
    onMapReady,
    onMapChange,
    pixels,
    selectedColor,
    user,
    onPixelPlace,
    onPixelHover,
    zoom,
    mapBounds
}) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const isInitialized = useRef(false);

    // Initialisation de la carte
    useEffect(() => {
        if (!mapRef.current || isInitialized.current) return;

        // Configuration de la carte
        const map = L.map(mapRef.current, {
            center: [48.8566, 2.3522], // Paris par défaut
            zoom: 16,
            minZoom: 10,
            maxZoom: 22,
            zoomControl: false, // On va l'ajouter manuellement
            attributionControl: true,
            preferCanvas: true, // Utiliser Canvas pour de meilleures performances
            maxBoundsViscosity: 0.8 // Résistance aux limites
        });

        // Ajouter le contrôle de zoom en position personnalisée
        L.control.zoom({
            position: 'bottomright'
        }).addTo(map);

        // Couche de base avec plusieurs options
        const baseLayers = {
            'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }),
            'CartoDB Light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap contributors © CARTO',
                maxZoom: 19
            }),
            'CartoDB Dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap contributors © CARTO',
                maxZoom: 19
            }),
            'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri, Maxar, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
                maxZoom: 19
            })
        };

        // Ajouter la couche par défaut
        baseLayers['CartoDB Light'].addTo(map);

        // Ajouter le contrôle des couches
        L.control.layers(baseLayers, {}, {
            position: 'topleft',
            collapsed: true
        }).addTo(map);

        // Ajouter un contrôle d'échelle
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false
        }).addTo(map);

        // Gestionnaires d'événements
        const handleMoveEnd = () => {
            const bounds = map.getBounds();
            const zoom = map.getZoom();

            const boundsData: Bounds = {
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest()
            };

            onMapChange(boundsData, zoom);
        };

        const handleZoomEnd = () => {
            handleMoveEnd();
        };

        // Débouncer les événements pour éviter les appels trop fréquents
        let moveTimeout: NodeJS.Timeout;
        const debouncedMoveEnd = () => {
            clearTimeout(moveTimeout);
            moveTimeout = setTimeout(handleMoveEnd, 150);
        };

        map.on('moveend', debouncedMoveEnd);
        map.on('zoomend', handleZoomEnd);

        // Gestionnaire de redimensionnement
        const handleResize = () => {
            map.invalidateSize();
        };

        window.addEventListener('resize', handleResize);

        // Sauvegarder l'instance et marquer comme initialisé
        mapInstanceRef.current = map;
        isInitialized.current = true;

        // Appeler le callback avec l'instance de la carte
        onMapReady(map);

        // Déclencher le premier chargement
        handleMoveEnd();

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(moveTimeout);
            map.remove();
            mapInstanceRef.current = null;
            isInitialized.current = false;
        };
    }, [onMapReady, onMapChange]);

    // Gestionnaire de clic pour les coordonnées (debug)
    useEffect(() => {
        if (!mapInstanceRef.current) return;

        const map = mapInstanceRef.current;

        const handleClick = (e: L.LeafletMouseEvent) => {
            // Afficher les coordonnées en mode debug (si nécessaire)
            if (process.env.NODE_ENV === 'development') {
                console.log(`Clic sur: ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
            }
        };

        map.on('click', handleClick);

        return () => {
            map.off('click', handleClick);
        };
    }, []);

    // Fonction pour centrer la carte sur une position
    const centerMap = useCallback((lat: number, lng: number, zoom?: number) => {
        if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([lat, lng], zoom || mapInstanceRef.current.getZoom());
        }
    }, []);

    // Fonction pour ajuster la vue sur une zone
    const fitBounds = useCallback((bounds: Bounds, options?: L.FitBoundsOptions) => {
        if (mapInstanceRef.current) {
            const leafletBounds = L.latLngBounds(
                [bounds.south, bounds.west],
                [bounds.north, bounds.east]
            );
            mapInstanceRef.current.fitBounds(leafletBounds, options);
        }
    }, []);

    // Exposer des méthodes utiles via une ref (si nécessaire)
    useEffect(() => {
        if (mapInstanceRef.current) {
            // Ajouter des méthodes personnalisées à l'instance de la carte
            (mapInstanceRef.current as any).centerMap = centerMap;
            (mapInstanceRef.current as any).fitBounds = fitBounds;
        }
    }, [centerMap, fitBounds]);

    return (
        <div className="relative w-full h-full">
            {/* Conteneur de la carte Leaflet */}
            <div
                ref={mapRef}
                className="w-full h-full"
                style={{ background: '#f8f9fa' }}
            />

            {/* Overlay des pixels */}
            {mapInstanceRef.current && (
                <PixelOverlayOptimized
                    map={mapInstanceRef.current}
                    pixels={pixels}
                    zoom={zoom}
                    mapBounds={mapBounds}
                    selectedColor={selectedColor}
                    user={user}
                    onPixelPlace={onPixelPlace}
                    onPixelHover={onPixelHover}
                />
            )}

            {/* Contrôles personnalisés */}
            <div className="absolute top-4 left-4 z-[1000]">
                {/* Bouton de géolocalisation */}
                <button
                    onClick={() => {
                        if (navigator.geolocation && mapInstanceRef.current) {
                            navigator.geolocation.getCurrentPosition(
                                (position) => {
                                    centerMap(position.coords.latitude, position.coords.longitude, 18);
                                },
                                (error) => {
                                    console.error('Erreur géolocalisation:', error);
                                    alert('Impossible d\'obtenir votre position');
                                }
                            );
                        } else {
                            alert('Géolocalisation non supportée');
                        }
                    }}
                    className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors mb-2"
                    title="Me localiser"
                >
                    📍
                </button>

                {/* Bouton pour aller à Paris */}
                <button
                    onClick={() => centerMap(48.8566, 2.3522, 16)}
                    className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors mb-2"
                    title="Aller à Paris"
                >
                    🗼
                </button>

                {/* Bouton pour aller à New York */}
                <button
                    onClick={() => centerMap(40.7128, -74.0060, 16)}
                    className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors mb-2"
                    title="Aller à New York"
                >
                    🗽
                </button>

                {/* Bouton pour aller à Tokyo */}
                <button
                    onClick={() => centerMap(35.6762, 139.6503, 16)}
                    className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
                    title="Aller à Tokyo"
                >
                    🗾
                </button>
            </div>

            {/* Informations de niveau de zoom */}
            <div className="absolute bottom-4 left-4 z-[1000]">
                <div className="bg-white px-3 py-1 rounded-lg shadow-lg text-sm">
                    <span className="text-gray-600">Zoom: </span>
                    <span className="font-medium">{zoom}</span>
                    {zoom < GRID_CONFIG.ZOOM.MIN_VISIBLE && (
                        <span className="text-orange-500 ml-2">
                            (Zoomez pour voir les pixels)
                        </span>
                    )}
                </div>
            </div>

            {/* Crosshair pour le placement de pixels */}
            {selectedColor && user && zoom >= GRID_CONFIG.ZOOM.SNAP_ENABLED && (
                <div className="absolute inset-0 pointer-events-none z-[1000] flex items-center justify-center">
                    <div className="relative">
                        <div
                            className="w-6 h-6 border-2 border-black bg-white bg-opacity-80 rounded"
                            style={{
                                borderColor: selectedColor,
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.3)'
                            }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-1 h-1 bg-black rounded-full" />
                        </div>
                    </div>
                </div>
            )}

            {/* Message d'aide pour les nouveaux utilisateurs */}
            {zoom < GRID_CONFIG.ZOOM.MIN_VISIBLE && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000]">
                    <div className="bg-blue-500 text-white px-6 py-4 rounded-lg shadow-xl max-w-sm text-center">
                        <div className="text-lg font-semibold mb-2">🔍 Zoomez pour commencer !</div>
                        <div className="text-sm opacity-90">
                            Zoomez jusqu'au niveau {GRID_CONFIG.ZOOM.MIN_VISIBLE} pour voir et placer des pixels
                        </div>
                    </div>
                </div>
            )}

            {/* Légende des couleurs en bas à droite */}
            {selectedColor && (
                <div className="absolute bottom-4 right-4 z-[1000]">
                    <div className="bg-white rounded-lg shadow-lg p-3 flex items-center gap-3">
                        <span className="text-sm text-gray-600">Couleur sélectionnée:</span>
                        <div
                            className="w-6 h-6 rounded border-2 border-gray-300"
                            style={{ backgroundColor: selectedColor }}
                        />
                        <span className="text-sm font-medium">{selectedColor.toUpperCase()}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeafletMapContainer;