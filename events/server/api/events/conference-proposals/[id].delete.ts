import { createError, defineEventHandler, getRouterParam } from "h3";
import { deleteDocument, getDocument } from "#database/utils/couchdb";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";
import { ensureEventsDatabase } from "../../../utils/events-db";
import {
  CONFERENCE_PROPOSAL_STATUS_REJECTED,
  CONFERENCE_PROPOSAL_TYPE,
  normalizeProposalStatus,
  type ConferenceProposalDocument,
} from "../../../utils/conference-proposal";

export default defineEventHandler(async (event) => {
  await assertEventsAdminSession(event, ["admin", "curator"]);
  const proposalId = getRouterParam(event, "id", { decode: true });
  if (!proposalId) {
    throw createError({
      statusCode: 400,
      statusMessage: "Proposal id is required",
    });
  }

  const databaseName = await ensureEventsDatabase();
  const proposal = await getDocument<ConferenceProposalDocument>(databaseName, proposalId);
  if (!proposal || proposal.type !== CONFERENCE_PROPOSAL_TYPE) {
    throw createError({
      statusCode: 404,
      statusMessage: "Proposal not found",
    });
  }

  if (normalizeProposalStatus(proposal.status) !== CONFERENCE_PROPOSAL_STATUS_REJECTED) {
    throw createError({
      statusCode: 400,
      statusMessage: "Only rejected proposals can be deleted",
    });
  }

  if (!proposal._rev) {
    throw createError({
      statusCode: 409,
      statusMessage: "Proposal revision is required for deletion",
    });
  }

  await deleteDocument(databaseName, proposal._id, proposal._rev);

  return {
    success: true,
    id: proposal._id,
  };
});

