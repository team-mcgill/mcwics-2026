import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWallet } from '@solana/wallet-adapter-react'
import { RoomScene } from '../components/room/RoomScene'
import { createRoomSocket } from '../lib/api/roomsSocket'
import { getRoomById } from '../lib/rooms/rooms'

const EQUIPPED_MASK_STORAGE_KEY = 'masquerade:equipped-mask'
const CHAT_BUBBLE_TTL_MS = 5000
const MAX_CHAT_MESSAGES = 80
const MOVE_SEND_INTERVAL_MS = 80

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
      name: typeof parsed.name === 'string' ? parsed.name : '',
      mintAddress: typeof parsed.mintAddress === 'string' ? parsed.mintAddress : '',
    }
  } catch {
    return null
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

function Room() {
  const { roomId } = useParams()
  const room = useMemo(() => getRoomById(roomId), [roomId])

  const { publicKey } = useWallet()
  const displayName = useMemo(() => getShortWalletLabel(publicKey), [publicKey])
  const walletAddress = useMemo(() => (publicKey ? publicKey.toBase58() : ''), [publicKey])
  const equippedMask = useMemo(() => loadEquippedMask(), [])

  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [connectionError, setConnectionError] = useState('')
  const [localPlayerId, setLocalPlayerId] = useState('')
  const [playersById, setPlayersById] = useState({})
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')

  const socketRef = useRef(null)
  const moveSentAtRef = useRef(0)
  const chatInputRef = useRef(null)

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
        socket.sendJoin({
          name: displayName,
          wallet: walletAddress,
          cosmeticImageData: equippedMask?.imageData || '',
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
  }, [displayName, equippedMask?.imageData, handleSocketMessage, room, walletAddress])

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
      <div className="max-w-7xl mx-auto px-4 md:px-6 h-[calc(100vh-7.5rem)] flex flex-col">
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-light text-white tracking-wide">{room.name}</h1>
            <p className="text-xs md:text-sm font-light text-[#718096] tracking-wide mt-1">
              WASD to move · Click + drag to look · Enter to chat · {displayName}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] font-light tracking-widest uppercase text-[#8b7355]">Status</p>
            <p className="text-xs font-light text-white/70 mt-1">{connectionStatus}</p>
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden bg-[#111] inner-glow">
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
        </div>
      </div>
    </div>
  )
}

export default Room
