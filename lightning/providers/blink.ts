import type {
  BlinkConfig,
  InvoiceRequest,
  InvoiceResponse,
  LightningProvider,
  WebhookEvent,
} from "../types/lightning";

type BlinkError = {
  code?: string;
  message?: string;
  path?: string[];
};

type GraphQLResponse<T> = {
  data?: T;
  errors?: BlinkError[];
};

function mapBlinkStatus(
  status: string | undefined,
): InvoiceResponse["status"] {
  switch ((status || "").toUpperCase()) {
    case "PAID":
      return "paid";
    case "EXPIRED":
      return "expired";
    case "PENDING":
      return "pending";
    case "FAILED":
      return "cancelled";
    default:
      return "pending";
  }
}

function formatErrors(errors: BlinkError[] | undefined): string {
  if (!errors?.length) {
    return "Unknown Blink API error";
  }

  return errors
    .map((error) => {
      if (error.message && error.code) {
        return `${error.message} (code: ${error.code})`;
      }

      return error.message || error.code || "Unknown error";
    })
    .join("; ");
}

function isAuthorizationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("AuthorizationError") ||
    message.toLowerCase().includes("not authorized");
}

export function createBlinkProvider(config: BlinkConfig): LightningProvider {
  const baseUrl = config.apiUrl || "https://api.blink.sv/graphql";
  let cachedWebhookEndpointId = config.webhookEndpointId;

  const request = async <T>(
    query: string,
    variables?: Record<string, any>,
  ): Promise<T> => {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-KEY": config.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Blink API error: ${response.status} - ${text}`);
    }

    const payload = (await response.json()) as GraphQLResponse<T>;
    if (payload.errors?.length) {
      throw new Error(`Blink API error: ${formatErrors(payload.errors)}`);
    }

    if (!payload.data) {
      throw new Error("Blink API error: missing response data");
    }

    return payload.data;
  };

  const resolveWalletId = async (
    preferredWalletId?: string,
  ): Promise<string> => {
    if (preferredWalletId) {
      return preferredWalletId;
    }

    const data = await request<{
      me?: {
        defaultAccount?: {
          wallets?: Array<{
            id: string;
            walletCurrency: string;
          }>;
        };
      };
    }>(
      `query Me {
        me {
          defaultAccount {
            wallets {
              id
              walletCurrency
            }
          }
        }
      }`,
    );

    const wallets = data.me?.defaultAccount?.wallets || [];
    const btcWallet = wallets.find(
      (wallet) => wallet.walletCurrency?.toUpperCase() === "BTC",
    );

    if (!btcWallet?.id) {
      throw new Error("Blink BTC wallet not found for the current account");
    }

    return btcWallet.id;
  };

  const createInvoice = async (
    requestInput: InvoiceRequest,
  ): Promise<InvoiceResponse> => {
    if (requestInput.currency.toLowerCase() !== "sats") {
      throw new Error("Blink provider only supports sats invoices");
    }

    const walletId = await resolveWalletId(config.walletId);
    const externalId =
      requestInput.metadata?.orderId ||
      requestInput.correlationId ||
      undefined;

    const data = await request<{
      lnInvoiceCreate?: {
        invoice?: {
          paymentRequest: string;
          paymentHash: string;
          paymentSecret?: string;
          satoshis?: number;
        };
        errors?: BlinkError[];
      };
    }>(
      `mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
        lnInvoiceCreate(input: $input) {
          invoice {
            paymentRequest
            paymentHash
            paymentSecret
            satoshis
          }
          errors {
            code
            message
            path
          }
        }
      }`,
      {
        input: {
          amount: requestInput.amount,
          walletId,
          memo: requestInput.description || "Lightning payment",
          externalId,
        },
      },
    );

    const result = data.lnInvoiceCreate;
    if (result?.errors?.length) {
      throw new Error(`Blink API error: ${formatErrors(result.errors)}`);
    }

    if (!result?.invoice?.paymentHash || !result.invoice.paymentRequest) {
      throw new Error("Blink API error: invoice creation returned no invoice");
    }

    return {
      invoiceId: result.invoice.paymentHash,
      id: result.invoice.paymentHash,
      paymentRequest: result.invoice.paymentRequest,
      amount: result.invoice.satoshis || requestInput.amount,
      currency: "sats",
      status: "pending",
      provider: "blink",
      paymentContext: {
        walletId,
        paymentSecret: result.invoice.paymentSecret,
        externalId,
      },
    };
  };

  const getInvoiceStatus = async (
    invoiceId: string,
  ): Promise<InvoiceResponse> => {
    const data = await request<{
      lnInvoicePaymentStatusByHash?: {
        paymentHash?: string;
        paymentRequest?: string;
        status?: string;
        paymentPreimage?: string;
      };
    }>(
      `query lnInvoicePaymentStatusByHash($input: LnInvoicePaymentStatusByHashInput!) {
        lnInvoicePaymentStatusByHash(input: $input) {
          paymentHash
          paymentRequest
          status
          paymentPreimage
        }
      }`,
      {
        input: {
          paymentHash: invoiceId,
        },
      },
    );

    const invoice = data.lnInvoicePaymentStatusByHash;
    if (!invoice?.paymentHash) {
      throw new Error(`Blink invoice not found for payment hash ${invoiceId}`);
    }

    return {
      invoiceId: invoice.paymentHash,
      id: invoice.paymentHash,
      paymentRequest: invoice.paymentRequest,
      amount: 0,
      currency: "sats",
      status: mapBlinkStatus(invoice.status),
      provider: "blink",
      paymentContext: {
        walletId: config.walletId,
      },
    };
  };

  const validateWebhook = (): boolean => true;

  const processWebhook = async (payload: any): Promise<WebhookEvent | null> => {
    const paymentHash = payload?.transaction?.initiationVia?.paymentHash;
    const transactionStatus = payload?.transaction?.status;

    console.log("Blink webhook received:", {
      eventType: payload?.eventType || null,
      paymentHash: paymentHash || null,
      transactionStatus: transactionStatus || null,
    });

    if (payload?.eventType !== "receive.lightning") {
      console.log("Blink webhook ignored:", {
        reason: "unsupported_event_type",
        eventType: payload?.eventType || null,
      });
      return null;
    }

    if (!paymentHash || transactionStatus !== "success") {
      console.log("Blink webhook ignored:", {
        reason: !paymentHash ? "missing_payment_hash" : "unsupported_transaction_status",
        eventType: payload?.eventType || null,
        paymentHash: paymentHash || null,
        transactionStatus: transactionStatus || null,
      });
      return null;
    }

    const invoice = await getInvoiceStatus(paymentHash);
    console.log("Blink webhook invoice status resolved:", {
      invoiceId: paymentHash,
      status: invoice.status,
      walletId: invoice.paymentContext?.walletId || null,
      externalId: invoice.paymentContext?.externalId || null,
    });

    return {
      invoiceId: paymentHash,
      status: invoice.status,
      amount: invoice.amount,
      currency: invoice.currency,
      timestamp: payload?.transaction?.createdAt
        ? new Date(payload.transaction.createdAt)
        : new Date(),
      metadata: {
        provider: "blink",
        eventType: payload.eventType,
        walletId: payload.walletId || invoice.paymentContext?.walletId,
        externalId: invoice.paymentContext?.externalId,
      },
    };
  };

  const setupWebhookSubscription = async (webhookUrl: string) => {
    if (cachedWebhookEndpointId) {
      return { success: true, endpointId: cachedWebhookEndpointId };
    }

    try {
      const existingEndpoints = await listWebhookSubscriptions();
      const matchingEndpoint = existingEndpoints.find(
        (endpoint: { id: string; url: string }) => endpoint.url === webhookUrl,
      );

      if (matchingEndpoint?.id) {
        cachedWebhookEndpointId = matchingEndpoint.id;
        return {
          success: true,
          endpointId: matchingEndpoint.id,
          reused: true,
        };
      }
    } catch (error) {
      if (!isAuthorizationError(error)) {
        throw error;
      }
    }

    try {
      const data = await request<{
        callbackEndpointAdd?: {
          id?: string;
          errors?: BlinkError[];
        };
      }>(
        `mutation CallbackEndpointAdd($input: CallbackEndpointAddInput!) {
          callbackEndpointAdd(input: $input) {
            id
            errors {
              code
              message
              path
            }
          }
        }`,
        {
          input: {
            url: webhookUrl,
          },
        },
      );

      const result = data.callbackEndpointAdd;
      if (result?.errors?.length) {
        throw new Error(`Blink API error: ${formatErrors(result.errors)}`);
      }

      if (!result?.id) {
        throw new Error("Blink API error: callback endpoint ID missing");
      }

      cachedWebhookEndpointId = result.id;
      return { success: true, endpointId: result.id };
    } catch (error) {
      if (isAuthorizationError(error)) {
        return {
          success: false,
          skipped: true,
          reason: "authorization_error",
        };
      }

      throw error;
    }
  };

  const listWebhookSubscriptions = async () => {
    const data = await request<{
      me?: {
        defaultAccount?: {
          callbackEndpoints?: Array<{
            id: string;
            url: string;
          }>;
        };
      };
    }>(
      `query CallbackEndpoints {
        me {
          defaultAccount {
            callbackEndpoints {
              id
              url
            }
          }
        }
      }`,
    );

    return data.me?.defaultAccount?.callbackEndpoints || [];
  };

  const deleteWebhookSubscription = async (endpointId: string) => {
    const data = await request<{
      callbackEndpointDelete?: {
        success?: boolean;
        errors?: BlinkError[];
      };
    }>(
      `mutation CallbackEndpointDelete($input: CallbackEndpointDeleteInput!) {
        callbackEndpointDelete(input: $input) {
          success
          errors {
            code
            message
            path
          }
        }
      }`,
      {
        input: {
          id: endpointId,
        },
      },
    );

    const result = data.callbackEndpointDelete;
    if (result?.errors?.length) {
      throw new Error(`Blink API error: ${formatErrors(result.errors)}`);
    }

    return { success: !!result?.success, endpointId };
  };

  return {
    createInvoice,
    getInvoiceStatus,
    validateWebhook,
    processWebhook,
    setupWebhookSubscription,
    listWebhookSubscriptions,
    deleteWebhookSubscription,
  };
}
