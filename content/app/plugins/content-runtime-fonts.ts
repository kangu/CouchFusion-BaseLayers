export default defineNuxtPlugin(() => {
  const runtimeCssVersion = useState<number>(
    "content-font-runtime-css-version",
    () => Date.now(),
  );

  useHead({
    link: [
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
