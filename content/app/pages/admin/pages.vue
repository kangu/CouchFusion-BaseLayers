<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type {
  ContentPagePublicationState,
  ContentPageSummary,
} from "#content/types/content-page";
import { useContentPagesStore } from "#content/app/stores/pages";
import { resolveContentI18nConfig } from "#content/utils/i18n";
import { normalizePagePath } from "#content/utils/page";
import { deriveStem, normalizeSeoImage } from "#content/utils/page-documents";

definePageMeta({
  middleware: ["auth", "role-auth"],
  authAllowedRoles: ["admin"],
  layout: "admin-workspace",
});

const contentStore = useContentPagesStore();
const runtimeConfig = useRuntimeConfig();
const contentI18nConfig = computed(() =>
  resolveContentI18nConfig(
    runtimeConfig.content?.i18n ?? runtimeConfig.public?.content?.i18n,
  ),
);

type ContentI18nConfigResponse = {
  defaultLocale: string;
  locales: string[];
};

type I18nSettingsResponse = {
  success: boolean;
  runtime: ContentI18nConfigResponse;
  effective: ContentI18nConfigResponse;
  override?: Record<string, any> | null;
};

const i18nSettings = ref<I18nSettingsResponse | null>(null);
const isI18nSettingsLoading = ref(false);
const isI18nSettingsSaving = ref(false);
const isDefaultLocaleMigrating = ref(false);
const isI18nPanelExpanded = ref(false);
const i18nSettingsError = ref<string | null>(null);
const i18nSettingsNotice = ref<string | null>(null);

const selectedLocales = ref<string[]>([]);
const selectedDefaultLocale = ref("");
const localeInput = ref("");
const migrationStrategy = ref<"strict" | "fallback-copy">("strict");

const configuredLocales = computed(() => {
  const effective = i18nSettings.value?.effective?.locales;
  if (Array.isArray(effective) && effective.length) {
    return effective;
  }
  return contentI18nConfig.value.locales;
});
const defaultLocale = computed(() => {
  const effectiveDefault = i18nSettings.value?.effective?.defaultLocale;
  if (typeof effectiveDefault === "string" && effectiveDefault.length > 0) {
    return effectiveDefault;
  }
  return contentI18nConfig.value.defaultLocale;
});
const hasMultipleLocales = computed(() => configuredLocales.value.length > 1);

const searchQuery = ref("");
const localizationFilter = ref<"all" | "needs-localization" | "localized">(
  "all",
);
const localePresenceFilter = ref<"all" | "present" | "missing">("all");
const localeFilter = ref("");
const imageFilter = ref<"all" | "with-image" | "without-image">("all");
const publicationFilter = ref<"all" | ContentPagePublicationState>("all");
const sortBy = ref<"path" | "title" | "updated">("updated");
const sortDirection = ref<"asc" | "desc">("desc");
const pageSize = ref(25);
const currentPage = ref(1);
const deletingById = ref<Record<string, boolean>>({});
const updatingPublicationById = ref<Record<string, boolean>>({});
const pageActionNotice = ref<string | null>(null);
const pageActionError = ref<string | null>(null);

const isCreateModalOpen = ref(false);
const isCreatePending = ref(false);
const createForm = reactive({
  path: "/",
  title: "",
  seoTitle: "",
  seoDescription: "",
  seoImage: "",
  meta: "{}",
});

const isCloneModalOpen = ref(false);
const isClonePending = ref(false);
const cloneSourcePage = ref<ContentPageSummary | null>(null);
const cloneForm = reactive({
  path: "/copy",
  title: "",
  seoTitle: "",
  seoDescription: "",
  seoImage: "",
  meta: "{}",
});

const indexState = computed(() => contentStore.index);
const isLoading = computed(() => indexState.value.pending);
const loadError = computed(() => indexState.value.error);
const allPages = computed(() => indexState.value.data ?? []);

const totalPagesCount = computed(() => allPages.value.length);

const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());

const knownLocalesFromPages = computed(() => {
  const locales = new Set<string>();
  for (const page of allPages.value) {
    for (const locale of page.localization?.availableLocales ?? []) {
      locales.add(locale);
    }
    for (const locale of page.localization?.missingLocales ?? []) {
      locales.add(locale);
    }
  }
  return Array.from(locales.values());
});

const localeCandidates = computed(() => {
  const fromRuntime = contentI18nConfig.value.locales;
  const fromEffective = configuredLocales.value;
  const fromSelected = selectedLocales.value;
  const merged = new Set([
    ...fromRuntime,
    ...fromEffective,
    ...fromSelected,
    ...knownLocalesFromPages.value,
  ]);
  return Array.from(merged.values()).sort((a, b) => a.localeCompare(b));
});

const isMigrationNeeded = computed(
  () =>
    selectedDefaultLocale.value.length > 0 &&
    selectedDefaultLocale.value !== defaultLocale.value,
);
const i18nCompactSummary = computed(() => {
  if (!configuredLocales.value.length) {
    return "No locales configured.";
  }
  return `${configuredLocales.value.length} enabled · default ${defaultLocale.value.toUpperCase()}`;
});

const getAvailableLocales = (page: ContentPageSummary): string[] => {
  const available = page.localization?.availableLocales;
  if (Array.isArray(available) && available.length) {
    return available.filter((locale) => configuredLocales.value.includes(locale));
  }

  const fallback = page.localization?.defaultLocale ?? defaultLocale.value;
  return configuredLocales.value.includes(fallback) ? [fallback] : [];
};

const getMissingLocales = (page: ContentPageSummary): string[] => {
  const missing = page.localization?.missingLocales;
  if (Array.isArray(missing)) {
    return missing.filter((locale) => configuredLocales.value.includes(locale));
  }

  const availableSet = new Set(getAvailableLocales(page));
  return configuredLocales.value.filter((locale) => !availableSet.has(locale));
};

const getLocaleCoverageLabel = (page: ContentPageSummary): string => {
  const availableCount = getAvailableLocales(page).length;
  return `${availableCount}/${configuredLocales.value.length}`;
};

const filteredPages = computed<ContentPageSummary[]>(() => {
  const query = normalizedQuery.value;

  return allPages.value.filter((page) => {
    if (query) {
      const haystack = [
        page.path,
        page.title ?? "",
        page.seoTitle ?? "",
        page.seoDescription ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (localizationFilter.value !== "all") {
      const missing = getMissingLocales(page).length;
      const needsLocalization = missing > 0;
      if (
        localizationFilter.value === "needs-localization" &&
        !needsLocalization
      ) {
        return false;
      }
      if (localizationFilter.value === "localized" && needsLocalization) {
        return false;
      }
    }

    if (hasMultipleLocales.value && localeFilter.value) {
      const selectedLocale = localeFilter.value;
      const available = getAvailableLocales(page);
      const hasSelectedLocale = available.includes(selectedLocale);

      if (localePresenceFilter.value === "present" && !hasSelectedLocale) {
        return false;
      }
      if (localePresenceFilter.value === "missing" && hasSelectedLocale) {
        return false;
      }
    }

    if (imageFilter.value !== "all") {
      const hasImage = Boolean(page.seoImage);
      if (imageFilter.value === "with-image" && !hasImage) {
        return false;
      }
      if (imageFilter.value === "without-image" && hasImage) {
        return false;
      }
    }

    if (
      publicationFilter.value !== "all" &&
      page.publicationState !== publicationFilter.value
    ) {
      return false;
    }

    return true;
  });
});

const sortedPages = computed<ContentPageSummary[]>(() => {
  const items = [...filteredPages.value];

  items.sort((a, b) => {
    if (sortBy.value === "path") {
      return a.path.localeCompare(b.path);
    }

    if (sortBy.value === "title") {
      return (a.title ?? "").localeCompare(b.title ?? "");
    }

    const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return aTime - bTime;
  });

  if (sortDirection.value === "desc") {
    items.reverse();
  }

  return items;
});

const totalFilteredCount = computed(() => sortedPages.value.length);
const totalPageCount = computed(() =>
  Math.max(1, Math.ceil(totalFilteredCount.value / pageSize.value)),
);

const paginatedPages = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return sortedPages.value.slice(start, start + pageSize.value);
});

const hasPreviousPage = computed(() => currentPage.value > 1);
const hasNextPage = computed(() => currentPage.value < totalPageCount.value);

const sortLabel = (column: "path" | "title" | "updated"): string => {
  if (sortBy.value !== column) {
    return "";
  }
  return sortDirection.value === "asc" ? "▲" : "▼";
};

const toggleColumnSort = (column: "path" | "title" | "updated") => {
  if (sortBy.value === column) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortBy.value = column;
  sortDirection.value = column === "updated" ? "desc" : "asc";
};

const toSlug = (path: string): string => {
  if (!path || path === "/") {
    return "";
  }
  return path.replace(/^\/+/, "");
};

const builderRouteForPath = (path: string): string => {
  const slug = toSlug(path);
  return slug ? `/k/${slug}` : "/k/";
};

const publicRouteForPath = (path: string): string => {
  const slug = toSlug(path);
  return slug ? `/${slug}` : "/";
};

const refreshIndex = async () => {
  await contentStore.fetchIndex(true);
};

const parseMetaField = (value: string): Record<string, any> => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  return JSON.parse(trimmed);
};

const serialiseMetaField = (value: Record<string, any> | null | undefined): string => {
  if (!value || Object.keys(value).length === 0) {
    return "{}";
  }
  return JSON.stringify(value, null, 2);
};

const deriveDuplicatePath = (sourcePath: string | null | undefined): string => {
  const normalized = normalizePagePath(sourcePath ?? "/");
  if (normalized === "/") {
    return "/copy";
  }
  return `${normalized}-copy`;
};

const resetCreateForm = () => {
  createForm.path = "/";
  createForm.title = "";
  createForm.seoTitle = "";
  createForm.seoDescription = "";
  createForm.seoImage = "";
  createForm.meta = "{}";
};

const openCreateModal = () => {
  resetCreateForm();
  isCreateModalOpen.value = true;
  pageActionError.value = null;
};

const closeCreateModal = () => {
  if (isCreatePending.value) {
    return;
  }
  isCreateModalOpen.value = false;
};

const openCloneModal = (page: ContentPageSummary) => {
  cloneSourcePage.value = page;
  cloneForm.path = deriveDuplicatePath(page.path);
  cloneForm.title = page.title ?? "Page title";
  cloneForm.seoTitle = page.seoTitle ?? page.title ?? "Page title";
  cloneForm.seoDescription = page.seoDescription ?? "SEO description.";
  cloneForm.seoImage = page.seoImage ?? "";
  cloneForm.meta = serialiseMetaField(page.meta);
  pageActionError.value = null;
  isCloneModalOpen.value = true;
};

const closeCloneModal = () => {
  if (isClonePending.value) {
    return;
  }
  isCloneModalOpen.value = false;
  cloneSourcePage.value = null;
};

const handleCreateNewPage = async () => {
  if (isCreatePending.value) {
    return;
  }

  const normalizedPath = normalizePagePath(createForm.path);
  if (!normalizedPath) {
    pageActionError.value = "Path is required.";
    return;
  }
  if (!createForm.title.trim()) {
    pageActionError.value = "Title is required.";
    return;
  }

  let metaPayload: Record<string, any>;
  try {
    metaPayload = parseMetaField(createForm.meta);
  } catch (error: any) {
    pageActionError.value = error?.message || "Meta must be valid JSON.";
    return;
  }

  isCreatePending.value = true;
  pageActionError.value = null;
  pageActionNotice.value = null;
  try {
    await contentStore.createPage(
      {
        path: normalizedPath,
        title: createForm.title,
        seoTitle: createForm.seoTitle || createForm.title,
        seoDescription: createForm.seoDescription || "SEO description.",
        seoImage: normalizeSeoImage(createForm.seoImage),
        meta: metaPayload,
        publicationState: "draft",
      },
      { locale: defaultLocale.value },
    );
    await refreshIndex();
    isCreateModalOpen.value = false;
    pageActionNotice.value = `Page "${createForm.title}" created.`;
  } catch (error: any) {
    pageActionError.value = error?.message || "Failed to create page.";
  } finally {
    isCreatePending.value = false;
  }
};

const handleClonePage = async () => {
  if (isClonePending.value || !cloneSourcePage.value) {
    return;
  }

  const normalizedPath = normalizePagePath(cloneForm.path);
  if (!normalizedPath) {
    pageActionError.value = "Path is required.";
    return;
  }
  if (!cloneForm.title.trim()) {
    pageActionError.value = "Title is required.";
    return;
  }

  let metaPayload: Record<string, any>;
  try {
    metaPayload = parseMetaField(cloneForm.meta);
  } catch (error: any) {
    pageActionError.value = error?.message || "Meta must be valid JSON.";
    return;
  }

  const sourceDocument = cloneSourcePage.value.document;
  if (!sourceDocument) {
    pageActionError.value = "Source page document is unavailable.";
    return;
  }

  isClonePending.value = true;
  pageActionError.value = null;
  pageActionNotice.value = null;
  try {
    const duplicatedDocument = {
      ...JSON.parse(JSON.stringify(sourceDocument)),
      _rev: undefined,
      path: normalizedPath,
      title: cloneForm.title,
      seo: {
        title: cloneForm.seoTitle || cloneForm.title,
        description: cloneForm.seoDescription || "SEO description.",
        image: normalizeSeoImage(cloneForm.seoImage),
      },
      meta: metaPayload,
      stem: deriveStem(normalizedPath),
      publicationState: "draft",
    };
    await contentStore.saveDocument(duplicatedDocument, {
      method: "POST",
      locale: defaultLocale.value,
    });
    await refreshIndex();
    isCloneModalOpen.value = false;
    pageActionNotice.value = `Page "${cloneForm.title}" cloned.`;
  } catch (error: any) {
    pageActionError.value = error?.message || "Failed to clone page.";
  } finally {
    isClonePending.value = false;
  }
};

const normalizeLocaleCode = (value: string): string =>
  value.trim().replace(/_/g, "-").toLowerCase();

const syncLocaleSelectionFromEffective = (response: I18nSettingsResponse) => {
  selectedLocales.value = [...response.effective.locales];
  selectedDefaultLocale.value = response.effective.defaultLocale;
};

const loadI18nSettings = async () => {
  isI18nSettingsLoading.value = true;
  i18nSettingsError.value = null;

  try {
    const response = await $fetch<I18nSettingsResponse>("/api/content/i18n-settings");
    i18nSettings.value = response;
    syncLocaleSelectionFromEffective(response);
  } catch (error: any) {
    i18nSettingsError.value =
      error?.data?.statusMessage || error?.message || "Failed to load language settings.";
    isI18nPanelExpanded.value = true;
  } finally {
    isI18nSettingsLoading.value = false;
  }
};

const toggleLocale = (locale: string) => {
  const normalized = normalizeLocaleCode(locale);
  const next = new Set(selectedLocales.value);
  if (next.has(normalized)) {
    if (next.size === 1) {
      return;
    }
    next.delete(normalized);
  } else {
    next.add(normalized);
  }
  selectedLocales.value = Array.from(next.values()).sort((a, b) => a.localeCompare(b));
};

const addLocaleFromInput = () => {
  const normalized = normalizeLocaleCode(localeInput.value);
  if (!normalized) {
    return;
  }
  if (!selectedLocales.value.includes(normalized)) {
    selectedLocales.value = [...selectedLocales.value, normalized].sort((a, b) =>
      a.localeCompare(b),
    );
  }
  localeInput.value = "";
};

const saveLocaleSettings = async () => {
  if (!selectedLocales.value.length) {
    i18nSettingsError.value = "At least one locale must stay enabled.";
    return;
  }
  if (!selectedLocales.value.includes(selectedDefaultLocale.value)) {
    i18nSettingsError.value = "Default locale must be part of enabled locales.";
    return;
  }

  isI18nSettingsSaving.value = true;
  i18nSettingsError.value = null;
  i18nSettingsNotice.value = null;
  try {
    const response = await $fetch<I18nSettingsResponse>("/api/content/i18n-settings", {
      method: "PUT",
      body: {
        locales: selectedLocales.value,
        defaultLocale: defaultLocale.value,
      },
    });
    i18nSettings.value = response;
    syncLocaleSelectionFromEffective(response);
    i18nSettingsNotice.value = "Language set saved.";
    await refreshIndex();
  } catch (error: any) {
    i18nSettingsError.value =
      error?.data?.statusMessage || error?.message || "Failed to save language settings.";
    isI18nPanelExpanded.value = true;
  } finally {
    isI18nSettingsSaving.value = false;
  }
};

const migrateDefaultLocale = async () => {
  if (!isMigrationNeeded.value) {
    return;
  }
  if (!selectedLocales.value.includes(selectedDefaultLocale.value)) {
    i18nSettingsError.value = "Default locale must be enabled before migration.";
    return;
  }

  isDefaultLocaleMigrating.value = true;
  i18nSettingsError.value = null;
  i18nSettingsNotice.value = null;

  try {
    const response = await $fetch<I18nSettingsResponse>("/api/content/i18n-settings/migrate-default", {
      method: "POST",
      body: {
        defaultLocale: selectedDefaultLocale.value,
        strategy: migrationStrategy.value,
      },
    });
    i18nSettings.value = response;
    syncLocaleSelectionFromEffective(response);
    i18nSettingsNotice.value = `Default locale migrated to ${response.effective.defaultLocale.toUpperCase()}.`;
    await refreshIndex();
  } catch (error: any) {
    i18nSettingsError.value =
      error?.data?.statusMessage || error?.message || "Default locale migration failed.";
    isI18nPanelExpanded.value = true;
  } finally {
    isDefaultLocaleMigrating.value = false;
  }
};

const formatTimestamp = (value: string | null): string => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString();
};

const openBuilder = (path: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.open(builderRouteForPath(path), "_blank", "noopener");
};

const openPublicPage = (path: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.open(publicRouteForPath(path), "_blank", "noopener");
};

const isPublicationState = (value: string): value is ContentPagePublicationState =>
  value === "published" || value === "draft";

const handlePublicationStateChange = async (
  page: ContentPageSummary,
  value: string,
) => {
  if (!isPublicationState(value) || value === page.publicationState) {
    return;
  }

  updatingPublicationById.value = {
    ...updatingPublicationById.value,
    [page.id]: true,
  };
  pageActionError.value = null;
  pageActionNotice.value = null;

  try {
    await contentStore.updatePublicationState(page.path, value);
    pageActionNotice.value =
      value === "draft"
        ? `Page "${page.title || page.path}" moved to draft.`
        : `Page "${page.title || page.path}" published.`;
  } catch (error: any) {
    pageActionError.value =
      error?.data?.statusMessage ||
      error?.message ||
      "Failed to update page status.";
  } finally {
    const next = { ...updatingPublicationById.value };
    delete next[page.id];
    updatingPublicationById.value = next;
  }
};

const handlePublicationStateEvent = (
  page: ContentPageSummary,
  event: Event,
) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) {
    return;
  }
  void handlePublicationStateChange(page, target.value);
};

const handleDelete = async (page: ContentPageSummary) => {
  if (deletingById.value[page.id]) {
    return;
  }

  const label = page.title?.trim() || page.path;
  const confirmed = window.confirm(
    `Delete page "${label}"? This action cannot be undone.`,
  );
  if (!confirmed) {
    return;
  }

  deletingById.value = { ...deletingById.value, [page.id]: true };
  try {
    await contentStore.deletePage(page.path);
    await contentStore.fetchIndex(true);
  } finally {
    const next = { ...deletingById.value };
    delete next[page.id];
    deletingById.value = next;
  }
};

onMounted(async () => {
  await Promise.all([
    loadI18nSettings(),
    contentStore.fetchIndex(),
  ]);
});

watch(
  [
    searchQuery,
    localizationFilter,
    localeFilter,
    localePresenceFilter,
    imageFilter,
    publicationFilter,
    sortBy,
    sortDirection,
  ],
  () => {
    currentPage.value = 1;
  },
);

watch(hasMultipleLocales, (value) => {
  if (value) {
    return;
  }
  localeFilter.value = "";
  localePresenceFilter.value = "all";
});

watch(selectedLocales, (locales) => {
  if (!locales.length) {
    return;
  }
  if (!locales.includes(selectedDefaultLocale.value)) {
    selectedDefaultLocale.value = locales[0];
  }
});

watch(configuredLocales, (locales) => {
  if (!localeFilter.value) {
    return;
  }
  if (locales.includes(localeFilter.value)) {
    return;
  }
  localeFilter.value = "";
});

watch(pageSize, () => {
  currentPage.value = 1;
});

watch(totalPageCount, (value) => {
  if (currentPage.value > value) {
    currentPage.value = value;
  }
});
</script>

<template>
  <div class="content-admin-pages">
    <header class="content-admin-pages__header">
      <p class="content-admin-pages__eyebrow">Content</p>
      <h1 class="content-admin-pages__title">Pages</h1>
      <p class="content-admin-pages__description">
        Manage large content inventories with filtering, sorting, and quick
        actions.
      </p>
    </header>

    <section
      class="i18n-admin-panel"
      :class="{ 'is-expanded': isI18nPanelExpanded }"
      @focusin="isI18nPanelExpanded = true"
    >
      <div class="i18n-admin-panel__header">
        <div class="i18n-admin-panel__header-text">
          <h2>Languages</h2>
          <p>Manage enabled locales and migrate default locale from inside content admin.</p>
        </div>
        <button
          type="button"
          class="pages-button i18n-admin-panel__toggle"
          @click="isI18nPanelExpanded = !isI18nPanelExpanded"
        >
          {{ isI18nPanelExpanded ? "Collapse" : "Manage" }}
        </button>
      </div>

      <p v-if="isI18nSettingsLoading" class="i18n-admin-panel__hint">Loading language settings…</p>
      <p v-else class="i18n-admin-panel__hint">
        Effective: <strong>{{ configuredLocales.join(", ") }}</strong>
        · Default: <strong>{{ defaultLocale.toUpperCase() }}</strong>
      </p>

      <div
        v-if="!isI18nPanelExpanded"
        class="i18n-admin-panel__compact"
      >
        <span class="status-pill status-pill--muted">{{ i18nCompactSummary }}</span>
      </div>

      <div v-else class="i18n-admin-panel__grid">
        <div class="i18n-admin-panel__section">
          <h3>Phase 1: Language Set</h3>
          <p class="i18n-admin-panel__section-hint">
            Toggle which locales are enabled. This does not change the default locale.
          </p>

          <div class="i18n-locale-list">
            <label
              v-for="locale in localeCandidates"
              :key="`toggle:${locale}`"
              class="i18n-locale-toggle"
            >
              <input
                type="checkbox"
                :checked="selectedLocales.includes(locale)"
                :disabled="selectedLocales.length === 1 && selectedLocales.includes(locale)"
                @change="toggleLocale(locale)"
              />
              <span>{{ locale.toUpperCase() }}</span>
            </label>
          </div>

          <div class="i18n-locale-add">
            <input
              v-model="localeInput"
              type="text"
              placeholder="Add locale code (e.g. it, pt-br)"
              @keydown.enter.prevent="addLocaleFromInput"
            />
            <button type="button" class="pages-button" @click="addLocaleFromInput">
              Add
            </button>
          </div>

          <button
            type="button"
            class="pages-button"
            :disabled="isI18nSettingsSaving || isI18nSettingsLoading"
            @click="saveLocaleSettings"
          >
            {{ isI18nSettingsSaving ? "Saving…" : "Save Language Set" }}
          </button>
        </div>

        <div class="i18n-admin-panel__section">
          <h3>Phase 2: Default Locale Migration</h3>
          <p class="i18n-admin-panel__section-hint">
            Select a new default locale and migrate documents so locale IDs/path semantics stay consistent.
          </p>

          <label class="pages-field pages-field--compact">
            <span>Target Default Locale</span>
            <select v-model="selectedDefaultLocale" :disabled="selectedLocales.length <= 1">
              <option v-for="locale in selectedLocales" :key="`default:${locale}`" :value="locale">
                {{ locale.toUpperCase() }}
              </option>
            </select>
          </label>

          <label class="pages-field">
            <span>Migration Strategy</span>
            <select v-model="migrationStrategy">
              <option value="strict">Strict (require translation exists)</option>
              <option value="fallback-copy">Fallback Copy (clone old default when missing)</option>
            </select>
          </label>

          <button
            type="button"
            class="pages-button"
            :disabled="
              isDefaultLocaleMigrating ||
              selectedLocales.length <= 1 ||
              !isMigrationNeeded ||
              isI18nSettingsLoading
            "
            @click="migrateDefaultLocale"
          >
            {{ isDefaultLocaleMigrating ? "Migrating…" : "Migrate Default Locale" }}
          </button>

          <p v-if="selectedLocales.length <= 1" class="i18n-admin-panel__section-hint">
            Single-language mode: default-locale migration is not applicable.
          </p>
        </div>
      </div>

      <p v-if="i18nSettingsNotice && isI18nPanelExpanded" class="i18n-admin-panel__notice">{{ i18nSettingsNotice }}</p>
      <p v-if="i18nSettingsError" class="i18n-admin-panel__error">{{ i18nSettingsError }}</p>
    </section>

    <section class="pages-toolbar">
      <div class="pages-toolbar__group">
        <label class="pages-field">
          <span>Search</span>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Path, title, SEO..."
          />
        </label>

        <label class="pages-field">
          <span>Localization</span>
          <select v-model="localizationFilter">
            <option value="all">All</option>
            <option value="needs-localization">Needs Localization</option>
            <option value="localized">Localized</option>
          </select>
        </label>

        <template v-if="hasMultipleLocales">
          <label class="pages-field pages-field--compact">
            <span>Locale</span>
            <select v-model="localeFilter">
              <option value="">Any</option>
              <option
                v-for="locale in configuredLocales"
                :key="locale"
                :value="locale"
              >
                {{ locale.toUpperCase() }}
              </option>
            </select>
          </label>

          <label class="pages-field pages-field--compact">
            <span>Locale State</span>
            <select v-model="localePresenceFilter">
              <option value="all">Any</option>
              <option value="present">Has Locale</option>
              <option value="missing">Missing Locale</option>
            </select>
          </label>
        </template>

        <label class="pages-field">
          <span>SEO Image</span>
          <select v-model="imageFilter">
            <option value="all">All</option>
            <option value="with-image">With Image</option>
            <option value="without-image">Without Image</option>
          </select>
        </label>

        <label class="pages-field">
          <span>Status</span>
          <select v-model="publicationFilter">
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </label>
      </div>

      <div class="pages-toolbar__group pages-toolbar__group--right">
        <button
          type="button"
          class="pages-button pages-button--primary"
          @click="openCreateModal"
        >
          Create New Page
        </button>
        <button
          type="button"
          class="pages-button"
          :disabled="isLoading"
          @click="refreshIndex"
        >
          Refresh
        </button>
      </div>
    </section>

    <section class="pages-summary">
      <p>
        Showing <strong>{{ paginatedPages.length }}</strong> of
        <strong>{{ totalFilteredCount }}</strong> filtered pages
        (<strong>{{ totalPagesCount }}</strong> total).
      </p>
      <p v-if="pageActionNotice" class="pages-summary__notice">{{ pageActionNotice }}</p>
    </section>

    <section v-if="loadError" class="pages-error">
      {{ loadError }}
    </section>
    <section v-if="pageActionError" class="pages-error">
      {{ pageActionError }}
    </section>

    <section class="pages-table-wrap">
      <table class="pages-table">
        <thead>
          <tr>
            <th>
              <button
                type="button"
                class="pages-column-sort"
                @click="toggleColumnSort('path')"
              >
                Path <span>{{ sortLabel("path") }}</span>
              </button>
            </th>
            <th>
              <button
                type="button"
                class="pages-column-sort"
                @click="toggleColumnSort('title')"
              >
                Title <span>{{ sortLabel("title") }}</span>
              </button>
            </th>
            <th>Status</th>
            <th>
              <button
                type="button"
                class="pages-column-sort"
                @click="toggleColumnSort('updated')"
              >
                Updated <span>{{ sortLabel("updated") }}</span>
              </button>
            </th>
            <th>Localization</th>
            <th>SEO Image</th>
            <th class="actions-col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="isLoading">
            <td colspan="7" class="empty-cell">Loading pages…</td>
          </tr>
          <tr v-else-if="!paginatedPages.length">
            <td colspan="7" class="empty-cell">No pages match the current filters.</td>
          </tr>
          <tr v-for="page in paginatedPages" :key="page.id">
            <td class="mono">{{ page.path }}</td>
            <td>{{ page.title || "—" }}</td>
            <td>
              <select
                class="publication-select"
                :value="page.publicationState"
                :disabled="Boolean(updatingPublicationById[page.id])"
                :aria-label="`Publication state for ${page.title || page.path}`"
                @change="handlePublicationStateEvent(page, $event)"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </td>
            <td>{{ formatTimestamp(page.updatedAt) }}</td>
            <td>
              <div class="locale-cell">
                <span class="status-pill status-pill--muted">
                  {{ getLocaleCoverageLabel(page) }}
                </span>
                <span
                  class="status-pill"
                  :class="getMissingLocales(page).length > 0 ? 'status-pill--warn' : 'status-pill--ok'"
                >
                  {{
                    getMissingLocales(page).length > 0
                      ? `Missing ${getMissingLocales(page).length}`
                      : "Complete"
                  }}
                </span>

                <div v-if="hasMultipleLocales" class="locale-badges">
                  <span
                    v-for="locale in configuredLocales"
                    :key="`${page.id}:${locale}`"
                    class="locale-badge"
                    :class="
                      getAvailableLocales(page).includes(locale)
                        ? 'locale-badge--ok'
                        : 'locale-badge--missing'
                    "
                  >
                    {{ locale.toUpperCase() }}
                  </span>
                </div>
                <p v-else class="locale-single-note">
                  Single language setup
                </p>
              </div>
            </td>
            <td>
              <span
                class="status-pill"
                :class="page.seoImage ? 'status-pill--ok' : 'status-pill--muted'"
              >
                {{ page.seoImage ? "Present" : "Missing" }}
              </span>
            </td>
            <td class="row-actions">
              <button
                type="button"
                class="row-action-button"
                @click="openBuilder(page.path)"
              >
                Open Builder
              </button>
              <button
                type="button"
                class="row-action-button"
                @click="openCloneModal(page)"
              >
                Clone
              </button>
              <button
                type="button"
                class="row-action-link"
                @click="openPublicPage(page.path)"
              >
                View
              </button>
              <button
                type="button"
                class="row-action-button row-action-button--danger"
                :disabled="Boolean(deletingById[page.id])"
                @click="handleDelete(page)"
              >
                {{ deletingById[page.id] ? "Deleting…" : "Delete" }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="pagination">
      <label class="pages-field pages-field--compact pages-field--pagination">
        <span>Page Size</span>
        <select v-model.number="pageSize">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </label>
      <button
        type="button"
        class="pages-button"
        :disabled="!hasPreviousPage"
        @click="currentPage -= 1"
      >
        Previous
      </button>
      <p>Page {{ currentPage }} of {{ totalPageCount }}</p>
      <button
        type="button"
        class="pages-button"
        :disabled="!hasNextPage"
        @click="currentPage += 1"
      >
        Next
      </button>
    </section>

    <div v-if="isCreateModalOpen" class="content-admin-pages__modal">
      <div class="modal__backdrop" @click="closeCreateModal" />
      <section class="modal__panel" role="dialog" aria-modal="true">
        <header class="modal__header">
          <div>
            <h2 class="modal__title">Create New Page</h2>
            <p class="modal__subtitle">
              Provide the basic page metadata to bootstrap the builder.
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
        </header>

        <form class="modal__form" @submit.prevent="handleCreateNewPage">
          <div class="modal__field">
            <label for="create-page-path">Page path</label>
            <input id="create-page-path" v-model="createForm.path" type="text" required placeholder="/new-page" />
          </div>
          <div class="modal__field">
            <label for="create-page-title">Title</label>
            <input id="create-page-title" v-model="createForm.title" type="text" required />
          </div>
          <div class="modal__field-grid">
            <div class="modal__field">
              <label for="create-page-seo-title">SEO title</label>
              <input id="create-page-seo-title" v-model="createForm.seoTitle" type="text" />
            </div>
            <div class="modal__field">
              <label for="create-page-seo-description">SEO description</label>
              <input id="create-page-seo-description" v-model="createForm.seoDescription" type="text" />
            </div>
          </div>
          <div class="modal__field">
            <label for="create-page-seo-image">Social image URL (absolute)</label>
            <input id="create-page-seo-image" v-model="createForm.seoImage" type="url" />
          </div>
          <div class="modal__field">
            <label for="create-page-meta">Meta JSON (optional)</label>
            <textarea id="create-page-meta" v-model="createForm.meta" rows="3"></textarea>
          </div>

          <div v-if="pageActionError" class="modal__error">
            {{ pageActionError }}
          </div>

          <footer class="modal__actions">
            <button type="button" class="pages-button" @click="closeCreateModal">Cancel</button>
            <button type="submit" class="pages-button pages-button--primary" :disabled="isCreatePending">
              {{ isCreatePending ? "Creating…" : "Create Page" }}
            </button>
          </footer>
        </form>
      </section>
    </div>

    <div v-if="isCloneModalOpen" class="content-admin-pages__modal">
      <div class="modal__backdrop" @click="closeCloneModal" />
      <section class="modal__panel" role="dialog" aria-modal="true">
        <header class="modal__header">
          <div>
            <h2 class="modal__title">Clone Page</h2>
            <p class="modal__subtitle">
              Adjust metadata for the duplicated page.
              <template v-if="cloneSourcePage">Source: {{ cloneSourcePage.path }}</template>
            </p>
          </div>
          <button
            type="button"
            class="modal__close"
            aria-label="Close"
            @click="closeCloneModal"
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
        </header>

        <form class="modal__form" @submit.prevent="handleClonePage">
          <div class="modal__field">
            <label for="clone-page-path">Page path</label>
            <input id="clone-page-path" v-model="cloneForm.path" type="text" required placeholder="/source-copy" />
          </div>
          <div class="modal__field">
            <label for="clone-page-title">Title</label>
            <input id="clone-page-title" v-model="cloneForm.title" type="text" required />
          </div>
          <div class="modal__field-grid">
            <div class="modal__field">
              <label for="clone-page-seo-title">SEO title</label>
              <input id="clone-page-seo-title" v-model="cloneForm.seoTitle" type="text" />
            </div>
            <div class="modal__field">
              <label for="clone-page-seo-description">SEO description</label>
              <input id="clone-page-seo-description" v-model="cloneForm.seoDescription" type="text" />
            </div>
          </div>
          <div class="modal__field">
            <label for="clone-page-seo-image">Social image URL (absolute)</label>
            <input id="clone-page-seo-image" v-model="cloneForm.seoImage" type="url" />
          </div>
          <div class="modal__field">
            <label for="clone-page-meta">Meta JSON (optional)</label>
            <textarea id="clone-page-meta" v-model="cloneForm.meta" rows="3"></textarea>
          </div>

          <div v-if="pageActionError" class="modal__error">
            {{ pageActionError }}
          </div>

          <footer class="modal__actions">
            <button type="button" class="pages-button" @click="closeCloneModal">Cancel</button>
            <button type="submit" class="pages-button pages-button--primary" :disabled="isClonePending">
              {{ isClonePending ? "Cloning…" : "Clone Page" }}
            </button>
          </footer>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.content-admin-pages {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.content-admin-pages__header {
  display: grid;
  gap: 0.4rem;
}

.content-admin-pages__eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
}

.content-admin-pages__title {
  margin: 0;
  font-size: clamp(1.4rem, 2vw, 1.85rem);
  line-height: 1.2;
  color: #0f172a;
}

.content-admin-pages__description {
  margin: 0;
  color: #334155;
}

.i18n-admin-panel {
  border: 1px solid #cbd5e1;
  border-radius: 0.75rem;
  background: #fff;
  padding: 0.9rem 1rem;
  display: grid;
  gap: 0.8rem;
}

.i18n-admin-panel__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.35rem;
}

.i18n-admin-panel__header-text {
  display: grid;
  gap: 0.35rem;
}

.i18n-admin-panel__header h2 {
  margin: 0;
  color: #0f172a;
  font-size: 1.05rem;
}

.i18n-admin-panel__header p {
  margin: 0;
  color: #475569;
  font-size: 0.84rem;
}

.i18n-admin-panel__hint {
  margin: 0;
  color: #334155;
  font-size: 0.82rem;
}

.i18n-admin-panel__compact {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.i18n-admin-panel__toggle {
  min-width: 96px;
  justify-content: center;
}

.i18n-admin-panel__grid {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.i18n-admin-panel__section {
  border: 1px solid #e2e8f0;
  border-radius: 0.65rem;
  padding: 0.75rem;
  display: grid;
  gap: 0.6rem;
}

.i18n-admin-panel__section h3 {
  margin: 0;
  color: #0f172a;
  font-size: 0.9rem;
}

.i18n-admin-panel__section-hint {
  margin: 0;
  color: #64748b;
  font-size: 0.78rem;
}

.i18n-locale-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.i18n-locale-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.77rem;
  color: #334155;
}

.i18n-locale-add {
  display: flex;
  gap: 0.5rem;
}

.i18n-locale-add input {
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 0.45rem;
  padding: 0.45rem 0.55rem;
  font-size: 0.84rem;
}

.i18n-admin-panel__notice {
  margin: 0;
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #166534;
  border-radius: 0.5rem;
  padding: 0.5rem 0.65rem;
  font-size: 0.82rem;
}

.i18n-admin-panel__error {
  margin: 0;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 0.5rem;
  padding: 0.5rem 0.65rem;
  font-size: 0.82rem;
}

.pages-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
}

.pages-toolbar__group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.pages-toolbar__group--right {
  justify-content: flex-end;
}

.pages-field {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.pages-field span {
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
}

.pages-field input,
.pages-field select {
  border: 1px solid #cbd5e1;
  border-radius: 0.45rem;
  padding: 0.45rem 0.55rem;
  font-size: 0.85rem;
  background: #fff;
}

.pages-field--compact {
  min-width: 120px;
}

.publication-select {
  min-width: 112px;
  border: 1px solid #cbd5e1;
  border-radius: 0.45rem;
  padding: 0.38rem 0.5rem;
  background: #fff;
  color: #0f172a;
  font-size: 0.82rem;
  font-weight: 600;
}

.publication-select:disabled {
  opacity: 0.65;
  cursor: wait;
}

.pages-button {
  border: 1px solid #cbd5e1;
  border-radius: 0.45rem;
  padding: 0.45rem 0.75rem;
  background: #fff;
  color: #0f172a;
  font-weight: 600;
  font-size: 0.85rem;
}

.pages-button--primary {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

.pages-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pages-summary {
  font-size: 0.88rem;
  color: #334155;
}

.pages-summary p {
  margin: 0;
}

.pages-summary__notice {
  margin-top: 0.4rem;
  color: #166534;
}

.pages-error {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  border-radius: 0.5rem;
  padding: 0.65rem 0.8rem;
  font-size: 0.85rem;
}

.pages-table-wrap {
  border: 1px solid #e2e8f0;
  border-radius: 0.65rem;
  overflow: auto;
  background: #fff;
}

.pages-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 980px;
}

.pages-table th,
.pages-table td {
  text-align: left;
  padding: 0.7rem 0.75rem;
  border-bottom: 1px solid #e2e8f0;
  vertical-align: middle;
}

.pages-table th {
  background: #f8fafc;
  color: #334155;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.pages-column-sort {
  border: 0;
  background: transparent;
  padding: 0;
  margin: 0;
  color: inherit;
  font: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
}

.pages-table .actions-col {
  min-width: 260px;
}

.empty-cell {
  text-align: center;
  color: #64748b;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.8rem;
}

.status-pill {
  display: inline-block;
  border-radius: 999px;
  padding: 0.2rem 0.55rem;
  font-size: 0.73rem;
  font-weight: 600;
}

.status-pill--ok {
  background: #dcfce7;
  color: #166534;
}

.status-pill--warn {
  background: #fef9c3;
  color: #854d0e;
}

.status-pill--muted {
  background: #e2e8f0;
  color: #334155;
}

.locale-cell {
  display: grid;
  gap: 0.35rem;
}

.locale-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.locale-badge {
  display: inline-block;
  border-radius: 999px;
  padding: 0.14rem 0.45rem;
  font-size: 0.67rem;
  font-weight: 700;
  line-height: 1.2;
}

.locale-badge--ok {
  background: #dcfce7;
  color: #166534;
}

.locale-badge--missing {
  background: #fee2e2;
  color: #991b1b;
}

.locale-single-note {
  margin: 0;
  font-size: 0.72rem;
  color: #64748b;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.row-action-button,
.row-action-link {
  border: 1px solid #cbd5e1;
  border-radius: 0.4rem;
  padding: 0.3rem 0.55rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #0f172a;
  background: #fff;
  text-decoration: none;
}

.row-action-button--danger {
  color: #b91c1c;
  border-color: #fecaca;
}

.row-action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
}

.pages-field--pagination {
  min-width: 100px;
}

.pagination p {
  margin: 0;
  color: #334155;
  font-size: 0.85rem;
}

.content-admin-pages__modal {
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

.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.modal__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.modal__subtitle {
  margin: 0.25rem 0 0;
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

.modal__field textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.modal__field input:focus,
.modal__field textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.3);
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

</style>
