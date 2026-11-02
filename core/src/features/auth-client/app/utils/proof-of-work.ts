export interface ProofChallenge {
  id: string
  bits: number
  expiresAt: number
  algorithm: 'sha256'
  input: 'id:nonce'
}
export function hasLeadingZeroBits(bytes: Uint8Array, bits: number): boolean {
  if (!Number.isInteger(bits) || bits < 0 || bits > bytes.length * 8)
    return false
  for (let index = 0; index < Math.floor(bits / 8); index++)
    if (bytes[index] !== 0) return false
  const remaining = bits % 8
  return !remaining || bytes[Math.floor(bits / 8)]! >> (8 - remaining) === 0
}
/** Solve asynchronously so the sign-in screen remains responsive. */
export async function solveProofOfWork(
  challenge: ProofChallenge,
): Promise<{ challengeId: string; nonce: string }> {
  if (
    challenge.algorithm !== 'sha256' ||
    challenge.input !== 'id:nonce' ||
    !Number.isInteger(challenge.bits) ||
    challenge.bits < 0 ||
    challenge.bits > 32
  )
    throw new Error('Unsupported verification challenge.')
  if (!globalThis.crypto?.subtle)
    throw new Error('Browser verification requires a secure connection.')
  const encoder = new TextEncoder()
  for (let nonce = 0; nonce < Number.MAX_SAFE_INTEGER; nonce++) {
    if (Date.now() >= challenge.expiresAt)
      throw new Error('Verification challenge expired. Please try again.')
    const hash = await crypto.subtle.digest(
      'SHA-256',
      encoder.encode(`${challenge.id}:${nonce}`),
    )
    if (hasLeadingZeroBits(new Uint8Array(hash), challenge.bits))
      return { challengeId: challenge.id, nonce: String(nonce) }
    if (nonce % 128 === 127)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
  throw new Error('Unable to complete browser verification.')
}
