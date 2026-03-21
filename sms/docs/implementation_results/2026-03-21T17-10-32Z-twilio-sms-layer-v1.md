# Twilio SMS Layer v1

## Summary
Implemented a new reusable `layers/sms` Nuxt layer with provider-based SMS sending and Twilio transport support.

## Implemented
- Added layer alias registration in `layers/sms/nuxt.config.ts`.
- Added CouchDB `_config` reader in `layers/sms/server/utils/config.ts` for:
  - `sms_provider`
  - `twilio_account_sid`
  - `twilio_auth_token`
  - `twilio_messaging_service_sid`
- Added SMS sender in `layers/sms/server/utils/sender.ts` with:
  - `mock` provider default
  - `twilio` provider using Messaging Service SID
  - fail-closed behavior when Twilio is enabled but config is incomplete
  - normalized send result (`ok`, `provider`, `providerMessageId`, `errorMessage`)
- Added unit tests in `layers/sms/server/utils/sender.spec.ts`.
- Added isolated test config `layers/sms/vitest.config.ts` to run SMS tests without CouchDB integration setup.
- Added `layers/sms/README.md` usage and configuration docs.

## Verification
- `bunx vitest --config sms/vitest.config.ts --run` from `layers/` (pass)
