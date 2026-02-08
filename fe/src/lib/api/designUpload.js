const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')
const TOKEN_TTL_MS = 55 * 60 * 1000
const walletTokenCache = new Map()

async function parseResponse(response) {
  if (response.ok) {
    return response.json()
  }

  let detail = 'Request failed.'
  try {
    const payload = await response.json()
    if (typeof payload?.detail === 'string' && payload.detail.trim()) {
      detail = payload.detail
    }
  } catch {
    detail = `Request failed with status ${response.status}`
  }

  throw new Error(detail)
}

function getWalletAddress(publicKey) {
  if (!publicKey) {
    throw new Error('Please connect your wallet first.')
  }

  if (typeof publicKey.toBase58 !== 'function') {
    throw new Error('Invalid wallet connection state.')
  }

  return publicKey.toBase58()
}

function getCachedToken(wallet) {
  const record = walletTokenCache.get(wallet)
  if (!record) return ''
  if (record.expiresAt <= Date.now()) {
    walletTokenCache.delete(wallet)
    return ''
  }
  return record.token
}

function setCachedToken(wallet, token) {
  walletTokenCache.set(wallet, {
    token,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  })
}

function clearCachedToken(wallet) {
  walletTokenCache.delete(wallet)
}

async function authenticateWallet({ publicKey, signMessage }) {
  if (typeof signMessage !== 'function') {
    throw new Error('Your wallet does not support signMessage. Please use Phantom sign message and try again.')
  }

  const wallet = getWalletAddress(publicKey)

  const challenge = await parseResponse(
    await fetch(`${API_BASE_URL}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet }),
    })
  )

  const messageBytes = new TextEncoder().encode(challenge.message)
  const signatureBytes = await signMessage(messageBytes)
  const signature = Buffer.from(signatureBytes).toString('base64')

  const verified = await parseResponse(
    await fetch(`${API_BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet,
        nonce: challenge.nonce,
        message: challenge.message,
        signature,
      }),
    })
  )

  const token = verified.accessToken
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Wallet authentication failed.')
  }

  setCachedToken(wallet, token)
  return token
}

async function postWithWalletAuth({ publicKey, signMessage, path, body }) {
  const wallet = getWalletAddress(publicKey)

  const request = (accessToken) => fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })

  let accessToken = getCachedToken(wallet)
  if (!accessToken) {
    accessToken = await authenticateWallet({ publicKey, signMessage })
  }

  let response = await request(accessToken)
  if (response.status === 401) {
    clearCachedToken(wallet)
    accessToken = await authenticateWallet({ publicKey, signMessage })
    response = await request(accessToken)
  }

  return parseResponse(response)
}

export async function uploadDesignMetadataWithWalletAuth({
  publicKey,
  signMessage,
  name,
  imageData,
  strokeData,
  accessoryData,
}) {
  return postWithWalletAuth({
    publicKey,
    signMessage,
    path: '/api/designs/upload',
    body: { name, imageData, strokeData, accessoryData },
  })
}

export async function updateDesignMetadataWithWalletAuth({
  publicKey,
  signMessage,
  metadataUri,
  name,
  imageData,
  strokeData,
  accessoryData,
}) {
  return postWithWalletAuth({
    publicKey,
    signMessage,
    path: '/api/designs/update',
    body: { metadataUri, name, imageData, strokeData, accessoryData },
  })
}

export async function deleteDesignMetadataWithWalletAuth({
  publicKey,
  signMessage,
  metadataUri,
}) {
  return postWithWalletAuth({
    publicKey,
    signMessage,
    path: '/api/designs/delete',
    body: { metadataUri },
  })
}
