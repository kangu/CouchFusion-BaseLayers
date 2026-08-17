import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = () => readFileSync(resolve(process.cwd(), 'content/app/components/builder/Workbench.vue'), 'utf8')

describe('in-between section insertion', () => {
  it('inserts immediately at a known in-between index and reserves placement dialog for neutral insertion', () => {
    const workbench = source()
    const confirmStart = workbench.indexOf('const confirmRootComponentWithName')
    const confirmEnd = workbench.indexOf('const confirmRootSectionPlacement', confirmStart)
    const confirm = workbench.slice(confirmStart, confirmEnd)

    expect(confirm).toContain('pendingRootInsertIndex.value !== null')
    expect(confirm).toContain('confirmRootSectionPlacement(pendingRootInsertIndex.value)')
    expect(confirm).toContain('isSectionPlacementDialogOpen.value = true')
  })
})
