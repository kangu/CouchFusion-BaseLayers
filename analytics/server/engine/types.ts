/**
 * Shared engine document shapes.
 */

/** Raw hit stored in `<prefix>_raw_<yyyy>_<mm>`. Short keys keep docs small. */
export interface RawEvent {
  _id: string;
  _rev?: string;
  /** pv = pageview, ev = custom event, id = identify. */
  t: "pv" | "ev" | "id";
  ts: number;
  /** Daily-salted visitor hash. */
  v: string;
  p: string;
  q?: string | null;
  h: string;
  ti?: string | null;
  r?: string | null;
  rd?: string | null;
  rp?: string | null;
  ch: string;
  utm?: { s: string | null; m: string | null; c: string | null; t: string | null; ct: string | null } | null;
  br: string;
  os: string;
  dv: string;
  sc?: string | null;
  lg?: string | null;
  cc?: string | null;
  rg?: string | null;
  ci?: string | null;
  n?: string | null;
  d?: Record<string, string | number | boolean> | null;
  tg?: string | null;
  uid?: string | null;
  pid?: string | null;
  /** Imported rows keep their origin. */
  src?: string;
}

export interface SiteGoal {
  id: string;
  name: string;
  type: "path" | "event";
  value: string;
}

export interface SiteDoc {
  _id: string;
  _rev?: string;
  type: "site";
  id: string;
  name: string;
  domains: string[];
  timezone: string;
  excludedPaths: string[];
  keepQuery: boolean;
  keepHash: boolean;
  enabled: boolean;
  shareToken: string | null;
  allowedRoles: string[];
  goals: SiteGoal[];
  createdAt: string;
  updatedAt: string;
}

export interface DimEntry {
  /** pageviews */
  pv?: number;
  /** visitors (daily unique, summed across days) */
  v?: number;
  /** visits */
  vi?: number;
  /** bounces */
  b?: number;
  /** total visit duration in seconds */
  d?: number;
  /** event count */
  c?: number;
}

export interface Totals {
  visitors: number;
  visits: number;
  pageviews: number;
  bounces: number;
  duration: number;
  events: number;
}

export interface HourBucket {
  pv: number;
  v: number;
  vi: number;
}

/** Rollup for one site-local day: `agg:<site>:<yyyymmdd>`. */
export interface DayRollup {
  _id?: string;
  _rev?: string;
  type?: "agg";
  site?: string;
  day: string;
  totals: Totals;
  hours: HourBucket[];
  dims: Record<string, Record<string, DimEntry>>;
  revenue: Record<string, number>;
  computedAt?: number;
}

export const VISIT_DIMENSIONS = [
  "referrer",
  "referrer_domain",
  "channel",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "browser",
  "os",
  "device",
  "screen",
  "language",
  "country",
  "region",
  "city",
  "tag",
  "entry",
  "exit",
] as const;

export const PAGE_DIMENSIONS = ["page", "title", "host"] as const;
export const EVENT_DIMENSIONS = ["event", "prop"] as const;

export type Dimension =
  | (typeof VISIT_DIMENSIONS)[number]
  | (typeof PAGE_DIMENSIONS)[number]
  | (typeof EVENT_DIMENSIONS)[number];

export const ALL_DIMENSIONS: Dimension[] = [
  ...PAGE_DIMENSIONS,
  ...VISIT_DIMENSIONS,
  ...EVENT_DIMENSIONS,
];

export interface Filter {
  dim: Dimension;
  op: "eq" | "neq" | "contains" | "not_contains";
  value: string;
}
