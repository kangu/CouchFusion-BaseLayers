import type { CouchDBDocument } from "#database/utils/couchdb";

export const CONFERENCE_PROPOSAL_TYPE = "conference_proposal";
export const CONFERENCE_PROPOSAL_STATUS_PENDING = "pending";
export const CONFERENCE_PROPOSAL_STATUS_ACCEPTED = "accepted";
export const CONFERENCE_PROPOSAL_STATUS_REJECTED = "rejected";

export type ConferenceProposalStatus =
  | typeof CONFERENCE_PROPOSAL_STATUS_PENDING
  | typeof CONFERENCE_PROPOSAL_STATUS_ACCEPTED
  | typeof CONFERENCE_PROPOSAL_STATUS_REJECTED;

export interface ConferenceProposalDocument extends CouchDBDocument {
  _id: string;
  _rev?: string;
  type: typeof CONFERENCE_PROPOSAL_TYPE;
  status: ConferenceProposalStatus;
  name: string;
  websiteUrl: string | null;
  location: string | null;
  city: string | null;
  country: string | null;
  continent: string | null;
  region?: string | null;
  startDateIso: string | null;
  recreateNextYear?: boolean;
  discountCode?: string | null;
  discountLabel?: string | null;
  commissionLabel?: string | null;
  logoUrl?: string | null;
  logoFileId?: string | null;
  organizerName?: string | null;
  contactEmail?: string | null;
  xAccountUrl?: string | null;
  interestedInAdvertising?: boolean;
  notes: string | null;
  conferenceId: string | null;
  submittedBy: {
    username: string;
    userDocId: string;
  };
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export const normalizeProposalStatus = (
  value: unknown,
): ConferenceProposalStatus => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === CONFERENCE_PROPOSAL_STATUS_ACCEPTED) {
    return CONFERENCE_PROPOSAL_STATUS_ACCEPTED;
  }
  if (normalized === CONFERENCE_PROPOSAL_STATUS_REJECTED) {
    return CONFERENCE_PROPOSAL_STATUS_REJECTED;
  }
  return CONFERENCE_PROPOSAL_STATUS_PENDING;
};

export const isProposalOpen = (
  value: ConferenceProposalDocument | null | undefined,
): boolean => {
  if (!value) return false;
  return normalizeProposalStatus(value.status) === CONFERENCE_PROPOSAL_STATUS_PENDING;
};
