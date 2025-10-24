# Analytics Layer (Umami)

Reusable Nuxt layer that wires up [Umami](https://umami.is) analytics with a composable and directive so projects can track events consistently.

## Features
- Auto-loads the Umami tracker script using runtime configuration.
- `useUmami()` composable exposes `track`, `trackView`, and `isLoaded`.
- `v-umami` directive attaches event handlers that fire Umami events declaratively.
- Works entirely on the client; no SSR side effects.

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
       public: {
         analytics: {
           umami: {
             websiteId: process.env.UMAMI_WEBSITE_ID,
             hostUrl: process.env.UMAMI_HOST_URL, // optional, defaults to https://analytics.umami.is
             scriptPath: '/script.js',             // optional
             dataDomains: 'example.com',           // optional CSV
             autoTrack: true,                      // set false to disable auto tracking
           },
         },
       },
     },
   });
   ```

3. Use the composable:
   ```vue
   <script setup lang="ts">
   const umami = useUmami();

   const trackSignup = () => {
     umami.track('signup-click', { plan: 'pro' });
   };
   </script>
   ```

4. Or use the directive:
   ```vue
   <template>
     <button v-umami="{ event: 'cta-click', data: { location: 'hero' } }">
       Try it now
     </button>
   </template>
   ```

## Runtime Config Notes
- `websiteId` **must** be supplied; otherwise the layer warns and exits quietly.
- `hostUrl` + `scriptPath` let you self-host Umami. By default the public cloud endpoint is used.
- `dataDomains` controls domain filtering as per Umami docs.
- Set `autoTrack: false` if you want to trigger every page view manually via `trackView`.
- Provide `excludedPaths` (array or CSV string) to skip tracking for sensitive routes such as `/login` or `/admin/*`. When exclusions are set, the layer disables Umami's auto-tracking and manually emits page views for allowed routes.

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
`v-umami`
- Value can be a string event name or an object `{ event, data?, trigger? }`.
- `trigger` defaults to `"click"`; `v-umami:mouseover="'event'"` also works.
- Automatically removes listeners when the component unmounts.

## Composable API
`const { track, trackView, isLoaded } = useUmami();`
- `track(event, data?)` – send a custom event.
- `trackView(url?, referrer?)` – track a page view.
- `isLoaded` – `ref<boolean>` indicating whether the tracker script is ready.
- `getInstance()` – access the underlying global Umami object if needed.

## Extending
- You can override the directive by registering another `v-umami` directive in the consuming app.
- The layer exposes `#analytics` alias pointing to its root for custom imports if necessary.

## Caddy routing

@umamijs {
    path /script.js
    path /api/send
}

reverse_proxy @umamijs https://cloud.umami.is {
    # Ensure the Host header is correct
    header_up Host cloud.umami.is
}
