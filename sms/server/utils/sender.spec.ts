import { beforeEach, describe, expect, it, vi } from "vitest";

const readCouchConfigValuesMock = vi.fn();
const twilioCreateMock = vi.fn();
const twilioConstructorMock = vi.fn();

vi.mock("#database/utils/couch-config", () => {
  return {
    buildCouchEnvSection: (slug: string) => `cf_env_${slug}`,
    readCouchConfigValues: (...args: unknown[]) => readCouchConfigValuesMock(...args),
  };
});

vi.mock("twilio", () => {
  return {
    Twilio: function Twilio(accountSid: string, authToken: string) {
      twilioConstructorMock(accountSid, authToken);
      return {
        messages: {
          create: twilioCreateMock,
        },
      };
    },
  };
});

describe("sendSms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        appSlug: "gas-maintenance",
      },
    }));
  });

  it("defaults to mock provider when config does not provide a provider", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({});
    const { readSmsEnvConfig } = await import("./config");

    const config = await readSmsEnvConfig();

    expect(config.provider).toBe("mock");
  });

  it("returns failed result when twilio provider is enabled without credentials", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({
      sms_provider: "twilio",
      twilio_account_sid: "",
      twilio_auth_token: "",
      twilio_messaging_service_sid: "",
    });

    const { sendSms } = await import("./sender");
    const result = await sendSms({
      to: "+40712345678",
      text: "Maintenance reminder",
    });

    expect(result.ok).toBe(false);
    expect(result.provider).toBe("twilio");
    expect(result.errorMessage).toContain("required credentials are missing");
  });

  it("sends using twilio messaging service sid", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({
      sms_provider: "twilio",
      twilio_account_sid: "AC123",
      twilio_auth_token: "secret",
      twilio_messaging_service_sid: "MG123",
    });
    twilioCreateMock.mockResolvedValueOnce({
      sid: "SM123",
    });

    const { sendSms } = await import("./sender");
    const result = await sendSms({
      to: "+40712345678",
      text: "Maintenance reminder",
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe("twilio");
    expect(result.providerMessageId).toBe("SM123");
    expect(twilioConstructorMock).toHaveBeenCalledWith("AC123", "secret");
    expect(twilioCreateMock).toHaveBeenCalledWith({
      to: "+40712345678",
      body: "Maintenance reminder",
      messagingServiceSid: "MG123",
    });
  });

  it("maps twilio API errors to normalized failure result", async () => {
    readCouchConfigValuesMock.mockResolvedValueOnce({
      sms_provider: "twilio",
      twilio_account_sid: "AC123",
      twilio_auth_token: "secret",
      twilio_messaging_service_sid: "MG123",
    });
    twilioCreateMock.mockRejectedValueOnce(new Error("Twilio 401"));

    const { sendSms } = await import("./sender");
    const result = await sendSms({
      to: "+40712345678",
      text: "Maintenance reminder",
    });

    expect(result.ok).toBe(false);
    expect(result.provider).toBe("twilio");
    expect(result.providerMessageId).toBeNull();
    expect(result.errorMessage).toContain("Twilio 401");
  });
});
