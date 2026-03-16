export interface EmailNotificationPayload {
  to: string;
  subject: string;
  text: string;
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

const shouldFail = (value: string): boolean => {
  return value.toLowerCase().includes("fail-notification");
};

export const sendEmailNotification = async (
  payload: EmailNotificationPayload,
): Promise<NotificationSendResult> => {
  if (shouldFail(payload.to)) {
    return {
      ok: false,
      providerMessageId: null,
      errorMessage: "Simulated email provider failure",
    };
  }

  console.info("[maintenance][email]", {
    to: payload.to,
    subject: payload.subject,
  });

  return {
    ok: true,
    providerMessageId: `mock-email-${crypto.randomUUID()}`,
    errorMessage: null,
  };
};

export const sendSmsNotification = async (
  payload: SmsNotificationPayload,
): Promise<NotificationSendResult> => {
  if (shouldFail(payload.to)) {
    return {
      ok: false,
      providerMessageId: null,
      errorMessage: "Simulated SMS provider failure",
    };
  }

  console.info("[maintenance][sms]", {
    to: payload.to,
    sender: payload.sender,
  });

  return {
    ok: true,
    providerMessageId: `mock-sms-${crypto.randomUUID()}`,
    errorMessage: null,
  };
};
