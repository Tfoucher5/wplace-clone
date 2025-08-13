'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
    GRID_CONFIG,
    getVisiblePixels,
    gridToGeo,
    getPixelBounds,
    getPixelScreenSize
} from '@/lib/gridSystem';

interface Pixel {
    id: number;
    gridX: number;
    gridY: number;
    color: string;
    username: string;
    placedAt: Date;
}

interface PixelOverlayProps {
    map: L.Map;
    pixels: Pixel[];
    zoom: number;
    mapBounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
}

const PixelOverlay: React.FC<PixelOverlayProps> = ({ map, pixels, zoom, mapBounds }) => {
    const pixelLayerRef = useRef<L.LayerGroup | null>(null);
    const gridLayerRef = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
        if (!map) return;

        // Créer les couches si elles n'existent pas
        if (!pixelLayerRef.current) {
            pixelLayerRef.current = L.layerGroup().addTo(map);
        }
        if (!gridLayerRef.current) {
            gridLayerRef.current = L.layerGroup().addTo(map);
        }

        // Nettoyer les couches existantes
        pixelLayerRef.current.clearLayers();
        gridLayerRef.current.clearLayers();

        // Ne rien afficher si le zoom est trop faible
        if (zoom < GRID_CONFIG.MIN_ZOOM_VISIBLE) {
            return;
        }

        console.log(`🔍 Rendu de la grille - Zoom: ${zoom}, Pixels: ${pixels.length}`);

        // Obtenir les positions de grille visibles
        const visibleGridPositions = getVisiblePixels(mapBounds, zoom);
        console.log(`📐 Positions de grille visibles: ${visibleGridPositions.length}`);

        // Créer un map des pixels existants pour un accès rapide
        const pixelMap = new Map<string, Pixel>();
        pixels.forEach(pixel => {
            const key = `${pixel.gridX},${pixel.gridY}`;
            pixelMap.set(key, pixel);
        });

        // Afficher la grille et les pixels
        visibleGridPositions.forEach(gridPos => {
            const bounds = getPixelBounds(gridPos.x, gridPos.y);
            const pixelKey = `${gridPos.x},${gridPos.y}`;
            const pixel = pixelMap.get(pixelKey);

            // Créer le rectangle de grille
            const pixelBounds = L.latLngBounds(
                [bounds.south, bounds.west],
                [bounds.north, bounds.east]
            );

            if (pixel) {
                // Pixel occupé - afficher avec la couleur
                const pixelRect = L.rectangle(pixelBounds, {
                    color: pixel.color,
                    fillColor: pixel.color,
                    fillOpacity: 0.8,
                    weight: 1,
                    opacity: 0.9
                });

                // Ajouter tooltip avec infos
                pixelRect.bindTooltip(`
          <div style="text-align: center; font-size: 12px;">
            <strong style="color: ${pixel.color};">${pixel.color}</strong><br/>
            Par: <strong>${pixel.username}</strong><br/>
            Position: ${pixel.gridX}, ${pixel.gridY}<br/>
            <small>${pixel.placedAt.toLocaleString()}</small>
          </div>
        `, {
                    direction: 'top',
                    offset: [0, -5]
                });

                pixelLayerRef.current?.addLayer(pixelRect);
            } else {
                // Pixel vide - afficher la grille
                const gridRect = L.rectangle(pixelBounds, {
                    color: '#ffffff',
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    weight: 0.5,
                    opacity: 0.2,
                    interactive: false
                });

                gridLayerRef.current?.addLayer(gridRect);
            }
        });

        console.log(`✅ Grille rendue: ${visibleGridPositions.length} positions, ${pixels.length} pixels`);

    }, [map, pixels, zoom, mapBounds]);

    // Cleanup lors du démontage
    useEffect(() => {
        return () => {
            if (pixelLayerRef.current && map) {
                map.removeLayer(pixelLayerRef.current);
            }
            if (gridLayerRef.current && map) {
                map.removeLayer(gridLayerRef.current);
            }
        };
    }, [map]);

    return null; // Ce composant ne rend rien directement dans le DOM React
};

export default PixelOverlay;