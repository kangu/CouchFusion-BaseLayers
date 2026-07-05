import type { ComponentArrayItemField } from "../types/builder";

export interface NodeEditorSummaryOptions {
    fields?: ComponentArrayItemField[];
    maxItems?: number;
    maxLength?: number;
}

const DEFAULT_MAX_LENGTH = 96;
const DEFAULT_MAX_ITEMS = 3;
const PREFERRED_KEYS = [
    "title",
    "label",
    "name",
    "heading",
    "text",
    "value",
    "description",
];

const normalizeSummaryText = (value: unknown): string => {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    if (typeof value === "number") {
        return Number.isFinite(value) ? String(value) : "";
    }

    const raw = String(value)
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return raw;
};

const truncateSummary = (value: string, maxLength: number): string => {
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength).trimEnd()}...`;
};

const summarizeArrayCount = (value: unknown[]): string => {
    if (value.length === 1) {
        return "1 item";
    }
    return `${value.length} items`;
};

const summarizeObjectFallback = (
    value: Record<string, unknown>,
    options: NodeEditorSummaryOptions,
): string => {
    for (const key of PREFERRED_KEYS) {
        const summary = summarizeNodeEditorValue(value[key], {
            ...options,
            fields: undefined,
        });
        if (summary) {
            return summary;
        }
    }

    const firstEntry = Object.entries(value).find(([, entry]) =>
        Boolean(summarizeNodeEditorValue(entry, { ...options, fields: undefined })),
    );

    if (!firstEntry) {
        return "";
    }

    return summarizeNodeEditorValue(firstEntry[1], {
        ...options,
        fields: undefined,
    });
};

const summarizeObjectWithFields = (
    value: Record<string, unknown>,
    fields: ComponentArrayItemField[],
    options: NodeEditorSummaryOptions,
): string => {
    const parts = fields
        .map((field) => {
            const fieldValue = value[field.key];
            if (Array.isArray(fieldValue)) {
                return fieldValue.length
                    ? `${field.label}: ${summarizeArrayCount(fieldValue)}`
                    : "";
            }

            const summary = summarizeNodeEditorValue(fieldValue, {
                ...options,
                fields: field.type === "jsonobject" ? field.fields : undefined,
            });

            return summary ? `${field.label}: ${summary}` : "";
        })
        .filter(Boolean);

    return parts.join(" · ");
};

export const summarizeNodeEditorValue = (
    value: unknown,
    options: NodeEditorSummaryOptions = {},
): string => {
    const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;
    let summary = "";

    if (Array.isArray(value)) {
        summary = summarizeArrayValue(value, options);
    } else if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        summary = options.fields?.length
            ? summarizeObjectWithFields(record, options.fields, options)
            : summarizeObjectFallback(record, options);
    } else {
        summary = normalizeSummaryText(value);
    }

    return truncateSummary(summary, maxLength);
};

export const summarizeArrayValue = (
    value: unknown[],
    options: NodeEditorSummaryOptions = {},
): string => {
    const maxItems = options.maxItems ?? DEFAULT_MAX_ITEMS;
    const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;

    if (!Array.isArray(value) || !value.length) {
        return "Empty";
    }

    const summaries = value
        .slice(0, maxItems)
        .map((entry) =>
            summarizeNodeEditorValue(entry, {
                ...options,
                fields: undefined,
                maxLength,
            }),
        )
        .filter(Boolean);

    const remaining = value.length - maxItems;
    if (remaining > 0) {
        summaries.push(`+${remaining} more`);
    }

    return truncateSummary(summaries.join(" · "), maxLength);
};
