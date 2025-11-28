#!/usr/bin/env bun
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..', '..')

const args = process.argv.slice(2)
const flagArg = args.find((arg) => arg.startsWith('--app='))
const flagValue = flagArg ? flagArg.split('=')[1] : undefined
const positional = args.find((arg) => !arg.startsWith('--'))

function inferAppFromCwd() {
  const appsDir = path.join(repoRoot, 'apps')
  const relative = path.relative(appsDir, process.cwd())
  if (!relative.startsWith('..')) {
    const [first] = relative.split(path.sep)
    if (first) {
      return first
    }
  }
  return undefined
}

const appName = flagValue || positional || inferAppFromCwd()

if (!appName) {
  console.error('Usage: bun run watch-component-registry --app=<appName>')
  process.exit(1)
}

const appRoot = path.join(repoRoot, 'apps', appName)
if (!fs.existsSync(appRoot)) {
  console.error(`App "${appName}" was not found at ${appRoot}`)
  process.exit(1)
}

function detectNuxtMajorVersion() {
  const packageJsonPath = path.join(appRoot, 'package.json')
  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8')
    const pkg = JSON.parse(raw)
    const range =
      pkg?.dependencies?.nuxt || pkg?.devDependencies?.nuxt || pkg?.peerDependencies?.nuxt
    if (typeof range === 'string') {
      const match = range.match(/(\d+)(?:\.(\d+))?/)
      if (match) {
        const parsed = Number.parseInt(match[1], 10)
        if (!Number.isNaN(parsed)) {
          return parsed
        }
      }
    }
  } catch (error) {
    console.warn(`[registry] Unable to read Nuxt version for ${appName}: ${error}`)
  }
  return fs.existsSync(path.join(appRoot, 'app')) ? 4 : 3
}

function resolveWatchDirs() {
  const major = detectNuxtMajorVersion()
  const nuxt3Candidates = [
    path.join(appRoot, 'components', 'content'),
    path.join(appRoot, 'app', 'components', 'content')
  ]
  const nuxt4Candidates = [
    path.join(appRoot, 'app', 'components', 'content'),
    path.join(appRoot, 'components', 'content')
  ]

  const candidates = major >= 4 ? nuxt4Candidates : nuxt3Candidates
  const existing = candidates.filter((dir) => fs.existsSync(dir))

  if (existing.length > 0) {
    return existing
  }

  const fallback = candidates[0]
  console.warn(`[registry] Creating missing content component directory at ${path.relative(repoRoot, fallback)}.`)
  fs.mkdirSync(fallback, { recursive: true })
  return [fallback]
}

const watchDirs = resolveWatchDirs()

let running = false
let pending = false

async function runGenerator(reason) {
  if (running) {
    pending = true
    return
  }
  running = true
  console.log(`[registry] ${reason} → generating component registry...`)

  const start = Date.now()
  const proc = Bun.spawn([
    'bun',
    path.join(repoRoot, 'layers', 'content', 'scripts', 'generate-component-registry.mjs'),
    `--app=${appName}`
  ], {
    stdout: 'inherit',
    stderr: 'inherit'
  })

  const exitCode = await proc.exited
  const duration = ((Date.now() - start) / 1000).toFixed(2)

  if (exitCode === 0) {
    console.log(`[registry] Completed in ${duration}s.`)
  } else {
    console.error(`[registry] Generator exited with code ${exitCode}.`)
  }

  running = false
  if (pending) {
    pending = false
    runGenerator('changes queued during run')
  }
}

await runGenerator('initial run')

// Track watcher stop handles
const watcherHandles = []

if (typeof (Bun?.watch) === 'function') {
  const watcher = Bun.watch({
    paths: watchDirs,
    debounceDelay: 150,
    filter: (file) => file.endsWith('.vue'),
    onChange(event) {
      const relativePath = path.relative(appRoot, event.path ?? '')
      runGenerator(`${event.event} ${relativePath}`)
    }
  })
  watcherHandles.push({ stop: () => watcher.stop() })
} else {
  for (const dir of watchDirs) {
    const handle = fs.watch(
      dir,
      { persistent: true },
      (eventType, filename) => {
        if (!filename || !filename.endsWith('.vue')) {
          return
        }
        runGenerator(`${eventType} ${path.join(path.relative(appRoot, dir), filename)}`)
      }
    )
    watcherHandles.push({ stop: () => handle.close() })
  }
}

console.log(`[registry] Watching directories for ${appName}:`)
for (const dir of watchDirs) {
  console.log(`  - ${path.relative(repoRoot, dir)}`)
}

process.on('SIGINT', () => {
  console.log('\n[registry] Stopping watcher...')
  for (const handle of watcherHandles) {
    handle.stop()
  }
  process.exit(0)
})

await new Promise(() => {})
