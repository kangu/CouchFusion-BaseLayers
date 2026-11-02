// Nostr and proof-of-work challenges are signed with CouchDB's own cookie secret, with no
// app setting: the secret is read from chttpd_auth/secret (mocked here).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let couchSecret: string | null = "couch-secret";
vi.mock("#database/utils/couch-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#database/utils/couch-config")>()),
  readCouchConfigValue: async (section: string, key: string) =>
    section === "chttpd_auth" && key === "secret" ? couchSecret : null,
}));

beforeAll(() => {
  (globalThis as any).useRuntimeConfig = () => ({ proofOfWork: { enabled: "true", difficultyBits: 1 } });
});
afterAll(() => {
  delete (globalThis as any).useRuntimeConfig;
});
beforeEach(async () => {
  couchSecret = "couch-secret";
  const { resetSessionCookieCache } = await import("./session-cookie");
  resetSessionCookieCache();
});

describe("Nostr challenges", () => {
  const npub = "npub1example";

  it("are signed and verified with CouchDB's secret", async () => {
    const { issueNostrChallenge, verifyNostrChallenge } = await import("./nostr-challenge");
    const issued = await issueNostrChallenge(npub, 300);
    const payload = await verifyNostrChallenge(issued.token, npub);
    expect(payload.challenge).toBe(issued.challenge);
  });

  it("reject a token signed with a different secret", async () => {
    const { issueNostrChallenge, verifyNostrChallenge } = await import("./nostr-challenge");
    const { resetSessionCookieCache } = await import("./session-cookie");
    const issued = await issueNostrChallenge(npub, 300);
    couchSecret = "rotated-secret";
    resetSessionCookieCache();
    await expect(verifyNostrChallenge(issued.token, npub)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("fail clearly when CouchDB's secret cannot be read", async () => {
    couchSecret = null;
    const { issueNostrChallenge } = await import("./nostr-challenge");
    await expect(issueNostrChallenge(npub, 300)).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("proof-of-work", () => {
  it("signs with the CouchDB secret once it has been read (synchronous API)", async () => {
    const { resolveCookieSecret } = await import("./session-cookie");
    const { resolveProofOfWorkConfig, issueProofOfWorkChallenge } = await import("./proof-of-work-runtime");
    await resolveCookieSecret();
    expect(resolveProofOfWorkConfig().secret).toBe("couch-secret");
    expect(issueProofOfWorkChallenge("login")).toMatchObject({ required: true });
  });

  it("explains itself when the secret has not been read yet", async () => {
    const { resolveProofOfWorkConfig } = await import("./proof-of-work-runtime");
    expect(() => resolveProofOfWorkConfig()).toThrow(/unavailable/);
  });
});
