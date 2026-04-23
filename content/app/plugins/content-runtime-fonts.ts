type RuntimeFontPreloadDescriptor = {
  id: string;
  href: string;
};

type RuntimeFontPreloadResponse = {
  success?: boolean;
  runtimeCssVersion?: number;
  preloads?: RuntimeFontPreloadDescriptor[];
};

export default defineNuxtPlugin(async () => {
  const runtimeCssVersion = useState<number>(
    "content-font-runtime-css-version",
    () => Date.now(),
  );

  const preloadDescriptors = useState<RuntimeFontPreloadDescriptor[]>(
    "content-font-runtime-preloads",
    () => [
      {
        id: "sans-400-normal",
        href: "/api/content/fonts/active/sans-400-normal.woff2",
      },
      {
        id: "sans-700-normal",
        href: "/api/content/fonts/active/sans-700-normal.woff2",
      },
    ],
  );

  try {
    const requestFetch = import.meta.server ? useRequestFetch() : $fetch;
    const response = await requestFetch<RuntimeFontPreloadResponse>(
      "/api/content/fonts/preload",
    );

    if (response?.success && Array.isArray(response.preloads) && response.preloads.length > 0) {
      preloadDescriptors.value = response.preloads
        .filter(
          (entry): entry is RuntimeFontPreloadDescriptor =>
            typeof entry?.id === "string" &&
            entry.id.trim().length > 0 &&
            typeof entry?.href === "string" &&
            entry.href.trim().length > 0,
        )
        .map((entry) => ({
          id: entry.id.trim(),
          href: entry.href.trim(),
        }));
    }

    if (typeof response?.runtimeCssVersion === "number" && Number.isFinite(response.runtimeCssVersion)) {
      runtimeCssVersion.value = response.runtimeCssVersion;
    }
  } catch {}

  useHead({
    link: [
      ...preloadDescriptors.value.map((entry) => ({
        id: `content-runtime-font-preload-${entry.id}`,
        rel: "preload",
        as: "font",
        type: "font/woff2",
        crossorigin: "anonymous",
        href: entry.href,
      })),
      {
        id: "content-runtime-fonts",
        rel: "stylesheet",
        href: computed(
          () =>
            `/api/content/fonts/runtime.css?v=${encodeURIComponent(
              String(runtimeCssVersion.value),
            )}`,
        ),
      },
    ],
  });
});
