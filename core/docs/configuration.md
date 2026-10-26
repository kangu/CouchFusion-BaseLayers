# Configuration contract

`nuxt.config.ts` owns capability selection under `couchdb`: appSlug, config.enabled/required, auth.enabled/password/email/nostr/ui/liveUsers/proofOfWork/loginPath/emailDeliveryHandler, admin.enabled/dataSync/sections, and typed local defaults. All feature flags default false. Configuration is opt-in; an enabled required section is loaded at worker startup with a 3-second timeout. Build/prepare never fetch configuration. Database-only startup performs no network operations. Workers use an immutable-lifetime settings snapshot; restart every worker after changing runtime policy.

`COUCHDB_ADMIN_AUTH` is the only required environment variable, base64(username:password). Bootstrap uses `http://localhost:5984`. Other environment names and repository dotenv files are not read by the layer/test runner. Never add credentials to Nuxt options, policy JSON or URLs.

Runtime policy comes from `_node/_local/_config/cf_env_<normalized appSlug>` as flat strings. Known remote values override local defaults, then library defaults. Unknown keys are ignored so other layers can share the section. Invalid known values fail validation. `config.required=false` permits an explicit local-default fallback on unavailable/missing sections; it does not forgive malformed present settings. A remote true cannot install code absent from Nuxt options; false can disable included methods/admin/Data Sync/live users.

| Keys | Values |
| --- | --- |
| auth_user_prefix | Existing application CouchDB username prefix; default empty |
| auth_token_database, auth_challenge_database | Explicit existing storage for enabled passwordless/PoW methods |
| auth_heading, auth_redirect_path | Login heading, local absolute post-login path (default `/`) |
| auth_token_ttl_seconds | 60..3600, default 600 |
| auth_session_max_age_seconds | 60..86400, default 600; checked after native session validation; cannot override CouchDB's shorter timeout |
| auth_cookie_secret | Server-only passwordless signing secret; must match native chttpd_auth secret |
| auth_pow_bits, auth_pow_ttl_seconds | 1..24/default18, 30..3600/default600 |
| admin_roles | Comma-separated allowed application roles, default admin; cannot be empty when enabled |
| admin_theme | ledger or classic |
| admin_brand_name, admin_site_name, admin_footer_text | Presentation strings |
| auth_password_enabled, auth_email_enabled, auth_nostr_enabled, auth_live_users_enabled, admin_enabled, admin_datasync_enabled | Strict true/false; only disable/permit compiled features |

Only feature booleans, login presentation, admin presentation/navigation and the current sanitized user's name/roles reach the client. Passwords, the bootstrap credential, cookie secrets and raw config sections never do. Native authentication policy is read only for passwordless compatibility; the integration does not change signing keys, PBKDF2 policy, native timeout or global server settings.

`couchdb.admin.sections` contains typed `{id,title,requiresRoles?,items:[{label,route,icon?,requiresRoles?,activeRoutes?}]}` sections. Other modules may contribute through `couchdb:admin:sections`. Route visibility is a convenience; guard each server endpoint independently with `requireUser`, `requireRoles`, or `requireAdmin` from `#core/server/auth`.

The current Nostr implementation verifies NIP-07 signed challenges against existing linked users. Parsed relay/DM/sender fields are reserved compatibility inputs and are not an implemented relay or DM delivery service. Email uses a host-provided server adapter; no email-layer dependency or implicit external messaging is installed.

## Validation and snapshot safety

Setup validates local defaults even when remote configuration is optional. The same schema checks effective settings after CouchDB precedence: numeric ranges, enums, string types, role lists, local redirect/navigation paths, relay URL structure, and application database names. JavaScript boolean strings such as `auth.enabled: 'false'` and malformed option groups are rejected rather than treated as truthy or silently disabled.

Enabled email requires `auth_token_database` and `auth_cookie_secret`; enabled Nostr requires `auth_challenge_database` and `auth_cookie_secret`; enabled proof of work requires `auth_challenge_database`. Application stores cannot name system databases such as `_users`. These are readiness checks for required values and shapes, not proof that the stores/views already exist or that the secret matches native policy. Feature-aware remote preflight and selected auth-design provisioning remain separate work. Password-only configurations do not require these passwordless settings. If remote policy disables all login methods, the installed login UI and method-dependent proof-of-work capability become effectively disabled as well.

An optional missing/unreachable section may use validated defaults. Malformed present JSON, invalid sections and invalid known values fail instead of being mistaken for an outage. Configuration errors name fields without echoing secret values.

Loaded settings are cloned and recursively frozen, including feature flags, role arrays, nested navigation and secrets. The freeze never affects the caller's input defaults. Public settings are independent allowlisted copies; mutating a response cannot modify worker policy. Restart workers to apply a new snapshot.
