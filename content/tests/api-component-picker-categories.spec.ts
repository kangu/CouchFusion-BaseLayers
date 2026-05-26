import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { contentHarness } from "../../_tests/setup/content";
import { seedAdminUser } from "../../_tests/fixtures/auth";
import type { CouchTestHarness } from "../../_tests/utils/couchdb";

const runtimeConfig = {
  dbLoginPrefix: "",
  public: {
    content: {},
  },
};

vi.mock("#imports", () => ({
  useRuntimeConfig: () => runtimeConfig,
}));

;(globalThis as any).useRuntimeConfig = () => runtimeConfig;

const resetHarness = async (harness: CouchTestHarness) => {
  await harness.teardown();
  const context = await harness.setup();
  runtimeConfig.dbLoginPrefix = context.loginPrefix;
};

interface CreateEventOptions {
  method?: string;
  path?: string;
  body?: any;
  headers?: Record<string, string>;
}

const createMockEvent = (options: CreateEventOptions = {}) => {
  const method = options.method || "GET";
  const path = options.path || "/api/content/component-picker-categories/admin";
  const headers = Object.fromEntries(
    Object.entries(options.headers || {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );

  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = path;
  req.headers = headers;

  if (options.body !== undefined) {
    if (!req.headers["content-type"]) {
      req.headers["content-type"] = "application/json";
    }
    req.body =
      typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);
  }

  const res = new ServerResponse(req);
  res.on("finish", () => socket.destroy());
  res.on("close", () => socket.destroy());
  const event = createEvent(req, res);
  event.context = {};
  return event;
};

describe("component picker categories admin API", () => {
  beforeEach(async () => {
    await resetHarness(contentHarness);
  });

  it("returns default empty settings for admins", async () => {
    const admin = await seedAdminUser(contentHarness, {
      username: "category-admin",
    });
    const cookieHeader = admin.setCookie?.split(";")[0] ?? "";

    const handler = (
      await import("../server/api/content/component-picker-categories/admin.get")
    ).default;
    const response = await handler(
      createMockEvent({ headers: { cookie: cookieHeader } }),
    );

    expect(response.success).toBe(true);
    expect(response.settings).toMatchObject({
      _id: "content-settings:component-picker-categories",
      type: "content-component-picker-categories",
      categories: [],
      assignments: {},
    });
  });

  it("saves normalized category settings and rejects stale revisions", async () => {
    const admin = await seedAdminUser(contentHarness, {
      username: "category-editor",
    });
    const cookieHeader = admin.setCookie?.split(";")[0] ?? "";

    const putHandler = (
      await import("../server/api/content/component-picker-categories/admin.put")
    ).default;

    const first = await putHandler(
      createMockEvent({
        method: "PUT",
        headers: { cookie: cookieHeader },
        body: {
          settings: {
            categories: [{ id: "Landing Pages", label: "Landing Pages" }],
            assignments: {
              "hero-section": ["landing-pages", "missing-category"],
              "future-section": ["landing-pages"],
            },
          },
        },
      }),
    );

    expect(first.success).toBe(true);
    expect(first.settings.categories).toEqual([
      { id: "landing-pages", label: "Landing Pages", order: 0 },
    ]);
    expect(first.settings.assignments).toEqual({
      "hero-section": ["landing-pages"],
      "future-section": ["landing-pages"],
    });

    await expect(
      putHandler(
        createMockEvent({
          method: "PUT",
          headers: { cookie: cookieHeader },
          body: {
            settings: {
              _rev: "stale-revision",
              categories: [{ id: "Landing Pages", label: "Landing Pages" }],
              assignments: {},
            },
          },
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("rejects duplicate category ids after normalization", async () => {
    const admin = await seedAdminUser(contentHarness, {
      username: "category-validator",
    });
    const cookieHeader = admin.setCookie?.split(";")[0] ?? "";
    const putHandler = (
      await import("../server/api/content/component-picker-categories/admin.put")
    ).default;

    await expect(
      putHandler(
        createMockEvent({
          method: "PUT",
          headers: { cookie: cookieHeader },
          body: {
            settings: {
              categories: [
                { id: "Landing", label: "Landing" },
                { id: "landing", label: "Landing Duplicate" },
              ],
              assignments: {},
            },
          },
        }),
      ),
    ).rejects.toThrow(/duplicate/i);
  });
});
