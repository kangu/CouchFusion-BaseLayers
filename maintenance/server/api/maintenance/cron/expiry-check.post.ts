import { defineEventHandler, readBody } from "h3";
import { assertMaintenanceRole } from "../../../utils/assert-maintenance-role";
import { runContractExpiryCheck } from "../../../utils/cron";

interface ExpiryCheckPayload {
  dryRun?: unknown;
  pastExpiredAction?: unknown;
}

export default defineEventHandler(async (event) => {
  const actor = await assertMaintenanceRole(event, ["admin"]);
  const payload = await readBody<ExpiryCheckPayload>(event);
  const pastExpiredAction = String(payload?.pastExpiredAction ?? "").trim().toLowerCase();
  const includePastExpired =
    pastExpiredAction === "include"
      ? true
      : pastExpiredAction === "skip"
        ? false
        : undefined;

  const summary = await runContractExpiryCheck({
    actor: actor.username,
    dryRun: payload?.dryRun === true,
    includePastExpired,
  });

  return {
    success: true,
    summary,
  };
});
