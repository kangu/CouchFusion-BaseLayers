import { computed, unref, watch, type MaybeRef, type Ref } from "vue";
import { useAsyncData, createError } from "#imports";
import { useContentPagesStore } from "#content/app/stores/pages";
import { contentToMinimalDocument } from "#content/utils/page-documents";
import type { ContentPageSummary } from "#content/types/content-page";
import { normalizePagePath } from "#content/utils/page";

interface UseContentPageDocumentResult {
  pending: Ref<boolean>;
  resolvedSummary: Ref<ContentPageSummary | null>;
  pageDocument: Ref<ReturnType<typeof contentToMinimalDocument> | null>;
  normalizedRoutePath: Ref<string>;
}

export const useContentPageDocument = (
  path: MaybeRef<string>,
): UseContentPageDocumentResult => {
  const contentStore = useContentPagesStore();
  const normalizedRoutePath = computed(() => normalizePagePath(unref(path)));

  const { data: pageSummary, pending } = useAsyncData(
    () => `content-page:${normalizedRoutePath.value}`,
    () => contentStore.fetchPageOrThrow(normalizedRoutePath.value),
    {
      watch: [() => normalizedRoutePath.value],
    },
  );

  const liveSummary = computed<ContentPageSummary | null>(() => {
    const live = contentStore.getPage(normalizedRoutePath.value);
    return live ?? null;
  });

  const resolvedSummary = computed<ContentPageSummary | null>(() => {
    return liveSummary.value ?? pageSummary.value ?? null;
  });

  const pageDocument = computed(() => {
    const summary = resolvedSummary.value;
    if (!summary?.document) {
      return null;
    }
    return contentToMinimalDocument(summary.document);
  });

  watch(pageDocument, (newDoc) => {
    if (!pending.value && newDoc === null && resolvedSummary.value !== undefined) {
      throw createError({
        statusCode: 404,
        statusMessage: "Page not found",
      });
    }
  });

  return {
    pending,
    resolvedSummary,
    pageDocument,
    normalizedRoutePath,
  };
};
