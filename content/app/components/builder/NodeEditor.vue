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
          <template v-else>
            <input
              v-model="propDraft[prop.key]"
              :placeholder="prop.placeholder"
              :type="prop.type === 'text' ? 'text' : 'text'"
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
import type { BuilderNodeChild, ComponentDefinition, ComponentRegistry } from '~/types/builder'

type PropInputType = 'text' | 'textarea' | 'boolean' | 'select' | 'json'

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

const definedPropKeys = computed(() => new Set(componentDef.value?.props?.map((prop) => prop.key) || []))

const extraPropEntries = computed(() => {
  if (props.node.type !== 'component') {
    return [] as Array<{ key: string; value: unknown }>
  }
  return Object.entries(props.node.props)
    .filter(([key]) => !definedPropKeys.value.has(key))
    .map(([key, value]) => ({ key, value }))
})

const getPropSchema = (key: string) => componentDef.value?.props?.find((prop) => prop.key === key)

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
      const rawValue = props.node.props?.[key]

      if (schema?.type === 'boolean') {
        propDraft[key] = Boolean(rawValue)
      } else if (schema?.type === 'json') {
        propDraft[key] = formatJsonValue(rawValue)
        jsonErrors[key] = null
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
  return value
}

const applyProp = (key: string, value: unknown, type: PropInputType) => {
  if (props.node.type !== 'component') {
    return
  }
  if (type === 'json') {
    const input = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    if (!input || !input.trim()) {
      jsonErrors[key] = null
      props.onUpdateProp(props.node.uid, key, [])
      return
    }

    try {
      const parsed = JSON.parse(input)
      jsonErrors[key] = null
      props.onUpdateProp(props.node.uid, key, parsed)
    } catch (error) {
      jsonErrors[key] = 'Invalid JSON'
    }
    return
  }

  const parsedValue = parseValueByType(value, type)
  jsonErrors[key] = null
  props.onUpdateProp(props.node.uid, key, parsedValue)
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
