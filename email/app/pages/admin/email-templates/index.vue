<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

definePageMeta({
  middleware: ['admin-auth']
})

useHead({
  title: 'Email Templates – Admin'
})

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

const router = useRouter()
const detailRouteName = 'admin-email-templates-id'
const { success: showSuccess, error: showError } = useEmailToast()

const requestHeaders = process.server ? useRequestHeaders(['cookie']) : undefined

const {
  data: templatesResponse,
  pending: isTemplatesLoading,
  error: templatesError,
  refresh: refreshTemplates
} = await useAsyncData<{
  success: boolean
  templates: EmailTemplateDocument[]
  total: number
}>('admin-email-templates', async () => {
  return await $fetch('/api/email-templates', {
    credentials: 'include',
    headers: requestHeaders
  })
})

const templates = computed(() => templatesResponse.value?.templates ?? [])
const loadError = computed(() => templatesError.value ? (templatesError.value.message || 'Failed to load email templates.') : null)

const placeholderDirectory = computed<Record<string, string[]>>(() => {
  const map: Record<string, string[]> = {}
  for (const template of templates.value) {
    map[template._id] = extractPlaceholders(template.mjml, template.html)
  }
  return map
})

const formatPlaceholderLabel = (value: string) => `{{ ${value} }}`

const navigateToTemplate = async (id: string) => {
  try {
    await router.push({ name: detailRouteName, params: { id } })
  } catch {
    await router.push(`/admin/email-templates/${encodeURIComponent(id)}`)
  }
}

const isCreateModalOpen = ref(false)
const isCreating = ref(false)
const createError = ref<string | null>(null)
const createModalMode = ref<'create' | 'clone'>('create')
const cloneSourceName = ref('')

const createForm = reactive({
  name: '',
  subject: '',
  mjml: '',
  html: '',
  editableMjmlBase: '',
  editableMjmlEntries: [] as unknown[]
})

const resetCreateForm = () => {
  createForm.name = ''
  createForm.subject = ''
  createForm.mjml = ''
  createForm.html = ''
  createForm.editableMjmlBase = ''
  createForm.editableMjmlEntries = []
  createModalMode.value = 'create'
  cloneSourceName.value = ''
  createError.value = null
}

const openCreateModal = () => {
  resetCreateForm()
  isCreateModalOpen.value = true
}

const openCloneModal = (template: EmailTemplateDocument) => {
  resetCreateForm()
  createModalMode.value = 'clone'
  cloneSourceName.value = template._id
  createForm.name = `${template._id}_copy`
  createForm.subject = typeof template.subject === 'string' ? template.subject : ''
  createForm.mjml = typeof template.mjml === 'string' ? template.mjml : ''
  createForm.html = typeof template.html === 'string' ? template.html : ''
  createForm.editableMjmlBase = typeof template.editableMjmlBase === 'string' ? template.editableMjmlBase : ''
  createForm.editableMjmlEntries = Array.isArray(template.editableMjmlEntries)
    ? template.editableMjmlEntries
    : []
  isCreateModalOpen.value = true
}

const closeCreateModal = () => {
  isCreateModalOpen.value = false
}

const submitCreateForm = async () => {
  if (isCreating.value) {
    return
  }

  const templateName = createForm.name.trim()

  if (!templateName) {
    createError.value = 'Template name is required'
    return
  }

  isCreating.value = true
  createError.value = null

  try {
    const response = await $fetch<{ success: boolean; template: EmailTemplateDocument }>(
      '/api/email-templates',
      {
        method: 'POST',
        body: {
          name: templateName,
          subject: createForm.subject,
          mjml: createForm.mjml,
          html: createForm.html,
          editableMjmlBase: createForm.editableMjmlBase || undefined,
          editableMjmlEntries: createForm.editableMjmlEntries
        }
      }
    )

    if (!response?.template) {
      throw new Error('Template creation failed')
    }

    closeCreateModal()
    showSuccess(createModalMode.value === 'clone' ? 'Template cloned successfully.' : 'Template created successfully.')
    await refreshTemplates()
    await navigateToTemplate(response.template._id)
  } catch (error: any) {
    const message = error?.statusMessage || error?.message || 'Failed to create template.'
    createError.value = message
    showError(message)
  } finally {
    isCreating.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Email templates</h1>
        <p class="mt-1 text-sm text-gray-600">
          Manage templated emails stored in CouchDB. Click a row to edit.
        </p>
      </div>
      <div>
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          @click="openCreateModal"
        >
          New template
        </button>
      </div>
    </div>

    <div
      v-if="loadError"
      class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      {{ loadError }}
    </div>

    <div class="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div>
          <p class="text-sm font-medium text-gray-500">Total templates</p>
          <p class="text-2xl font-semibold text-gray-900">{{ templates.length }}</p>
        </div>
        <div v-if="isTemplatesLoading" class="text-sm text-gray-500">Loading…</div>
      </div>

      <div v-if="templates.length > 0" class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Subject</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Name</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Placeholders</th>
              <th scope="col" class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 bg-white">
            <tr
              v-for="template in templates"
              :key="template._id"
              class="hover:bg-gray-50 cursor-pointer"
              @click="navigateToTemplate(template._id)"
            >
              <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                {{ template.subject || 'Untitled template' }}
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-gray-700">
                {{ template._id }}
              </td>
              <td class="px-6 py-4 text-sm text-gray-700">
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="param in placeholderDirectory[template._id] || []"
                    :key="param"
                    class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                  >
                    {{ formatPlaceholderLabel(param) }}
                  </span>
                  <span
                    v-if="(placeholderDirectory[template._id] || []).length === 0"
                    class="text-xs text-gray-500"
                  >
                    None
                  </span>
                </div>
              </td>
              <td class="whitespace-nowrap px-6 py-4 text-sm text-blue-600">
                <div class="flex items-center gap-3">
                  <NuxtLink
                    :to="{ name: detailRouteName, params: { id: template._id } }"
                    class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    @click.stop
                  >
                    <Icon name="mdi:open-in-new" class="h-4 w-4" />
                    Edit
                  </NuxtLink>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 text-gray-600 hover:text-gray-800"
                    @click.stop="openCloneModal(template)"
                  >
                    <Icon name="mdi:content-copy" class="h-4 w-4" />
                    Clone
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-else
        class="px-6 py-12 text-center text-sm text-gray-500"
      >
        No templates found. Create one to get started.
      </div>
    </div>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isCreateModalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      >
        <div class="w-full max-w-xl rounded-lg bg-white shadow-xl">
          <div class="border-b border-gray-200 px-6 py-4">
            <h2 class="text-lg font-semibold text-gray-900">
              {{ createModalMode === 'clone' ? 'Clone email template' : 'Create email template' }}
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              <template v-if="createModalMode === 'clone'">
                Create a new template by cloning <span class="font-medium text-gray-700">{{ cloneSourceName }}</span>.
              </template>
              <template v-else>
                Enter a unique name for your template.
              </template>
            </p>
          </div>
          <div class="px-6 py-5 space-y-5">
            <div>
              <label class="block text-sm font-medium text-gray-700">Template name</label>
              <input
                v-model="createForm.name"
                type="text"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g., welcome, reminder, newsletter"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">Subject (optional)</label>
              <input
                v-model="createForm.subject"
                type="text"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Email subject"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">MJML (optional)</label>
              <textarea
                v-model="createForm.mjml"
                rows="6"
                spellcheck="false"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700">HTML (optional)</label>
              <textarea
                v-model="createForm.html"
                rows="4"
                spellcheck="false"
                class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div
              v-if="createError"
              class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {{ createError }}
            </div>
          </div>
          <div class="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              @click="closeCreateModal"
            >
              Cancel
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-blue-300"
              :disabled="isCreating"
              @click="submitCreateForm"
            >
              <Icon
                v-if="isCreating"
                name="mdi:loading"
                class="mr-2 h-4 w-4 animate-spin"
              />
              {{ createModalMode === 'clone' ? 'Clone template' : 'Create template' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
