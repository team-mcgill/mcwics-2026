import { PublicKey } from '@solana/web3.js'

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

const textDecoder = new TextDecoder('utf-8')

const FALLBACK_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#111"/><circle cx="256" cy="256" r="190" fill="#1a1a1a" stroke="#d4af37" stroke-width="8"/><path d="M170 250c0-60 39-108 86-108s86 48 86 108" fill="none" stroke="#d4af37" stroke-width="10" stroke-linecap="round"/><circle cx="214" cy="244" r="10" fill="#d4af37"/><circle cx="298" cy="244" r="10" fill="#d4af37"/><path d="M216 300c10 16 24 24 40 24s30-8 40-24" fill="none" stroke="#d4af37" stroke-width="9" stroke-linecap="round"/><text x="256" y="430" fill="#888" text-anchor="middle" font-size="24" font-family="serif">No Image</text></svg>'
)}`

function readBorshString(bytes, offset) {
  if (offset + 4 > bytes.length) {
    return { value: '', offset: bytes.length }
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const length = view.getUint32(offset, true)
  const start = offset + 4
  const end = start + length

  if (end > bytes.length) {
    return { value: '', offset: bytes.length }
  }

  const raw = textDecoder.decode(bytes.slice(start, end))
  return {
    value: raw.replace(/\0/g, '').trim(),
    offset: end,
  }
}

function decodeMetadataAccount(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  if (bytes.length < 65) return null

  let offset = 1 + 32 + 32
  const name = readBorshString(bytes, offset)
  offset = name.offset
  const symbol = readBorshString(bytes, offset)
  offset = symbol.offset
  const uri = readBorshString(bytes, offset)

  return {
    name: name.value,
    symbol: symbol.value,
    uri: uri.value,
  }
}

async function fetchJson(uri) {
  if (!uri) return null
  try {
    const response = await fetch(uri)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function resolveImage(metadataJson) {
  if (metadataJson && typeof metadataJson.image === 'string' && metadataJson.image.trim()) {
    return metadataJson.image
  }
  return FALLBACK_IMAGE
}

function resolveMaskTexture(metadataJson) {
  if (
    metadataJson
    && metadataJson.properties
    && typeof metadataJson.properties.maskTexture === 'string'
    && metadataJson.properties.maskTexture.trim()
  ) {
    return metadataJson.properties.maskTexture
  }

  return resolveImage(metadataJson)
}

function resolveStrokeData(metadataJson) {
  const candidate = metadataJson?.properties?.strokeData
  if (!Array.isArray(candidate)) return []

  return candidate
    .map((stroke) => {
      if (!stroke || typeof stroke !== 'object') return null
      if (typeof stroke.color !== 'string' || !stroke.color.trim()) return null
      if (!Number.isFinite(stroke.size)) return null
      if (!Array.isArray(stroke.points)) return null

      const points = stroke.points
        .filter((point) => point && Number.isFinite(point.x) && Number.isFinite(point.y))
        .map((point) => ({
          x: Math.max(0, Math.min(1, point.x)),
          y: Math.max(0, Math.min(1, point.y)),
        }))

      if (!points.length) return null

      return {
        color: stroke.color,
        size: Math.max(1, Number(stroke.size)),
        points,
      }
    })
    .filter(Boolean)
}

export async function fetchWalletDesignInventory(connection, ownerPublicKey) {
  if (!ownerPublicKey) return []

  const tokenAccounts = await connection.getParsedTokenAccountsByOwner(ownerPublicKey, {
    programId: TOKEN_PROGRAM_ID,
  })

  const mintSet = new Set()
  for (const { account } of tokenAccounts.value) {
    const tokenInfo = account.data?.parsed?.info?.tokenAmount
    const mint = account.data?.parsed?.info?.mint

    if (!mint || !tokenInfo) continue
    if (tokenInfo.amount === '1' && tokenInfo.decimals === 0) {
      mintSet.add(mint)
    }
  }

  const mints = [...mintSet]
  if (!mints.length) return []

  const metadataPdas = mints.map((mint) =>
    PublicKey.findProgramAddressSync(
      [
        new TextEncoder().encode('metadata'),
        METADATA_PROGRAM_ID.toBytes(),
        new PublicKey(mint).toBytes(),
      ],
      METADATA_PROGRAM_ID
    )[0]
  )

  const metadataAccounts = await connection.getMultipleAccountsInfo(metadataPdas)

  const withJson = await Promise.all(
    mints.map(async (mint, index) => {
      const account = metadataAccounts[index]
      const metadata = account?.data ? decodeMetadataAccount(account.data) : null
      const metadataJson = metadata?.uri ? await fetchJson(metadata.uri) : null

      return {
        mint,
        metadata,
        metadataJson,
      }
    })
  )

  return withJson.map((item) => {
    const offchainName = typeof item.metadataJson?.name === 'string' ? item.metadataJson.name.trim() : ''
    const onchainName = typeof item.metadata?.name === 'string' ? item.metadata.name.trim() : ''
    const name = offchainName || onchainName || `Mask ${item.mint.slice(0, 6)}`
    return {
      id: item.mint,
      mintAddress: item.mint,
      name,
      imageData: resolveImage(item.metadataJson),
      paintData: resolveMaskTexture(item.metadataJson),
      strokeData: resolveStrokeData(item.metadataJson),
      createdAt: item.metadataJson?.createdAt ?? null,
      minted: true,
      metadataUri: item.metadata?.uri ?? null,
      hasImageFallback: !item.metadataJson?.image,
    }
  })
}

export { FALLBACK_IMAGE }
