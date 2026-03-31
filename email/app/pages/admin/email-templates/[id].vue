<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'

definePageMeta({
  middleware: ['admin-auth']
})

// Load MJML compiler only on this page
useHead({
  script: [
    {
      src: 'https://unpkg.com/mjml-browser@4.18.0/lib/index.js',
      defer: false,
    },
  ],
})

const route = useRoute()
const router = useRouter()
const { success: showSuccess, error: showError } = useEmailToast()

// Template name (stripped, without prefix)
const templateName = computed(() => String(route.params.id || ''))

interface EmailTemplateDocument {
  _id: string
  _rev?: string
  subject?: string
  mjml?: string
  html?: string
  params?: string[]
  editableMjmlBase?: string
  editableMjmlEntries?: unknown
  [key: string]: unknown
}

interface ExtractTextsResponse {
  success: boolean
  texts: string[]
  transformedMjml: string
  hrefLinks?: Array<{
    textPlaceholder: string
    hrefPlaceholder: string
    href: string
    tagName: string
  }>
}

interface EditableMjmlTextEntry {
  placeholder: string
  originalText: string
  value: string
  hrefPlaceholder: string | null
  hrefOriginal: string | null
  hrefValue: string
  hrefTag: string | null
  priorityTag: 'mj-title' | 'mj-preview' | null
  isPriority: boolean
}

const PLACEHOLDER_PATTERN = /{{\s*([\w.-]+)\s*}}/g

const extractPlaceholders = (...sources: Array<string | undefined | null>): string[] => {
  const params = new Set<string>()

  for (const source of sources) {
    if (!source || typeof source !== 'string') {
      continue
    }

    let match: RegExpExecArray | null
    while ((match = PLACEHOLDER_PATTERN.exec(source)) !== null) {
      const param = match[1]?.trim()
      if (param) {
        params.add(param)
      }
    }
  }

  return Array.from(params).sort((a, b) => a.localeCompare(b))
}

const requestHeaders = process.server ? useRequestHeaders(['cookie']) : undefined

const {
  data: templateResponse,
  pending: isTemplateLoading,
  error: templateError,
  refresh: refreshTemplate
} = await useAsyncData<{ success: boolean; template: EmailTemplateDocument }>(
  () => `admin-email-template-${templateName.value}`,
  async () => {
    return await $fetch(`/api/email-templates/${encodeURIComponent(templateName.value)}`, {
      credentials: 'include',
      headers: requestHeaders
    })
  },
  {
    watch: [templateName]
  }
)

const editorState = reactive({
  _id: '',
  _rev: '',
  subject: '',
  mjml: '',
  html: ''
})

useHead(() => ({
  title: editorState.subject ? `${editorState.subject} – Email Template` : 'Email Template – Admin',
  bodyAttrs: {
    'data-email-template-page': 'true'
  }
}))

const originalTemplate = ref<EmailTemplateDocument | null>(null)

const extractedParams = computed(() => extractPlaceholders(editorState.mjml, editorState.html))

const formatPlaceholderLabel = (value: string) => `{{ ${value} }}`

const hasUnsavedChanges = computed(() => {
  const template = originalTemplate.value
  if (!template) {
    return false
  }

  return (
    editorState.subject !== (template.subject ?? '') ||
    editorState.mjml !== (template.mjml ?? '') ||
    editorState.html !== (template.html ?? '')
  )
})

const isSaving = ref(false)
const isDetectingTexts = ref(false)
const editableMjmlTextEntries = ref<EditableMjmlTextEntry[]>([])
const transformedMjmlBase = ref('')
const hasAppliedFirstDetectedTransformation = ref(false)
const pendingAutoDetectOnLoad = ref(false)
const autoDetectedTemplateId = ref('')
const detectTextsError = ref<string | null>(null)
let renderDetectedInputsDebounceTimer: ReturnType<typeof setTimeout> | null = null
let autoDetectDebounceTimer: ReturnType<typeof setTimeout> | null = null
const AUTO_DETECT_DELAY = 1500 // 1.5 seconds debounce

const canSave = computed(() => hasUnsavedChanges.value && !isTemplateLoading.value && !isSaving.value)

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const resolvePriorityTag = (baseMjml: string, placeholder: string): 'mj-title' | 'mj-preview' | null => {
  if (!baseMjml || !placeholder) {
    return null
  }

  const escapedPlaceholder = escapeRegExp(`[${placeholder}]`)
  const titlePattern = new RegExp(`<mj-title\\b[^>]*>[\\s\\S]*?${escapedPlaceholder}[\\s\\S]*?<\\/mj-title>`, 'i')
  if (titlePattern.test(baseMjml)) {
    return 'mj-title'
  }

  const previewPattern = new RegExp(`<mj-preview\\b[^>]*>[\\s\\S]*?${escapedPlaceholder}[\\s\\S]*?<\\/mj-preview>`, 'i')
  if (previewPattern.test(baseMjml)) {
    return 'mj-preview'
  }

  return null
}

const attachPriorityMetadata = (entries: EditableMjmlTextEntry[], baseMjml: string): EditableMjmlTextEntry[] => {
  return entries.map((entry) => {
    const priorityTag = resolvePriorityTag(baseMjml, entry.placeholder)
    return {
      ...entry,
      priorityTag,
      isPriority: priorityTag !== null || Boolean(entry.hrefPlaceholder)
    }
  })
}

function sanitizeEditableMjmlEntries (value: unknown): EditableMjmlTextEntry[] {
  if (!Array.isArray(value)) {
    return []
  }

  const entries: EditableMjmlTextEntry[] = []
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }

    const placeholder = typeof (candidate as any).placeholder === 'string'
      ? (candidate as any).placeholder.trim()
      : ''
    const originalText = typeof (candidate as any).originalText === 'string'
      ? (candidate as any).originalText
      : ''
    const entryValue = typeof (candidate as any).value === 'string'
      ? (candidate as any).value
      : originalText
    const hrefPlaceholder = typeof (candidate as any).hrefPlaceholder === 'string'
      ? (candidate as any).hrefPlaceholder.trim() || null
      : null
    const hrefOriginal = typeof (candidate as any).hrefOriginal === 'string'
      ? (candidate as any).hrefOriginal
      : null
    const hrefValue = typeof (candidate as any).hrefValue === 'string'
      ? (candidate as any).hrefValue
      : (hrefOriginal ?? '')
    const hrefTag = typeof (candidate as any).hrefTag === 'string'
      ? (candidate as any).hrefTag
      : null

    if (!placeholder) {
      continue
    }

    entries.push({
      placeholder,
      originalText,
      value: entryValue,
      hrefPlaceholder,
      hrefOriginal,
      hrefValue,
      hrefTag,
      priorityTag: null,
      isPriority: false
    })
  }

  return entries
}

function renderMjmlFromEntries (baseMjml: string, entries: EditableMjmlTextEntry[]): string {
  if (!baseMjml || entries.length === 0) {
    return baseMjml
  }

  let nextMjml = baseMjml
  for (const entry of entries) {
    const token = `[${entry.placeholder}]`
    nextMjml = nextMjml.split(token).join(entry.value)

    if (entry.hrefPlaceholder) {
      const hrefToken = `[${entry.hrefPlaceholder}]`
      nextMjml = nextMjml.split(hrefToken).join(entry.hrefValue || '')
    }
  }

  return nextMjml
}

const applyTemplateToEditor = (template: EmailTemplateDocument | null) => {
  if (!template) {
    originalTemplate.value = null
    editorState._id = ''
    editorState._rev = ''
    editorState.subject = ''
    editorState.mjml = ''
    editorState.html = ''
    editableMjmlTextEntries.value = []
    transformedMjmlBase.value = ''
    hasAppliedFirstDetectedTransformation.value = false
    pendingAutoDetectOnLoad.value = false
    autoDetectedTemplateId.value = ''
    return
  }

  originalTemplate.value = template
  editorState._id = template._id
  editorState._rev = typeof template._rev === 'string' ? template._rev : ''
  editorState.subject = typeof template.subject === 'string' ? template.subject : ''
  editorState.mjml = typeof template.mjml === 'string' ? template.mjml : ''
  // Use the stored HTML from the template (server returns the saved HTML)
  editorState.html = typeof template.html === 'string' ? template.html : ''

  const persistedBase = typeof template.editableMjmlBase === 'string' ? template.editableMjmlBase : ''
  const persistedEntries = sanitizeEditableMjmlEntries(template.editableMjmlEntries)

  if (persistedBase && persistedEntries.length > 0) {
    transformedMjmlBase.value = persistedBase
    editableMjmlTextEntries.value = attachPriorityMetadata(persistedEntries, persistedBase)
    hasAppliedFirstDetectedTransformation.value = true
    // Only re-render MJML from entries if the current editor MJML matches the template's stored MJML
    // This prevents overwriting manual edits made to the raw MJML
    const templateMjml = typeof template.mjml === 'string' ? template.mjml : ''
    if (editorState.mjml === templateMjml || !editorState.mjml) {
      editorState.mjml = renderMjmlFromEntries(persistedBase, editableMjmlTextEntries.value)
    }
    pendingAutoDetectOnLoad.value = false
  } else {
    editableMjmlTextEntries.value = []
    transformedMjmlBase.value = ''
    hasAppliedFirstDetectedTransformation.value = false
    pendingAutoDetectOnLoad.value = Boolean(editorState.mjml.trim())
    autoDetectedTemplateId.value = ''
  }
}

watch(
  templateResponse,
  (response) => {
    applyTemplateToEditor(response?.template ?? null)
  },
  { immediate: true }
)

const compileError = ref<string | null>(null)
const isCompiling = ref(false)
const mjmlCompiler = shallowRef<null | ((source: string) => { html?: string; errors?: Array<{ message?: string }> })>(null)
const isMjmlEditorExpanded = ref(false)
const previewIframeRef = ref<HTMLIFrameElement | null>(null)
const previewSectionRef = ref<HTMLElement | null>(null)
const previewCardRef = ref<HTMLElement | null>(null)
const isPreviewFixed = ref(false)
const previewFixedStyle = ref<Record<string, string>>({})
const previewPlaceholderHeight = ref(0)
let previewFixTriggerY = 0
const pendingPreviewScrollRestore = ref<{ x: number; y: number } | null>(null)

const capturePreviewScrollPosition = () => {
  if (!process.client) {
    return
  }

  const previewWindow = previewIframeRef.value?.contentWindow
  if (!previewWindow) {
    return
  }

  pendingPreviewScrollRestore.value = {
    x: previewWindow.scrollX || 0,
    y: previewWindow.scrollY || 0
  }
}

const restorePreviewScrollPosition = () => {
  if (!process.client || !pendingPreviewScrollRestore.value) {
    return
  }

  const target = pendingPreviewScrollRestore.value
  const previewWindow = previewIframeRef.value?.contentWindow
  if (!previewWindow) {
    return
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      previewWindow.scrollTo(target.x, target.y)
      pendingPreviewScrollRestore.value = null
    })
  })
}

const onPreviewIframeLoad = () => {
  restorePreviewScrollPosition()
}

const resetPreviewFixedState = () => {
  isPreviewFixed.value = false
  previewFixedStyle.value = {}
  previewPlaceholderHeight.value = 0
}

const updatePreviewTrigger = () => {
  if (!process.client) {
    return
  }

  const card = previewCardRef.value
  if (!card) {
    return
  }

  if (isPreviewFixed.value) {
    return
  }

  const rect = card.getBoundingClientRect()
  previewFixTriggerY = rect.top + window.scrollY - 10
}

const applyPreviewFixedStyle = () => {
  if (!process.client) {
    return
  }

  const section = previewSectionRef.value
  const card = previewCardRef.value
  if (!section || !card) {
    return
  }

  const sectionRect = section.getBoundingClientRect()
  previewPlaceholderHeight.value = card.getBoundingClientRect().height
  previewFixedStyle.value = {
    top: '10px',
    left: `${sectionRect.left}px`,
    width: `${sectionRect.width}px`
  }
}

const syncPreviewFixedState = () => {
  if (!process.client) {
    return
  }

  const isDesktop = window.matchMedia('(min-width: 1024px)').matches
  if (!isDesktop) {
    resetPreviewFixedState()
    return
  }

  if (!previewCardRef.value) {
    return
  }

  const shouldFix = window.scrollY >= previewFixTriggerY

  if (shouldFix) {
    if (!isPreviewFixed.value) {
      applyPreviewFixedStyle()
    } else {
      applyPreviewFixedStyle()
    }
    isPreviewFixed.value = true
    return
  }

  if (isPreviewFixed.value) {
    resetPreviewFixedState()
    nextTick(() => {
      updatePreviewTrigger()
    })
  }
}

const onWindowScrollForPreview = () => {
  syncPreviewFixedState()
}

const onWindowResizeForPreview = () => {
  if (!process.client) {
    return
  }
  resetPreviewFixedState()
  nextTick(() => {
    updatePreviewTrigger()
    syncPreviewFixedState()
  })
}

const compileMjml = async (source: string) => {
  if (!mjmlCompiler.value) {
    return
  }

  isCompiling.value = true

  try {
    const result = mjmlCompiler.value(source)
    const compileErrors = result?.errors ?? []

    if (compileErrors.length > 0) {
      compileError.value = compileErrors
        .map(error => error.message)
        .filter(Boolean)
        .join('\n')
        || 'MJML compilation error.'
    } else {
      compileError.value = null
    }

    if (typeof result?.html === 'string') {
      capturePreviewScrollPosition()
      editorState.html = result.html
    }
  } catch (error: any) {
    compileError.value = error?.message || 'Failed to compile MJML.'
  } finally {
    isCompiling.value = false
  }
}

onMounted(async () => {
  if (!process.client) {
    return
  }

  try {
    // mjml-browser exposes window.mjml as a global UMD module
    // Check if it's already available, otherwise wait a bit for script to load
    const checkMjml = () => {
      const globalMjml = (window as any).mjml
      if (globalMjml && typeof globalMjml === 'function') {
        mjmlCompiler.value = globalMjml
        if (editorState.mjml) {
          compileMjml(editorState.mjml)
        }
        return true
      }
      return false
    }

    // Try immediately first
    if (!checkMjml()) {
      // If not available, poll for it (script might still be loading)
      let attempts = 0
      const interval = setInterval(() => {
        attempts++
        if (checkMjml() || attempts > 50) { // Stop after ~5 seconds
          clearInterval(interval)
          if (attempts > 50) {
            compileError.value = 'MJML compiler failed to load. Please refresh the page.'
          }
        }
      }, 100)
    }
  } catch (error: any) {
    compileError.value = error?.message || 'Failed to load MJML compiler.'
  }

  nextTick(() => {
    updatePreviewTrigger()
    syncPreviewFixedState()
  })

  window.addEventListener('scroll', onWindowScrollForPreview, { passive: true })
  window.addEventListener('resize', onWindowResizeForPreview, { passive: true })
})

onBeforeUnmount(() => {
  if (renderDetectedInputsDebounceTimer) {
    clearTimeout(renderDetectedInputsDebounceTimer)
    renderDetectedInputsDebounceTimer = null
  }

  if (!process.client) {
    return
  }
  window.removeEventListener('scroll', onWindowScrollForPreview)
  window.removeEventListener('resize', onWindowResizeForPreview)
})

// Compile MJML whenever it changes (but only if compiler is ready)
watch(
  () => editorState.mjml,
  async (value) => {
    detectTextsError.value = null

    if (!mjmlCompiler.value || !value) {
      return
    }
    await compileMjml(value)
  }
)

// Also compile when compiler becomes ready (in case data loaded first)
watch(
  mjmlCompiler,
  async (compiler) => {
    if (compiler && editorState.mjml) {
      await compileMjml(editorState.mjml)
    }
  },
  { immediate: false }
)

const saveTemplate = async () => {
  if (!editorState._id || !canSave.value) {
    return
  }

  isSaving.value = true

  try {
    const response = await $fetch<{ success: boolean; template: EmailTemplateDocument }>(
      `/api/email-templates/${encodeURIComponent(editorState._id)}`,
      {
        method: 'PUT',
        body: {
          _id: editorState._id,
          _rev: editorState._rev,
          subject: editorState.subject,
          mjml: editorState.mjml,
          html: editorState.html,
          editableMjmlBase: transformedMjmlBase.value || undefined,
          editableMjmlEntries: editableMjmlTextEntries.value,
          params: extractedParams.value
        }
      }
    )

    if (!response?.template) {
      throw new Error('Template save failed.')
    }

    applyTemplateToEditor(response.template)
    showSuccess('Template saved successfully.')
    await refreshTemplate()
  } catch (error: any) {
    const message = error?.statusMessage || error?.message || 'Failed to save template.'
    showError(message)
  } finally {
    isSaving.value = false
  }
}

const detectTextsFromMjml = async () => {
  if (!editorState.mjml.trim() || isDetectingTexts.value) {
    return
  }

  isDetectingTexts.value = true
  detectTextsError.value = null

  try {
    const response = await $fetch<ExtractTextsResponse>('/api/email-templates/extract-texts', {
      method: 'POST',
      body: {
        mjml: editorState.mjml
      }
    })

    const extractedTexts = Array.isArray(response?.texts) ? response.texts : []
    const transformedMjml = typeof response?.transformedMjml === 'string' ? response.transformedMjml : ''
    const hrefLinks = Array.isArray(response?.hrefLinks) ? response.hrefLinks : []

    const hrefPlaceholderSet = new Set(
      hrefLinks
        .map(link => (typeof link?.hrefPlaceholder === 'string' ? link.hrefPlaceholder.trim() : ''))
        .filter(Boolean)
    )
    const placeholders = extractBracketPlaceholders(transformedMjml)
      .filter(placeholder => !hrefPlaceholderSet.has(placeholder))
    const builtEntries = attachHrefLinksToEntries(
      buildEditableEntries(placeholders, extractedTexts),
      hrefLinks
    )
    const entriesWithPriority = attachPriorityMetadata(builtEntries, transformedMjml)
    editableMjmlTextEntries.value = entriesWithPriority
    transformedMjmlBase.value = transformedMjml

    if (!hasAppliedFirstDetectedTransformation.value && transformedMjml.trim()) {
      hasAppliedFirstDetectedTransformation.value = true
      editorState.mjml = renderMjmlFromEntries(transformedMjml, entriesWithPriority)
    }
  } catch (error: any) {
    editableMjmlTextEntries.value = []
    const message = error?.statusMessage || error?.message || 'Failed to detect editable texts.'
    detectTextsError.value = message
    showError(message)
  } finally {
    isDetectingTexts.value = false
  }
}

const discardChanges = () => {
  applyTemplateToEditor(originalTemplate.value)
}

const goBack = () => {
  router.push('/admin/email-templates')
}

const toggleMjmlEditor = () => {
  isMjmlEditorExpanded.value = !isMjmlEditorExpanded.value
}

const extractBracketPlaceholders = (mjml: string): string[] => {
  const found = new Set<string>()
  const placeholders: string[] = []
  const pattern = /\[([a-z0-9-]+)\]/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(mjml)) !== null) {
    const placeholder = match[1]?.trim()
    if (!placeholder || found.has(placeholder)) {
      continue
    }
    found.add(placeholder)
    placeholders.push(placeholder)
  }

  return placeholders
}

const buildEditableEntries = (placeholders: string[], texts: string[]): EditableMjmlTextEntry[] => {
  const length = Math.min(placeholders.length, texts.length)
  const entries: EditableMjmlTextEntry[] = []

  for (let index = 0; index < length; index++) {
    const originalText = texts[index] ?? ''
    const placeholder = placeholders[index] ?? ''
    if (!placeholder) {
      continue
    }

    entries.push({
      placeholder,
      originalText,
      value: originalText,
      hrefPlaceholder: null,
      hrefOriginal: null,
      hrefValue: '',
      hrefTag: null,
      priorityTag: null,
      isPriority: false
    })
  }

  return entries
}

const attachHrefLinksToEntries = (
  entries: EditableMjmlTextEntry[],
  hrefLinks: ExtractTextsResponse['hrefLinks']
): EditableMjmlTextEntry[] => {
  if (!entries.length || !Array.isArray(hrefLinks) || hrefLinks.length === 0) {
    return entries
  }

  const hrefByTextPlaceholder = new Map<string, { hrefPlaceholder: string, href: string, tagName: string }>()
  for (const link of hrefLinks) {
    if (!link || typeof link !== 'object') {
      continue
    }

    const textPlaceholder = typeof link.textPlaceholder === 'string' ? link.textPlaceholder.trim() : ''
    const hrefPlaceholder = typeof link.hrefPlaceholder === 'string' ? link.hrefPlaceholder.trim() : ''
    const href = typeof link.href === 'string' ? link.href : ''
    const tagName = typeof link.tagName === 'string' ? link.tagName : ''
    if (!textPlaceholder || !hrefPlaceholder) {
      continue
    }

    hrefByTextPlaceholder.set(textPlaceholder, { hrefPlaceholder, href, tagName })
  }

  return entries.map((entry) => {
    const hrefLink = hrefByTextPlaceholder.get(entry.placeholder)
    if (!hrefLink) {
      return entry
    }

    return {
      ...entry,
      hrefPlaceholder: hrefLink.hrefPlaceholder,
      hrefOriginal: hrefLink.href,
      hrefValue: hrefLink.href,
      hrefTag: hrefLink.tagName || null
    }
  })
}

const renderMjmlFromDetectedInputs = () => {
  if (!transformedMjmlBase.value || editableMjmlTextEntries.value.length === 0) {
    return
  }

  editorState.mjml = renderMjmlFromEntries(transformedMjmlBase.value, editableMjmlTextEntries.value)
}

const scheduleRenderMjmlFromDetectedInputs = () => {
  if (renderDetectedInputsDebounceTimer) {
    clearTimeout(renderDetectedInputsDebounceTimer)
  }

  renderDetectedInputsDebounceTimer = setTimeout(() => {
    renderDetectedInputsDebounceTimer = null
    renderMjmlFromDetectedInputs()
  }, 250)
}

watch(
  () => [pendingAutoDetectOnLoad.value, editorState._id, editorState.mjml, isDetectingTexts.value] as const,
  async ([shouldAutoDetect, templateId, mjml, detecting]) => {
    if (!shouldAutoDetect || detecting || !templateId || !mjml.trim()) {
      return
    }

    if (editableMjmlTextEntries.value.length > 0 || autoDetectedTemplateId.value === templateId) {
      pendingAutoDetectOnLoad.value = false
      return
    }

    autoDetectedTemplateId.value = templateId
    await detectTextsFromMjml()
    pendingAutoDetectOnLoad.value = false
  },
  { immediate: true }
)

// Auto-detect texts when MJML changes (debounced)
const scheduleAutoDetect = () => {
  if (autoDetectDebounceTimer) {
    clearTimeout(autoDetectDebounceTimer)
  }

  autoDetectDebounceTimer = setTimeout(() => {
    autoDetectDebounceTimer = null
    if (editorState.mjml.trim() && !isDetectingTexts.value) {
      detectTextsFromMjml()
    }
  }, AUTO_DETECT_DELAY)
}

// Watch for MJML changes and trigger auto-detect
watch(
  () => editorState.mjml,
  (newValue, oldValue) => {
    // Skip on initial load
    if (!oldValue) {
      return
    }

    // Schedule auto-detect when MJML changes
    scheduleAutoDetect()
  }
)

// Clean up timers on unmount
onBeforeUnmount(() => {
  if (autoDetectDebounceTimer) {
    clearTimeout(autoDetectDebounceTimer)
  }
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          @click="goBack"
        >
          <Icon name="mdi:arrow-left" class="mr-2 h-4 w-4" />
          Back to templates
        </button>
        <div>
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">Template</p>
          <p class="text-lg font-semibold text-gray-900">{{ editorState.subject || 'Loading…' }}</p>
          <p class="text-xs text-gray-500">{{ editorState._id }}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!hasUnsavedChanges"
          @click="discardChanges"
        >
          Discard
        </button>
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
          :disabled="!canSave"
          @click="saveTemplate"
        >
          <Icon
            v-if="isSaving"
            name="mdi:loading"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Save changes
        </button>
      </div>
    </div>

    <div
      v-if="templateError"
      class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ templateError.message || templateError.statusMessage || 'Failed to load template.' }}
    </div>

    <div
      v-if="isTemplateLoading && !templateResponse"
      class="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500 shadow-sm"
    >
      Loading template…
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-12">
      <section class="space-y-6 lg:col-span-5">
        <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div class="border-b border-gray-200 px-6 py-4">
            <h2 class="text-base font-semibold text-gray-900">MJML & HTML</h2>
            <p class="text-xs text-gray-500">MJML edits auto-compile into HTML; HTML is read-only.</p>
          </div>
          <div class="space-y-5 px-6 py-6">
            <div>
              <label class="block text-sm font-medium text-gray-700">Subject</label>
              <input
                v-model="editorState.subject"
                type="text"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Subject line"
              />
            </div>
            <div>
              <div class="flex items-center justify-between">
                <label class="block text-sm font-medium text-gray-700">MJML</label>
                <button
                  type="button"
                  class="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  @click="toggleMjmlEditor"
                >
                  {{ isMjmlEditorExpanded ? 'Hide MJML Editor' : 'Show MJML Editor' }}
                </button>
              </div>
              <ClientOnly v-if="isMjmlEditorExpanded">
                <Suspense>
                  <template #default>
                    <div
                      class="email-template-mjml-editor mt-1 overflow-hidden rounded-md border border-gray-300 shadow-sm"
                      style="height: min(60vh, 600px); min-height: 320px;"
                    >
                      <AdminPrismCodeJar
                        v-model="editorState.mjml"
                        class="text-sm"
                      />
                    </div>
                  </template>
                  <template #fallback>
                    <textarea
                      v-model="editorState.mjml"
                      class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      rows="14"
                      spellcheck="false"
                    />
                  </template>
                </Suspense>
              </ClientOnly>
              <p class="mt-1 text-xs text-gray-500">
                {{ isCompiling ? 'Compiling MJML…' : 'MJML will recompile automatically.' }}
              </p>
            </div>
          </div>
        </div>

        <div class="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 class="text-sm font-semibold text-gray-900">Dynamic parameters</h3>
            <p class="mt-1 text-xs text-gray-500">
              Detected placeholders render as <code v-pre>{{param}}</code>.
            </p>
            <ul class="mt-4 space-y-2">
            <li
              v-for="param in extractedParams"
              :key="param"
              class="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            >
              <Icon name="mdi:code-braces" class="h-4 w-4 text-gray-400" />
              <span class="font-mono text-xs text-gray-600">
                {{ formatPlaceholderLabel(param) }}
              </span>
            </li>
            <li
              v-if="extractedParams.length === 0"
              class="rounded border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500"
            >
              No dynamic parameters detected.
            </li>
          </ul>

          <div class="mt-5 border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between gap-3">
              <p class="text-xs text-gray-500">
                Detect editable text segments from current MJML and map them to distinct placeholders.
              </p>
              <button
                type="button"
                class="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="isDetectingTexts || !editorState.mjml.trim()"
                @click="detectTextsFromMjml"
              >
                <Icon
                  v-if="isDetectingTexts"
                  name="mdi:loading"
                  class="mr-1.5 h-3.5 w-3.5 animate-spin"
                />
                Detect texts from MJML
              </button>
            </div>

            <div
              v-if="detectTextsError"
              class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              {{ detectTextsError }}
            </div>

            <div class="mt-3 space-y-2">
              <div
                v-for="(entry, index) in editableMjmlTextEntries"
                :key="`${entry.placeholder}-${index}`"
                class="rounded border px-3 py-2"
                :class="entry.isPriority
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-gray-50'"
              >
                <p
                  v-if="entry.isPriority && entry.priorityTag"
                  class="mb-1 inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700"
                >
                  Priority · {{ entry.priorityTag }}
                </p>
                <label class="block text-[11px] font-mono text-gray-500">
                  [{{ entry.placeholder }}]
                </label>
                <input
                  v-model="entry.value"
                  type="text"
                  class="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  :placeholder="entry.originalText"
                  @input="scheduleRenderMjmlFromDetectedInputs"
                />
                <div v-if="entry.hrefPlaceholder" class="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-2">
                  <p class="inline-flex items-center rounded bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    Priority · {{ entry.hrefTag || 'link' }} href
                  </p>
                  <label class="mt-1 block text-[11px] font-mono text-gray-500">
                    [{{ entry.hrefPlaceholder }}] linked to [{{ entry.placeholder }}]
                  </label>
                  <input
                    v-model="entry.hrefValue"
                    type="text"
                    class="mt-1 block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    :placeholder="entry.hrefOriginal || ''"
                    @input="scheduleRenderMjmlFromDetectedInputs"
                  />
                </div>
              </div>
              <div
                v-if="!isDetectingTexts && editableMjmlTextEntries.length === 0"
                class="rounded border border-dashed border-gray-200 px-3 py-3 text-xs text-gray-500"
              >
                No editable texts detected yet. Click “Detect texts from MJML”.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref="previewSectionRef" class="lg:col-span-7">
        <div
          v-if="isPreviewFixed"
          :style="{ height: `${previewPlaceholderHeight}px` }"
          aria-hidden="true"
        />
        <div
          ref="previewCardRef"
          class="rounded-lg border border-gray-200 bg-white shadow-sm"
          :class="{ 'email-preview-fixed': isPreviewFixed }"
          :style="isPreviewFixed ? previewFixedStyle : undefined"
        >
          <div class="border-b border-gray-200 px-6 py-4">
            <h2 class="text-base font-semibold text-gray-900">HTML preview</h2>
            <p class="text-xs text-gray-500">Rendered email as it will be sent.</p>
          </div>
          <div class="max-h-[36rem] overflow-y-auto">
            <ClientOnly>
              <iframe
                ref="previewIframeRef"
                :srcdoc="editorState.html"
                class="w-full min-h-[500px]"
                sandbox="allow-scripts allow-same-origin"
                title="Email preview"
                @load="onPreviewIframeLoad"
              />
              <template #fallback>
                <div class="w-full min-h-[500px] flex items-center justify-center text-gray-400">
                  Loading preview...
                </div>
              </template>
            </ClientOnly>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.email-template-mjml-editor {
  position: relative;
}

.email-template-mjml-editor :deep(.prism-codejar) {
  height: 100%;
}

.email-template-mjml-editor :deep(.prism-codejar__editor),
.email-template-mjml-editor :deep(.prism-codejar__fallback) {
  overflow: auto;
}

.email-preview-fixed {
  position: fixed;
  z-index: 30;
}
</style>
