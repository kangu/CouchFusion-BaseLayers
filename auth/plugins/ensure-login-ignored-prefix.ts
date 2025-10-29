import { defineNuxtPlugin, useRuntimeConfig, useAppConfig } from '#imports'

const normaliseLoginPath = (value: string | null | undefined): string | null => {
    if (!value || typeof value !== 'string') {
        return null
    }

    let resolved = value.trim()
    if (!resolved) {
        return null
    }

    if (!resolved.startsWith('/')) {
        resolved = `/${resolved}`
    }

    if (resolved === '/') {
        return null
    }

    return resolved.replace(/\/+$/, '')
}

const appendUnique = (target: any, key: string, loginPath: string) => {
    if (!target) {
        return
    }

    const current = target[key]

    if (Array.isArray(current)) {
        if (!current.includes(loginPath)) {
            current.push(loginPath)
        }
        return
    }

    target[key] = [loginPath]
}

export default defineNuxtPlugin(() => {
    const runtimeConfig = useRuntimeConfig()
    const appConfig = useAppConfig()

    const loginPath =
        normaliseLoginPath(runtimeConfig.public?.authLoginPath) ??
        '/login'

    const contentConfig = appConfig.content ?? (appConfig.content = {})

    appendUnique(contentConfig, 'manualIgnoredPrefixes', loginPath)
    appendUnique(contentConfig, 'manualPrefixes', loginPath)
    appendUnique(contentConfig, 'ignoredPrefixes', loginPath)
})
