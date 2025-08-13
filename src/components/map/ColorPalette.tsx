// src/components/map/ColorPalette.tsx - Palette de couleurs inspirée wplace.live

'use client';

import { useState, useMemo } from 'react';
import {
    COLOR_PALETTE,
    getAllColors,
    isFreeColor,
    getColorType,
    type ColorInfo
} from '@/lib/gridConfig';

interface ColorPaletteProps {
    selectedColor?: string;
    onColorSelect: (color: string) => void;
    user?: {
        id: number;
        username: string;
        isPremium: boolean;
    };
    className?: string;
}

const ColorPalette: React.FC<ColorPaletteProps> = ({
    selectedColor,
    onColorSelect,
    user,
    className = ''
}) => {
    const [showPremiumOnly, setShowPremiumOnly] = useState(false);
    const [showFreeOnly, setShowFreeOnly] = useState(false);

    // Obtenir toutes les couleurs avec filtrage
    const filteredColors = useMemo(() => {
        let colors = getAllColors();

        if (showFreeOnly) {
            colors = colors.filter(color => color.type === 'FREE');
        } else if (showPremiumOnly) {
            colors = colors.filter(color => color.type === 'PREMIUM');
        }

        return colors;
    }, [showFreeOnly, showPremiumOnly]);

    // Statistiques des couleurs
    const colorStats = useMemo(() => {
        const total = getAllColors().length;
        const free = COLOR_PALETTE.FREE.length;
        const premium = COLOR_PALETTE.PREMIUM.length;
        const selected = filteredColors.length;

        return { total, free, premium, selected };
    }, [filteredColors.length]);

    const handleColorClick = (color: ColorInfo) => {
        // Vérifier si l'utilisateur peut utiliser cette couleur
        if (color.type === 'PREMIUM' && !user?.isPremium) {
            alert('Cette couleur nécessite un compte premium !');
            return;
        }

        onColorSelect(color.hex);
    };

    const isColorDisabled = (color: ColorInfo): boolean => {
        return color.type === 'PREMIUM' && !user?.isPremium;
    };

    return (
        <div className={`bg-white rounded-lg shadow-lg p-4 ${className}`}>
            {/* En-tête avec titre et stats */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                    Palette de couleurs
                </h3>
                <div className="text-sm text-gray-600">
                    {colorStats.selected} / {colorStats.total} couleurs
                </div>
            </div>

            {/* Filtres */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => {
                        setShowFreeOnly(false);
                        setShowPremiumOnly(false);
                    }}
                    className={`px-3 py-1 rounded text-sm transition-colors ${!showFreeOnly && !showPremiumOnly
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    Toutes ({colorStats.total})
                </button>

                <button
                    onClick={() => {
                        setShowFreeOnly(true);
                        setShowPremiumOnly(false);
                    }}
                    className={`px-3 py-1 rounded text-sm transition-colors ${showFreeOnly
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    Gratuites ({colorStats.free})
                </button>

                <button
                    onClick={() => {
                        setShowFreeOnly(false);
                        setShowPremiumOnly(true);
                    }}
                    className={`px-3 py-1 rounded text-sm transition-colors ${showPremiumOnly
                            ? 'bg-yellow-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                >
                    Premium ({colorStats.premium}) 👑
                </button>
            </div>

            {/* Couleur sélectionnée */}
            {selectedColor && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-8 h-8 rounded border-2 border-gray-300"
                            style={{ backgroundColor: selectedColor }}
                        />
                        <div>
                            <div className="font-medium text-gray-800">
                                Couleur sélectionnée
                            </div>
                            <div className="text-sm text-gray-600">
                                {selectedColor.toUpperCase()}
                                {isFreeColor(selectedColor) ? (
                                    <span className="ml-2 text-green-600">✓ Gratuite</span>
                                ) : (
                                    <span className="ml-2 text-yellow-600">👑 Premium</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Grille de couleurs */}
            <div className="grid grid-cols-8 gap-1 max-h-64 overflow-y-auto">
                {filteredColors.map((color, index) => {
                    const isSelected = selectedColor === color.hex;
                    const isDisabled = isColorDisabled(color);

                    return (
                        <button
                            key={`${color.hex}-${index}`}
                            onClick={() => handleColorClick(color)}
                            disabled={isDisabled}
                            className={`
                relative w-8 h-8 rounded transition-all duration-200
                ${isSelected
                                    ? 'ring-2 ring-blue-500 ring-offset-2 scale-110'
                                    : 'hover:scale-105'
                                }
                ${isDisabled
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'cursor-pointer hover:shadow-lg'
                                }
                border border-gray-300
              `}
                            style={{ backgroundColor: color.hex }}
                            title={`${color.hex.toUpperCase()} - ${color.type === 'FREE' ? 'Gratuite' : 'Premium'}`}
                        >
                            {/* Indicateur premium */}
                            {color.type === 'PREMIUM' && (
                                <div className="absolute -top-1 -right-1 text-xs">
                                    👑
                                </div>
                            )}

                            {/* Indicateur sélection */}
                            {isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full shadow-lg" />
                                </div>
                            )}

                            {/* Indicateur disabled */}
                            {isDisabled && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-white text-xs font-bold">🔒</div>
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Informations utilisateur */}
            <div className="mt-4 pt-4 border-t border-gray-200">
                {user ? (
                    <div className="text-sm text-gray-600">
                        <div className="flex items-center justify-between">
                            <span>Connecté en tant que <strong>{user.username}</strong></span>
                            {user.isPremium ? (
                                <span className="text-yellow-600 font-medium">👑 Premium</span>
                            ) : (
                                <span className="text-gray-500">Gratuit</span>
                            )}
                        </div>
                        {!user.isPremium && (
                            <div className="mt-2 text-xs text-gray-500">
                                Passez à Premium pour débloquer {colorStats.premium} couleurs supplémentaires !
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-gray-500">
                        Connectez-vous pour placer des pixels
                    </div>
                )}
            </div>

            {/* Légende */}
            <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-100 border border-green-300 rounded" />
                        <span>Couleurs gratuites</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded relative">
                            <span className="absolute -top-1 -right-1 text-xs">👑</span>
                        </div>
                        <span>Couleurs premium</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ColorPalette;