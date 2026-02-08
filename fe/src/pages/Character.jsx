import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { FaceMeshPainter } from '../components/FaceMeshPainter'
import { MaskInventory } from '../components/MaskInventory'
import {
  deleteDesignMetadataWithWalletAuth,
  updateDesignMetadataWithWalletAuth,
  uploadDesignMetadataWithWalletAuth,
} from '../lib/api/designUpload'
import {
  cancelMarketplaceListingWithWalletAuth,
  createMarketplaceListingWithWalletAuth,
  fetchMarketplaceConfig,
} from '../lib/api/marketplace'
import { burnMaskDesign } from '../lib/solana/burnDesign'
import { approveDesignForMarketplace } from '../lib/solana/marketplace'
import { mintMaskDesign } from '../lib/solana/mintDesign'

function Character() {
  const painterRef = useRef(null)
  const hasPersistedEquipRef = useRef(false)
  const marketplaceConfigRef = useRef(null)
  const [activeDesign, setActiveDesign] = useState(null)
  const [activeAccessoryItems, setActiveAccessoryItems] = useState(new Map())
  const { connection } = useConnection()
  const { publicKey, sendTransaction, signMessage } = useWallet()

  const accessoryDebugRows = useMemo(
    () => Array.from(activeAccessoryItems.values()).map((item) => {
      const rawY = Number(item?.characterDefaultPosition?.y)
      return {
        id: item?.id || 'unknown',
        name: item?.name || item?.id || 'Unknown',
        source: item?.__transformSource || 'unknown',
        y: Number.isFinite(rawY) ? rawY : 'n/a',
      }
    }),
    [activeAccessoryItems]
  )

  const handleMintDesign = useCallback(async ({ name, imageData, strokeData, accessoryData }) => {
    const normalizedAccessories = Array.isArray(accessoryData)
      ? accessoryData
      : Array.from(activeAccessoryItems.values())

    const uploaded = await uploadDesignMetadataWithWalletAuth({
      publicKey,
      signMessage,
      name,
      imageData,
      strokeData,
      accessoryData: normalizedAccessories,
    })

    return mintMaskDesign({
      name,
      imageData,
      metadataUri: uploaded.metadataUrl,
      connection,
      publicKey,
      sendTransaction,
    })
  }, [activeAccessoryItems, connection, publicKey, sendTransaction, signMessage])

  const handleUpdateDesign = useCallback(async ({ metadataUri, name, imageData, strokeData, accessoryData }) => {
    if (!metadataUri) {
      throw new Error('Loaded design is missing metadata URI.')
    }

    const normalizedAccessories = Array.isArray(accessoryData)
      ? accessoryData
      : Array.from(activeAccessoryItems.values())

    return updateDesignMetadataWithWalletAuth({
      publicKey,
      signMessage,
      metadataUri,
      name,
      imageData,
      strokeData,
      accessoryData: normalizedAccessories,
    })
  }, [activeAccessoryItems, publicKey, signMessage])

  const handleDeleteDesign = useCallback(async ({ mintAddress, metadataUri }) => {
    if (!mintAddress) {
      throw new Error('Design mint address is missing.')
    }

    const burned = await burnMaskDesign({
      mintAddress,
      connection,
      publicKey,
      sendTransaction,
    })

    const cleanupPromise = metadataUri
      ? deleteDesignMetadataWithWalletAuth({
        publicKey,
        signMessage,
        metadataUri,
      })
        .then(() => '')
        .catch((error) => (error instanceof Error ? error.message : 'Failed to delete backend assets.'))
      : Promise.resolve('')

    return {
      signature: burned.signature,
      waitForConfirmation: burned.waitForConfirmation,
      cleanupPromise,
    }
  }, [connection, publicKey, sendTransaction, signMessage])

  const getMarketplaceAuthority = useCallback(async () => {
    if (marketplaceConfigRef.current?.authorityPubkey) {
      return marketplaceConfigRef.current.authorityPubkey
    }

    const config = await fetchMarketplaceConfig()
    if (!config?.authorityPubkey) {
      throw new Error('Marketplace authority is unavailable.')
    }

    marketplaceConfigRef.current = config
    return config.authorityPubkey
  }, [])

  const handleSellDesign = useCallback(async ({ mintAddress, metadataUri, name, imageData, priceSol }) => {
    if (!mintAddress) {
      throw new Error('Design mint address is missing.')
    }

    if (!metadataUri) {
      throw new Error('Design metadata URI is missing.')
    }

    const authorityPubkey = await getMarketplaceAuthority()

    const approved = await approveDesignForMarketplace({
      mintAddress,
      marketplaceAuthority: authorityPubkey,
      connection,
      publicKey,
      sendTransaction,
    })

    await approved.waitForConfirmation()

    const listing = await createMarketplaceListingWithWalletAuth({
      publicKey,
      signMessage,
      mintAddress,
      metadataUri,
      name,
      imageData,
      category: 'Masks',
      priceSol,
    })

    return {
      signature: approved.signature,
      listing,
    }
  }, [connection, getMarketplaceAuthority, publicKey, sendTransaction, signMessage])

  const handleCancelListing = useCallback(async ({ listingId }) => {
    if (!listingId) {
      throw new Error('Listing id is missing.')
    }

    return cancelMarketplaceListingWithWalletAuth({
      publicKey,
      signMessage,
      listingId,
    })
  }, [publicKey, signMessage])

  const handleAccessoryToggle = useCallback((itemId, isEquipped, itemData = null) => {
    setActiveAccessoryItems((prev) => {
      const next = new Map(prev)
      if (isEquipped && itemData) {
        next.set(itemId, {
          ...itemData,
          id: itemId,
        })
      } else {
        next.delete(itemId)
      }
      return next
    })

    // Notify the painter to toggle the accessory
    if (painterRef.current?.toggleAccessory) {
      painterRef.current.toggleAccessory(itemId, isEquipped, itemData)
    }
  }, [])

  useEffect(() => {
    const accessories = Array.from(activeAccessoryItems.values())
    const hasDesign = Boolean(activeDesign)
    const hasAccessories = accessories.length > 0

    if (!hasDesign && !hasAccessories) {
      if (hasPersistedEquipRef.current) {
        window.localStorage.removeItem('masquerade:equipped-mask')
      }
      return
    }

    const payload = {
      id: activeDesign?.id || '',
      name: activeDesign?.name || 'Accessory Loadout',
      mintAddress: activeDesign?.mintAddress || '',
      imageData: activeDesign?.paintData || activeDesign?.imageData || '',
      paintData: activeDesign?.paintData || activeDesign?.imageData || '',
      strokeData: Array.isArray(activeDesign?.strokeData) ? activeDesign.strokeData : [],
      accessories,
    }

    window.localStorage.setItem('masquerade:equipped-mask', JSON.stringify(payload))
    hasPersistedEquipRef.current = true
  }, [activeAccessoryItems, activeDesign])

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-light text-white mb-2 tracking-wider">
            Your <span className="text-[#f5f5dc]">Mask</span>
          </h1>
          <p className="text-sm font-light text-[#718096] max-w-xl tracking-wide">
            Customize your masquerade identity. Paint directly on your face mesh, then save your designs to your collection.
          </p>
          {accessoryDebugRows.length ? (
            <div className="mt-3 rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-[#8b7355] mb-1">Accessory transform debug</p>
              {accessoryDebugRows.map((row) => (
                <p key={row.id} className="text-[11px] text-[#9aa1ad]">
                  {row.name}: source={row.source}, characterY={row.y}
                </p>
              ))}
            </div>
          ) : null}
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - Painter (3/5 width) */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl bg-[#111] inner-glow p-6">
              <FaceMeshPainter ref={painterRef} />
            </div>
          </div>

          {/* Right Column - Inventory (2/5 width) */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-[#111] inner-glow p-6 h-[600px] lg:h-[calc(100vh-200px)] lg:max-h-[800px]">
              <MaskInventory
                painterRef={painterRef}
                onDesignLoad={setActiveDesign}
                onMintDesign={handleMintDesign}
                onUpdateDesign={handleUpdateDesign}
                onDeleteDesign={handleDeleteDesign}
                onSellDesign={handleSellDesign}
                onCancelListing={handleCancelListing}
                onAccessoryToggle={handleAccessoryToggle}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Character
