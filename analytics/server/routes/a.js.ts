// Standalone tracker script for pages served outside the Nuxt app.
import { defineEventHandler, setResponseHeaders } from "h3";
import { TRACKER_SCRIPT } from "../engine/tracker-script";

export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
    "Access-Control-Allow-Origin": "*",
  });
  return TRACKER_SCRIPT;
});
