// src/app/api/user/stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PixelService } from '@/lib/pixelService';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
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

        const stats = await PixelService.getUserStats(user.id);

        return NextResponse.json({
            success: true,
            stats
        });

    } catch (error) {
        console.error('Erreur API GET /user/stats:', error);
        return NextResponse.json(
            { error: 'Erreur serveur' },
            { status: 500 }
        );
    }
}