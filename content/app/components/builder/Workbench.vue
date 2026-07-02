<script setup lang="ts">
import {
    computed,
    defineAsyncComponent,
    nextTick,
    onMounted,
    onBeforeUnmount,
    reactive,
    ref,
    toRaw,
    watch,
} from "vue";
import NodeEditor from "./NodeEditor.vue";
import ComponentPickerDialog from "./ComponentPickerDialog.vue";
import FontBrowserDialog from "./FontBrowserDialog.vue";
import { useComponentRegistry } from "../../composables/useComponentRegistry";
import {
    useContentFontSettings,
    type BunnyFontCatalogEntry,
} from "#content/app/composables/useContentFontSettings";
import { useContentThemeSettings } from "#content/app/composables/useContentThemeSettings";
import { useGlobalComponentsRegistry } from "#content/app/composables/useGlobalComponentsRegistry";
import type { ContentGlobalComponentEntry } from "#content/utils/global-components";
import {
    filterNodesBySearch,
    normalizeSearchQuery,
} from "../../utils/builderSearch";
import type {
    BuilderNode,
    BuilderNodeChild,
    BuilderTree,
    BuilderValue,
    ComponentDefinition,
    ComponentRegistry,
} from "~/types/builder";
import {
    createDocumentFromTree,
    type MinimalContentDocument,
    type PageConfigInput,
    type SpacingPresetId,
} from "../../utils/contentBuilder";
import type { ComponentPropSchema } from "~/types/builder";
import {
    CONTENT_META_I18N_KEY,
    resolveContentI18nConfig,
    resolveContentLocalePath,
} from "#content/utils/i18n";
import {
    buildComponentDefinitionLookup,
    collectFixedBodyPaths,
} from "#content/utils/i18n-body";
import {
    inferPropPathFromPreviewHint,
    type InlinePreviewPropHint,
} from "#content/app/utils/inline-preview-prop-path";
import { resolveContentRuntimeStylingConfig } from "#content/utils/runtime-styling";
import {
    applyGlobalAliasDefaultsToNode,
    applyGlobalAliasDefaultsToTree,
} from "#content/app/utils/global-alias-defaults";

const ContentImageField = defineAsyncComponent(
    () => import("../admin/ContentImageField.vue"),
);
const BUILDER_SECTION_ID_PROP = "__builderSectionId";

const cloneDocument = (doc: MinimalContentDocument | undefined | null) => {
    if (!doc) {
        return null;
    }

    const rawDoc = toRaw(doc);

    if (typeof structuredClone === "function") {
        try {
            return structuredClone(rawDoc);
        } catch {
            // fall through to JSON fallback
        }
    }

    try {
        return JSON.parse(JSON.stringify(rawDoc)) as MinimalContentDocument;
    } catch {
        return rawDoc as MinimalContentDocument;
    }
};

const PARAGRAPH_ALIGN_VALUES = ["left", "center", "right"] as const;
type ParagraphAlignment = (typeof PARAGRAPH_ALIGN_VALUES)[number];
const DEFAULT_PARAGRAPH_ALIGN: ParagraphAlignment = "left";

const isPlainObject = (value: unknown): value is Record<string, any> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const toPlainRecord = (value: unknown): Record<string, any> =>
    isPlainObject(value) ? { ...value } : {};

const nextSectionId = () => {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
        return `sec_${globalThis.crypto.randomUUID()}`;
    }
    return `sec_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 10)}`;
};

const normalizeComponentId = (component: unknown): string | null => {
    if (typeof component !== "string" || !component.trim()) {
        return null;
    }

    const trimmed = component.trim();
    if (/^[A-Z]/.test(trimmed)) {
        return trimmed;
    }

    if (trimmed.includes("-")) {
        return trimmed;
    }

    return trimmed
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .toLowerCase();
};

const normaliseParagraphAlignment = (
    value: unknown,
): ParagraphAlignment | null => {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim().toLowerCase();
    return PARAGRAPH_ALIGN_VALUES.includes(normalized as ParagraphAlignment)
        ? (normalized as ParagraphAlignment)
        : null;
};

const extractParagraphAlignFromStyle = (
    style: unknown,
): ParagraphAlignment | null => {
    if (typeof style === "string") {
        for (const token of style.split(";")) {
            if (!token) {
                continue;
            }
            const [property, rawValue] = token.split(":");
            if (!property || !rawValue) {
                continue;
            }
            if (property.trim().toLowerCase() === "text-align") {
                const alignment = normaliseParagraphAlignment(rawValue);
                if (alignment) {
                    return alignment;
                }
            }
        }
        return null;
    }

    if (isPlainObject(style)) {
        const candidate = style.textAlign ?? style["text-align"];
        return normaliseParagraphAlignment(candidate);
    }

    return null;
};

const stripParagraphAlignFromStyle = (style: unknown): unknown => {
    if (typeof style === "string") {
        const filtered = style
            .split(";")
            .map((token) => token.trim())
            .filter(
                (token) =>
                    token.length > 0 &&
                    token.split(":")[0]?.trim().toLowerCase() !== "text-align",
            );

        if (filtered.length === 0) {
            return undefined;
        }

        return filtered.join("; ");
    }

    if (isPlainObject(style)) {
        const cleaned: Record<string, any> = {};
        for (const [key, value] of Object.entries(style)) {
            if (key === "textAlign" || key === "text-align") {
                continue;
            }
            cleaned[key] = value;
        }
        return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }

    return style;
};

const props = defineProps<{
    initialDocument?: MinimalContentDocument | null;
    hidePreview?: boolean;
    searchQuery?: string;
    showTranslateSection?: boolean;
    selectedTranslationPointers?: string[];
    onSaveFocusedEdit?: () => Promise<void> | void;
}>();
const emit = defineEmits<{
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
    (e: "node-focus", payload: { uid: string; path: string }): void;
    (
        e: "translate-scope",
        payload: {
            scopeMode: "page" | "section" | "field";
            scopePointer: string | null;
            label?: string;
        },
    ): void;
    (e: "update:searchQuery", value: string): void;
    (e: "update:selectedTranslationPointers", value: string[]): void;
    (e: "focused-edit-change", isActive: boolean): void;
}>();

const { registry, createNode, createTextNode } = useComponentRegistry();
const globalComponentsRegistry = useGlobalComponentsRegistry();
const contentFontSettings = useContentFontSettings();
const contentThemeSettings = useContentThemeSettings();
const runtimeConfig = useRuntimeConfig();
const contentRuntimeStylingConfig = computed(() =>
    resolveContentRuntimeStylingConfig(
        runtimeConfig.content ?? runtimeConfig.public?.content,
    ),
);
const isTypographyFeatureEnabled = computed(
    () => contentRuntimeStylingConfig.value.fontsEnabled,
);
const isThemeFeatureEnabled = computed(
    () => contentRuntimeStylingConfig.value.themeEnabled,
);
const contentI18nConfig = computed(() =>
    resolveContentI18nConfig(
        runtimeConfig.content?.i18n ?? runtimeConfig.public?.content?.i18n,
    ),
);

const resolveGlobalEntryDefaults = (
    entry: ContentGlobalComponentEntry,
    locale: string,
) => {
    const shared = entry.defaultProps ?? {};
    const byLocale = entry.defaultPropsByLocale;
    if (!byLocale || typeof byLocale !== "object") {
        return shared;
    }
    const localeDefaults = byLocale[locale];
    if (!localeDefaults || typeof localeDefaults !== "object") {
        return shared;
    }
    return {
        ...shared,
        ...localeDefaults,
    };
};

const toGlobalComponentDefinition = (
    entry: ContentGlobalComponentEntry,
): ComponentDefinition | null => {
    const base = registry.lookup[entry.component];
    if (!base) {
        return null;
    }

    return {
        ...base,
        id: entry.id,
        label: entry.id,
        category: "global",
        previewComponentId: entry.component,
        previewProps: resolveGlobalEntryDefaults(
            entry,
            resolvedBuilderLocale.value,
        ) as Record<string, BuilderValue>,
        description: `Global alias for ${base.label}. Uses shared defaults from global registry.`,
    };
};

const globalComponentOptions = computed<ComponentDefinition[]>(() =>
    globalComponentsRegistry.components.value
        .filter((entry) => entry.enabled)
        .map((entry) => toGlobalComponentDefinition(entry))
        .filter((entry): entry is ComponentDefinition => Boolean(entry)),
);

const globalAliasDefaultsById = computed<
    Record<string, Record<string, unknown>>
>(() => {
    const map: Record<string, Record<string, unknown>> = {};
    for (const entry of globalComponentsRegistry.components.value) {
        if (entry.enabled === false) {
            continue;
        }
        if (!entry?.id) {
            continue;
        }
        map[entry.id] = {
            ...resolveGlobalEntryDefaults(entry, resolvedBuilderLocale.value),
        };
    }
    return map;
});

const componentOptions = computed<ComponentDefinition[]>(() => {
    const merged = new Map<string, ComponentDefinition>();
    for (const definition of registry.list) {
        merged.set(definition.id, definition);
    }
    for (const definition of globalComponentOptions.value) {
        merged.set(definition.id, definition);
    }
    return Array.from(merged.values());
});

const runtimeRegistry = computed<ComponentRegistry>(() => ({
    list: componentOptions.value,
    lookup: buildComponentDefinitionLookup(componentOptions.value),
}));

const componentDefinitionLookup = computed(() =>
    buildComponentDefinitionLookup(componentOptions.value),
);

const globalAliasIds = computed(
    () =>
        new Set(
            globalComponentsRegistry.components.value
                .filter((entry) => entry.enabled !== false)
                .map((entry) => entry.id),
        ),
);
const globalAliasIdList = computed(() => Array.from(globalAliasIds.value));

const builderTree = ref<BuilderTree>([]);
const pageConfig = reactive<PageConfigInput>({
    path: "/",
    title: "Page title",
    seoTitle: "Page title",
    seoDescription: "SEO description.",
    seoImage: "",
    navigation: true,
    extension: "md",
    meta: {},
});
const resolvedBuilderLocale = computed(() =>
    resolveContentLocalePath(pageConfig.path || "/", contentI18nConfig.value)
        .locale,
);
const resolvedDefaultLocale = computed(
    () => contentI18nConfig.value.defaultLocale,
);
const isMultiLanguageSite = computed(
    () =>
        contentI18nConfig.value.enabled &&
        contentI18nConfig.value.locales.length > 1,
);
const showTranslateSection = computed(
    () => isMultiLanguageSite.value && props.showTranslateSection !== false,
);

const getSectionNamesById = (): Record<string, string> => {
    const meta = toPlainRecord(pageConfig.meta);
    const builder = toPlainRecord(meta.builder);
    const rawNames = toPlainRecord(builder.sectionNamesById);
    return Object.fromEntries(
        Object.entries(rawNames).filter(
            ([key, value]) => typeof key === "string" && typeof value === "string",
        ),
    );
};

const isAssistiveSectionSnapToggleEnabled = computed(() => {
    return (
        runtimeConfig.public?.content?.builder?.assistiveSectionSnapToggle ===
        true
    );
});

const getAssistiveSectionSnap = (): boolean => {
    const meta = toPlainRecord(pageConfig.meta);
    const builder = toPlainRecord(meta.builder);
    return typeof builder.assistiveSectionSnap === "boolean"
        ? builder.assistiveSectionSnap
        : true;
};

const setAssistiveSectionSnap = (nextValue: boolean) => {
    const meta = toPlainRecord(pageConfig.meta);
    const builder = toPlainRecord(meta.builder);
    pageConfig.meta = {
        ...meta,
        builder: {
            ...builder,
            assistiveSectionSnap: nextValue,
        },
    };
};

const setSectionNamesById = (nextNamesById: Record<string, string>) => {
    const meta = toPlainRecord(pageConfig.meta);
    const builder = toPlainRecord(meta.builder);
    pageConfig.meta = {
        ...meta,
        builder: {
            ...builder,
            sectionNamesById: nextNamesById,
        },
    };
};

const getRootSectionId = (node: BuilderNodeChild): string | null => {
    if (node.type !== "component") {
        return null;
    }
    const value = node.props?.[BUILDER_SECTION_ID_PROP];
    return typeof value === "string" && value.trim() ? value : null;
};

const ensureRootSectionId = (node: BuilderNodeChild): string | null => {
    if (node.type !== "component") {
        return null;
    }
    const existing = getRootSectionId(node);
    if (existing) {
        return existing;
    }
    const created = nextSectionId();
    node.props = {
        ...toPlainRecord(node.props),
        [BUILDER_SECTION_ID_PROP]: created,
    };
    return created;
};

const syncRootSectionNamesMetadata = () => {
    const existing = getSectionNamesById();
    const next: Record<string, string> = {};
    for (const node of builderTree.value) {
        const sectionId = ensureRootSectionId(node);
        if (!sectionId) {
            continue;
        }
        const currentName = existing[sectionId];
        if (typeof currentName === "string" && currentName.trim()) {
            next[sectionId] = currentName.trim();
        }
    }
    setSectionNamesById(next);
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

const selectedTranslationPointers = computed(() =>
    normalizeSelectedTranslationPointers(props.selectedTranslationPointers),
);

const selectedTranslationPointerSet = computed(
    () => new Set(selectedTranslationPointers.value),
);

const emitSelectedTranslationPointers = (nextPointers: string[]) => {
    emit(
        "update:selectedTranslationPointers",
        normalizeSelectedTranslationPointers(nextPointers),
    );
};

const setTranslationPointerSelection = (
    pointer: string,
    selected: boolean,
) => {
    if (typeof pointer !== "string" || !pointer.startsWith("/")) {
        return;
    }

    const next = new Set(selectedTranslationPointers.value);
    if (selected) {
        next.add(pointer);
    } else {
        next.delete(pointer);
    }

    emitSelectedTranslationPointers(Array.from(next));
};

const isTranslationPointerSelected = (pointer: string): boolean =>
    selectedTranslationPointerSet.value.has(pointer);

const seoDraft = reactive({
    path: pageConfig.path,
    title: pageConfig.title,
    seoTitle: pageConfig.seoTitle,
    seoDescription: pageConfig.seoDescription,
    seoImage: pageConfig.seoImage,
    assistiveSectionSnap: getAssistiveSectionSnap(),
});
const isSeoCardExpanded = ref(false);

const syncSeoDraftFromPageConfig = () => {
    seoDraft.path = pageConfig.path;
    seoDraft.title = pageConfig.title;
    seoDraft.seoTitle = pageConfig.seoTitle;
    seoDraft.seoDescription = pageConfig.seoDescription;
    seoDraft.seoImage = pageConfig.seoImage;
    seoDraft.assistiveSectionSnap = getAssistiveSectionSnap();
};

const hasSeoDraftChanges = computed(
    () =>
        seoDraft.path !== pageConfig.path ||
        seoDraft.title !== pageConfig.title ||
        seoDraft.seoTitle !== pageConfig.seoTitle ||
        seoDraft.seoDescription !== pageConfig.seoDescription ||
        seoDraft.seoImage !== pageConfig.seoImage ||
        (isAssistiveSectionSnapToggleEnabled.value &&
            seoDraft.assistiveSectionSnap !== getAssistiveSectionSnap()),
);

const openSeoCardEditor = () => {
    syncSeoDraftFromPageConfig();
    isSeoCardExpanded.value = true;
};

const applySeoDraft = () => {
    pageConfig.path = seoDraft.path;
    pageConfig.title = seoDraft.title;
    pageConfig.seoTitle = seoDraft.seoTitle;
    pageConfig.seoDescription = seoDraft.seoDescription;
    pageConfig.seoImage = seoDraft.seoImage;
    if (isAssistiveSectionSnapToggleEnabled.value) {
        setAssistiveSectionSnap(seoDraft.assistiveSectionSnap);
    }
    isSeoCardExpanded.value = false;
};

const cancelSeoDraft = () => {
    syncSeoDraftFromPageConfig();
    isSeoCardExpanded.value = false;
};

const layout = reactive<{ spacing: SpacingPresetId }>({ spacing: "none" });
const previewSpacingClass = computed(
    () =>
        spacingPresets.find((preset) => preset.id === layout.spacing)
            ?.className || "",
);

const expandedRootNodes = reactive<Record<string, boolean>>({});

const fallbackSearchQuery = ref("");
const propFocusRequestToken = ref(0);
const nodePropFocusRequest = ref<{
    uidPath: string[];
    targetUid: string;
    propPath: Array<string | number>;
    token: number;
} | null>(null);
const focusedEditSession = ref<{
    uidPath: string[];
    targetUid: string;
    builderPath: number[];
    propPath: Array<string | number>;
    token: number;
    snapshot: MinimalContentDocument;
} | null>(null);
const isFocusedEditSaving = ref(false);
const focusedShowFieldsAround = ref(false);
const focusedShowAllFields = ref(false);
const focusedPropDisplay = computed<"active" | "around" | "all">(() => {
    if (focusedShowAllFields.value) {
        return "all";
    }
    if (focusedShowFieldsAround.value) {
        return "around";
    }
    return "active";
});

watch(
    () => Boolean(focusedEditSession.value),
    (isActive) => emit("focused-edit-change", isActive),
    { immediate: true },
);
const searchQuery = computed<string>({
    get: () => props.searchQuery ?? fallbackSearchQuery.value,
    set: (value) => {
        if (props.searchQuery !== undefined) {
            emit("update:searchQuery", value);
        } else {
            fallbackSearchQuery.value = value;
        }
    },
});
const normalizedSearchQuery = computed(() =>
    normalizeSearchQuery(searchQuery.value),
);
const stickyRootMatchUids = ref<Set<string> | null>(null);

watch(
    () => normalizedSearchQuery.value,
    (query) => {
        if (!query) {
            stickyRootMatchUids.value = null;
            return;
        }
        stickyRootMatchUids.value = new Set(
            filterNodesBySearch(builderTree.value, query).map((node) => node.uid),
        );
    },
    { immediate: true },
);

const filteredBuilderTree = computed(() =>
    !normalizedSearchQuery.value
        ? builderTree.value
        : builderTree.value.filter((node) =>
              Boolean(stickyRootMatchUids.value?.has(node.uid)),
          ),
);

const isRootPickerOpen = ref(false);
const draggingUid = ref<string | null>(null);
const dragOverUid = ref<string | null>(null);
const pendingRootInsertIndex = ref<number | null>(null);
const isSectionNamePromptOpen = ref(false);
const pendingSelectedComponentId = ref<string | null>(null);
const pendingSectionNameDraft = ref("");
const sectionNamePromptInputRef = ref<HTMLInputElement | null>(null);

const isGlobalAliasModalOpen = ref(false);
const isGlobalAliasSaving = ref(false);
const pendingGlobalAliasNodeUid = ref<string | null>(null);
const globalAliasNameDraft = ref("");
const globalAliasError = ref<string | null>(null);
const globalAliasNameInputRef = ref<HTMLInputElement | null>(null);

const spacingPresets: Array<{
    id: SpacingPresetId;
    label: string;
    className: string;
}> = [
    { id: "none", label: "No spacing", className: "" },
    { id: "tight", label: "Tight (16px)", className: "space-tight" },
    { id: "cozy", label: "Cozy (32px)", className: "space-cozy" },
    { id: "roomy", label: "Roomy (48px)", className: "space-roomy" },
];

const socialImagePropDefinition: ComponentPropSchema = {
    key: "seoImage",
    label: "Social preview image",
    type: "text",
    ui: { component: "ContentImageField" },
    description: "Absolute URL used for Open Graph and Twitter cards.",
};

const normalizeJsonProps = (
    component: string,
    props: Record<string, unknown>,
) => {
    const definition = registry.lookup[component];
    if (!definition?.props?.length) {
        return props;
    }

    for (const schema of definition.props) {
        const storageKey =
            schema.type === "stringarray" || schema.type === "jsonarray"
                ? `:${schema.key}`
                : schema.key;
        const rawValue = props[schema.key] ?? props[storageKey];

        if (schema.type === "json") {
            if (typeof rawValue === "string") {
                const trimmed = rawValue.trim();

                if (!trimmed) {
                    props[schema.key] = [];
                    continue;
                }

                try {
                    props[schema.key] = JSON.parse(trimmed);
                } catch (error) {
                    console.warn(
                        `Failed to parse JSON prop "${schema.key}" for component ${component}:`,
                        error,
                    );
                    // Keep original string so the editor can surface it for correction.
                }
            }
        }

        if (schema.type === "jsonarray") {
            let serialized: string | undefined;
            if (typeof rawValue === "string") {
                serialized = rawValue;
            } else if (Array.isArray(rawValue)) {
                serialized = JSON.stringify(rawValue);
            }

            if (serialized !== undefined) {
                props[storageKey] = serialized;
            } else if (props[storageKey] === undefined) {
                props[storageKey] = "[]";
            }

            if (storageKey !== schema.key) {
                delete props[schema.key];
            }
            continue;
        }

        if (schema.type === "stringarray") {
            let serialized: string | undefined;
            if (typeof rawValue === "string") {
                serialized = rawValue;
            } else if (Array.isArray(rawValue)) {
                serialized = JSON.stringify(
                    rawValue.map((entry) => String(entry ?? "")),
                );
            }

            if (serialized !== undefined) {
                props[storageKey] = serialized;
            } else if (props[storageKey] === undefined) {
                props[storageKey] = "[]";
            }

            if (storageKey !== schema.key) {
                delete props[schema.key];
            }
            continue;
        }
    }

    return props;
};

const parseMarginClasses = (
    className: unknown,
): BuilderNode["margins"] | null => {
    if (typeof className !== "string" || !className.trim()) {
        return null;
    }

    const margins: BuilderNode["margins"] = {};
    const prefixMap: Record<string, "sm" | "md" | "lg" | "xl"> = {
        sm: "sm",
        md: "md",
        lg: "lg",
        xl: "xl",
    };

    for (const token of className.split(/\s+/)) {
        if (!token) {
            continue;
        }
        const segments = token.split(":");
        const utility = segments.pop();
        if (!utility) {
            continue;
        }
        const prefix = segments.pop() ?? "base";
        const breakpoint = prefix === "base" ? "base" : prefixMap[prefix];
        if (!breakpoint) {
            continue;
        }
        const [axis, value] = utility.split("-");
        if (!value) {
            continue;
        }
        let side: keyof BuilderNode["margins"] | undefined;
        if (axis === "pt") {
            side = "top";
        } else if (axis === "pr") {
            side = "right";
        } else if (axis === "pb") {
            side = "bottom";
        } else if (axis === "pl") {
            side = "left";
        }
        if (!side) {
            continue;
        }
        if (!margins[side]) {
            margins[side] = {};
        }
        margins[side]![breakpoint] = value;
    }

    return Object.keys(margins).length ? margins : null;
};

const deserializeEntry = (entry: any): BuilderNodeChild | null => {
    if (entry === null || entry === undefined) {
        return null;
    }
    if (typeof entry === "string") {
        const textNode = createTextNode(entry);
        textNode.value = entry;
        return textNode;
    }
    if (Array.isArray(entry)) {
        const [rawComponent, rawProps = {}, ...children] = entry;
        const component = normalizeComponentId(rawComponent);
        if (!component) {
            return null;
        }
        if (component === "content-margin-wrapper") {
            const [wrapped] = children;
            const inner = deserializeEntry(wrapped);
            if (inner && inner.type === "component") {
                const margins = parseMarginClasses(
                    (rawProps as Record<string, unknown>)?.class,
                );
                if (margins) {
                    inner.margins = margins;
                }
            }
            return inner;
        }
        const node = createNode(component);

        // Handle v-slot attributes for template components
        const processedProps: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(
            rawProps as Record<string, unknown>,
        )) {
            if (component === "template" && key.startsWith("v-slot:")) {
                // Convert v-slot:name back to slot prop
                processedProps.slot = key.replace("v-slot:", "");
            } else {
                processedProps[key] = value;
            }
        }
        node.props = normalizeJsonProps(component, processedProps);

        if (component === "p") {
            const alignFromProp = normaliseParagraphAlignment(node.props.align);
            const alignFromStyle = extractParagraphAlignFromStyle(
                node.props.style,
            );
            const resolvedAlign =
                alignFromProp ?? alignFromStyle ?? DEFAULT_PARAGRAPH_ALIGN;

            node.props.align = resolvedAlign;

            const cleanedStyle = stripParagraphAlignFromStyle(node.props.style);
            if (cleanedStyle === undefined) {
                delete node.props.style;
            } else {
                node.props.style = cleanedStyle;
            }
        }

        node.children = children
            .map((child) => deserializeEntry(child))
            .filter((child): child is BuilderNodeChild => child !== null);
        return node;
    }
    return null;
};

const deserializeTree = (entries: any[]): BuilderTree => {
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries
        .map((entry) => deserializeEntry(entry))
        .filter((entry): entry is BuilderNodeChild => entry !== null);
};

const hydrateGlobalAliasProps = () => {
    const aliases = globalAliasDefaultsById.value;
    if (!Object.keys(aliases).length) {
        return;
    }

    applyGlobalAliasDefaultsToTree(builderTree.value, aliases);
};

const resetExpandedRoots = () => {
    for (const key of Object.keys(expandedRootNodes)) {
        delete expandedRootNodes[key];
    }
};

const pruneExpandedRoots = () => {
    for (const key of Object.keys(expandedRootNodes)) {
        if (!builderTree.value.some((node) => node.uid === key)) {
            delete expandedRootNodes[key];
        }
    }
};

const applyDocument = (doc: MinimalContentDocument | null) => {
    if (!doc) {
        builderTree.value = [];
        pageConfig.path = "/";
        pageConfig.title = "Page title";
        pageConfig.seoTitle = "Page title";
        pageConfig.seoDescription = "SEO description.";
        pageConfig.seoImage = "";
        pageConfig.navigation = true;
        pageConfig.extension = "md";
        pageConfig.meta = {};
        syncRootSectionNamesMetadata();
        syncSeoDraftFromPageConfig();
        isSeoCardExpanded.value = false;
        layout.spacing = "none";
        resetExpandedRoots();
        return;
    }

    builderTree.value = deserializeTree(doc.body?.value ?? []);
    pageConfig.path = doc.path ?? "/";
    pageConfig.title = doc.title ?? "";
    pageConfig.seoTitle = doc.seo?.title ?? "";
    pageConfig.seoDescription = doc.seo?.description ?? "";
    pageConfig.seoImage = doc.seo?.image ?? "";
    pageConfig.navigation = doc.navigation ?? true;
    pageConfig.extension = doc.extension ?? "md";
    pageConfig.meta = isPlainObject(doc.meta) ? { ...doc.meta } : {};
    syncRootSectionNamesMetadata();
    syncSeoDraftFromPageConfig();
    isSeoCardExpanded.value = false;
    layout.spacing = doc.layout?.spacing ?? "none";
    pruneExpandedRoots();
};

watch(
    () => props.initialDocument,
    (value) => {
        const cloned = cloneDocument(value);
        applyDocument(cloned);
    },
    { immediate: true },
);

watch(
    builderTree,
    () => {
        syncRootSectionNamesMetadata();
    },
    { deep: true },
);

const findNode = (
    nodes: BuilderNodeChild[],
    uid: string,
): BuilderNodeChild | null => {
    for (const node of nodes) {
        if (node.uid === uid) {
            return node;
        }
        if (node.type === "component") {
            const child = findNode(node.children, uid);
            if (child) {
                return child;
            }
        }
    }
    return null;
};

const findNodeEntry = (
    nodes: BuilderNodeChild[],
    uid: string,
): {
    parent: BuilderNodeChild[];
    index: number;
    node: BuilderNodeChild;
} | null => {
    for (let index = 0; index < nodes.length; index += 1) {
        const candidate = nodes[index];
        if (candidate.uid === uid) {
            return { parent: nodes, index, node: candidate };
        }
        if (candidate.type === "component") {
            const childEntry = findNodeEntry(candidate.children, uid);
            if (childEntry) {
                return childEntry;
            }
        }
    }
    return null;
};

const cloneNodeData = <T,>(value: T): T => {
    if (
        value === null ||
        value === undefined ||
        typeof value === "function" ||
        typeof value !== "object"
    ) {
        return value;
    }

    if (typeof structuredClone === "function") {
        try {
            return structuredClone(value);
        } catch (error) {
            console.warn(
                "[builder] structuredClone failed, falling back to JSON clone:",
                error,
            );
        }
    }

    try {
        return JSON.parse(JSON.stringify(value)) as T;
    } catch (error) {
        console.warn("[builder] JSON clone failed, using shallow copy:", error);
        if (Array.isArray(value)) {
            return [...value] as T;
        }
        return { ...(value as Record<string, unknown>) } as T;
    }
};

const cloneBuilderNode = (source: BuilderNodeChild): BuilderNodeChild => {
    if (source.type === "text") {
        return createTextNode(source.value);
    }

    const cloned = createNode(source.component);
    cloned.props = cloneNodeData(source.props ?? {});
    cloned.children = source.children.map((child) => cloneBuilderNode(child));
    if (source.margins) {
        cloned.margins = cloneNodeData(source.margins);
    } else {
        delete cloned.margins;
    }

    return cloned;
};

const insertRootNode = (node: BuilderNodeChild, insertIndex: number | null) => {
    if (insertIndex === null) {
        builderTree.value.push(node);
        return;
    }

    const boundedIndex = Math.max(0, Math.min(insertIndex, builderTree.value.length));
    builderTree.value.splice(boundedIndex, 0, node);
};

const openRootPicker = (insertIndex: number | null = null) => {
    pendingRootInsertIndex.value = insertIndex;
    isRootPickerOpen.value = true;
};

const closeRootPicker = () => {
    isRootPickerOpen.value = false;
    if (isSectionNamePromptOpen.value) {
        return;
    }
    pendingRootInsertIndex.value = null;
};

const closeAddSectionWorkflow = () => {
    isRootPickerOpen.value = false;
    isSectionNamePromptOpen.value = false;
    pendingRootInsertIndex.value = null;
    pendingSelectedComponentId.value = null;
    pendingSectionNameDraft.value = "";
};

const pendingSelectedComponentLabel = computed(() => {
    const componentId = pendingSelectedComponentId.value;
    if (!componentId) {
        return "";
    }
    return registry.lookup[componentId]?.label ?? componentId;
});

const handleRootComponentPicked = (componentId: string) => {
    pendingSelectedComponentId.value = componentId;
    pendingSectionNameDraft.value = "";
    isRootPickerOpen.value = false;
    isSectionNamePromptOpen.value = true;
    nextTick(() => {
        sectionNamePromptInputRef.value?.focus();
    });
};

const confirmRootComponentWithName = () => {
    const componentId = pendingSelectedComponentId.value;
    const sectionName = pendingSectionNameDraft.value.trim();
    if (!componentId || !sectionName) {
        return;
    }
    const node = createNode(componentId);
    applyGlobalAliasDefaultsToNode(node, globalAliasDefaultsById.value);
    insertRootNode(node, pendingRootInsertIndex.value);
    saveLocalSectionName(node.uid, sectionName);
    closeAddSectionWorkflow();
};

const cancelRootComponentSelection = () => {
    closeAddSectionWorkflow();
};

const addRootText = () => {
    insertRootNode(createTextNode("New text"), pendingRootInsertIndex.value);
    closeRootPicker();
};

const getRootInsertIndexAfter = (uid: string): number | null => {
    const rootIndex = builderTree.value.findIndex((node) => node.uid === uid);
    if (rootIndex === -1) {
        return null;
    }
    return rootIndex + 1;
};

const getRootNodeByUid = (uid: string): BuilderNodeChild | null =>
    builderTree.value.find((node) => node.uid === uid) ?? null;

const getLocalSectionName = (uid: string): string => {
    const node = getRootNodeByUid(uid);
    if (!node) {
        return "";
    }
    const sectionId = getRootSectionId(node);
    if (!sectionId) {
        return "";
    }
    return getSectionNamesById()[sectionId] ?? "";
};

const saveLocalSectionName = (uid: string, value: string) => {
    const node = getRootNodeByUid(uid);
    if (!node) {
        return;
    }
    const sectionId = ensureRootSectionId(node);
    if (!sectionId) {
        return;
    }
    const names = getSectionNamesById();
    const normalized = value.trim();
    if (!normalized) {
        delete names[sectionId];
    } else {
        names[sectionId] = normalized;
    }
    setSectionNamesById(names);
};

const updateNodeProp = (uid: string, key: string, value: unknown) => {
    const node = findNode(builderTree.value, uid);
    if (!node || node.type !== "component") {
        return;
    }

    const isInternalMetaProp =
        key.startsWith("__builder") || key.startsWith("__content");
    if (isInternalMetaProp) {
        const props = { ...node.props };
        if (value === undefined || value === null) {
            delete props[key];
        } else {
            props[key] = value;
        }
        node.props = props;
        return;
    }

    const aliasId = node.component;
    const aliasEntryIndex = globalComponentsRegistry.components.value.findIndex(
        (entry) => entry.id === aliasId && entry.enabled !== false,
    );
    if (aliasEntryIndex !== -1) {
        const props = { ...node.props };
        if (value === undefined || value === null) {
            delete props[key];
        } else {
            props[key] = value;
        }
        node.props = props;
        queueGlobalAliasPropPatch(aliasId, key, value);
        return;
    }

    const props = { ...node.props };
    if (value === undefined || value === null) {
        delete props[key];
    } else {
        props[key] = value;
    }
    node.props = props;
};

const cloneGlobalEntriesForSave = (
    entries: ContentGlobalComponentEntry[],
): ContentGlobalComponentEntry[] =>
    entries.map((entry) => ({
        ...entry,
        defaultProps: { ...(entry.defaultProps ?? {}) },
        defaultPropsByLocale: Object.fromEntries(
            Object.entries(entry.defaultPropsByLocale ?? {}).map(
                ([locale, props]) => [locale, { ...(props ?? {}) }],
            ),
        ),
    }));

type GlobalAliasPendingPatch = {
    defaultProps: Record<string, unknown | undefined>;
    defaultPropsByLocale: Record<string, Record<string, unknown | undefined>>;
};

const globalAliasPendingPatches = new Map<
    string,
    GlobalAliasPendingPatch
>();
let globalAliasPersistTimer: ReturnType<typeof setTimeout> | null = null;
let globalAliasAdminLoadPromise: Promise<void> | null = null;
let isGlobalAliasAdminLoaded = false;

const ensureGlobalAliasAdminLoaded = async () => {
    if (isGlobalAliasAdminLoaded) {
        return;
    }
    if (!globalAliasAdminLoadPromise) {
        globalAliasAdminLoadPromise = globalComponentsRegistry
            .fetchAdmin()
            .then(() => {
                isGlobalAliasAdminLoaded = true;
            })
            .finally(() => {
                globalAliasAdminLoadPromise = null;
            });
    }
    await globalAliasAdminLoadPromise;
};

const applyGlobalAliasPendingPatches = () => {
    if (!globalAliasPendingPatches.size) {
        return;
    }

    const nextEntries = cloneGlobalEntriesForSave(
        globalComponentsRegistry.components.value,
    );
    let changed = false;

    for (const [aliasId, patch] of globalAliasPendingPatches.entries()) {
        const entryIndex = nextEntries.findIndex(
            (entry) => entry.id === aliasId && entry.enabled !== false,
        );
        if (entryIndex === -1) {
            continue;
        }
        const target = nextEntries[entryIndex];
        const nextProps = { ...(target.defaultProps ?? {}) };
        for (const [propKey, propValue] of Object.entries(
            patch.defaultProps ?? {},
        )) {
            if (propValue === undefined || propValue === null) {
                delete nextProps[propKey];
            } else {
                nextProps[propKey] = cloneNodeData(propValue);
            }
        }
        const nextDefaultPropsByLocale: Record<string, Record<string, unknown>> =
            Object.fromEntries(
                Object.entries(target.defaultPropsByLocale ?? {}).map(
                    ([locale, props]) => [locale, { ...(props ?? {}) }],
                ),
            );
        for (const [locale, localePatch] of Object.entries(
            patch.defaultPropsByLocale ?? {},
        )) {
            const nextLocaleProps = {
                ...(nextDefaultPropsByLocale[locale] ?? {}),
            };
            for (const [propKey, propValue] of Object.entries(localePatch)) {
                if (propValue === undefined || propValue === null) {
                    delete nextLocaleProps[propKey];
                } else {
                    nextLocaleProps[propKey] = cloneNodeData(propValue);
                }
            }
            if (Object.keys(nextLocaleProps).length === 0) {
                delete nextDefaultPropsByLocale[locale];
            } else {
                nextDefaultPropsByLocale[locale] = nextLocaleProps;
            }
        }
        nextEntries[entryIndex] = {
            ...target,
            defaultProps: nextProps,
            defaultPropsByLocale: nextDefaultPropsByLocale,
        };
        changed = true;
    }

    if (changed) {
        globalComponentsRegistry.components.value = nextEntries;
    }
};

const persistGlobalAliasPatches = async () => {
    try {
        await ensureGlobalAliasAdminLoaded();
        applyGlobalAliasPendingPatches();
        const entriesToSave = cloneGlobalEntriesForSave(
            globalComponentsRegistry.components.value,
        );
        await globalComponentsRegistry.saveAdmin(entriesToSave);
        globalAliasPendingPatches.clear();
    } catch (error) {
        console.error(
            "[builder] Failed to persist global component defaults from page editor.",
            error,
        );
    }
};

const schedulePersistGlobalAliasPatches = () => {
    if (globalAliasPersistTimer) {
        clearTimeout(globalAliasPersistTimer);
    }
    globalAliasPersistTimer = setTimeout(() => {
        globalAliasPersistTimer = null;
        void persistGlobalAliasPatches();
    }, 450);
};

const queueGlobalAliasPropPatch = (
    aliasId: string,
    key: string,
    value: unknown,
) => {
    const currentPatch = globalAliasPendingPatches.get(aliasId) ?? {
        defaultProps: {},
        defaultPropsByLocale: {},
    };
    const locale = resolvedBuilderLocale.value;
    const isDefaultLocale = locale === resolvedDefaultLocale.value;
    if (isDefaultLocale) {
        currentPatch.defaultProps[key] = value as unknown;
    } else {
        const localePatch = currentPatch.defaultPropsByLocale[locale] ?? {};
        localePatch[key] = value as unknown;
        currentPatch.defaultPropsByLocale[locale] = localePatch;
    }
    globalAliasPendingPatches.set(aliasId, currentPatch);

    applyGlobalAliasPendingPatches();
    schedulePersistGlobalAliasPatches();
};

const updateTextNode = (uid: string, value: string) => {
    const node = findNode(builderTree.value, uid);
    if (!node || node.type !== "text") {
        return;
    }
    node.value = value;
};

const addChildComponent = (parentUid: string, componentId: string) => {
    const parent = findNode(builderTree.value, parentUid);
    if (!parent || parent.type !== "component") {
        return;
    }
    const node = createNode(componentId);
    applyGlobalAliasDefaultsToNode(node, globalAliasDefaultsById.value);
    parent.children.push(node);
};

const addChildText = (parentUid: string) => {
    const parent = findNode(builderTree.value, parentUid);
    if (!parent || parent.type !== "component") {
        return;
    }
    parent.children.push(createTextNode("Text"));
};

const removeNode = (uid: string) => {
    const removeRecursive = (nodes: BuilderNodeChild[]): boolean => {
        const index = nodes.findIndex((node) => node.uid === uid);
        if (index !== -1) {
            nodes.splice(index, 1);
            return true;
        }
        for (const node of nodes) {
            if (node.type === "component" && removeRecursive(node.children)) {
                return true;
            }
        }
        return false;
    };

    if (removeRecursive(builderTree.value)) {
        delete expandedRootNodes[uid];
    }
};

const cloneNode = (uid: string) => {
    const entry = findNodeEntry(builderTree.value, uid);
    if (!entry) {
        return;
    }

    const shouldClone =
        typeof window === "undefined"
            ? true
            : window.confirm("Clone this element?");

    if (!shouldClone) {
        return;
    }

    const duplicated = cloneBuilderNode(entry.node);
    entry.parent.splice(entry.index + 1, 0, duplicated);
};

const toSuggestedGlobalAlias = (componentId: string): string => {
    if (!componentId.trim()) {
        return "GlobalComponent";
    }
    if (/^[A-Z][A-Za-z0-9_-]*$/.test(componentId)) {
        return componentId;
    }

    const pascal = componentId
        .split(/[-_\s]+/)
        .filter((part) => part.length > 0)
        .map((part) => part[0].toUpperCase() + part.slice(1))
        .join("");

    if (!pascal) {
        return "GlobalComponent";
    }
    return `Global${pascal}`;
};

const sanitizeGlobalDefaultProps = (
    input: Record<string, unknown> | undefined,
): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input ?? {})) {
        if (key.startsWith("__builder") || key.startsWith("__content")) {
            continue;
        }
        result[key] = cloneNodeData(value);
    }
    return result;
};

const sanitizeLocalAliasProps = (
    input: Record<string, unknown> | undefined,
): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input ?? {})) {
        if (key.startsWith("__builder") || key.startsWith("__content")) {
            result[key] = cloneNodeData(value);
        }
    }
    return result;
};

const openGlobalAliasModal = async (uid: string) => {
    const node = findNode(builderTree.value, uid);
    if (!node || node.type !== "component") {
        return;
    }
    if (
        globalComponentsRegistry.components.value.some(
            (entry) => entry.id === node.component && entry.enabled !== false,
        )
    ) {
        if (typeof window !== "undefined") {
            window.alert(
                "This node already uses a global alias. Create aliases only from base components.",
            );
        }
        return;
    }

    pendingGlobalAliasNodeUid.value = uid;
    globalAliasNameDraft.value = toSuggestedGlobalAlias(node.component);
    globalAliasError.value = null;
    isGlobalAliasModalOpen.value = true;
    try {
        await globalComponentsRegistry.fetchAdmin();
    } catch {
        // keep modal open; save path will show explicit error
    }
    await nextTick();
    globalAliasNameInputRef.value?.focus();
    globalAliasNameInputRef.value?.select();
};

const closeGlobalAliasModal = () => {
    if (isGlobalAliasSaving.value) {
        return;
    }
    isGlobalAliasModalOpen.value = false;
    pendingGlobalAliasNodeUid.value = null;
    globalAliasNameDraft.value = "";
    globalAliasError.value = null;
};

const GLOBAL_ALIAS_NAME_PATTERN = /^[A-Z][A-Za-z0-9_-]*$/;

const extractGlobalAliasUsagePages = (error: any): Array<{
    path?: string;
    title?: string | null;
}> => {
    const candidates = [
        error?.data?.data?.pages,
        error?.data?.pages,
        error?.response?._data?.data?.pages,
        error?.response?._data?.pages,
    ];
    for (const candidate of candidates) {
        if (Array.isArray(candidate)) {
            return candidate;
        }
    }
    return [];
};

const formatGlobalAliasDeleteError = (aliasId: string, error: any): string => {
    const pages = extractGlobalAliasUsagePages(error);
    const message =
        error?.data?.statusMessage ||
        error?.response?._data?.statusMessage ||
        error?.message ||
        `Failed to delete global component "${aliasId}".`;
    if (!pages.length) {
        return message;
    }
    const pageList = pages
        .map((page) => {
            const path = typeof page?.path === "string" ? page.path : "/";
            const title =
                typeof page?.title === "string" && page.title.trim()
                    ? ` (${page.title})`
                    : "";
            return `- ${path}${title}`;
        })
        .join("\n");
    return `${message}\n\nRemove the global component from these pages first:\n${pageList}`;
};

const deleteGlobalComponent = async (aliasId: string) => {
    try {
        await ensureGlobalAliasAdminLoaded();
        await globalComponentsRegistry.deleteAdmin(aliasId);
        globalAliasPendingPatches.delete(aliasId);
    } catch (error: any) {
        const message = formatGlobalAliasDeleteError(aliasId, error);
        if (typeof window !== "undefined") {
            window.alert(message);
        } else {
            console.error(message);
        }
    }
};

const confirmCreateGlobalAlias = async () => {
    const uid = pendingGlobalAliasNodeUid.value;
    const aliasName = globalAliasNameDraft.value.trim();
    const node = uid ? findNode(builderTree.value, uid) : null;

    if (!uid || !node || node.type !== "component") {
        globalAliasError.value = "The selected component is no longer available.";
        return;
    }
    if (!GLOBAL_ALIAS_NAME_PATTERN.test(aliasName)) {
        globalAliasError.value =
            "Alias must start with uppercase and contain only letters, numbers, _ or -.";
        return;
    }
    if (Object.hasOwn(registry.lookup, aliasName)) {
        globalAliasError.value =
            `Alias "${aliasName}" conflicts with an existing component id. Use a different alias name.`;
        return;
    }

    isGlobalAliasSaving.value = true;
    globalAliasError.value = null;

    try {
        const existing = [...globalComponentsRegistry.components.value];
        const existingEntry = existing.find((entry) => entry.id === aliasName);

        if (existingEntry) {
            const overwrite =
                typeof window === "undefined"
                    ? true
                    : window.confirm(
                          `Global alias "${aliasName}" already exists. Overwrite its defaults with current node props?`,
                      );
            if (!overwrite) {
                isGlobalAliasSaving.value = false;
                return;
            }
        }

        const updatedEntries = existing.filter((entry) => entry.id !== aliasName);
        updatedEntries.push({
            id: aliasName,
            component: node.component,
            enabled: true,
            defaultProps: sanitizeGlobalDefaultProps(node.props),
        });

        await globalComponentsRegistry.saveAdmin(updatedEntries);

        const localAliasProps = sanitizeLocalAliasProps(node.props);
        node.component = aliasName;
        node.props = localAliasProps;

        closeGlobalAliasModal();
    } catch (error: any) {
        globalAliasError.value =
            error?.data?.statusMessage ||
            error?.message ||
            "Failed to create global alias.";
    } finally {
        isGlobalAliasSaving.value = false;
    }
};

const isRootExpanded = (uid: string) => expandedRootNodes[uid] === true;

const handleRootExpansion = (uid: string, expanded: boolean) => {
    if (!builderTree.value.some((node) => node.uid === uid)) {
        return;
    }
    if (expanded) {
        expandedRootNodes[uid] = true;
    } else {
        delete expandedRootNodes[uid];
    }
};

const moveRootNode = (dragUid: string | null, targetUid: string | null) => {
    if (!dragUid) {
        return;
    }
    const items = builderTree.value;
    const fromIndex = items.findIndex((node) => node.uid === dragUid);
    if (fromIndex === -1) {
        return;
    }
    const [moved] = items.splice(fromIndex, 1);
    const targetIndex = targetUid
        ? items.findIndex((node) => node.uid === targetUid)
        : items.length;
    const insertIndex = targetIndex === -1 ? items.length : targetIndex;
    items.splice(insertIndex, 0, moved);
};

const handleDragStart = (uid: string) => {
    if (isRootExpanded(uid)) {
        return;
    }
    draggingUid.value = uid;
};

const handleDragEnd = () => {
    draggingUid.value = null;
    dragOverUid.value = null;
};

const handleDragOver = (uid: string | null) => {
    if (draggingUid.value === uid) {
        return;
    }
    dragOverUid.value = uid;
};

const handleDrop = (uid: string | null) => {
    if (!draggingUid.value) {
        return;
    }
    if (uid && uid === draggingUid.value) {
        handleDragEnd();
        return;
    }
    moveRootNode(draggingUid.value, uid);
    handleDragEnd();
};

const handleNodeFocus = (payload: {
    uid: string;
    mode?: "flash" | "lock" | "clear";
}) => {
    emit("node-focus", {
        uid: payload.uid,
        path: pageConfig.path,
        mode: payload.mode ?? "flash",
    });
};

const escapePointerToken = (token: string | number): string =>
    String(token).replace(/~/g, "~0").replace(/\//g, "~1");

const toJsonPointer = (segments: Array<string | number>): string =>
    `/${segments.map((segment) => escapePointerToken(segment)).join("/")}`;

const findBuilderNodePathByUid = (
    nodes: BuilderNodeChild[],
    uid: string,
    currentPath: number[] = [],
): number[] | null => {
    for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        const nextPath = [...currentPath, index];

        if (node.uid === uid) {
            return nextPath;
        }

        if (node.type === "component") {
            const nested = findBuilderNodePathByUid(node.children, uid, nextPath);
            if (nested) {
                return nested;
            }
        }
    }

    return null;
};

const resolveUidPathByBuilderPath = (builderPath: number[]): string[] => {
    const uidPath: string[] = [];
    let currentNodes: BuilderNodeChild[] = builderTree.value;

    for (const index of builderPath) {
        const node = currentNodes[index];
        if (!node) {
            break;
        }
        uidPath.push(node.uid);
        if (node.type !== "component") {
            break;
        }
        currentNodes = node.children;
    }

    return uidPath;
};

const parseDottedPropPath = (value: string): Array<string | number> =>
    value
        .split(".")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)
        .map((segment) =>
            /^-?\d+$/.test(segment) ? Number.parseInt(segment, 10) : segment,
        );

const findBuilderNodeByUid = (
    nodes: BuilderNodeChild[],
    uid: string,
): BuilderNodeChild | null => {
    for (const node of nodes) {
        if (node.uid === uid) {
            return node;
        }

        if (node.type === "component") {
            const nested = findBuilderNodeByUid(node.children, uid);
            if (nested) {
                return nested;
            }
        }
    }

    return null;
};

const focusedEditNode = computed(() => {
    const session = focusedEditSession.value;
    if (!session) {
        return null;
    }

    return findBuilderNodeByUid(builderTree.value, session.targetUid);
});

const focusedEditFocusRequest = computed(() => {
    const session = focusedEditSession.value;
    const request = nodePropFocusRequest.value;
    if (!session || !request || request.targetUid !== session.targetUid) {
        return request;
    }

    return {
        ...request,
        uidPath: [session.targetUid],
    };
});

const focusedEditDisplayTitle = computed(() => {
    const node = focusedEditNode.value;
    if (!node) {
        return "Focused edit";
    }
    if (node.type !== "component") {
        return "Text";
    }

    const rootUid = focusedEditSession.value?.uidPath[0] ?? node.uid;
    const localName = getLocalSectionName(rootUid).trim();
    return localName || "Unnamed section";
});

const resolveFallbackPropPath = (
    uid: string,
    hint: InlinePreviewPropHint | undefined,
): Array<string | number> => {
    if (!hint) {
        return [];
    }

    const targetNode = findBuilderNodeByUid(builderTree.value, uid);
    if (!targetNode || targetNode.type !== "component") {
        return [];
    }

    const inferred = inferPropPathFromPreviewHint(targetNode.props ?? {}, hint);
    return inferred ?? [];
};

const focusedEditSnapshot = (): MinimalContentDocument => getSerializedDocument();

const openFocusedEditSession = (payload: {
    uidPath: string[];
    targetUid: string;
    builderPath: number[];
    propPath: Array<string | number>;
}) => {
    propFocusRequestToken.value += 1;
    const token = propFocusRequestToken.value;
    const request = {
        uidPath: payload.uidPath,
        targetUid: payload.targetUid,
        propPath: payload.propPath,
        token,
    };

    focusedShowFieldsAround.value = false;
    focusedShowAllFields.value = false;
    focusedEditSession.value = {
        ...request,
        builderPath: [...payload.builderPath],
        snapshot: focusedEditSnapshot(),
    };
    nodePropFocusRequest.value = request;
    handleNodeFocus({ uid: payload.targetUid, mode: "lock" });
};

const waitForFocusedTreeReturn = () =>
    new Promise<void>((resolve) => {
        if (typeof window === "undefined") {
            resolve();
            return;
        }

        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
        });
    });

const waitForFocusedTreeSettle = () =>
    new Promise<void>((resolve) => {
        if (typeof window === "undefined") {
            resolve();
            return;
        }
        window.setTimeout(resolve, 300);
    });

const applyTreeFocusRequest = (
    uidPath: string[],
    targetUid: string,
    propPath: Array<string | number>,
) => {
    propFocusRequestToken.value += 1;
    nodePropFocusRequest.value = {
        uidPath: [...uidPath],
        targetUid,
        propPath: [...propPath],
        token: propFocusRequestToken.value,
    };
    handleNodeFocus({ uid: targetUid, mode: "lock" });
};

const restoreTreeFocusAfterFocusedEdit = async (
    session: NonNullable<typeof focusedEditSession.value>,
) => {
    const resolvedUidPath = resolveUidPathByBuilderPath(session.builderPath);
    const uidPath = resolvedUidPath.length ? resolvedUidPath : session.uidPath;
    const targetUid = uidPath[uidPath.length - 1] ?? session.targetUid;
    const rootUid = uidPath[0];
    if (rootUid) {
        expandedRootNodes[rootUid] = true;
    }

    await nextTick();
    await waitForFocusedTreeReturn();

    applyTreeFocusRequest(uidPath, targetUid, session.propPath);
    await waitForFocusedTreeSettle();
    applyTreeFocusRequest(uidPath, targetUid, session.propPath);
};

const closeFocusedEditSession = () => {
    const session = focusedEditSession.value;
    if (session) {
        handleNodeFocus({ uid: session.targetUid, mode: "clear" });
    }
    focusedEditSession.value = null;
    nodePropFocusRequest.value = null;
    isFocusedEditSaving.value = false;
    focusedShowFieldsAround.value = false;
    focusedShowAllFields.value = false;
    if (session) {
        void restoreTreeFocusAfterFocusedEdit(session);
    }
};

const cancelFocusedEditSession = () => {
    if (!focusedEditSession.value || isFocusedEditSaving.value) {
        return;
    }

    loadDocument(focusedEditSession.value.snapshot);
    closeFocusedEditSession();
};

const confirmFocusedEditSession = async () => {
    if (!focusedEditSession.value || isFocusedEditSaving.value) {
        return;
    }

    isFocusedEditSaving.value = true;
    try {
        await props.onSaveFocusedEdit?.();
        closeFocusedEditSession();
    } finally {
        isFocusedEditSaving.value = false;
    }
};

const focusNodeProp = (payload: {
    uid: string;
    propPath: string;
    sectionId?: string;
    hint?: InlinePreviewPropHint;
}) => {
    if (!payload || typeof payload.uid !== "string") {
        return;
    }

    const propPath = payload.propPath.trim().length
        ? parseDottedPropPath(payload.propPath)
        : resolveFallbackPropPath(payload.uid, payload.hint);
    if (!propPath.length) {
        return;
    }

    let targetUid = payload.uid;
    let builderPath = findBuilderNodePathByUid(builderTree.value, targetUid);

    const sectionId =
        typeof payload.sectionId === "string" ? payload.sectionId.trim() : "";
    if (sectionId) {
        const sectionRootNode = builderTree.value.find(
            (node) => getRootSectionId(node) === sectionId,
        );

        if (sectionRootNode) {
            const sectionPath = findBuilderNodePathByUid(
                builderTree.value,
                sectionRootNode.uid,
            );

            if (
                sectionPath &&
                sectionPath.length &&
                (!builderPath || builderPath[0] !== sectionPath[0])
            ) {
                builderPath = sectionPath;
                targetUid = sectionRootNode.uid;
            }
        }
    }

    if (!builderPath || !builderPath.length) {
        return;
    }

    const uidPath = resolveUidPathByBuilderPath(builderPath);
    if (!uidPath.length) {
        return;
    }

    // Ensure node remains visible while applying prop focus.
    searchQuery.value = "";
    const rootUid = uidPath[0];
    expandedRootNodes[rootUid] = true;

    openFocusedEditSession({
        uidPath,
        targetUid,
        builderPath,
        propPath,
    });
};

const toBodyNodePointerSegments = (
    builderPath: number[],
): Array<string | number> => {
    if (!builderPath.length) {
        return [];
    }

    const [rootIndex, ...childIndices] = builderPath;
    const bodySegments: Array<string | number> = [rootIndex];
    childIndices.forEach((index) => {
        bodySegments.push(index + 2);
    });
    return bodySegments;
};

const SEO_TITLE_POINTER = "/__seo/title";
const SEO_DESCRIPTION_POINTER = "/__seo/description";

const resolveFieldPointer = (
    payload: {
        uid: string;
        propPath: Array<string | number>;
    },
): string | null => {
    const builderPath = findBuilderNodePathByUid(builderTree.value, payload.uid);
    if (!builderPath || !payload.propPath.length) {
        return null;
    }

    const nodePointer = toBodyNodePointerSegments(builderPath);
    return toJsonPointer([
        ...nodePointer,
        1,
        ...payload.propPath,
    ]);
};

const handleTranslateField = (payload: {
    uid: string;
    propPath: Array<string | number>;
    label?: string;
}) => {
    const fieldPointer = resolveFieldPointer(payload);
    if (!fieldPointer) {
        return;
    }

    emit("translate-scope", {
        scopeMode: "field",
        scopePointer: fieldPointer,
        label: payload.label,
    });
};

const handleToggleTranslateFieldSelection = (payload: {
    uid: string;
    propPath: Array<string | number>;
    selected: boolean;
}) => {
    const fieldPointer = resolveFieldPointer(payload);
    if (!fieldPointer) {
        return;
    }

    setTranslationPointerSelection(fieldPointer, payload.selected);
};

const isTranslateFieldSelected = (payload: {
    uid: string;
    propPath: Array<string | number>;
}): boolean => {
    const fieldPointer = resolveFieldPointer(payload);
    if (!fieldPointer) {
        return false;
    }

    return isTranslationPointerSelected(fieldPointer);
};

const handleTranslateSection = (payload: {
    uid: string;
    label?: string;
}) => {
    const builderPath = findBuilderNodePathByUid(builderTree.value, payload.uid);
    if (!builderPath) {
        return;
    }

    const sectionPointer = toJsonPointer(toBodyNodePointerSegments(builderPath));
    emit("translate-scope", {
        scopeMode: "section",
        scopePointer: sectionPointer,
        label: payload.label,
    });
};

const handleTranslateSeoField = (field: "title" | "description") => {
    if (field === "title") {
        pageConfig.seoTitle = seoDraft.seoTitle;
        emit("translate-scope", {
            scopeMode: "field",
            scopePointer: SEO_TITLE_POINTER,
            label: "SEO title",
        });
        return;
    }

    pageConfig.seoDescription = seoDraft.seoDescription;
    emit("translate-scope", {
        scopeMode: "field",
        scopePointer: SEO_DESCRIPTION_POINTER,
        label: "SEO description",
    });
};

const serializedDocument = computed(() =>
    (() => {
        const document = createDocumentFromTree(
            builderTree.value,
            {
                ...pageConfig,
                meta: pageConfig.meta ?? {},
            },
            { spacing: layout.spacing },
            { globalAliasIds: globalAliasIds.value },
        );

        const fixedBodyPaths = collectFixedBodyPaths(
            document.body?.value ?? [],
            componentDefinitionLookup.value,
        );
        const meta = toPlainRecord(document.meta);
        const i18nMeta = toPlainRecord(meta[CONTENT_META_I18N_KEY]);

        document.meta = {
            ...meta,
            [CONTENT_META_I18N_KEY]: {
                ...i18nMeta,
                fixedBodyPaths,
            },
        };

        return document;
    })(),
);

const previewDocument = computed(() =>
    (() => {
        const document = createDocumentFromTree(
            builderTree.value,
            {
                ...pageConfig,
                meta: pageConfig.meta ?? {},
            },
            { spacing: layout.spacing },
            {
                annotateBuilderUids: true,
            },
        );

        const fixedBodyPaths = collectFixedBodyPaths(
            document.body?.value ?? [],
            componentDefinitionLookup.value,
        );
        const meta = toPlainRecord(document.meta);
        const i18nMeta = toPlainRecord(meta[CONTENT_META_I18N_KEY]);

        document.meta = {
            ...meta,
            [CONTENT_META_I18N_KEY]: {
                ...i18nMeta,
                fixedBodyPaths,
            },
        };

        return document;
    })(),
);

let documentEmitTimeout: ReturnType<typeof setTimeout> | null = null;
let previewDocumentEmitTimeout: ReturnType<typeof setTimeout> | null = null;

const scheduleDocumentEmit = (document: MinimalContentDocument) => {
    if (documentEmitTimeout) {
        clearTimeout(documentEmitTimeout);
    }

    documentEmitTimeout = setTimeout(() => {
        documentEmitTimeout = null;
        try {
            const cloned = cloneDocument(document);
            if (cloned) {
                emit("document-change", cloned);
            }
        } catch (error) {
            console.error("Failed to emit document change", error);
        }
    }, 200);
};

const schedulePreviewDocumentEmit = (document: MinimalContentDocument) => {
    if (previewDocumentEmitTimeout) {
        clearTimeout(previewDocumentEmitTimeout);
    }

    previewDocumentEmitTimeout = setTimeout(() => {
        previewDocumentEmitTimeout = null;
        try {
            const cloned = cloneDocument(document);
            if (cloned) {
                emit("document-preview-change", cloned);
            }
        } catch (error) {
            console.error("Failed to emit preview document change", error);
        }
    }, 200);
};

watch(
    serializedDocument,
    (value) => {
        if (!value) {
            return;
        }
        scheduleDocumentEmit(value);
    },
    { deep: true, immediate: true },
);

watch(
    previewDocument,
    (value) => {
        if (!value) {
            return;
        }
        schedulePreviewDocumentEmit(value);
    },
    { deep: true, immediate: true },
);

onMounted(() => {
    globalComponentsRegistry
        .fetchPublic()
        .then(() => {
            hydrateGlobalAliasProps();
        })
        .catch(() => {});

    if (isTypographyFeatureEnabled.value) {
        contentFontSettings
            .fetchAdmin()
            .then(() => {
                syncTypographyDraft();
            })
            .catch(() => {});
    }

    if (isThemeFeatureEnabled.value) {
        contentThemeSettings
            .fetchAdmin()
            .then(() => {
                syncThemeDraft();
            })
            .catch(() => {});
    }
});

watch(
    () => globalAliasDefaultsById.value,
    () => {
        hydrateGlobalAliasProps();
    },
    { deep: true },
);

onBeforeUnmount(() => {
    if (documentEmitTimeout) {
        clearTimeout(documentEmitTimeout);
        documentEmitTimeout = null;
    }
    if (previewDocumentEmitTimeout) {
        clearTimeout(previewDocumentEmitTimeout);
        previewDocumentEmitTimeout = null;
    }
    if (globalAliasPersistTimer) {
        clearTimeout(globalAliasPersistTimer);
        globalAliasPersistTimer = null;
    }
    if (globalAliasPendingPatches.size > 0) {
        void persistGlobalAliasPatches();
    }
});

const sansFamilyDraft = ref("");
const displayFamilyDraft = ref("");
const styleDraft = ref<Array<"normal" | "italic">>([]);
const weightDraft = ref<number[]>([]);
const widthDraft = ref<string[]>([]);
const typographyNotice = ref<string | null>(null);
const isTypographyApplying = ref(false);
const isTypographyPanelExpanded = ref(false);
const fontBrowserTarget = ref<"sans" | "display" | null>(null);
const installingFontSlug = ref<string | null>(null);
const ADD_FONT_OPTION_VALUE = "__content_add_new_font__";
const TYPOGRAPHY_STYLE_OPTIONS = [
    { label: "Normal", value: "normal" as const },
    { label: "Italic", value: "italic" as const },
];
const TYPOGRAPHY_WEIGHT_OPTIONS = [100, 200, 300, 400, 500, 600, 700, 800, 900];
const TYPOGRAPHY_WIDTH_OPTIONS = [
    { label: "Ultra Condensed", value: "50%" },
    { label: "Extra Condensed", value: "62.5%" },
    { label: "Condensed", value: "75%" },
    { label: "Semi Condensed", value: "87.5%" },
    { label: "Normal", value: "100%" },
    { label: "Semi Expanded", value: "112.5%" },
    { label: "Expanded", value: "125%" },
    { label: "Extra Expanded", value: "150%" },
    { label: "Ultra Expanded", value: "200%" },
];

const sortNumbers = (values: number[]) => [...values].sort((left, right) => left - right);
const sortStrings = (values: string[]) => [...values].sort((left, right) => left.localeCompare(right));
const hasSameNumbers = (left: number[], right: number[]) =>
    left.length === right.length && left.every((value, index) => value === right[index]);
const hasSameStrings = (left: string[], right: string[]) =>
    left.length === right.length && left.every((value, index) => value === right[index]);

const typographyOptions = computed(() => contentFontSettings.options.value ?? []);
const typographyErrorMessage = computed(() => contentFontSettings.error.value);
const isTypographyPending = computed(
    () => contentFontSettings.loading.value || contentFontSettings.applying.value,
);
const isFontBrowserOpen = computed(() => fontBrowserTarget.value !== null);

const hasTypographyDraftChanges = computed(() => {
    const settings = contentFontSettings.settings.value;
    if (!settings) {
        return false;
    }
    return (
        settings.sansFamily !== sansFamilyDraft.value ||
        settings.displayFamily !== displayFamilyDraft.value ||
        !hasSameStrings(sortStrings(settings.styles), sortStrings(styleDraft.value)) ||
        !hasSameNumbers(sortNumbers(settings.weights), sortNumbers(weightDraft.value)) ||
        !hasSameStrings(sortStrings(settings.widths), sortStrings(widthDraft.value))
    );
});

const typographyStatusLabel = computed(() => {
    const settings = contentFontSettings.settings.value;
    if (!settings) {
        return "Not loaded";
    }

    if (settings.status === "failed") {
        return "Last apply failed";
    }

    if (settings.lastAppliedAt) {
        return `Applied ${new Date(settings.lastAppliedAt).toLocaleString()}`;
    }

    return "Not applied yet";
});

const typographyFamilyLabel = (slug: string) => {
    const match = typographyOptions.value.find((option) => option.slug === slug);
    return match?.label ?? slug;
};

const typographyFamilyWithFallback = (value: string, fallback: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
};

const previewStyles = computed(() => {
    const settings = contentFontSettings.settings.value;
    return styleDraft.value.length > 0
        ? styleDraft.value
        : (settings?.styles ?? ["normal"]);
});

const previewWeights = computed(() => {
    const settings = contentFontSettings.settings.value;
    return weightDraft.value.length > 0
        ? weightDraft.value
        : (settings?.weights ?? [300, 400, 700]);
});

const buildBunnyPreviewCssHref = (familySlug: string, styles: Array<"normal" | "italic">, weights: number[]) => {
    const styleSet = new Set(styles);
    const variants: string[] = [];

    for (const weight of weights) {
        if (styleSet.has("normal")) {
            variants.push(String(weight));
        }
        if (styleSet.has("italic")) {
            variants.push(`${weight}i`);
        }
    }

    if (variants.length === 0) {
        variants.push("400");
    }

    return `https://fonts.bunny.net/css?family=${encodeURIComponent(`${familySlug}:${variants}`)}`;
};

const typographySummaryLabel = computed(() => {
    if (!isTypographyFeatureEnabled.value) {
        return "Disabled";
    }

    const settings = contentFontSettings.settings.value;
    if (!settings) {
        return "Sans: - · Display: -";
    }
    return `Sans: ${typographyFamilyLabel(settings.sansFamily)} · Display: ${typographyFamilyLabel(settings.displayFamily)}`;
});

const previewSansFamilySlug = computed(() => {
    const settings = contentFontSettings.settings.value;
    const fallback = settings?.sansFamily ?? "";
    return typographyFamilyWithFallback(sansFamilyDraft.value, fallback);
});

const previewDisplayFamilySlug = computed(() => {
    const settings = contentFontSettings.settings.value;
    const fallback = settings?.displayFamily ?? "";
    return typographyFamilyWithFallback(displayFamilyDraft.value, fallback);
});

const previewTypographyStyle = computed(() => {
    const sansLabel = typographyFamilyLabel(previewSansFamilySlug.value);
    const displayLabel = typographyFamilyLabel(previewDisplayFamilySlug.value);

    return {
        "--font-sans": `'${sansLabel}', sans-serif`,
        "--font-display": `'${displayLabel}', serif`,
        fontFamily: "var(--font-sans)",
    } as Record<string, string>;
});

const previewFontCssLinks = computed(() => {
    if (!isTypographyFeatureEnabled.value) {
        return [];
    }

    const uniqueFamilies = new Set([
        previewSansFamilySlug.value,
        previewDisplayFamilySlug.value,
    ]);
    const links: Array<{ id: string; rel: "stylesheet"; href: string }> = [];

    for (const familySlug of uniqueFamilies) {
        if (!familySlug) {
            continue;
        }
        links.push({
            id: `builder-preview-font-${familySlug}`,
            rel: "stylesheet",
            href: buildBunnyPreviewCssHref(
                familySlug,
                previewStyles.value,
                previewWeights.value,
            ),
        });
    }

    return links;
});

useHead(() => ({
    link: previewFontCssLinks.value,
}));

const isPreviewFontLoading = ref(false);
let previewFontLoadToken = 0;

const waitForPreviewFonts = async () => {
    if (!isTypographyFeatureEnabled.value) {
        isPreviewFontLoading.value = false;
        return;
    }

    if (!import.meta.client) {
        return;
    }

    const sansSlug = previewSansFamilySlug.value;
    const displaySlug = previewDisplayFamilySlug.value;
    if (!sansSlug && !displaySlug) {
        isPreviewFontLoading.value = false;
        return;
    }

    const sansLabel = typographyFamilyLabel(sansSlug);
    const displayLabel = typographyFamilyLabel(displaySlug);
    const token = ++previewFontLoadToken;
    isPreviewFontLoading.value = true;

    const loadJobs: Array<Promise<FontFace[]>> = [];
    const selectedStyles = previewStyles.value.length > 0 ? previewStyles.value : ["normal"];
    const selectedWeights = previewWeights.value.length > 0 ? previewWeights.value : [400];
    const buildFontLoadValue = (style: "normal" | "italic", weight: number, label: string) =>
        `${style} ${weight} 1rem "${label}"`;

    if (sansSlug) {
        for (const style of selectedStyles) {
            for (const weight of selectedWeights) {
                loadJobs.push(document.fonts.load(buildFontLoadValue(style, weight, sansLabel)));
            }
        }
    }
    if (displaySlug) {
        for (const style of selectedStyles) {
            for (const weight of selectedWeights) {
                loadJobs.push(document.fonts.load(buildFontLoadValue(style, weight, displayLabel)));
            }
        }
    }

    try {
        await Promise.all(loadJobs);
        await document.fonts.ready;
    } catch {
    } finally {
        if (token === previewFontLoadToken) {
            isPreviewFontLoading.value = false;
        }
    }
};

watch(
    () => [
        previewSansFamilySlug.value,
        previewDisplayFamilySlug.value,
        previewStyles.value.join(","),
        previewWeights.value.join(","),
    ],
    () => {
        if (!isTypographyFeatureEnabled.value) {
            return;
        }

        void waitForPreviewFonts();
        emit("font-preview-change", {
            sansFamily: typographyFamilyLabel(previewSansFamilySlug.value),
            displayFamily: typographyFamilyLabel(previewDisplayFamilySlug.value),
            cssHrefs: previewFontCssLinks.value.map((entry) => entry.href),
        });
    },
    { immediate: true },
);

const toggleTypographyPanel = () => {
    if (!isTypographyFeatureEnabled.value) {
        return;
    }
    isTypographyPanelExpanded.value = !isTypographyPanelExpanded.value;
};

const openFontBrowser = async (target: "sans" | "display") => {
    fontBrowserTarget.value = target;
    typographyNotice.value = null;

    if (contentFontSettings.catalog.value.length === 0) {
        await contentFontSettings.fetchCatalog();
    }
};

const closeFontBrowser = () => {
    fontBrowserTarget.value = null;
    installingFontSlug.value = null;
};

const handleTypographyFamilyChange = (
    target: "sans" | "display",
    event: Event,
) => {
    const value = event.target instanceof HTMLSelectElement
        ? event.target.value
        : "";

    if (value === ADD_FONT_OPTION_VALUE) {
        void openFontBrowser(target);
        return;
    }

    if (target === "sans") {
        sansFamilyDraft.value = value;
    } else {
        displayFamilyDraft.value = value;
    }
};

const installFontFromBrowser = async (font: BunnyFontCatalogEntry) => {
    if (!fontBrowserTarget.value) {
        return;
    }

    installingFontSlug.value = font.slug;
    typographyNotice.value = null;

    try {
        await contentFontSettings.installFamily({
            family: font.slug,
            styles: previewStyles.value,
            weights: previewWeights.value,
            widths: widthDraft.value.length > 0
                ? [...widthDraft.value]
                : (contentFontSettings.settings.value?.widths ?? ["100%"]),
        });

        if (fontBrowserTarget.value === "sans") {
            sansFamilyDraft.value = font.slug;
        } else {
            displayFamilyDraft.value = font.slug;
        }

        typographyNotice.value = `${font.label} installed. Apply fonts to publish it.`;
        closeFontBrowser();
    } finally {
        installingFontSlug.value = null;
    }
};

const syncTypographyDraft = () => {
    const settings = contentFontSettings.settings.value;
    if (!settings) {
        return;
    }
    sansFamilyDraft.value = settings.sansFamily;
    displayFamilyDraft.value = settings.displayFamily;
    styleDraft.value = [...settings.styles];
    weightDraft.value = [...settings.weights];
    widthDraft.value = [...settings.widths];
};

const resetTypographyDraft = () => {
    syncTypographyDraft();
    typographyNotice.value = null;
};

const applyTypographySelection = async () => {
    if (!isTypographyFeatureEnabled.value) {
        return;
    }

    if (
        !sansFamilyDraft.value ||
        !displayFamilyDraft.value ||
        styleDraft.value.length === 0 ||
        weightDraft.value.length === 0 ||
        widthDraft.value.length === 0
    ) {
        return;
    }

    typographyNotice.value = null;
    isTypographyApplying.value = true;
    try {
        await contentFontSettings.saveAdmin({
            sansFamily: sansFamilyDraft.value,
            displayFamily: displayFamilyDraft.value,
            styles: [...styleDraft.value],
            weights: [...weightDraft.value],
            widths: [...widthDraft.value],
        });
        await contentFontSettings.applyAdmin();
        contentFontSettings.bumpRuntimeStylesheet();
        syncTypographyDraft();
        typographyNotice.value = "Fonts applied.";
    } finally {
        isTypographyApplying.value = false;
    }
};

watch(
    () => contentFontSettings.settings.value,
    () => {
        syncTypographyDraft();
    },
    { immediate: true },
);

const THEME_MODES = [
    { label: "Simple", value: "simple" as const },
    { label: "Full", value: "full" as const },
];

const themeModeDraft = ref<"simple" | "full">("simple");
const isThemePanelExpanded = ref(false);
const themeDraft = ref<Record<string, string>>({});
const themeNotice = ref<string | null>(null);

const themeSettings = computed(() => contentThemeSettings.settings.value);
const themeSchema = computed(() => contentThemeSettings.schema.value);
const themeErrorMessage = computed(() => contentThemeSettings.error.value);
const isThemePending = computed(
    () => contentThemeSettings.loading.value || contentThemeSettings.applying.value,
);

const editableThemeTokenKeys = computed(
    () => new Set(themeSchema.value?.fullEditableTokenKeys ?? []),
);
const simpleThemeTokenKeys = computed(() => themeSchema.value?.simpleTokenKeys ?? []);
const readOnlyThemeTokenKeys = computed(
    () => new Set(themeSchema.value?.readOnlyTokenKeys ?? []),
);

const themeTokenDefinitionsByKey = computed(() => {
    const map = new Map<
        string,
        {
            key: string;
            label: string;
            namespace: string;
            valueType: "color" | "length" | "number" | "string";
            simpleEditable: boolean;
            runtimeWritable: boolean;
            owner: "theme" | "fonts";
            description: string;
        }
    >();

    for (const token of themeSchema.value?.tokens ?? []) {
        map.set(token.key, token);
    }

    return map;
});

const getThemeTokenValue = (key: string) => {
    if (typeof themeDraft.value[key] === "string") {
        return themeDraft.value[key];
    }
    return themeSettings.value?.draftTokens?.[key] ?? "";
};

const updateThemeTokenValue = (key: string, value: string) => {
    themeDraft.value = {
        ...themeDraft.value,
        [key]: value,
    };
    themeNotice.value = null;
};

const isThemeTokenReadOnly = (key: string) =>
    !editableThemeTokenKeys.value.has(key) || readOnlyThemeTokenKeys.value.has(key);

const themeSimpleTokenDefinitions = computed(() =>
    simpleThemeTokenKeys.value
        .map((key) => themeTokenDefinitionsByKey.value.get(key))
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
);

const themeNamespaceSections = computed(() => {
    const namespaces = themeSchema.value?.namespaces ?? [];
    const tokens = themeSchema.value?.tokens ?? [];

    return namespaces.map((namespace) => ({
        ...namespace,
        tokens: tokens.filter((token) => token.namespace === namespace.key),
    }));
});

const createComparableThemeTokenMap = (source: Record<string, string> | null | undefined) => {
    const result: Record<string, string> = {};
    const keys = Array.from(editableThemeTokenKeys.value.values()).sort((left, right) =>
        left.localeCompare(right),
    );

    for (const key of keys) {
        const raw = source?.[key];
        if (typeof raw !== "string") {
            continue;
        }
        const normalized = raw.trim();
        if (!normalized) {
            continue;
        }
        result[key] = normalized;
    }

    return result;
};

const hasThemeDraftChanges = computed(() => {
    const settings = themeSettings.value;
    if (!settings) {
        return false;
    }

    const original = createComparableThemeTokenMap(settings.draftTokens);
    const draft = createComparableThemeTokenMap(themeDraft.value);
    return JSON.stringify(original) !== JSON.stringify(draft);
});

const themeStatusLabel = computed(() => {
    const settings = themeSettings.value;
    if (!settings) {
        return "Not loaded";
    }

    if (settings.status === "failed") {
        return "Last apply failed";
    }

    if (settings.lastAppliedAt) {
        return `Applied ${new Date(settings.lastAppliedAt).toLocaleString()}`;
    }

    return "Not applied yet";
});

const themeSummaryLabel = computed(() => {
    if (!isThemeFeatureEnabled.value) {
        return "Disabled";
    }

    const primary = getThemeTokenValue("--color-primary") || "-";
    const secondary = getThemeTokenValue("--color-secondary") || "-";
    return `Primary: ${primary} · Secondary: ${secondary}`;
});

const syncThemeDraft = () => {
    const settings = themeSettings.value;
    if (!settings) {
        return;
    }

    const nextDraft: Record<string, string> = {};
    for (const key of editableThemeTokenKeys.value) {
        const value = settings.draftTokens?.[key];
        if (typeof value === "string" && value.trim().length > 0) {
            nextDraft[key] = value;
        }
    }

    themeDraft.value = nextDraft;
};

const resetThemeDraft = () => {
    syncThemeDraft();
    themeNotice.value = null;
};

const saveThemeDraft = async () => {
    if (!isThemeFeatureEnabled.value) {
        return;
    }

    if (!themeSettings.value) {
        return;
    }
    themeNotice.value = null;

    const payload: Record<string, string> = {};
    for (const key of editableThemeTokenKeys.value) {
        const raw = getThemeTokenValue(key);
        const normalized = typeof raw === "string" ? raw.trim() : "";
        if (!normalized) {
            continue;
        }
        payload[key] = normalized;
    }

    await contentThemeSettings.saveAdmin({
        draftTokens: payload,
    });
    syncThemeDraft();
    themeNotice.value = "Theme draft saved.";
};

const applyThemeDraft = async () => {
    if (!isThemeFeatureEnabled.value) {
        return;
    }

    if (!themeSettings.value || hasThemeDraftChanges.value) {
        return;
    }
    themeNotice.value = null;
    await contentThemeSettings.applyAdmin();
    contentThemeSettings.bumpRuntimeStylesheet();
    syncThemeDraft();
    themeNotice.value = "Theme applied.";
};

const toggleThemePanel = () => {
    if (!isThemeFeatureEnabled.value) {
        return;
    }
    isThemePanelExpanded.value = !isThemePanelExpanded.value;
};

const previewThemeTokens = computed(() => {
    if (!isThemeFeatureEnabled.value) {
        return {};
    }

    const tokens: Record<string, string> = {};
    for (const key of editableThemeTokenKeys.value) {
        const value = getThemeTokenValue(key).trim();
        if (!value) {
            continue;
        }
        tokens[key] = value;
    }
    return tokens;
});

watch(
    () => previewThemeTokens.value,
    (value) => {
        if (!isThemeFeatureEnabled.value) {
            return;
        }

        emit("theme-preview-change", {
            tokens: { ...value },
        });
    },
    { deep: true, immediate: true },
);

watch(
    () => themeSettings.value,
    () => {
        syncThemeDraft();
    },
    { immediate: true },
);

const serializedJson = computed(() =>
    JSON.stringify(serializedDocument.value, null, 2),
);

const getSerializedDocument = (): MinimalContentDocument => {
    if (typeof structuredClone === "function") {
        try {
            return structuredClone(serializedDocument.value);
        } catch {}
    }

    return JSON.parse(
        JSON.stringify(serializedDocument.value),
    ) as MinimalContentDocument;
};

const loadDocument = (doc: MinimalContentDocument | null) => {
    const cloned = cloneDocument(doc);
    applyDocument(cloned);
};

defineExpose({
    getSerializedDocument,
    loadDocument,
    focusNodeProp,
});

const importInputRef = ref<HTMLInputElement | null>(null);

const handleLoadDebugClick = () => {
    importInputRef.value?.click();
};

const handleDebugFile = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) {
        return;
    }
    try {
        const text = await file.text();
        const parsed = JSON.parse(text) as MinimalContentDocument;
        const cloned = cloneDocument(parsed);
        applyDocument(cloned);
    } catch (error) {
        console.error("Failed to load debug data", error);
    } finally {
        target.value = "";
    }
};

const getDocumentBlob = () =>
    new Blob([JSON.stringify(serializedDocument.value, null, 2)], {
        type: "application/json;charset=utf-8",
    });

const makeDebugFilename = () => {
    const rawId = serializedDocument.value.id || "builder-debug";
    const sanitized = rawId
        .toString()
        .replace(/[^a-z0-9-_]/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    const base = sanitized || "builder-debug";
    return `${base}.json`;
};

const handleSaveDebugClick = () => {
    const blob = getDocumentBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = makeDebugFilename();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
</script>

<template>
    <div class="builder-page">
        <section v-if="!focusedEditSession" class="builder-controls">
            <div v-if="isTypographyFeatureEnabled" class="builder-typography-toggle">
                <button
                    type="button"
                    class="builder-typography-toggle__button"
                    :aria-expanded="isTypographyPanelExpanded"
                    @click="toggleTypographyPanel"
                >
                    {{
                        isTypographyPanelExpanded
                            ? "Hide Typography"
                            : "Typography"
                    }}
                </button>
                <span class="builder-typography-toggle__summary">
                    {{ typographySummaryLabel }}
                </span>
            </div>

            <div
                v-if="isTypographyFeatureEnabled && isTypographyPanelExpanded"
                class="builder-typography-card"
            >
                <div class="builder-typography-card__header">
                    <h3>Typography</h3>
                    <span>{{ typographyStatusLabel }}</span>
                </div>
                <div class="builder-typography-card__grid">
                    <label>
                        <span>Sans family</span>
                        <select
                            :value="sansFamilyDraft"
                            :disabled="isTypographyPending"
                            @change="handleTypographyFamilyChange('sans', $event)"
                        >
                            <option
                                v-for="option in typographyOptions"
                                :key="`sans-${option.slug}`"
                                :value="option.slug"
                            >
                                {{ option.label }}
                            </option>
                            <option :value="ADD_FONT_OPTION_VALUE">
                                Add new...
                            </option>
                        </select>
                    </label>
                    <label>
                        <span>Serif family</span>
                        <select
                            :value="displayFamilyDraft"
                            :disabled="isTypographyPending"
                            @change="handleTypographyFamilyChange('display', $event)"
                        >
                            <option
                                v-for="option in typographyOptions"
                                :key="`display-${option.slug}`"
                                :value="option.slug"
                            >
                                {{ option.label }}
                            </option>
                            <option :value="ADD_FONT_OPTION_VALUE">
                                Add new...
                            </option>
                        </select>
                    </label>
                </div>
                <div class="builder-typography-card__profiles">
                    <fieldset class="builder-typography-card__fieldset">
                        <legend>Styles</legend>
                        <label
                            v-for="option in TYPOGRAPHY_STYLE_OPTIONS"
                            :key="`style-${option.value}`"
                            class="builder-typography-card__choice"
                        >
                            <input
                                v-model="styleDraft"
                                type="checkbox"
                                :value="option.value"
                                :disabled="isTypographyPending"
                            />
                            <span>{{ option.label }}</span>
                        </label>
                    </fieldset>
                    <fieldset class="builder-typography-card__fieldset">
                        <legend>Weights</legend>
                        <label
                            v-for="weight in TYPOGRAPHY_WEIGHT_OPTIONS"
                            :key="`weight-${weight}`"
                            class="builder-typography-card__choice"
                        >
                            <input
                                v-model="weightDraft"
                                type="checkbox"
                                :value="weight"
                                :disabled="isTypographyPending"
                            />
                            <span>{{ weight }}</span>
                        </label>
                    </fieldset>
                    <fieldset class="builder-typography-card__fieldset">
                        <legend>Widths</legend>
                        <label
                            v-for="option in TYPOGRAPHY_WIDTH_OPTIONS"
                            :key="`width-${option.value}`"
                            class="builder-typography-card__choice"
                        >
                            <input
                                v-model="widthDraft"
                                type="checkbox"
                                :value="option.value"
                                :disabled="isTypographyPending"
                            />
                            <span>{{ option.label }}</span>
                        </label>
                        <p class="builder-typography-card__hint">
                            Only widths exposed by Bunny for the selected family will be materialized.
                        </p>
                    </fieldset>
                </div>
                <p v-if="typographyErrorMessage" class="builder-typography-card__error">
                    {{ typographyErrorMessage }}
                </p>
                <p v-else-if="typographyNotice" class="builder-typography-card__notice">
                    {{ typographyNotice }}
                </p>
                <div class="builder-typography-card__actions">
                    <button
                        type="button"
                        class="builder-typography-card__cancel"
                        :disabled="isTypographyPending || !hasTypographyDraftChanges"
                        @click="resetTypographyDraft"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        class="builder-typography-card__apply"
                        :disabled="isTypographyPending || !sansFamilyDraft || !displayFamilyDraft || styleDraft.length === 0 || weightDraft.length === 0 || widthDraft.length === 0"
                        @click="applyTypographySelection"
                    >
                        {{
                            isTypographyApplying
                                ? "Applying…"
                                : "Apply Fonts"
                        }}
                    </button>
                </div>
            </div>

            <FontBrowserDialog
                :is-open="isFontBrowserOpen"
                :fonts="contentFontSettings.catalog.value"
                :loading="contentFontSettings.catalogLoading.value"
                :installing="isTypographyPending"
                :installing-slug="installingFontSlug"
                @close="closeFontBrowser"
                @install="installFontFromBrowser"
            />

            <div v-if="isThemeFeatureEnabled" class="builder-theme-toggle">
                <button
                    type="button"
                    class="builder-theme-toggle__button"
                    :aria-expanded="isThemePanelExpanded"
                    @click="toggleThemePanel"
                >
                    {{
                        isThemePanelExpanded
                            ? "Hide Theme"
                            : "Theme"
                    }}
                </button>
                <span class="builder-theme-toggle__summary">
                    {{ themeSummaryLabel }}
                </span>
            </div>

            <div
                v-if="isThemeFeatureEnabled && isThemePanelExpanded"
                class="builder-theme-card"
            >
                <div class="builder-theme-card__header">
                    <h3>Theme</h3>
                    <span>{{ themeStatusLabel }}</span>
                </div>

                <div class="builder-theme-card__mode">
                    <button
                        v-for="mode in THEME_MODES"
                        :key="`theme-mode-${mode.value}`"
                        type="button"
                        class="builder-theme-card__mode-btn"
                        :class="{ 'builder-theme-card__mode-btn--active': themeModeDraft === mode.value }"
                        :disabled="isThemePending"
                        @click="themeModeDraft = mode.value"
                    >
                        {{ mode.label }}
                    </button>
                </div>

                <div v-if="themeModeDraft === 'simple'" class="builder-theme-card__simple">
                    <label
                        v-for="token in themeSimpleTokenDefinitions"
                        :key="`theme-simple-${token.key}`"
                    >
                        <span>{{ token.label }}</span>
                        <input
                            type="text"
                            :value="getThemeTokenValue(token.key)"
                            :disabled="isThemePending || isThemeTokenReadOnly(token.key)"
                            @input="
                                (event: Event) =>
                                    updateThemeTokenValue(
                                        token.key,
                                        (event.target as HTMLInputElement).value,
                                    )
                            "
                        />
                    </label>
                </div>

                <div v-else class="builder-theme-card__full">
                    <section
                        v-for="namespace in themeNamespaceSections"
                        :key="`theme-namespace-${namespace.key}`"
                        class="builder-theme-card__namespace"
                    >
                        <header class="builder-theme-card__namespace-header">
                            <div>
                                <h4>{{ namespace.label }}</h4>
                                <p>{{ namespace.description }}</p>
                            </div>
                            <span
                                v-if="namespace.compileTimeOnly"
                                class="builder-theme-card__namespace-badge"
                            >
                                Read-only (compile-time)
                            </span>
                        </header>

                        <p
                            v-if="namespace.tokens.length === 0"
                            class="builder-theme-card__namespace-empty"
                        >
                            No project keys configured for this namespace yet.
                        </p>

                        <div v-else class="builder-theme-card__namespace-grid">
                            <label
                                v-for="token in namespace.tokens"
                                :key="`theme-token-${token.key}`"
                            >
                                <span>
                                    {{ token.label }}
                                    <em v-if="isThemeTokenReadOnly(token.key)"> · read-only</em>
                                </span>
                                <input
                                    type="text"
                                    :value="getThemeTokenValue(token.key)"
                                    :disabled="isThemePending || isThemeTokenReadOnly(token.key)"
                                    @input="
                                        (event: Event) =>
                                            updateThemeTokenValue(
                                                token.key,
                                                (event.target as HTMLInputElement).value,
                                            )
                                    "
                                />
                            </label>
                        </div>
                    </section>
                </div>

                <p v-if="themeErrorMessage" class="builder-theme-card__error">
                    {{ themeErrorMessage }}
                </p>
                <p v-else-if="themeNotice" class="builder-theme-card__notice">
                    {{ themeNotice }}
                </p>

                <div class="builder-theme-card__actions">
                    <button
                        type="button"
                        class="builder-theme-card__cancel"
                        :disabled="isThemePending || !themeSettings || !hasThemeDraftChanges"
                        @click="resetThemeDraft"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        class="builder-theme-card__save"
                        :disabled="isThemePending || !themeSettings || !hasThemeDraftChanges"
                        @click="saveThemeDraft"
                    >
                        Save Draft
                    </button>
                    <button
                        type="button"
                        class="builder-theme-card__apply"
                        :disabled="isThemePending || !themeSettings || hasThemeDraftChanges"
                        @click="applyThemeDraft"
                    >
                        Apply Theme
                    </button>
                </div>
            </div>

            <button
                v-if="!isSeoCardExpanded"
                type="button"
                class="builder-seo-card"
                :class="{ 'builder-seo-card--dirty': hasSeoDraftChanges }"
                @click="openSeoCardEditor"
            >
                <div class="builder-seo-card__content">
                    <div class="builder-seo-card__main">
                        <div class="builder-seo-card__eyebrow">SEO</div>
                        <div class="builder-seo-card__title">
                            {{ pageConfig.seoTitle || "SEO title" }}
                        </div>
                        <div class="builder-seo-card__description">
                            {{
                                pageConfig.seoDescription ||
                                "SEO description is empty."
                            }}
                        </div>
                        <div class="builder-seo-card__meta">
                            <span>Path: {{ pageConfig.path || "/" }}</span>
                            <span>
                                Internal: {{ pageConfig.title || "Page title" }}
                            </span>
                        </div>
                    </div>
                    <div class="builder-seo-card__preview">
                        <div class="builder-seo-card__preview-label">
                            Social preview
                        </div>
                        <img
                            v-if="pageConfig.seoImage"
                            :src="pageConfig.seoImage"
                            alt="Social preview"
                            class="builder-seo-card__preview-image"
                        />
                        <div
                            v-else
                            class="builder-seo-card__preview-placeholder"
                        >
                            No image
                        </div>
                    </div>
                </div>
            </button>

            <div v-else class="builder-config">
                <label>
                    <span>Page path</span>
                    <input v-model="seoDraft.path" type="text" placeholder="/" />
                </label>
                <label>
                    <span>Page title (internal)</span>
                    <input
                        v-model="seoDraft.title"
                        type="text"
                        placeholder="Page title"
                    />
                </label>
                <label class="builder-config__full">
                    <span class="builder-config__label-row">
                        <span>SEO title</span>
                        <span class="builder-config__translate-actions">
                            <input
                                type="checkbox"
                                class="builder-config__translate-checkbox"
                                :checked="isTranslationPointerSelected(SEO_TITLE_POINTER)"
                                aria-label="Select SEO title for batch translation"
                                @change="
                                    (event: Event) =>
                                        setTranslationPointerSelection(
                                            SEO_TITLE_POINTER,
                                            (event.target as HTMLInputElement).checked,
                                        )
                                "
                            />
                            <button
                                type="button"
                                class="builder-config__translate-btn"
                                @click="handleTranslateSeoField('title')"
                            >
                                Translate
                            </button>
                        </span>
                    </span>
                    <input
                        v-model="seoDraft.seoTitle"
                        type="text"
                        placeholder="SEO title"
                    />
                </label>
                <label class="builder-config__textarea builder-config__full">
                    <span class="builder-config__label-row">
                        <span>SEO description</span>
                        <span class="builder-config__translate-actions">
                            <input
                                type="checkbox"
                                class="builder-config__translate-checkbox"
                                :checked="
                                    isTranslationPointerSelected(
                                        SEO_DESCRIPTION_POINTER,
                                    )
                                "
                                aria-label="Select SEO description for batch translation"
                                @change="
                                    (event: Event) =>
                                        setTranslationPointerSelection(
                                            SEO_DESCRIPTION_POINTER,
                                            (event.target as HTMLInputElement).checked,
                                        )
                                "
                            />
                            <button
                                type="button"
                                class="builder-config__translate-btn"
                                @click="handleTranslateSeoField('description')"
                            >
                                Translate
                            </button>
                        </span>
                    </span>
                    <textarea
                        v-model="seoDraft.seoDescription"
                        rows="2"
                        placeholder="SEO description."
                    />
                </label>
                <div class="builder-config__image">
                    <div class="builder-config__image-label">
                        <span>Social preview image</span>
                        <small>Absolute URL for og:image / twitter:image</small>
                    </div>
                    <ContentImageField
                        :prop-definition="socialImagePropDefinition"
                        :model-value="seoDraft.seoImage || ''"
                        @update:model-value="
                            (value) => (seoDraft.seoImage = value ?? '')
                        "
                    />
                </div>
                <label
                    v-if="isAssistiveSectionSnapToggleEnabled"
                    class="builder-config__checkbox builder-config__full"
                >
                    <input
                        v-model="seoDraft.assistiveSectionSnap"
                        type="checkbox"
                    />
                    <span>Assistive section snap on homepage (desktop only)</span>
                </label>
                <div class="builder-config__actions">
                    <button
                        type="button"
                        class="builder-config__cancel"
                        @click="cancelSeoDraft"
                    >
                        Cancel
                    </button>
                    <button type="button" class="builder-config__ok" @click="applySeoDraft">
                        OK
                    </button>
                </div>
            </div>
            <!-- <div class="builder-derived">
                <div>
                    <span>Computed ID</span>
                    <code>{{ serializedDocument.id }}</code>
                </div>
                <div>
                    <span>Stem</span>
                    <code>{{ serializedDocument.stem }}</code>
                </div>
            </div> -->

            <!-- <div class="builder-layout">
                <label>
                    <span>Spacing preset (dummy for now)</span>
                    <select v-model="layout.spacing">
                        <option
                            v-for="preset in spacingPresets"
                            :key="preset.id"
                            :value="preset.id"
                        >
                            {{ preset.label }}
                        </option>
                    </select>
                </label>
            </div> -->
        </section>

        <Transition name="builder-focused-editor" mode="out-in">
        <section
            v-if="focusedEditSession"
            key="focused-editor"
            class="builder-focused-editor"
        >
            <div class="builder-focused-editor__stage">
                <div class="builder-focused-editor__card">
                    <header class="builder-focused-editor__header">
                        <div>
                            <span class="builder-focused-editor__eyebrow">
                                Focused edit
                            </span>
                            <h3>
                                {{ focusedEditDisplayTitle }}
                            </h3>
                        </div>
                        <button
                            type="button"
                            class="builder-focused-editor__close"
                            :disabled="isFocusedEditSaving"
                            aria-label="Cancel focused edit"
                            @click="cancelFocusedEditSession"
                        >
                            ×
                        </button>
                    </header>

                    <NodeEditor
                        v-if="focusedEditNode"
                        :node="focusedEditNode"
                        :registry="runtimeRegistry"
                        :component-options="componentOptions"
                        :global-alias-ids="globalAliasIdList"
                        :show-translate-section="showTranslateSection"
                        :focus-request="focusedEditFocusRequest"
                        :search-query="normalizedSearchQuery"
                        isolate-layout
                        :focused-prop-display="focusedPropDisplay"
                        :on-update-prop="updateNodeProp"
                        :on-update-text="updateTextNode"
                        :on-add-child-component="addChildComponent"
                        :on-add-child-text="addChildText"
                        :on-remove="removeNode"
                        :on-clone="cloneNode"
                        :on-create-global-alias="openGlobalAliasModal"
                        :on-toggle-expanded="handleRootExpansion"
                        :on-focus-node="handleNodeFocus"
                        :on-translate-field="handleTranslateField"
                        :on-translate-section="handleTranslateSection"
                        :on-toggle-translate-field-selection="
                            handleToggleTranslateFieldSelection
                        "
                        :is-translate-field-selected="isTranslateFieldSelected"
                        :section-name="getLocalSectionName(focusedEditNode.uid)"
                        :on-save-section-name="saveLocalSectionName"
                    />
                    <div v-else class="builder-focused-editor__missing">
                        The selected field is no longer available.
                    </div>
                </div>
            </div>

            <footer class="builder-focused-editor__bar">
                <div class="builder-focused-editor__visibility">
                    <label class="builder-focused-editor__toggle">
                        <input
                            v-model="focusedShowFieldsAround"
                            type="checkbox"
                            :disabled="focusedShowAllFields || isFocusedEditSaving"
                        />
                        <span>Show fields around</span>
                    </label>
                    <label class="builder-focused-editor__toggle">
                        <input
                            v-model="focusedShowAllFields"
                            type="checkbox"
                            :disabled="isFocusedEditSaving"
                        />
                        <span>Show all fields in section</span>
                    </label>
                </div>
                <div class="builder-focused-editor__actions">
                    <button
                        type="button"
                        class="builder-focused-editor__cancel"
                        :disabled="isFocusedEditSaving"
                        @click="cancelFocusedEditSession"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        class="builder-focused-editor__save"
                        :disabled="isFocusedEditSaving"
                        @click="confirmFocusedEditSession"
                    >
                        {{ isFocusedEditSaving ? "Saving..." : "OK" }}
                    </button>
                </div>
            </footer>
        </section>

        <section v-else key="tree" class="builder-tree">
            <div class="builder-tree__controls">
                <div class="builder-add">
                    <button type="button" @click="openRootPicker()">
                        + Section
                    </button>
                    <ComponentPickerDialog
                        :is-open="isRootPickerOpen"
                        :component-options="componentOptions"
                        @close="closeRootPicker"
                        @select="handleRootComponentPicked"
                        @delete-global-component="deleteGlobalComponent"
                    />
                    <input
                        ref="importInputRef"
                        type="file"
                        accept="application/json"
                        hidden
                        data-test="debug-import"
                        @change="handleDebugFile"
                    />
                </div>
            </div>
            <p v-if="!builderTree.length" class="builder-empty">
                No components added yet.
            </p>
            <div
                v-for="node in filteredBuilderTree"
                :key="node.uid"
                class="builder-root-item"
                :draggable="!isRootExpanded(node.uid)"
                :data-dragging="draggingUid === node.uid"
                :data-drag-over="dragOverUid === node.uid"
                :data-expanded="isRootExpanded(node.uid)"
                @dragstart="handleDragStart(node.uid)"
                @dragend="handleDragEnd"
                @dragover.prevent="handleDragOver(node.uid)"
                @drop.prevent="handleDrop(node.uid)"
            >
                <div class="builder-root-item__handle" aria-hidden="true">
                    ⇅
                </div>
                <NodeEditor
                    :node="node"
                    :registry="runtimeRegistry"
                    :component-options="componentOptions"
                    :global-alias-ids="globalAliasIdList"
                    :show-translate-section="showTranslateSection"
                    :focus-request="nodePropFocusRequest"
                    :search-query="normalizedSearchQuery"
                    :on-update-prop="updateNodeProp"
                    :on-update-text="updateTextNode"
                    :on-add-child-component="addChildComponent"
                    :on-add-child-text="addChildText"
                    :on-remove="removeNode"
                    :on-clone="cloneNode"
                    :on-create-global-alias="openGlobalAliasModal"
                    :on-toggle-expanded="handleRootExpansion"
                    :on-focus-node="handleNodeFocus"
                    :on-translate-field="handleTranslateField"
                    :on-translate-section="handleTranslateSection"
                    :on-toggle-translate-field-selection="
                        handleToggleTranslateFieldSelection
                    "
                    :is-translate-field-selected="isTranslateFieldSelected"
                    :section-name="getLocalSectionName(node.uid)"
                    :on-save-section-name="saveLocalSectionName"
                />
                <button
                    type="button"
                    class="builder-root-item__insert"
                    aria-label="Insert new section here"
                    title="Insert new section here"
                    @click="openRootPicker(getRootInsertIndexAfter(node.uid))"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 16 16">
                    <path fill="currentColor" fill-rule="evenodd" d="M8.47 8.53L9 8l-.53-.53l-2.25-2.25a.75.75 0 0 0-1.06 1.06l.969.97h-3.38A1.25 1.25 0 0 1 1.5 6V1.75a.75.75 0 0 0-1.5 0V6a2.75 2.75 0 0 0 2.75 2.75h3.38l-.97.97a.75.75 0 1 0 1.061 1.06zM7 12.5a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 7 12.5m.75-9.75a.75.75 0 1 0 0 1.5h7.5a.75.75 0 0 0 0-1.5z" clip-rule="evenodd" stroke-width="0.5" stroke="currentColor" />
                  </svg>
                </button>
            </div>
            <div
                v-if="isSectionNamePromptOpen"
                class="builder-section-name-modal-backdrop"
                @click.self="cancelRootComponentSelection"
            >
                <form
                    class="builder-section-name-modal"
                    @submit.prevent="confirmRootComponentWithName"
                >
                    <h3>Section Name</h3>
                    <p>{{ pendingSelectedComponentLabel }}</p>
                    <input
                        ref="sectionNamePromptInputRef"
                        v-model="pendingSectionNameDraft"
                        type="text"
                        placeholder="Enter a section name"
                        autocomplete="off"
                    />
                    <div class="builder-section-name-modal__actions">
                        <button
                            type="button"
                            class="builder-section-name-modal__cancel"
                            @click="cancelRootComponentSelection"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="builder-section-name-modal__confirm"
                            :disabled="!pendingSectionNameDraft.trim()"
                        >
                            Add Section
                        </button>
                    </div>
                </form>
            </div>
            <div
                v-if="isGlobalAliasModalOpen"
                class="builder-section-name-modal-backdrop"
                @click.self="closeGlobalAliasModal"
            >
                <form
                    class="builder-section-name-modal"
                    @submit.prevent="confirmCreateGlobalAlias"
                >
                    <h3>Create Global Alias</h3>
                    <p>
                        Save current node props as shared global defaults and replace this
                        node with the alias.
                    </p>
                    <input
                        ref="globalAliasNameInputRef"
                        v-model="globalAliasNameDraft"
                        type="text"
                        placeholder="GlobalFooter"
                        autocomplete="off"
                    />
                    <p v-if="globalAliasError" class="builder-section-name-modal__error">
                        {{ globalAliasError }}
                    </p>
                    <div class="builder-section-name-modal__actions">
                        <button
                            type="button"
                            class="builder-section-name-modal__cancel"
                            @click="closeGlobalAliasModal"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="builder-section-name-modal__confirm"
                            :disabled="!globalAliasNameDraft.trim() || isGlobalAliasSaving"
                        >
                            {{
                                isGlobalAliasSaving
                                    ? "Saving…"
                                    : "Create Global Alias"
                            }}
                        </button>
                    </div>
                </form>
            </div>
            <div
                v-if="filteredBuilderTree.length"
                class="builder-root-dropzone"
                @dragover.prevent="handleDragOver(null)"
                @drop.prevent="handleDrop(null)"
            >
                Drop here to move to the end
            </div>
        </section>
        </Transition>

        <!--
    <section class="builder-output">
      <h2>Serialized Output</h2>
      <pre>{{ serializedJson }}</pre>
    </section>
-->

        <section class="builder-preview" v-if="!hidePreview">
            <h2>Preview</h2>
            <div class="builder-preview__surface">
                <div
                    :class="['builder-preview__content', previewSpacingClass]"
                    :style="previewTypographyStyle"
                >
                    <Content
                        :value="serializedDocument"
                        :global-components="globalComponentsRegistry.components"
                    />
                </div>
                <div
                    v-if="isPreviewFontLoading"
                    class="builder-preview__loading"
                    aria-live="polite"
                    aria-busy="true"
                >
                    <span class="builder-preview__spinner" aria-hidden="true" />
                    <span>Loading preview fonts…</span>
                </div>
            </div>
        </section>
    </div>
</template>

<style scoped>
.builder-page {
    display: grid;
    gap: 24px;
    padding: 0;
    max-width: 1200px;
    margin: 0 auto;
}

.builder-controls {
    display: grid;
    gap: 16px;
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
}

.builder-typography-card {
    display: grid;
    gap: 12px;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #ffffff;
}

.builder-typography-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.builder-typography-toggle__button {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 7px 12px;
    background: #ffffff;
    color: #0f172a;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
}

.builder-typography-toggle__summary {
    font-size: 0.78rem;
    color: #475569;
}

.builder-typography-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
}

.builder-typography-card__header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #0f172a;
}

.builder-typography-card__header span {
    font-size: 0.78rem;
    color: #475569;
}

.builder-typography-card__grid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.builder-typography-card__grid label {
    display: grid;
    gap: 6px;
    font-size: 0.78rem;
    color: #334155;
}

.builder-typography-card__grid select {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    font-size: 0.86rem;
}

.builder-typography-card__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.builder-typography-card__profiles {
    display: grid;
    gap: 12px;
}

.builder-typography-card__fieldset {
    display: grid;
    gap: 8px;
    padding: 10px 12px 12px;
    border: 1px solid #dbe2ea;
    border-radius: 10px;
    margin: 0;
}

.builder-typography-card__fieldset legend {
    padding: 0 4px;
    font-size: 0.78rem;
    font-weight: 600;
    color: #334155;
}

.builder-typography-card__choice {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: #1e293b;
}

.builder-typography-card__choice input {
    margin: 0;
}

.builder-typography-card__hint {
    margin: 0;
    font-size: 0.74rem;
    color: #64748b;
}

.builder-typography-card__cancel,
.builder-typography-card__apply {
    border: 0;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
}

.builder-typography-card__cancel {
    background: #e2e8f0;
    color: #1e293b;
}

.builder-typography-card__apply {
    background: #2563eb;
    color: #ffffff;
}

.builder-typography-card__cancel:disabled,
.builder-typography-card__apply:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.builder-typography-card__error {
    margin: 0;
    font-size: 0.78rem;
    color: #b91c1c;
}

.builder-typography-card__notice {
    margin: 0;
    font-size: 0.78rem;
    color: #0369a1;
}

.builder-theme-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.builder-theme-toggle__button {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 7px 12px;
    background: #ffffff;
    color: #0f172a;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
}

.builder-theme-toggle__summary {
    font-size: 0.78rem;
    color: #475569;
}

.builder-theme-card {
    display: grid;
    gap: 12px;
    padding: 12px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #ffffff;
}

.builder-theme-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
}

.builder-theme-card__header h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #0f172a;
}

.builder-theme-card__header span {
    font-size: 0.78rem;
    color: #475569;
}

.builder-theme-card__mode {
    display: flex;
    gap: 8px;
}

.builder-theme-card__mode-btn {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 6px 10px;
    background: #ffffff;
    color: #334155;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
}

.builder-theme-card__mode-btn--active {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1d4ed8;
}

.builder-theme-card__simple {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.builder-theme-card__simple label,
.builder-theme-card__namespace-grid label {
    display: grid;
    gap: 6px;
    font-size: 0.78rem;
    color: #334155;
}

.builder-theme-card__simple input,
.builder-theme-card__namespace-grid input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #0f172a;
    font-size: 0.86rem;
}

.builder-theme-card__full {
    display: grid;
    gap: 10px;
}

.builder-theme-card__namespace {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px;
    display: grid;
    gap: 8px;
}

.builder-theme-card__namespace-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
}

.builder-theme-card__namespace-header h4 {
    margin: 0;
    font-size: 0.8rem;
    font-weight: 600;
    color: #0f172a;
}

.builder-theme-card__namespace-header p {
    margin: 3px 0 0;
    font-size: 0.72rem;
    color: #64748b;
    max-width: 760px;
}

.builder-theme-card__namespace-badge {
    display: inline-flex;
    align-items: center;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 0.68rem;
    color: #475569;
    white-space: nowrap;
}

.builder-theme-card__namespace-empty {
    margin: 0;
    font-size: 0.74rem;
    color: #64748b;
}

.builder-theme-card__namespace-grid {
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.builder-theme-card__namespace-grid em {
    font-style: normal;
    color: #64748b;
    font-size: 0.72rem;
}

.builder-theme-card__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.builder-theme-card__cancel,
.builder-theme-card__save,
.builder-theme-card__apply {
    border: 0;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
}

.builder-theme-card__cancel {
    background: #e2e8f0;
    color: #1e293b;
}

.builder-theme-card__save {
    background: #f59e0b;
    color: #ffffff;
}

.builder-theme-card__apply {
    background: #2563eb;
    color: #ffffff;
}

.builder-theme-card__cancel:disabled,
.builder-theme-card__save:disabled,
.builder-theme-card__apply:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.builder-theme-card__error {
    margin: 0;
    font-size: 0.78rem;
    color: #b91c1c;
}

.builder-theme-card__notice {
    margin: 0;
    font-size: 0.78rem;
    color: #0369a1;
}

.builder-seo-card {
    width: 100%;
    text-align: left;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #ffffff;
    padding: 12px;
    cursor: pointer;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.builder-seo-card:hover {
    border-color: #94a3b8;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
}

.builder-seo-card--dirty {
    border-color: #3b82f6;
}

.builder-seo-card__content {
    display: grid;
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) 180px;
}

.builder-seo-card__main {
    display: grid;
    gap: 6px;
}

.builder-seo-card__eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #64748b;
}

.builder-seo-card__title {
    font-size: 16px;
    line-height: 1.3;
    font-weight: 700;
    color: #0f172a;
}

.builder-seo-card__description {
    font-size: 13px;
    line-height: 1.35;
    color: #475569;
    display: -webkit-box;
    overflow: hidden;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

.builder-seo-card__meta {
    display: grid;
    gap: 2px;
    margin-top: 2px;
    font-size: 12px;
    color: #64748b;
}

.builder-seo-card__preview {
    display: grid;
    gap: 6px;
    align-content: start;
}

.builder-seo-card__preview-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
}

.builder-seo-card__preview-image,
.builder-seo-card__preview-placeholder {
    width: 100%;
    aspect-ratio: 1200 / 630;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}

.builder-seo-card__preview-image {
    object-fit: cover;
    background: #ffffff;
}

.builder-seo-card__preview-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f8fafc;
    color: #64748b;
    font-size: 12px;
}

.builder-tree__controls {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 8px;
}

.builder-search {
    display: grid;
    gap: 6px;
    padding: 12px 16px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
}

.builder-tree__search {
    flex: 1 1 320px;
    min-width: 260px;
}

.builder-search label {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.builder-search input {
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #cbd5f5;
    font: inherit;
}

.builder-config {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.builder-config label {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.builder-config__label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.builder-config input,
.builder-config textarea {
    padding: 8px;
    border-radius: 4px;
    border: 1px solid #cbd5f5;
    font: inherit;
}

.builder-config__full {
  grid-column: 1 / -1;
}

.builder-config__translate-btn {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #ffffff;
    color: #334155;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.2;
    cursor: pointer;
}

.builder-config__translate-btn:hover {
    background: #f8fafc;
}

.builder-config__translate-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.builder-config__translate-checkbox {
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: #2563eb;
    cursor: pointer;
}

.builder-config__textarea textarea {
    min-height: 72px;
}

.builder-config__image {
    grid-column: 1 / -1;
    display: grid;
    gap: 8px;
}

.builder-config__actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
}

.builder-config__cancel {
    min-width: 96px;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #334155;
    font-weight: 600;
    cursor: pointer;
}

.builder-config__cancel:hover {
    background: #f8fafc;
}

.builder-config__ok {
    min-width: 96px;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid #1d4ed8;
    background: #2563eb;
    color: #ffffff;
    font-weight: 600;
    cursor: pointer;
}

.builder-config__ok:hover {
    background: #1d4ed8;
}

.builder-config__image-label {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
}

.builder-config__image-label small {
    font-size: 12px;
    color: #64748b;
}

.builder-config__checkbox {
    flex-direction: row;
    align-items: center;
    gap: 8px;
}

.builder-config__checkbox input {
    width: 18px;
    height: 18px;
}

@media (max-width: 900px) {
    .builder-seo-card__content {
        grid-template-columns: 1fr;
    }

    .builder-seo-card__preview {
        max-width: 260px;
    }
}

.builder-derived {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 0.9rem;
    color: #475569;
}

.builder-derived span {
    display: block;
    font-weight: 600;
    margin-bottom: 2px;
}

.builder-derived code {
    background: #e2e8f0;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.85rem;
}

.builder-add {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
}

.builder-add select,
.builder-add button {
    padding: 14px 10px;
    border-radius: 12px;
    border: 1px solid #cbd5f5;
    background: #2563eb;
    color: #ffffff;
    cursor: pointer;
    min-width: 132px;
    font-weight: 600;
}

.builder-add button:hover {
    background: #1d4ed8;
}

.builder-load {
    border-color: #334155;
    color: #334155;
}

.builder-save {
    border-color: #0f766e;
    color: #0f766e;
}

.builder-layout {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.builder-layout label {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.builder-layout select {
    padding: 8px 12px;
    border-radius: 4px;
    border: 1px solid #cbd5f5;
    background: #fff;
}

.builder-tree {
    padding: 4px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.builder-focused-editor {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    overflow: visible;
}

.builder-focused-editor__stage {
    min-height: 0;
    min-width: 0;
    display: block;
    padding: 0;
    overflow: visible;
}

.builder-focused-editor__card {
    width: 100%;
    min-width: 0;
    display: grid;
    gap: 0.75rem;
}

.builder-focused-editor__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 0;
    background: rgba(255, 255, 255, 0.86);
    box-shadow: 0 18px 35px -28px rgba(15, 23, 42, 0.4);
}

.builder-focused-editor__eyebrow {
    display: block;
    margin-bottom: 0.2rem;
    color: #2563eb;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
}

.builder-focused-editor__header h3 {
    margin: 0;
    color: #0f172a;
    font-size: 1rem;
    font-weight: 800;
    line-height: 1.2;
}

.builder-focused-editor__close {
    width: 2.1rem;
    height: 2.1rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #dbe3ef;
    border-radius: 999px;
    background: #ffffff;
    color: #475569;
    font-size: 1.2rem;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
}

.builder-focused-editor__close:hover:not(:disabled) {
    border-color: #bfdbfe;
    color: #1d4ed8;
}

.builder-focused-editor__missing {
    padding: 1rem;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    color: #64748b;
    background: #ffffff;
}

.builder-focused-editor__bar {
    position: sticky;
    bottom: 0;
    z-index: 5;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 0.65rem;
    border-top: 1px solid #dbe3ef;
    border-bottom: 1px solid #dbe3ef;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(14px);
}

.builder-focused-editor__visibility,
.builder-focused-editor__actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.builder-focused-editor__actions {
    flex: 0 0 auto;
    flex-wrap: nowrap;
}

.builder-focused-editor__toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: #334155;
    font-size: 0.72rem;
    font-weight: 700;
    line-height: 1.2;
}

.builder-focused-editor__toggle input {
    width: 0.9rem;
    height: 0.9rem;
    margin: 0;
    accent-color: #2563eb;
}

.builder-focused-editor__toggle:has(input:disabled) {
    color: #94a3b8;
}

.builder-focused-editor__cancel,
.builder-focused-editor__save {
    min-width: 82px;
    border-radius: 9px;
    padding: 0.55rem 0.8rem;
    font-size: 0.78rem;
    font-weight: 800;
    cursor: pointer;
}

.builder-focused-editor__cancel {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #334155;
}

.builder-focused-editor__save {
    border: 1px solid #1d4ed8;
    background: #2563eb;
    color: #ffffff;
}

.builder-focused-editor__cancel:disabled,
.builder-focused-editor__save:disabled,
.builder-focused-editor__close:disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

@media (max-width: 720px) {
    .builder-focused-editor__bar {
        align-items: stretch;
        flex-direction: column;
    }

    .builder-focused-editor__actions {
        flex-wrap: nowrap;
        justify-content: flex-end;
    }
}

.builder-focused-editor-enter-active {
    animation: builderFocusedEditorBounceIn 0.42s cubic-bezier(0.2, 0.9, 0.24, 1.25);
}

.builder-focused-editor-leave-active {
    transition: opacity 0.18s ease, transform 0.18s ease;
}

.builder-focused-editor-leave-to {
    opacity: 0;
    transform: translateY(8px) scale(0.99);
}

@keyframes builderFocusedEditorBounceIn {
    0% {
        opacity: 0;
        transform: translateY(18px) scale(0.96);
    }

    70% {
        opacity: 1;
        transform: translateY(-4px) scale(1.01);
    }

    100% {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.builder-tree__search {
    position: sticky;
    top: 0;
    z-index: 2;
    margin-bottom: 8px;
    background: #fff;
}

.builder-empty {
    color: #64748b;
}

.builder-root-item {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    border: 1px dashed transparent;
    border-radius: 8px;
    padding: 0;
    position: relative;
}

.builder-root-item[data-dragging="true"] {
    opacity: 0.5;
}

.builder-root-item[data-drag-over="true"] {
    border-color: #3b82f6;
    background: #f8fbff;
}

.builder-root-item__handle {
    cursor: grab;
    font-size: 1.25rem;
    line-height: 1;
    padding: 8px 4px;
    color: #94a3b8;
    user-select: none;
    position: absolute;
    left: -0.6rem;
    top: -1rem;
}

.builder-root-item__insert {
    position: absolute;
    left: 50%;
    bottom: -12px;
    transform: translateX(-50%);
    width: 35px;
    height: 35px;
    border-radius: 999px;
    border: 1px solid #bfdbfe;
    background: #ffffff;
    color: #2563eb;
    font-size: 18px;
    line-height: 1;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    z-index: 3;
}

.builder-root-item:hover .builder-root-item__insert,
.builder-root-item:focus-within .builder-root-item__insert {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(-50%) translateY(2px);
}

.builder-root-item__insert:hover {
    box-shadow: 0 4px 10px rgba(37, 99, 235, 0.24);
}

.builder-section-name-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.24);
    padding: 16px;
}

.builder-section-name-modal {
    width: min(420px, 100%);
    display: grid;
    gap: 12px;
    padding: 16px;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    box-shadow: 0 20px 40px rgba(15, 23, 42, 0.14);
}

.builder-section-name-modal h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
}

.builder-section-name-modal p {
    margin: 0;
    font-size: 0.8rem;
    color: #64748b;
}

.builder-section-name-modal input {
    width: 100%;
    padding: 9px 10px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font: inherit;
}

.builder-section-name-modal__error {
    margin: 0;
    font-size: 0.78rem;
    color: #b91c1c;
}

.builder-section-name-modal__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.builder-section-name-modal__cancel,
.builder-section-name-modal__confirm {
    min-width: 96px;
    padding: 8px 12px;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
}

.builder-section-name-modal__cancel {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #334155;
}

.builder-section-name-modal__confirm {
    border: 1px solid #1d4ed8;
    background: #2563eb;
    color: #ffffff;
}

.builder-section-name-modal__confirm:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.builder-root-dropzone {
    border: 1px dashed #cbd5f5;
    border-radius: 8px;
    padding: 12px;
    text-align: center;
    color: #475569;
    background: #f8fafc;
}

.builder-output,
.builder-preview {
    padding: 16px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
}

.builder-output pre {
    white-space: pre-wrap;
    background: #0f172a;
    color: #f8fafc;
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
}

.builder-preview__content {
    display: flex;
    flex-direction: column;
}

.builder-preview__surface {
    position: relative;
}

.builder-preview__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: rgba(248, 250, 252, 0.82);
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    color: #1e293b;
    font-size: 0.82rem;
    font-weight: 600;
}

.builder-preview__spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #cbd5e1;
    border-top-color: #2563eb;
    border-radius: 999px;
    animation: builderPreviewSpin 0.8s linear infinite;
}

@keyframes builderPreviewSpin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.builder-preview__content.space-tight > :deep(* + *) {
    margin-top: 16px;
}

.builder-preview__content.space-cozy > :deep(* + *) {
    margin-top: 32px;
}

.builder-preview__content.space-roomy > :deep(* + *) {
    margin-top: 48px;
}
</style>
