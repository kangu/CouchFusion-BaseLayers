import { cleanupLocalTestRun } from '../tests/helpers/local-harness'
const runId = process.argv[2]
if (!runId || !/^[a-f0-9]{24}$/.test(runId)) {
  console.error('Usage: test:cleanup <exact 24-character run ID>')
  process.exitCode = 1
} else
  cleanupLocalTestRun(runId)
    .then(() => console.info(`Cleaned local test run ${runId}`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Cleanup failed')
      process.exitCode = 1
    })
