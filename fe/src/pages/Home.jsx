import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ROOMS, TOPICS } from '../lib/rooms/rooms'

function RoomCard({ room }) {
  const occupancyPercent = (room.players / room.maxPlayers) * 100
  const isNearlyFull = occupancyPercent > 80

  return (
    <Link to={`/rooms/${room.id}`} className="group relative bg-[#111] rounded-2xl overflow-hidden hover-lift cursor-pointer inner-glow block">
      <div className="absolute inset-0 bg-gradient-to-br from-[#d4af37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="w-14 h-14 rounded-xl bg-[#0a0a0a] flex items-center justify-center text-2xl inner-glow">
            {room.image}
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-light tracking-wider ${
            isNearlyFull ? 'text-red-400 bg-red-400/10' : 'text-[#8b7355] bg-[#8b7355]/10'
          }`}>
            {room.players}/{room.maxPlayers}
          </div>
        </div>

        <h3 className="text-lg font-serif font-light text-white/90 mb-1 tracking-wide group-hover:text-[#f5f5dc] transition-elegant">
          {room.name}
        </h3>

        <p className="text-sm font-light text-[#718096] mb-5 tracking-wider uppercase">
          {room.topic}
        </p>

        <div className="w-full h-px bg-white/5 mb-5" />

        <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${
              isNearlyFull ? 'bg-red-400/60' : 'bg-[#8b7355]/60'
            }`}
            style={{ width: `${occupancyPercent}%` }}
          />
        </div>
      </div>

      <div className="relative px-6 pb-6">
        <div className="w-full py-3 rounded-lg text-[#0a0a0a] font-light text-sm tracking-wider uppercase btn-convex transition-all duration-300 text-center">
          Enter Room
        </div>
      </div>
    </Link>
  )
}

function TopicCard({ topic, isSelected }) {
  return (
    <div className={`group flex items-center gap-4 p-4 rounded-xl transition-all duration-300 cursor-pointer ${
      isSelected ? 'bg-[#d4af37]/10' : 'bg-[#111] hover:bg-[#161616]'
    } inner-glow`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-transform duration-300 ${
        isSelected ? 'bg-[#d4af37]/20 scale-95' : 'bg-[#0a0a0a] group-hover:scale-105'
      } inner-glow`}>
        {topic.icon}
      </div>
      <div>
        <h4 className={`font-light tracking-wider text-sm uppercase transition-colors ${isSelected ? 'text-[#d4af37]' : 'text-white/80'}`}>{topic.name}</h4>
        <p className="text-xs font-light text-[#718096] tracking-wide">{topic.count} online</p>
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
        <div className="absolute top-32 left-20 w-96 h-96 bg-[#d4af37]/5 rounded-full blur-[100px]" />
        <div className="absolute top-48 right-32 w-64 h-64 bg-[#8b7355]/5 rounded-full blur-[80px]" />

        <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-24">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#111] mb-8 inner-glow">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" />
              <span className="text-xs font-light text-[#8b7355] tracking-widest uppercase">1,247 masks online</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-serif font-light text-white mb-4 tracking-wider">
              The Grand
              <span className="block text-[#f5f5dc] mt-2">
                Masquerade
              </span>
            </h1>

            <p className="text-base font-light text-[#718096] mb-10 max-w-lg mx-auto leading-relaxed tracking-wide">
              Enter the digital ballroom where anonymity meets expression.
              Don your mask, join the conversation, and discover secrets in the shadows.
            </p>

            <div className="flex items-center justify-center gap-4">
              <Link
                to="/character"
                className="px-8 py-3 rounded-lg text-[#0a0a0a] font-light text-sm tracking-widest uppercase btn-convex transition-all duration-300"
              >
                Customize Mask
              </Link>
              <Link
                to="/store"
                className="px-8 py-3 rounded-lg border border-white/10 text-white/70 font-light text-sm tracking-widest uppercase hover:border-[#d4af37]/30 hover:text-white transition-all duration-300"
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
          <h2 className="text-sm font-light text-[#718096] tracking-[0.3em] uppercase">Browse by Topic</h2>
          {selectedTopic && (
            <button
              onClick={() => setSelectedTopic(null)}
              className="text-xs font-light text-[#8b7355] hover:text-[#d4af37] tracking-wider uppercase transition-colors"
            >
              Clear filter
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-16">
          {TOPICS.map((topic) => (
            <div
              key={topic.name}
              onClick={() => setSelectedTopic(topic.name === selectedTopic ? null : topic.name)}
            >
              <TopicCard topic={topic} isSelected={selectedTopic === topic.name} />
            </div>
          ))}
        </div>

        {/* Rooms Grid */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-sm font-light text-[#718096] tracking-[0.3em] uppercase">
            {selectedTopic ? `${selectedTopic} Rooms` : 'Featured Rooms'}
          </h2>
          <span className="text-xs font-light text-[#718096] tracking-wider">
            {filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''} available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>

        {filteredRooms.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4 opacity-50">🎭</div>
            <h3 className="text-lg font-light text-white/80 mb-2 tracking-wide">No rooms found</h3>
            <p className="text-sm font-light text-[#718096]">Try selecting a different topic</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-20">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="text-xs font-light text-[#718096] tracking-wider">
              Built on Solana
            </p>
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xs font-light text-[#718096] hover:text-[#8b7355] transition-colors tracking-wider">Terms</Link>
              <Link to="/" className="text-xs font-light text-[#718096] hover:text-[#8b7355] transition-colors tracking-wider">Privacy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
