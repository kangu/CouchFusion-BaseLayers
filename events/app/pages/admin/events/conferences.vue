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
  confirmedDates: boolean;
  hasAirtable: boolean;
  isPublished: boolean;
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

type ConferencesSortDirection = "asc" | "desc";
type ConferencesSortKey =
  | "name"
  | "year"
  | "startDateIso"
  | "location"
  | "country"
  | "status"
  | "isPublished"
  | "confirmedDates";

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

const queryState = reactive({
  search: "",
  status: "all",
  continent: "all",
  year: "all",
  published: "all",
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
  confirmedDates: false,
  hasAirtable: false,
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
  status: "Not started",
  bitvocationParticipation: "unknown" as "yes" | "no" | "unknown",
  contactName: "",
  contactChannel: "",
  notes: "",
  ownerTodo: "",
  isPublished: false,
  confirmedDates: false,
  hasAirtable: false,
});

// == computed ==
const listQuery = computed(() => {
  const query: Record<string, string | number> = {
    page: 1,
    pageSize: 120,
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

const conferences = computed(() => conferencesData.value?.conferences ?? []);
const sortedConferences = computed(() => {
  const items = [...conferences.value];
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
      case "confirmedDates":
        result = applyBooleanDirection(
          Number(left.confirmedDates) - Number(right.confirmedDates),
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
const totalConferences = computed(() => conferencesData.value?.total ?? 0);
const statusCounts = computed(() => conferencesData.value?.statusCounts ?? {});
const publicationCounts = computed(
  () =>
    conferencesData.value?.publicationCounts ?? {
      published: 0,
      draft: 0,
    },
);
const statusOptions = computed(() =>
  Object.keys(statusCounts.value).sort((left, right) =>
    left.localeCompare(right),
  ),
);
const yearOptions = computed(() => conferencesData.value?.yearOptions ?? []);
const continentOptions = computed(
  () => conferencesData.value?.continentOptions ?? [],
);

const confirmedCount = computed(
  () => conferences.value.filter((conference) => conference.confirmedDates).length,
);
const inProgressCount = computed(
  () =>
    conferences.value.filter(
      (conference) => conference.status.toLowerCase() === "in progress",
    ).length,
);
const withContactCount = computed(
  () =>
    conferences.value.filter((conference) => Boolean(conference.contactChannel))
      .length,
);
const publishedCount = computed(() => publicationCounts.value.published);
const draftCount = computed(() => publicationCounts.value.draft);

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
const editableStatusOptions = [
  "Not started",
  "In progress",
  "Completed",
  "Blocked",
  "Archived",
];

// == lifecycle ==

// == watchers ==
watch(
  () => csvInput.value,
  () => {
    previewData.value = null;
  },
);

// == local page api ==
const statusTone = (status: string) => {
  const normalized = status.trim().toLowerCase();
  if (normalized === "in progress") {
    return "bg-amber-100 text-amber-800 border-amber-300";
  }
  if (normalized === "completed" || normalized === "done") {
    return "bg-emerald-100 text-emerald-800 border-emerald-300";
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
  createForm.status = "Not started";
  createForm.bitvocationParticipation = "unknown";
  createForm.contactName = "";
  createForm.contactChannel = "";
  createForm.notes = "";
  createForm.ownerTodo = "";
  createForm.isPublished = false;
  createForm.confirmedDates = false;
  createForm.hasAirtable = false;
};

const openCreateDialog = () => {
  createError.value = null;
  createSuccess.value = null;
  resetCreateForm();
  createDialogOpen.value = true;
};

const closeCreateDialog = () => {
  if (createPending.value) return;
  createDialogOpen.value = false;
  createError.value = null;
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
    await $fetch<ConferencePatchResponse>("/api/events/conferences", {
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
        status: toNullableText(createForm.status) ?? "Not started",
        bitvocationParticipation: createForm.bitvocationParticipation,
        contactName: toNullableText(createForm.contactName),
        contactChannel: toNullableText(createForm.contactChannel),
        notes: toNullableText(createForm.notes),
        ownerTodo: toNullableText(createForm.ownerTodo),
        isPublished: createForm.isPublished,
        confirmedDates: createForm.confirmedDates,
        hasAirtable: createForm.hasAirtable,
      },
    });

    createSuccess.value = "Conference created.";
    createDialogOpen.value = false;
    await refreshConferences();
  } catch (error: any) {
    createError.value = error?.data?.statusMessage || "Failed to create conference.";
  } finally {
    createPending.value = false;
  }
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
      _rev: response.rev,
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
  editorForm.status = conference.status || "Not started";
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
  editorForm.continent = conference.continent || "";
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
  editorForm.confirmedDates = conference.confirmedDates;
  editorForm.hasAirtable = conference.hasAirtable;
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
    continent: toNullableText(editorForm.continent),
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
    confirmedDates: editorForm.confirmedDates,
    hasAirtable: editorForm.hasAirtable,
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
  if (!editingConferenceId.value) {
    editorError.value = "No conference selected for editing.";
    return;
  }

  editorPending.value = true;
  editorError.value = null;
  editorSuccess.value = null;

  try {
    const response = await $fetch<ConferencePatchResponse>(
      `/api/events/conferences/${encodeURIComponent(editingConferenceId.value)}`,
      {
        method: "PATCH",
        body: payload,
      },
    );

    editorForm.documentRev = response.rev || editorForm.documentRev;
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
    await refreshConferences();
  } catch (error: any) {
    editorError.value = error?.data?.statusMessage || "Update failed.";
  } finally {
    editorPending.value = false;
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
        <div class="grid gap-3 sm:grid-cols-2 lg:mt-auto lg:grid-cols-5">
          <div class="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p class="text-xs uppercase tracking-wide text-orange-200">Conferences</p>
            <p class="mt-2 text-2xl font-semibold">{{ totalConferences }}</p>
          </div>
          <div class="rounded-2xl border border-white/20 bg-white/10 p-4">
            <p class="text-xs uppercase tracking-wide text-orange-200">Dates Confirmed</p>
            <p class="mt-2 text-2xl font-semibold">{{ confirmedCount }}</p>
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

    <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="grid gap-3 md:grid-cols-5">
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
        v-else-if="!conferences.length"
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
                <th class="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <button type="button" class="inline-flex items-center gap-1" @click="toggleSort('confirmedDates')">
                    Confirmed <span class="text-slate-400">{{ sortIndicator("confirmedDates") }}</span>
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
                  <p class="font-medium text-slate-900">{{ conference.name }}</p>
<!--                  <p class="text-xs text-slate-500">{{ conference.slug }}</p>-->
                </td>
                <td class="px-3 py-2.5 text-slate-700 text-nowrap">{{ formatDate(conference.startDateIso) }}</td>
                <td class="px-3 py-2.5 text-slate-700">
                  <span
                    class="inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold text-nowrap"
                    :class="conferenceMonthPillClass(conference)"
                  >
                    {{ conferenceMonthLabel(conference) }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-slate-700">{{ conference.location || "Location TBD" }}</td>
                <td class="px-3 py-2.5 text-slate-700">{{ conference.country || "—" }}</td>
                <td class="px-3 py-2.5 text-slate-700">{{ conference.discountCode || "—" }}</td>
                <td class="px-3 py-2.5">
                  <span
                    class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium text-nowrap"
                    :class="statusTone(conference.status)"
                  >
                    {{ conference.status }}
                  </span>
                </td>
                <td class="px-3 py-2.5">
                  <div class="relative inline-flex">
                    <button
                      type="button"
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
                <td class="px-3 py-2.5">
                  <span
                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="conference.confirmedDates ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'"
                  >
                    {{ conference.confirmedDates ? "Yes" : "No" }}
                  </span>
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
                    v-model="createForm.confirmedDates"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  >
                  Confirmed Dates
                </label>
                <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    v-model="createForm.hasAirtable"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  >
                  Airtable Linked
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
                      <th class="px-3 py-2 text-left font-medium text-slate-700">Confirmed</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="previewConference in previewRows" :key="previewConference._id">
                      <td class="px-3 py-2 text-slate-800">{{ previewConference.name }}</td>
                      <td class="px-3 py-2 text-slate-600">
                        {{ formatDate(previewConference.startDateIso) }}
                      </td>
                      <td class="px-3 py-2 text-slate-600">{{ previewConference.status }}</td>
                      <td class="px-3 py-2 text-slate-600">
                        {{ previewConference.confirmedDates ? "Yes" : "No" }}
                      </td>
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
            <h2 class="mt-2 text-xl font-semibold">Full Conference Document</h2>
            <p class="mt-1 text-sm text-slate-200">
              Edit all conference document fields, grouped by meaning and source context.
            </p>
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
                  <input
                    v-model="editorForm.continent"
                    type="text"
                    class="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/60"
                    placeholder="North America"
                  >
                </div>
              </div>
              <div class="flex flex-wrap gap-4">
                <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    v-model="editorForm.confirmedDates"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  >
                  Confirmed Dates
                </label>
                <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    v-model="editorForm.hasAirtable"
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  >
                  Airtable Linked
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
