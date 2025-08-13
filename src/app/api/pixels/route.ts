// app/api/pixels/route.ts - API simple pour la persistance des pixels

import { NextRequest, NextResponse } from 'next/server';

// Simulation d'une base de données en mémoire (remplacer par une vraie DB)
const pixels: Array<{
  id: number;
  lat: number;
  lng: number;
  gridX: number;
  gridY: number;
  color: string;
  username: string;
  placedAt: string;
}> = [];

// GET /api/pixels - Récupérer tous les pixels
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5000');

    // Retourner les pixels (limités)
    const limitedPixels = pixels.slice(-limit);

    return NextResponse.json({
      success: true,
      data: {
        pixels: limitedPixels,
        count: limitedPixels.length,
        total: pixels.length
      }
    });

  } catch (error) {
    console.error('Erreur GET /api/pixels:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/pixels - Sauvegarder un pixel
export async function POST(request: NextRequest) {
  try {
    // Pour la démo, pas d'authentification stricte
    const body = await request.json();
    const { lat, lng, gridX, gridY, color } = body;

    // Validations de base
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Coordonnées invalides' },
        { status: 400 }
      );
    }

    if (typeof gridX !== 'number' || typeof gridY !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Position de grille invalide' },
        { status: 400 }
      );
    }

    if (!color || typeof color !== 'string' || !color.match(/^#[0-9A-Fa-f]{6}$/)) {
      return NextResponse.json(
        { success: false, error: 'Couleur invalide' },
        { status: 400 }
      );
    }

    // Créer le pixel
    const newPixel = {
      id: Date.now(),
      lat,
      lng,
      gridX,
      gridY,
      color: color.toUpperCase(),
      username: 'Anonyme', // Pour la démo
      placedAt: new Date().toISOString()
    };

    // Remplacer pixel existant ou ajouter nouveau
    const existingIndex = pixels.findIndex(p => p.gridX === gridX && p.gridY === gridY);
    if (existingIndex >= 0) {
      pixels[existingIndex] = newPixel;
    } else {
      pixels.push(newPixel);
    }

    console.log(`✅ Pixel sauvegardé: (${gridX}, ${gridY}) ${color}`);

    return NextResponse.json({
      success: true,
      data: {
        pixel: newPixel,
        user: {
          username: 'Anonyme',
          pixelsPlaced: pixels.length
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Erreur POST /api/pixels:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// DELETE /api/pixels - Réinitialiser tous les pixels (pour tests)
export async function DELETE() {
  try {
    pixels.length = 0; // Vider l'array

    return NextResponse.json({
      success: true,
      message: 'Tous les pixels ont été supprimés'
    });
  } catch (error) {
    console.error('Erreur DELETE /api/pixels:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}