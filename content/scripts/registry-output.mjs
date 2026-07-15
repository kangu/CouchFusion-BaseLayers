import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

export function createRegistryRecord(definition, sourceFile, appRoot) {
  const source = path.relative(appRoot, sourceFile).split(path.sep).join('/')
  if (!source || source === '..' || source.startsWith('../') || path.posix.isAbsolute(source)) {
    throw new Error(`Component source is outside the app root: ${sourceFile}`)
  }

  return {
    definition,
    manifest: {
      id: String(definition.id ?? ''),
      label: String(definition.label ?? ''),
      description: String(definition.description ?? ''),
      source,
      propCount: Array.isArray(definition.props) ? definition.props.length : 0,
      allowChildren: Boolean(definition.allowChildren),
    },
  }
}

export function renderRegistryOutputs(records) {
  const ordered = [...records].sort((left, right) => left.manifest.id.localeCompare(right.manifest.id))
  const formatted = formatValue(ordered.map((record) => record.definition))
  const typescript = Buffer.from(
    `import type { ComponentDefinition } from '#content/types/builder'\n\n` +
      `const definitions: ComponentDefinition[] = ${formatted}\n\nexport default definitions\n`,
  )
  const manifest = Buffer.from(`${JSON.stringify({
    version: 1,
    typescriptSha256: createHash('sha256').update(typescript).digest('hex'),
    components: ordered.map((record) => record.manifest),
  }, null, 2)}\n`)

  return { typescript, manifest }
}

export async function writeRegistryPair({ outputFile, records, fileSystem = fs }) {
  const outputs = renderRegistryOutputs(records)
  const manifestFile = outputFile.replace(/\.ts$/, '.json')
  const suffix = `${process.pid}-${randomUUID()}.tmp`
  const typeTemp = `${outputFile}.${suffix}`
  const manifestTemp = `${manifestFile}.${suffix}`

  await fileSystem.mkdir(path.dirname(outputFile), { recursive: true })
  try {
    await writeSynced(fileSystem, typeTemp, outputs.typescript)
    await writeSynced(fileSystem, manifestTemp, outputs.manifest)
    await fileSystem.rename(typeTemp, outputFile)
    await fileSystem.rename(manifestTemp, manifestFile)
  } finally {
    await Promise.all([
      removeTemporary(fileSystem, typeTemp),
      removeTemporary(fileSystem, manifestTemp),
    ])
  }
}

async function writeSynced(fileSystem, filename, content) {
  const handle = await fileSystem.open(filename, 'wx', 0o600)
  try {
    await handle.writeFile(content)
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function removeTemporary(fileSystem, filename) {
  try {
    await fileSystem.unlink(filename)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

const escapeString = (value) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')

const formatValue = (value, level = 0) => {
  const indent = '  '.repeat(level)
  const nextIndent = '  '.repeat(level + 1)

  if (value === null) return 'null'

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const lines = value
      .map((item, index) => {
        const suffix = index < value.length - 1 ? ',' : ''
        return `${nextIndent}${formatValue(item, level + 1)}${suffix}`
      })
      .join('\n')
    return `[\n${lines}\n${indent}]`
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value)
    if (entries.length === 0) return '{}'
    const lines = entries
      .map(([key, item], index) => {
        const suffix = index < entries.length - 1 ? ',' : ''
        return `${nextIndent}${key}: ${formatValue(item, level + 1)}${suffix}`
      })
      .join('\n')
    return `{\n${lines}\n${indent}}`
  }

  if (typeof value === 'string') return `'${escapeString(value)}'`
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return 'undefined'
}
