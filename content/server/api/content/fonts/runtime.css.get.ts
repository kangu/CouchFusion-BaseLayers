import { defineEventHandler, setHeader } from "h3";
import { getRuntimeFontCss } from "../../../utils/content-fonts";

export default defineEventHandler(async (event) => {
  const css = await getRuntimeFontCss();

  setHeader(event, "content-type", "text/css; charset=utf-8");
  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate");

  return css;
});
