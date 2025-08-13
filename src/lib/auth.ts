// src/lib/auth.ts

import jwt from 'jsonwebtoken';
import { pool, User } from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';

export interface JWTPayload {
  userId: number;
  username: string;
  email: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
}

/**
 * Génère un token JWT pour un utilisateur
 */
export function generateToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    email: user.email
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d', // Token valide 7 jours
    issuer: 'wplace-clone',
    audience: 'wplace-users'
  });
}

/**
 * Vérifie et décode un token JWT
 */
export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // Vérifier que l'utilisateur existe toujours
    const result = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];

  } catch (error) {
    console.error('Erreur lors de la vérification du token:', error);
    return null;
  }
}

/**
 * Middleware pour vérifier l'authentification
 */
export async function requireAuth(token?: string): Promise<AuthUser> {
  if (!token) {
    throw new Error('Token d\'authentification requis');
  }

  const user = await verifyToken(token);
  if (!user) {
    throw new Error('Token invalide ou expiré');
  }

  return user;
}