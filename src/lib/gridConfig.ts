// src/lib/gridConfig.ts - Configuration de grille optimisée inspirée de wplace.live

/**
 * Configuration principale de la grille de pixels
 * Système de coordonnées fixes inspiré de wplace.live
 */
export const GRID_CONFIG = {
    // Système de grille mondiale - taille des pixels
    PIXEL_SIZE_DEGREES: 0.0001, // Plus petit pour plus de détail

    // Système de tiles/chunks pour optimiser le chargement
    TILE_SIZE: 256, // 256x256 pixels par tile (standard cartographique)
    CHUNK_SIZE: 64,  // 64x64 pixels par chunk pour requêtes DB

    // Limites du monde (projection Web Mercator)
    WORLD_BOUNDS: {
        MIN_LAT: -85.0511,   // Limite technique Web Mercator
        MAX_LAT: 85.0511,    // Limite technique Web Mercator  
        MIN_LNG: -180,       // Antéméridien ouest
        MAX_LNG: 180         // Antéméridien est
    },

    // Niveaux de zoom pour affichage
    ZOOM: {
        MIN_VISIBLE: 14,      // Zoom minimum pour voir les pixels
        MAX_DETAIL: 20,       // Zoom maximum supporté
        GRID_VISIBLE: 16,     // Zoom pour voir la grille
        SNAP_ENABLED: 15      // Zoom pour activer le snap
    },

    // Performance et limites
    MAX_PIXELS_PER_TILE: 65536, // 256*256
    MAX_PIXELS_PER_REQUEST: 4096, // Limite par requête API

    // Rendu visuel
    PIXEL_BORDER_WIDTH: 1,
    GRID_OPACITY: 0.3,
    PIXEL_OPACITY: 0.9,

    // Système de cooldown (inspiré wplace.live)
    COOLDOWN_SECONDS: 30,

    // Anti-spam et rate limiting
    MAX_PIXELS_PER_MINUTE: 5,
    MAX_PIXELS_PER_HOUR: 60,

    // Cache et optimisation
    TILE_CACHE_TTL: 300, // 5 minutes
    CHUNK_CACHE_TTL: 60, // 1 minute
};

/**
 * Palette de couleurs officielle (inspirée wplace.live)
 * 64 couleurs au total - certaines gratuites, d'autres premium
 */
export const COLOR_PALETTE = {
    // Couleurs gratuites (24 couleurs)
    FREE: [
        '#FFFFFF', '#E4E4E4', '#888888', '#222222', // Gris
        '#FF0000', '#FF8800', '#FFFF00', '#88FF00', // Rouge-Jaune
        '#00FF00', '#00FF88', '#00FFFF', '#0088FF', // Vert-Cyan
        '#0000FF', '#8800FF', '#FF00FF', '#FF0088', // Bleu-Magenta
        '#8B4513', '#A0522D', '#D2691E', '#F4A460', // Marrons
        '#FFB6C1', '#FFC0CB', '#FF69B4', '#FF1493'  // Roses
    ],

    // Couleurs premium (40 couleurs supplémentaires)
    PREMIUM: [
        '#F0F8FF', '#FAEBD7', '#7FFFD4', '#F0FFFF', '#F5F5DC',
        '#FFE4C4', '#000000', '#0000CD', '#8A2BE2', '#A52A2A',
        '#DEB887', '#5F9EA0', '#7FFF00', '#D2691E', '#FF7F50',
        '#6495ED', '#DC143C', '#00FFFF', '#00008B', '#008B8B',
        '#B8860B', '#A9A9A9', '#006400', '#BDB76B', '#8B008B',
        '#556B2F', '#FF8C00', '#9932CC', '#8B0000', '#E9967A',
        '#8FBC8F', '#483D8B', '#2F4F4F', '#00CED1', '#9400D3',
        '#FF1493', '#00BFFF', '#696969', '#1E90FF', '#B22222'
    ]
} as const;

/**
 * Types de couleurs
 */
export type ColorType = 'FREE' | 'PREMIUM';

/**
 * Interface pour une couleur avec métadonnées
 */
export interface ColorInfo {
    hex: string;
    type: ColorType;
    name?: string;
    index: number;
}

/**
 * Obtient toutes les couleurs disponibles
 */
export function getAllColors(): ColorInfo[] {
    const colors: ColorInfo[] = [];

    COLOR_PALETTE.FREE.forEach((hex, index) => {
        colors.push({
            hex,
            type: 'FREE',
            index: index
        });
    });

    COLOR_PALETTE.PREMIUM.forEach((hex, index) => {
        colors.push({
            hex,
            type: 'PREMIUM',
            index: index + COLOR_PALETTE.FREE.length
        });
    });

    return colors;
}

/**
 * Vérifie si une couleur est valide
 */
export function isValidColor(hex: string): boolean {
    return COLOR_PALETTE.FREE.includes(hex as any) ||
        COLOR_PALETTE.PREMIUM.includes(hex as any);
}

/**
 * Vérifie si une couleur est gratuite
 */
export function isFreeColor(hex: string): boolean {
    return COLOR_PALETTE.FREE.includes(hex as any);
}

/**
 * Obtient le type d'une couleur
 */
export function getColorType(hex: string): ColorType | null {
    if (COLOR_PALETTE.FREE.includes(hex as any)) return 'FREE';
    if (COLOR_PALETTE.PREMIUM.includes(hex as any)) return 'PREMIUM';
    return null;
}

/**
 * Calcule les dimensions de la grille mondiale
 */
export function getWorldGridDimensions() {
    const { WORLD_BOUNDS, PIXEL_SIZE_DEGREES } = GRID_CONFIG;

    const width = Math.floor((WORLD_BOUNDS.MAX_LNG - WORLD_BOUNDS.MIN_LNG) / PIXEL_SIZE_DEGREES);
    const height = Math.floor((WORLD_BOUNDS.MAX_LAT - WORLD_BOUNDS.MIN_LAT) / PIXEL_SIZE_DEGREES);

    return { width, height, totalPixels: width * height };
}

/**
 * Calcule le nombre de tiles nécessaires
 */
export function getWorldTileDimensions() {
    const gridDims = getWorldGridDimensions();
    const { TILE_SIZE } = GRID_CONFIG;

    const tilesX = Math.ceil(gridDims.width / TILE_SIZE);
    const tilesY = Math.ceil(gridDims.height / TILE_SIZE);

    return { tilesX, tilesY, totalTiles: tilesX * tilesY };
}