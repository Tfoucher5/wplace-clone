// src/components/map/PixelOverlayOptimized.tsx - Composant de grille optimisé

'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import L from 'leaflet';
import {
    GRID_CONFIG,
    getAllColors,
    isFreeColor,
    getColorType
} from '@/lib/gridConfig';
import {
    getVisiblePixels,
    getPixelBounds,
    snapToGrid,
    validatePixelPlacement,
    getPixelId,
    type Pixel,
    type Bounds,
    type GridCoordinates
} from '@/lib/pixelGridSystem';

interface PixelOverlayProps {
    map: L.Map;
    pixels: Pixel[];
    zoom: number;
    mapBounds: Bounds;
    selectedColor?: string;
    user?: {
        id: number;
        username: string;
        isPremium: boolean;
        lastPixelTime?: Date;
    };
    onPixelPlace?: (pixel: Omit<Pixel, 'id'>) => Promise<void>;
    onPixelHover?: (pixel: Pixel | null) => void;
}

const PixelOverlayOptimized: React.FC<PixelOverlayProps> = ({
    map,
    pixels,
    zoom,
    mapBounds,
    selectedColor,
    user,
    onPixelPlace,
    onPixelHover
}) => {
    const pixelLayerRef = useRef<L.LayerGroup | null>(null);
    const gridLayerRef = useRef<L.LayerGroup | null>(null);
    const pixelMapRef = useRef<Map<string, L.Rectangle>>(new Map());
    const gridMapRef = useRef<Map<string, L.Rectangle>>(new Map());
    const clickHandlerRef = useRef<L.LeafletEventHandlerFn | null>(null);
    const hoverHandlerRef = useRef<L.LeafletEventHandlerFn | null>(null);

    // Optimisation : créer un map des pixels pour un accès rapide
    const pixelMap = useMemo(() => {
        const map = new Map<string, Pixel>();
        pixels.forEach(pixel => {
            const key = getPixelId(pixel.gridX, pixel.gridY);
            map.set(key, pixel);
        });
        return map;
    }, [pixels]);

    // Vérifier le cooldown utilisateur
    const canPlacePixel = useMemo(() => {
        if (!user?.lastPixelTime) return true;
        const timeSinceLastPixel = Date.now() - user.lastPixelTime.getTime();
        return timeSinceLastPixel >= GRID_CONFIG.COOLDOWN_SECONDS * 1000;
    }, [user?.lastPixelTime]);

    // Calculer le temps restant pour le cooldown
    const getCooldownRemaining = useCallback(() => {
        if (!user?.lastPixelTime) return 0;
        const timeSinceLastPixel = Date.now() - user.lastPixelTime.getTime();
        const cooldownMs = GRID_CONFIG.COOLDOWN_SECONDS * 1000;
        return Math.max(0, cooldownMs - timeSinceLastPixel);
    }, [user?.lastPixelTime]);

    // Gestionnaire de clic pour placer un pixel
    const handleMapClick = useCallback(async (e: L.LeafletMouseEvent) => {
        if (!selectedColor || !user || !onPixelPlace) return;

        // Vérifier le cooldown
        if (!canPlacePixel) {
            const remaining = Math.ceil(getCooldownRemaining() / 1000);
            alert(`Attendez ${remaining} secondes avant de placer un autre pixel !`);
            return;
        }

        // Vérifier si la couleur est autorisée
        const colorType = getColorType(selectedColor);
        if (colorType === 'PREMIUM' && !user.isPremium) {
            alert('Cette couleur nécessite un compte premium !');
            return;
        }

        // Snapper à la grille
        const snapped = snapToGrid(e.latlng.lat, e.latlng.lng);

        // Valider le placement
        const pixelData = {
            gridX: snapped.gridX,
            gridY: snapped.gridY,
            lat: snapped.lat,
            lng: snapped.lng,
            color: selectedColor,
            userId: user.id,
            username: user.username,
            placedAt: new Date()
        };

        const validation = validatePixelPlacement(pixelData);
        if (!validation.valid) {
            alert(`Erreur: ${validation.error}`);
            return;
        }

        try {
            await onPixelPlace(pixelData);
        } catch (error) {
            console.error('Erreur placement pixel:', error);
            alert('Erreur lors du placement du pixel');
        }
    }, [selectedColor, user, onPixelPlace, canPlacePixel, getCooldownRemaining]);

    // Gestionnaire de survol pour afficher les infos
    const handleMouseMove = useCallback((e: L.LeafletMouseEvent) => {
        if (zoom < GRID_CONFIG.ZOOM.MIN_VISIBLE) return;

        const snapped = snapToGrid(e.latlng.lat, e.latlng.lng);
        const pixelKey = getPixelId(snapped.gridX, snapped.gridY);
        const existingPixel = pixelMap.get(pixelKey);

        if (onPixelHover) {
            onPixelHover(existingPixel || null);
        }
    }, [zoom, pixelMap, onPixelHover]);

    // Initialiser les couches
    useEffect(() => {
        if (!map) return;

        // Créer les couches si elles n'existent pas
        if (!pixelLayerRef.current) {
            pixelLayerRef.current = L.layerGroup().addTo(map);
        }
        if (!gridLayerRef.current) {
            gridLayerRef.current = L.layerGroup().addTo(map);
        }

        // Ajouter les gestionnaires d'événements
        if (clickHandlerRef.current) {
            map.off('click', clickHandlerRef.current);
        }
        if (hoverHandlerRef.current) {
            map.off('mousemove', hoverHandlerRef.current);
        }

        clickHandlerRef.current = handleMapClick;
        hoverHandlerRef.current = handleMouseMove;

        map.on('click', clickHandlerRef.current);
        map.on('mousemove', hoverHandlerRef.current);

        // Cleanup
        return () => {
            if (clickHandlerRef.current) {
                map.off('click', clickHandlerRef.current);
            }
            if (hoverHandlerRef.current) {
                map.off('mousemove', hoverHandlerRef.current);
            }
        };
    }, [map, handleMapClick, handleMouseMove]);

    // Rendu principal des pixels et de la grille
    useEffect(() => {
        if (!map || !pixelLayerRef.current || !gridLayerRef.current) return;

        console.log(`🔍 Rendu grille - Zoom: ${zoom}, Pixels: ${pixels.length}`);

        // Ne rien afficher si le zoom est trop faible
        if (zoom < GRID_CONFIG.ZOOM.MIN_VISIBLE) {
            pixelLayerRef.current.clearLayers();
            gridLayerRef.current.clearLayers();
            pixelMapRef.current.clear();
            gridMapRef.current.clear();
            return;
        }

        // Obtenir les positions de grille visibles
        const visibleGridPositions = getVisiblePixels(mapBounds, zoom);
        console.log(`📐 Positions de grille visibles: ${visibleGridPositions.length}`);

        // Optimisation : batch les opérations
        const pixelsToAdd: { pos: GridCoordinates; pixel?: Pixel }[] = [];
        const pixelsToRemove: string[] = [];
        const gridsToAdd: GridCoordinates[] = [];
        const gridsToRemove: string[] = [];

        // Identifier les pixels à ajouter/supprimer
        const currentPixelKeys = new Set(Array.from(pixelMapRef.current.keys()));
        const currentGridKeys = new Set(Array.from(gridMapRef.current.keys()));
        const newPixelKeys = new Set<string>();
        const newGridKeys = new Set<string>();

        visibleGridPositions.forEach(pos => {
            const key = getPixelId(pos.gridX, pos.gridY);
            newPixelKeys.add(key);
            newGridKeys.add(key);

            const existingPixel = pixelMap.get(key);

            if (existingPixel) {
                // Pixel existant
                if (!currentPixelKeys.has(key)) {
                    pixelsToAdd.push({ pos, pixel: existingPixel });
                }
            } else {
                // Case vide - afficher la grille
                if (!currentGridKeys.has(key)) {
                    gridsToAdd.push(pos);
                }
            }
        });

        // Identifier les éléments à supprimer
        currentPixelKeys.forEach(key => {
            if (!newPixelKeys.has(key)) {
                pixelsToRemove.push(key);
            }
        });

        currentGridKeys.forEach(key => {
            if (!newGridKeys.has(key)) {
                gridsToRemove.push(key);
            }
        });

        // Supprimer les anciens éléments
        pixelsToRemove.forEach(key => {
            const rect = pixelMapRef.current.get(key);
            if (rect) {
                pixelLayerRef.current!.removeLayer(rect);
                pixelMapRef.current.delete(key);
            }
        });

        gridsToRemove.forEach(key => {
            const rect = gridMapRef.current.get(key);
            if (rect) {
                gridLayerRef.current!.removeLayer(rect);
                gridMapRef.current.delete(key);
            }
        });

        // Ajouter les nouveaux pixels
        pixelsToAdd.forEach(({ pos, pixel }) => {
            if (!pixel) return;

            const bounds = getPixelBounds(pos.gridX, pos.gridY);
            const pixelBounds = L.latLngBounds(
                [bounds.south, bounds.west],
                [bounds.north, bounds.east]
            );

            const rectangle = L.rectangle(pixelBounds, {
                color: pixel.color,
                fillColor: pixel.color,
                fillOpacity: GRID_CONFIG.PIXEL_OPACITY,
                weight: GRID_CONFIG.PIXEL_BORDER_WIDTH,
                opacity: 1,
                interactive: true
            });

            // Tooltip avec informations du pixel
            rectangle.bindTooltip(`
        <div style="text-align: center; font-size: 12px; min-width: 120px;">
          <strong style="color: ${pixel.color};">Pixel (${pixel.gridX}, ${pixel.gridY})</strong><br/>
          <span style="color: #666;">Par: <strong>${pixel.username}</strong></span><br/>
          <span style="color: #666;">Couleur: <strong>${pixel.color}</strong></span><br/>
          <span style="color: #666;">Placé: ${pixel.placedAt.toLocaleString()}</span>
        </div>
      `, {
                permanent: false,
                direction: 'top',
                offset: [0, -5],
                className: 'pixel-tooltip'
            });

            const key = getPixelId(pos.gridX, pos.gridY);
            pixelLayerRef.current!.addLayer(rectangle);
            pixelMapRef.current.set(key, rectangle);
        });

        // Ajouter les nouvelles grilles (cases vides)
        if (zoom >= GRID_CONFIG.ZOOM.GRID_VISIBLE) {
            gridsToAdd.forEach(pos => {
                const key = getPixelId(pos.gridX, pos.gridY);

                // Ne pas afficher la grille si un pixel existe déjà
                if (pixelMap.has(key)) return;

                const bounds = getPixelBounds(pos.gridX, pos.gridY);
                const gridBounds = L.latLngBounds(
                    [bounds.south, bounds.west],
                    [bounds.north, bounds.east]
                );

                const rectangle = L.rectangle(gridBounds, {
                    color: '#ccc',
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    weight: 1,
                    opacity: GRID_CONFIG.GRID_OPACITY,
                    interactive: false,
                    className: 'grid-cell'
                });

                gridLayerRef.current!.addLayer(rectangle);
                gridMapRef.current.set(key, rectangle);
            });
        }

        console.log(`✅ Rendu terminé - Pixels: ${pixelMapRef.current.size}, Grilles: ${gridMapRef.current.size}`);

    }, [map, pixels, zoom, mapBounds, pixelMap]);

    // Mise à jour du curseur selon l'état
    useEffect(() => {
        if (!map) return;

        const container = map.getContainer();

        if (selectedColor && user && canPlacePixel) {
            container.style.cursor = 'crosshair';
        } else if (selectedColor && user && !canPlacePixel) {
            container.style.cursor = 'wait';
        } else {
            container.style.cursor = '';
        }

        return () => {
            container.style.cursor = '';
        };
    }, [map, selectedColor, user, canPlacePixel]);

    // Cleanup lors du démontage
    useEffect(() => {
        return () => {
            if (pixelLayerRef.current) {
                pixelLayerRef.current.clearLayers();
            }
            if (gridLayerRef.current) {
                gridLayerRef.current.clearLayers();
            }
            pixelMapRef.current.clear();
            gridMapRef.current.clear();
        };
    }, []);

    return null; // Composant sans rendu direct
};

export default PixelOverlayOptimized;