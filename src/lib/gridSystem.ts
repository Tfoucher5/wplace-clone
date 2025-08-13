// src/lib/gridSystem.ts - Système de grille de pixels fixe

/**
 * Configuration de la grille de pixels fixe
 * Chaque pixel a une position géographique fixe
 */
export const GRID_CONFIG = {
  // Taille d'un pixel en degrés (plus petit = plus de pixels)
  PIXEL_SIZE_DEGREES: 0.001, // ~111 mètres à l'équateur

  // Zoom minimum pour voir les pixels
  MIN_ZOOM_VISIBLE: 12,

  // Taille des pixels affichés en pixels écran
  PIXEL_DISPLAY_SIZE: 8, // 8x8 pixels carrés

  // Limites du monde
  BOUNDS: {
    MIN_LAT: -85,
    MAX_LAT: 85,
    MIN_LNG: -180,
    MAX_LNG: 180
  }
};

/**
 * Convertit des coordonnées géographiques en position de grille
 */
export function geoToGrid(lat: number, lng: number): { x: number; y: number } {
  const { BOUNDS, PIXEL_SIZE_DEGREES } = GRID_CONFIG;

  // Normaliser les coordonnées dans les limites
  const normalizedLat = Math.max(BOUNDS.MIN_LAT, Math.min(BOUNDS.MAX_LAT, lat));
  const normalizedLng = Math.max(BOUNDS.MIN_LNG, Math.min(BOUNDS.MAX_LNG, lng));

  // Convertir en position de grille (entiers)
  const x = Math.floor((normalizedLng - BOUNDS.MIN_LNG) / PIXEL_SIZE_DEGREES);
  const y = Math.floor((BOUNDS.MAX_LAT - normalizedLat) / PIXEL_SIZE_DEGREES);

  return { x, y };
}

/**
 * Convertit une position de grille en coordonnées géographiques (centre du pixel)
 */
export function gridToGeo(gridX: number, gridY: number): { lat: number; lng: number } {
  const { BOUNDS, PIXEL_SIZE_DEGREES } = GRID_CONFIG;

  // Calculer les coordonnées du centre du pixel
  const lng = BOUNDS.MIN_LNG + (gridX * PIXEL_SIZE_DEGREES) + (PIXEL_SIZE_DEGREES / 2);
  const lat = BOUNDS.MAX_LAT - (gridY * PIXEL_SIZE_DEGREES) - (PIXEL_SIZE_DEGREES / 2);

  return { lat, lng };
}

/**
 * Obtient les limites géographiques d'un pixel de grille
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
 */
export function getVisiblePixels(mapBounds: {
  north: number;
  south: number;
  east: number;
  west: number;
}, zoom: number): Array<{ x: number; y: number }> {

  // Ne pas afficher les pixels si le zoom est trop faible
  if (zoom < GRID_CONFIG.MIN_ZOOM_VISIBLE) {
    return [];
  }

  // Convertir les limites de la carte en positions de grille
  const topLeft = geoToGrid(mapBounds.north, mapBounds.west);
  const bottomRight = geoToGrid(mapBounds.south, mapBounds.east);

  const pixels: Array<{ x: number; y: number }> = [];

  // Générer toutes les positions de grille visibles
  for (let x = topLeft.x; x <= bottomRight.x; x++) {
    for (let y = topLeft.y; y <= bottomRight.y; y++) {
      pixels.push({ x, y });
    }
  }

  return pixels;
}

/**
 * Snap une position géographique à la grille la plus proche
 */
export function snapToGrid(lat: number, lng: number): { lat: number; lng: number; gridX: number; gridY: number } {
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
 */
export function getPixelScreenSize(zoom: number): number {
  // Taille fixe pour commencer
  return GRID_CONFIG.PIXEL_DISPLAY_SIZE;
}

/**
 * Vérifie si on peut placer un pixel à cette position
 */
export function canPlacePixelAt(gridX: number, gridY: number, existingPixels: Array<{ x: number, y: number }>): boolean {
  // Vérifier si un pixel existe déjà à cette position
  return !existingPixels.some(pixel => pixel.x === gridX && pixel.y === gridY);
}