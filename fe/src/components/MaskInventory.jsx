import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Transaction, SystemProgram, PublicKey } from '@solana/web3.js';

const STORAGE_KEY = 'masquerade_designs';

export function MaskInventory({ painterRef, onDesignLoad }) {
  const [designs, setDesigns] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [mintingId, setMintingId] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [designName, setDesignName] = useState('');
  const { publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();

  // Load designs from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setDesigns(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse designs:', e);
      }
    }
  }, []);

  // Save designs to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
  }, [designs]);

  const handleSaveClick = () => {
    if (!painterRef.current) return;
    setDesignName(`Mask Design ${designs.length + 1}`);
    setShowSaveModal(true);
  };

  const confirmSave = async () => {
    if (!painterRef.current || !designName.trim()) return;
    
    setIsSaving(true);
    try {
      const imageData = painterRef.current.exportDesign();
      const newDesign = {
        id: Date.now().toString(),
        name: designName.trim(),
        imageData,
        createdAt: new Date().toISOString(),
        minted: false,
        mintAddress: null,
      };
      setDesigns(prev => [newDesign, ...prev]);
      setShowSaveModal(false);
    } catch (err) {
      console.error('Failed to save design:', err);
      alert('Failed to save design. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadDesign = (design) => {
    if (painterRef.current) {
      painterRef.current.loadDesign(design.imageData);
      onDesignLoad?.(design);
    }
  };

  const handleDeleteDesign = (id) => {
    if (confirm('Are you sure you want to delete this design?')) {
      setDesigns(prev => prev.filter(d => d.id !== id));
    }
  };

  const handleMintDesign = async (design) => {
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    setMintingId(design.id);
    try {
      // For now, we'll create a simple transaction as a placeholder
      // In a real implementation, you'd use Metaplex to create an NFT
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: publicKey, // Self-transfer as placeholder
          lamports: 0,
        })
      );

      // This is a simplified mock - real NFT minting would require Metaplex
      // and proper metadata upload to Arweave/IPFS
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate minting
      
      // Update design as minted
      setDesigns(prev => prev.map(d => 
        d.id === design.id 
          ? { ...d, minted: true, mintAddress: publicKey.toString() }
          : d
      ));
      
      alert(`Design "${design.name}" would be minted to devnet!\n\nNote: Full NFT minting requires Metaplex integration with metadata upload.`);
    } catch (err) {
      console.error('Minting failed:', err);
      alert('Minting failed: ' + err.message);
    } finally {
      setMintingId(null);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
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
          <h2 className="text-lg font-serif text-white tracking-wider">Your Collection</h2>
          <p className="text-xs text-[#718096] font-light">
            {designs.length} design{designs.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <button
          onClick={handleSaveClick}
          disabled={isSaving || !painterRef.current}
          className="px-4 py-2 bg-[#d4af37] text-black text-xs font-medium tracking-wider uppercase rounded-lg hover:bg-[#c4a030] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
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

      {/* Designs Grid */}
      <div className="flex-1 overflow-y-auto -mx-2 px-2">
        {designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#555]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-[#718096] text-sm font-light mb-2">No designs yet</p>
            <p className="text-[#555] text-xs font-light">Create and save your first mask design</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {designs.map((design) => (
              <div
                key={design.id}
                className="group bg-[#0f0f0f] border border-[#222] hover:border-[#d4af37]/30 rounded-xl overflow-hidden transition-all duration-300"
              >
                {/* Thumbnail */}
                <div className="aspect-square relative overflow-hidden bg-[#1a1a1a]">
                  <img
                    src={design.imageData}
                    alt={design.name}
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
                        disabled={mintingId === design.id || !publicKey}
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
                    <button
                      onClick={() => handleDeleteDesign(design.id)}
                      className="px-2 py-1.5 text-[10px] font-light tracking-wider uppercase bg-transparent hover:bg-red-500/10 text-[#555] hover:text-red-400 border border-[#333] hover:border-red-500/30 rounded transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
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
          <div className="bg-[#111] border border-[#333] rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-serif text-lg mb-2">Save Design</h3>
            <p className="text-[#718096] text-sm font-light mb-4">Give your mask design a name</p>
            
            <input
              type="text"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              placeholder="Design name..."
              className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#d4af37]/50 mb-4"
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
                className="flex-1 px-4 py-2.5 bg-[#d4af37] text-black text-sm font-medium rounded-lg hover:bg-[#c4a030] transition-colors disabled:opacity-50"
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
