// src/lib/gridSystem.ts - Système de grille de pixels fixe

/**
 * Configuration de la grille de pixels fixe
 * Chaque pixel a une position géographique fixe dans une grille mondiale
 */
export const GRID_CONFIG = {
  // Taille d'un pixel en degrés (plus petit = plus de pixels, plus de détail)
  PIXEL_SIZE_DEGREES: 0.001, // ~111 mètres à l'équateur, ~78 mètres à Paris

  // Zoom minimum pour voir les pixels (performance)
  MIN_ZOOM_VISIBLE: 12,

  // Taille des pixels affichés en pixels écran
  PIXEL_DISPLAY_SIZE: 8, // 8x8 pixels carrés sur l'écran

  // Limites du monde (projection Web Mercator)
  BOUNDS: {
    MIN_LAT: -85,   // Limite sud de Web Mercator
    MAX_LAT: 85,    // Limite nord de Web Mercator  
    MIN_LNG: -180,  // Antéméridien ouest
    MAX_LNG: 180    // Antéméridien est
  },

  // Configuration des chunks pour optimiser le chargement
  CHUNK_SIZE: 100, // 100x100 pixels par chunk
  MAX_PIXELS_PER_REQUEST: 10000, // Limite de pixels par requête API
};

/**
 * Convertit des coordonnées géographiques en position de grille
 * @param lat - Latitude en degrés
 * @param lng - Longitude en degrés
 * @returns Position dans la grille (entiers)
 */
export function geoToGrid(lat: number, lng: number): { x: number; y: number } {
  const { BOUNDS, PIXEL_SIZE_DEGREES } = GRID_CONFIG;

  // Normaliser les coordonnées dans les limites du monde
  const normalizedLat = Math.max(BOUNDS.MIN_LAT, Math.min(BOUNDS.MAX_LAT, lat));
  const normalizedLng = Math.max(BOUNDS.MIN_LNG, Math.min(BOUNDS.MAX_LNG, lng));

  // Convertir en position de grille (entiers)
  // X augmente vers l'est, Y augmente vers le sud (comme une image)
  const x = Math.floor((normalizedLng - BOUNDS.MIN_LNG) / PIXEL_SIZE_DEGREES);
  const y = Math.floor((BOUNDS.MAX_LAT - normalizedLat) / PIXEL_SIZE_DEGREES);

  return { x, y };
}

/**
 * Convertit une position de grille en coordonnées géographiques (centre du pixel)
 * @param gridX - Position X dans la grille
 * @param gridY - Position Y dans la grille
 * @returns Coordonnées du centre du pixel
 */
export function gridToGeo(gridX: number, gridY: number): { lat: number; lng: number } {
  const { BOUNDS, PIXEL_SIZE_DEGREES } = GRID_CONFIG;

  // Calculer les coordonnées du centre du pixel
  const lng = BOUNDS.MIN_LNG + (gridX * PIXEL_SIZE_DEGREES) + (PIXEL_SIZE_DEGREES / 2);
  const lat = BOUNDS.MAX_LAT - (gridY * PIXEL_SIZE_DEGREES) - (PIXEL_SIZE_DEGREES / 2);

  return { lat, lng };
}

/**
 * Obtient les limites géographiques exactes d'un pixel de grille
 * @param gridX - Position X dans la grille
 * @param gridY - Position Y dans la grille
 * @returns Limites du pixel (rectangle)
 */
export function getPixelBounds(gridX: number, gridY: number): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  const { BOUNDS, PIXEL_SIZE_DEGREES } = GRID_CONFIG;

  const west = BOUNDS.MIN_LNG + (gridX * PIXEL_SIZE_DEGREES);
  const east = west + PIXEL_SIZE_DEGREES;
  const north = BOUNDS.MAX_LAT - (gridY * PIXEL_SIZE_DEGREES);
  const south = north - PIXEL_SIZE_DEGREES;

  return { north, south, east, west };
}

/**
 * Calcule quels pixels de grille sont visibles dans une zone donnée
 * @param mapBounds - Limites de la zone visible
 * @param zoom - Niveau de zoom actuel
 * @returns Liste des positions de grille visibles
 */
export function getVisiblePixels(mapBounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}, zoom: number): Array<{ x: number; y: number }> {

  // Ne pas afficher les pixels si le zoom est trop faible (performance)
  if (zoom < GRID_CONFIG.MIN_ZOOM_VISIBLE) {
    return [];
  }

  // Convertir les limites de la carte en positions de grille
  const topLeft = geoToGrid(mapBounds.north, mapBounds.west);
  const bottomRight = geoToGrid(mapBounds.south, mapBounds.east);

  const pixels: Array<{ x: number; y: number }> = [];

  // Limiter le nombre de pixels pour éviter les surcharges
  const maxPixelsPerSide = Math.sqrt(GRID_CONFIG.MAX_PIXELS_PER_REQUEST);
  const pixelCountX = Math.min(bottomRight.x - topLeft.x + 1, maxPixelsPerSide);
  const pixelCountY = Math.min(bottomRight.y - topLeft.y + 1, maxPixelsPerSide);

  // Générer toutes les positions de grille visibles
  for (let x = topLeft.x; x < topLeft.x + pixelCountX; x++) {
    for (let y = topLeft.y; y < topLeft.y + pixelCountY; y++) {
      pixels.push({ x, y });
    }
  }

  console.log(`🎯 Pixels visibles: ${pixels.length} (zone: ${pixelCountX}x${pixelCountY})`);
  return pixels;
}

/**
 * Snap une position géographique à la grille la plus proche
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Position snappée à la grille avec coordonnées et indices
 */
export function snapToGrid(lat: number, lng: number): {
  lat: number;
  lng: number;
  gridX: number;
  gridY: number
} {
  const grid = geoToGrid(lat, lng);
  const snappedGeo = gridToGeo(grid.x, grid.y);

  return {
    lat: snappedGeo.lat,
    lng: snappedGeo.lng,
    gridX: grid.x,
    gridY: grid.y
  };
}

/**
 * Calcule la taille d'un pixel en pixels écran selon le zoom
 * @param zoom - Niveau de zoom
 * @returns Taille en pixels écran
 */
export function getPixelScreenSize(zoom: number): number {
  // Pour l'instant, taille fixe, mais on pourrait la faire varier avec le zoom
  const baseSize = GRID_CONFIG.PIXEL_DISPLAY_SIZE;

  // Optionnel: faire varier la taille avec le zoom
  // const scaleFactor = Math.max(0.5, Math.min(2, (zoom - 10) / 5));
  // return Math.round(baseSize * scaleFactor);

  return baseSize;
}

/**
 * Vérifie si on peut placer un pixel à cette position
 * @param gridX - Position X dans la grille
 * @param gridY - Position Y dans la grille  
 * @param existingPixels - Liste des pixels existants
 * @returns true si la position est libre
 */
export function canPlacePixelAt(
  gridX: number,
  gridY: number,
  existingPixels: Array<{ x: number, y: number }>
): boolean {
  // Vérifier si un pixel existe déjà à cette position
  return !existingPixels.some(pixel => pixel.x === gridX && pixel.y === gridY);
}

/**
 * Convertit une position de grille en identifiant de chunk
 * @param gridX - Position X dans la grille
 * @param gridY - Position Y dans la grille
 * @returns Coordonnées du chunk
 */
export function getChunkCoords(gridX: number, gridY: number): { chunkX: number; chunkY: number } {
  const chunkX = Math.floor(gridX / GRID_CONFIG.CHUNK_SIZE);
  const chunkY = Math.floor(gridY / GRID_CONFIG.CHUNK_SIZE);

  return { chunkX, chunkY };
}

/**
 * Obtient tous les chunks visibles dans une zone
 * @param mapBounds - Limites de la zone visible
 * @param zoom - Niveau de zoom
 * @returns Liste des chunks à charger
 */
export function getVisibleChunks(mapBounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}, zoom: number): Array<{ chunkX: number; chunkY: number }> {

  if (zoom < GRID_CONFIG.MIN_ZOOM_VISIBLE) {
    return [];
  }

  const topLeft = geoToGrid(mapBounds.north, mapBounds.west);
  const bottomRight = geoToGrid(mapBounds.south, mapBounds.east);

  const topLeftChunk = getChunkCoords(topLeft.x, topLeft.y);
  const bottomRightChunk = getChunkCoords(bottomRight.x, bottomRight.y);

  const chunks: Array<{ chunkX: number; chunkY: number }> = [];

  for (let chunkX = topLeftChunk.chunkX; chunkX <= bottomRightChunk.chunkX; chunkX++) {
    for (let chunkY = topLeftChunk.chunkY; chunkY <= bottomRightChunk.chunkY; chunkY++) {
      chunks.push({ chunkX, chunkY });
    }
  }

  return chunks;
}

/**
 * Calcule les statistiques de la grille
 * @param pixels - Liste des pixels
 * @returns Statistiques
 */
export function getGridStats(pixels: Array<{ gridX: number; gridY: number; color: string; username: string }>) {
  const totalPixels = pixels.length;
  const uniqueUsers = new Set(pixels.map(p => p.username)).size;
  const uniqueColors = new Set(pixels.map(p => p.color)).size;

  // Calculer la zone couverte
  const minX = Math.min(...pixels.map(p => p.gridX));
  const maxX = Math.max(...pixels.map(p => p.gridX));
  const minY = Math.min(...pixels.map(p => p.gridY));
  const maxY = Math.max(...pixels.map(p => p.gridY));

  const coveredArea = (maxX - minX + 1) * (maxY - minY + 1);
  const density = totalPixels / coveredArea;

  return {
    totalPixels,
    uniqueUsers,
    uniqueColors,
    coveredArea,
    density: Math.round(density * 100) / 100,
    bounds: { minX, maxX, minY, maxY }
  };
}

/**
 * Valide les coordonnées de grille
 * @param gridX - Position X
 * @param gridY - Position Y
 * @returns true si les coordonnées sont valides
 */
export function isValidGridPosition(gridX: number, gridY: number): boolean {
  // Calculer les limites de la grille
  const worldSize = {
    width: (GRID_CONFIG.BOUNDS.MAX_LNG - GRID_CONFIG.BOUNDS.MIN_LNG) / GRID_CONFIG.PIXEL_SIZE_DEGREES,
    height: (GRID_CONFIG.BOUNDS.MAX_LAT - GRID_CONFIG.BOUNDS.MIN_LAT) / GRID_CONFIG.PIXEL_SIZE_DEGREES
  };

  return gridX >= 0 && gridX < worldSize.width &&
    gridY >= 0 && gridY < worldSize.height;
}

/**
 * Génère un identifiant unique pour un pixel
 * @param gridX - Position X
 * @param gridY - Position Y
 * @returns Identifiant unique
 */
export function getPixelId(gridX: number, gridY: number): string {
  return `${gridX},${gridY}`;
}

/**
 * Parse un identifiant de pixel
 * @param pixelId - Identifiant du pixel
 * @returns Coordonnées de grille
 */
export function parsePixelId(pixelId: string): { gridX: number; gridY: number } | null {
  const parts = pixelId.split(',').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { gridX: parts[0], gridY: parts[1] };
  }
  return null;
}