<script setup lang="ts">
interface ConferenceMapItem {
  _id: string;
  name: string;
  city: string | null;
  country: string | null;
  continent: string | null;
  location: string | null;
  startDateIso: string | null;
  dateRangeLabel: string | null;
}

interface GeoPoint {
  lat: number;
  lng: number;
}

interface MapMarker {
  key: string;
  x: number;
  y: number;
  cityLabel: string;
  countryLabel: string;
  count: number;
  eventNames: string[];
}

const props = withDefaults(
  defineProps<{
    conferences?: ConferenceMapItem[];
  }>(),
  {
    conferences: () => [],
  },
);

// == props ==

// == composables ==

// == local data ==
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 500;

const COUNTRY_COORDINATES: Record<string, GeoPoint> = {
  "united states": { lat: 39.8, lng: -98.6 },
  us: { lat: 39.8, lng: -98.6 },
  "u.s.": { lat: 39.8, lng: -98.6 },
  colombia: { lat: 4.6, lng: -74.1 },
  honduras: { lat: 15.2, lng: -86.2 },
  "south africa": { lat: -30.6, lng: 22.9 },
  canada: { lat: 56.1, lng: -106.3 },
  mexico: { lat: 23.6, lng: -102.5 },
  brazil: { lat: -14.2, lng: -51.9 },
  argentina: { lat: -38.4, lng: -63.6 },
  chile: { lat: -35.7, lng: -71.5 },
  "united kingdom": { lat: 55.0, lng: -3.0 },
  uk: { lat: 55.0, lng: -3.0 },
  germany: { lat: 51.2, lng: 10.4 },
  france: { lat: 46.2, lng: 2.2 },
  spain: { lat: 40.4, lng: -3.7 },
  portugal: { lat: 39.4, lng: -8.2 },
  italy: { lat: 42.6, lng: 12.6 },
  switzerland: { lat: 46.8, lng: 8.3 },
  netherlands: { lat: 52.1, lng: 5.3 },
  belgium: { lat: 50.8, lng: 4.4 },
  austria: { lat: 47.5, lng: 14.6 },
  czechia: { lat: 49.8, lng: 15.5 },
  poland: { lat: 51.9, lng: 19.1 },
  sweden: { lat: 60.1, lng: 18.6 },
  norway: { lat: 60.5, lng: 8.4 },
  finland: { lat: 64.0, lng: 26.0 },
  estonia: { lat: 58.7, lng: 25.0 },
  latvia: { lat: 56.9, lng: 24.6 },
  lithuania: { lat: 55.3, lng: 23.9 },
  romania: { lat: 45.9, lng: 24.9 },
  serbia: { lat: 44.0, lng: 20.8 },
  turkey: { lat: 38.9, lng: 35.2 },
  uae: { lat: 24.5, lng: 54.3 },
  "united arab emirates": { lat: 24.5, lng: 54.3 },
  israel: { lat: 31.0, lng: 35.0 },
  india: { lat: 20.6, lng: 78.9 },
  singapore: { lat: 1.3, lng: 103.8 },
  japan: { lat: 36.2, lng: 138.2 },
  korea: { lat: 36.3, lng: 127.9 },
  "south korea": { lat: 36.3, lng: 127.9 },
  thailand: { lat: 15.8, lng: 101.0 },
  vietnam: { lat: 14.1, lng: 108.3 },
  indonesia: { lat: -2.5, lng: 118.0 },
  australia: { lat: -25.3, lng: 133.8 },
  "new zealand": { lat: -40.9, lng: 174.8 },
  nigeria: { lat: 9.1, lng: 8.7 },
  kenya: { lat: -0.02, lng: 37.9 },
  ghana: { lat: 7.95, lng: -1.02 },
};

const CITY_COORDINATES: Record<string, GeoPoint> = {
  medellin: { lat: 6.2442, lng: -75.5812 },
  "naples, fl": { lat: 26.142, lng: -81.7948 },
  naples: { lat: 26.142, lng: -81.7948 },
  prospera: { lat: 16.3175, lng: -86.5383 },
  "cape town": { lat: -33.9249, lng: 18.4241 },
  miami: { lat: 25.7617, lng: -80.1918 },
  austin: { lat: 30.2672, lng: -97.7431 },
  nashville: { lat: 36.1627, lng: -86.7816 },
  newyork: { lat: 40.7128, lng: -74.006 },
  "new york": { lat: 40.7128, lng: -74.006 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  lisbon: { lat: 38.7223, lng: -9.1393 },
  london: { lat: 51.5072, lng: -0.1276 },
  paris: { lat: 48.8566, lng: 2.3522 },
  berlin: { lat: 52.52, lng: 13.405 },
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  zurich: { lat: 47.3769, lng: 8.5417 },
  geneva: { lat: 46.2044, lng: 6.1432 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  istanbul: { lat: 41.0082, lng: 28.9784 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  bangkok: { lat: 13.7563, lng: 100.5018 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  melbourne: { lat: -37.8136, lng: 144.9631 },
  lagos: { lat: 6.5244, lng: 3.3792 },
};

const CONTINENT_COORDINATES: Record<string, GeoPoint> = {
  "north america": { lat: 45.0, lng: -100.0 },
  latam: { lat: -8.0, lng: -63.0 },
  "south america": { lat: -16.0, lng: -58.0 },
  europe: { lat: 54.5, lng: 15.0 },
  africa: { lat: 5.0, lng: 20.0 },
  asia: { lat: 34.0, lng: 90.0 },
  oceania: { lat: -22.0, lng: 140.0 },
};

// == computed ==
const normalizeGeoKey = (value: string | null | undefined): string =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s,.-]/g, "")
    .trim();

const toMapPoint = (geoPoint: GeoPoint): { x: number; y: number } => {
  const x = ((geoPoint.lng + 180) / 360) * MAP_WIDTH;
  const y = ((90 - geoPoint.lat) / 180) * MAP_HEIGHT;

  return {
    x: Math.max(22, Math.min(MAP_WIDTH - 22, x)),
    y: Math.max(22, Math.min(MAP_HEIGHT - 22, y)),
  };
};

/**
 * Resolve conference coordinates from city first, then country, then continent centroid.
 */
const resolveCoordinates = (conference: ConferenceMapItem): GeoPoint | null => {
  const cityKey = normalizeGeoKey(conference.city);
  const countryKey = normalizeGeoKey(conference.country);
  const continentKey = normalizeGeoKey(conference.continent);

  if (cityKey && CITY_COORDINATES[cityKey]) {
    return CITY_COORDINATES[cityKey];
  }

  if (cityKey.includes(",")) {
    const [firstToken] = cityKey.split(",", 1);
    if (firstToken && CITY_COORDINATES[firstToken]) {
      return CITY_COORDINATES[firstToken];
    }
  }

  if (countryKey && COUNTRY_COORDINATES[countryKey]) {
    return COUNTRY_COORDINATES[countryKey];
  }

  if (continentKey && CONTINENT_COORDINATES[continentKey]) {
    return CONTINENT_COORDINATES[continentKey];
  }

  return null;
};

const markers = computed<MapMarker[]>(() => {
  const groupedMarkers = new Map<string, MapMarker>();

  for (const conference of props.conferences) {
    const coordinates = resolveCoordinates(conference);
    if (!coordinates) continue;

    const point = toMapPoint(coordinates);
    const cityLabel = conference.city || conference.location || "Unknown city";
    const countryLabel = conference.country || conference.continent || "Unknown country";
    const markerKey = `${normalizeGeoKey(countryLabel)}::${normalizeGeoKey(cityLabel)}`;

    const existing = groupedMarkers.get(markerKey);
    if (existing) {
      existing.count += 1;
      existing.eventNames.push(conference.name);
      continue;
    }

    groupedMarkers.set(markerKey, {
      key: markerKey,
      x: point.x,
      y: point.y,
      cityLabel,
      countryLabel,
      count: 1,
      eventNames: [conference.name],
    });
  }

  return Array.from(groupedMarkers.values()).sort((left, right) => right.count - left.count);
});

const mappedConferenceCount = computed(() =>
  props.conferences.reduce((total, conference) => {
    if (resolveCoordinates(conference)) return total + 1;
    return total;
  }, 0),
);

const unmappedConferenceCount = computed(
  () => Math.max(0, props.conferences.length - mappedConferenceCount.value),
);

const countrySummary = computed(() => {
  const summary = new Map<string, number>();

  for (const conference of props.conferences) {
    const country = conference.country?.trim();
    if (!country) continue;
    summary.set(country, (summary.get(country) ?? 0) + 1);
  }

  return Array.from(summary.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 12);
});

const citySummary = computed(() => {
  const summary = new Map<string, number>();

  for (const conference of props.conferences) {
    const city = conference.city?.trim();
    if (!city) continue;
    summary.set(city, (summary.get(city) ?? 0) + 1);
  }

  return Array.from(summary.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 12);
});

// == lifecycle ==

// == watchers ==

// == local page api ==
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-[2fr_1fr]">
    <div class="rounded-3xl border border-slate-200 bg-slate-950 p-4 text-white shadow-lg sm:p-6">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-[0.18em] text-orange-300">World Coverage</p>
          <h3 class="text-lg font-semibold text-white">Countries and cities highlighted</h3>
        </div>
        <p class="text-xs text-slate-300">
          {{ markers.length }} mapped {{ markers.length === 1 ? "location" : "locations" }}
          · {{ props.conferences.length }} conferences
        </p>
      </div>

      <div class="overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
        <svg
          viewBox="0 0 1000 500"
          class="h-auto w-full"
          role="img"
          aria-label="World map with highlighted conference cities"
        >
          <defs>
            <linearGradient id="events-map-ocean" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#081227" />
              <stop offset="100%" stop-color="#14243b" />
            </linearGradient>
            <linearGradient id="events-map-land" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#22344f" />
              <stop offset="100%" stop-color="#2f4a6a" />
            </linearGradient>
            <radialGradient id="events-map-pin" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#f59e0b" />
              <stop offset="100%" stop-color="#f97316" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="1000" height="500" fill="url(#events-map-ocean)" />

          <g stroke="#2b425d" stroke-width="1" opacity="0.45">
            <line x1="0" y1="100" x2="1000" y2="100" />
            <line x1="0" y1="200" x2="1000" y2="200" />
            <line x1="0" y1="300" x2="1000" y2="300" />
            <line x1="0" y1="400" x2="1000" y2="400" />
            <line x1="200" y1="0" x2="200" y2="500" />
            <line x1="400" y1="0" x2="400" y2="500" />
            <line x1="600" y1="0" x2="600" y2="500" />
            <line x1="800" y1="0" x2="800" y2="500" />
          </g>

          <g fill="url(#events-map-land)" opacity="0.92" stroke="#4c6f95" stroke-width="1.2">
            <path d="M96 132 L180 78 L278 86 L326 148 L278 222 L204 236 L134 194 Z" />
            <path d="M278 246 L324 274 L344 334 L324 424 L284 466 L252 422 L260 342 Z" />
            <path d="M468 112 L524 92 L592 104 L612 132 L558 162 L498 152 Z" />
            <path d="M518 176 L590 172 L642 244 L622 352 L562 424 L504 334 L502 242 Z" />
            <path d="M602 102 L758 92 L884 144 L896 220 L812 266 L704 234 L622 184 Z" />
            <path d="M808 324 L884 334 L910 382 L862 422 L792 392 Z" />
          </g>

          <g>
            <g
              v-for="(marker, index) in markers"
              :key="marker.key"
            >
              <circle
                :cx="marker.x"
                :cy="marker.y"
                :r="Math.min(20, 8 + marker.count * 2)"
                fill="#f97316"
                opacity="0.22"
              />
              <circle
                :cx="marker.x"
                :cy="marker.y"
                :r="Math.min(10, 4 + marker.count)"
                fill="url(#events-map-pin)"
                stroke="#fdba74"
                stroke-width="1"
              />
              <text
                :x="marker.x + 12"
                :y="marker.y + (index % 2 === 0 ? -10 : 14)"
                fill="#f8fafc"
                font-size="12"
                font-weight="600"
              >
                {{ marker.cityLabel }}
                <tspan fill="#fdba74">({{ marker.count }})</tspan>
              </text>
              <title>{{ marker.countryLabel }} · {{ marker.eventNames.join(", ") }}</title>
            </g>
          </g>
        </svg>
      </div>

      <p v-if="unmappedConferenceCount > 0" class="mt-3 text-xs text-slate-300">
        {{ unmappedConferenceCount }} conferences are shown in list/calendar but not pinned yet because location coordinates are missing.
      </p>
    </div>

    <aside class="space-y-4">
      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Top Countries</h4>
        <ul class="mt-3 space-y-2">
          <li
            v-for="country in countrySummary"
            :key="country.country"
            class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm"
          >
            <span class="font-medium text-slate-800">{{ country.country }}</span>
            <span class="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">{{ country.count }}</span>
          </li>
        </ul>
      </section>

      <section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Top Cities</h4>
        <ul class="mt-3 space-y-2">
          <li
            v-for="city in citySummary"
            :key="city.city"
            class="flex items-center justify-between rounded-xl bg-orange-50 px-3 py-2 text-sm"
          >
            <span class="font-medium text-slate-800">{{ city.city }}</span>
            <span class="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">{{ city.count }}</span>
          </li>
        </ul>
      </section>
    </aside>
  </div>
</template>

<style scoped>
svg text {
  paint-order: stroke;
  stroke: rgba(15, 23, 42, 0.7);
  stroke-width: 2px;
  stroke-linejoin: round;
}
</style>
