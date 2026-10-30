# Trusted forwarding headers

## Problem
`getClientIp` used `CF-Connecting-IP` first, and `geoFromHeaders` read `CF-IPCountry`, CloudFront, Vercel and `X-Country-Code` as sent. On a site not behind Cloudflare, Caddy passes those headers through unchanged. Any visitor could therefore choose their IP and their country. The IP feeds the visitor hash, the ignored-IP list and rate limiting.

## Change
- `server/engine/net.ts` `resolveClient(event, trust)` returns the client IP and which geo headers are trustworthy for this request. `getClientIp` wraps it.
- New `_config` key `analytics_trust_headers` (editable in Settings → Engine):
  - `auto` (default): find the connecting address. That is the socket peer, or, when the peer is loopback/private (a local proxy), that proxy's `X-Real-IP` or last `X-Forwarded-For` hop. Cloudflare headers count only if that address is in Cloudflare's published ranges (hardcoded, checked against cloudflare.com/ips on 2026-10-28). Other CDN geo headers are ignored. Otherwise the IP is the connecting address and the country falls back to the time zone.
  - `cloudflare`: always trust Cloudflare headers (for another proxy or LB between Cloudflare and Caddy).
  - `all`: the previous behaviour (every header as sent; for CloudFront/Vercel or a proxy that sets `X-Country-Code`).
- `resolveGeo` takes the per-request `geoHeaders`; `geoFromHeaders(event, "cloudflare" | "all" | "none")`.
- The collector and pixel/link hits use `resolveClient`.
- `geoStats.ignoredCloudflareHeaders` counts hits whose Cloudflare headers were ignored. Settings explains it and when to switch to `cloudflare`.

## Deploy notes
- Behind the githooker Caddy template (`header_up X-Real-IP {remote_host}`), Cloudflare-proxied sites keep working. Caddy's peer is a Cloudflare edge, so its `X-Real-IP` is in range.
- **Watch for this.** If something other than Cloudflare sits in front of Caddy (another proxy or LB), every hit would get that proxy's IP and lose its Cloudflare country. Visitor counts would collapse. Settings → Engine shows "N hits carried Cloudflare headers but didn't come from a Cloudflare address". Set `analytics_trust_headers=cloudflare` for such sites.
- An app exposed directly with no proxy uses the socket address, and headers are ignored.

## Verification
- New `server/engine/net.spec.ts` (11 tests): Caddy without Cloudflare plus forged headers, Cloudflare → Caddy, IPv6 and IPv4-mapped peers, a direct public peer, XFF fallback, junk values, local dev, `cloudflare` and `all` modes, config parsing, range checks.
- `geo.spec.ts` covers ignored untrusted headers.
- Whole suite: 73 passed, 2 skipped. `apps/smart-lead` builds.
- Not verified against live traffic.
