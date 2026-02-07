import { PublicKey, Transaction } from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  createBurnInstruction,
  createCloseAccountInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'

export async function burnMaskDesign({ mintAddress, connection, publicKey, sendTransaction }) {
  if (!publicKey) {
    throw new Error('Please connect your wallet first.')
  }

  if (!connection || typeof sendTransaction !== 'function') {
    throw new Error('Wallet connection is not ready.')
  }

  const mintPublicKey = new PublicKey(mintAddress)
  const associatedTokenAddress = getAssociatedTokenAddressSync(mintPublicKey, publicKey)

  const transaction = new Transaction().add(
    createBurnInstruction(
      associatedTokenAddress,
      mintPublicKey,
      publicKey,
      1,
      [],
      TOKEN_PROGRAM_ID
    ),
    createCloseAccountInstruction(
      associatedTokenAddress,
      publicKey,
      publicKey,
      [],
      TOKEN_PROGRAM_ID
    )
  )

  const latestBlockhash = await connection.getLatestBlockhash('confirmed')
  transaction.feePayer = publicKey
  transaction.recentBlockhash = latestBlockhash.blockhash

  const signature = await sendTransaction(transaction, connection, {
    preflightCommitment: 'confirmed',
  })

  const confirmation = await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    'finalized'
  )

  if (confirmation.value.err) {
    throw new Error(`Burn transaction failed: ${JSON.stringify(confirmation.value.err)}`)
  }

  return {
    signature,
    mintAddress: mintPublicKey.toBase58(),
  }
}
