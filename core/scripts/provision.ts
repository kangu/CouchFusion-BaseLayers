/** Run with a TypeScript runner: provision.ts --config /absolute/config.json [--apply]. */
import { readFile } from 'node:fs/promises'
import { createServiceClient } from '../src/server/client'
import { initializeDatabase } from '../src/server/operations'
import { validateProvisioningPolicy } from '../src/server/provisioning-schema'
const args = process.argv.slice(2)
const configPath = args[args.indexOf('--config') + 1]
if (!args.includes('--config') || !configPath || configPath.startsWith('--'))
  throw new Error('An explicit --config file is required')
const config: unknown = JSON.parse(await readFile(configPath, 'utf8'))
validateProvisioningPolicy(config)
console.log(
  JSON.stringify(
    {
      mode: args.includes('--apply') ? 'apply' : 'dry-run',
      target: 'http://localhost:5984',
      database: config.database,
      security: config.security,
      securityAppliesTo: 'newly-created-database-only',
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
