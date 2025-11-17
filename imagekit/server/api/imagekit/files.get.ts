import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { useRuntimeConfig } from '#imports'
import { assertAdminSession } from '#auth/server/utils/assert-admin-session'
import imageKitService from '#imagekit/utils/imagekit'

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
  const defaultPath =
    normalizeFolderName(runtimeConfig.imagekit?.folder) ??
    normalizeFolderName(runtimeConfig.public?.imagekit?.folder)

  setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  setResponseHeader(event, 'Pragma', 'no-cache')
  setResponseHeader(event, 'Expires', '0')

  const query = getQuery(event)

  const parseInteger = (value: unknown) => {
    if (typeof value !== 'string') {
      return undefined
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const skip = parseInteger(query.skip)
  const limit = parseInteger(query.limit)
  const searchQuery = typeof query.searchQuery === 'string' ? query.searchQuery : undefined
  const path =
    normalizeFolderName(typeof query.path === 'string' ? query.path : undefined) ?? defaultPath
  const sort = typeof query.sort === 'string' ? query.sort : undefined
  const tags =
    typeof query.tags === 'string'
      ? query.tags
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : undefined

  const result = await imageKitService.listFiles({
    skip,
    limit,
    searchQuery,
    path,
    sort,
    tags,
  })

  return result
})
