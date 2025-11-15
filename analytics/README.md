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

2. Provide Umami runtime config (env variables or inline):
   ```ts
   export default defineNuxtConfig({
     runtimeConfig: {
       analytics: {
         umami: {
           websiteId: process.env.UMAMI_WEBSITE_ID,
           excludedPaths: process.env.NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS
            ? process.env.NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS.split(',')
                  .map((path) => path.trim())
                  .filter(Boolean)
            : []
         },
       },
     },
   });
   ```

3. Use the composable:
   ```vue
   <script setup lang="ts">
   const analytics = useAnalytics();

   const trackSignup = () => {
     analytics.trackEvent('signup-click', { plan: 'pro' });
   };
   </script>
   ```

4. Or use the directive:
   ```vue
   <template>
     <button v-analytics="{ event: 'cta-click', data: { location: 'hero' } }">
       Try it now
     </button>
   </template>
   ```

## Runtime Config Notes
- `websiteId` **must** be supplied; otherwise the layer warns and exits quietly.
- Provide `excludedPaths` (array or CSV string) to skip tracking for sensitive routes such as `/login` or `/admin/*`. When exclusions are set, the layer disables Umami's auto-tracking and manually emits page views for allowed routes.
- Override `public.analytics.endpoint` if your frontend should post analytics to a different proxy route than `/api/stats`.
- Toggle `includeTitle`, `sendReferrer`, or `debug` under `public.analytics.umami` to adjust payload metadata without touching code.

### Environment Examples
Create a `.env` (auto-loaded by Nuxt/bun dev server) with a development website ID:
```env
# .env
NUXT_PUBLIC_UMAMI_WEBSITE_ID=dev-site-id
NUXT_PUBLIC_UMAMI_HOST_URL=https://analytics.umami.is
NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS=/login,/auth/*
```

For production, prefer `.env.production` or environment variables provided by your host:
```env
# .env.production
NUXT_PUBLIC_UMAMI_WEBSITE_ID=prod-site-id
NUXT_PUBLIC_UMAMI_HOST_URL=https://analytics.yourdomain.com
NUXT_PUBLIC_UMAMI_SCRIPT_PATH=/umami.js
NUXT_PUBLIC_UMAMI_DATA_DOMAINS=app.yourdomain.com,www.yourdomain.com
NUXT_PUBLIC_UMAMI_AUTO_TRACK=true
NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS=/internal-preview/*,/admin/*
```

When running locally, `bun run dev` automatically reads `.env`. For production builds (e.g., `bun run build` on deploy), ensure these variables are present in the environment before starting the server.

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
