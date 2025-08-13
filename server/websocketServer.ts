// server/websocketServer.ts - Serveur WebSocket optimisé pour temps réel

import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import jwt from 'jsonwebtoken';
import { createPool } from 'mysql2/promise';
import {
    getVisibleChunks,
    getChunkId,
    type Pixel,
    type Bounds,
    type ChunkCoordinates
} from '../src/lib/pixelGridSystem';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000');

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Configuration base de données
const pool = createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'wplace_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Interfaces
interface ConnectedUser {
    id: number;
    username: string;
    socketId: string;
    currentChunks: Set<string>;
    isAuthenticated: boolean;
    joinedAt: Date;
}

interface PixelPlacedEvent {
    pixel: Pixel;
    user: {
        id: number;
        username: string;
        pixelsPlaced: number;
    };
}

interface ViewBoundsUpdate {
    bounds: Bounds;
    zoom: number;
}

interface ChunkSubscription {
    chunkId: string;
    subscribers: Set<string>; // Socket IDs
    lastActivity: Date;
}

// État du serveur
const connectedUsers = new Map<string, ConnectedUser>(); // socketId -> user
const chunkSubscriptions = new Map<string, ChunkSubscription>(); // chunkId -> subscription
const userSockets = new Map<number, string>(); // userId -> socketId

// Statistiques en temps réel
let totalConnectedUsers = 0;
let totalPixelsPlaced = 0;
let serverStartTime = new Date();

// Fonctions utilitaires
async function authenticateSocket(token: string): Promise<{ id: number; username: string } | null> {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;

        const [rows] = await pool.execute(
            'SELECT id, username FROM users WHERE id = ?',
            [decoded.userId]
        );

        const users = rows as any[];
        return users.length > 0 ? users[0] : null;
    } catch (error) {
        console.error('Erreur authentification WebSocket:', error);
        return null;
    }
}

function subscribeToChunks(socketId: string, chunks: ChunkCoordinates[]): void {
    const user = connectedUsers.get(socketId);
    if (!user) return;

    // Désabonner des anciens chunks
    user.currentChunks.forEach(chunkId => {
        const subscription = chunkSubscriptions.get(chunkId);
        if (subscription) {
            subscription.subscribers.delete(socketId);
            if (subscription.subscribers.size === 0) {
                chunkSubscriptions.delete(chunkId);
            }
        }
    });

    // S'abonner aux nouveaux chunks
    user.currentChunks.clear();
    chunks.forEach(chunk => {
        const chunkId = getChunkId(chunk.chunkX, chunk.chunkY);
        user.currentChunks.add(chunkId);

        let subscription = chunkSubscriptions.get(chunkId);
        if (!subscription) {
            subscription = {
                chunkId,
                subscribers: new Set(),
                lastActivity: new Date()
            };
            chunkSubscriptions.set(chunkId, subscription);
        }

        subscription.subscribers.add(socketId);
        subscription.lastActivity = new Date();
    });

    console.log(`👁️ Utilisateur ${user.username} abonné à ${chunks.length} chunks`);
}

function broadcastToChunk(chunkId: string, event: string, data: any, excludeSocketId?: string): void {
    const subscription = chunkSubscriptions.get(chunkId);
    if (!subscription) return;

    subscription.subscribers.forEach(socketId => {
        if (socketId !== excludeSocketId) {
            const io = getIO();
            if (io) {
                io.to(socketId).emit(event, data);
            }
        }
    });
}

function cleanupInactiveSubscriptions(): void {
    const now = new Date();
    const CLEANUP_THRESHOLD = 5 * 60 * 1000; // 5 minutes

    chunkSubscriptions.forEach((subscription, chunkId) => {
        if (now.getTime() - subscription.lastActivity.getTime() > CLEANUP_THRESHOLD) {
            chunkSubscriptions.delete(chunkId);
        }
    });
}

// Variable globale pour l'instance IO
let ioInstance: SocketIOServer | null = null;

function getIO(): SocketIOServer | null {
    return ioInstance;
}

// Nettoyage périodique
setInterval(cleanupInactiveSubscriptions, 60000); // Chaque minute

// Initialisation du serveur
app.prepare().then(() => {
    const server = createServer((req, res) => {
        const parsedUrl = parse(req.url!, true);
        handle(req, res, parsedUrl);
    });

    const io = new SocketIOServer(server, {
        cors: {
            origin: dev ? "http://localhost:3000" : process.env.FRONTEND_URL,
            methods: ["GET", "POST"],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000,
        maxHttpBufferSize: 1e6, // 1MB
        transports: ['websocket', 'polling']
    });

    ioInstance = io;

    // Middleware d'authentification
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;

            if (token) {
                const user = await authenticateSocket(token);
                if (user) {
                    socket.data.user = user;
                    socket.data.isAuthenticated = true;
                }
            }

            // Permettre les connexions non authentifiées (lecture seule)
            socket.data.isAuthenticated = socket.data.isAuthenticated || false;
            next();
        } catch (error) {
            console.error('Erreur middleware auth:', error);
            next();
        }
    });

    // Gestionnaires d'événements
    io.on('connection', (socket) => {
        const isAuthenticated = socket.data.isAuthenticated;
        const user = socket.data.user;

        console.log(`🔌 Nouvelle connexion: ${socket.id} ${isAuthenticated ? `(${user.username})` : '(anonyme)'}`);

        // Enregistrer l'utilisateur connecté
        const connectedUser: ConnectedUser = {
            id: user?.id || 0,
            username: user?.username || 'Anonyme',
            socketId: socket.id,
            currentChunks: new Set(),
            isAuthenticated,
            joinedAt: new Date()
        };

        connectedUsers.set(socket.id, connectedUser);
        if (isAuthenticated) {
            userSockets.set(user.id, socket.id);
        }
        totalConnectedUsers++;

        // Envoyer les statistiques du serveur
        socket.emit('server:stats', {
            connectedUsers: totalConnectedUsers,
            totalPixelsPlaced,
            serverUptime: Date.now() - serverStartTime.getTime(),
            chunksActive: chunkSubscriptions.size
        });

        // Abonnement aux chunks visibles
        socket.on('subscribe:chunks', (data: { bounds: Bounds; zoom: number }) => {
            try {
                const chunks = getVisibleChunks(data.bounds);
                subscribeToChunks(socket.id, chunks);

                socket.emit('chunks:subscribed', {
                    chunks: chunks.map(c => getChunkId(c.chunkX, c.chunkY)),
                    count: chunks.length
                });
            } catch (error) {
                console.error('Erreur subscription chunks:', error);
                socket.emit('error', { message: 'Erreur abonnement chunks' });
            }
        });

        // Placement de pixel (authentifié seulement)
        socket.on('pixel:place', async (data: PixelPlacedEvent) => {
            if (!isAuthenticated) {
                socket.emit('error', { message: 'Authentification requise pour placer des pixels' });
                return;
            }

            try {
                const { pixel } = data;
                const chunkId = getChunkId(
                    Math.floor(pixel.gridX / 64), // CHUNK_SIZE = 64
                    Math.floor(pixel.gridY / 64)
                );

                // Mettre à jour les statistiques
                totalPixelsPlaced++;

                // Diffuser aux utilisateurs dans le même chunk
                broadcastToChunk(chunkId, 'pixel:placed', data, socket.id);

                // Confirmer à l'expéditeur
                socket.emit('pixel:confirmed', {
                    pixel,
                    timestamp: new Date().toISOString()
                });

                console.log(`🎨 Pixel placé par ${user.username} à (${pixel.gridX}, ${pixel.gridY})`);

            } catch (error) {
                console.error('Erreur placement pixel:', error);
                socket.emit('error', { message: 'Erreur placement pixel' });
            }
        });

        // Demande de pixels dans une zone
        socket.on('pixels:request', async (data: { bounds: Bounds; limit?: number }) => {
            try {
                const { bounds, limit = 1000 } = data;

                // Récupérer les pixels depuis la base de données
                const chunks = getVisibleChunks(bounds);
                const chunkConditions = chunks.map(chunk =>
                    `(chunk_x = ${chunk.chunkX} AND chunk_y = ${chunk.chunkY})`
                ).join(' OR ');

                if (chunkConditions) {
                    const [rows] = await pool.execute(`
            SELECT 
              p.id,
              p.grid_x as gridX,
              p.grid_y as gridY,
              p.lat,
              p.lng,
              p.color,
              p.placed_at as placedAt,
              u.username
            FROM pixels p
            JOIN users u ON p.user_id = u.id
            WHERE ${chunkConditions}
            ORDER BY p.placed_at DESC
            LIMIT ?
          `, [limit]);

                    const pixels = (rows as any[]).map(pixel => ({
                        ...pixel,
                        placedAt: new Date(pixel.placedAt)
                    }));

                    socket.emit('pixels:data', {
                        pixels,
                        bounds,
                        count: pixels.length
                    });
                } else {
                    socket.emit('pixels:data', { pixels: [], bounds, count: 0 });
                }

            } catch (error) {
                console.error('Erreur récupération pixels:', error);
                socket.emit('error', { message: 'Erreur chargement pixels' });
            }
        });

        // Demande des statistiques en temps réel
        socket.on('stats:request', () => {
            socket.emit('stats:update', {
                connectedUsers: totalConnectedUsers,
                totalPixelsPlaced,
                serverUptime: Date.now() - serverStartTime.getTime(),
                chunksActive: chunkSubscriptions.size,
                authenticatedUsers: Array.from(connectedUsers.values()).filter(u => u.isAuthenticated).length
            });
        });

        // Ping/Pong pour maintenir la connexion
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });

        // Déconnexion
        socket.on('disconnect', (reason) => {
            console.log(`🔌 Déconnexion: ${socket.id} (${connectedUser.username}) - Raison: ${reason}`);

            // Déconnexion
            socket.on('disconnect', (reason) => {
                console.log(`🔌 Déconnexion: ${socket.id} (${connectedUser.username}) - Raison: ${reason}`);

                // Nettoyer les abonnements
                connectedUser.currentChunks.forEach(chunkId => {
                    const subscription = chunkSubscriptions.get(chunkId);
                    if (subscription) {
                        subscription.subscribers.delete(socket.id);
                        if (subscription.subscribers.size === 0) {
                            chunkSubscriptions.delete(chunkId);
                        }
                    }
                });

                // Supprimer l'utilisateur des maps
                connectedUsers.delete(socket.id);
                if (isAuthenticated && user) {
                    userSockets.delete(user.id);
                }
                totalConnectedUsers--;

                // Diffuser la mise à jour des stats
                socket.broadcast.emit('server:stats', {
                    connectedUsers: totalConnectedUsers,
                    totalPixelsPlaced,
                    serverUptime: Date.now() - serverStartTime.getTime(),
                    chunksActive: chunkSubscriptions.size
                });
            });

            // Gestion des erreurs
            socket.on('error', (error) => {
                console.error(`❌ Erreur socket ${socket.id}:`, error);
            });
        });

        // API interne pour déclencher des événements depuis l'API REST
        global.broadcastPixelPlaced = (pixelData: PixelPlacedEvent) => {
            const chunkId = getChunkId(
                Math.floor(pixelData.pixel.gridX / 64),
                Math.floor(pixelData.pixel.gridY / 64)
            );

            totalPixelsPlaced++;
            broadcastToChunk(chunkId, 'pixel:placed', pixelData);

            // Diffuser les stats globales
            io.emit('server:stats', {
                connectedUsers: totalConnectedUsers,
                totalPixelsPlaced,
                serverUptime: Date.now() - serverStartTime.getTime(),
                chunksActive: chunkSubscriptions.size
            });
        };

        // Endpoints de monitoring
        server.on('request', (req, res) => {
            if (req.url === '/api/ws-stats' && req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    connectedUsers: totalConnectedUsers,
                    authenticatedUsers: Array.from(connectedUsers.values()).filter(u => u.isAuthenticated).length,
                    totalPixelsPlaced,
                    chunksActive: chunkSubscriptions.size,
                    serverUptime: Date.now() - serverStartTime.getTime(),
                    memoryUsage: process.memoryUsage()
                }));
                return;
            }
        });

        // Démarrage du serveur
        server.listen(port, (err?: any) => {
            if (err) throw err;
            console.log(`🚀 Serveur démarré sur http://${hostname}:${port}`);
            console.log(`📡 WebSocket prêt pour les connexions temps réel`);
            console.log(`🎯 Mode: ${dev ? 'développement' : 'production'}`);
        });

        // Gestion propre de l'arrêt
        process.on('SIGTERM', () => {
            console.log('🛑 Arrêt du serveur...');
            server.close(() => {
                pool.end();
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('🛑 Arrêt du serveur...');
            server.close(() => {
                pool.end();
                process.exit(0);
            });
        });
    });