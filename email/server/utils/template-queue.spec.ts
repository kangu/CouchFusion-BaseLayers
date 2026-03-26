import { beforeEach, describe, expect, it, vi } from "vitest";

describe("queueTemplateEmail", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("useRuntimeConfig", () => ({
      dbLoginPrefix: "gas-",
    }));
    process.env.COUCHDB_ADMIN_AUTH = "encoded-auth";
    delete process.env.EMAIL_SENDER_BASE_URL;
  });

  it("posts payload to email-sender update handler using app template prefix", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "queued-123",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { queueTemplateEmail } = await import("./template-queue");
    const result = await queueTemplateEmail({
      templateName: "check_2y_default",
      to: "client@example.com",
      payload: {
        clientName: "Acme SRL",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBe("queued-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://localhost:5984/email-sender/_design/pending_emails/_update/build_template_with_payload/template_gas_check_2y_default",
    );
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Basic encoded-auth",
    });

    const body = JSON.parse(String(options.body));
    expect(body.to).toBe("client@example.com");
    expect(body.email).toBe("client@example.com");
    expect(body.clientName).toBe("Acme SRL");
  });

  it("returns failed result when queue endpoint returns non-ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      text: async () => "update function missing",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { queueTemplateEmail } = await import("./template-queue");
    const result = await queueTemplateEmail({
      templateName: "check_2y_default",
      to: "client@example.com",
      payload: {},
    });

    expect(result.ok).toBe(false);
    expect(result.providerMessageId).toBeNull();
    expect(result.errorMessage).toContain("update function missing");
  });

  it("falls back to legacy dash-preserved prefix when normalized prefix template is not found", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        text: async () => '{"error":"Template document not found"}',
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "queued-legacy-456",
      });
    vi.stubGlobal("fetch", fetchMock);

    const { queueTemplateEmail } = await import("./template-queue");
    const result = await queueTemplateEmail({
      templateName: "check_2y_default",
      to: "client@example.com",
      payload: {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [primaryUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [legacyUrl] = fetchMock.mock.calls[1] as [string, RequestInit];

    expect(primaryUrl).toBe(
      "http://localhost:5984/email-sender/_design/pending_emails/_update/build_template_with_payload/template_gas_check_2y_default",
    );
    expect(legacyUrl).toBe(
      "http://localhost:5984/email-sender/_design/pending_emails/_update/build_template_with_payload/template_gas-_check_2y_default",
    );
    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBe("queued-legacy-456");
  });

  it("returns failed result when COUCHDB_ADMIN_AUTH is missing", async () => {
    delete process.env.COUCHDB_ADMIN_AUTH;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { queueTemplateEmail } = await import("./template-queue");
    const result = await queueTemplateEmail({
      templateName: "check_2y_default",
      to: "client@example.com",
      payload: {},
    });

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toContain("COUCHDB_ADMIN_AUTH");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
