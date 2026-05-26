import type {
    BuilderNodeChild,
    BuilderValue,
} from "#content/app/types/builder";

export type GlobalAliasDefaultsById = Record<string, Record<string, unknown>>;

const isInternalContentProp = (key: string): boolean =>
    key.startsWith("__builder") || key.startsWith("__content");

const cloneGlobalAliasDefaultValue = <T>(value: T): T => {
    if (
        value === null ||
        typeof value !== "object" ||
        value instanceof Date ||
        value instanceof RegExp
    ) {
        return value;
    }

    if (typeof structuredClone === "function") {
        try {
            return structuredClone(value);
        } catch {
            // Fall through to JSON clone for values structuredClone cannot copy.
        }
    }

    try {
        return JSON.parse(JSON.stringify(value)) as T;
    } catch {
        if (Array.isArray(value)) {
            return [...value] as T;
        }
        return { ...(value as Record<string, unknown>) } as T;
    }
};

export const applyGlobalAliasDefaultsToNode = (
    node: BuilderNodeChild,
    defaultsById: GlobalAliasDefaultsById,
): boolean => {
    if (node.type !== "component") {
        return false;
    }

    const defaults = defaultsById[node.component];
    if (!defaults) {
        return false;
    }

    const nextProps = { ...(node.props ?? {}) };
    let changed = false;

    for (const [key, value] of Object.entries(defaults)) {
        if (
            nextProps[key] === undefined &&
            !isInternalContentProp(key)
        ) {
            nextProps[key] = cloneGlobalAliasDefaultValue(value) as BuilderValue;
            changed = true;
        }
    }

    if (changed) {
        node.props = nextProps;
    }

    return changed;
};

export const applyGlobalAliasDefaultsToTree = (
    nodes: BuilderNodeChild[],
    defaultsById: GlobalAliasDefaultsById,
): boolean => {
    let changed = false;

    for (const node of nodes) {
        if (applyGlobalAliasDefaultsToNode(node, defaultsById)) {
            changed = true;
        }

        if (node.type === "component" && node.children?.length) {
            if (applyGlobalAliasDefaultsToTree(node.children, defaultsById)) {
                changed = true;
            }
        }
    }

    return changed;
};
