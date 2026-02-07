import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center px-6">
        <div className="text-6xl mb-8 opacity-40">🎭</div>
        <h1 className="text-5xl font-serif font-light text-white mb-4 tracking-wider">404</h1>
        <p className="text-sm font-light text-[#718096] mb-10 tracking-wide">The mask you seek remains hidden</p>
        <Link
          to="/"
          className="px-8 py-3 rounded-lg bg-[#d4af37] text-[#0a0a0a] font-light text-sm tracking-widest uppercase hover:bg-[#e8c547] hover:-translate-y-0.5 transition-all duration-300"
        >
          Return to the Ballroom
        </Link>
      </div>
    </div>
  )
}

export default NotFound
