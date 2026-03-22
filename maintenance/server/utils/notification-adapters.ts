import { sendSms } from "#sms/server/utils/sender";
import { queueTemplateEmail } from "#email/server/utils/template-queue";

export interface EmailNotificationPayload {
  to: string;
  template: string;
  payload: Record<string, unknown>;
}

export interface SmsNotificationPayload {
  to: string;
  sender: string | null;
  text: string;
}

export interface NotificationSendResult {
  ok: boolean;
  providerMessageId: string | null;
  errorMessage: string | null;
}

export const sendEmailNotification = async (
  payload: EmailNotificationPayload,
): Promise<NotificationSendResult> => {
  const result = await queueTemplateEmail({
    templateName: payload.template,
    to: payload.to,
    payload: payload.payload,
  });

  return result;
};

export const sendSmsNotification = async (
  payload: SmsNotificationPayload,
): Promise<NotificationSendResult> => {
  const result = await sendSms({
    to: payload.to,
    text: payload.text,
  });

  return {
    ok: result.ok,
    providerMessageId: result.providerMessageId,
    errorMessage: result.errorMessage,
  };
};
