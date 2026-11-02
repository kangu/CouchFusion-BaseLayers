import { describe, expect, it } from 'vitest'
import {
  createLocalTestRun,
  readLocalTestConfig,
  localRequest,
  requireOk,
} from '../helpers/local-harness'
describe('owned same-instance replication', () => {
  it('replicates a document between two run-owned scratch databases', async () => {
    const config = await readLocalTestConfig()
    const run = await createLocalTestRun(config)
    let failed = true
    try {
      const source = await run.database('source')
      const target = await run.database('target')
      await requireOk(
        await localRequest(config, `/${source}/owned`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testRunMarker: run.marker,
            value: 'replicated',
          }),
        }),
      )
      const result = await requireOk(
        await localRequest(
          config,
          '/_replicate',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, target, doc_ids: ['owned'] }),
          },
          { timeoutMs: Math.max(15000, config.readyTimeoutMs) },
        ),
      )
      expect(result.ok).toBe(true)
      const copied = await requireOk(
        await localRequest(config, `/${target}/owned`),
      )
      expect(copied.testRunMarker).toBe(run.marker)
      expect(copied.value).toBe('replicated')
      failed = false
    } finally {
      if (!failed || !config.keepFailedResources) await run.cleanup()
    }
  }, 45000)
})
