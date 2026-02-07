import { FaceMeshPainter } from '../components/FaceMeshPainter'

function Character() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] py-8">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-white mb-3">
            Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] to-[#f5f5dc]">Mask</span>
          </h1>
          <p className="text-[#a0a0a0] max-w-lg mx-auto">
            Customize your masquerade identity. Paint directly on your face mesh to create a unique look for the ballroom.
          </p>
        </div>

        {/* Painter Container */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#141414] to-[#1a1a1a] p-6">
          <FaceMeshPainter />
        </div>

        {/* Tips */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#141414] border border-white/5">
            <div className="text-2xl mb-2">🎨</div>
            <h3 className="font-medium text-white mb-1">Paint Freely</h3>
            <p className="text-sm text-[#a0a0a0]">Use the brush to draw patterns, shapes, or anything you imagine.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#141414] border border-white/5">
            <div className="text-2xl mb-2">👁️</div>
            <h3 className="font-medium text-white mb-1">Face Tracking</h3>
            <p className="text-sm text-[#a0a0a0]">Your mask moves with you in real-time using AI face detection.</p>
          </div>
          <div className="p-4 rounded-xl bg-[#141414] border border-white/5">
            <div className="text-2xl mb-2">💾</div>
            <h3 className="font-medium text-white mb-1">Save & Share</h3>
            <p className="text-sm text-[#a0a0a0]">Your design is saved to your profile and visible in rooms.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Character
