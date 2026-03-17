import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAllDocs } from '../../database/utils/couchdb'
import { contentHarness, getContentTestContext } from '../../_tests/setup/content'
import { buildContentPageDocument } from '../../_tests/fixtures/content'
import { contentIdFromPath } from '../utils/page-documents'
import { saveLocalizedPageDocument } from '../server/utils/content-pages-save'

const i18nConfig = {
  defaultLocale: 'en',
  locales: ['en', 'fr', 'ro'],
}

const runtimeConfig: any = {
  dbLoginPrefix: '',
  content: {
    i18n: i18nConfig,
  },
  public: {
    content: {
      i18n: i18nConfig,
    },
  },
}

const appConfig = {
  content: {
    i18n: i18nConfig,
  },
}

vi.mock('#imports', () => ({
  useRuntimeConfig: () => runtimeConfig,
  useAppConfig: () => appConfig,
}))

;(globalThis as any).useRuntimeConfig = () => runtimeConfig
;(globalThis as any).useAppConfig = () => appConfig

const seedTimestamp = '2026-03-09T06:30:00.000Z'
const fixedPointer = '/0/1/globalNotice'

const makeBodyValue = (headline: string, globalNotice: string) => [
  ['landing', { headline, globalNotice }],
]

const readTexts = (document: Record<string, any>) => {
  const entry = Array.isArray(document.body?.value)
    ? document.body.value[0]
    : null
  const props = Array.isArray(entry) && entry[1] && typeof entry[1] === 'object'
    ? entry[1]
    : {}

  return {
    headline: props.headline,
    globalNotice: props.globalNotice,
  }
}

const buildLocalizedDocument = (options: {
  masterId: string
  locale: 'en' | 'fr' | 'ro'
  headline: string
  globalNotice: string
}) => {
  const path = options.locale === 'en' ? '/' : `/${options.locale}`
  const document = buildContentPageDocument({
    path,
    title: 'Home',
    body: makeBodyValue(options.headline, options.globalNotice),
    createdAt: seedTimestamp,
    updatedAt: seedTimestamp,
    meta: {},
  }) as Record<string, any>

  document._id =
    options.locale === 'en'
      ? options.masterId
      : `${options.masterId}::${options.locale}`

  document.meta = {
    contentI18n: {
      version: 1,
      masterId: options.masterId,
      locale: options.locale,
      basePath: '/',
      defaultLocale: 'en',
      fixedBodyPaths: [fixedPointer],
      updatedAtByLocale: {
        en: seedTimestamp,
        fr: seedTimestamp,
        ro: seedTimestamp,
      },
    },
  }

  return document
}

const resetHarness = async () => {
  await contentHarness.teardown()
  const context = await contentHarness.setup()
  runtimeConfig.dbLoginPrefix = context.loginPrefix
}

const getDocsById = async (ids: string[]) => {
  const context = getContentTestContext()
  const response = await getAllDocs(
    context.databaseName,
    { keys: ids, include_docs: true },
    context.config,
  )

  const rows = Array.isArray(response?.rows) ? response.rows : []
  const docsById = new Map<string, Record<string, any>>()

  for (const row of rows) {
    if (row.doc && typeof row.doc._id === 'string') {
      docsById.set(row.doc._id, row.doc as Record<string, any>)
    }
  }

  return docsById
}

describe('saveLocalizedPageDocument i18n persistence behavior', () => {
  beforeEach(async () => {
    await resetHarness()
  })

  it('does not persist untouched sibling locales or master on locale-only changes', async () => {
    const masterId = contentIdFromPath('/')
    const master = buildLocalizedDocument({
      masterId,
      locale: 'en',
      headline: 'Hello EN',
      globalNotice: 'Global EN',
    })
    const fr = buildLocalizedDocument({
      masterId,
      locale: 'fr',
      headline: 'Bonjour FR',
      globalNotice: 'Global EN',
    })
    const ro = buildLocalizedDocument({
      masterId,
      locale: 'ro',
      headline: 'Salut RO',
      globalNotice: 'Global EN',
    })

    await contentHarness.seedDocuments([master, fr, ro])

    const frId = `${masterId}::fr`
    const roId = `${masterId}::ro`
    const before = await getDocsById([masterId, frId, roId])

    const frEdit = {
      ...fr,
      path: '/fr',
      body: {
        type: 'minimal',
        value: makeBodyValue('Bonjour FR updated', 'Global EN'),
      },
    }

    await saveLocalizedPageDocument(
      { document: frEdit, locale: 'fr' },
      { isCreate: false },
    )

    const after = await getDocsById([masterId, frId, roId])

    expect(after.get(frId)?._rev).not.toBe(before.get(frId)?._rev)
    expect(after.get(masterId)?._rev).toBe(before.get(masterId)?._rev)
    expect(after.get(roId)?._rev).toBe(before.get(roId)?._rev)

    expect(readTexts(after.get(masterId) as Record<string, any>)).toEqual({
      headline: 'Hello EN',
      globalNotice: 'Global EN',
    })
    expect(readTexts(after.get(roId) as Record<string, any>)).toEqual({
      headline: 'Salut RO',
      globalNotice: 'Global EN',
    })
  })

  it('propagates fixedBodyPaths changes from locale save to master and other locales', async () => {
    const masterId = contentIdFromPath('/')
    const master = buildLocalizedDocument({
      masterId,
      locale: 'en',
      headline: 'Hello EN',
      globalNotice: 'Global EN',
    })
    const fr = buildLocalizedDocument({
      masterId,
      locale: 'fr',
      headline: 'Bonjour FR',
      globalNotice: 'Global EN',
    })
    const ro = buildLocalizedDocument({
      masterId,
      locale: 'ro',
      headline: 'Salut RO',
      globalNotice: 'Global EN',
    })

    await contentHarness.seedDocuments([master, fr, ro])

    const frId = `${masterId}::fr`
    const roId = `${masterId}::ro`
    const before = await getDocsById([masterId, frId, roId])

    const frEdit = {
      ...fr,
      path: '/fr',
      body: {
        type: 'minimal',
        value: makeBodyValue('Bonjour FR updated', 'Global updated from FR'),
      },
    }

    await saveLocalizedPageDocument(
      { document: frEdit, locale: 'fr' },
      { isCreate: false },
    )

    const after = await getDocsById([masterId, frId, roId])

    expect(after.get(frId)?._rev).not.toBe(before.get(frId)?._rev)
    expect(after.get(masterId)?._rev).not.toBe(before.get(masterId)?._rev)
    expect(after.get(roId)?._rev).not.toBe(before.get(roId)?._rev)

    expect(readTexts(after.get(masterId) as Record<string, any>)).toEqual({
      headline: 'Hello EN',
      globalNotice: 'Global updated from FR',
    })
    expect(readTexts(after.get(roId) as Record<string, any>)).toEqual({
      headline: 'Salut RO',
      globalNotice: 'Global updated from FR',
    })
  })
})
