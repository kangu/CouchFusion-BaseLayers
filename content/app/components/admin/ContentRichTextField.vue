<template>
    <div class="rich-text-field" @click.stop.prevent="absorbPointerEvent">
        <div class="rich-text-field__toolbar">
            <button
                v-for="action in toolbarActions"
                :key="action.key"
                class="rich-text-field__button"
                :class="{ 'is-active': action.isActive?.() }"
                type="button"
                :title="action.label"
                :disabled="!editorInstance"
                @click="action.command"
            >
                {{ action.label }}
            </button>
        </div>

        <div class="rich-text-field__surface" :data-placeholder="placeholder">
            <component
                v-if="EditorContentComponent"
                :is="EditorContentComponent"
                class="rich-text-field__content"
                :editor="editorInstance"
            />
        </div>

        <p v-if="description" class="rich-text-field__description">
            {{ description }}
        </p>
    </div>
</template>

<script setup lang="ts">
import {
    computed,
    onBeforeUnmount,
    onMounted,
    ref,
    shallowRef,
    watch,
} from "vue";
import type { ComponentPropSchema } from "~/types/builder";
import { sanitizeRichTextHtml } from "~/utils/rich-text";

const UPDATE_DEBOUNCE_MS = 250;

const props = defineProps<{
    modelValue?: string;
    propDefinition?: ComponentPropSchema;
    fieldContext?: Record<string, unknown>;
}>();

const emit = defineEmits<{
    (event: "update:modelValue", value: string): void;
}>();

const editorModules = shallowRef<{
    EditorContent: any;
    Editor: any;
    StarterKit: any;
} | null>(null);
const EditorContentComponent = shallowRef<any>(null);
const editor = shallowRef<any>(null);
const editorInstance = computed(() => editor.value);

const lastEmitted = ref(sanitizeRichTextHtml(props.modelValue ?? ""));
const placeholder = computed(
    () => props.propDefinition?.placeholder ?? "Start typing…",
);
const description = computed(() => props.propDefinition?.description);

let updateTimer: ReturnType<typeof setTimeout> | null = null;

const absorbPointerEvent = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
};

const emitSanitizedChange = (value: string) => {
    const sanitized = sanitizeRichTextHtml(value);
    if (sanitized === lastEmitted.value) {
        return;
    }
    lastEmitted.value = sanitized;
    if (updateTimer) {
        clearTimeout(updateTimer);
    }
    updateTimer = setTimeout(() => {
        emit("update:modelValue", sanitized);
    }, UPDATE_DEBOUNCE_MS);
};

const syncExternalValue = (value: string | undefined) => {
    const sanitized = sanitizeRichTextHtml(value ?? "");
    lastEmitted.value = sanitized;
    if (editorInstance.value && editorInstance.value.getHTML() !== sanitized) {
        editorInstance.value.commands.setContent(sanitized || "<p></p>", false, {
            preserveWhitespace: false,
        });
    }
};

watch(
    () => props.modelValue,
    (value) => {
        syncExternalValue(value);
    },
);

const runEditorCommand = (
    fn: (editor: NonNullable<typeof editorInstance.value>) => void,
) => {
    if (!editorInstance.value) {
        return;
    }
    fn(editorInstance.value);
    emitSanitizedChange(editorInstance.value.getHTML());
};

const toolbarActions = computed(() => [
    {
        key: "bold",
        label: "B",
        command: () =>
            runEditorCommand((ed) => ed.chain().focus().toggleBold().run()),
        isActive: () => editorInstance.value?.isActive("bold"),
    },
    {
        key: "italic",
        label: "I",
        command: () =>
            runEditorCommand((ed) => ed.chain().focus().toggleItalic().run()),
        isActive: () => editorInstance.value?.isActive("italic"),
    },
    {
        key: "strike",
        label: "S",
        command: () =>
            runEditorCommand((ed) => ed.chain().focus().toggleStrike().run()),
        isActive: () => editorInstance.value?.isActive("strike"),
    },
    {
        key: "heading2",
        label: "H2",
        command: () =>
            runEditorCommand((ed) =>
                ed.chain().focus().toggleHeading({ level: 2 }).run(),
            ),
        isActive: () => editorInstance.value?.isActive("heading", { level: 2 }),
    },
    {
        key: "bullet",
        label: "•",
        command: () =>
            runEditorCommand((ed) =>
                ed.chain().focus().toggleBulletList().run(),
            ),
        isActive: () => editorInstance.value?.isActive("bulletList"),
    },
    {
        key: "ordered",
        label: "1.",
        command: () =>
            runEditorCommand((ed) =>
                ed.chain().focus().toggleOrderedList().run(),
            ),
        isActive: () => editorInstance.value?.isActive("orderedList"),
    },
    {
        key: "quote",
        label: "“”",
        command: () =>
            runEditorCommand((ed) =>
                ed.chain().focus().toggleBlockquote().run(),
            ),
        isActive: () => editorInstance.value?.isActive("blockquote"),
    },
    {
        key: "code",
        label: "</>",
        command: () =>
            runEditorCommand((ed) =>
                ed.chain().focus().toggleCodeBlock().run(),
            ),
        isActive: () => editorInstance.value?.isActive("codeBlock"),
    },
]);

const createEditor = () => {
    const mods = editorModules.value;
    if (!mods || editor.value) {
        return;
    }

    editor.value = new mods.Editor({
        content: lastEmitted.value || "<p></p>",
        extensions: [
            mods.StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
            }),
        ],
        editorProps: {
            attributes: {
                class: "ProseMirror-focused-target",
                spellcheck: "true",
            },
        },
        onUpdate: ({ editor }) => {
            emitSanitizedChange(editor.getHTML());
        },
    });
};

onMounted(async () => {
    if (editorModules.value) {
        createEditor();
        return;
    }

    const [{ EditorContent, Editor }, { default: StarterKit }] = await Promise.all([
        import("@tiptap/vue-3"),
        import("@tiptap/starter-kit"),
    ]);

    editorModules.value = { EditorContent, Editor, StarterKit };
    EditorContentComponent.value = EditorContent;
    createEditor();
});

onBeforeUnmount(() => {
    if (updateTimer) {
        clearTimeout(updateTimer);
    }
    editor.value?.destroy();
    editor.value = null;
});
</script>

<style scoped>
.rich-text-field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.rich-text-field__toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
}

.rich-text-field__button {
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    color: #111827;
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    cursor: pointer;
}

.rich-text-field__button.is-active {
    background: #111827;
    color: #fff;
}

.rich-text-field__button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.rich-text-field__surface {
    border: 1px solid #d1d5db;
    border-radius: 8px;
    min-height: 180px;
    padding: 0.75rem;
    background: #fff;
}

.rich-text-field__surface:focus-within {
    border-color: #111827;
    box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.1);
}

.rich-text-field__surface[data-placeholder]:not(:focus-within)
    :deep(.ProseMirror) {
    position: relative;
}

.rich-text-field__surface[data-placeholder]:not(:focus-within)
    :deep(.ProseMirror:empty)::before {
    color: #9ca3af;
    content: attr(data-placeholder);
    left: 0.75rem;
    pointer-events: none;
    position: absolute;
}

.rich-text-field__content :deep(.ProseMirror) {
    min-height: 150px;
    outline: none;
    white-space: pre-wrap;
    ol {
        padding-left: 1.25rem;
        list-style-position: outside;
        list-style-type: decimal;
    }
    ul {
        padding-left: 1.25rem;
        list-style-position: outside;
        list-style-type: disc;
    }
}

.rich-text-field__content :deep(.ProseMirror p),
.rich-text-field__content :deep(.ProseMirror h1),
.rich-text-field__content :deep(.ProseMirror h2),
.rich-text-field__content :deep(.ProseMirror h3),
.rich-text-field__content :deep(.ProseMirror ul),
.rich-text-field__content :deep(.ProseMirror ol),
.rich-text-field__content :deep(.ProseMirror pre),
.rich-text-field__content :deep(.ProseMirror blockquote) {
    margin: 0 0 0.75rem;
}

.rich-text-field__content :deep(.ProseMirror code) {
    background: #1f2937;
    color: #f9fafb;
    padding: 0.125rem 0.25rem;
    border-radius: 4px;
    font-size: 0.85rem;
}

.rich-text-field__content :deep(.ProseMirror pre) {
    background: #111827;
    color: #f9fafb;
    padding: 0.75rem;
    border-radius: 6px;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    overflow-x: auto;
}

.rich-text-field__description {
    color: #6b7280;
    font-size: 0.85rem;
}
</style>
