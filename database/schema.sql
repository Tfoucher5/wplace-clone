-- database/schema.sql

-- Table des utilisateurs
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    pixels_placed INTEGER DEFAULT 0,
    last_pixel_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des pixels avec coordonnées géographiques fixes
CREATE TABLE pixels (
    id SERIAL PRIMARY KEY,
    lat DECIMAL(10, 8) NOT NULL, -- Latitude avec précision
    lng DECIMAL(11, 8) NOT NULL, -- Longitude avec précision
    grid_x INTEGER NOT NULL,     -- Position X dans la grille
    grid_y INTEGER NOT NULL,     -- Position Y dans la grille
    color VARCHAR(7) NOT NULL,   -- Code couleur hex (#FF0000)
    user_id INTEGER REFERENCES users(id),
    placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(grid_x, grid_y)       -- Un seul pixel par position de grille
);

-- Index pour optimiser les requêtes par zone géographique
CREATE INDEX idx_pixels_grid ON pixels(grid_x, grid_y);
CREATE INDEX idx_pixels_geo ON pixels(lat, lng);
CREATE INDEX idx_pixels_placed_at ON pixels(placed_at);

-- Table des chunks/tuiles pour optimiser le chargement
CREATE TABLE pixel_chunks (
    id SERIAL PRIMARY KEY,
    chunk_x INTEGER NOT NULL,
    chunk_y INTEGER NOT NULL,
    zoom_level INTEGER NOT NULL,
    pixel_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chunk_x, chunk_y, zoom_level)
);

-- Index pour les chunks
CREATE INDEX idx_chunks_coords ON pixel_chunks(chunk_x, chunk_y, zoom_level);

-- Table pour les alliances/équipes
CREATE TABLE alliances (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7) NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de liaison users-alliances
CREATE TABLE user_alliances (
    user_id INTEGER REFERENCES users(id),
    alliance_id INTEGER REFERENCES alliances(id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(user_id, alliance_id)
);

-- Vue pour les statistiques
CREATE VIEW user_stats AS
SELECT 
    u.id,
    u.username,
    u.pixels_placed,
    COUNT(p.id) as pixels_current,
    a.name as alliance_name
FROM users u
LEFT JOIN pixels p ON u.id = p.user_id
LEFT JOIN user_alliances ua ON u.id = ua.user_id
LEFT JOIN alliances a ON ua.alliance_id = a.id
GROUP BY u.id, u.username, u.pixels_placed, a.name;