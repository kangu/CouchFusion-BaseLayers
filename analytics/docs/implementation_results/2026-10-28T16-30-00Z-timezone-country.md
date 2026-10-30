# Country from the browser time zone

## Question
Some sites aren't behind Cloudflare, so they get no `CF-IPCountry` and no country. What is the most lightweight optional way to get one?

## Research (multi-agent, 2026-10-28)
Four options were compared, with measurements; findings were challenged by a skeptic.

| Option | Extra weight | Per hit | Accuracy | Region/city | Ops | License |
|---|---|---|---|---|---|---|
| **Time zone → country (chosen)** | ~10 KB table, no deps; Nuxt tracker already sends the zone | ~20 ns Map lookup | Country-level; wrong for manual/remote-desktop zones, right for VPN users | no | none (regenerate 1–2×/year) | tzdb, public domain |
| Local IP DB (sapics `user-country`) | ~4.6 MB per process | ~0.2 µs v4, ~0.9 µs v6 | ~94–97% agreement with DB-IP/GeoLite2 | no | host cron to refresh | PDDL, no attribution |
| Caddy GeoIP plugin → `X-Country-Code` header | custom Caddy build + MMDB per server | in proxy | same as the DB | yes (with a City DB) | custom binary, DB updates | DB-IP Lite CC BY 4.0 (link back) or GeoLite2 (account) |
| Cloudflare proxy (orange cloud) | none | none | high | with managed transform | DNS change | — |

Measured for the time-zone map: all 418 zone names Node supports resolve (Atlantic/Reykjavik is excluded on purpose). It agrees exactly with ICU/CLDR and with `countries-and-timezones`. Browsers report the configured name (Europe/Oslo, Asia/Calcutta), so most zones that tzdb merges across countries are not ambiguous in practice.

## Changes
- `scripts/generate-tz-country.mjs` builds `server/engine/tz-country.ts` from tzdb `zone.tab` + `backward`. It currently holds 541 names and 247 countries from tzdb 2026f. It excludes non-geographic names (UTC, Etc/*, CET, EST, …) and Atlantic/Reykjavik (the anti-fingerprinting zone), and has 6 overrides for links that cross countries.
- `server/engine/geo.ts`: `countryFromTimezone` (allowlist lookup, ≤64 chars, safe against `__proto__` etc.) and `resolveGeo` (header → time zone, per `analytics_geo_source`).
- `analytics_geo_source` now accepts `auto` (new default) | `header` | `timezone` | `none`. Settings offers all four.
- The collector uses `payload.timezone`. Pixel and link hits have no zone, so they use headers only.
- `/a.js` now sends `timezone`.
- `geoStats.fromTimezone` is shown in Settings ("… of them inferred from the browser time zone").
- Docs: README (both), `docs/self-hosted-analytics.md`, `agents.md`.

## Verification
- New `server/engine/geo.spec.ts` (9 tests): mappings, null cases, hostile input, runtime coverage, source precedence, config parsing, a.js payload. Whole suite: 61 passed, 2 skipped.
- `apps/smart-lead` builds.

## Not done / follow-ups
- **Forgeable headers on non-Cloudflare sites.** `geoFromHeaders` trusts `cf-ipcountry` etc. as sent, and `getClientIp` trusts `cf-connecting-ip` first. On a site not behind Cloudflare, a visitor can set them, and that also affects the visitor hash, the ignored-IP check and rate limiting. Fix it in the Caddy template (`header_up -Cf-Connecting-Ip`, `-Cf-Ipcountry`) or with a `_config` key naming the trusted header.
- **Leftover Umami proxy.** `cli-githooker`'s Caddy template still proxies `/script.js` and `/api/send` to `cloud.umami.is`, a leftover from before the Umami removal.
- **Upgrade path.** If more accuracy is wanted later, add the PDDL `user-country` IP table as a middle step (header → ip → time zone).
