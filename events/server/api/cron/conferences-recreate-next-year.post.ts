import { createError, defineEventHandler, getHeader } from "h3";
import { recreateConferencesForNextYear } from "../../utils/conference-next-year-recreation";

export default defineEventHandler(async (event) => {
  const runtimeConfig = useRuntimeConfig();
  const cronSecret = runtimeConfig.cronSecret;
  const authHeader = getHeader(event, "authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!cronSecret || token !== cronSecret) {
    throw createError({
      statusCode: 401,
      statusMessage: "Unauthorized",
    });
  }

  const nowIso = new Date().toISOString();
  const stats = await recreateConferencesForNextYear({ nowIso });

  return {
    success: true,
    nowIso,
    ...stats,
  };
});
