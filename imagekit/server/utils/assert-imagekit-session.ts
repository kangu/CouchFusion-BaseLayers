import { createError, type H3Event } from 'h3'
import { requireAuthenticatedUser } from '#auth/server/utils/authenticated-user'

const IMAGEKIT_ALLOWED_ROLES = ['admin', 'curator', 'organizer'] as const

export const assertImagekitSession = async (event: H3Event) => {
  const userContext = await requireAuthenticatedUser(event)
  const sessionRoles = Array.isArray(userContext.session.userCtx.roles)
    ? userContext.session.userCtx.roles
    : []
  const hasAccess = IMAGEKIT_ALLOWED_ROLES.some((role) => sessionRoles.includes(role))

  if (!hasAccess) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not found',
    })
  }

  return userContext
}

export type AssertedImagekitSession = Awaited<ReturnType<typeof assertImagekitSession>>
