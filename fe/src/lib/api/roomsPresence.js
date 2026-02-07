const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')

function sanitizePresencePayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { rooms: {}, totalPlayers: 0 }
  }

  const roomsSource = payload.rooms && typeof payload.rooms === 'object' ? payload.rooms : {}
  const rooms = {}

  Object.entries(roomsSource).forEach(([roomId, count]) => {
    const parsed = Number(count)
    if (!Number.isFinite(parsed)) return
    rooms[String(roomId)] = Math.max(0, Math.floor(parsed))
  })

  const totalFromRooms = Object.values(rooms).reduce((sum, count) => sum + count, 0)
  const totalPlayers = Number.isFinite(Number(payload.totalPlayers))
    ? Math.max(0, Math.floor(Number(payload.totalPlayers)))
    : totalFromRooms

  return { rooms, totalPlayers }
}

export async function fetchRoomsPresence() {
  const response = await fetch(`${API_BASE_URL}/api/rooms/presence`)
  if (!response.ok) {
    throw new Error('Failed to fetch rooms presence.')
  }

  const payload = await response.json()
  return sanitizePresencePayload(payload)
}
