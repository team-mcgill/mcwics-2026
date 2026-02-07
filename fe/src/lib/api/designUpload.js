const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '')

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

export async function uploadDesignMetadataWithWalletAuth({
  publicKey,
  signMessage,
  name,
  imageData,
  strokeData,
}) {
  if (!publicKey) {
    throw new Error('Please connect your wallet first.')
  }

  if (typeof signMessage !== 'function') {
    throw new Error('Your wallet does not support signMessage. Please use Phantom sign message and try again.')
  }

  const wallet = publicKey.toBase58()

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

  const uploaded = await parseResponse(
    await fetch(`${API_BASE_URL}/api/designs/upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${verified.accessToken}`,
      },
      body: JSON.stringify({ name, imageData, strokeData }),
    })
  )

  return uploaded
}
