import { defineEventHandler, setHeader } from "h3";
import { getRuntimeFontCss } from "../../../utils/content-fonts";

/**
 * Public runtime CSS endpoint used by all rendered pages.
 *
 * @remarks
 * Served with no-store semantics so newly applied font profiles are reflected immediately
 * when the builder bumps `runtimeCssVersion` query params.
 */
export default defineEventHandler(async (event) => {
  const css = await getRuntimeFontCss();

  setHeader(event, "content-type", "text/css; charset=utf-8");
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate");

  return css;
});
