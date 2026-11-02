import { describe, expect, test } from 'bun:test'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { isNumericValue, readNumericLiteral } from '../../scripts/registry-literals.mjs'

const require = createRequire(import.meta.url)
const { parseExpression } = require('@babel/parser')
const types = require('@babel/types')
const read = (code) => readNumericLiteral(parseExpression(code), types)

describe('readNumericLiteral', () => {
  test('reads plain and signed numbers', () => {
    expect(read('8')).toBe(8)
    expect(read('-8')).toBe(-8)
    expect(read('+3')).toBe(3)
    expect(read('-0.5')).toBe(-0.5)
    expect(read('- -2')).toBe(2)
    expect(read('0')).toBe(0)
  })

  test('ignores anything that is not a number literal', () => {
    for (const code of ['"8"', '-x', '!1', 'typeof 1', '-"8"', '1 + 2', 'null', 'undefined']) {
      expect(read(code)).toBeUndefined()
      expect(isNumericValue(parseExpression(code), types)).toBe(false)
    }
  })
})

describe('component registry generator', () => {
  test('reads defaults and builder metadata through the signed-number reader', async () => {
    const generator = fileURLToPath(new URL('../../scripts/generate-component-registry.mjs', import.meta.url))
    const source = await fs.readFile(generator, 'utf8')
    expect(source).toContain("from './registry-literals.mjs'")
    // No bare numeric-literal checks left: they would drop negative numbers again.
    expect(source).not.toMatch(/types\.isNumericLiteral\(/)
  })
})
