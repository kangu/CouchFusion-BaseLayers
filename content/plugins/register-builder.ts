/*
* This is needed for NuxtJS3 to be able to import the plugins
* */

import BuilderWorkbench from '../app/components/builder/Workbench.vue'
import ContentAdminWorkbench from '../app/components/admin/ContentAdminWorkbench.vue'
import ContentRichTextField from '../app/components/admin/ContentRichTextField.vue'
// ContentRichTextField: () => import("../components/admin/ContentRichTextField.vue"),

export default defineNuxtPlugin(({ vueApp }) => {
  vueApp.component('BuilderWorkbench', BuilderWorkbench)
  vueApp.component('ContentAdminWorkbench', ContentAdminWorkbench)
  vueApp.component('ContentRichTextField', ContentRichTextField)
})
