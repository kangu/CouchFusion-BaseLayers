import BuilderWorkbench from '../components/builder/Workbench.vue'
import ContentAdminWorkbench from '../components/admin/ContentAdminWorkbench.vue'

export default defineNuxtPlugin(({ vueApp }) => {
  vueApp.component('BuilderWorkbench', BuilderWorkbench)
  vueApp.component('ContentAdminWorkbench', ContentAdminWorkbench)
})
