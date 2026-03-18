<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, reactive, ref, shallowRef, watch } from 'vue'

definePageMeta({
  layout: 'admin-workspace',
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
  [key: string]: unknown
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

const canSave = computed(() => hasUnsavedChanges.value && !isTemplateLoading.value && !isSaving.value)

const applyTemplateToEditor = (template: EmailTemplateDocument | null) => {
  if (!template) {
    originalTemplate.value = null
    editorState._id = ''
    editorState._rev = ''
    editorState.subject = ''
    editorState.mjml = ''
    editorState.html = ''
    return
  }

  originalTemplate.value = template
  editorState._id = template._id
  editorState._rev = typeof template._rev === 'string' ? template._rev : ''
  editorState.subject = typeof template.subject === 'string' ? template.subject : ''
  editorState.mjml = typeof template.mjml === 'string' ? template.mjml : ''
  // Use the stored HTML from the template (server returns the saved HTML)
  editorState.html = typeof template.html === 'string' ? template.html : ''
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
const codeMirrorExtensions = ref<any[]>([])
const CodeMirror = defineAsyncComponent(() => import('vue-codemirror').then(module => module.Codemirror))

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

  try {
    const { xml } = await import('@codemirror/lang-xml')
    codeMirrorExtensions.value = [xml()]
  } catch (error) {
    console.warn('Failed to load CodeMirror XML extensions', error)
  }
})

// Compile MJML whenever it changes (but only if compiler is ready)
watch(
  () => editorState.mjml,
  async (value) => {
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

const discardChanges = () => {
  applyTemplateToEditor(originalTemplate.value)
}

const goBack = () => {
  router.push('/admin/email-templates')
}
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
              <label class="block text-sm font-medium text-gray-700">MJML</label>
              <ClientOnly>
                <Suspense>
                  <template #default>
                    <div class="mt-1 overflow-auto rounded-md border border-gray-300 shadow-sm" style="max-height: 600px;">
                      <CodeMirror
                        v-model="editorState.mjml"
                        :extensions="codeMirrorExtensions"
                        :tab-size="2"
                        :basic="true"
                        class="text-sm"
                        style="min-height: 320px;"
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
                {{ isCompiling ? 'Compiling MJML…' : compileError ? 'MJML has compile issues; preview may be outdated.' : 'MJML will recompile automatically.' }}
              </p>
              <div
                v-if="compileError"
                class="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700"
              >
                {{ compileError }}
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">HTML (read-only)</label>
              <textarea
                v-model="editorState.html"
                readonly
                class="mt-1 block w-full cursor-not-allowed rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm shadow-sm focus:border-blue-300 focus:outline-none"
                rows="10"
                spellcheck="false"
              />
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
        </div>
      </section>

      <section class="lg:col-span-7 lg:sticky lg:top-4 lg:self-start">
        <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div class="border-b border-gray-200 px-6 py-4">
            <h2 class="text-base font-semibold text-gray-900">HTML preview</h2>
            <p class="text-xs text-gray-500">Rendered email as it will be sent.</p>
          </div>
          <div class="max-h-[36rem] overflow-y-auto">
            <ClientOnly>
              <iframe
                :srcdoc="editorState.html"
                class="w-full min-h-[500px]"
                sandbox="allow-scripts"
                title="Email preview"
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
:global(body[data-email-template-page='true'] main.flex-1) {
  overflow: visible;
}
</style>
