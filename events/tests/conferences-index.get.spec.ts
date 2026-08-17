import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

const getViewMock = vi.fn();
const ensureEventsDatabaseMock = vi.fn();
const assertEventsAdminSessionMock = vi.fn();

vi.mock("#database/utils/couchdb", () => ({
  getView: getViewMock,
}));

vi.mock("../server/utils/events-db", () => ({
  ensureEventsDatabase: ensureEventsDatabaseMock,
}));

vi.mock("../server/utils/assert-events-admin-session", () => ({
  assertEventsAdminSession: assertEventsAdminSessionMock,
}));

const createMockEvent = (path = "/api/events/conferences") => {
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  request.method = "GET";
  request.url = path;
  const response = new ServerResponse(request);
  const event = createEvent(request, response);
  event.context = {};

  return { event, socket };
};

const createConference = (index: number, status = "In progress") => ({
  _id: `conference-${index}`,
  type: "conference" as const,
  name: `Conference ${index}`,
  slug: `conference-${index}`,
  year: 2027,
  startDateIso: "2027-06-01",
  status,
  isPublished: true,
});

describe("admin conferences list route", () => {
  beforeEach(() => {
    getViewMock.mockReset();
    ensureEventsDatabaseMock.mockReset();
    assertEventsAdminSessionMock.mockReset();
    ensureEventsDatabaseMock.mockResolvedValue("bitvocation-events");
    assertEventsAdminSessionMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns every conference when no filters are applied", async () => {
    const conferences = Array.from({ length: 121 }, (_, index) => createConference(index));
    getViewMock.mockResolvedValue({ rows: conferences.map((doc) => ({ doc })) });

    const handler = (await import("../server/api/events/conferences/index.get")).default;
    const { event, socket } = createMockEvent();
    const result = await handler(event);
    socket.destroy();

    expect(result.total).toBe(121);
    expect(result.conferences).toHaveLength(121);
  });

  it("returns every matching conference when a filter is applied", async () => {
    const conferences = Array.from({ length: 121 }, (_, index) =>
      createConference(index, index % 2 === 0 ? "In progress" : "Declined"),
    );
    getViewMock.mockResolvedValue({ rows: conferences.map((doc) => ({ doc })) });

    const handler = (await import("../server/api/events/conferences/index.get")).default;
    const { event, socket } = createMockEvent("/api/events/conferences?status=In%20progress");
    const result = await handler(event);
    socket.destroy();

    expect(result.total).toBe(61);
    expect(result.conferences).toHaveLength(61);
    expect(result.conferences.every((conference) => conference.status === "In progress")).toBe(true);
  });
});
