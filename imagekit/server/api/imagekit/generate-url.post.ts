import { createError, defineEventHandler, readBody } from 'h3'
import { assertImagekitSession } from '../../utils/assert-imagekit-session'
import { getImageKitService } from '#imagekit/utils/imagekit'

interface GenerateUrlPayload {
  filePath?: string
  transformations?: Record<string, unknown>
}

export default defineEventHandler(async (event) => {
  await assertImagekitSession(event)

  const body = await readBody<GenerateUrlPayload>(event)

  if (!body?.filePath || typeof body.filePath !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'filePath is required',
    })
  }

  const result = getImageKitService().generateUrl(body.filePath, body.transformations ?? {})

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
