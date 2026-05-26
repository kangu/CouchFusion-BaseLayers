import { createError } from "h3";

type InvisibleFormShieldPurpose = "login" | "contact";

export interface InvisibleFormShieldPayload {
  startedAt?: number | string;
  website?: string;
  company?: string;
  phone?: string;
  [key: string]: unknown;
}

interface AssertInvisibleFormShieldOptions {
  purpose: InvisibleFormShieldPurpose;
  now?: Date;
  minAgeMs?: number;
  maxAgeMs?: number;
}

type InvisibleFormShieldFailureReason =
  | "missing"
  | "invalid-started-at"
  | "too-fast"
  | "stale"
  | "honeypot";

const DEFAULT_MIN_AGE_MS = 2_000;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const rejectInvisibleFormShield = (
  purpose: InvisibleFormShieldPurpose,
  reason: InvisibleFormShieldFailureReason,
): never => {
  throw createError({
    statusCode: reason === "missing" ? 400 : 403,
    statusMessage: "Invisible form shield rejected the request.",
    data: {
      purpose,
      reason,
    },
  });
};

const parseStartedAt = (value: unknown): number => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return Number(value);
  }

  return Number.NaN;
};

/**
 * Validates invisible anti-spam metadata submitted by browser-rendered forms.
 * Hidden honeypot fields must stay empty and the form must not be submitted
 * unrealistically soon after rendering.
 */
export const assertInvisibleFormShield = (
  payload: InvisibleFormShieldPayload | null | undefined,
  {
    purpose,
    now = new Date(),
    minAgeMs = DEFAULT_MIN_AGE_MS,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
  }: AssertInvisibleFormShieldOptions,
): void => {
  if (!payload || typeof payload !== "object") {
    rejectInvisibleFormShield(purpose, "missing");
  }

  const startedAt = parseStartedAt(payload.startedAt);
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    rejectInvisibleFormShield(purpose, "invalid-started-at");
  }

  const ageMs = now.getTime() - startedAt;
  if (ageMs < minAgeMs) {
    rejectInvisibleFormShield(purpose, "too-fast");
  }

  if (ageMs > maxAgeMs) {
    rejectInvisibleFormShield(purpose, "stale");
  }

  for (const [key, value] of Object.entries(payload)) {
    if (key === "startedAt") {
      continue;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      rejectInvisibleFormShield(purpose, "honeypot");
    }
  }
};
