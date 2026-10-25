import { fileURLToPath } from 'node:url'
export default defineNuxtConfig({
  modules: [fileURLToPath(new URL('./module', import.meta.url))],
})
