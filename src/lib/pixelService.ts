// src/lib/pixelService.ts

import { pool, redis, Pixel } from './database';
import { geoToGrid, gridToGeo, getChunkKey, getVisibleChunks } from './gridSystem';

export class PixelService {
    /**
     * Place un pixel à une position géographique
     */
    static async placePixel(
        lat: number,
        lng: number,
        color: string,
        userId: number
    ): Promise<{ success: boolean; message?: string; pixel?: Pixel }> {
        try {
            // Convertir en position de grille
            const { x: gridX, y: gridY } = geoToGrid(lat, lng);

            // Vérifier le cooldown de l'utilisateur
            const canPlace = await this.checkUserCooldown(userId);
            if (!canPlace) {
                return { success: false, message: 'Vous devez attendre 30 secondes entre chaque pixel' };
            }

            // Vérifier si la couleur est valide
            if (!this.isValidColor(color)) {
                return { success: false, message: 'Couleur invalide' };
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Insérer ou mettre à jour le pixel
                const result = await client.query(`
          INSERT INTO pixels (lat, lng, grid_x, grid_y, color, user_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (grid_x, grid_y)
          DO UPDATE SET 
            color = EXCLUDED.color,
            user_id = EXCLUDED.user_id,
            placed_at = CURRENT_TIMESTAMP
          RETURNING *
        `, [lat, lng, gridX, gridY, color, userId]);

                const pixel = result.rows[0];

                // Mettre à jour les stats de l'utilisateur
                await client.query(`
          UPDATE users 
          SET pixels_placed = pixels_placed + 1,
              last_pixel_time = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `, [userId]);

                await client.query('COMMIT');

                // Mettre en cache dans Redis
                await this.cachePixel(pixel);

                // Invalider le cache du chunk
                await this.invalidateChunkCache(gridX, gridY);

                return { success: true, pixel };

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Erreur lors du placement du pixel:', error);
            return { success: false, message: 'Erreur serveur' };
        }
    }

    /**
     * Récupère les pixels dans une zone géographique
     */
    static async getPixelsInBounds(bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    }, zoom: number): Promise<Pixel[]> {
        try {
            // Essayer de récupérer depuis le cache d'abord
            const cachedPixels = await this.getCachedPixelsInBounds(bounds, zoom);
            if (cachedPixels.length > 0) {
                return cachedPixels;
            }

            // Requête directe à la base de données
            const result = await pool.query(`
        SELECT * FROM pixels 
        WHERE lat BETWEEN $1 AND $2
        AND lng BETWEEN $3 AND $4
        ORDER BY placed_at DESC
      `, [bounds.south, bounds.north, bounds.west, bounds.east]);

            const pixels = result.rows;

            // Mettre en cache les résultats
            await this.cachePixelsInBounds(pixels, bounds, zoom);

            return pixels;

        } catch (error) {
            console.error('Erreur lors de la récupération des pixels:', error);
            return [];
        }
    }

    /**
     * Vérifie le cooldown d'un utilisateur
     */
    private static async checkUserCooldown(userId: number): Promise<boolean> {
        try {
            const cacheKey = `cooldown:user:${userId}`;
            const lastPixelTime = await redis.get(cacheKey);

            if (lastPixelTime) {
                const timeSinceLastPixel = Date.now() - parseInt(lastPixelTime);
                return timeSinceLastPixel >= 30000; // 30 secondes
            }

            // Vérifier en base si pas en cache
            const result = await pool.query(
                'SELECT last_pixel_time FROM users WHERE id = $1',
                [userId]
            );

            if (result.rows.length > 0 && result.rows[0].last_pixel_time) {
                const lastTime = new Date(result.rows[0].last_pixel_time).getTime();
                const timeSinceLastPixel = Date.now() - lastTime;

                // Mettre en cache
                await redis.setex(cacheKey, 30, lastTime.toString());

                return timeSinceLastPixel >= 30000;
            }

            return true;

        } catch (error) {
            console.error('Erreur lors de la vérification du cooldown:', error);
            return false;
        }
    }

    /**
     * Met un pixel en cache
     */
    private static async cachePixel(pixel: Pixel): Promise<void> {
        try {
            const key = `pixel:${pixel.grid_x}:${pixel.grid_y}`;
            await redis.setex(key, 3600, JSON.stringify(pixel)); // Cache 1 heure

            // Mettre à jour le cooldown de l'utilisateur
            const cooldownKey = `cooldown:user:${pixel.user_id}`;
            await redis.setex(cooldownKey, 30, Date.now().toString());

        } catch (error) {
            console.error('Erreur lors de la mise en cache du pixel:', error);
        }
    }

    /**
     * Récupère les pixels en cache pour une zone
     */
    private static async getCachedPixelsInBounds(bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    }, zoom: number): Promise<Pixel[]> {
        try {
            const chunks = getVisibleChunks(bounds, zoom);
            const pixels: Pixel[] = [];

            for (const chunk of chunks) {
                const chunkKey = getChunkKey(chunk.chunkX, chunk.chunkY, zoom);
                const cachedChunk = await redis.get(chunkKey);

                if (cachedChunk) {
                    const chunkPixels = JSON.parse(cachedChunk);
                    pixels.push(...chunkPixels);
                }
            }

            return pixels;

        } catch (error) {
            console.error('Erreur lors de la récupération des pixels en cache:', error);
            return [];
        }
    }

    /**
     * Met en cache les pixels d'une zone
     */
    private static async cachePixelsInBounds(
        pixels: Pixel[],
        bounds: { north: number; south: number; east: number; west: number },
        zoom: number
    ): Promise<void> {
        try {
            const chunks = getVisibleChunks(bounds, zoom);

            for (const chunk of chunks) {
                // Filtrer les pixels de ce chunk
                const chunkPixels = pixels.filter(pixel => {
                    const chunkX = Math.floor(pixel.grid_x / 100);
                    const chunkY = Math.floor(pixel.grid_y / 100);
                    return chunkX === chunk.chunkX && chunkY === chunk.chunkY;
                });

                if (chunkPixels.length > 0) {
                    const chunkKey = getChunkKey(chunk.chunkX, chunk.chunkY, zoom);
                    await redis.setex(chunkKey, 300, JSON.stringify(chunkPixels)); // Cache 5 minutes
                }
            }

        } catch (error) {
            console.error('Erreur lors de la mise en cache des pixels:', error);
        }
    }

    /**
     * Invalide le cache d'un chunk
     */
    private static async invalidateChunkCache(gridX: number, gridY: number): Promise<void> {
        try {
            const chunkX = Math.floor(gridX / 100);
            const chunkY = Math.floor(gridY / 100);

            // Invalider pour tous les niveaux de zoom
            for (let zoom = 10; zoom <= 18; zoom++) {
                const chunkKey = getChunkKey(chunkX, chunkY, zoom);
                await redis.del(chunkKey);
            }

        } catch (error) {
            console.error('Erreur lors de l\'invalidation du cache:', error);
        }
    }

    /**
     * Valide un code couleur hex
     */
    private static isValidColor(color: string): boolean {
        return /^#[0-9A-F]{6}$/i.test(color);
    }

    /**
     * Récupère les statistiques d'un utilisateur
     */
    static async getUserStats(userId: number): Promise<{
        pixelsPlaced: number;
        pixelsCurrent: number;
        canPlacePixel: boolean;
        cooldownRemaining?: number;
    }> {
        try {
            const result = await pool.query(`
        SELECT 
          pixels_placed,
          (SELECT COUNT(*) FROM pixels WHERE user_id = $1) as pixels_current,
          last_pixel_time
        FROM users WHERE id = $1
      `, [userId]);

            if (result.rows.length === 0) {
                return { pixelsPlaced: 0, pixelsCurrent: 0, canPlacePixel: true };
            }

            const user = result.rows[0];
            const canPlace = await this.checkUserCooldown(userId);

            let cooldownRemaining = 0;
            if (!canPlace && user.last_pixel_time) {
                const timeSince = Date.now() - new Date(user.last_pixel_time).getTime();
                cooldownRemaining = Math.max(0, 30000 - timeSince);
            }

            return {
                pixelsPlaced: user.pixels_placed || 0,
                pixelsCurrent: user.pixels_current || 0,
                canPlacePixel: canPlace,
                cooldownRemaining: cooldownRemaining > 0 ? cooldownRemaining : undefined
            };

        } catch (error) {
            console.error('Erreur lors de la récupération des stats:', error);
            return { pixelsPlaced: 0, pixelsCurrent: 0, canPlacePixel: false };
        }
    }
}