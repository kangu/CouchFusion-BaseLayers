<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import 'prismjs'
import 'prismjs/themes/prism.css'

const props = withDefaults(defineProps<{
  modelValue?: string
  language?: string
}>(), {
  modelValue: '',
  language: 'markup'
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const editorRef = ref<HTMLElement | null>(null)
const isReady = ref(false)
const initError = ref<string | null>(null)

let jar: {
  updateCode: (code: string) => void
  onUpdate: (cb: (code: string) => void) => void
  destroy?: () => void
} | null = null
let isInternalUpdate = false

const normalizeCode = (value: string | undefined) => String(value ?? '')

onMounted(async () => {
  if (!process.client || !editorRef.value) {
    return
  }

  try {
    const { CodeJar } = await import('codejar')
    const language = props.language || 'markup'
    const prismInstance: any = (globalThis as any).Prism
    const highlightLanguage = prismInstance.languages?.[language] || prismInstance.languages?.markup

    jar = CodeJar(editorRef.value, (editor) => {
      const code = editor.textContent || ''
      if (!prismInstance || !prismInstance.highlight || !highlightLanguage) {
        editor.textContent = code
        return
      }
      editor.innerHTML = prismInstance.highlight(code, highlightLanguage, language)
    })

    jar.updateCode(normalizeCode(props.modelValue))
    jar.onUpdate((code: string) => {
      isInternalUpdate = true
      emit('update:modelValue', code)
      requestAnimationFrame(() => {
        isInternalUpdate = false
      })
    })

    isReady.value = true
  } catch (error: any) {
    initError.value = error?.message || 'Failed to initialize code editor.'
  }
})

watch(
  () => props.modelValue,
  (value) => {
    if (!jar || isInternalUpdate) {
      return
    }

    const nextValue = normalizeCode(value)
    const currentValue = editorRef.value?.textContent ?? ''
    if (nextValue !== currentValue) {
      jar.updateCode(nextValue)
    }
  }
)

onBeforeUnmount(() => {
  jar?.destroy?.()
  jar = null
})
</script>

<template>
  <div class="prism-codejar">
    <pre
      v-show="isReady && !initError"
      ref="editorRef"
      class="prism-codejar__editor language-markup"
      spellcheck="false"
    />
    <textarea
      v-if="!isReady || initError"
      :value="modelValue"
      class="prism-codejar__fallback"
      spellcheck="false"
      @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    />
  </div>
</template>

<style scoped>
.prism-codejar {
  height: 100%;
  min-height: inherit;
}

.prism-codejar__editor,
.prism-codejar__fallback {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: inherit;
  margin: 0;
  padding: 0.75rem;
  border: 0;
  outline: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre;
  overflow: auto;
  background: #fff;
  color: #111827;
}

.prism-codejar__fallback {
  resize: none;
}
</style>
