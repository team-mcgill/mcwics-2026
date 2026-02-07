import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center px-6">
        <div className="text-8xl mb-6">🎭</div>
        <h1 className="text-6xl font-serif font-bold text-white mb-4">404</h1>
        <p className="text-xl text-[#a0a0a0] mb-8">The mask you seek remains hidden</p>
        <Link
          to="/"
          className="px-8 py-3 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#8b7355] text-[#0a0a0a] font-medium hover:from-[#e8c547] hover:to-[#a08060] transition-all"
        >
          Return to the Ballroom
        </Link>
      </div>
    </div>
  )
}

export default NotFound
