import { createError, defineEventHandler, getRouterParam } from 'h3'
import { assertAdminSession } from '#auth/server/utils/assert-admin-session'
import imageKitService from '#imagekit/utils/imagekit'

export default defineEventHandler(async (event) => {
  await assertAdminSession(event)

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
