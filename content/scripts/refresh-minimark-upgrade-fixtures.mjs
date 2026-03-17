#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const layerRoot = resolve(scriptDir, '..')
const fixturesDir = resolve(layerRoot, 'tests/fixtures/minimark-upgrade')

const SOURCE_DOCUMENTS = [
  {
    name: 'rs-index',
    database: 'rs--content',
    id: 'page-/index',
    url: 'http://localhost:5984/rs--content/page-%2Findex',
  },
  {
    name: 'couchfusion-home',
    database: 'couchfusion-com--content',
    id: 'page-/',
    url: 'http://localhost:5984/couchfusion-com--content/page-%2F',
  },
  {
    name: 'bitvocation-survey-2024',
    database: 'bv--content',
    id: 'page-/survey-2024',
    url: 'http://localhost:5984/bv--content/page-%2Fsurvey-2024',
  },
]

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const clone = (value) => JSON.parse(JSON.stringify(value))

const sortKeysDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => sortKeysDeep(entry))
  }

  if (!isPlainObject(value)) {
    return value
  }

  return Object.keys(value)
    .sort((a, b) => a.localeCompare(b))
    .reduce((acc, key) => {
      acc[key] = sortKeysDeep(value[key])
      return acc
    }, {})
}

const normalizeDocument = (rawDocument) => {
  if (!isPlainObject(rawDocument)) {
    throw new Error('Document payload is not an object')
  }

  const normalized = {
    _id: typeof rawDocument._id === 'string' ? rawDocument._id : null,
    path: typeof rawDocument.path === 'string' ? rawDocument.path : null,
    title: typeof rawDocument.title === 'string' ? rawDocument.title : null,
    type: typeof rawDocument.type === 'string' ? rawDocument.type : null,
    extension:
      typeof rawDocument.extension === 'string' ? rawDocument.extension : null,
    navigation:
      typeof rawDocument.navigation === 'boolean' ? rawDocument.navigation : null,
    layout: isPlainObject(rawDocument.layout) ? clone(rawDocument.layout) : null,
    seo: isPlainObject(rawDocument.seo) ? clone(rawDocument.seo) : null,
    meta: isPlainObject(rawDocument.meta) ? clone(rawDocument.meta) : null,
    body: {
      type:
        typeof rawDocument.body?.type === 'string' ? rawDocument.body.type : null,
      value: Array.isArray(rawDocument.body?.value) ? clone(rawDocument.body.value) : [],
    },
  }

  if (isPlainObject(normalized.meta?.contentI18n)) {
    delete normalized.meta.contentI18n.updatedAtByLocale
  }

  return sortKeysDeep(normalized)
}

const writeFixture = async (source, payload) => {
  const filePath = resolve(fixturesDir, `${source.name}.json`)
  const data = `${JSON.stringify(payload, null, 2)}\n`
  await writeFile(filePath, data, 'utf8')
  return filePath
}

const run = async () => {
  await mkdir(fixturesDir, { recursive: true })

  const capturedAt = new Date().toISOString()
  const written = []

  for (const source of SOURCE_DOCUMENTS) {
    const response = await fetch(source.url)
    if (!response.ok) {
      const responseText = await response.text()
      throw new Error(
        `Failed to fetch ${source.url}: ${response.status} ${response.statusText} ${responseText}`,
      )
    }

    const document = await response.json()
    const normalizedDocument = normalizeDocument(document)

    if (!normalizedDocument._id || !normalizedDocument.path) {
      throw new Error(
        `Invalid content document fetched from ${source.url}: missing _id/path`,
      )
    }

    const fixturePayload = sortKeysDeep({
      source,
      capturedAt,
      document: normalizedDocument,
    })

    const filePath = await writeFixture(source, fixturePayload)
    written.push(filePath)
  }

  console.log('Updated minimark upgrade fixtures:')
  for (const filePath of written) {
    console.log(`- ${filePath}`)
  }
}

run().catch((error) => {
  console.error('[refresh-minimark-upgrade-fixtures] failed:', error)
  process.exitCode = 1
})
