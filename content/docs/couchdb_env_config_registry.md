# Content Layer CouchDB `_config` Registry

Last updated: 2026-04-21 (UTC)

This file tracks CouchDB `_config` settings consumed by the `layers/content` layer and their current values.

## Section: `cf_env_nuxt-app-starter`

Used by: `layers/content/server/utils/content-fonts.ts`

| Key | Current Value | Notes |
|---|---|---|
| `content_fonts_allowlist` | `inter,lato,playfair-display,montserrat,roboto` | Comma-separated family slug allowlist used by Typography UI and apply pipeline. |
| `content_fonts_default_sans` | `null` | Falls back to layer logic when unset. |
| `content_fonts_default_display` | `null` | Falls back to layer logic when unset. |

## Section: `cf_openai`

Used by: `layers/content/server/utils/llm-translations-config.ts`

| Key | Current Value | Notes |
|---|---|---|
| `api_key` | `set(length=164)` | Value masked; used by LLM translation features. |

## Fallback Behavior (from current code)

- Font allowlist fallback: `inter,lato,playfair-display` when `content_fonts_allowlist` is unset/empty.
- Default font selection fallback resolves from allowlist when default keys are unset.
