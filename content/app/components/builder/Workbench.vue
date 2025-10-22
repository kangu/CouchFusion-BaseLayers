<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import NodeEditor from './NodeEditor.vue'
import { useComponentRegistry } from '../../composables/useComponentRegistry'
import type { BuilderNode, BuilderNodeChild, BuilderTree } from '~/types/builder'
import {
  createDocumentFromTree,
  type MinimalContentDocument,
  type PageConfigInput,
  type SpacingPresetId
} from '../../utils/contentBuilder'

const cloneDocument = (doc: MinimalContentDocument | undefined | null) => {
  if (!doc) {
    return null
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(doc)
    } catch (error) {
      console.warn('Structured clone failed in Workbench, falling back to JSON clone:', error)
    }
  }
  return JSON.parse(JSON.stringify(doc)) as MinimalContentDocument
}

const PARAGRAPH_ALIGN_VALUES = ['left', 'center', 'right'] as const
type ParagraphAlignment = typeof PARAGRAPH_ALIGN_VALUES[number]
const DEFAULT_PARAGRAPH_ALIGN: ParagraphAlignment = 'left'

const isPlainObject = (value: unknown): value is Record<string, any> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const normalizeComponentId = (component: unknown): string | null => {
  if (typeof component !== 'string' || !component.trim()) {
    return null
  }

  if (component.includes('-')) {
    return component
  }

  return component
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()
}

const normaliseParagraphAlignment = (value: unknown): ParagraphAlignment | null => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim().toLowerCase()
  return PARAGRAPH_ALIGN_VALUES.includes(normalized as ParagraphAlignment)
    ? (normalized as ParagraphAlignment)
    : null
}

const extractParagraphAlignFromStyle = (style: unknown): ParagraphAlignment | null => {
  if (typeof style === 'string') {
    for (const token of style.split(';')) {
      if (!token) {
        continue
      }
      const [property, rawValue] = token.split(':')
      if (!property || !rawValue) {
        continue
      }
      if (property.trim().toLowerCase() === 'text-align') {
        const alignment = normaliseParagraphAlignment(rawValue)
        if (alignment) {
          return alignment
        }
      }
    }
    return null
  }

  if (isPlainObject(style)) {
    const candidate = style.textAlign ?? style['text-align']
    return normaliseParagraphAlignment(candidate)
  }

  return null
}

const stripParagraphAlignFromStyle = (style: unknown): unknown => {
  if (typeof style === 'string') {
    const filtered = style
      .split(';')
      .map((token) => token.trim())
      .filter((token) => token.length > 0 && token.split(':')[0]?.trim().toLowerCase() !== 'text-align')

    if (filtered.length === 0) {
      return undefined
    }

    return filtered.join('; ')
  }

  if (isPlainObject(style)) {
    const cleaned: Record<string, any> = {}
    for (const [key, value] of Object.entries(style)) {
      if (key === 'textAlign' || key === 'text-align') {
        continue
      }
      cleaned[key] = value
    }
    return Object.keys(cleaned).length > 0 ? cleaned : undefined
  }

  return style
}

const props = defineProps<{ initialDocument?: MinimalContentDocument | null }>()
const emit = defineEmits<{
  (e: 'document-change', document: MinimalContentDocument): void
}>()

const { registry, createNode, createTextNode } = useComponentRegistry()
const componentOptions = computed(() => registry.list)

const builderTree = ref<BuilderTree>([])
const pageConfig = reactive<PageConfigInput>({
  path: '/',
  title: 'Page title',
  seoTitle: 'Page title',
  seoDescription: 'SEO description.',
  navigation: true,
  extension: 'md',
  meta: {}
})

const layout = reactive<{ spacing: SpacingPresetId }>({ spacing: 'none' })
const previewSpacingClass = computed(() =>
  spacingPresets.find((preset) => preset.id === layout.spacing)?.className || ''
)

const selectedRootComponent = ref(componentOptions.value[0]?.id || '')
const draggingUid = ref<string | null>(null)
const dragOverUid = ref<string | null>(null)

const spacingPresets: Array<{ id: SpacingPresetId; label: string; className: string }> = [
  { id: 'none', label: 'No spacing', className: '' },
  { id: 'tight', label: 'Tight (16px)', className: 'space-tight' },
  { id: 'cozy', label: 'Cozy (32px)', className: 'space-cozy' },
  { id: 'roomy', label: 'Roomy (48px)', className: 'space-roomy' }
]

const normalizeJsonProps = (component: string, props: Record<string, unknown>) => {
  const definition = registry.lookup[component]
  if (!definition?.props?.length) {
    return props
  }

  for (const schema of definition.props) {
    const storageKey =
      schema.type === 'stringarray' || schema.type === 'jsonarray' ? `:${schema.key}` : schema.key
    const rawValue = props[schema.key] ?? props[storageKey]

    if (schema.type === 'json') {
      if (typeof rawValue === 'string') {
        const trimmed = rawValue.trim()

        if (!trimmed) {
          props[schema.key] = []
          continue
        }

        try {
          props[schema.key] = JSON.parse(trimmed)
        } catch (error) {
          console.warn(`Failed to parse JSON prop "${schema.key}" for component ${component}:`, error)
          // Keep original string so the editor can surface it for correction.
        }
      }
    }

    if (schema.type === 'jsonarray') {
      let serialized: string | undefined
      if (typeof rawValue === 'string') {
        serialized = rawValue
      } else if (Array.isArray(rawValue)) {
        serialized = JSON.stringify(rawValue)
      }

      if (serialized !== undefined) {
        props[storageKey] = serialized
      } else if (props[storageKey] === undefined) {
        props[storageKey] = '[]'
      }

      if (storageKey !== schema.key) {
        delete props[schema.key]
      }
      continue
    }

    if (schema.type === 'stringarray') {
      let serialized: string | undefined
      if (typeof rawValue === 'string') {
        serialized = rawValue
      } else if (Array.isArray(rawValue)) {
        serialized = JSON.stringify(rawValue.map((entry) => String(entry ?? '')))
      }

      if (serialized !== undefined) {
        props[storageKey] = serialized
      } else if (props[storageKey] === undefined) {
        props[storageKey] = '[]'
      }

      if (storageKey !== schema.key) {
        delete props[schema.key]
      }
      continue
    }
  }

  return props
}

const parseMarginClasses = (className: unknown): BuilderNode['margins'] | null => {
  if (typeof className !== 'string' || !className.trim()) {
    return null
  }

  const margins: BuilderNode['margins'] = {}
  const prefixMap: Record<string, 'sm' | 'md' | 'lg' | 'xl'> = {
    sm: 'sm',
    md: 'md',
    lg: 'lg',
    xl: 'xl'
  }

  for (const token of className.split(/\s+/)) {
    if (!token) {
      continue
    }
    const segments = token.split(':')
    const utility = segments.pop()
    if (!utility) {
      continue
    }
    const prefix = segments.pop() ?? 'base'
    const breakpoint = prefix === 'base' ? 'base' : prefixMap[prefix]
    if (!breakpoint) {
      continue
    }
    const [axis, value] = utility.split('-')
    if (!value) {
      continue
    }
    let side: keyof BuilderNode['margins'] | undefined
    if (axis === 'pt') {
      side = 'top'
    } else if (axis === 'pr') {
      side = 'right'
    } else if (axis === 'pb') {
      side = 'bottom'
    } else if (axis === 'pl') {
      side = 'left'
    }
    if (!side) {
      continue
    }
    if (!margins[side]) {
      margins[side] = {}
    }
    margins[side]![breakpoint] = value
  }

  return Object.keys(margins).length ? margins : null
}

const deserializeEntry = (entry: any): BuilderNodeChild | null => {
  if (entry === null || entry === undefined) {
    return null
  }
  if (typeof entry === 'string') {
    const textNode = createTextNode(entry)
    textNode.value = entry
    return textNode
  }
  if (Array.isArray(entry)) {
    const [rawComponent, rawProps = {}, ...children] = entry
    const component = normalizeComponentId(rawComponent)
    if (!component) {
      return null
    }
    if (component === 'content-margin-wrapper') {
      const [wrapped] = children
      const inner = deserializeEntry(wrapped)
      if (inner && inner.type === 'component') {
        const margins = parseMarginClasses((rawProps as Record<string, unknown>)?.class)
        if (margins) {
          inner.margins = margins
        }
      }
      return inner
    }
    const node = createNode(component)

    // Handle v-slot attributes for template components
    const processedProps: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(rawProps as Record<string, unknown>)) {
      if (component === 'template' && key.startsWith('v-slot:')) {
        // Convert v-slot:name back to slot prop
        processedProps.slot = key.replace('v-slot:', '')
      } else {
        processedProps[key] = value
      }
    }
    node.props = normalizeJsonProps(component, processedProps)

    if (component === 'p') {
      const alignFromProp = normaliseParagraphAlignment(node.props.align)
      const alignFromStyle = extractParagraphAlignFromStyle(node.props.style)
      const resolvedAlign = alignFromProp ?? alignFromStyle ?? DEFAULT_PARAGRAPH_ALIGN

      node.props.align = resolvedAlign

      const cleanedStyle = stripParagraphAlignFromStyle(node.props.style)
      if (cleanedStyle === undefined) {
        delete node.props.style
      } else {
        node.props.style = cleanedStyle
      }
    }

    node.children = children
      .map((child) => deserializeEntry(child))
      .filter((child): child is BuilderNodeChild => child !== null)
    return node
  }
  return null
}

const deserializeTree = (entries: any[]): BuilderTree => {
  if (!Array.isArray(entries)) {
    return []
  }
  return entries
    .map((entry) => deserializeEntry(entry))
    .filter((entry): entry is BuilderNodeChild => entry !== null)
}

const applyDocument = (doc: MinimalContentDocument | null) => {
  if (!doc) {
    builderTree.value = []
    pageConfig.path = '/'
    pageConfig.title = 'Page title'
    pageConfig.seoTitle = 'Page title'
    pageConfig.seoDescription = 'SEO description.'
    pageConfig.navigation = true
    pageConfig.extension = 'md'
    pageConfig.meta = {}
    layout.spacing = 'none'
    return
  }

  builderTree.value = deserializeTree(doc.body?.value ?? [])
  pageConfig.path = doc.path ?? '/'
  pageConfig.title = doc.title ?? ''
  pageConfig.seoTitle = doc.seo?.title ?? ''
  pageConfig.seoDescription = doc.seo?.description ?? ''
  pageConfig.navigation = doc.navigation ?? true
  pageConfig.extension = doc.extension ?? 'md'
  pageConfig.meta = doc.meta ?? {}
  layout.spacing = doc.layout?.spacing ?? 'none'
}

watch(
  () => props.initialDocument,
  (value) => {
    const cloned = cloneDocument(value)
    applyDocument(cloned)
  },
  { immediate: true }
)

const findNode = (nodes: BuilderNodeChild[], uid: string): BuilderNodeChild | null => {
  for (const node of nodes) {
    if (node.uid === uid) {
      return node
    }
    if (node.type === 'component') {
      const child = findNode(node.children, uid)
      if (child) {
        return child
      }
    }
  }
  return null
}

const addRootComponent = () => {
  if (!selectedRootComponent.value) {
    return
  }
  builderTree.value.push(createNode(selectedRootComponent.value))
}

const addRootText = () => {
  builderTree.value.push(createTextNode('New text'))
}

const updateNodeProp = (uid: string, key: string, value: unknown) => {
  const node = findNode(builderTree.value, uid)
  if (!node || node.type !== 'component') {
    return
  }
  const props = { ...node.props }
  if (value === '' || value === undefined || value === null) {
    delete props[key]
  } else {
    props[key] = value
  }
  node.props = props
}

const updateTextNode = (uid: string, value: string) => {
  const node = findNode(builderTree.value, uid)
  if (!node || node.type !== 'text') {
    return
  }
  node.value = value
}

const addChildComponent = (parentUid: string, componentId: string) => {
  const parent = findNode(builderTree.value, parentUid)
  if (!parent || parent.type !== 'component') {
    return
  }
  parent.children.push(createNode(componentId))
}

const addChildText = (parentUid: string) => {
  const parent = findNode(builderTree.value, parentUid)
  if (!parent || parent.type !== 'component') {
    return
  }
  parent.children.push(createTextNode('Text'))
}

const removeNode = (uid: string) => {
  const removeRecursive = (nodes: BuilderNodeChild[]): boolean => {
    const index = nodes.findIndex((node) => node.uid === uid)
    if (index !== -1) {
      nodes.splice(index, 1)
      return true
    }
    for (const node of nodes) {
      if (node.type === 'component' && removeRecursive(node.children)) {
        return true
      }
    }
    return false
  }

  removeRecursive(builderTree.value)
}

const moveRootNode = (dragUid: string | null, targetUid: string | null) => {
  if (!dragUid) {
    return
  }
  const items = builderTree.value
  const fromIndex = items.findIndex((node) => node.uid === dragUid)
  if (fromIndex === -1) {
    return
  }
  const [moved] = items.splice(fromIndex, 1)
  const targetIndex = targetUid ? items.findIndex((node) => node.uid === targetUid) : items.length
  const insertIndex = targetIndex === -1 ? items.length : targetIndex
  items.splice(insertIndex, 0, moved)
}

const handleDragStart = (uid: string) => {
  draggingUid.value = uid
}

const handleDragEnd = () => {
  draggingUid.value = null
  dragOverUid.value = null
}

const handleDragOver = (uid: string | null) => {
  if (draggingUid.value === uid) {
    return
  }
  dragOverUid.value = uid
}

const handleDrop = (uid: string | null) => {
  if (!draggingUid.value) {
    return
  }
  if (uid && uid === draggingUid.value) {
    handleDragEnd()
    return
  }
  moveRootNode(draggingUid.value, uid)
  handleDragEnd()
}

const serializedDocument = computed(() =>
  createDocumentFromTree(
    builderTree.value,
    {
      ...pageConfig,
      meta: pageConfig.meta ?? {}
    },
    { spacing: layout.spacing }
  )
)

let documentEmitTimeout: ReturnType<typeof setTimeout> | null = null

const scheduleDocumentEmit = (document: MinimalContentDocument) => {
  if (documentEmitTimeout) {
    clearTimeout(documentEmitTimeout)
  }

  documentEmitTimeout = setTimeout(() => {
    documentEmitTimeout = null
    try {
      const cloned = cloneDocument(document)
      if (cloned) {
        emit('document-change', cloned)
      }
    } catch (error) {
      console.error('Failed to emit document change', error)
    }
  }, 200)
}

watch(
  serializedDocument,
  (value) => {
    if (!value) {
      return
    }
    scheduleDocumentEmit(value)
  },
  { deep: true, immediate: true }
)

onBeforeUnmount(() => {
  if (documentEmitTimeout) {
    clearTimeout(documentEmitTimeout)
    documentEmitTimeout = null
  }
})

const serializedJson = computed(() => JSON.stringify(serializedDocument.value, null, 2))

const getSerializedDocument = (): MinimalContentDocument => {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(serializedDocument.value)
    } catch {}
  }

  return JSON.parse(JSON.stringify(serializedDocument.value)) as MinimalContentDocument
}

const loadDocument = (doc: MinimalContentDocument | null) => {
  const cloned = cloneDocument(doc)
  applyDocument(cloned)
}

defineExpose({
  getSerializedDocument,
  loadDocument
})

const importInputRef = ref<HTMLInputElement | null>(null)

const handleLoadDebugClick = () => {
  importInputRef.value?.click()
}

const handleDebugFile = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }
  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as MinimalContentDocument
    const cloned = cloneDocument(parsed)
    applyDocument(cloned)
  } catch (error) {
    console.error('Failed to load debug data', error)
  } finally {
    target.value = ''
  }
}

const getDocumentBlob = () =>
  new Blob([JSON.stringify(serializedDocument.value, null, 2)], {
    type: 'application/json;charset=utf-8'
  })

const makeDebugFilename = () => {
  const rawId = serializedDocument.value.id || 'builder-debug'
  const sanitized = rawId
    .toString()
    .replace(/[^a-z0-9-_]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const base = sanitized || 'builder-debug'
  return `${base}.json`
}

const handleSaveDebugClick = () => {
  const blob = getDocumentBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = makeDebugFilename()
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="builder-page">
    <section class="builder-controls">
      <h1>Content Builder MVP</h1>
      <div class="builder-config">
        <label>
          <span>Page path</span>
          <input v-model="pageConfig.path" type="text" placeholder="/" />
        </label>
        <label>
          <span>Page title</span>
          <input v-model="pageConfig.title" type="text" placeholder="Page title" />
        </label>
        <label>
          <span>SEO title</span>
          <input v-model="pageConfig.seoTitle" type="text" placeholder="SEO title" />
        </label>
        <label class="builder-config__textarea">
          <span>SEO description</span>
          <textarea v-model="pageConfig.seoDescription" rows="2" placeholder="SEO description." />
        </label>
      </div>
      <div class="builder-derived">
        <div>
          <span>Computed ID</span>
          <code>{{ serializedDocument.id }}</code>
        </div>
        <div>
          <span>Stem</span>
          <code>{{ serializedDocument.stem }}</code>
        </div>
      </div>

      <div class="builder-add">
        <select v-model="selectedRootComponent">
          <option disabled value="">Select component</option>
          <option v-for="component in componentOptions" :key="component.id" :value="component.id">
            {{ component.label }}
          </option>
        </select>
        <button type="button" @click="addRootComponent">Add top-level component</button>
        <button type="button" @click="addRootText">Add text node</button>
        <button type="button" class="builder-load" @click="handleLoadDebugClick">
          Load Debug Data
        </button>
        <button type="button" class="builder-save" @click="handleSaveDebugClick">
          Save Debug Data
        </button>
        <input
          ref="importInputRef"
          type="file"
          accept="application/json"
          hidden
          data-test="debug-import"
          @change="handleDebugFile"
        />
      </div>

      <div class="builder-layout">
        <label>
          <span>Spacing preset (dummy for now)</span>
          <select v-model="layout.spacing">
            <option v-for="preset in spacingPresets" :key="preset.id" :value="preset.id">
              {{ preset.label }}
            </option>
          </select>
        </label>
      </div>
    </section>

    <section class="builder-tree">
      <p v-if="!builderTree.length" class="builder-empty">No components added yet.</p>
      <div
        v-for="node in builderTree"
        :key="node.uid"
        class="builder-root-item"
        draggable="true"
        :data-dragging="draggingUid === node.uid"
        :data-drag-over="dragOverUid === node.uid"
        @dragstart="handleDragStart(node.uid)"
        @dragend="handleDragEnd"
        @dragover.prevent="handleDragOver(node.uid)"
        @drop.prevent="handleDrop(node.uid)"
      >
        <div class="builder-root-item__handle" aria-hidden="true">⇅</div>
        <NodeEditor
          :node="node"
          :registry="registry"
          :component-options="componentOptions"
          :on-update-prop="updateNodeProp"
          :on-update-text="updateTextNode"
          :on-add-child-component="addChildComponent"
          :on-add-child-text="addChildText"
          :on-remove="removeNode"
        />
      </div>
      <div
        v-if="builderTree.length"
        class="builder-root-dropzone"
        @dragover.prevent="handleDragOver(null)"
        @drop.prevent="handleDrop(null)"
      >
        Drop here to move to the end
      </div>
    </section>

<!--
    <section class="builder-output">
      <h2>Serialized Output</h2>
      <pre>{{ serializedJson }}</pre>
    </section>
-->

    <section class="builder-preview">
      <h2>Preview</h2>
      <div :class="['builder-preview__content', previewSpacingClass]">
        <ContentRenderer :value="serializedDocument" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.builder-page {
  display: grid;
  gap: 24px;
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.builder-controls {
  display: grid;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f8fafc;
}

.builder-config {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.builder-config label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.builder-config input,
.builder-config textarea {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #cbd5f5;
  font: inherit;
}

.builder-config__textarea textarea {
  min-height: 72px;
}

.builder-config__checkbox {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}

.builder-config__checkbox input {
  width: 18px;
  height: 18px;
}

.builder-derived {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  font-size: 0.9rem;
  color: #475569;
}

.builder-derived span {
  display: block;
  font-weight: 600;
  margin-bottom: 2px;
}

.builder-derived code {
  background: #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85rem;
}

.builder-add {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.builder-add select,
.builder-add button {
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #cbd5f5;
  background: #fff;
}

.builder-load {
  border-color: #334155;
  color: #334155;
}

.builder-save {
  border-color: #0f766e;
  color: #0f766e;
}

.builder-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.builder-layout label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.builder-layout select {
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #cbd5f5;
  background: #fff;
}

.builder-tree {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.builder-empty {
  color: #64748b;
}

.builder-root-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  border: 1px dashed transparent;
  border-radius: 8px;
  padding: 8px;
}

.builder-root-item[data-dragging='true'] {
  opacity: 0.5;
}

.builder-root-item[data-drag-over='true'] {
  border-color: #3b82f6;
  background: #f8fbff;
}

.builder-root-item__handle {
  cursor: grab;
  font-size: 1.25rem;
  line-height: 1;
  padding: 8px 4px;
  color: #94a3b8;
  user-select: none;
}

.builder-root-dropzone {
  border: 1px dashed #cbd5f5;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  color: #475569;
  background: #f8fafc;
}

.builder-output,
.builder-preview {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
}

.builder-output pre {
  white-space: pre-wrap;
  background: #0f172a;
  color: #f8fafc;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}

.builder-preview__content {
  display: flex;
  flex-direction: column;
}

.builder-preview__content.space-tight > :deep(* + *) {
  margin-top: 16px;
}

.builder-preview__content.space-cozy > :deep(* + *) {
  margin-top: 32px;
}

.builder-preview__content.space-roomy > :deep(* + *) {
  margin-top: 48px;
}
</style>
