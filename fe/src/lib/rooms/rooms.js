export const ROOMS = [
  { id: 1, name: 'The Grand Ballroom', topic: 'Music', players: 24, maxPlayers: 50, image: '🎭' },
  { id: 2, name: 'Garden of Whispers', topic: 'Romance', players: 12, maxPlayers: 30, image: '🌹' },
  { id: 3, name: 'Midnight Gallery', topic: 'Art', players: 8, maxPlayers: 20, image: '🎨' },
  { id: 4, name: 'Shadow Theater', topic: 'Mystery', players: 18, maxPlayers: 40, image: '🎪' },
  { id: 5, name: 'Crystal Palace', topic: 'Fashion', players: 31, maxPlayers: 60, image: '💎' },
  { id: 6, name: 'Velvet Lounge', topic: 'Poetry', players: 6, maxPlayers: 25, image: '📜' },
]

export const TOPICS = [
  { name: 'Music', icon: '🎵', count: 124 },
  { name: 'Art', icon: '🎨', count: 89 },
  { name: 'Romance', icon: '💫', count: 67 },
  { name: 'Mystery', icon: '🔮', count: 45 },
  { name: 'Fashion', icon: '👑', count: 156 },
  { name: 'Poetry', icon: '✨', count: 34 },
]

export function getRoomById(roomId) {
  const normalizedId = Number(roomId)
  return ROOMS.find((room) => room.id === normalizedId) ?? null
}
