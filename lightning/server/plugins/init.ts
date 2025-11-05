/**
 * Nitro server plugin for CouchDB initialization
 * Runs on server startup to ensure required design documents exist for lightning orders
 */

import {
  initializeDatabase,
  validateCouchDBEnvironment,
} from "#database/utils/couchdb";
import { lightningDesignDocument } from "../../utils/design-documents";
import { createStrikeProvider } from "../../providers/strike";
import type { LightningConfig } from "../../types/lightning";

/**
 * Initialize Strike webhook subscription
 */
async function initializeStrikeWebhook(runtimeConfig: any): Promise<void> {
  console.log("🔔 Initializing Strike webhook subscription...");

  try {
    // Validate required environment variables
    if (!process.env.NUXT_PUBLIC_SITE_URL) {
      console.warn(
        "⚠️ NUXT_PUBLIC_SITE_URL not set, skipping Strike webhook subscription setup",
      );
      return;
    }

    const lightningConfig = runtimeConfig.lightning as LightningConfig;

    // Validate Strike configuration
    if (!lightningConfig.providers?.strike) {
      console.warn(
        "⚠️ Strike provider configuration not found, skipping webhook subscription setup",
      );
      return;
    }

    const strikeConfig = lightningConfig.providers.strike;

    if (!strikeConfig.webhookSecret) {
      console.warn(
        "⚠️ Strike webhook secret not configured, skipping webhook subscription setup",
      );
      return;
    }

    // Create Strike provider and set up webhook subscription
    const strikeProvider = createStrikeProvider(strikeConfig);

    if (strikeProvider.setupWebhookSubscription) {
      const webhookUrl = `${process.env.NUXT_PUBLIC_SITE_URL}/api/webhooks/strike`;

      await strikeProvider.setupWebhookSubscription(webhookUrl);
      console.log("🎉 Strike webhook subscription initialized successfully");
    } else {
      console.warn("⚠️ Strike provider does not support webhook subscriptions");
    }
  } catch (error) {
    console.error(
      "💥 Strike webhook subscription initialization failed:",
      error,
    );
    // Don't throw here to prevent server startup failure
    // Webhook subscriptions are optional for basic functionality
  }
}

/**
 * Initialize CouchDB for lightning layer
 */
async function initializeLightningLayer(): Promise<void> {
  console.log("⚡ Initializing CouchDB for lightning layer...");

  try {
    // Validate environment variables
    validateCouchDBEnvironment();

    // Get runtime config for database naming
    const runtimeConfig = useRuntimeConfig();
    const dbLoginPrefix = runtimeConfig.dbLoginPrefix;

    if (!dbLoginPrefix) {
      throw new Error("dbLoginPrefix is not configured in runtime config");
    }

    // Construct database name
    const databaseName = `${dbLoginPrefix}-orders`;

    console.log(`🔧 Initializing lightning orders database: ${databaseName}`);

    // Initialize orders database with lightning design documents
    await initializeDatabase(databaseName, [lightningDesignDocument]);

    console.log(
      "🎉 CouchDB lightning layer initialization completed successfully",
    );

    // initialize strike webhook if it's set as the active provider
    if (runtimeConfig.lightning.defaultProvider === "strike") {
      await initializeStrikeWebhook(runtimeConfig);
    }
  } catch (error) {
    console.error("💥 CouchDB lightning layer initialization failed:", error);
    // Don't throw here to prevent server startup failure
    // The validation will catch missing config at runtime
  }
}

// Nitro plugin - runs on server startup
export default async () => {
  await initializeLightningLayer();
};
