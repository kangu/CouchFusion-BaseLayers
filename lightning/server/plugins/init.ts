/**
 * Nitro server plugin for CouchDB initialization
 * Runs on server startup to ensure required design documents exist for lightning orders
 */

import {
  initializeDatabase,
  validateCouchDBEnvironment,
} from "#database/utils/couchdb";
import { lightningDesignDocument } from "../../utils/design-documents";
import { createBlinkProvider } from "../../providers/blink";
import { createStrikeProvider } from "../../providers/strike";
import type { LightningConfig } from "../../types/lightning";
import {
  assertLightningConfigReady,
  logLightningConfigSourceNotices,
  resolveLightningConfigWithSources,
} from "../utils/lightning-config";

/**
 * Initialize Strike webhook subscription
 */
async function initializeStrikeWebhook(lightningConfig: LightningConfig): Promise<void> {
  console.log("🔔 Initializing Strike webhook subscription...");

  try {
    // Validate required environment variables
    if (!process.env.NUXT_PUBLIC_SITE_URL) {
      console.warn(
        "⚠️ NUXT_PUBLIC_SITE_URL not set, skipping Strike webhook subscription setup",
      );
      return;
    }

    // Validate Strike configuration
    if (!lightningConfig.providers?.strike) {
      console.warn(
        "⚠️ Strike provider configuration not found, skipping webhook subscription setup",
      );
      return;
    }

    const strikeConfig = lightningConfig.providers.strike;

    if (!strikeConfig.apiKey) {
      console.warn(
        "⚠️ Strike API key not configured, skipping webhook subscription setup",
      );
      return;
    }

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

async function initializeBlinkWebhook(lightningConfig: LightningConfig): Promise<void> {
  console.log("🔔 Initializing Blink webhook subscription...");

  try {
    const blinkConfig = lightningConfig.providers?.blink;

    if (!blinkConfig) {
      console.warn(
        "⚠️ Blink provider configuration not found, skipping webhook subscription setup",
      );
      return;
    }

    if (!blinkConfig.apiKey) {
      console.warn(
        "⚠️ Blink API key not configured, skipping webhook subscription setup",
      );
      return;
    }

    const webhookUrl =
      blinkConfig.webhookUrl ||
      (process.env.NUXT_PUBLIC_SITE_URL
        ? `${process.env.NUXT_PUBLIC_SITE_URL}/api/webhooks/blink`
        : null);

    if (!webhookUrl) {
      console.warn(
        "⚠️ NUXT_PUBLIC_SITE_URL not set and no Blink webhook URL configured, skipping webhook setup",
      );
      return;
    }

    const blinkProvider = createBlinkProvider(blinkConfig);
    const result = await blinkProvider.setupWebhookSubscription?.(webhookUrl);
    if (result && result.success === false && result.skipped) {
      console.warn(
        "⚠️ Blink API key cannot manage callback endpoints; continuing without auto-created webhooks",
      );
      return;
    }
    console.log("🎉 Blink webhook subscription initialized successfully");
  } catch (error) {
    console.error("💥 Blink webhook subscription initialization failed:", error);
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
    const resolvedLightningConfig = await resolveLightningConfigWithSources(runtimeConfig);
    const lightningConfig = resolvedLightningConfig.config;

    logLightningConfigSourceNotices(resolvedLightningConfig);
    assertLightningConfigReady(resolvedLightningConfig);

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

    // initialize provider-specific webhook setup
    if (lightningConfig.defaultProvider === "strike") {
      await initializeStrikeWebhook(lightningConfig);
    } else if (lightningConfig.defaultProvider === "blink") {
      await initializeBlinkWebhook(lightningConfig);
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
