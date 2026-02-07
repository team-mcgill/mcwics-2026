import { useCallback, useEffect, useRef, useState } from 'react'
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
  const { connection } = useConnection()
  const { publicKey, sendTransaction, signMessage } = useWallet()

  const handleMintDesign = useCallback(async ({ name, imageData, strokeData }) => {
    const uploaded = await uploadDesignMetadataWithWalletAuth({
      publicKey,
      signMessage,
      name,
      imageData,
      strokeData,
    })

    return mintMaskDesign({
      name,
      imageData,
      metadataUri: uploaded.metadataUrl,
      connection,
      publicKey,
      sendTransaction,
    })
  }, [connection, publicKey, sendTransaction, signMessage])

  const handleUpdateDesign = useCallback(async ({ metadataUri, name, imageData, strokeData }) => {
    if (!metadataUri) {
      throw new Error('Loaded design is missing metadata URI.')
    }

    return updateDesignMetadataWithWalletAuth({
      publicKey,
      signMessage,
      metadataUri,
      name,
      imageData,
      strokeData,
    })
  }, [publicKey, signMessage])

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

  useEffect(() => {
    if (!activeDesign) {
      if (hasPersistedEquipRef.current) {
        window.localStorage.removeItem('masquerade:equipped-mask')
      }
      return
    }

    const payload = {
      id: activeDesign.id,
      name: activeDesign.name,
      mintAddress: activeDesign.mintAddress,
      imageData: activeDesign.paintData || activeDesign.imageData || '',
    }

    window.localStorage.setItem('masquerade:equipped-mask', JSON.stringify(payload))
    hasPersistedEquipRef.current = true
  }, [activeDesign])

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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Character
