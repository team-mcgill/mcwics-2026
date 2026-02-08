import { DEFAULT_ROOM_MAP, getRoomMapById } from '../rooms/maps'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')

const DEFAULT_ROOM_IMAGE = '🎭'

function parseErrorMessage(payload, fallback) {
  if (!payload || typeof payload !== 'object') return fallback
  if (typeof payload.detail === 'string' && payload.detail.trim()) {
    return payload.detail
  }
  return fallback
}

function sanitizeRoom(room) {
  if (!room || typeof room !== 'object') return null

  const id = room.id == null ? '' : String(room.id).trim()
  if (!id) return null

  const name = typeof room.name === 'string' && room.name.trim() ? room.name.trim() : 'Untitled Room'
  const topic = typeof room.topic === 'string' && room.topic.trim() ? room.topic.trim() : 'General'
  const image = typeof room.image === 'string' && room.image.trim() ? room.image.trim() : DEFAULT_ROOM_IMAGE

  const players = Number(room.players)
  const maxPlayers = Number(room.maxPlayers)
  const selectedMap = getRoomMapById(room.mapId)
  const mapModel = typeof room.mapModel === 'string' && room.mapModel.trim()
    ? room.mapModel.trim()
    : selectedMap.modelUrl
  const parsedDefaultYAxis = Number(room.defaultYAxis)
  const hasRoomDefaultYAxis = Number.isFinite(parsedDefaultYAxis)
  const mapYAxisExceedsLegacyLimit = Math.abs(selectedMap.defaultYAxis) > 20
  const roomYAxisLooksLegacyClamped = hasRoomDefaultYAxis && Math.abs(parsedDefaultYAxis) <= 20
  const defaultYAxis = hasRoomDefaultYAxis
    ? ((Math.abs(parsedDefaultYAxis) < 0.0001 && selectedMap.defaultYAxis !== 0) || (mapYAxisExceedsLegacyLimit && roomYAxisLooksLegacyClamped)
      ? selectedMap.defaultYAxis
      : parsedDefaultYAxis)
    : selectedMap.defaultYAxis

  return {
    id,
    name,
    topic,
    image,
    players: Number.isFinite(players) ? Math.max(0, Math.floor(players)) : 0,
    maxPlayers: Number.isFinite(maxPlayers) ? Math.max(1, Math.floor(maxPlayers)) : 20,
    mapId: selectedMap.id,
    mapName: selectedMap.name,
    mapModel,
    defaultYAxis,
  }
}

export async function fetchRooms() {
  const response = await fetch(`${API_BASE_URL}/api/rooms`)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, 'Failed to fetch rooms.'))
  }

  const rawRooms = Array.isArray(payload?.rooms) ? payload.rooms : []
  const rooms = rawRooms.map((room) => sanitizeRoom(room)).filter(Boolean)

  return {
    rooms,
    totalPlayers: rooms.reduce((sum, room) => sum + room.players, 0),
  }
}

export async function createRoom({
  name,
  topic,
  image,
  maxPlayers,
  mapId = DEFAULT_ROOM_MAP.id,
  mapModel = DEFAULT_ROOM_MAP.modelUrl,
  defaultYAxis = DEFAULT_ROOM_MAP.defaultYAxis,
}) {
  const response = await fetch(`${API_BASE_URL}/api/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      topic,
      image,
      maxPlayers,
      mapId,
      mapModel,
      defaultYAxis,
    }),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(parseErrorMessage(payload, 'Failed to create room.'))
  }

  const room = sanitizeRoom(payload)
  if (!room) {
    throw new Error('Created room payload is invalid.')
  }

  return room
}
