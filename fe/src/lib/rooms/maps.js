export const ROOM_MAPS = [
  {
    id: 'futuristic-plaza',
    name: 'Futuristic Plaza',
    modelUrl: '/models/futuristic_plaza.glb',
    defaultYAxis: 0,
  },
  {
    id: 'underground-garden',
    name: 'Underground Garden',
    modelUrl: '/models/underground_garden.glb',
    defaultYAxis: 0,
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
