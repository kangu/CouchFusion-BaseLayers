import { createError, defineEventHandler, getRequestHeader, getRequestURL, readMultipartFormData } from 'h3'
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

const isUploadDebugEnabled = () => {
    const value = process.env.CONTENT_LOCAL_UPLOAD_DEBUG
    return value === '1' || value === 'true'
}

const logUploadDebug = (message: string, details: Record<string, unknown> = {}) => {
    if (!isUploadDebugEnabled()) {
        return
    }
    console.info('[content/local-images/upload]', message, details)
}

const logUploadError = (message: string, details: Record<string, unknown> = {}) => {
    console.error('[content/local-images/upload]', message, details)
}

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
    const requestInfo = {
        method: event.method,
        url: getRequestURL(event).toString(),
        contentType: getRequestHeader(event, 'content-type') ?? null,
        contentLength: getRequestHeader(event, 'content-length') ?? null,
        userAgent: getRequestHeader(event, 'user-agent') ?? null,
        xForwardedFor: getRequestHeader(event, 'x-forwarded-for') ?? null,
        nodeEnv: process.env.NODE_ENV ?? null,
        cwd: process.cwd()
    }

    try {
        logUploadDebug('request received', requestInfo)
        await requireAuthRoleSession(event)
        logUploadDebug('auth session accepted')

        const form = await readMultipartFormData(event)
        logUploadDebug('multipart parsed', {
            parts: form?.map((part) => ({
                name: part.name ?? null,
                filename: part.filename ?? null,
                type: part.type ?? null,
                size: part.data?.length ?? 0
            })) ?? []
        })

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

        logUploadDebug('writing file', {
            originalName: filePart.filename,
            uniqueName,
            imagesDir,
            targetPath,
            bytes: filePart.data.length
        })

        await fs.writeFile(targetPath, filePart.data)
        const stat = await fs.stat(targetPath)

        const entry: LocalImageEntry = {
            name: uniqueName,
            filePath: uniqueName,
            url: toPublicImageUrl(uniqueName),
            size: stat.size,
            updatedAt: stat.mtime.toISOString()
        }

        logUploadDebug('upload success', {
            filePath: entry.filePath,
            url: entry.url,
            size: entry.size
        })

        return {
            success: true,
            image: entry
        }
    } catch (error: any) {
        logUploadError('upload failed', {
            ...requestInfo,
            errorMessage: error?.message ?? String(error),
            statusCode: error?.statusCode ?? null,
            statusMessage: error?.statusMessage ?? null,
            stack: error?.stack ?? null
        })
        throw error
    }
})
