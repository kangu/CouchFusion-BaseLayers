# Initial Prompt
I want on the /organizer/meetups page to give access to users that have the "organizer" role. Currently the page is guarded through an admin-auth middleware from the auth layer. I would like a build a more generic middleware to which I can pass in a custom set of roles that so at least one of them needs to match on the user doc for the page to be allowed. Can I use parameters to the middleware definition here? definePageMeta({
  layout: 'members',
  middleware: ['admin-auth']
}) Are there other ways to implement this? Reusability and minimal code is a key factor

# Implementation Summary
Added generic role-auth middleware in the auth layer that loads the session on demand and checks meta-defined allowed roles (defaulting to admin), and updated the organizer meetups page to allow admin or organizer via authAllowedRoles meta.

# Documentation Overview
- Introduced `app/middleware/role_auth.ts` in the auth layer. It fetches the current session if missing, reads `authAllowedRoles` from route meta (defaulting to `['admin']`), and allows navigation when at least one role matches the logged-in user; otherwise it returns a 404.
- The middleware mirrors the existing `admin_auth` flow but is configurable per page, enabling shared role checks without duplicating logic.

# Implementation Examples
- Page meta allowing admins or organizers:
  ```ts
  definePageMeta({
    layout: 'members',
    middleware: ['role-auth'],
    authAllowedRoles: ['admin', 'organizer']
  })
  ```
- Default behavior (only admins) when `authAllowedRoles` is omitted:
  ```ts
  definePageMeta({
    middleware: ['role-auth']
  })
  ```
