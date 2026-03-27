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
    .map((error) => error.message || error.code || "Unknown error")
    .join("; ");
}

export function createBlinkProvider(config: BlinkConfig): LightningProvider {
  const baseUrl = config.apiUrl || "https://api.blink.sv/graphql";

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
    const walletId = await resolveWalletId(config.walletId);
    const data = await request<{
      wallet?: {
        invoiceByPaymentHash?: {
          paymentHash?: string;
          paymentRequest?: string;
          paymentStatus?: string;
          satoshis?: number;
          externalId?: string;
        };
      };
    }>(
      `query InvoiceByPaymentHash($walletId: WalletId!, $paymentHash: PaymentHash!) {
        wallet(id: $walletId) {
          invoiceByPaymentHash(paymentHash: $paymentHash) {
            paymentHash
            paymentRequest
            paymentStatus
            satoshis
            externalId
          }
        }
      }`,
      {
        walletId,
        paymentHash: invoiceId,
      },
    );

    const invoice = data.wallet?.invoiceByPaymentHash;
    if (!invoice?.paymentHash) {
      throw new Error(`Blink invoice not found for payment hash ${invoiceId}`);
    }

    return {
      invoiceId: invoice.paymentHash,
      id: invoice.paymentHash,
      paymentRequest: invoice.paymentRequest,
      amount: invoice.satoshis || 0,
      currency: "sats",
      status: mapBlinkStatus(invoice.paymentStatus),
      provider: "blink",
      paymentContext: {
        walletId,
        externalId: invoice.externalId,
      },
    };
  };

  const validateWebhook = (): boolean => true;

  const processWebhook = async (payload: any): Promise<WebhookEvent | null> => {
    if (payload?.eventType !== "receive.lightning") {
      return null;
    }

    const paymentHash = payload?.transaction?.initiationVia?.paymentHash;
    const transactionStatus = payload?.transaction?.status;
    if (!paymentHash || transactionStatus !== "success") {
      return null;
    }

    const invoice = await getInvoiceStatus(paymentHash);
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
    if (config.webhookEndpointId) {
      return { success: true, endpointId: config.webhookEndpointId };
    }

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

    config.webhookEndpointId = result.id;
    return { success: true, endpointId: result.id };
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
