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

  it("maps invoice status from invoiceByPaymentHash", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          wallet: {
            invoiceByPaymentHash: {
              paymentHash: "hash_paid",
              paymentRequest: "lnbc1paid",
              paymentStatus: "PAID"
            }
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

    expect(invoice).toMatchObject({
      invoiceId: "hash_paid",
      paymentRequest: "lnbc1paid",
      status: "paid",
      provider: "blink"
    });
  });

  it("re-fetches invoice status for receive.lightning webhooks", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          wallet: {
            invoiceByPaymentHash: {
              paymentHash: "hash_webhook",
              paymentRequest: "lnbc1paid",
              paymentStatus: "PAID"
            }
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
  });

  it("manages callback endpoints through GraphQL", async () => {
    const fetchMock = vi
      .fn()
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
