type ProofOfWorkPurpose = "login" | "contact";

interface ProofOfWorkChallengeResponse {
  required?: boolean;
  token?: string;
  difficulty?: number;
  difficultyBits?: number;
  algorithm?: "sha256-leading-zero-bits";
  expiresAt?: string;
}

export interface ProofOfWorkSolution {
  token: string;
  nonce: string;
  hash: string;
}

const YIELD_EVERY_ATTEMPTS = 250;

const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const digestSha256 = async (value: string): Promise<string> => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest);
};

const yieldToBrowser = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
};

const hasLeadingZeroBits = (hash: string, difficultyBits: number): boolean => {
  const fullHexZeros = Math.floor(difficultyBits / 4);
  const remainingBits = difficultyBits % 4;

  if (!hash.startsWith("0".repeat(fullHexZeros))) {
    return false;
  }

  if (remainingBits === 0) {
    return true;
  }

  const nextNibble = Number.parseInt(hash[fullHexZeros] ?? "f", 16);
  return Number.isInteger(nextNibble) && nextNibble < 2 ** (4 - remainingBits);
};

/**
 * Fetches and solves short-lived proof-of-work challenges for email-generating forms.
 */
export const useProofOfWork = () => {
  /**
   * Requests a signed challenge and finds a nonce whose SHA-256 hash has the
   * requested leading-zero prefix.
   */
  const solveProofOfWork = async (purpose: ProofOfWorkPurpose): Promise<ProofOfWorkSolution | undefined> => {
    if (!process.client) {
      return undefined;
    }

    const challenge = await $fetch<ProofOfWorkChallengeResponse>("/api/proof-of-work/challenge", {
      method: "POST",
      body: {
        purpose,
      },
    });

    if (challenge.required === false) {
      return undefined;
    }

    const difficultyBits = Number.isInteger(challenge.difficultyBits)
      ? Number(challenge.difficultyBits)
      : Number(challenge.difficulty) * 4;

    if (!challenge.token || !Number.isInteger(difficultyBits) || difficultyBits < 1) {
      throw new Error("Invalid proof-of-work challenge.");
    }

    let nonce = 0;

    while (true) {
      const nonceValue = String(nonce);
      const hash = await digestSha256(`${challenge.token}:${nonceValue}`);

      if (hasLeadingZeroBits(hash, difficultyBits)) {
        return {
          token: challenge.token,
          nonce: nonceValue,
          hash,
        };
      }

      nonce += 1;

      if (nonce % YIELD_EVERY_ATTEMPTS === 0) {
        await yieldToBrowser();
      }
    }
  };

  return {
    solveProofOfWork,
  };
};
