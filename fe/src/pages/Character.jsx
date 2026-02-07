import { FaceMeshPainter } from '../components/FaceMeshPainter'

function Character() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-slate-900 to-slate-800 p-6 flex items-center justify-center">
      <div className="w-full max-w-4xl rounded-2xl border border-white/10 bg-black/20 p-6">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Character</h1>
        <FaceMeshPainter />
      </div>
    </div>
  )
}

export default Character
