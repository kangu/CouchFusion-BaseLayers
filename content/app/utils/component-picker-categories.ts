import type { ComponentDefinition } from "../types/builder";

export const CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID =
  "content-settings:component-picker-categories" as const;

export const CONTENT_COMPONENT_PICKER_CATEGORIES_TYPE =
  "content-component-picker-categories" as const;

export interface ComponentPickerCategory {
  id: string;
  label: string;
  order: number;
}

export interface ComponentPickerCategorySettings {
  _id?: typeof CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID;
  _rev?: string;
  type?: typeof CONTENT_COMPONENT_PICKER_CATEGORIES_TYPE;
  categories: ComponentPickerCategory[];
  assignments: Record<string, string[]>;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface ComponentPickerCategoryTab {
  id: string;
  label: string;
  system: boolean;
}

const SYSTEM_CATEGORY_IDS = new Set(["all", "default", "global", "basic-html"]);
const PRIMITIVE_COMPONENT_IDS = new Set(["p", "span", "strong", "template"]);
const PRIMITIVE_COMPONENT_LABELS = new Set([
  "paragraph",
  "span",
  "strong text",
  "template (slot)",
  "template",
]);

export const slugifyComponentPickerCategory = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const formatComponentPickerCategoryLabel = (value: string): string => {
  if (value === "all") {
    return "All";
  }
  if (value === "basic-html") {
    return "Basic HTML";
  }
  if (value === "default") {
    return "Sections";
  }
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

export const isSystemComponentPickerCategory = (id: string): boolean =>
  SYSTEM_CATEGORY_IDS.has(id);

export const isPrimitiveComponentDefinition = (
  definition: ComponentDefinition,
): boolean => {
  const id = definition.id.trim().toLowerCase();
  const label = definition.label.trim().toLowerCase();
  return PRIMITIVE_COMPONENT_IDS.has(id) || PRIMITIVE_COMPONENT_LABELS.has(label);
};

export const normalizeComponentFallbackCategory = (
  definition: ComponentDefinition,
): string => {
  if (isPrimitiveComponentDefinition(definition)) {
    return "basic-html";
  }
  const category = slugifyComponentPickerCategory(definition.category);
  return category || "default";
};

const normalizeCategoryInput = (
  value: unknown,
  index: number,
): ComponentPickerCategory | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, any>;
  const label =
    typeof raw.label === "string" && raw.label.trim().length > 0
      ? raw.label.trim()
      : typeof raw.id === "string"
        ? formatComponentPickerCategoryLabel(slugifyComponentPickerCategory(raw.id))
        : "";
  const id = slugifyComponentPickerCategory(raw.id || label);
  if (!id || isSystemComponentPickerCategory(id) || !label) {
    return null;
  }
  const numericOrder =
    typeof raw.order === "number" && Number.isFinite(raw.order)
      ? raw.order
      : index;
  return {
    id,
    label,
    order: numericOrder,
  };
};

export const normalizeComponentPickerCategorySettings = (
  value: unknown,
): ComponentPickerCategorySettings => {
  const raw =
    value && typeof value === "object" ? (value as Record<string, any>) : {};
  const seen = new Set<string>();
  const categories: ComponentPickerCategory[] = [];
  const rawCategories = Array.isArray(raw.categories) ? raw.categories : [];

  rawCategories.forEach((item, index) => {
    const category = normalizeCategoryInput(item, index);
    if (!category || seen.has(category.id)) {
      return;
    }
    seen.add(category.id);
    categories.push(category);
  });
  categories.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));

  const allowedCategoryIds = new Set(categories.map((category) => category.id));
  const assignments: Record<string, string[]> = {};
  const rawAssignments =
    raw.assignments && typeof raw.assignments === "object" && !Array.isArray(raw.assignments)
      ? (raw.assignments as Record<string, unknown>)
      : {};

  for (const [componentId, categoryIds] of Object.entries(rawAssignments)) {
    const id = componentId.trim();
    if (!id || !Array.isArray(categoryIds)) {
      continue;
    }
    const normalizedCategoryIds = Array.from(
      new Set(
        categoryIds
          .map((categoryId) => slugifyComponentPickerCategory(categoryId))
          .filter((categoryId) => allowedCategoryIds.has(categoryId)),
      ),
    );
    if (normalizedCategoryIds.length > 0) {
      assignments[id] = normalizedCategoryIds;
    }
  }

  return {
    _id: CONTENT_COMPONENT_PICKER_CATEGORIES_DOC_ID,
    _rev: typeof raw._rev === "string" ? raw._rev : undefined,
    type: CONTENT_COMPONENT_PICKER_CATEGORIES_TYPE,
    categories,
    assignments,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
  };
};

export const getEffectiveComponentPickerCategoryIds = (
  definition: ComponentDefinition,
  settings: ComponentPickerCategorySettings,
): string[] => {
  const assigned = settings.assignments[definition.id] || [];
  if (assigned.length > 0) {
    return assigned;
  }
  return [normalizeComponentFallbackCategory(definition)];
};

export const buildComponentPickerCategoryTabs = (
  definitions: ComponentDefinition[],
  settings: ComponentPickerCategorySettings,
): ComponentPickerCategoryTab[] => {
  const discovered = new Set<string>();
  for (const definition of definitions) {
    discovered.add(normalizeComponentFallbackCategory(definition));
  }
  const orderedFallbacks = Array.from(discovered.values()).sort((left, right) =>
    left.localeCompare(right),
  );
  const prioritizedFallbacks = [
    ...orderedFallbacks.filter((value) => value === "default"),
    ...orderedFallbacks.filter((value) => value === "global"),
    ...orderedFallbacks.filter((value) => value === "basic-html"),
    ...orderedFallbacks.filter(
      (value) =>
        value !== "default" && value !== "global" && value !== "basic-html",
    ),
  ];

  return [
    { id: "all", label: "All", system: true },
    ...prioritizedFallbacks.map((id) => ({
      id,
      label: formatComponentPickerCategoryLabel(id),
      system: true,
    })),
    ...settings.categories.map((category) => ({
      id: category.id,
      label: category.label,
      system: false,
    })),
  ];
};

export const filterComponentPickerDefinitions = (
  definitions: ComponentDefinition[],
  settings: ComponentPickerCategorySettings,
  selectedCategory: string,
): ComponentDefinition[] => {
  if (selectedCategory === "all") {
    return definitions;
  }
  return definitions.filter((definition) =>
    getEffectiveComponentPickerCategoryIds(definition, settings).includes(
      selectedCategory,
    ),
  );
};
