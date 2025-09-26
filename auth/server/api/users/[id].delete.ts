import { defineEventHandler, createError } from 'h3'
import { getDocument, putDocument } from '#database/utils/couchdb'

type CouchUserDocument = Record<string, unknown> & {
  _id: string
  _rev?: string
}

/**
 * Soft deletes a user document from CouchDB _users database.
 */
export default defineEventHandler(async (event) => {
  const params = event.context.params || {}
  const encodedId = params.id

  if (!encodedId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User document id is required'
    })
  }

  const documentId = decodeURIComponent(encodedId)
  const existingDocument = await getDocument<CouchUserDocument>('_users', documentId)

  if (!existingDocument || !existingDocument._rev) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User document not found'
    })
  }

  const deletionDocument: CouchUserDocument & { _deleted: true } = {
    _id: existingDocument._id,
    _rev: existingDocument._rev,
    _deleted: true
  }

  await putDocument('_users', deletionDocument)

  return {
    success: true,
    id: documentId
  }
})
