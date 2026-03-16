import { createError } from "h3";
import { initializeDatabase } from "#database/utils/couchdb";
import { maintenanceDesignDocument } from "./design-documents";

const initializedDatabases = new Set<string>();

export const getMaintenanceDatabaseName = (): string => {
  const runtimeConfig = useRuntimeConfig();
  const prefix = runtimeConfig.dbLoginPrefix;

  if (!prefix || typeof prefix !== "string") {
    throw createError({
      statusCode: 500,
      statusMessage: "Server configuration error: dbLoginPrefix is missing",
    });
  }

  return `${prefix}-maintenance`;
};

export const ensureMaintenanceDatabase = async (): Promise<string> => {
  const databaseName = getMaintenanceDatabaseName();

  if (initializedDatabases.has(databaseName)) {
    return databaseName;
  }

  await initializeDatabase(databaseName, [maintenanceDesignDocument]);
  initializedDatabases.add(databaseName);

  return databaseName;
};
