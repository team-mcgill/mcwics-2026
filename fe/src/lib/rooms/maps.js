export const ROOM_MAPS = [
  {
    id: 'futuristic-plaza',
    name: 'Futuristic Plaza',
    modelUrl: '/models/futuristic_plaza.glb',
    defaultYAxis: 0,
  },
  {
    id: 'japanese-garden',
    name: 'Japanese Garden',
    modelUrl: '/models/japanese_garden.glb',
    defaultYAxis: 2.0,
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
