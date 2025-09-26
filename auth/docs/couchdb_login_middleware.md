    - Create a lightweight state management composable using Vue's reactivity
    - Store authentication state: user data, loading state, error state
    - Provide methods: fetchUser(), logout(), isAuthenticated
    - Use $fetch to call GET /api/login endpoint
    - Handle authentication state persistence across page reloads

    2. Route Guard Middleware (layers/auth/app/middleware/auth.ts)

    - Create Nuxt middleware to protect routes with meta: { auth: true }
    - Use the useAuth composable to check authentication status
    - Redirect to login page if unauthenticated on protected routes
    - Make login page URL configurable via nuxt.config

    3. Auth Plugin (layers/auth/app/plugins/auth.client.ts)

    - Initialize authentication state on app startup
    - Automatically call fetchUser() on app load to restore session
    - Handle authentication state hydration

    4. Update Auth Layer Config (layers/auth/nuxt.config.ts)

    - Enable auto-imports for the new composable and middleware
    - Add default runtime config for login redirect URL
    - Ensure proper registration of middleware

    5. Usage in Bitvocation Demo

    - Add middleware configuration to nuxt.config.ts
    - Create example protected pages with meta: { auth: true }
    - Create a basic login page for redirects

    Key Features:

    - Automatic Session Restore: Checks authentication on app load
    - Route Protection: Guards routes with meta: { auth: true }
    - Configurable Redirects: Login page URL configurable per app
    - Reactive State: Real-time authentication state across components
    - Error Handling: Proper handling of network/auth errors
    - SSR Compatible: Works with server-side rendering

    Integration:

    Apps using the auth layer will automatically get:
    - useAuth() composable available globally
    - auth middleware for protecting routes
    - Automatic session management
    - Configurable login redirect behavior
