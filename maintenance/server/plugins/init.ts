import {
  bulkDocs,
  getAllDocs,
  getDocument,
  putDocument,
  validateCouchDBEnvironment,
} from "#database/utils/couchdb";
import { readMaintenanceEnvConfig } from "../utils/config";
import { runContractExpiryCheck } from "../utils/cron";
import { ensureMaintenanceDatabase } from "../utils/maintenance-db";
import type { MaintenanceClientDocument, MaintenanceJobDocument } from "../utils/types";

let schedulerStarted = false;
const CONTRACT_MIGRATION_MARKER_ID = "maintenance_meta:contract-model-migration-v1";
const EXPIRATION_MODEL_MIGRATION_MARKER_ID = "maintenance_meta:client-expiration-model-v1";

interface LegacyContractDocument {
  _id: string;
  _rev?: string;
  type: "maintenance_contract";
  clientId: string;
  startDate: string;
  expirationDate: string;
  checkupIntervalMonths: number | null;
  status: "active" | "expiring_soon" | "expired" | "renewed";
  createdAt: string;
  updatedAt: string;
}

const getLegacyContracts = async (databaseName: string): Promise<LegacyContractDocument[]> => {
  const response = await getAllDocs(databaseName, {
    include_docs: true,
    startkey: "maintenance_contract:",
    endkey: "maintenance_contract:\ufff0",
  });

  return (response?.rows ?? [])
    .map((row) => row.doc as LegacyContractDocument | undefined)
    .filter(
      (doc): doc is LegacyContractDocument =>
        Boolean(doc && doc.type === "maintenance_contract" && doc.clientId),
    );
};

const getJobsToMigrate = async (databaseName: string): Promise<MaintenanceJobDocument[]> => {
  const response = await getAllDocs(databaseName, {
    include_docs: true,
    startkey: "maintenance_job:",
    endkey: "maintenance_job:\ufff0",
  });

  return (response?.rows ?? [])
    .map((row) => row.doc as MaintenanceJobDocument | undefined)
    .filter((doc): doc is MaintenanceJobDocument => Boolean(doc && doc.type === "maintenance_job"))
    .filter((doc) => Object.prototype.hasOwnProperty.call(doc as Record<string, unknown>, "contractId"));
};

const getClientsForMigration = async (databaseName: string): Promise<MaintenanceClientDocument[]> => {
  const response = await getAllDocs(databaseName, {
    include_docs: true,
    startkey: "maintenance_client:",
    endkey: "maintenance_client:\ufff0",
  });

  return (response?.rows ?? [])
    .map((row) => row.doc as MaintenanceClientDocument | undefined)
    .filter((doc): doc is MaintenanceClientDocument => Boolean(doc && doc.type === "maintenance_client"));
};

const migrateContractsToClients = async (databaseName: string): Promise<void> => {
  const marker = await getDocument(databaseName, CONTRACT_MIGRATION_MARKER_ID);
  if (marker) {
    return;
  }

  const contracts = await getLegacyContracts(databaseName);
  const contractsByClient = new Map<string, LegacyContractDocument>();

  for (const contract of contracts) {
    const existing = contractsByClient.get(contract.clientId);
    if (!existing) {
      contractsByClient.set(contract.clientId, contract);
      continue;
    }

    const existingDate = existing.updatedAt || existing.createdAt || "";
    const contractDate = contract.updatedAt || contract.createdAt || "";
    if (contractDate > existingDate) {
      contractsByClient.set(contract.clientId, contract);
    }
  }

  const clientUpdates: MaintenanceClientDocument[] = [];
  for (const [clientId, contract] of contractsByClient.entries()) {
    const client = await getDocument<MaintenanceClientDocument>(databaseName, clientId);
    if (!client || client.type !== "maintenance_client") {
      continue;
    }

    const nextClient: MaintenanceClientDocument = {
      ...client,
      contractStartDate: contract.startDate ?? null,
      contractExpirationDate: contract.expirationDate ?? null,
      contractExpirationStatus: contract.status ?? "active",
      contractCheckupIntervalMonths: 12,
      updatedAt: new Date().toISOString(),
    };

    clientUpdates.push(nextClient);
  }

  const jobUpdates = (await getJobsToMigrate(databaseName)).map((job) => {
    const { contractId: _legacyContractId, ...rest } = job as MaintenanceJobDocument & {
      contractId?: string;
    };
    return {
      ...rest,
      updatedAt: new Date().toISOString(),
    } as MaintenanceJobDocument;
  });

  if (clientUpdates.length > 0) {
    await bulkDocs(databaseName, clientUpdates);
  }

  if (jobUpdates.length > 0) {
    await bulkDocs(databaseName, jobUpdates);
  }

  await putDocument(databaseName, {
    _id: CONTRACT_MIGRATION_MARKER_ID,
    type: "maintenance_meta",
    completedAt: new Date().toISOString(),
    migratedClients: clientUpdates.length,
    migratedJobs: jobUpdates.length,
  });

  console.info("[maintenance] contract model migration completed", {
    migratedClients: clientUpdates.length,
    migratedJobs: jobUpdates.length,
  });
};

const migrateClientExpirationModel = async (databaseName: string): Promise<void> => {
  const marker = await getDocument(databaseName, EXPIRATION_MODEL_MIGRATION_MARKER_ID);
  if (marker) {
    return;
  }

  const clients = await getClientsForMigration(databaseName);
  const updates: MaintenanceClientDocument[] = [];

  for (const client of clients) {
    const raw = client as MaintenanceClientDocument & Record<string, unknown>;
    const legacyStatus = String(raw.contractStatus ?? raw.status ?? "active").trim().toLowerCase();
    const normalizedStatus =
      legacyStatus === "expiring_soon" || legacyStatus === "expired" || legacyStatus === "renewed"
        ? legacyStatus
        : "active";
    const overhaulExpirationDate =
      client.overhaulExpirationDate ??
      (typeof raw.overhaulDueDate === "string" ? raw.overhaulDueDate : null) ??
      (typeof raw.overhaulBaseDate === "string" ? raw.overhaulBaseDate : null);
    const gasSensorExpirationDate =
      client.gasSensorExpirationDate ??
      (typeof raw.gasSensorDueDate === "string" ? raw.gasSensorDueDate : null) ??
      (typeof raw.gasSensorBaseDate === "string" ? raw.gasSensorBaseDate : null);
    const nextClient = {
      ...raw,
      contractExpirationStatus:
        client.contractExpirationDate === null ? null : (normalizedStatus as "active" | "expiring_soon" | "expired" | "renewed"),
      contractCheckupIntervalMonths:
        Number.isInteger(client.contractCheckupIntervalMonths) &&
        (client.contractCheckupIntervalMonths ?? 0) > 0
          ? client.contractCheckupIntervalMonths
          : client.contractStartDate
            ? 12
            : null,
      overhaulExpirationDate,
      overhaulExpirationStatus:
        overhaulExpirationDate === null ? null : (normalizedStatus as "active" | "expiring_soon" | "expired" | "renewed"),
      gasSensorExpirationDate,
      gasSensorExpirationStatus:
        gasSensorExpirationDate === null ? null : (normalizedStatus as "active" | "expiring_soon" | "expired" | "renewed"),
      updatedAt: new Date().toISOString(),
    } as MaintenanceClientDocument & Record<string, unknown>;
    delete nextClient.status;
    delete nextClient.contractStatus;
    delete nextClient.overhaulBaseDate;
    delete nextClient.overhaulDueDate;
    delete nextClient.gasSensorBaseDate;
    delete nextClient.gasSensorDueDate;
    updates.push(nextClient as MaintenanceClientDocument);
  }

  if (updates.length > 0) {
    await bulkDocs(databaseName, updates);
  }

  await putDocument(databaseName, {
    _id: EXPIRATION_MODEL_MIGRATION_MARKER_ID,
    type: "maintenance_meta",
    completedAt: new Date().toISOString(),
    migratedClients: updates.length,
  });

  console.info("[maintenance] client expiration model migration completed", {
    migratedClients: updates.length,
  });
};

const startInProcessCronScheduler = async (): Promise<void> => {
  if (schedulerStarted) {
    return;
  }

  const runtimeConfig = useRuntimeConfig();
  const enabled = runtimeConfig.maintenance?.inProcessCronEnabled === true;
  if (!enabled) {
    return;
  }

  schedulerStarted = true;
  let lastRunDate = "";

  setInterval(async () => {
    try {
      const config = await readMaintenanceEnvConfig();
      const now = new Date();
      const runDate = now.toISOString().slice(0, 10);
      const runHour = now.getUTCHours();

      if (runHour !== config.cronHourUtc || runDate === lastRunDate) {
        return;
      }

      await runContractExpiryCheck({
        actor: "system:in-process-cron",
        includePastExpired: false,
      });

      lastRunDate = runDate;
    } catch (error) {
      console.error("[maintenance] in-process cron run failed", error);
    }
  }, 60 * 1000);

  console.info("[maintenance] in-process cron scheduler enabled");
};

const initializeMaintenanceLayer = async (): Promise<void> => {
  console.info("[maintenance] initializing layer database and scheduler...");

  try {
    validateCouchDBEnvironment();
    const databaseName = await ensureMaintenanceDatabase();
    await migrateContractsToClients(databaseName);
    await migrateClientExpirationModel(databaseName);
    await startInProcessCronScheduler();
    console.info("[maintenance] initialization completed");
  } catch (error) {
    console.error("[maintenance] initialization failed", error);
  }
};

export default async () => {
  await initializeMaintenanceLayer();
};
