import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type ProofOfWorkPurpose = "login" | "contact";

export interface ProofOfWorkSolution {
  token: string;
  nonce: string;
  hash: string;
}

interface ProofOfWorkPayload {
  purpose: ProofOfWorkPurpose;
  difficulty: number;
  difficultyBits: number;
  issuedAt: string;
  expiresAt: string;
  random: string;
}

interface CreateProofOfWorkChallengeOptions {
  purpose: ProofOfWorkPurpose;
  secret: string;
  difficulty?: number;
  difficultyBits?: number;
  ttlSeconds?: number;
  now?: Date;
  random?: string;
}

interface VerifyProofOfWorkOptions {
  solution?: ProofOfWorkSolution | null;
  expectedPurpose: ProofOfWorkPurpose;
  secret: string;
  now?: Date;
}

export type ProofOfWorkFailureReason =
  | "missing"
  | "invalid-token"
  | "purpose-mismatch"
  | "expired"
  | "hash-mismatch"
  | "difficulty"
  | "replay";

export type ProofOfWorkVerificationResult =
  | { valid: true }
  | { valid: false; reason: ProofOfWorkFailureReason };

export interface ProofOfWorkChallenge {
  token: string;
  difficulty: number;
  difficultyBits: number;
  algorithm: "sha256-leading-zero-bits";
  expiresAt: string;
}

interface ConsumeProofOfWorkTokenOptions {
  token: string;
  purpose: ProofOfWorkPurpose;
  ttlSeconds: number;
  now?: Date;
}

export type ProofOfWorkConsumptionResult =
  | { consumed: true }
  | { consumed: false; reason: "replay" };

const DEFAULT_DIFFICULTY_BITS = 18;
const DEFAULT_TTL_SECONDS = 600;

const encodeBase64Url = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

const decodeBase64Url = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8");

const signPayload = (encodedPayload: string, secret: string): string =>
  createHmac("sha256", secret).update(encodedPayload).digest("base64url");

const safeEqual = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
};

const resolveDifficultyBits = (difficultyBits?: number, difficulty?: number): number => {
  if (Number.isInteger(difficultyBits) && Number(difficultyBits) > 0) {
    return Number(difficultyBits);
  }

  if (Number.isInteger(difficulty) && Number(difficulty) > 0) {
    return Number(difficulty) * 4;
  }

  return DEFAULT_DIFFICULTY_BITS;
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

const parseToken = (token: string, secret: string): ProofOfWorkPayload | null => {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as ProofOfWorkPayload;
    if (
      (payload.purpose !== "login" && payload.purpose !== "contact") ||
      !Number.isInteger(payload.difficulty) ||
      payload.difficulty < 1 ||
      !Number.isInteger(payload.difficultyBits) ||
      payload.difficultyBits < 1 ||
      typeof payload.issuedAt !== "string" ||
      typeof payload.expiresAt !== "string" ||
      typeof payload.random !== "string"
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
};

export const createProofOfWorkChallenge = ({
  purpose,
  secret,
  difficulty,
  difficultyBits,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  now = new Date(),
  random = randomBytes(16).toString("hex"),
}: CreateProofOfWorkChallengeOptions): ProofOfWorkChallenge => {
  const expiresAtDate = new Date(now.getTime() + ttlSeconds * 1000);
  const resolvedDifficultyBits = resolveDifficultyBits(difficultyBits, difficulty);
  const payload: ProofOfWorkPayload = {
    purpose,
    difficulty: Math.floor(resolvedDifficultyBits / 4),
    difficultyBits: resolvedDifficultyBits,
    issuedAt: now.toISOString(),
    expiresAt: expiresAtDate.toISOString(),
    random,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, secret);

  return {
    token: `${encodedPayload}.${signature}`,
    difficulty: payload.difficulty,
    difficultyBits: payload.difficultyBits,
    algorithm: "sha256-leading-zero-bits",
    expiresAt: payload.expiresAt,
  };
};

export const computeProofOfWorkHash = (token: string, nonce: string): string =>
  createHash("sha256").update(`${token}:${nonce}`).digest("hex");

/**
 * Creates an in-memory replay guard for signed proof-of-work challenge tokens.
 * This makes each issued challenge consumable once per server process.
 */
export const createProofOfWorkConsumptionStore = () => {
  const consumedTokens = new Map<string, number>();

  const cleanupExpiredTokens = (nowMs: number): void => {
    for (const [key, expiresAt] of consumedTokens) {
      if (expiresAt <= nowMs) {
        consumedTokens.delete(key);
      }
    }
  };

  const consume = ({
    token,
    purpose,
    ttlSeconds,
    now = new Date(),
  }: ConsumeProofOfWorkTokenOptions): ProofOfWorkConsumptionResult => {
    const nowMs = now.getTime();
    cleanupExpiredTokens(nowMs);

    const key = `${purpose}:${token}`;
    if (consumedTokens.has(key)) {
      return { consumed: false, reason: "replay" };
    }

    consumedTokens.set(key, nowMs + ttlSeconds * 1000);
    return { consumed: true };
  };

  return {
    consume,
  };
};

export const verifyProofOfWork = ({
  solution,
  expectedPurpose,
  secret,
  now = new Date(),
}: VerifyProofOfWorkOptions): ProofOfWorkVerificationResult => {
  if (!solution?.token || !solution.nonce || !solution.hash) {
    return { valid: false, reason: "missing" };
  }

  const payload = parseToken(solution.token, secret);
  if (!payload) {
    return { valid: false, reason: "invalid-token" };
  }

  if (payload.purpose !== expectedPurpose) {
    return { valid: false, reason: "purpose-mismatch" };
  }

  if (Number.isNaN(Date.parse(payload.expiresAt)) || new Date(payload.expiresAt).getTime() < now.getTime()) {
    return { valid: false, reason: "expired" };
  }

  const expectedHash = computeProofOfWorkHash(solution.token, solution.nonce);
  if (!safeEqual(solution.hash, expectedHash)) {
    return { valid: false, reason: "hash-mismatch" };
  }

  if (!hasLeadingZeroBits(solution.hash, payload.difficultyBits)) {
    return { valid: false, reason: "difficulty" };
  }

  return { valid: true };
};
