import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { getDocument, putDocument } from "#database/utils/couchdb";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";
import { ensureEventsDatabase } from "../../../utils/events-db";
import {
  CONFERENCE_PROPOSAL_STATUS_ACCEPTED,
  CONFERENCE_PROPOSAL_STATUS_PENDING,
  CONFERENCE_PROPOSAL_STATUS_REJECTED,
  CONFERENCE_PROPOSAL_TYPE,
  normalizeProposalStatus,
  type ConferenceProposalDocument,
} from "../../../utils/conference-proposal";

interface ConferenceProposalPatchPayload {
  status?: unknown;
  conferenceId?: unknown;
}

const asOptionalText = (
  value: unknown,
  maxLength: number,
  fieldLabel: string,
): string | null | undefined => {
  if (typeof value === "undefined") return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} must be a string or null`,
    });
  }
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  if (trimmed.length > maxLength) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldLabel} exceeds maximum length`,
    });
  }
  return trimmed;
};

export default defineEventHandler(async (event) => {
  await assertEventsAdminSession(event, ["admin", "curator"]);
  const proposalId = getRouterParam(event, "id", { decode: true });
  if (!proposalId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Proposal id is required",
    });
  }

  const payload = await readBody<ConferenceProposalPatchPayload>(event);
  if (!payload || typeof payload !== "object") {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid request payload",
    });
  }

  const status = normalizeProposalStatus(payload.status);
  if (
    status !== CONFERENCE_PROPOSAL_STATUS_PENDING &&
    status !== CONFERENCE_PROPOSAL_STATUS_ACCEPTED &&
    status !== CONFERENCE_PROPOSAL_STATUS_REJECTED
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid proposal status",
    });
  }

  const conferenceId = asOptionalText(payload.conferenceId, 220, "conferenceId");
  if (status === CONFERENCE_PROPOSAL_STATUS_ACCEPTED && !conferenceId) {
    throw createError({
      statusCode: 400,
      statusMessage: "conferenceId is required when accepting a proposal",
    });
  }

  const databaseName = await ensureEventsDatabase();
  const current = await getDocument<ConferenceProposalDocument>(databaseName, proposalId);
  if (!current || current.type !== CONFERENCE_PROPOSAL_TYPE) {
    throw createError({
      statusCode: 404,
      statusMessage: "Proposal not found",
    });
  }

  const now = new Date().toISOString();
  const nextProposal: ConferenceProposalDocument = {
    ...current,
    status,
    conferenceId:
      typeof conferenceId !== "undefined"
        ? conferenceId
        : current.conferenceId ?? null,
    updatedAt: now,
    resolvedAt:
      status === CONFERENCE_PROPOSAL_STATUS_PENDING
        ? null
        : current.resolvedAt ?? now,
  };

  const result = await putDocument(databaseName, nextProposal);

  return {
    success: true,
    id: result.id,
    rev: result.rev,
    proposal: {
      ...nextProposal,
      _rev: result.rev,
    },
  };
});

