import type { ComputedRef } from "vue";

type VisibleWhenRule = { prop: string; equals: unknown };
type MatchesSearch = (value: unknown) => boolean;

export const useNodeEditorFieldVisibility = ({
    isSearchActive,
    matchesSearch,
}: {
    isSearchActive: ComputedRef<boolean>;
    matchesSearch: MatchesSearch;
}) => {
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
            return matchesSearch(context[field.key]);
        });
    };

    return { isFieldVisible, filterVisibleFields };
};
