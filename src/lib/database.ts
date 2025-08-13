// src/lib/database.ts - Types et utilitaires pour la base de données

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  pixels_placed: number;
  last_pixel_time?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Pixel {
  id: number;
  lat: number;
  lng: number;
  grid_x: number;
  grid_y: number;
  color: string;
  user_id: number;
  placed_at: Date;
}

export interface PixelChunk {
  id: number;
  chunk_x: number;
  chunk_y: number;
  zoom_level: number;
  pixel_count: number;
  last_updated: Date;
}

export interface Alliance {
  id: number;
  name: string;
  description?: string;
  color: string;
  created_by: number;
  created_at: Date;
}

export interface UserAlliance {
  user_id: number;
  alliance_id: number;
  joined_at: Date;
}

// Types pour l'API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Types pour les requêtes
export interface PlacePixelRequest {
  lat: number;
  lng: number;
  gridX: number;
  gridY: number;
  color: string;
}

export interface GetPixelsRequest {
  chunkX?: number;
  chunkY?: number;
  minX?: number;
  maxX?: number;
  minY?: number;
  maxY?: number;
  limit?: number;
  offset?: number;
}

export interface AuthRequest {
  username: string;
  password: string;
  email?: string; // Pour l'inscription
}

// Types pour les réponses
export interface AuthResponse {
  token: string;
  user: {
    id: number;
    username: string;
    email: string;
    pixelsPlaced: number;
    lastPixelTime?: string;
    createdAt: string;
  };
}

export interface PixelResponse {
  pixel: {
    id: number;
    lat: number;
    lng: number;
    gridX: number;
    gridY: number;
    color: string;
    username: string;
    placedAt: string;
  };
  user: {
    id: number;
    username: string;
    pixelsPlaced: number;
    lastPixelTime: string;
  };
}

export interface UserStats {
  id: number;
  username: string;
  pixels_placed: number;
  pixels_current: number;
  alliance_name?: string;
  rank: number;
  last_active: Date;
}

// Utilitaires de validation
export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validatePixelColor(color: string): boolean {
  // Valider le format hex (#RRGGBB)
  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  return hexRegex.test(color);
}

export function validateGridPosition(gridX: number, gridY: number): boolean {
  // Vérifier que les positions sont des entiers valides
  return Number.isInteger(gridX) && Number.isInteger(gridY) &&
    gridX >= 0 && gridY >= 0;
}

export function validateUsername(username: string): string | null {
  if (!username || username.length < 3) {
    return 'Le nom d\'utilisateur doit contenir au moins 3 caractères';
  }
  if (username.length > 50) {
    return 'Le nom d\'utilisateur ne peut pas dépasser 50 caractères';
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, _ et -';
  }
  return null;
}

export function validateEmail(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'Adresse email invalide';
  }
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password || password.length < 6) {
    return 'Le mot de passe doit contenir au moins 6 caractères';
  }
  if (password.length > 100) {
    return 'Le mot de passe ne peut pas dépasser 100 caractères';
  }
  return null;
}

// Utilitaires de conversion pour l'API
export function userToApiUser(user: User): AuthResponse['user'] {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    pixelsPlaced: user.pixels_placed,
    lastPixelTime: user.last_pixel_time?.toISOString(),
    createdAt: user.created_at.toISOString(),
  };
}

export function pixelToApiPixel(pixel: Pixel & { username: string }): PixelResponse['pixel'] {
  return {
    id: pixel.id,
    lat: pixel.lat,
    lng: pixel.lng,
    gridX: pixel.grid_x,
    gridY: pixel.grid_y,
    color: pixel.color,
    username: pixel.username,
    placedAt: pixel.placed_at.toISOString(),
  };
}

// Configuration de l'API
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || '/api',
  COOLDOWN_SECONDS: 30,
  MAX_PIXELS_PER_REQUEST: 10000,
  MAX_USERNAME_LENGTH: 50,
  MIN_USERNAME_LENGTH: 3,
  MIN_PASSWORD_LENGTH: 6,
  CHUNK_SIZE: 100,
  RATE_LIMITS: {
    PIXELS_PER_MINUTE: 2,
    REQUESTS_PER_MINUTE: 60,
    REGISTRATION_PER_HOUR: 5,
  }
};

// Couleurs autorisées (palette r/place)
export const ALLOWED_COLORS = [
  '#FFFFFF', '#E4E4E4', '#888888', '#222222', // Noir et blanc
  '#FFA7D1', '#E50000', '#E59500', '#A06A42', // Roses et rouges
  '#E5D900', '#94E044', '#02BE01', '#00D3DD', // Jaunes et verts
  '#0083C7', '#0000EA', '#CF6EE4', '#820080'  // Bleus et violets
];

export function isValidColor(color: string): boolean {
  return ALLOWED_COLORS.includes(color.toUpperCase());
}

// Gestion des erreurs
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Trop de requêtes, veuillez patienter') {
    super(429, message, 'RATE_LIMIT');
  }
}

export class CooldownError extends ApiError {
  constructor(remainingSeconds: number) {
    super(400, `Cooldown actif: ${remainingSeconds}s restantes`, 'COOLDOWN');
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Non authentifié') {
    super(401, message, 'AUTH_REQUIRED');
  }
}

export class ValidationApiError extends ApiError {
  constructor(field: string, message: string) {
    super(400, message, 'VALIDATION_ERROR');
  }
}

// Utilitaires pour les chunks
export function getChunkKey(chunkX: number, chunkY: number, zoomLevel: number = 1): string {
  return `${chunkX},${chunkY},${zoomLevel}`;
}

export function parseChunkKey(key: string): { chunkX: number; chunkY: number; zoomLevel: number } | null {
  const parts = key.split(',').map(Number);
  if (parts.length === 3 && parts.every(n => !isNaN(n))) {
    return { chunkX: parts[0], chunkY: parts[1], zoomLevel: parts[2] };
  }
  return null;
}

// Cache en mémoire simple pour les pixels (côté client)
class PixelCache {
  private cache = new Map<string, { pixels: any[]; timestamp: number }>();
  private readonly TTL = 30000; // 30 secondes

  set(key: string, pixels: any[]): void {
    this.cache.set(key, {
      pixels: [...pixels],
      timestamp: Date.now()
    });
  }

  get(key: string): any[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Vérifier l'expiration
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.pixels;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const pixelCache = new PixelCache();