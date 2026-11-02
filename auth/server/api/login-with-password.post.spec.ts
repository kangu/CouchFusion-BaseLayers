import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { createApp, toNodeListener } from "h3";

// One account: "bv" prefix + "maria", password "right".
const authenticate = vi.fn(async (name: string, password: string) =>
  name === "bvmaria" && password === "right" ? { ok: true, name: "bvmaria" } : { ok: false },
);

vi.mock("#database/utils/couchdb", () => ({
  authenticate: (name: string, password: string) => authenticate(name, password),
  getDocument: async () => ({ _id: "org.couchdb.user:bvmaria", name: "bvmaria", salt: "s" }),
}));

vi.mock("../utils/session-cookie", () => ({
  issueSessionCookie: async () => true,
}));

let server: Server;
let url = "";
beforeAll(async () => {
  (globalThis as any).useRuntimeConfig = () => ({ dbLoginPrefix: "bv" });
  const handler = (await import("./login-with-password.post")).default;
  const app = createApp();
  app.use(handler);
  server = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(() => {
  server.close();
  delete (globalThis as any).useRuntimeConfig;
});
beforeEach(async () => {
  (await import("../utils/login-limits")).resetLoginLimits();
  authenticate.mockClear();
});

const login = (username: string, password: string, address = "203.0.113.10") =>
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Real-IP": address },
    body: JSON.stringify({ username, password }),
  });

describe("POST /api/login-with-password: limits", () => {
  it("logs in with the right password", async () => {
    expect((await login("maria", "right")).status).toBe(200);
  });

  it("answers 429 after 5 wrong passwords for a username, without checking the password", async () => {
    for (let i = 0; i < 5; i++) expect((await login("maria", `wrong${i}`)).status).toBe(401);
    authenticate.mockClear();
    // Same username, prefixed spelling and different case: same counter. Even the right password waits.
    for (const name of ["maria", "BVmaria", "Maria"]) {
      expect((await login(name, "right", "198.51.100.1")).status).toBe(429);
    }
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("a successful login resets the username's count", async () => {
    for (let i = 0; i < 4; i++) await login("maria", `wrong${i}`);
    expect((await login("maria", "right")).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login("maria", `again${i}`)).status).toBe(401);
    expect((await login("maria", "right")).status).toBe(200);
  });

  it("answers 429 to an address after 20 wrong passwords across usernames", async () => {
    for (let i = 0; i < 20; i++) {
      // Four misses per username stay under the per-username limit.
      expect((await login(`user${Math.floor(i / 4)}`, "nope", "198.51.100.7")).status).toBe(401);
    }
    expect((await login("maria", "right", "198.51.100.7")).status).toBe(429);
    expect((await login("maria", "right", "203.0.113.99")).status).toBe(200);
  });
});
