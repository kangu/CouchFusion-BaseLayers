import { defineEventHandler } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { getGlobalComponentsSettings } from "../../../utils/global-components-settings";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const settings = await getGlobalComponentsSettings();

  return {
    success: true,
    settings: settings ?? {
      _id: "content-settings:global-components",
      type: "content-global-components",
      entries: [],
      updatedAt: null,
      updatedBy: null,
    },
  };
});
