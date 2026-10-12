/**
 * Dashboard state (site, range, compare, filters) kept in the route query so
 * views are shareable and survive reloads.
 */
import { computed, ref } from "vue";
import type { AnalyticsApi } from "./useAnalyticsApi";
import { errorMessage } from "./useAnalyticsApi";

export interface UiFilter {
  dim: string;
  op: "eq" | "neq" | "contains" | "not_contains";
  value: string;
}

export const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "12m", label: "Last 12 months" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
];

/**
 * Each app has exactly one website, loaded from `GET site`.
 * @param api analytics API client (admin or read-only share)
 */
export const useAnalyticsState = (api: AnalyticsApi) => {
  // composables
  const route = useRoute();
  const router = useRouter();

  // local data
  const sites = ref<any[]>([]);
  const status = ref<any>(null);
  const loadingSites = ref(false);
  const siteError = ref<string | null>(null);

  // computed
  const setQuery = (patch: Record<string, string | undefined>) => {
    const query = { ...route.query, ...patch };
    for (const key of Object.keys(query)) if (query[key] === undefined || query[key] === "") delete query[key];
    void router.replace({ query });
  };

  const site = computed(() => sites.value[0] ?? null);
  const siteId = computed<string>(() => String(site.value?.id ?? ""));
  const range = computed<string>({
    get: () => String(route.query.range || "7d"),
    set: (value) => setQuery({ range: value, ...(value !== "custom" ? { from: undefined, to: undefined } : {}) }),
  });
  const from = computed<string>({ get: () => String(route.query.from || ""), set: (v) => setQuery({ from: v }) });
  const to = computed<string>({ get: () => String(route.query.to || ""), set: (v) => setQuery({ to: v }) });
  const compare = computed<boolean>({
    get: () => route.query.compare === "1",
    set: (value) => setQuery({ compare: value ? "1" : undefined }),
  });
  const filters = computed<UiFilter[]>({
    get: () => {
      try {
        const parsed = JSON.parse(String(route.query.f || "[]"));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
    set: (value) => setQuery({ f: value.length ? JSON.stringify(value) : undefined }),
  });

  /** Query params shared by every stats request. */
  const params = computed(() => ({
    range: range.value === "custom" && !from.value ? "7d" : range.value,
    from: range.value === "custom" ? from.value : undefined,
    to: range.value === "custom" ? to.value || from.value : undefined,
    filters: filters.value.length ? JSON.stringify(filters.value) : undefined,
  }));

  // local page api
  const addFilter = (filter: UiFilter) => {
    const rest = filters.value.filter((f) => !(f.dim === filter.dim && f.op === filter.op));
    filters.value = [...rest, filter];
  };
  const removeFilter = (index: number) => {
    filters.value = filters.value.filter((_, i) => i !== index);
  };
  const clearFilters = () => {
    filters.value = [];
  };

  const loadSites = async () => {
    loadingSites.value = true;
    siteError.value = null;
    try {
      if (!api.readonly) status.value = await api.get("status");
      // Skip the site call while local storage is off: the gate explains why.
      if (api.readonly || status.value?.storesLocally) sites.value = [(await api.get("site")).site];
    } catch (error) {
      siteError.value = errorMessage(error);
    } finally {
      loadingSites.value = false;
    }
  };

  return {
    sites,
    status,
    site,
    siteId,
    range,
    from,
    to,
    compare,
    filters,
    params,
    loadingSites,
    siteError,
    addFilter,
    removeFilter,
    clearFilters,
    loadSites,
  };
};

export type AnalyticsState = ReturnType<typeof useAnalyticsState>;
