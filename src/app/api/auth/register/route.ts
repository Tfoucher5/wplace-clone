// src/app/api/auth/register/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { pool } from '@/lib/database';
import { generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, email, password } = await request.json();

    // Validation des données
    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: 'Le nom d\'utilisateur doit faire entre 3 et 20 caractères' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit faire au moins 6 caractères' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format d\'email invalide' },
        { status: 400 }
      );
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: 'Nom d\'utilisateur ou email déjà utilisé' },
        { status: 409 }
      );
    }

    // Hasher le mot de passe
    const passwordHash = await hash(password, 12);

    // Créer l'utilisateur
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, email, created_at`,
      [username, email, passwordHash]
    );

    const user = result.rows[0];

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
    console.error('Erreur lors de l\'inscription:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}