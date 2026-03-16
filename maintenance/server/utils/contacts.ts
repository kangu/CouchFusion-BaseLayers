import { createError } from "h3";
import type {
  MaintenanceClientDocument,
  MaintenanceContactMethod,
  MaintenanceContactPurpose,
} from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;

const normalizeText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const normalizePurpose = (value: unknown): MaintenanceContactPurpose => {
  const normalized = String(value ?? "customer").trim().toLowerCase();
  if (
    normalized === "company" ||
    normalized === "customer" ||
    normalized === "billing" ||
    normalized === "technical"
  ) {
    return normalized;
  }
  return "customer";
};

export const normalizeEmailAddress = (value: unknown): string => {
  const email = normalizeText(value)?.toLowerCase();
  if (!email || !EMAIL_PATTERN.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid email contact value",
    });
  }
  return email;
};

export const normalizeSmsNumber = (value: unknown): string => {
  const raw = normalizeText(value);
  if (!raw) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid SMS contact value",
    });
  }

  const compact = raw.replace(/[\s()-]+/g, "");
  const withPlus = compact.startsWith("00")
    ? `+${compact.slice(2)}`
    : compact.startsWith("+")
      ? compact
      : `+${compact}`;

  if (!PHONE_PATTERN.test(withPlus)) {
    throw createError({
      statusCode: 400,
      statusMessage: "SMS contact must be a valid E.164 phone number",
    });
  }

  return withPlus;
};

export const parseClientContacts = (value: unknown): MaintenanceContactMethod[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: "At least one contact method is required",
    });
  }

  const contacts = value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw createError({
        statusCode: 400,
        statusMessage: `Contact #${index + 1} is invalid`,
      });
    }

    const payload = item as Record<string, unknown>;
    const channel = String(payload.channel ?? "").trim().toLowerCase();
    if (channel !== "email" && channel !== "sms") {
      throw createError({
        statusCode: 400,
        statusMessage: `Contact #${index + 1} must use email or sms channel`,
      });
    }

    const normalizedValue =
      channel === "email"
        ? normalizeEmailAddress(payload.value)
        : normalizeSmsNumber(payload.value);

    const id = normalizeText(payload.id) ?? crypto.randomUUID();

    return {
      id,
      channel,
      value: normalizedValue,
      purpose: normalizePurpose(payload.purpose),
      active: payload.active !== false,
      label: normalizeText(payload.label),
    } satisfies MaintenanceContactMethod;
  });

  const uniqueMap = new Map<string, MaintenanceContactMethod>();
  for (const contact of contacts) {
    const key = `${contact.channel}:${contact.value}:${contact.purpose}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, contact);
    }
  }

  return Array.from(uniqueMap.values());
};

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized.length) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
};

export const buildNotificationRecipients = (
  client: MaintenanceClientDocument,
  companyEmailsFromConfig: string[],
): {
  companyEmails: string[];
  customerEmails: string[];
  companySms: string[];
  customerSms: string[];
} => {
  const activeContacts = Array.isArray(client.contacts)
    ? client.contacts.filter((contact) => contact.active !== false)
    : [];

  const companyEmails = dedupe([
    ...companyEmailsFromConfig.map((email) => email.toLowerCase()),
    ...activeContacts
      .filter((contact) => contact.channel === "email" && contact.purpose === "company")
      .map((contact) => contact.value.toLowerCase()),
  ]);

  const customerEmails = dedupe(
    activeContacts
      .filter((contact) => contact.channel === "email" && contact.purpose === "customer")
      .map((contact) => contact.value.toLowerCase()),
  );

  const companySms = dedupe(
    activeContacts
      .filter((contact) => contact.channel === "sms" && contact.purpose === "company")
      .map((contact) => contact.value),
  );

  const customerSms = dedupe(
    activeContacts
      .filter((contact) => contact.channel === "sms" && contact.purpose === "customer")
      .map((contact) => contact.value),
  );

  return {
    companyEmails,
    customerEmails,
    companySms,
    customerSms,
  };
};
