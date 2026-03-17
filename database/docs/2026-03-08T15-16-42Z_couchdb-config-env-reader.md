# Initial Prompt
Proceed with the implementation plan for CouchDB `_config` env rollout with app-folder-based `cf_env_[slug]` convention.

# Implementation Summary
Added shared CouchDB `_config` env helpers in the database layer so other layers can read flat key-value entries from section namespaces like `cf_env_radustanciu`.

# Documentation Overview
- Added `layers/database/utils/couch-config.ts` with:
  - `readCouchConfigValue(section, key)`
  - `readCouchConfigValues(section, keys)`
  - `buildCouchEnvSection(slug)`
  - `normalizeCouchEnvSlug(slug)`
  - quoted-string-safe parser for CouchDB `_config` values.
- Updated `layers/database/README.md` with usage notes for `_config` helpers.

