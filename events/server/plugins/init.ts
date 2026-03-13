import { validateCouchDBEnvironment } from "#database/utils/couchdb";
import { ensureEventsDatabase } from "../utils/events-db";

async function initializeEventsLayer(): Promise<void> {
  console.log("🔧 Initializing CouchDB for events layer...");

  try {
    validateCouchDBEnvironment();
    await ensureEventsDatabase();
    console.log("🎉 CouchDB events layer initialization completed successfully");
  } catch (error) {
    console.error("💥 CouchDB events layer initialization failed:", error);
  }
}

export default async () => {
  await initializeEventsLayer();
};
