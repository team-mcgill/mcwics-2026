const PRESET_COLORS = [
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
    <div className="flex flex-col gap-4 p-4 bg-gray-800 rounded-lg"> 
      <div className="flex items-center gap-4"> 
        <span className="text-white text-sm w-20">Brush Size:</span>
        <input
          type="range"
          min="1"
          max="50"
          value={brushSize}
          onChange={(e) => onSizeChange(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-white text-sm w-8">{brushSize}</span>
      </div>

      <div className="flex items-center gap-4"> 
        <span className="text-white text-sm w-20">Color:</span>
        <div className="flex gap-2 flex-wrap"> 
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onColorChange(color)}
              className={`w-8 h-8 rounded-full border-2 ${
                brushColor === color ? 'border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: color }}
              aria-label={`Select color ${color}`}
            />
          ))}
          <input
            type="color"
            value={brushColor}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-8 h-8 rounded-full cursor-pointer"
          />
        </div>
      </div>

      <div className="flex items-center gap-4"> 
        <button
          onClick={onToggleFaceMesh}
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
            showFaceMesh
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
          }`}
        >
          {showFaceMesh ? 'Hide Face Mesh' : 'Show Face Mesh'}
        </button>

        <button
          onClick={onClearCanvas}
          className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          Clear Drawing
        </button>
      </div>

      <div className="text-gray-400 text-xs mt-2"> 
        Click and drag on the canvas to draw over your face mesh
      </div>
    </div>
  )
}
