import { useCallback, useEffect, useMemo, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  buyMarketplaceListingWithWalletAuth,
  fetchMarketplaceListings,
} from '../lib/api/marketplace'
import { sendListingPayment } from '../lib/solana/marketplace'
import { FALLBACK_IMAGE } from '../lib/solana/inventory'

const CATEGORIES = ['All', 'Masks', 'Accessories', 'Outfits', 'Effects']

function formatSol(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0'
  return numeric.toFixed(3).replace(/\.?0+$/, '')
}

function formatWallet(address) {
  if (!address || address.length < 10) return address || 'Unknown'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

function StoreItem({ item, buying, onBuy }) {
  return (
    <div className="group relative bg-[#111] rounded-2xl overflow-hidden hover-lift inner-glow">
      <div className="absolute inset-0 bg-gradient-to-br from-[#d4af37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative aspect-square bg-[#0a0a0a] overflow-hidden">
        <img
          src={item.imageData || FALLBACK_IMAGE}
          alt={item.name}
          onError={(event) => {
            event.currentTarget.src = FALLBACK_IMAGE
          }}
          className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity duration-500"
        />

        <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-light tracking-wider uppercase text-[#d4af37] bg-[#d4af37]/10">
          {item.category || 'Masks'}
        </div>
      </div>

      <div className="relative p-5">
        <h3 className="font-serif font-light text-white/90 mb-1 tracking-wide group-hover:text-[#f5f5dc] transition-elegant truncate">
          {item.name || 'Unnamed Design'}
        </h3>

        <p className="text-xs font-light text-[#718096] mb-5 tracking-wider uppercase">
          Seller {formatWallet(item.sellerWallet)}
        </p>

        <div className="w-full h-px bg-white/5 mb-5" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195]" />
            <span className="font-light text-white/80 truncate">{formatSol(item.priceSol)}</span>
            <span className="text-xs font-light text-[#718096]">SOL</span>
          </div>
          <button
            onClick={() => onBuy(item)}
            disabled={buying}
            className="px-5 py-2 rounded-lg text-[#0a0a0a] text-xs font-light tracking-wider uppercase btn-convex transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {buying ? 'Buying...' : 'Buy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Store() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [listings, setListings] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [buyingListingId, setBuyingListingId] = useState('')

  const { connection } = useConnection()
  const { publicKey, sendTransaction, signMessage } = useWallet()

  const refreshListings = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const response = await fetchMarketplaceListings()
      const items = Array.isArray(response?.items) ? response.items : []
      setListings(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketplace listings.')
      setListings([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshListings()
  }, [refreshListings])

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All') return listings
    return listings.filter((item) => (item.category || 'Masks') === selectedCategory)
  }, [listings, selectedCategory])

  const handleBuy = useCallback(async (item) => {
    if (!publicKey) {
      setError('Please connect your wallet first.')
      return
    }

    if (!connection || typeof sendTransaction !== 'function') {
      setError('Wallet connection is not ready.')
      return
    }

    if (typeof signMessage !== 'function') {
      setError('Wallet signMessage is required to complete marketplace purchase.')
      return
    }

    setError('')
    setNotice('')
    setBuyingListingId(item.id)

    try {
      const payment = await sendListingPayment({
        sellerWallet: item.sellerWallet,
        lamports: Number(item.priceLamports),
        connection,
        publicKey,
        sendTransaction,
      })

      await payment.waitForConfirmation()

      const bought = await buyMarketplaceListingWithWalletAuth({
        publicKey,
        signMessage,
        listingId: item.id,
        paymentSignature: payment.signature,
      })

      setNotice(`Purchase complete: ${bought?.name || item.name}`)
      await refreshListings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed.')
    } finally {
      setBuyingListingId('')
    }
  }, [connection, publicKey, refreshListings, sendTransaction, signMessage])

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#d4af37]/5 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-6 pt-28 pb-16">
          <div className="text-center max-w-xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-serif font-light text-white mb-3 tracking-wider">
              The <span className="text-[#f5f5dc]">Boutique</span>
            </h1>
            <p className="text-sm font-light text-[#718096] tracking-wide">
              Live marketplace listings from community collections.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mb-12 mt-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-5 py-2 rounded-lg text-xs font-light tracking-wider uppercase transition-all duration-300 ${
                selectedCategory === category
                  ? 'bg-[#d4af37] text-[#0a0a0a]'
                  : 'bg-[#111] text-[#718096] hover:text-white inner-glow'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pb-20">
        {error ? (
          <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {notice}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-[#d4af37] border-t-transparent rounded-full mb-3" />
            <p className="text-[#718096] text-sm font-light">Loading marketplace listings...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <StoreItem
                key={item.id}
                item={item}
                onBuy={handleBuy}
                buying={buyingListingId === item.id}
              />
            ))}
          </div>
        )}

        {!isLoading && filteredItems.length === 0 && (
          <div className="text-center py-20">
            <h3 className="text-lg font-light text-white/80 mb-2 tracking-wide">No listings found</h3>
            <p className="text-sm font-light text-[#718096]">Try selecting a different category or check back later.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Store
