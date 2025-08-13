'use client';

import { useState } from 'react';

interface ColorPickerProps {
    selectedColor: string;
    onColorSelect: (color: string) => void;
    disabled?: boolean;
}

// Palette de couleurs comme wplace.live
const DEFAULT_COLORS = [
    '#FFFFFF', '#E4E4E4', '#888888', '#222222',
    '#FFA7D1', '#E50000', '#E59500', '#A06A42',
    '#E5D900', '#94E044', '#02BE01', '#00D3DD',
    '#0083C7', '#0000EA', '#CF6EE4', '#820080',
    '#FF6A00', '#FFA500', '#FFFF00', '#00FF00',
    '#00FFFF', '#0080FF', '#8000FF', '#FF00FF',
    '#800000', '#808000', '#008000', '#008080',
    '#000080', '#800080', '#C0C0C0', '#FF69B4'
];

const ColorPicker: React.FC<ColorPickerProps> = ({
    selectedColor,
    onColorSelect,
    disabled = false
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="color-picker-container">
            {/* Couleur sélectionnée */}
            <div className="flex items-center justify-between p-3 border-b border-gray-600">
                <span className="text-sm font-medium">Couleur sélectionnée</span>
                <div
                    className={`w-8 h-8 rounded border-2 cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed border-gray-500' : 'border-gray-400 hover:border-white'
                        }`}
                    style={{ backgroundColor: selectedColor }}
                    onClick={() => !disabled && setIsExpanded(!isExpanded)}
                />
            </div>

            {/* Palette de couleurs */}
            <div className={`transition-all duration-200 ${isExpanded ? 'max-h-96' : 'max-h-0'} overflow-hidden`}>
                <div className="p-3">
                    <div className="grid grid-cols-4 gap-2 mb-3">
                        {DEFAULT_COLORS.map((color) => (
                            <button
                                key={color}
                                className={`w-8 h-8 rounded border-2 transition-all hover:scale-110 ${selectedColor === color ? 'border-blue-400 scale-110' : 'border-gray-500'
                                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-white cursor-pointer'}`}
                                style={{ backgroundColor: color }}
                                onClick={() => !disabled && onColorSelect(color)}
                                disabled={disabled}
                                title={`Couleur: ${color}`}
                            />
                        ))}
                    </div>

                    {/* Sélecteur de couleur personnalisé */}
                    <div className="border-t border-gray-600 pt-3">
                        <label className="block text-xs text-gray-400 mb-2">Couleur personnalisée</label>
                        <div className="flex items-center space-x-2">
                            <input
                                type="color"
                                value={selectedColor}
                                onChange={(e) => !disabled && onColorSelect(e.target.value.toUpperCase())}
                                disabled={disabled}
                                className={`w-8 h-8 rounded border border-gray-500 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                            />
                            <input
                                type="text"
                                value={selectedColor}
                                onChange={(e) => {
                                    const value = e.target.value.toUpperCase();
                                    if (!disabled && /^#[0-9A-F]{0,6}$/.test(value)) {
                                        onColorSelect(value);
                                    }
                                }}
                                disabled={disabled}
                                placeholder="#FF0000"
                                className={`flex-1 px-2 py-1 text-xs bg-gray-700 border border-gray-500 rounded ${disabled ? 'opacity-50 cursor-not-allowed' : 'focus:border-blue-400 focus:outline-none'
                                    }`}
                                maxLength={7}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bouton pour réduire/étendre */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                disabled={disabled}
                className={`w-full p-2 text-xs text-gray-400 hover:text-white transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
            >
                {isExpanded ? '▲ Réduire' : '▼ Voir toutes les couleurs'}
            </button>
        </div>
    );
};

export default ColorPicker;