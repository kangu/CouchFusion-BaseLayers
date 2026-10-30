import { computed } from "vue";
import {
  defineNuxtPlugin,
  useHead,
  useRoute,
  useRuntimeConfig,
} from "#imports";
import {
  resolveContentI18nConfig,
  resolveContentLocalePath,
} from "#content/utils/i18n";

export default defineNuxtPlugin(() => {
  const route = useRoute();
  const runtimeConfig = useRuntimeConfig();
  const contentI18nConfig = resolveContentI18nConfig(
    (runtimeConfig.public?.content?.i18n ?? (import.meta.server ? runtimeConfig.content?.i18n : undefined)),
  );

  const activeLocale = computed(
    () => resolveContentLocalePath(route.path, contentI18nConfig).locale,
  );
  const activeDirection = computed(() =>
    activeLocale.value.toLowerCase() === "ar-ae" ? "rtl" : "ltr",
  );

  useHead(() => ({
    htmlAttrs: {
      lang: activeLocale.value,
      dir: activeDirection.value,
    },
  }));
});
