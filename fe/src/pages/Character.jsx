import { FaceMeshPainter } from '../components/FaceMeshPainter'

function Character() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-serif font-light text-white mb-3 tracking-wider">
            Your <span className="text-[#f5f5dc]">Mask</span>
          </h1>
          <p className="text-sm font-light text-[#718096] max-w-lg mx-auto tracking-wide">
            Customize your masquerade identity. Paint directly on your face mesh to create a unique look for the ballroom.
          </p>
        </div>

        {/* Painter Container */}
        <div className="rounded-2xl bg-[#111] p-6 inner-glow">
          <FaceMeshPainter />
        </div>

      </div>
    </div>
  )
}

export default Character
