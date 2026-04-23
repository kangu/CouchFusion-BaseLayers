import { resolveRuntimeAppSlug, buildCouchEnvSection } from "#database/utils/couch-config";

let hasLoggedAppSlug = false;

export default defineNitroPlugin(() => {
  if (hasLoggedAppSlug) {
    return;
  }

  const runtimeConfig = useRuntimeConfig();
  const appSlug = resolveRuntimeAppSlug(runtimeConfig);
  const section = buildCouchEnvSection(appSlug);

  console.log(`[database] startup appSlug for CouchDB _config: ${appSlug} (section: ${section})`);
  hasLoggedAppSlug = true;
});
