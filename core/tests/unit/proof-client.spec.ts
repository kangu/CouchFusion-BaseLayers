import { describe, it, expect } from 'vitest'
import {
  hasLeadingZeroBits,
  solveProofOfWork,
} from '../../src/features/auth-client/app/utils/proof-of-work'
describe('browser proof of work', () => {
  it('counts leading zero bits across bytes', () => {
    expect(hasLeadingZeroBits(new Uint8Array([0, 15]), 12)).toBe(true)
    expect(hasLeadingZeroBits(new Uint8Array([0, 16]), 12)).toBe(false)
    expect(hasLeadingZeroBits(new Uint8Array([128]), 1)).toBe(false)
  })
  it('solves a SHA256 challenge', async () => {
    const proof = await solveProofOfWork({
      id: 'test',
      bits: 4,
      expiresAt: Date.now() + 10000,
      algorithm: 'sha256',
      input: 'id:nonce',
    })
    const hash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`test:${proof.nonce}`),
    )
    expect(proof.challengeId).toBe('test')
    expect(hasLeadingZeroBits(new Uint8Array(hash), 4)).toBe(true)
  })
  it('rejects expired challenges', async () => {
    await expect(
      solveProofOfWork({
        id: 'test',
        bits: 4,
        expiresAt: 0,
        algorithm: 'sha256',
        input: 'id:nonce',
      }),
    ).rejects.toThrow('expired')
  })
})
