// src/lib/pixelGridSystem.ts - Système de grille de pixels optimisé

import { GRID_CONFIG, COLOR_PALETTE, isValidColor } from './gridConfig';

/**
 * Interface pour les coordonnées de grille
 */
export interface GridCoordinates {
  gridX: number;
  gridY: number;
}

/**
 * Interface pour les coordonnées géographiques
 */
export interface GeoCoordinates {
  lat: number;
  lng: number;
}

/**
 * Interface pour les coordonnées de tile
 */
export interface TileCoordinates {
  tileX: number;
  tileY: number;
  zoom: number;
}

/**
 * Interface pour les coordonnées de chunk
 */
export interface ChunkCoordinates {
  chunkX: number;
  chunkY: number;
}

/**
 * Interface pour un pixel complet
 */
export interface Pixel {
  id?: number;
  gridX: number;
  gridY: number;
  lat: number;
  lng: number;
  color: string;
  userId: number;
  username: string;
  placedAt: Date;
  tileX?: number;
  tileY?: number;
  chunkX?: number;
  chunkY?: number;
}

/**
 * Interface pour les limites d'une zone
 */
export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * Convertit des coordonnées géographiques en position de grille
 * Utilise un système de grille fixe mondiale comme wplace.live
 */
export function geoToGrid(lat: number, lng: number): GridCoordinates {
  const { WORLD_BOUNDS, PIXEL_SIZE_DEGREES } = GRID_CONFIG;

  // Clamper les coordonnées dans les limites du monde
  const clampedLat = Math.max(WORLD_BOUNDS.MIN_LAT, Math.min(WORLD_BOUNDS.MAX_LAT, lat));
  const clampedLng = Math.max(WORLD_BOUNDS.MIN_LNG, Math.min(WORLD_BOUNDS.MAX_LNG, lng));

  // Convertir en position de grille (entiers)
  const gridX = Math.floor((clampedLng - WORLD_BOUNDS.MIN_LNG) / PIXEL_SIZE_DEGREES);
  const gridY = Math.floor((WORLD_BOUNDS.MAX_LAT - clampedLat) / PIXEL_SIZE_DEGREES);

  return { gridX, gridY };
}

/**
 * Convertit une position de grille en coordonnées géographiques (centre du pixel)
 */
export function gridToGeo(gridX: number, gridY: number): GeoCoordinates {
  const { WORLD_BOUNDS, PIXEL_SIZE_DEGREES } = GRID_CONFIG;

  // Calculer les coordonnées du centre du pixel
  const lng = WORLD_BOUNDS.MIN_LNG + (gridX + 0.5) * PIXEL_SIZE_DEGREES;
  const lat = WORLD_BOUNDS.MAX_LAT - (gridY + 0.5) * PIXEL_SIZE_DEGREES;

  return { lat, lng };
}

/**
 * Obtient les limites géographiques exactes d'un pixel
 */
export function getPixelBounds(gridX: number, gridY: number): Bounds {
  const { WORLD_BOUNDS, PIXEL_SIZE_DEGREES } = GRID_CONFIG;

  const west = WORLD_BOUNDS.MIN_LNG + gridX * PIXEL_SIZE_DEGREES;
  const east = west + PIXEL_SIZE_DEGREES;
  const north = WORLD_BOUNDS.MAX_LAT - gridY * PIXEL_SIZE_DEGREES;
  const south = north - PIXEL_SIZE_DEGREES;

  return { north, south, east, west };
}

/**
 * Snap une position géographique à la grille la plus proche
 */
export function snapToGrid(lat: number, lng: number): GeoCoordinates & GridCoordinates {
  const grid = geoToGrid(lat, lng);
  const geo = gridToGeo(grid.gridX, grid.gridY);

  return {
    lat: geo.lat,
    lng: geo.lng,
    gridX: grid.gridX,
    gridY: grid.gridY
  };
}

/**
 * Convertit des coordonnées de grille en coordonnées de tile
 */
export function gridToTile(gridX: number, gridY: number, zoom: number = 18): TileCoordinates {
  const { TILE_SIZE } = GRID_CONFIG;

  // Calcul simple : diviser par la taille de tile
  const tileX = Math.floor(gridX / TILE_SIZE);
  const tileY = Math.floor(gridY / TILE_SIZE);

  return { tileX, tileY, zoom };
}

/**
 * Convertit des coordonnées de grille en coordonnées de chunk
 */
export function gridToChunk(gridX: number, gridY: number): ChunkCoordinates {
  const { CHUNK_SIZE } = GRID_CONFIG;

  const chunkX = Math.floor(gridX / CHUNK_SIZE);
  const chunkY = Math.floor(gridY / CHUNK_SIZE);

  return { chunkX, chunkY };
}

/**
 * Obtient tous les chunks visibles dans une zone
 */
export function getVisibleChunks(bounds: Bounds): ChunkCoordinates[] {
  const topLeft = geoToGrid(bounds.north, bounds.west);
  const bottomRight = geoToGrid(bounds.south, bounds.east);

  const topLeftChunk = gridToChunk(topLeft.gridX, topLeft.gridY);
  const bottomRightChunk = gridToChunk(bottomRight.gridX, bottomRight.gridY);

  const chunks: ChunkCoordinates[] = [];

  for (let chunkX = topLeftChunk.chunkX; chunkX <= bottomRightChunk.chunkX; chunkX++) {
    for (let chunkY = topLeftChunk.chunkY; chunkY <= bottomRightChunk.chunkY; chunkY++) {
      chunks.push({ chunkX, chunkY });
    }
  }

  return chunks;
}

/**
 * Obtient toutes les positions de grille dans un chunk
 */
export function getChunkGridPositions(chunkX: number, chunkY: number): GridCoordinates[] {
  const { CHUNK_SIZE } = GRID_CONFIG;
  const positions: GridCoordinates[] = [];

  const startX = chunkX * CHUNK_SIZE;
  const startY = chunkY * CHUNK_SIZE;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      positions.push({
        gridX: startX + x,
        gridY: startY + y
      });
    }
  }

  return positions;
}

/**
 * Calcule quels pixels de grille sont visibles dans une zone donnée
 */
export function getVisiblePixels(bounds: Bounds, zoom: number): GridCoordinates[] {
  // Ne pas afficher les pixels si le zoom est trop faible
  if (zoom < GRID_CONFIG.ZOOM.MIN_VISIBLE) {
    return [];
  }

  const topLeft = geoToGrid(bounds.north, bounds.west);
  const bottomRight = geoToGrid(bounds.south, bounds.east);

  const pixels: GridCoordinates[] = [];

  // Limiter le nombre de pixels pour éviter les surcharges
  const maxPixelsPerSide = Math.sqrt(GRID_CONFIG.MAX_PIXELS_PER_REQUEST);
  const pixelCountX = Math.min(bottomRight.gridX - topLeft.gridX + 1, maxPixelsPerSide);
  const pixelCountY = Math.min(bottomRight.gridY - topLeft.gridY + 1, maxPixelsPerSide);

  // Générer toutes les positions de grille visibles
  for (let x = topLeft.gridX; x < topLeft.gridX + pixelCountX; x++) {
    for (let y = topLeft.gridY; y < topLeft.gridY + pixelCountY; y++) {
      if (isValidGridPosition(x, y)) {
        pixels.push({ gridX: x, gridY: y });
      }
    }
  }

  console.log(`🎯 Pixels visibles: ${pixels.length} (zone: ${pixelCountX}x${pixelCountY}) - Zoom: ${zoom}`);
  return pixels;
}

/**
 * Vérifie si une position de grille est valide
 */
export function isValidGridPosition(gridX: number, gridY: number): boolean {
  const { WORLD_BOUNDS, PIXEL_SIZE_DEGREES } = GRID_CONFIG;

  const maxGridX = Math.floor((WORLD_BOUNDS.MAX_LNG - WORLD_BOUNDS.MIN_LNG) / PIXEL_SIZE_DEGREES);
  const maxGridY = Math.floor((WORLD_BOUNDS.MAX_LAT - WORLD_BOUNDS.MIN_LAT) / PIXEL_SIZE_DEGREES);

  return gridX >= 0 && gridX < maxGridX && gridY >= 0 && gridY < maxGridY;
}

/**
 * Génère un identifiant unique pour un pixel
 */
export function getPixelId(gridX: number, gridY: number): string {
  return `${gridX},${gridY}`;
}

/**
 * Parse un identifiant de pixel
 */
export function parsePixelId(pixelId: string): GridCoordinates | null {
  const parts = pixelId.split(',').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { gridX: parts[0], gridY: parts[1] };
  }
  return null;
}

/**
 * Génère un identifiant pour un chunk
 */
export function getChunkId(chunkX: number, chunkY: number): string {
  return `chunk_${chunkX}_${chunkY}`;
}

/**
 * Génère un identifiant pour un tile
 */
export function getTileId(tileX: number, tileY: number, zoom: number): string {
  return `tile_${zoom}_${tileX}_${tileY}`;
}

/**
 * Valide les données d'un pixel avant placement
 */
export function validatePixelPlacement(pixel: Partial<Pixel>): { valid: boolean; error?: string } {
  // Vérifier les coordonnées
  if (typeof pixel.gridX !== 'number' || typeof pixel.gridY !== 'number') {
    return { valid: false, error: 'Coordonnées de grille invalides' };
  }

  if (!isValidGridPosition(pixel.gridX, pixel.gridY)) {
    return { valid: false, error: 'Position de grille hors limites' };
  }

  // Vérifier la couleur
  if (!pixel.color || !isValidColor(pixel.color)) {
    return { valid: false, error: 'Couleur invalide' };
  }

  // Vérifier l'utilisateur
  if (!pixel.userId || pixel.userId <= 0) {
    return { valid: false, error: 'Utilisateur invalide' };
  }

  return { valid: true };
}

/**
 * Calcule les statistiques d'une zone de pixels
 */
export function calculatePixelStats(pixels: Pixel[]) {
  if (pixels.length === 0) {
    return {
      totalPixels: 0,
      uniqueUsers: 0,
      uniqueColors: 0,
      coveredArea: 0,
      density: 0,
      bounds: null
    };
  }

  const uniqueUsers = new Set(pixels.map(p => p.username)).size;
  const uniqueColors = new Set(pixels.map(p => p.color)).size;

  const minX = Math.min(...pixels.map(p => p.gridX));
  const maxX = Math.max(...pixels.map(p => p.gridX));
  const minY = Math.min(...pixels.map(p => p.gridY));
  const maxY = Math.max(...pixels.map(p => p.gridY));

  const coveredArea = (maxX - minX + 1) * (maxY - minY + 1);
  const density = pixels.length / coveredArea;

  return {
    totalPixels: pixels.length,
    uniqueUsers,
    uniqueColors,
    coveredArea,
    density: Math.round(density * 100) / 100,
    bounds: { minX, maxX, minY, maxY }
  };
}

/**
 * Optimise le chargement de pixels par chunks
 */
export function optimizePixelLoading(bounds: Bounds, zoom: number): {
  strategy: 'FULL' | 'CHUNKED' | 'TILED';
  chunks?: ChunkCoordinates[];
  tiles?: TileCoordinates[];
  maxPixels: number;
} {
  const area = Math.abs((bounds.north - bounds.south) * (bounds.east - bounds.west));
  const estimatedPixels = area / (GRID_CONFIG.PIXEL_SIZE_DEGREES ** 2);

  if (estimatedPixels < 100) {
    return { strategy: 'FULL', maxPixels: Math.floor(estimatedPixels) };
  } else if (estimatedPixels < 10000) {
    return {
      strategy: 'CHUNKED',
      chunks: getVisibleChunks(bounds),
      maxPixels: GRID_CONFIG.MAX_PIXELS_PER_REQUEST
    };
  } else {
    const topLeft = geoToGrid(bounds.north, bounds.west);
    const bottomRight = geoToGrid(bounds.south, bounds.east);
    const topLeftTile = gridToTile(topLeft.gridX, topLeft.gridY, zoom);
    const bottomRightTile = gridToTile(bottomRight.gridX, bottomRight.gridY, zoom);

    const tiles: TileCoordinates[] = [];
    for (let x = topLeftTile.tileX; x <= bottomRightTile.tileX; x++) {
      for (let y = topLeftTile.tileY; y <= bottomRightTile.tileY; y++) {
        tiles.push({ tileX: x, tileY: y, zoom });
      }
    }

    return {
      strategy: 'TILED',
      tiles,
      maxPixels: GRID_CONFIG.MAX_PIXELS_PER_TILE
    };
  }
}