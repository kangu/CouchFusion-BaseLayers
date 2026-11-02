import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  agentReloadGuardEnabled,
  agentReloadGuardPlugin,
} from "./agent-reload-guard";

type ControlPlaneEnvironment = Record<string, string | undefined>;

const controlPlaneFile = (name: string) =>
  fileURLToPath(new URL(`../runtime/control-plane/${name}`, import.meta.url));

/** Routes served to the CouchFusion control plane (dev only, token-gated). */
export const CONTROL_PLANE_ROUTES = [
  { route: "/__couchfusion/control/ping", method: "get", file: "ping.get.ts" },
  {
    route: "/__couchfusion/control/component-usage",
    method: "get",
    file: "component-usage.get.ts",
  },
  // LLM request page operations (contract 2026-11-02-llm-request-contract.md).
  { route: "/__couchfusion/control/pages", method: "get", file: "pages.get.ts" },
  {
    route: "/__couchfusion/control/page-documents",
    method: "get",
    file: "page-documents.get.ts",
  },
  {
    route: "/__couchfusion/control/pages/check",
    method: "post",
    file: "pages-check.post.ts",
  },
  {
    route: "/__couchfusion/control/pages/apply",
    method: "post",
    file: "pages-apply.post.ts",
  },
] as const;

const REGISTRY_MANIFEST = join("content-builder", "component-definitions.json");

/**
 * Where the app's generated registry manifest can live: `<srcDir>/content-builder`
 * (what `~/content-builder` resolves to), then the generator's Nuxt 4 and Nuxt 3
 * locations under the app root. Read by the page-operation check to know which
 * component tags exist.
 */
export const registryManifestCandidates = (options: {
  srcDir?: string;
  rootDir?: string;
}): string[] => {
  const candidates: string[] = [];
  if (options.srcDir) {
    candidates.push(join(options.srcDir, REGISTRY_MANIFEST));
  }
  if (options.rootDir) {
    candidates.push(join(options.rootDir, "app", REGISTRY_MANIFEST));
    candidates.push(join(options.rootDir, REGISTRY_MANIFEST));
  }
  return Array.from(new Set(candidates));
};

/**
 * The control routes exist only when the CouchFusion supervisor started `nuxt dev`:
 * dev mode AND a non-empty `COUCHFUSION_CONTROL_TOKEN`. Production builds and apps
 * without the variable register nothing.
 */
export const controlPlaneEnabled = (
  dev: boolean,
  environment: ControlPlaneEnvironment,
): boolean => dev && Boolean(environment.COUCHFUSION_CONTROL_TOKEN?.trim());

/**
 * Hostname of `COUCHFUSION_PUBLIC_ORIGIN` (the dev slot origin the browser uses),
 * or `null` when unset or not a valid http(s) URL.
 */
export const publicOriginHostname = (
  environment: ControlPlaneEnvironment,
): string | null => {
  const raw = environment.COUCHFUSION_PUBLIC_ORIGIN?.trim();
  if (!raw) {
    return null;
  }
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.hostname : null;
  } catch {
    return null;
  }
};

/**
 * Nuxt module: registers the CouchFusion control-plane routes and the dev-slot
 * host allowance. Inert unless the supervisor environment is present (see docs/
 * `couchfusion-control-plane-bridge.md`).
 *
 * Vite/HMR choice: only the slot hostname is added to `vite.server.allowedHosts`.
 * No `vite.server.hmr` override is set — the Vite client derives the HMR socket
 * from the page URL (`wss://<slot>/_nuxt/` behind the tailnet, `ws://localhost:<slot>`
 * through an SSH tunnel), and the slot proxy passes WebSocket upgrades through with
 * `Host` rewritten to the loopback upstream. Forcing a host/clientPort would break
 * whichever of the two access paths it did not name.
 */
export default async function registerControlPlaneRoutes(
  _moduleOptions: unknown,
  nuxt: any,
  environment: ControlPlaneEnvironment = process.env,
) {
  if (!nuxt.options.dev) {
    return;
  }

  const hostname = publicOriginHostname(environment);
  if (hostname) {
    nuxt.options.vite ||= {};
    nuxt.options.vite.server ||= {};
    const allowed = nuxt.options.vite.server.allowedHosts;
    if (allowed !== true) {
      const list = Array.isArray(allowed) ? allowed : [];
      if (!list.includes(hostname)) {
        list.push(hostname);
      }
      nuxt.options.vite.server.allowedHosts = list;
    }
  }

  // Agent reload guard: while the control plane's generate job runs (marker file
  // exists), Vite must not reload the builder for content-component/registry changes.
  if (agentReloadGuardEnabled(true, environment)) {
    const markerPath = environment.COUCHFUSION_AGENT_MARKER!.trim();
    nuxt.hook("vite:extendConfig", (config: any, context?: { isClient?: boolean }) => {
      if (context && context.isClient === false) {
        return;
      }
      config.plugins ||= [];
      config.plugins.push(agentReloadGuardPlugin(markerPath));
    });
  }

  if (!controlPlaneEnabled(true, environment)) {
    return;
  }

  nuxt.options.runtimeConfig ||= {};
  nuxt.options.runtimeConfig.content ||= {};
  nuxt.options.runtimeConfig.content.controlPlaneRegistryManifests =
    registryManifestCandidates({
      srcDir: nuxt.options.srcDir,
      rootDir: nuxt.options.rootDir,
    });

  nuxt.options.nitro ||= {};
  nuxt.options.nitro.handlers ||= [];
  for (const entry of CONTROL_PLANE_ROUTES) {
    nuxt.options.nitro.handlers.push({
      route: entry.route,
      method: entry.method,
      handler: controlPlaneFile(entry.file),
    });
  }
}
