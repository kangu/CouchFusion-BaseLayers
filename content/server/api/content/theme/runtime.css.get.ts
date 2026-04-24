import { defineEventHandler, setHeader } from "h3";
import { getRuntimeThemeCss } from "../../../utils/content-theme";
import { assertContentRuntimeThemeEnabled } from "../../../utils/content-runtime-styling";

/**
 * Public runtime theme stylesheet endpoint.
 *
 * @remarks
 * Served with no-store cache headers so newly applied theme snapshots become visible
 * immediately when the runtime stylesheet URL version changes in clients.
 */
export default defineEventHandler(async (event) => {
  assertContentRuntimeThemeEnabled();
  const css = await getRuntimeThemeCss();

  setHeader(event, "content-type", "text/css; charset=utf-8");
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate");

  return css;
});
