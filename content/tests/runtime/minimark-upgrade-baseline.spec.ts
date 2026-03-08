import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { toHast, fromHast } from 'minimark/hast'
import { visit as minimarkVisit } from 'minimark'
import { HTML_TAGS } from '../../app/components/runtime/content/utils/htmlTags'

type MinimarkNode = string | [string, Record<string, unknown>, ...MinimarkNode[]]

interface FixtureDocument {
  _id: string
  path: string
  body: {
    type: string
    value: MinimarkNode[]
  }
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

const fixtureDir = fileURLToPath(
  new URL('../fixtures/minimark-upgrade', import.meta.url),
)

const FIXTURE_EXPECTATIONS = {
  'rs-index': {
    topLevelTags: [
      'landing',
      'phil',
      'work',
      'work',
      'work',
      'work',
      'work',
      'work',
      'services',
      'contact',
    ],
    customTags: ['contact', 'landing', 'phil', 'services', 'work'],
    visitCount: 60,
  },
  'couchfusion-home': {
    topLevelTags: [
      'home-hero',
      'home-feature-grid',
      'home-foundations',
      'home-quickstart',
      'home-learn-preview',
      'home-community-callout',
      'lightning-donation',
    ],
    customTags: [
      'home-community-callout',
      'home-feature-grid',
      'home-foundations',
      'home-hero',
      'home-learn-preview',
      'home-quickstart',
      'lightning-donation',
    ],
    visitCount: 7,
  },
  'bitvocation-survey-2024': {
    topLevelTags: ['survey-form'],
    customTags: ['survey-form'],
    visitCount: 1,
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

const collectTopLevelTags = (tree: MinimarkNode[]): string[] =>
  tree
    .filter(
      (node): node is [string, Record<string, unknown>, ...MinimarkNode[]] =>
        Array.isArray(node) && typeof node[0] === 'string',
    )
    .map((node) => node[0])

const collectCustomTags = (tree: MinimarkNode[]): string[] => {
  const custom = new Set<string>()
  const walk = (node: MinimarkNode) => {
    if (typeof node === 'string' || !Array.isArray(node)) {
      return
    }

    const tag = node[0]
    if (typeof tag === 'string') {
      const normalizedTag = tag.toLowerCase()
      if (!HTML_TAGS.has(normalizedTag)) {
        custom.add(normalizedTag)
      }
    }

    for (let index = 2; index < node.length; index += 1) {
      walk(node[index])
    }
  }

  tree.forEach((node) => walk(node))
  return Array.from(custom).sort()
}

describe('minimark upgrade baseline fixtures', () => {
  for (const fixtureName of fixtureNames) {
    it(`${fixtureName}: keeps tree structure and traversal behavior stable`, () => {
      const fixture = loadFixture(fixtureName)
      const expected = FIXTURE_EXPECTATIONS[fixtureName]
      const minimarkTree = {
        type: 'minimark' as const,
        value: clone(fixture.document.body.value),
      }

      expect(fixture.document.body.type).toBe('minimal')
      expect(collectTopLevelTags(minimarkTree.value)).toEqual(expected.topLevelTags)
      expect(collectCustomTags(minimarkTree.value)).toEqual(expected.customTags)

      const hast = toHast(minimarkTree)
      expect(hast.type).toBe('root')
      expect(Array.isArray(hast.children)).toBe(true)
      expect(hast.children.length).toBe(expected.topLevelTags.length)

      const roundtrip = fromHast(hast)
      expect(roundtrip.type).toBe('minimark')
      expect(roundtrip.value).toEqual(minimarkTree.value)

      let visitedCount = 0
      minimarkVisit(
        { type: 'minimark', value: minimarkTree.value },
        () => true,
        () => {
          visitedCount += 1
          return undefined
        },
      )
      expect(visitedCount).toBe(expected.visitCount)
    })
  }

  it('rs-index: visit replacement for text nodes remains functional', () => {
    const fixture = loadFixture('rs-index')
    const tree = {
      type: 'minimark' as const,
      value: clone(fixture.document.body.value),
    }

    let replacements = 0

    minimarkVisit(
      { type: 'minimark', value: tree.value },
      (node) => typeof node === 'string' && node.includes('software'),
      (node) => {
        replacements += 1
        return typeof node === 'string'
          ? node.replace(/software/g, 'software✅')
          : node
      },
    )

    expect(replacements).toBeGreaterThan(0)

    const serialized = JSON.stringify(tree.value)
    expect(serialized).toContain('software✅')
  })
})
