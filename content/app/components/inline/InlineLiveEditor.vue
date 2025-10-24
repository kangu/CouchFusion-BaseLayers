<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { normalizePagePath } from "#content/utils/page";
import ContentAdminWorkbench from "#content/app/components/admin/ContentAdminWorkbench.vue";
import type ContentAdminWorkbenchComponent from "#content/app/components/admin/ContentAdminWorkbench.vue";
import type { ContentPageSummary } from "#content/types/content-page";
import type { MinimalContentDocument } from "#content/app/utils/contentBuilder";

type ContentAdminWorkbenchProps = InstanceType<
    typeof ContentAdminWorkbenchComponent
>["$props"];

const props = defineProps<{
    previewBaseUrl?: string | null;
    initialPath?: string;
    iframeTitle?: string;
    workbench?: Partial<ContentAdminWorkbenchProps>;
}>();

const runtimeConfig = useRuntimeConfig();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const isIframeReady = ref(false);
const latestDocument = ref<MinimalContentDocument | null>(null);
const selectedSummary = ref<ContentPageSummary | null>(null);
const cacheBuster = ref(Date.now());
const resolvedBaseUrl = ref<string>("");
const isClientReady = ref(false);
const workbenchProps = computed(() => ({
    // hidePreview: true,
    ...(props.workbench ?? {}),
}));

const initialPath = computed(() => normalizePagePath(props.initialPath ?? "/"));
const activePath = ref(initialPath.value);
const workbenchInstanceKey = ref(0);

const resolveBaseCandidates = () => {
    if (
        typeof props.previewBaseUrl === "string" &&
        props.previewBaseUrl.trim()
    ) {
        return props.previewBaseUrl.trim();
    }
    const configUrl =
        runtimeConfig.public?.siteUrl || runtimeConfig.public?.siteURL;
    if (typeof configUrl === "string" && configUrl.trim()) {
        return configUrl.trim();
    }
    if (typeof window !== "undefined" && window.location?.origin) {
        return window.location.origin;
    }
    return "";
};

const previewUrl = computed(() => {
    if (!resolvedBaseUrl.value) {
        return "";
    }

    try {
        const url = new URL(activePath.value || "/", resolvedBaseUrl.value);
        url.searchParams.set("inline-preview", "1");
        url.searchParams.set("_ts", cacheBuster.value.toString());
        console.debug(
            "[inline-live-editor] resolved preview url",
            url.toString(),
        );
        return url.toString();
    } catch (error) {
        console.error("Failed to resolve inline preview URL:", error);
        return "";
    }
});

const previewOrigin = computed(() => {
    if (!previewUrl.value) {
        return "*";
    }
    try {
        const parsed = new URL(previewUrl.value);
        return parsed.origin;
    } catch {
        return "*";
    }
});

const getClonedDocument = (
    document: MinimalContentDocument,
): MinimalContentDocument => {
    if (typeof structuredClone === "function") {
        try {
            return structuredClone(document);
        } catch {}
    }
    return JSON.parse(JSON.stringify(document)) as MinimalContentDocument;
};

const sendLiveUpdate = (document: MinimalContentDocument) => {
    if (!iframeRef.value?.contentWindow) {
        return;
    }

    const normalizedPath = normalizePagePath(document.path ?? activePath.value);
    const payload = getClonedDocument({
        ...document,
        path: normalizedPath,
    });

    console.debug("[inline-live-editor] sending live update", {
        path: normalizedPath,
        document: payload,
    });

    iframeRef.value.contentWindow.postMessage(
        {
            type: "live_updates",
            payload: {
                path: normalizedPath,
                document: payload,
            },
        },
        previewOrigin.value,
    );
};

const handlePageSelected = (summary: ContentPageSummary | null) => {
    selectedSummary.value = summary;
    if (!summary) {
        return;
    }

    const normalizedPath = normalizePagePath(summary.path);
    if (activePath.value !== normalizedPath) {
        activePath.value = normalizedPath;
        isIframeReady.value = false;
    }
};

const handleDocumentChange = (document: MinimalContentDocument) => {
    const normalized = getClonedDocument(document);
    normalized.path = normalizePagePath(normalized.path ?? activePath.value);
    latestDocument.value = normalized;
    console.debug("[inline-live-editor] document change", normalized);
    if (activePath.value !== normalized.path) {
        activePath.value = normalized.path;
        isIframeReady.value = false;
    }
    if (isIframeReady.value) {
        sendLiveUpdate(normalized);
    }
};

const handleIframeLoad = () => {
    isIframeReady.value = true;
    if (latestDocument.value) {
        nextTick(() => sendLiveUpdate(latestDocument.value!));
    }
};

watch(
    () => props.previewBaseUrl,
    () => {
        const candidate = resolveBaseCandidates();
        if (candidate) {
            console.debug("[inline-live-editor] previewBaseUrl updated", {
                prop: props.previewBaseUrl,
                resolved: candidate,
            });
            resolvedBaseUrl.value = candidate;
            console.debug(
                "[inline-live-editor] resolvedBaseUrl now",
                resolvedBaseUrl.value,
            );
        }
    },
    { immediate: true },
);

watch(
    () => activePath.value,
    () => {
        cacheBuster.value = Date.now();
    },
);

watch(
    () => initialPath.value,
    (nextPath, previousPath) => {
        if (!nextPath || nextPath === previousPath) {
            return;
        }

        activePath.value = nextPath;
        latestDocument.value = null;
        selectedSummary.value = null;
        isIframeReady.value = false;
        workbenchInstanceKey.value += 1;
    },
);

onMounted(() => {
    if (!resolvedBaseUrl.value) {
        resolvedBaseUrl.value = resolveBaseCandidates();
    }
    isClientReady.value = true;
});
</script>

<template>
    <div class="inline-live-editor">
        <section class="inline-live-editor__sidebar">
            <ContentAdminWorkbench
                :key="workbenchInstanceKey"
                class="inline-live-editor__workbench"
                v-bind="workbenchProps"
                :initial-path="initialPath"
                :auto-select-first="false"
                :hide-preview="true"
                @page-selected="handlePageSelected"
                @document-change="handleDocumentChange"
            />
        </section>

        <section class="inline-live-editor__preview">
            <div class="inline-live-editor__preview-frame">
                <iframe
                    v-if="isClientReady && previewUrl"
                    ref="iframeRef"
                    :src="previewUrl"
                    :title="iframeTitle || 'Inline preview'"
                    @load="handleIframeLoad"
                />
                <div v-else class="inline-live-editor__preview-placeholder">
                    Unable to determine preview URL. Configure `public.siteUrl`
                    or pass `preview-base-url`.
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
.inline-live-editor {
    display: grid;
    grid-template-columns: minmax(360px, 650px) 1fr;
    gap: 0;
    width: 100vw;
    height: 100vh;
}

.inline-live-editor__sidebar {
    overflow: auto;
    border-right: 1px solid #e5e7eb;
    background-color: #f8fafc;
}

.inline-live-editor__workbench {
    height: 100%;
    display: flex;
    flex-direction: column;
}

.inline-live-editor__preview {
    position: relative;
    display: flex;
    flex-direction: column;
    background-color: #111827;
}

.inline-live-editor__preview-frame {
    position: relative;
    flex: 1;
}

.inline-live-editor__preview-frame iframe {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: none;
    background-color: #fff;
}

.inline-live-editor__preview-placeholder {
    color: #f9fafb;
    padding: 2rem;
    font-size: 0.95rem;
}

@media (max-width: 1200px) {
    .inline-live-editor {
        grid-template-columns: 1fr;
        height: auto;
        min-height: 100vh;
    }

    .inline-live-editor__sidebar {
        border-right: none;
        border-bottom: 1px solid #e5e7eb;
    }

    .inline-live-editor__preview {
        min-height: 480px;
    }
}
</style>
