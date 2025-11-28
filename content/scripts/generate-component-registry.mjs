#!/usr/bin/env bun
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..', '..')

const positionalArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const [appNameArg] = positionalArgs
const appFlag = process.argv.find((arg) => arg.startsWith('--app='))
const appFlagValue = appFlag ? appFlag.split('=')[1] : undefined

const inferAppNameFromCwd = () => {
  let current = path.resolve(process.cwd())
  const repo = path.resolve(repoRoot)
  const root = path.parse(current).root

  while (true) {
    const parent = path.dirname(current)
    if (path.basename(parent) === 'apps') {
      return path.basename(current)
    }
    if (current === parent || current === root || current === repo) {
      break
    }
    current = parent
  }

  return undefined
}

const appName = appFlagValue || appNameArg || inferAppNameFromCwd()

if (!appName) {
  console.error('Unable to determine app name. Provide --app=<name> or run the command from within apps/<name>.')
  process.exit(1)
}

const appRoot = path.join(repoRoot, 'apps', appName)

let componentDirs = []
let outputFile = ''
let nuxtMajorVersion = 3

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

const parseMajorFromRange = (range) => {
  if (typeof range !== 'string') {
    return null
  }
  const match = range.match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!match) {
    return null
  }
  const major = parseInt(match[1], 10)
  return Number.isNaN(major) ? null : major
}

const detectNuxtMajorVersion = async () => {
  const packageJsonPath = path.join(appRoot, 'package.json')
  try {
    const raw = await fs.readFile(packageJsonPath, 'utf8')
    const pkg = JSON.parse(raw)
    const versionRange =
      pkg?.dependencies?.nuxt ||
      pkg?.devDependencies?.nuxt ||
      pkg?.peerDependencies?.nuxt

    const parsed = parseMajorFromRange(versionRange)
    if (parsed) {
      return parsed
    }
  } catch (error) {
    const reason = error?.message || String(error)
    console.warn(`Unable to read Nuxt version for "${appName}": ${reason}`)
  }

  return (await fileExists(path.join(appRoot, 'app'))) ? 4 : 3
}

const resolveComponentDirectories = async (major) => {
  const nuxt3Candidates = [
    path.join(appRoot, 'components', 'content'),
    path.join(appRoot, 'app', 'components', 'content')
  ]

  const nuxt4Candidates = [
    path.join(appRoot, 'app', 'components', 'content'),
    path.join(appRoot, 'components', 'content')
  ]

  const candidateDirs = major >= 4 ? nuxt4Candidates : nuxt3Candidates

  const resolved = []
  for (const candidate of candidateDirs) {
    if (await fileExists(candidate)) {
      resolved.push(candidate)
    }
  }

  if (resolved.length === 0) {
    resolved.push(candidateDirs[0])
  }

  return resolved
}

const ensureAppPaths = async () => {
  if (!(await fileExists(appRoot))) {
    console.error(`App "${appName}" was not found at ${appRoot}`)
    process.exit(1)
  }

  nuxtMajorVersion = await detectNuxtMajorVersion()
  componentDirs = await resolveComponentDirectories(nuxtMajorVersion)

  for (let index = 0; index < componentDirs.length; index += 1) {
    const dir = componentDirs[index]
    if (!(await fileExists(dir))) {
      if (index === 0) {
        console.warn(`No content component directory found for ${appName}. Creating ${dir}.`)
      }
      await fs.mkdir(dir, { recursive: true })
    }
  }

  const builderBaseDir =
    nuxtMajorVersion >= 4
      ? path.join(appRoot, 'app', 'content-builder')
      : path.join(appRoot, 'content-builder')

  outputFile = path.join(builderBaseDir, 'component-definitions.ts')
}

const createAppRequire = () => {
  const packageJsonPath = path.join(appRoot, 'package.json')
  return createRequire(packageJsonPath)
}

const collectVueFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectVueFiles(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      files.push(fullPath)
    }
  }
  return files
}

const toKebabCase = (value) => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[\s_-]+/g, '-')
    .toLowerCase()
}

const toTitleCase = (value) => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase())
}

// --- remainder of generator logic unchanged ---
// To keep parity with the original CLI version, we inline the remainder without modifications.

const extractTemplateMetadata = (template, propNames, helpers) => {
  const result = {
    propOrder: [],
    slotOrder: [],
    flow: [],
    hasDefaultSlot: false,
    namedSlots: []
  }

  if (!template) {
    return result
  }

  const { compilerDom, parser, traverse } = helpers
  const { NodeTypes } = compilerDom

  let ast
  try {
    ast = compilerDom.parse(template)
  } catch (error) {
    console.warn('Failed to parse template for metadata extraction:', error?.message || error)
    return result
  }

  const propNameSet = new Set(propNames)
  const seenProps = new Set()
  const seenSlots = new Set()

  const recordProp = (name) => {
    if (!propNameSet.has(name) || seenProps.has(name)) {
      return
    }
    seenProps.add(name)
    result.propOrder.push(name)
    result.flow.push({ type: 'prop', key: name })
  }

  const recordSlot = (name) => {
    if (seenSlots.has(name)) {
      return
    }
    seenSlots.add(name)
    if (name === 'default') {
      result.hasDefaultSlot = true
    } else {
      result.namedSlots.push(name)
    }
    result.slotOrder.push(name)
    result.flow.push({ type: 'slot', name })
  }

  const inspectExpression = (expression) => {
    if (!expression) {
      return
    }
    try {
      const exprAst = parser.parseExpression(expression, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      })
      traverse(exprAst, {
        Identifier(path) {
          const name = path.node.name
          if (!propNameSet.has(name)) {
            return
          }
          if (path.scope && path.scope.hasBinding(name)) {
            return
          }
          if (
            path.parent &&
            path.parent.type === 'MemberExpression' &&
            path.parent.property === path.node &&
            !path.parent.computed
          ) {
            return
          }
          if (
            path.parent &&
            path.parent.type === 'ObjectProperty' &&
            path.parent.key === path.node &&
            !path.parent.computed
          ) {
            return
          }
          recordProp(name)
        }
      })
    } catch {
      for (const name of propNameSet) {
        const pattern = new RegExp(`(^|[^A-Za-z0-9_])${name}(?![A-Za-z0-9_])`)
        if (pattern.test(expression)) {
          recordProp(name)
        }
      }
    }
  }

  const walk = (node) => {
    if (!node) return
    switch (node.type) {
      case NodeTypes.INTERPOLATION:
        if (node.content?.content) {
          inspectExpression(node.content.content)
        }
        break
      case NodeTypes.IF:
        node.branches.forEach((branch) => {
          if (branch.condition?.content) {
            inspectExpression(branch.condition.content)
          }
          branch.children?.forEach(walk)
        })
        break
      case NodeTypes.FOR:
        if (node.source?.content) {
          inspectExpression(node.source.content)
        }
        node.children?.forEach(walk)
        break
      case NodeTypes.ELEMENT: {
        const tag = (node.tag || '').toLowerCase()
        if (tag === 'slot') {
          let slotName = 'default'
          for (const prop of node.props || []) {
            if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name' && prop.value?.content) {
              slotName = prop.value.content
              break
            }
          }
          recordSlot(slotName)
        }
        for (const prop of node.props || []) {
          if (prop.type === NodeTypes.DIRECTIVE) {
            if (prop.name === 'slot') {
              const slotName =
                prop.arg && prop.arg.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content
                  ? prop.arg.content
                  : 'default'
              recordSlot(slotName)
            }
            if (prop.exp?.content) {
              inspectExpression(prop.exp.content)
            }
          }
        }
        node.children?.forEach(walk)
        break
      }
      case NodeTypes.TEXT_CALL:
        walk(node.content)
        break
      case NodeTypes.COMPOUND_EXPRESSION:
        for (const child of node.children || []) {
          if (typeof child === 'object' && child !== null && 'content' in child && child.content) {
            inspectExpression(child.content)
          }
        }
        break
      default:
        if (Array.isArray(node.children)) {
          node.children.forEach(walk)
        }
        break
    }
  }

  walk(ast)

  return result
}

const getPropertyKey = (keyNode) => {
  if (!keyNode) return null
  switch (keyNode.type) {
    case 'Identifier':
      return keyNode.name
    case 'StringLiteral':
      return keyNode.value
    default:
      return null
  }
}

// --- snip: unchanged logic continues ---
// NOTE: For brevity, the script below mirrors the original generator in cli-content without functional changes.

const resolveRuntimeType = (node, types) => {
  if (!node) return 'unknown'
  if (types.isIdentifier(node)) {
    switch (node.name) {
      case 'String':
        return 'string'
      case 'Boolean':
        return 'boolean'
      case 'Number':
        return 'number'
      case 'Array':
        return 'array'
      case 'Object':
        return 'object'
      default:
        return 'unknown'
    }
  }
  if (types.isArrayExpression(node)) {
    return 'array'
  }
  if (types.isObjectExpression(node)) {
    return 'object'
  }
  if (types.isTSAsExpression(node)) {
    return resolveRuntimeType(node.expression, types)
  }
  if (types.isMemberExpression(node)) {
    return resolveRuntimeType(node.object, types)
  }
  return 'unknown'
}

const resolveTypeAnnotation = (typeNode) => {
  if (!typeNode) return 'unknown'
  switch (typeNode.type) {
    case 'TSStringKeyword':
      return 'string'
    case 'TSBooleanKeyword':
      return 'boolean'
    case 'TSNumberKeyword':
      return 'number'
    case 'TSArrayType':
      return 'array'
    case 'TSAnyKeyword':
    case 'TSUnknownKeyword':
      return 'unknown'
    case 'TSTypeLiteral':
      return 'object'
    case 'TSUnionType':
      return resolveTypeAnnotation(typeNode.types[0])
    case 'TSLiteralType':
      return 'string'
    case 'TSTypeReference':
      if (typeNode.typeName.type === 'Identifier') {
        const name = typeNode.typeName.name
        if (name === 'Array') return 'array'
        if (name === 'Record' || name === 'Object') return 'object'
        if (name === 'Boolean') return 'boolean'
        if (name === 'Number') return 'number'
        if (name === 'String') return 'string'
      }
      return 'unknown'
    default:
      return 'unknown'
  }
}

// (full original logic continues unchanged; retained for feature parity)

// --- BEGIN pasted remainder from original generator ---
const extractMemberRootKey = (memberExpression, paramName, types) => {
  let current = memberExpression
  const path = []

  while (types.isMemberExpression(current)) {
    const property = current.property
    if (types.isIdentifier(property)) {
      path.push(property.name)
    } else if (types.isStringLiteral(property)) {
      path.push(property.value)
    } else {
      break
    }
    current = current.object
  }

  if (types.isIdentifier(current) && current.name === paramName && path.length > 0) {
    return path[path.length - 1]
  }

  return null
}

// Extract nested property path from member expression
const extractMemberPath = (memberExpression, paramName, types) => {
  let current = memberExpression
  const path = []

  while (types.isMemberExpression(current)) {
    const property = current.property
    if (types.isIdentifier(property)) {
      path.push(property.name)
    } else if (types.isStringLiteral(property)) {
      path.push(property.value)
    } else {
      break
    }
    current = current.object
  }

  if (types.isIdentifier(current) && current.name === paramName && path.length > 0) {
    return path.reverse() // Return path from root to leaf
  }

  return []
}

const inferFieldTypeFromValue = (node, types) => {
  if (!node) return 'text'
  if (types.isStringLiteral(node) || types.isTemplateLiteral(node)) {
    return 'text'
  }
  if (types.isNumericLiteral(node)) {
    return 'number'
  }
  if (types.isBooleanLiteral(node)) {
    return 'boolean'
  }
  if (types.isNullLiteral?.(node)) {
    return 'text'
  }
  if (types.isArrayExpression(node) || types.isObjectExpression(node)) {
    return 'text'
  }
  return 'text'
}

const pickFieldType = (existing, candidate) => {
  const priority = {
    boolean: 3,
    number: 2,
    text: 1
  }

  if (!existing) return candidate
  return (priority[candidate] || 0) > (priority[existing] || 0) ? candidate : existing
}

const collectFieldInfo = (node, paramName, types, accumulator, nestedAccumulator = new Map()) => {
  if (!node) return

  if (types.isLogicalExpression(node) || types.isBinaryExpression(node)) {
    collectFieldInfo(node.left, paramName, types, accumulator, nestedAccumulator)
    collectFieldInfo(node.right, paramName, types, accumulator, nestedAccumulator)

    if (types.isBinaryExpression(node)) {
      const leftKey = types.isMemberExpression(node.left)
        ? extractMemberRootKey(node.left, paramName, types)
        : null
      const rightType = inferFieldTypeFromValue(node.right, types)

      if (leftKey) {
        const existing = accumulator.get(leftKey)
        accumulator.set(leftKey, pickFieldType(existing, rightType))
      }
    }
    return
  }

  if (types.isUnaryExpression(node)) {
    collectFieldInfo(node.argument, paramName, types, accumulator, nestedAccumulator)
    return
  }

  if (types.isCallExpression(node)) {
    // Check for nested array operations like card.buttons.every()
    if (types.isMemberExpression(node.callee)) {
      const path = extractMemberPath(node.callee, paramName, types)
      if (path.length >= 2) {
        const [rootField, nestedField, ...method] = path
        if (method[0] === 'every' || method[0] === 'some' || method[0] === 'length') {
          // This indicates rootField.nestedField is an array
          if (!nestedAccumulator.has(rootField)) {
            nestedAccumulator.set(rootField, new Map())
          }
          nestedAccumulator.get(rootField).set(nestedField, 'array')
        }
      }
    }

    collectFieldInfo(node.callee, paramName, types, accumulator, nestedAccumulator)
    for (const argument of node.arguments) {
      collectFieldInfo(argument, paramName, types, accumulator, nestedAccumulator)
    }
    return
  }

  if (types.isConditionalExpression(node)) {
    collectFieldInfo(node.test, paramName, types, accumulator, nestedAccumulator)
    collectFieldInfo(node.consequent, paramName, types, accumulator, nestedAccumulator)
    collectFieldInfo(node.alternate, paramName, types, accumulator, nestedAccumulator)
    return
  }

  if (types.isMemberExpression(node)) {
    const rootKey = extractMemberRootKey(node, paramName, types)
    const path = extractMemberPath(node, paramName, types)

    if (rootKey) {
      const existing = accumulator.get(rootKey)
      accumulator.set(rootKey, pickFieldType(existing, 'text'))
    }

    // Detect nested property access like card.buttons.length
    if (path.length >= 2) {
      const [rootField, nestedField] = path
      if (!nestedAccumulator.has(rootField)) {
        nestedAccumulator.set(rootField, new Map())
      }
      nestedAccumulator.get(rootField).set(nestedField, 'text')
    }
    return
  }
}

const getArrowFunctionReturnExpression = (fn, types) => {
  if (types.isBlockStatement(fn.body)) {
    const returnStatement = fn.body.body.find((statement) => types.isReturnStatement(statement))
    return returnStatement?.argument || null
  }
  return fn.body
}

const detectPrimitiveElementType = (node, paramName, types) => {
  if (!node) return null

  if (types.isBinaryExpression(node) && ['===', '==', '!==', '!='].includes(node.operator)) {
    const check = (left, right) => {
      if (
        types.isUnaryExpression(left, { operator: 'typeof' }) &&
        types.isIdentifier(left.argument, { name: paramName }) &&
        types.isStringLiteral(right)
      ) {
        switch (right.value) {
          case 'string':
            return 'string'
          case 'number':
            return 'number'
          case 'boolean':
            return 'boolean'
          default:
            return null
        }
      }
      return null
    }

    return check(node.left, node.right) || check(node.right, node.left)
  }

  if (types.isLogicalExpression(node)) {
    return detectPrimitiveElementType(node.left, paramName, types) ||
      detectPrimitiveElementType(node.right, paramName, types)
  }

  if (types.isConditionalExpression(node)) {
    return (
      detectPrimitiveElementType(node.test, paramName, types) ||
      detectPrimitiveElementType(node.consequent, paramName, types) ||
      detectPrimitiveElementType(node.alternate, paramName, types)
    )
  }

  if (types.isUnaryExpression(node)) {
    return detectPrimitiveElementType(node.argument, paramName, types)
  }

  if (types.isCallExpression(node)) {
    for (const argument of node.arguments) {
      const detected = detectPrimitiveElementType(argument, paramName, types)
      if (detected) return detected
    }
  }

  return null
}

const inferArrayStructureFromValidator = (validatorNode, types) => {
  if (!validatorNode) return []

  if (!types.isArrowFunctionExpression(validatorNode) && !types.isFunctionExpression(validatorNode)) {
    return { items: [], elementType: null }
  }

  const returnExpression = getArrowFunctionReturnExpression(validatorNode, types)

  const findEveryCallExpression = (node) => {
    if (!node) return null

    if (types.isCallExpression(node)) {
      if (
        types.isMemberExpression(node.callee) &&
        types.isIdentifier(node.callee.property, { name: 'every' })
      ) {
        return node
      }

      for (const argument of node.arguments) {
        const nested = findEveryCallExpression(argument)
        if (nested) return nested
      }
    }

    if (types.isLogicalExpression(node) || types.isBinaryExpression(node)) {
      return findEveryCallExpression(node.left) || findEveryCallExpression(node.right)
    }

    if (types.isConditionalExpression(node)) {
      return (
        findEveryCallExpression(node.test) ||
        findEveryCallExpression(node.consequent) ||
        findEveryCallExpression(node.alternate)
      )
    }

    if (types.isUnaryExpression(node)) {
      return findEveryCallExpression(node.argument)
    }

    if (types.isSequenceExpression(node)) {
      for (const expr of node.expressions) {
        const found = findEveryCallExpression(expr)
        if (found) return found
      }
    }

    return null
  }

  const everyCall = findEveryCallExpression(returnExpression)
  if (!everyCall) {
    return { items: [], elementType: null }
  }

  if (!types.isMemberExpression(everyCall.callee)) {
    return { items: [], elementType: null }
  }

  const everyPredicate = everyCall.arguments[0]
  if (!everyPredicate) {
    return { items: [], elementType: null }
  }

  if (!types.isArrowFunctionExpression(everyPredicate) && !types.isFunctionExpression(everyPredicate)) {
    return { items: [], elementType: null }
  }

  const param = everyPredicate.params[0]
  if (!param || !types.isIdentifier(param)) {
    return { items: [], elementType: null }
  }

  const fieldAccumulator = new Map()
  const nestedAccumulator = new Map()
  const predicateExpression = getArrowFunctionReturnExpression(everyPredicate, types)
  collectFieldInfo(predicateExpression, param.name, types, fieldAccumulator, nestedAccumulator)

  const items = Array.from(fieldAccumulator.entries())
    .map(([key, type]) => {
      const item = { key, type }
      // Check if this field has nested arrays
      if (nestedAccumulator.has(key)) {
        const nestedFields = nestedAccumulator.get(key)
        const nestedItems = Array.from(nestedFields.entries())
          .filter(([nestedKey, nestedType]) => nestedType === 'array')
          .map(([nestedKey]) => ({
            key: nestedKey,
            type: 'jsonarray',
            items: [] // Would need more sophisticated analysis to detect button structure
          }))

        if (nestedItems.length > 0) {
          item.nestedArrays = nestedItems
        }
      }
      return item
    })
    .sort((a, b) => a.key.localeCompare(b.key))

  if (items.length > 0) {
    return { items, elementType: null, nestedArrays: nestedAccumulator }
  }

  const primitive = detectPrimitiveElementType(predicateExpression, param.name, types)
  return { items: [], elementType: primitive }
}

const convertTypeToControl = (type) => {
  switch (type) {
    case 'boolean':
      return 'boolean'
    case 'array':
    case 'object':
      return 'json'
    default:
      return 'text'
  }
}

const nodeToValue = (node, types) => {
  if (!node) return undefined
  if (types.isStringLiteral(node)) {
    return node.value
  }
  if (types.isBooleanLiteral(node)) {
    return node.value
  }
  if (types.isNumericLiteral(node)) {
    return node.value
  }
  if (types.isNullLiteral?.(node)) {
    return null
  }
  if (types.isTemplateLiteral(node) && node.expressions.length === 0) {
    return node.quasis[0]?.value?.cooked ?? ''
  }
  if (types.isArrayExpression(node)) {
    return node.elements.map((element) => nodeToValue(element, types)).filter((value) => value !== undefined)
  }
  if (types.isObjectExpression(node)) {
    const result = {}
    for (const prop of node.properties) {
      if (types.isObjectProperty(prop)) {
        const key = getPropertyKey(prop.key)
        if (!key) continue
        const value = nodeToValue(prop.value, types)
        if (value !== undefined) {
          result[key] = value
        }
      }
    }
    return result
  }
  if (types.isArrowFunctionExpression(node) && node.params.length === 0) {
    if (types.isArrayExpression(node.body) || types.isObjectExpression(node.body)) {
      return nodeToValue(node.body, types)
    }
    if (types.isBlockStatement(node.body)) {
      const returnStatement = node.body.body.find((statement) => types.isReturnStatement(statement))
      if (returnStatement && returnStatement.argument) {
        return nodeToValue(returnStatement.argument, types)
      }
    }
  }
  return undefined
}

const determineControlType = (prop) => {
  if (prop.ui?.widget === 'textarea') {
    return 'textarea'
  }
  if (prop.ui?.widget === 'rich-string') {
    return 'text'
  }
  if (prop.type === 'array') {
    if (prop.items && prop.items.length > 0) {
      return 'jsonarray'
    }
    if (prop.elementType === 'string') {
      return 'stringarray'
    }
    return 'json'
  }
  if (prop.type === 'object') {
    const fieldEntries = prop.fields || prop.items
    if (fieldEntries && fieldEntries.length > 0) {
      return 'jsonobject'
    }
    return 'json'
  }
  return convertTypeToControl(prop.type)
}

const IMAGE_FIELD_KEYWORDS = [
  'image',
  'thumbnail',
  'thumb',
  'avatar',
  'logo',
  'logos',
  'photo',
  'picture',
  'cover',
  'banner',
  // 'icon',
  'illustration'
]

const normalizeKey = (key) => key.replace(/[\s_-]+/g, '').toLowerCase()

const looksLikeImageField = (key) => {
  const normalized = normalizeKey(key)

  return IMAGE_FIELD_KEYWORDS.some((keyword) => {
    if (normalized === keyword) {
      return true
    }

    if (normalized.endsWith(keyword)) {
      return true
    }

    if (normalized.startsWith(keyword)) {
      return true
    }

    return normalized.includes(keyword) && keyword.length >= 4
  })
}

const applyImageFieldUi = (schema, key) => {
  if (schema.ui) {
    return schema
  }

  if (!looksLikeImageField(key)) {
    return schema
  }

  if (schema.type === 'text' || schema.type === 'stringarray') {
    schema.ui = { component: 'ContentImageField' }
  }

  return schema
}

const applySchemaUiHints = (schema, key, ui) => {
  if (ui?.widget === 'textarea' && schema.type === 'text') {
    schema.type = 'textarea'
  }
  if (ui) {
    schema.ui = ui
    return schema
  }
  return applyImageFieldUi(schema, key)
}

const buildPropSchema = (prop) => {
  const label = toTitleCase(prop.key)
  const schema = {
    key: prop.key,
    label,
    type: determineControlType(prop)
  }
  if (prop.required) {
    schema.required = true
  }
  if (prop.default !== undefined) {
    schema.default = prop.default
  }
  if (prop.items && prop.items.length > 0) {
    schema.items = prop.items.map((item) => convertArrayItemSchema(item))
  }
  const objectFields = prop.fields || (schema.type === 'jsonobject' ? prop.items : undefined)
  if (objectFields && objectFields.length > 0) {
    schema.fields = objectFields.map((field) => convertArrayItemSchema(field))
  }
  if (prop.elementType) {
    schema.elementType = prop.elementType
  }
  return applySchemaUiHints(schema, prop.key, prop.ui)
}

const convertArrayItemSchema = (item) => {
  const label = toTitleCase(item.key)
  const finalizeSchema = (schema) => applySchemaUiHints(schema, item.key, item.ui)

  if (item.type === 'array') {
    if (item.items && item.items.length > 0) {
      return finalizeSchema({
        key: item.key,
        label,
        type: 'jsonarray',
        items: item.items.map((child) => convertArrayItemSchema(child)),
        default: item.default
      })
    }
    if (item.elementType === 'string') {
      const schema = {
        key: item.key,
        label,
        type: 'stringarray',
        default: item.default
      }
      return finalizeSchema(schema)
    }
    if (item.elementType === 'number') {
      return finalizeSchema({
        key: item.key,
        label,
        type: 'jsonarray',
        items: [
          {
            key: 'value',
            label: 'Value',
            type: 'number'
          }
        ],
        default: item.default
      })
    }
    if (item.elementType === 'boolean') {
      return finalizeSchema({
        key: item.key,
        label,
        type: 'jsonarray',
        items: [
          {
            key: 'value',
            label: 'Value',
            type: 'boolean'
          }
        ],
        default: item.default
      })
    }
    return finalizeSchema({
      key: item.key,
      label,
      type: 'jsonarray',
      items: [],
      default: item.default
    })
  }

  if (item.type === 'object') {
    const childFields = item.fields || item.items || []
    const schema = {
      key: item.key,
      label,
      type: 'jsonobject'
    }
    if (childFields.length > 0) {
      schema.fields = childFields.map((child) => convertArrayItemSchema(child))
    }
    if (item.default !== undefined) {
      schema.default = item.default
    }
    return finalizeSchema(schema)
  }

  if (item.type === 'stringarray') {
    const schema = {
      key: item.key,
      label,
      type: 'stringarray',
      default: item.default
    }
    return finalizeSchema(schema)
  }

  if (item.type === 'boolean') {
    return finalizeSchema({
      key: item.key,
      label,
      type: 'boolean',
      default: item.default
    })
  }

  if (item.type === 'number') {
    return finalizeSchema({
      key: item.key,
      label,
      type: 'number',
      default: item.default
    })
  }

  const schema = {
    key: item.key,
    label,
    type: 'text'
  }
  if (item.default !== undefined) {
    schema.default = item.default
  }
  return finalizeSchema(schema)
}

const cloneArrayItem = (item) => {
  const cloned = { ...item }
  if (item.items) {
    cloned.items = item.items.map((child) => cloneArrayItem(child))
  }
  if (item.fields) {
    cloned.fields = item.fields.map((child) => cloneArrayItem(child))
  }
  return cloned
}

const mergeArrayItems = (existingItems = [], incomingItems = []) => {
  const itemMap = new Map()

  for (const item of existingItems) {
    itemMap.set(item.key, cloneArrayItem(item))
  }

  for (const item of incomingItems) {
    const current = itemMap.get(item.key)
    if (current) {
      current.type = current.type === 'unknown' ? item.type : current.type
      if (typeof item.required === 'boolean') {
        current.required = item.required
      }
      if (item.items && item.items.length > 0) {
        current.items = mergeArrayItems(current.items || [], item.items)
      }
      if (item.elementType) {
        current.elementType = item.elementType
      }
      if (item.fields && item.fields.length > 0) {
        current.fields = mergeObjectFields(current.fields || [], item.fields)
      }
      if (item.default !== undefined) {
        current.default = item.default
      }
      if (item.ui && !current.ui) {
        current.ui = item.ui
      }
    } else {
      itemMap.set(item.key, cloneArrayItem(item))
    }
  }

  return Array.from(itemMap.values()).sort((a, b) => a.key.localeCompare(b.key))
}

const mergeObjectFields = (existingFields = [], incomingFields = []) => {
  const map = new Map()

  for (const field of existingFields) {
    map.set(field.key, cloneArrayItem(field))
  }

  for (const field of incomingFields) {
    const current = map.get(field.key)
    if (current) {
      current.type = current.type === 'unknown' ? field.type : current.type
      if (typeof field.required === 'boolean') {
        current.required = field.required
      }
      if (field.items && field.items.length > 0) {
        current.items = mergeArrayItems(current.items || [], field.items)
      }
      if (field.fields && field.fields.length > 0) {
        current.fields = mergeObjectFields(current.fields || [], field.fields)
      }
      if (field.elementType) {
        current.elementType = field.elementType
      }
      if (field.default !== undefined) {
        current.default = field.default
      }
      if (field.ui && !current.ui) {
        current.ui = field.ui
      }
    } else {
      map.set(field.key, cloneArrayItem(field))
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
}

const mergeProps = (typedProps, runtimeProps, defaults) => {
  const map = new Map()

  for (const prop of typedProps) {
    map.set(prop.key, {
      ...prop,
      items: prop.items ? mergeArrayItems([], prop.items) : undefined,
      fields: prop.fields ? mergeObjectFields([], prop.fields) : undefined
    })
  }

  for (const prop of runtimeProps) {
    const existing = map.get(prop.key)
    if (existing) {
      existing.type = existing.type === 'unknown' ? prop.type : existing.type
      if (typeof prop.required === 'boolean') {
        existing.required = prop.required
      }
      if (prop.default !== undefined) {
        existing.default = prop.default
      }
      if (prop.items && prop.items.length > 0) {
        existing.items = mergeArrayItems(existing.items || [], prop.items)
      }
      if (prop.elementType) {
        existing.elementType = prop.elementType
      }
      if (prop.fields && prop.fields.length > 0) {
        existing.fields = mergeObjectFields(existing.fields || [], prop.fields)
      }
      if (prop.ui && !existing.ui) {
        existing.ui = prop.ui
      }
    } else {
      map.set(prop.key, {
        ...prop,
        items: prop.items ? mergeArrayItems([], prop.items) : undefined,
        fields: prop.fields ? mergeObjectFields([], prop.fields) : undefined
      })
    }
  }

  for (const [key, value] of defaults.entries()) {
    const existing = map.get(key)
    if (existing) {
      existing.default = value
      if (value !== undefined) {
        existing.required = false
      }
    } else {
      map.set(key, { key, type: 'unknown', required: false, default: value })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key))
}

const extractProps = (scriptContent, helpers) => {
  const { parser, traverse, types } = helpers
  if (!scriptContent) {
    return []
  }

  const ast = parser.parse(scriptContent, {
    sourceType: 'module',
    plugins: ['typescript', 'decorators-legacy']
  })

  const interfaceMap = new Map()
  const typeAliasMap = new Map()
  const processedNodes = new Set()
  const defaults = new Map()
  let typedProps = []
  let runtimeProps = []

  const parseTypeLiteral = (literal) => {
    const props = []
    if (!literal || !literal.members) {
      return props
    }

    for (const member of literal.members) {
      if (!types.isTSPropertySignature(member)) {
        continue
      }
      const key = getPropertyKey(member.key)
      if (!key) {
        continue
      }
      const detail = analyzeTypeAnnotation(member.typeAnnotation?.typeAnnotation)
      const required = !member.optional
      const entry = {
        key,
        type: detail.type,
        required,
        items: detail.type === 'array' ? detail.items : undefined,
        elementType: detail.type === 'array' ? detail.elementType : undefined,
        fields: detail.type === 'object' ? detail.items : undefined,
        ui: detail.ui
      }
      props.push(entry)
    }

    return props
  }

  const parseInterface = (name) => {
    const node = interfaceMap.get(name)
    if (!node) return []
    return parseTypeLiteral({ members: node.body.body })
  }

  const parseTypeAlias = (name) => {
    const node = typeAliasMap.get(name)
    if (!node) return []
    if (node.typeAnnotation.type === 'TSTypeLiteral') {
      return parseTypeLiteral({ members: node.typeAnnotation.members })
    }
    const analyzed = analyzeTypeAnnotation(node.typeAnnotation)
    if (analyzed.type === 'object' && Array.isArray(analyzed.items)) {
      return analyzed.items
    }
    if (analyzed.type === 'array' && Array.isArray(analyzed.items)) {
      return analyzed.items
    }
    return []
  }

  function analyzeTypeAnnotation(typeNode) {
    if (!typeNode) {
      return { type: 'unknown' }
    }

    switch (typeNode.type) {
      case 'TSStringKeyword':
        return { type: 'string' }
      case 'TSBooleanKeyword':
        return { type: 'boolean' }
      case 'TSNumberKeyword':
        return { type: 'number' }
      case 'TSAnyKeyword':
      case 'TSUnknownKeyword':
        return { type: 'unknown' }
      case 'TSLiteralType':
        return { type: 'string' }
      case 'TSArrayType': {
        const elementDetail = analyzeTypeAnnotation(typeNode.elementType)
        if (elementDetail.type === 'object' && Array.isArray(elementDetail.items)) {
          return { type: 'array', items: elementDetail.items }
        }
        if (elementDetail.type === 'array') {
          if (Array.isArray(elementDetail.items)) {
            return { type: 'array', items: elementDetail.items }
          }
          if (elementDetail.elementType) {
            return { type: 'array', elementType: elementDetail.elementType }
          }
        }
        if (elementDetail.type && ['string', 'number', 'boolean'].includes(elementDetail.type)) {
          return { type: 'array', elementType: elementDetail.type }
        }
        return { type: 'array', items: elementDetail.items }
      }
      case 'TSTypeLiteral': {
        const nested = parseTypeLiteral({ members: typeNode.members })
        return { type: 'object', items: nested, fields: nested }
      }
      case 'TSTypeReference': {
        if (typeNode.typeName.type === 'Identifier') {
          const name = typeNode.typeName.name
          if (name === 'TextAreaString') {
            return { type: 'string', ui: { widget: 'textarea' } }
          }
          if (name === 'RichTextAreaString') {
            return {
              type: 'string',
              ui: { widget: 'rich-string', component: 'ContentRichTextField' }
            }
          }
          if (name === 'Array' && typeNode.typeParameters?.params?.length) {
            const element = analyzeTypeAnnotation(typeNode.typeParameters.params[0])
            if (element.type === 'object' && Array.isArray(element.items)) {
              return { type: 'array', items: element.items }
            }
            if (element.type === 'array') {
              if (Array.isArray(element.items)) {
                return { type: 'array', items: element.items }
              }
              if (element.elementType) {
                return { type: 'array', elementType: element.elementType }
              }
            }
            if (['string', 'number', 'boolean'].includes(element.type)) {
              return { type: 'array', elementType: element.type }
            }
            return { type: 'array', items: element.items }
          }

          if (interfaceMap.has(name)) {
            const iface = interfaceMap.get(name)
            const nested = parseTypeLiteral({ members: iface.body.body })
            return { type: 'object', items: nested, fields: nested }
          }

          if (typeAliasMap.has(name)) {
            const alias = typeAliasMap.get(name)
            return analyzeTypeAnnotation(alias.typeAnnotation)
          }
        }
        return { type: 'unknown' }
      }
      case 'TSUnionType': {
        const filtered = typeNode.types.filter(
          (subtype) => subtype.type !== 'TSNullKeyword' && subtype.type !== 'TSUndefinedKeyword'
        )
        if (filtered.length === 0) {
          return { type: 'unknown' }
        }
        return analyzeTypeAnnotation(filtered[0])
      }
      default:
        return { type: resolveTypeAnnotation(typeNode) }
    }
  }

  const parseDefaultsObject = (objectExpression) => {
    if (!objectExpression || objectExpression.type !== 'ObjectExpression') {
      return
    }
    for (const property of objectExpression.properties) {
      if (!types.isObjectProperty(property)) continue
      const key = getPropertyKey(property.key)
      if (!key) continue
      const value = nodeToValue(property.value, types)
      if (value !== undefined) {
        defaults.set(key, value)
      }
    }
  }

  const parseRuntimeProps = (objectExpression) => {
    if (!objectExpression || objectExpression.type !== 'ObjectExpression') {
      return []
    }
  const props = []
    for (const property of objectExpression.properties) {
      if (!types.isObjectProperty(property)) continue
      const key = getPropertyKey(property.key)
      if (!key) continue
      const init = property.value

      if (types.isObjectExpression(init)) {
        let type = 'unknown'
        let required = false
        let defaultValue
        let itemSchema
        let elementType
        for (const option of init.properties) {
          if (!types.isObjectProperty(option)) continue
          const optionKey = getPropertyKey(option.key)
          if (!optionKey) continue
          if (optionKey === 'type') {
            type = resolveRuntimeType(option.value, types)
          } else if (optionKey === 'required') {
            const value = nodeToValue(option.value, types)
            required = Boolean(value)
          } else if (optionKey === 'default') {
            defaultValue = nodeToValue(option.value, types)
          } else if (optionKey === 'validator') {
            const inferred = inferArrayStructureFromValidator(option.value, types)
            if (inferred.items.length > 0) {
              itemSchema = inferred.items
            }
            if (inferred.elementType) {
              elementType = inferred.elementType
            }
          }
        }
        if (type === 'array' && !itemSchema && !elementType) {
          elementType = 'string'
        }
        props.push({ key, type, required, default: defaultValue, items: itemSchema, elementType })
      } else {
        const type = resolveRuntimeType(init, types)
        props.push({ key, type, required: false })
      }
    }
    return props
  }

  const processDefineProps = (callExpression) => {
    if (processedNodes.has(callExpression)) {
      return
    }
    processedNodes.add(callExpression)

    if (callExpression.arguments[0]) {
      runtimeProps = parseRuntimeProps(callExpression.arguments[0])
    }

    const typeParam = callExpression.typeParameters?.params?.[0]
    if (!typeParam) {
      return
    }
    if (typeParam.type === 'TSTypeLiteral') {
      typedProps = parseTypeLiteral(typeParam)
    } else if (typeParam.type === 'TSTypeReference' && typeParam.typeName.type === 'Identifier') {
      const name = typeParam.typeName.name
      typedProps = parseInterface(name)
      if (typedProps.length === 0) {
        typedProps = parseTypeAlias(name)
      }
    }
  }

  traverse(ast, {
    TSInterfaceDeclaration(path) {
      interfaceMap.set(path.node.id.name, path.node)
    },
    TSTypeAliasDeclaration(path) {
      typeAliasMap.set(path.node.id.name, path.node)
    },
    CallExpression(path) {
      const { node } = path
      if (types.isIdentifier(node.callee, { name: 'withDefaults' })) {
        const [definePropsCall, defaultsObject] = node.arguments
        if (types.isCallExpression(definePropsCall) && types.isIdentifier(definePropsCall.callee, { name: 'defineProps' })) {
          processDefineProps(definePropsCall)
        }
        if (defaultsObject) {
          parseDefaultsObject(defaultsObject)
        }
      } else if (types.isIdentifier(node.callee, { name: 'defineProps' })) {
        processDefineProps(node)
      }
    }
  })

  return mergeProps(typedProps, runtimeProps, defaults)
}

const generateDefinitions = async (vueFiles, helpers) => {
  const definitions = []

  for (const file of vueFiles) {
    const source = await fs.readFile(file, 'utf8')
    const { descriptor } = helpers.compiler.parse(source, { filename: file })
    const componentName = path.basename(file, '.vue')

    const props = extractProps(descriptor.scriptSetup?.content || descriptor.script?.content || '', helpers)

    const propNames = props.map((prop) => prop.key)
    const templateMeta = descriptor.template
      ? extractTemplateMetadata(descriptor.template.content || '', propNames, helpers)
      : {
          propOrder: [],
          slotOrder: [],
          flow: [],
          hasDefaultSlot: false,
          namedSlots: []
        }

    const definition = {
      id: toKebabCase(componentName),
      label: toTitleCase(componentName),
      description: `Auto-generated registry entry for ${componentName}.`
    }

    if (props.length > 0) {
      const propMap = new Map(props.map((prop) => [prop.key, prop]))
      const orderedProps = []
      const seen = new Set()

      for (const key of templateMeta.propOrder) {
        const match = propMap.get(key)
        if (match && !seen.has(key)) {
          orderedProps.push(match)
          seen.add(key)
        }
      }

      for (const prop of props) {
        if (!seen.has(prop.key)) {
          orderedProps.push(prop)
          seen.add(prop.key)
        }
      }

      definition.props = orderedProps.map(buildPropSchema)
    }

    if (templateMeta.slotOrder.length > 0) {
      definition.slots = templateMeta.slotOrder.map((name) => ({
        name,
        label: name === 'default' ? 'Default Slot' : toTitleCase(name.replace(/[-_]+/g, ' '))
      }))
      definition.allowChildren = true
      const hints = []
      if (templateMeta.hasDefaultSlot) {
        hints.push('default slot')
      }
      if (templateMeta.namedSlots.length > 0) {
        hints.push(`named slots: ${templateMeta.namedSlots.join(', ')}`)
      }
      definition.childHint = `Supports ${hints.join(' and ')}`
    }

    if (templateMeta.flow.length > 0) {
      definition.flow = templateMeta.flow
    }

    const scriptsContent = [
      descriptor.script?.content,
      descriptor.scriptSetup?.content
    ]
      .filter(Boolean)
      .join('\n')

    const builderMeta = extractBuilderMeta(scriptsContent, helpers)
    if (builderMeta) {
      applyBuilderMeta(definition, builderMeta)
    }

    definitions.push(definition)
  }

  return definitions.sort((a, b) => a.label.localeCompare(b.label))
}

const extractBuilderMeta = (scriptContent, helpers) => {
  if (!scriptContent) return null
  const { parser, traverse, types } = helpers
  try {
    const ast = parser.parse(scriptContent, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'importAttributes', 'topLevelAwait']
    })

    let meta = null

    traverse(ast, {
      ExportNamedDeclaration(path) {
        const { node } = path
        if (!node.declaration) return
        if (types.isVariableDeclaration(node.declaration)) {
          for (const decl of node.declaration.declarations) {
            const id = decl.id
            if (!types.isIdentifier(id) || id.name !== 'builderFieldMeta') continue
            if (types.isObjectExpression(decl.init)) {
              meta = objectExpressionToLiteral(decl.init, types)
            }
          }
        }
      }
    })

    return meta
  } catch (error) {
    console.warn('[registry] Failed to parse builder metadata:', error?.message || error)
    return null
  }
}

const objectExpressionToLiteral = (node, types) => {
  const obj = {}
  node.properties.forEach((prop) => {
    if (types.isObjectProperty(prop)) {
      const key = types.isIdentifier(prop.key) ? prop.key.name : types.isStringLiteral(prop.key) ? prop.key.value : null
      if (!key) return
      if (types.isObjectExpression(prop.value)) {
        obj[key] = objectExpressionToLiteral(prop.value, types)
      } else if (types.isArrayExpression(prop.value)) {
        obj[key] = prop.value.elements.map((el) => {
          if (types.isObjectExpression(el)) return objectExpressionToLiteral(el, types)
          if (types.isStringLiteral(el)) return el.value
          if (types.isNumericLiteral(el)) return el.value
          if (types.isBooleanLiteral(el)) return el.value
          return null
        })
      } else if (types.isStringLiteral(prop.value) || types.isNumericLiteral(prop.value) || types.isBooleanLiteral(prop.value)) {
        obj[key] = prop.value.value
      }
    }
  })
  return obj
}

const applyBuilderMeta = (definition, meta) => {
    if (!meta || !definition.props) return
    const applyToPath = (path, payload) => {
      const segments = path.split('.').filter(Boolean)
      if (segments.length === 0) return

    let current = { props: definition.props }
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i]
      const targetArray = current.props || current.items || current.fields || []
      const target = targetArray.find((entry) => entry.key === segment)
      if (!target) return
      if (i === segments.length - 1) {
        Object.assign(target, payload)
        return
      }
      current = target
    }
  }

  Object.entries(meta).forEach(([path, payload]) => {
    if (!payload || typeof payload !== 'object') return
    const normalizedPayload = { ...payload }
    if (payload.visibleWhen && Array.isArray(payload.visibleWhen)) {
      normalizedPayload.visibleWhen = payload.visibleWhen
    } else if (payload.visibleWhen) {
      normalizedPayload.visibleWhen = [payload.visibleWhen]
    }
    if (payload.options && Array.isArray(payload.options)) {
      normalizedPayload.options = payload.options
    }
    if (payload.type) {
      normalizedPayload.type = payload.type
    }
    if (payload.default !== undefined) {
      normalizedPayload.default = payload.default
    }
    applyToPath(path, normalizedPayload)
  })
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

  if (value === null) {
    return 'null'
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '[]'
    }
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
    if (entries.length === 0) {
      return '{}'
    }
    const lines = entries
      .map(([key, val], index) => {
        const suffix = index < entries.length - 1 ? ',' : ''
        return `${nextIndent}${key}: ${formatValue(val, level + 1)}${suffix}`
      })
      .join('\n')
    return `{
${lines}
${indent}}`
  }

  if (typeof value === 'string') {
    return `'${escapeString(value)}'`
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return 'undefined'
}

const writeDefinitionsFile = async (definitions) => {
  const formatted = formatValue(definitions)
  const content = `import type { ComponentDefinition } from '#content/types/builder'\n\nconst definitions: ComponentDefinition[] = ${formatted}\n\nexport default definitions\n`
  await fs.mkdir(path.dirname(outputFile), { recursive: true })
  await fs.writeFile(outputFile, content)
}

const run = async () => {
  await ensureAppPaths()
  const appRequire = createAppRequire()

  const helpers = {
    compiler: appRequire('@vue/compiler-sfc'),
    compilerDom: appRequire('@vue/compiler-dom'),
    parser: appRequire('@babel/parser'),
    traverse: appRequire('@babel/traverse').default,
    types: appRequire('@babel/types')
  }

  const vueFiles = [
    ...new Set(
      (
        await Promise.all(componentDirs.map((dir) => collectVueFiles(dir)))
      ).flat()
    )
  ]

  if (vueFiles.length === 0) {
    console.warn(
      `No Vue files found in component directories:\n` +
        componentDirs.map((dir) => ` - ${dir}`).join('\n') +
        '\nGenerated an empty component registry.'
    )
  }

  const definitions = await generateDefinitions(vueFiles, helpers)
  await writeDefinitionsFile(definitions)

  console.log(`Generated ${definitions.length} component definitions for ${appName}.`)
}

run().catch((error) => {
  console.error('Failed to generate component registry:', error)
  process.exit(1)
})
