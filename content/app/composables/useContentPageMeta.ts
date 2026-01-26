import { computed, type Ref } from "vue";
import { useSocialImageMeta } from "#content/app/composables/useSocialImageMeta";
import type { MinimalContentDocument } from "#content/app/utils/contentBuilder";

interface UseContentPageMetaOptions {
  pageDocument: Ref<MinimalContentDocument | null>;
  defaultTitle: string;
  defaultDescription: string;
}

export const useContentPageMeta = (options: UseContentPageMetaOptions) => {
  const { pageDocument, defaultTitle, defaultDescription } = options;

  const { socialImageMeta } = useSocialImageMeta({
    image: computed(() => pageDocument.value?.seo.image),
  });

  const head = computed(() => {
    const title =
      pageDocument.value?.seo.title ||
      pageDocument.value?.title ||
      defaultTitle;
    const description =
      pageDocument.value?.seo.description ||
      defaultDescription;

    const meta = [
      {
        name: "description",
        content: description,
      },
      ...(socialImageMeta.value ?? []),
    ];

    return {
      title,
      meta,
    };
  });

  return {
    head,
  };
};
