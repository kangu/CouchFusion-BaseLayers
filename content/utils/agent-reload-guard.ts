import { existsSync } from "node:fs";

/**
 * CouchFusion agent reload guard (dev only).
 *
 * While the CouchFusion control plane runs a component-generation job it creates a
 * marker file (`COUCHFUSION_AGENT_MARKER`). Every write Codex makes to
 * `app/components/content/**` — and every registry regeneration that follows — would
 * otherwise make Vite reload the builder page mid-run (observed: `full-reload *` from the
 * content `import.meta.glob`, plain `full-reload`s from the registry `.ts`/`.json`
 * module propagation, `file-changed` from `@vitejs/plugin-vue`, `prune` on delete and a
 * Tailwind CSS `update`). While the marker exists this guard drops those HMR messages at
 * the single place they all leave the server: the client HMR channel (`server.ws`, which
 * in Vite 7 is the same object as the client environment's `hot` channel). When the job
 * ends the control plane asks the builder to reload through the postMessage bridge.
 */

type HmrPayload = {
  type?: string;
  path?: string;
  triggeredBy?: string;
  event?: string;
  data?: { file?: string } | unknown;
  updates?: { path?: string; acceptedPath?: string }[];
  paths?: string[];
};

/** Paths whose changes the guard suppresses (absolute files or Vite URL paths). */
export const isGuardedPath = (value: string | undefined | null): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.replace(/\\/g, "/");
  return (
    normalized.includes("/components/content/") ||
    normalized.includes("/content-builder/component-definitions.")
  );
};

/** How long after a guarded file event untargeted reload/update messages are dropped. */
export const GUARD_WINDOW_MS = 2500;

/**
 * Decide whether an outgoing HMR payload must be dropped.
 * `windowOpen` is true shortly after a guarded file changed while the marker existed;
 * it catches messages that do not name the file (e.g. `full-reload` without `path`, or a
 * Tailwind CSS update caused by a content component).
 */
export const shouldSuppress = (payload: HmrPayload, windowOpen: boolean): boolean => {
  switch (payload?.type) {
    case "full-reload":
      return windowOpen || isGuardedPath(payload.path) || isGuardedPath(payload.triggeredBy);
    case "update":
      return (
        windowOpen ||
        (payload.updates ?? []).some(
          (u) => isGuardedPath(u.path) || isGuardedPath(u.acceptedPath),
        )
      );
    case "prune":
      return (payload.paths ?? []).length > 0 && (payload.paths ?? []).every((p) => isGuardedPath(p));
    case "custom":
      return (
        payload.event === "file-changed" &&
        isGuardedPath((payload.data as { file?: string } | undefined)?.file)
      );
    default:
      return false;
  }
};

/** Guard is active only for `nuxt dev` started by the control plane. */
export const agentReloadGuardEnabled = (
  dev: boolean,
  environment: Record<string, string | undefined>,
): boolean => dev && Boolean(environment.COUCHFUSION_AGENT_MARKER?.trim());

type GuardOptions = {
  markerPath: string;
  markerExists?: (path: string) => boolean;
  now?: () => number;
  log?: (message: string) => void;
};

type HotLike = { send: (...args: any[]) => unknown };

/**
 * Wrap a hot channel's `send` so guarded payloads are dropped while the marker exists.
 * Returns `noteFileEvent`, to be called for watcher events, which opens the time window.
 */
export const createAgentReloadGuard = (options: GuardOptions) => {
  const markerExists = options.markerExists ?? ((p: string) => existsSync(p));
  const now = options.now ?? (() => Date.now());
  let windowUntil = 0;
  let dropped = 0;

  const active = () => markerExists(options.markerPath);

  const noteFileEvent = (file: string) => {
    if (isGuardedPath(file) && active()) {
      windowUntil = now() + GUARD_WINDOW_MS;
    }
  };

  const wrap = (channel: HotLike) => {
    const original = channel.send.bind(channel);
    if ((channel.send as { __cfAgentGuard?: boolean }).__cfAgentGuard) {
      return;
    }
    const guarded = (...args: any[]) => {
      // `send(event, data)` is shorthand for a custom event.
      const payload: HmrPayload =
        typeof args[0] === "string"
          ? { type: "custom", event: args[0], data: args[1] }
          : (args[0] as HmrPayload);
      if (active() && shouldSuppress(payload, now() < windowUntil)) {
        dropped += 1;
        options.log?.(
          `[couchfusion] agent run in progress: suppressed HMR ${payload.type}${payload.event ? `:${payload.event}` : ""} (${dropped} so far)`,
        );
        return;
      }
      return original(...args);
    };
    (guarded as { __cfAgentGuard?: boolean }).__cfAgentGuard = true;
    channel.send = guarded;
  };

  return { wrap, noteFileEvent, droppedCount: () => dropped };
};

/** Vite plugin installing the guard on the dev server's client HMR channel. */
export const agentReloadGuardPlugin = (markerPath: string) => ({
  name: "couchfusion:agent-reload-guard",
  apply: "serve" as const,
  configureServer(server: any) {
    const guard = createAgentReloadGuard({
      markerPath,
      log: (message) => server.config?.logger?.info?.(message, { timestamp: true }),
    });
    guard.wrap(server.ws);
    const clientHot = server.environments?.client?.hot;
    if (clientHot && clientHot !== server.ws && typeof clientHot.send === "function") {
      guard.wrap(clientHot);
    }
    // Prepend so the window opens before Vite's own watcher handlers emit HMR messages.
    const watcher = server.watcher;
    for (const event of ["add", "change", "unlink"]) {
      const listener = (file: string) => guard.noteFileEvent(file);
      if (typeof watcher?.prependListener === "function") {
        watcher.prependListener(event, listener);
      } else {
        watcher?.on?.(event, listener);
      }
    }
  },
});
