const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')

function toWebSocketBaseUrl(httpUrl) {
  if (httpUrl.startsWith('https://')) {
    return `wss://${httpUrl.slice('https://'.length)}`
  }
  if (httpUrl.startsWith('http://')) {
    return `ws://${httpUrl.slice('http://'.length)}`
  }
  return httpUrl
}

export function createRoomSocket({ roomId, onMessage, onOpen, onClose, onError }) {
  const wsBaseUrl = toWebSocketBaseUrl(API_BASE_URL)
  const url = `${wsBaseUrl}/ws/rooms/${encodeURIComponent(roomId)}`
  let socket = null

  const send = (payload) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    socket.send(JSON.stringify(payload))
    return true
  }

  const connect = () => new Promise((resolve, reject) => {
    socket = new WebSocket(url)
    let settled = false

    socket.onopen = () => {
      onOpen?.()
      if (!settled) {
        settled = true
        resolve()
      }
    }

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        onMessage?.(payload)
      } catch (error) {
        onError?.(error)
      }
    }

    socket.onerror = (event) => {
      onError?.(event)
      if (!settled && socket.readyState !== WebSocket.OPEN) {
        settled = true
        reject(new Error('WebSocket connection failed.'))
      }
    }

    socket.onclose = () => {
      onClose?.()
    }
  })

  return {
    connect,
    sendJoin: ({ name, wallet, cosmeticImageData, cosmeticAccessories = [], position = { x: 0, y: 0, z: 0 }, rotationY = 0 }) => send({
      type: 'join',
      name,
      wallet,
      cosmeticImageData,
      cosmeticAccessories,
      position,
      rotationY,
    }),
    sendMove: ({ position, rotationY }) => send({
      type: 'move',
      position,
      rotationY,
    }),
    sendChat: (text) => send({
      type: 'chat',
      text,
    }),
    sendSetCosmetic: ({ cosmeticImageData, cosmeticAccessories = [] }) => send({
      type: 'set_cosmetic',
      cosmeticImageData,
      cosmeticAccessories,
    }),
    close: () => {
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close()
      }
    },
    isOpen: () => !!socket && socket.readyState === WebSocket.OPEN,
  }
}
