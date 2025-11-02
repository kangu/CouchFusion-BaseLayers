import { beforeAll, afterAll } from 'vitest'
import { createCouchTestHarness } from '../utils/couchdb'
import { contentDesignDocument } from '../../content/utils/design-documents'

export const contentHarness = createCouchTestHarness({
  namespace: 'content',
  databaseSuffix: 'content',
  designDocuments: [contentDesignDocument],
})

beforeAll(async () => {
  const context = await contentHarness.setup()
  process.env.NUXT_DB_LOGIN_PREFIX = context.loginPrefix
})

afterAll(async () => {
  await contentHarness.teardown()
})

export const getContentTestContext = () => contentHarness.getContext()
