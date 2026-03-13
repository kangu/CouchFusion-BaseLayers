import { createError } from "h3";
import { initializeDatabase } from "#database/utils/couchdb";
import { conferencesDesignDocument } from "./design-documents";

const initializedDatabases = new Set<string>();

export const getEventsDatabaseName = (): string => {
  const runtimeConfig = useRuntimeConfig();
  const prefix = runtimeConfig.dbLoginPrefix;

  if (!prefix || typeof prefix !== "string") {
    throw createError({
      statusCode: 500,
      statusMessage: "Server configuration error: dbLoginPrefix is missing",
    });
  }

  return `${prefix}-events`;
};

export const ensureEventsDatabase = async (): Promise<string> => {
  const databaseName = getEventsDatabaseName();

  if (initializedDatabases.has(databaseName)) {
    return databaseName;
  }

  await initializeDatabase(databaseName, [conferencesDesignDocument]);
  initializedDatabases.add(databaseName);

  return databaseName;
};
