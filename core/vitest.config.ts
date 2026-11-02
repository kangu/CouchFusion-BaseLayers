import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', environment: 'node', include: ['tests/unit/**/*.spec.ts'] } },
      { test: { name: 'local', environment: 'node', include: ['tests/local/**/*.spec.ts'], fileParallelism: false, testTimeout: 15000, hookTimeout: 30000 } },
      { test: { name: 'nuxt', environment: 'node', include: ['tests/nuxt/**/*.spec.ts'], fileParallelism: false, testTimeout: 30000, hookTimeout: 60000 } },
    ],
  },
})
