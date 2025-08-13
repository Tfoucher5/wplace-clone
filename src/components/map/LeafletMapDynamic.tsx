'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '@/hooks/useAuth';
import {
  geoToGrid,
  gridToGeo,
  snapToGrid,
  getVisiblePixels,
  getPixelScreenSize,
  canPlacePixelAt,
  GRID_CONFIG
} from '@/lib/gridSystem';

// Fix pour les icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LeafletMapProps {
  onPixelPlaced?: (count: number) => void;
  userId?: number;
  isAuthenticated?: boolean;
}

interface Pixel {
  id: number;
  lat: number;
  lng: number;
  gridX: number;
  gridY: number;
  color: string;
  username: string;
  placedAt: Date;
}

interface PixelLayer extends L.LayerGroup {
  _pixels: Map<string, L.Rectangle>;
}

const LeafletMapDynamic: React.FC<LeafletMapProps> = ({ onPixelPlaced, userId, isAuthenticated: authProp }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const pixelLayerRef = useRef<PixelLayer | null>(null);

  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('#E50000'); // Rouge par défaut au lieu de #FF0000
  const [zoom, setZoom] = useState<number>(3);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [canPlacePixel, setCanPlacePixel] = useState<boolean>(true);
  const [showPanels, setShowPanels] = useState<boolean>(true);
  const [previewPixel, setPreviewPixel] = useState<{ lat: number; lng: number; gridX: number; gridY: number } | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  const { user, isAuthenticated, login, logout } = useAuth();

  // Couleurs disponibles (palette r/place)
  const colors = [
    '#FFFFFF', '#E4E4E4', '#888888', '#222222',
    '#FFA7D1', '#E50000', '#E59500', '#A06A42',
    '#E5D900', '#94E044', '#02BE01', '#00D3DD',
    '#0083C7', '#0000EA', '#CF6EE4', '#820080'
  ];

  // Debug : afficher la couleur sélectionnée
  useEffect(() => {
    console.log('🎨 Couleur sélectionnée changée:', selectedColor);
  }, [selectedColor]);

  // Simulation WebSocket simplifié
  useEffect(() => {
    if (isAuthenticated) {
      console.log('🔌 WebSocket simulé connecté');
      setWsConnected(true);
    } else {
      setWsConnected(false);
    }
  }, [isAuthenticated]);

  // Gestion du cooldown basée sur les données utilisateur
  useEffect(() => {
    if (!isAuthenticated || !user?.lastPixelTime) {
      setCooldownRemaining(0);
      setCanPlacePixel(true);
      return;
    }

    const cooldownDuration = 30 * 1000; // 30 secondes
    const lastPixelTime = new Date(user.lastPixelTime).getTime();
    const now = Date.now();
    const timeRemaining = Math.max(0, cooldownDuration - (now - lastPixelTime));

    if (timeRemaining > 0) {
      setCooldownRemaining(Math.ceil(timeRemaining / 1000));
      setCanPlacePixel(false);

      const interval = setInterval(() => {
        const newTimeRemaining = Math.max(0, cooldownDuration - (Date.now() - lastPixelTime));
        const secondsRemaining = Math.ceil(newTimeRemaining / 1000);

        setCooldownRemaining(secondsRemaining);

        if (secondsRemaining === 0) {
          setCanPlacePixel(true);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setCooldownRemaining(0);
      setCanPlacePixel(true);
    }
  }, [isAuthenticated, user?.lastPixelTime]);

  // Charger les pixels depuis localStorage ET l'API au démarrage
  useEffect(() => {
    // Charger depuis localStorage pour l'affichage immédiat
    if (typeof window !== 'undefined') {
      const savedPixels = localStorage.getItem('wplace_pixels');
      if (savedPixels) {
        try {
          const parsedPixels = JSON.parse(savedPixels).map((p: any) => ({
            ...p,
            placedAt: new Date(p.placedAt)
          }));
          setPixels(parsedPixels);
        } catch (error) {
          console.error('Erreur chargement pixels localStorage:', error);
        }
      }
    }

    // Charger depuis l'API pour avoir les pixels des autres utilisateurs
    const loadPixelsFromAPI = async () => {
      try {
        const response = await fetch('/api/pixels?limit=5000');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.pixels) {
            const apiPixels = data.data.pixels.map((p: any) => ({
              ...p,
              placedAt: new Date(p.placedAt)
            }));
            setPixels(apiPixels);

            // Mettre à jour localStorage avec les données de l'API
            if (typeof window !== 'undefined') {
              localStorage.setItem('wplace_pixels', JSON.stringify(apiPixels));
            }
          }
        }
      } catch (error) {
        console.error('Erreur chargement pixels API:', error);
      }
    };

    loadPixelsFromAPI();
  }, []);

  // Sauvegarder les pixels dans localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && pixels.length >= 0) {
      localStorage.setItem('wplace_pixels', JSON.stringify(pixels));
    }
  }, [pixels]);

  // Créer et mettre à jour la couche de pixels
  const updatePixelLayer = useCallback(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const currentZoom = map.getZoom();

    // Ne pas afficher les pixels si le zoom est trop faible
    if (currentZoom < GRID_CONFIG.MIN_ZOOM_VISIBLE) {
      if (pixelLayerRef.current) {
        map.removeLayer(pixelLayerRef.current);
        pixelLayerRef.current = null;
      }
      return;
    }

    // Créer la couche de pixels si elle n'existe pas
    if (!pixelLayerRef.current) {
      const layer = L.layerGroup();
      const pixelLayer = Object.assign(layer, {
        _pixels: new Map<string, L.Rectangle>()
      }) as PixelLayer;

      pixelLayerRef.current = pixelLayer;
      map.addLayer(pixelLayer);
    }

    const pixelLayer = pixelLayerRef.current;
    const bounds = map.getBounds();

    // Obtenir les pixels visibles dans la zone actuelle
    const visiblePixels = getVisiblePixels({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    }, currentZoom);

    // Nettoyer les pixels qui ne sont plus visibles
    pixelLayer._pixels.forEach((rectangle, key) => {
      const [gridX, gridY] = key.split(',').map(Number);
      const isVisible = visiblePixels.some(p => p.x === gridX && p.y === gridY);

      if (!isVisible) {
        pixelLayer.removeLayer(rectangle);
        pixelLayer._pixels.delete(key);
      }
    });

    // Ajouter les pixels visibles
    visiblePixels.forEach(({ x: gridX, y: gridY }) => {
      const key = `${gridX},${gridY}`;

      if (!pixelLayer._pixels.has(key)) {
        const pixel = pixels.find(p => p.gridX === gridX && p.gridY === gridY);
        const geo = gridToGeo(gridX, gridY);
        const pixelSize = GRID_CONFIG.PIXEL_SIZE_DEGREES;

        // Correction Mercator pour des pixels carrés à l'écran
        const latCorrectionFactor = Math.cos(geo.lat * Math.PI / 180);
        const lngSize = pixelSize / latCorrectionFactor; // Plus étroit en longitude
        const latSize = pixelSize; // Normal en latitude

        const rectBounds = L.latLngBounds([
          [geo.lat - latSize / 2, geo.lng - lngSize / 2],
          [geo.lat + latSize / 2, geo.lng + lngSize / 2]
        ]);

        if (pixel) {
          // Pixel existant - couleur pleine, carré parfait
          const rectangle = L.rectangle(rectBounds, {
            color: pixel.color,
            fillColor: pixel.color,
            fillOpacity: 1,
            weight: 1,
            opacity: 1,
            interactive: true
          });

          // Tooltip pour les pixels existants
          rectangle.bindTooltip(`
            <strong>Pixel (${gridX}, ${gridY})</strong><br/>
            Par: ${pixel.username}<br/>
            Couleur: ${pixel.color}<br/>
            Placé: ${pixel.placedAt.toLocaleString()}
          `, {
            permanent: false,
            direction: 'top'
          });

          pixelLayer.addLayer(rectangle);
          pixelLayer._pixels.set(key, rectangle);
        } else {
          // Grille vide - ajuster avec Mercator pour correspondre aux pixels
          const latCorrectionFactor = Math.cos(geo.lat * Math.PI / 180);
          const lngSize = pixelSize / latCorrectionFactor;
          const latSize = pixelSize;

          // Utiliser la même taille que les pixels pour la grille
          const gridBounds = L.latLngBounds([
            [geo.lat - latSize / 2, geo.lng - lngSize / 2],
            [geo.lat + latSize / 2, geo.lng + lngSize / 2]
          ]);

          const rectangle = L.rectangle(gridBounds, {
            color: 'rgba(200,200,200,0.08)', // Lignes très discrètes
            fillColor: 'transparent', // Pas de fond du tout
            fillOpacity: 0,
            weight: 0.2, // Lignes très fines
            opacity: 0.08,
            interactive: false,
            fill: false // Pas de remplissage
          });

          pixelLayer.addLayer(rectangle);
          pixelLayer._pixels.set(key, rectangle);
        }
      }
    });

  }, [pixels]);

  // Placer un pixel
  const placePixel = useCallback(async (lat: number, lng: number) => {
    if (!isAuthenticated || !canPlacePixel) {
      console.log('❌ Cannot place pixel:', { isAuthenticated, canPlacePixel });
      return;
    }

    // Snap à la grille
    const snapped = snapToGrid(lat, lng);

    // CAPTURE la couleur au moment du clic pour éviter les problèmes de closure
    const currentColor = selectedColor;

    console.log('🎯 Placement pixel:', {
      position: [snapped.gridX, snapped.gridY],
      couleur: currentColor,
      coords: [snapped.lat.toFixed(6), snapped.lng.toFixed(6)]
    });

    const newPixel: Pixel = {
      id: Date.now(),
      lat: snapped.lat,
      lng: snapped.lng,
      gridX: snapped.gridX,
      gridY: snapped.gridY,
      color: currentColor, // Utiliser la couleur capturée
      username: user?.username || 'Anonyme',
      placedAt: new Date()
    };

    try {
      // Optimistic update avec forçage immédiat de re-rendu
      setPixels(prev => {
        const filtered = prev.filter(p => !(p.gridX === newPixel.gridX && p.gridY === newPixel.gridY));
        return [...filtered, newPixel];
      });

      // Forcer la mise à jour de la couche IMMÉDIATEMENT
      setTimeout(() => {
        if (pixelLayerRef.current && mapInstanceRef.current) {
          const map = mapInstanceRef.current;
          const key = `${newPixel.gridX},${newPixel.gridY}`;

          // Supprimer l'ancien rectangle de grille vide s'il existe
          const existingRect = pixelLayerRef.current._pixels.get(key);
          if (existingRect) {
            pixelLayerRef.current.removeLayer(existingRect);
          }

          // Créer immédiatement le nouveau pixel carré visuellement
          const geo = gridToGeo(newPixel.gridX, newPixel.gridY);
          const pixelSize = GRID_CONFIG.PIXEL_SIZE_DEGREES;

          // Correction Mercator pour pixels carrés à l'écran
          const latCorrectionFactor = Math.cos(geo.lat * Math.PI / 180);
          const lngSize = pixelSize / latCorrectionFactor;
          const latSize = pixelSize;

          const rectBounds = L.latLngBounds([
            [geo.lat - latSize / 2, geo.lng - lngSize / 2],
            [geo.lat + latSize / 2, geo.lng + lngSize / 2]
          ]);

          const rectangle = L.rectangle(rectBounds, {
            color: newPixel.color,
            fillColor: newPixel.color,
            fillOpacity: 1,
            weight: 1,
            opacity: 1,
            interactive: true
          });

          rectangle.bindTooltip(`
            <strong>Pixel (${newPixel.gridX}, ${newPixel.gridY})</strong><br/>
            Par: ${newPixel.username}<br/>
            Couleur: ${newPixel.color}<br/>
            Placé: ${newPixel.placedAt.toLocaleString()}
          `, {
            permanent: false,
            direction: 'top'
          });

          pixelLayerRef.current.addLayer(rectangle);
          pixelLayerRef.current._pixels.set(key, rectangle);
        }
      }, 1);

      // Appeler l'API pour persister en base de données
      const response = await fetch('/api/pixels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('wplace_auth_token')}`
        },
        body: JSON.stringify({
          lat: newPixel.lat,
          lng: newPixel.lng,
          gridX: newPixel.gridX,
          gridY: newPixel.gridY,
          color: newPixel.color // Utiliser la couleur du pixel créé
        })
      });

      if (!response.ok) {
        throw new Error('Erreur sauvegarde pixel en base');
      }

      const result = await response.json();
      console.log('✅ Pixel sauvegardé en base:', result);

      if (onPixelPlaced) {
        onPixelPlaced((user?.pixelsPlaced || 0) + 1);
      }

    } catch (error) {
      console.error('❌ Erreur placement pixel:', error);

      // Rollback en cas d'erreur
      setPixels(prev => prev.filter(p => !(p.gridX === newPixel.gridX && p.gridY === newPixel.gridY)));

      // Remettre la grille vide
      setTimeout(() => {
        updatePixelLayer();
      }, 10);

      alert('Erreur lors du placement du pixel. Veuillez réessayer.');
    }
  }, [isAuthenticated, canPlacePixel, selectedColor, user, onPixelPlaced, updatePixelLayer]);

  // Mettre à jour les pixels quand ils changent
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      updatePixelLayer();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [pixels, zoom, updatePixelLayer]);

  // Initialiser la carte
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      pixelLayerRef.current = null;
    }

    console.log('🗺️ Initialisation de la carte...');

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 3,
      zoomControl: true,
      attributionControl: false,
      worldCopyJump: true,
      minZoom: 2,
      maxZoom: 18,
      preferCanvas: true,
      maxBounds: [[-85, -Infinity], [85, Infinity]],
      maxBoundsViscosity: 1.0
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      noWrap: false,
      maxZoom: 18,
      opacity: 0.7
    }).addTo(map);

    mapInstanceRef.current = map;

    // Événements
    map.on('zoomend moveend', () => {
      const currentZoom = map.getZoom();
      setZoom(currentZoom);
      setTimeout(() => {
        updatePixelLayer();
      }, 150);
    });

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (map.getZoom() >= GRID_CONFIG.MIN_ZOOM_VISIBLE) {
        const snapped = snapToGrid(e.latlng.lat, e.latlng.lng);
        setPreviewPixel(snapped);
      } else {
        setPreviewPixel(null);
      }
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      // Debug du clic pour vérifier l'alignement
      const snapped = snapToGrid(e.latlng.lat, e.latlng.lng);
      console.log('🖱️ Clic carte:', {
        original: [e.latlng.lat.toFixed(6), e.latlng.lng.toFixed(6)],
        snapped: [snapped.lat.toFixed(6), snapped.lng.toFixed(6)],
        grid: [snapped.gridX, snapped.gridY],
        zoom: map.getZoom(),
        auth: isAuthenticated,
        canPlace: canPlacePixel
      });

      if (isAuthenticated && canPlacePixel && map.getZoom() >= GRID_CONFIG.MIN_ZOOM_VISIBLE) {
        placePixel(e.latlng.lat, e.latlng.lng);
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        pixelLayerRef.current = null;
      }
    };
  }, []);

  // Preview du pixel au survol
  useEffect(() => {
    if (!mapInstanceRef.current || !previewPixel || !isAuthenticated) return;

    const map = mapInstanceRef.current;
    const existing = pixels.find(p => p.gridX === previewPixel.gridX && p.gridY === previewPixel.gridY);

    if (existing) return;

    const pixelSize = GRID_CONFIG.PIXEL_SIZE_DEGREES;

    // Preview carré visuellement (correction Mercator)
    const latCorrectionFactor = Math.cos(previewPixel.lat * Math.PI / 180);
    const lngSize = pixelSize / latCorrectionFactor;
    const latSize = pixelSize;

    const bounds = L.latLngBounds([
      [previewPixel.lat - latSize / 2, previewPixel.lng - lngSize / 2],
      [previewPixel.lat + latSize / 2, previewPixel.lng + lngSize / 2]
    ]);

    const previewRect = L.rectangle(bounds, {
      color: selectedColor,
      fillColor: selectedColor,
      fillOpacity: 0.6,
      weight: 2,
      opacity: 0.8,
      dashArray: '3, 3',
      interactive: false
    });

    previewRect.addTo(map);

    return () => {
      try {
        map.removeLayer(previewRect);
      } catch (e) {
        // Ignore les erreurs
      }
    };
  }, [previewPixel, selectedColor, pixels, isAuthenticated]);

  // Authentification simple
  const handleLogin = () => {
    const username = prompt('Nom d\'utilisateur:');
    if (username) {
      login(username, 'demo');
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Conteneur carte */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          cursor: isAuthenticated && canPlacePixel && zoom >= GRID_CONFIG.MIN_ZOOM_VISIBLE ? 'crosshair' : 'default'
        }}
      />

      {/* Toggle panneaux */}
      <button
        onClick={() => setShowPanels(!showPanels)}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          padding: '8px 12px',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '12px'
        }}
      >
        {showPanels ? '👁️ Masquer UI' : '⚙️ Afficher UI'}
      </button>

      {showPanels && (
        <>
          {/* Panneau d'authentification */}
          <div style={{
            position: 'absolute',
            top: '60px',
            right: '10px',
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.9)',
            padding: '16px',
            borderRadius: '10px',
            color: 'white',
            fontSize: '14px',
            minWidth: '200px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#60a5fa' }}>
              🔐 Authentification
            </div>

            {isAuthenticated ? (
              <div>
                <div style={{ color: '#10b981', marginBottom: '8px' }}>
                  ✅ Connecté: <strong>{user?.username}</strong>
                </div>
                <div style={{ fontSize: '12px', marginBottom: '8px', color: '#94a3b8' }}>
                  Pixels placés: {user?.pixelsPlaced || 0}
                </div>
                <div style={{ fontSize: '12px', marginBottom: '12px', color: '#94a3b8' }}>
                  WebSocket: {wsConnected ? '🟢 Connecté' : '🔴 Déconnecté'}
                </div>
                <button
                  onClick={() => logout()}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Se déconnecter
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '12px', color: '#fbbf24' }}>
                  ⚠️ Non connecté
                </div>
                <button
                  onClick={handleLogin}
                  style={{
                    width: '100%',
                    padding: '8px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Se connecter
                </button>
              </div>
            )}
          </div>

          {/* Palette de couleurs */}
          {isAuthenticated && (
            <div style={{
              position: 'absolute',
              top: '60px',
              left: '10px',
              zIndex: 1000,
              backgroundColor: 'rgba(0,0,0,0.9)',
              padding: '16px',
              borderRadius: '10px',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '12px', color: '#f59e0b' }}>
                🎨 Couleurs
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '4px',
                marginBottom: '12px'
              }}>
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      console.log('🎨 Clic couleur:', color);
                      setSelectedColor(color);
                    }}
                    style={{
                      width: '24px',
                      height: '24px',
                      backgroundColor: color,
                      border: selectedColor === color ? '3px solid #60a5fa' : '1px solid #444',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      boxShadow: selectedColor === color ? '0 0 8px rgba(96, 165, 250, 0.5)' : 'none',
                      transition: 'all 0.2s'
                    }}
                    title={`Couleur: ${color}`}
                  />
                ))}
              </div>

              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                Sélectionné: <span style={{
                  color: selectedColor,
                  fontWeight: 'bold',
                  textShadow: selectedColor === '#222222' || selectedColor === '#888888' ? '0 0 2px white' : 'none'
                }}>
                  {selectedColor}
                </span>
              </div>
            </div>
          )}

          {/* Panneau de contrôle */}
          <div style={{
            position: 'absolute',
            bottom: '20px',
            left: '10px',
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.9)',
            padding: '16px',
            borderRadius: '10px',
            color: 'white',
            fontSize: '12px',
            maxWidth: '300px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#22d3ee' }}>
              🌍 WorldPlace - Status
            </div>

            <div style={{ lineHeight: '1.4', marginBottom: '12px' }}>
              <div>🔍 Zoom: <strong>{zoom}</strong> {zoom < GRID_CONFIG.MIN_ZOOM_VISIBLE ? '(trop faible pour pixels)' : ''}</div>
              <div>📊 Pixels affichés: <strong>{pixels.length}</strong></div>
              <div>⏱️ Cooldown: {cooldownRemaining > 0 ? `🔴 ${cooldownRemaining}s` : '🟢 Prêt'}</div>
              <div>🎯 Placement: {isAuthenticated && canPlacePixel && zoom >= GRID_CONFIG.MIN_ZOOM_VISIBLE ? '🟢 Actif' : '🔴 Inactif'}</div>
            </div>

            {previewPixel && (
              <div style={{
                padding: '8px',
                backgroundColor: 'rgba(96, 165, 250, 0.2)',
                borderRadius: '6px',
                marginBottom: '8px',
                border: '1px solid rgba(96, 165, 250, 0.3)'
              }}>
                <div style={{ fontWeight: 'bold', color: '#60a5fa' }}>🎯 Preview:</div>
                <div>Grid: ({previewPixel.gridX}, {previewPixel.gridY})</div>
                <div>Coord: ({previewPixel.lat.toFixed(6)}, {previewPixel.lng.toFixed(6)})</div>
              </div>
            )}

            <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
              💡 Zoomez à {GRID_CONFIG.MIN_ZOOM_VISIBLE}+ pour voir et placer des pixels
            </div>
          </div>
        </>
      )}

      {/* Message de connexion pour utilisateurs non authentifiés */}
      {!isAuthenticated && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0,0,0,0.9)',
          color: '#fbbf24',
          padding: '16px 24px',
          borderRadius: '10px',
          zIndex: 1000,
          border: '1px solid rgba(251, 191, 36, 0.5)',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        }}>
          🔐 Connectez-vous pour participer au WorldPlace !
        </div>
      )}
    </div>
  );
};

export default LeafletMapDynamic;