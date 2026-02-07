import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import {
  createApproveCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'

async function confirmFinalized({ connection, signature, latestBlockhash }) {
  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'finalized'
  )

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`)
  }

  return confirmation
}

export async function approveDesignForMarketplace({
  mintAddress,
  marketplaceAuthority,
  connection,
  publicKey,
  sendTransaction,
  awaitFinalization = false,
}) {
  if (!publicKey) {
    throw new Error('Please connect your wallet first.')
  }

  if (!connection || typeof sendTransaction !== 'function') {
    throw new Error('Wallet connection is not ready.')
  }

  const mintPublicKey = new PublicKey(mintAddress)
  const authorityPublicKey = new PublicKey(marketplaceAuthority)
  const associatedTokenAddress = getAssociatedTokenAddressSync(mintPublicKey, publicKey)

  const transaction = new Transaction().add(
    createApproveCheckedInstruction(
      associatedTokenAddress,
      mintPublicKey,
      authorityPublicKey,
      publicKey,
      1,
      0
    )
  )

  const latestBlockhash = await connection.getLatestBlockhash('confirmed')
  transaction.feePayer = publicKey
  transaction.recentBlockhash = latestBlockhash.blockhash

  const signature = await sendTransaction(transaction, connection, {
    preflightCommitment: 'confirmed',
  })

  const waitForConfirmation = () => confirmFinalized({
    connection,
    signature,
    latestBlockhash,
  })

  if (awaitFinalization) {
    await waitForConfirmation()
  }

  return {
    signature,
    waitForConfirmation,
  }
}

export async function sendListingPayment({
  sellerWallet,
  lamports,
  connection,
  publicKey,
  sendTransaction,
  awaitFinalization = false,
}) {
  if (!publicKey) {
    throw new Error('Please connect your wallet first.')
  }

  if (!connection || typeof sendTransaction !== 'function') {
    throw new Error('Wallet connection is not ready.')
  }

  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error('Listing price is invalid.')
  }

  const destination = new PublicKey(sellerWallet)

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: destination,
      lamports: Math.floor(lamports),
    })
  )

  const latestBlockhash = await connection.getLatestBlockhash('confirmed')
  transaction.feePayer = publicKey
  transaction.recentBlockhash = latestBlockhash.blockhash

  const signature = await sendTransaction(transaction, connection, {
    preflightCommitment: 'confirmed',
  })

  const waitForConfirmation = () => confirmFinalized({
    connection,
    signature,
    latestBlockhash,
  })

  if (awaitFinalization) {
    await waitForConfirmation()
  }

  return {
    signature,
    amountSol: Math.floor(lamports) / LAMPORTS_PER_SOL,
    waitForConfirmation,
  }
}
