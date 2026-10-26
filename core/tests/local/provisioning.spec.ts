import { describe, expect, it } from 'vitest'
import {
  createDatabase,
  createOrUpdateDesignDocument,
  getDatabaseInfo,
  getDatabaseSecurity,
  getDocument,
  initializeDatabase,
  setDatabaseSecurity,
  type CouchDBDesignDocument,
  type OperationClient,
} from '../../src/server/operations'
import {
  createLocalTestRun,
  localRequest,
  readLocalTestConfig,
} from '../helpers/local-harness'

const originalPolicy = {
  admins: { names: ['provision-owner'], roles: ['provision-admin'] },
  members: { names: ['provision-reader'], roles: ['provision-member'] },
}
const replacementPolicy = {
  admins: { names: [], roles: ['replacement-admin'] },
  members: { names: [], roles: ['replacement-member'] },
}
const design: CouchDBDesignDocument = {
  _id: 'owned',
  language: 'javascript',
  views: {
    byKind: {
      map: 'function(doc) { emit(doc.kind, null); }',
      reduce: '_count',
    },
  },
}

describe('local explicit provisioning operations', () => {
  it('preserves existing security and unchanged revisions, updates changed designs, and secures new databases', async () => {
    const config = await readLocalTestConfig()
    const run = await createLocalTestRun(config)
    const client: OperationClient = {
      request: (path, init) => localRequest(config, path, init),
      json: async () => {
        throw new Error('Operations must check response status')
      },
    }
    let failed = true
    try {
      const existing = await run.database('existing')
      expect(await createDatabase(client, existing)).toBe(false)
      await setDatabaseSecurity(client, existing, originalPolicy)
      await createOrUpdateDesignDocument(client, existing, design)
      const initialDesign = await getDocument(client, existing, '_design/owned')
      const initialInfo = await getDatabaseInfo(client, existing)
      const initialPolicy = await getDatabaseSecurity(client, existing)
      expect(initialPolicy).toMatchObject(originalPolicy)
      // Reordered nested keys and an unqualified ID still describe the same design.
      const equivalent: CouchDBDesignDocument = {
        views: { byKind: { reduce: '_count', map: design.views.byKind!.map } },
        language: 'javascript',
        _id: '_design/owned',
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        await initializeDatabase(client, existing, replacementPolicy, [
          equivalent,
        ])
        expect(await getDatabaseSecurity(client, existing)).toEqual(
          initialPolicy,
        )
        expect(
          (await getDocument(client, existing, '_design/owned'))?._rev,
        ).toBe(initialDesign?._rev)
        expect((await getDatabaseInfo(client, existing)).update_seq).toBe(
          initialInfo.update_seq,
        )
      }
      const changed = {
        ...design,
        views: { byKind: { map: 'function(doc) { emit(doc.kind, 1); }' } },
      }
      await initializeDatabase(client, existing, replacementPolicy, [changed])
      const changedDoc = await getDocument(client, existing, '_design/owned')
      expect(changedDoc?._rev).not.toBe(initialDesign?._rev)
      expect(changedDoc?.views).toEqual(changed.views)
      expect((await getDatabaseInfo(client, existing)).update_seq).not.toBe(
        initialInfo.update_seq,
      )
      expect(await getDatabaseSecurity(client, existing)).toEqual(initialPolicy)
      const fresh = await run.register({
        kind: 'database',
        id: `couchdb_test_${run.runId}_new`,
      })
      await initializeDatabase(client, fresh, replacementPolicy, [design])
      expect(await getDatabaseSecurity(client, fresh)).toMatchObject(
        replacementPolicy,
      )
      expect(
        (await getDocument(client, fresh, '_design/owned'))?.views,
      ).toEqual(design.views)
      failed = false
    } finally {
      if (!failed || !config.keepFailedResources) await run.cleanup()
      else
        console.info(
          `Preserved local test run ${run.runId}; use test:cleanup ${run.runId}`,
        )
    }
  }, 30000)
})
