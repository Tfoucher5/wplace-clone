// app/api/pixels/route.ts - API route pour la gestion des pixels

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import {
  validatePixelColor,
  validateGridPosition,
  isValidColor,
  ApiError,
  CooldownError,
  AuthenticationError,
  ValidationApiError,
  userToApiUser,
  pixelToApiPixel,
  API_CONFIG
} from '@/lib/database';
import { snapToGrid } from '@/lib/gridSystem';

// Types pour la base de données (à adapter selon votre ORM)
interface Database {
  user: {
    findUnique: (where: { id: number }) => Promise<any>;
    update: (params: { where: { id: number }, data: any }) => Promise<any>;
  };
  pixel: {
    create: (data: any) => Promise<any>;
    findMany: (params?: any) => Promise<any[]>;
    findUnique: (where: any) => Promise<any>;
    upsert: (params: any) => Promise<any>;
  };
}

// Simuler une base de données en mémoire pour la démo
const mockDb: Database = {
  user: {
    findUnique: async (where) => {
      // Mock user
      return {
        id: where.id,
        username: 'demo_user',
        email: 'demo@example.com',
        pixels_placed: 0,
        last_pixel_time: null,
        created_at: new Date(),
        updated_at: new Date()
      };
    },
    update: async (params) => {
      return {
        id: params.where.id,
        username: 'demo_user',
        pixels_placed: (params.data.pixels_placed || 0) + 1,
        last_pixel_time: params.data.last_pixel_time,
      };
    }
  },
  pixel: {
    create: async (data) => {
      return {
        id: Date.now(),
        ...data,
        placed_at: new Date()
      };
    },
    findMany: async () => {
      return [];
    },
    findUnique: async () => null,
    upsert: async (params) => {
      return {
        id: Date.now(),
        ...params.create,
        placed_at: new Date()
      };
    }
  }
};

// Middleware d'authentification
async function authenticateRequest(request: NextRequest) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Token manquant');
  }

  const token = authHeader.substring(7);

  try {
    // Pour la démo, on decode simplement le token base64
    const decoded = JSON.parse(atob(token.split(':')[0]));
    return { userId: decoded.id || 1 };
  } catch (error) {
    throw new AuthenticationError('Token invalide');
  }
}

// Vérifier le cooldown
async function checkCooldown(userId: number) {
  const user = await mockDb.user.findUnique({ id: userId });

  if (user?.last_pixel_time) {
    const lastPixelTime = new Date(user.last_pixel_time).getTime();
    const now = Date.now();
    const cooldownMs = API_CONFIG.COOLDOWN_SECONDS * 1000;
    const remainingMs = cooldownMs - (now - lastPixelTime);

    if (remainingMs > 0) {
      throw new CooldownError(Math.ceil(remainingMs / 1000));
    }
  }
}

// GET /api/pixels - Récupérer les pixels
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chunkX = searchParams.get('chunkX');
    const chunkY = searchParams.get('chunkY');
    const minX = searchParams.get('minX');
    const maxX = searchParams.get('maxX');
    const minY = searchParams.get('minY');
    const maxY = searchParams.get('maxY');
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '1000'),
      API_CONFIG.MAX_PIXELS_PER_REQUEST
    );

    // Construire la requête selon les paramètres
    let whereClause: any = {};

    if (chunkX && chunkY) {
      const chunkSize = 100;
      const startX = parseInt(chunkX) * chunkSize;
      const startY = parseInt(chunkY) * chunkSize;

      whereClause = {
        grid_x: { gte: startX, lt: startX + chunkSize },
        grid_y: { gte: startY, lt: startY + chunkSize }
      };
    } else if (minX && maxX && minY && maxY) {
      whereClause = {
        grid_x: { gte: parseInt(minX), lte: parseInt(maxX) },
        grid_y: { gte: parseInt(minY), lte: parseInt(maxY) }
      };
    }

    const pixels = await mockDb.pixel.findMany({
      where: whereClause,
      take: limit,
      include: {
        user: {
          select: { username: true }
        }
      },
      orderBy: { placed_at: 'desc' }
    });

    // Convertir au format API
    const apiPixels = pixels.map(pixel => ({
      id: pixel.id,
      lat: pixel.lat,
      lng: pixel.lng,
      gridX: pixel.grid_x,
      gridY: pixel.grid_y,
      color: pixel.color,
      username: pixel.user?.username || 'Inconnu',
      placedAt: pixel.placed_at.toISOString()
    }));

    return NextResponse.json({
      success: true,
      data: {
        pixels: apiPixels,
        count: apiPixels.length,
        chunk: chunkX && chunkY ? { x: parseInt(chunkX), y: parseInt(chunkY) } : null
      }
    });

  } catch (error) {
    console.error('Erreur GET /api/pixels:', error);

    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/pixels - Placer un pixel
export async function POST(request: NextRequest) {
  try {
    // Authentification
    const { userId } = await authenticateRequest(request);

    // Vérifier le cooldown
    await checkCooldown(userId);

    // Parser le body
    const body = await request.json();
    const { lat, lng, gridX, gridY, color } = body;

    // Validations
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new ValidationApiError('coordinates', 'Coordonnées invalides');
    }

    if (!validateGridPosition(gridX, gridY)) {
      throw new ValidationApiError('grid', 'Position de grille invalide');
    }

    if (!validatePixelColor(color)) {
      throw new ValidationApiError('color', 'Format de couleur invalide');
    }

    if (!isValidColor(color)) {
      throw new ValidationApiError('color', 'Couleur non autorisée');
    }

    // Snap à la grille pour s'assurer de la cohérence
    const snapped = snapToGrid(lat, lng);

    if (snapped.gridX !== gridX || snapped.gridY !== gridY) {
      console.warn('Position corrigée:', {
        original: { gridX, gridY },
        snapped: { gridX: snapped.gridX, gridY: snapped.gridY }
      });
    }

    // Placer ou remplacer le pixel
    const pixel = await mockDb.pixel.upsert({
      where: {
        grid_x_grid_y: {
          grid_x: snapped.gridX,
          grid_y: snapped.gridY
        }
      },
      update: {
        color: color.toUpperCase(),
        user_id: userId,
        placed_at: new Date()
      },
      create: {
        lat: snapped.lat,
        lng: snapped.lng,
        grid_x: snapped.gridX,
        grid_y: snapped.gridY,
        color: color.toUpperCase(),
        user_id: userId,
        placed_at: new Date()
      },
      include: {
        user: {
          select: { username: true }
        }
      }
    });

    // Mettre à jour les stats utilisateur
    const updatedUser = await mockDb.user.update({
      where: { id: userId },
      data: {
        pixels_placed: { increment: 1 },
        last_pixel_time: new Date()
      }
    });

    // Préparer la réponse
    const response = {
      success: true,
      data: {
        pixel: {
          id: pixel.id,
          lat: pixel.lat,
          lng: pixel.lng,
          gridX: pixel.grid_x,
          gridY: pixel.grid_y,
          color: pixel.color,
          username: pixel.user?.username || 'Inconnu',
          placedAt: pixel.placed_at.toISOString()
        },
        user: {
          id: updatedUser.id,
          username: updatedUser.username,
          pixelsPlaced: updatedUser.pixels_placed,
          lastPixelTime: updatedUser.last_pixel_time?.toISOString()
        }
      }
    };

    // TODO: Envoyer via WebSocket aux autres clients connectés
    // websocketBroadcast('pixel_updated', response.data);

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Erreur POST /api/pixels:', error);

    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE /api/pixels/[id] - Supprimer un pixel (admin seulement)
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await authenticateRequest(request);

    // Vérifier les permissions admin
    const user = await mockDb.user.findUnique({ id: userId });
    if (!user?.isAdmin) {
      throw new AuthenticationError('Permissions insuffisantes');
    }

    // TODO: Implémenter la suppression

    return NextResponse.json({
      success: true,
      message: 'Pixel supprimé'
    });

  } catch (error) {
    console.error('Erreur DELETE /api/pixels:', error);

    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}