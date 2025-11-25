export default defineNuxtPlugin(({ vueApp }) => {
  // Register content-builder/admin components lazily so heavy editor/builder code
  // does not inflate the main bundle.
  const components = {
    BuilderWorkbench: () => import("../components/builder/Workbench.vue"),
    ContentAdminWorkbench: () => import("../components/admin/ContentAdminWorkbench.vue"),
    ContentImageField: () => import("../components/admin/ContentImageField.vue"),
    ContentRichTextField: () => import("../components/admin/ContentRichTextField.vue"),
  };

  for (const [name, loader] of Object.entries(components)) {
    vueApp.component(name, defineAsyncComponent(loader));
  }
});
