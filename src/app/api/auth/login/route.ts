// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { pool } from '@/lib/database';
import { generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { login, password } = await request.json();

    if (!login || !password) {
      return NextResponse.json(
        { error: 'Login et mot de passe requis' },
        { status: 400 }
      );
    }

    // Chercher l'utilisateur par username ou email
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [login]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 401 }
      );
    }

    const user = result.rows[0];

    // Vérifier le mot de passe
    const isValidPassword = await compare(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Générer le token JWT
    const token = generateToken(user);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      token
    });

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}