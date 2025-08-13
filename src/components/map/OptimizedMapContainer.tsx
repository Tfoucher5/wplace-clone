// src/components/map/OptimizedMapContainer.tsx - Composant principal de carte optimisé

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import io, { Socket } from 'socket.io-client';
import { GRID_CONFIG } from '@/lib/gridConfig';
import {
    type Pixel,
    type Bounds,
    getVisibleChunks,
    snapToGrid
} from '@/lib/pixelGridSystem';
import ColorPalette from './ColorPalette';

// Import dynamique de Leaflet pour éviter les erreurs SSR
const LeafletMap = dynamic(() => import('./LeafletMapContainer'), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Chargement de la carte...</p>
            </div>
        </div>
    )
});

interface OptimizedMapContainerProps {
    className?: string;
    user?: {
        id: number;
        username: string;
        email: string;
        isPremium: boolean;
        pixelsPlaced: number;
        lastPixelTime?: Date;
    };
    onUserUpdate?: (user: any) => void;
}

interface ServerStats {
    connectedUsers: number;
    totalPixelsPlaced: number;
    serverUptime: number;
    chunksActive: number;
    authenticatedUsers?: number;
}

interface HoveredPixelInfo {
    gridX: number;
    gridY: number;
    lat: number;
    lng: number;
    pixel?: Pixel;
}

const OptimizedMapContainer: React.FC<OptimizedMapContainerProps> = ({
    className = '',
    user,
    onUserUpdate
}) => {
    // État de la carte
    const [map, setMap] = useState<L.Map | null>(null);
    const [zoom, setZoom] = useState(16);
    const [mapBounds, setMapBounds] = useState<Bounds>({
        north: 48.8566,
        south: 48.8566,
        east: 2.3522,
        west: 2.3522
    });

    // État des pixels
    const [pixels, setPixels] = useState<Pixel[]>([]);
    const [selectedColor, setSelectedColor] = useState<string>('#FF0000');
    const [hoveredPixel, setHoveredPixel] = useState<HoveredPixelInfo | null>(null);
    const [isPlacing, setIsPlacing] = useState(false);

    // État WebSocket
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [serverStats, setServerStats] = useState<ServerStats>({
        connectedUsers: 0,
        totalPixelsPlaced: 0,
        serverUptime: 0,
        chunksActive: 0
    });

    // État UI
    const [showColorPalette, setShowColorPalette] = useState(true);
    const [showStats, setShowStats] = useState(true);
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [lastPixelTime, setLastPixelTime] = useState<Date | undefined>(user?.lastPixelTime);

    // Refs
    const pixelsRef = useRef<Pixel[]>([]);
    const subscriptionBoundsRef = useRef<Bounds | null>(null);
    const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Mettre à jour la ref des pixels
    useEffect(() => {
        pixelsRef.current = pixels;
    }, [pixels]);

    // Initialisation WebSocket
    useEffect(() => {
        const socketInstance = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000', {
            auth: {
                token: user ? localStorage.getItem('wplace_auth_token') : undefined
            },
            transports: ['websocket', 'polling']
        });

        socketInstance.on('connect', () => {
            console.log('✅ WebSocket connecté');
            setIsConnected(true);
            setSocket(socketInstance);
        });

        socketInstance.on('disconnect', () => {
            console.log('❌ WebSocket déconnecté');
            setIsConnected(false);
        });

        socketInstance.on('server:stats', (stats: ServerStats) => {
            setServerStats(stats);
        });

        socketInstance.on('pixel:placed', (data: { pixel: Pixel; user: any }) => {
            console.log('🎨 Nouveau pixel reçu:', data);

            setPixels(prev => {
                const filtered = prev.filter(p =>
                    !(p.gridX === data.pixel.gridX && p.gridY === data.pixel.gridY)
                );
                return [...filtered, data.pixel];
            });
        });

        socketInstance.on('pixel:confirmed', (data: { pixel: Pixel; timestamp: string }) => {
            console.log('✅ Pixel confirmé:', data);
            setIsPlacing(false);
        });

        socketInstance.on('pixels:data', (data: { pixels: Pixel[]; bounds: Bounds; count: number }) => {
            console.log(`📥 Pixels reçus: ${data.count} pixels`);
            setPixels(data.pixels);
        });

        socketInstance.on('chunks:subscribed', (data: { chunks: string[]; count: number }) => {
            console.log(`📡 Abonné à ${data.count} chunks`);
        });

        socketInstance.on('error', (error: { message: string }) => {
            console.error('❌ Erreur WebSocket:', error);
            alert(`Erreur: ${error.message}`);
            setIsPlacing(false);
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, [user]);

    // Gestion du cooldown
    useEffect(() => {
        const updateCooldown = () => {
            if (!lastPixelTime) {
                setCooldownRemaining(0);
                return;
            }

            const timeSinceLastPixel = Date.now() - lastPixelTime.getTime();
            const cooldownMs = GRID_CONFIG.COOLDOWN_SECONDS * 1000;
            const remaining = Math.max(0, cooldownMs - timeSinceLastPixel);

            setCooldownRemaining(Math.ceil(remaining / 1000));

            if (remaining <= 0 && cooldownIntervalRef.current) {
                clearInterval(cooldownIntervalRef.current);
                cooldownIntervalRef.current = null;
            }
        };

        if (lastPixelTime) {
            updateCooldown();
            cooldownIntervalRef.current = setInterval(updateCooldown, 1000);
        }

        return () => {
            if (cooldownIntervalRef.current) {
                clearInterval(cooldownIntervalRef.current);
            }
        };
    }, [lastPixelTime]);

    // Abonnement aux chunks visibles
    const subscribeToVisibleChunks = useCallback((bounds: Bounds, currentZoom: number) => {
        if (!socket || !isConnected) return;

        // Éviter les abonnements redondants
        if (subscriptionBoundsRef.current) {
            const diff = {
                north: Math.abs(bounds.north - subscriptionBoundsRef.current.north),
                south: Math.abs(bounds.south - subscriptionBoundsRef.current.south),
                east: Math.abs(bounds.east - subscriptionBoundsRef.current.east),
                west: Math.abs(bounds.west - subscriptionBoundsRef.current.west)
            };

            // Si le changement est minime, ne pas réabonner
            if (diff.north < 0.001 && diff.south < 0.001 && diff.east < 0.001 && diff.west < 0.001) {
                return;
            }
        }

        subscriptionBoundsRef.current = bounds;

        // S'abonner aux chunks
        socket.emit('subscribe:chunks', { bounds, zoom: currentZoom });

        // Demander les pixels existants
        socket.emit('pixels:request', { bounds, limit: GRID_CONFIG.MAX_PIXELS_PER_REQUEST });
    }, [socket, isConnected]);

    // Gestionnaire de mouvement/zoom de la carte
    const handleMapChange = useCallback((newBounds: Bounds, newZoom: number) => {
        setMapBounds(newBounds);
        setZoom(newZoom);

        // S'abonner aux nouveaux chunks visibles avec debounce
        const timeoutId = setTimeout(() => {
            subscribeToVisibleChunks(newBounds, newZoom);
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [subscribeToVisibleChunks]);

    // Gestionnaire de placement de pixel
    const handlePixelPlace = useCallback(async (pixelData: Omit<Pixel, 'id'>) => {
        if (!socket || !isConnected || !user || isPlacing) return;

        // Vérifier le cooldown
        if (cooldownRemaining > 0) {
            alert(`Attendez ${cooldownRemaining} secondes avant de placer un autre pixel !`);
            return;
        }

        setIsPlacing(true);

        try {
            // Appeler l'API REST pour la persistance
            const response = await fetch('/api/pixels', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('wplace_auth_token')}`
                },
                body: JSON.stringify({
                    lat: pixelData.lat,
                    lng: pixelData.lng,
                    gridX: pixelData.gridX,
                    gridY: pixelData.gridY,
                    color: pixelData.color
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Erreur serveur');
            }

            const result = await response.json();

            // Mettre à jour l'état utilisateur
            if (result.data.user && onUserUpdate) {
                onUserUpdate({
                    ...user,
                    pixelsPlaced: result.data.user.pixelsPlaced,
                    lastPixelTime: new Date(result.data.user.lastPixelTime)
                });
            }

            setLastPixelTime(new Date());

            // Émettre via WebSocket pour la synchronisation temps réel
            socket.emit('pixel:place', {
                pixel: result.data.pixel,
                user: result.data.user
            });

            console.log('✅ Pixel placé avec succès');

        } catch (error) {
            console.error('❌ Erreur placement pixel:', error);
            alert(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
            setIsPlacing(false);
        }
    }, [socket, isConnected, user, isPlacing, cooldownRemaining, onUserUpdate]);

    // Gestionnaire de survol
    const handlePixelHover = useCallback((pixel: Pixel | null) => {
        if (pixel) {
            setHoveredPixel({
                gridX: pixel.gridX,
                gridY: pixel.gridY,
                lat: pixel.lat,
                lng: pixel.lng,
                pixel
            });
        } else {
            setHoveredPixel(null);
        }
    }, []);

    // Calculer si l'utilisateur peut placer un pixel
    const canPlacePixel = useMemo(() => {
        return user && isConnected && cooldownRemaining === 0 && !isPlacing;
    }, [user, isConnected, cooldownRemaining, isPlacing]);

    // Formatage du temps de serveur
    const formatUptime = (ms: number) => {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}j ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        return `${minutes}m ${seconds % 60}s`;
    };

    return (
        <div className={`relative w-full h-full ${className}`}>
            {/* Carte principale */}
            <div className="absolute inset-0">
                <LeafletMap
                    onMapReady={setMap}
                    onMapChange={handleMapChange}
                    pixels={pixels}
                    selectedColor={selectedColor}
                    user={user}
                    onPixelPlace={handlePixelPlace}
                    onPixelHover={handlePixelHover}
                    zoom={zoom}
                    mapBounds={mapBounds}
                />
            </div>

            {/* Interface utilisateur */}
            <div className="absolute top-4 left-4 z-[1000] space-y-4">
                {/* Palette de couleurs */}
                {showColorPalette && (
                    <div className="w-80">
                        <ColorPalette
                            selectedColor={selectedColor}
                            onColorSelect={setSelectedColor}
                            user={user}
                        />
                    </div>
                )}

                {/* Bouton pour masquer/afficher la palette */}
                <button
                    onClick={() => setShowColorPalette(!showColorPalette)}
                    className="bg-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                    {showColorPalette ? '🎨 Masquer' : '🎨 Couleurs'}
                </button>
            </div>

            {/* Panneau d'informations */}
            <div className="absolute top-4 right-4 z-[1000] space-y-4">
                {/* Statistiques du serveur */}
                {showStats && (
                    <div className="bg-white rounded-lg shadow-lg p-4 min-w-64">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-800">Serveur</h3>
                            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        </div>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Connectés:</span>
                                <span className="font-medium">{serverStats.connectedUsers}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Pixels totaux:</span>
                                <span className="font-medium">{serverStats.totalPixelsPlaced.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Chunks actifs:</span>
                                <span className="font-medium">{serverStats.chunksActive}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Uptime:</span>
                                <span className="font-medium">{formatUptime(serverStats.serverUptime)}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Informations utilisateur */}
                {user && (
                    <div className="bg-white rounded-lg shadow-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-3">
                            {user.username} {user.isPremium && '👑'}
                        </h3>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Pixels placés:</span>
                                <span className="font-medium">{user.pixelsPlaced}</span>
                            </div>

                            {cooldownRemaining > 0 ? (
                                <div className="bg-orange-100 border border-orange-300 rounded p-2 text-center">
                                    <div className="text-orange-800 font-medium">
                                        Cooldown: {cooldownRemaining}s
                                    </div>
                                </div>
                            ) : canPlacePixel ? (
                                <div className="bg-green-100 border border-green-300 rounded p-2 text-center">
                                    <div className="text-green-800 font-medium">
                                        ✓ Prêt à placer
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-100 border border-gray-300 rounded p-2 text-center">
                                    <div className="text-gray-600">
                                        {isPlacing ? 'Placement...' : 'Non connecté'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Informations pixel survolé */}
                {hoveredPixel && (
                    <div className="bg-white rounded-lg shadow-lg p-4">
                        <h3 className="font-semibold text-gray-800 mb-3">Pixel survolé</h3>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Position:</span>
                                <span className="font-medium">({hoveredPixel.gridX}, {hoveredPixel.gridY})</span>
                            </div>

                            {hoveredPixel.pixel ? (
                                <>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600">Couleur:</span>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-4 h-4 rounded border border-gray-300"
                                                style={{ backgroundColor: hoveredPixel.pixel.color }}
                                            />
                                            <span className="font-medium">{hoveredPixel.pixel.color}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Par:</span>
                                        <span className="font-medium">{hoveredPixel.pixel.username}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Placé:</span>
                                        <span className="font-medium">{hoveredPixel.pixel.placedAt.toLocaleString()}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-gray-500 italic">Case vide</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Bouton pour masquer/afficher les stats */}
                <button
                    onClick={() => setShowStats(!showStats)}
                    className="bg-white px-3 py-2 rounded-lg shadow-lg text-sm font-medium hover:bg-gray-50 transition-colors w-full"
                >
                    {showStats ? '📊 Masquer stats' : '📊 Afficher stats'}
                </button>
            </div>

            {/* Indicateur de chargement */}
            {isPlacing && (
                <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center z-[2000]">
                    <div className="bg-white rounded-lg p-6 shadow-xl">
                        <div className="flex items-center gap-3">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                            <span className="font-medium">Placement du pixel...</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OptimizedMapContainer;