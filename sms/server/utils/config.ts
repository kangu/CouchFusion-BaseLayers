import {
  buildCouchEnvSection,
  readCouchConfigValues,
} from "#database/utils/couch-config";

export type SmsProvider = "mock" | "twilio";

export interface SmsEnvConfig {
  provider: SmsProvider;
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioMessagingServiceSid: string | null;
}

const normalizeProvider = (value: string | null): SmsProvider => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "twilio" ? "twilio" : "mock";
};

const parseOptional = (value: string | null): string | null => {
  const trimmed = String(value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAppSlug = (): string => {
  const runtimeConfig = useRuntimeConfig();
  const appSlug = runtimeConfig.public?.appSlug;

  if (typeof appSlug === "string" && appSlug.trim().length > 0) {
    return appSlug.trim();
  }

  return "gas-maintenance";
};

export const readSmsEnvConfig = async (): Promise<SmsEnvConfig> => {
  const section = buildCouchEnvSection(normalizeAppSlug());
  const values = await readCouchConfigValues(section, [
    "sms_provider",
    "twilio_account_sid",
    "twilio_auth_token",
    "twilio_messaging_service_sid",
  ]);

  return {
    provider: normalizeProvider(values.sms_provider),
    twilioAccountSid: parseOptional(values.twilio_account_sid),
    twilioAuthToken: parseOptional(values.twilio_auth_token),
    twilioMessagingServiceSid: parseOptional(values.twilio_messaging_service_sid),
  };
};
