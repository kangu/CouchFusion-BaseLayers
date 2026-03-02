import type { ComputedRef } from "vue";

type VisibleWhenRule = { prop: string; equals: unknown };
type MatchesSearch = (value: unknown) => boolean;

export const useNodeEditorFieldVisibility = ({
    isSearchActive,
    matchesSearch,
    normalizedSearchQuery,
}: {
    isSearchActive: ComputedRef<boolean>;
    matchesSearch: MatchesSearch;
    normalizedSearchQuery: ComputedRef<string>;
}) => {
    let stickyFieldsByContext = new WeakMap<object, Set<string>>();
    let stickyQuery = "";

    const ensureStickyScope = () => {
        if (stickyQuery === normalizedSearchQuery.value) {
            return;
        }
        stickyQuery = normalizedSearchQuery.value;
        stickyFieldsByContext = new WeakMap<object, Set<string>>();
    };

    const isFieldVisible = (
        schema: { visibleWhen?: VisibleWhenRule | VisibleWhenRule[] } | undefined,
        context: Record<string, any> | undefined,
    ) => {
        if (!schema?.visibleWhen) {
            return true;
        }
        const rules = Array.isArray(schema.visibleWhen)
            ? schema.visibleWhen
            : [schema.visibleWhen];
        return rules.some((rule) => {
            if (!rule || typeof rule !== "object") {
                return true;
            }
            const target = context?.[rule.prop];
            if (Array.isArray(rule.equals)) {
                return rule.equals.includes(target);
            }
            return target === rule.equals;
        });
    };

    const filterVisibleFields = <
        T extends {
            key: string;
            visibleWhen?: VisibleWhenRule | VisibleWhenRule[];
        },
    >(
        fields: T[] | undefined,
        context: Record<string, any> | undefined,
    ): T[] => {
        if (!fields) {
            return [];
        }
        return fields.filter((field) => {
            if (!isFieldVisible(field, context)) {
                return false;
            }
            if (!isSearchActive.value) {
                return true;
            }
            if (!context) {
                return false;
            }
            ensureStickyScope();
            if (typeof context === "object" && context !== null) {
                const contextObject = context as object;
                let stickyVisible = stickyFieldsByContext.get(contextObject);
                if (!stickyVisible) {
                    stickyVisible = new Set<string>();
                    stickyFieldsByContext.set(contextObject, stickyVisible);
                }
                if (stickyVisible.has(field.key)) {
                    return true;
                }
                const matched = matchesSearch(context[field.key]);
                if (matched) {
                    stickyVisible.add(field.key);
                }
                return matched;
            }
            return matchesSearch(context[field.key]);
        });
    };

    return { isFieldVisible, filterVisibleFields };
};
