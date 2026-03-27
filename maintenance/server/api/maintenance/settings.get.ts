import { defineEventHandler } from "h3";
import { assertMaintenanceRole } from "../../utils/assert-maintenance-role";
import { readMaintenanceEnvConfig } from "../../utils/config";

export default defineEventHandler(async (event) => {
  await assertMaintenanceRole(event, ["admin"]);

  const config = await readMaintenanceEnvConfig();

  return {
    companyName: config.companyName,
    companyAddress: config.companyAddress,
    companyNotificationEmails: config.companyNotificationEmails,
  };
});
