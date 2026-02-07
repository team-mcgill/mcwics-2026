import { createCreateMetadataAccountV3Instruction } from '@metaplex-foundation/mpl-token-metadata'
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')

function getMetadataPda(mintAddress) {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode('metadata'), METADATA_PROGRAM_ID.toBytes(), mintAddress.toBytes()],
    METADATA_PROGRAM_ID
  )[0]
}

export async function mintMaskDesign({
  name,
  imageData,
  metadataUri,
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
  const normalizedMetadataUri = typeof metadataUri === 'string' ? metadataUri.trim() : ''

  if (!normalizedMetadataUri) {
    throw new Error('Metadata URI is required before minting.')
  }

  if (normalizedMetadataUri.length > 200) {
    throw new Error('Metadata URI is too long for token metadata account.')
  }

  const mintKeypair = Keypair.generate()
  const mintAddress = mintKeypair.publicKey
  const metadataAddress = getMetadataPda(mintAddress)
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
    createMintToInstruction(mintAddress, associatedTokenAddress, publicKey, 1),
    createCreateMetadataAccountV3Instruction(
      {
        metadata: metadataAddress,
        mint: mintAddress,
        mintAuthority: publicKey,
        payer: publicKey,
        updateAuthority: publicKey,
      },
      {
        createMetadataAccountArgsV3: {
          data: {
            name: normalizedName,
            symbol: 'MASK',
            uri: normalizedMetadataUri,
            sellerFeeBasisPoints: 0,
            creators: null,
            collection: null,
            uses: null,
          },
          isMutable: true,
          collectionDetails: null,
        },
      }
    )
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
