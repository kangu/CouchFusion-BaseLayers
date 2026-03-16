import { validateCouchDBEnvironment } from "#database/utils/couchdb";
import { readMaintenanceEnvConfig } from "../utils/config";
import { runContractExpiryCheck } from "../utils/cron";
import { ensureMaintenanceDatabase } from "../utils/maintenance-db";

let schedulerStarted = false;

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
    await ensureMaintenanceDatabase();
    await startInProcessCronScheduler();
    console.info("[maintenance] initialization completed");
  } catch (error) {
    console.error("[maintenance] initialization failed", error);
  }
};

export default async () => {
  await initializeMaintenanceLayer();
};
