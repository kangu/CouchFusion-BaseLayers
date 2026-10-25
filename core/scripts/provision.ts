/** Run with a TypeScript runner: provision.ts --config /absolute/config.json [--apply]. */
import { readFile } from 'node:fs/promises'
import { createServiceClient } from '../src/server/client'
import {
  initializeDatabase,
  type CouchDBSecurityObject,
  type CouchDBDesignDocument,
} from '../src/server/operations'
const args = process.argv.slice(2)
const configPath = args[args.indexOf('--config') + 1]
if (!args.includes('--config') || !configPath || configPath.startsWith('--'))
  throw new Error('An explicit --config file is required')
const config = JSON.parse(await readFile(configPath, 'utf8')) as {
  database: string
  security: CouchDBSecurityObject
  designs?: CouchDBDesignDocument[]
}
if (
  !/^[a-z][a-z0-9_$()+/-]*$/.test(config.database) ||
  config.database.startsWith('_')
)
  throw new Error('Provide an explicit non-system database name')
if (!config.security?.admins || !config.security?.members)
  throw new Error('An explicit database security policy is required')
console.log(
  JSON.stringify(
    {
      mode: args.includes('--apply') ? 'apply' : 'dry-run',
      target: 'http://localhost:5984',
      database: config.database,
      security: config.security,
      designIds: config.designs?.map((d) => d._id) || [],
    },
    null,
    2,
  ),
)
if (args.includes('--apply'))
  await initializeDatabase(
    createServiceClient(),
    config.database,
    config.security,
    config.designs,
  )
