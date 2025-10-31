# Duplicate Page Workflow

## Initial Prompt
```
Provide a way for a page to be Cloned, alongside the Save Changes and Delete command in the builder workbench. When clicked, provide the same dialog as for Create New Page, but called Duplicate page, overwrite the existing page with the information supplied in the dialog's form field, then persist the final page document to the couchdb, refresh the list of pages from the builder and load the newly created page in the editor for editing.
```

## Implementation Summary
Added a Duplicate workflow in the content admin workbench that reuses the builder's current document, lets editors rewrite metadata via a dedicated modal, persists the cloned page, refreshes the index, and opens the new page for immediate editing.

## Documentation Overview
- Extended `ContentAdminWorkbench` with duplicate-specific state, emits, and helpers that mirror the create flow while pre-filling metadata from the current selection.
- Added a toolbar button and modal labelled “Duplicate Page” so editors can adjust path, title, SEO fields, and meta before cloning a document.
- The duplication handler serialises the live builder document, rewrites identifiers and metadata with the modal values, posts the new document, refreshes the index, and loads the cloned page into the workbench.

## Implementation Examples
```vue
<button
  type="button"
  class="content-admin-workbench__button content-admin-workbench__button--muted"
  :disabled="isDuplicatePending || !selectedSummary"
  @click="showDuplicateModal"
>
  <span>{{ isDuplicatePending ? 'Duplicating…' : 'Duplicate' }}</span>
</button>
```

```ts
const duplicatedMinimal: MinimalContentDocument = {
  ...builder.getSerializedDocument(),
  id: contentIdFromPath(targetPath),
  path: targetPath,
  title: duplicatePageForm.title,
  seo: {
    title: duplicatePageForm.seoTitle || duplicatePageForm.title,
    description: duplicatePageForm.seoDescription || 'SEO description.'
  },
  meta: parsedMeta,
  stem: deriveStem(targetPath)
};

const duplicatedSummary = await contentStore.saveDocument(
  minimalToContentDocument(duplicatedMinimal),
  { method: 'POST' }
);
await openPageForEditing(duplicatedSummary.path, true);
```
