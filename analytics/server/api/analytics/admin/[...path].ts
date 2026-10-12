// Catch-all admin API for the self-hosted analytics engine.
import { defineEventHandler, getRouterParam } from "h3";
import { buildAdminContext, coreAdminRoutes } from "../../../engine/admin-routes";
import { platformRoutes } from "../../../engine/platform-routes";
import { reportRoutes } from "../../../engine/report-routes";
import { dispatch } from "../../../engine/router";

const routes = [...coreAdminRoutes, ...reportRoutes, ...platformRoutes];

export default defineEventHandler((event) =>
  dispatch(event, getRouterParam(event, "path") ?? "", routes, (base, route) => buildAdminContext(base, route)),
);
