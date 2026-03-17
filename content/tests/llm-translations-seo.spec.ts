import { describe, expect, it } from 'vitest'
import type { MinimalContentDocument } from '#content/app/utils/contentBuilder'
import {
  SEO_DESCRIPTION_POINTER,
  SEO_TITLE_POINTER,
  applyTranslationsToSeo,
  collectPageSeoEntries,
  readTranslationTargetText,
  splitTranslationsByPointer,
} from '../server/api/content/llm-translations/translate.post'

const createMinimalDocument = (): MinimalContentDocument => ({
  id: 'page-/index',
  path: '/',
  title: 'Home',
  body: {
    type: 'minimal',
    value: [['landing', { headlinePrefix: 'Hello world' }]],
  },
  seo: {
    title: 'SEO Title',
    description: 'SEO Description',
    image: null,
  },
  meta: {},
  navigation: true,
  extension: 'md',
  stem: 'index',
})

describe('llm translations page seo helpers', () => {
  it('collects seo entries only in page scope', () => {
    const document = createMinimalDocument()

    const pageEntries = collectPageSeoEntries(document, 'page', null)
    const sectionEntries = collectPageSeoEntries(document, 'section', null)
    const fieldTitleEntries = collectPageSeoEntries(
      document,
      'field',
      SEO_TITLE_POINTER,
    )
    const fieldDescriptionEntries = collectPageSeoEntries(
      document,
      'field',
      SEO_DESCRIPTION_POINTER,
    )
    const fieldOtherEntries = collectPageSeoEntries(document, 'field', '/0/1/title')

    expect(pageEntries).toEqual([
      { pointer: SEO_TITLE_POINTER, text: 'SEO Title' },
      { pointer: SEO_DESCRIPTION_POINTER, text: 'SEO Description' },
    ])
    expect(sectionEntries).toEqual([])
    expect(fieldTitleEntries).toEqual([
      { pointer: SEO_TITLE_POINTER, text: 'SEO Title' },
    ])
    expect(fieldDescriptionEntries).toEqual([
      { pointer: SEO_DESCRIPTION_POINTER, text: 'SEO Description' },
    ])
    expect(fieldOtherEntries).toEqual([])
  })

  it('reads target text from seo pointers and body pointers', () => {
    const document = createMinimalDocument()

    expect(readTranslationTargetText(document, SEO_TITLE_POINTER)).toBe('SEO Title')
    expect(readTranslationTargetText(document, SEO_DESCRIPTION_POINTER)).toBe('SEO Description')
    expect(readTranslationTargetText(document, '/0/1/headlinePrefix')).toBe('Hello world')
  })

  it('splits translations by seo and body pointers', () => {
    const split = splitTranslationsByPointer({
      [SEO_TITLE_POINTER]: 'Titlu SEO',
      '/0/1/headlinePrefix': 'Salut lume',
      [SEO_DESCRIPTION_POINTER]: 'Descriere SEO',
    })

    expect(split.seoTranslations).toEqual({
      [SEO_TITLE_POINTER]: 'Titlu SEO',
      [SEO_DESCRIPTION_POINTER]: 'Descriere SEO',
    })
    expect(split.bodyTranslations).toEqual({
      '/0/1/headlinePrefix': 'Salut lume',
    })
  })

  it('applies seo translations with overwrite mode all', () => {
    const document = createMinimalDocument()

    const applied = applyTranslationsToSeo(
      document,
      {
        [SEO_TITLE_POINTER]: 'Titlu SEO',
        [SEO_DESCRIPTION_POINTER]: 'Descriere SEO',
      },
      'all',
    )

    expect(applied).toEqual({
      appliedCount: 2,
      skippedCount: 0,
    })
    expect(document.seo.title).toBe('Titlu SEO')
    expect(document.seo.description).toBe('Descriere SEO')
  })

  it('applies seo translations with overwrite mode missing', () => {
    const document = createMinimalDocument()
    document.seo.description = '  '

    const applied = applyTranslationsToSeo(
      document,
      {
        [SEO_TITLE_POINTER]: 'Titlu SEO',
        [SEO_DESCRIPTION_POINTER]: 'Descriere SEO',
      },
      'missing',
    )

    expect(applied).toEqual({
      appliedCount: 1,
      skippedCount: 1,
    })
    expect(document.seo.title).toBe('SEO Title')
    expect(document.seo.description).toBe('Descriere SEO')
  })
})
