function About() {
  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 max-w-2xl w-full mx-4">
        <h1 className="text-4xl font-bold text-white mb-6 text-center">
          About
        </h1>
        <div className="space-y-4 text-slate-300">
          <p>
            This project is built with modern web technologies:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><span className="text-blue-400 font-medium">React 18</span> - A JavaScript library for building user interfaces</li>
            <li><span className="text-cyan-400 font-medium">Tailwind CSS v4</span> - A utility-first CSS framework</li>
            <li><span className="text-purple-400 font-medium">Vite</span> - Next generation frontend tooling</li>
            <li><span className="text-red-400 font-medium">React Router v7</span> - Declarative routing for React</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default About
