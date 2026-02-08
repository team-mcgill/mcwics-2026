import { useCallback, useEffect, useMemo, useState, Suspense, lazy } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import {
  buyMarketplaceListingWithWalletAuth,
  fetchMarketplaceListings,
} from '../lib/api/marketplace'
import {
  buyAdminItem,
  fetchAdminItems,
  fetchUserAdminInventory,
} from '../lib/api/adminItems'
import { sendListingPayment } from '../lib/solana/marketplace'
import { FALLBACK_IMAGE } from '../lib/solana/inventory'

const ModelPreview = lazy(() => import('../components/ModelPreview').then(m => ({ default: m.ModelPreview })))

const STORE_TABS = ['Marketplace', 'Official']
const CATEGORIES = ['All', 'Masks', 'Accessories', 'Outfits', 'Effects']
const ADMIN_CATEGORIES = ['All', 'Headwear', 'Face']

function formatSol(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '0'
  return numeric.toFixed(3).replace(/\.?0+$/, '')
}

function formatWallet(address) {
  if (!address || address.length < 10) return address || 'Unknown'
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

function StoreItem({ item, buying, onBuy, isOfficial = false, isOwned = false }) {
  const hasModel = isOfficial && item.modelUrl

  return (
    <div className="group relative bg-[#111] rounded-2xl overflow-hidden hover-lift inner-glow">
      <div className="absolute inset-0 bg-gradient-to-br from-[#d4af37]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative aspect-square bg-[#0a0a0a] overflow-hidden">
        {hasModel ? (
          <div className="absolute inset-0 w-full h-full">
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a]">
                <div className="animate-spin h-6 w-6 border-2 border-[#d4af37] border-t-transparent rounded-full" />
              </div>
            }>
              <ModelPreview modelUrl={item.modelUrl} className="w-full h-full" />
            </Suspense>
          </div>
        ) : (
          <img
            src={item.imageData || item.thumbnailUrl || FALLBACK_IMAGE}
            alt={item.name}
            onError={(event) => {
              event.currentTarget.src = FALLBACK_IMAGE
            }}
            className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity duration-500"
          />
        )}

        {isOfficial ? (
          <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full text-[10px] font-light tracking-wider uppercase text-emerald-400 bg-emerald-500/10">
            Official
          </div>
        ) : null}

        {isOwned ? (
          <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-light tracking-wider uppercase text-[#d4af37] bg-[#d4af37]/10">
            Owned
          </div>
        ) : (
          <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-[10px] font-light tracking-wider uppercase text-[#d4af37] bg-[#d4af37]/10">
            {item.category || 'Masks'}
          </div>
        )}
      </div>

      <div className="relative p-5">
        <h3 className="font-serif font-light text-white/90 mb-1 tracking-wide group-hover:text-[#f5f5dc] transition-elegant truncate">
          {item.name || 'Unnamed Design'}
        </h3>

        {isOfficial ? (
          <p className="text-xs font-light text-emerald-400/80 mb-5 tracking-wider uppercase">
            By Masquerade
          </p>
        ) : (
          <p className="text-xs font-light text-[#718096] mb-5 tracking-wider uppercase">
            Seller {formatWallet(item.sellerWallet)}
          </p>
        )}

        <div className="w-full h-px bg-white/5 mb-5" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-[#9945FF] to-[#14F195]" />
            <span className="font-light text-white/80 truncate">{formatSol(item.priceSol)}</span>
            <span className="text-xs font-light text-[#718096]">SOL</span>
          </div>
          <button
            onClick={() => onBuy(item)}
            disabled={buying || isOwned}
            className="px-5 py-2 rounded-lg text-[#0a0a0a] text-xs font-light tracking-wider uppercase btn-convex transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isOwned ? 'Owned' : buying ? 'Buying...' : 'Buy'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Store() {
  const [activeTab, setActiveTab] = useState('Marketplace')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [selectedAdminCategory, setSelectedAdminCategory] = useState('All')
  const [listings, setListings] = useState([])
  const [adminItems, setAdminItems] = useState([])
  const [userInventory, setUserInventory] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [buyingListingId, setBuyingListingId] = useState('')
  const [buyingAdminItemId, setBuyingAdminItemId] = useState('')

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

  const refreshAdminItems = useCallback(async () => {
    setIsLoadingAdmin(true)
    try {
      const response = await fetchAdminItems()
      const items = Array.isArray(response?.items) ? response.items : []
      setAdminItems(items)
    } catch (err) {
      console.error('Failed to load admin items:', err)
      setAdminItems([])
    } finally {
      setIsLoadingAdmin(false)
    }
  }, [])

  // Only fetch inventory when explicitly needed (after purchase), not on page load
  const refreshUserInventory = useCallback(async () => {
    if (!publicKey || typeof signMessage !== 'function') {
      setUserInventory([])
      return
    }
    try {
      const response = await fetchUserAdminInventory({ publicKey, signMessage })
      const inventory = Array.isArray(response?.inventory) ? response.inventory : []
      setUserInventory(inventory)
    } catch (err) {
      console.error('Failed to load user inventory:', err)
      setUserInventory([])
    }
  }, [publicKey, signMessage])

  useEffect(() => {
    void refreshListings()
    void refreshAdminItems()
  }, [refreshListings, refreshAdminItems])

  // Don't auto-fetch inventory on page load - only after successful purchase

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All') return listings
    return listings.filter((item) => (item.category || 'Masks') === selectedCategory)
  }, [listings, selectedCategory])

  const filteredAdminItems = useMemo(() => {
    if (selectedAdminCategory === 'All') return adminItems
    return adminItems.filter((item) => item.category === selectedAdminCategory)
  }, [adminItems, selectedAdminCategory])

  const ownedAdminItemIds = useMemo(() => {
    return new Set(userInventory.map((inv) => inv.item?.id).filter(Boolean))
  }, [userInventory])

  const handleBuyMarketplace = useCallback(async (item) => {
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

  const handleBuyAdminItem = useCallback(async (item) => {
    if (!publicKey) {
      setError('Please connect your wallet first.')
      return
    }

    if (!connection || typeof sendTransaction !== 'function') {
      setError('Wallet connection is not ready.')
      return
    }

    if (typeof signMessage !== 'function') {
      setError('Wallet signMessage is required to complete purchase.')
      return
    }

    if (ownedAdminItemIds.has(item.id)) {
      setError('You already own this item.')
      return
    }

    setError('')
    setNotice('')
    setBuyingAdminItemId(item.id)

    try {
      // Send payment to admin treasury (using a fixed treasury address)
      const ADMIN_TREASURY = '6tE8ZosU5ZSxgeNTNxDgZ1vXQNwf28wMffpA2sf5PuvZ' // Replace with actual treasury
      const { SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js')

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(ADMIN_TREASURY),
          lamports: Math.floor(item.priceSol * LAMPORTS_PER_SOL),
        })
      )

      const signature = await sendTransaction(transaction, connection)
      await connection.confirmTransaction(signature, 'confirmed')

      const bought = await buyAdminItem({
        publicKey,
        signMessage,
        itemId: item.id,
        paymentSignature: signature,
      })

      setNotice(`Purchase complete: ${bought?.item?.name || item.name}`)
      await refreshUserInventory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed.')
    } finally {
      setBuyingAdminItemId('')
    }
  }, [connection, publicKey, ownedAdminItemIds, refreshUserInventory, sendTransaction, signMessage])

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
              {activeTab === 'Marketplace'
                ? 'Live marketplace listings from community collections.'
                : 'Official Masquerade accessories and wearables.'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="max-w-7xl mx-auto px-6 mb-8">
        <div className="flex items-center justify-center gap-2">
          {STORE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-lg text-sm font-light tracking-wider uppercase transition-all duration-300 ${
                activeTab === tab
                  ? 'bg-[#d4af37] text-[#0a0a0a]'
                  : 'bg-[#111] text-[#718096] hover:text-white inner-glow'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div className="max-w-7xl mx-auto px-6 mb-12">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {activeTab === 'Marketplace'
            ? CATEGORIES.map((category) => (
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
              ))
            : ADMIN_CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedAdminCategory(category)}
                  className={`px-5 py-2 rounded-lg text-xs font-light tracking-wider uppercase transition-all duration-300 ${
                    selectedAdminCategory === category
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

        {activeTab === 'Marketplace' ? (
          <>
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
                    onBuy={handleBuyMarketplace}
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
          </>
        ) : (
          <>
            {isLoadingAdmin ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="animate-spin h-6 w-6 border-2 border-[#d4af37] border-t-transparent rounded-full mb-3" />
                <p className="text-[#718096] text-sm font-light">Loading official items...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAdminItems.map((item) => (
                  <StoreItem
                    key={item.id}
                    item={item}
                    onBuy={handleBuyAdminItem}
                    buying={buyingAdminItemId === item.id}
                    isOfficial={true}
                    isOwned={ownedAdminItemIds.has(item.id)}
                  />
                ))}
              </div>
            )}

            {!isLoadingAdmin && filteredAdminItems.length === 0 && (
              <div className="text-center py-20">
                <h3 className="text-lg font-light text-white/80 mb-2 tracking-wide">No items found</h3>
                <p className="text-sm font-light text-[#718096]">Try selecting a different category.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Store
