# Analytics Layer (Umami)

Reusable Nuxt layer that wires up [Umami](https://umami.is) analytics with a composable and directive so projects can track events consistently.

## Features
- Auto-loads the Umami tracker script using runtime configuration.
- `useAnalytics()` composable exposes `trackEvent`, `trackPageview`, and router helpers.
- `v-analytics` directive attaches event handlers that fire Umami-backed events declaratively.
- Ships SSR-safe directive registration so server rendering never errors on pages that include analytics bindings.

## Installation
1. Add the layer to your Nuxt app:
   ```ts
   // nuxt.config.ts
   export default defineNuxtConfig({
     extends: [
       '../../layers/analytics',
       // ...other layers
     ],
   });
   ```

2. Provide a deterministic application slug and any browser-side behavior:
   ```ts
   export default defineNuxtConfig({
     runtimeConfig: {
       public: {
         appSlug: 'my-app',
         analytics: {
           umami: {
             includeTitle: true,
             sendReferrer: true,
             debug: false
           }
         },
       },
     },
   });
   ```

3. Configure the server proxy in CouchDB `_config`. Values are flat strings in
   the `cf_env_[appSlug]` section:

   - `umami_website_id` — required; the authoritative Umami website ID.
   - `umami_excluded_paths` — optional comma-separated exact paths or `*` suffix patterns.

4. Use the composable:
   ```vue
   <script setup lang="ts">
   const analytics = useAnalytics();

   const trackSignup = () => {
     analytics.trackEvent('signup-click', { plan: 'pro' });
   };
   </script>
   ```

5. Or use the directive:
   ```vue
   <template>
     <button v-analytics="{ event: 'cta-click', data: { location: 'hero' } }">
       Try it now
     </button>
   </template>
   ```

## Runtime Config Notes
- `runtimeConfig.public.appSlug` **must** be deterministic. It selects the CouchDB section `cf_env_[appSlug]` and should normally match the app folder name.
- The proxy accepts `websiteId` only from CouchDB. It rejects requests while `umami_website_id` is missing and always overwrites any client-supplied `payload.website` value.
- Provide `umami_excluded_paths` in CouchDB to skip sensitive routes such as `/login` or `/admin/*`. Exact matches and suffix `*` prefix patterns are supported.
- Override `public.analytics.endpoint` if your frontend should post analytics to a different proxy route than `/api/stats`.
- Toggle `includeTitle`, `sendReferrer`, or `debug` under `public.analytics.umami` to adjust payload metadata without touching code.
- The legacy CouchDB key `NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS` remains a compatibility fallback. Migrate it to `umami_excluded_paths`; when both exist, the canonical lower-case key wins.
- Ready config is cached for the server process lifetime. Missing required config is cached for 30 seconds, after which the layer retries CouchDB; concurrent requests share one read.

## Migration from environment-backed server config

1. Upgrade the Analytics layer together with its shared Database layer dependency.
2. Add an explicit `runtimeConfig.public.appSlug` to the consuming app before deployment.
3. Before switching traffic, create `cf_env_[appSlug].umami_website_id` in CouchDB.
4. Move exclusions to `cf_env_[appSlug].umami_excluded_paths`. The legacy uppercase exclusion key can remain during a staged rollout.
5. Keep any existing public Umami environment variables during the first rollout if older clients still emit them. The upgraded proxy does not trust them, so they can be removed after all instances are upgraded.
6. Confirm the redacted startup notices report the expected section, a present website ID, and the intended exclusion source.

The server-side migration is intentionally strict: deploy the CouchDB keys before or with the new layer. If the required website ID is absent, `/api/stats` returns an error instead of attributing events to a client-selected website.

## Directive API
`v-analytics`
- Value can be a string event name or an object `{ event, data?, trigger? }`.
- `trigger` defaults to `"click"`; `v-analytics:mouseover="'event'"` also works.
- Automatically removes listeners when the component unmounts.

## Composable API
`const { trackEvent, trackPageview, trackRouterNavigation, track, trackView } = useAnalytics();`
- `trackEvent(name, data?, extra?)` – send a custom event payload (also available as `track`).
- `trackPageview(extra?)` – track a page view (also exposed as `trackView(url?, referrer?)`).
- `trackRouterNavigation(to, from)` – helper wired to the Nuxt router's `afterEach` hook.

## Extending
- You can override the directive by registering another `v-analytics` directive in the consuming app.
- The layer exposes `#analytics` alias pointing to its root for custom imports if necessary.
