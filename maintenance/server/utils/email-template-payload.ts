import type {
  MaintenanceClientDocument,
  MaintenanceNotificationCategory,
} from "./types";

interface BuildMaintenanceEmailTemplatePayloadInput {
  client: MaintenanceClientDocument;
  dueDate: string;
  category: MaintenanceNotificationCategory;
  reminderLabel: string;
  recipientRole: "company" | "customer";
  reminderText: string;
  companyName: string | null;
  companyAddress: string | null;
}

const formatAddress = (
  address: MaintenanceClientDocument["serviceAddress"] | null,
): string | null => {
  if (!address?.line1) {
    return null;
  }

  return [address.line1, address.city, address.state, address.postalCode, address.country]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(", ");
};

export const buildMaintenanceEmailTemplatePayload = (
  input: BuildMaintenanceEmailTemplatePayloadInput,
): Record<string, unknown> => {
  return {
    clientName: input.client.name,
    clientId: input.client._id,
    expirationDate: input.dueDate,
    category: input.category,
    reminderLabel: input.reminderLabel,
    recipientRole: input.recipientRole,
    reminderText: input.reminderText,
    company_name: input.companyName,
    company_address: input.companyAddress,
    customer_name: input.client.primaryContactName ?? input.client.name,
    reference_number: input.client.counterId,
    service_address: formatAddress(input.client.serviceAddress),
  };
};
