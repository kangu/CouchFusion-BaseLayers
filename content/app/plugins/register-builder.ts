import BuilderWorkbench from '../components/builder/Workbench.vue'

export default defineNuxtPlugin(({ vueApp }) => {
  vueApp.component('BuilderWorkbench', BuilderWorkbench)
})
