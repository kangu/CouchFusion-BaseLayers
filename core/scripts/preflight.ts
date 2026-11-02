/** Read-only preflight; requires an explicit config file, never modifies CouchDB. */
import { readFile } from 'node:fs/promises'
import { createServiceClient } from '../src/server/client'
const args = process.argv.slice(2)
const configPath = args[args.indexOf('--config') + 1]
if (!args.includes('--config') || !configPath || configPath.startsWith('--'))
  throw new Error('An explicit --config file is required')
const config = JSON.parse(await readFile(configPath, 'utf8')) as {
  database: string
}
if (!config.database || config.database.startsWith('_'))
  throw new Error('Provide an explicit non-system database')
const client = createServiceClient()
const response = await client.request(`/${encodeURIComponent(config.database)}`)
console.log(
  JSON.stringify({
    target: 'http://localhost:5984',
    database: config.database,
    status: response.status,
    exists: response.ok,
  }),
)
if (!response.ok && response.status !== 404) process.exitCode = 1
