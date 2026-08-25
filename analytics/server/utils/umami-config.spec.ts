import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildCouchEnvSectionMock,
  readCouchConfigValuesMock,
  resolveRuntimeAppSlugMock,
} = vi.hoisted(() => ({
  buildCouchEnvSectionMock: vi.fn((slug: string) => `cf_env_${slug}`),
  readCouchConfigValuesMock: vi.fn(),
  resolveRuntimeAppSlugMock: vi.fn(
    (runtimeConfig: Record<string, any>) => runtimeConfig.public.appSlug,
  ),
}));

vi.mock("#database/utils/couch-config", () => ({
  buildCouchEnvSection: buildCouchEnvSectionMock,
  readCouchConfigValues: readCouchConfigValuesMock,
  resolveRuntimeAppSlug: resolveRuntimeAppSlugMock,
}));

import {
  resetUmamiConfigCache,
  resolveUmamiConfig,
  resolveUmamiConfigWithSources,
} from "./umami-config";

const runtimeConfig = {
  public: {
    appSlug: "forest-cabin",
  },
};

describe("Umami CouchDB config resolution", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-25T10:00:00.000Z"));
    resetUmamiConfigCache();
    buildCouchEnvSectionMock.mockClear();
    readCouchConfigValuesMock.mockReset();
    resolveRuntimeAppSlugMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves the website ID and canonical exclusions from the deterministic app section", async () => {
    readCouchConfigValuesMock.mockResolvedValue({
      umami_website_id: " website-123 ",
      umami_excluded_paths: " /admin/*, /login , ,/preview/* ",
      NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS: "/legacy/*",
    });

    const resolved = await resolveUmamiConfigWithSources(runtimeConfig);

    expect(resolveRuntimeAppSlugMock).toHaveBeenCalledWith(runtimeConfig);
    expect(buildCouchEnvSectionMock).toHaveBeenCalledWith("forest-cabin");
    expect(readCouchConfigValuesMock).toHaveBeenCalledWith(
      "cf_env_forest-cabin",
      [
        "umami_website_id",
        "umami_excluded_paths",
        "NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS",
      ],
    );
    expect(resolved.config).toEqual({
      websiteId: "website-123",
      excludedPaths: ["/admin/*", "/login", "/preview/*"],
    });
    expect(resolved.sources.excludedPaths).toMatchObject({
      key: "umami_excluded_paths",
      present: true,
      source: "couchdb",
    });
  });

  it("uses the legacy exclusion key when the canonical key is absent", async () => {
    readCouchConfigValuesMock.mockResolvedValue({
      umami_website_id: "website-123",
      umami_excluded_paths: null,
      NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS: "/confirm-login,/admin/*",
    });

    const resolved = await resolveUmamiConfigWithSources(runtimeConfig);

    expect(resolved.config.excludedPaths).toEqual([
      "/confirm-login",
      "/admin/*",
    ]);
    expect(resolved.sources.excludedPaths).toMatchObject({
      key: "NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS",
      present: true,
      source: "couchdb",
    });
  });

  it("rejects when the authoritative CouchDB website ID is missing", async () => {
    readCouchConfigValuesMock.mockResolvedValue({
      umami_website_id: null,
      umami_excluded_paths: null,
      NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS: null,
    });

    await expect(resolveUmamiConfig(runtimeConfig)).rejects.toThrow(
      "Missing required Umami CouchDB config values in cf_env_forest-cabin: umami_website_id",
    );
  });

  it("negative-caches missing required config for 30 seconds before retrying", async () => {
    readCouchConfigValuesMock
      .mockResolvedValueOnce({
        umami_website_id: null,
        umami_excluded_paths: null,
        NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS: null,
      })
      .mockResolvedValueOnce({
        umami_website_id: "website-after-fix",
        umami_excluded_paths: "/admin/*",
        NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS: null,
      });

    await expect(resolveUmamiConfig(runtimeConfig)).rejects.toThrow();
    await expect(resolveUmamiConfig(runtimeConfig)).rejects.toThrow();
    expect(readCouchConfigValuesMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_001);

    await expect(resolveUmamiConfig(runtimeConfig)).resolves.toEqual({
      websiteId: "website-after-fix",
      excludedPaths: ["/admin/*"],
    });
    expect(readCouchConfigValuesMock).toHaveBeenCalledTimes(2);
  });

  it("shares one CouchDB read across concurrent requests", async () => {
    let releaseRead: ((value: Record<string, string | null>) => void) | undefined;
    readCouchConfigValuesMock.mockImplementation(
      () =>
        new Promise<Record<string, string | null>>((resolve) => {
          releaseRead = resolve;
        }),
    );

    const first = resolveUmamiConfig(runtimeConfig);
    const second = resolveUmamiConfig(runtimeConfig);

    expect(readCouchConfigValuesMock).toHaveBeenCalledTimes(1);

    releaseRead?.({
      umami_website_id: "website-123",
      umami_excluded_paths: "/admin/*",
      NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS: null,
    });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { websiteId: "website-123", excludedPaths: ["/admin/*"] },
      { websiteId: "website-123", excludedPaths: ["/admin/*"] },
    ]);
  });
});
