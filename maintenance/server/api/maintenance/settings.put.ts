import { defineEventHandler, readBody, createError } from "h3";
import {
  buildCouchEnvSection,
  writeCouchConfigValue,
} from "#database/utils/couch-config";
import { assertMaintenanceRole } from "../../utils/assert-maintenance-role";
import { asOptionalText } from "../../utils/parsers";

interface MaintenanceSettingsPayload {
  companyName?: unknown;
  companyAddress?: unknown;
  companyNotificationEmails?: unknown;
}

const normalizeEmails = (value: unknown): string[] => {
  if (typeof value === "undefined" || value === null || value === "") {
    return [];
  }

  if (!Array.isArray(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: "companyNotificationEmails must be an array",
    });
  }

  return value
    .map((item) => String(item ?? "").trim().toLowerCase())
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

export default defineEventHandler(async (event) => {
  await assertMaintenanceRole(event, ["admin"]);

  const payload = await readBody<MaintenanceSettingsPayload>(event);
  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid payload",
    });
  }

  const companyName = asOptionalText(payload.companyName, 180, "companyName");
  const companyAddress = asOptionalText(payload.companyAddress, 500, "companyAddress");
  const companyNotificationEmails = normalizeEmails(payload.companyNotificationEmails);
  const section = buildCouchEnvSection(normalizeAppSlug());

  const results = await Promise.all([
    writeCouchConfigValue(section, "maintenance_company_name", companyName),
    writeCouchConfigValue(section, "maintenance_company_address", companyAddress),
    writeCouchConfigValue(
      section,
      "maintenance_company_notification_emails",
      companyNotificationEmails.join(","),
    ),
  ]);

  if (results.some((ok) => !ok)) {
    throw createError({
      statusCode: 500,
      statusMessage: "Failed to save maintenance settings",
    });
  }

  return {
    success: true,
    settings: {
      companyName,
      companyAddress,
      companyNotificationEmails,
    },
  };
});
