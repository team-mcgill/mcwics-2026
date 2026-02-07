function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 max-w-md w-full mx-4">
        <h1 className="text-4xl font-bold text-white mb-4 text-center">
          React + Tailwind v4
        </h1>
        <p className="text-slate-300 text-center mb-6">
          Built with Vite, React 18 LTS, and Tailwind CSS v4
        </p>
        <div className="flex gap-4 justify-center">
          <button className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors">
            Get Started
          </button>
          <button className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors border border-white/20">
            Learn More
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
