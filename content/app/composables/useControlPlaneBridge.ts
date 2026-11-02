import { ref, readonly, type Ref } from "vue";
import { useRuntimeConfig } from "#imports";

/**
 * Child side of the CouchFusion control-plane postMessage bridge (protocol v1).
 *
 * The builder page, when it runs inside the control plane's full-screen frame (or was
 * opened from it), announces itself to the parent and can ask it to delete or create
 * content components. The parent always confirms in its own UI; requests from here are
 * never authority. Everything is inert unless: dev mode, a non-empty
 * `runtimeConfig.public.content.controlPlane.origins`, and the page is framed or has an
 * opener. See `layers/content/docs/couchfusion-control-plane-bridge.md`.
 */

export const BRIDGE_PROTOCOL_VERSION = 1;
export const BRIDGE_REQUEST_TIMEOUT_MS = 120_000;
const READY_RETRY_INTERVAL_MS = 1_000;
const READY_RETRY_LIMIT = 10;
const PROMPT_HINT_MAX_BYTES = 2048;

export type BridgeCapability = "component.delete" | "component.create" | "reload";
export type BridgeResultStatus = "accepted" | "cancelled" | "failed" | "done";

export interface BridgeRequestResult {
  status: BridgeResultStatus;
  message?: string;
  componentId?: string;
}

export interface BridgeReloadRequest {
  reason: string;
  focusComponentId?: string;
  dirty: boolean;
}

/** Returns true when the page may reload now (the handler clears any unload guard). */
export type BridgeReloadHandler = (request: BridgeReloadRequest) => boolean | Promise<boolean>;

interface BridgeEnvelope {
  cf: number;
  type: string;
  id: string;
  nonce?: string;
  replyTo?: string;
  payload?: Record<string, unknown>;
}

/** Minimal window surface used by the bridge (real `window` in the browser, fakes in tests). */
export interface BridgeTargetWindow {
  postMessage(message: unknown, targetOrigin: string): void;
}

export interface BridgeHostWindow extends BridgeTargetWindow {
  parent: BridgeTargetWindow | null;
  opener: BridgeTargetWindow | null;
  location: { pathname: string; search: string; reload(): void };
  addEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", listener: (event: MessageEvent) => void): void;
  confirm(message: string): boolean;
}

export interface ControlPlaneBridgeOptions {
  dev: boolean;
  /** Allowed control-plane origins (already split and trimmed). */
  origins: string[];
  /** App slug reported in `cf:host.ready`. */
  app: string;
  /** Host window; omit outside the browser. */
  host?: BridgeHostWindow | null;
  randomId?: () => string;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface ControlPlaneBridge {
  /** True after the parent's `welcome`; host-only UI renders only then. */
  connected: Readonly<Ref<boolean>>;
  capabilities: Readonly<Ref<BridgeCapability[]>>;
  /** Component the parent asked to focus after a create-triggered reload. */
  focusComponentId: Readonly<Ref<string | null>>;
  /** Whether the bridge can run at all in this page (dev, origins, framed/opened). */
  isEligible(): boolean;
  start(context?: { builder?: boolean }): void;
  stop(): void;
  setDirty(dirty: boolean): void;
  requestDelete(componentId: string): Promise<BridgeRequestResult>;
  requestCreate(promptHint?: string): Promise<BridgeRequestResult>;
  onReloadRequest(handler: BridgeReloadHandler): () => void;
  clearFocus(): void;
}

/** Split the comma-separated origins setting into normalized origins. */
export const parseControlPlaneOrigins = (value: unknown): string[] => {
  if (typeof value !== "string") {
    return [];
  }
  const origins = new Set<string>();
  for (const part of value.split(",")) {
    const candidate = part.trim();
    if (!candidate) {
      continue;
    }
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") {
        origins.add(url.origin);
      }
    } catch {
      // ignore malformed entries
    }
  }
  return Array.from(origins);
};

const defaultRandomId = (): string => {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const truncateUtf8 = (value: string, maxBytes: number): string => {
  const encoder = new TextEncoder();
  if (encoder.encode(value).length <= maxBytes) {
    return value;
  }
  let result = value;
  while (result.length > 0 && encoder.encode(result).length > maxBytes) {
    result = result.slice(0, -1);
  }
  return result;
};

const isEnvelope = (value: unknown): value is BridgeEnvelope => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.cf === BRIDGE_PROTOCOL_VERSION &&
    typeof candidate.type === "string" &&
    candidate.type.startsWith("cf:host.") &&
    typeof candidate.id === "string"
  );
};

const RESULT_STATUSES = new Set<BridgeResultStatus>(["accepted", "cancelled", "failed", "done"]);
const KNOWN_CAPABILITIES = new Set<BridgeCapability>(["component.delete", "component.create", "reload"]);

/**
 * Create a bridge instance. Pure apart from the injected host window, so it is unit-testable.
 */
export const createControlPlaneBridge = (
  options: ControlPlaneBridgeOptions,
): ControlPlaneBridge => {
  const host = options.host ?? null;
  const randomId = options.randomId ?? defaultRandomId;
  const setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  const connected = ref(false);
  const capabilities = ref<BridgeCapability[]>([]);
  const focusComponentId = ref<string | null>(null);

  let started = false;
  let builder = false;
  let dirty = false;
  let nonce = "";
  let pinnedOrigin = "";
  let readyAttempts = 0;
  let readyTimer: unknown = null;
  let reloadHandler: BridgeReloadHandler | null = null;
  const pending = new Map<string, { resolve: (result: BridgeRequestResult) => void; timer: unknown }>();

  const target = (): BridgeTargetWindow | null => {
    if (!host) {
      return null;
    }
    if (host.parent && host.parent !== (host as BridgeTargetWindow)) {
      return host.parent;
    }
    return host.opener ?? null;
  };

  const isEligible = (): boolean =>
    options.dev && options.origins.length > 0 && target() !== null;

  const post = (type: string, payload: Record<string, unknown>, replyTo?: string): string => {
    const destination = target();
    const id = randomId();
    if (!destination) {
      return id;
    }
    const envelope: BridgeEnvelope = { cf: BRIDGE_PROTOCOL_VERSION, type, id, payload };
    if (replyTo) {
      envelope.replyTo = replyTo;
    }
    if (connected.value) {
      envelope.nonce = nonce;
      destination.postMessage(envelope, pinnedOrigin);
    } else {
      // Before welcome, only a window at one of the configured origins can receive it.
      for (const origin of options.origins) {
        destination.postMessage(envelope, origin);
      }
    }
    return id;
  };

  const sendReady = () => {
    if (!started || connected.value) {
      return;
    }
    post("cf:host.ready", {
      app: options.app,
      route: host ? `${host.location.pathname}${host.location.search}` : "",
      builder,
      dirty,
    });
    readyAttempts += 1;
    if (readyAttempts < READY_RETRY_LIMIT) {
      readyTimer = setTimer(sendReady, READY_RETRY_INTERVAL_MS);
    }
  };

  const settle = (id: string, result: BridgeRequestResult) => {
    const entry = pending.get(id);
    if (!entry) {
      return;
    }
    pending.delete(id);
    clearTimer(entry.timer);
    entry.resolve(result);
  };

  const handleReload = async (message: BridgeEnvelope) => {
    const payload = message.payload ?? {};
    const request: BridgeReloadRequest = {
      reason: typeof payload.reason === "string" ? payload.reason : "",
      dirty,
    };
    if (typeof payload.focusComponentId === "string" && payload.focusComponentId) {
      request.focusComponentId = payload.focusComponentId;
    }
    const handler: BridgeReloadHandler =
      reloadHandler ??
      ((current) =>
        !current.dirty ||
        host?.confirm("The control plane wants to reload this page. Unsaved builder changes will be lost. Reload now?") === true);

    let proceed = false;
    try {
      proceed = await handler(request);
    } catch {
      proceed = false;
    }

    if (proceed) {
      post("cf:host.reload.ack", { reloading: true }, message.id);
      host?.location.reload();
    } else {
      post("cf:host.reload.ack", { reloading: false, reason: "unsaved" }, message.id);
    }
  };

  const onMessage = (event: MessageEvent) => {
    const destination = target();
    if (!destination || event.source !== (destination as unknown)) {
      return;
    }
    if (!options.origins.includes(event.origin)) {
      return;
    }
    const message = event.data;
    if (!isEnvelope(message)) {
      return;
    }

    if (!connected.value) {
      if (message.type !== "cf:host.welcome") {
        return;
      }
      const payload = message.payload ?? {};
      const welcomeNonce = typeof payload.nonce === "string" ? payload.nonce : "";
      if (!welcomeNonce) {
        return;
      }
      nonce = welcomeNonce;
      pinnedOrigin = event.origin;
      capabilities.value = Array.isArray(payload.capabilities)
        ? (payload.capabilities.filter((entry): entry is BridgeCapability =>
            KNOWN_CAPABILITIES.has(entry as BridgeCapability),
          ))
        : [];
      connected.value = true;
      if (readyTimer !== null) {
        clearTimer(readyTimer);
        readyTimer = null;
      }
      if (dirty) {
        post("cf:host.dirty", { dirty });
      }
      return;
    }

    if (event.origin !== pinnedOrigin || message.nonce !== nonce) {
      return;
    }

    const payload = message.payload ?? {};
    switch (message.type) {
      case "cf:host.request.result": {
        if (!message.replyTo) {
          return;
        }
        const status = payload.status as BridgeResultStatus;
        const result: BridgeRequestResult = {
          status: RESULT_STATUSES.has(status) ? status : "failed",
        };
        if (typeof payload.message === "string") {
          result.message = payload.message;
        }
        if (typeof payload.componentId === "string") {
          result.componentId = payload.componentId;
        }
        settle(message.replyTo, result);
        return;
      }
      case "cf:host.reload.request":
        void handleReload(message);
        return;
      case "cf:host.component.focus":
        if (typeof payload.componentId === "string" && payload.componentId) {
          focusComponentId.value = payload.componentId;
        }
        return;
      default:
        return;
    }
  };

  const request = (type: string, payload: Record<string, unknown>): Promise<BridgeRequestResult> => {
    if (!connected.value) {
      return Promise.resolve({ status: "failed", message: "Not connected to the control plane." });
    }
    return new Promise((resolve) => {
      const id = post(type, payload);
      const timer = setTimer(() => {
        settle(id, { status: "failed", message: "The control plane did not answer in time." });
      }, BRIDGE_REQUEST_TIMEOUT_MS);
      pending.set(id, { resolve, timer });
    });
  };

  return {
    connected: readonly(connected),
    capabilities: readonly(capabilities),
    focusComponentId: readonly(focusComponentId),
    isEligible,
    start(context = {}) {
      if (started || !host || !isEligible()) {
        return;
      }
      started = true;
      builder = context.builder === true;
      readyAttempts = 0;
      host.addEventListener("message", onMessage);
      sendReady();
    },
    stop() {
      if (!started || !host) {
        return;
      }
      started = false;
      host.removeEventListener("message", onMessage);
      if (readyTimer !== null) {
        clearTimer(readyTimer);
        readyTimer = null;
      }
      for (const id of Array.from(pending.keys())) {
        settle(id, { status: "cancelled", message: "Bridge stopped." });
      }
      connected.value = false;
      nonce = "";
      pinnedOrigin = "";
    },
    setDirty(next) {
      if (dirty === next) {
        return;
      }
      dirty = next;
      if (connected.value) {
        post("cf:host.dirty", { dirty });
      }
    },
    requestDelete(componentId) {
      return request("cf:host.component.delete.request", { componentId });
    },
    requestCreate(promptHint) {
      const payload: Record<string, unknown> = {};
      const hint = typeof promptHint === "string" ? promptHint.trim() : "";
      if (hint) {
        payload.promptHint = truncateUtf8(hint, PROMPT_HINT_MAX_BYTES);
      }
      return request("cf:host.component.create.request", payload);
    },
    onReloadRequest(handler) {
      reloadHandler = handler;
      return () => {
        if (reloadHandler === handler) {
          reloadHandler = null;
        }
      };
    },
    clearFocus() {
      focusComponentId.value = null;
    },
  };
};

/**
 * When framed, keep only the configured origin that actually is the parent
 * (`location.ancestorOrigins`, Chrome/Safari). This avoids posting `ready` to every configured
 * origin, which makes the browser log a mismatch warning for each wrong one. Without
 * `ancestorOrigins` (Firefox) or when opened in a new tab, the full list is kept; the browser
 * only delivers a message whose target origin matches the recipient either way.
 */
export const narrowToParentOrigin = (
  origins: string[],
  win: { location?: { ancestorOrigins?: ArrayLike<string> } } | null,
): string[] => {
  const parent = win?.location?.ancestorOrigins?.[0];
  return parent && origins.includes(parent) ? [parent] : origins;
};

let sharedBridge: ControlPlaneBridge | null = null;

/**
 * Shared bridge for the current page. On the server, in production and in apps without
 * `controlPlane.origins` it never connects, so host-only UI stays hidden.
 */
export const useControlPlaneBridge = (): ControlPlaneBridge => {
  if (sharedBridge) {
    return sharedBridge;
  }
  const runtimeConfig = useRuntimeConfig();
  const publicConfig = (runtimeConfig.public ?? {}) as Record<string, any>;
  const isBrowser = import.meta.client && typeof window !== "undefined";
  const bridge = createControlPlaneBridge({
    dev: import.meta.dev === true,
    origins: narrowToParentOrigin(
      parseControlPlaneOrigins(publicConfig.content?.controlPlane?.origins),
      isBrowser ? window : null,
    ),
    app: typeof publicConfig.appSlug === "string" ? publicConfig.appSlug : "",
    host: isBrowser ? (window as unknown as BridgeHostWindow) : null,
  });
  if (isBrowser) {
    sharedBridge = bridge;
  }
  return bridge;
};
