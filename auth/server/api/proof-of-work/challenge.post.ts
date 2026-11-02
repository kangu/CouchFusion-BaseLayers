import { createError, defineEventHandler, readBody } from "h3";
import {
  type ProofOfWorkPurpose,
} from "#auth/server/utils/proof-of-work";
import { issueProofOfWorkChallenge } from "#auth/server/utils/proof-of-work-runtime";
import { resolveCookieSecret } from "#auth/server/utils/session-cookie";

interface ProofOfWorkChallengeRequest {
  purpose?: ProofOfWorkPurpose;
}

const isProofOfWorkPurpose = (value: unknown): value is ProofOfWorkPurpose =>
  value === "login" || value === "contact" || value === "career_hub_checkout";

export default defineEventHandler(async (event) => {
  const body = await readBody<ProofOfWorkChallengeRequest>(event);

  if (!isProofOfWorkPurpose(body?.purpose)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid proof-of-work purpose.",
    });
  }

  await resolveCookieSecret(); // refreshes the proof-of-work signing secret
  return issueProofOfWorkChallenge(body.purpose);
});
