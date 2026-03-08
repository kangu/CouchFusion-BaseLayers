export const useRoute = () => {
  const resolver = (globalThis as any).useRoute
  if (typeof resolver === 'function') {
    return resolver()
  }

  return { path: '/' }
}

export const useRuntimeConfig = () => {
  const resolver = (globalThis as any).useRuntimeConfig
  if (typeof resolver === 'function') {
    return resolver()
  }

  return {}
}
