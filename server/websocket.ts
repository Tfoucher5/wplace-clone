// server/websocket.ts - Version avec types corrects

const { Server } = require('socket.io');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Note: On va créer des versions CommonJS des modules dans src/lib
// Pour l'instant, on va les importer différemment
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000');

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface ConnectedUser {
    id: number;
    username: string;
    socketId: string;
    currentChunks: Set<string>;
}

interface PixelPlacedEvent {
    pixel: {
        id: number;
        lat: number;
        lng: number;
        grid_x: number;
        grid_y: number;
        color: string;
        user_id: number;
        placed_at: string;
    };
    user: {
        id: number;
        username: string;
    };
}

interface ViewBounds {
    north: number;
    south: number;
    east: number;
    west: number;
}

interface ChunkCoord {
    chunkX: number;
    chunkY: number;
}

// Fonctions utilitaires intégrées (temporaire)
function getChunkKey(chunkX: number, chunkY: number, zoom: number): string {
    return `chunk:${zoom}:${chunkX}:${chunkY}`;
}

function getVisibleChunks(bounds: ViewBounds, zoom: number): ChunkCoord[] {
    if (zoom < 10) return [];

    const CHUNK_SIZE = 100;
    const PIXEL_SIZE_DEGREES = 0.0001;
    const BOUNDS = { MIN_LAT: -85, MAX_LAT: 85, MIN_LNG: -180, MAX_LNG: 180 };

    // Convertir bounds en positions de grille
    const topLeftX = Math.floor((bounds.west - BOUNDS.MIN_LNG) / PIXEL_SIZE_DEGREES);
    const topLeftY = Math.floor((BOUNDS.MAX_LAT - bounds.north) / PIXEL_SIZE_DEGREES);
    const bottomRightX = Math.floor((bounds.east - BOUNDS.MIN_LNG) / PIXEL_SIZE_DEGREES);
    const bottomRightY = Math.floor((BOUNDS.MAX_LAT - bounds.south) / PIXEL_SIZE_DEGREES);

    const chunks: ChunkCoord[] = [];
    const minChunkX = Math.floor(topLeftX / CHUNK_SIZE);
    const maxChunkX = Math.floor(bottomRightX / CHUNK_SIZE);
    const minChunkY = Math.floor(topLeftY / CHUNK_SIZE);
    const maxChunkY = Math.floor(bottomRightY / CHUNK_SIZE);

    for (let x = minChunkX; x <= maxChunkX; x++) {
        for (let y = minChunkY; y <= maxChunkY; y++) {
            chunks.push({ chunkX: x, chunkY: y });
        }
    }

    return chunks;
}

// Mock functions - à remplacer par les vraies quand les modules seront prêts
async function mockVerifyToken(token: string): Promise<any> {
    // Temporaire - retourne un utilisateur test
    if (token === 'test-token') {
        return { id: 1, username: 'TestUser', email: 'test@example.com' };
    }
    return null;
}

async function mockGetPixelsInBounds(bounds: ViewBounds, zoom: number): Promise<any[]> {
    // Temporaire - retourne un tableau vide
    return [];
}

async function mockPlacePixel(lat: number, lng: number, color: string, userId: number): Promise<any> {
    // Temporaire - simule un pixel placé
    const PIXEL_SIZE_DEGREES = 0.0001;
    const BOUNDS = { MIN_LAT: -85, MAX_LAT: 85, MIN_LNG: -180, MAX_LNG: 180 };

    const gridX = Math.floor((lng - BOUNDS.MIN_LNG) / PIXEL_SIZE_DEGREES);
    const gridY = Math.floor((BOUNDS.MAX_LAT - lat) / PIXEL_SIZE_DEGREES);

    return {
        success: true,
        pixel: {
            id: Date.now(),
            lat,
            lng,
            grid_x: gridX,
            grid_y: gridY,
            color,
            user_id: userId,
            placed_at: new Date()
        }
    };
}

async function mockGetUserStats(userId: number): Promise<any> {
    return {
        pixelsPlaced: 42,
        pixelsCurrent: 25,
        canPlacePixel: true
    };
}

app.prepare().then(() => {
    const server = createServer((req: any, res: any) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        transports: ['websocket', 'polling']
    });

    // Map pour stocker les utilisateurs connectés
    const connectedUsers = new Map<string, ConnectedUser>();

    // Map pour stocker les utilisateurs par chunk
    const chunkUsers = new Map<string, Set<string>>();

    console.log('🚀 Initialisation du serveur WebSocket...');

    io.on('connection', async (socket: import('socket.io').Socket) => {
        console.log(`✅ Nouvelle connexion: ${socket.id}`);

        // Authentification du socket
        socket.on('authenticate', async (token: string) => {
            try {
                const user = await mockVerifyToken(token);
                if (!user) {
                    socket.emit('auth_error', 'Token invalide');
                    return;
                }

                // Enregistrer l'utilisateur connecté
                connectedUsers.set(socket.id, {
                    id: user.id,
                    username: user.username,
                    socketId: socket.id,
                    currentChunks: new Set<string>()
                });

                socket.emit('authenticated', {
                    user: {
                        id: user.id,
                        username: user.username
                    }
                });

                console.log(`👤 Utilisateur authentifié: ${user.username} (${socket.id})`);

            } catch (error) {
                console.error('❌ Erreur d\'authentification:', error);
                socket.emit('auth_error', 'Erreur d\'authentification');
            }
        });

        // Gestion du changement de vue
        socket.on('view_changed', async (data: { bounds: ViewBounds; zoom: number }) => {
            const user = connectedUsers.get(socket.id);
            if (!user) return;

            try {
                const { bounds, zoom } = data;
                const visibleChunks: ChunkCoord[] = getVisibleChunks(bounds, zoom);
                const newChunkKeys = new Set<string>(
                    visibleChunks.map(chunk => getChunkKey(chunk.chunkX, chunk.chunkY, zoom))
                );

                // Quitter les anciens chunks
                user.currentChunks.forEach((chunkKey: string) => {
                    if (!newChunkKeys.has(chunkKey)) {
                        socket.leave(chunkKey);

                        const chunkUserSet = chunkUsers.get(chunkKey);
                        if (chunkUserSet) {
                            chunkUserSet.delete(socket.id);
                            if (chunkUserSet.size === 0) {
                                chunkUsers.delete(chunkKey);
                            }
                        }
                    }
                });

                // Rejoindre les nouveaux chunks
                newChunkKeys.forEach((chunkKey: string) => {
                    if (!user.currentChunks.has(chunkKey)) {
                        socket.join(chunkKey);

                        if (!chunkUsers.has(chunkKey)) {
                            chunkUsers.set(chunkKey, new Set<string>());
                        }
                        chunkUsers.get(chunkKey)!.add(socket.id);
                    }
                });

                user.currentChunks = newChunkKeys;

                // Envoyer les pixels des nouveaux chunks
                const pixels = await mockGetPixelsInBounds(bounds, zoom);
                socket.emit('pixels_loaded', {
                    pixels,
                    bounds,
                    zoom
                });

                console.log(`🗺️ Vue changée pour ${user.username}: ${visibleChunks.length} chunks`);

            } catch (error) {
                console.error('❌ Erreur lors du changement de vue:', error);
                socket.emit('error', 'Erreur lors du chargement des pixels');
            }
        });

        // Gestion du placement de pixel
        socket.on('place_pixel', async (data: { lat: number; lng: number; color: string }) => {
            const user = connectedUsers.get(socket.id);
            if (!user) {
                socket.emit('error', 'Utilisateur non authentifié');
                return;
            }

            try {
                const { lat, lng, color } = data;
                const result = await mockPlacePixel(lat, lng, color, user.id);

                if (result.success && result.pixel) {
                    const pixelEvent: PixelPlacedEvent = {
                        pixel: {
                            ...result.pixel,
                            placed_at: result.pixel.placed_at.toISOString()
                        },
                        user: {
                            id: user.id,
                            username: user.username
                        }
                    };

                    // Confirmer à l'utilisateur
                    socket.emit('pixel_placed', pixelEvent);

                    // Diffuser aux autres utilisateurs
                    const chunkX = Math.floor(result.pixel.grid_x / 100);
                    const chunkY = Math.floor(result.pixel.grid_y / 100);

                    for (let zoom = 10; zoom <= 18; zoom++) {
                        const chunkKey = getChunkKey(chunkX, chunkY, zoom);
                        socket.to(chunkKey).emit('pixel_updated', pixelEvent);
                    }

                    console.log(`🎨 Pixel placé par ${user.username}: ${result.pixel.grid_x}, ${result.pixel.grid_y}`);

                } else {
                    socket.emit('pixel_error', result.message || 'Erreur lors du placement du pixel');
                }

            } catch (error) {
                console.error('❌ Erreur lors du placement du pixel:', error);
                socket.emit('pixel_error', 'Erreur serveur');
            }
        });

        // Stats utilisateur
        socket.on('get_user_stats', async () => {
            const user = connectedUsers.get(socket.id);
            if (!user) return;

            try {
                const stats = await mockGetUserStats(user.id);
                socket.emit('user_stats', stats);
            } catch (error) {
                console.error('❌ Erreur lors de la récupération des stats:', error);
            }
        });

        // Déconnexion
        socket.on('disconnect', () => {
            const user = connectedUsers.get(socket.id);

            if (user) {
                user.currentChunks.forEach((chunkKey: string) => {
                    const chunkUserSet = chunkUsers.get(chunkKey);
                    if (chunkUserSet) {
                        chunkUserSet.delete(socket.id);
                        if (chunkUserSet.size === 0) {
                            chunkUsers.delete(chunkKey);
                        }
                    }
                });

                console.log(`👋 Utilisateur déconnecté: ${user.username} (${socket.id})`);
                connectedUsers.delete(socket.id);
            }
        });

        // Ping/Pong
        socket.on('ping', () => {
            socket.emit('pong');
        });
    });

    // Statistiques périodiques
    setInterval(() => {
        const stats = {
            connectedUsers: connectedUsers.size,
            activeChunks: chunkUsers.size,
            timestamp: new Date().toISOString()
        };

        io.emit('server_stats', stats);
        console.log(`📊 Stats: ${stats.connectedUsers} utilisateurs, ${stats.activeChunks} chunks actifs`);
    }, 30000);

    server.listen(port, hostname, () => {
        console.log(`🚀 Serveur démarré sur http://${hostname}:${port}`);
        console.log(`📡 WebSocket prêt pour les connexions temps réel`);
        console.log(`🗄️ Mode: ${dev ? 'DÉVELOPPEMENT' : 'PRODUCTION'}`);
        console.log(`⚠️  Utilisation des fonctions mock (temporaire)`);
        console.log(`🎯 Prêt pour les tests !`);
    });
});