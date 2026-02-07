import { SystemProgram, Transaction } from '@solana/web3.js'

export async function mintMaskDesign({
  name,
  imageData,
  replaceMintAddress,
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

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: publicKey,
      lamports: 0,
    })
  )

  const signature = await sendTransaction(transaction, connection)
  await connection.confirmTransaction(signature, 'confirmed')

  return {
    signature,
    mintAddress: replaceMintAddress ?? publicKey.toBase58(),
    name,
    imageData,
  }
}
