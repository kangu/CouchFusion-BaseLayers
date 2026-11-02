import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  initializeDatabase,
  type OperationClient,
} from '../../src/server/operations'
import { validateProvisioningPolicy } from '../../src/server/provisioning-schema'
const security = {
  admins: { names: [], roles: [] },
  members: { names: [], roles: ['reader'] },
}
const design = {
  _id: 'lookup',
  language: 'javascript',
  views: { lookup: { map: 'function(doc) { emit(doc._id, null); }' } },
}
const policy = { database: 'owned', security, designs: [design] }
describe('provisioning input validation before allocation', () => {
  it.each([
    { ...policy, security: { admins: 'bad', members: 'bad' } },
    {
      ...policy,
      security: { ...security, members: { names: 'reader', roles: [] } },
    },
    {
      ...policy,
      security: { ...security, admins: { names: [], roles: [42] } },
    },
    { ...policy, database: '_users' },
    { ...policy, database: 'Bad' },
    { ...policy, designs: {} },
    { ...policy, designs: [null] },
    { ...policy, designs: [{ ...design, _id: 42 }] },
    { ...policy, designs: [{ ...design, _id: '_local/lookup' }] },
    { ...policy, designs: [{ ...design, _id: '' }] },
    { ...policy, designs: [{ ...design, language: 42 }] },
    { ...policy, designs: [{ ...design, views: [] }] },
    { ...policy, designs: [{ ...design, views: { lookup: { map: 42 } } }] },
  ])(
    'rejects invalid structure without making any request: %j',
    async (invalid) => {
      let requests = 0
      const client: OperationClient = {
        request: async () => {
          requests++
          return Response.json({ ok: true })
        },
        json: async () => {
          throw new Error('unused')
        },
      }
      expect(() => validateProvisioningPolicy(invalid)).toThrow()
      await expect(
        initializeDatabase(
          client,
          invalid.database,
          invalid.security as any,
          invalid.designs as any,
        ),
      ).rejects.toThrow()
      expect(requests).toBe(0)
    },
  )
  it.each(['url', 'adminAuth'])(
    'rejects misleading top-level %s configuration',
    (field) => {
      expect(() =>
        validateProvisioningPolicy({ ...policy, [field]: 'unsupported' }),
      ).toThrow()
    },
  )
  it('accepts structural policies without compiling CouchDB functions or query maps', () => {
    expect(() => validateProvisioningPolicy(policy)).not.toThrow()
    expect(() =>
      validateProvisioningPolicy({
        ...policy,
        designs: [
          {
            _id: '_design/query',
            language: 'query',
            views: {
              byKind: {
                map: { fields: { kind: 'asc' }, selector: {} },
                reduce: '_count',
              },
            },
          },
        ],
      }),
    ).not.toThrow()
    expect(() =>
      validateProvisioningPolicy({
        ...policy,
        designs: [
          { ...design, views: { lookup: { map: 'server must compile this' } } },
        ],
      }),
    ).not.toThrow()
  })
})

describe('provision CLI policy validation', () => {
  it('rejects malformed and misleading apply policies before creating a service client', () => {
    const directory = mkdtempSync(join(tmpdir(), 'core-provision-'))
    try {
      const path = join(directory, 'policy.json')
      for (const invalid of [
        { ...policy, security: { admins: 'bad', members: 'bad' } },
        { ...policy, designs: [{ ...design, _id: 42 }] },
        { ...policy, url: 'http://remote.invalid:5984' },
        { ...policy, adminAuth: 'unsupported' },
      ]) {
        writeFileSync(path, JSON.stringify(invalid))
        const result = spawnSync(
          process.execPath,
          [
            '--import',
            'tsx',
            'scripts/provision.ts',
            '--config',
            path,
            '--apply',
          ],
          {
            cwd: process.cwd(),
            env: { ...process.env, COUCHDB_ADMIN_AUTH: '' },
            encoding: 'utf8',
          },
        )
        expect(result.status).not.toBe(0)
        expect(result.stderr).toContain('Invalid provisioning')
        expect(result.stdout).toBe('')
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
it('rejects duplicate normalized design IDs before making a request', async () => {
  let requests = 0
  const client: OperationClient = {
    request: async () => {
      requests++
      return Response.json({ ok: true })
    },
  }
  await expect(
    initializeDatabase(client, 'owned', security, [
      design,
      {
        ...design,
        _id: '_design/lookup',
        views: { other: { map: 'function(doc) { emit(doc._id); }' } },
      },
    ]),
  ).rejects.toThrow(/duplicate/)
  expect(requests).toBe(0)
})
