export const ROOM_MAPS = [
  {
    id: 'futuristic-plaza',
    name: 'Futuristic Plaza',
    modelUrl: '/models/futuristic_plaza.glb',
    defaultYAxis: 0,
    spawnPoints: [
      { x: 6.5, y: 0, z: -5.25, rotationY: Math.PI * 0.55 },
      { x: -7, y: 0, z: 4.5, rotationY: -Math.PI * 0.4 },
      { x: 2.8, y: 1.1, z: 9.5, rotationY: Math.PI },
    ],
  },
  {
    id: 'underground-garden',
    name: 'Underground Garden',
    modelUrl: '/models/underground_garden.glb',
    defaultYAxis: 0,
    spawnPoints: [
      { x: 5.2, y: 0, z: -5.8, rotationY: Math.PI * 0.35 },
      { x: -6.1, y: 0, z: 5.6, rotationY: -Math.PI * 0.25 },
      { x: 7.8, y: 1.6, z: 2.4, rotationY: Math.PI * 0.9 },
    ],
  },
]

export const DEFAULT_ROOM_MAP = ROOM_MAPS[0]

const ROOM_MAPS_BY_ID = new Map(ROOM_MAPS.map((map) => [map.id, map]))

export function getRoomMapById(mapId) {
  if (typeof mapId !== 'string') {
    return DEFAULT_ROOM_MAP
  }

  return ROOM_MAPS_BY_ID.get(mapId.trim()) || DEFAULT_ROOM_MAP
}

function toFiniteNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeSpawn(spawn, fallback) {
  if (!spawn || typeof spawn !== 'object') {
    return { ...fallback }
  }

  return {
    x: toFiniteNumber(spawn.x, fallback.x),
    y: toFiniteNumber(spawn.y, fallback.y),
    z: toFiniteNumber(spawn.z, fallback.z),
    rotationY: toFiniteNumber(spawn.rotationY, fallback.rotationY),
  }
}

export function getRandomRoomSpawn(mapId, options = {}) {
  const roomMap = getRoomMapById(mapId)
  const fallbackY = toFiniteNumber(options?.fallbackY, roomMap.defaultYAxis)
  const fallback = {
    x: 0,
    y: fallbackY,
    z: 0,
    rotationY: 0,
  }

  const spawnPoints = Array.isArray(roomMap.spawnPoints) ? roomMap.spawnPoints : []
  if (!spawnPoints.length) {
    return fallback
  }

  const randomIndex = Math.floor(Math.random() * spawnPoints.length)
  return normalizeSpawn(spawnPoints[randomIndex], fallback)
}
