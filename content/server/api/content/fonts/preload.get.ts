import { defineEventHandler, setHeader } from "h3";
import { resolveActiveRuntimeFontAsset } from "../../../utils/content-fonts";

/**
 * Public helper endpoint returning direct preload URLs for critical sans faces.
 *
 * @remarks
 * Returns concrete attachment URLs (not redirect endpoints) so browser preload requests
 * can dedupe against `@font-face` requests from runtime CSS.
 */
export default defineEventHandler(async (event) => {
  const [sans400, sans700] = await Promise.all([
    resolveActiveRuntimeFontAsset({
      role: "sans",
      weight: 400,
      style: "normal",
      stretch: "100%",
    }),
    resolveActiveRuntimeFontAsset({
      role: "sans",
      weight: 700,
      style: "normal",
      stretch: "100%",
    }),
  ]);

  setHeader(event, "cache-control", "no-store, no-cache, must-revalidate");

  return {
    success: true,
    runtimeCssVersion: sans400.runtimeCssVersion,
    preloads: [
      {
        id: "sans-400-normal",
        href: sans400.publicUrl,
      },
      {
        id: "sans-700-normal",
        href: sans700.publicUrl,
      },
    ],
  };
});
