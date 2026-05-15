import { defineAsyncComponent } from 'vue'

export default defineNuxtPlugin(({ vueApp }) => {
  const components = {
    BuilderWorkbench: () => import('../app/components/builder/Workbench.vue'),
    ContentAdminWorkbench: () => import('../app/components/admin/ContentAdminWorkbench.vue'),
    ContentRichTextField: () => import('../app/components/admin/ContentRichTextField.vue'),
  }

  for (const [name, loader] of Object.entries(components)) {
    if (!vueApp.component(name)) {
      vueApp.component(name, defineAsyncComponent(loader))
    }
  }
})
