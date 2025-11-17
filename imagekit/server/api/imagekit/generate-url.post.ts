import { createError, defineEventHandler, readBody } from 'h3'
import { assertAdminSession } from '#auth/server/utils/assert-admin-session'
import imageKitService from '#imagekit/utils/imagekit'

interface GenerateUrlPayload {
  filePath?: string
  transformations?: Record<string, unknown>
}

export default defineEventHandler(async (event) => {
  await assertAdminSession(event)

  const body = await readBody<GenerateUrlPayload>(event)

  if (!body?.filePath || typeof body.filePath !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'filePath is required',
    })
  }

  const result = imageKitService.generateUrl(body.filePath, body.transformations ?? {})

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
