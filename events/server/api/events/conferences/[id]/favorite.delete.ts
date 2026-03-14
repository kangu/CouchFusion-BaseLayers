import { createError, defineEventHandler, getRouterParam } from "h3";
import { putDocument } from "#database/utils/couchdb";
import { requireAuthenticatedUser } from "#auth/server/utils/authenticated-user";
import {
  normalizeConferencePreferences,
  setConferencePreference,
} from "#events/server/utils/conference-preferences";

export default defineEventHandler(async (event) => {
  const conferenceId = getRouterParam(event, "id", { decode: true });

  if (!conferenceId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Conference id is required",
    });
  }

  const { userDoc } = await requireAuthenticatedUser(event);
  const currentPrefs = normalizeConferencePreferences(userDoc.conference_prefs);
  const nextPrefs = setConferencePreference(
    currentPrefs,
    "favorites",
    conferenceId,
    false,
  );

  userDoc.conference_prefs = nextPrefs;
  userDoc.updatedAt = new Date().toISOString();

  const updateResult = await putDocument("_users", userDoc);

  return {
    success: true,
    conferenceId,
    favorite: false,
    preferences: nextPrefs,
    rev: updateResult.rev,
  };
});
