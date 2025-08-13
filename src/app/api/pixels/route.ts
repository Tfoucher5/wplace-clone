// src/app/api/pixels/route.ts - API routes pour la gestion des pixels

import { NextRequest, NextResponse } from 'next/server';
import { createPool } from 'mysql2/promise';
import { validatePixelPlacement, geoToGrid, gridToGeo, getVisibleChunks, type Pixel } from '@/lib/pixelGridSystem';
import { GRID_CONFIG, isValidColor, isFreeColor } from '@/lib/gridConfig';
import jwt from 'jsonwebtoken';

// Configuration de la base de données
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

// Interface pour l'utilisateur authentifié
interface AuthUser {
  id: number;
  username: string;
  email: string;
  isPremium: boolean;
  lastPixelTime?: Date;
}

// Fonction d'authentification
async function authenticate(request: NextRequest): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    const [rows] = await pool.execute(
      'SELECT id, username, email, is_premium, last_pixel_time FROM users WHERE id = ?',
      [decoded.userId]
    );

    const users = rows as any[];
    if (users.length === 0) return null;

    const user = users[0];
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      isPremium: user.is_premium,
      lastPixelTime: user.last_pixel_time ? new Date(user.last_pixel_time) : undefined
    };
  } catch (error) {
    console.error('Erreur authentification:', error);
    return null;
  }
}

// Vérifier le cooldown utilisateur
function checkCooldown(lastPixelTime?: Date): { canPlace: boolean; remainingSeconds: number } {
  if (!lastPixelTime) {
    return { canPlace: true, remainingSeconds: 0 };
  }

  const timeSinceLastPixel = Date.now() - lastPixelTime.getTime();
  const cooldownMs = GRID_CONFIG.COOLDOWN_SECONDS * 1000;
  const remainingMs = cooldownMs - timeSinceLastPixel;

  return {
    canPlace: remainingMs <= 0,
    remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000))
  };
}

// GET /api/pixels - Récupérer les pixels dans une zone
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Paramètres de la requête
    const north = parseFloat(searchParams.get('north') || '0');
    const south = parseFloat(searchParams.get('south') || '0');
    const east = parseFloat(searchParams.get('east') || '0');
    const west = parseFloat(searchParams.get('west') || '0');
    const limit = parseInt(searchParams.get('limit') || '1000');

    // Valider les paramètres
    if (isNaN(north) || isNaN(south) || isNaN(east) || isNaN(west)) {
      return NextResponse.json(
        { success: false, error: 'Paramètres de zone invalides' },
        { status: 400 }
      );
    }

    // Convertir en coordonnées de grille
    const topLeft = geoToGrid(north, west);
    const bottomRight = geoToGrid(south, east);

    // Optimisation : utiliser les chunks visibles
    const bounds = { north, south, east, west };
    const chunks = getVisibleChunks(bounds);

    let pixels: any[] = [];

    if (chunks.length <= 10) {
      // Requête par chunks optimisée
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

        pixels = rows as any[];
      }
    } else {
      // Requête par zone géographique (fallback)
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
        WHERE p.grid_x BETWEEN ? AND ?
          AND p.grid_y BETWEEN ? AND ?
        ORDER BY p.placed_at DESC
        LIMIT ?
      `, [topLeft.gridX, bottomRight.gridX, topLeft.gridY, bottomRight.gridY, limit]);

      pixels = rows as any[];
    }

    // Convertir les dates
    const formattedPixels = pixels.map(pixel => ({
      ...pixel,
      placedAt: new Date(pixel.placedAt)
    }));

    return NextResponse.json({
      success: true,
      data: formattedPixels,
      count: formattedPixels.length,
      bounds: { north, south, east, west }
    });

  } catch (error) {
    console.error('Erreur GET /api/pixels:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/pixels - Placer un nouveau pixel
export async function POST(request: NextRequest) {
  try {
    // Authentification requise
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise' },
        { status: 401 }
      );
    }

    // Parser le body
    const body = await request.json();
    const { lat, lng, gridX, gridY, color } = body;

    // Valider les données
    const pixelData = {
      gridX,
      gridY,
      lat,
      lng,
      color,
      userId: user.id,
      username: user.username,
      placedAt: new Date()
    };

    const validation = validatePixelPlacement(pixelData);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Vérifier la couleur
    if (!isValidColor(color)) {
      return NextResponse.json(
        { success: false, error: 'Couleur invalide' },
        { status: 400 }
      );
    }

    // Vérifier si l'utilisateur peut utiliser cette couleur
    if (!isFreeColor(color) && !user.isPremium) {
      return NextResponse.json(
        { success: false, error: 'Cette couleur nécessite un compte premium' },
        { status: 403 }
      );
    }

    // Vérifier le cooldown
    const cooldownCheck = checkCooldown(user.lastPixelTime);
    if (!cooldownCheck.canPlace) {
      return NextResponse.json(
        {
          success: false,
          error: `Attendez ${cooldownCheck.remainingSeconds} secondes avant de placer un autre pixel`,
          remainingSeconds: cooldownCheck.remainingSeconds
        },
        { status: 429 }
      );
    }

    // Calculer les coordonnées de chunk
    const chunkX = Math.floor(gridX / GRID_CONFIG.CHUNK_SIZE);
    const chunkY = Math.floor(gridY / GRID_CONFIG.CHUNK_SIZE);

    // Transaction pour placer le pixel
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Vérifier s'il y a déjà un pixel à cette position
      const [existingPixels] = await connection.execute(
        'SELECT id FROM pixels WHERE grid_x = ? AND grid_y = ?',
        [gridX, gridY]
      );

      if ((existingPixels as any[]).length > 0) {
        // Remplacer le pixel existant
        await connection.execute(`
          UPDATE pixels 
          SET color = ?, user_id = ?, placed_at = NOW(), chunk_x = ?, chunk_y = ?
          WHERE grid_x = ? AND grid_y = ?
        `, [color, user.id, chunkX, chunkY, gridX, gridY]);
      } else {
        // Créer un nouveau pixel
        await connection.execute(`
          INSERT INTO pixels (grid_x, grid_y, lat, lng, color, user_id, placed_at, chunk_x, chunk_y)
          VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)
        `, [gridX, gridY, lat, lng, color, user.id, chunkX, chunkY]);
      }

      // Mettre à jour le compteur et timestamp de l'utilisateur
      await connection.execute(`
        UPDATE users 
        SET pixels_placed = pixels_placed + 1, last_pixel_time = NOW()
        WHERE id = ?
      `, [user.id]);

      await connection.commit();

      // Récupérer le pixel créé/mis à jour
      const [newPixelRows] = await connection.execute(`
        SELECT 
          p.id,
          p.grid_x as gridX,
          p.grid_y as gridY,
          p.lat,
          p.lng,
          p.color,
          p.placed_at as placedAt,
          u.username,
          u.pixels_placed as pixelsPlaced
        FROM pixels p
        JOIN users u ON p.user_id = u.id
        WHERE p.grid_x = ? AND p.grid_y = ?
      `, [gridX, gridY]);

      const newPixel = (newPixelRows as any[])[0];

      // Réponse avec le pixel créé et infos utilisateur
      return NextResponse.json({
        success: true,
        data: {
          pixel: {
            ...newPixel,
            placedAt: new Date(newPixel.placedAt)
          },
          user: {
            id: user.id,
            username: user.username,
            pixelsPlaced: newPixel.pixelsPlaced,
            lastPixelTime: new Date()
          }
        },
        message: 'Pixel placé avec succès'
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Erreur POST /api/pixels:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur lors du placement du pixel' },
      { status: 500 }
    );
  }
}

// PUT /api/pixels/[id] - Modifier un pixel existant (admin uniquement)
export async function PUT(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise' },
        { status: 401 }
      );
    }

    // TODO: Vérifier si l'utilisateur est admin
    // Pour l'instant, on permet seulement de modifier ses propres pixels

    const body = await request.json();
    const { pixelId, color } = body;

    if (!isValidColor(color)) {
      return NextResponse.json(
        { success: false, error: 'Couleur invalide' },
        { status: 400 }
      );
    }

    if (!isFreeColor(color) && !user.isPremium) {
      return NextResponse.json(
        { success: false, error: 'Cette couleur nécessite un compte premium' },
        { status: 403 }
      );
    }

    const [result] = await pool.execute(`
      UPDATE pixels 
      SET color = ?, placed_at = NOW()
      WHERE id = ? AND user_id = ?
    `, [color, pixelId, user.id]);

    const updateResult = result as any;

    if (updateResult.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Pixel non trouvé ou pas autorisé à le modifier' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pixel mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur PUT /api/pixels:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE /api/pixels/[id] - Supprimer un pixel (admin uniquement)
export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticate(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const pixelId = searchParams.get('id');

    if (!pixelId) {
      return NextResponse.json(
        { success: false, error: 'ID de pixel requis' },
        { status: 400 }
      );
    }

    // Pour l'instant, permettre seulement de supprimer ses propres pixels
    const [result] = await pool.execute(`
      DELETE FROM pixels 
      WHERE id = ? AND user_id = ?
    `, [pixelId, user.id]);

    const deleteResult = result as any;

    if (deleteResult.affectedRows === 0) {
      return NextResponse.json(
        { success: false, error: 'Pixel non trouvé ou pas autorisé à le supprimer' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Pixel supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur DELETE /api/pixels:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}