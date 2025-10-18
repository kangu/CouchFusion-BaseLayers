import { promises as fs, Dirent } from 'node:fs'
import { extname, join } from 'node:path'

const PAGE_FILE_EXTENSIONS = new Set(['.vue', '.ts', '.js', '.jsx', '.tsx', '.mjs', '.cjs'])

const normalizePrefix = (value: string | null | undefined): string | null => {
    if (!value || typeof value !== 'string') {
        return null
    }

    const trimmed = value.trim()

    if (!trimmed.startsWith('/')) {
        return null
    }

    if (trimmed === '/') {
        return null
    }

    return trimmed.replace(/\/+$/, '')
}

const getPagesDir = (nuxt: any) => {
    const pagesDir = nuxt.options.dir?.pages || 'pages'
    return join(nuxt.options.srcDir, pagesDir)
}

const collectStaticPagePrefixes = async (directory: string): Promise<string[]> => {
    let entries: Dirent[]
    try {
        entries = await fs.readdir(directory, { withFileTypes: true })
    } catch (error: any) {
        if (error?.code === 'ENOENT') {
            return []
        }

        console.warn('[content-layer] Failed to read pages directory:', error)
        return []
    }

    const prefixes = new Set<string>()

    for (const entry of entries) {
        const name = entry.name

        if (!name || name.startsWith('_') || name.startsWith('[') || name.startsWith('.')) {
            continue
        }

        if (entry.isDirectory()) {
            prefixes.add(`/${name}`)
            continue
        }

        if (!entry.isFile()) {
            continue
        }

        const extension = extname(name)
        if (!PAGE_FILE_EXTENSIONS.has(extension)) {
            continue
        }

        const base = name.slice(0, -extension.length)
        if (!base || base === 'index' || base.startsWith('[') || base === 'error') {
            continue
        }

        prefixes.add(`/${base}`)
    }

    return Array.from(prefixes)
}

export default async function contentLayerIgnoredPrefixesModule(_moduleOptions: any, nuxt: any) {
    nuxt.options.appConfig = nuxt.options.appConfig || {}
    const contentConfig = nuxt.options.appConfig.content || {}

    const pagesDir = getPagesDir(nuxt)
    const autoPrefixes = await collectStaticPagePrefixes(pagesDir)

    const manualPrefixesInput = Array.isArray(contentConfig.manualIgnoredPrefixes)
        ? contentConfig.manualIgnoredPrefixes
        : []

    const manualNormalised = manualPrefixesInput
        .map((prefix) => normalizePrefix(prefix))
        .filter((value): value is string => Boolean(value))

    const autoNormalised = autoPrefixes
        .map((prefix) => normalizePrefix(prefix))
        .filter((value): value is string => Boolean(value))

    const merged = Array.from(
        new Set<string>([...autoNormalised, ...manualNormalised])
    ).sort((a, b) => a.localeCompare(b))

    nuxt.options.appConfig.content = {
        ...contentConfig,
        autoIgnoredPrefixes: autoNormalised,
        manualIgnoredPrefixes: manualNormalised,
        ignoredPrefixes: merged
    }
}
