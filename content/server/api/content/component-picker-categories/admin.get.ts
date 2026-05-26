import { defineEventHandler } from "h3";
import { requireAdminSession } from "../../../utils/auth";
import { getEffectiveComponentPickerCategoriesSettings } from "../../../utils/component-picker-categories";

export default defineEventHandler(async (event) => {
  await requireAdminSession(event);
  const settings = await getEffectiveComponentPickerCategoriesSettings();

  return {
    success: true,
    settings,
  };
});
