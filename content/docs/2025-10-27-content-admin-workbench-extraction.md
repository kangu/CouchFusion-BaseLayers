## Initial Prompt
Go ahead with the plan, making sure the bitvocation-demo implementation is still functional while using composable/components from the content layer, and also prepare for implementing the content layer and page/content editing into a new app, more specifically "pacanele-landing"

## Implementation Summary
Implementation Summary: Refactored the content layer to ship a reusable ContentAdminWorkbench component with configurable styling hooks, updated the Bitvocation admin content page to consume it, and registered the component globally for upcoming pacanele-landing adoption.

## Documentation Overview
- Introduced `#content/app/components/admin/ContentAdminWorkbench.vue`, a drop-in content editor that encapsulates page selection, history restore, and builder integration with optional callbacks for toast feedback and delete confirmation.
- Added configurable `ui` class hooks and scoped baseline styles so consuming apps inherit a sensible layout while retaining the ability to override brand colours or typography.
- Registered the component through the existing `register-builder` plugin, keeping backwards compatibility with `BuilderWorkbench` and simplifying adoption in Nuxt apps that extend the content layer.
- Captured feedback/event emitters (`save-success`, `delete-success`, etc.) to let hosts bind custom analytics or route transitions without forking the core implementation.

## Implementation Examples
- **Basic Usage**
  ```vue
  <script setup lang="ts">
  const { success, error } = useToast()
  </script>

  <template>
    <ContentAdminWorkbench :feedback="{ success, error }" />
  </template>
  ```

- **Custom Branding**
  ```ts
  const uiConfig = {
    createButton: 'inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
    pageChipActive: 'border-emerald-500 bg-emerald-50 text-emerald-600 shadow-sm',
    modalSaveButton: 'inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2'
  }
  ```

- **Delete Confirmation Override**
  ```vue
  <ContentAdminWorkbench
    :confirm-delete="(page) => openConfirmDialog({ title: `Delete ${page.title}?` })"
    @delete-success="trackDeletion"
  />
  ```
