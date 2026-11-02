import { createError, defineEventHandler, readBody } from 'h3'
import { requireContentEditorSession } from '../../../utils/auth'
import {
  setContentPagePublicationState,
  type ContentPagePublicationInput,
} from '../../../utils/content-page-publication'

export default defineEventHandler(async (event) => {
  await requireContentEditorSession(event)

  try {
    const body = await readBody<ContentPagePublicationInput>(event)
    return await setContentPagePublicationState(body)
  } catch (error: any) {
    if (error?.statusCode) {
      throw error
    }

    console.error('Content publication state PATCH error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update publication state',
    })
  }
})
