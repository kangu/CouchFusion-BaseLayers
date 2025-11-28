import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const resolveScript = () =>
  fileURLToPath(
    new URL("../scripts/watch-component-registry.mjs", import.meta.url),
  );

const inferAppName = (nuxt: any) => {
  const rootDir: string = nuxt.options.rootDir || process.cwd();
  const parent = path.basename(path.dirname(rootDir));
  if (parent === "apps") {
    return path.basename(rootDir);
  }
  return null;
};

export default function contentRegistryWatchModule(_moduleOptions: any, nuxt: any) {
  const isDev = Boolean(nuxt.options.dev);
  const enabled = process.env.CONTENT_REGISTRY_WATCH !== "0";

  if (!isDev || !enabled) {
    return;
  }

  const appName = inferAppName(nuxt);
  if (!appName) {
    nuxt.options.logger?.info?.(
      "[content-layer] Skipping component registry watch: unable to infer app name (expected rootDir to be apps/<name>).",
    );
    return;
  }

  const script = resolveScript();
  nuxt.options.logger?.info?.(
    `[content-layer] Starting component registry watcher for app \"${appName}\"... (set CONTENT_REGISTRY_WATCH=0 to disable)`,
  );

  const child = spawn("bun", [script, `--app=${appName}`], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    nuxt.options.logger?.info?.(
      `[content-layer] component registry watcher exited (code=${code}, signal=${signal})`,
    );
  });

  nuxt.hook("close", () => {
    if (!child.killed) {
      child.kill("SIGINT");
    }
  });
}
