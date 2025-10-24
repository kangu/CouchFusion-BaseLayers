# Content Admin Workbench Tailwind Removal

## Initial Prompt
```
Rework the layers/content/app/components/admin/ContentAdminWorkbench.vue to not depend at all on tailwindcss, yet its default style should be the exact tailwindcss classes it has now, but inlined with actual values in the css <style> section. The end result is for the radustanciu app to render the /builder page correctly with styles in it independent of tailwindcss
```

## Implementation Summary
Implementation Summary: Replaced Tailwind utility usage in ContentAdminWorkbench with scoped BEM-style classes and explicit CSS tokens so the workbench renders identically without Tailwind.

## Documentation Overview
- Replaced Tailwind utility strings in the workbench template with purpose-specific classes that preserve existing UI override hooks.
- Added scoped button, chip, icon, and spinner styles that mirror the Tailwind tokens (spacing, colors, focus rings, transitions) directly in CSS.
- Applied root layout spacing and updated chip state modifiers so the builder index continues to reflect active selection and hover feedback.

## Implementation Examples
```vue
<button
  class="content-admin-workbench__button content-admin-workbench__button--primary"
  :class="ui.saveButton"
>
  <svg class="content-admin-workbench__icon content-admin-workbench__icon--sm content-admin-workbench__spinner" />
  <span>Save Changes</span>
</button>
```

```css
.content-admin-workbench__chip--active {
  border-color: #3b82f6;
  background-color: #eff6ff;
  color: #2563eb;
  box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
}
```
