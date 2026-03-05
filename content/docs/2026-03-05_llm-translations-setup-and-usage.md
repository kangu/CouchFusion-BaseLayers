# LLM Translations Setup and Usage

This guide explains how to enable and use the LLM translation feature in the Content Builder.

## 1) Configure CouchDB API key

The feature reads the OpenAI key from CouchDB node config:
- key path: `cf_openai.api_key`

Set it with CouchDB config API (example):

```bash
curl -X PUT "http://localhost:5984/_node/_local/_config/cf_openai/api_key" \
  -H "Content-Type: application/json" \
  -d "\"YOUR_OPENAI_API_KEY\""
```

Notes:
- Value is stored as a CouchDB config string.
- App startup reads and caches it.

## 2) Start app (initialization)

On app startup, content layer initialization does:
- ensures content DB exists
- ensures `llm-translations` config document exists in content DB
- reads `cf_openai.api_key` and caches runtime translation config

No manual creation of `llm-translations` doc is required.

## 3) Optional: adjust translation model/config

Document id:
- `_id: "llm-translations"` in the content database

Config shape is under:
- `config.baseUrl`
- `config.model`
- `config.request.maxCompletionTokens`
- `config.request.temperature`
- `config.prompts.system`
- `config.prompts.userTemplate`

You can edit this document directly in CouchDB admin tools if needed.

## 4) Use in Content Admin Workbench

In page editor header:
- choose active source locale (this is always source)
- choose target locales in `Translate to`
- choose overwrite mode:
  - `Missing only` (fills empty/missing values)
  - `All values` (replaces existing localized values)
- click `Translate Page` for full page scope

For narrower scopes:
- section-level: use section translate button in node header
- field-level: use inline `Translate` button next to localized input/rich-text
- nested localized fields are supported in jsonobject/jsonarray/stringarray paths

## 5) Staging behavior (important)

Translation results are staged in editor per locale:
- translated documents are loaded into editor state
- nothing is auto-saved
- user must click `Save Changes` per locale

Report behavior:
- after translation run, report appears in header
- quick buttons let you open each translated locale
- failures are shown per locale

## 6) Workbench + node editor integration summary

- Page, section, and field translation requests all resolve to body JSON pointers.
- Server translates localizable text values in selected scope.
- Fixed/global paths are skipped by server rules.

## 7) SSR and security

- API routes are server-side and admin-session protected.
- Feature works in SSR runtime (server endpoints + server initialization plugin).
- API key never needs to be exposed to client UI.

