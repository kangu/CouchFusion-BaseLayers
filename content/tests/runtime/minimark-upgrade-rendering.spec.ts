/** @vitest-environment jsdom */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ContentDocument from '../../app/components/runtime/content/Content.vue'
import { HTML_TAGS } from '../../app/components/runtime/content/utils/htmlTags'

type MinimarkNode = string | [string, Record<string, unknown>, ...MinimarkNode[]]

interface FixtureDocument {
  _id: string
  path: string
  body: {
    type: string
    value: MinimarkNode[]
  }
  meta?: Record<string, unknown> | null
}

interface FixturePayload {
  capturedAt: string
  source: {
    name: string
    database: string
    id: string
    url: string
  }
  document: FixtureDocument
}

interface RenderCapture {
  tag: string
  attrs: Record<string, unknown>
  slotNames: string[]
}

const resolveFixtureDir = (): string => {
  const candidates = [
    resolve(process.cwd(), 'content/tests/fixtures/minimark-upgrade'),
    resolve(process.cwd(), 'layers/content/tests/fixtures/minimark-upgrade'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Unable to resolve minimark fixture directory. Checked: ${candidates.join(', ')}`,
  )
}

const fixtureDir = resolveFixtureDir()

const FIXTURE_EXPECTATIONS = {
  'rs-index': {
    topLevelCounts: {
      landing: 1,
      phil: 1,
      work: 6,
      services: 1,
      contact: 1,
    },
    slotTextSamples: ['This is where I heal my hurts', 'Yo that\'s quite nice'],
  },
  'couchfusion-home': {
    topLevelCounts: {
      'home-hero': 1,
      'home-feature-grid': 1,
      'home-foundations': 1,
      'home-quickstart': 1,
      'home-learn-preview': 1,
      'home-community-callout': 1,
      'lightning-donation': 1,
    },
    slotTextSamples: [],
  },
  'bitvocation-survey-2024': {
    topLevelCounts: {
      'survey-form': 1,
    },
    slotTextSamples: [],
  },
} as const

const fixtureNames = Object.keys(FIXTURE_EXPECTATIONS) as Array<
  keyof typeof FIXTURE_EXPECTATIONS
>

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const loadFixture = (name: string): FixturePayload => {
  const fixturePath = resolve(fixtureDir, `${name}.json`)
  return JSON.parse(readFileSync(fixturePath, 'utf8')) as FixturePayload
}

const collectCustomTags = (tree: MinimarkNode[]): string[] => {
  const tags = new Set<string>()

  const walk = (node: MinimarkNode) => {
    if (typeof node === 'string' || !Array.isArray(node)) {
      return
    }

    const tag = String(node[0] ?? '').toLowerCase()
    if (tag.length > 0 && !HTML_TAGS.has(tag)) {
      tags.add(tag)
    }

    for (let index = 2; index < node.length; index += 1) {
      walk(node[index])
    }
  }

  tree.forEach((node) => walk(node))
  return Array.from(tags).sort((a, b) => a.localeCompare(b))
}

const setupNuxtRuntimeStubs = (path: string) => {
  const i18nConfig = {
    defaultLocale: 'en',
    locales: ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'zh', 'ro'],
  }

  ;(globalThis as any).useRoute = () => ({ path })
  ;(globalThis as any).useRuntimeConfig = () => ({
    dbLoginPrefix: 'test-minimark-upgrade',
    content: { i18n: i18nConfig },
    public: { content: { i18n: i18nConfig } },
  })
  ;(globalThis as any).useAppConfig = () => ({ content: {} })
}

const buildProxyComponents = (tags: string[], captures: RenderCapture[]) => {
  const components: Record<string, unknown> = {}

  for (const tag of tags) {
    components[tag] = defineComponent({
      name: `Proxy${tag.replace(/[^a-zA-Z0-9]/g, '_')}`,
      inheritAttrs: false,
      setup(_props, { attrs, slots }) {
        captures.push({
          tag,
          attrs: clone(attrs),
          slotNames: Object.keys(slots).sort((a, b) => a.localeCompare(b)),
        })

        return () => {
          const nodes: unknown[] = []

          for (const [slotName, slotRenderer] of Object.entries(slots)) {
            const rendered = slotRenderer?.() ?? []
            if (slotName === 'default') {
              nodes.push(...rendered)
              continue
            }

            nodes.push(
              h(
                'div',
                {
                  'data-mm-slot': slotName,
                  'data-mm-parent-tag': tag,
                },
                rendered,
              ),
            )
          }

          return h(
            'section',
            {
              'data-mm-proxy': tag,
            },
            nodes,
          )
        }
      },
    })
  }

  return components
}

const findCapture = (captures: RenderCapture[], tag: string): RenderCapture => {
  const matched = captures.find((entry) => entry.tag === tag)
  if (!matched) {
    throw new Error(`Missing render capture for tag: ${tag}`)
  }
  return matched
}

describe('minimark upgrade rendering regressions', () => {
  for (const fixtureName of fixtureNames) {
    it(`${fixtureName}: renders top-level custom tags and slot content`, async () => {
      const fixture = loadFixture(fixtureName)
      const expected = FIXTURE_EXPECTATIONS[fixtureName]
      const captures: RenderCapture[] = []
      const customTags = collectCustomTags(fixture.document.body.value)
      const components = buildProxyComponents(customTags, captures)

      setupNuxtRuntimeStubs(fixture.document.path)

      const wrapper = mount(ContentDocument, {
        props: {
          value: {
            id: fixture.document._id,
            path: fixture.document.path,
            body: clone(fixture.document.body),
            meta: clone(fixture.document.meta ?? {}),
          },
          components,
        },
      })

      await flushPromises()

      const expectedTotal = Object.values(expected.topLevelCounts).reduce(
        (sum, count) => sum + count,
        0,
      )

      const renderedTopLevel = wrapper.findAll('[data-mm-proxy]')
      expect(renderedTopLevel.length).toBe(expectedTotal)

      for (const [tag, count] of Object.entries(expected.topLevelCounts)) {
        expect(wrapper.findAll(`[data-mm-proxy="${tag}"]`).length).toBe(count)
      }

      for (const sample of expected.slotTextSamples) {
        expect(wrapper.text()).toContain(sample)
      }
    })

    it(`${fixtureName}: supports SSR rendering with custom component mapping`, async () => {
      const fixture = loadFixture(fixtureName)
      const expected = FIXTURE_EXPECTATIONS[fixtureName]
      const captures: RenderCapture[] = []
      const customTags = collectCustomTags(fixture.document.body.value)
      const components = buildProxyComponents(customTags, captures)

      setupNuxtRuntimeStubs(fixture.document.path)

      const app = createSSRApp({
        render: () =>
          h(ContentDocument, {
            value: {
              id: fixture.document._id,
              path: fixture.document.path,
              body: clone(fixture.document.body),
              meta: clone(fixture.document.meta ?? {}),
            },
            components,
          }),
      })

      const html = await renderToString(app)

      const expectedTotal = Object.values(expected.topLevelCounts).reduce(
        (sum, count) => sum + count,
        0,
      )

      const matchCount = html.match(/data-mm-proxy=/g)?.length ?? 0
      expect(matchCount).toBe(expectedTotal)

      const decodedHtml = html
        .replaceAll('&#39;', "'")
        .replaceAll('&quot;', '"')
        .replaceAll('&amp;', '&')

      for (const sample of expected.slotTextSamples) {
        expect(decodedHtml).toContain(sample)
      }
    })
  }

  it('parses bound JSON props into objects/arrays for rs-index landing + phil', async () => {
    const fixture = loadFixture('rs-index')
    const captures: RenderCapture[] = []
    const customTags = collectCustomTags(fixture.document.body.value)
    const components = buildProxyComponents(customTags, captures)

    setupNuxtRuntimeStubs(fixture.document.path)

    mount(ContentDocument, {
      props: {
        value: {
          id: fixture.document._id,
          path: fixture.document.path,
          body: clone(fixture.document.body),
          meta: clone(fixture.document.meta ?? {}),
        },
        components,
      },
    })

    await flushPromises()

    const landing = findCapture(captures, 'landing')
    expect(landing.attrs.primaryButton).toEqual({
      event: 'Get in Touch',
      href: '#contact',
      label: 'Get in touch',
    })
    expect(landing.attrs.secondaryButton).toEqual({
      event: 'See my work',
      href: '#experience',
      label: 'See my work',
    })

    const phil = findCapture(captures, 'phil')
    const toolkit = phil.attrs.coreToolkit as Array<Record<string, unknown>>
    expect(Array.isArray(toolkit)).toBe(true)
    expect(toolkit.length).toBe(6)
    expect(toolkit[0]?.name).toBe('CouchDB')

    const signalSection = phil.attrs.signalSection as Record<string, unknown>
    expect(signalSection?.heading).toBe('About me')
  })

  it('parses bound JSON props for couchfusion and bitvocation fixtures', async () => {
    const couchfusionFixture = loadFixture('couchfusion-home')
    const couchfusionCaptures: RenderCapture[] = []
    const couchfusionComponents = buildProxyComponents(
      collectCustomTags(couchfusionFixture.document.body.value),
      couchfusionCaptures,
    )

    setupNuxtRuntimeStubs(couchfusionFixture.document.path)

    mount(ContentDocument, {
      props: {
        value: {
          id: couchfusionFixture.document._id,
          path: couchfusionFixture.document.path,
          body: clone(couchfusionFixture.document.body),
          meta: clone(couchfusionFixture.document.meta ?? {}),
        },
        components: couchfusionComponents,
      },
    })

    await flushPromises()

    const homeHero = findCapture(couchfusionCaptures, 'home-hero')
    const pillars = homeHero.attrs.pillars as Array<Record<string, unknown>>
    const highlights = homeHero.attrs.highlights as Array<Record<string, unknown>>

    expect(Array.isArray(pillars)).toBe(true)
    expect(pillars.length).toBe(3)
    expect(Array.isArray(highlights)).toBe(true)
    expect(highlights.length).toBe(3)
    expect(homeHero.attrs.flashDuration).toBe(1400)

    const surveyFixture = loadFixture('bitvocation-survey-2024')
    const surveyCaptures: RenderCapture[] = []
    const surveyComponents = buildProxyComponents(
      collectCustomTags(surveyFixture.document.body.value),
      surveyCaptures,
    )

    setupNuxtRuntimeStubs(surveyFixture.document.path)

    mount(ContentDocument, {
      props: {
        value: {
          id: surveyFixture.document._id,
          path: surveyFixture.document.path,
          body: clone(surveyFixture.document.body),
          meta: clone(surveyFixture.document.meta ?? {}),
        },
        components: surveyComponents,
      },
    })

    await flushPromises()

    const survey = findCapture(surveyCaptures, 'survey-form')
    const meta = survey.attrs.meta as Record<string, unknown>
    const sections = survey.attrs.sections as Array<Record<string, unknown>>

    expect(meta.id).toBe('survey-2024')
    expect(meta.collectsEmail).toBe(true)
    expect(Array.isArray(sections)).toBe(true)
    expect(sections.length).toBeGreaterThan(4)
  })
})
