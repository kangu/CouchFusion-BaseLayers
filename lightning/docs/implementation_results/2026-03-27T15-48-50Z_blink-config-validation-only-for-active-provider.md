# Initial Prompt
I get this error while trying to run the project: Set NUXT_BLINK_API_KEY environment variable or configure directly:
providers: {
  blink: {
    apiKey: 'your-blink-api-key',
    walletId: 'your-btc-wallet-id'
  }
}. The "blink" is not the active lightning provide, it should not throw an error unless it's used

# Plan
1. Trace where Blink configuration is validated during startup.
2. Add a regression test that proves startup should not fail when Blink is present but not the active provider.
3. Keep the existing guard that Blink must still provide an API key when Blink is the selected default provider.
4. Apply the minimal validation change and rerun the focused lightning test file.

# Implementation Summary
- Root cause:
  - `layers/lightning/nuxt.config.ts` validated `providers.blink` eagerly during the layer `ready` hook.
  - The layer populates a Blink config object in runtime defaults, so apps using another provider could still fail at startup when `NUXT_BLINK_API_KEY` was unset.
- Test changes:
  - Added two regression tests to `layers/lightning/tests/blink-provider.spec.ts`:
    - startup does not fail when `defaultProvider` is `strike` and Blink is only a placeholder entry
    - startup still fails when `defaultProvider` is `blink` and Blink has no `apiKey`
  - Added `layers/lightning/vitest.config.ts` so the lightning unit tests can run without the content-layer CouchDB test bootstrap.
- Production fix:
  - Updated `layers/lightning/nuxt.config.ts` so provider credential validation runs only for the active `defaultProvider`.
  - Non-default provider placeholders no longer block app startup.

# Verification
- Passed:
  - `bunx vitest --config lightning/vitest.config.ts lightning/tests/blink-provider.spec.ts`

# Next Steps
1. If you want the same behavior enforced consistently, add equivalent active-provider-only validation for any future provider-specific required fields.
2. If this layer keeps growing its standalone tests, keep using the local `lightning/vitest.config.ts` so unit tests stay isolated from database-backed setup.
