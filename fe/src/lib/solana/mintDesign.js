import { Keypair, SystemProgram, Transaction } from '@solana/web3.js'
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'

export async function mintMaskDesign({
  name,
  imageData,
  connection,
  publicKey,
  sendTransaction,
}) {
  if (!publicKey) {
    throw new Error('Please connect your wallet first.')
  }

  if (!connection || typeof sendTransaction !== 'function') {
    throw new Error('Wallet connection is not ready.')
  }

  const normalizedName = typeof name === 'string' && name.trim()
    ? name.trim().slice(0, 32)
    : `Mask ${Date.now()}`

  const mintKeypair = Keypair.generate()
  const mintAddress = mintKeypair.publicKey
  const associatedTokenAddress = getAssociatedTokenAddressSync(mintAddress, publicKey)

  const mintRentLamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE)

  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: publicKey,
      newAccountPubkey: mintAddress,
      space: MINT_SIZE,
      lamports: mintRentLamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMintInstruction(mintAddress, 0, publicKey, publicKey),
    createAssociatedTokenAccountInstruction(
      publicKey,
      associatedTokenAddress,
      publicKey,
      mintAddress
    ),
    createMintToInstruction(mintAddress, associatedTokenAddress, publicKey, 1)
  )

  const latestBlockhash = await connection.getLatestBlockhash('confirmed')
  transaction.feePayer = publicKey
  transaction.recentBlockhash = latestBlockhash.blockhash

  const signature = await sendTransaction(transaction, connection, {
    signers: [mintKeypair],
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
    throw new Error(`Mint transaction failed: ${JSON.stringify(confirmation.value.err)}`)
  }

  return {
    signature,
    mintAddress: mintAddress.toBase58(),
    name: normalizedName,
    imageData,
  }
}
