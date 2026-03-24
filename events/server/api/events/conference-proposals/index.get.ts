import { defineEventHandler } from "h3";
import { getAllDocs } from "#database/utils/couchdb";
import { assertEventsAdminSession } from "../../../utils/assert-events-admin-session";
import { ensureEventsDatabase } from "../../../utils/events-db";
import {
  CONFERENCE_PROPOSAL_TYPE,
  normalizeProposalStatus,
  type ConferenceProposalDocument,
} from "../../../utils/conference-proposal";

interface ConferenceProposalListResponse {
  proposals: ConferenceProposalDocument[];
  meta: {
    pending: number;
    accepted: number;
    rejected: number;
    total: number;
  };
}

export default defineEventHandler(async (event): Promise<ConferenceProposalListResponse> => {
  await assertEventsAdminSession(event, ["admin", "curator"]);
  const databaseName = await ensureEventsDatabase();
  const allDocuments = await getAllDocs(databaseName, { include_docs: true });

  const proposals = (allDocuments?.rows ?? [])
    .map((row) => row.doc as ConferenceProposalDocument | undefined)
    .filter(
      (doc): doc is ConferenceProposalDocument =>
        Boolean(doc && doc.type === CONFERENCE_PROPOSAL_TYPE && doc._id),
    )
    .sort((left, right) => {
      const leftOpen = normalizeProposalStatus(left.status) === "pending";
      const rightOpen = normalizeProposalStatus(right.status) === "pending";
      if (leftOpen !== rightOpen) return leftOpen ? -1 : 1;
      return String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? ""));
    });

  return {
    proposals,
    meta: {
      pending: proposals.filter((proposal) => normalizeProposalStatus(proposal.status) === "pending").length,
      accepted: proposals.filter((proposal) => normalizeProposalStatus(proposal.status) === "accepted").length,
      rejected: proposals.filter((proposal) => normalizeProposalStatus(proposal.status) === "rejected").length,
      total: proposals.length,
    },
  };
});

