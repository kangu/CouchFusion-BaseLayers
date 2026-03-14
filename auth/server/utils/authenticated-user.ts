import { createError, getCookie, type H3Event } from "h3";
import { getDocument, getSession } from "#database/utils/couchdb";

export interface AuthenticatedUserDoc extends Record<string, any> {
  _id: string;
  _rev?: string;
  name: string;
  type: "user";
  roles?: string[];
}

export interface AuthenticatedUserContext {
  sessionToken: string;
  userDoc: AuthenticatedUserDoc;
  session: {
    userCtx: {
      name: string;
      roles: string[];
    };
  };
}

export const requireAuthenticatedUser = async (
  event: H3Event,
): Promise<AuthenticatedUserContext> => {
  const sessionToken = getCookie(event, "AuthSession");

  if (!sessionToken) {
    throw createError({
      statusCode: 401,
      statusMessage: "Authentication required",
    });
  }

  const session = await getSession({ authSessionCookie: sessionToken });
  const username = session?.userCtx?.name;

  if (!username) {
    throw createError({
      statusCode: 401,
      statusMessage: "Invalid or expired session",
    });
  }

  const userDoc = await getDocument<AuthenticatedUserDoc>(
    "_users",
    `org.couchdb.user:${username}`,
  );

  if (!userDoc || userDoc.type !== "user") {
    throw createError({
      statusCode: 404,
      statusMessage: "User document not found",
    });
  }

  return {
    sessionToken,
    userDoc,
    session: {
      userCtx: {
        name: username,
        roles: Array.isArray(session?.userCtx?.roles) ? session.userCtx.roles : [],
      },
    },
  };
};
