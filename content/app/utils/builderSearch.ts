import type { BuilderNodeChild } from "../types/builder";

export const normalizeSearchQuery = (query?: string): string => {
    if (typeof query !== "string") {
        return "";
    }
    return query.trim().toLowerCase();
};

export const matchesSearchValue = (
    value: unknown,
    query: string,
    seen: Set<object> = new Set(),
): boolean => {
    if (!query) {
        return true;
    }
    if (value === null || value === undefined) {
        return false;
    }

    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return String(value).toLowerCase().includes(query);
    }

    if (Array.isArray(value)) {
        return value.some((entry) => matchesSearchValue(entry, query, seen));
    }

    if (typeof value === "object") {
        if (seen.has(value as object)) {
            return false;
        }
        seen.add(value as object);
        return Object.values(value as Record<string, unknown>).some((entry) =>
            matchesSearchValue(entry, query, seen),
        );
    }

    return false;
};

export const doesNodeMatchSearch = (
    node: BuilderNodeChild,
    query: string,
): boolean => {
    if (!query) {
        return true;
    }
    if (node.type === "text") {
        return matchesSearchValue(node.value, query);
    }
    const propValues = Object.values(node.props || {});
    if (propValues.some((value) => matchesSearchValue(value, query))) {
        return true;
    }
    return node.children?.some((child) => doesNodeMatchSearch(child, query))
        ? true
        : false;
};

export const filterNodesBySearch = (
    nodes: BuilderNodeChild[],
    query: string,
): BuilderNodeChild[] => {
    if (!query) {
        return nodes;
    }
    return nodes.filter((node) => doesNodeMatchSearch(node, query));
};
