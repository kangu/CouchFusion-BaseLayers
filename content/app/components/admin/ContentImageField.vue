<template>
    <div class="image-field">
        <div class="image-field__preview" v-if="previewUrl">
            <img :src="previewUrl" alt="" loading="lazy" />
            <button
                type="button"
                class="image-field__clear"
                @click="clearImage"
                :disabled="pending"
            >
                Remove
            </button>
        </div>

        <div class="image-field__controls">
            <input
                v-model="localValue"
                type="text"
                class="image-field__input"
                :placeholder="placeholder"
                :disabled="pending"
                @change="commitValue"
                @blur="commitValue"
            />
            <div class="image-field__actions">
                <button
                    type="button"
                    class="image-field__button"
                    @click="openLibrary"
                    :disabled="pending"
                >
                    Browse
                </button>
                <button
                    type="button"
                    class="image-field__button"
                    @click="triggerUpload"
                    :disabled="pending"
                >
                    Upload
                </button>
            </div>
        </div>

        <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="sr-only"
            @change="handleFileChange"
        />

        <Transition name="fade">
            <div
                v-if="isLibraryOpen"
                class="image-field__library-backdrop"
                @click.self="closeLibrary"
            >
                <div class="image-field__library">
                    <header class="image-field__library-header">
                        <h3>Select Image</h3>
                        <button
                            type="button"
                            class="image-field__close"
                            @click="closeLibrary"
                        >
                            ✕
                        </button>
                    </header>
                    <div class="image-field__library-controls">
                        <input
                            v-model="searchTerm"
                            type="search"
                            placeholder="Search by name, tag, or path"
                            @keyup.enter="searchLibrary"
                        />
                        <button
                            type="button"
                            @click="searchLibrary"
                            :disabled="isLibraryLoading"
                        >
                            Search
                        </button>
                    </div>
                    <div
                        v-if="displayedCountLabel"
                        class="image-field__library-summary"
                    >
                        <span class="image-field__library-count">{{
                            displayedCountLabel
                        }}</span>
                        <button
                            v-if="canShowAll"
                            type="button"
                            class="image-field__button image-field__button--ghost"
                            @click="showAllImages"
                            :disabled="isLibraryLoading"
                        >
                            Show All
                        </button>
                    </div>
                    <div class="image-field__library-body">
                        <p v-if="libraryError" class="image-field__error">
                            {{ libraryError }}
                        </p>
                        <p
                            v-else-if="isLibraryLoading"
                            class="image-field__hint"
                        >
                            Loading images…
                        </p>
                        <p
                            v-else-if="libraryItems.length === 0"
                            class="image-field__hint"
                        >
                            No images found. Try uploading a new file.
                        </p>
                        <ul v-else class="image-field__library-grid">
                            <li
                                v-for="item in libraryItems"
                                :key="item.fileId ?? item.filePath"
                                class="image-field__library-card"
                            >
                                <div class="image-field__library-thumbnail">
                                    <img
                                        :src="
                                            item.thumbnailUrl ||
                                            item.url ||
                                            buildPreviewUrl(item.filePath)
                                        "
                                        alt=""
                                        loading="lazy"
                                    />
                                </div>
                                <div class="image-field__library-meta">
                                    <strong class="image-field__library-name">{{
                                        item.name || item.filePath
                                    }}</strong>
                                    <small class="image-field__library-path">{{
                                        item.filePath
                                    }}</small>
                                </div>
                                <button
                                    type="button"
                                    class="image-field__button image-field__button--primary"
                                    @click="selectFromLibrary(item)"
                                >
                                    Use Image
                                </button>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </Transition>

        <p v-if="error" class="image-field__error">{{ error }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRuntimeConfig } from "#imports";
import type {
    ComponentArrayItemField,
    ComponentPropSchema,
} from "#content/app/types/builder";
import type {
    ImageKitFile,
    ImageKitUploadResult,
} from "#imagekit/utils/imagekit";
import { useImageKit } from "#imagekit/composables/useImageKit";
import { resolveImageKitUrl } from "#imagekit/utils/transform";

interface FieldContext {
    propKey: string;
    arrayIndex?: number;
    nestedFieldKey?: string;
    nestedIndex?: number;
}

interface Props {
    modelValue?: string;
    propDefinition: ComponentPropSchema | ComponentArrayItemField;
    fieldContext?: FieldContext;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (event: "update:modelValue", value: string | undefined): void;
}>();

const runtimeConfig = useRuntimeConfig();
const { uploadImage, getImageList } = useImageKit();

const localValue = ref(props.modelValue ?? "");
const error = ref<string | null>(null);
const pending = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const isLibraryOpen = ref(false);
const isLibraryLoading = ref(false);
const libraryItems = ref<ImageKitFile[]>([]);
const libraryError = ref<string | null>(null);
const searchTerm = ref("");
const DEFAULT_LIBRARY_LIMIT = 30;
const MAX_LIBRARY_LIMIT = 1000;
const libraryLimit = ref<number>(DEFAULT_LIBRARY_LIMIT);
const libraryTotal = ref(0);

const folderHint = computed(() => {
    const candidate =
        props.propDefinition?.ui && typeof props.propDefinition.ui === "object"
            ? (props.propDefinition.ui as Record<string, unknown>).folder
            : undefined;
    return typeof candidate === "string" && candidate.trim()
        ? candidate.trim()
        : "content-editor";
});

const placeholder = computed(
    () => props.propDefinition?.description || "Enter ImageKit file path",
);

const urlEndpoint = computed(
    () => runtimeConfig.public?.imagekit?.urlEndpoint || "",
);

const previewUrl = computed(() => buildPreviewUrl(localValue.value));
const displayedCountLabel = computed(() => {
    if (!libraryTotal.value) {
        return "";
    }

    const displayed = libraryItems.value.length;
    return `Displaying ${displayed} of ${libraryTotal.value} images`;
});
const canShowAll = computed(() => {
    return (
        libraryTotal.value > 0 && libraryItems.value.length < libraryTotal.value
    );
});

const normalizeFolder = (value: string) => value.replace(/^\/+/, "");

const isImageKitPath = (value?: string | null) => {
    if (!value) {
        return false;
    }
    if (/^https?:\/\//i.test(value)) {
        return true;
    }
    const normalizedValue = normalizeFolder(value);
    const expectedFolder = normalizeFolder(folderHint.value);
    return normalizedValue.startsWith(expectedFolder);
};

const ensureAbsoluteUrl = (value?: string | null) => {
    if (!value) {
        return "";
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (!isImageKitPath(value)) {
        return value;
    }

    return buildPreviewUrl(value);
};

watch(
    () => props.modelValue,
    (next) => {
        if (next === undefined) {
            localValue.value = "";
            return;
        }
        const normalized = ensureAbsoluteUrl(next);
        if (normalized !== localValue.value) {
            localValue.value = normalized;
        }
    },
    { immediate: true },
);

const buildPreviewUrl = (filePath?: string) => {
    if (!filePath) {
        return "";
    }

    if (/^https?:\/\//i.test(filePath)) {
        return filePath;
    }

    if (/^(data:|blob:)/i.test(filePath)) {
        return filePath;
    }

    if (!urlEndpoint.value && isImageKitPath(filePath)) {
        return "";
    }

    const resolved = resolveImageKitUrl(
        filePath,
        urlEndpoint.value || undefined,
    );
    return resolved;
};

const commitValue = () => {
    error.value = null;
    const normalized = ensureAbsoluteUrl(localValue.value);
    localValue.value = normalized;
    emit("update:modelValue", normalized || undefined);
};

const clearImage = () => {
    localValue.value = "";
    commitValue();
};

const triggerUpload = () => {
    fileInputRef.value?.click();
};

const handleFileChange = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
        return;
    }

    pending.value = true;
    error.value = null;

    try {
        const result = await uploadImage(file, {
            folder: folderHint.value,
            fileName: file.name,
        });
        const absoluteUrl = ensureAbsoluteUrl(result.url || result.filePath);
        localValue.value = absoluteUrl;
        commitValue();
        await fetchLibrary();
    } catch (uploadError) {
        error.value =
            uploadError instanceof Error
                ? uploadError.message
                : "Upload failed";
    } finally {
        pending.value = false;
        input.value = "";
    }
};

const openLibrary = () => {
    libraryLimit.value = DEFAULT_LIBRARY_LIMIT;
    isLibraryOpen.value = true;
};

const closeLibrary = () => {
    isLibraryOpen.value = false;
};

const fetchLibrary = async (override: { limit?: number } = {}) => {
    const requestedLimit =
        override.limit ?? libraryLimit.value ?? DEFAULT_LIBRARY_LIMIT;
    isLibraryLoading.value = true;
    libraryError.value = null;

    try {
        const result = await getImageList({
            limit: requestedLimit,
            searchQuery: searchTerm.value.trim() || undefined,
            path: folderHint.value,
            sort: "DESC_CREATED",
        });
        libraryItems.value = result.files;
        libraryTotal.value = result.total;
        libraryLimit.value = requestedLimit;
    } catch (libraryFetchError) {
        libraryError.value =
            libraryFetchError instanceof Error
                ? libraryFetchError.message
                : "Failed to load images";
    } finally {
        isLibraryLoading.value = false;
    }
};

const searchLibrary = async () => {
    libraryLimit.value = DEFAULT_LIBRARY_LIMIT;
    await fetchLibrary({ limit: DEFAULT_LIBRARY_LIMIT });
};

const showAllImages = async () => {
    if (isLibraryLoading.value || !canShowAll.value) {
        return;
    }
    const targetLimit =
        libraryTotal.value > 0
            ? Math.min(MAX_LIBRARY_LIMIT, libraryTotal.value)
            : MAX_LIBRARY_LIMIT;
    await fetchLibrary({ limit: targetLimit });
};

watch(isLibraryOpen, (isOpen) => {
    if (!isOpen) {
        return;
    }
    void fetchLibrary({ limit: DEFAULT_LIBRARY_LIMIT });
});

const selectFromLibrary = (item: ImageKitFile | ImageKitUploadResult) => {
    const rawValue =
        item.url ??
        (typeof item.filePath === "string" ? item.filePath : undefined);
    if (!rawValue) {
        return;
    }
    localValue.value = ensureAbsoluteUrl(rawValue);
    commitValue();
    closeLibrary();
};

onMounted(() => {
    if (!props.modelValue) {
        return;
    }
    const normalized = ensureAbsoluteUrl(props.modelValue);
    if (normalized !== props.modelValue) {
        localValue.value = normalized;
        emit("update:modelValue", normalized);
    }
});
</script>

<style scoped>
.image-field {
    display: grid;
    gap: 0.75rem;
}

.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}

.image-field__preview {
    position: relative;
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: 0.75rem;
    overflow: hidden;
    max-width: 16rem;
}

.image-field__preview img {
    display: block;
    width: 100%;
    height: auto;
}

.image-field__clear {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(15, 23, 42, 0.75);
    color: #fff;
    border: none;
    border-radius: 9999px;
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
    cursor: pointer;
}

.image-field__controls {
    display: grid;
    gap: 0.5rem;
}

.image-field__input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.5);
    font-family: inherit;
}

.image-field__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.image-field__button {
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    border: 1px solid rgba(148, 163, 184, 0.5);
    background: #fff;
    cursor: pointer;
    font-size: 0.875rem;
}

.image-field__button--primary {
    background: #0f172a;
    color: #fff;
    border-color: #0f172a;
}

.image-field__error {
    color: #b91c1c;
    font-size: 0.875rem;
}

.image-field__hint {
    font-size: 0.875rem;
    color: #475569;
}

.image-field__library-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    display: grid;
    place-items: center;
    z-index: 40;
    padding: 1.5rem;
}

.image-field__library {
    background: #fff;
    border-radius: 1rem;
    width: min(72rem, 100%);
    max-height: 90vh;
    display: grid;
    grid-template-rows: auto auto auto 1fr;
    overflow: hidden;
}

.image-field__library-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.3);
}

.image-field__library-controls {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(248, 250, 252, 0.65);
}

.image-field__library-controls input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.5);
}

.image-field__library-controls button {
    padding: 0.5rem 0.9rem;
    border-radius: 9999px;
    border: 1px solid rgba(148, 163, 184, 0.5);
    background: #fff;
    cursor: pointer;
}

.image-field__library-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1.5rem 0;
    font-size: 0.875rem;
    color: #334155;
}

.image-field__library-count {
    flex: 1;
}

.image-field__button--ghost {
    background: transparent;
    color: #0f172a;
    border-color: rgba(15, 23, 42, 0.35);
}

.image-field__library-body {
    padding: 1rem 1.5rem 1.5rem;
    overflow-y: auto;
}

.image-field__library-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
    list-style: none;
    padding: 0;
    margin: 0;
}

.image-field__library-card {
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 0.75rem;
    padding: 0.75rem;
    display: grid;
    gap: 0.75rem;
    background: #fff;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.image-field__library-thumbnail {
    border-radius: 0.5rem;
    overflow: hidden;
    background: rgba(148, 163, 184, 0.2);
    aspect-ratio: 4 / 3;
    display: grid;
    place-items: center;
}

.image-field__library-thumbnail img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.image-field__library-meta {
    display: grid;
    gap: 0.25rem;
}

.image-field__library-name {
    font-size: 0.95rem;
    color: #0f172a;
    word-break: break-word;
}

.image-field__library-path {
    font-size: 0.75rem;
    color: #64748b;
    word-break: break-all;
}

.image-field__close {
    border: none;
    background: transparent;
    font-size: 1.125rem;
    cursor: pointer;
}
</style>
