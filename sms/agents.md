# Layer: sms

Runtime: nuxt 4.x, vue 3.5.x

Provider-based SMS sending layer for CouchFusion apps. Supports a `mock` provider (default, dev/test) and `twilio` (production via Messaging Service SID). Reads all credentials from CouchDB `_config` under `cf_env_[appSlug]`, in line with the root Environment Configuration Standard.

Consumed by: `apps/gas-maintenance` (via `extends` array). No other consumers at present.

## Folder map

- `server/utils/config.ts` — `readSmsEnvConfig()`; resolves provider + Twilio credentials from CouchDB `_config`.
- `server/utils/sender.ts` — `sendSms()`; routes to mock or Twilio and normalizes the result.
- `server/utils/sender.spec.ts` — vitest unit tests (mocks `#database/utils/couch-config` and `twilio`).
- `nuxt.config.ts` — registers the `#sms` alias to the layer root.
- `vitest.config.ts` — standalone vitest config; aliases `#database` to `../database`.
- `README.md` — human-facing usage docs (config keys, install, result shape).
- `docs/implementation_results/` — task result notes.

## Public API / Exports

- `sendSms(payload: SmsSendPayload): Promise<SmsSendResult>` — import from `#sms/server/utils/sender`.
  - `SmsSendPayload = { to: string; text: string }`
  - `SmsSendResult = { ok: boolean; provider: "mock" | "twilio"; providerMessageId: string | null; errorMessage: string | null }`
- `readSmsEnvConfig(): Promise<SmsEnvConfig>` — import from `#sms/server/utils/config` (rarely needed directly).
- Layer alias: `#sms`. No auto-imports, no components, no HTTP endpoints — call sites import the util.

## Conventions

- Always import from `#sms/server/utils/*`, never from relative paths inside the layer.
- All secrets live in CouchDB `_config` section `cf_env_[appSlug]` — never read from `process.env` or `runtimeConfig`.
- Default app slug fallback in `config.ts` is `gas-maintenance` — when adding a new consumer, pass `runtimeConfig.public.appSlug` so the correct `_config` section is used.
- Twilio uses the **Messaging Service SID** flow (`messagingServiceSid`), not a direct `from` number. Don't introduce `from`-based sending without updating the test suite.
- Fail closed: if `sms_provider=twilio` but any credential is missing, return `ok: false` rather than falling back to mock.

## Dependencies

- `#database/utils/couch-config` (`buildCouchEnvSection`, `readCouchConfigValues`) — from the `database` layer; this layer does NOT extend `database` in its own `nuxt.config.ts`, so consumers must provide it.
- Runtime package: `twilio` (npm). Consumers must `bun install twilio`; the layer has no `package.json` deps.
- Runtime config: `runtimeConfig.public.appSlug` (string) — drives the `_config` section name.

### CouchDB `_config` keys (section `cf_env_[appSlug]`)

- `sms_provider` — `mock` (default) or `twilio`
- `twilio_account_sid`
- `twilio_auth_token`
- `twilio_messaging_service_sid`

## Build / Test commands

- Standalone tests (recommended): `bunx vitest run --config vitest.config.ts` from the layer folder.
  - The vitest config aliases `#database` → `../database`, so the `database` layer folder must exist.
- No standalone lint/typecheck scripts. Typecheck via a consuming app (e.g. `apps/gas-maintenance`): `nuxt typecheck`.
- Manual smoke: set `sms_provider=mock` in `_config`, call `sendSms({ to: "+40712345678", text: "test" })`, expect `ok: true, provider: "mock"`.

## Gotchas / Pitfalls

- The `mock` provider simulates failure when `payload.to` contains the substring `fail-notification` — useful for tests, surprising in prod.
- `normalizeAppSlug()` falls back to `gas-maintenance` silently if `appSlug` is unset; a misconfigured consumer will read the wrong `_config` section.
- `twilio` is imported at module load (`import twilioModule from "twilio"`). If `twilio` is not installed in the consumer, the layer will fail on import even when `sms_provider=mock`. Tests mock it; runtime does not.
- `resolveTwilioConstructor()` is defensive about CJS/ESM/default exports — don't simplify it without re-running the spec.
- No HTTP endpoint is exposed by this layer; it is a server util only.

## Cross-references

- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md` (esp. "Environment Configuration Standard (CouchDB _config)").
- Related layer: `layers/database` (provides `couch-config` util).
- Related skill: none directly.
