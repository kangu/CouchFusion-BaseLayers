import { defineEventHandler, readBody } from "h3";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { runContractExpiryCheck } from "../../../utils/cron";

interface ExpiryCheckPayload {
  dryRun?: unknown;
}

export default defineEventHandler(async (event) => {
  const actor = await assertMaintenanceRole(event, ["admin"]);
  const payload = await readBody<ExpiryCheckPayload>(event);

  const summary = await runContractExpiryCheck({
    actor: actor.username,
    dryRun: payload?.dryRun === true,
  });

  return {
    success: true,
    summary,
  };
});
