import { createError, defineEventHandler, getRouterParam } from 'h3'
import { assertImagekitSession } from '../../../utils/assert-imagekit-session'
import imageKitService from '#imagekit/utils/imagekit'

export default defineEventHandler(async (event) => {
  await assertImagekitSession(event)

  const fileId = getRouterParam(event, 'fileId')

  if (!fileId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'fileId is required',
    })
  }

  const result = await imageKitService.deleteFile(fileId)

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    }
  }

  return {
    success: true,
    data: true,
  }
})
