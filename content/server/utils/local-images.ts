import { promises as fs } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'

const ALLOWED_EXTENSIONS = new Set([
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.avif',
    '.bmp'
])

const IMAGES_SUBDIR = 'images'

export const getPublicImagesDir = () => {
    return join(process.cwd(), 'public', IMAGES_SUBDIR)
}

export const ensureImagesDir = async () => {
    const dir = getPublicImagesDir()
    await fs.mkdir(dir, { recursive: true })
    return dir
}

export const sanitizeFileName = (input: string) => {
    const name = basename(input).replace(/[^a-zA-Z0-9.\-_]/g, '_')
    return name.length ? name : `image-${Date.now()}`
}

export const isAllowedImage = (fileName: string) => {
    const ext = extname(fileName).toLowerCase()
    return ALLOWED_EXTENSIONS.has(ext)
}

export const resolveImagePath = (relativePath: string) => {
    const baseDir = getPublicImagesDir()
    const target = resolve(baseDir, relativePath)
    if (!target.startsWith(baseDir)) {
        throw new Error('Invalid image path')
    }
    return target
}

export const toPublicImageUrl = (relativePath: string) => {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
    return `/${IMAGES_SUBDIR}/${normalized}`
}

export type LocalImageEntry = {
    name: string
    filePath: string
    url: string
    size: number
    updatedAt: string
}

export const listLocalImages = async (search?: string) => {
    const dir = await ensureImagesDir()
    const results: LocalImageEntry[] = []
    const stack: Array<{ dir: string; relative: string }> = [{ dir, relative: '' }]
    const loweredSearch = search?.toLowerCase() ?? ''

    while (stack.length) {
        const current = stack.pop()!
        const entries = await fs.readdir(current.dir, { withFileTypes: true })

        for (const entry of entries) {
            if (entry.name.startsWith('.')) {
                continue
            }
            const entryPath = join(current.dir, entry.name)
            const relativePath = current.relative
                ? `${current.relative}/${entry.name}`
                : entry.name

            if (entry.isDirectory()) {
                stack.push({ dir: entryPath, relative: relativePath })
                continue
            }

            if (!isAllowedImage(entry.name)) {
                continue
            }

            if (
                loweredSearch &&
                !relativePath.toLowerCase().includes(loweredSearch)
            ) {
                continue
            }

            const stat = await fs.stat(entryPath)
            results.push({
                name: entry.name,
                filePath: relativePath.replace(/\\/g, '/'),
                url: toPublicImageUrl(relativePath),
                size: stat.size,
                updatedAt: stat.mtime.toISOString()
            })
        }
    }

    results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    return results
}
