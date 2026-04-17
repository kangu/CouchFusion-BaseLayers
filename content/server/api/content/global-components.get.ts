import { defineEventHandler } from "h3";
import { getEffectiveGlobalComponentEntries } from "../../utils/global-components-settings";

export default defineEventHandler(async () => {
  const entries = await getEffectiveGlobalComponentEntries();
  return {
    success: true,
    components: entries.filter((entry) => entry.enabled),
  };
});
