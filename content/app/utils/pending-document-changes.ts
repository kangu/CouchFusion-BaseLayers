const asRecord = (value: unknown): Record<string, unknown> | null => {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
};

/**
 * Resolves a named root section for a serialized minimal-document leaf path.
 *
 * Root section IDs are stored on the serialized root node while display names
 * live in `meta.builder.sectionNamesById`.
 */
export const resolveDocumentSectionName = (
    document: unknown,
    path: string,
): string | null => {
    const pathParts = path.split(".");
    if (pathParts[0] !== "body" || pathParts[1] !== "value") {
        return null;
    }

    const rootIndex = Number(pathParts[2]);
    if (!Number.isInteger(rootIndex) || rootIndex < 0) {
        return null;
    }

    const documentRecord = asRecord(document);
    const body = asRecord(documentRecord?.body);
    const entries = body?.value;
    if (!Array.isArray(entries)) {
        return null;
    }

    const rootEntry = entries[rootIndex];
    if (!Array.isArray(rootEntry)) {
        return null;
    }

    const rootProps = asRecord(rootEntry[1]);
    const sectionId = rootProps?.__builderSectionId;
    if (typeof sectionId !== "string" || !sectionId.trim()) {
        return null;
    }

    const meta = asRecord(documentRecord?.meta);
    const builder = asRecord(meta?.builder);
    const sectionNamesById = asRecord(builder?.sectionNamesById);
    const sectionName = sectionNamesById?.[sectionId];

    return typeof sectionName === "string" && sectionName.trim()
        ? sectionName.trim()
        : null;
};
