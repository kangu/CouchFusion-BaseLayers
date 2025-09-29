<template>
  <div class="node-panel" :style="{ marginLeft: depth * 16 + 'px' }">
    <div v-if="node.type === 'component'" class="node-panel__header">
      <div>
        <strong>{{ componentDef?.label || node.component }}</strong>
        <span v-if="componentDef?.description" class="node-panel__description">{{ componentDef.description }}</span>
      </div>
      <button class="node-panel__remove" type="button" @click="onRemove(node.uid)">
        Remove
      </button>
    </div>

    <div v-if="node.type === 'component'" class="node-panel__body">
      <div v-if="componentDef?.props?.length" class="node-panel__props">
        <label v-for="prop in componentDef.props" :key="prop.key" class="node-panel__field">
          <span>{{ prop.label }}</span>
          <template v-if="prop.type === 'textarea'">
            <textarea
              v-model="propDraft[prop.key]"
              :placeholder="prop.placeholder"
              rows="3"
              @change="() => applyProp(prop.key, propDraft[prop.key], prop.type)"
              @blur="() => applyProp(prop.key, propDraft[prop.key], prop.type)"
            />
          </template>
          <template v-else-if="prop.type === 'boolean'">
            <input
              type="checkbox"
              :checked="Boolean(propDraft[prop.key])"
              @change="(event: Event) => applyProp(prop.key, (event.target as HTMLInputElement).checked, prop.type)"
            />
          </template>
          <template v-else-if="prop.type === 'select'">
            <select
              v-model="propDraft[prop.key]"
              @change="() => applyProp(prop.key, propDraft[prop.key], prop.type)"
            >
              <option disabled value="">Select</option>
              <option v-for="option in prop.options || []" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </template>
          <template v-else-if="prop.type === 'json'">
            <textarea
              v-model="propDraft[prop.key]"
              class="font-mono"
              rows="6"
              @change="() => applyProp(prop.key, propDraft[prop.key], prop.type)"
              @blur="() => applyProp(prop.key, propDraft[prop.key], prop.type)"
            />
            <small v-if="jsonErrors[prop.key]" class="node-panel__error">{{ jsonErrors[prop.key] }}</small>
          </template>
          <template v-else-if="prop.type === 'jsonarray'">
            <div class="node-panel__array">
              <div
                v-for="(item, index) in propDraft[prop.key]"
                :key="`${prop.key}-${index}`"
                class="node-panel__array-item"
                :class="{
                  'node-panel__array-item--drag-over':
                    dragOverArrayItem?.propKey === prop.key && dragOverArrayItem.index === index
                }"
                draggable="true"
                @dragstart.stop="(event) => handleArrayItemDragStart(prop.key, index, 'jsonarray', event)"
                @dragenter.stop.prevent="() => handleArrayItemDragEnter(prop.key, index)"
                @dragover.stop.prevent="() => handleArrayItemDragEnter(prop.key, index)"
                @dragleave.stop="handleArrayItemDragLeave"
                @drop.stop.prevent="() => handleArrayItemDrop(prop.key, index, 'jsonarray')"
                @dragend.stop="handleArrayItemDragEnd"
              >
                <div class="node-panel__array-fields">
                  <label
                    v-for="field in prop.items || []"
                    :key="field.key"
                    class="node-panel__field node-panel__field--nested"
                  >
                    <span>{{ field.label }}</span>
                    <template v-if="field.type === 'textarea'">
                      <textarea
                        v-model="item[field.key]"
                        rows="3"
                        @change="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                        @blur="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                      />
                    </template>
                    <template v-else-if="field.type === 'boolean'">
                      <input
                        type="checkbox"
                        :checked="Boolean(item[field.key])"
                        @change="(event: Event) => handleArrayItemFieldChange(prop.key, index, field, (event.target as HTMLInputElement).checked)"
                      />
                    </template>
                    <template v-else-if="field.type === 'number'">
                      <input
                        v-model.number="item[field.key]"
                        type="number"
                        @change="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                        @blur="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                      />
                    </template>
                    <template v-else>
                      <input
                        v-model="item[field.key]"
                        type="text"
                        @change="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                        @blur="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
                      />
                    </template>
                  </label>
                </div>
                <button
                  type="button"
                  class="node-panel__array-remove"
                  @click="removeArrayItem(prop.key, index)"
                >
                  Remove item
                </button>
              </div>
              <button
                type="button"
                class="node-panel__array-add"
                @click="addArrayItem(prop)"
              >
                Add item
              </button>
            </div>
          </template>
          <template v-else-if="prop.type === 'stringarray'">
            <div class="node-panel__array">
              <div
                v-for="(value, index) in propDraft[prop.key]"
                :key="`${prop.key}-${index}`"
                class="node-panel__array-item"
                :class="{
                  'node-panel__array-item--drag-over':
                    dragOverArrayItem?.propKey === prop.key && dragOverArrayItem.index === index
                }"
                draggable="true"
                @dragstart.stop="(event) => handleArrayItemDragStart(prop.key, index, 'stringarray', event)"
                @dragenter.stop.prevent="() => handleArrayItemDragEnter(prop.key, index)"
                @dragover.stop.prevent="() => handleArrayItemDragEnter(prop.key, index)"
                @dragleave.stop="handleArrayItemDragLeave"
                @drop.stop.prevent="() => handleArrayItemDrop(prop.key, index, 'stringarray')"
                @dragend.stop="handleArrayItemDragEnd"
              >
                <label class="node-panel__field">
                  <span>{{ prop.label }} {{ index + 1 }}</span>
                  <input
                    v-model="propDraft[prop.key][index]"
                    type="text"
                    @change="() => handleStringArrayChange(prop.key, index, propDraft[prop.key][index])"
                    @blur="() => handleStringArrayChange(prop.key, index, propDraft[prop.key][index])"
                  />
                </label>
                <button
                  type="button"
                  class="node-panel__array-remove"
                  @click="removeStringArrayItem(prop.key, index)"
                >
                  Remove item
                </button>
              </div>
              <button
                type="button"
                class="node-panel__array-add"
                @click="addStringArrayItem(prop.key)"
              >
                Add item
              </button>
            </div>
          </template>
          <template v-else>
            <input
              v-model="propDraft[prop.key]"
              :placeholder="prop.placeholder"
              :type="prop.type === 'number' ? 'number' : 'text'"
              @change="() => applyProp(prop.key, propDraft[prop.key], prop.type)"
              @blur="() => applyProp(prop.key, propDraft[prop.key], prop.type)"
            />
          </template>
          <small v-if="prop.description">{{ prop.description }}</small>
        </label>
      </div>

      <div v-if="extraPropEntries.length" class="node-panel__props">
        <label v-for="entry in extraPropEntries" :key="entry.key" class="node-panel__field">
          <span>{{ entry.key }}</span>
          <input
            v-model="extraPropsDraft[entry.key]"
            type="text"
            @change="() => applyProp(entry.key, extraPropsDraft[entry.key], 'text')"
            @blur="() => applyProp(entry.key, extraPropsDraft[entry.key], 'text')"
          />
        </label>
      </div>

      <form class="node-panel__new-prop" @submit.prevent="handleAddCustomProp">
        <div>
          <input v-model="newPropKey" placeholder="Prop key (e.g. theme)" />
        </div>
        <div>
          <input v-model="newPropValue" placeholder="Value" />
        </div>
        <button type="submit">Add prop</button>
      </form>

      <div v-if="componentDef?.allowChildren" class="node-panel__children">
        <div class="node-panel__children-actions">
          <select v-model="selectedChildComponent">
            <option disabled value="">Select component</option>
            <option
              v-for="option in componentOptions"
              :key="option.id"
              :value="option.id"
            >
              {{ option.label }}
            </option>
          </select>
          <button
            type="button"
            :disabled="!selectedChildComponent"
            @click="handleAddChildComponent"
          >
            Add child component
          </button>
          <button type="button" @click="onAddChildText(node.uid)">
            Add text child
          </button>
        </div>
        <p v-if="componentDef.childHint" class="node-panel__hint">{{ componentDef.childHint }}</p>
        <NodeEditor
          v-for="child in node.children"
          :key="child.uid"
          :node="child"
          :registry="registry"
          :component-options="componentOptions"
          :depth="depth + 1"
          :on-update-prop="onUpdateProp"
          :on-update-text="onUpdateText"
          :on-add-child-component="onAddChildComponent"
          :on-add-child-text="onAddChildText"
          :on-remove="onRemove"
        />
      </div>
    </div>

    <div v-else class="node-panel__text">
      <label class="node-panel__field">
        <span>Text value</span>
        <textarea
          v-model="textDraft"
          rows="2"
          @change="applyTextValue"
          @blur="applyTextValue"
        />
      </label>
      <button class="node-panel__remove" type="button" @click="onRemove(node.uid)">
        Remove
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type {
  BuilderNodeChild,
  ComponentArrayItemField,
  ComponentDefinition,
  ComponentPropSchema,
  ComponentRegistry
} from '~/types/builder'

type PropInputType =
  | 'text'
  | 'textarea'
  | 'boolean'
  | 'select'
  | 'json'
  | 'jsonarray'
  | 'stringarray'
  | 'number'

const props = defineProps<{
  node: BuilderNodeChild
  registry: ComponentRegistry
  componentOptions: ComponentDefinition[]
  depth?: number
  onUpdateProp: (uid: string, key: string, value: unknown) => void
  onUpdateText: (uid: string, value: string) => void
  onAddChildComponent: (parentUid: string, componentId: string) => void
  onAddChildText: (parentUid: string) => void
  onRemove: (uid: string) => void
}>()

const depth = computed(() => props.depth ?? 0)

const componentDef = computed(() =>
  props.node.type === 'component' ? props.registry.lookup[props.node.component] : undefined
)

const propDraft = reactive<Record<string, any>>({})
const extraPropsDraft = reactive<Record<string, string>>({})
const jsonErrors = reactive<Record<string, string | null>>({})
const textDraft = ref(props.node.type === 'text' ? props.node.value : '')
const selectedChildComponent = ref('')
const newPropKey = ref('')
const newPropValue = ref('')
const draggingArrayItem = ref<{ propKey: string; index: number; type: 'jsonarray' | 'stringarray' } | null>(
  null
)
const dragOverArrayItem = ref<{ propKey: string; index: number } | null>(null)

const storageKeyForType = (key: string, type: PropInputType | ComponentPropSchema['type']) =>
  type === 'stringarray' || type === 'jsonarray' ? `:${key}` : key

const definedPropKeys = computed(() => {
  const keys = new Set<string>()
  for (const prop of componentDef.value?.props || []) {
    keys.add(prop.key)
    keys.add(storageKeyForType(prop.key, prop.type))
  }
  return keys
})

const extraPropEntries = computed(() => {
  if (props.node.type !== 'component') {
    return [] as Array<{ key: string; value: unknown }>
  }
  return Object.entries(props.node.props)
    .filter(([key]) => !definedPropKeys.value.has(key))
    .map(([key, value]) => ({ key, value }))
})

const getPropSchema = (key: string) => componentDef.value?.props?.find((prop) => prop.key === key)

const cloneValue = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const ensureArrayValue = (value: unknown): Array<Record<string, any>> => {
  if (Array.isArray(value)) {
    return value.map((entry) => ({ ...entry }))
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => ({ ...entry }))
      }
    } catch (error) {
      console.warn('Failed to parse JSON array draft value:', error)
    }
  }
  return []
}

const ensureStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry ?? ''))
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => String(entry ?? ''))
      }
    } catch (error) {
      console.warn('Failed to parse string array draft value:', error)
    }
  }
  return []
}

const createEmptyArrayItem = (fields: ComponentArrayItemField[]) => {
  const item: Record<string, unknown> = {}
  for (const field of fields) {
    if (field.type === 'boolean') {
      item[field.key] = false
    } else if (field.type === 'number') {
      item[field.key] = 0
    } else {
      item[field.key] = ''
    }
  }
  return item
}

const formatJsonValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) {
      return ''
    }
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    } catch (error) {
      return value
    }
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return ''
  }
}

const hydrateDrafts = () => {
  for (const key of Object.keys(propDraft)) {
    delete propDraft[key]
  }
  for (const key of Object.keys(extraPropsDraft)) {
    delete extraPropsDraft[key]
  }
  for (const key of Object.keys(jsonErrors)) {
    delete jsonErrors[key]
  }

  if (props.node.type === 'component') {
    for (const key of definedPropKeys.value) {
      const schema = getPropSchema(key)
      const storageKey = schema ? storageKeyForType(schema.key, schema.type) : key
      const rawValue = props.node.props?.[storageKey] ?? props.node.props?.[key]

      if (schema?.type === 'boolean') {
        propDraft[key] = Boolean(rawValue)
      } else if (schema?.type === 'json') {
        propDraft[key] = formatJsonValue(rawValue)
        jsonErrors[key] = null
      } else if (schema?.type === 'jsonarray') {
        propDraft[key] = ensureArrayValue(rawValue ?? [])
      } else if (schema?.type === 'stringarray') {
        propDraft[key] = ensureStringArray(rawValue ?? [])
      } else {
        propDraft[key] = rawValue ?? ''
      }
    }
    for (const entry of extraPropEntries.value) {
      extraPropsDraft[entry.key] = String(entry.value ?? '')
    }
  } else {
    textDraft.value = props.node.value
  }
}

watch(
  () => props.node,
  () => {
    hydrateDrafts()
  },
  { immediate: true, deep: true }
)

const parseValueByType = (value: unknown, type: PropInputType) => {
  if (type === 'boolean') {
    return Boolean(value)
  }
  if (type === 'number') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return value
}

const applyProp = (key: string, value: unknown, type: PropInputType) => {
  if (props.node.type !== 'component') {
    return
  }
  const storageKey = storageKeyForType(key, type)
  if (type === 'json') {
    const input = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    if (!input || !input.trim()) {
      jsonErrors[key] = null
      props.onUpdateProp(props.node.uid, storageKey, [])
      return
    }

    try {
      const parsed = JSON.parse(input)
      jsonErrors[key] = null
      props.onUpdateProp(props.node.uid, storageKey, parsed)
    } catch (error) {
      jsonErrors[key] = 'Invalid JSON'
    }
    return
  }

  if (type === 'jsonarray') {
    const normalized = ensureArrayValue(value)
    jsonErrors[key] = null
    props.onUpdateProp(props.node.uid, storageKey, JSON.stringify(normalized))
    if (storageKey !== key) {
      props.onUpdateProp(props.node.uid, key, undefined)
    }
    return
  }

  if (type === 'stringarray') {
    const normalized = ensureStringArray(value)
    jsonErrors[key] = null
    props.onUpdateProp(props.node.uid, storageKey, JSON.stringify(normalized))
    if (storageKey !== key) {
      props.onUpdateProp(props.node.uid, key, undefined)
    }
    return
  }

  const parsedValue = parseValueByType(value, type)
  jsonErrors[key] = null
  props.onUpdateProp(props.node.uid, key, parsedValue)
}

const normalizeArrayFieldValue = (field: ComponentArrayItemField, value: unknown) => {
  if (field.type === 'boolean') {
    return Boolean(value)
  }
  if (field.type === 'number') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return typeof value === 'string' ? value : value ?? ''
}

const handleArrayItemFieldChange = (
  propKey: string,
  index: number,
  field: ComponentArrayItemField,
  rawValue: unknown
) => {
  if (!Array.isArray(propDraft[propKey])) {
    propDraft[propKey] = []
  }
  const current = ensureArrayValue(propDraft[propKey])
  const next = current.map((item) => ({ ...item }))
  if (!next[index]) {
    next[index] = createEmptyArrayItem(field ? [field] : [])
  }
  next[index][field.key] = normalizeArrayFieldValue(field, rawValue)
  propDraft[propKey] = next
  applyProp(propKey, next, 'jsonarray')
}

const addArrayItem = (schema: ComponentPropSchema) => {
  if (!schema.items || !schema.items.length) {
    return
  }
  const key = schema.key
  const current = ensureArrayValue(propDraft[key])
  const next = [...current, createEmptyArrayItem(schema.items)]
  propDraft[key] = next
  applyProp(key, next, 'jsonarray')
}

const removeArrayItem = (propKey: string, index: number) => {
  const current = ensureArrayValue(propDraft[propKey])
  current.splice(index, 1)
  propDraft[propKey] = current
  applyProp(propKey, current, 'jsonarray')
}

const handleStringArrayChange = (propKey: string, index: number, rawValue: unknown) => {
  const current = ensureStringArray(propDraft[propKey])
  current[index] = String(rawValue ?? '')
  propDraft[propKey] = current
  applyProp(propKey, current, 'stringarray')
}

const addStringArrayItem = (propKey: string) => {
  const current = ensureStringArray(propDraft[propKey])
  current.push('')
  propDraft[propKey] = current
  applyProp(propKey, current, 'stringarray')
}

const removeStringArrayItem = (propKey: string, index: number) => {
  const current = ensureStringArray(propDraft[propKey])
  current.splice(index, 1)
  propDraft[propKey] = current
  applyProp(propKey, current, 'stringarray')
}

const handleArrayItemDragStart = (
  propKey: string,
  index: number,
  type: 'jsonarray' | 'stringarray',
  event: DragEvent
) => {
  draggingArrayItem.value = { propKey, index, type }
  dragOverArrayItem.value = { propKey, index }
  event.dataTransfer?.setData('text/plain', `${propKey}:${index}`)
  event.dataTransfer?.setDragImage?.((event.target as HTMLElement) || new Image(), 0, 0)
}

const handleArrayItemDragEnter = (propKey: string, index: number) => {
  if (!draggingArrayItem.value) {
    return
  }
  if (draggingArrayItem.value.propKey !== propKey) {
    return
  }
  dragOverArrayItem.value = { propKey, index }
}

const handleArrayItemDragLeave = () => {
  dragOverArrayItem.value = null
}

const reorderArrayItems = (
  propKey: string,
  fromIndex: number,
  toIndex: number,
  type: 'jsonarray' | 'stringarray'
) => {
  if (fromIndex === toIndex) {
    return
  }

  if (type === 'jsonarray') {
    const current = ensureArrayValue(propDraft[propKey])
    if (!current[fromIndex]) {
      return
    }
    const [moved] = current.splice(fromIndex, 1)
    current.splice(toIndex, 0, moved)
    propDraft[propKey] = current
    applyProp(propKey, current, 'jsonarray')
    return
  }

  const current = ensureStringArray(propDraft[propKey])
  if (fromIndex < 0 || fromIndex >= current.length) {
    return
  }
  const [moved] = current.splice(fromIndex, 1)
  current.splice(toIndex, 0, moved)
  propDraft[propKey] = current
  applyProp(propKey, current, 'stringarray')
}

const handleArrayItemDrop = (
  propKey: string,
  index: number,
  type: 'jsonarray' | 'stringarray'
) => {
  if (!draggingArrayItem.value) {
    return
  }
  const { propKey: sourceKey, index: sourceIndex, type: sourceType } = draggingArrayItem.value
  if (sourceKey !== propKey || sourceType !== type) {
    draggingArrayItem.value = null
    dragOverArrayItem.value = null
    return
  }

  reorderArrayItems(propKey, sourceIndex, index, type)
  draggingArrayItem.value = null
  dragOverArrayItem.value = null
}

const handleArrayItemDragEnd = () => {
  draggingArrayItem.value = null
  dragOverArrayItem.value = null
}

const handleAddChildComponent = () => {
  if (!selectedChildComponent.value) {
    return
  }
  props.onAddChildComponent(props.node.uid, selectedChildComponent.value)
  selectedChildComponent.value = ''
}

const handleAddCustomProp = () => {
  if (!newPropKey.value.trim()) {
    return
  }
  props.onUpdateProp(props.node.uid, newPropKey.value.trim(), newPropValue.value)
  newPropKey.value = ''
  newPropValue.value = ''
}

const applyTextValue = () => {
  if (props.node.type !== 'text') {
    return
  }
  props.onUpdateText(props.node.uid, textDraft.value)
}
</script>

<style scoped>
.node-panel {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  background: #fff;
}

.node-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.node-panel__description {
  display: block;
  font-size: 0.875rem;
  color: #64748b;
}

.node-panel__remove {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
}

.node-panel__body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-panel__props {
  display: grid;
  gap: 8px;
}

.node-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-panel__field input,
.node-panel__field textarea,
.node-panel__field select {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #cbd5f5;
}

.node-panel__field--nested {
  background: #f8fafc;
  padding: 8px;
  border: 1px dashed #cbd5f5;
}

.node-panel__array {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.node-panel__array-item {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: move;
}

.node-panel__array-fields {
  display: grid;
  gap: 8px;
}

.node-panel__array-item--drag-over {
  border-color: #2563eb;
  background: #eff6ff;
}

.node-panel__array-add {
  align-self: flex-start;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
}

.node-panel__array-remove {
  align-self: flex-start;
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
}

.node-panel__children {
  margin-top: 8px;
}

.node-panel__error {
  color: #ef4444;
  font-size: 0.75rem;
}

.node-panel__children-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.node-panel__hint {
  font-size: 0.8rem;
  color: #64748b;
  margin: 8px 0;
}

.node-panel__new-prop {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.node-panel__new-prop input {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #cbd5f5;
}

.node-panel__new-prop button {
  padding: 6px 12px;
}

.node-panel__text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
