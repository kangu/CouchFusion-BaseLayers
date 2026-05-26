import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { putDocument } from "#database/utils/couchdb";
import { contentHarness } from "../../_tests/setup/content";
import { seedContentPages } from "../../_tests/fixtures/content";
import { seedAdminUser } from "../../_tests/fixtures/auth";
import type { CouchTestHarness } from "../../_tests/utils/couchdb";

const runtimeConfig = {
  dbLoginPrefix: "",
  public: {
    content: {},
  },
};

const appConfig = {
  content: {},
};

vi.mock("#imports", () => ({
  useRuntimeConfig: () => runtimeConfig,
  useAppConfig: () => appConfig,
}));

(globalThis as any).useRuntimeConfig = () => runtimeConfig;
(globalThis as any).useAppConfig = () => appConfig;

const resetHarness = async (harness: CouchTestHarness) => {
  await harness.teardown();
  const context = await harness.setup();
  runtimeConfig.dbLoginPrefix = context.loginPrefix;
};

interface CreateEventOptions {
  method?: string;
  path?: string;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
}

const createMockEvent = (options: CreateEventOptions = {}) => {
  const method = options.method || "GET";
  const path = options.path || "/api/content/global-components/admin";
  const url = new URL(`http://localhost${path}`);
  const query = options.query || {};

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = Object.fromEntries(
    Object.entries(options.headers || {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );

  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = `${url.pathname}${url.search}`;
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

const seedGlobalComponentsSettings = async () => {
  const context = contentHarness.getContext();
  await putDocument(context.databaseName, {
    _id: "content-settings:global-components",
    type: "content-global-components",
    entries: [
      {
        id: "GlobalFooter",
        component: "pinecrest-footer",
        enabled: true,
        defaultProps: { title: "Footer" },
        defaultPropsByLocale: {},
      },
      {
        id: "GlobalUnused",
        component: "pinecrest-footer",
        enabled: true,
        defaultProps: {},
        defaultPropsByLocale: {},
      },
    ],
    updatedAt: new Date().toISOString(),
    updatedBy: "seed",
  });
};

describe("global components admin API", () => {
  beforeEach(async () => {
    await resetHarness(contentHarness);
  });

  it("blocks deleting a global component that is still used on pages", async () => {
    await seedGlobalComponentsSettings();
    await seedContentPages(contentHarness, {
      path: "/about",
      title: "About",
      body: [["GlobalFooter"]],
    });
    const admin = await seedAdminUser(contentHarness, {
      username: "global-deleter",
    });
    const cookieHeader = admin.setCookie?.split(";")[0] ?? "";

    const handler = (
      await import("../server/api/content/global-components/admin.delete")
    ).default;
    const event = createMockEvent({
      method: "DELETE",
      query: { id: "GlobalFooter" },
      headers: { cookie: cookieHeader },
    });

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 409,
      data: {
        aliasId: "GlobalFooter",
        pages: [
          expect.objectContaining({
            path: "/about",
            title: "About",
          }),
        ],
      },
    });
  });

  it("deletes an unused global component", async () => {
    await seedGlobalComponentsSettings();
    const admin = await seedAdminUser(contentHarness, {
      username: "global-unused-deleter",
    });
    const cookieHeader = admin.setCookie?.split(";")[0] ?? "";

    const deleteHandler = (
      await import("../server/api/content/global-components/admin.delete")
    ).default;
    const deleteEvent = createMockEvent({
      method: "DELETE",
      query: { id: "GlobalUnused" },
      headers: { cookie: cookieHeader },
    });

    const response = await deleteHandler(deleteEvent);

    expect(response.success).toBe(true);
    expect(response.deletedId).toBe("GlobalUnused");
    expect(response.settings.entries.map((entry: any) => entry.id)).toEqual([
      "GlobalFooter",
    ]);
  });

  it("blocks removing a used global component through full settings save", async () => {
    await seedGlobalComponentsSettings();
    await seedContentPages(contentHarness, {
      path: "/contact",
      title: "Contact",
      body: [["section", {}, ["GlobalFooter"]]],
    });
    const admin = await seedAdminUser(contentHarness, {
      username: "global-save-deleter",
    });
    const cookieHeader = admin.setCookie?.split(";")[0] ?? "";

    const handler = (
      await import("../server/api/content/global-components/admin.put")
    ).default;
    const event = createMockEvent({
      method: "PUT",
      body: {
        entries: [
          {
            id: "GlobalUnused",
            component: "pinecrest-footer",
            enabled: true,
            defaultProps: {},
          },
        ],
      },
      headers: { cookie: cookieHeader },
    });

    await expect(handler(event)).rejects.toMatchObject({
      statusCode: 409,
      data: {
        aliasId: "GlobalFooter",
        pages: [
          expect.objectContaining({
            path: "/contact",
            title: "Contact",
          }),
        ],
      },
    });
  });
});
