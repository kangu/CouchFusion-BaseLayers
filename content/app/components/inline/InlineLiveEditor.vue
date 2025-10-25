<script setup lang="ts">
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    ref,
    watch,
} from "vue";
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
const route = useRoute();

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
const hasUnsavedChanges = ref(false);
const sidebarWidth = ref(420);
const dividerRef = ref<HTMLDivElement | null>(null);
const isDraggingDivider = ref(false);
const pendingDividerDrag = ref(false);
const dividerPointerId = ref<number | null>(null);
const dragStartX = ref(0);
const dragStartWidth = ref(0);

const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue =
        "You have unsaved changes. Are you sure you want to leave?";
};

const applyBeforeUnload = (enabled: boolean) => {
    if (!import.meta.client) {
        return;
    }

    if (enabled) {
        window.addEventListener("beforeunload", beforeUnloadHandler);
    } else {
        window.removeEventListener("beforeunload", beforeUnloadHandler);
    }
};

const setUnsavedState = (value: boolean) => {
    if (hasUnsavedChanges.value === value) {
        return;
    }
    hasUnsavedChanges.value = value;
    applyBeforeUnload(value);
};

const builderBasePath = computed(() => {
    const currentPath = route.path || "/builder";
    const cleaned = currentPath.split("?")[0].split("#")[0];
    const segments = cleaned.split("/").filter(Boolean);
    const baseSegment = segments[0] ?? "builder";
    return baseSegment === "k" ? "/k" : "/builder";
});

const MIN_SIDEBAR_WIDTH = 320;
const MAX_SIDEBAR_WIDTH = 720;
const MIN_PREVIEW_WIDTH = 480;
const DRAG_ACTIVATION_THRESHOLD = 3;
const SIDEBAR_STORAGE_KEY = "inline-live-editor-sidebar-width";

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

const clampSidebarWidth = (value: number): number => {
    const min = MIN_SIDEBAR_WIDTH;
    let max = Math.max(min, MAX_SIDEBAR_WIDTH);

    if (typeof window !== "undefined") {
        const viewportCap = window.innerWidth - MIN_PREVIEW_WIDTH;
        if (Number.isFinite(viewportCap)) {
            max = Math.min(max, Math.max(min, viewportCap));
        }
    }

    return Math.min(Math.max(value, min), max);
};

const applySidebarConstraints = () => {
    sidebarWidth.value = clampSidebarWidth(sidebarWidth.value);
};

const loadStoredSidebarWidth = (): number | null => {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed)) {
            return null;
        }
        return clampSidebarWidth(parsed);
    } catch (error) {
        console.debug(
            "[inline-live-editor] failed to read sidebar width",
            error,
        );
        return null;
    }
};

const persistSidebarWidth = (value: number) => {
    if (typeof window === "undefined") {
        return;
    }

    try {
        window.localStorage.setItem(
            SIDEBAR_STORAGE_KEY,
            String(Math.round(value)),
        );
    } catch (error) {
        console.debug(
            "[inline-live-editor] failed to persist sidebar width",
            error,
        );
    }
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
        setUnsavedState(false);
        return;
    }

    const normalizedPath = normalizePagePath(summary.path);
    if (activePath.value !== normalizedPath) {
        activePath.value = normalizedPath;
        isIframeReady.value = false;
    }
    setUnsavedState(false);
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

const handleSaveSuccess = () => {
    setUnsavedState(false);
};

const handleUnsavedStateChange = (value: boolean) => {
    setUnsavedState(value);
};

const stopDividerDrag = (event?: PointerEvent) => {
    if (
        dividerPointerId.value !== null &&
        event &&
        event.pointerId !== dividerPointerId.value
    ) {
        return;
    }

    if (dividerPointerId.value !== null && dividerRef.value) {
        try {
            if (dividerRef.value.hasPointerCapture(dividerPointerId.value)) {
                dividerRef.value.releasePointerCapture(dividerPointerId.value);
            }
        } catch (error) {
            console.debug(
                "[inline-live-editor] releasePointerCapture failed",
                error,
            );
        }
    }

    dividerPointerId.value = null;
    pendingDividerDrag.value = false;
    isDraggingDivider.value = false;
    window.removeEventListener("pointermove", handleDividerDrag);
    window.removeEventListener("pointerup", stopDividerDrag);
    window.removeEventListener("pointercancel", stopDividerDrag);
};

const handleDividerDrag = (event: PointerEvent) => {
    if (dividerPointerId.value !== event.pointerId) {
        return;
    }

    const delta = event.clientX - dragStartX.value;

    if (pendingDividerDrag.value) {
        if (Math.abs(delta) < DRAG_ACTIVATION_THRESHOLD) {
            return;
        }
        pendingDividerDrag.value = false;
        isDraggingDivider.value = true;
    }

    if (!isDraggingDivider.value) {
        return;
    }

    event.preventDefault();
    sidebarWidth.value = clampSidebarWidth(dragStartWidth.value + delta);
};

const beginDividerDrag = (event: PointerEvent) => {
    const isPrimaryMouse = event.pointerType === "mouse" && event.button === 0;
    const isTouchOrPen =
        event.pointerType === "touch" || event.pointerType === "pen";

    if (!isPrimaryMouse && !isTouchOrPen) {
        return;
    }

    event.preventDefault();

    dividerPointerId.value = event.pointerId;
    pendingDividerDrag.value = true;
    dragStartX.value = event.clientX;
    dragStartWidth.value = sidebarWidth.value;

    if (dividerRef.value) {
        try {
            dividerRef.value.setPointerCapture(event.pointerId);
        } catch (error) {
            console.debug(
                "[inline-live-editor] setPointerCapture failed",
                error,
            );
        }
    }

    window.addEventListener("pointermove", handleDividerDrag, {
        passive: false,
    });
    window.addEventListener("pointerup", stopDividerDrag, { passive: true });
    window.addEventListener("pointercancel", stopDividerDrag, {
        passive: true,
    });
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

const normaliseBuilderTarget = (path: string): string => {
    if (!path || path === "/") {
        return "";
    }
    return path.replace(/^\/+/, "");
};

const syncRouteToActivePath = (
    nextPath: string,
    previousPath: string | null,
) => {
    if (!import.meta.client) {
        return;
    }
    if (!nextPath || nextPath === previousPath) {
        return;
    }

    const normalised = normaliseBuilderTarget(nextPath);
    const targetPath = normalised
        ? `${builderBasePath.value}/${normalised}`
        : `${builderBasePath.value}/`;

    const current =
        window.location.pathname +
        window.location.search +
        window.location.hash;

    if (current === targetPath) {
        return;
    }

    try {
        window.history.pushState(null, "", targetPath);
    } catch (error) {
        console.error(
            "[inline-live-editor] failed to update builder history path:",
            error,
        );
    }
};

watch(
    () => activePath.value,
    (nextPath, previousPath) => {
        cacheBuster.value = Date.now();
        syncRouteToActivePath(nextPath, previousPath ?? null);
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
        setUnsavedState(false);
    },
);

onMounted(() => {
    if (typeof window !== "undefined") {
        const stored = loadStoredSidebarWidth();
        if (stored !== null) {
            sidebarWidth.value = stored;
        }
    }

    if (!resolvedBaseUrl.value) {
        resolvedBaseUrl.value = resolveBaseCandidates();
    }
    isClientReady.value = true;
    applySidebarConstraints();
    if (typeof window !== "undefined") {
        window.addEventListener("resize", applySidebarConstraints, {
            passive: true,
        });
    }
});

onBeforeUnmount(() => {
    applyBeforeUnload(false);
    stopDividerDrag();
    if (typeof window !== "undefined") {
        window.removeEventListener("resize", applySidebarConstraints);
    }
});

watch(
    () => sidebarWidth.value,
    (value, previous) => {
        if (typeof value !== "number" || value === previous) {
            return;
        }
        persistSidebarWidth(value);
    },
);

onBeforeRouteLeave(() => {
    if (!hasUnsavedChanges.value) {
        return;
    }

    if (typeof window !== "undefined") {
        const shouldLeave = window.confirm(
            "You have unsaved changes. Leave without saving?",
        );
        if (!shouldLeave) {
            return false;
        }
    }

    setUnsavedState(false);
});
</script>

<template>
    <div
        class="inline-live-editor"
        :class="{ 'inline-live-editor--dragging': isDraggingDivider }"
        :style="{
            '--inline-sidebar-width': `${sidebarWidth}px`,
        }"
    >
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
                @save-success="handleSaveSuccess"
                @unsaved-state-change="handleUnsavedStateChange"
            />
        </section>

        <div
            class="inline-live-editor__divider"
            role="separator"
            aria-orientation="vertical"
            tabindex="0"
            ref="dividerRef"
            @pointerdown="beginDividerDrag"
        ></div>

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
    --inline-sidebar-width: 420px;
    display: grid;
    grid-template-columns: var(--inline-sidebar-width) minmax(4px, 8px) 1fr;
    gap: 0;
    width: 100vw;
    height: 100vh;
}

.inline-live-editor__sidebar {
    overflow: auto;
    border-right: 1px solid #e5e7eb;
    background-color: #f8fafc;
}

.inline-live-editor__divider {
    position: relative;
    cursor: col-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    touch-action: none;
}

.inline-live-editor__divider::before {
    content: "";
    width: 1px;
    height: 80%;
    border-radius: 999px;
    background-color: rgba(71, 85, 105, 0.35);
    transition: background-color 0.2s ease;
}

.inline-live-editor--dragging .inline-live-editor__divider::before,
.inline-live-editor__divider:focus-visible::before,
.inline-live-editor__divider:hover::before {
    background-color: rgba(37, 99, 235, 0.6);
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

@media (max-width: 1000px) {
    .inline-live-editor {
        grid-template-columns: 1fr;
        height: auto;
        min-height: 100vh;
    }

    .inline-live-editor__sidebar {
        border-right: none;
        border-bottom: 1px solid #e5e7eb;
    }

    .inline-live-editor__divider {
        display: none;
    }

    .inline-live-editor__preview {
        min-height: 480px;
    }
}
</style>
