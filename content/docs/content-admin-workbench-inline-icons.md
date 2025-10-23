## Initial Prompt
```
The ContentAdminWorkbench.vue component has a dependency on Icon which further depends on @iconify/vue. Refactor the ContentAdminWorkbench.vue component to work without <Icon>, replacing the instances with dropped-in SVG code. Verify succes that at the end the icons in ContentAdminWorkbench.vue are still rendering correctly with or without <Icon> and @iconify/vue in the project.
```

## Implementation Summary
Replaced the Iconify-based tags in ContentAdminWorkbench.vue with inline SVG markup so the workbench renders its controls without requiring @iconify/vue.

## Documentation Overview
- Swapped each `<Icon>` usage in `layers/content/app/components/admin/ContentAdminWorkbench.vue` for hard-coded Material Design SVGs (`plus`, `magnify`, `alert`, `loading`, `trash`, `clock`, `restore`, `close`), ensuring they inherit `currentColor`, respect existing sizing classes, and preserve animations like `animate-spin`.
- Added a fallback spinner path for the save and modal actions so loading states continue to animate even if Iconify is absent.
- Confirmed the component no longer references `<Icon>`, making the admin workbench resilient whether or not `@iconify/vue` is installed.

## Implementation Examples
```vue
<svg
  v-if="isSavePending"
  class="h-4 w-4 animate-spin"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  aria-hidden="true"
>
  <path
    fill="currentColor"
    d="M12 4V2a10 10 0 1 1-10 10h2a8 8 0 1 0 8-8Z"
  />
</svg>
<span>{{ isSavePending ? 'Saving…' : 'Save Changes' }}</span>
```
