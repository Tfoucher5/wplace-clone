// src/lib/database.ts

import { Pool } from 'pg';
import Redis from 'ioredis';

// Configuration PostgreSQL
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'wplace',
  password: 'your_password', // Change ça
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Configuration Redis
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
});

export { pool, redis };

// Types pour la base de données
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