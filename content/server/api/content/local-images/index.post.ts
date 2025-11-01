import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { promises as fs } from 'node:fs'
import { join, parse } from 'node:path'
import { requireAuthRoleSession } from '../../../utils/auth'
import {
    ensureImagesDir,
    isAllowedImage,
    sanitizeFileName,
    toPublicImageUrl,
    type LocalImageEntry
} from '../../../utils/local-images'

const fileExists = async (path: string) => {
    try {
        await fs.access(path)
        return true
    } catch {
        return false
    }
}

const buildUniqueFileName = async (directory: string, originalName: string) => {
    const sanitized = sanitizeFileName(originalName)
    if (!isAllowedImage(sanitized)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Unsupported image type'
        })
    }

    const { name, ext } = parse(sanitized)
    let candidate = sanitized
    let counter = 1

    while (await fileExists(join(directory, candidate))) {
        candidate = `${name}-${counter}${ext}`
        counter += 1
    }

    return candidate
}

export default defineEventHandler(async (event) => {
    await requireAuthRoleSession(event)
    const form = await readMultipartFormData(event)

    if (!form || !form.length) {
        throw createError({
            statusCode: 400,
            statusMessage: 'No form data received'
        })
    }

    const filePart = form.find((part) => part.name === 'file' && part.filename)

    if (!filePart || !filePart.data || !filePart.filename) {
        throw createError({
            statusCode: 400,
            statusMessage: 'File upload is required'
        })
    }

    const imagesDir = await ensureImagesDir()
    const uniqueName = await buildUniqueFileName(imagesDir, filePart.filename)
    const targetPath = join(imagesDir, uniqueName)

    await fs.writeFile(targetPath, filePart.data)
    const stat = await fs.stat(targetPath)

    const entry: LocalImageEntry = {
        name: uniqueName,
        filePath: uniqueName,
        url: toPublicImageUrl(uniqueName),
        size: stat.size,
        updatedAt: stat.mtime.toISOString()
    }

    return {
        success: true,
        image: entry
    }
})
