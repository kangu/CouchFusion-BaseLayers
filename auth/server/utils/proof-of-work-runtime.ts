import { createError } from "h3";
import {
  type ProofOfWorkPurpose,
  type ProofOfWorkSolution,
  createProofOfWorkConsumptionStore,
  createProofOfWorkChallenge,
  verifyProofOfWork,
} from "#auth/server/utils/proof-of-work";

interface RuntimeProofOfWorkConfig {
  enabled?: boolean | string;
  secret?: string;
  difficulty?: number | string;
  difficultyBits?: number | string;
  ttlSeconds?: number | string;
}

interface ResolvedProofOfWorkConfig {
  enabled: boolean;
  secret: string;
  difficulty: number;
  difficultyBits: number;
  ttlSeconds: number;
}

const DEFAULT_DIFFICULTY = 4;
const DEFAULT_DIFFICULTY_BITS = 18;
const DEFAULT_TTL_SECONDS = 600;
const proofOfWorkConsumptionStore = createProofOfWorkConsumptionStore();

const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const parsePositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Resolves proof-of-work settings from Nuxt runtime config and validates that
 * enabled deployments have a server-only signing secret.
 */
export const resolveProofOfWorkConfig = (): ResolvedProofOfWorkConfig => {
  const runtimeConfig = useRuntimeConfig();
  const proofOfWork = (runtimeConfig.proofOfWork ?? {}) as RuntimeProofOfWorkConfig;
  const enabled = parseBoolean(proofOfWork.enabled, true);
  const secretCandidates = [
    proofOfWork.secret,
    runtimeConfig.couchdbCookieSecret,
    runtimeConfig.cronSecret,
  ];
  const secret = secretCandidates
    .find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0)
    ?.trim() ?? "";

  if (enabled && !secret) {
    throw createError({
      statusCode: 500,
      statusMessage: "Proof-of-work signing secret is not configured.",
    });
  }

  const configuredDifficultyBits = parsePositiveInteger(proofOfWork.difficultyBits, 0);
  const configuredDifficulty = parsePositiveInteger(proofOfWork.difficulty, DEFAULT_DIFFICULTY);
  const difficultyBits = configuredDifficultyBits || (
    proofOfWork.difficulty === undefined
      ? DEFAULT_DIFFICULTY_BITS
      : configuredDifficulty * 4
  );

  return {
    enabled,
    secret,
    difficulty: Math.floor(difficultyBits / 4),
    difficultyBits,
    ttlSeconds: parsePositiveInteger(proofOfWork.ttlSeconds, DEFAULT_TTL_SECONDS),
  };
};

/**
 * Issues a signed challenge for a specific form purpose.
 */
export const issueProofOfWorkChallenge = (purpose: ProofOfWorkPurpose) => {
  const config = resolveProofOfWorkConfig();

  if (!config.enabled) {
    return {
      required: false,
    };
  }

  return {
    required: true,
    ...createProofOfWorkChallenge({
      purpose,
      secret: config.secret,
      difficulty: config.difficulty,
      difficultyBits: config.difficultyBits,
      ttlSeconds: config.ttlSeconds,
    }),
  };
};

/**
 * Verifies a submitted proof-of-work solution before email side effects run.
 */
export const assertProofOfWork = (
  solution: ProofOfWorkSolution | null | undefined,
  expectedPurpose: ProofOfWorkPurpose,
): void => {
  const config = resolveProofOfWorkConfig();

  if (!config.enabled) {
    return;
  }

  const result = verifyProofOfWork({
    solution,
    expectedPurpose,
    secret: config.secret,
  });

  if (!result.valid) {
    throw createError({
      statusCode: result.reason === "missing" ? 400 : 403,
      statusMessage: "Proof-of-work verification failed.",
      data: {
        reason: result.reason,
      },
    });
  }

  const consumptionResult = proofOfWorkConsumptionStore.consume({
    token: solution.token,
    purpose: expectedPurpose,
    ttlSeconds: config.ttlSeconds,
  });

  if (!consumptionResult.consumed) {
    throw createError({
      statusCode: 403,
      statusMessage: "Proof-of-work verification failed.",
      data: {
        reason: consumptionResult.reason,
      },
    });
  }
};
