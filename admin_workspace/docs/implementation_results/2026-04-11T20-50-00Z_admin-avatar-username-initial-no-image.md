# Admin Header Avatar: Username Initial (No Image URL)

## Scope
- Layer: `layers/admin_workspace`
- File: `app/layouts/admin-workspace.vue`

## Change
- Removed avatar image URL usage in the admin header profile trigger.
- Removed `userAvatar` computed (which used `user.profile.avatar` and `avatarVersion`).
- Kept and tightened `userInitial` to derive from logged-in username (`user.name`), uppercase first character.
- Profile trigger now always renders a circular initial badge.

## Outcome
- Any prior URL like `https://ik.imagekit.io/bitvocation/avatars/radu?v=...` is no longer used by this admin layout.
- Fallback visual is now the default visual.

## Verification
- `cd apps/nuxt-app-starter && npx nuxi prepare` passed.
