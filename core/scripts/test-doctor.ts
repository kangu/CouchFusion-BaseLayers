import {
  localRequest,
  readLocalTestConfig,
  requireOk,
} from '../tests/helpers/local-harness'
async function main() {
  const config = await readLocalTestConfig()
  const root = await requireOk(await localRequest(config, '/'))
  const session = await requireOk(await localRequest(config, '/_session'))
  if (!session.userCtx?.roles?.includes('_admin'))
    throw new Error('Credentials do not identify a CouchDB administrator')
  console.info(
    JSON.stringify({
      endpoint: 'http://localhost:5984',
      version: root.version,
      administrator: true,
      configuration: 'readable',
      httpTimeoutMs: config.httpTimeoutMs,
      readyTimeoutMs: config.readyTimeoutMs,
      reportTimings: config.reportTimings,
      keepFailedResources: config.keepFailedResources,
    }),
  )
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Doctor failed')
  process.exitCode = 1
})
