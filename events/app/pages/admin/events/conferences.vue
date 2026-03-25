<script setup lang="ts">
interface ConferenceItem {
  _id: string;
  _rev?: string;
  type: "conference";
  name: string;
  slug: string;
  year: number | null;
  websiteUrl: string | null;
  xAccountUrl: string | null;
  location: string | null;
  city: string | null;
  monthLabel: string | null;
  startDateLabel: string | null;
  startDateIso: string | null;
  dateRangeLabel: string | null;
  country: string | null;
  continent: string | null;
  hasAirtable: boolean;
  isPublished: boolean;
  recreateNextYear: boolean;
  discountCode: string | null;
  discountLabel: string | null;
  commissionLabel: string | null;
  status: string;
  notes: string | null;
  ownerTodo: string | null;
  commissionEarnedLabel: string | null;
  commissionReceived: boolean | null;
  contactName: string | null;
  contactChannel: string | null;
  bitvocationParticipation: "yes" | "no" | "unknown";
  ticketsSold: number | null;
  source: {
    format: "csv-semicolon";
    rowNumber: number;
    importedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ConferenceListPayload {
  conferences: ConferenceItem[];
  total: number;
  unfilteredCounts: {
    total: number;
    inProgress: number;
    published: number;
    draft: number;
  };
  statusCounts: Record<string, number>;
  publicationCounts: {
    published: number;
    draft: number;
  };
  yearOptions: number[];
  continentOptions: string[];
}

interface ImportPreviewPayload {
  success: boolean;
  dryRun: boolean;
  imported: number;
  preview: ConferenceItem[];
  warnings: string[];
  meta: {
    rowCount: number;
    validConferenceCount: number;
    ignoredRowCount: number;
  };
}

interface ConferencePatchResponse {
  success: boolean;
  id: string;
  rev?: string;
  notificationPreview?: {
    requested: boolean;
    eligible: number;
    watcherNpubs: string[];
    message: string;
    changeLines: string[];
  } | null;
  notifiedWatchers?: {
    requested: boolean;
    eligible: number;
    sent: number;
    failed: number;
  } | null;
  conference: ConferenceItem;
}

interface ConferenceProposalItem {
  _id: string;
  _rev?: string;
  type: "conference_proposal";
  status: "pending" | "accepted" | "rejected";
  name: string;
  websiteUrl: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  continent: string | null;
  startDateIso: string | null;
  notes: string | null;
  conferenceId: string | null;
  submittedBy: {
    username: string;
    userDocId: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

interface ConferenceProposalListPayload {
  proposals: ConferenceProposalItem[];
  meta: {
    pending: number;
    accepted: number;
    rejected: number;
    total: number;
  };
}

interface FeaturedConferenceSummary {
  _id: string;
  name: string;
  startDateIso: string | null;
  location: string | null;
  country: string | null;
  isPublished: boolean;
}

interface FeaturedConferenceEntry {
  conferenceId: string;
  enabled: boolean;
  imageUrl: string | null;
  imageFileId: string | null;
  imageAlt: string | null;
}

interface FeaturedConferencesPayload {
  rev: string | null;
  featured: FeaturedConferenceEntry[];
  conferences: FeaturedConferenceSummary[];
}

type ConferencesSortDirection = "asc" | "desc";
type ConferencesSortKey =
  | "name"
  | "year"
  | "startDateIso"
  | "location"
  | "country"
  | "status"
  | "isPublished";
type InlineEditableField =
  | "name"
  | "startDateIso"
  | "location"
  | "country"
  | "discountCode"
  | "status";
type EditorContinentMode = "existing" | "custom";

const EDITOR_ADD_NEW_CONTINENT = "__add_new_continent__";
const STATUS_TO_BE_CONTACTED = "To be Contacted";
const STATUS_IN_PROGRESS = "In progress";
const STATUS_DONE_CONFIRMED = "Done (confirmed)";
const STATUS_DECLINED = "Declined";
const editableStatusOptions = [
  STATUS_TO_BE_CONTACTED,
  STATUS_IN_PROGRESS,
  STATUS_DONE_CONFIRMED,
  STATUS_DECLINED,
];

definePageMeta({
  layout: 'members',
  middleware: ['role-auth'],
  authAllowedRoles: ['admin', 'curator']
})

useHead({
  title: "Conference Management",
});

// == props ==

// == composables ==
const requestHeaders = process.server ? useRequestHeaders(["cookie"]) : undefined;
const runtimeConfig = useRuntimeConfig();

const queryState = reactive({
  search: "",
  status: "all",
  continent: "all",
  year: "all",
  published: "all",
  showPastEvents: false,
});

// == local data ==
const csvInput = ref("");
const csvFileName = ref<string | null>(null);
const previewData = ref<ImportPreviewPayload | null>(null);
const previewPending = ref(false);
const importPending = ref(false);
const importError = ref<string | null>(null);
const importSuccessMessage = ref<string | null>(null);
const createDialogOpen = ref(false);
const createPending = ref(false);
const createError = ref<string | null>(null);
const createSuccess = ref<string | null>(null);
const csvDialogOpen = ref(false);
const publishTogglePendingId = ref<string | null>(null);
const publishUnpublishConfirmId = ref<string | null>(null);
const publishToggleError = ref<string | null>(null);
const editorOpen = ref(false);
const editingConferenceId = ref<string | null>(null);
const editorPending = ref(false);
const editorError = ref<string | null>(null);
const editorSuccess = ref<string | null>(null);
const editorContinentMode = ref<EditorContinentMode>("existing");
const editorCustomContinent = ref("");
const inlineEditingCell = ref<{
  conferenceId: string;
  field: InlineEditableField;
} | null>(null);
const inlineDraftValue = ref("");
const inlineSavingCellKey = ref<string | null>(null);
const inlineErrorsByCell = ref<Record<string, string>>({});
const inlineStatusMenuConferenceId = ref<string | null>(null);
const notificationPreviewOpen = ref(false);
const notificationPreviewPending = ref(false);
const notificationPreviewMessage = ref("");
const notificationPreviewEligible = ref(0);
const notificationPreviewWatchers = ref<string[]>([]);
const notificationPreviewPayload = ref<Record<string, unknown> | null>(null);
const sortState = reactive<{
  key: ConferencesSortKey;
  direction: ConferencesSortDirection;
}>({
  key: "startDateIso",
  direction: "asc",
});
const featuredSearch = ref("");
const ADMIN_FILTERS_SESSION_KEY = "bv-admin-events-conferences-filters";
const featuredDraft = ref<FeaturedConferenceEntry[]>([]);
const featuredSectionExpanded = ref(false);
const proposalActionPendingId = ref<string | null>(null);
const proposalActionError = ref<string | null>(null);
const proposalDetailsOpen = ref(false);
const selectedProposal = ref<ConferenceProposalItem | null>(null);
const createFromProposalId = ref<string | null>(null);
const featuredDocumentRev = ref<string | null>(null);
const featuredSavePending = ref(false);
const featuredSaveError = ref<string | null>(null);
const featuredSaveSuccess = ref<string | null>(null);
const featuredUploadPendingIds = ref<string[]>([]);
const featuredDraggedConferenceId = ref<string | null>(null);
const editorForm = reactive({
  documentId: "",
  documentRev: "",
  documentType: "conference" as "conference",
  name: "",
  slug: "",
  year: "",
  status: "",
  bitvocationParticipation: "unknown" as "yes" | "no" | "unknown",
  websiteUrl: "",
  xAccountUrl: "",
  location: "",
  city: "",
  monthLabel: "",
  startDateLabel: "",
  startDateIso: "",
  dateRangeLabel: "",
  country: "",
  continent: "",
  discountCode: "",
  discountLabel: "",
  commissionLabel: "",
  ticketsSold: "",
  commissionEarnedLabel: "",
  commissionReceived: "unknown" as "unknown" | "yes" | "no",
  contactName: "",
  contactChannel: "",
  ownerTodo: "",
  notes: "",
  hasAirtable: false,
  recreateNextYear: false,
  isPublished: false,
  sourceFormat: "csv-semicolon",
  sourceRowNumber: "",
  sourceImportedAt: "",
  createdAt: "",
  updatedAt: "",
  notifyWatchers: false,
  notifyMessage: "",
});
const createForm = reactive({
  name: "",
  slug: "",
  year: "",
  startDateIso: "",
  startDateLabel: "",
  dateRangeLabel: "",
  monthLabel: "",
  location: "",
  city: "",
  country: "",
  continent: "",
  websiteUrl: "",
  xAccountUrl: "",
  status: STATUS_TO_BE_CONTACTED,
  bitvocationParticipation: "unknown" as "yes" | "no" | "unknown",
  contactName: "",
  contactChannel: "",
  notes: "",
  ownerTodo: "",
  isPublished: false,
  hasAirtable: false,
  recreateNextYear: false,
});

// == computed ==
const listQuery = computed(() => {
  const query: Record<string, string | number> = {
    page: 1,
    pageSize: 120,
    includePast: "true",
  };

  if (queryState.search.trim()) query.search = queryState.search.trim();
  if (queryState.status !== "all") query.status = queryState.status;
  if (queryState.continent !== "all") query.continent = queryState.continent;
  if (queryState.year !== "all") query.year = Number.parseInt(queryState.year, 10);
  if (queryState.published !== "all") query.published = queryState.published;

  return query;
});

const {
  data: conferencesData,
  pending: listPending,
  error: listError,
  refresh: refreshConferences,
} = await useAsyncData<ConferenceListPayload>(
  "events-conferences-board",
  () => {
    return $fetch("/api/events/conferences", {
      query: listQuery.value,
      headers: requestHeaders,
      credentials: "include",
    });
  },
  {
    watch: [listQuery],
    default: () => ({
      conferences: [],
      total: 0,
      unfilteredCounts: {
        total: 0,
        inProgress: 0,
        published: 0,
        draft: 0,
      },
      statusCounts: {},
      publicationCounts: {
        published: 0,
        draft: 0,
      },
      yearOptions: [],
      continentOptions: [],
    }),
  },
);

const {
  data: featuredData,
  pending: featuredPending,
  error: featuredError,
  refresh: refreshFeatured,
} = await useAsyncData<FeaturedConferencesPayload>(
  "events-featured-conferences",
  () => {
    return $fetch("/api/events/conferences/featured", {
      headers: requestHeaders,
      credentials: "include",
    });
  },
  {
    default: () => ({
      rev: null,
      featured: [],
      conferences: [],
    }),
  },
);

const {
  data: conferenceProposalsData,
  pending: proposalsPending,
  error: proposalsError,
  refresh: refreshConferenceProposals,
} = await useAsyncData<ConferenceProposalListPayload>(
  "events-conference-proposals",
  () => {
    return $fetch("/api/events/conference-proposals", {
      headers: requestHeaders,
      credentials: "include",
    });
  },
  {
    default: () => ({
      proposals: [],
      meta: {
        pending: 0,
        accepted: 0,
        rejected: 0,
        total: 0,
      },
    }),
  },
);

const conferences = computed(() => conferencesData.value?.conferences ?? []);
const conferenceProposals = computed(
  () => conferenceProposalsData.value?.proposals ?? [],
);
const conferenceProposalCounts = computed(
  () =>
    conferenceProposalsData.value?.meta ?? {
      pending: 0,
      accepted: 0,
      rejected: 0,
      total: 0,
    },
);
const pendingConferenceProposals = computed(() =>
  conferenceProposals.value.filter((proposal) => proposal.status === "pending"),
);
const currentUtcDateOnly = (): string => {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const isPastConference = (conference: ConferenceItem): boolean => {
  const startDateIso = String(conference.startDateIso ?? "").trim();
  if (!startDateIso.length) return false;
  if (DATE_ONLY_PATTERN.test(startDateIso)) {
    return startDateIso < currentUtcDateOnly();
  }

  const parsed = new Date(startDateIso);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
};
const visibleConferences = computed(() => {
  if (queryState.showPastEvents) return conferences.value;
  return conferences.value.filter((conference) => !isPastConference(conference));
});
const sortedConferences = computed(() => {
  const items = [...visibleConferences.value];
  const isDescending = sortState.direction === "desc";

  const normalizeSortText = (value: string | null | undefined): string | null => {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized.length ? normalized : null;
  };

  const compareNullableText = (
    leftValue: string | null | undefined,
    rightValue: string | null | undefined,
  ): number => {
    const left = normalizeSortText(leftValue);
    const right = normalizeSortText(rightValue);

    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;

    const result = left.localeCompare(right);
    return isDescending ? -result : result;
  };

  const compareNullableNumber = (
    leftValue: number | null | undefined,
    rightValue: number | null | undefined,
  ): number => {
    const left = typeof leftValue === "number" ? leftValue : null;
    const right = typeof rightValue === "number" ? rightValue : null;

    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;

    const result = left - right;
    return isDescending ? -result : result;
  };

  const applyBooleanDirection = (value: number): number =>
    isDescending ? -value : value;

  items.sort((left, right) => {
    let result = 0;

    switch (sortState.key) {
      case "name":
        result = compareNullableText(left.name, right.name);
        break;
      case "year":
        result = compareNullableNumber(left.year, right.year);
        break;
      case "startDateIso":
        result = compareNullableText(left.startDateIso, right.startDateIso);
        break;
      case "location":
        result = compareNullableText(left.location, right.location);
        break;
      case "country":
        result = compareNullableText(left.country, right.country);
        break;
      case "status":
        result = compareNullableText(left.status, right.status);
        break;
      case "isPublished":
        result = applyBooleanDirection(
          Number(left.isPublished) - Number(right.isPublished),
        );
        break;
      default:
        result = 0;
    }

    if (result !== 0) return result;
    return compareNullableText(left.name, right.name);
  });

  return items;
});
const unfilteredCounts = computed(
  () =>
    conferencesData.value?.unfilteredCounts ?? {
      total: 0,
      inProgress: 0,
      published: 0,
      draft: 0,
    },
);
const totalConferences = computed(() => unfilteredCounts.value.total);
const statusCounts = computed(() => conferencesData.value?.statusCounts ?? {});
const publicationCounts = computed(
  () =>
    conferencesData.value?.publicationCounts ?? {
      published: 0,
      draft: 0,
    },
);
const statusOptions = computed(() => [...editableStatusOptions]);
const yearOptions = computed(() => conferencesData.value?.yearOptions ?? []);
const continentOptions = computed(
  () => conferencesData.value?.continentOptions ?? [],
);
const featuredCatalog = computed(() => featuredData.value?.conferences ?? []);
const featuredCatalogById = computed(() => {
  const map = new Map<string, FeaturedConferenceSummary>();
  for (const conference of featuredCatalog.value) {
    map.set(conference._id, conference);
  }
  return map;
});
const featuredDraftIds = computed(
  () => new Set(featuredDraft.value.map((entry) => entry.conferenceId)),
);
const featuredCards = computed(() =>
  featuredDraft.value.map((entry) => ({
    entry,
    conference:
      featuredCatalogById.value.get(entry.conferenceId) ?? {
        _id: entry.conferenceId,
        name: `Unknown conference (${entry.conferenceId})`,
        startDateIso: null,
        location: null,
        country: null,
        isPublished: false,
      },
  })),
);
const featuredAvailableConferences = computed(() => {
  const search = featuredSearch.value.trim().toLowerCase();

  return featuredCatalog.value.filter((conference) => {
    if (featuredDraftIds.value.has(conference._id)) {
      return false;
    }

    if (!search.length) {
      return true;
    }

    const haystack = [conference.name, conference.location, conference.country]
      .map((value) => String(value ?? "").trim().toLowerCase())
      .join(" ");

    return haystack.includes(search);
  });
});
const publicSiteBaseUrl = computed(() => {
  const configuredSiteUrl = runtimeConfig.public?.siteUrl;
  if (typeof configuredSiteUrl === "string" && configuredSiteUrl.trim().length > 0) {
    return configuredSiteUrl.trim().replace(/\/+$/, "");
  }

  if (process.client && typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, "");
  }

  return "";
});
const editorPublicUrl = computed(() => {
  const normalizedSlug = editorForm.slug.trim();
  if (!normalizedSlug) {
    return "";
  }

  const redirectPath = `/to/${encodeURIComponent(normalizedSlug)}`;
  return publicSiteBaseUrl.value ? `${publicSiteBaseUrl.value}${redirectPath}` : redirectPath;
});

const inProgressCount = computed(
  () => unfilteredCounts.value.inProgress,
);
const withContactCount = computed(
  () =>
    conferences.value.filter((conference) => Boolean(conference.contactChannel))
      .length,
);
const publishedCount = computed(() => unfilteredCounts.value.published);
const draftCount = computed(() => unfilteredCounts.value.draft);

const previewRows = computed(() => previewData.value?.preview ?? []);
const previewWarnings = computed(() => previewData.value?.warnings ?? []);
const previewMeta = computed(
  () =>
    previewData.value?.meta ?? {
      rowCount: 0,
      validConferenceCount: 0,
      ignoredRowCount: 0,
    },
);
// == lifecycle ==

// == watchers ==
watch(
  featuredData,
  (payload) => {
    featuredDraft.value = (payload?.featured ?? []).map((entry) => ({
      conferenceId: String(entry.conferenceId ?? "").trim(),
      enabled: entry.enabled !== false,
      imageUrl:
        typeof entry.imageUrl === "string" && entry.imageUrl.trim().length
          ? entry.imageUrl.trim()
          : null,
      imageFileId:
        typeof entry.imageFileId === "string" && entry.imageFileId.trim().length
          ? entry.imageFileId.trim()
          : null,
      imageAlt:
        typeof entry.imageAlt === "string" && entry.imageAlt.trim().length
          ? entry.imageAlt.trim()
          : null,
    }));
    featuredDocumentRev.value = payload?.rev ?? null;
  },
  { immediate: true },
);

watch(
  () => csvInput.value,
  () => {
    previewData.value = null;
  },
);

watch(
  () => [
    queryState.search,
    queryState.status,
    queryState.continent,
    queryState.year,
    queryState.published,
    queryState.showPastEvents,
  ],
  () => {
    if (!process.client) return;

    try {
      sessionStorage.setItem(
        ADMIN_FILTERS_SESSION_KEY,
        JSON.stringify({
          search: queryState.search,
          status: queryState.status,
          continent: queryState.continent,
          year: queryState.year,
          published: queryState.published,
          showPastEvents: queryState.showPastEvents,
        }),
      );
    } catch (persistError) {
      console.warn("Failed to persist admin conference filters", persistError);
    }
  },
);

// == local page api ==
const statusTone = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === STATUS_IN_PROGRESS.toLowerCase()) {
    return "bg-amber-100 text-amber-800 border-amber-300";
  }
  if (normalized === STATUS_DONE_CONFIRMED.toLowerCase()) {
    return "bg-emerald-100 text-emerald-800 border-emerald-300";
  }
  if (normalized === STATUS_DECLINED.toLowerCase()) {
    return "bg-rose-100 text-rose-800 border-rose-300";
  }
  return "bg-slate-100 text-slate-700 border-slate-300";
};

const hasConferenceDiscount = (conference: ConferenceItem): boolean => {
  const code = String(conference.discountCode ?? "").trim();
  const label = String(conference.discountLabel ?? "").trim();
  return code.length > 0 || label.length > 0;
};

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const formatDate = (value: string | null) => {
  if (!value) return "Date not set";

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(value);
  if (dateOnlyMatch) {
    const year = Number.parseInt(dateOnlyMatch[1], 10);
    const month = Number.parseInt(dateOnlyMatch[2], 10);
    const day = Number.parseInt(dateOnlyMatch[3], 10);
    const utcDate = new Date(Date.UTC(year, month - 1, day));

    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(utcDate);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
};

const monthPillPalette = [
  "border-emerald-200 bg-emerald-50 text-emerald-800",
  "border-blue-200 bg-blue-50 text-blue-800",
  "border-amber-200 bg-amber-50 text-amber-800",
  "border-rose-200 bg-rose-50 text-rose-800",
  "border-violet-200 bg-violet-50 text-violet-800",
  "border-cyan-200 bg-cyan-50 text-cyan-800",
  "border-lime-200 bg-lime-50 text-lime-800",
  "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
];

const conferenceMonthKey = (conference: ConferenceItem): string | null => {
  if (!conference.startDateIso) {
    return null;
  }

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(conference.startDateIso);
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}`;
  }

  const parsed = new Date(conference.startDateIso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = String(parsed.getUTCFullYear());
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const conferenceMonthLabel = (conference: ConferenceItem): string => {
  if (!conference.startDateIso) {
    return "TBA";
  }

  const dateOnlyMatch = DATE_ONLY_PATTERN.exec(conference.startDateIso);
  if (dateOnlyMatch) {
    const year = Number.parseInt(dateOnlyMatch[1], 10);
    const month = Number.parseInt(dateOnlyMatch[2], 10);
    const day = Number.parseInt(dateOnlyMatch[3], 10);
    const utcDate = new Date(Date.UTC(year, month - 1, day));

    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(utcDate);
  }

  const parsed = new Date(conference.startDateIso);
  if (Number.isNaN(parsed.getTime())) {
    return "TBA";
  }

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parsed);
};

const conferenceMonthPillClass = (conference: ConferenceItem): string => {
  const key = conferenceMonthKey(conference);
  if (!key) {
    return "border-slate-200 bg-slate-100 text-slate-700";
  }

  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % monthPillPalette.length;
  }

  return monthPillPalette[hash];
};

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toNullableText = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const inlineCellKey = (conferenceId: string, field: InlineEditableField): string =>
  `${conferenceId}:${field}`;

const isInlineEditing = (
  conferenceId: string,
  field: InlineEditableField,
): boolean =>
  inlineEditingCell.value?.conferenceId === conferenceId &&
  inlineEditingCell.value?.field === field;

const inlineCellError = (
  conferenceId: string,
  field: InlineEditableField,
): string | null => inlineErrorsByCell.value[inlineCellKey(conferenceId, field)] || null;

const inlineCellSaving = (
  conferenceId: string,
  field: InlineEditableField,
): boolean => inlineSavingCellKey.value === inlineCellKey(conferenceId, field);

const clearInlineCellError = (
  conferenceId: string,
  field: InlineEditableField,
) => {
  const key = inlineCellKey(conferenceId, field);
  if (!inlineErrorsByCell.value[key]) return;
  const next = { ...inlineErrorsByCell.value };
  delete next[key];
  inlineErrorsByCell.value = next;
};

const startInlineEdit = async (
  conference: ConferenceItem,
  field: InlineEditableField,
) => {
  if (inlineSavingCellKey.value) return;
  inlineStatusMenuConferenceId.value = null;
  clearInlineCellError(conference._id, field);
  inlineEditingCell.value = {
    conferenceId: conference._id,
    field,
  };

  switch (field) {
    case "name":
      inlineDraftValue.value = conference.name || "";
      break;
    case "startDateIso":
      inlineDraftValue.value = conference.startDateIso || "";
      break;
    case "location":
      inlineDraftValue.value = conference.location || "";
      break;
    case "country":
      inlineDraftValue.value = conference.country || "";
      break;
    case "discountCode":
      inlineDraftValue.value = conference.discountCode || "";
      break;
    case "status":
      inlineDraftValue.value = conference.status || editableStatusOptions[0] || "";
      break;
  }

  await nextTick();
  const selector = `[data-inline-editor-key="${inlineCellKey(
    conference._id,
    field,
  )}"]`;
  const input = document.querySelector(selector);
  if (input instanceof HTMLInputElement) {
    input.focus();
    if (field !== "startDateIso") {
      input.select();
    }
  }
};

const cancelInlineEdit = () => {
  inlineEditingCell.value = null;
  inlineDraftValue.value = "";
};

const toggleInlineStatusMenu = (conferenceId: string) => {
  if (inlineSavingCellKey.value) return;
  cancelInlineEdit();
  inlineStatusMenuConferenceId.value =
    inlineStatusMenuConferenceId.value === conferenceId ? null : conferenceId;
};

const inlineCurrentValue = (
  conference: ConferenceItem,
  field: InlineEditableField,
): string => {
  switch (field) {
    case "name":
      return conference.name || "";
    case "startDateIso":
      return conference.startDateIso || "";
    case "location":
      return conference.location || "";
    case "country":
      return conference.country || "";
    case "discountCode":
      return conference.discountCode || "";
    case "status":
      return conference.status || "";
  }
};

const saveInlineEdit = async (
  conference: ConferenceItem,
  field: InlineEditableField,
) => {
  if (!isInlineEditing(conference._id, field)) return;

  const cellKey = inlineCellKey(conference._id, field);
  if (inlineSavingCellKey.value === cellKey) return;

  const currentValue = inlineCurrentValue(conference, field);
  const nextRawValue = inlineDraftValue.value;
  const nextComparable =
    field === "name" || field === "status" ? nextRawValue.trim() : nextRawValue;
  const currentComparable =
    field === "name" || field === "status" ? currentValue.trim() : currentValue;

  if (nextComparable === currentComparable) {
    cancelInlineEdit();
    return;
  }

  if ((field === "name" || field === "status") && !nextComparable.length) {
    inlineErrorsByCell.value = {
      ...inlineErrorsByCell.value,
      [cellKey]: `${field === "name" ? "Name" : "Status"} cannot be empty.`,
    };
    return;
  }

  inlineSavingCellKey.value = cellKey;
  clearInlineCellError(conference._id, field);

  const payload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  if (field === "name" || field === "status") {
    payload[field] = nextComparable;
  } else {
    const normalized = nextRawValue.trim();
    payload[field] = normalized.length ? normalized : null;
  }

  try {
    const response = await $fetch<ConferencePatchResponse>(
      `/api/events/conferences/${encodeURIComponent(conference._id)}`,
      {
        method: "PATCH",
        body: payload,
      },
    );

    patchConferenceInList(conference._id, response.conference);
    cancelInlineEdit();
    inlineStatusMenuConferenceId.value = null;
  } catch (error: any) {
    inlineErrorsByCell.value = {
      ...inlineErrorsByCell.value,
      [cellKey]: error?.data?.statusMessage || "Inline update failed.",
    };
  } finally {
    inlineSavingCellKey.value = null;
  }
};

const selectInlineStatus = async (
  conference: ConferenceItem,
  nextStatus: string,
) => {
  inlineEditingCell.value = {
    conferenceId: conference._id,
    field: "status",
  };
  inlineDraftValue.value = nextStatus;
  await saveInlineEdit(conference, "status");
  if (!inlineCellError(conference._id, "status")) {
    inlineStatusMenuConferenceId.value = null;
  }
};

const editorContinentValue = (): string =>
  editorContinentMode.value === "custom"
    ? editorCustomContinent.value
    : editorForm.continent;

const onEditorContinentSelectionChange = (value: string) => {
  if (value === EDITOR_ADD_NEW_CONTINENT) {
    editorContinentMode.value = "custom";
    editorForm.continent = EDITOR_ADD_NEW_CONTINENT;
    return;
  }

  editorContinentMode.value = "existing";
  editorForm.continent = value;
  editorCustomContinent.value = "";
};

const toggleSort = (key: ConferencesSortKey) => {
  if (sortState.key === key) {
    sortState.direction = sortState.direction === "asc" ? "desc" : "asc";
    return;
  }

  sortState.key = key;
  sortState.direction = "asc";
};

const sortIndicator = (key: ConferencesSortKey): string => {
  if (sortState.key !== key) return "";
  return sortState.direction === "asc" ? "↑" : "↓";
};

const isFeaturedUploadPending = (conferenceId: string): boolean =>
  featuredUploadPendingIds.value.includes(conferenceId);

const addConferenceToFeatured = (conferenceId: string) => {
  const normalizedConferenceId = conferenceId.trim();
  if (!normalizedConferenceId.length) return;

  if (featuredDraftIds.value.has(normalizedConferenceId)) {
    return;
  }

  featuredDraft.value = [
    ...featuredDraft.value,
    {
      conferenceId: normalizedConferenceId,
      enabled: true,
      imageUrl: null,
      imageFileId: null,
      imageAlt: null,
    },
  ];
  featuredSaveSuccess.value = null;
};

const removeConferenceFromFeatured = (conferenceId: string) => {
  featuredDraft.value = featuredDraft.value.filter(
    (entry) => entry.conferenceId !== conferenceId,
  );
  featuredSaveSuccess.value = null;
};

const toggleFeaturedEnabled = (conferenceId: string) => {
  featuredDraft.value = featuredDraft.value.map((entry) =>
    entry.conferenceId === conferenceId
      ? { ...entry, enabled: !entry.enabled }
      : entry,
  );
  featuredSaveSuccess.value = null;
};

const onFeaturedDragStart = (conferenceId: string) => {
  featuredDraggedConferenceId.value = conferenceId;
};

const onFeaturedDrop = (targetConferenceId: string) => {
  const draggedConferenceId = featuredDraggedConferenceId.value;
  featuredDraggedConferenceId.value = null;

  if (!draggedConferenceId || draggedConferenceId === targetConferenceId) {
    return;
  }

  const currentEntries = [...featuredDraft.value];
  const fromIndex = currentEntries.findIndex(
    (entry) => entry.conferenceId === draggedConferenceId,
  );
  const toIndex = currentEntries.findIndex(
    (entry) => entry.conferenceId === targetConferenceId,
  );

  if (fromIndex < 0 || toIndex < 0) {
    return;
  }

  const [moved] = currentEntries.splice(fromIndex, 1);
  currentEntries.splice(toIndex, 0, moved);
  featuredDraft.value = currentEntries;
  featuredSaveSuccess.value = null;
};

const onFeaturedImageSelected = async (
  conferenceId: string,
  event: Event,
) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  featuredUploadPendingIds.value = [
    ...featuredUploadPendingIds.value,
    conferenceId,
  ];
  featuredSaveError.value = null;
  featuredSaveSuccess.value = null;

  try {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("folder", "events/featured-conferences");
    formData.append("fileName", `${conferenceId}-${Date.now()}`);

    const response = await $fetch<{
      success: boolean;
      data?: {
        fileId: string;
        url: string;
      };
      error?: string;
    }>("/api/imagekit/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "Image upload failed");
    }

    featuredDraft.value = featuredDraft.value.map((entry) =>
      entry.conferenceId === conferenceId
        ? {
            ...entry,
            imageUrl: response.data?.url ?? null,
            imageFileId: response.data?.fileId ?? null,
          }
        : entry,
    );
  } catch (error: any) {
    featuredSaveError.value =
      error?.data?.statusMessage ||
      error?.message ||
      "Failed to upload featured image.";
  } finally {
    featuredUploadPendingIds.value = featuredUploadPendingIds.value.filter(
      (id) => id !== conferenceId,
    );

    if (input) {
      input.value = "";
    }
  }
};

const clearFeaturedImage = (conferenceId: string) => {
  featuredDraft.value = featuredDraft.value.map((entry) =>
    entry.conferenceId === conferenceId
      ? {
          ...entry,
          imageUrl: null,
          imageFileId: null,
        }
      : entry,
  );
  featuredSaveSuccess.value = null;
};

const buildFeaturedSaveErrorMessage = (error: any): string => {
  const statusCode =
    Number(error?.statusCode) ||
    Number(error?.response?.status) ||
    Number(error?.data?.statusCode) ||
    0;
  const statusMessage = String(error?.data?.statusMessage ?? "").trim();
  const serverMessage = String(error?.data?.message ?? "").trim();
  const directMessage = String(error?.message ?? "").trim();
  const baseMessage =
    statusMessage || serverMessage || directMessage || "Failed to save featured conferences.";

  if (statusCode === 409 || baseMessage.toLowerCase().includes("conflict")) {
    return `${baseMessage} (HTTP 409)`;
  }

  if (statusCode >= 400) {
    return `${baseMessage} (HTTP ${statusCode})`;
  }

  return baseMessage;
};

const saveFeaturedConferences = async () => {
  if (featuredSavePending.value) {
    return;
  }

  featuredSavePending.value = true;
  featuredSaveError.value = null;
  featuredSaveSuccess.value = null;

  try {
    const response = await $fetch<{
      success: boolean;
      rev?: string;
    }>("/api/events/conferences/featured", {
      method: "PATCH",
      body: {
        featured: featuredDraft.value,
        rev: featuredDocumentRev.value,
      },
      credentials: "include",
    });

    if (!response.success) {
      throw new Error("Failed to save featured conferences.");
    }

    featuredDocumentRev.value = response.rev ?? featuredDocumentRev.value;
    featuredSaveSuccess.value = "Featured conferences updated.";
    await refreshFeatured();
  } catch (error: any) {
    featuredSaveError.value = buildFeaturedSaveErrorMessage(error);
  } finally {
    featuredSavePending.value = false;
  }
};

const openCsvDialog = () => {
  csvDialogOpen.value = true;
};

const closeCsvDialog = () => {
  if (previewPending.value || importPending.value) return;
  csvDialogOpen.value = false;
};

const resetCreateForm = () => {
  createForm.name = "";
  createForm.slug = "";
  createForm.year = "";
  createForm.startDateIso = "";
  createForm.startDateLabel = "";
  createForm.dateRangeLabel = "";
  createForm.monthLabel = "";
  createForm.location = "";
  createForm.city = "";
  createForm.country = "";
  createForm.continent = "";
  createForm.websiteUrl = "";
  createForm.xAccountUrl = "";
  createForm.status = STATUS_TO_BE_CONTACTED;
  createForm.bitvocationParticipation = "unknown";
  createForm.contactName = "";
  createForm.contactChannel = "";
  createForm.notes = "";
  createForm.ownerTodo = "";
  createForm.isPublished = false;
  createForm.hasAirtable = false;
  createForm.recreateNextYear = false;
};

const openCreateDialog = () => {
  createError.value = null;
  createSuccess.value = null;
  createFromProposalId.value = null;
  resetCreateForm();
  createDialogOpen.value = true;
};

const openCreateDialogFromProposal = (proposal: ConferenceProposalItem) => {
  createError.value = null;
  createSuccess.value = null;
  createFromProposalId.value = proposal._id;
  resetCreateForm();
  createForm.name = proposal.name || "";
  createForm.websiteUrl = proposal.websiteUrl || "";
  createForm.location = proposal.location || "";
  createForm.city = proposal.city || "";
  createForm.country = proposal.country || "";
  createForm.continent = proposal.continent || "";
  createForm.notes = proposal.notes || "";
  createForm.startDateIso = proposal.startDateIso || "";
  if (proposal.startDateIso && DATE_ONLY_PATTERN.test(proposal.startDateIso)) {
    createForm.year = proposal.startDateIso.slice(0, 4);
  }
  createDialogOpen.value = true;
};

const closeCreateDialog = () => {
  if (createPending.value) return;
  createDialogOpen.value = false;
  createError.value = null;
  createFromProposalId.value = null;
};

const saveCreateConference = async () => {
  const normalizedName = createForm.name.trim();
  if (!normalizedName.length) {
    createError.value = "Conference name is required.";
    return;
  }

  const normalizedSlug = createForm.slug.trim() || toSlug(normalizedName);
  if (!normalizedSlug.length) {
    createError.value = "Slug is required.";
    return;
  }

  const parsedYear = Number.parseInt(createForm.year.trim(), 10);
  if (!Number.isInteger(parsedYear) || parsedYear <= 0) {
    createError.value = "Year must be a valid positive integer.";
    return;
  }

  const startDateIso = createForm.startDateIso.trim();
  if (!DATE_ONLY_PATTERN.test(startDateIso)) {
    createError.value = "Start Date (ISO) is required in YYYY-MM-DD format.";
    return;
  }

  createPending.value = true;
  createError.value = null;
  createSuccess.value = null;

  try {
    const created = await $fetch<ConferencePatchResponse>("/api/events/conferences", {
      method: "POST",
      body: {
        name: normalizedName,
        slug: normalizedSlug,
        year: parsedYear,
        startDateIso,
        startDateLabel: toNullableText(createForm.startDateLabel),
        dateRangeLabel: toNullableText(createForm.dateRangeLabel),
        monthLabel: toNullableText(createForm.monthLabel),
        location: toNullableText(createForm.location),
        city: toNullableText(createForm.city),
        country: toNullableText(createForm.country),
        continent: toNullableText(createForm.continent),
        websiteUrl: toNullableText(createForm.websiteUrl),
        xAccountUrl: toNullableText(createForm.xAccountUrl),
        status: toNullableText(createForm.status) ?? STATUS_TO_BE_CONTACTED,
        bitvocationParticipation: createForm.bitvocationParticipation,
        contactName: toNullableText(createForm.contactName),
        contactChannel: toNullableText(createForm.contactChannel),
        notes: toNullableText(createForm.notes),
        ownerTodo: toNullableText(createForm.ownerTodo),
        isPublished: createForm.isPublished,
        hasAirtable: createForm.hasAirtable,
        recreateNextYear: createForm.recreateNextYear,
      },
    });

    if (createFromProposalId.value) {
      await $fetch(`/api/events/conference-proposals/${encodeURIComponent(createFromProposalId.value)}`, {
        method: "PATCH",
        body: {
          status: "accepted",
          conferenceId: created.id,
        },
        credentials: "include",
      });
      await refreshConferenceProposals();
      createFromProposalId.value = null;
    }

    createSuccess.value = "Conference created.";
    createDialogOpen.value = false;
    await refreshConferences();
  } catch (error: any) {
    createError.value = error?.data?.statusMessage || "Failed to create conference.";
  } finally {
    createPending.value = false;
  }
};

const setConferenceProposalStatus = async (
  proposal: ConferenceProposalItem,
  status: "accepted" | "rejected",
  conferenceId?: string,
) => {
  if (proposalActionPendingId.value) return;

  proposalActionPendingId.value = proposal._id;
  proposalActionError.value = null;

  try {
    await $fetch(`/api/events/conference-proposals/${encodeURIComponent(proposal._id)}`, {
      method: "PATCH",
      body: {
        status,
        conferenceId: conferenceId ?? null,
      },
      credentials: "include",
    });
    await refreshConferenceProposals();
  } catch (error: any) {
    proposalActionError.value =
      error?.data?.statusMessage ||
      error?.message ||
      "Failed to update proposal status.";
  } finally {
    proposalActionPendingId.value = null;
  }
};

const deleteRejectedProposal = async (proposal: ConferenceProposalItem) => {
  if (proposalActionPendingId.value) return;
  if (!process.client) return;

  const confirmed = window.confirm(
    `Delete rejected proposal "${proposal.name}"? This action cannot be undone.`,
  );
  if (!confirmed) return;

  proposalActionPendingId.value = proposal._id;
  proposalActionError.value = null;

  try {
    await $fetch(`/api/events/conference-proposals/${encodeURIComponent(proposal._id)}`, {
      method: "DELETE",
      credentials: "include",
    });
    await refreshConferenceProposals();
  } catch (error: any) {
    proposalActionError.value =
      error?.data?.statusMessage ||
      error?.message ||
      "Failed to delete rejected proposal.";
  } finally {
    proposalActionPendingId.value = null;
  }
};

const openProposalDetails = (proposal: ConferenceProposalItem) => {
  selectedProposal.value = proposal;
  proposalDetailsOpen.value = true;
};

const closeProposalDetails = () => {
  proposalDetailsOpen.value = false;
  selectedProposal.value = null;
};

const patchConferenceInList = (
  conferenceId: string,
  patch: Partial<ConferenceItem>,
) => {
  const currentData = conferencesData.value;
  if (!currentData?.conferences?.length) return;

  const rowIndex = currentData.conferences.findIndex(
    (conference) => conference._id === conferenceId,
  );
  if (rowIndex < 0) return;

  const existing = currentData.conferences[rowIndex];
  if (!existing) return;

  const updatedConference: ConferenceItem = {
    ...existing,
    ...patch,
  };

  const updatedConferences = [...currentData.conferences];
  updatedConferences[rowIndex] = updatedConference;

  let updatedPublicationCounts = currentData.publicationCounts;
  if (
    typeof patch.isPublished === "boolean" &&
    patch.isPublished !== existing.isPublished
  ) {
    const delta = patch.isPublished ? 1 : -1;
    updatedPublicationCounts = {
      published: Math.max(0, currentData.publicationCounts.published + delta),
      draft: Math.max(0, currentData.publicationCounts.draft - delta),
    };
  }

  conferencesData.value = {
    ...currentData,
    conferences: updatedConferences,
    publicationCounts: updatedPublicationCounts,
  };
};

const quickTogglePublished = async (
  conference: Pick<ConferenceItem, "_id">,
  nextPublished: boolean,
) => {
  if (publishTogglePendingId.value) return;

  const currentConference = conferencesData.value?.conferences.find(
    (item) => item._id === conference._id,
  );
  const previousPublished = currentConference?.isPublished ?? false;
  const previousUpdatedAt = currentConference?.updatedAt;

  publishTogglePendingId.value = conference._id;
  publishUnpublishConfirmId.value = null;
  publishToggleError.value = null;
  patchConferenceInList(conference._id, {
    isPublished: nextPublished,
  });

  try {
    const response = await $fetch<ConferencePatchResponse>(
      `/api/events/conferences/${encodeURIComponent(conference._id)}`,
      {
        method: "PATCH",
        body: {
          isPublished: nextPublished,
          updatedAt: new Date().toISOString(),
        },
      },
    );

    patchConferenceInList(conference._id, {
      isPublished: response.conference.isPublished,
      updatedAt: response.conference.updatedAt,
      _rev: response.conference._rev || response.rev,
    });
  } catch (error: any) {
    const rollbackPatch: Partial<ConferenceItem> = {
      isPublished: previousPublished,
    };
    if (typeof previousUpdatedAt === "string") {
      rollbackPatch.updatedAt = previousUpdatedAt;
    }
    patchConferenceInList(conference._id, rollbackPatch);
    publishToggleError.value =
      error?.data?.statusMessage || "Failed to update published state.";
  } finally {
    publishTogglePendingId.value = null;
  }
};

const requestPublishedToggle = (conference: ConferenceItem) => {
  publishToggleError.value = null;

  if (conference.isPublished) {
    publishUnpublishConfirmId.value = conference._id;
    return;
  }

  void quickTogglePublished(conference, true);
};

const cancelUnpublishConfirm = () => {
  if (publishTogglePendingId.value) return;
  publishUnpublishConfirmId.value = null;
};

const confirmUnpublish = (conference: ConferenceItem) => {
  void quickTogglePublished(conference, false);
};

const handleDocumentPointerDown = (event: PointerEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target) return;

  if (inlineStatusMenuConferenceId.value) {
    const statusMenuContainer = target.closest("[data-inline-status-menu]");
    const statusMenuToggle = target.closest("[data-inline-status-toggle]");
    if (!statusMenuContainer && !statusMenuToggle) {
      inlineStatusMenuConferenceId.value = null;
    }
  }

  if (publishUnpublishConfirmId.value) {
    const publishConfirmContainer = target.closest("[data-publish-confirm-menu]");
    const publishConfirmToggle = target.closest("[data-publish-confirm-toggle]");
    if (!publishConfirmContainer && !publishConfirmToggle) {
      publishUnpublishConfirmId.value = null;
    }
  }
};

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
});

onMounted(() => {
  if (!process.client) return;

  try {
    const raw = sessionStorage.getItem(ADMIN_FILTERS_SESSION_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Partial<{
      search: string;
      status: string;
      continent: string;
      year: string;
      published: string;
      showPastEvents: boolean;
    }>;

    if (typeof parsed.search === "string") queryState.search = parsed.search;
    if (typeof parsed.status === "string") queryState.status = parsed.status;
    if (typeof parsed.continent === "string") queryState.continent = parsed.continent;
    if (typeof parsed.year === "string") queryState.year = parsed.year;
    if (typeof parsed.published === "string") queryState.published = parsed.published;
    if (typeof parsed.showPastEvents === "boolean") {
      queryState.showPastEvents = parsed.showPastEvents;
    }
  } catch (loadError) {
    console.warn("Failed to load admin conference filters", loadError);
  }
});

const handleCsvFileInput = async (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) return;

  csvFileName.value = file.name;
  csvInput.value = await file.text();
  importError.value = null;
  importSuccessMessage.value = null;
};

const previewCsv = async () => {
  if (!csvInput.value.trim()) {
    importError.value = "Paste CSV content or upload a CSV file first.";
    return;
  }

  previewPending.value = true;
  importError.value = null;
  importSuccessMessage.value = null;

  try {
    const response = await $fetch<ImportPreviewPayload>(
      "/api/events/conferences/import-csv",
      {
        method: "POST",
        body: {
          csvText: csvInput.value,
          dryRun: true,
        },
      },
    );
    previewData.value = response;
  } catch (error: any) {
    importError.value = error?.data?.statusMessage || "CSV preview failed.";
  } finally {
    previewPending.value = false;
  }
};

const importCsv = async () => {
  if (!csvInput.value.trim()) {
    importError.value = "Paste CSV content or upload a CSV file first.";
    return;
  }

  importPending.value = true;
  importError.value = null;
  importSuccessMessage.value = null;

  try {
    const response = await $fetch<ImportPreviewPayload>(
      "/api/events/conferences/import-csv",
      {
        method: "POST",
        body: {
          csvText: csvInput.value,
          dryRun: false,
        },
      },
    );

    previewData.value = response;
    importSuccessMessage.value = `Imported ${response.imported} conference records.`;
    await refreshConferences();
  } catch (error: any) {
    importError.value = error?.data?.statusMessage || "Import failed.";
  } finally {
    importPending.value = false;
  }
};

const openEditor = (conference: ConferenceItem) => {
  editingConferenceId.value = conference._id;
  editorForm.documentId = conference._id;
  editorForm.documentRev = conference._rev || "";
  editorForm.documentType = conference.type;
  editorForm.name = conference.name || "";
  editorForm.slug = conference.slug || "";
  editorForm.year = typeof conference.year === "number" ? String(conference.year) : "";
  editorForm.status = conference.status || STATUS_TO_BE_CONTACTED;
  editorForm.bitvocationParticipation =
    conference.bitvocationParticipation || "unknown";
  editorForm.websiteUrl = conference.websiteUrl || "";
  editorForm.xAccountUrl = conference.xAccountUrl || "";
  editorForm.location = conference.location || "";
  editorForm.city = conference.city || "";
  editorForm.monthLabel = conference.monthLabel || "";
  editorForm.startDateLabel = conference.startDateLabel || "";
  editorForm.startDateIso = conference.startDateIso || "";
  editorForm.dateRangeLabel = conference.dateRangeLabel || "";
  editorForm.country = conference.country || "";
  const normalizedContinent = String(conference.continent ?? "").trim();
  if (!normalizedContinent.length) {
    editorContinentMode.value = "existing";
    editorForm.continent = "";
    editorCustomContinent.value = "";
  } else if (continentOptions.value.includes(normalizedContinent)) {
    editorContinentMode.value = "existing";
    editorForm.continent = normalizedContinent;
    editorCustomContinent.value = "";
  } else {
    editorContinentMode.value = "custom";
    editorForm.continent = EDITOR_ADD_NEW_CONTINENT;
    editorCustomContinent.value = normalizedContinent;
  }
  editorForm.discountCode = conference.discountCode || "";
  editorForm.discountLabel = conference.discountLabel || "";
  editorForm.commissionLabel = conference.commissionLabel || "";
  editorForm.ticketsSold =
    typeof conference.ticketsSold === "number" ? String(conference.ticketsSold) : "";
  editorForm.commissionEarnedLabel = conference.commissionEarnedLabel || "";
  editorForm.commissionReceived =
    conference.commissionReceived === null
      ? "unknown"
      : conference.commissionReceived
        ? "yes"
        : "no";
  editorForm.contactName = conference.contactName || "";
  editorForm.contactChannel = conference.contactChannel || "";
  editorForm.ownerTodo = conference.ownerTodo || "";
  editorForm.notes = conference.notes || "";
  editorForm.hasAirtable = conference.hasAirtable;
  editorForm.recreateNextYear = Boolean(conference.recreateNextYear);
  editorForm.isPublished = conference.isPublished;
  editorForm.sourceFormat = conference.source?.format || "csv-semicolon";
  editorForm.sourceRowNumber = conference.source?.rowNumber
    ? String(conference.source.rowNumber)
    : "";
  editorForm.sourceImportedAt = conference.source?.importedAt || "";
  editorForm.createdAt = conference.createdAt || "";
  editorForm.updatedAt = conference.updatedAt || "";
  editorForm.notifyWatchers = false;
  editorForm.notifyMessage = "";
  editorError.value = null;
  editorSuccess.value = null;
  editorOpen.value = true;
};

const closeEditor = () => {
  if (editorPending.value || notificationPreviewPending.value) return;
  editorOpen.value = false;
  editingConferenceId.value = null;
  editorError.value = null;
  editorSuccess.value = null;
  notificationPreviewOpen.value = false;
  notificationPreviewPayload.value = null;
  notificationPreviewMessage.value = "";
  notificationPreviewEligible.value = 0;
  notificationPreviewWatchers.value = [];
};

const buildEditorPatchPayload = (): Record<string, unknown> | null => {
  if (!editingConferenceId.value) {
    editorError.value = "No conference selected for editing.";
    return null;
  }

  const normalizedName = editorForm.name.trim();
  if (!normalizedName.length) {
    editorError.value = "Conference name is required.";
    return null;
  }

  const normalizedSlug = editorForm.slug.trim() || toSlug(normalizedName);
  if (!normalizedSlug.length) {
    editorError.value = "Slug is required.";
    return null;
  }

  const parsedYear = editorForm.year.trim()
    ? Number.parseInt(editorForm.year.trim(), 10)
    : null;
  if (editorForm.year.trim() && !Number.isFinite(parsedYear)) {
    editorError.value = "Year must be a valid integer.";
    return null;
  }

  const parsedTicketsSold = editorForm.ticketsSold.trim()
    ? Number.parseInt(editorForm.ticketsSold.trim(), 10)
    : null;
  if (editorForm.ticketsSold.trim() && !Number.isFinite(parsedTicketsSold)) {
    editorError.value = "Tickets sold must be a valid integer.";
    return null;
  }

  const parsedSourceRowNumber = Number.parseInt(
    editorForm.sourceRowNumber.trim(),
    10,
  );
  if (!Number.isFinite(parsedSourceRowNumber) || parsedSourceRowNumber <= 0) {
    editorError.value = "Source row number must be a positive integer.";
    return null;
  }

  return {
    name: normalizedName,
    slug: normalizedSlug,
    year: parsedYear,
    status: editorForm.status,
    bitvocationParticipation: editorForm.bitvocationParticipation,
    websiteUrl: toNullableText(editorForm.websiteUrl),
    xAccountUrl: toNullableText(editorForm.xAccountUrl),
    location: toNullableText(editorForm.location),
    city: toNullableText(editorForm.city),
    monthLabel: toNullableText(editorForm.monthLabel),
    startDateLabel: toNullableText(editorForm.startDateLabel),
    startDateIso: toNullableText(editorForm.startDateIso),
    dateRangeLabel: toNullableText(editorForm.dateRangeLabel),
    country: toNullableText(editorForm.country),
    continent: toNullableText(editorContinentValue()),
    discountCode: toNullableText(editorForm.discountCode),
    discountLabel: toNullableText(editorForm.discountLabel),
    commissionLabel: toNullableText(editorForm.commissionLabel),
    ticketsSold: parsedTicketsSold,
    commissionEarnedLabel: toNullableText(editorForm.commissionEarnedLabel),
    commissionReceived:
      editorForm.commissionReceived === "unknown"
        ? null
        : editorForm.commissionReceived === "yes",
    contactName: toNullableText(editorForm.contactName),
    contactChannel: toNullableText(editorForm.contactChannel),
    ownerTodo: toNullableText(editorForm.ownerTodo),
    notes: toNullableText(editorForm.notes),
    hasAirtable: editorForm.hasAirtable,
    recreateNextYear: editorForm.recreateNextYear,
    isPublished: editorForm.isPublished,
    source: {
      format: editorForm.sourceFormat || "csv-semicolon",
      rowNumber: parsedSourceRowNumber,
      importedAt: editorForm.sourceImportedAt.trim() || new Date().toISOString(),
    },
    createdAt: editorForm.createdAt.trim() || undefined,
    updatedAt: editorForm.updatedAt.trim() || new Date().toISOString(),
    notifyWatchers: editorForm.notifyWatchers,
    notifyMessage: toNullableText(editorForm.notifyMessage),
  };
};

const persistEditorChanges = async (
  payload: Record<string, unknown>,
): Promise<void> => {
  if (editorPending.value) {
    return;
  }

  if (!editingConferenceId.value) {
    editorError.value = "No conference selected for editing.";
    return;
  }
  const conferenceId = editingConferenceId.value;

  editorPending.value = true;
  editorError.value = null;
  editorSuccess.value = null;
  let closeEditorOnSuccess = false;

  try {
    const response = await $fetch<ConferencePatchResponse>(
      `/api/events/conferences/${encodeURIComponent(conferenceId)}`,
      {
        method: "PATCH",
        body: payload,
      },
    );

    editorForm.documentRev =
      response.conference._rev || response.rev || editorForm.documentRev;
    editorForm.updatedAt = response.conference.updatedAt;
    if (response.notifiedWatchers?.requested) {
      editorSuccess.value = `Conference updated. Nostr watchers notified: ${response.notifiedWatchers.sent}/${response.notifiedWatchers.eligible}.`;
    } else {
      editorSuccess.value = "Conference updated.";
    }
    editorForm.notifyWatchers = false;
    editorForm.notifyMessage = "";
    notificationPreviewOpen.value = false;
    notificationPreviewPayload.value = null;
    patchConferenceInList(conferenceId, response.conference);
    closeEditorOnSuccess = true;
  } catch (error: any) {
    editorError.value = error?.data?.statusMessage || "Update failed.";
  } finally {
    editorPending.value = false;
    if (closeEditorOnSuccess) {
      closeEditor();
    }
  }
};

const closeNotificationPreview = () => {
  if (notificationPreviewPending.value || editorPending.value) {
    return;
  }

  notificationPreviewOpen.value = false;
  notificationPreviewPayload.value = null;
  notificationPreviewMessage.value = "";
  notificationPreviewEligible.value = 0;
  notificationPreviewWatchers.value = [];
};

const requestNotificationPreview = async (
  payload: Record<string, unknown>,
): Promise<void> => {
  if (!editingConferenceId.value) {
    editorError.value = "No conference selected for editing.";
    return;
  }

  notificationPreviewPending.value = true;
  editorError.value = null;

  try {
    const response = await $fetch<ConferencePatchResponse>(
      `/api/events/conferences/${encodeURIComponent(editingConferenceId.value)}`,
      {
        method: "PATCH",
        body: {
          ...payload,
          previewNotificationOnly: true,
          notifyWatchers: true,
        },
      },
    );

    const preview = response.notificationPreview;
    if (!preview) {
      throw new Error("Preview payload missing from server response.");
    }

    notificationPreviewPayload.value = payload;
    notificationPreviewMessage.value = preview.message;
    notificationPreviewEligible.value = preview.eligible;
    notificationPreviewWatchers.value = preview.watcherNpubs;
    notificationPreviewOpen.value = true;
  } catch (error: any) {
    editorError.value =
      error?.data?.statusMessage ||
      error?.message ||
      "Failed to prepare Nostr notification preview.";
  } finally {
    notificationPreviewPending.value = false;
  }
};

const confirmNotificationAndSave = async () => {
  const payload = notificationPreviewPayload.value;
  if (!payload) {
    editorError.value = "Notification preview payload is missing.";
    return;
  }

  await persistEditorChanges(payload);
};

const saveEditor = async () => {
  const payload = buildEditorPatchPayload();
  if (!payload) return;

  if (editorForm.notifyWatchers) {
    await requestNotificationPreview(payload);
    return;
  }

  await persistEditorChanges(payload);
};
</script>

<template>
  <div class="space-y-8">
    <section
      class="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-orange-900 text-white shadow-xl"
    >
      <div class="flex flex-col gap-6 p-6 md:p-8 lg:min-h-[300px] lg:justify-between">
        <div class="space-y-4">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
            Events Operations
          </p>
          <h1 class="text-3xl font-bold leading-tight md:text-4xl">
            Conference Management
          </h1>
          <p class="max-w-2xl text-sm text-slate-200 md:text-base">
            Centralize conference pipeline tracking, partner readiness, and import
            workflows in one operator-grade section powered by the reusable
            <code>#events</code> layer.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:mt-auto lg:grid-cols-4">
          <div class="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p class="text-xs uppercase tracking-wide text-orange-200">Conferences</p>
            <p class="mt-2 text-2xl font-semibold">{{ totalConferences }}</p>
          </div>
          <div class="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p class="text-xs uppercase tracking-wide text-orange-200">In Progress</p>
            <p class="mt-2 text-2xl font-semibold">{{ inProgressCount }}</p>
          </div>
          <div class="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p class="text-xs uppercase tracking-wide text-orange-200">Published</p>
            <p class="mt-2 text-2xl font-semibold">{{ publishedCount }}</p>
          </div>
          <div class="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p class="text-xs uppercase tracking-wide text-orange-200">Draft</p>
            <p class="mt-2 text-2xl font-semibold">{{ draftCount }}</p>
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="conferenceProposals.length > 0"
      class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Conference Proposals</h2>
          <p class="text-sm text-slate-600">
            Submitted by logged-in users and ready for curation.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span class="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-700">
            Pending {{ conferenceProposalCounts.pending }}
          </span>
          <span class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700">
            Accepted {{ conferenceProposalCounts.accepted }}
          </span>
          <span class="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">
            Rejected {{ conferenceProposalCounts.rejected }}
          </span>
        </div>
      </div>

      <p v-if="proposalsError" class="text-sm text-red-600">
        Failed to load conference proposals.
      </p>
      <p v-else-if="proposalActionError" class="text-sm text-red-600">
        {{ proposalActionError }}
      </p>
      <p v-else-if="proposalsPending" class="text-sm text-slate-600">
        Loading proposals...
      </p>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-slate-200 text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Conference</th>
              <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Submitted By</th>
              <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">When</th>
              <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">Status</th>
              <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="proposal in conferenceProposals" :key="proposal._id">
              <td class="px-3 py-2.5">
                <p class="font-medium text-slate-900">{{ proposal.name }}</p>
                <p class="text-xs text-slate-600">
                  {{ proposal.location || proposal.country || "Location not provided" }}
                </p>
                <p v-if="proposal.websiteUrl" class="text-xs text-slate-600">
                  {{ proposal.websiteUrl }}
                </p>
              </td>
              <td class="px-3 py-2.5 text-slate-700">
                {{ proposal.submittedBy?.username || "Unknown user" }}
              </td>
              <td class="px-3 py-2.5 text-slate-700 text-nowrap">
                {{ formatDate(proposal.createdAt || null) }}
              </td>
              <td class="px-3 py-2.5">
                <span
                  class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium"
                  :class="
                    proposal.status === 'accepted'
                      ? 'border-emerald-300 bg-emerald-100 text-emerald-700'
                      : proposal.status === 'rejected'
                        ? 'border-rose-300 bg-rose-100 text-rose-700'
                        : 'border-amber-300 bg-amber-100 text-amber-700'
                  "
                >
                  {{ proposal.status }}
                </span>
              </td>
              <td class="px-3 py-2.5 text-right">
                <div class="inline-flex items-center gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    @click="openProposalDetails(proposal)"
                  >
                    Details
                  </button>
                  <button
                    v-if="proposal.status === 'pending'"
                    type="button"
                    class="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    :disabled="proposalActionPendingId === proposal._id"
                    @click="openCreateDialogFromProposal(proposal)"
                  >
                    Transform
                  </button>
                  <button
                    v-if="proposal.status === 'pending'"
                    type="button"
                    class="inline-flex items-center rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                    :disabled="proposalActionPendingId === proposal._id"
                    @click="setConferenceProposalStatus(proposal, 'rejected')"
                  >
                    {{ proposalActionPendingId === proposal._id ? "Saving..." : "Reject" }}
                  </button>
                  <button
                    v-if="proposal.status === 'rejected'"
                    type="button"
                    class="inline-flex items-center rounded-md border border-rose-300 bg-white px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                    :disabled="proposalActionPendingId === proposal._id"
                    @click="deleteRejectedProposal(proposal)"
                  >
                    {{ proposalActionPendingId === proposal._id ? "Deleting..." : "Delete" }}
                  </button>
                  <span v-if="proposal.status === 'accepted' && proposal.conferenceId" class="text-xs text-emerald-700">
                    {{ proposal.conferenceId }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="proposalDetailsOpen && selectedProposal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        @click="closeProposalDetails"
      >
        <div
          class="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          @click.stop
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-slate-900">Conference Proposal Details</h3>
              <p class="text-sm text-slate-600">{{ selectedProposal.name }}</p>
            </div>
            <button
              type="button"
              class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
              @click="closeProposalDetails"
            >
              ×
            </button>
          </div>

          <div class="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <p class="text-slate-800">{{ selectedProposal.status }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Submitted By</p>
              <p class="text-slate-800">{{ selectedProposal.submittedBy?.username || "Unknown user" }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Website</p>
              <p class="break-all text-slate-800">{{ selectedProposal.websiteUrl || "—" }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</p>
              <p class="text-slate-800">{{ formatDate(selectedProposal.startDateIso || null) }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
              <p class="text-slate-800">{{ selectedProposal.location || "—" }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">City</p>
              <p class="text-slate-800">{{ selectedProposal.city || "—" }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Country</p>
              <p class="text-slate-800">{{ selectedProposal.country || "—" }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Continent</p>
              <p class="text-slate-800">{{ selectedProposal.continent || "—" }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Created At</p>
              <p class="text-slate-800">{{ formatDate(selectedProposal.createdAt || null) }}</p>
            </div>
            <div class="space-y-1">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Resolved At</p>
              <p class="text-slate-800">{{ selectedProposal.resolvedAt ? formatDate(selectedProposal.resolvedAt) : "—" }}</p>
            </div>
            <div class="space-y-1 md:col-span-2">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
              <p class="whitespace-pre-wrap text-slate-800">{{ selectedProposal.notes || "—" }}</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <section class="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <button
        type="button"
        class="flex w-full flex-wrap items-center justify-between gap-3 text-left"
        @click="featuredSectionExpanded = !featuredSectionExpanded"
      >
        <div>
          <h2 class="text-lg font-semibold text-slate-900">Featured Conferences</h2>
          <p class="text-sm text-slate-600">
            {{ featuredDraft.length }} configured
          </p>
        </div>
        <span class="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">
          {{ featuredSectionExpanded ? "Collapse" : "Expand" }}
        </span>
      </button>

      <div v-if="featuredSectionExpanded" class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-slate-600">
            Build the featured conferences list, reorder cards, and upload custom logos.
          </p>
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-transparent bg-orange-custom px-4 py-2 text-sm font-medium text-white hover:bg-orange-custom-hover focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="featuredSavePending || featuredPending"
            @click="saveFeaturedConferences"
          >
            {{ featuredSavePending ? "Saving..." : "Save Featured List" }}
          </button>
        </div>

        <p v-if="featuredError" class="text-sm text-red-600">
          Failed to load featured conferences.
        </p>
        <p v-if="featuredSaveError" class="text-sm text-red-600">
          {{ featuredSaveError }}
        </p>
        <p v-if="featuredSaveSuccess" class="text-sm text-emerald-700">
          {{ featuredSaveSuccess }}
        </p>

        <div class="grid gap-4 lg:grid-cols-[minmax(18rem,1fr)_minmax(0,2fr)]">
        <div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <label class="block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Add conference to featured
          </label>
          <input
            v-model="featuredSearch"
            type="search"
            class="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
            placeholder="Search conference name, location, country..."
          >

          <div class="max-h-72 space-y-2 overflow-y-auto pr-1">
            <p
              v-if="featuredPending"
              class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
            >
              Loading conferences...
            </p>
            <p
              v-else-if="!featuredAvailableConferences.length"
              class="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600"
            >
              No conferences available for adding.
            </p>
            <button
              v-for="conference in featuredAvailableConferences"
              :key="`featured-candidate-${conference._id}`"
              type="button"
              class="flex w-full items-start justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-left hover:border-orange-300 hover:bg-orange-50/40"
              @click="addConferenceToFeatured(conference._id)"
            >
              <div>
                <p class="text-sm font-medium text-slate-900">{{ conference.name }}</p>
                <p class="text-xs text-slate-500">
                  {{ conference.location || conference.country || "Location TBD" }}
                </p>
              </div>
              <span class="text-xs font-semibold text-orange-700">Add</span>
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <p
            v-if="!featuredCards.length"
            class="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
          >
            No featured conferences yet. Add conferences from the list to start curating.
          </p>

          <article
            v-for="card in featuredCards"
            :key="`featured-card-${card.entry.conferenceId}`"
            class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            draggable="true"
            @dragstart="onFeaturedDragStart(card.entry.conferenceId)"
            @dragover.prevent
            @drop="onFeaturedDrop(card.entry.conferenceId)"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="text-sm font-semibold text-slate-900">
                  {{ card.conference.name }}
                </p>
                <p class="mt-1 text-xs text-slate-500">
                  {{ formatDate(card.conference.startDateIso) }}
                </p>
                <p class="text-xs text-slate-500">
                  {{ card.conference.location || card.conference.country || "Location TBD" }}
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <label class="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    :checked="card.entry.enabled"
                    @change="toggleFeaturedEnabled(card.entry.conferenceId)"
                  >
                  Enabled
                </label>
                <button
                  type="button"
                  class="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  @click="removeConferenceFromFeatured(card.entry.conferenceId)"
                >
                  Remove
                </button>
              </div>
            </div>

            <div class="mt-3 grid gap-3 md:grid-cols-[8rem_minmax(0,1fr)]">
              <div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <img
                  v-if="card.entry.imageUrl"
                  :src="card.entry.imageUrl"
                  :alt="card.entry.imageAlt || `${card.conference.name} featured image`"
                  class="h-28 w-full object-cover"
                >
                <div
                  v-else
                  class="flex h-28 items-center justify-center px-2 text-center text-xs text-slate-500"
                >
                  No image uploaded
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <label
                    :for="`featured-image-${card.entry.conferenceId}`"
                    class="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {{ isFeaturedUploadPending(card.entry.conferenceId) ? "Uploading..." : "Upload logo/image" }}
                  </label>
                  <input
                    :id="`featured-image-${card.entry.conferenceId}`"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    :disabled="isFeaturedUploadPending(card.entry.conferenceId)"
                    @change="onFeaturedImageSelected(card.entry.conferenceId, $event)"
                  >
                  <button
                    type="button"
                    class="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    :disabled="!card.entry.imageUrl"
                    @click="clearFeaturedImage(card.entry.conferenceId)"
                  >
                    Clear image
                  </button>
                </div>
                <p class="text-[11px] text-slate-500">
                  Drag cards to change featured order.
                </p>
              </div>
            </div>
          </article>
        </div>
      </div>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="grid gap-3 md:grid-cols-6">
        <input
          v-model="queryState.search"
          type="search"
          class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
          placeholder="Search conference, location, notes..."
        >
        <select
          v-model="queryState.status"
          class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
        >
          <option value="all">All statuses</option>
          <option v-for="status in statusOptions" :key="status" :value="status">
            {{ status }}
          </option>
        </select>
        <select
          v-model="queryState.continent"
          class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
        >
          <option value="all">All continents</option>
          <option v-for="continent in continentOptions" :key="continent" :value="continent">
            {{ continent }}
          </option>
        </select>
        <select
          v-model="queryState.year"
          class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
        >
          <option value="all">All years</option>
          <option v-for="year in yearOptions" :key="year" :value="String(year)">
            {{ year }}
          </option>
        </select>
        <select
          v-model="queryState.published"
          class="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
        >
          <option value="all">Published + Draft</option>
          <option value="published">Published only</option>
          <option value="draft">Draft only</option>
        </select>
        <label class="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
          <input
            v-model="queryState.showPastEvents"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
          >
          Past events
        </label>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p class="text-sm text-slate-700">
          Manage conference records directly from this board.
        </p>
        <button
          type="button"
          class="inline-flex items-center rounded-md border border-transparent bg-orange-custom px-4 py-2 text-sm font-medium text-white hover:bg-orange-custom-hover focus:outline-none focus:ring-2 focus:ring-orange-500"
          @click="openCreateDialog"
        >
          Add Conference
        </button>
      </div>
      <p v-if="createSuccess" class="text-sm text-emerald-700">{{ createSuccess }}</p>
      <p v-if="listPending" class="text-sm text-slate-600">Loading conference board...</p>
      <p v-else-if="listError" class="text-sm text-red-600">
        Failed to load conferences.
      </p>
      <p
        v-else-if="!sortedConferences.length"
        class="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600"
      >
        No conferences found. Add a manual conference or import CSV to populate this section.
      </p>
      <div v-else class="space-y-3">
        <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p class="text-sm text-slate-700">
            Showing {{ sortedConferences.length }} conferences.
            Sort:
            <span class="font-medium text-slate-900">
              {{ sortState.key }} {{ sortState.direction === "asc" ? "↑" : "↓" }}
            </span>
          </p>
        </div>
        <p v-if="publishToggleError" class="text-sm text-red-600">
          {{ publishToggleError }}
        </p>

        <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <button type="button" class="inline-flex items-center gap-1" @click="toggleSort('name')">
                    Conference <span class="text-slate-400">{{ sortIndicator("name") }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <button type="button" class="inline-flex items-center gap-1" @click="toggleSort('startDateIso')">
                    Date <span class="text-slate-400">{{ sortIndicator("startDateIso") }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <button type="button" class="inline-flex items-center gap-1" @click="toggleSort('year')">
                    Year <span class="text-slate-400">{{ sortIndicator("year") }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <button type="button" class="inline-flex items-center gap-1" @click="toggleSort('location')">
                    Location <span class="text-slate-400">{{ sortIndicator("location") }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <button type="button" class="inline-flex items-center gap-1" @click="toggleSort('country')">
                    Country <span class="text-slate-400">{{ sortIndicator("country") }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Discount Code
                </th>
                <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <button type="button" class="inline-flex items-center gap-1" @click="toggleSort('status')">
                    Status <span class="text-slate-400">{{ sortIndicator("status") }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <button type="button" class="inline-flex items-center gap-1" @click="toggleSort('isPublished')">
                    Published <span class="text-slate-400">{{ sortIndicator("isPublished") }}</span>
                  </button>
                </th>
                <th class="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Edit</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="conference in sortedConferences"
                :key="conference._id"
                class="hover:bg-slate-50/70"
                :class="hasConferenceDiscount(conference) ? 'bg-orange-50/70' : ''"
              >
                <td class="px-3 py-2.5">
                  <div v-if="isInlineEditing(conference._id, 'name')" class="space-y-1">
                    <input
                      :data-inline-editor-key="inlineCellKey(conference._id, 'name')"
                      v-model="inlineDraftValue"
                      type="text"
                      class="block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                      :disabled="inlineCellSaving(conference._id, 'name')"
                      @blur="saveInlineEdit(conference, 'name')"
                      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                      @keydown.esc.prevent="cancelInlineEdit"
                    >
                    <p v-if="inlineCellSaving(conference._id, 'name')" class="text-[11px] text-slate-500">
                      Saving...
                    </p>
                    <p v-if="inlineCellError(conference._id, 'name')" class="text-[11px] text-red-600">
                      {{ inlineCellError(conference._id, "name") }}
                    </p>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="font-medium text-left text-slate-900 hover:text-orange-700"
                    @click="startInlineEdit(conference, 'name')"
                  >
                    {{ conference.name }}
                  </button>
                </td>
                <td class="px-3 py-2.5 text-slate-700 text-nowrap">
                  <div v-if="isInlineEditing(conference._id, 'startDateIso')" class="space-y-1">
                    <input
                      :data-inline-editor-key="inlineCellKey(conference._id, 'startDateIso')"
                      v-model="inlineDraftValue"
                      type="date"
                      class="block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                      :disabled="inlineCellSaving(conference._id, 'startDateIso')"
                      @blur="saveInlineEdit(conference, 'startDateIso')"
                      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                      @keydown.esc.prevent="cancelInlineEdit"
                    >
                    <p v-if="inlineCellSaving(conference._id, 'startDateIso')" class="text-[11px] text-slate-500">
                      Saving...
                    </p>
                    <p v-if="inlineCellError(conference._id, 'startDateIso')" class="text-[11px] text-red-600">
                      {{ inlineCellError(conference._id, "startDateIso") }}
                    </p>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="hover:text-orange-700"
                    @click="startInlineEdit(conference, 'startDateIso')"
                  >
                    {{ formatDate(conference.startDateIso) }}
                  </button>
                </td>
                <td class="px-3 py-2.5 text-slate-700">
                  <span
                    class="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold text-nowrap"
                    :class="conferenceMonthPillClass(conference)"
                  >
                    {{ conferenceMonthLabel(conference) }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-slate-700">
                  <div v-if="isInlineEditing(conference._id, 'location')" class="space-y-1">
                    <input
                      :data-inline-editor-key="inlineCellKey(conference._id, 'location')"
                      v-model="inlineDraftValue"
                      type="text"
                      class="block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                      :disabled="inlineCellSaving(conference._id, 'location')"
                      @blur="saveInlineEdit(conference, 'location')"
                      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                      @keydown.esc.prevent="cancelInlineEdit"
                    >
                    <p v-if="inlineCellSaving(conference._id, 'location')" class="text-[11px] text-slate-500">
                      Saving...
                    </p>
                    <p v-if="inlineCellError(conference._id, 'location')" class="text-[11px] text-red-600">
                      {{ inlineCellError(conference._id, "location") }}
                    </p>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="hover:text-orange-700 text-left"
                    @click="startInlineEdit(conference, 'location')"
                  >
                    {{ conference.location || "Location TBD" }}
                  </button>
                </td>
                <td class="px-3 py-2.5 text-slate-700">
                  <div v-if="isInlineEditing(conference._id, 'country')" class="space-y-1">
                    <input
                      :data-inline-editor-key="inlineCellKey(conference._id, 'country')"
                      v-model="inlineDraftValue"
                      type="text"
                      class="block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                      :disabled="inlineCellSaving(conference._id, 'country')"
                      @blur="saveInlineEdit(conference, 'country')"
                      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                      @keydown.esc.prevent="cancelInlineEdit"
                    >
                    <p v-if="inlineCellSaving(conference._id, 'country')" class="text-[11px] text-slate-500">
                      Saving...
                    </p>
                    <p v-if="inlineCellError(conference._id, 'country')" class="text-[11px] text-red-600">
                      {{ inlineCellError(conference._id, "country") }}
                    </p>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="hover:text-orange-700 text-left"
                    @click="startInlineEdit(conference, 'country')"
                  >
                    {{ conference.country || "—" }}
                  </button>
                </td>
                <td class="px-3 py-2.5 text-slate-700">
                  <div v-if="isInlineEditing(conference._id, 'discountCode')" class="space-y-1">
                    <input
                      :data-inline-editor-key="inlineCellKey(conference._id, 'discountCode')"
                      v-model="inlineDraftValue"
                      type="text"
                      class="block w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                      :disabled="inlineCellSaving(conference._id, 'discountCode')"
                      @blur="saveInlineEdit(conference, 'discountCode')"
                      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                      @keydown.esc.prevent="cancelInlineEdit"
                    >
                    <p v-if="inlineCellSaving(conference._id, 'discountCode')" class="text-[11px] text-slate-500">
                      Saving...
                    </p>
                    <p v-if="inlineCellError(conference._id, 'discountCode')" class="text-[11px] text-red-600">
                      {{ inlineCellError(conference._id, "discountCode") }}
                    </p>
                  </div>
                  <button
                    v-else
                    type="button"
                    class="hover:text-orange-700"
                    @click="startInlineEdit(conference, 'discountCode')"
                  >
                    {{ conference.discountCode || "—" }}
                  </button>
                </td>
                <td class="relative px-3 py-2.5">
                  <button
                    type="button"
                    data-inline-status-toggle
                    class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium text-nowrap"
                    :class="statusTone(conference.status)"
                    :disabled="inlineCellSaving(conference._id, 'status')"
                    @click="toggleInlineStatusMenu(conference._id)"
                  >
                    {{
                      inlineCellSaving(conference._id, "status")
                        ? "Saving..."
                        : conference.status
                    }}
                  </button>
                  <div
                    v-if="inlineStatusMenuConferenceId === conference._id"
                    data-inline-status-menu
                    class="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg"
                  >
                    <div class="space-y-1">
                      <button
                        v-for="status in editableStatusOptions"
                        :key="status"
                        type="button"
                        class="block w-full rounded px-2 py-1 text-left text-slate-700 hover:bg-slate-100"
                        :class="status === conference.status ? 'bg-slate-100 font-medium' : ''"
                        :disabled="inlineCellSaving(conference._id, 'status')"
                        @click="selectInlineStatus(conference, status)"
                      >
                        {{ status }}
                      </button>
                    </div>
                  </div>
                  <p v-if="inlineCellError(conference._id, 'status')" class="mt-1 text-[11px] text-red-600">
                    {{ inlineCellError(conference._id, "status") }}
                  </p>
                </td>
                <td class="px-3 py-2.5">
                  <div class="relative inline-flex">
                    <button
                      type="button"
                      data-publish-confirm-toggle
                      class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium transition"
                      :class="conference.isPublished ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'"
                      :disabled="publishTogglePendingId === conference._id"
                      @click="requestPublishedToggle(conference)"
                    >
                      {{
                        publishTogglePendingId === conference._id
                          ? "Saving..."
                          : conference.isPublished
                            ? "Yes"
                            : "No"
                      }}
                    </button>
                    <div
                      v-if="publishUnpublishConfirmId === conference._id"
                      data-publish-confirm-menu
                      class="absolute left-0 top-full z-20 mt-1 w-44 rounded-md border border-slate-200 bg-white p-2 text-xs shadow-lg"
                    >
                      <p class="text-slate-700">Unpublish this conference?</p>
                      <div class="mt-2 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          class="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50"
                          :disabled="publishTogglePendingId === conference._id"
                          @click="cancelUnpublishConfirm"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          class="rounded-md border border-transparent bg-orange-custom px-2 py-1 text-white hover:bg-orange-custom-hover"
                          :disabled="publishTogglePendingId === conference._id"
                          @click="confirmUnpublish(conference)"
                        >
                          Unpublish
                        </button>
                      </div>
                    </div>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <button
                    type="button"
                    class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                    title="Edit conference document"
                    @click="openEditor(conference)"
                  >
                    <span class="sr-only">Edit conference document</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.9"
                      class="h-4 w-4"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M16.862 3.487a1.85 1.85 0 0 1 2.617 2.617L8.56 17.024l-3.876.862.862-3.876L16.862 3.487Z"
                      />
                      <path stroke-linecap="round" stroke-linejoin="round" d="m14.897 5.452 2.617 2.617" />
                    </svg>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900">CSV Import</h2>
          <p class="text-sm text-slate-600">
            Open the import dialog to preview or import conference CSV files.
          </p>
        </div>
        <button
            type="button"
            class="inline-flex items-center rounded-md border border-transparent bg-orange-custom px-4 py-2 text-sm font-medium text-white hover:bg-orange-custom-hover focus:outline-none focus:ring-2 focus:ring-orange-500"
            @click="openCsvDialog"
        >
          Open CSV Import
        </button>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="createDialogOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        @click="closeCreateDialog"
      >
        <div
          class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          @click.stop
        >
          <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">Add Conference</h2>
              <p class="text-sm text-slate-600">
                Create a conference document directly in the events database.
              </p>
            </div>
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              :disabled="createPending"
              @click="closeCreateDialog"
            >
              Close
            </button>
          </div>

          <div class="flex-1 space-y-5 overflow-y-auto p-5">
            <section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">Core Fields</h3>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-1 md:col-span-2">
                  <label class="block text-sm font-medium text-slate-800">Conference Name</label>
                  <input
                    v-model="createForm.name"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="Conference name"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Slug (optional)</label>
                  <input
                    v-model="createForm.slug"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="conference-slug"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Year</label>
                  <input
                    v-model="createForm.year"
                    type="text"
                    inputmode="numeric"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="2026"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Start Date (ISO)</label>
                  <input
                    v-model="createForm.startDateIso"
                    type="date"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Status</label>
                  <select
                    v-model="createForm.status"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                    <option v-for="status in editableStatusOptions" :key="status" :value="status">
                      {{ status }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="flex flex-wrap gap-4">
                <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    v-model="createForm.isPublished"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  >
                  Published
                </label>
                <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    v-model="createForm.hasAirtable"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  >
                  Airtable Linked
                </label>
                <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    v-model="createForm.recreateNextYear"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  >
                  Recreate on next year
                </label>
              </div>
            </section>

            <section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">Location & Links</h3>
              <div class="grid gap-3 md:grid-cols-2">
                <input
                  v-model="createForm.location"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Location"
                >
                <input
                  v-model="createForm.city"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="City"
                >
                <input
                  v-model="createForm.country"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Country"
                >
                <input
                  v-model="createForm.continent"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Continent"
                >
                <input
                  v-model="createForm.websiteUrl"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Website URL"
                >
                <input
                  v-model="createForm.xAccountUrl"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="X Account URL"
                >
                <input
                  v-model="createForm.startDateLabel"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Start Date Label (optional)"
                >
                <input
                  v-model="createForm.dateRangeLabel"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Date Range Label (optional)"
                >
                <input
                  v-model="createForm.monthLabel"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Month Label (optional)"
                >
                <select
                  v-model="createForm.bitvocationParticipation"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                >
                  <option value="unknown">Bitvocation Participation: Unknown</option>
                  <option value="yes">Bitvocation Participation: Yes</option>
                  <option value="no">Bitvocation Participation: No</option>
                </select>
                <input
                  v-model="createForm.contactName"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Contact Name"
                >
                <input
                  v-model="createForm.contactChannel"
                  type="text"
                  class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Contact Channel"
                >
              </div>
              <textarea
                v-model="createForm.notes"
                class="block h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                placeholder="Notes"
              />
              <textarea
                v-model="createForm.ownerTodo"
                class="block h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                placeholder="Owner TODO"
              />
            </section>

            <p v-if="createError" class="text-sm text-red-600">{{ createError }}</p>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              :disabled="createPending"
              @click="closeCreateDialog"
            >
              Cancel
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-transparent bg-orange-custom px-4 py-2 text-sm font-medium text-white hover:bg-orange-custom-hover"
              :disabled="createPending"
              @click="saveCreateConference"
            >
              {{ createPending ? "Creating..." : "Create Conference" }}
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="csvDialogOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
        @click="closeCsvDialog"
      >
        <div
          class="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          @click.stop
        >
          <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">CSV Intake</h2>
              <p class="text-sm text-slate-600">
                Preview and import conference CSV files into the events database.
              </p>
            </div>
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              :disabled="previewPending || importPending"
              @click="closeCsvDialog"
            >
              Close
            </button>
          </div>

          <div class="flex-1 space-y-5 overflow-y-auto p-5">
            <div class="grid gap-5 xl:grid-cols-[2fr_1fr]">
              <div class="space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <p class="text-sm font-semibold uppercase tracking-wide text-slate-700">Intake Input</p>
                  <label
                    class="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="file"
                      class="hidden"
                      accept=".csv,text/csv"
                      @change="handleCsvFileInput"
                    >
                    Upload CSV
                  </label>
                </div>
                <p v-if="csvFileName" class="text-xs text-slate-500">
                  Loaded file: {{ csvFileName }}
                </p>
                <textarea
                  v-model="csvInput"
                  class="h-44 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  placeholder="Paste semicolon-separated conference CSV here..."
                />
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    :disabled="previewPending || importPending"
                    @click="previewCsv"
                  >
                    {{ previewPending ? "Previewing..." : "Preview CSV" }}
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center rounded-md border border-transparent bg-orange-custom px-4 py-2 text-sm font-medium text-white hover:bg-orange-custom-hover focus:outline-none focus:ring-2 focus:ring-orange-500"
                    :disabled="importPending || previewPending"
                    @click="importCsv"
                  >
                    {{ importPending ? "Importing..." : "Import Conferences" }}
                  </button>
                </div>
                <p v-if="importError" class="text-sm text-red-600">{{ importError }}</p>
                <p v-if="importSuccessMessage" class="text-sm text-emerald-700">
                  {{ importSuccessMessage }}
                </p>
              </div>

              <div class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
                  Import Quality
                </h3>
                <p class="text-sm text-slate-600">
                  Parsed rows: <span class="font-semibold text-slate-900">{{ previewMeta.rowCount }}</span>
                </p>
                <p class="text-sm text-slate-600">
                  Valid conferences:
                  <span class="font-semibold text-slate-900">{{ previewMeta.validConferenceCount }}</span>
                </p>
                <p class="text-sm text-slate-600">
                  Ignored rows: <span class="font-semibold text-slate-900">{{ previewMeta.ignoredRowCount }}</span>
                </p>
                <p class="text-sm text-slate-600">
                  Contactable conferences:
                  <span class="font-semibold text-slate-900">{{ withContactCount }}</span>
                </p>
                <div v-if="previewWarnings.length" class="space-y-2 pt-2">
                  <p class="text-xs font-semibold uppercase tracking-wide text-amber-700">
                    Warnings
                  </p>
                  <ul class="space-y-1 text-xs text-amber-800">
                    <li
                      v-for="warning in previewWarnings"
                      :key="warning"
                      class="rounded-md bg-amber-50 px-2 py-1"
                    >
                      {{ warning }}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <section
              v-if="previewRows.length"
              class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h3 class="text-base font-semibold text-slate-900">Preview Snapshot</h3>
              <p class="mt-1 text-sm text-slate-600">
                First {{ previewRows.length }} normalized records from the latest CSV parse.
              </p>
              <div class="mt-4 overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-200 text-sm">
                  <thead class="bg-slate-50">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-slate-700">Conference</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-700">Date</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="previewConference in previewRows" :key="previewConference._id">
                      <td class="px-3 py-2 text-slate-800">{{ previewConference.name }}</td>
                      <td class="px-3 py-2 text-slate-600">
                        {{ formatDate(previewConference.startDateIso) }}
                      </td>
                      <td class="px-3 py-2 text-slate-600">{{ previewConference.status }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>

      <div
        v-if="editorOpen"
        class="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/40"
        @click="closeEditor"
      >
        <aside
          class="flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl"
          @click.stop
        >
          <div class="bg-gradient-to-r from-slate-900 to-orange-900 px-6 py-5 text-white">
            <p class="text-xs uppercase tracking-[0.18em] text-orange-300">Conference Editor</p>
            <h2 class="mt-2 text-xl font-semibold">{{ editorForm.name }}</h2>
          </div>

          <div class="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Identity & Publication
              </h3>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-1 md:col-span-2">
                  <label class="block text-sm font-medium text-slate-800">Conference Name</label>
                  <input
                    v-model="editorForm.name"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="Conference name"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Slug</label>
                  <input
                    v-model="editorForm.slug"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="conference-slug"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Year</label>
                  <input
                    v-model="editorForm.year"
                    type="text"
                    inputmode="numeric"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="2026"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Status</label>
                  <select
                    v-model="editorForm.status"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                    <option v-for="status in editableStatusOptions" :key="status" :value="status">
                      {{ status }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Bitvocation Participation</label>
                  <select
                    v-model="editorForm.bitvocationParticipation"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
              <div class="flex flex-wrap gap-4">
                <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    v-model="editorForm.isPublished"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  >
                  Published
                </label>
              </div>
            </section>

            <section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Links & Contact
              </h3>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Website URL</label>
                  <input
                    v-model="editorForm.websiteUrl"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="https://..."
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">X Account URL</label>
                  <input
                    v-model="editorForm.xAccountUrl"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="https://x.com/..."
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Contact Name</label>
                  <input
                    v-model="editorForm.contactName"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="Main contact"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Contact Channel</label>
                  <input
                    v-model="editorForm.contactChannel"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="email or URL"
                  >
                </div>
                <div class="space-y-1 md:col-span-2">
                  <label class="block text-sm font-semibold uppercase tracking-wide text-orange-800">Public URL</label>
                  <input
                    :value="editorPublicUrl"
                    type="text"
                    readonly
                    class="block w-full rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-900 focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                    placeholder="Set slug to generate public URL"
                  >
                </div>
              </div>
            </section>

            <section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Schedule & Geography
              </h3>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Start Date (ISO)</label>
                  <input
                    v-model="editorForm.startDateIso"
                    type="date"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Start Date Label</label>
                  <input
                    v-model="editorForm.startDateLabel"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="Jan 16, 2026"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Month Label</label>
                  <input
                    v-model="editorForm.monthLabel"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="01 Jan"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Date Range Label</label>
                  <input
                    v-model="editorForm.dateRangeLabel"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="January 16-17"
                  >
                </div>
                <div class="space-y-1 md:col-span-2">
                  <label class="block text-sm font-medium text-slate-800">Location</label>
                  <input
                    v-model="editorForm.location"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="US - Naples, FL"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">City</label>
                  <input
                    v-model="editorForm.city"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="Naples"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Country</label>
                  <input
                    v-model="editorForm.country"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="U.S."
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Continent</label>
                  <select
                    :value="editorContinentMode === 'custom' ? EDITOR_ADD_NEW_CONTINENT : editorForm.continent"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    @change="onEditorContinentSelectionChange(($event.target as HTMLSelectElement).value)"
                  >
                    <option value="">Select continent</option>
                    <option v-for="continent in continentOptions" :key="continent" :value="continent">
                      {{ continent }}
                    </option>
                    <option :value="EDITOR_ADD_NEW_CONTINENT">+ Add new...</option>
                  </select>
                  <input
                    v-if="editorContinentMode === 'custom'"
                    v-model="editorCustomContinent"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="North America"
                  >
                </div>
              </div>
              <div class="flex flex-wrap gap-4">
                <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    v-model="editorForm.hasAirtable"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  >
                  Airtable Linked
                </label>
                <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    v-model="editorForm.recreateNextYear"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  >
                  Recreate on next year
                </label>
              </div>
            </section>

            <section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Commercial & Performance
              </h3>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Discount Code</label>
                  <input
                    v-model="editorForm.discountCode"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Discount Label</label>
                  <input
                    v-model="editorForm.discountLabel"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Commission Label</label>
                  <input
                    v-model="editorForm.commissionLabel"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Tickets Sold</label>
                  <input
                    v-model="editorForm.ticketsSold"
                    type="text"
                    inputmode="numeric"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Commission Earned Label</label>
                  <input
                    v-model="editorForm.commissionEarnedLabel"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Commission Received</label>
                  <select
                    v-model="editorForm.commissionReceived"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>
            </section>

            <section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Internal Notes & TODO
              </h3>
              <div class="space-y-1">
                <label class="block text-sm font-medium text-slate-800">Owner TODO</label>
                <textarea
                  v-model="editorForm.ownerTodo"
                  class="block h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                ></textarea>
              </div>
              <div class="space-y-1">
                <label class="block text-sm font-medium text-slate-800">Notes</label>
                <textarea
                  v-model="editorForm.notes"
                  class="block h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                ></textarea>
              </div>
            </section>

            <section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Source & Audit Metadata
              </h3>
              <div class="grid gap-3 md:grid-cols-2">
                <div class="space-y-1 md:col-span-2">
                  <label class="block text-sm font-medium text-slate-800">Document ID</label>
                  <input
                    v-model="editorForm.documentId"
                    type="text"
                    readonly
                    class="block w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Document Type</label>
                  <input
                    v-model="editorForm.documentType"
                    type="text"
                    readonly
                    class="block w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Document Revision</label>
                  <input
                    v-model="editorForm.documentRev"
                    type="text"
                    readonly
                    class="block w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700"
                    placeholder="Will update after save"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Source Format</label>
                  <select
                    v-model="editorForm.sourceFormat"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                    <option value="csv-semicolon">csv-semicolon</option>
                  </select>
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Source Row Number</label>
                  <input
                    v-model="editorForm.sourceRowNumber"
                    type="text"
                    inputmode="numeric"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  >
                </div>
                <div class="space-y-1 md:col-span-2">
                  <label class="block text-sm font-medium text-slate-800">Source Imported At (ISO)</label>
                  <input
                    v-model="editorForm.sourceImportedAt"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="2026-01-01T10:00:00.000Z"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Created At (ISO)</label>
                  <input
                    v-model="editorForm.createdAt"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="2026-01-01T10:00:00.000Z"
                  >
                </div>
                <div class="space-y-1">
                  <label class="block text-sm font-medium text-slate-800">Updated At (ISO)</label>
                  <input
                    v-model="editorForm.updatedAt"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="2026-01-01T10:00:00.000Z"
                  >
                </div>
              </div>
            </section>

            <section class="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-700">
                Notification
              </h3>
              <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  v-model="editorForm.notifyWatchers"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                >
                Send Nostr update to watchers before save
              </label>
              <div class="space-y-1">
                <label class="block text-sm font-medium text-slate-800">Admin note (optional)</label>
                <textarea
                  v-model="editorForm.notifyMessage"
                  class="block h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                  :disabled="!editorForm.notifyWatchers"
                  placeholder="Optional context to include in the Nostr DM."
                ></textarea>
              </div>
            </section>

            <p v-if="editorError" class="text-sm text-red-600">{{ editorError }}</p>
            <p v-if="editorSuccess" class="text-sm text-emerald-700">{{ editorSuccess }}</p>
          </div>

          <div class="flex items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              :disabled="editorPending || notificationPreviewPending"
              @click="closeEditor"
            >
              Close
            </button>
            <button
              type="button"
              class="inline-flex items-center rounded-md border border-transparent bg-orange-custom px-4 py-2 text-sm font-medium text-white hover:bg-orange-custom-hover focus:outline-none focus:ring-2 focus:ring-orange-500"
              :disabled="editorPending || notificationPreviewPending"
              @click="saveEditor"
            >
              {{
                editorPending
                  ? "Saving..."
                  : notificationPreviewPending
                    ? "Preparing Preview..."
                    : "Save Changes"
              }}
            </button>
          </div>
        </aside>

        <div
          v-if="notificationPreviewOpen"
          class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4"
          @click.stop="closeNotificationPreview"
        >
          <div
            class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            @click.stop
          >
            <div class="border-b border-slate-200 px-5 py-4">
              <h3 class="text-lg font-semibold text-slate-900">Confirm Nostr Notification</h3>
              <p class="mt-1 text-sm text-slate-600">
                This is the exact message that will be sent.
                Eligible watchers: {{ notificationPreviewEligible }}
              </p>
            </div>

            <div class="flex-1 space-y-3 overflow-y-auto p-5">
              <p
                v-if="!notificationPreviewEligible"
                class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                No eligible watchers are currently subscribed for this conference.
              </p>

              <div
                v-else
                class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
              >
                <p class="font-semibold text-slate-700">Watchers</p>
                <p class="mt-1 break-all">
                  {{ notificationPreviewWatchers.join(", ") }}
                </p>
              </div>

              <div class="rounded-md border border-slate-300 bg-slate-950 p-4 text-xs text-slate-100">
                <pre class="whitespace-pre-wrap break-words font-mono">{{ notificationPreviewMessage }}</pre>
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                class="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
                :disabled="editorPending"
                @click="closeNotificationPreview"
              >
                Cancel
              </button>
              <button
                type="button"
                class="inline-flex items-center rounded-md border border-transparent bg-orange-custom px-4 py-2 text-sm font-medium text-white hover:bg-orange-custom-hover focus:outline-none focus:ring-2 focus:ring-orange-500"
                :disabled="editorPending"
                @click="confirmNotificationAndSave"
              >
                {{ editorPending ? "Sending..." : "Confirm & Save" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
