import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { fetchWalletDesignInventory, FALLBACK_IMAGE } from '../lib/solana/inventory';

export function MaskInventory({ painterRef, onDesignLoad, onMintDesign }) {
  const [designs, setDesigns] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savePhase, setSavePhase] = useState('idle');
  const [lastMintSignature, setLastMintSignature] = useState('');
  const [mintingId, setMintingId] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [designName, setDesignName] = useState('');
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const refreshInventory = useCallback(async () => {
    if (!publicKey) {
      setDesigns([]);
      setInventoryError('');
      return;
    }

    setIsLoadingInventory(true);
    setInventoryError('');

    try {
      const onChainDesigns = await fetchWalletDesignInventory(connection, publicKey);
      setDesigns(onChainDesigns);
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : 'Failed to load inventory from devnet.');
      setDesigns([]);
    } finally {
      setIsLoadingInventory(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

  const handleSaveClick = () => {
    if (!painterRef.current) return;
    setDesignName(`Mask Design ${designs.length + 1}`);
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    if (!painterRef.current || !designName.trim()) return;
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }
    
    setIsSaving(true);
    setSavePhase('submitting');
    setLastMintSignature('');
    try {
      const exported = typeof painterRef.current.exportDesignState === 'function'
        ? painterRef.current.exportDesignState()
        : {
          imageData: painterRef.current.exportDesign(),
          strokeData: [],
        };

      if (typeof onMintDesign !== 'function') {
        throw new Error('Minting handler is not connected. Wire your mint flow into MaskInventory via onMintDesign.');
      }

      const mintResult = await onMintDesign({
        name: designName.trim(),
        imageData: exported.imageData,
        strokeData: exported.strokeData,
      });

      setSavePhase('confirmed');
      if (mintResult?.signature) {
        setLastMintSignature(mintResult.signature);
      }

      setShowSaveModal(false);
      setSavePhase('refreshing');
      await refreshInventory();
      setSavePhase('idle');
    } catch (err) {
      console.error('Failed to save design:', err);
      alert(err instanceof Error ? err.message : 'Failed to save design.');
      setSavePhase('idle');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadDesign = (design) => {
    if (painterRef.current) {
      painterRef.current.loadDesign({
        imageData: design.paintData || design.imageData,
        strokeData: design.strokeData,
      });
      onDesignLoad?.(design);
    }
  };

  const handleMintDesign = async (design) => {
    if (!publicKey || !painterRef.current) return;
    if (typeof onMintDesign !== 'function') {
      alert('Mint handler is not connected.');
      return;
    }

    setMintingId(design.id);
    try {
      const mintResult = await onMintDesign({
        name: design.name,
        imageData: design.imageData,
        strokeData: design.strokeData,
        replaceMintAddress: design.mintAddress,
      });
      if (mintResult?.signature) {
        setLastMintSignature(mintResult.signature);
      }
      await refreshInventory();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Minting failed.');
    } finally {
      setMintingId(null);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown date';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-serif font-light text-white/90 tracking-wider">Your Collection</h2>
          <p className="text-xs text-[#718096] font-light mt-1">
            {publicKey ? `${designs.length} design${designs.length !== 1 ? 's' : ''} on devnet` : 'Connect wallet to load devnet inventory'}
          </p>
        </div>
        <button
          onClick={handleSaveClick}
          disabled={isSaving || !painterRef.current || !publicKey}
          className="px-4 py-2 btn-convex text-[#0a0a0a] text-xs font-light tracking-wider uppercase rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:-translate-y-0.5"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {savePhase === 'submitting'
                ? 'Submitting...'
                : savePhase === 'confirmed'
                  ? 'Confirmed...'
                  : savePhase === 'refreshing'
                    ? 'Refreshing...'
                    : 'Saving...'}
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Save Design
            </>
          )}
        </button>
      </div>

      {isSaving ? (
        <div className="mb-4 rounded-lg inner-glow bg-[#d4af37]/5 px-3 py-2">
          <p className="text-[11px] text-[#8b7355] tracking-wide uppercase">
            {savePhase === 'submitting'
              ? 'Transaction submitted to wallet...'
              : savePhase === 'confirmed'
                ? 'Transaction confirmed on devnet...'
                : savePhase === 'refreshing'
                  ? 'Refreshing inventory...'
                  : 'Processing...'}
          </p>
        </div>
      ) : null}

      {lastMintSignature ? (
        <div className="mb-4 rounded-lg inner-glow bg-[#111] px-3 py-2">
          <p className="text-[11px] text-[#8b7355]">
            Last mint confirmed.&nbsp;
            <a
              href={`https://explorer.solana.com/tx/${lastMintSignature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="text-[#d4af37] hover:text-[#e8c547] transition-colors"
            >
              View transaction
            </a>
          </p>
        </div>
      ) : null}

      {/* Designs Grid */}
      <div className="flex-1 overflow-y-auto -mx-2 px-2">
        {!publicKey ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-[#718096] text-sm font-light mb-2">Wallet not connected</p>
            <p className="text-[#555] text-xs font-light">Connect wallet to load your devnet designs</p>
          </div>
        ) : isLoadingInventory ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-[#d4af37] border-t-transparent rounded-full mb-3" />
            <p className="text-[#718096] text-sm font-light">Loading devnet inventory...</p>
          </div>
        ) : inventoryError ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-red-400 text-sm font-light mb-2">Failed to load inventory</p>
            <p className="text-[#666] text-xs font-light mb-4">{inventoryError}</p>
            <button
              onClick={refreshInventory}
              className="px-3 py-2 text-xs tracking-wider uppercase border border-[#d4af37]/30 text-[#d4af37] rounded-lg hover:bg-[#d4af37]/10"
            >
              Retry
            </button>
          </div>
        ) : designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-14 h-14 rounded-full bg-[#111] inner-glow flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[#718096] text-sm font-light mb-2">No devnet designs yet</p>
            <p className="text-[#555] text-xs font-light">Mint a design to make it appear here after reload</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {designs.map((design) => (
              <div
                key={design.id}
                className="group bg-[#111] inner-glow hover:border-[#d4af37]/20 rounded-xl overflow-hidden transition-all duration-300"
              >
                {/* Thumbnail */}
                <div className="aspect-square relative overflow-hidden bg-[#1a1a1a]">
                  <img
                    src={design.imageData}
                    alt={design.name}
                    onError={(event) => {
                      event.currentTarget.src = FALLBACK_IMAGE;
                    }}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  />
                  {design.minted && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#d4af37] flex items-center justify-center">
                      <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="text-white text-xs font-medium truncate mb-1">{design.name}</h3>
                  <p className="text-[#555] text-[10px] font-light mb-3">{formatDate(design.createdAt)}</p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleLoadDesign(design)}
                      className="flex-1 px-2 py-1.5 text-[10px] font-light tracking-wider uppercase bg-[#1a1a1a] hover:bg-[#252525] text-[#a0a0a0] hover:text-white rounded transition-colors"
                    >
                      Load
                    </button>
                    {!design.minted ? (
                      <button
                        onClick={() => handleMintDesign(design)}
                        disabled={mintingId === design.id || !publicKey || isLoadingInventory}
                        className="flex-1 px-2 py-1.5 text-[10px] font-light tracking-wider uppercase bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 rounded transition-colors disabled:opacity-50"
                      >
                        {mintingId === design.id ? '...' : 'Mint'}
                      </button>
                    ) : (
                      <button
                        disabled
                        className="flex-1 px-2 py-1.5 text-[10px] font-light tracking-wider uppercase bg-[#1a1a1a] text-[#555] rounded cursor-default"
                      >
                        Minted
                      </button>
                    )}
                    <a
                      href={`https://explorer.solana.com/address/${design.mintAddress}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1.5 text-[10px] font-light tracking-wider uppercase bg-transparent hover:bg-[#d4af37]/10 text-[#555] hover:text-[#d4af37] border border-[#333] hover:border-[#d4af37]/30 rounded transition-colors"
                    >
                      View
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] inner-glow rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-serif font-light text-lg mb-2 tracking-wide">Save Design</h3>
            <p className="text-[#718096] text-sm font-light mb-4">Give your mask design a name</p>
            
            <input
              type="text"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="Design name..."
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#d4af37]/30 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmSave()}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-light text-[#a0a0a0] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSave}
                disabled={!designName.trim() || isSaving}
                className="flex-1 px-4 py-2.5 btn-convex text-[#0a0a0a] text-sm font-light rounded-lg transition-all duration-300 disabled:opacity-50 hover:-translate-y-0.5"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
