import { Twilio } from "twilio";
import { readSmsEnvConfig } from "./config";

export interface SmsSendPayload {
  to: string;
  text: string;
}

export interface SmsSendResult {
  ok: boolean;
  provider: "mock" | "twilio";
  providerMessageId: string | null;
  errorMessage: string | null;
}

const shouldFail = (value: string): boolean => {
  return value.toLowerCase().includes("fail-notification");
};

const sendMockSms = async (payload: SmsSendPayload): Promise<SmsSendResult> => {
  if (shouldFail(payload.to)) {
    return {
      ok: false,
      provider: "mock",
      providerMessageId: null,
      errorMessage: "Simulated SMS provider failure",
    };
  }

  console.info("[sms][mock]", {
    to: payload.to,
  });

  return {
    ok: true,
    provider: "mock",
    providerMessageId: `mock-sms-${crypto.randomUUID()}`,
    errorMessage: null,
  };
};

const hasTwilioConfig = (
  accountSid: string | null,
  authToken: string | null,
  messagingServiceSid: string | null,
): boolean => {
  return Boolean(accountSid && authToken && messagingServiceSid);
};

export const sendSms = async (payload: SmsSendPayload): Promise<SmsSendResult> => {
  const config = await readSmsEnvConfig();

  if (config.provider === "mock") {
    return sendMockSms(payload);
  }

  if (
    !hasTwilioConfig(
      config.twilioAccountSid,
      config.twilioAuthToken,
      config.twilioMessagingServiceSid,
    )
  ) {
    return {
      ok: false,
      provider: "twilio",
      providerMessageId: null,
      errorMessage: "Twilio SMS is enabled but required credentials are missing",
    };
  }

  try {
    const twilioClient = new Twilio(config.twilioAccountSid!, config.twilioAuthToken!);
    const message = await twilioClient.messages.create({
      to: payload.to,
      body: payload.text,
      messagingServiceSid: config.twilioMessagingServiceSid!,
    });

    return {
      ok: true,
      provider: "twilio",
      providerMessageId: message.sid ?? null,
      errorMessage: null,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "twilio",
      providerMessageId: null,
      errorMessage: error instanceof Error ? error.message : "Twilio SMS send failed",
    };
  }
};
