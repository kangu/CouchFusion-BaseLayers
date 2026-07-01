<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { BunnyFontCatalogEntry } from "#content/app/composables/useContentFontSettings";

// props
interface FontBrowserDialogProps {
  isOpen: boolean;
  fonts: readonly BunnyFontCatalogEntry[];
  loading?: boolean;
  installing?: boolean;
  installingSlug?: string | null;
}

const props = withDefaults(defineProps<FontBrowserDialogProps>(), {
  loading: false,
  installing: false,
  installingSlug: null,
});

const emit = defineEmits<{
  (event: "close"): void;
  (event: "install", font: BunnyFontCatalogEntry): void;
}>();

// local data
const searchQuery = ref("");
const PREVIEW_FONT_LIMIT = 12;
const FONT_BROWSER_PREVIEW_ATTR = "data-content-font-browser-preview";

/**
 * Builds a Bunny stylesheet URL for a lightweight preview profile.
 */
const buildPreviewHref = (font: BunnyFontCatalogEntry) => {
  const previewWeights = font.weights.includes(700)
    ? [400, 700]
    : [font.weights[0] ?? 400];
  const variants = previewWeights.map(String).join(",");

  return `https://fonts.bunny.net/css?family=${encodeURIComponent(`${font.slug}:${variants}`)}`;
};

/**
 * Remove preview links injected by this dialog.
 */
const removePreviewLinks = () => {
  if (!import.meta.client) {
    return;
  }

  document
    .querySelectorAll<HTMLLinkElement>(`link[${FONT_BROWSER_PREVIEW_ATTR}="1"]`)
    .forEach((link) => link.remove());
};

/**
 * Inject only the currently visible preview font stylesheets.
 */
const syncPreviewLinks = (hrefs: string[]) => {
  if (!import.meta.client) {
    return;
  }

  removePreviewLinks();
  if (!props.isOpen) {
    return;
  }

  for (const href of hrefs) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute(FONT_BROWSER_PREVIEW_ATTR, "1");
    document.head.appendChild(link);
  }
};

/**
 * Format category metadata for compact card display.
 */
const formatCategory = (font: BunnyFontCatalogEntry) =>
  [font.category, font.defSubset].filter(Boolean).join(" / ") || "Bunny Font";

// computed
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLowerCase());
const filteredFonts = computed(() => {
  const query = normalizedSearchQuery.value;
  const source = Array.isArray(props.fonts) ? props.fonts : [];
  if (!query) {
    return source;
  }

  return source.filter((font) => {
    const haystack = [
      font.label,
      font.slug,
      font.category,
      font.defSubset,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});
const previewFonts = computed(() => filteredFonts.value.slice(0, PREVIEW_FONT_LIMIT));
const previewFontCssHrefs = computed(() => previewFonts.value.map(buildPreviewHref));

watch(
  () => [props.isOpen, previewFontCssHrefs.value.join("|")],
  () => syncPreviewLinks(previewFontCssHrefs.value),
  { immediate: true },
);

onBeforeUnmount(removePreviewLinks);
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="font-browser-dialog" role="dialog" aria-modal="true">
      <button
        type="button"
        class="font-browser-dialog__backdrop"
        aria-label="Close font browser"
        @click="emit('close')"
      />
      <section class="font-browser-dialog__panel" aria-label="Bunny font browser">
        <header class="font-browser-dialog__header">
          <div>
            <p class="font-browser-dialog__eyebrow">Bunny Fonts</p>
            <h2>Add a font</h2>
          </div>
          <button type="button" class="font-browser-dialog__close" @click="emit('close')">
            Close
          </button>
        </header>

        <div class="font-browser-dialog__toolbar">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search fonts..."
            class="font-browser-dialog__search"
          />
          <span class="font-browser-dialog__count">
            {{ filteredFonts.length }} fonts
          </span>
        </div>

        <div v-if="loading" class="font-browser-dialog__state">
          Loading Bunny font catalog...
        </div>
        <div v-else-if="filteredFonts.length === 0" class="font-browser-dialog__state">
          No fonts match your search.
        </div>
        <div v-else class="font-browser-dialog__grid">
          <article
            v-for="font in previewFonts"
            :key="font.slug"
            class="font-browser-card"
          >
            <div class="font-browser-card__topline">
              <span>{{ formatCategory(font) }}</span>
              <span v-if="font.isVariable">Variable</span>
            </div>
            <p
              class="font-browser-card__sample"
              :style="{ fontFamily: `'${font.label}', sans-serif` }"
            >
              The quick brown fox jumps over Bitcoin jobs.
            </p>
            <div class="font-browser-card__footer">
              <div>
                <h3>{{ font.label }}</h3>
                <p>{{ font.weights.join(', ') }}</p>
              </div>
              <button
                type="button"
                class="font-browser-card__install"
                :disabled="installing"
                @click="emit('install', font)"
              >
                {{
                  installingSlug === font.slug
                    ? "Installing..."
                    : "Install"
                }}
              </button>
            </div>
          </article>
        </div>

        <p v-if="filteredFonts.length > previewFonts.length" class="font-browser-dialog__limit">
          Showing the first {{ previewFonts.length }} matches. Refine the search to preview more specific fonts.
        </p>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.font-browser-dialog {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  padding: 24px;
}

.font-browser-dialog__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: rgba(15, 23, 42, 0.48);
}

.font-browser-dialog__panel {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  width: min(1120px, 100%);
  max-height: min(820px, calc(100vh - 48px));
  overflow: hidden;
  border: 1px solid #d8dde7;
  border-radius: 12px;
  background: #f8fafc;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.28);
}

.font-browser-dialog__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid #e2e8f0;
  background: #ffffff;
}

.font-browser-dialog__header h2 {
  margin: 0;
  color: #111827;
  font-size: 1.25rem;
  font-weight: 700;
}

.font-browser-dialog__eyebrow {
  margin: 0 0 4px;
  color: #f97316;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.font-browser-dialog__close,
.font-browser-card__install {
  border: 1px solid #d8dde7;
  border-radius: 7px;
  background: #ffffff;
  color: #111827;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
}

.font-browser-dialog__close {
  padding: 8px 12px;
}

.font-browser-dialog__toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.font-browser-dialog__search {
  min-width: 0;
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px 12px;
  color: #111827;
  font: inherit;
  font-size: 0.9rem;
}

.font-browser-dialog__count,
.font-browser-dialog__limit {
  color: #64748b;
  font-size: 0.78rem;
  font-weight: 700;
}

.font-browser-dialog__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  min-height: 0;
  overflow: auto;
  padding: 20px 24px 24px;
}

.font-browser-card {
  display: grid;
  gap: 16px;
  min-height: 230px;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  background: #ffffff;
  padding: 16px;
}

.font-browser-card__topline,
.font-browser-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.font-browser-card__topline {
  color: #64748b;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.font-browser-card__sample {
  margin: 0;
  color: #111827;
  font-size: 1.5rem;
  font-weight: 400;
  line-height: 1.18;
}

.font-browser-card__footer h3 {
  margin: 0 0 4px;
  color: #111827;
  font-size: 0.95rem;
  font-weight: 800;
}

.font-browser-card__footer p {
  margin: 0;
  color: #64748b;
  font-size: 0.75rem;
}

.font-browser-card__install {
  padding: 8px 12px;
  background: #111827;
  color: #ffffff;
}

.font-browser-card__install:disabled {
  cursor: progress;
  opacity: 0.6;
}

.font-browser-dialog__state {
  padding: 48px 24px;
  color: #64748b;
  text-align: center;
}

.font-browser-dialog__limit {
  margin: 0;
  padding: 0 24px 20px;
}
</style>
