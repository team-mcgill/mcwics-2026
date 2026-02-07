import { useCallback, useRef, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { FaceMeshPainter } from '../components/FaceMeshPainter'
import { MaskInventory } from '../components/MaskInventory'
import { mintMaskDesign } from '../lib/solana/mintDesign'

function Character() {
  const painterRef = useRef(null)
  const [activeDesign, setActiveDesign] = useState(null)
  const { connection } = useConnection()
  const { publicKey, sendTransaction } = useWallet()

  const handleMintDesign = useCallback(async ({ name, imageData, replaceMintAddress }) => {
    return mintMaskDesign({
      name,
      imageData,
      replaceMintAddress,
      connection,
      publicKey,
      sendTransaction,
    })
  }, [connection, publicKey, sendTransaction])

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
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Character
