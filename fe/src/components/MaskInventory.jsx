import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { fetchWalletDesignInventory, FALLBACK_IMAGE } from '../lib/solana/inventory';
import { fetchMarketplaceListings } from '../lib/api/marketplace';

const INVENTORY_CACHE_PREFIX = 'mask-inventory:';
const JOB_PRUNE_DELAY_MS = 5000;

function createJobId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toErrorMessage(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function cloneDesignList(list) {
  return list.map((item) => ({ ...item }));
}

function formatSol(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '0';
  return numeric.toFixed(3).replace(/\.?0+$/, '');
}

export function MaskInventory({
  painterRef,
  onDesignLoad,
  onMintDesign,
  onUpdateDesign,
  onDeleteDesign,
  onSellDesign,
  onCancelListing,
}) {
  const [designs, setDesigns] = useState([]);
  const [loadedDesignId, setLoadedDesignId] = useState(null);
  const [backgroundJobs, setBackgroundJobs] = useState([]);
  const [bannerError, setBannerError] = useState('');
  const [lastMintSignature, setLastMintSignature] = useState('');
  const [deletingDesign, setDeletingDesign] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [sellingDesign, setSellingDesign] = useState(null);
  const [sellPrice, setSellPrice] = useState('0.1');
  const [designName, setDesignName] = useState('');
  const [saveMode, setSaveMode] = useState('create');
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [isSyncingInventory, setIsSyncingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState('');
  const [marketListingsByMint, setMarketListingsByMint] = useState({});
  const [isSyncingListings, setIsSyncingListings] = useState(false);

  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const walletAddress = useMemo(() => (publicKey ? publicKey.toBase58() : ''), [publicKey]);
  const inventoryCacheKey = useMemo(
    () => (walletAddress ? `${INVENTORY_CACHE_PREFIX}${walletAddress}` : ''),
    [walletAddress]
  );

  const loadedDesign = loadedDesignId
    ? designs.find((design) => design.id === loadedDesignId) ?? null
    : null;

  const upsertJob = useCallback((jobId, patch) => {
    setBackgroundJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, ...patch } : job)));
  }, []);

  const addJob = useCallback((type, message) => {
    const id = createJobId(type);
    setBackgroundJobs((prev) => [{ id, type, status: 'processing', message }, ...prev].slice(0, 8));
    return id;
  }, []);

  const pruneJobLater = useCallback((jobId) => {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      setBackgroundJobs((prev) => prev.filter((job) => job.id !== jobId));
    }, JOB_PRUNE_DELAY_MS);
  }, []);

  const readCachedInventory = useCallback(() => {
    if (!inventoryCacheKey || typeof window === 'undefined') return [];

    try {
      const raw = window.localStorage.getItem(inventoryCacheKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [inventoryCacheKey]);

  const writeCachedInventory = useCallback((nextDesigns) => {
    if (!inventoryCacheKey || typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(inventoryCacheKey, JSON.stringify(nextDesigns));
    } catch {
      // Ignore storage write failures.
    }
  }, [inventoryCacheKey]);

  const refreshOwnedListings = useCallback(async ({ silent = false } = {}) => {
    if (!walletAddress) {
      setMarketListingsByMint({});
      setIsSyncingListings(false);
      return;
    }

    if (silent) {
      setIsSyncingListings(true);
    }

    try {
      const response = await fetchMarketplaceListings();
      const items = Array.isArray(response?.items) ? response.items : [];
      const mine = items.filter((item) => item?.sellerWallet === walletAddress);
      const byMint = {};

      for (const listing of mine) {
        if (typeof listing?.mintAddress === 'string' && listing.mintAddress) {
          byMint[listing.mintAddress] = listing;
        }
      }

      setMarketListingsByMint(byMint);
    } catch (error) {
      if (!silent) {
        setBannerError(toErrorMessage(error, 'Failed to load marketplace listings.'));
      }
    } finally {
      if (silent) {
        setIsSyncingListings(false);
      }
    }
  }, [walletAddress]);

  const refreshInventory = useCallback(async ({ silent = false } = {}) => {
    if (!publicKey) {
      setDesigns([]);
      setInventoryError('');
      setIsLoadingInventory(false);
      setIsSyncingInventory(false);
      return [];
    }

    if (silent) {
      setIsSyncingInventory(true);
    } else {
      setIsLoadingInventory(true);
    }
    setInventoryError('');

    try {
      const onChainDesigns = await fetchWalletDesignInventory(connection, publicKey);
      setDesigns(onChainDesigns);
      writeCachedInventory(onChainDesigns);
      return onChainDesigns;
    } catch (error) {
      setInventoryError(toErrorMessage(error, 'Failed to load inventory from devnet.'));
      if (!silent) {
        setDesigns([]);
      }
      return [];
    } finally {
      if (silent) {
        setIsSyncingInventory(false);
      } else {
        setIsLoadingInventory(false);
      }
    }
  }, [connection, publicKey, writeCachedInventory]);

  useEffect(() => {
    if (!publicKey) {
      setDesigns([]);
      setLoadedDesignId(null);
      setInventoryError('');
      setIsLoadingInventory(false);
      setIsSyncingInventory(false);
      setMarketListingsByMint({});
      return;
    }

    const cached = readCachedInventory();
    if (cached.length) {
      setDesigns(cached);
      setIsLoadingInventory(false);
      void refreshInventory({ silent: true });
    } else {
      setDesigns([]);
      void refreshInventory();
    }

    void refreshOwnedListings({ silent: true });
  }, [publicKey, readCachedInventory, refreshInventory, refreshOwnedListings]);

  useEffect(() => {
    if (loadedDesignId && !loadedDesign) {
      setLoadedDesignId(null);
      onDesignLoad?.(null);
    }
  }, [loadedDesign, loadedDesignId, onDesignLoad]);

  const rollbackSnapshot = useCallback((snapshot) => {
    setDesigns(snapshot.designs);
    setLoadedDesignId(snapshot.loadedDesignId);

    const restoredLoadedDesign = snapshot.loadedDesignId
      ? snapshot.designs.find((design) => design.id === snapshot.loadedDesignId) ?? null
      : null;

    onDesignLoad?.(restoredLoadedDesign);

    if (restoredLoadedDesign) {
      painterRef.current?.loadDesign?.({
        imageData: restoredLoadedDesign.paintData || restoredLoadedDesign.imageData,
        strokeData: restoredLoadedDesign.strokeData,
      });
    }
  }, [onDesignLoad, painterRef]);

  const handleSaveClick = () => {
    if (!painterRef.current) return;

    if (loadedDesign) {
      setDesignName(loadedDesign.name);
      setSaveMode('overwrite');
    } else {
      setDesignName(`Mask Design ${designs.length + 1}`);
      setSaveMode('create');
    }

    setShowSaveModal(true);
  };

  const confirmSave = () => {
    if (!painterRef.current || !designName.trim()) return;
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    const exported = typeof painterRef.current.exportDesignState === 'function'
      ? painterRef.current.exportDesignState()
      : {
        imageData: painterRef.current.exportDesign(),
        strokeData: [],
      };

    const trimmedName = designName.trim();
    const snapshot = {
      designs: cloneDesignList(designs),
      loadedDesignId,
    };

    const targetDesign = loadedDesign ? { ...loadedDesign } : null;

    setShowSaveModal(false);
    setBannerError('');

    if (targetDesign) {
      setDesigns((prev) => prev.map((design) => (
        design.id === targetDesign.id
          ? {
            ...design,
            name: trimmedName,
            imageData: exported.imageData,
            paintData: exported.imageData,
            strokeData: exported.strokeData,
            pending: true,
          }
          : design
      )));
    } else {
      const optimisticId = createJobId('pending-create');
      setDesigns((prev) => [{
        id: optimisticId,
        mintAddress: optimisticId,
        name: trimmedName,
        imageData: exported.imageData,
        paintData: exported.imageData,
        strokeData: exported.strokeData,
        createdAt: new Date().toISOString(),
        minted: false,
        metadataUri: null,
        pending: true,
      }, ...prev]);
    }

    const jobId = addJob(
      targetDesign ? 'overwrite' : 'create',
      targetDesign ? 'Updating design in background...' : 'Saving new design in background...'
    );

    void (async () => {
      try {
        let result;

        if (targetDesign) {
          if (!targetDesign.metadataUri) {
            throw new Error('Loaded design cannot be overwritten because metadata URI is missing.');
          }

          if (typeof onUpdateDesign !== 'function') {
            throw new Error('Update handler is not connected.');
          }

          result = await onUpdateDesign({
            id: targetDesign.id,
            mintAddress: targetDesign.mintAddress,
            metadataUri: targetDesign.metadataUri,
            name: trimmedName,
            imageData: exported.imageData,
            strokeData: exported.strokeData,
          });
        } else {
          if (typeof onMintDesign !== 'function') {
            throw new Error('Minting handler is not connected.');
          }

          result = await onMintDesign({
            name: trimmedName,
            imageData: exported.imageData,
            strokeData: exported.strokeData,
          });
        }

        if (result?.signature) {
          setLastMintSignature(result.signature);
        }

        upsertJob(jobId, {
          status: 'submitted',
          message: result?.signature
            ? 'Transaction submitted. Finalizing in background...'
            : 'Saved. Syncing inventory...',
        });

        if (typeof result?.waitForConfirmation === 'function') {
          await result.waitForConfirmation();
          upsertJob(jobId, {
            status: 'confirmed',
            message: 'Transaction finalized. Syncing inventory...',
          });
        }

        await Promise.all([
          refreshInventory({ silent: true }),
          refreshOwnedListings({ silent: true }),
        ]);

        upsertJob(jobId, {
          status: 'done',
          message: targetDesign ? 'Design updated.' : 'Design saved.',
        });
        pruneJobLater(jobId);
      } catch (error) {
        rollbackSnapshot(snapshot);
        setBannerError(toErrorMessage(error, 'Failed to save design.'));

        upsertJob(jobId, {
          status: 'failed',
          message: 'Save failed. Changes were reverted.',
        });
        pruneJobLater(jobId);
      }
    })();
  };

  const handleLoadDesign = (design) => {
    if (!painterRef.current || design.pending) return;

    painterRef.current.loadDesign({
      imageData: design.paintData || design.imageData,
      strokeData: design.strokeData,
    });

    setLoadedDesignId(design.id);
    onDesignLoad?.(design);
  };

  const handleDeleteClick = (design) => {
    if (design.pending) return;

    const listing = marketListingsByMint[design.mintAddress];
    if (listing) {
      setBannerError('Unlist this item before deleting it from your collection.');
      return;
    }

    setDeletingDesign(design);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!deletingDesign || !publicKey) return;
    if (typeof onDeleteDesign !== 'function') {
      alert('Delete handler is not connected.');
      return;
    }

    const targetDesign = { ...deletingDesign };
    const snapshot = {
      designs: cloneDesignList(designs),
      loadedDesignId,
    };

    setShowDeleteModal(false);
    setDeletingDesign(null);
    setBannerError('');

    if (loadedDesignId === targetDesign.id) {
      setLoadedDesignId(null);
      onDesignLoad?.(null);
      painterRef.current?.clearDrawing?.();
    }

    setDesigns((prev) => prev.filter((design) => design.id !== targetDesign.id));

    const jobId = addJob('delete', 'Deleting design in background...');

    void (async () => {
      try {
        const deleted = await onDeleteDesign(targetDesign);

        if (deleted?.signature) {
          setLastMintSignature(deleted.signature);
        }

        upsertJob(jobId, {
          status: 'submitted',
          message: deleted?.signature
            ? 'Burn submitted. Finalizing in background...'
            : 'Delete submitted. Syncing inventory...',
        });

        if (typeof deleted?.waitForConfirmation === 'function') {
          await deleted.waitForConfirmation();
          upsertJob(jobId, {
            status: 'confirmed',
            message: 'Burn finalized. Syncing inventory...',
          });
        }

        await Promise.all([
          refreshInventory({ silent: true }),
          refreshOwnedListings({ silent: true }),
        ]);

        let cleanupError = deleted?.cleanupError ?? '';
        if (!cleanupError && deleted?.cleanupPromise && typeof deleted.cleanupPromise.then === 'function') {
          cleanupError = await deleted.cleanupPromise;
        }

        if (cleanupError) {
          setBannerError(`Design burned, but backend cleanup failed: ${cleanupError}`);
        }

        upsertJob(jobId, {
          status: 'done',
          message: 'Design deleted.',
        });
        pruneJobLater(jobId);
      } catch (error) {
        rollbackSnapshot(snapshot);
        setBannerError(toErrorMessage(error, 'Delete failed. Changes were reverted.'));

        upsertJob(jobId, {
          status: 'failed',
          message: 'Delete failed. Changes were reverted.',
        });
        pruneJobLater(jobId);
      }
    })();
  };

  const handleSellClick = (design) => {
    if (!design || design.pending) return;
    setSellingDesign(design);
    setSellPrice('0.1');
    setShowSellModal(true);
  };

  const confirmSell = () => {
    if (!sellingDesign) return;
    if (!publicKey) {
      alert('Please connect your wallet first');
      return;
    }

    if (typeof onSellDesign !== 'function') {
      alert('Sell handler is not connected.');
      return;
    }

    const listingPrice = Number(sellPrice);
    if (!Number.isFinite(listingPrice) || listingPrice <= 0) {
      alert('Please enter a valid SOL price.');
      return;
    }

    if (!sellingDesign.metadataUri) {
      alert('This item cannot be listed because metadata URI is missing.');
      return;
    }

    const design = { ...sellingDesign };
    const previousListings = { ...marketListingsByMint };

    setShowSellModal(false);
    setSellingDesign(null);
    setBannerError('');

    setMarketListingsByMint((prev) => ({
      ...prev,
      [design.mintAddress]: {
        id: `pending-${design.mintAddress}`,
        mintAddress: design.mintAddress,
        priceSol: listingPrice,
        pending: true,
      },
    }));

    const jobId = addJob('sell', 'Listing item in marketplace background...');

    void (async () => {
      try {
        const listed = await onSellDesign({
          mintAddress: design.mintAddress,
          metadataUri: design.metadataUri,
          name: design.name,
          imageData: design.imageData,
          priceSol: listingPrice,
        });

        if (listed?.signature) {
          setLastMintSignature(listed.signature);
        }

        upsertJob(jobId, {
          status: 'submitted',
          message: listed?.signature
            ? 'Sell approval confirmed. Syncing listing...'
            : 'Listing submitted. Syncing...',
        });

        await refreshOwnedListings({ silent: true });

        upsertJob(jobId, {
          status: 'done',
          message: 'Item listed for sale.',
        });
        pruneJobLater(jobId);
      } catch (error) {
        setMarketListingsByMint(previousListings);
        setBannerError(toErrorMessage(error, 'Failed to list item for sale.'));

        upsertJob(jobId, {
          status: 'failed',
          message: 'Sell failed. Listing changes were reverted.',
        });
        pruneJobLater(jobId);
      }
    })();
  };

  const handleUnlist = (design) => {
    const listing = marketListingsByMint[design.mintAddress];
    if (!listing || listing.pending) return;
    if (typeof onCancelListing !== 'function') {
      setBannerError('Cancel listing handler is not connected.');
      return;
    }

    const previousListings = { ...marketListingsByMint };
    setBannerError('');

    setMarketListingsByMint((prev) => {
      const next = { ...prev };
      delete next[design.mintAddress];
      return next;
    });

    const jobId = addJob('unlist', 'Removing listing in background...');

    void (async () => {
      try {
        await onCancelListing({ listingId: listing.id });
        await refreshOwnedListings({ silent: true });

        upsertJob(jobId, {
          status: 'done',
          message: 'Listing removed.',
        });
        pruneJobLater(jobId);
      } catch (error) {
        setMarketListingsByMint(previousListings);
        setBannerError(toErrorMessage(error, 'Failed to remove listing.'));

        upsertJob(jobId, {
          status: 'failed',
          message: 'Unlist failed. Changes were reverted.',
        });
        pruneJobLater(jobId);
      }
    })();
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown date';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return 'Unknown date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const activeJobCount = backgroundJobs.filter(
    (job) => job.status === 'processing' || job.status === 'submitted' || job.status === 'confirmed'
  ).length;

  const statusToneClass = (status) => {
    if (status === 'failed') return 'text-red-300';
    if (status === 'done') return 'text-emerald-300';
    return 'text-[#d4af37]';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-serif font-light text-white/90 tracking-wider">Your Collection</h2>
          <p className="text-xs text-[#718096] font-light mt-1">
            {publicKey ? `${designs.length} design${designs.length !== 1 ? 's' : ''} on devnet` : 'Connect wallet to load devnet inventory'}
          </p>
        </div>

        <button
          onClick={handleSaveClick}
          disabled={!painterRef.current || !publicKey}
          className="px-4 py-2 btn-convex text-[#0a0a0a] text-xs font-light tracking-wider uppercase rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 hover:-translate-y-0.5"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {loadedDesign ? 'Save Changes' : 'Save Design'}
        </button>
      </div>

      {activeJobCount > 0 ? (
        <div className="mb-4 rounded-lg inner-glow bg-[#d4af37]/5 px-3 py-2">
          <p className="text-[11px] text-[#8b7355] tracking-wide uppercase">
            Processing {activeJobCount} task{activeJobCount !== 1 ? 's' : ''} in background...
          </p>
        </div>
      ) : null}

      {backgroundJobs.length > 0 ? (
        <div className="mb-4 rounded-lg inner-glow bg-[#111] px-3 py-2 space-y-1">
          {backgroundJobs.slice(0, 3).map((job) => (
            <p key={job.id} className={`text-[11px] ${statusToneClass(job.status)}`}>
              {job.message}
            </p>
          ))}
        </div>
      ) : null}

      {bannerError ? (
        <div className="mb-4 rounded-lg inner-glow bg-red-500/10 px-3 py-2 border border-red-500/30 flex items-start justify-between gap-2">
          <p className="text-[11px] text-red-200">{bannerError}</p>
          <button
            onClick={() => setBannerError('')}
            className="text-[10px] uppercase tracking-wider text-red-200/80 hover:text-red-100"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {loadedDesign ? (
        <div className="mb-4 rounded-lg inner-glow bg-[#111] px-3 py-2">
          <p className="text-[11px] text-[#8b7355]">
            Loaded design:&nbsp;<span className="text-[#d4af37]">{loadedDesign.name}</span>. Saving will overwrite this design.
          </p>
        </div>
      ) : null}

      {lastMintSignature ? (
        <div className="mb-4 rounded-lg inner-glow bg-[#111] px-3 py-2">
          <p className="text-[11px] text-[#8b7355]">
            Last transaction signature:&nbsp;
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

      {(isSyncingInventory || isSyncingListings) ? (
        <div className="mb-3 rounded-lg inner-glow bg-[#111] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-[#8b7355]">Syncing inventory/marketplace in background...</p>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto -mx-2 px-2">
        {!publicKey ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-[#718096] text-sm font-light mb-2">Wallet not connected</p>
            <p className="text-[#555] text-xs font-light">Connect wallet to load your devnet designs</p>
          </div>
        ) : isLoadingInventory && designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-[#d4af37] border-t-transparent rounded-full mb-3" />
            <p className="text-[#718096] text-sm font-light">Loading devnet inventory...</p>
          </div>
        ) : inventoryError && designs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-red-400 text-sm font-light mb-2">Failed to load inventory</p>
            <p className="text-[#666] text-xs font-light mb-4">{inventoryError}</p>
            <button
              onClick={() => void refreshInventory()}
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
            <p className="text-[#555] text-xs font-light">Mint a design to make it appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {designs.map((design) => {
              const listing = design.mintAddress ? marketListingsByMint[design.mintAddress] : null;
              const isListed = Boolean(listing);
              const isListingPending = Boolean(listing?.pending);

              return (
                <div
                  key={design.id}
                  className={`group bg-[#111] inner-glow rounded-xl overflow-hidden transition-all duration-300 ${loadedDesignId === design.id ? 'ring-1 ring-[#d4af37]/50' : 'hover:border-[#d4af37]/20'}`}
                >
                  <div className="aspect-square relative overflow-hidden bg-[#1a1a1a]">
                    <img
                      src={design.imageData}
                      alt={design.name}
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_IMAGE;
                      }}
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />

                    {design.pending ? (
                      <div className="absolute top-2 left-2 rounded-full bg-[#d4af37]/85 px-2 py-0.5">
                        <p className="text-[9px] uppercase tracking-wider text-black">Pending</p>
                      </div>
                    ) : null}

                    {isListed ? (
                      <div className="absolute top-2 left-2 rounded-full bg-emerald-500/85 px-2 py-0.5">
                        <p className="text-[9px] uppercase tracking-wider text-black">
                          {isListingPending ? 'Listing...' : `Listed ${formatSol(listing.priceSol)} SOL`}
                        </p>
                      </div>
                    ) : null}

                    {design.minted ? (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#d4af37] flex items-center justify-center">
                        <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : null}
                  </div>

                  <div className="p-3">
                    <h3 className="text-white text-xs font-medium truncate mb-1">{design.name}</h3>
                    <p className="text-[#555] text-[10px] font-light mb-3">{formatDate(design.createdAt)}</p>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleLoadDesign(design)}
                        disabled={design.pending}
                        className="px-2 py-1.5 text-[10px] font-light tracking-wider uppercase bg-[#1a1a1a] hover:bg-[#252525] text-[#a0a0a0] hover:text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Load
                      </button>

                      {isListed ? (
                        <button
                          onClick={() => handleUnlist(design)}
                          disabled={isListingPending}
                          className="px-2 py-1.5 text-[10px] font-light tracking-wider uppercase bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Unlist
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSellClick(design)}
                          disabled={design.pending || !design.mintAddress}
                          className="px-2 py-1.5 text-[10px] font-light tracking-wider uppercase bg-[#d4af37]/10 hover:bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Sell
                        </button>
                      )}

                      <button
                        onClick={() => handleDeleteClick(design)}
                        disabled={design.pending || isListed}
                        className="px-2 py-1.5 text-[10px] font-light tracking-wider uppercase bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Delete
                      </button>

                      {!design.pending && design.mintAddress ? (
                        <a
                          href={`https://explorer.solana.com/address/${design.mintAddress}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1.5 text-center text-[10px] font-light tracking-wider uppercase bg-transparent hover:bg-[#d4af37]/10 text-[#555] hover:text-[#d4af37] border border-[#333] hover:border-[#d4af37]/30 rounded transition-colors"
                        >
                          View
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showSaveModal ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] inner-glow rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-serif font-light text-lg mb-2 tracking-wide">
              {saveMode === 'overwrite' ? 'Overwrite Design' : 'Save Design'}
            </h3>
            <p className="text-[#718096] text-sm font-light mb-4">
              {saveMode === 'overwrite'
                ? 'This will update the currently loaded design in background.'
                : 'Give your mask design a name'}
            </p>

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
                disabled={!designName.trim()}
                className="flex-1 px-4 py-2.5 btn-convex text-[#0a0a0a] text-sm font-light rounded-lg transition-all duration-300 disabled:opacity-50 hover:-translate-y-0.5"
              >
                {saveMode === 'overwrite' ? 'Start Update' : 'Start Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSellModal && sellingDesign ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] inner-glow rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-serif font-light text-lg mb-2 tracking-wide">List for Sale</h3>
            <p className="text-[#718096] text-sm font-light mb-4">
              Enter a SOL price for <span className="text-[#d4af37]">{sellingDesign.name}</span>.
            </p>

            <input
              type="number"
              min="0"
              step="0.001"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="0.1"
              className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#d4af37]/30 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && confirmSell()}
            />

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSellModal(false);
                  setSellingDesign(null);
                }}
                className="flex-1 px-4 py-2.5 text-sm font-light text-[#a0a0a0] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSell}
                disabled={!sellPrice.trim()}
                className="flex-1 px-4 py-2.5 btn-convex text-[#0a0a0a] text-sm font-light rounded-lg transition-all duration-300 disabled:opacity-50 hover:-translate-y-0.5"
              >
                List Item
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteModal && deletingDesign ? (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#111] inner-glow rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-white font-serif font-light text-lg mb-2 tracking-wide">Delete Design</h3>
            <p className="text-[#718096] text-sm font-light mb-4">
              This will burn <span className="text-[#d4af37]">{deletingDesign.name}</span> on devnet and remove backend assets if possible. Processing continues in background.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingDesign(null);
                }}
                className="flex-1 px-4 py-2.5 text-sm font-light text-[#a0a0a0] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-light bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30 transition-all duration-300"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
