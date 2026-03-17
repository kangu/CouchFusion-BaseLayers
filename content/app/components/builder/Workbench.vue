<script setup lang="ts">
import {
    computed,
    defineAsyncComponent,
    nextTick,
    onBeforeUnmount,
    reactive,
    ref,
    toRaw,
    watch,
} from "vue";
import NodeEditor from "./NodeEditor.vue";
import ComponentPickerDialog from "./ComponentPickerDialog.vue";
import { useComponentRegistry } from "../../composables/useComponentRegistry";
import {
    filterNodesBySearch,
    normalizeSearchQuery,
} from "../../utils/builderSearch";
import type {
    BuilderNode,
    BuilderNodeChild,
    BuilderTree,
} from "~/types/builder";
import {
    createDocumentFromTree,
    type MinimalContentDocument,
    type PageConfigInput,
    type SpacingPresetId,
} from "../../utils/contentBuilder";
import type { ComponentPropSchema } from "~/types/builder";
import { CONTENT_META_I18N_KEY } from "#content/utils/i18n";
import {
    buildComponentDefinitionLookup,
    collectFixedBodyPaths,
} from "#content/utils/i18n-body";

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

    if (component.includes("-")) {
        return component;
    }

    return component
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
    selectedTranslationPointers?: string[];
}>();
const emit = defineEmits<{
    (e: "document-change", document: MinimalContentDocument): void;
    (e: "document-preview-change", document: MinimalContentDocument): void;
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
}>();

const { registry, createNode, createTextNode } = useComponentRegistry();
const runtimeConfig = useRuntimeConfig();
const componentOptions = computed(() => registry.list);
const componentDefinitionLookup = computed(() =>
    buildComponentDefinitionLookup(registry.list),
);

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
    const props = { ...node.props };
    if (value === undefined || value === null) {
        delete props[key];
    } else {
        props[key] = value;
    }
    node.props = props;
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
    parent.children.push(createNode(componentId));
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

const focusNodeProp = (payload: {
    uid: string;
    propPath: string;
    sectionId?: string;
}) => {
    if (!payload || typeof payload.uid !== "string") {
        return;
    }

    const propPath = parseDottedPropPath(payload.propPath);
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

    propFocusRequestToken.value += 1;
    nodePropFocusRequest.value = {
        uidPath,
        targetUid,
        propPath,
        token: propFocusRequestToken.value,
    };
    handleNodeFocus({ uid: targetUid, mode: "lock" });
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
            { annotateBuilderUids: true },
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

onBeforeUnmount(() => {
    if (documentEmitTimeout) {
        clearTimeout(documentEmitTimeout);
        documentEmitTimeout = null;
    }
    if (previewDocumentEmitTimeout) {
        clearTimeout(previewDocumentEmitTimeout);
        previewDocumentEmitTimeout = null;
    }
});

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
        <section class="builder-controls">
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

        <section class="builder-tree">
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
                    :registry="registry"
                    :component-options="componentOptions"
                    :focus-request="nodePropFocusRequest"
                    :search-query="normalizedSearchQuery"
                    :on-update-prop="updateNodeProp"
                    :on-update-text="updateTextNode"
                    :on-add-child-component="addChildComponent"
                    :on-add-child-text="addChildText"
                    :on-remove="removeNode"
                    :on-clone="cloneNode"
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
                v-if="filteredBuilderTree.length"
                class="builder-root-dropzone"
                @dragover.prevent="handleDragOver(null)"
                @drop.prevent="handleDrop(null)"
            >
                Drop here to move to the end
            </div>
        </section>

        <!--
    <section class="builder-output">
      <h2>Serialized Output</h2>
      <pre>{{ serializedJson }}</pre>
    </section>
-->

        <section class="builder-preview" v-if="!hidePreview">
            <h2>Preview</h2>
            <div :class="['builder-preview__content', previewSpacingClass]">
                <Content :value="serializedDocument" />
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
