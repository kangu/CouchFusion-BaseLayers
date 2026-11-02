// Brute-force limits for the login endpoints. Counters live in memory, per server process:
// a restart clears them (the per-email limit still cancels codes in CouchDB, which persists).
import { getRequestHeader, getRequestIP, type H3Event } from "h3";

export interface FailureCounter {
  /** True once `max` failures were recorded for `key` within the current window. */
  blocked(key: string, now?: number): boolean;
  /** Records a failure and returns the count within the current window. */
  fail(key: string, now?: number): number;
  reset(key: string): void;
  clear(): void;
}

/** Fixed window per key, starting at its first failure. */
export function createFailureCounter({ max, windowMs }: { max: number; windowMs: number }): FailureCounter {
  const entries = new Map<string, { start: number; count: number }>();
  const live = (key: string, now: number) => {
    const entry = entries.get(key);
    return entry && now - entry.start < windowMs ? entry : null;
  };
  const prune = (now: number) => {
    for (const [key, entry] of entries) if (now - entry.start >= windowMs) entries.delete(key);
  };
  return {
    blocked(key, now = Date.now()) {
      const entry = live(key, now);
      return !!entry && entry.count >= max;
    },
    fail(key, now = Date.now()) {
      let entry = live(key, now);
      if (!entry) {
        entry = { start: now, count: 0 };
        entries.set(key, entry);
        if (entries.size > 10_000) prune(now);
      }
      entry.count += 1;
      return entry.count;
    },
    reset(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
  };
}

export const LOGIN_LIMITS = {
  windowMinutes: 15,
  /** Wrong codes for one email before its pending codes are cancelled. */
  codeFailuresPerEmail: 5,
  /** Wrong codes from one address (any email) before it gets 429 for the window. */
  codeFailuresPerAddress: 30,
  /** Wrong passwords for one username before it gets 429 for the window. */
  passwordFailuresPerUser: 5,
  /** Wrong passwords from one address before it gets 429 for the window. */
  passwordFailuresPerAddress: 20,
} as const;

const windowMs = LOGIN_LIMITS.windowMinutes * 60 * 1000;

export const codeFailuresByEmail = createFailureCounter({ max: LOGIN_LIMITS.codeFailuresPerEmail, windowMs });
export const codeFailuresByAddress = createFailureCounter({ max: LOGIN_LIMITS.codeFailuresPerAddress, windowMs });
export const passwordFailuresByUser = createFailureCounter({ max: LOGIN_LIMITS.passwordFailuresPerUser, windowMs });
export const passwordFailuresByAddress = createFailureCounter({ max: LOGIN_LIMITS.passwordFailuresPerAddress, windowMs });

/** Clears every login counter (tests). */
export const resetLoginLimits = (): void => {
  for (const counter of [codeFailuresByEmail, codeFailuresByAddress, passwordFailuresByUser, passwordFailuresByAddress]) {
    counter.clear();
  }
};

/**
 * The client's address for the per-address limits: `X-Real-IP` as set by the reverse
 * proxy (the CouchFusion Caddy template overwrites it with the connecting address), else
 * the socket address. A client that reaches the app without the proxy could fake the
 * header; the per-email and per-username limits don't depend on it.
 */
export const clientAddress = (event: H3Event): string => {
  const real = getRequestHeader(event, "x-real-ip")?.trim();
  return real || getRequestIP(event) || "unknown";
};
