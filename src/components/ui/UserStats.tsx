// src/components/ui/UserStats.tsx

'use client';

interface UserStatsProps {
    stats: {
        pixelsPlaced: number;
        pixelsCurrent: number;
        canPlacePixel: boolean;
    };
    cooldownRemaining: number;
    currentZoom: number;
    minZoomVisible: number;
}

const UserStats: React.FC<UserStatsProps> = ({
    stats,
    cooldownRemaining,
    currentZoom,
    minZoomVisible
}) => {
    const formatTime = (ms: number): string => {
        const seconds = Math.ceil(ms / 1000);
        return `${seconds}s`;
    };

    const canPlace = stats.canPlacePixel && currentZoom >= minZoomVisible;

    return (
        <div className="user-stats p-3 space-y-3">
            {/* Titre */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Vos statistiques</h3>
                <div className={`w-3 h-3 rounded-full ${canPlace ? 'bg-green-400' : 'bg-red-400'}`} />
            </div>

            {/* Statistiques */}
            <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                    <span className="text-gray-400">Pixels placés:</span>
                    <span className="text-white font-medium">{stats.pixelsPlaced.toLocaleString()}</span>
                </div>

                <div className="flex justify-between">
                    <span className="text-gray-400">Pixels actuels:</span>
                    <span className="text-white font-medium">{stats.pixelsCurrent.toLocaleString()}</span>
                </div>

                <div className="flex justify-between">
                    <span className="text-gray-400">Zoom actuel:</span>
                    <span className="text-white font-medium">{currentZoom}</span>
                </div>
            </div>

            {/* Status de placement */}
            <div className="border-t border-gray-600 pt-3">
                {cooldownRemaining > 0 ? (
                    <div className="text-center">
                        <div className="text-yellow-400 font-medium text-sm mb-1">
                            Cooldown actif
                        </div>
                        <div className="text-xs text-gray-400">
                            Prochain pixel dans: {formatTime(cooldownRemaining)}
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                            <div
                                className="bg-yellow-400 h-2 rounded-full transition-all duration-1000"
                                style={{
                                    width: `${Math.max(0, 100 - (cooldownRemaining / 30000) * 100)}%`
                                }}
                            />
                        </div>
                    </div>
                ) : currentZoom < minZoomVisible ? (
                    <div className="text-center">
                        <div className="text-orange-400 font-medium text-sm mb-1">
                            Zoomez pour placer
                        </div>
                        <div className="text-xs text-gray-400">
                            Niveau {minZoomVisible} minimum requis
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <div className="text-green-400 font-medium text-sm mb-1">
                            ✓ Prêt à placer
                        </div>
                        <div className="text-xs text-gray-400">
                            Cliquez sur la carte
                        </div>
                    </div>
                )}
            </div>

            {/* Conseils */}
            <div className="border-t border-gray-600 pt-3">
                <div className="text-xs text-gray-500">
                    💡 <strong>Conseil:</strong> Les pixels sont permanents et visibles par tous les joueurs
                </div>
            </div>
        </div>
    );
};

export default UserStats;