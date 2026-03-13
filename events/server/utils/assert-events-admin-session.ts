import type { H3Event } from "h3";
import { assertAdminSession } from "#auth/server/utils/assert-admin-session";

/**
 * Enforce admin session for events admin APIs.
 */
export const assertEventsAdminSession = async (event: H3Event): Promise<void> => {
  await assertAdminSession(event);
};
