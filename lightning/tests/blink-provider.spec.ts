import { afterEach, describe, expect, it, vi } from "vitest";

describe("blink provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("creates an invoice with a configured BTC wallet", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          lnInvoiceCreate: {
            invoice: {
              paymentRequest: "lnbc1blink",
              paymentHash: "hash_123",
              paymentSecret: "secret_123",
              satoshis: 1200
            },
            errors: []
          }
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const { createBlinkProvider } = await import("../providers/blink");
    const provider = createBlinkProvider({
      apiKey: "blink_key",
      walletId: "btc-wallet-1"
    });

    const invoice = await provider.createInvoice({
      amount: 1200,
      currency: "sats",
      description: "Order #1"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.blink.sv/graphql",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-API-KEY": "blink_key"
        })
      })
    );

    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.query).toContain("lnInvoiceCreate");
    expect(body.variables).toEqual({
      input: {
        amount: 1200,
        walletId: "btc-wallet-1",
        memo: "Order #1"
      }
    });

    expect(invoice).toMatchObject({
      invoiceId: "hash_123",
      paymentRequest: "lnbc1blink",
      amount: 1200,
      currency: "sats",
      status: "pending",
      provider: "blink",
      paymentContext: {
        walletId: "btc-wallet-1",
        paymentSecret: "secret_123"
      }
    });
  });

  it("discovers the BTC wallet when walletId is not configured", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            me: {
              defaultAccount: {
                wallets: [
                  { id: "usd-wallet", walletCurrency: "USD" },
                  { id: "btc-wallet", walletCurrency: "BTC" }
                ]
              }
            }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            lnInvoiceCreate: {
              invoice: {
                paymentRequest: "lnbc1blink",
                paymentHash: "hash_discovered",
                paymentSecret: "secret_discovered",
                satoshis: 2100
              },
              errors: []
            }
          }
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const { createBlinkProvider } = await import("../providers/blink");
    const provider = createBlinkProvider({
      apiKey: "blink_key"
    });

    const invoice = await provider.createInvoice({
      amount: 2100,
      currency: "sats",
      description: "Auto wallet"
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const invoiceCallBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string);
    expect(invoiceCallBody.variables.input.walletId).toBe("btc-wallet");
    expect(invoice.paymentContext?.walletId).toBe("btc-wallet");
  });

  it("maps invoice status from lnInvoicePaymentStatusByHash", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          lnInvoicePaymentStatusByHash: {
            paymentHash: "hash_paid",
            paymentRequest: "lnbc1paid",
            status: "PAID"
          }
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const { createBlinkProvider } = await import("../providers/blink");
    const provider = createBlinkProvider({
      apiKey: "blink_key",
      walletId: "btc-wallet"
    });

    const invoice = await provider.getInvoiceStatus("hash_paid");
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);

    expect(invoice).toMatchObject({
      invoiceId: "hash_paid",
      paymentRequest: "lnbc1paid",
      status: "paid",
      provider: "blink"
    });
    expect(body.query).toContain("lnInvoicePaymentStatusByHash");
    expect(body.variables).toEqual({
      input: {
        paymentHash: "hash_paid"
      }
    });
  });

  it("re-fetches invoice status for receive.lightning webhooks", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          lnInvoicePaymentStatusByHash: {
            paymentHash: "hash_webhook",
            paymentRequest: "lnbc1paid",
            status: "PAID"
          }
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const { createBlinkProvider } = await import("../providers/blink");
    const provider = createBlinkProvider({
      apiKey: "blink_key",
      walletId: "btc-wallet"
    });

    const event = await provider.processWebhook({
      eventType: "receive.lightning",
      walletId: "btc-wallet",
      transaction: {
        createdAt: "2026-03-27T12:00:00.000Z",
        status: "success",
        initiationVia: {
          type: "lightning",
          paymentHash: "hash_webhook"
        }
      }
    });

    expect(event).toMatchObject({
      invoiceId: "hash_webhook",
      status: "paid",
      metadata: {
        provider: "blink",
        eventType: "receive.lightning"
      }
    });
    expect(console.log).toHaveBeenCalledWith(
      "Blink webhook received:",
      expect.objectContaining({
        eventType: "receive.lightning",
        paymentHash: "hash_webhook",
        transactionStatus: "success",
      }),
    );
    expect(console.log).toHaveBeenCalledWith(
      "Blink webhook invoice status resolved:",
      expect.objectContaining({
        invoiceId: "hash_webhook",
        status: "paid",
      }),
    );
  });

  it("manages callback endpoints through GraphQL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            me: {
              defaultAccount: {
                callbackEndpoints: []
              }
            }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            callbackEndpointAdd: {
              id: "ep_123",
              errors: []
            }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            me: {
              defaultAccount: {
                callbackEndpoints: [
                  { id: "ep_123", url: "https://example.com/api/webhooks/blink" }
                ]
              }
            }
          }
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            callbackEndpointDelete: {
              success: true,
              errors: []
            }
          }
        })
      });

    vi.stubGlobal("fetch", fetchMock);

    const { createBlinkProvider } = await import("../providers/blink");
    const provider = createBlinkProvider({
      apiKey: "blink_key"
    });

    const created = await provider.setupWebhookSubscription?.("https://example.com/api/webhooks/blink");
    const listed = await provider.listWebhookSubscriptions?.();
    const deleted = await provider.deleteWebhookSubscription?.("ep_123");

    expect(created).toEqual({ success: true, endpointId: "ep_123" });
    expect(listed).toEqual([
      { id: "ep_123", url: "https://example.com/api/webhooks/blink" }
    ]);
    expect(deleted).toEqual({ success: true, endpointId: "ep_123" });
  });

  it("reuses an existing callback endpoint for the same webhook url", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            me: {
              defaultAccount: {
                callbackEndpoints: [
                  { id: "ep_existing", url: "https://example.com/api/webhooks/blink" },
                ],
              },
            },
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { createBlinkProvider } = await import("../providers/blink");
    const provider = createBlinkProvider({
      apiKey: "blink_key",
    });

    const created = await provider.setupWebhookSubscription?.(
      "https://example.com/api/webhooks/blink",
    );

    expect(created).toEqual({ success: true, endpointId: "ep_existing", reused: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(body.query).toContain("callbackEndpoints");
  });

  it("skips webhook auto-registration when the API key cannot manage callback endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        errors: [
          {
            message:
              "Unexpected error occurred, please try again or contact support if it persists",
            code: "AuthorizationError: not authorized to execute mutations",
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { createBlinkProvider } = await import("../providers/blink");
    const provider = createBlinkProvider({
      apiKey: "blink_key",
    });

    await expect(
      provider.setupWebhookSubscription?.(
        "https://example.com/api/webhooks/blink",
      ),
    ).resolves.toEqual({
      success: false,
      skipped: true,
      reason: "authorization_error",
    });
  });

  it("does not mutate a read-only blink config object when caching webhook endpoint ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          callbackEndpointAdd: {
            id: "ep_readonly",
            errors: [],
          },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { createBlinkProvider } = await import("../providers/blink");
    const provider = createBlinkProvider(
      Object.freeze({
        apiKey: "blink_key",
      }),
    );

    await expect(
      provider.setupWebhookSubscription?.(
        "https://example.com/api/webhooks/blink",
      ),
    ).resolves.toEqual({
      success: true,
      endpointId: "ep_readonly",
    });
  });

  it("logs why a Blink webhook event was ignored", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { createBlinkProvider } = await import("../providers/blink");
    const provider = createBlinkProvider({
      apiKey: "blink_key",
      walletId: "btc-wallet",
    });

    const result = await provider.processWebhook({
      eventType: "wallet",
      transaction: {
        status: "success",
      },
    });

    expect(result).toBeNull();
    expect(console.log).toHaveBeenCalledWith(
      "Blink webhook ignored:",
      expect.objectContaining({
        reason: "unsupported_event_type",
        eventType: "wallet",
      }),
    );
  });

  it("registers blink in the lightning service", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          lnInvoiceCreate: {
            invoice: {
              paymentRequest: "lnbc1blink",
              paymentHash: "hash_service",
              paymentSecret: "secret_service",
              satoshis: 500
            },
            errors: []
          }
        }
      })
    });

    vi.stubGlobal("fetch", fetchMock);

    const { createLightningService } = await import("../services/lightning");
    const service = createLightningService({
      defaultProvider: "blink",
      providers: {
        blink: {
          apiKey: "blink_key",
          walletId: "btc-wallet"
        }
      }
    } as any);

    const invoice = await service.createInvoice({
      amount: 500,
      currency: "sats"
    });

    expect(invoice.invoiceId).toBe("hash_service");
  });

  it("does not require blink config when another provider is active", async () => {
    vi.stubGlobal("defineNuxtConfig", (config: unknown) => config);

    const module = await import("../nuxt.config");
    const readyHook = module.default.hooks?.ready;

    await expect(
      readyHook?.({
        options: {
          runtimeConfig: {
            lightning: {
              defaultProvider: "strike",
              providers: {
                strike: {
                  apiKey: "strike_key",
                  webhookSecret: "secret"
                },
                blink: {}
              }
            }
          }
        }
      })
    ).resolves.toBeUndefined();
  });

  it("still requires blink api key when blink is the active provider", async () => {
    vi.stubGlobal("defineNuxtConfig", (config: unknown) => config);

    const module = await import("../nuxt.config");
    const readyHook = module.default.hooks?.ready;

    await expect(
      readyHook?.({
        options: {
          runtimeConfig: {
            lightning: {
              defaultProvider: "blink",
              providers: {
                blink: {}
              }
            }
          }
        }
      })
    ).rejects.toThrow(/Blink provider requires 'apiKey'/);
  });
});
