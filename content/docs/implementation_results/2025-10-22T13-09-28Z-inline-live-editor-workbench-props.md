# Inline Live Editor Workbench Props

## Initial Prompt
```
I am implementing a /builder page in the pacanele-loading app. Add the Icon.vue component to the project as it is needed to render icons inside the content editor. Make sure to pass some default styles to the InlineLiveEditor and ContentAdminWorkbench further down to render decent looking styles on the content editor component. See attached screenshot for how it's currently looking [Screenshot 2025-10-22 at 15.57.54.png 1296x2660]
```

## Plan
1. Review pacanele-landing builder setup and content layer components to identify styling extension points.  
2. Implement Icon component/dependency and update builder page with default styling plus UI configuration.  
3. Validate the builder route via Playwright, then capture documentation and implementation results.

## Implementation Summary
Added a `workbench` prop to `InlineLiveEditor` that proxies partial `ContentAdminWorkbench` props, letting host apps supply custom UI class maps and copy while retaining the shared editing workflow.

## Next Steps
1. Consider exposing additional hooks (e.g. sidebar slot) if future apps need to extend the inline editor beyond styling tweaks.  
2. Update downstream documentation to highlight the new prop so other projects can adopt it without spelunking the component.
