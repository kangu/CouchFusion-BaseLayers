# CouchDB 3.5.3 authentication review

Reviewed current source, shared-layer Git history and recorded integration results on 2026-11-03. No runtime or deployment changes made; no live servers tested in this review.

- CouchDB 3.5.3 release notes list auth handler aliases (old tuples accepted), proxy header defaults, malformed authorization handling and system database suffix checks. Our auth layer uses AuthSession cookies, not X-Auth-CouchDB proxy headers. These notes do not introduce a replacement cookie format.
- CouchDB 3.5.0 enables upgrade_hash_on_auth by default. This concerns password hashes, distinct from cookie HMAC. Cookie hash_algorithms defaults to sha256, sha; the shared generator still signs SHA-1 and therefore depends on sha remaining accepted.
- Shared commit 16deae6 (2026-10-31) implements persistent one-year sessions, admin-config salt precedence and validation through GET /_session before issuing cookies. Its report records successful checks on hydra1 CouchDB 3.5.3, including acceptance after twelve minutes. The radustanciu VPS report associates hydra1 with that app, though the auth report itself names only the host.
- Shared commit 19f3916 (2026-11-02) removes app cookie-secret overrides and reads CouchDB chttpd_auth/secret directly, cached for five minutes. Its report records live challenge checks in paleologu-prosti.
- Bitvocation's 2026-11-02 local hardening report records successful password login with a one-year HttpOnly/SameSite=Lax cookie. Its production review explicitly could not establish deployed revisions. Local implementation and recorded checks do not establish rollout to every production app.
- Related November 2 commits ec9d62b and 513f5da add login-code/password limits and signed-out admin 404 behavior; these are application changes, not CouchDB 3.5.3 requirements.

Sources: https://docs.couchdb.org/en/stable/whatsnew/3.5.html and https://docs.couchdb.org/en/stable/config/auth.html; adjacent October 31 and November 2 implementation reports; apps/bitvocation/docs/implementation_results/2026-11-02T10-34-44Z_production-hardening-local-verification.md.
