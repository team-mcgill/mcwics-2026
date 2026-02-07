import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 max-w-md w-full mx-4 text-center">
        <h1 className="text-6xl font-bold text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-slate-200 mb-4">Page Not Found</h2>
        <p className="text-slate-300 mb-6">
          The page you're looking for doesn't exist.
        </p>
        <Link 
          to="/" 
          className="inline-block px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  )
}

export default NotFound
