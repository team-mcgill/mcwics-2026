import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { RoomScene } from '../components/room/RoomScene'
import { createRoomSocket } from '../lib/api/roomsSocket'
import { getRoomById, ROOMS } from '../lib/rooms/rooms'
import { FALLBACK_IMAGE, fetchWalletDesignInventory } from '../lib/solana/inventory'

const EQUIPPED_MASK_STORAGE_KEY = 'masquerade:equipped-mask'
const CHAT_BUBBLE_TTL_MS = 5000
const MAX_CHAT_MESSAGES = 80
const MOVE_SEND_INTERVAL_MS = 80
const MASK_STROKE_RENDER_BASE_WIDTH = 640
const MASK_STROKE_RENDER_SIZES = [1536, 1024, 768]
const MAX_COSMETIC_IMAGE_DATA_SAFE_LENGTH = 2_800_000
const MASK_STROKE_TARGET_FILL = 0.92
const MASK_STROKE_AUTO_FIT_MAX_SCALE = 10
const MASK_STROKE_ALPHA_THRESHOLD = 30
const MASK_STROKE_WIDTH_BOOST = 1.45

function percentileFromSorted(sortedValues, ratio) {
  if (!sortedValues.length) return 0

  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.floor(ratio * (sortedValues.length - 1))))
  return sortedValues[index]
}

function normalizeStrokeData(strokeData) {
  if (!Array.isArray(strokeData)) return []

  return strokeData
    .map((stroke) => {
      if (!stroke || typeof stroke !== 'object') return null
      if (typeof stroke.color !== 'string' || !stroke.color.trim()) return null
      if (!Number.isFinite(stroke.size)) return null
      if (!Array.isArray(stroke.points)) return null

      const points = stroke.points
        .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
        .map((point) => ({
          x: Math.max(0, Math.min(1, Number(point.x))),
          y: Math.max(0, Math.min(1, Number(point.y))),
        }))

      if (!points.length) return null

      return {
        color: stroke.color,
        size: Math.max(1, Number(stroke.size)),
        points,
      }
    })
    .filter(Boolean)
}

function computeStrokeBounds(strokes) {
  const xValues = []
  const yValues = []

  strokes.forEach((stroke) => {
    const strokePadding = Math.max(1, stroke.size) / MASK_STROKE_RENDER_BASE_WIDTH / 2
    stroke.points.forEach((point) => {
      xValues.push(point.x - strokePadding, point.x + strokePadding)
      yValues.push(point.y - strokePadding, point.y + strokePadding)
    })
  })

  if (!xValues.length || !yValues.length) {
    return null
  }

  const sortedX = [...xValues].sort((a, b) => a - b)
  const sortedY = [...yValues].sort((a, b) => a - b)

  const useRobustBounds = sortedX.length >= 48 && sortedY.length >= 48
  const lowerRatio = useRobustBounds ? 0.06 : 0
  const upperRatio = useRobustBounds ? 0.94 : 1

  const minX = percentileFromSorted(sortedX, lowerRatio)
  const maxX = percentileFromSorted(sortedX, upperRatio)
  const minY = percentileFromSorted(sortedY, lowerRatio)
  const maxY = percentileFromSorted(sortedY, upperRatio)

  const width = Math.max(0, maxX - minX)
  const height = Math.max(0, maxY - minY)

  return {
    width,
    height,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  }
}

function cleanupLowAlphaPixels(ctx, textureSize) {
  const imageData = ctx.getImageData(0, 0, textureSize, textureSize)
  const pixels = imageData.data

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]
    if (alpha <= MASK_STROKE_ALPHA_THRESHOLD) {
      pixels[i] = 0
      pixels[i + 1] = 0
      pixels[i + 2] = 0
      pixels[i + 3] = 0
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

function renderStrokeDataToImageDataUrl(strokeData, textureSize) {
  const normalizedStrokes = normalizeStrokeData(strokeData)
  if (!normalizedStrokes.length) return ''

  const canvas = document.createElement('canvas')
  canvas.width = textureSize
  canvas.height = textureSize

  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.clearRect(0, 0, textureSize, textureSize)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const widthScale = textureSize / MASK_STROKE_RENDER_BASE_WIDTH
  const bounds = computeStrokeBounds(normalizedStrokes)

  let scaleToFill = 1
  let centerX = 0.5
  let centerY = 0.5

  if (bounds && bounds.width > 0.0001 && bounds.height > 0.0001) {
    const fitScale = Math.min(
      MASK_STROKE_TARGET_FILL / bounds.width,
      MASK_STROKE_TARGET_FILL / bounds.height
    )

    scaleToFill = Math.min(MASK_STROKE_AUTO_FIT_MAX_SCALE, Math.max(1, fitScale))
    centerX = bounds.centerX
    centerY = bounds.centerY
  }

  const toTextureX = (x) => ((x - centerX) * scaleToFill + 0.5) * textureSize
  const toTextureY = (y) => ((y - centerY) * scaleToFill + 0.5) * textureSize

  normalizedStrokes.forEach((stroke) => {
    const points = stroke.points
    const lineWidth = Math.min(textureSize * 0.24, Math.max(1, stroke.size * widthScale * scaleToFill * MASK_STROKE_WIDTH_BOOST))

    if (points.length === 1) {
      ctx.beginPath()
      ctx.fillStyle = stroke.color
      ctx.arc(toTextureX(points[0].x), toTextureY(points[0].y), lineWidth / 2, 0, Math.PI * 2)
      ctx.fill()
      return
    }

    ctx.beginPath()
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = lineWidth
    ctx.moveTo(toTextureX(points[0].x), toTextureY(points[0].y))

    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(toTextureX(points[i].x), toTextureY(points[i].y))
    }

    ctx.stroke()
  })

  cleanupLowAlphaPixels(ctx, textureSize)

  return canvas.toDataURL('image/png')
}

function resolveEquippedMaskImageData(mask) {
  if (!mask || typeof mask !== 'object') return ''

  const strokeData = normalizeStrokeData(mask.strokeData)
  if (strokeData.length) {
    for (const textureSize of MASK_STROKE_RENDER_SIZES) {
      const rendered = renderStrokeDataToImageDataUrl(strokeData, textureSize)
      if (rendered && rendered.length <= MAX_COSMETIC_IMAGE_DATA_SAFE_LENGTH) {
        return rendered
      }
    }
  }

  if (typeof mask.paintData === 'string' && mask.paintData) {
    return mask.paintData
  }

  if (typeof mask.imageData === 'string' && mask.imageData) {
    return mask.imageData
  }

  return ''
}

function getShortWalletLabel(publicKey) {
  if (!publicKey || typeof publicKey.toBase58 !== 'function') {
    return 'Guest'
  }

  const value = publicKey.toBase58()
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function loadEquippedMask() {
  try {
    const raw = window.localStorage.getItem(EQUIPPED_MASK_STORAGE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    return {
      imageData: typeof parsed.imageData === 'string' ? parsed.imageData : '',
      paintData: typeof parsed.paintData === 'string' ? parsed.paintData : '',
      strokeData: normalizeStrokeData(parsed.strokeData),
      name: typeof parsed.name === 'string' ? parsed.name : '',
      mintAddress: typeof parsed.mintAddress === 'string' ? parsed.mintAddress : '',
    }
  } catch {
    return null
  }
}

function persistEquippedMask(mask) {
  try {
    if (!mask) {
      window.localStorage.removeItem(EQUIPPED_MASK_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(EQUIPPED_MASK_STORAGE_KEY, JSON.stringify({
      imageData: typeof mask.imageData === 'string' ? mask.imageData : '',
      paintData: typeof mask.paintData === 'string' ? mask.paintData : '',
      strokeData: normalizeStrokeData(mask.strokeData),
      name: typeof mask.name === 'string' ? mask.name : '',
      mintAddress: typeof mask.mintAddress === 'string' ? mask.mintAddress : '',
    }))
  } catch {
    // Ignore storage write failures.
  }
}

function upsertPlayer(existingState, player) {
  return {
    ...existingState,
    [player.id]: {
      id: player.id,
      name: player.name || 'Guest',
      wallet: player.wallet || '',
      position: {
        x: Number(player.position?.x ?? 0),
        y: Number(player.position?.y ?? 0),
        z: Number(player.position?.z ?? 0),
      },
      rotationY: Number(player.rotationY ?? 0),
      cosmeticImageData: typeof player.cosmeticImageData === 'string' ? player.cosmeticImageData : '',
      chatText: existingState[player.id]?.chatText || '',
      chatExpiresAt: existingState[player.id]?.chatExpiresAt || 0,
    },
  }
}

function StatusIndicator({ status }) {
  const statusConfig = {
    connected: { dot: 'bg-emerald-500', pulse: false, text: '', textColor: 'text-emerald-400' },
    connecting: { dot: 'bg-amber-400', pulse: true, text: '...', textColor: 'text-amber-400' },
    disconnected: { dot: 'bg-red-500', pulse: false, text: '', textColor: 'text-red-400' },
    error: { dot: 'bg-red-500', pulse: false, text: '', textColor: 'text-red-400' },
  }

  const config = statusConfig[status] || statusConfig.connecting

  return (
    <div className="flex items-center gap-2 px-1.5 py-1.5 rounded-full bg-[#111]/80 border border-white/5">
      <span className={`w-2 h-2 rounded-full ${config.dot} ${config.pulse ? 'animate-pulse' : ''}`} />
      <span className={`text-[11px] font-light tracking-wide ${config.textColor}`}>{config.text}</span>
    </div>
  )
}

function RoomSelectorSidebar({ isOpen, onClose, currentRoomId }) {
  const navigate = useNavigate()

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={`fixed top-0 left-0 h-full w-80 bg-[#0a0a0a]/95 backdrop-blur-xl border-r border-[#d4af37]/20 z-50 transform transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
            <div className="flex items-center gap-3">
                🗝️
              <span className="font-serif text-white tracking-[0.1em]">Rooms</span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-[#718096] hover:text-[#d4af37] transition-colors"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 6L18 18" strokeLinecap="round" />
                <path d="M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4">
            {ROOMS.map((room) => {
              const isCurrent = room.id === Number(currentRoomId)
              return (
                <button
                  key={room.id}
                  onClick={() => {
                    if (!isCurrent) {
                      navigate(`/rooms/${room.id}`)
                    }
                    onClose()
                  }}
                  className={`w-full text-left px-6 py-4 transition-all duration-200 group ${
                    isCurrent
                      ? 'bg-[#d4af37]/10 border-l-2 border-[#d4af37]'
                      : 'hover:bg-white/5 border-l-2 border-transparent hover:border-[#d4af37]/50'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-2xl">{room.image}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-serif text-sm tracking-wide truncate ${isCurrent ? 'text-[#d4af37]' : 'text-white group-hover:text-[#f5f5dc]'}`}>
                        {room.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-[#718096]">{room.topic}</span>
                        <span className="w-1 h-1 rounded-full bg-[#718096]" />
                        <span className="text-[11px] text-[#8b7355]">{room.players} online</span>
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="px-6 py-4 border-t border-white/5">
            <Link
              to="/"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-white/10 text-[#a0a0a0] text-xs tracking-widest uppercase hover:border-[#d4af37]/30 hover:text-[#d4af37] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 12L21 12M3 12L9 6M3 12L9 18" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Back to Lobby
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

function Room() {
  const { roomId } = useParams()
  const room = useMemo(() => getRoomById(roomId), [roomId])

  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const displayName = useMemo(() => getShortWalletLabel(publicKey), [publicKey])
  const walletAddress = useMemo(() => (publicKey ? publicKey.toBase58() : ''), [publicKey])
  const [equippedMask, setEquippedMask] = useState(() => loadEquippedMask())

  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [connectionError, setConnectionError] = useState('')
  const [localPlayerId, setLocalPlayerId] = useState('')
  const [playersById, setPlayersById] = useState({})
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [isChangingMask, setIsChangingMask] = useState(false)
  const [availableMasks, setAvailableMasks] = useState([])
  const [isLoadingMasks, setIsLoadingMasks] = useState(false)
  const [maskLoadError, setMaskLoadError] = useState('')
  const [maskEquipError, setMaskEquipError] = useState('')
  const [isRoomSelectorOpen, setIsRoomSelectorOpen] = useState(false)

  const socketRef = useRef(null)
  const moveSentAtRef = useRef(0)
  const chatInputRef = useRef(null)
  const equippedMaskRef = useRef(equippedMask)

  useEffect(() => {
    equippedMaskRef.current = equippedMask
  }, [equippedMask])

  const handleSocketMessage = useCallback((payload) => {
    if (!payload || typeof payload !== 'object') return

    if (payload.type === 'joined') {
      setLocalPlayerId(typeof payload.playerId === 'string' ? payload.playerId : '')
      return
    }

    if (payload.type === 'snapshot' && Array.isArray(payload.players)) {
      const next = {}
      payload.players.forEach((player) => {
        if (player?.id) {
          next[player.id] = {
            id: player.id,
            name: player.name || 'Guest',
            wallet: player.wallet || '',
            position: {
              x: Number(player.position?.x ?? 0),
              y: Number(player.position?.y ?? 0),
              z: Number(player.position?.z ?? 0),
            },
            rotationY: Number(player.rotationY ?? 0),
            cosmeticImageData: typeof player.cosmeticImageData === 'string' ? player.cosmeticImageData : '',
            chatText: '',
            chatExpiresAt: 0,
          }
        }
      })
      setPlayersById(next)
      return
    }

    if (payload.type === 'player_joined' && payload.player?.id) {
      setPlayersById((prev) => upsertPlayer(prev, payload.player))
      return
    }

    if (payload.type === 'player_moved' && typeof payload.playerId === 'string') {
      setPlayersById((prev) => {
        const current = prev[payload.playerId]
        if (!current) return prev

        return {
          ...prev,
          [payload.playerId]: {
            ...current,
            position: {
              x: Number(payload.position?.x ?? current.position.x),
              y: Number(payload.position?.y ?? current.position.y),
              z: Number(payload.position?.z ?? current.position.z),
            },
            rotationY: Number(payload.rotationY ?? current.rotationY),
          },
        }
      })
      return
    }

    if (payload.type === 'player_cosmetic_updated' && typeof payload.playerId === 'string') {
      setPlayersById((prev) => {
        const current = prev[payload.playerId]
        if (!current) return prev

        return {
          ...prev,
          [payload.playerId]: {
            ...current,
            cosmeticImageData: typeof payload.cosmeticImageData === 'string' ? payload.cosmeticImageData : '',
          },
        }
      })
      return
    }

    if (payload.type === 'set_cosmetic_ack') {
      if (payload.accepted) {
        setMaskEquipError('')
      } else {
        setMaskEquipError(
          typeof payload.reason === 'string' && payload.reason.trim()
            ? payload.reason
            : 'Could not equip this mask right now.'
        )
      }
      return
    }

    if (payload.type === 'player_left' && typeof payload.playerId === 'string') {
      setPlayersById((prev) => {
        if (!prev[payload.playerId]) return prev
        const next = { ...prev }
        delete next[payload.playerId]
        return next
      })
      return
    }

    if (payload.type === 'chat' && typeof payload.playerId === 'string' && typeof payload.text === 'string') {
      const timestamp = payload.createdAt || new Date().toISOString()
      const name = typeof payload.name === 'string' ? payload.name : 'Guest'

      setMessages((prev) => {
        const next = [...prev, { playerId: payload.playerId, name, text: payload.text, createdAt: timestamp }]
        if (next.length <= MAX_CHAT_MESSAGES) return next
        return next.slice(next.length - MAX_CHAT_MESSAGES)
      })

      setPlayersById((prev) => {
        const current = prev[payload.playerId]
        if (!current) return prev

        return {
          ...prev,
          [payload.playerId]: {
            ...current,
            chatText: payload.text,
            chatExpiresAt: Date.now() + CHAT_BUBBLE_TTL_MS,
          },
        }
      })
      return
    }

    if (payload.type === 'error' && typeof payload.message === 'string') {
      setConnectionError(payload.message)
    }
  }, [])

  useEffect(() => {
    if (!room) return undefined

    setConnectionStatus('connecting')
    setConnectionError('')
    setMaskEquipError('')
    setLocalPlayerId('')
    setPlayersById({})
    setMessages([])

    const socket = createRoomSocket({
      roomId: String(room.id),
      onMessage: handleSocketMessage,
      onOpen: () => {
        setConnectionStatus('connected')
        setConnectionError('')
      },
      onClose: () => {
        setConnectionStatus('disconnected')
      },
      onError: () => {
        if (socket.isOpen()) return
        setConnectionStatus('error')
        setConnectionError('Failed to connect to room socket.')
      },
    })

    socketRef.current = socket
    let cancelled = false

    socket.connect()
      .then(() => {
        if (cancelled) return
        const initialCosmeticImageData = resolveEquippedMaskImageData(equippedMaskRef.current)
        socket.sendJoin({
          name: displayName,
          wallet: walletAddress,
          cosmeticImageData: initialCosmeticImageData,
          position: { x: 0, y: 0, z: 0 },
          rotationY: 0,
        })
      })
      .catch(() => {
        if (cancelled) return
        setConnectionStatus('error')
        setConnectionError('Could not join this room right now.')
      })

    return () => {
      cancelled = true
      socket.close()
      socketRef.current = null
    }
  }, [displayName, handleSocketMessage, room, walletAddress])

  const refreshRoomMasks = useCallback(async () => {
    if (!publicKey) {
      setAvailableMasks([])
      setMaskLoadError('')
      return
    }

    setIsLoadingMasks(true)
    setMaskLoadError('')

    try {
      const nextMasks = await fetchWalletDesignInventory(connection, publicKey)
      setAvailableMasks(nextMasks)
    } catch {
      setMaskLoadError('Failed to load masks from devnet.')
      setAvailableMasks([])
    } finally {
      setIsLoadingMasks(false)
    }
  }, [connection, publicKey])

  useEffect(() => {
    if (!isChangingMask) return
    void refreshRoomMasks()
  }, [isChangingMask, refreshRoomMasks])

  const applyEquippedMask = useCallback((mask) => {
    const maskImageData = resolveEquippedMaskImageData(mask)
    if (mask && !maskImageData) {
      setMaskEquipError('Selected mask does not have usable texture data.')
      return
    }

    const nextMask = mask
      ? {
        imageData: maskImageData,
        paintData: typeof mask.paintData === 'string' ? mask.paintData : '',
        strokeData: normalizeStrokeData(mask.strokeData),
        name: typeof mask.name === 'string' ? mask.name : '',
        mintAddress: typeof mask.mintAddress === 'string' ? mask.mintAddress : '',
      }
      : null

    setEquippedMask(nextMask)
    persistEquippedMask(nextMask)
    setMaskEquipError('')

    if (localPlayerId) {
      setPlayersById((prev) => {
        const current = prev[localPlayerId]
        if (!current) return prev

        return {
          ...prev,
          [localPlayerId]: {
            ...current,
            cosmeticImageData: nextMask?.imageData || '',
          },
        }
      })
    }

    const sent = socketRef.current?.sendSetCosmetic({
      cosmeticImageData: nextMask?.imageData || '',
    }) === true

    if (!sent) {
      setMaskEquipError('Socket is not open; mask update was not sent.')
    }

    setIsChangingMask(false)
  }, [localPlayerId])

  const handleLocalMove = useCallback(({ position, rotationY }) => {
    const now = Date.now()
    if (now - moveSentAtRef.current < MOVE_SEND_INTERVAL_MS) {
      return
    }

    moveSentAtRef.current = now

    if (localPlayerId) {
      setPlayersById((prev) => {
        const current = prev[localPlayerId]
        if (!current) return prev
        return {
          ...prev,
          [localPlayerId]: {
            ...current,
            position,
            rotationY,
          },
        }
      })
    }

    socketRef.current?.sendMove({ position, rotationY })
  }, [localPlayerId])

  const handleSubmitChat = useCallback((event) => {
    event.preventDefault()
    const trimmed = chatInput.trim()
    if (!trimmed) return

    socketRef.current?.sendChat(trimmed)
    setChatInput('')
    chatInputRef.current?.blur()
  }, [chatInput])

  if (!room) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] pt-28 px-6">
        <div className="max-w-4xl mx-auto rounded-2xl bg-[#111] inner-glow p-8 text-center">
          <h1 className="text-2xl font-serif font-light text-white mb-3 tracking-wide">Room not found</h1>
          <p className="text-sm font-light text-[#718096] mb-6">This room doesn&apos;t exist anymore.</p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-2 rounded-lg text-[#0a0a0a] font-light text-xs tracking-widest uppercase btn-convex"
          >
            Back to Rooms
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-4">
      <RoomSelectorSidebar
        isOpen={isRoomSelectorOpen}
        onClose={() => setIsRoomSelectorOpen(false)}
        currentRoomId={roomId}
      />

      <div className="max-w-7xl mx-auto px-4 md:px-6 h-[calc(100vh-7.5rem)] flex flex-col">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsRoomSelectorOpen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#111] border border-white/10 text-[#d4af37] hover:border-[#d4af37]/50 hover:bg-[#d4af37]/5 transition-all"
              aria-label="Change Room"
            >
            🗝️
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl md:text-2xl font-serif font-light text-white tracking-wide">{room.name}</h1>
                <span className="px-2 py-0.5 rounded-full bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-[10px] tracking-wider">
                  {Object.keys(playersById).length} here
                </span>
              </div>
              <p className="text-xs md:text-sm font-light text-[#718096] tracking-wide mt-1">
                WASD to move · Click + drag to look · Enter to chat · {displayName}
              </p>
            </div>
          </div>

          <StatusIndicator status={connectionStatus} />
        </div>

        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden bg-[#111] inner-glow relative">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a]/20 via-transparent to-[#0a0a0a]/40 pointer-events-none z-10" />
          <RoomScene
            playersById={playersById}
            localPlayerId={localPlayerId}
            onLocalMove={handleLocalMove}
          />
        </div>

        <div className="mt-3 rounded-2xl bg-[#111] inner-glow px-3 py-3 md:px-4 md:py-4">
          <div className="max-h-28 overflow-y-auto mb-3 space-y-1.5 pr-1">
            {messages.length === 0 ? (
              <p className="text-xs font-light text-[#555]">No chat yet. Say hi.</p>
            ) : (
              messages.map((message, index) => (
                <p key={`${message.playerId}-${message.createdAt}-${index}`} className="text-xs font-light text-[#d0d0d0] break-words">
                  <span className="text-[#d4af37]">{message.name}:</span> {message.text}
                </p>
              ))
            )}
          </div>

          <form onSubmit={handleSubmitChat}>
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder="Type a message and press Enter"
              maxLength={240}
              className="w-full rounded-lg bg-[#0c0c0c] border border-white/10 px-4 py-2.5 text-sm text-white/90 placeholder:text-[#555] focus:outline-none focus:border-[#d4af37]/40"
            />
          </form>

          {connectionError && (
            <p className="mt-2 text-xs font-light text-red-400">{connectionError}</p>
          )}

          {maskEquipError && (
            <p className="mt-2 text-xs font-light text-red-300">{maskEquipError}</p>
          )}
        </div>

        {isChangingMask && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-[#111] inner-glow p-5 md:p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-lg md:text-xl font-serif font-light text-white tracking-wide">Changing Room</h2>
                  <p className="text-xs text-[#718096] mt-1">
                    {equippedMask?.name ? `Equipped: ${equippedMask.name}` : 'No mask equipped'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangingMask(false)}
                  className="text-xs tracking-widest uppercase text-[#a0a0a0] hover:text-white"
                >
                  Close
                </button>
              </div>

              {!publicKey ? (
                <p className="text-sm text-[#718096]">Connect your wallet to load masks.</p>
              ) : isLoadingMasks ? (
                <p className="text-sm text-[#718096]">Loading masks...</p>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => applyEquippedMask(null)}
                      className="px-3 py-1.5 rounded-lg border border-red-400/30 text-red-300 text-[11px] tracking-widest uppercase hover:bg-red-500/10"
                    >
                      Unequip
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshRoomMasks()}
                      className="px-3 py-1.5 rounded-lg border border-white/20 text-white/80 text-[11px] tracking-widest uppercase hover:bg-white/5"
                    >
                      Refresh
                    </button>
                  </div>

                  {maskLoadError && (
                    <p className="text-xs text-red-300 mb-3">{maskLoadError}</p>
                  )}

                  {availableMasks.length === 0 ? (
                    <p className="text-sm text-[#718096]">No masks found in your devnet inventory.</p>
                  ) : (
                    <div className="max-h-[56vh] overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3">
                      {availableMasks.map((mask) => {
                        const isEquipped = Boolean(equippedMask?.mintAddress) && equippedMask.mintAddress === mask.mintAddress

                        return (
                          <button
                            key={mask.id}
                            type="button"
                            onClick={() => applyEquippedMask(mask)}
                            className={`text-left rounded-xl overflow-hidden border transition-colors ${isEquipped ? 'border-[#d4af37]/70' : 'border-white/10 hover:border-[#d4af37]/30'}`}
                          >
                            <div className="aspect-square bg-[#1a1a1a]">
                              <img
                                src={mask.imageData || FALLBACK_IMAGE}
                                alt={mask.name || 'Mask'}
                                onError={(event) => {
                                  event.currentTarget.src = FALLBACK_IMAGE
                                }}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="px-2.5 py-2">
                              <p className="text-xs text-white truncate">{mask.name || 'Untitled mask'}</p>
                              <p className="text-[10px] text-[#8b7355] mt-1 tracking-widest uppercase">
                                {isEquipped ? 'Equipped' : 'Equip'}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Room
