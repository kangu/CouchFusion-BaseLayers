# Initial Prompt
Refactor the env variable STRIKE_API_KEY to NUXT_STRIKE_API_KEY everywhere, so I can configure it at deployment to a different value that nuxtjs would read it.

# Implementation Summary
Updated the lightning layer runtime config to read Strike API credentials from NUXT_STRIKE_API_KEY and refreshed the inline guidance text to match the new variable name.

# Documentation Overview
- Lightning layer consumers now need to provide `NUXT_STRIKE_API_KEY` instead of `STRIKE_API_KEY` in Nuxt runtime configuration or deployment environments.
- Validation messages inside `layers/lightning/nuxt.config.ts` have been aligned with the new variable name so misconfiguration feedback stays accurate.
- No other modules referenced the legacy variable, so changes are scoped to the lightning layer configuration file.

# Implementation Examples
- `layers/lightning/nuxt.config.ts:34` – strikes provider definition now sources `process.env.NUXT_STRIKE_API_KEY`.
- `layers/lightning/nuxt.config.ts:63` – sample configuration snippet uses `NUXT_STRIKE_API_KEY` in inline guidance.
- `layers/lightning/nuxt.config.ts:121` – developer-facing error copy instructs teams to set `NUXT_STRIKE_API_KEY`.
