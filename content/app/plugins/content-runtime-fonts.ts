export default defineNuxtPlugin(() => {
  const runtimeCssVersion = useState<number>(
    "content-font-runtime-css-version",
    () => Date.now(),
  );

  const preloadDescriptors = [
    {
      id: "sans-400-normal",
      href: "/api/content/fonts/active/sans-400-normal.woff2",
    },
    {
      id: "sans-700-normal",
      href: "/api/content/fonts/active/sans-700-normal.woff2",
    },
  ] as const;

  useHead({
    link: [
      ...preloadDescriptors.map((entry) => ({
        id: `content-runtime-font-preload-${entry.id}`,
        rel: "preload",
        as: "font",
        type: "font/woff2",
        crossorigin: "anonymous",
        href: computed(
          () =>
            `${entry.href}?v=${encodeURIComponent(String(runtimeCssVersion.value))}`,
        ),
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
