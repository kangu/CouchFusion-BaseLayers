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
import {
    buildLocalizedPath,
    setValueAtPath,
    resolveContentI18nConfig,
    resolveContentLocalePath,
} from "#content/utils/i18n";
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
    normalizeSeoImage,
} from "#content/utils/page-documents";
import type {
    ContentPageSummary,
    ContentPageHistoryEntry,
} from "#content/types/content-page";
import { useContentPagesStore } from "#content/app/stores/pages";
import {
    useLlmTranslations,
    type LlmTranslationLocaleReportEntry,
    type LlmTranslationOverwriteMode,
    type LlmTranslationScopeMode,
    type LlmTranslationTokenUsage,
} from "#content/app/composables/useLlmTranslations";
import { resolveLocaleMeta } from "#content/app/utils/locales-meta";
import type { InlinePreviewPropHint } from "#content/app/utils/inline-preview-prop-path";
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
    (e: "document-preview-change", document: MinimalContentDocument): void;
    (
        e: "font-preview-change",
        payload: {
            sansFamily: string;
            displayFamily: string;
            cssHrefs: string[];
        },
    ): void;
    (
        e: "theme-preview-change",
        payload: {
            tokens: Record<string, string>;
        },
    ): void;
    (
        e: "preview-motion-change",
        payload: {
            forceMotion: boolean;
            mediaPreference: "reduce" | "no-preference";
        },
    ): void;
    (e: "unsaved-state-change", hasChanges: boolean): void;
    (
        e: "node-focus",
        payload: {
            uid: string;
            path: string;
            mode?: "flash" | "lock" | "clear";
            propKey?: string;
            propPath?: string;
            scrollBlock?: ScrollLogicalPosition;
            forceScroll?: boolean;
        },
    ): void;
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
const runtimeConfig = useRuntimeConfig();
const contentI18nConfig = computed(() =>
    resolveContentI18nConfig(
        runtimeConfig.content?.i18n ?? runtimeConfig.public?.content?.i18n,
    ),
);
const initialTarget = computed<{
    basePath: string;
    locale: string;
} | null>(() => {
    const value = initialPath.value;
    if (!value) {
        return null;
    }

    const resolved = resolveContentLocalePath(value, contentI18nConfig.value);
    return {
        basePath: resolved.basePath,
        locale: resolved.locale,
    };
});
const activeLocale = ref(
    initialTarget.value?.locale ?? contentI18nConfig.value.defaultLocale,
);
const availableLocales = computed(() => contentI18nConfig.value.locales);
const translationSourceLocale = ref(activeLocale.value);
const isDefaultActiveLocale = computed(
    () => activeLocale.value === contentI18nConfig.value.defaultLocale,
);
const translationLocaleOptions = computed(() =>
    availableLocales.value.filter(
        (locale) => locale !== translationSourceLocale.value,
    ),
);
const stagedLocaleCount = computed(
    () => Object.keys(stagedDocumentsByLocale.value).length,
);
const hasActiveLocaleStagedDocument = computed(
    () => Boolean(stagedDocumentsByLocale.value[activeLocale.value]),
);

type BuilderWorkbenchInstance = ComponentPublicInstance<{
    getSerializedDocument: () => MinimalContentDocument;
    loadDocument: (doc: MinimalContentDocument | null) => void;
    focusNodeProp: (payload: {
        uid: string;
        propPath: string;
        sectionId?: string;
        hint?: InlinePreviewPropHint;
    }) => void;
}>;

const filterTerm = ref("");
const selectedPath = ref<string | null>(null);
const isSelectingPage = ref(false);
const selectionError = ref<string | null>(null);
const hasBootstrappedSelection = ref(false);
const builderSearchQuery = ref("");
const selectedTranslationPointers = ref<string[]>([]);

const builderRef = ref<BuilderWorkbenchInstance | null>(null);
const isSavePending = ref(false);
const isDeletePending = ref(false);
const saveError = ref<string | null>(null);
const lastSavedAt = ref<string | null>(null);
const selectedHistoryId = ref<string | null>(null);
const latestDocument = ref<MinimalContentDocument | null>(null);
const hasUnsavedChanges = ref(false);
const lastSavedSnapshot = ref<string | null>(null);
const forcePreviewMotion = ref(false);
const stagedDocumentsByLocale = ref<Record<string, MinimalContentDocument>>({});
const translationTargetLocales = ref<string[]>([]);
const translationOverwriteMode = ref<LlmTranslationOverwriteMode>("missing");
const translationScopeLabel = ref<string | null>(null);
const pendingTranslationPayload = ref<TranslateScopePayload | null>(null);
const translationConfigError = ref<string | null>(null);
const isTranslationConfigDialogOpen = ref(false);
const isTranslationDialogOpen = ref(false);
const selectedTranslationResultLocale = ref<string | null>(null);
const isPersistAllTranslationsPending = ref(false);
const isTranslationPersistPendingByLocale = ref<Record<string, boolean>>({});
const persistedTranslationLocales = ref<Record<string, string>>({});
const translationDraftValuesByLocale = ref<Record<string, Record<string, string>>>(
    {},
);
const translationDebugByLocale = ref<
    Record<
        string,
        {
            updatedAt: string;
            stagedMinimalDocument: MinimalContentDocument | null;
            persistRequestDocument: Record<string, any> | null;
            persistResponseDocument: Record<string, any> | null;
        }
    >
>({});
const translationNotice = ref<{
    type: "success" | "error";
    message: string;
} | null>(null);
const {
    pending: isTranslationPending,
    error: translationError,
    lastResult: translationLastResult,
    runTranslation,
    reset: resetTranslationState,
} = useLlmTranslations();

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
    seoImage: "",
    meta: "{}",
});

const duplicatePageForm = reactive({
    path: "/",
    title: "",
    seoTitle: "",
    seoDescription: "",
    seoImage: "",
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
const isHistoryMenuOpen = ref(false);
const isActionsMenuOpen = ref(false);
const isTranslationMenuOpen = ref(false);
const isInlineTranslationEnabled = ref(false);
const isFocusedEditActive = ref(false);
const historyMenuRef = ref<HTMLElement | null>(null);
const translationMenuRef = ref<HTMLElement | null>(null);

const headerFixedStyles = computed(() => {
    if (!isHeaderPinned.value) {
        return undefined;
    }
    return {
        top: "0px",
        left: headerPosition.left,
        width: headerPosition.width,
    };
});

watch(isFocusedEditActive, (isActive) => {
    if (isActive) {
        closeActionsMenu();
        closeHistoryMenu();
        return;
    }
    void nextTick(() => updateHeaderMeasurements());
});

let headerObserver: IntersectionObserver | null = null;
let resizeObserver: ResizeObserver | null = null;

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
const totalPagesCount = computed(() => availablePages.value?.length ?? 0);

const selectedSummary = computed<ContentPageSummary | null>(() => {
    if (!selectedPath.value) {
        return null;
    }
    return contentStore.getPage(selectedPath.value, activeLocale.value);
});
const toBasePath = (path: string): string =>
    resolveContentLocalePath(path, contentI18nConfig.value).basePath;
const currentEditedPath = computed(
    () => {
        const rawPath =
            selectedSummary.value?.path ?? latestDocument.value?.path ?? null;

        if (!rawPath) {
            return title.value;
        }

        const resolved = resolveContentLocalePath(
            rawPath,
            contentI18nConfig.value,
        );
        const basePath = resolved.basePath;

        if (activeLocale.value === contentI18nConfig.value.defaultLocale) {
            return basePath;
        }

        return buildLocalizedPath(
            basePath,
            activeLocale.value,
            contentI18nConfig.value,
        );
    },
);

const historyState = computed(() => {
    if (!selectedSummary.value?.path) {
        return null;
    }
    return contentStore.getHistoryState(
        selectedSummary.value.path,
        activeLocale.value,
    );
});

const historyEntries = computed<ContentPageHistoryEntry[]>(
    () => historyState.value?.data ?? [],
);
const isHistoryLoading = computed(() => historyState.value?.pending ?? false);
const historyError = computed(() => historyState.value?.error ?? null);

const isIndexLoading = computed(() => indexState.value.pending);
const indexError = computed(() => indexState.value.error);
const hasPages = computed(() => (availablePages.value?.length ?? 0) > 0);
const lastUpdatedDisplay = computed(() =>
    formatTimestamp(
        selectedSummary.value?.localization?.updatedAtByLocale?.[
            activeLocale.value
        ] ??
            selectedSummary.value?.updatedAt ??
            null,
        lastSavedAt.value,
    ),
);
const missingLocalizedCount = computed(
    () => selectedSummary.value?.localization?.missingLocalizedCount ?? 0,
);
const translationLocaleResults = computed(
    () => translationLastResult.value?.report.localeResults ?? [],
);
const activeTranslationLocaleResult = computed(() => {
    const current = selectedTranslationResultLocale.value;
    if (current) {
        const matched = translationLocaleResults.value.find(
            (entry) => entry.locale === current,
        );
        if (matched) {
            return matched;
        }
    }
    return translationLocaleResults.value[0] ?? null;
});
const hasPersistableTranslationLocales = computed(() =>
    translationLocaleResults.value.some(
        (entry) =>
            entry.status === "ok" &&
            !!stagedDocumentsByLocale.value[entry.locale] &&
            !isLocaleTranslationPersisted(entry.locale),
    ),
);
const translationCompletedAtDisplay = computed(() =>
    formatTimestamp(translationLastResult.value?.report.completedAt ?? null),
);
type TranslationReportTokenUsageSummary = LlmTranslationTokenUsage & {
    localeCount: number;
};
const translationReportTokenUsage = computed<TranslationReportTokenUsageSummary | null>(
    () => {
        let promptTokens = 0;
        let completionTokens = 0;
        let totalTokens = 0;
        let reasoningTokens = 0;
        let cachedPromptTokens = 0;
        let localeCount = 0;

        for (const entry of translationLocaleResults.value) {
            const usage = entry.tokenUsage;
            if (!usage) {
                continue;
            }

            localeCount += 1;
            promptTokens += usage.promptTokens || 0;
            completionTokens += usage.completionTokens || 0;
            totalTokens += usage.totalTokens || 0;
            reasoningTokens += usage.reasoningTokens || 0;
            cachedPromptTokens += usage.cachedPromptTokens || 0;
        }

        if (!localeCount) {
            return null;
        }

        return {
            promptTokens,
            completionTokens,
            totalTokens,
            reasoningTokens: reasoningTokens > 0 ? reasoningTokens : null,
            cachedPromptTokens: cachedPromptTokens > 0 ? cachedPromptTokens : null,
            localeCount,
        };
    },
);
const translationReportTokenUsageText = computed(() =>
    formatTokenUsageSummary(translationReportTokenUsage.value, {
        includeLocaleCount: true,
    }),
);
const activeTranslationLocaleTokenUsageText = computed(() =>
    formatTokenUsageSummary(activeTranslationLocaleResult.value?.tokenUsage ?? null),
);
const translationResultTargetLocales = computed(() =>
    translationLastResult.value?.report.localeResults.map((entry) => entry.locale) ??
    [],
);
const translationModalTitle = computed(() => {
    if (isTranslationPending.value) {
        return "Translation in progress";
    }
    return "Translation report";
});
const translationModalSubtitle = computed(() => {
    const scopeLabel = translationScopeLabel.value?.trim() || "Page";
    const sourceLocale =
        translationLastResult.value?.sourceLocale ?? translationSourceLocale.value;
    const targets = translationResultTargetLocales.value.length
        ? translationResultTargetLocales.value.join(", ")
        : translationTargetLocales.value.length
            ? translationTargetLocales.value.join(", ")
        : "none selected";
    return `Scope: ${scopeLabel}. From ${sourceLocale} to ${targets}.`;
});
const translationConfigModalSubtitle = computed(() => {
    const scopeLabel = pendingTranslationPayload.value?.label?.trim() || "Page";
    return `Scope: ${scopeLabel}. Source locale: ${translationSourceLocale.value}.`;
});
const translationHasDialogContent = computed(
    () =>
        isTranslationPending.value ||
        !!translationNotice.value ||
        !!translationLastResult.value,
);
const pageListId = "content-admin-pages-datalist";

const searchPlaceholder = computed(() => {
    if (isIndexLoading.value) {
        return "Loading pages…";
    }
    return `Search pages (${totalPagesCount.value} total)`;
});

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
    if (selectedHistoryDocument.value) {
        return selectedHistoryDocument.value;
    }

    const staged = stagedDocumentsByLocale.value[activeLocale.value];
    if (staged) {
        return clonePlain(staged);
    }

    return resolveDocument(selectedSummary.value);
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

        const target = initialTarget.value?.basePath ?? initialPath.value;
        if (target) {
            const match = pages.find(
                (entry) => normalizePagePath(entry.path) === target,
            );
            if (match) {
                hasBootstrappedSelection.value = true;
                openPageForEditing(match.path);
                return;
            }

            hasBootstrappedSelection.value = true;
            openPageForEditing(target);
            return;
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
        closeHistoryMenu();
        closeActionsMenu();
        if (!path) {
            emit("page-selected", null);
            return;
        }
        const basePath = toBasePath(path);
        selectedPath.value = basePath;
        selectedHistoryId.value = null;
        emit("page-selected", selectedSummary.value ?? null);
        contentStore
            .fetchHistory(basePath, false, { locale: activeLocale.value })
            .catch(() => {});
    },
);

watch(
    () => translationLocaleOptions.value,
    (options) => {
        const allowed = new Set(options);
        translationTargetLocales.value = translationTargetLocales.value.filter(
            (locale) => allowed.has(locale),
        );
    },
    { immediate: true },
);

watch(
    () => availableLocales.value,
    (locales) => {
        if (locales.includes(translationSourceLocale.value)) {
            return;
        }
        if (locales.includes(activeLocale.value)) {
            translationSourceLocale.value = activeLocale.value;
            return;
        }
        translationSourceLocale.value =
            locales[0] ?? contentI18nConfig.value.defaultLocale;
    },
    { immediate: true },
);

watch(
    () => translationError.value,
    (message) => {
        if (!message) {
            return;
        }
        translationNotice.value = {
            type: "error",
            message,
        };
        isTranslationDialogOpen.value = true;
    },
);

watch(
    () => translationLocaleResults.value.map((entry) => entry.locale),
    (locales) => {
        if (!locales.length) {
            selectedTranslationResultLocale.value = null;
            return;
        }
        if (
            !selectedTranslationResultLocale.value ||
            !locales.includes(selectedTranslationResultLocale.value)
        ) {
            selectedTranslationResultLocale.value = locales[0];
        }
    },
    { immediate: true },
);

watch(
    () => translationLastResult.value,
    (result) => {
        if (!result) {
            translationDraftValuesByLocale.value = {};
            return;
        }

        const nextDrafts: Record<string, Record<string, string>> = {};
        for (const entry of result.report.localeResults) {
            if (entry.status !== "ok" || !Array.isArray(entry.translations)) {
                continue;
            }
            nextDrafts[entry.locale] = Object.fromEntries(
                entry.translations
                    .filter(
                        (
                            row,
                        ): row is {
                            key: string;
                            value: string;
                        } =>
                            Boolean(
                                row &&
                                    typeof row.key === "string" &&
                                    typeof row.value === "string",
                            ),
                    )
                    .map((row) => [row.key, row.value]),
            );
        }
        translationDraftValuesByLocale.value = nextDrafts;
    },
    { immediate: true },
);

watch(
    () => activeLocale.value,
    async (nextLocale, previousLocale) => {
        if (!selectedPath.value || nextLocale === previousLocale) {
            return;
        }

        if (hasUnsavedChanges.value) {
            const confirmed = await confirmDiscardUnsavedChanges();
            if (!confirmed) {
                activeLocale.value = previousLocale;
                return;
            }
            updateUnsavedState(false);
            lastSavedSnapshot.value = null;
        }

        await openPageForEditing(selectedPath.value, true);
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

const handleHistoryMenuOutsidePointerDown = (event: PointerEvent) => {
    if (
        !isHistoryMenuOpen.value &&
        !isActionsMenuOpen.value &&
        !isTranslationMenuOpen.value
    ) {
        return;
    }
    const target = event.target as Node | null;
    if (historyMenuRef.value && target && !historyMenuRef.value.contains(target)) {
        closeHistoryMenu();
        closeActionsMenu();
    }
    if (
        translationMenuRef.value &&
        target &&
        !translationMenuRef.value.contains(target)
    ) {
        closeTranslationMenu();
    }
};

const handleHistoryMenuEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
        closeHistoryMenu();
        closeActionsMenu();
        closeTranslationMenu();
    }
};

onMounted(() => {
    if (typeof window === "undefined") {
        return;
    }

    updateHeaderMeasurements();

    window.addEventListener("resize", updateHeaderMeasurements);
    window.addEventListener("pointerdown", handleHistoryMenuOutsidePointerDown);
    window.addEventListener("keydown", handleHistoryMenuEscape);

    if ("ResizeObserver" in window) {
        resizeObserver = new ResizeObserver(() => updateHeaderMeasurements());

        if (headerRef.value) {
            resizeObserver.observe(headerRef.value);
        }

        if (editorCardRef.value) {
            resizeObserver.observe(editorCardRef.value);
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
        window.removeEventListener(
            "pointerdown",
            handleHistoryMenuOutsidePointerDown,
        );
        window.removeEventListener("keydown", handleHistoryMenuEscape);
    }

    headerObserver?.disconnect();
    resizeObserver?.disconnect();
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

function formatTokenUsageSummary(
    usage: LlmTranslationTokenUsage | TranslationReportTokenUsageSummary | null,
    options?: {
        includeLocaleCount?: boolean;
    },
): string | null {
    if (!usage) {
        return null;
    }

    const summary = [
        `Total ${usage.totalTokens.toLocaleString()}`,
        `Prompt ${usage.promptTokens.toLocaleString()}`,
        `Completion ${usage.completionTokens.toLocaleString()}`,
    ];

    if (
        typeof usage.reasoningTokens === "number" &&
        Number.isFinite(usage.reasoningTokens) &&
        usage.reasoningTokens > 0
    ) {
        summary.push(`Reasoning ${usage.reasoningTokens.toLocaleString()}`);
    }

    if (
        typeof usage.cachedPromptTokens === "number" &&
        Number.isFinite(usage.cachedPromptTokens) &&
        usage.cachedPromptTokens > 0
    ) {
        summary.push(
            `Cached prompt ${usage.cachedPromptTokens.toLocaleString()}`,
        );
    }

    if (
        options?.includeLocaleCount &&
        "localeCount" in usage &&
        typeof usage.localeCount === "number" &&
        usage.localeCount > 0
    ) {
        summary.push(`Across ${usage.localeCount} locale(s)`);
    }

    return summary.join(" · ");
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
            seoImage: summary.seoImage ?? undefined,
            navigation: true,
            extension: "md",
            meta: summary.meta ?? {},
        },
        { spacing: "none" },
    );
}

async function openPageForEditing(path: string, force = false): Promise<void> {
    const normalizedPath = toBasePath(normalizePagePath(path));
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

    if (normalizedPath !== selectedPath.value) {
        selectedTranslationPointers.value = [];
        stagedDocumentsByLocale.value = {};
        resetTranslationPersistenceState();
        translationScopeLabel.value = null;
        pendingTranslationPayload.value = null;
        translationConfigError.value = null;
        isTranslationConfigDialogOpen.value = false;
        translationNotice.value = null;
        isTranslationDialogOpen.value = false;
        resetTranslationState();
    }

    hasLoadedInitialDocument.value = false;
    lastSavedSnapshot.value = null;
    isSelectingPage.value = true;
    selectionError.value = null;
    saveError.value = null;

    try {
        await contentStore.fetchPage(normalizedPath, force, {
            locale: activeLocale.value,
        });
        selectedPath.value = normalizedPath;
        lastSavedAt.value = null;
        selectedHistoryId.value = null;
        updateUnsavedState(false);
        contentStore
            .fetchHistory(normalizedPath, force, { locale: activeLocale.value })
            .catch(() => {});
    } catch (error: any) {
        selectionError.value = error?.message || "Failed to load page content.";
    } finally {
        isSelectingPage.value = false;
    }
}

function handlePageSearchChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!target) {
        return;
    }

    const rawValue = target.value.trim();
    if (!rawValue) {
        return;
    }

    const normalizedPath = normalizePagePath(rawValue);
    const pages = availablePages.value ?? [];
    const byPath = pages.find(
        (page) => normalizePagePath(page.path) === normalizedPath,
    );
    if (byPath) {
        openPageForEditing(byPath.path);
        return;
    }

    const lowerValue = rawValue.toLowerCase();
    const byTitle = pages.find(
        (page) => page.title?.toLowerCase() === lowerValue,
    );
    if (byTitle) {
        openPageForEditing(byTitle.path);
    }
}

function resetCreatePageForm(): void {
    newPageForm.path = "/";
    newPageForm.title = "";
    newPageForm.seoTitle = "";
    newPageForm.seoDescription = "";
    newPageForm.seoImage = "";
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

function normaliseSeoImage(value: string | null | undefined): string | null {
    return normalizeSeoImage(value ?? null);
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

function resetDuplicatePageForm(document: MinimalContentDocument | null): void {
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
    duplicatePageForm.seoImage = normalizeSeoImage(
        sourceDoc?.seo?.image ?? summary?.seoImage ?? "",
    ) ?? "";
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
        const seoImage = normaliseSeoImage(newPageForm.seoImage);
        const summary = await contentStore.createPage({
            path: normalizedPath,
            title: newPageForm.title,
            seoTitle: newPageForm.seoTitle || newPageForm.title,
            seoDescription: newPageForm.seoDescription || "SEO description.",
            seoImage,
            meta: metaPayload,
        }, { locale: contentI18nConfig.value.defaultLocale });
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

        const duplicatedSeoImage = normaliseSeoImage(duplicatePageForm.seoImage);
        const duplicatedMinimal: MinimalContentDocument = {
            ...baseDocument,
            id: contentIdFromPath(normalizedPath),
            path: normalizedPath,
            title: duplicatePageForm.title,
            seo: {
                title: duplicatePageForm.seoTitle || duplicatePageForm.title,
                description:
                    duplicatePageForm.seoDescription || "SEO description.",
                image: duplicatedSeoImage,
            },
            meta: metaPayload,
            stem: deriveStem(normalizedPath),
            body: {
                type: baseDocument.body?.type ?? "minimal",
                value: filteredBody,
            },
        };

        const contentDocument = minimalToContentDocument(duplicatedMinimal);
        const duplicatedSummary = await contentStore.saveDocument(contentDocument, {
            method: "POST",
            locale: contentI18nConfig.value.defaultLocale,
        });

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
        updateUnsavedState(hasActiveLocaleStagedDocument.value);
    } else {
        updateUnsavedState(serialized !== lastSavedSnapshot.value);
    }

    emit("document-change", document);
}

function handleDocumentPreviewChange(document: MinimalContentDocument): void {
    emit("document-preview-change", document);
}

function handleFontPreviewChange(payload: {
    sansFamily: string;
    displayFamily: string;
    cssHrefs: string[];
}): void {
    emit("font-preview-change", payload);
}

function handleThemePreviewChange(payload: {
    tokens: Record<string, string>;
}): void {
    emit("theme-preview-change", payload);
}

function handleNodeFocus(
    payload:
        | {
              uid?: string;
              path?: string;
              mode?: string;
              propKey?: string;
              propPath?: string;
              scrollBlock?: ScrollLogicalPosition;
              forceScroll?: boolean;
          }
        | Event,
): void {
    if (!payload || typeof payload !== "object" || payload instanceof Event) {
        return;
    }
    if (typeof payload.uid !== "string" || typeof payload.path !== "string") {
        return;
    }
    emit("node-focus", {
        uid: payload.uid,
        path: payload.path,
        mode:
            payload.mode === "flash" ||
            payload.mode === "lock" ||
            payload.mode === "clear"
                ? payload.mode
                : undefined,
        propKey:
            typeof payload.propKey === "string" ? payload.propKey : undefined,
        propPath:
            typeof payload.propPath === "string" ? payload.propPath : undefined,
        scrollBlock: payload.scrollBlock,
        forceScroll: payload.forceScroll === true,
    });
}

type TranslateScopePayload = {
    scopeMode: LlmTranslationScopeMode;
    scopePointer: string | null;
    label?: string;
    selectedScopePointers?: string[];
};

const setTranslationNotice = (
    type: "success" | "error",
    message: string,
) => {
    translationNotice.value = { type, message };
    if (type === "error") {
        console.warn("[content][llm-translations]", message);
    }
};

const normalizeSelectedTranslationPointers = (value: unknown): string[] => {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(
        new Set(
            value
                .filter((entry): entry is string => typeof entry === "string")
                .map((entry) => entry.trim())
                .filter((entry) => entry.startsWith("/")),
        ),
    ).sort();
};

const pendingSelectedScopePointers = computed(() =>
    normalizeSelectedTranslationPointers(
        pendingTranslationPayload.value?.selectedScopePointers,
    ),
);
const pendingSelectedScopeCount = computed(
    () => pendingSelectedScopePointers.value.length,
);

const handleSelectedTranslationPointersUpdate = (value: unknown): void => {
    selectedTranslationPointers.value = normalizeSelectedTranslationPointers(value);
};

const getLocaleLabel = (locale: string): string =>
    resolveLocaleMeta(locale).label;

const getLocaleFlagSvg = (locale: string): string =>
    resolveLocaleMeta(locale).flagSvg;

const cloneMinimalForDebug = (
    document: MinimalContentDocument | null | undefined,
): MinimalContentDocument | null =>
    document ? clonePlain(document) : null;

const cloneRecordForDebug = (
    value: Record<string, any> | null | undefined,
): Record<string, any> | null => (value ? clonePlain(value) : null);

function mergeTranslationLocaleDebug(
    locale: string,
    patch: Partial<{
        stagedMinimalDocument: MinimalContentDocument | null;
        persistRequestDocument: Record<string, any> | null;
        persistResponseDocument: Record<string, any> | null;
    }>,
): void {
    const current = translationDebugByLocale.value[locale] ?? {
        updatedAt: new Date().toISOString(),
        stagedMinimalDocument: null,
        persistRequestDocument: null,
        persistResponseDocument: null,
    };
    const next = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
    };
    translationDebugByLocale.value = {
        ...translationDebugByLocale.value,
        [locale]: next,
    };
}

const toTranslationDebugDocumentDump = (document: unknown) => {
    if (!document || typeof document !== "object") {
        return null;
    }
    const raw = document as Record<string, any>;
    const body = raw.body && typeof raw.body === "object" ? raw.body : null;
    const bodyValue = Array.isArray(body?.value) ? body.value : null;
    const meta = raw.meta && typeof raw.meta === "object" ? raw.meta : null;
    const contentI18n =
        meta &&
        meta.contentI18n &&
        typeof meta.contentI18n === "object" &&
        !Array.isArray(meta.contentI18n)
            ? meta.contentI18n
            : null;

    return {
        id:
            typeof raw.id === "string"
                ? raw.id
                : typeof raw._id === "string"
                    ? raw._id
                    : null,
        path: typeof raw.path === "string" ? raw.path : null,
        contentI18n,
        bodyValue,
    };
};

function getTranslationLocaleDebugDump(locale: string): string {
    const reportEntry =
        translationLastResult.value?.report.localeResults.find(
            (entry) => entry.locale === locale,
        ) ?? null;
    const debugState = translationDebugByLocale.value[locale] ?? null;
    const stagedLiveDocument =
        stagedDocumentsByLocale.value[locale] ?? null;

    const payload = {
        locale,
        sourceLocale: translationLastResult.value?.sourceLocale ?? null,
        overwriteMode: translationLastResult.value?.overwriteMode ?? null,
        report: reportEntry
            ? {
                  status: reportEntry.status,
                  translatedCount: reportEntry.translatedCount,
                  appliedCount: reportEntry.appliedCount,
                  skippedCount: reportEntry.skippedCount,
                  returnedTranslations: Array.isArray(reportEntry.translations)
                      ? reportEntry.translations
                      : [],
              }
            : null,
        stagedMinimal: toTranslationDebugDocumentDump(
            debugState?.stagedMinimalDocument ?? stagedLiveDocument,
        ),
        persistRequest: toTranslationDebugDocumentDump(
            debugState?.persistRequestDocument ?? null,
        ),
        persistResponse: toTranslationDebugDocumentDump(
            debugState?.persistResponseDocument ?? null,
        ),
        debugUpdatedAt: debugState?.updatedAt ?? null,
    };

    return JSON.stringify(payload, null, 2);
}

function getTranslationDraftValue(
    locale: string,
    key: string,
    fallback = "",
): string {
    const localeDrafts = translationDraftValuesByLocale.value[locale];
    const value = localeDrafts?.[key];
    return typeof value === "string" ? value : fallback;
}

function isTranslationDraftChanged(
    locale: string,
    key: string,
    original: string,
): boolean {
    return getTranslationDraftValue(locale, key, original) !== original;
}

function isTranslationDraftEditable(locale: string): boolean {
    return (
        !isLocaleTranslationPersistPending(locale) &&
        !isLocaleTranslationPersisted(locale)
    );
}

const INTEGER_POINTER_SEGMENT = /^(?:0|[1-9]\d*)$/;
const SEO_TITLE_POINTER = "/__seo/title";
const SEO_DESCRIPTION_POINTER = "/__seo/description";

function decodePointerSegment(segment: string): string {
    return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function parseBodyPointer(pointer: string): string[] | null {
    if (typeof pointer !== "string" || !pointer.startsWith("/")) {
        return null;
    }
    const segments = pointer
        .split("/")
        .slice(1)
        .map((segment) => decodePointerSegment(segment));
    return segments.length ? segments : null;
}

function parseJsonString(value: string): unknown | null {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function readPointerValue(container: unknown, segments: string[]): unknown {
    let cursor: any = container;
    for (let index = 0; index < segments.length; index += 1) {
        const key = resolveContainerSegment(cursor, segments[index]);
        if (Array.isArray(cursor)) {
            if (
                typeof key !== "number" ||
                key < 0 ||
                key >= cursor.length ||
                typeof cursor[key] === "undefined"
            ) {
                return undefined;
            }
            cursor = cursor[key];
            continue;
        }
        if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
            return undefined;
        }
        cursor = cursor[key];
    }
    return cursor;
}

function writePointerValue(
    container: unknown,
    segments: string[],
    value: unknown,
): boolean {
    if (!segments.length) {
        return false;
    }

    let cursor: any = container;
    for (let index = 0; index < segments.length - 1; index += 1) {
        const key = resolveContainerSegment(cursor, segments[index]);
        if (Array.isArray(cursor)) {
            if (
                typeof key !== "number" ||
                key < 0 ||
                key >= cursor.length ||
                typeof cursor[key] === "undefined"
            ) {
                return false;
            }
            cursor = cursor[key];
            continue;
        }
        if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
            return false;
        }
        cursor = cursor[key];
    }

    const leafKey = resolveContainerSegment(cursor, segments[segments.length - 1]);
    if (Array.isArray(cursor)) {
        if (
            typeof leafKey !== "number" ||
            leafKey < 0 ||
            leafKey >= cursor.length
        ) {
            return false;
        }
        cursor[leafKey] = value;
        return true;
    }
    if (!cursor || typeof cursor !== "object" || typeof leafKey !== "string") {
        return false;
    }
    (cursor as Record<string, unknown>)[leafKey] = value;
    return true;
}

type EncodedPointerWriteTarget = {
    encodedSegments: string[];
    nestedSegments: string[];
    parsedRoot: unknown;
};

function resolveEncodedPointerWriteTarget(
    bodyValue: unknown,
    segments: string[],
): EncodedPointerWriteTarget | null {
    for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        if (segment.startsWith(":")) {
            continue;
        }

        const encodedSegments = [
            ...segments.slice(0, index),
            `:${segment}`,
        ];
        const encodedRaw = readPointerValue(bodyValue, encodedSegments);
        if (typeof encodedRaw !== "string") {
            continue;
        }

        const parsedRoot = parseJsonString(encodedRaw);
        if (parsedRoot === null) {
            continue;
        }

        return {
            encodedSegments,
            nestedSegments: segments.slice(index + 1),
            parsedRoot,
        };
    }

    return null;
}

function toPathSegments(segments: string[]): Array<string | number> {
    return segments.map((segment) =>
        INTEGER_POINTER_SEGMENT.test(segment)
            ? Number.parseInt(segment, 10)
            : segment,
    );
}

function resolveContainerSegment(
    container: unknown,
    segment: string,
): string | number {
    if (Array.isArray(container) && INTEGER_POINTER_SEGMENT.test(segment)) {
        return Number.parseInt(segment, 10);
    }
    return segment;
}

function setBodyPointerStringValue(
    bodyValue: unknown,
    pointer: string,
    value: string,
): boolean {
    const segments = parseBodyPointer(pointer);
    if (!segments || !segments.length) {
        return false;
    }

    const encodedTarget = resolveEncodedPointerWriteTarget(bodyValue, segments);
    if (encodedTarget) {
        const nextParsedRoot =
            encodedTarget.nestedSegments.length > 0
                ? setValueAtPath(
                      encodedTarget.parsedRoot,
                      toPathSegments(encodedTarget.nestedSegments),
                      value,
                  )
                : value;

        const didWriteEncoded = writePointerValue(
            bodyValue,
            encodedTarget.encodedSegments,
            JSON.stringify(nextParsedRoot),
        );
        if (!didWriteEncoded) {
            return false;
        }

        // Keep legacy direct mirror props (if present) in sync with encoded values.
        const directExistingValue = readPointerValue(bodyValue, segments);
        if (typeof directExistingValue !== "undefined") {
            writePointerValue(bodyValue, segments, value);
        }
        return true;
    }

    return writePointerValue(bodyValue, segments, value);
}

function setDocumentPointerStringValue(
    document: MinimalContentDocument,
    pointer: string,
    value: string,
): boolean {
    if (pointer === SEO_TITLE_POINTER) {
        if (!document.seo || typeof document.seo !== "object") {
            document.seo = {
                title: value,
                description: "",
                image: null,
            };
            return true;
        }
        document.seo.title = value;
        return true;
    }

    if (pointer === SEO_DESCRIPTION_POINTER) {
        if (!document.seo || typeof document.seo !== "object") {
            document.seo = {
                title: "",
                description: value,
                image: null,
            };
            return true;
        }
        document.seo.description = value;
        return true;
    }

    if (!document.body || !Array.isArray(document.body.value)) {
        return false;
    }

    return setBodyPointerStringValue(document.body.value, pointer, value);
}

function applyTranslationDraftToStagedDocument(
    locale: string,
    pointer: string,
    value: string,
): boolean {
    const staged = stagedDocumentsByLocale.value[locale];
    if (!staged) {
        return false;
    }

    const nextStaged = clonePlain(staged);
    const applied = setDocumentPointerStringValue(nextStaged, pointer, value);
    if (!applied) {
        return false;
    }

    stagedDocumentsByLocale.value = {
        ...stagedDocumentsByLocale.value,
        [locale]: nextStaged,
    };
    mergeTranslationLocaleDebug(locale, {
        stagedMinimalDocument: cloneMinimalForDebug(nextStaged),
    });
    return true;
}

function applyAllDraftsToStagedDocument(locale: string): MinimalContentDocument | null {
    const staged = stagedDocumentsByLocale.value[locale];
    if (!staged) {
        return null;
    }

    const localeDrafts = translationDraftValuesByLocale.value[locale] ?? {};
    const nextStaged = clonePlain(staged);
    for (const [pointer, value] of Object.entries(localeDrafts)) {
        setDocumentPointerStringValue(nextStaged, pointer, value);
    }

    stagedDocumentsByLocale.value = {
        ...stagedDocumentsByLocale.value,
        [locale]: nextStaged,
    };
    mergeTranslationLocaleDebug(locale, {
        stagedMinimalDocument: cloneMinimalForDebug(nextStaged),
    });
    return nextStaged;
}

function updateTranslationDraft(
    locale: string,
    key: string,
    value: string,
): void {
    const localeDrafts = translationDraftValuesByLocale.value[locale] ?? {};
    translationDraftValuesByLocale.value = {
        ...translationDraftValuesByLocale.value,
        [locale]: {
            ...localeDrafts,
            [key]: value,
        },
    };

    if (!isTranslationDraftEditable(locale)) {
        return;
    }

    const applied = applyTranslationDraftToStagedDocument(locale, key, value);
    if (!applied) {
        console.warn(
            `[content][llm-translations] Unable to apply staged draft value for ${locale} at ${key}`,
        );
    }
}

function handleTranslationDraftInput(
    locale: string,
    key: string,
    event: Event,
): void {
    const target = event.target as HTMLTextAreaElement | null;
    if (!target) {
        return;
    }
    updateTranslationDraft(locale, key, target.value);
}

function getTranslationLocalePersistState(
    entry: LlmTranslationLocaleReportEntry,
): {
    label: string;
    className: string;
} {
    if (entry.status !== "ok") {
        return {
            label: "failed",
            className: "translation-modal__locale-persist-state--error",
        };
    }
    if (isLocaleTranslationPersistPending(entry.locale)) {
        return {
            label: "persisting",
            className: "translation-modal__locale-persist-state--pending",
        };
    }
    if (isLocaleTranslationPersisted(entry.locale)) {
        return {
            label: "persisted",
            className: "translation-modal__locale-persist-state--persisted",
        };
    }
    return {
        label: "not persisted",
        className: "translation-modal__locale-persist-state--staged",
    };
}

function resetTranslationPersistenceState(): void {
    isTranslationPersistPendingByLocale.value = {};
    persistedTranslationLocales.value = {};
    isPersistAllTranslationsPending.value = false;
    translationDraftValuesByLocale.value = {};
    translationDebugByLocale.value = {};
}

function isLocaleTranslationPersistPending(locale: string): boolean {
    return Boolean(isTranslationPersistPendingByLocale.value[locale]);
}

function isLocaleTranslationPersisted(locale: string): boolean {
    return Boolean(persistedTranslationLocales.value[locale]);
}

function setLocaleTranslationPersistPending(
    locale: string,
    value: boolean,
): void {
    const next = { ...isTranslationPersistPendingByLocale.value };
    if (value) {
        next[locale] = true;
    } else {
        delete next[locale];
    }
    isTranslationPersistPendingByLocale.value = next;
}

const applyStagedTranslations = (
    stagedByLocale: Record<string, MinimalContentDocument> | null | undefined,
) => {
    const entries = Object.entries(stagedByLocale ?? {});
    if (!entries.length) {
        return [];
    }

    const next = { ...stagedDocumentsByLocale.value };
    const appliedLocales: string[] = [];

    for (const [locale, document] of entries) {
        next[locale] = clonePlain(document);
        appliedLocales.push(locale);
        mergeTranslationLocaleDebug(locale, {
            stagedMinimalDocument: cloneMinimalForDebug(document),
            persistRequestDocument: null,
            persistResponseDocument: null,
        });
    }

    stagedDocumentsByLocale.value = next;
    return appliedLocales;
};

const resolveTranslationSourceDocument = async (
    path: string,
    sourceLocale: string,
    builder: BuilderWorkbenchInstance,
): Promise<MinimalContentDocument> => {
    const stagedSource = stagedDocumentsByLocale.value[sourceLocale];
    if (stagedSource) {
        return clonePlain(stagedSource);
    }

    if (sourceLocale === activeLocale.value) {
        return builder.getSerializedDocument();
    }

    await contentStore.fetchPage(path, false, { locale: sourceLocale });
    const sourceSummary = contentStore.getPage(path, sourceLocale);
    if (!sourceSummary?.document) {
        throw new Error(`Source locale document not found for ${sourceLocale}.`);
    }

    return contentToMinimalDocument(sourceSummary.document);
};

const runScopedTranslation = async (
    payload: TranslateScopePayload,
): Promise<void> => {
    translationNotice.value = null;
    resetTranslationPersistenceState();

    if (!selectedSummary.value) {
        setTranslationNotice("error", "Select a page before translating.");
        return;
    }

    if (selectedHistoryId.value) {
        const message = "Switch to Current version before running translation.";
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
        return;
    }

    if (!translationTargetLocales.value.length) {
        const message = "Select at least one target locale.";
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
        return;
    }

    const builder = builderRef.value;
    if (!builder) {
        const message = "Builder not ready.";
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
        return;
    }

    const path = selectedPath.value ?? selectedSummary.value.path;
    const sourceLocale = translationSourceLocale.value;
    if (!availableLocales.value.includes(sourceLocale)) {
        const message = "Select a valid source locale.";
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
        return;
    }

    if (translationTargetLocales.value.includes(sourceLocale)) {
        const message = "Source locale cannot also be a destination locale.";
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
        return;
    }

    const sourceDocument = await resolveTranslationSourceDocument(
        path,
        sourceLocale,
        builder,
    );
    translationScopeLabel.value = payload.label ?? null;
    isTranslationDialogOpen.value = true;

    const result = await runTranslation({
        path,
        sourceLocale,
        targetLocales: translationTargetLocales.value,
        sourceDocument,
        scopeMode: payload.scopeMode,
        scopePointer: payload.scopePointer,
        overwriteMode: translationOverwriteMode.value,
        selectedScopePointers: payload.selectedScopePointers,
    });

    const appliedLocales = applyStagedTranslations(result.stagedDocumentsByLocale);
    if (appliedLocales.includes(activeLocale.value)) {
        const staged = stagedDocumentsByLocale.value[activeLocale.value];
        if (staged) {
            builder.loadDocument(clonePlain(staged));
            updateUnsavedState(true);
        }
    }

    const successCount = result.report.localeResults.filter(
        (entry) => entry.status === "ok",
    ).length;
    const errorCount = result.report.localeResults.length - successCount;
    const firstError = result.report.localeResults.find(
        (entry) => entry.status === "error" && typeof entry.error === "string",
    );
    const scopeLabel = payload.label?.trim() || payload.scopeMode;
    if (successCount > 0) {
        const message = `Translation (${scopeLabel}) completed for ${successCount} locale(s)${
            errorCount > 0 ? `, ${errorCount} failed` : ""
        }.`;
        setTranslationNotice("success", message);
        feedback.value.success?.(message);
        if (selectedTranslationPointers.value.length > 0) {
            selectedTranslationPointers.value = [];
        }
    } else {
        const message = firstError?.error
            ? `Translation (${scopeLabel}) failed for all selected locales. ${firstError.locale}: ${firstError.error}`
            : `Translation (${scopeLabel}) failed for all selected locales.`;
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
    }
};

const closeTranslationDialog = (): void => {
    if (isTranslationPending.value) {
        return;
    }
    isTranslationDialogOpen.value = false;
};

const openTranslationConfigDialog = (payload: TranslateScopePayload): void => {
    if (!selectedSummary.value) {
        setTranslationNotice("error", "Select a page before translating.");
        return;
    }

    if (selectedHistoryId.value) {
        const message = "Switch to Current version before running translation.";
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
        return;
    }

    pendingTranslationPayload.value = payload;
    translationConfigError.value = null;
    translationSourceLocale.value = activeLocale.value;
    const allowedTargets = new Set(translationLocaleOptions.value);
    translationTargetLocales.value = translationTargetLocales.value.filter(
        (locale) => allowedTargets.has(locale),
    );
    if (!translationTargetLocales.value.length) {
        translationTargetLocales.value = [...translationLocaleOptions.value];
    }
    isTranslationConfigDialogOpen.value = true;
};

const closeTranslationConfigDialog = (): void => {
    if (isTranslationPending.value) {
        return;
    }
    isTranslationConfigDialogOpen.value = false;
    pendingTranslationPayload.value = null;
    translationConfigError.value = null;
};

const clearPendingTranslationSelection = (): void => {
    if (isTranslationPending.value || !pendingTranslationPayload.value) {
        return;
    }

    if (!pendingSelectedScopeCount.value) {
        return;
    }

    selectedTranslationPointers.value = [];
    pendingTranslationPayload.value = {
        ...pendingTranslationPayload.value,
        label:
            pendingTranslationPayload.value.scopeMode === "page"
                ? "Page"
                : pendingTranslationPayload.value.label,
        selectedScopePointers: undefined,
    };
};

const confirmTranslationConfigAndRun = async (): Promise<void> => {
    if (isTranslationPending.value) {
        return;
    }

    const payload = pendingTranslationPayload.value;
    if (!payload) {
        return;
    }

    if (!availableLocales.value.includes(translationSourceLocale.value)) {
        translationConfigError.value = "Select a valid source locale.";
        return;
    }

    if (translationTargetLocales.value.includes(translationSourceLocale.value)) {
        translationConfigError.value =
            "Source locale cannot also be a destination locale.";
        return;
    }

    if (!translationTargetLocales.value.length) {
        translationConfigError.value = "Select at least one target locale.";
        return;
    }

    isTranslationConfigDialogOpen.value = false;
    pendingTranslationPayload.value = null;
    translationConfigError.value = null;

    try {
        await runScopedTranslation(payload);
    } catch (error: any) {
        const message =
            error instanceof Error
                ? error.message
                : String(error?.message ?? "Translation failed");
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
    }
};

const persistTranslatedLocale = async (locale: string): Promise<void> => {
    if (isTranslationPending.value || isLocaleTranslationPersistPending(locale)) {
        return;
    }

    if (selectedHistoryId.value) {
        const message =
            "Switch to Current version before persisting translated locales.";
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
        return;
    }

    const staged =
        applyAllDraftsToStagedDocument(locale) ??
        stagedDocumentsByLocale.value[locale];
    if (!staged) {
        const message = `No staged translation available for ${locale}.`;
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
        return;
    }

    try {
        setLocaleTranslationPersistPending(locale, true);

        const contentDocument = minimalToContentDocument(clonePlain(staged));
        const existing = contentStore.getPage(
            selectedPath.value ?? staged.path,
            locale,
        )?.document;

        if (existing?._id) {
            contentDocument._id = existing._id;
        }
        if (existing?._rev) {
            contentDocument._rev = existing._rev;
        }
        if (existing?.createdAt) {
            contentDocument.createdAt = existing.createdAt;
        }

        mergeTranslationLocaleDebug(locale, {
            stagedMinimalDocument: cloneMinimalForDebug(staged),
            persistRequestDocument: cloneRecordForDebug(
                contentDocument as unknown as Record<string, any>,
            ),
        });

        const savedSummary = await contentStore.saveDocument(contentDocument, {
            locale,
        });

        mergeTranslationLocaleDebug(locale, {
            persistResponseDocument: cloneRecordForDebug(
                savedSummary.document as unknown as Record<string, any>,
            ),
        });

        const nextPersisted = { ...persistedTranslationLocales.value };
        nextPersisted[locale] = new Date().toISOString();
        persistedTranslationLocales.value = nextPersisted;

        const nextStaged = { ...stagedDocumentsByLocale.value };
        delete nextStaged[locale];
        stagedDocumentsByLocale.value = nextStaged;

        const message = `Persisted translation for ${locale}.`;
        setTranslationNotice("success", message);
        feedback.value.success?.(message, {
            label: "View Page",
            href: savedSummary.path,
        });
    } catch (error: any) {
        const message =
            error instanceof Error
                ? error.message
                : String(error?.message ?? `Failed to persist locale ${locale}.`);
        setTranslationNotice("error", message);
        feedback.value.error?.(message);
    } finally {
        setLocaleTranslationPersistPending(locale, false);
    }
};

const persistAllTranslatedLocales = async (): Promise<void> => {
    if (isTranslationPending.value || isPersistAllTranslationsPending.value) {
        return;
    }

    const locales = translationLocaleResults.value
        .filter((entry) => entry.status === "ok")
        .map((entry) => entry.locale)
        .filter(
            (locale) =>
                !!stagedDocumentsByLocale.value[locale] &&
                !isLocaleTranslationPersistPending(locale) &&
                !isLocaleTranslationPersisted(locale),
        );

    if (!locales.length) {
        setTranslationNotice("error", "No staged locale translations to persist.");
        return;
    }

    isPersistAllTranslationsPending.value = true;
    try {
        for (const locale of locales) {
            await persistTranslatedLocale(locale);
        }
    } finally {
        isPersistAllTranslationsPending.value = false;
    }
};

const handleTranslateScope = async (
    payload: TranslateScopePayload,
): Promise<void> => {
    openTranslationConfigDialog(payload);
};

const handleTranslatePage = async (): Promise<void> => {
    const selectedPointers = normalizeSelectedTranslationPointers(
        selectedTranslationPointers.value,
    );
    await handleTranslateScope({
        scopeMode: "page",
        scopePointer: null,
        label: selectedPointers.length
            ? `Selected fields (${selectedPointers.length})`
            : "Page",
        selectedScopePointers: selectedPointers.length
            ? selectedPointers
            : undefined,
    });
};

const openTranslatedLocale = async (locale: string): Promise<void> => {
    if (!availableLocales.value.includes(locale)) {
        return;
    }

    if (locale === activeLocale.value) {
        const staged = stagedDocumentsByLocale.value[locale];
        if (staged) {
            builderRef.value?.loadDocument(clonePlain(staged));
            updateUnsavedState(true);
        }
        return;
    }

    activeLocale.value = locale;
};

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

        const savedSummary = await contentStore.saveDocument(contentDocument, {
            locale: activeLocale.value,
        });
        selectedPath.value = toBasePath(savedSummary.path);
        lastSavedAt.value = savedSummary.updatedAt ?? new Date().toISOString();
        selectedHistoryId.value = null;
        if (stagedDocumentsByLocale.value[activeLocale.value]) {
            const next = { ...stagedDocumentsByLocale.value };
            delete next[activeLocale.value];
            stagedDocumentsByLocale.value = next;
        }

        const savedMinimalDocument = savedSummary.document
            ? contentToMinimalDocument(savedSummary.document)
            : clonePlain(serialized);
        const savedSnapshot = JSON.stringify(savedMinimalDocument);
        const currentSnapshot = JSON.stringify(serialized);
        latestDocument.value = clonePlain(savedMinimalDocument);
        lastSavedSnapshot.value = savedSnapshot;
        if (savedSnapshot !== currentSnapshot) {
            builder.loadDocument(clonePlain(savedMinimalDocument));
        }
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

async function handleFocusedEditorSave(): Promise<void> {
    await handleSaveDocument();
    if (saveError.value) {
        throw new Error(saveError.value);
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
        await contentStore.fetchHistory(selectedSummary.value.path, false, {
            locale: activeLocale.value,
        });
        selectedHistoryId.value = targetId;
    } catch (error: any) {
        const wrapped =
            error instanceof Error
                ? error
                : new Error(error?.message || "Failed to load history entry.");
        feedback.value.error?.(wrapped.message);
    }
}

const closeHistoryMenu = () => {
    isHistoryMenuOpen.value = false;
};

const closeActionsMenu = () => {
    isActionsMenuOpen.value = false;
};

const closeTranslationMenu = () => {
    isTranslationMenuOpen.value = false;
};

watch(
    () => forcePreviewMotion.value,
    (value) => {
        emit("preview-motion-change", {
            forceMotion: value,
            mediaPreference: value ? "no-preference" : "reduce",
        });
    },
    { immediate: true },
);

watch(isInlineTranslationEnabled, (enabled) => {
    if (!enabled) {
        selectedTranslationPointers.value = [];
    }
});

const toggleHistoryMenu = () => {
    if (!selectedSummary.value) {
        return;
    }
    closeActionsMenu();
    isHistoryMenuOpen.value = !isHistoryMenuOpen.value;
};

const toggleActionsMenu = () => {
    if (!selectedSummary.value) {
        return;
    }
    closeHistoryMenu();
    isActionsMenuOpen.value = !isActionsMenuOpen.value;
};

const toggleTranslationMenu = () => {
    closeHistoryMenu();
    closeActionsMenu();
    isTranslationMenuOpen.value = !isTranslationMenuOpen.value;
};

const handleChooseNewTranslationLanguage = async (): Promise<void> => {
    closeTranslationMenu();
    await handleTranslatePage();
};

const handleSelectActiveLocale = (locale: string): void => {
    if (!selectedSummary.value || !availableLocales.value.includes(locale)) {
        return;
    }

    if (locale !== activeLocale.value) {
        activeLocale.value = locale;
    }

    closeTranslationMenu();
};

const handleToggleInlineTranslations = (): void => {
    isInlineTranslationEnabled.value = !isInlineTranslationEnabled.value;
    closeTranslationMenu();
};

const handleDuplicateFromActionsMenu = () => {
    closeActionsMenu();
    showDuplicateModal();
};

const handleTranslateFromActionsMenu = () => {
    closeActionsMenu();
    handleTranslatePage();
};

const handleDeleteFromActionsMenu = () => {
    closeActionsMenu();
    handleDeletePage();
};

const handleHistoryMenuSelection = async (historyId: string): Promise<void> => {
    await handleSelectHistory(historyId);
    closeHistoryMenu();
};

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

        await contentStore.deletePage(target.path, { locale: activeLocale.value });
        await contentStore.fetchIndex(true);

        emit("delete-success", target);
        feedback.value.success?.(`Page "${label}" deleted.`);

        const remaining = contentStore.index.data;
        stagedDocumentsByLocale.value = {};
        resetTranslationPersistenceState();
        translationScopeLabel.value = null;
        pendingTranslationPayload.value = null;
        translationConfigError.value = null;
        isTranslationConfigDialogOpen.value = false;
        isTranslationDialogOpen.value = false;
        resetTranslationState();
        lastSavedAt.value = null;
        if (remaining.length) {
            await openPageForEditing(remaining[0].path, true);
        } else {
            selectedTranslationPointers.value = [];
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

const focusPropFromPreview = (payload: {
    uid: string;
    path: string;
    propPath: string;
    sectionId?: string;
    hint?: InlinePreviewPropHint;
}) => {
    if (
        !payload ||
        typeof payload.uid !== "string" ||
        typeof payload.path !== "string"
    ) {
        return;
    }

    const builder = builderRef.value;
    if (!builder || typeof builder.focusNodeProp !== "function") {
        return;
    }

    builder.focusNodeProp({
        uid: payload.uid,
        propPath: payload.propPath,
        sectionId: payload.sectionId,
        hint: payload.hint,
    });
};

defineExpose({
    openCreateModal: showCreatePageModal,
    refreshIndex: () => contentStore.fetchIndex(true),
    focusPropFromPreview,
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
                    <div class="content-admin-workbench__title">
                        {{ currentEditedPath }}
                    </div>
                </div>
                <div class="content-admin-workbench__header-actions">
                    <div
                        ref="translationMenuRef"
                        class="content-admin-workbench__translation-menu"
                    >
                        <button
                            type="button"
                            class="content-admin-workbench__button content-admin-workbench__button--muted content-admin-workbench__translation-trigger"
                            :class="{ 'is-active': isTranslationMenuOpen }"
                            aria-label="Open translation tools"
                            aria-haspopup="menu"
                            :aria-expanded="isTranslationMenuOpen"
                            @click="toggleTranslationMenu"
                        >
                            <svg
                                class="content-admin-workbench__icon content-admin-workbench__icon--sm"
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path
                                    fill="currentColor"
                                    d="M12.9 15.7a14 14 0 0 0 2.45-5.2H18V8.5h-6V6.5h-2v2H4v2h9.3a11.8 11.8 0 0 1-1.8 3.75A14 14 0 0 1 10 12h-2.2a16.3 16.3 0 0 0 2.35 3.85L7.6 18.4 9 19.8l2.5-2.5 1.55 1.55.9-1.9-1.05-1.25ZM17.5 13h2L23 21h-2.1l-.7-1.8h-3.4l-.7 1.8H14l3.5-8Zm-.05 4.5h2.1l-1.05-2.85-1.05 2.85Z"
                                />
                            </svg>
                        </button>
                        <div
                            v-if="isTranslationMenuOpen"
                            class="content-admin-workbench__translation-dropdown"
                            role="menu"
                        >
                            <div
                                class="content-admin-workbench__translation-section"
                                role="none"
                            >
                                <div
                                    class="content-admin-workbench__translation-section-label"
                                >
                                    Current locale
                                </div>
                                <div
                                    class="content-admin-workbench__translation-locales"
                                    role="group"
                                    aria-label="Current locale"
                                >
                                    <button
                                        v-for="locale in availableLocales"
                                        :key="`active-locale-${locale}`"
                                        type="button"
                                        role="menuitemradio"
                                        class="content-admin-workbench__translation-locale"
                                        :class="{
                                            'is-active':
                                                locale === activeLocale,
                                        }"
                                        :aria-checked="
                                            locale === activeLocale
                                        "
                                        :disabled="!selectedSummary"
                                        @click="handleSelectActiveLocale(locale)"
                                    >
                                        <span
                                            v-if="getLocaleFlagSvg(locale)"
                                            class="content-admin-workbench__translation-locale-flag"
                                            v-html="getLocaleFlagSvg(locale)"
                                        />
                                        <span
                                            class="content-admin-workbench__translation-locale-code"
                                        >
                                            {{ locale }}
                                        </span>
                                    </button>
                                </div>
                            </div>
                            <button
                                v-if="translationLocaleOptions.length"
                                type="button"
                                role="menuitem"
                                class="content-admin-workbench__translation-item"
                                :disabled="
                                    isTranslationPending ||
                                    !!selectedHistoryId
                                "
                                @click="handleChooseNewTranslationLanguage"
                            >
                                Translate to
                            </button>
                            <button
                                type="button"
                                role="menuitemcheckbox"
                                class="content-admin-workbench__translation-item content-admin-workbench__translation-item--toggle"
                                :aria-checked="isInlineTranslationEnabled"
                                @click="handleToggleInlineTranslations"
                            >
                                <span>Inline translations</span>
                                <span
                                    class="content-admin-workbench__translation-switch"
                                    :class="{
                                        'is-on': isInlineTranslationEnabled,
                                    }"
                                    aria-hidden="true"
                                />
                            </button>
                        </div>
                    </div>
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
                    </button>
                </div>
            </div>
        </slot>

        <div v-if="!isFocusedEditActive" class="content-admin-workbench__panel">
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
                            :list="pageListId"
                            type="search"
                            :placeholder="searchPlaceholder"
                            @change="handlePageSearchChange"
                        />
                        <datalist :id="pageListId">
                            <option
                                v-for="page in availablePages || []"
                                :key="page.path"
                                :value="page.path"
                            >
                                {{ `${page.path} — ${page.title || "[No title]"}` }}
                            </option>
                        </datalist>
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
                <div v-else-if="!isIndexLoading && !hasPages" class="content-admin-workbench__hint">
                    No pages available yet. Create one to get started.
                </div>
            </div>
        </div>

        <div ref="editorCardRef" class="content-admin-workbench__editor">
            <div
                ref="headerSentinelRef"
                aria-hidden="true"
                class="content-admin-workbench__sentinel"
            ></div>

            <div
                v-show="!isFocusedEditActive"
                ref="headerRef"
                class="content-admin-workbench__editor-header"
                :class="{ 'is-pinned': isHeaderPinned }"
                :style="headerFixedStyles"
            >
              <div class="flex flex-col flex-1">

                <div class="flex-none flex">
                  <div class="editor-header__actions">
                    <div class="editor-header__save-group" ref="historyMenuRef">
                      <div class="editor-header__save-split">
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
                          <span>{{ isSavePending ? "Saving…" : "Save Changes" }}</span>
                        </button>
                        <button
                            type="button"
                            class="content-admin-workbench__button content-admin-workbench__button--muted editor-header__history-button"
                            :class="{ 'is-active': isHistoryMenuOpen }"
                            :disabled="!selectedSummary"
                            :aria-expanded="isHistoryMenuOpen"
                            aria-haspopup="menu"
                            @click="toggleHistoryMenu"
                        >
                          History
                        </button>
                        <button
                            type="button"
                            class="content-admin-workbench__button content-admin-workbench__button--muted editor-header__save-menu-toggle"
                            :disabled="!selectedSummary"
                            :aria-expanded="isActionsMenuOpen"
                            aria-haspopup="menu"
                            aria-label="Open save actions menu"
                            @click="toggleActionsMenu"
                        >
                          <svg
                              class="content-admin-workbench__icon content-admin-workbench__icon--sm"
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                          >
                            <path fill="currentColor" d="M7 10l5 5l5-5z" />
                          </svg>
                        </button>
                      </div>

                      <div
                          v-if="isActionsMenuOpen"
                          class="editor-header__actions-dropdown"
                          role="menu"
                      >
                        <button
                            type="button"
                            role="menuitem"
                            class="editor-header__actions-item"
                            :disabled="isDuplicatePending || !selectedSummary"
                            @click="handleDuplicateFromActionsMenu"
                        >
                          Duplicate
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            class="editor-header__actions-item"
                            :disabled="
                                isTranslationPending ||
                                !translationLocaleOptions.length ||
                                !!selectedHistoryId
                            "
                            @click="handleTranslateFromActionsMenu"
                        >
                          {{ isTranslationPending ? "Translating..." : "Translate" }}
                        </button>
                        <button
                            type="button"
                            role="menuitemcheckbox"
                            class="editor-header__actions-item editor-header__actions-item--toggle"
                            :aria-checked="forcePreviewMotion"
                            :disabled="!selectedSummary"
                            @click="
                                forcePreviewMotion = !forcePreviewMotion;
                                closeActionsMenu();
                            "
                        >
                          Keep Animations Running
                          <span>{{ forcePreviewMotion ? "On" : "Off" }}</span>
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            class="editor-header__actions-item editor-header__actions-item--danger"
                            :disabled="isDeletePending || !selectedSummary"
                            @click="handleDeleteFromActionsMenu"
                        >
                          Delete
                        </button>
                      </div>

                      <div
                          v-if="isHistoryMenuOpen"
                          class="editor-header__history-dropdown"
                          role="menu"
                      >
                        <div class="history-menu">
                          <div class="history-menu__header">
                            <span>History</span>
                          </div>
                          <div v-if="historyError" class="history-menu__error">
                            {{ historyError }}
                          </div>
                          <div
                              v-else-if="isHistoryLoading"
                              class="history-menu__hint"
                          >
                            Loading history…
                          </div>
                          <div v-else class="history-menu__list" role="none">
                            <button
                                type="button"
                                role="menuitem"
                                class="history-menu__item"
                                :class="{
                                            'is-active': !selectedHistoryId,
                                        }"
                                @click="handleHistoryMenuSelection('')"
                            >
                              Current version
                            </button>
                            <template v-if="historyEntries.length">
                              <button
                                  v-for="entry in historyEntries"
                                  :key="entry.id"
                                  type="button"
                                  role="menuitem"
                                  class="history-menu__item"
                                  :class="{
                                                'is-active':
                                                    entry.id === selectedHistoryId,
                                            }"
                                  @click="
                                                handleHistoryMenuSelection(entry.id)
                                            "
                              >
                                {{ formatHistoryLabel(entry.timestamp) }}
                              </button>
                            </template>
                            <p
                                v-else
                                class="history-menu__hint"
                            >
                              No history available yet.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="editor-header__status-line">
                    <span v-if="lastUpdatedDisplay" class="editor-header__status-time">
                        Updated {{ lastUpdatedDisplay }}
                    </span>
                    <span
                        v-if="selectedSummary && !isDefaultActiveLocale"
                        class="editor-header__status"
                    >
                        Missing localized values: {{ missingLocalizedCount }}
                    </span>
                    <span
                        v-if="stagedLocaleCount > 0"
                        class="editor-header__status"
                    >
                        Staged locales: {{ stagedLocaleCount }}
                    </span>
                </div>

                <div class="editor-header__fullrow">
                    <label
                        class="builder-component-search"
                        :class="{ 'is-active': builderSearchQuery.length > 0 }"
                    >
                        <svg
                            class="builder-component-search__icon"
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
                            v-model="builderSearchQuery"
                            type="search"
                            placeholder="Search through content..."
                        />
                    </label>
                </div>
              </div>
            </div>

            <div
                v-if="!isFocusedEditActive && isHeaderPinned"
                :style="{ height: `${headerPlaceholderHeight}px` }"
                aria-hidden="true"
            />

            <div class="content-admin-workbench__editor-body">
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
                                :search-query="builderSearchQuery"
                                :show-translate-section="
                                    isInlineTranslationEnabled
                                "
                                :on-save-focused-edit="handleFocusedEditorSave"
                                :selected-translation-pointers="
                                    selectedTranslationPointers
                                "
                                @document-change="handleDocumentChange"
                                @document-preview-change="
                                    handleDocumentPreviewChange
                                "
                                @font-preview-change="handleFontPreviewChange"
                                @theme-preview-change="handleThemePreviewChange"
                                @translate-scope="handleTranslateScope"
                                @update:selected-translation-pointers="
                                    handleSelectedTranslationPointersUpdate
                                "
                                @node-focus="handleNodeFocus"
                                @focused-edit-change="
                                    (isActive) =>
                                        (isFocusedEditActive = isActive)
                                "
                                @update:search-query="
                                    (value) => (builderSearchQuery = value)
                                "
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
                                <label for="new-page-seo-image"
                                    >Social image URL (absolute)</label
                                >
                                <input
                                    id="new-page-seo-image"
                                    v-model="newPageForm.seoImage"
                                    type="url"
                                    placeholder="https://example.com/og-image.jpg"
                                />
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
                                <label for="duplicate-page-seo-image"
                                    >Social image URL (absolute)</label
                                >
                                <input
                                    id="duplicate-page-seo-image"
                                    v-model="duplicatePageForm.seoImage"
                                    type="url"
                                    placeholder="https://example.com/og-image.jpg"
                                />
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
                                            '--component-indent':
                                                getDuplicateNodeIndent(node),
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

        <Teleport to="body">
            <Transition name="fade">
                <div
                    v-if="isTranslationConfigDialogOpen"
                    class="content-admin-workbench__modal"
                >
                    <div
                        class="modal__backdrop"
                        @click="closeTranslationConfigDialog"
                    />
                    <div
                        class="modal__panel modal__panel--translation modal__panel--translation-config"
                        role="dialog"
                        aria-modal="true"
                    >
                        <div class="modal__header">
                            <div>
                                <h2 class="modal__title">Start translation</h2>
                                <p class="modal__subtitle">
                                    {{ translationConfigModalSubtitle }}
                                </p>
                            </div>
                            <button
                                type="button"
                                class="modal__close"
                                aria-label="Close"
                                :disabled="isTranslationPending"
                                @click="closeTranslationConfigDialog"
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

                        <div class="translation-config__content">
                            <div
                                v-if="pendingSelectedScopeCount > 0"
                                class="translation-config__selection-summary"
                            >
                                <div class="translation-config__selection-copy">
                                    <p class="translation-config__selection-title">
                                        Selected fields
                                    </p>
                                    <p class="translation-config__selection-text">
                                        {{ pendingSelectedScopeCount }} selected for
                                        translation.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    class="content-admin-workbench__button content-admin-workbench__button--muted translation-config__selection-clear"
                                    :disabled="isTranslationPending"
                                    @click="clearPendingTranslationSelection"
                                >
                                    Clear selection
                                </button>
                            </div>

                            <label class="translation-config__field">
                                <span class="translation-config__label">
                                    Source locale
                                </span>
                                <select
                                    v-model="translationSourceLocale"
                                    class="translation-config__select"
                                    :disabled="isTranslationPending"
                                >
                                    <option
                                        v-for="locale in availableLocales"
                                        :key="`source-${locale}`"
                                        :value="locale"
                                    >
                                        {{ getLocaleLabel(locale) }} ({{ locale }})
                                    </option>
                                </select>
                            </label>

                            <label class="translation-config__field">
                                <div class="translation-config__targets-header">
                                    <span class="translation-config__label">
                                        Destination locales
                                    </span>
                                    <div class="translation-config__target-actions">
                                        <button
                                            type="button"
                                            class="translation-config__target-action"
                                            :disabled="
                                                isTranslationPending ||
                                                !translationLocaleOptions.length
                                            "
                                            @click="
                                                translationTargetLocales = [
                                                    ...translationLocaleOptions,
                                                ]
                                            "
                                        >
                                            Select all
                                        </button>
                                        <button
                                            type="button"
                                            class="translation-config__target-action"
                                            :disabled="
                                                isTranslationPending ||
                                                !translationTargetLocales.length
                                            "
                                            @click="translationTargetLocales = []"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>
                                <div class="translation-config__targets">
                                    <label
                                        v-for="locale in translationLocaleOptions"
                                        :key="`target-${locale}`"
                                        class="translation-config__target-chip"
                                        :class="{
                                            'is-selected':
                                                translationTargetLocales.includes(
                                                    locale,
                                                ),
                                        }"
                                    >
                                        <input
                                            v-model="translationTargetLocales"
                                            type="checkbox"
                                            :value="locale"
                                            :disabled="isTranslationPending"
                                            class="translation-config__target-input"
                                        />
                                        <span
                                            v-if="getLocaleFlagSvg(locale)"
                                            class="translation-config__target-flag"
                                            v-html="getLocaleFlagSvg(locale)"
                                        />
                                        <span class="translation-config__target-label">
                                            {{ getLocaleLabel(locale) }}
                                        </span>
                                    </label>
                                </div>
                            </label>

                            <label class="translation-config__field">
                                <span class="translation-config__label">
                                    Overwrite mode
                                </span>
                                <select
                                    v-model="translationOverwriteMode"
                                    class="translation-config__select"
                                    :disabled="isTranslationPending"
                                >
                                    <option value="missing">Missing only</option>
                                    <option value="all">All values</option>
                                </select>
                            </label>
                        </div>

                        <div
                            v-if="translationConfigError"
                            class="modal__notice modal__notice--error"
                        >
                            {{ translationConfigError }}
                        </div>

                        <div class="modal__actions">
                            <button
                                type="button"
                                class="content-admin-workbench__button content-admin-workbench__button--muted"
                                :class="ui.modalCancelButton"
                                :disabled="isTranslationPending"
                                @click="closeTranslationConfigDialog"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                class="content-admin-workbench__button content-admin-workbench__button--primary"
                                :class="ui.modalSaveButton"
                                :disabled="
                                    isTranslationPending ||
                                    !translationTargetLocales.length
                                "
                                @click="confirmTranslationConfigAndRun"
                            >
                                Start translation
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>

        <Teleport to="body">
            <Transition name="fade">
                <div
                    v-if="isTranslationDialogOpen && translationHasDialogContent"
                    class="content-admin-workbench__modal"
                >
                    <div
                        class="modal__backdrop"
                        @click="closeTranslationDialog"
                    />
                    <div
                        class="modal__panel modal__panel--translation modal__panel--translation-results"
                        role="dialog"
                        aria-modal="true"
                    >
                        <div class="modal__header">
                            <div>
                                <h2 class="modal__title">{{ translationModalTitle }}</h2>
                                <p class="modal__subtitle">
                                    {{ translationModalSubtitle }}
                                </p>
                            </div>
                            <button
                                type="button"
                                class="modal__close"
                                aria-label="Close"
                                :disabled="isTranslationPending"
                                @click="closeTranslationDialog"
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

                        <div class="translation-modal__body">
                            <div
                                v-if="translationNotice"
                                class="modal__notice"
                                :class="
                                    translationNotice.type === 'error'
                                        ? 'modal__notice--error'
                                        : 'modal__notice--success'
                                "
                            >
                                {{ translationNotice.message }}
                            </div>

                            <div
                                v-if="isTranslationPending"
                                class="editor-header__translation-progress"
                            >
                                <div class="editor-header__translation-progress-head">
                                    <strong>Translating selected scope</strong>
                                    <span>Please wait…</span>
                                </div>
                                <div class="editor-header__translation-progress-track">
                                    <div class="editor-header__translation-progress-bar" />
                                </div>
                            </div>

                            <div
                                v-if="translationLastResult"
                                class="editor-header__translation-report"
                            >
                                <span class="editor-header__translation-report-text">
                                    Source entries:
                                    {{ translationLastResult.report.totalSourceEntries }}.
                                    {{
                                        translationCompletedAtDisplay
                                            ? `Completed ${translationCompletedAtDisplay}.`
                                            : ""
                                    }}
                                </span>
                                <span
                                    v-if="translationReportTokenUsageText"
                                    class="editor-header__translation-report-text"
                                >
                                    Token usage: {{ translationReportTokenUsageText }}.
                                </span>
                                <div
                                    v-if="translationLastResult.report.keyPoints.length"
                                    class="translation-modal__key-points"
                                >
                                    <p class="translation-modal__key-points-title">Key points</p>
                                    <p
                                        v-for="(point, index) in translationLastResult.report.keyPoints"
                                        :key="`translation-point-${index}`"
                                        class="translation-modal__key-point"
                                    >
                                        {{ point }}
                                    </p>
                                </div>
                                <div class="translation-modal__locale-results">
                                    <div
                                        v-if="translationLocaleResults.length"
                                        class="translation-modal__tabs-head"
                                    >
                                        <div class="translation-modal__tabs">
                                            <button
                                                v-for="entry in translationLocaleResults"
                                                :key="`translation-tab-${entry.locale}`"
                                                type="button"
                                                class="translation-modal__tab"
                                                :class="{
                                                    'is-active':
                                                        activeTranslationLocaleResult?.locale ===
                                                        entry.locale,
                                                }"
                                                @click="selectedTranslationResultLocale = entry.locale"
                                            >
                                                <span>{{ entry.locale }}</span>
                                                <span
                                                    class="translation-modal__tab-status"
                                                    :class="
                                                        getTranslationLocalePersistState(entry).className
                                                    "
                                                >
                                                    {{
                                                        getTranslationLocalePersistState(entry).label
                                                    }}
                                                </span>
                                            </button>
                                        </div>
                                        <div class="translation-modal__tabs-actions">
                                            <button
                                                type="button"
                                                class="editor-header__translation-locale-button"
                                                :disabled="
                                                    isPersistAllTranslationsPending ||
                                                    !hasPersistableTranslationLocales
                                                "
                                                @click="persistAllTranslatedLocales"
                                            >
                                                {{
                                                    isPersistAllTranslationsPending
                                                        ? "Persisting all…"
                                                        : "Persist all"
                                                }}
                                            </button>
                                        </div>
                                    </div>

                                    <article
                                        v-if="activeTranslationLocaleResult"
                                        :key="`translation-result-${activeTranslationLocaleResult.locale}`"
                                        class="translation-modal__locale-card"
                                    >
                                        <div class="translation-modal__locale-head">
                                            <strong>{{
                                                activeTranslationLocaleResult.locale
                                            }}</strong>
                                            <div class="translation-modal__locale-head-status">
                                                <span
                                                    class="translation-modal__locale-status"
                                                    :class="
                                                        activeTranslationLocaleResult.status === 'ok'
                                                            ? 'translation-modal__locale-status--ok'
                                                            : 'translation-modal__locale-status--error'
                                                    "
                                                >
                                                    {{
                                                        activeTranslationLocaleResult.status === "ok"
                                                            ? `${activeTranslationLocaleResult.translatedCount} translated`
                                                            : "failed"
                                                    }}
                                                </span>
                                                <span
                                                    class="translation-modal__locale-persist-state"
                                                    :class="
                                                        getTranslationLocalePersistState(
                                                            activeTranslationLocaleResult,
                                                        ).className
                                                    "
                                                >
                                                    {{
                                                        getTranslationLocalePersistState(
                                                            activeTranslationLocaleResult,
                                                        ).label
                                                    }}
                                                </span>
                                            </div>
                                        </div>
                                        <p
                                            v-if="activeTranslationLocaleTokenUsageText"
                                            class="translation-modal__locale-token-usage"
                                        >
                                            Token usage:
                                            {{ activeTranslationLocaleTokenUsageText }}.
                                        </p>

                                        <div
                                            v-if="activeTranslationLocaleResult.status === 'ok'"
                                            class="translation-modal__locale-actions"
                                        >
                                            <button
                                                type="button"
                                                class="editor-header__translation-locale-button"
                                                :disabled="
                                                    isLocaleTranslationPersistPending(
                                                        activeTranslationLocaleResult.locale,
                                                    ) ||
                                                    isLocaleTranslationPersisted(
                                                        activeTranslationLocaleResult.locale,
                                                    )
                                                "
                                                @click="
                                                    persistTranslatedLocale(
                                                        activeTranslationLocaleResult.locale,
                                                    )
                                                "
                                            >
                                                {{
                                                    isLocaleTranslationPersistPending(
                                                        activeTranslationLocaleResult.locale,
                                                    )
                                                        ? `Persisting ${activeTranslationLocaleResult.locale}…`
                                                        : isLocaleTranslationPersisted(
                                                                activeTranslationLocaleResult.locale,
                                                            )
                                                            ? `Persisted ${activeTranslationLocaleResult.locale}`
                                                            : `Persist ${activeTranslationLocaleResult.locale}`
                                                }}
                                            </button>
                                            <button
                                                v-if="
                                                    isLocaleTranslationPersisted(
                                                        activeTranslationLocaleResult.locale,
                                                    )
                                                "
                                                type="button"
                                                class="editor-header__translation-locale-button"
                                                @click="
                                                    openTranslatedLocale(
                                                        activeTranslationLocaleResult.locale,
                                                    )
                                                "
                                            >
                                                Open {{ activeTranslationLocaleResult.locale }}
                                            </button>
                                        </div>

                                        <p
                                            v-if="activeTranslationLocaleResult.status !== 'ok'"
                                            class="translation-modal__locale-error"
                                        >
                                            {{
                                                activeTranslationLocaleResult.error ||
                                                "Unknown error"
                                            }}
                                        </p>

                                        <div
                                            v-if="
                                                activeTranslationLocaleResult.status === 'ok' &&
                                                Array.isArray(
                                                    activeTranslationLocaleResult.translations,
                                                ) &&
                                                activeTranslationLocaleResult.translations.length
                                            "
                                            class="translation-modal__translations"
                                        >
                                            <table class="translation-modal__translations-table">
                                                <thead>
                                                    <tr>
                                                        <th>Key</th>
                                                        <th>Original</th>
                                                        <th>Translation</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr
                                                        v-for="(
                                                            translation, index
                                                        ) in activeTranslationLocaleResult.translations"
                                                        :key="`${activeTranslationLocaleResult.locale}-translation-${index}`"
                                                        class="translation-modal__translations-row"
                                                    >
                                                        <td class="translation-modal__translations-cell translation-modal__translations-cell--key">
                                                            <code class="translation-modal__translation-key">
                                                                {{ translation.key }}
                                                            </code>
                                                        </td>
                                                        <td class="translation-modal__translations-cell translation-modal__translations-cell--original">
                                                            <p class="translation-modal__translation-original">
                                                                {{
                                                                    translation.original &&
                                                                    translation.original.length
                                                                        ? translation.original
                                                                        : "—"
                                                                }}
                                                            </p>
                                                        </td>
                                                        <td class="translation-modal__translations-cell translation-modal__translations-cell--translation">
                                                            <textarea
                                                                class="translation-modal__translation-input"
                                                                rows="3"
                                                                :value="
                                                                    getTranslationDraftValue(
                                                                        activeTranslationLocaleResult.locale,
                                                                        translation.key,
                                                                        translation.value,
                                                                    )
                                                                "
                                                                :disabled="
                                                                    !isTranslationDraftEditable(
                                                                        activeTranslationLocaleResult.locale,
                                                                    )
                                                                "
                                                                @input="
                                                                    handleTranslationDraftInput(
                                                                        activeTranslationLocaleResult.locale,
                                                                        translation.key,
                                                                        $event,
                                                                    )
                                                                "
                                                            />
                                                            <p
                                                                v-if="
                                                                    isTranslationDraftChanged(
                                                                        activeTranslationLocaleResult.locale,
                                                                        translation.key,
                                                                        translation.value,
                                                                    )
                                                                "
                                                                class="translation-modal__translation-changed"
                                                            >
                                                                Edited locally. Persist to save this change.
                                                            </p>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <p
                                            v-else-if="
                                                activeTranslationLocaleResult.status === 'ok'
                                            "
                                            class="translation-modal__translations-empty"
                                        >
                                            No translated keys returned for this locale.
                                        </p>

                                        <details class="translation-modal__debug-dump">
                                            <summary>Debug target doc body</summary>
                                            <pre>{{
                                                getTranslationLocaleDebugDump(
                                                    activeTranslationLocaleResult.locale,
                                                )
                                            }}</pre>
                                        </details>
                                    </article>
                                    <p
                                        v-else
                                        class="translation-modal__translations-empty"
                                    >
                                        No locale results available for this translation run.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="modal__actions">
                            <button
                                type="button"
                                class="content-admin-workbench__button content-admin-workbench__button--muted"
                                :class="ui.modalCancelButton"
                                :disabled="isTranslationPending"
                                @click="closeTranslationDialog"
                            >
                                Close
                            </button>
                        </div>
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
  padding: 0.5rem 0.75rem;
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

.content-admin-workbench__translation-menu {
    position: relative;
}

.content-admin-workbench__translation-trigger {
    justify-content: center;
    color: #334155;
}

.content-admin-workbench__translation-trigger .content-admin-workbench__icon {
    width: 1.35rem;
    height: 1.35rem;
}

.content-admin-workbench__translation-trigger.is-active {
    border-color: #94a3b8;
    background: #f8fafc;
    color: #0f172a;
}

.content-admin-workbench__translation-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 1250;
    display: grid;
    min-width: 275px;
    gap: 0.25rem;
    padding: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.65rem;
    background: #ffffff;
    box-shadow: 0 18px 40px -24px rgba(15, 23, 42, 0.45);
}

.content-admin-workbench__translation-section {
    display: grid;
    gap: 0.45rem;
    padding: 0.35rem 0.35rem 0.55rem;
    border-bottom: 1px solid #e2e8f0;
    margin-bottom: 0.25rem;
}

.content-admin-workbench__translation-section-label {
    color: #64748b;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.content-admin-workbench__translation-locales {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.content-admin-workbench__translation-locale {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 2rem;
    border: 1px solid #dbe3ef;
    border-radius: 999px;
    background: #ffffff;
    color: #334155;
    padding: 0.35rem 0.65rem;
    font-size: 0.82rem;
    font-weight: 700;
    line-height: 1;
}

.content-admin-workbench__translation-locale:hover:not(:disabled) {
    border-color: #bfdbfe;
    background: #eff6ff;
    color: #1d4ed8;
}

.content-admin-workbench__translation-locale.is-active {
    border-color: #2563eb;
    background: #2563eb;
    color: #ffffff;
}

.content-admin-workbench__translation-locale:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.content-admin-workbench__translation-locale-flag {
    width: 1rem;
    height: 1rem;
    overflow: hidden;
    border-radius: 999px;
    flex: 0 0 auto;
}

.content-admin-workbench__translation-locale-flag :deep(svg) {
    display: block;
    width: 100%;
    height: 100%;
}

.content-admin-workbench__translation-item {
    display: inline-flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    background: #ffffff;
    padding: 0.65rem 0.75rem;
    color: #1f2937;
    font-size: 0.9rem;
    font-weight: 600;
    text-align: left;
}

.content-admin-workbench__translation-item:hover:not(:disabled) {
    border-color: #dbeafe;
    background: #eff6ff;
    color: #1d4ed8;
}

.content-admin-workbench__translation-item:disabled {
    cursor: not-allowed;
    color: #94a3b8;
}

.content-admin-workbench__translation-item--toggle {
    align-items: center;
}

.content-admin-workbench__translation-switch {
    position: relative;
    flex: 0 0 auto;
    width: 2.2rem;
    height: 1.25rem;
    border-radius: 999px;
    background: #cbd5e1;
    transition: background-color 0.16s ease;
}

.content-admin-workbench__translation-switch::after {
    position: absolute;
    top: 0.2rem;
    left: 0.2rem;
    width: 0.85rem;
    height: 0.85rem;
    content: "";
    border-radius: 999px;
    background: #ffffff;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.2);
    transition: transform 0.16s ease;
}

.content-admin-workbench__translation-switch.is-on {
    background: #2563eb;
}

.content-admin-workbench__translation-switch.is-on::after {
    transform: translateX(0.95rem);
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

.content-admin-workbench__search {
    flex: 1;
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
    width: 100%;
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

.editor-header__status--error,
.editor-header__status-error {
    color: #dc2626;
    font-weight: 500;
}

.editor-header__status--success {
    color: #0f766e;
    font-weight: 500;
}

.editor-header__status-time {
    color: #6b7280;
}

.editor-header__actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.editor-header__save-group {
    position: relative;
}

.editor-header__save-split {
    display: inline-flex;
    align-items: stretch;
    gap: 0.35rem;
}

.editor-header__save-menu-toggle {
    min-width: 2.35rem;
    justify-content: center;
    padding-inline: 0.5rem;
}

.editor-header__actions-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    z-index: 1200;
    min-width: 230px;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background-color: #ffffff;
    box-shadow: 0 12px 30px -18px rgba(15, 23, 42, 0.35);
    display: grid;
    gap: 0.25rem;
}

.editor-header__actions-item {
    width: 100%;
    text-align: left;
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    padding: 0.5rem 0.65rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.4rem;
    background: #ffffff;
    color: #0f172a;
    font-size: 0.82rem;
    font-weight: 600;
    transition:
        border-color 0.15s ease,
        color 0.15s ease,
        background-color 0.15s ease;
}

.editor-header__actions-item:hover:not(:disabled) {
    border-color: #93c5fd;
    color: #1d4ed8;
    background-color: #f8fafc;
}

.editor-header__actions-item:disabled {
    opacity: 0.6;
    cursor: default;
}

.editor-header__actions-item--toggle span {
    color: #475569;
    font-size: 0.75rem;
}

.editor-header__actions-item--danger {
    color: #b91c1c;
    border-color: #fecaca;
}

.editor-header__actions-item--danger:hover:not(:disabled) {
    background-color: #fef2f2;
    border-color: #fca5a5;
    color: #991b1b;
}

.editor-header__translation-controls {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    padding: 0.35rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    background: #f8fafc;
}

.editor-header__translation-targets {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    color: #334155;
}

.editor-header__translation-target {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.2rem 0.45rem;
    border-radius: 999px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    color: #1e293b;
    font-size: 0.72rem;
    font-weight: 600;
}

.editor-header__translation-target input {
    width: 12px;
    height: 12px;
    margin: 0;
}

.editor-header__translation-overwrite {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
}

.editor-header__translation-overwrite select {
    min-width: 110px;
    padding: 0.35rem 0.45rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.45rem;
    background: #ffffff;
    color: #0f172a;
    font-size: 0.75rem;
    font-weight: 600;
}

.translation-config__content {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.translation-config__selection-summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: 1px solid #dbeafe;
    border-radius: 0.7rem;
    background: linear-gradient(180deg, #f8fbff 0%, #f1f5ff 100%);
    padding: 0.75rem 0.9rem;
}

.translation-config__selection-copy {
    display: grid;
    gap: 0.15rem;
}

.translation-config__selection-title {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 700;
    color: #1e3a8a;
}

.translation-config__selection-text {
    margin: 0;
    font-size: 0.78rem;
    color: #475569;
}

.translation-config__selection-clear {
    padding: 0.38rem 0.65rem;
    white-space: nowrap;
}

.translation-config__field {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
}

.translation-config__label {
    font-size: 0.82rem;
    font-weight: 700;
    color: #334155;
}

.translation-config__targets-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
}

.translation-config__target-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
}

.translation-config__target-action {
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    padding: 0.2rem 0.55rem;
    background: #ffffff;
    color: #334155;
    font-size: 0.7rem;
    font-weight: 700;
}

.translation-config__target-action:disabled {
    opacity: 0.6;
    cursor: default;
}

.translation-config__targets {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 0.55rem;
}

.translation-config__target-chip {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.7rem;
    background: #ffffff;
    min-height: 2.65rem;
    padding: 0.55rem 0.65rem;
    color: #0f172a;
    cursor: pointer;
    transition:
        border-color 0.18s ease,
        box-shadow 0.18s ease,
        background-color 0.18s ease;
}

.translation-config__target-chip:hover {
    border-color: #93c5fd;
    box-shadow: 0 6px 16px -12px rgba(59, 130, 246, 0.85);
}

.translation-config__target-chip.is-selected {
    border-color: #3b82f6;
    background: #eff6ff;
}

.translation-config__target-input {
    width: 15px;
    height: 15px;
    margin: 0;
    flex-shrink: 0;
}

.translation-config__target-flag {
    width: 18px;
    height: 18px;
    border-radius: 999px;
    overflow: hidden;
    flex-shrink: 0;
}

.translation-config__target-flag :deep(svg) {
    width: 100%;
    height: 100%;
    display: block;
}

.translation-config__target-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.2;
}

.translation-config__select {
    min-width: 260px;
    width: fit-content;
    max-width: 100%;
    padding: 0.55rem 0.65rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.6rem;
    background: #ffffff;
    color: #0f172a;
    font-size: 0.87rem;
    font-weight: 700;
}

.editor-header__status-line {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.5rem;
}

.editor-header__translation-progress {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin-top: 0.35rem;
    padding: 0.55rem 0.65rem;
    border-radius: 0.5rem;
    border: 1px solid #bfdbfe;
    background: #f1f7ff;
}

.editor-header__translation-progress-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: #1e3a8a;
}

.editor-header__translation-progress-track {
    position: relative;
    overflow: hidden;
    height: 8px;
    border-radius: 999px;
    background: #dbeafe;
}

.editor-header__translation-progress-bar {
    position: absolute;
    top: 0;
    left: -40%;
    width: 40%;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #1d4ed8, #3b82f6);
    animation: editor-header-progress-slide 1.15s ease-in-out infinite;
}

@keyframes editor-header-progress-slide {
    0% {
        left: -40%;
    }
    50% {
        left: 35%;
    }
    100% {
        left: 100%;
    }
}

.editor-header__translation-progress-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.72rem;
    color: #1e40af;
}

.modal__panel--translation .editor-header__translation-progress,
.modal__panel--translation .editor-header__translation-report {
    margin-top: 0;
}

.editor-header__translation-report {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 0.75rem;
    margin-top: 0.35rem;
    padding: 0.45rem 0.6rem;
    border-radius: 0.5rem;
    border: 1px solid #dbeafe;
    background: #f8fbff;
}

.editor-header__translation-report-text {
    width: 100%;
    font-size: 0.75rem;
    color: #334155;
}

.editor-header__translation-report-locales {
    width: 100%;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
}

.editor-header__translation-locale-button {
    border: 1px solid #93c5fd;
    border-radius: 0.45rem;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 0.72rem;
    font-weight: 600;
    line-height: 1;
    padding: 0.4rem 0.5rem;
    cursor: pointer;
}

.editor-header__translation-locale-button:disabled {
    border-color: #fecaca;
    background: #fff1f2;
    color: #b91c1c;
    cursor: not-allowed;
}

.editor-header__translation-errors {
    width: 100%;
    border-top: 1px dashed #bfdbfe;
    padding-top: 0.45rem;
}

.editor-header__translation-errors-title {
    margin: 0 0 0.2rem;
    font-size: 0.73rem;
    font-weight: 600;
    color: #9f1239;
}

.editor-header__translation-error-line {
    margin: 0;
    font-size: 0.72rem;
    color: #be123c;
    word-break: break-word;
}

.translation-modal__key-points {
    width: 100%;
    border-radius: 0.45rem;
    border: 1px solid #dbeafe;
    background: #f8fbff;
    padding: 0.5rem;
}

.translation-modal__key-points-title {
    margin: 0 0 0.3rem;
    font-size: 0.73rem;
    font-weight: 600;
    color: #1e3a8a;
}

.translation-modal__key-point {
    margin: 0.2rem 0 0;
    font-size: 0.72rem;
    color: #334155;
    word-break: break-word;
}

.translation-modal__locale-results {
    width: 100%;
    display: grid;
    gap: 0.55rem;
}

.translation-modal__tabs-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.translation-modal__tabs {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
}

.translation-modal__tab {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid #dbeafe;
    border-radius: 0.45rem;
    background: #ffffff;
    color: #1e293b;
    padding: 0.3rem 0.5rem;
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
}

.translation-modal__tab.is-active {
    border-color: #93c5fd;
    background: #eff6ff;
    color: #1d4ed8;
}

.translation-modal__tab-status {
    border-radius: 999px;
    border: 1px solid transparent;
    padding: 0.05rem 0.35rem;
    font-size: 0.63rem;
    font-weight: 600;
    line-height: 1.1;
}

.translation-modal__tabs-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
}

.translation-modal__locale-card {
    border: 1px solid #dbeafe;
    border-radius: 0.5rem;
    background: #ffffff;
    padding: 0.55rem;
    display: grid;
    gap: 0.45rem;
}

.translation-modal__locale-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
}

.translation-modal__locale-head-status {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    flex-wrap: wrap;
}

.translation-modal__locale-status {
    font-size: 0.7rem;
    font-weight: 600;
    border-radius: 999px;
    padding: 0.15rem 0.45rem;
    border: 1px solid transparent;
}

.translation-modal__locale-status--ok {
    color: #0f766e;
    background: #f0fdfa;
    border-color: #99f6e4;
}

.translation-modal__locale-status--error {
    color: #b91c1c;
    background: #fff1f2;
    border-color: #fecaca;
}

.translation-modal__locale-persist-state {
    font-size: 0.7rem;
    font-weight: 600;
    border-radius: 999px;
    padding: 0.15rem 0.45rem;
    border: 1px solid transparent;
    line-height: 1.1;
}

.translation-modal__locale-persist-state--persisted {
    color: #0f766e;
    background: #f0fdfa;
    border-color: #99f6e4;
}

.translation-modal__locale-persist-state--pending {
    color: #1d4ed8;
    background: #eff6ff;
    border-color: #bfdbfe;
}

.translation-modal__locale-persist-state--staged {
    color: #475569;
    background: #f8fafc;
    border-color: #cbd5e1;
}

.translation-modal__locale-persist-state--error {
    color: #b91c1c;
    background: #fff1f2;
    border-color: #fecaca;
}

.translation-modal__locale-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
}

.translation-modal__locale-token-usage {
    margin: 0;
    font-size: 0.73rem;
    color: #334155;
    word-break: break-word;
}

.translation-modal__locale-error {
    margin: 0;
    font-size: 0.74rem;
    color: #be123c;
    word-break: break-word;
}

.translation-modal__translations {
    border: 1px solid #e2e8f0;
    border-radius: 0.45rem;
    background: #f8fafc;
    max-height: 420px;
    overflow: auto;
}

.translation-modal__translations-table {
    width: 100%;
    min-width: 900px;
    border-collapse: collapse;
}

.translation-modal__translations-table th {
    position: sticky;
    top: 0;
    z-index: 1;
    text-align: left;
    font-size: 0.74rem;
    font-weight: 700;
    color: #0f172a;
    background: #eff6ff;
    padding: 0.55rem 0.6rem;
    border-bottom: 1px solid #bfdbfe;
}

.translation-modal__translations-row {
    border-top: 1px solid #e2e8f0;
}

.translation-modal__translations-cell {
    vertical-align: top;
    padding: 0.5rem 0.6rem;
}

.translation-modal__translations-cell--key {
    width: 16%;
}

.translation-modal__translations-cell--original {
    width: 34%;
}

.translation-modal__translations-cell--translation {
    width: 50%;
}

.translation-modal__translation-key {
    font-size: 0.68rem;
    color: #1d4ed8;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 0.3rem;
    padding: 0.1rem 0.35rem;
    width: fit-content;
}

.translation-modal__translation-original {
    margin: 0;
    font-size: 0.9rem;
    color: #334155;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.45;
}

.translation-modal__translation-input {
    width: 100%;
    border-radius: 0.45rem;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #1e293b;
    padding: 0.35rem 0.45rem;
    font-size: 0.95rem;
    line-height: 1.5;
    resize: vertical;
}

.translation-modal__translation-input:focus {
    outline: none;
    border-color: #93c5fd;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.25);
}

.translation-modal__translation-input:disabled {
    background: #f8fafc;
    color: #64748b;
}

.translation-modal__translation-changed {
    margin: 0;
    font-size: 0.68rem;
    color: #1d4ed8;
}

.translation-modal__translations-empty {
    margin: 0;
    font-size: 0.72rem;
    color: #64748b;
}

.translation-modal__debug-dump {
    border: 1px solid #e2e8f0;
    border-radius: 0.45rem;
    background: #f8fafc;
    overflow: hidden;
}

.translation-modal__debug-dump summary {
    cursor: pointer;
    list-style: none;
    user-select: none;
    margin: 0;
    padding: 0.45rem 0.5rem;
    font-size: 0.71rem;
    font-weight: 600;
    color: #334155;
    background: #eff6ff;
    border-bottom: 1px solid #dbeafe;
}

.translation-modal__debug-dump summary::-webkit-details-marker {
    display: none;
}

.translation-modal__debug-dump pre {
    margin: 0;
    padding: 0.5rem;
    max-height: 260px;
    overflow: auto;
    font-size: 0.67rem;
    line-height: 1.45;
    color: #0f172a;
    white-space: pre;
}

.editor-header__fullrow {
    width: 100%;
    margin-top: 0.5rem;
    flex: 1 1 100%;
}

.builder-component-search {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    gap: 0.5rem;
}

.builder-component-search input {
    width: 100%;
    padding: 0.65rem 0.85rem 0.65rem 2.5rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(148, 163, 184, 0.5);
    font-size: 0.95rem;
    background: #fff;
}

.builder-component-search__icon {
    position: absolute;
    left: 0.85rem;
    width: 1rem;
    height: 1rem;
    color: #94a3b8;
    pointer-events: none;
}

.builder-component-search.is-active input {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.builder-component-search.is-active .builder-component-search__icon {
    color: #2563eb;
}

.editor-header__history {
    position: relative;
}

.editor-header__history-button {
    min-width: 2.5rem;
}

.editor-header__history-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 1200;
}

.history-menu {
    min-width: 220px;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    background-color: #ffffff;
    box-shadow: 0 12px 30px -18px rgba(15, 23, 42, 0.35);
    display: grid;
    gap: 0.5rem;
}

.history-menu__header {
    font-weight: 600;
    font-size: 0.875rem;
    color: #111827;
}

.history-menu__list {
    display: grid;
    gap: 0.25rem;
}

.history-menu__item {
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 0.375rem;
    background: #ffffff;
    color: #111827;
    font-size: 0.875rem;
    cursor: pointer;
    transition:
        background-color 0.15s ease,
        border-color 0.15s ease,
        color 0.15s ease;
}

.history-menu__item:hover {
    border-color: #93c5fd;
    color: #2563eb;
    background-color: #f8fafc;
}

.history-menu__item.is-active {
    border-color: #2563eb;
    color: #2563eb;
    background-color: #eff6ff;
}

.history-menu__hint {
    font-size: 0.8125rem;
    color: #6b7280;
}

.history-menu__error {
    font-size: 0.875rem;
    color: #dc2626;
}

.content-admin-workbench__editor-body {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.25rem;
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
    background-color: #f9fafb;
    padding: 0;
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
    z-index: 2100;
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

.modal__panel--translation {
    width: min(100% - 2rem, 44rem);
    display: grid;
    gap: 0.75rem;
}

.modal__panel--translation-config {
    width: min(100% - 2rem, 56rem);
    padding: 1.75rem;
}

.modal__panel--translation-results {
    width: min(100% - 1rem, 82rem);
    max-height: min(calc(100vh - 1rem), 100%);
    max-height: min(calc(100dvh - 1rem), 100%);
    grid-template-rows: auto minmax(0, 1fr) auto;
    overflow: hidden;
}

.modal__panel--translation-results .modal__header {
    margin-bottom: 0;
}

.translation-modal__body {
    min-height: 0;
    overflow-y: auto;
    display: grid;
    gap: 0.75rem;
    padding-right: 0.2rem;
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

.modal__close:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.modal__notice {
    border-radius: 0.5rem;
    padding: 0.7rem 0.85rem;
    font-size: 0.82rem;
    line-height: 1.35;
    border: 1px solid transparent;
}

.modal__notice--success {
    border-color: #99f6e4;
    color: #0f766e;
    background: #f0fdfa;
}

.modal__notice--error {
    border-color: #fecaca;
    color: #b91c1c;
    background: #fef2f2;
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
