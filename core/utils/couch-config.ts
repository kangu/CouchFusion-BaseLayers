import type { OperationClient } from "../src/server/operations";
import { basename } from "node:path";



export const parseCouchConfigString = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "string" && parsed.trim()) {
        return parsed.trim();
      }
    } catch {
      return trimmed.slice(1, -1).trim() || null;
    }
  }

  return trimmed;
};

export const normalizeCouchEnvSlug = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const buildCouchEnvSection = (slug: string): string => {
  const normalized = normalizeCouchEnvSlug(slug);
  if (!normalized) {
    return "";
  }
  return `cf_env_${normalized}`;
};

export const resolveRuntimeAppSlug = (
  runtimeConfig: Record<string, any> | null | undefined,
  fallback = basename(process.cwd()),
): string => {
  const explicit = runtimeConfig?.public?.appSlug;
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return explicit.trim();
  }

  return normalizeCouchEnvSlug(String(fallback || "").trim());
};

export const readCouchConfigValue = async (
  client: OperationClient,
  section: string,
  key: string,
): Promise<string | null> => {
  if (!section || !key) {
    return null;
  }

  const encodedSection = encodeURIComponent(section);
  const encodedKey = encodeURIComponent(key);
  const url = `/_node/_local/_config/${encodedSection}/${encodedKey}`;

  try {
    const response = await client.request(url, { method: "GET" });
    if (!response.ok) {
      return null;
    }

    const raw = await response.text();
    return parseCouchConfigString(raw);
  } catch (error) {
    console.warn(
      `[database] failed to read CouchDB _config value ${section}.${key}:`,
      error,
    );
    return null;
  }
};

export const readCouchConfigValues = async (
  client: OperationClient,
  section: string,
  keys: string[],
): Promise<Record<string, string | null>> => {
  const result: Record<string, string | null> = {};
  if (!section || !Array.isArray(keys) || keys.length === 0) {
    return result;
  }

  await Promise.all(
    keys.map(async (key) => {
      result[key] = await readCouchConfigValue(client, section, key);
    }),
  );

  return result;
};

export const writeCouchConfigValue = async (
  client: OperationClient,
  section: string,
  key: string,
  value: string | null,
): Promise<boolean> => {
  if (!section || !key) {
    return false;
  }

  const encodedSection = encodeURIComponent(section);
  const encodedKey = encodeURIComponent(key);
  const url = `/_node/_local/_config/${encodedSection}/${encodedKey}`;

  try {
    const response = await client.request(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value ?? ""),
    });

    return response.ok;
  } catch (error) {
    console.warn(
      `[database] failed to write CouchDB _config value ${section}.${key}:`,
      error,
    );
    return false;
  }
};
