'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix pour les icônes Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface LeafletMapProps {
  userId?: number;
  isAuthenticated: boolean;
  onPixelPlaced?: (count: number) => void;
}

interface Pixel {
  id: number;
  lat: number;
  lng: number;
  color: string;
  username: string;
  placedAt: Date;
}

const LeafletMapDynamic: React.FC<LeafletMapProps> = ({ userId, isAuthenticated, onPixelPlaced }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('#FF0000');
  const [zoom, setZoom] = useState<number>(3);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [canPlacePixel, setCanPlacePixel] = useState<boolean>(true);
  const [showPanels, setShowPanels] = useState<boolean>(true);

  // Couleurs disponibles
  const colors = [
    '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
    '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#FFC0CB', '#A52A2A', '#808080', '#000000',
    '#FFFFFF', '#90EE90', '#FFB6C1', '#20B2AA'
  ];

  // Charger les pixels sauvegardés
  useEffect(() => {
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
          console.error('Erreur chargement pixels:', error);
        }
      }
    }
  }, []);

  // Sauvegarder les pixels
  useEffect(() => {
    if (typeof window !== 'undefined' && pixels.length >= 0) {
      localStorage.setItem('wplace_pixels', JSON.stringify(pixels));
    }
  }, [pixels]);

  // Initialiser la carte
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Supprimer la carte existante si elle existe
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    console.log('🗺️ Initialisation de la carte...');

    try {
      // Créer la carte avec limites strictes
      const map = L.map(mapContainerRef.current, {
        center: [20, 0], // Centre du monde
        zoom: 3,
        zoomControl: true,
        attributionControl: false,
        worldCopyJump: true, // Réplication horizontale
        minZoom: 2,
        maxZoom: 18,
        preferCanvas: true, // Meilleure performance
        // Limites strictes - Pôles Nord/Sud, longitude infinie
        maxBounds: [[-85, -Infinity], [85, Infinity]],
        maxBoundsViscosity: 1.0 // Résistance maximale
      });

      // Ajouter les tuiles avec réplication horizontale
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        noWrap: false, // Permet la réplication horizontale
        maxZoom: 18
      }).addTo(map);

      // Gestion du zoom avec mise à jour état
      map.on('zoomend', () => {
        const currentZoom = map.getZoom();
        setZoom(currentZoom);
        console.log('📏 Zoom changé:', currentZoom);
      });

      // Gestion des clics avec debug
      map.on('click', (e: L.LeafletMouseEvent) => {
        console.log('🖱️ Clic détecté:', {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          isAuthenticated,
          canPlacePixel,
          zoom: map.getZoom()
        });

        if (isAuthenticated && canPlacePixel) {
          placePixel(e.latlng.lat, e.latlng.lng);
        } else {
          if (!isAuthenticated) {
            console.log('❌ Non authentifié');
            alert('Connectez-vous pour placer des pixels !');
          } else if (!canPlacePixel) {
            console.log('⏱️ Cooldown actif');
            alert(`Attendez encore ${Math.ceil(cooldownRemaining / 1000)} secondes`);
          }
        }
      });

      // Restaurer les pixels existants
      pixels.forEach(pixel => {
        addPixelToMap(map, pixel);
      });

      mapInstanceRef.current = map;

      // Forcer le redimensionnement
      setTimeout(() => {
        map.invalidateSize();
      }, 100);

      console.log('✅ Carte initialisée avec', pixels.length, 'pixels');

    } catch (error) {
      console.error('❌ Erreur initialisation carte:', error);
    }

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        console.log('🧹 Nettoyage carte');
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Une seule fois

  // Redimensionner quand le container change
  useEffect(() => {
    const handleResize = () => {
      if (mapInstanceRef.current) {
        setTimeout(() => {
          mapInstanceRef.current?.invalidateSize();
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Ajouter un pixel à la carte
  const addPixelToMap = (map: L.Map, pixel: Pixel) => {
    const marker = L.circleMarker([pixel.lat, pixel.lng], {
      color: pixel.color,
      fillColor: pixel.color,
      fillOpacity: 0.8,
      radius: 5,
      weight: 2,
      stroke: true
    }).addTo(map);

    marker.bindTooltip(`
      <div style="text-align: center;">
        <strong style="color: ${pixel.color};">${pixel.color}</strong><br/>
        Par: <strong>${pixel.username}</strong><br/>
        <small>${pixel.placedAt.toLocaleString()}</small>
      </div>
    `, {
      direction: 'top',
      offset: [0, -10]
    });

    return marker;
  };

  // Placer un pixel
  const placePixel = (lat: number, lng: number) => {
    if (!isAuthenticated || !canPlacePixel || !userId || !mapInstanceRef.current) {
      return;
    }

    // Récupérer le nom d'utilisateur
    const currentUserData = localStorage.getItem('wplace_current_user');
    const username = currentUserData ? JSON.parse(currentUserData).user.username : 'Anonyme';

    console.log(`🎨 Pixel placé par ${username} à: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);

    const newPixel: Pixel = {
      id: Date.now(),
      lat: parseFloat(lat.toFixed(6)), // Limiter la précision
      lng: parseFloat(lng.toFixed(6)),
      color: selectedColor,
      username,
      placedAt: new Date()
    };

    // Ajouter à la liste
    setPixels(prev => {
      const newPixels = [...prev, newPixel];
      onPixelPlaced?.(newPixels.length);
      return newPixels;
    });

    // Ajouter à la carte avec animation
    const marker = addPixelToMap(mapInstanceRef.current, newPixel);

    // Animation du nouveau pixel
    setTimeout(() => {
      marker.setStyle({ radius: 8 });
      setTimeout(() => marker.setStyle({ radius: 5 }), 300);
    }, 50);

    // Démarrer le cooldown
    setCanPlacePixel(false);
    setCooldownRemaining(30000);
  };

  // Effet cooldown
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => {
        setCooldownRemaining(prev => {
          const newTime = prev - 1000;
          if (newTime <= 0) {
            setCanPlacePixel(true);
            return 0;
          }
          return newTime;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownRemaining]);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    }}>
      {/* Container de la carte - FULL SIZE */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Bouton masquer/afficher - Position ajustée pour ne pas chevaucher le header */}
      <button
        onClick={() => setShowPanels(!showPanels)}
        style={{
          position: 'absolute',
          top: '70px', // Décalé sous le header (header ~60px + marge)
          right: '12px',
          zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 14px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 'bold',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}
      >
        {showPanels ? '✕' : '⚙️'}
      </button>

      {/* Interface utilisateur - Position ajustée */}
      {showPanels && (
        <div style={{
          position: 'absolute',
          top: '70px', // Décalé sous le header
          left: '12px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxHeight: 'calc(100% - 82px)', // Ajuster pour le décalage
          overflowY: 'auto',
          maxWidth: '280px'
        }}>

          {/* Sélecteur de couleur */}
          <div style={{
            backgroundColor: 'rgba(0,0,0,0.9)',
            padding: '14px',
            borderRadius: '10px',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{
              margin: '0 0 10px 0',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🎨 Couleur
              <div style={{
                width: '18px',
                height: '18px',
                backgroundColor: selectedColor,
                border: '2px solid white',
                borderRadius: '4px'
              }}></div>
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '6px',
              marginBottom: '10px'
            }}>
              {colors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: color,
                    border: selectedColor === color ? '3px solid #3b82f6' : '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)'
                  }}
                  title={color}
                />
              ))}
            </div>

            <div style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#ccc',
              textAlign: 'center',
              backgroundColor: 'rgba(255,255,255,0.1)',
              padding: '4px',
              borderRadius: '4px'
            }}>
              {selectedColor}
            </div>
          </div>

          {/* Statistiques */}
          <div style={{
            backgroundColor: 'rgba(0,0,0,0.9)',
            padding: '14px',
            borderRadius: '10px',
            color: 'white',
            fontSize: '13px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>
              📊 Statistiques
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Zoom:</span> <strong style={{ color: '#3b82f6' }}>{zoom}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pixels:</span> <strong style={{ color: '#10b981' }}>{pixels.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Connecté:</span> <strong style={{ color: isAuthenticated ? '#10b981' : '#ef4444' }}>{isAuthenticated ? '✅ Oui' : '❌ Non'}</strong>
              </div>
              {isAuthenticated && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Utilisateur:</span> <strong style={{ color: '#8b5cf6' }}>
                    {(() => {
                      const userData = typeof window !== 'undefined' ? localStorage.getItem('wplace_current_user') : null;
                      return userData ? JSON.parse(userData).user.username : 'Inconnu';
                    })()}
                  </strong>
                </div>
              )}
            </div>

            {cooldownRemaining > 0 ? (
              <div style={{
                marginTop: '10px',
                padding: '8px',
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                borderRadius: '6px',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ color: '#fbbf24', fontSize: '12px', fontWeight: 'bold' }}>
                  ⏱️ Cooldown: {Math.ceil(cooldownRemaining / 1000)}s
                </div>
                <div style={{
                  width: '100%',
                  height: '4px',
                  backgroundColor: 'rgba(251, 191, 36, 0.3)',
                  borderRadius: '2px',
                  marginTop: '5px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${100 - (cooldownRemaining / 30000) * 100}%`,
                    height: '100%',
                    backgroundColor: '#fbbf24',
                    transition: 'width 1s linear'
                  }}></div>
                </div>
              </div>
            ) : (
              <div style={{
                marginTop: '10px',
                padding: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '6px',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                ✅ Prêt à placer !
              </div>
            )}
          </div>

          {/* Instructions */}
          <div style={{
            backgroundColor: 'rgba(0,0,0,0.9)',
            padding: '12px',
            borderRadius: '10px',
            color: 'white',
            fontSize: '11px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>📋 Comment jouer:</div>
            <div style={{ lineHeight: '1.4' }}>
              1. 🎨 Choisir une couleur<br />
              2. {isAuthenticated ? '🖱️ Cliquer sur la carte' : '🔐 Se connecter'}<br />
              3. ⏱️ Attendre 30 secondes<br />
              4. 🌍 Défiler horizontalement = monde infini !
            </div>
          </div>

          {/* Debug et grille de pixels */}
          <div style={{
            backgroundColor: 'rgba(0,0,0,0.9)',
            padding: '12px',
            borderRadius: '10px',
            color: 'white',
            fontSize: '11px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>🔧 Debug & Grille:</div>
            <div style={{ lineHeight: '1.4' }}>
              • Status: {isAuthenticated ? '🟢 Connecté' : '🔴 Déconnecté'}<br />
              • Cooldown: {cooldownRemaining > 0 ? '🔴 Actif' : '🟢 Prêt'}<br />
              • Zoom actuel: <strong>{zoom}</strong><br />
              • Clic pour placer: {isAuthenticated && canPlacePixel ? '🟢 OK' : '🔴 Non'}
            </div>

            {/* Grille de test */}
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>🎯 Test rapide:</div>
              <button
                onClick={() => {
                  if (mapInstanceRef.current && isAuthenticated) {
                    const center = mapInstanceRef.current.getCenter();
                    placePixel(center.lat, center.lng);
                  } else {
                    alert('Connectez-vous d\'abord !');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: isAuthenticated ? '#10b981' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '10px',
                  cursor: 'pointer'
                }}
                disabled={!isAuthenticated || !canPlacePixel}
              >
                {isAuthenticated ? 'Placer pixel ici' : 'Se connecter d\'abord'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message de connexion */}
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
          🔐 Connectez-vous pour placer des pixels
        </div>
      )}
    </div>
  );
};

export default LeafletMapDynamic;