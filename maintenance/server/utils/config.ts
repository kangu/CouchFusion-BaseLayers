import {
  buildCouchEnvSection,
  readCouchConfigValues,
} from "#database/utils/couch-config";

interface MaintenanceEnvConfig {
  defaultCheckupMonths: number;
  reminderDaysBeforeExpiry: number;
  cronHourUtc: number;
  smsSender: string | null;
  companyNotificationEmails: string[];
}

const asBoundedInteger = (
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number => {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
};

const parseCsv = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const normalizeAppSlug = (): string => {
  const runtimeConfig = useRuntimeConfig();
  const appSlug = runtimeConfig.public?.appSlug;

  if (typeof appSlug === "string" && appSlug.trim().length > 0) {
    return appSlug.trim();
  }

  return "gas-maintenance";
};

export const readMaintenanceEnvConfig = async (): Promise<MaintenanceEnvConfig> => {
  const section = buildCouchEnvSection(normalizeAppSlug());
  const values = await readCouchConfigValues(section, [
    "maintenance_default_checkup_months",
    "maintenance_cron_hour",
    "maintenance_reminder_days_before_expiry",
    "maintenance_sms_sender",
    "maintenance_company_notification_emails",
  ]);

  return {
    defaultCheckupMonths: asBoundedInteger(
      values.maintenance_default_checkup_months,
      6,
      1,
      24,
    ),
    reminderDaysBeforeExpiry: asBoundedInteger(
      values.maintenance_reminder_days_before_expiry,
      30,
      1,
      365,
    ),
    cronHourUtc: asBoundedInteger(values.maintenance_cron_hour, 4, 0, 23),
    smsSender:
      typeof values.maintenance_sms_sender === "string" &&
      values.maintenance_sms_sender.trim().length > 0
        ? values.maintenance_sms_sender.trim()
        : null,
    companyNotificationEmails: parseCsv(values.maintenance_company_notification_emails),
  };
};
