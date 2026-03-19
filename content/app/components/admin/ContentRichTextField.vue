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

        <div
            class="rich-text-field__surface"
            :class="{ 'is-search-match': hasSearchMatch }"
            :data-placeholder="placeholder"
        >
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

        <div
            v-if="isLinkPopoverOpen"
            class="rich-text-field__popover-backdrop"
            @click.stop.prevent="closeLinkPopover"
        >
            <div
                class="rich-text-field__popover"
                @click.stop
            >
                <h3 class="rich-text-field__popover-title">
                    Edit Link
                </h3>
                <div class="rich-text-field__form">
                    <label class="rich-text-field__label">
                        URL
                        <input
                            ref="linkUrlInputRef"
                            v-model="linkForm.href"
                            class="rich-text-field__input"
                            type="text"
                            placeholder="https://example.com"
                        />
                    </label>
                    <label class="rich-text-field__label">
                        Target
                        <select
                            v-model="linkForm.target"
                            class="rich-text-field__input"
                        >
                            <option
                                v-for="option in linkTargetOptions"
                                :key="option || 'default'"
                                :value="option"
                            >
                                {{ option || "Default" }}
                            </option>
                        </select>
                    </label>
                    <label class="rich-text-field__label">
                        rel
                        <input
                            v-model="linkForm.rel"
                            class="rich-text-field__input"
                            type="text"
                            placeholder="noopener noreferrer"
                        />
                    </label>
                    <label class="rich-text-field__label">
                        Download filename
                        <input
                            v-model="linkForm.download"
                            class="rich-text-field__input"
                            type="text"
                            placeholder="brochure.pdf"
                        />
                    </label>
                </div>
                <div class="rich-text-field__actions">
                    <button
                        type="button"
                        class="rich-text-field__button-secondary"
                        @click="closeLinkPopover"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="rich-text-field__button-primary"
                        @click="applyLinkForm"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
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
import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { ComponentPropSchema } from "../../types/builder";
import { normalizeSearchQuery } from "../../utils/builderSearch";
import { sanitizeRichTextHtml } from "../../utils/rich-text";

const UPDATE_DEBOUNCE_MS = 250;
const SEARCH_HIT_CLASS = "rich-text-field__search-hit";
const SEARCH_HIGHLIGHT_META_KEY = "contentRichTextSearchHighlightRefresh";
const SEARCH_HIGHLIGHT_PLUGIN_KEY = new PluginKey<DecorationSet>(
    "contentRichTextSearchHighlight",
);

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
    Link: any;
} | null>(null);
const EditorContentComponent = shallowRef<any>(null);
const editor = shallowRef<any>(null);
const editorInstance = computed(() => editor.value);
const pendingExternalContent = ref<string | null>(null);

const lastEmitted = ref(sanitizeRichTextHtml(props.modelValue ?? ""));
const placeholder = computed(
    () => props.propDefinition?.placeholder ?? "Start typing…",
);
const description = computed(() => props.propDefinition?.description);
const normalizedSearchQuery = computed(() =>
    normalizeSearchQuery(
        typeof props.fieldContext?.searchQuery === "string"
            ? props.fieldContext.searchQuery
            : "",
    ),
);
const hasSearchMatch = computed(() => {
    if (!normalizedSearchQuery.value) {
        return false;
    }
    return lastEmitted.value.toLowerCase().includes(normalizedSearchQuery.value);
});

const isLinkPopoverOpen = ref(false);
const linkForm = ref({
    href: "",
    target: "",
    rel: "",
    download: "",
});
const linkUrlInputRef = ref<HTMLInputElement | null>(null);
const linkTargetOptions = ["", "_self", "_blank", "_parent", "_top"];

let updateTimer: ReturnType<typeof setTimeout> | null = null;

const buildSearchDecorations = (
    doc: ProseMirrorNode,
    query: string,
): DecorationSet => {
    if (!query) {
        return DecorationSet.empty;
    }
    const decorations: Decoration[] = [];
    doc.descendants((node, pos) => {
        if (!node.isText || !node.text) {
            return;
        }
        const lowerText = node.text.toLowerCase();
        let fromIndex = 0;
        let matchIndex = lowerText.indexOf(query, fromIndex);
        while (matchIndex !== -1) {
            decorations.push(
                Decoration.inline(
                    pos + matchIndex,
                    pos + matchIndex + query.length,
                    { class: SEARCH_HIT_CLASS },
                ),
            );
            fromIndex = matchIndex + query.length;
            matchIndex = lowerText.indexOf(query, fromIndex);
        }
    });
    return decorations.length
        ? DecorationSet.create(doc, decorations)
        : DecorationSet.empty;
};

const createSearchHighlightExtension = (getQuery: () => string) =>
    Extension.create({
        name: "contentSearchHighlight",
        addProseMirrorPlugins() {
            return [
                new Plugin({
                    key: SEARCH_HIGHLIGHT_PLUGIN_KEY,
                    state: {
                        init: (_config, state) =>
                            buildSearchDecorations(state.doc, getQuery()),
                        apply: (tr, previous, _oldState, newState) => {
                            const shouldRefresh =
                                tr.docChanged ||
                                tr.getMeta(SEARCH_HIGHLIGHT_META_KEY) === true;
                            if (!shouldRefresh) {
                                return previous.map(tr.mapping, tr.doc);
                            }
                            return buildSearchDecorations(
                                newState.doc,
                                getQuery(),
                            );
                        },
                    },
                    props: {
                        decorations(state) {
                            return SEARCH_HIGHLIGHT_PLUGIN_KEY.getState(state);
                        },
                    },
                }),
            ];
        },
    });

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
    if (!editorInstance.value) {
        pendingExternalContent.value = sanitized;
        return;
    }
    if (editorInstance.value.getHTML() !== sanitized) {
        editorInstance.value.commands.setContent(sanitized || "<p></p>", false, {
            preserveWhitespace: false,
        });
    }
    pendingExternalContent.value = null;
};

watch(
    () => props.modelValue,
    (value) => {
        syncExternalValue(value);
    },
    { immediate: true },
);

watch(
    normalizedSearchQuery,
    () => {
        if (!editorInstance.value) {
            return;
        }
        editorInstance.value.view.dispatch(
            editorInstance.value.state.tr.setMeta(
                SEARCH_HIGHLIGHT_META_KEY,
                true,
            ),
        );
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
    {
        key: "link",
        label: "Link",
        command: () => {
            if (!editorInstance.value) return;
            const existing = editorInstance.value.getAttributes("link") ?? {};
            linkForm.value = {
                href: existing?.href ?? "",
                target: existing?.target ?? "",
                rel: existing?.rel ?? "",
                download: existing?.download ?? "",
            };
            isLinkPopoverOpen.value = true;
            requestAnimationFrame(() => {
                linkUrlInputRef.value?.focus();
                linkUrlInputRef.value?.select();
            });
        },
        isActive: () => editorInstance.value?.isActive("link"),
    },
]);

const createEditor = () => {
    const mods = editorModules.value;
    if (!mods || editor.value) {
        return;
    }

    const EnhancedLink = mods.Link.extend({
        addAttributes() {
            return {
                ...this.parent?.(),
                target: {
                    default: null,
                    parseHTML: (element: HTMLElement) =>
                        element.getAttribute("target"),
                    renderHTML: (attributes: Record<string, any>) =>
                        attributes.target ? { target: attributes.target } : {},
                },
                rel: {
                    default: null,
                    parseHTML: (element: HTMLElement) =>
                        element.getAttribute("rel"),
                    renderHTML: (attributes: Record<string, any>) =>
                        attributes.rel ? { rel: attributes.rel } : {},
                },
                download: {
                    default: null,
                    parseHTML: (element: HTMLElement) =>
                        element.getAttribute("download"),
                    renderHTML: (attributes: Record<string, any>) =>
                        attributes.download
                            ? { download: attributes.download }
                            : {},
                },
            };
        },
    });

    editor.value = new mods.Editor({
        content: lastEmitted.value || "<p></p>",
        extensions: [
            mods.StarterKit.configure({
                heading: {
                    levels: [1, 2, 3],
                },
                link: false,
            }),
            EnhancedLink.configure({
                openOnClick: false,
                autolink: false,
                linkOnPaste: false,
            }),
            createSearchHighlightExtension(() => normalizedSearchQuery.value),
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
        onCreate: ({ editor }) => {
            const queued = pendingExternalContent.value;
            if (queued === null) {
                return;
            }
            const next = queued || "<p></p>";
            if (editor.getHTML() !== next) {
                editor.commands.setContent(next, false, {
                    preserveWhitespace: false,
                });
            }
            pendingExternalContent.value = null;
        },
    });
};

const applyLinkForm = () => {
    if (!editorInstance.value) return;
    const href = linkForm.value.href.trim();
    const target = linkForm.value.target.trim();
    const rel = linkForm.value.rel.trim();
    const download = linkForm.value.download.trim();

    runEditorCommand((ed) => {
        if (!href) {
            ed.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }
        const payload: Record<string, string> = { href };
        if (target) payload.target = target;
        if (rel) payload.rel = rel;
        if (download) payload.download = download;

        ed.chain().focus().extendMarkRange("link").setLink(payload).run();
    });

    isLinkPopoverOpen.value = false;
};

const closeLinkPopover = () => {
    isLinkPopoverOpen.value = false;
};

onMounted(async () => {
    if (editorModules.value) {
        createEditor();
        return;
    }

    const [{ EditorContent, Editor }, { default: StarterKit }, { Link }] = await Promise.all([
        import("@tiptap/vue-3"),
        import("@tiptap/starter-kit"),
        import("@tiptap/extension-link"),
    ]);

    editorModules.value = { EditorContent, Editor, StarterKit, Link };
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

.rich-text-field__surface.is-search-match {
    border-color: #93c5fd;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18);
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

.rich-text-field__content :deep(.rich-text-field__search-hit) {
    background: rgba(250, 204, 21, 0.35);
    border-radius: 2px;
}

.rich-text-field__description {
    color: #6b7280;
    font-size: 0.85rem;
}

.rich-text-field__popover-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
}

.rich-text-field__popover {
    width: min(440px, 92vw);
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    box-shadow: 0 12px 35px rgba(0, 0, 0, 0.14);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.rich-text-field__popover-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: #111827;
}

.rich-text-field__form {
    display: grid;
    gap: 0.5rem;
}

.rich-text-field__label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
    color: #111827;
}

.rich-text-field__input {
    border: 1px solid #d1d5db;
    border-radius: 6px;
    padding: 0.45rem 0.6rem;
    font-size: 0.95rem;
    outline: none;
}

.rich-text-field__input:focus {
    border-color: #111827;
    box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.08);
}

.rich-text-field__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}

.rich-text-field__button-secondary,
.rich-text-field__button-primary {
    border-radius: 6px;
    padding: 0.45rem 0.8rem;
    cursor: pointer;
    border: 1px solid transparent;
}

.rich-text-field__button-secondary {
    background: #f3f4f6;
    border-color: #e5e7eb;
    color: #111827;
}

.rich-text-field__button-primary {
    background: #111827;
    border-color: #111827;
    color: #fff;
}
</style>
