const PRESET_COLORS = [
  '#d4af37', // Gold
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#ff00ff',
  '#00ffff',
  '#ffffff',
  '#000000',
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
    <div className="w-full bg-[#0f0f0f] border border-[#d4af37]/20 rounded-xl p-5">
      {/* Brush Size */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[#a0a0a0] text-xs font-light tracking-wider uppercase">Brush Size</span>
          <span className="text-[#d4af37] text-xs font-light">{brushSize}px</span>
        </div>
        <input
          type="range"
          min="1"
          max="50"
          value={brushSize}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="w-full h-1 bg-[#1a1a1a] rounded-full appearance-none cursor-pointer accent-[#d4af37]"
          style={{
            background: `linear-gradient(to right, #d4af37 0%, #d4af37 ${(brushSize / 50) * 100}%, #1a1a1a ${(brushSize / 50) * 100}%, #1a1a1a 100%)`
          }}
        />
      </div>

      {/* Color Palette */}
      <div className="mb-5">
        <span className="text-[#a0a0a0] text-xs font-light tracking-wider uppercase block mb-3">Color</span>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={`w-7 h-7 rounded-full transition-all duration-200 ${
                brushColor === color
                  ? 'ring-2 ring-[#d4af37] ring-offset-2 ring-offset-[#0f0f0f] scale-110'
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            />
          ))}
          <label className="w-7 h-7 rounded-full bg-gradient-to-br from-[#d4af37] to-[#8b7355] flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
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
      <div className="flex gap-3">
        <button
          onClick={onToggleFaceMesh}
          className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-light tracking-wider uppercase transition-all duration-300 border ${
            showFaceMesh
              ? 'bg-[#d4af37]/10 border-[#d4af37]/30 text-[#d4af37] hover:bg-[#d4af37]/20'
              : 'bg-transparent border-[#333] text-[#666] hover:border-[#555] hover:text-[#888]'
          }`}
        >
          {showFaceMesh ? 'Hide Mesh' : 'Show Mesh'}
        </button>

        <button
          onClick={onClearCanvas}
          className="flex-1 px-4 py-2.5 rounded-lg text-xs font-light tracking-wider uppercase transition-all duration-300 border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
        >
          Clear
        </button>
      </div>

      <div className="text-[#555] text-xs mt-4 text-center font-light">
        Click and drag on your face to paint
      </div>
    </div>
  )
}
