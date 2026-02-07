import { useState } from 'react'
import { Link } from 'react-router-dom'

const ROOMS = [
  { id: 1, name: 'The Grand Ballroom', topic: 'Music', players: 24, maxPlayers: 50, image: '🎭' },
  { id: 2, name: 'Garden of Whispers', topic: 'Romance', players: 12, maxPlayers: 30, image: '🌹' },
  { id: 3, name: 'Midnight Gallery', topic: 'Art', players: 8, maxPlayers: 20, image: '🎨' },
  { id: 4, name: 'Shadow Theater', topic: 'Mystery', players: 18, maxPlayers: 40, image: '🎪' },
  { id: 5, name: 'Crystal Palace', topic: 'Fashion', players: 31, maxPlayers: 60, image: '💎' },
  { id: 6, name: 'Velvet Lounge', topic: 'Poetry', players: 6, maxPlayers: 25, image: '📜' },
]

const TOPICS = [
  { name: 'Music', icon: '🎵', count: 124 },
  { name: 'Art', icon: '🎨', count: 89 },
  { name: 'Romance', icon: '💫', count: 67 },
  { name: 'Mystery', icon: '🔮', count: 45 },
  { name: 'Fashion', icon: '👑', count: 156 },
  { name: 'Poetry', icon: '✨', count: 34 },
]

function RoomCard({ room }) {
  const occupancyPercent = (room.players / room.maxPlayers) * 100
  const isNearlyFull = occupancyPercent > 80

  return (
    <div className="group relative bg-gradient-to-br from-[#141414] to-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden hover:border-[#d4af37]/30 transition-all duration-300 cursor-pointer">
      <div className="absolute inset-0 bg-gradient-to-br from-[#d4af37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#d4af37]/20 to-[#8b7355]/20 flex items-center justify-center text-3xl border border-[#d4af37]/20">
            {room.image}
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            isNearlyFull
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30'
          }`}>
            {room.players}/{room.maxPlayers}
          </div>
        </div>

        <h3 className="text-lg font-serif font-semibold text-white mb-2 group-hover:text-[#d4af37] transition-colors">
          {room.name}
        </h3>

        <div className="flex items-center gap-2 mb-4">
          <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-[#a0a0a0] border border-white/10">
            {room.topic}
          </span>
        </div>

        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isNearlyFull ? 'bg-red-400' : 'bg-[#d4af37]'
            }`}
            style={{ width: `${occupancyPercent}%` }}
          />
        </div>
      </div>

      <div className="relative px-6 pb-6">
        <button className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#8b7355] text-[#0a0a0a] font-medium text-sm hover:from-[#e8c547] hover:to-[#a08060] transition-all transform group-hover:scale-[1.02]">
          Enter Room
        </button>
      </div>
    </div>
  )
}

function TopicCard({ topic }) {
  return (
    <div className="group flex items-center gap-4 p-4 rounded-xl bg-[#141414] border border-white/5 hover:border-[#d4af37]/30 transition-all cursor-pointer">
      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#d4af37]/10 to-[#8b7355]/10 flex items-center justify-center text-xl border border-[#d4af37]/20 group-hover:scale-110 transition-transform">
        {topic.icon}
      </div>
      <div>
        <h4 className="font-medium text-white group-hover:text-[#d4af37] transition-colors">{topic.name}</h4>
        <p className="text-sm text-[#a0a0a0]">{topic.count} online</p>
      </div>
    </div>
  )
}

function Home() {
  const [selectedTopic, setSelectedTopic] = useState(null)

  const filteredRooms = selectedTopic
    ? ROOMS.filter(room => room.topic === selectedTopic)
    : ROOMS

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d4af37]/5 via-transparent to-transparent" />

        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-64 h-64 bg-[#d4af37]/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-[#8b7355]/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/20 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#d4af37] animate-pulse" />
              <span className="text-sm text-[#d4af37]">1,247 masks online</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-serif font-bold text-white mb-6 leading-tight">
              The Grand
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] via-[#f5f5dc] to-[#d4af37]">
                Masquerade
              </span>
            </h1>

            <p className="text-lg text-[#a0a0a0] mb-8 max-w-xl mx-auto leading-relaxed">
              Enter the digital ballroom where anonymity meets expression.
              Don your mask, join the conversation, and discover secrets in the shadows.
            </p>

            <div className="flex items-center justify-center gap-4">
              <Link
                to="/character"
                className="px-8 py-3 rounded-lg bg-gradient-to-r from-[#d4af37] to-[#8b7355] text-[#0a0a0a] font-medium hover:from-[#e8c547] hover:to-[#a08060] transition-all transform hover:scale-105"
              >
                Customize Mask
              </Link>
              <Link
                to="/store"
                className="px-8 py-3 rounded-lg bg-white/5 text-white border border-white/10 hover:bg-white/10 hover:border-[#d4af37]/30 transition-all"
              >
                Browse Store
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Topics Section */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-serif font-semibold text-white">Browse by Topic</h2>
          {selectedTopic && (
            <button
              onClick={() => setSelectedTopic(null)}
              className="text-sm text-[#d4af37] hover:text-[#e8c547] transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16">
          {TOPICS.map((topic) => (
            <div
              key={topic.name}
              onClick={() => setSelectedTopic(topic.name === selectedTopic ? null : topic.name)}
              className={`cursor-pointer transition-all ${selectedTopic === topic.name ? 'ring-2 ring-[#d4af37] rounded-xl' : ''}`}
            >
              <TopicCard topic={topic} />
            </div>
          ))}
        </div>

        {/* Rooms Grid */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-serif font-semibold text-white">
            {selectedTopic ? `${selectedTopic} Rooms` : 'Featured Rooms'}
          </h2>
          <span className="text-sm text-[#a0a0a0]">
            {filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''} available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>

        {filteredRooms.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🎭</div>
            <h3 className="text-xl font-medium text-white mb-2">No rooms found</h3>
            <p className="text-[#a0a0a0]">Try selecting a different topic</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-[#a0a0a0]">
              Built on Solana
            </p>
            <div className="flex items-center gap-6">
              <Link to="/" className="text-sm text-[#a0a0a0] hover:text-[#d4af37] transition-colors">Terms</Link>
              <Link to="/" className="text-sm text-[#a0a0a0] hover:text-[#d4af37] transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
