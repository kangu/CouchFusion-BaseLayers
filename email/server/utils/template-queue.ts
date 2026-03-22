import { getEmailTemplatePrefix } from "./email-templates";

const EMAIL_SENDER_UPDATE_PREFIX =
  "/email-sender/_design/pending_emails/_update/build_template_with_payload/";

export interface QueueTemplateEmailInput {
  templateName: string;
  to: string;
  payload: Record<string, unknown>;
}

export interface QueueTemplateEmailResult {
  ok: boolean;
  providerMessageId: string | null;
  errorMessage: string | null;
}

const resolveAuthHeader = (): string | null => {
  const encoded = process.env.COUCHDB_ADMIN_AUTH;
  if (!encoded || typeof encoded !== "string" || encoded.trim().length === 0) {
    return null;
  }

  return `Basic ${encoded.trim()}`;
};

const normalizeTemplateId = (rawTemplateName: string, prefix: string): string | null => {
  const templateName = rawTemplateName.trim();
  if (!templateName) {
    return null;
  }

  if (templateName.startsWith(prefix)) {
    return templateName;
  }

  return `${prefix}${templateName}`;
};

export const queueTemplateEmail = async (
  input: QueueTemplateEmailInput,
): Promise<QueueTemplateEmailResult> => {
  const authHeader = resolveAuthHeader();
  if (!authHeader) {
    return {
      ok: false,
      providerMessageId: null,
      errorMessage: "COUCHDB_ADMIN_AUTH environment variable is required.",
    };
  }

  const runtimeConfig = useRuntimeConfig();
  const templatePrefix = getEmailTemplatePrefix(runtimeConfig.dbLoginPrefix || "");
  const fullTemplateId = normalizeTemplateId(input.templateName, templatePrefix);

  if (!fullTemplateId) {
    return {
      ok: false,
      providerMessageId: null,
      errorMessage: "templateName is required.",
    };
  }

  const baseUrl = process.env.EMAIL_SENDER_BASE_URL || "http://localhost:5984";
  const endpoint = `${baseUrl}${EMAIL_SENDER_UPDATE_PREFIX}${fullTemplateId}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        ...input.payload,
        to: input.to,
        email: input.to,
        admin_email: input.to,
        created_at: new Date().toISOString(),
      }),
    });

    const bodyText = await response.text().catch(() => "");

    if (!response.ok) {
      return {
        ok: false,
        providerMessageId: null,
        errorMessage: bodyText || `Failed to queue email template payload (${response.status}).`,
      };
    }

    return {
      ok: true,
      providerMessageId: bodyText || null,
      errorMessage: null,
    };
  } catch (error) {
    return {
      ok: false,
      providerMessageId: null,
      errorMessage: error instanceof Error ? error.message : "Unknown queue error",
    };
  }
};
