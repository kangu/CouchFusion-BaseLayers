/**
 * On-demand reports computed from raw events (bounded by
 * `analytics_max_scan_days`): goals, funnel, journey, retention, UTM,
 * attribution, revenue, breakdown, plus the sessions explorer.
 */
import type { EngineConfig } from "./config";
import { SCAN_MARGIN_MS } from "./aggregator";
import { createExclusionMatcher } from "./exclusions";
import { parseFilters, QueryError, resolveRange, type ResolvedRange } from "./query";
import { buildVisits, filterVisit, isBounce, visitAttribute, visitDuration, type Visit } from "./rollup";
import { readRawEvents } from "./storage";
import { daysInRange, formatDay, localDay } from "./time";
import type { Filter, RawEvent, SiteDoc, SiteGoal } from "./types";

export interface ReportInput {
  range: ResolvedRange;
  filters: Filter[];
  visits: Visit[];
  timeZone: string;
}

/** Loads visits in range (visit-level filters applied). */
export const loadVisits = async (config: EngineConfig, site: SiteDoc, query: Record<string, any>): Promise<ReportInput> => {
  const range = resolveRange(query, site.timezone);
  const days = daysInRange(range.from, range.to, 5000);
  if (days.length > config.maxScanDays) {
    throw new QueryError(400, `Reports are limited to ${config.maxScanDays} days (analytics_max_scan_days)`);
  }
  const filters = parseFilters(query.filters);
  const events = await readRawEvents(config, site.id, range.fromTs - SCAN_MARGIN_MS, range.toTs + SCAN_MARGIN_MS);
  const daySet = new Set(days);
  const visits = buildVisits(events).filter((visit) => {
    if (range.window) {
      if (visit.start < range.window[0] || visit.start >= range.window[1]) return false;
    } else if (!daySet.has(localDay(visit.start, site.timezone))) return false;
    return filters.length ? filterVisit(visit, filters) !== null : true;
  });
  return { range, filters, visits, timeZone: site.timezone };
};

export interface Step {
  type: "path" | "event";
  value: string;
}

export const parseSteps = (raw: unknown, min = 1, max = 10): Step[] => {
  const steps = (Array.isArray(raw) ? raw : [])
    .filter((s) => s && typeof s.value === "string" && s.value.trim())
    .slice(0, max)
    .map((s) => ({ type: s.type === "event" ? "event" : "path", value: String(s.value).trim().slice(0, 200) }) as Step);
  if (steps.length < min) throw new QueryError(400, `At least ${min} step(s) required`);
  return steps;
};

/** True when an event satisfies a step (paths accept a trailing `*`). */
export const stepMatches = (event: RawEvent, step: Step): boolean => {
  if (step.type === "event") return event.t === "ev" && event.n === step.value;
  return event.t === "pv" && createExclusionMatcher([step.value])(event.p);
};

const distinct = (visits: Visit[]) => new Set(visits.map((v) => v.visitor)).size;

/** Goals: visitors/visits converting on each goal. */
export const goalsReport = (input: ReportInput, goals: SiteGoal[]) => {
  const totalVisitors = distinct(input.visits);
  return {
    totalVisitors,
    totalVisits: input.visits.length,
    goals: goals.map((goal) => {
      const step: Step = { type: goal.type, value: goal.value };
      const converted = input.visits.filter((visit) => visit.events.some((e) => stepMatches(e, step)));
      const count = input.visits.reduce((sum, visit) => sum + visit.events.filter((e) => stepMatches(e, step)).length, 0);
      const visitors = distinct(converted);
      return {
        ...goal,
        visitors,
        visits: converted.length,
        count,
        conversionRate: totalVisitors ? Math.round((visitors / totalVisitors) * 1000) / 10 : 0,
      };
    }),
  };
};

/** Funnel: ordered steps within one visit and `windowMinutes` of the first step. */
export const funnelReport = (input: ReportInput, steps: Step[], windowMinutes = 60) => {
  const windowMs = Math.max(1, windowMinutes) * 60_000;
  const reached = steps.map(() => ({ visits: 0, visitors: new Set<string>() }));
  for (const visit of input.visits) {
    let index = 0;
    let startTs = 0;
    for (const event of visit.events) {
      if (index >= steps.length) break;
      if (index > 0 && event.ts - startTs > windowMs) break;
      if (stepMatches(event, steps[index])) {
        if (index === 0) startTs = event.ts;
        reached[index].visits += 1;
        reached[index].visitors.add(visit.visitor);
        index += 1;
      }
    }
  }
  const first = reached[0].visitors.size;
  return {
    windowMinutes,
    steps: steps.map((step, i) => {
      const visitors = reached[i].visitors.size;
      const previous = i === 0 ? visitors : reached[i - 1].visitors.size;
      return {
        ...step,
        visitors,
        visits: reached[i].visits,
        conversionRate: first ? Math.round((visitors / first) * 1000) / 10 : 0,
        dropoff: previous - visitors,
        dropoffRate: previous ? Math.round(((previous - visitors) / previous) * 1000) / 10 : 0,
      };
    }),
  };
};

const stepLabel = (event: RawEvent) => (event.t === "ev" ? `⚡ ${event.n}` : event.p);

/** Journeys: most common sequences of pages/events per visit. */
export const journeyReport = (input: ReportInput, length = 5, start?: Step | null, end?: Step | null) => {
  const size = Math.min(7, Math.max(2, length));
  const counts = new Map<string, { path: string[]; visits: number; visitors: Set<string> }>();
  for (const visit of input.visits) {
    let events = visit.events.filter((e) => e.t !== "id");
    if (start) {
      const index = events.findIndex((e) => stepMatches(e, start));
      if (index < 0) continue;
      events = events.slice(index);
    }
    const labels: string[] = [];
    let endIndex = -1;
    for (const event of events) {
      const label = stepLabel(event);
      if (labels[labels.length - 1] !== label) labels.push(label);
      if (end && endIndex < 0 && stepMatches(event, end)) endIndex = labels.length;
    }
    if (end && endIndex < 0) continue;
    const path = (end ? labels.slice(0, endIndex) : labels).slice(0, size);
    const key = path.join("\u001f");
    const entry = counts.get(key) ?? { path, visits: 0, visitors: new Set<string>() };
    entry.visits += 1;
    entry.visitors.add(visit.visitor);
    counts.set(key, entry);
  }
  return {
    totalVisits: input.visits.length,
    journeys: [...counts.values()]
      .map((entry) => ({ path: entry.path, visits: entry.visits, visitors: entry.visitors.size }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 50),
  };
};

/** Cross-day identity: app-supplied id or opt-in persistent id. */
export const identityOf = (visit: Visit): string | null => {
  for (const event of visit.events) {
    if (event.uid) return `u:${event.uid}`;
    if (event.pid) return `p:${event.pid}`;
  }
  return null;
};

/** Daily retention cohorts (needs identify() or persistent ids). */
export const retentionReport = (input: ReportInput, maxDays = 14) => {
  const days = daysInRange(input.range.from, input.range.to, 400);
  const activity = new Map<string, Set<string>>();
  let anonymousVisits = 0;
  for (const visit of input.visits) {
    const identity = identityOf(visit);
    if (!identity) {
      anonymousVisits += 1;
      continue;
    }
    const set = activity.get(identity) ?? new Set<string>();
    set.add(localDay(visit.start, input.timeZone));
    activity.set(identity, set);
  }
  const cohorts = new Map<string, string[]>();
  for (const [identity, active] of activity) {
    const firstDay = [...active].sort()[0];
    const list = cohorts.get(firstDay) ?? [];
    list.push(identity);
    cohorts.set(firstDay, list);
  }
  const horizon = Math.min(maxDays, days.length - 1);
  return {
    identifiedVisitors: activity.size,
    anonymousVisits,
    note: activity.size
      ? null
      : "Retention needs cross-day identity: call identify(userId) or enable analytics_persistent_id (consent required).",
    cohorts: days
      .filter((day) => cohorts.has(day))
      .map((day) => {
        const members = cohorts.get(day)!;
        const dayIndex = days.indexOf(day);
        return {
          day: formatDay(day),
          size: members.length,
          retention: Array.from({ length: horizon + 1 }, (_, offset) => {
            const target = days[dayIndex + offset];
            if (!target) return null;
            const returning = members.filter((m) => activity.get(m)!.has(target)).length;
            return Math.round((returning / members.length) * 1000) / 10;
          }),
        };
      }),
  };
};

const groupVisits = (visits: Visit[], keyOf: (visit: Visit) => string[] | null) => {
  const groups = new Map<string, { key: string[]; visits: Visit[] }>();
  for (const visit of visits) {
    const key = keyOf(visit);
    if (!key) continue;
    const id = key.join("\u001f");
    const group = groups.get(id) ?? { key, visits: [] };
    group.visits.push(visit);
    groups.set(id, group);
  }
  return [...groups.values()].map(({ key, visits }) => {
    const bounces = visits.filter(isBounce).length;
    const duration = visits.reduce((sum, v) => sum + visitDuration(v), 0);
    return {
      key,
      visitors: distinct(visits),
      visits: visits.length,
      pageviews: visits.reduce((sum, v) => sum + v.pageviews.length, 0),
      events: visits.reduce((sum, v) => sum + v.customs.length, 0),
      bounceRate: visits.length ? Math.round((bounces / visits.length) * 1000) / 10 : 0,
      avgDuration: visits.length ? Math.round(duration / visits.length) : 0,
    };
  }).sort((a, b) => b.visitors - a.visitors || b.visits - a.visits);
};

/** Multi-dimension pivot (1-3 dimensions). */
export const breakdownReport = (input: ReportInput, dims: string[]) => {
  const fields = dims.filter((d) => typeof d === "string").slice(0, 3);
  if (!fields.length) throw new QueryError(400, "Choose at least one dimension");
  const pageDims = new Set(["page", "title", "host"]);
  const keyOf = (visit: Visit) => {
    const key = fields.map((dim) => {
      if (pageDims.has(dim)) {
        const pv = visit.pageviews[0];
        return (dim === "page" ? pv?.p : dim === "title" ? pv?.ti : pv?.h) ?? "(none)";
      }
      if (dim === "event") return visit.customs[0]?.n ?? "(none)";
      return visitAttribute(visit, dim) ?? "(none)";
    });
    return key;
  };
  return { dims: fields, rows: groupVisits(input.visits, keyOf).slice(0, 200) };
};

/** UTM combinations. */
export const utmReport = (input: ReportInput) => ({
  rows: groupVisits(input.visits, (visit) => {
    const utm = visit.first.utm;
    if (!utm || !Object.values(utm).some(Boolean)) return null;
    return [utm.s ?? "(none)", utm.m ?? "(none)", utm.c ?? "(none)", utm.t ?? "", utm.ct ?? ""];
  }).slice(0, 200),
});

const revenueOf = (event: RawEvent) => {
  const raw = event.d?.revenue;
  const amount = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(amount)) return null;
  return { amount, currency: String(event.d?.currency ?? "USD").toUpperCase().slice(0, 3) };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Revenue totals and breakdowns by day, event, country and channel. */
export const revenueReport = (input: ReportInput, currency?: string) => {
  const totals = new Map<string, { amount: number; count: number; visitors: Set<string> }>();
  const by = { day: new Map<string, number>(), event: new Map<string, number>(), country: new Map<string, number>(), channel: new Map<string, number>(), referrer: new Map<string, number>() };
  const add = (map: Map<string, number>, key: string, amount: number) => map.set(key, round2((map.get(key) ?? 0) + amount));
  for (const visit of input.visits) {
    for (const event of visit.customs) {
      const revenue = revenueOf(event);
      if (!revenue) continue;
      const total = totals.get(revenue.currency) ?? { amount: 0, count: 0, visitors: new Set<string>() };
      total.amount = round2(total.amount + revenue.amount);
      total.count += 1;
      total.visitors.add(visit.visitor);
      totals.set(revenue.currency, total);
      if (currency && revenue.currency !== currency) continue;
      add(by.day, formatDay(localDay(event.ts, input.timeZone)), revenue.amount);
      add(by.event, event.n ?? "(none)", revenue.amount);
      add(by.country, visit.first.cc ?? "(unknown)", revenue.amount);
      add(by.channel, visit.first.ch ?? "direct", revenue.amount);
      add(by.referrer, visit.first.r ?? "(direct)", revenue.amount);
    }
  }
  const currencies = [...totals.keys()].sort();
  const sorted = (map: Map<string, number>) => [...map].map(([value, amount]) => ({ value, amount })).sort((a, b) => b.amount - a.amount);
  return {
    currency: currency ?? currencies[0] ?? null,
    totals: currencies.map((c) => {
      const t = totals.get(c)!;
      return { currency: c, amount: t.amount, count: t.count, visitors: t.visitors.size, average: t.count ? round2(t.amount / t.count) : 0 };
    }),
    series: daysInRange(input.range.from, input.range.to, 400).map((day) => ({ t: formatDay(day), amount: by.day.get(formatDay(day)) ?? 0 })),
    byEvent: sorted(by.event),
    byCountry: sorted(by.country),
    byChannel: sorted(by.channel),
    byReferrer: sorted(by.referrer),
  };
};

/**
 * Attribution of conversions (a goal step) to the first or last non-direct
 * touch of the converting identity (app id / persistent id, else the visitor).
 */
export const attributionReport = (input: ReportInput, goal: Step, model: "first" | "last" = "last") => {
  const byIdentity = new Map<string, Visit[]>();
  for (const visit of input.visits) {
    const identity = identityOf(visit) ?? `v:${visit.visitor}`;
    const list = byIdentity.get(identity) ?? [];
    list.push(visit);
    byIdentity.set(identity, list);
  }
  const tallies = { channel: new Map<string, number>(), referrer: new Map<string, number>(), utm_source: new Map<string, number>(), utm_campaign: new Map<string, number>() };
  const revenue = new Map<string, number>();
  let conversions = 0;
  for (const visits of byIdentity.values()) {
    visits.sort((a, b) => a.start - b.start);
    const convertingIndex = visits.findIndex((v) => v.events.some((e) => stepMatches(e, goal)));
    if (convertingIndex < 0) continue;
    conversions += 1;
    const touches = visits.slice(0, convertingIndex + 1);
    const nonDirect = touches.filter((v) => v.first.ch !== "direct");
    const touch = (model === "first" ? nonDirect[0] : nonDirect[nonDirect.length - 1]) ?? touches[model === "first" ? 0 : touches.length - 1];
    const conversionEvent = visits[convertingIndex].events.find((e) => stepMatches(e, goal));
    const value = conversionEvent ? revenueOf(conversionEvent)?.amount ?? 0 : 0;
    const keys = {
      channel: touch.first.ch ?? "direct",
      referrer: touch.first.r ?? "(direct)",
      utm_source: touch.first.utm?.s ?? "(none)",
      utm_campaign: touch.first.utm?.c ?? "(none)",
    };
    for (const [dim, key] of Object.entries(keys)) {
      const map = tallies[dim as keyof typeof tallies];
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    revenue.set(keys.channel, round2((revenue.get(keys.channel) ?? 0) + value));
  }
  const rows = (map: Map<string, number>) =>
    [...map].map(([value, count]) => ({ value, conversions: count, share: conversions ? Math.round((count / conversions) * 1000) / 10 : 0 })).sort((a, b) => b.conversions - a.conversions);
  return {
    model,
    goal,
    conversions,
    channel: rows(tallies.channel).map((row) => ({ ...row, revenue: revenue.get(row.value) ?? 0 })),
    referrer: rows(tallies.referrer),
    utm_source: rows(tallies.utm_source),
    utm_campaign: rows(tallies.utm_campaign),
  };
};

/** Session (visit) summaries, newest first. */
export const sessionList = (input: ReportInput, offset = 0, limit = 50) => {
  const visits = [...input.visits].sort((a, b) => b.start - a.start);
  return {
    total: visits.length,
    sessions: visits.slice(offset, offset + limit).map((visit) => ({
      id: visit.id,
      visitor: visit.visitor,
      start: visit.start,
      duration: visitDuration(visit),
      pageviews: visit.pageviews.length,
      events: visit.customs.length,
      entry: visitAttribute(visit, "entry"),
      exit: visitAttribute(visit, "exit"),
      country: visit.first.cc ?? null,
      city: visit.first.ci ?? null,
      browser: visit.first.br,
      os: visit.first.os,
      device: visit.first.dv,
      screen: visit.first.sc ?? null,
      language: visit.first.lg ?? null,
      referrer: visit.first.r ?? null,
      channel: visit.first.ch,
      identity: identityOf(visit),
      bounce: isBounce(visit),
    })),
  };
};

/** Full event timeline for one visit id (`<visitor>-<start base36>`). */
export const sessionDetail = async (config: EngineConfig, site: SiteDoc, visitId: string) => {
  const match = visitId.match(/^([0-9a-f]{16})-([0-9a-z]+)$/);
  if (!match) throw new QueryError(400, "Invalid session id");
  const start = parseInt(match[2], 36);
  const events = await readRawEvents(config, site.id, start - 31 * 60_000, start + 12 * 3600_000);
  const visit = buildVisits(events.filter((e) => e.v === match[1])).find((v) => v.id === visitId);
  if (!visit) throw new QueryError(404, "Session not found");
  return {
    ...sessionList({ range: null as any, filters: [], visits: [visit], timeZone: site.timezone }).sessions[0],
    timeline: visit.events.map((e) => ({
      ts: e.ts,
      type: e.t,
      path: e.p,
      title: e.ti ?? null,
      name: e.n ?? null,
      data: e.d ?? null,
      uid: e.uid ?? null,
    })),
  };
};
