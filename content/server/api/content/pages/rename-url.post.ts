import { createError, defineEventHandler, readBody } from 'h3'
import { requireContentEditorSession } from '../../../utils/auth'
import {
  renameContentPageUrl,
  type ContentPageUrlRenameInput,
} from '../../../utils/content-page-url-rename'

export default defineEventHandler(async (event) => {
  await requireContentEditorSession(event)
  const body = await readBody<Partial<ContentPageUrlRenameInput>>(event)

  if (!body || typeof body.sourcePath !== 'string' || typeof body.targetPath !== 'string' || typeof body.keepRedirect !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'sourcePath, targetPath, and keepRedirect are required' })
  }

  return {
    success: true,
    ...(await renameContentPageUrl(body as ContentPageUrlRenameInput)),
  }
})
