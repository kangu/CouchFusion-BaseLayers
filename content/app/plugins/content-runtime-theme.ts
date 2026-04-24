import { resolveContentRuntimeStylingConfig } from "#content/utils/runtime-styling";

/**
 * Runtime theme stylesheet injector.
 *
 * @remarks
 * Mirrors the runtime-font head injection pattern:
 * - keeps a reactive stylesheet version marker shared with admin composables,
 * - loads runtime theme CSS from content-layer API so applied theme values are server-driven.
 */
export default defineNuxtPlugin(() => {
  const runtimeConfig = useRuntimeConfig();
  const runtimeStyling = resolveContentRuntimeStylingConfig(
    runtimeConfig.public?.content ?? runtimeConfig.content ?? {},
  );
  if (!runtimeStyling.themeEnabled) {
    return;
  }

  const runtimeCssVersion = useState<number>(
    "content-theme-runtime-css-version",
    () => Date.now(),
  );

  useHead({
    link: [
      {
        id: "content-runtime-theme",
        rel: "stylesheet",
        href: computed(
          () =>
            `/api/content/theme/runtime.css?v=${encodeURIComponent(
              String(runtimeCssVersion.value),
            )}`,
        ),
      },
    ],
  });
});
