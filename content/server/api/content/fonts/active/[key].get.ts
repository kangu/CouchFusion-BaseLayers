import {
  createError,
  defineEventHandler,
  getRouterParam,
  sendRedirect,
  setHeader,
} from "h3";
import { resolveActiveRuntimeFontAsset } from "../../../../utils/content-fonts";

const ACTIVE_FONT_KEY_PATTERN =
  /^(sans|display)-(\d+)-(normal|italic)(?:-([\d.]+%))?\.woff2$/i;

/**
 * Public compatibility endpoint resolving semantic font keys to active asset URL.
 *
 * @remarks
 * Kept mainly for backward compatibility and ergonomic semantic links.
 * New preload flow prefers `/api/content/fonts/preload` for direct asset URLs.
 */
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, "key");
  if (!key) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing active font key.",
    });
  }

  const match = ACTIVE_FONT_KEY_PATTERN.exec(key);
  if (!match) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid active font key format.",
    });
  }

  const [, roleRaw, weightRaw, styleRaw, stretchRaw] = match;
  const resolved = await resolveActiveRuntimeFontAsset({
    role: roleRaw.toLowerCase() as "sans" | "display",
    weight: Number(weightRaw),
    style: styleRaw.toLowerCase() as "normal" | "italic",
    stretch: stretchRaw || "100%",
  });

  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate");
  setHeader(event, "x-content-font-runtime-version", String(resolved.runtimeCssVersion));

  return sendRedirect(event, resolved.publicUrl, 302);
});
