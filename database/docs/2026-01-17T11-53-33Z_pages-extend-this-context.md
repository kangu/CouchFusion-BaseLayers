## Initial Prompt
I get this error - apps/bitvocation/app/components/content
Cannot start nuxt: TypeError: Cannot read properties of undefined (reading 'options')
    at pages:extend (/Users/radu/Projects/nuxt-apps/layers/database/nuxt.config.ts:31:12)

## Implementation Summary
Implementation Summary: Fixed the database layer pages:extend hook to use the Nuxt hook context (`this.options`) instead of an undefined parameter, preventing startup crashes.

## Documentation Overview
- The hook now uses a function expression so Nuxt binds `this` to the build context, allowing access to `appConfig`.

## Implementation Examples
```ts
hooks: {
  'pages:extend': function (pages) {
    const adminLayout = this.options.appConfig?.uiNavigation?.adminLayout || 'default'
    // ...apply layout meta
  },
},
```
