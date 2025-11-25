<script setup lang="ts">
import {
    computed,
    defineAsyncComponent,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
    type ComponentPublicInstance,
} from "vue";
import { storeToRefs } from "pinia";
import { normalizePagePath } from "#content/utils/page";
import { createDocumentFromTree } from "#content/app/utils/contentBuilder";
import type {
    MinimalContentDocument,
    MinimalContentEntry,
} from "#content/app/utils/contentBuilder";
import {
    clonePlain,
    contentIdFromPath,
    contentToMinimalDocument,
    deriveStem,
    minimalToContentDocument,
} from "#content/utils/page-documents";
import type {
    ContentPageSummary,
    ContentPageHistoryEntry,
} from "#content/types/content-page";
import { useContentPagesStore } from "#content/app/stores/pages";
const BuilderWorkbench = defineAsyncComponent(
    () => import("../builder/Workbench.vue"),
);

type FeedbackLink = {
    label?: string;
    href?: string;
};

type FeedbackHandler = (message: string, link?: FeedbackLink) => void;

interface FeedbackHandlers {
    success?: FeedbackHandler;
    error?: FeedbackHandler;
}

interface UiConfig {
    createButton: string;
    pageChipActive: string;
    pageChipInactive: string;
    saveButton: string;
    deleteButton: string;
    cancelButton: string;
    modalSaveButton: string;
    modalCancelButton: string;
}

const defaultUi: UiConfig = {
    createButton: "",
    pageChipActive: "",
    pageChipInactive: "",
    saveButton: "",
    deleteButton: "",
    cancelButton: "",
    modalSaveButton: "",
    modalCancelButton: "",
};

const props = defineProps<{
    title?: string;
    description?: string;
    autoSelectFirst?: boolean;
    feedback?: FeedbackHandlers;
    confirmDelete?: (page: ContentPageSummary) => boolean | Promise<boolean>;
    ui?: Partial<UiConfig>;
    initialPath?: string | null;
    hidePreview?: boolean;
}>();

const emit = defineEmits<{
    (e: "page-selected", page: ContentPageSummary | null): void;
    (e: "create-success", page: ContentPageSummary): void;
    (e: "create-error", error: Error): void;
    (e: "save-success", page: ContentPageSummary): void;
    (e: "save-error", error: Error): void;
    (e: "delete-success", page: ContentPageSummary): void;
    (e: "delete-error", error: Error): void;
    (e: "duplicate-success", page: ContentPageSummary): void;
    (e: "duplicate-error", error: Error): void;
    (e: "document-change", document: MinimalContentDocument): void;
    (e: "unsaved-state-change", hasChanges: boolean): void;
}>();

const title = computed(() => props.title ?? "Content Builder");
const description = computed(
    () =>
        props.description ??
        "Manage content pages and edit their layout using the builder workbench.",
);
const hidePreview = computed(() => props.hidePreview === true);
const ui = computed<UiConfig>(() => ({ ...defaultUi, ...(props.ui ?? {}) }));
const feedback = computed(() => props.feedback ?? {});
const autoSelectFirst = computed(() => props.autoSelectFirst !== false);
const initialPath = computed(() => {
    if (!props.initialPath) {
        return null;
    }
    return normalizePagePath(props.initialPath);
});

const contentStore = useContentPagesStore();
await contentStore.fetchIndex();
const { index: indexState } = storeToRefs(contentStore);

type BuilderWorkbenchInstance = ComponentPublicInstance<{
    getSerializedDocument: () => MinimalContentDocument;
    loadDocument: (doc: MinimalContentDocument | null) => void;
}>;

const filterTerm = ref("");
const selectedPath = ref<string | null>(null);
const isSelectingPage = ref(false);
const selectionError = ref<string | null>(null);
const hasBootstrappedSelection = ref(false);

const builderRef = ref<BuilderWorkbenchInstance | null>(null);
const isSavePending = ref(false);
const isDeletePending = ref(false);
const saveError = ref<string | null>(null);
const lastSavedAt = ref<string | null>(null);
const selectedHistoryId = ref<string | null>(null);
const latestDocument = ref<MinimalContentDocument | null>(null);
const editorBodyRef = ref<HTMLElement | null>(null);
const isCondensed = ref(false);
const hasUnsavedChanges = ref(false);
const lastSavedSnapshot = ref<string | null>(null);

const isCreateModalOpen = ref(false);
const isCreatingPage = ref(false);
const createPageError = ref<string | null>(null);
const isDuplicateModalOpen = ref(false);
const isDuplicatePending = ref(false);
const duplicatePageError = ref<string | null>(null);

const newPageForm = reactive({
    path: "/",
    title: "",
    seoTitle: "",
    seoDescription: "",
    meta: "{}",
});

const duplicatePageForm = reactive({
    path: "/",
    title: "",
    seoTitle: "",
    seoDescription: "",
    meta: "{}",
});

type DuplicateNodeEntry = {
    key: string;
    label: string;
    component: string;
    path: number[];
    selected: boolean;
};

const duplicateNodes = ref<DuplicateNodeEntry[]>([]);
const duplicateSourceDocument = ref<MinimalContentDocument | null>(null);

const editorCardRef = ref<HTMLElement | null>(null);
const headerRef = ref<HTMLElement | null>(null);
const headerSentinelRef = ref<HTMLElement | null>(null);
const isHeaderPinned = ref(false);
const headerPlaceholderHeight = ref(0);
const headerPosition = reactive({ top: "0px", left: "0px", width: "auto" });
const hasLoadedInitialDocument = ref(false);

const headerFixedStyles = computed(() => {
    if (!isHeaderPinned.value) {
        return undefined;
    }
    const parsedTop = Number.parseFloat(headerPosition.top);
    const safeTop = Number.isFinite(parsedTop) ? Math.max(parsedTop, 0) : 0;
    return {
        top: `${safeTop}px`,
        left: headerPosition.left,
        width: headerPosition.width,
    };
});

let headerObserver: IntersectionObserver | null = null;
let resizeObserver: ResizeObserver | null = null;
let editorBodyObserver: ResizeObserver | null = null;

const updateUnsavedState = (value: boolean) => {
    if (hasUnsavedChanges.value === value) {
        return;
    }
    hasUnsavedChanges.value = value;
    emit("unsaved-state-change", value);
};

const confirmDiscardUnsavedChanges = async (): Promise<boolean> => {
    if (!hasUnsavedChanges.value) {
        return true;
    }

    if (typeof window === "undefined") {
        return true;
    }

    return window.confirm(
        "You have unsaved changes. Discard them and continue?",
    );
};

const availablePages = computed(() => indexState.value.data);

const normalizedFilter = computed(() => filterTerm.value.trim().toLowerCase());

const filteredPages = computed(() => {
    const list = availablePages.value ?? [];
    if (!normalizedFilter.value) {
        return list;
    }
    return list.filter((page) => {
        const titleValue = page.title?.toLowerCase() ?? "";
        const pathValue = page.path.toLowerCase();
        return (
            titleValue.includes(normalizedFilter.value) ||
            pathValue.includes(normalizedFilter.value)
        );
    });
});

const selectedSummary = computed<ContentPageSummary | null>(() => {
    if (!selectedPath.value) {
        return null;
    }
    return contentStore.getPage(selectedPath.value);
});

const historyState = computed(() => {
    if (!selectedSummary.value?.path) {
        return null;
    }
    return contentStore.getHistoryState(selectedSummary.value.path);
});

const historyEntries = computed<ContentPageHistoryEntry[]>(
    () => historyState.value?.data ?? [],
);
const isHistoryLoading = computed(() => historyState.value?.pending ?? false);
const historyError = computed(() => historyState.value?.error ?? null);

const isIndexLoading = computed(() => indexState.value.pending);
const indexError = computed(() => indexState.value.error);
const hasPages = computed(() => (availablePages.value?.length ?? 0) > 0);
const isFilteredEmpty = computed(
    () => hasPages.value && filteredPages.value.length === 0,
);
const lastUpdatedDisplay = computed(() =>
    formatTimestamp(
        selectedSummary.value?.updatedAt ?? null,
        lastSavedAt.value,
    ),
);
const condensedHistoryValue = computed(() => selectedHistoryId.value ?? "");

const selectedHistoryDocument = computed<MinimalContentDocument | null>(() => {
    if (!selectedHistoryId.value) {
        return null;
    }
    const entry = historyEntries.value.find(
        (item) => item.id === selectedHistoryId.value,
    );
    if (!entry) {
        return null;
    }
    return contentToMinimalDocument(entry.document);
});

const selectedDocument = computed<MinimalContentDocument | null>(() => {
    return (
        selectedHistoryDocument.value ?? resolveDocument(selectedSummary.value)
    );
});

watch(
    () => availablePages.value,
    (pages) => {
        if (hasBootstrappedSelection.value) {
            return;
        }
        if (!pages || pages.length === 0) {
            return;
        }

        const target = initialPath.value;
        if (target) {
            const match = pages.find(
                (entry) => normalizePagePath(entry.path) === target,
            );
            if (match) {
                hasBootstrappedSelection.value = true;
                openPageForEditing(match.path);
                return;
            }
        }

        if (!autoSelectFirst.value) {
            return;
        }

        hasBootstrappedSelection.value = true;
        openPageForEditing(pages[0].path);
    },
    { immediate: true },
);

watch(
    () => selectedSummary.value?.path,
    (path) => {
        if (!path) {
            emit("page-selected", null);
            return;
        }
        selectedPath.value = path;
        selectedHistoryId.value = null;
        emit("page-selected", selectedSummary.value ?? null);
        contentStore.fetchHistory(path).catch(() => {});
    },
);

const updateHeaderMeasurements = () => {
    const headerEl = headerRef.value;
    if (!headerEl) {
        return;
    }
    const cardEl = editorCardRef.value;
    const cardRect = cardEl?.getBoundingClientRect();
    const headerRect = headerEl.getBoundingClientRect();
    const referenceRect = cardRect ?? headerRect;

    headerPosition.top = cardRect ? `${cardRect.top}px` : "0px";
    headerPosition.left = `${referenceRect.left}px`;
    headerPosition.width = `${referenceRect.width}px`;
    headerPlaceholderHeight.value = headerEl.offsetHeight;
};

const updateCondensedState = () => {
    const element = editorBodyRef.value;
    if (!element) {
        return;
    }
    const { width } = element.getBoundingClientRect();
    isCondensed.value = width < 1000;
};

const handleIntersection: IntersectionObserverCallback = (entries) => {
    const entry = entries[0];
    if (!entry) {
        return;
    }
    const shouldPin = !entry.isIntersecting;

    if (shouldPin === isHeaderPinned.value) {
        return;
    }

    if (shouldPin) {
        updateHeaderMeasurements();
    }

    isHeaderPinned.value = shouldPin;

    if (!shouldPin) {
        nextTick(() => updateHeaderMeasurements());
    }
};

onMounted(() => {
    if (typeof window === "undefined") {
        return;
    }

    updateHeaderMeasurements();
    updateCondensedState();

    window.addEventListener("resize", updateHeaderMeasurements);
    window.addEventListener("resize", updateCondensedState);

    if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(() => updateHeaderMeasurements());

        if (headerRef.value) {
            resizeObserver.observe(headerRef.value);
        }

        if (editorCardRef.value) {
            resizeObserver.observe(editorCardRef.value);
        }

        editorBodyObserver = new ResizeObserver(() => updateCondensedState());

        if (editorBodyRef.value) {
            editorBodyObserver.observe(editorBodyRef.value);
        } else {
            nextTick(() => {
                if (editorBodyRef.value) {
                    editorBodyObserver?.observe(editorBodyRef.value);
                    updateCondensedState();
                }
            });
        }
    }

    if (headerSentinelRef.value) {
        headerObserver = new IntersectionObserver(handleIntersection, {
            threshold: 0,
        });
        headerObserver.observe(headerSentinelRef.value);
    }
});

onBeforeUnmount(() => {
    if (typeof window !== "undefined") {
        window.removeEventListener("resize", updateHeaderMeasurements);
        window.removeEventListener("resize", updateCondensedState);
    }

    headerObserver?.disconnect();
    resizeObserver?.disconnect();
    editorBodyObserver?.disconnect();
});

function formatTimestamp(
    value: string | null,
    override?: string | null,
): string | null {
    const source = override ?? value;
    if (!source) {
        return null;
    }
    const date = new Date(source);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toLocaleString();
}

function formatHistoryLabel(value: string): string {
    return formatTimestamp(value) ?? "Unknown save";
}

function resolveDocument(
    summary: ContentPageSummary | null | undefined,
): MinimalContentDocument | null {
    if (!summary) {
        return null;
    }

    if (summary.document) {
        return contentToMinimalDocument(summary.document);
    }

    return createDocumentFromTree(
        [],
        {
            path: summary.path,
            title: summary.title ?? "Page title",
            seoTitle: summary.seoTitle ?? summary.title ?? "Page title",
            seoDescription: summary.seoDescription ?? "SEO description.",
            navigation: true,
            extension: "md",
            meta: summary.meta ?? {},
        },
        { spacing: "none" },
    );
}

async function openPageForEditing(path: string, force = false): Promise<void> {
    const normalizedPath = normalizePagePath(path);
    if (!force && normalizedPath === selectedPath.value) {
        return;
    }

    if (hasUnsavedChanges.value && normalizedPath !== selectedPath.value) {
        const confirmed = await confirmDiscardUnsavedChanges();
        if (!confirmed) {
            return;
        }
        updateUnsavedState(false);
        lastSavedSnapshot.value = latestDocument.value
            ? JSON.stringify(latestDocument.value)
            : null;
    }

    if (isSelectingPage.value) {
        return;
    }

    hasLoadedInitialDocument.value = false;
    lastSavedSnapshot.value = null;
    isSelectingPage.value = true;
    selectionError.value = null;
    saveError.value = null;

    try {
        await contentStore.fetchPage(normalizedPath, force);
        selectedPath.value = normalizedPath;
        lastSavedAt.value = null;
        selectedHistoryId.value = null;
        updateUnsavedState(false);
        contentStore.fetchHistory(normalizedPath, force).catch(() => {});
        nextTick(() => updateCondensedState());
    } catch (error: any) {
        selectionError.value = error?.message || "Failed to load page content.";
    } finally {
        isSelectingPage.value = false;
    }
}

function resetCreatePageForm(): void {
    newPageForm.path = "/";
    newPageForm.title = "";
    newPageForm.seoTitle = "";
    newPageForm.seoDescription = "";
    newPageForm.meta = "{}";
    createPageError.value = null;
}

function showCreatePageModal(): void {
    resetCreatePageForm();
    isCreateModalOpen.value = true;
}

function parseMetaField(value: string): Record<string, any> {
    const trimmed = value.trim();
    if (!trimmed) {
        return {};
    }
    return JSON.parse(trimmed);
}

function serialiseMetaField(
    value: Record<string, any> | null | undefined,
): string {
    if (!value || Object.keys(value).length === 0) {
        return "{}";
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch (error) {
        console.debug(
            "[content-admin-workbench] failed to serialise meta",
            error,
        );
        return "{}";
    }
}

function deriveDuplicatePath(sourcePath: string | null | undefined): string {
    const normalized = normalizePagePath(sourcePath ?? "/");
    if (normalized === "/") {
        return "/copy";
    }
    if (normalized.endsWith("-copy")) {
        return `${normalized}-copy`;
    }
    return `${normalized}-copy`;
}

function resetDuplicatePageForm(
    document: MinimalContentDocument | null,
): void {
    const summary = selectedSummary.value;
    const sourceDoc = document ?? null;

    const sourcePath = sourceDoc?.path ?? summary?.path ?? "/";
    duplicatePageForm.path = deriveDuplicatePath(sourcePath);
    duplicatePageForm.title =
        sourceDoc?.title ?? summary?.title ?? "Page title";
    duplicatePageForm.seoTitle =
        sourceDoc?.seo?.title ??
        summary?.seoTitle ??
        sourceDoc?.title ??
        summary?.title ??
        "Page title";
    duplicatePageForm.seoDescription =
        sourceDoc?.seo?.description ??
        summary?.seoDescription ??
        "SEO description.";
    duplicatePageForm.meta = serialiseMetaField(
        sourceDoc?.meta ?? summary?.meta ?? {},
    );
    duplicatePageError.value = null;
}

function closeDuplicateModal(): void {
    isDuplicateModalOpen.value = false;
    duplicateNodes.value = [];
    duplicateSourceDocument.value = null;
    duplicatePageError.value = null;
}

const collectDuplicateNodes = (
    entries: MinimalContentEntry[] | undefined,
    basePath: number[] = [],
    ancestors: string[] = [],
): DuplicateNodeEntry[] => {
    if (!Array.isArray(entries)) {
        return [];
    }

    const collected: DuplicateNodeEntry[] = [];

    entries.forEach((entry, index) => {
        if (!Array.isArray(entry) || typeof entry[0] !== "string") {
            return;
        }

        const componentId = entry[0];
        const currentPath = [...basePath, index];
        const labelParts = [...ancestors, componentId];
        const label = labelParts.join(" › ");

        collected.push({
            key: currentPath.join("."),
            label,
            component: componentId,
            path: currentPath,
            selected: true,
        });

        const children = entry.slice(2) as MinimalContentEntry[];
        collected.push(
            ...collectDuplicateNodes(children, currentPath, labelParts),
        );
    });

    return collected;
};

const buildDuplicateNodes = (
    document: MinimalContentDocument | null,
): DuplicateNodeEntry[] => {
    if (!document) {
        return [];
    }

    const entries = document.body?.value ?? [];
    return collectDuplicateNodes(entries);
};

const filterComponentEntries = (
    entries: MinimalContentEntry[] | undefined,
    basePath: number[],
    allowed: Set<string>,
): MinimalContentEntry[] => {
    if (!Array.isArray(entries)) {
        return [];
    }

    const filtered: MinimalContentEntry[] = [];

    entries.forEach((entry, index) => {
        const currentPath = [...basePath, index];

        if (!Array.isArray(entry) || typeof entry[0] !== "string") {
            filtered.push(entry);
            return;
        }

        const key = currentPath.join(".");
        const children = entry.slice(2) as MinimalContentEntry[];
        const filteredChildren = filterComponentEntries(
            children,
            currentPath,
            allowed,
        );

        if (!allowed.has(key)) {
            return;
        }

        const rawProps = entry[1];
        const props =
            rawProps && typeof rawProps === "object"
                ? clonePlain(rawProps as Record<string, any>)
                : {};

        const rebuilt: MinimalContentEntry = [
            entry[0],
            props,
            ...filteredChildren,
        ];

        filtered.push(rebuilt);
    });

    return filtered;
};

const getDuplicateNodeIndent = (node: DuplicateNodeEntry): string => {
    const depth = Math.max(node.path.length - 1, 0);
    return `${depth * 0.75}rem`;
};

const setDuplicateNodeSelection = (key: string, selected: boolean): void => {
    const prefix = `${key}.`;

    duplicateNodes.value.forEach((entry) => {
        if (entry.key === key || entry.key.startsWith(prefix)) {
            entry.selected = selected;
        }
    });

    if (!selected) {
        return;
    }

    const segments = key.split(".");
    while (segments.length > 1) {
        segments.pop();
        const parentKey = segments.join(".");
        const parent = duplicateNodes.value.find(
            (entry) => entry.key === parentKey,
        );
        if (parent && !parent.selected) {
            parent.selected = true;
        }
    }
};

const handleDuplicateNodeToggle = (key: string, event: Event): void => {
    const target = event.target as HTMLInputElement | null;
    if (!target) {
        return;
    }
    setDuplicateNodeSelection(key, target.checked);
};

function showDuplicateModal(): void {
    if (!selectedSummary.value) {
        return;
    }

    const builder = builderRef.value;
    if (!builder) {
        const wrapped = new Error("Builder not ready.");
        duplicatePageError.value = wrapped.message;
        feedback.value.error?.(wrapped.message);
        return;
    }

    const serialized = builder.getSerializedDocument();
    duplicateSourceDocument.value = clonePlain(serialized);
    duplicateNodes.value = buildDuplicateNodes(duplicateSourceDocument.value);
    resetDuplicatePageForm(duplicateSourceDocument.value);
    duplicatePageError.value = null;
    isDuplicateModalOpen.value = true;
}

async function handleCreatePage(): Promise<void> {
    if (isCreatingPage.value) {
        return;
    }

    const normalizedPath = normalizePagePath(newPageForm.path);
    if (!normalizedPath) {
        createPageError.value = "Path is required.";
        return;
    }

    if (!newPageForm.title.trim()) {
        createPageError.value = "Title is required.";
        return;
    }

    let metaPayload: Record<string, any>;
    try {
        metaPayload = parseMetaField(newPageForm.meta);
    } catch (error: any) {
        createPageError.value = error?.message || "Meta must be valid JSON.";
        return;
    }

    isCreatingPage.value = true;
    createPageError.value = null;

    try {
        const summary = await contentStore.createPage({
            path: normalizedPath,
            title: newPageForm.title,
            seoTitle: newPageForm.seoTitle || newPageForm.title,
            seoDescription: newPageForm.seoDescription || "SEO description.",
            meta: metaPayload,
        });
        await contentStore.fetchIndex(true);
        await openPageForEditing(normalizedPath, true);
        filterTerm.value = "";
        isCreateModalOpen.value = false;
        emit("create-success", summary);
        feedback.value.success?.(`Page "${summary.title}" created.`, {
            label: "Edit Page",
            href: summary.path,
        });
    } catch (error: any) {
        const wrapped =
            error instanceof Error
                ? error
                : new Error(error?.message || "Failed to create page.");
        createPageError.value = wrapped.message;
        emit("create-error", wrapped);
        feedback.value.error?.(wrapped.message);
    } finally {
        isCreatingPage.value = false;
    }
}

async function handleDuplicatePage(): Promise<void> {
    if (isDuplicatePending.value || !selectedSummary.value) {
        return;
    }

    const builder = builderRef.value;
    if (!builder) {
        const wrapped = new Error("Builder not ready.");
        duplicatePageError.value = wrapped.message;
        emit("duplicate-error", wrapped);
        feedback.value.error?.(wrapped.message);
        return;
    }

    const normalizedPath = normalizePagePath(duplicatePageForm.path);
    if (!normalizedPath) {
        duplicatePageError.value = "Path is required.";
        return;
    }

    if (!duplicatePageForm.title.trim()) {
        duplicatePageError.value = "Title is required.";
        return;
    }

    let metaPayload: Record<string, any>;
    try {
        metaPayload = parseMetaField(duplicatePageForm.meta);
    } catch (error: any) {
        duplicatePageError.value = error?.message || "Meta must be valid JSON.";
        return;
    }

    try {
        isDuplicatePending.value = true;
        duplicatePageError.value = null;

        const baseDocument = duplicateSourceDocument.value
            ? clonePlain(duplicateSourceDocument.value)
            : clonePlain(builder.getSerializedDocument());
        const selectedComponentKeys = new Set(
            duplicateNodes.value
                .filter((entry) => entry.selected)
                .map((entry) => entry.key),
        );
        const filteredBody = filterComponentEntries(
            baseDocument.body?.value,
            [],
            selectedComponentKeys,
        );

        const duplicatedMinimal: MinimalContentDocument = {
            ...baseDocument,
            id: contentIdFromPath(normalizedPath),
            path: normalizedPath,
            title: duplicatePageForm.title,
            seo: {
                title: duplicatePageForm.seoTitle || duplicatePageForm.title,
                description:
                    duplicatePageForm.seoDescription || "SEO description.",
            },
            meta: metaPayload,
            stem: deriveStem(normalizedPath),
            body: {
                type: baseDocument.body?.type ?? "minimal",
                value: filteredBody,
            },
        };

        const contentDocument = minimalToContentDocument(duplicatedMinimal);
        const duplicatedSummary = await contentStore.saveDocument(
            contentDocument,
            { method: "POST" },
        );

        await contentStore.fetchIndex(true);
        closeDuplicateModal();
        updateUnsavedState(false);
        lastSavedSnapshot.value = null;
        await openPageForEditing(duplicatedSummary.path, true);
        emit("duplicate-success", duplicatedSummary);
        feedback.value.success?.(
            `Page "${duplicatedSummary.title}" duplicated.`,
            {
                label: "Edit Page",
                href: duplicatedSummary.path,
            },
        );
    } catch (error: any) {
        const wrapped =
            error instanceof Error
                ? error
                : new Error(error?.message || "Failed to duplicate page.");
        duplicatePageError.value = wrapped.message;
        emit("duplicate-error", wrapped);
        feedback.value.error?.(wrapped.message);
    } finally {
        isDuplicatePending.value = false;
    }
}

function handleDocumentChange(document: MinimalContentDocument): void {
    latestDocument.value = document;
    lastSavedAt.value = null;
    const serialized = JSON.stringify(document);
    const wasBootstrapped = hasLoadedInitialDocument.value;
    hasLoadedInitialDocument.value = true;

    if (!wasBootstrapped || lastSavedSnapshot.value === null) {
        lastSavedSnapshot.value = serialized;
        updateUnsavedState(false);
    } else {
        updateUnsavedState(serialized !== lastSavedSnapshot.value);
    }

    emit("document-change", document);
}

async function handleSaveDocument(): Promise<void> {
    if (isSavePending.value || !selectedSummary.value) {
        return;
    }
    const builder = builderRef.value;
    if (!builder) {
        const wrapped = new Error("Builder not ready.");
        saveError.value = wrapped.message;
        emit("save-error", wrapped);
        feedback.value.error?.(wrapped.message);
        return;
    }

    try {
        isSavePending.value = true;
        saveError.value = null;

        const serialized = builder.getSerializedDocument();
        const contentDocument = minimalToContentDocument(serialized);

        if (selectedSummary.value.document) {
            contentDocument._id = selectedSummary.value.document._id;
            contentDocument._rev = selectedSummary.value.document._rev;
            contentDocument.createdAt =
                selectedSummary.value.document.createdAt ?? null;
        }

        const savedSummary = await contentStore.saveDocument(contentDocument);
        selectedPath.value = savedSummary.path;
        lastSavedAt.value = savedSummary.updatedAt ?? new Date().toISOString();
        selectedHistoryId.value = null;
        lastSavedSnapshot.value = JSON.stringify(serialized);
        updateUnsavedState(false);

        emit("save-success", savedSummary);
        feedback.value.success?.(
            `Page "${savedSummary.title}" saved successfully`,
            {
                label: "View Page",
                href: savedSummary.path,
            },
        );
    } catch (error: any) {
        const wrapped =
            error instanceof Error
                ? error
                : new Error(error?.message || "Failed to save page.");
        saveError.value = wrapped.message;
        emit("save-error", wrapped);
        feedback.value.error?.(wrapped.message);
    } finally {
        isSavePending.value = false;
    }
}

async function handleSelectHistory(entryId: string): Promise<void> {
    if (!selectedSummary.value?.path) {
        return;
    }

    const targetId = entryId ?? "";
    if (targetId === (selectedHistoryId.value ?? "")) {
        return;
    }

    if (hasUnsavedChanges.value) {
        const confirmed = await confirmDiscardUnsavedChanges();
        if (!confirmed) {
            return;
        }
        updateUnsavedState(false);
        lastSavedSnapshot.value = null;
    }

    hasLoadedInitialDocument.value = false;
    lastSavedSnapshot.value = null;

    if (!targetId) {
        selectedHistoryId.value = null;
        return;
    }

    try {
        await contentStore.fetchHistory(selectedSummary.value.path);
        selectedHistoryId.value = targetId;
    } catch (error: any) {
        const wrapped =
            error instanceof Error
                ? error
                : new Error(error?.message || "Failed to load history entry.");
        feedback.value.error?.(wrapped.message);
    }
}

async function handleCondensedHistoryChange(event: Event): Promise<void> {
    const target = event.target as HTMLSelectElement | null;
    if (!target) {
        return;
    }
    await handleSelectHistory(target.value ?? "");
}

async function handleDeletePage(): Promise<void> {
    if (isDeletePending.value || !selectedSummary.value) {
        return;
    }

    const target = selectedSummary.value;
    const label = target.title || target.path;

    let confirmed = true;
    if (props.confirmDelete) {
        confirmed = await props.confirmDelete(target);
    } else if (
        typeof window !== "undefined" &&
        typeof window.confirm === "function"
    ) {
        confirmed = window.confirm(
            `Delete page "${label}"? This action cannot be undone.`,
        );
    }

    if (!confirmed) {
        return;
    }

    try {
        isDeletePending.value = true;
        saveError.value = null;

        await contentStore.deletePage(target.path);
        await contentStore.fetchIndex(true);

        emit("delete-success", target);
        feedback.value.success?.(`Page "${label}" deleted.`);

        const remaining = contentStore.index.data;
        lastSavedAt.value = null;
        if (remaining.length) {
            await openPageForEditing(remaining[0].path, true);
        } else {
            selectedPath.value = null;
            hasLoadedInitialDocument.value = false;
            updateUnsavedState(false);
            emit("page-selected", null);
        }
    } catch (error: any) {
        const wrapped =
            error instanceof Error
                ? error
                : new Error(error?.message || "Failed to delete page.");
        emit("delete-error", wrapped);
        feedback.value.error?.(wrapped.message);
    } finally {
        isDeletePending.value = false;
    }
}

function closeCreateModal(): void {
    isCreateModalOpen.value = false;
}

defineExpose({
    openCreateModal: showCreatePageModal,
    refreshIndex: () => contentStore.fetchIndex(true),
});
</script>

<template>
    <div class="content-admin-workbench">
        <slot
            name="header"
            :title="title"
            :description="description"
            :open-create="showCreatePageModal"
        >
            <div class="content-admin-workbench__header">
                <div class="content-admin-workbench__header-copy">
                    <h1 class="content-admin-workbench__title">{{ title }}</h1>
                    <p class="content-admin-workbench__description">
                        {{ description }}
                    </p>
                </div>
                <div class="content-admin-workbench__header-actions">
                    <button
                        type="button"
                        class="content-admin-workbench__button content-admin-workbench__button--primary"
                        :class="ui.createButton"
                        @click="showCreatePageModal"
                    >
                        <svg
                            class="content-admin-workbench__icon content-admin-workbench__icon--sm"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                fill="currentColor"
                                d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z"
                            />
                        </svg>
                        <span>New Page</span>
                    </button>
                </div>
            </div>
        </slot>

        <div class="content-admin-workbench__panel">
            <div class="content-admin-workbench__panel-controls">
                <div class="content-admin-workbench__search">
                    <label class="search-input">
                        <svg
                            class="content-admin-workbench__icon content-admin-workbench__icon--sm content-admin-workbench__icon--muted"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                fill="currentColor"
                                d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.47 4.24l5.06 5.06-1.41 1.41-5.06-5.06A6.5 6.5 0 1 1 9.5 3m0 2A4.5 4.5 0 1 0 14 9.5 4.5 4.5 0 0 0 9.5 5Z"
                            />
                        </svg>
                        <input
                            v-model="filterTerm"
                            type="search"
                            placeholder="Filter pages by title or path"
                        />
                    </label>
                </div>
                <div v-if="indexError" class="content-admin-workbench__error">
                    <svg
                        class="content-admin-workbench__icon content-admin-workbench__icon--md"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            fill="currentColor"
                            d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm1-5h-2v-2h2Zm0-4h-2V7h2Z"
                        />
                    </svg>
                    <span>{{ indexError }}</span>
                </div>
            </div>

            <div class="content-admin-workbench__chip-list">
                <template v-if="isIndexLoading">
                    <span class="content-admin-workbench__hint"
                        >Loading pages…</span
                    >
                </template>
                <template v-else-if="isFilteredEmpty">
                    <span class="content-admin-workbench__hint"
                        >No pages match your filter.</span
                    >
                </template>
                <template v-else-if="!hasPages">
                    <span class="content-admin-workbench__hint"
                        >No pages available yet. Create one to get
                        started.</span
                    >
                </template>
                <template v-else>
                    <button
                        v-for="page in filteredPages"
                        :key="page.path"
                        type="button"
                        class="content-admin-workbench__chip"
                        :class="[
                            page.path === selectedPath
                                ? [
                                      'content-admin-workbench__chip--active',
                                      ui.pageChipActive,
                                  ]
                                : [
                                      'content-admin-workbench__chip--inactive',
                                      ui.pageChipInactive,
                                  ],
                        ]"
                        @click="openPageForEditing(page.path)"
                    >
                        {{ `${page.path} - ${page.title || "[No title]"}` }}
                    </button>
                </template>
            </div>
        </div>

        <div ref="editorCardRef" class="content-admin-workbench__editor">
            <div
                ref="headerSentinelRef"
                aria-hidden="true"
                class="content-admin-workbench__sentinel"
            ></div>

            <div
                ref="headerRef"
                class="content-admin-workbench__editor-header"
                :class="{ 'is-pinned': isHeaderPinned }"
                :style="headerFixedStyles"
            >
                <div class="editor-header__left">
                    <div class="editor-header__meta">
                        <span class="editor-header__meta-label">Editing</span>
                        <span class="editor-header__meta-value">
                            {{
                                selectedSummary?.title ||
                                selectedSummary?.path ||
                                "No page selected"
                            }}
                        </span>
                    </div>
                    <div class="editor-header__status">
                        <span
                            v-if="selectionError"
                            class="editor-header__status-error"
                            >{{ selectionError }}</span
                        >
                        <span
                            v-else-if="lastUpdatedDisplay"
                            class="editor-header__status-time"
                        >
                            Last saved {{ lastUpdatedDisplay }}
                        </span>
                    </div>
                </div>
                <div class="editor-header__actions">
                    <button
                        type="button"
                        class="content-admin-workbench__button content-admin-workbench__button--primary"
                        :class="ui.saveButton"
                        :disabled="isSavePending || !selectedSummary"
                        @click="handleSaveDocument"
                    >
                        <svg
                            v-if="isSavePending"
                            class="content-admin-workbench__icon content-admin-workbench__icon--sm content-admin-workbench__spinner"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                fill="currentColor"
                                d="M12 4V2a10 10 0 1 1-10 10h2a8 8 0 1 0 8-8Z"
                            />
                        </svg>
                        <span>{{
                            isSavePending ? "Saving…" : "Save Changes"
                        }}</span>
                    </button>
                    <button
                        type="button"
                        class="content-admin-workbench__button content-admin-workbench__button--danger"
                        :class="ui.deleteButton"
                        :disabled="isDeletePending || !selectedSummary"
                        @click="handleDeletePage"
                    >
                        <svg
                            class="content-admin-workbench__icon content-admin-workbench__icon--sm"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                fill="currentColor"
                                d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14Zm-1 3H6v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2Zm-3 2v10h-2V9Zm-4 0v10H9V9Z"
                            />
                        </svg>
                        <span>Delete</span>
                    </button>
                    <button
                        type="button"
                        class="content-admin-workbench__button content-admin-workbench__button--muted"
                        :class="ui.cancelButton"
                        :disabled="isDuplicatePending || !selectedSummary"
                        @click="showDuplicateModal"
                    >
                        <svg
                            class="content-admin-workbench__icon content-admin-workbench__icon--sm"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path
                                fill="currentColor"
                                d="M7 4h9a2 2 0 0 1 2 2v1h-2V6H7v12h9v-1h2v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm5 4h8v2h-8Zm0 4h8v2h-8Zm0 4h5v2h-5Z"
                            />
                        </svg>
                    </button>
                </div>
            </div>

            <div
                v-if="isHeaderPinned"
                :style="{ height: `${headerPlaceholderHeight}px` }"
                aria-hidden="true"
            />

            <div
                ref="editorBodyRef"
                class="content-admin-workbench__editor-body"
            >
                <div
                    v-if="isCondensed"
                    class="content-admin-workbench__condensed-history"
                >
                    <div class="condensed-history__header">
                        <label
                            class="condensed-history__label"
                            for="condensed-history-select"
                        >
                            <span class="sidebar__title">History</span>
                            <span class="sidebar__subtitle"
                                >Restore recent revisions.</span
                            >
                        </label>
                    </div>

                    <div v-if="historyError" class="sidebar__error">
                        {{ historyError }}
                    </div>
                    <div v-else-if="isHistoryLoading" class="sidebar__hint">
                        Loading history…
                    </div>
                    <div v-else class="condensed-history__control">
                        <select
                            id="condensed-history-select"
                            :value="condensedHistoryValue"
                            :disabled="
                                isHistoryLoading || historyEntries.length === 0
                            "
                            @change="handleCondensedHistoryChange"
                        >
                            <option value="">Current version</option>
                            <option
                                v-for="entry in historyEntries"
                                :key="entry.id"
                                :value="entry.id"
                            >
                                {{ formatHistoryLabel(entry.timestamp) }}
                            </option>
                        </select>
                        <p
                            v-if="historyEntries.length === 0"
                            class="sidebar__hint"
                        >
                            No history available yet.
                        </p>
                    </div>
                </div>

                <div
                    v-if="!isCondensed"
                    class="content-admin-workbench__editor-sidebar"
                >
                    <h2 class="sidebar__title">History</h2>
                    <p class="sidebar__subtitle">Restore recent revisions.</p>

                    <div v-if="historyError" class="sidebar__error">
                        {{ historyError }}
                    </div>

                    <div class="sidebar__history">
                        <button
                            type="button"
                            class="sidebar__history-item"
                            :class="{ 'is-active': !selectedHistoryId }"
                            @click="handleSelectHistory('')"
                        >
                            <svg
                                class="content-admin-workbench__icon content-admin-workbench__icon--sm"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    fill="currentColor"
                                    d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.65Z"
                                />
                            </svg>
                            <span>Current version</span>
                        </button>

                        <div v-if="isHistoryLoading" class="sidebar__hint">
                            Loading history…
                        </div>
                        <div
                            v-else-if="historyEntries.length === 0"
                            class="sidebar__hint"
                        >
                            No history available yet.
                        </div>
                        <template v-else>
                            <button
                                v-for="entry in historyEntries"
                                :key="entry.id"
                                type="button"
                                class="sidebar__history-item"
                                :class="{
                                    'is-active': entry.id === selectedHistoryId,
                                }"
                                @click="handleSelectHistory(entry.id)"
                            >
                                <svg
                                    class="content-admin-workbench__icon content-admin-workbench__icon--sm"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M12 5V2L8 6l4 4V7a6 6 0 0 1 6 6 6 6 0 0 1-4 5.66v2.1A8 8 0 0 0 20 13a8 8 0 0 0-8-8ZM6 11a6 6 0 0 1 4-5.66v-2.1A8 8 0 0 0 4 11a8 8 0 0 0 8 8v3l4-4-4-4v3a6 6 0 0 1-6-6Z"
                                    />
                                </svg>
                                <span>{{
                                    formatHistoryLabel(entry.timestamp)
                                }}</span>
                            </button>
                        </template>
                    </div>
                </div>

                <div class="content-admin-workbench__editor-canvas">
                    <div v-if="saveError" class="editor-canvas__error">
                        {{ saveError }}
                    </div>

                    <div v-if="selectedDocument">
                        <div
                            v-if="!hidePreview"
                            class="editor-canvas__preview-label"
                        >
                            <h2 class="preview-title">Preview</h2>
                            <p class="preview-subtitle">
                                Rendered output of the current content document.
                            </p>
                        </div>
                        <div
                            class="editor-canvas__workbench"
                            :class="{
                                'editor-canvas__workbench--full': hidePreview,
                            }"
                        >
                            <BuilderWorkbench
                                ref="builderRef"
                                :initial-document="selectedDocument"
                                :hide-preview="hidePreview"
                                :key="selectedDocument.id"
                                @document-change="handleDocumentChange"
                            />
                        </div>
                    </div>
                    <div v-else class="editor-canvas__placeholder">
                        Select a page to begin editing.
                    </div>
                </div>
            </div>
        </div>

        <Teleport to="body">
            <Transition name="fade">
                <div
                    v-if="isCreateModalOpen"
                    class="content-admin-workbench__modal"
                >
                    <div class="modal__backdrop" @click="closeCreateModal" />
                    <div class="modal__panel" role="dialog" aria-modal="true">
                        <div class="modal__header">
                            <div>
                                <h2 class="modal__title">Create New Page</h2>
                                <p class="modal__subtitle">
                                    Provide the basic page metadata to bootstrap
                                    the builder.
                                </p>
                            </div>
                            <button
                                type="button"
                                class="modal__close"
                                aria-label="Close"
                                @click="closeCreateModal"
                            >
                                <svg
                                    class="h-5 w-5"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12Z"
                                    />
                                </svg>
                            </button>
                        </div>

                        <form
                            class="modal__form"
                            @submit.prevent="handleCreatePage"
                        >
                            <div class="modal__field">
                                <label for="new-page-path">Page path</label>
                                <input
                                    id="new-page-path"
                                    v-model="newPageForm.path"
                                    type="text"
                                    required
                                    placeholder="/about"
                                />
                            </div>

                            <div class="modal__field">
                                <label for="new-page-title">Title</label>
                                <input
                                    id="new-page-title"
                                    v-model="newPageForm.title"
                                    type="text"
                                    required
                                    placeholder="Page title"
                                />
                            </div>

                            <div class="modal__field-grid">
                                <div class="modal__field">
                                    <label for="new-page-seo-title"
                                        >SEO title</label
                                    >
                                    <input
                                        id="new-page-seo-title"
                                        v-model="newPageForm.seoTitle"
                                        type="text"
                                        placeholder="SEO title"
                                    />
                                </div>
                                <div class="modal__field">
                                    <label for="new-page-seo-description"
                                        >SEO description</label
                                    >
                                    <input
                                        id="new-page-seo-description"
                                        v-model="newPageForm.seoDescription"
                                        type="text"
                                        placeholder="SEO description."
                                    />
                                </div>
                            </div>

                            <div class="modal__field">
                                <label for="new-page-meta"
                                    >Meta JSON (optional)</label
                                >
                                <textarea
                                    id="new-page-meta"
                                    v-model="newPageForm.meta"
                                    rows="3"
                                ></textarea>
                            </div>

                            <div v-if="createPageError" class="modal__error">
                                {{ createPageError }}
                            </div>

                            <div class="modal__actions">
                                <button
                                    type="button"
                                    class="content-admin-workbench__button content-admin-workbench__button--muted"
                                    :class="ui.modalCancelButton"
                                    @click="closeCreateModal"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    class="content-admin-workbench__button content-admin-workbench__button--primary"
                                    :class="ui.modalSaveButton"
                                    :disabled="isCreatingPage"
                                >
                                    <svg
                                        v-if="isCreatingPage"
                                        class="content-admin-workbench__icon content-admin-workbench__icon--sm content-admin-workbench__spinner"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                    >
                                        <path
                                            fill="currentColor"
                                            d="M12 4V2a10 10 0 1 1-10 10h2a8 8 0 1 0 8-8Z"
                                        />
                                    </svg>
                                    <span>{{
                                        isCreatingPage ? "Saving…" : "Save Page"
                                    }}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <Teleport to="body">
            <Transition name="fade">
                <div
                    v-if="isDuplicateModalOpen"
                    class="content-admin-workbench__modal"
                >
                    <div class="modal__backdrop" @click="closeDuplicateModal" />
                    <div class="modal__panel" role="dialog" aria-modal="true">
                        <div class="modal__header">
                            <div>
                                <h2 class="modal__title">Duplicate Page</h2>
                                <p class="modal__subtitle">
                                    Adjust the metadata for the duplicated page.
                                </p>
                            </div>
                            <button
                                type="button"
                                class="modal__close"
                                aria-label="Close"
                                @click="closeDuplicateModal"
                            >
                                <svg
                                    class="h-5 w-5"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12Z"
                                    />
                                </svg>
                            </button>
                        </div>

                        <form
                            class="modal__form"
                            @submit.prevent="handleDuplicatePage"
                        >
                            <div class="modal__field">
                                <label for="duplicate-page-path"
                                    >Page path</label
                                >
                                <input
                                    id="duplicate-page-path"
                                    v-model="duplicatePageForm.path"
                                    type="text"
                                    required
                                    placeholder="/about-copy"
                                />
                            </div>

                            <div class="modal__field">
                                <label for="duplicate-page-title">Title</label>
                                <input
                                    id="duplicate-page-title"
                                    v-model="duplicatePageForm.title"
                                    type="text"
                                    required
                                />
                            </div>

                            <div class="modal__field-grid">
                                <div class="modal__field">
                                    <label for="duplicate-page-seo-title"
                                        >SEO title</label
                                    >
                                    <input
                                        id="duplicate-page-seo-title"
                                        v-model="duplicatePageForm.seoTitle"
                                        type="text"
                                    />
                                </div>
                                <div class="modal__field">
                                    <label for="duplicate-page-seo-description"
                                        >SEO description</label
                                    >
                                    <input
                                        id="duplicate-page-seo-description"
                                        v-model="
                                            duplicatePageForm.seoDescription
                                        "
                                        type="text"
                                    />
                                </div>
                            </div>

                            <div class="modal__field">
                                <label for="duplicate-page-meta"
                                    >Meta JSON (optional)</label
                                >
                                <textarea
                                    id="duplicate-page-meta"
                                    v-model="duplicatePageForm.meta"
                                    rows="3"
                                ></textarea>
                            </div>

                            <div class="modal__components-block">
                                <div class="modal__components-header">
                                    <span class="modal__section-title"
                                        >Components to duplicate</span
                                    >
                                    <p class="modal__section-subtitle">
                                        Uncheck components to exclude them from
                                        the cloned page.
                                    </p>
                                </div>
                                <div
                                    v-if="duplicateNodes.length"
                                    class="modal__components-list"
                                >
                                    <label
                                        v-for="node in duplicateNodes"
                                        :key="node.key"
                                        class="modal__components-item"
                                        :style="{
                                            '--component-indent': getDuplicateNodeIndent(
                                                node,
                                            ),
                                        }"
                                    >
                                        <input
                                            class="modal__components-checkbox"
                                            type="checkbox"
                                            :checked="node.selected"
                                            @change="
                                                handleDuplicateNodeToggle(
                                                    node.key,
                                                    $event,
                                                )
                                            "
                                        />
                                        <span class="modal__components-label">
                                            {{ node.label }}
                                        </span>
                                        <code class="modal__components-code">
                                            {{ node.component }}
                                        </code>
                                    </label>
                                </div>
                                <p v-else class="modal__components-empty">
                                    This page does not contain any components.
                                </p>
                            </div>

                            <div v-if="duplicatePageError" class="modal__error">
                                <svg
                                    class="content-admin-workbench__icon content-admin-workbench__icon--sm"
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm1-5h-2v-2h2Zm0-4h-2V7h2Z"
                                    />
                                </svg>
                                <span>{{ duplicatePageError }}</span>
                            </div>

                            <div class="modal__actions">
                                <button
                                    type="button"
                                    class="content-admin-workbench__button content-admin-workbench__button--muted"
                                    :class="ui.modalCancelButton"
                                    @click="closeDuplicateModal"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    class="content-admin-workbench__button content-admin-workbench__button--primary"
                                    :class="ui.modalSaveButton"
                                    :disabled="isDuplicatePending"
                                >
                                    <svg
                                        v-if="isDuplicatePending"
                                        class="content-admin-workbench__icon content-admin-workbench__icon--sm content-admin-workbench__spinner"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                    >
                                        <path
                                            fill="currentColor"
                                            d="M12 4V2a10 10 0 1 1-10 10h2a8 8 0 1 0 8-8Z"
                                        />
                                    </svg>
                                    <span>{{
                                        isDuplicatePending
                                            ? "Duplicating…"
                                            : "Duplicate page"
                                    }}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>

<style scoped>
.content-admin-workbench {
    display: flex;
    flex-direction: column;
}

.content-admin-workbench > * + * {
    margin-top: 1.5rem;
}

.content-admin-workbench__button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    border: 1px solid transparent;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.25rem;
    cursor: pointer;
    transition:
        background-color 0.2s ease,
        border-color 0.2s ease,
        box-shadow 0.2s ease,
        color 0.2s ease;
    outline: none;
}

.content-admin-workbench__button:disabled {
    cursor: not-allowed;
    opacity: 0.7;
}

.content-admin-workbench__button--primary {
    background-color: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
    box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.08);
}

.content-admin-workbench__button--primary:hover:not(:disabled) {
    background-color: #1d4ed8;
}

.content-admin-workbench__button--primary:focus-visible {
    box-shadow:
        0 0 0 2px #ffffff,
        0 0 0 4px rgba(59, 130, 246, 0.75);
}

.content-admin-workbench__button--danger {
    background-color: #ffffff;
    border-color: #fecaca;
    color: #dc2626;
}

.content-admin-workbench__button--danger:hover:not(:disabled) {
    background-color: #fef2f2;
}

.content-admin-workbench__button--danger:focus-visible {
    box-shadow:
        0 0 0 2px #ffffff,
        0 0 0 4px rgba(248, 113, 113, 0.65);
}

.content-admin-workbench__button--muted {
    background-color: #ffffff;
    border-color: #d1d5db;
    color: #4b5563;
    font-weight: 500;
}

.content-admin-workbench__button--muted:hover:not(:disabled) {
    background-color: #f9fafb;
}

.content-admin-workbench__button--muted:focus-visible {
    border-color: #2563eb;
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.35);
}

.content-admin-workbench__icon {
    display: block;
    flex-shrink: 0;
}

.content-admin-workbench__icon--sm {
    width: 1rem;
    height: 1rem;
}

.content-admin-workbench__icon--md {
    width: 1.25rem;
    height: 1.25rem;
}

.content-admin-workbench__icon--muted {
    color: #9ca3af;
}

@keyframes content-admin-workbench-spinner {
    to {
        transform: rotate(360deg);
    }
}

.content-admin-workbench__spinner {
    animation: content-admin-workbench-spinner 1s linear infinite;
}

.content-admin-workbench__header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

@media (min-width: 1024px) {
    .content-admin-workbench__header {
        flex-direction: row;
        align-items: flex-start;
        justify-content: space-between;
    }
}

.content-admin-workbench__title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #111827;
}

.content-admin-workbench__description {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: #4b5563;
}

.content-admin-workbench__header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.content-admin-workbench__panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
    background-color: #ffffff;
    padding: 1rem;
    box-shadow: 0 10px 30px -15px rgba(15, 23, 42, 0.2);
}

.content-admin-workbench__panel-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

@media (min-width: 1024px) {
    .content-admin-workbench__panel-controls {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }
}

.search-input {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    background-color: #ffffff;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #4b5563;
    width: 17rem;
}

.search-input:focus-within {
    border-color: #2563eb;
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.4);
}

.search-input input {
    width: 100%;
    border: 0;
    background: transparent;
    padding: 0;
    font-size: 0.875rem;
    color: #374151;
    outline: none;
}

.content-admin-workbench__error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #dc2626;
}

.content-admin-workbench__chip-list {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 3rem;
    overflow-x: auto;
    padding-bottom: 0.25rem;
}

.content-admin-workbench__chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 9999px;
    border: 1px solid #e5e7eb;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    background-color: #ffffff;
    transition:
        background-color 0.15s ease,
        border-color 0.15s ease,
        box-shadow 0.15s ease,
        color 0.15s ease;
    cursor: pointer;
    outline: none;
}

.content-admin-workbench__chip--active {
    border-color: #3b82f6;
    background-color: #eff6ff;
    color: #2563eb;
    box-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
}

.content-admin-workbench__chip--inactive {
    border-color: #e5e7eb;
    background-color: #ffffff;
    color: #374151;
}

.content-admin-workbench__chip--inactive:hover {
    border-color: #93c5fd;
    color: #2563eb;
}

.content-admin-workbench__chip:focus-visible {
    box-shadow:
        0 0 0 2px #ffffff,
        0 0 0 4px rgba(59, 130, 246, 0.45);
}

.content-admin-workbench__hint {
    font-size: 0.875rem;
    color: #6b7280;
}

.content-admin-workbench__editor {
    position: relative;
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
    background-color: #ffffff;
    box-shadow: 0 10px 30px -15px rgba(15, 23, 42, 0.16);
}

.content-admin-workbench__sentinel {
    position: absolute;
    top: 0;
    width: 100%;
    height: 1px;
    pointer-events: none;
}

.content-admin-workbench__editor-header {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    border-bottom: 1px solid #e5e7eb;
    padding: 1rem 1.25rem;
    background-color: #ffffff;
    transition: box-shadow 0.2s ease;
    z-index: 5;
}

.content-admin-workbench__editor-header.is-pinned {
    position: fixed;
    top: 0;
    z-index: 1000;
    box-shadow: 0 10px 30px -20px rgba(15, 23, 42, 0.3);
}

@media (min-width: 1024px) {
    .content-admin-workbench__editor-header {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
    }
}

.editor-header__left {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.editor-header__meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.875rem;
    color: #111827;
}

.editor-header__meta-label {
    font-weight: 600;
    color: #2563eb;
}

.editor-header__meta-value {
    font-weight: 500;
}

.editor-header__status {
    font-size: 0.75rem;
    color: #6b7280;
}

.editor-header__status-error {
    color: #dc2626;
    font-weight: 500;
}

.editor-header__status-time {
    color: #6b7280;
}

.editor-header__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.content-admin-workbench__editor-body {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
    padding: 1.25rem;
    container-type: inline-size;
    container-name: workbench;
}

@container workbench (min-width: 1000px) {
    .content-admin-workbench__editor-body {
        grid-template-columns: minmax(240px, 280px) 1fr;
    }

    .content-admin-workbench__editor-sidebar {
        display: block;
        border-right: 1px solid #e5e7eb;
        padding-right: 1.25rem;
    }

    .content-admin-workbench__condensed-history {
        display: none;
    }
}

.content-admin-workbench__editor-sidebar {
    border-right: 1px solid #e5e7eb;
    padding-right: 1.25rem;
    display: none;
}

.content-admin-workbench__condensed-history {
    display: block;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 1rem;
    margin-bottom: 1.5rem;
}

.condensed-history__header {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.condensed-history__label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.condensed-history__control {
    display: flex;
    flex-direction: column;
}

.content-admin-workbench__condensed-history select {
    width: 100%;
    margin-top: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid #d1d5db;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #111827;
    background-color: #ffffff;
}

.content-admin-workbench__condensed-history select:disabled {
    color: #9ca3af;
    background-color: #f9fafb;
}

.content-admin-workbench__condensed-history .sidebar__hint {
    margin-top: 0.5rem;
}

@container workbench (max-width: 999px) {
    .content-admin-workbench__editor-body {
        padding: 1rem;
        grid-template-columns: 1fr;
        grid-auto-rows: auto;
    }

    .content-admin-workbench__editor-body > * {
        width: 100%;
    }

    .content-admin-workbench__editor-canvas {
        gap: 0.75rem;
        width: 100%;
    }

    .editor-canvas__workbench,
    .builder-page,
    .editor-canvas__placeholder {
        width: 100%;
        padding: 0 !important;
    }
}

.sidebar__title {
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
}

.sidebar__subtitle {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: #6b7280;
}

.sidebar__hint {
    margin-top: 0.75rem;
    font-size: 0.875rem;
    color: #6b7280;
}

.sidebar__error {
    margin-top: 0.75rem;
    border-radius: 0.5rem;
    background-color: #fee2e2;
    color: #b91c1c;
    font-size: 0.875rem;
    padding: 0.75rem 1rem;
}

.sidebar__history {
    margin-top: 1rem;
    display: grid;
    gap: 0.5rem;
}

.sidebar__history-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 0.5rem;
    border: 1px solid transparent;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #374151;
    transition: all 0.15s ease;
    background-color: #f9fafb;
}

.sidebar__history-item:hover {
    background-color: #eef2ff;
    color: #1d4ed8;
}

.sidebar__history-item.is-active {
    background-color: #e0e7ff;
    border-color: #6366f1;
    color: #1d4ed8;
}

.content-admin-workbench__editor-canvas {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
}

.editor-canvas__error {
    border-radius: 0.5rem;
    border: 1px solid #fecaca;
    background-color: #fee2e2;
    color: #b91c1c;
    font-size: 0.875rem;
    padding: 0.75rem 1rem;
}

.editor-canvas__workbench {
    border-radius: 0.75rem;
    border: 1px solid #e5e7eb;
    background-color: #f9fafb;
    padding: 1rem;
    min-height: 600px;
}

.editor-canvas__workbench--full {
    min-height: 0;
}

.editor-canvas__preview-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.preview-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
}

.preview-subtitle {
    font-size: 0.875rem;
    color: #6b7280;
}

.editor-canvas__placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.75rem;
    border: 1px dashed #d1d5db;
    color: #6b7280;
    font-size: 0.875rem;
    min-height: 320px;
}

.content-admin-workbench__modal {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal__backdrop {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.45);
}

.modal__panel {
    position: relative;
    z-index: 1;
    width: min(100% - 2rem, 32rem);
    border-radius: 0.75rem;
    background-color: #ffffff;
    padding: 1.5rem;
    box-shadow: 0 25px 50px -12px rgba(30, 64, 175, 0.35);
}

.modal__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1rem;
}

.modal__title {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
}

.modal__subtitle {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: #6b7280;
}

.modal__close {
    border-radius: 0.5rem;
    padding: 0.25rem;
    color: #6b7280;
    transition: color 0.2s ease;
}

.modal__close:hover {
    color: #1f2937;
}

.modal__form {
    display: grid;
    gap: 1rem;
}

.modal__field {
    display: grid;
    gap: 0.25rem;
}

.modal__field label {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
}

.modal__field input,
.modal__field textarea {
    width: 100%;
    border-radius: 0.5rem;
    border: 1px solid #d1d5db;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: #111827;
    outline: none;
    transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    background-color: #ffffff;
}

.modal__field input:focus,
.modal__field textarea:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.3);
}

.modal__components-block {
    display: grid;
    gap: 0.5rem;
}

.modal__components-header {
    display: grid;
    gap: 0.25rem;
}

.modal__section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
}

.modal__section-subtitle {
    font-size: 0.75rem;
    color: #6b7280;
}

.modal__components-list {
    border-radius: 0.5rem;
    border: 1px solid #e5e7eb;
    background-color: #f9fafb;
    max-height: 14rem;
    overflow-y: auto;
}

.modal__components-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    padding-left: calc(0.75rem + var(--component-indent, 0rem));
    font-size: 0.875rem;
    color: #1f2937;
    border-top: 1px solid rgba(229, 231, 235, 0.8);
}

.modal__components-item:first-child {
    border-top: none;
}

.modal__components-checkbox {
    flex-shrink: 0;
}

.modal__components-label {
    flex: 1 1 auto;
    word-break: break-word;
}

.modal__components-code {
    font-size: 0.75rem;
    background-color: #e5e7eb;
    color: #111827;
    border-radius: 0.375rem;
    padding: 0.125rem 0.5rem;
}

.modal__components-empty {
    font-size: 0.75rem;
    color: #6b7280;
}

.modal__field-grid {
    display: grid;
    gap: 1rem;
}

@media (min-width: 1024px) {
    .modal__field-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

.modal__error {
    border-radius: 0.5rem;
    border: 1px solid #fecaca;
    background-color: #fee2e2;
    color: #b91c1c;
    font-size: 0.875rem;
    padding: 0.75rem 1rem;
}

.modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
