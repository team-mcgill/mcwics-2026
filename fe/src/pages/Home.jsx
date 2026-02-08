import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createRoom, fetchRooms } from '../lib/api/rooms'
import { DEFAULT_ROOM_MAP, ROOM_MAPS, getRoomMapById } from '../lib/rooms/maps'

const ROOMS_REFRESH_INTERVAL_MS = 5000

const TOPIC_ICONS = {
  Music: '🎵',
  Art: '🎨',
  Romance: '💫',
  Mystery: '🔮',
  Fashion: '👑',
  Poetry: '✨',
}

const ROOM_EMOJI_OPTIONS = [
  '🎭', '🎪', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷',
  '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🕹️',
  '🎰', '🎟️', '🎫', '🏆', '🏅', '🥇', '🥈', '🥉', '🎖️', '⚔️',

  '✨', '🌟', '💫', '⭐', '⚡', '🔥', '💥', '☄️', '🌈', '❄️',
  '🌙', '🌌', '☀️', '⛅', '🌤️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️',
  '🌀', '🌊', '💧', '🫧', '🍃', '🌿', '🍀', '🌱', '🌵', '🌴',

  '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🪻', '🪷', '🪹', '🪺',
  '🍄', '🌾', '🪵', '🪨', '🏔️', '⛰️', '🏕️', '🏝️', '🏜️', '🏞️',
  '🌋', '🏛️', '🏰', '🕍', '⛩️', '🕌', '🛕', '🗼', '🗽', '🎡',

  '💎', '👑', '🪄', '🔮', '🧿', '🕯️', '🪔', '🗝️', '🔐', '🛡️',
  '⚜️', '♠️', '♥️', '♦️', '♣️', '🃏', '🎴', '🀄', '🧩', '🧸',
  '🪅', '🎁', '🎀', '🪩', '💍', '📿', '🪙', '💰', '🏮', '📯',

  '😀', '😄', '😁', '😆', '😎', '🥳', '🤩', '😌', '😊', '😇',
  '😉', '😏', '🤗', '🫶', '❤️', '🧡', '💛', '💚', '💙', '💜',
  '🖤', '🤍', '🤎', '💕', '💞', '💓', '💗', '💖', '💘', '💝',

  '💃', '🕺', '🧚', '🧙', '🧛', '🧜', '🦸', '🦹', '🧞', '🧝',
  '👠', '👗', '👘', '🧥', '🎩', '🪭', '🪶', '🪽', '🦋', '🐉',
  '🦄', '🦊', '🐺', '🐈', '🐆', '🦚', '🦢', '🦉', '🦇', '🐍',

  '🍷', '🍸', '🍹', '🥂', '🍾', '🍺', '🥃', '☕', '🫖', '🍵',
  '🍫', '🍰', '🧁', '🍓', '🍒', '🍇', '🍉', '🍍', '🥭', '🍑',
  '🫐', '🍋', '🍊', '🍎', '🍏', '🍐', '🥐', '🥨', '🧀', '🍿',

  '🚀', '🛸', '✈️', '🛶', '⛵', '🚢', '🚂', '🚲', '🛼', '🏎️',
  '🌃', '🌆', '🌉', '🏙️', '🌁', '🎇', '🎆', '🕰️', '⌛', '📜',
  '📖', '🖋️', '📸', '🎥', '🔭', '🧭', '🗺️', '🧳', '🪐', '🌠',
]

function getTopicIcon(topic) {
  return TOPIC_ICONS[topic] || '🎭'
}

function RoomCard({ room }) {
  const occupancyPercent = (room.players / room.maxPlayers) * 100
  const isNearlyFull = occupancyPercent > 80

  return (
    <Link to={`/rooms/${encodeURIComponent(room.id)}`} className="group relative bg-[#111] rounded-2xl overflow-hidden hover-lift cursor-pointer inner-glow block">
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

function CreateRoomModal({ isSubmitting, error, form, onChange, onSelectEmoji, onClose, onSubmit }) {
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false)
  if (!form) return null

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#111] inner-glow">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
          <h3 className="text-lg font-serif font-light text-white tracking-wide">Create Room</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 text-[#555] hover:text-white rounded-lg disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label htmlFor="room-name" className="block text-[11px] tracking-widest uppercase text-[#8b7355] mb-2">Room name</label>
            <input
              id="room-name"
              name="name"
              type="text"
              value={form.name}
              onChange={onChange}
              maxLength={80}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#0c0c0c] border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder:text-[#555] focus:outline-none focus:border-[#d4af37]/40"
              placeholder="Midnight Tea Salon"
            />
          </div>

          <div>
            <label htmlFor="room-topic" className="block text-[11px] tracking-widest uppercase text-[#8b7355] mb-2">Topic</label>
            <input
              id="room-topic"
              name="topic"
              type="text"
              value={form.topic}
              onChange={onChange}
              maxLength={60}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#0c0c0c] border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder:text-[#555] focus:outline-none focus:border-[#d4af37]/40"
              placeholder="Late-night fashion"
            />
          </div>

          <div>
            <label htmlFor="room-map" className="block text-[11px] tracking-widest uppercase text-[#8b7355] mb-2">Map</label>
            <select
              id="room-map"
              name="mapId"
              value={form.mapId}
              onChange={onChange}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-[#0c0c0c] border border-white/10 px-4 py-2.5 text-sm text-white/90 focus:outline-none focus:border-[#d4af37]/40"
            >
              {ROOM_MAPS.map((roomMap) => (
                <option key={roomMap.id} value={roomMap.id} className="bg-[#0c0c0c]">
                  {roomMap.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="block text-[11px] tracking-widest uppercase text-[#8b7355] mb-2">Emoji</p>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsEmojiPickerOpen(true)}
                className="w-full inline-flex items-center justify-between rounded-lg border border-[#d4af37]/30 bg-[#0c0c0c] px-4 py-2.5 text-sm text-[#f5e7b2] hover:bg-[#171717] hover:border-[#d4af37]/50 transition-colors disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="text-xl leading-none">{form.image || '🎭'}</span>
                  <span>Select room emoji</span>
                </span>
                <svg className="w-4 h-4 text-[#8b7355]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <div>
              <label htmlFor="room-max-players" className="block text-[11px] tracking-widest uppercase text-[#8b7355] mb-2">Max players</label>
              <input
                id="room-max-players"
                name="maxPlayers"
                type="number"
                value={form.maxPlayers}
                onChange={onChange}
                min={2}
                max={120}
                disabled={isSubmitting}
                className="w-full rounded-lg bg-[#0c0c0c] border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder:text-[#555] focus:outline-none focus:border-[#d4af37]/40"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-300">{error}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-lg border border-white/10 text-[#718096] text-[11px] tracking-widest uppercase hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg btn-convex text-[#0a0a0a] text-[11px] tracking-widest uppercase disabled:opacity-60"
            >
              {isSubmitting ? 'Creating...' : 'Create & Join'}
            </button>
          </div>
        </form>
      </div>

      {isEmojiPickerOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsEmojiPickerOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-2xl border border-[#d4af37]/20 bg-[#0f0f0f] shadow-[0_20px_60px_rgba(0,0,0,0.65)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-lg">{form.image || '🎭'}</span>
                <p className="text-xs tracking-[0.2em] uppercase text-[#8b7355]">Choose Emoji</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEmojiPickerOpen(false)}
                className="p-1.5 rounded-md text-[#666] hover:text-white hover:bg-white/5"
                aria-label="Close emoji picker"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-2">
              <div className="max-h-[360px] overflow-y-auto p-2 rounded-xl bg-[#0a0a0a] border border-white/5">
                <div className="grid grid-cols-8 gap-2">
                  {ROOM_EMOJI_OPTIONS.map((emoji) => {
                    const isSelected = form.image === emoji
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          onSelectEmoji(emoji)
                          setIsEmojiPickerOpen(false)
                        }}
                        className={`h-10 w-10 rounded-lg text-xl transition-colors ${
                          isSelected
                            ? 'bg-[#d4af37]/20 border border-[#d4af37]/40'
                            : 'bg-[#111] border border-white/10 hover:border-[#d4af37]/40 hover:bg-[#171717]'
                        }`}
                        aria-label={`Select ${emoji}`}
                      >
                        {emoji}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Home() {
  const navigate = useNavigate()
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [rooms, setRooms] = useState([])
  const [isLoadingRooms, setIsLoadingRooms] = useState(true)
  const [roomsError, setRoomsError] = useState('')
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createError, setCreateError] = useState('')
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    topic: '',
    image: '🎭',
    maxPlayers: '30',
    mapId: DEFAULT_ROOM_MAP.id,
  })

  const refreshRooms = useCallback(async ({ initial = false } = {}) => {
    if (initial) {
      setIsLoadingRooms(true)
    }

    try {
      const payload = await fetchRooms()
      setRooms(payload.rooms)
      setRoomsError('')
    } catch {
      setRoomsError('Failed to load rooms right now.')
      if (initial) {
        setRooms([])
      }
    } finally {
      if (initial) {
        setIsLoadingRooms(false)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadInitial = async () => {
      await refreshRooms({ initial: true })
    }

    void loadInitial()
    const timerId = window.setInterval(() => {
      if (!cancelled) {
        void refreshRooms()
      }
    }, ROOMS_REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timerId)
    }
  }, [refreshRooms])

  const roomsWithPresence = useMemo(() => rooms, [rooms])

  const totalPlayersOnline = useMemo(
    () => roomsWithPresence.reduce((sum, room) => sum + room.players, 0),
    [roomsWithPresence]
  )

  const topicsWithPresence = useMemo(() => {
    const countsByTopic = {}
    roomsWithPresence.forEach((room) => {
      countsByTopic[room.topic] = (countsByTopic[room.topic] ?? 0) + room.players
    })

    return Object.entries(countsByTopic)
      .map(([name, count]) => ({
        name,
        icon: getTopicIcon(name),
        count,
      }))
      .sort((a, b) => b.count - a.count)
  }, [roomsWithPresence])

  const filteredRooms = selectedTopic
    ? roomsWithPresence.filter(room => room.topic === selectedTopic)
    : roomsWithPresence

  const handleCreateFormChange = (event) => {
    const { name, value } = event.target
    setCreateForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSelectEmoji = (emoji) => {
    setCreateForm((prev) => ({
      ...prev,
      image: emoji,
    }))
  }

  const handleCreateRoom = async (event) => {
    event.preventDefault()
    if (isCreatingRoom) return

    const name = createForm.name.trim()
    const topic = createForm.topic.trim()
    const image = createForm.image.trim() || '🎭'
    const parsedMaxPlayers = Number.parseInt(createForm.maxPlayers, 10)
    const selectedMap = getRoomMapById(createForm.mapId)

    if (!name) {
      setCreateError('Room name is required.')
      return
    }

    if (!topic) {
      setCreateError('Topic is required.')
      return
    }

    if (!Number.isFinite(parsedMaxPlayers) || parsedMaxPlayers < 2 || parsedMaxPlayers > 120) {
      setCreateError('Max players must be between 2 and 120.')
      return
    }

    setIsCreatingRoom(true)
    setCreateError('')

    try {
      const createdRoom = await createRoom({
        name,
        topic,
        image,
        maxPlayers: parsedMaxPlayers,
        mapId: selectedMap.id,
        mapModel: selectedMap.modelUrl,
        defaultYAxis: selectedMap.defaultYAxis,
      })

      setIsCreateModalOpen(false)
      setCreateForm({
        name: '',
        topic: '',
        image: '🎭',
        maxPlayers: '30',
        mapId: DEFAULT_ROOM_MAP.id,
      })
      navigate(`/rooms/${encodeURIComponent(createdRoom.id)}`)
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Could not create room right now.')
    } finally {
      setIsCreatingRoom(false)
    }
  }

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
              <span className="text-xs font-light text-[#8b7355] tracking-widest uppercase">{totalPlayersOnline} players online</span>
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
          {topicsWithPresence.map((topic) => (
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
          <div className="flex items-center gap-3">
            <span className="text-xs font-light text-[#718096] tracking-wider">
              {filteredRooms.length} room{filteredRooms.length !== 1 ? 's' : ''} available
            </span>
            <button
              type="button"
              onClick={() => {
                setCreateError('')
                setIsCreateModalOpen(true)
              }}
              className="px-4 py-2 rounded-lg border border-[#d4af37]/30 text-[#d4af37] text-[11px] tracking-widest uppercase hover:bg-[#d4af37]/10 transition-colors"
            >
              Create Room
            </button>
          </div>
        </div>

        {roomsError && (
          <p className="text-xs text-red-300 mb-4">{roomsError}</p>
        )}

        {isLoadingRooms && filteredRooms.length === 0 && (
          <p className="text-sm text-[#718096] mb-6">Loading rooms...</p>
        )}

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

      {isCreateModalOpen && (
        <CreateRoomModal
          isSubmitting={isCreatingRoom}
          error={createError}
          form={createForm}
          onChange={handleCreateFormChange}
          onSelectEmoji={handleSelectEmoji}
          onClose={() => {
            if (isCreatingRoom) return
            setIsCreateModalOpen(false)
            setCreateError('')
          }}
          onSubmit={handleCreateRoom}
        />
      )}
    </div>
  )
}

export default Home
