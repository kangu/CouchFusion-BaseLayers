import { createError, defineEventHandler, readMultipartFormData } from 'h3'
import { useRuntimeConfig } from '#imports'
import { assertAdminSession } from '#auth/server/utils/assert-admin-session'
import imageKitService from '#imagekit/utils/imagekit'

const MAX_IMAGE_BYTES = 15 * 1024 * 1024 // 15MB ceiling for uploads

const normalizeFolderName = (value?: string | null): string | undefined => {
  if (!value) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed ? trimmed.replace(/^\/+/, '') : undefined
}

export default defineEventHandler(async (event) => {
  await assertAdminSession(event)
  const runtimeConfig = useRuntimeConfig()
  const defaultFolder =
    normalizeFolderName(runtimeConfig.imagekit?.folder) ??
    normalizeFolderName(runtimeConfig.public?.imagekit?.folder)

  const formData = await readMultipartFormData(event)

  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file uploaded',
    })
  }

  const filePart = formData.find((part) => Boolean(part.filename && part.data))

  if (!filePart || !filePart.filename || !filePart.data) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid upload payload',
    })
  }

  if (filePart.type && !filePart.type.startsWith('image/')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Only image uploads are supported',
    })
  }

  if (filePart.data.length > MAX_IMAGE_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Image exceeds maximum size (15MB)',
    })
  }

  const resolveTextField = (fieldName: string): string | undefined => {
    const entry = formData.find((part) => part.name === fieldName && !part.filename)
    if (!entry?.data) {
      return undefined
    }
    return entry.data.toString('utf-8') || undefined
  }

  const requestedFileName = resolveTextField('fileName')
  const requestedFolder = resolveTextField('folder')

  const safeFileName = (requestedFileName || filePart.filename).replace(/[^a-zA-Z0-9._-]/g, '_')
  const folder = normalizeFolderName(requestedFolder) ?? defaultFolder ?? 'content-editor'

  const result = await imageKitService.uploadFile(filePart.data, safeFileName, folder)

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    }
  }

  return {
    success: true,
    data: result.data,
  }
})
