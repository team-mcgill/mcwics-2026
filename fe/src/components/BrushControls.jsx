const PRESET_COLORS = [
  '#d4af37', // Gold
  '#f5f5dc', // Cream
  '#8b7355', // Bronze
  '#c9a86c', // Soft gold
  '#a67c52', // Muted brown
  '#8b4513', // Saddle brown
  '#cd5c5c', // Soft red
  '#4682b4', // Steel blue
  '#2e8b57', // Sea green
  '#ffffff', // White
  '#1a1a1a', // Dark gray
  '#000000', // Black
]

export function BrushControls({
  brushColor,
  brushSize,
  showFaceMesh,
  onColorChange,
  onSizeChange,
  onToggleFaceMesh,
  onClearCanvas,
}) {
  return (
    <div className="w-full bg-[#111] rounded-xl p-4 inner-glow">
      {/* Brush Size */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#a0a0a0] text-xs font-light tracking-wider uppercase">Brush Size</span>
          <span className="text-[#8b7355] text-xs font-light">{brushSize}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="50"
          value={brushSize}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="w-full h-0.5 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #8b7355 0%, #8b7355 ${(brushSize / 50) * 100}%, #1a1a1a ${(brushSize / 50) * 100}%, #1a1a1a 100%)`
          }}
        />
      </div>

      {/* Color Palette */}
      <div className="mb-4">
        <span className="text-[#a0a0a0] text-xs font-light tracking-wider uppercase block mb-3">Color</span>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={`w-6 h-6 rounded-full transition-all duration-200 ${
                brushColor === color
                  ? 'ring-2 ring-[#d4af37] ring-offset-1 ring-offset-[#0f0f0f] scale-110'
                  : 'hover:scale-105'
              } ${color === '#ffffff' || color === '#f5f5dc' ? 'border border-white/20' : ''}`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            />
          ))}
          <label className="w-6 h-6 rounded-full bg-gradient-to-br from-[#d4af37] to-[#8b7355] flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
            <input
              type="color"
              value={brushColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="opacity-0 w-full h-full cursor-pointer"
            />
            <svg className="w-3 h-3 text-black absolute pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFaceMesh}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-300 ${
              showFaceMesh
                ? 'bg-[#d4af37]/10 text-[#d4af37] hover:bg-[#d4af37]/20'
                : 'bg-[#1a1a1a] text-[#666] hover:text-[#888]'
            }`}
            title={showFaceMesh ? 'Hide mesh' : 'Show mesh'}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {showFaceMesh ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              )}
            </svg>
          </button>

          <button
            onClick={onClearCanvas}
            className="w-9 h-9 rounded-lg bg-[#1a1a1a] text-[#666] hover:text-red-400 hover:bg-red-400/10 transition-all duration-300 flex items-center justify-center"
            title="Clear canvas"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

      </div>

    </div>
  )
}
