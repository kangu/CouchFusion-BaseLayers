/**
 * Direct preload descriptor returned by `/api/content/fonts/preload`.
 */
type RuntimeFontPreloadDescriptor = {
  id: string;
  href: string;
};

/** Minimal server response contract for runtime preload bootstrap. */
type RuntimeFontPreloadResponse = {
  success?: boolean;
  runtimeCssVersion?: number;
  preloads?: RuntimeFontPreloadDescriptor[];
};

/**
 * Runtime font head-injection plugin.
 *
 * @remarks
 * Responsibilities:
 * - fetch direct attachment URLs for critical preloads (sans 400/700),
 * - inject preload links and runtime stylesheet tag,
 * - keep stylesheet query param tied to reactive runtimeCssVersion state.
 *
 * API rationale:
 * - direct preload URLs avoid duplicate network fetches caused by preload redirects,
 * - stylesheet URL remains versioned so newly applied profiles can be forced immediately.
 */
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
    // Use request-bound fetch on server so cookies/session context propagate consistently.
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

  // Inject links once per app bootstrap; runtimeCssVersion updates stylesheet URL reactively.
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
