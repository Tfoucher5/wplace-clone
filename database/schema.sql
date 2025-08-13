-- database/schema.sql - Schéma de base de données optimisé pour wplace.live
-- Base de données principale
CREATE DATABASE IF NOT EXISTS wplace_db;

USE wplace_db;

-- Table des utilisateurs
CREATE TABLE
    users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_premium BOOLEAN DEFAULT FALSE,
        pixels_placed INT DEFAULT 0,
        last_pixel_time TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        -- Index pour les performances
        INDEX idx_username (username),
        INDEX idx_email (email),
        INDEX idx_last_pixel_time (last_pixel_time),
        INDEX idx_pixels_placed (pixels_placed)
    );

-- Table des pixels (optimisée pour les requêtes spatiales)
CREATE TABLE
    pixels (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        grid_x INT NOT NULL,
        grid_y INT NOT NULL,
        lat DECIMAL(10, 7) NOT NULL,
        lng DECIMAL(10, 7) NOT NULL,
        color VARCHAR(7) NOT NULL, -- Format #RRGGBB
        user_id INT NOT NULL,
        placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        -- Coordonnées de chunk pour optimisation
        chunk_x INT NOT NULL,
        chunk_y INT NOT NULL,
        -- Coordonnées de tile pour cache
        tile_x INT NULL,
        tile_y INT NULL,
        zoom_level TINYINT DEFAULT 18,
        -- Clé étrangère
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        -- Index unique pour éviter les doublons de position
        UNIQUE KEY unique_position (grid_x, grid_y),
        -- Index optimisés pour les requêtes spatiales
        INDEX idx_grid_coordinates (grid_x, grid_y),
        INDEX idx_chunk_coordinates (chunk_x, chunk_y),
        INDEX idx_tile_coordinates (tile_x, tile_y, zoom_level),
        INDEX idx_placed_at (placed_at),
        INDEX idx_user_id (user_id),
        INDEX idx_color (color),
        -- Index composé pour les requêtes de zone
        INDEX idx_grid_area (grid_x, grid_y, placed_at),
        INDEX idx_chunk_area (chunk_x, chunk_y, placed_at),
        -- Index spatial (si MySQL 8.0+)
        -- SPATIAL INDEX idx_spatial_coords (POINT(lng, lat))
    );

-- Table des chunks pour cache et optimisation
CREATE TABLE
    pixel_chunks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        chunk_x INT NOT NULL,
        chunk_y INT NOT NULL,
        zoom_level TINYINT NOT NULL,
        pixel_count INT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        -- Métadonnées du chunk
        min_grid_x INT NULL,
        max_grid_x INT NULL,
        min_grid_y INT NULL,
        max_grid_y INT NULL,
        -- Index
        UNIQUE KEY unique_chunk (chunk_x, chunk_y, zoom_level),
        INDEX idx_last_updated (last_updated),
        INDEX idx_pixel_count (pixel_count)
    );

-- Table des tiles pour cache de rendu
CREATE TABLE
    pixel_tiles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tile_x INT NOT NULL,
        tile_y INT NOT NULL,
        zoom_level TINYINT NOT NULL,
        -- Cache des données du tile
        pixel_data JSON NULL, -- Données des pixels dans ce tile
        image_url VARCHAR(500) NULL, -- URL de l'image pré-rendue (optionnel)
        -- Métadonnées
        pixel_count INT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        -- Index
        UNIQUE KEY unique_tile (tile_x, tile_y, zoom_level),
        INDEX idx_last_updated (last_updated),
        INDEX idx_expires_at (expires_at),
        INDEX idx_pixel_count (pixel_count)
    );

-- Table des alliances/équipes (optionnel)
CREATE TABLE
    alliances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT NULL,
        color VARCHAR(7) NOT NULL, -- Couleur de l'alliance
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        -- Statistiques
        member_count INT DEFAULT 1,
        total_pixels INT DEFAULT 0,
        FOREIGN KEY (created_by) REFERENCES users (id),
        INDEX idx_name (name),
        INDEX idx_created_by (created_by),
        INDEX idx_member_count (member_count)
    );

-- Table de liaison utilisateurs-alliances
CREATE TABLE
    user_alliances (
        user_id INT NOT NULL,
        alliance_id INT NOT NULL,
        role ENUM ('MEMBER', 'MODERATOR', 'ADMIN') DEFAULT 'MEMBER',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, alliance_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (alliance_id) REFERENCES alliances (id) ON DELETE CASCADE,
        INDEX idx_alliance_id (alliance_id),
        INDEX idx_role (role),
        INDEX idx_joined_at (joined_at)
    );

-- Table des sessions utilisateur (pour JWT alternative)
CREATE TABLE
    user_sessions (
        id VARCHAR(128) PRIMARY KEY,
        user_id INT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        -- Métadonnées de session
        ip_address VARCHAR(45) NULL, -- IPv6 compatible
        user_agent TEXT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_expires_at (expires_at),
        INDEX idx_last_activity (last_activity)
    );

-- Table des logs d'activité (pour modération)
CREATE TABLE
    activity_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        action VARCHAR(50) NOT NULL, -- 'PLACE_PIXEL', 'DELETE_PIXEL', 'LOGIN', etc.
        details JSON NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at),
        INDEX idx_ip_address (ip_address)
    );

-- Table des reports/signalements
CREATE TABLE
    pixel_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pixel_id BIGINT NOT NULL,
        reported_by INT NOT NULL,
        reason ENUM ('SPAM', 'INAPPROPRIATE', 'GRIEFING', 'OTHER') NOT NULL,
        description TEXT NULL,
        status ENUM ('PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED') DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP NULL,
        resolved_by INT NULL,
        FOREIGN KEY (pixel_id) REFERENCES pixels (id) ON DELETE CASCADE,
        FOREIGN KEY (reported_by) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL,
        INDEX idx_pixel_id (pixel_id),
        INDEX idx_reported_by (reported_by),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
    );

-- Table de configuration système
CREATE TABLE
    system_config (
        id INT AUTO_INCREMENT PRIMARY KEY,
        config_key VARCHAR(100) UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        description TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_config_key (config_key)
    );

-- Vues pour les statistiques
CREATE VIEW
    user_stats AS
SELECT
    u.id,
    u.username,
    u.pixels_placed,
    COUNT(DISTINCT p.id) as pixels_current,
    u.last_pixel_time,
    u.created_at,
    a.name as alliance_name
FROM
    users u
    LEFT JOIN pixels p ON u.id = p.user_id
    LEFT JOIN user_alliances ua ON u.id = ua.user_id
    LEFT JOIN alliances a ON ua.alliance_id = a.id
GROUP BY
    u.id,
    u.username,
    u.pixels_placed,
    u.last_pixel_time,
    u.created_at,
    a.name;

CREATE VIEW
    chunk_stats AS
SELECT
    chunk_x,
    chunk_y,
    COUNT(*) as pixel_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT color) as unique_colors,
    MIN(placed_at) as first_pixel,
    MAX(placed_at) as last_pixel
FROM
    pixels
GROUP BY
    chunk_x,
    chunk_y;

-- Procédures stockées pour optimisation
-- Procédure pour nettoyer les sessions expirées
DELIMITER / / CREATE PROCEDURE CleanupExpiredSessions () BEGIN
DELETE FROM user_sessions
WHERE
    expires_at < NOW ();

END / / DELIMITER;

-- Procédure pour mettre à jour les statistiques des chunks
DELIMITER / / CREATE PROCEDURE UpdateChunkStats (IN p_chunk_x INT, IN p_chunk_y INT) BEGIN
INSERT INTO
    pixel_chunks (
        chunk_x,
        chunk_y,
        zoom_level,
        pixel_count,
        min_grid_x,
        max_grid_x,
        min_grid_y,
        max_grid_y
    )
SELECT
    p_chunk_x,
    p_chunk_y,
    18, -- Zoom level par défaut
    COUNT(*),
    MIN(grid_x),
    MAX(grid_x),
    MIN(grid_y),
    MAX(grid_y)
FROM
    pixels
WHERE
    chunk_x = p_chunk_x
    AND chunk_y = p_chunk_y ON DUPLICATE KEY
UPDATE pixel_count =
VALUES
    (pixel_count),
    min_grid_x =
VALUES
    (min_grid_x),
    max_grid_x =
VALUES
    (max_grid_x),
    min_grid_y =
VALUES
    (min_grid_y),
    max_grid_y =
VALUES
    (max_grid_y),
    last_updated = CURRENT_TIMESTAMP;

END / / DELIMITER;

-- Triggers pour maintenir la cohérence
-- Trigger pour mettre à jour les stats d'alliance lors d'ajout de pixel
DELIMITER / / CREATE TRIGGER update_alliance_stats_insert AFTER INSERT ON pixels FOR EACH ROW BEGIN
UPDATE alliances a
JOIN user_alliances ua ON a.id = ua.alliance_id
SET
    a.total_pixels = a.total_pixels + 1
WHERE
    ua.user_id = NEW.user_id;

END / / DELIMITER;

-- Trigger pour mettre à jour les stats de chunk
DELIMITER / / CREATE TRIGGER update_chunk_stats_insert AFTER INSERT ON pixels FOR EACH ROW BEGIN CALL UpdateChunkStats (NEW.chunk_x, NEW.chunk_y);

END / / DELIMITER;

-- Configuration initiale du système
INSERT INTO
    system_config (config_key, config_value, description)
VALUES
    (
        'pixel_cooldown_seconds',
        '30',
        'Temps d attente entre deux pixels en secondes'
    ),
    (
        'max_pixels_per_hour',
        '60',
        'Nombre maximum de pixels par heure par utilisateur'
    ),
    (
        'grid_pixel_size_degrees',
        '0.0001',
        'Taille d un pixel en degrés'
    ),
    (
        'tile_cache_ttl_seconds',
        '300',
        'Durée de vie du cache des tiles en secondes'
    ),
    (
        'maintenance_mode',
        'false',
        'Mode maintenance activé/désactivé'
    ),
    (
        'premium_price_monthly',
        '4.99',
        'Prix de l abonnement premium mensuel'
    ),
    (
        'free_colors_count',
        '24',
        'Nombre de couleurs gratuites'
    ),
    (
        'premium_colors_count',
        '40',
        'Nombre de couleurs premium'
    );

-- Index additionnels pour les performances (si nécessaire)
-- ALTER TABLE pixels ADD INDEX idx_recent_pixels (placed_at DESC, grid_x, grid_y);
-- ALTER TABLE users ADD INDEX idx_active_users (last_pixel_time DESC, pixels_placed DESC);
-- Optimisations MySQL
-- SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB pour le buffer pool
-- SET GLOBAL query_cache_size = 268435456; -- 256MB pour le cache de requêtes