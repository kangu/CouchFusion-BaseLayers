import type { MaybeRefOrGetter } from "vue";

interface AdminWorkspaceHeaderTitle {
  path: string;
  title: string;
}

/** Title override for the admin header, tied to the route that set it. */
export const useAdminWorkspaceHeaderState = () =>
  useState<AdminWorkspaceHeaderTitle | null>("aw-header-title", () => null);

/**
 * Show a custom title in the admin header for the current page instead of the
 * navigation label. Page actions can be teleported into `#aw-header-actions`.
 */
export const useAdminWorkspaceHeaderTitle = (title: MaybeRefOrGetter<string>) => {
  const route = useRoute();
  const state = useAdminWorkspaceHeaderState();
  const path = route.path;

  watchEffect(() => {
    state.value = { path, title: toValue(title) };
  });
};
