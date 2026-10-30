import { describe, expect, it } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { buildEngineConfig } from "./config";
import { isCloudflareIp, resolveClient } from "./net";

/** A request whose TCP peer is `peer`, carrying `headers`. */
const request = (peer: string | null, headers: Record<string, string> = {}) => {
  const socket = new Socket();
  if (peer) Object.defineProperty(socket, "remoteAddress", { value: peer });
  const req = new IncomingMessage(socket);
  req.headers = headers;
  return createEvent(req, new ServerResponse(req));
};

const forged = { "cf-connecting-ip": "1.2.3.4", "cf-ipcountry": "US" };

describe("client IP and header trust (auto)", () => {
  it("behind Caddy without Cloudflare: uses the proxy's X-Real-IP and ignores forged Cloudflare headers", () => {
    const client = resolveClient(request("127.0.0.1", { "x-real-ip": "203.0.113.9", ...forged }));
    expect(client).toEqual({ ip: "203.0.113.9", geoHeaders: "none", ignoredCloudflareHeaders: true });
  });

  it("behind Cloudflare then Caddy: trusts CF-Connecting-IP and CF geo", () => {
    const client = resolveClient(request("127.0.0.1", { "x-real-ip": "172.64.10.20", "cf-connecting-ip": "81.196.0.1", "cf-ipcountry": "RO" }));
    expect(client).toEqual({ ip: "81.196.0.1", geoHeaders: "cloudflare", ignoredCloudflareHeaders: false });
  });

  it("Cloudflare over IPv6 and IPv4-mapped peers count too", () => {
    expect(resolveClient(request("::ffff:127.0.0.1", { "x-real-ip": "2606:4700::6810:84e5", "cf-connecting-ip": "2a02:2f00::1" })).ip).toBe("2a02:2f00::1");
    expect(resolveClient(request("104.16.0.5", { "cf-connecting-ip": "81.196.0.1" })).geoHeaders).toBe("cloudflare");
  });

  it("exposed directly: the socket peer wins over any header", () => {
    const client = resolveClient(request("198.51.100.7", { "x-real-ip": "9.9.9.9", "x-forwarded-for": "8.8.8.8", ...forged }));
    expect(client.ip).toBe("198.51.100.7");
    expect(client.geoHeaders).toBe("none");
  });

  it("uses the last X-Forwarded-For hop when X-Real-IP is missing or junk", () => {
    expect(resolveClient(request("10.0.0.2", { "x-forwarded-for": "6.6.6.6, 203.0.113.50" })).ip).toBe("203.0.113.50");
    expect(resolveClient(request("10.0.0.2", { "x-real-ip": "unknown", "x-forwarded-for": "203.0.113.50" })).ip).toBe("203.0.113.50");
  });

  it("a junk CF-Connecting-IP from Cloudflare falls back to the edge address", () => {
    expect(resolveClient(request("127.0.0.1", { "x-real-ip": "172.64.10.20", "cf-connecting-ip": "zz::1" })).ip).toBe("172.64.10.20");
  });

  it("no proxy headers at all: the peer (local dev)", () => {
    expect(resolveClient(request("127.0.0.1")).ip).toBe("127.0.0.1");
  });
});

describe("other trust modes", () => {
  it("cloudflare: trusts Cloudflare headers from any address", () => {
    const client = resolveClient(request("127.0.0.1", { "x-real-ip": "10.1.1.1", ...forged }), "cloudflare");
    expect(client).toMatchObject({ ip: "1.2.3.4", geoHeaders: "cloudflare" });
  });

  it("all: the old behaviour, every header as sent", () => {
    const client = resolveClient(request("198.51.100.7", { "x-forwarded-for": "8.8.8.8, 7.7.7.7" }), "all");
    expect(client).toMatchObject({ ip: "8.8.8.8", geoHeaders: "all" });
  });

  it("config defaults to auto", () => {
    expect(buildEngineConfig("kangu", {}).trustHeaders).toBe("auto");
    expect(buildEngineConfig("kangu", { analytics_trust_headers: "Cloudflare" }).trustHeaders).toBe("cloudflare");
    expect(buildEngineConfig("kangu", { analytics_trust_headers: "yes" }).trustHeaders).toBe("auto");
  });

  it("knows Cloudflare's ranges", () => {
    expect(isCloudflareIp("162.158.1.1")).toBe(true);
    expect(isCloudflareIp("2a06:98c0::1")).toBe(true);
    expect(isCloudflareIp("8.8.8.8")).toBe(false);
  });
});
