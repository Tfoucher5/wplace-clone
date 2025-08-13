// src/app/api/pixels/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PixelService } from '@/lib/pixelService';
import { verifyToken } from '@/lib/auth';

// GET - Récupérer les pixels dans une zone
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const north = parseFloat(searchParams.get('north') || '0');
    const south = parseFloat(searchParams.get('south') || '0');
    const east = parseFloat(searchParams.get('east') || '0');
    const west = parseFloat(searchParams.get('west') || '0');
    const zoom = parseInt(searchParams.get('zoom') || '10');

    // Validation des paramètres
    if (!north || !south || !east || !west) {
      return NextResponse.json(
        { error: 'Paramètres de zone manquants' },
        { status: 400 }
      );
    }

    if (north <= south || east <= west) {
      return NextResponse.json(
        { error: 'Paramètres de zone invalides' },
        { status: 400 }
      );
    }

    const bounds = { north, south, east, west };
    const pixels = await PixelService.getPixelsInBounds(bounds, zoom);

    return NextResponse.json({
      success: true,
      pixels,
      count: pixels.length
    });

  } catch (error) {
    console.error('Erreur API GET /pixels:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST - Placer un pixel
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token d\'authentification requis' },
        { status: 401 }
      );
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Token invalide' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { lat, lng, color } = body;

    // Validation des données
    if (!lat || !lng || !color) {
      return NextResponse.json(
        { error: 'Données manquantes (lat, lng, color)' },
        { status: 400 }
      );
    }

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Coordonnées invalides' },
        { status: 400 }
      );
    }

    if (!/^#[0-9A-F]{6}$/i.test(color)) {
      return NextResponse.json(
        { error: 'Format de couleur invalide' },
        { status: 400 }
      );
    }

    const result = await PixelService.placePixel(lat, lng, color, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      pixel: result.pixel
    });

  } catch (error) {
    console.error('Erreur API POST /pixels:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}