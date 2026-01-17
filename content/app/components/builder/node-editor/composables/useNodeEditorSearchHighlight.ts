import { computed, type ComputedRef } from "vue";
import type {
    ComponentArrayItemField,
    ComponentPropSchema,
} from "~/types/builder";

type MatchesSearch = (value: unknown) => boolean;

export const useNodeEditorSearchHighlight = (
    normalizedSearchQuery: ComputedRef<string>,
    matchesSearch: MatchesSearch,
) => {
    const isSearchActive = computed(
        () => normalizedSearchQuery.value.length > 0,
    );

    const escapeHighlightText = (value: string) =>
        value
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

    const shouldHighlightText = (value: unknown, type?: string) => {
        if (!isSearchActive.value) {
            return false;
        }
        if (type === "number" || type === "boolean") {
            return false;
        }
        const text = value === null || value === undefined ? "" : String(value);
        if (!text) {
            return false;
        }
        return text.toLowerCase().includes(normalizedSearchQuery.value);
    };

    const getHighlightMarkup = (value: unknown): string => {
        const text = value === null || value === undefined ? "" : String(value);
        if (!text) {
            return "";
        }
        const query = normalizedSearchQuery.value;
        if (!query) {
            return escapeHighlightText(text);
        }
        const lowerText = text.toLowerCase();
        if (!lowerText.includes(query)) {
            return escapeHighlightText(text);
        }
        let result = "";
        let startIndex = 0;
        let matchIndex = lowerText.indexOf(query, startIndex);
        while (matchIndex !== -1) {
            result += escapeHighlightText(text.slice(startIndex, matchIndex));
            result += `<mark>${escapeHighlightText(
                text.slice(matchIndex, matchIndex + query.length),
            )}</mark>`;
            startIndex = matchIndex + query.length;
            matchIndex = lowerText.indexOf(query, startIndex);
        }
        result += escapeHighlightText(text.slice(startIndex));
        return result;
    };

    const shouldHighlightSelect = (
        schema: ComponentPropSchema | ComponentArrayItemField,
        value: unknown,
    ) =>
        schema.type === "select" &&
        isSearchActive.value &&
        matchesSearch(value);

    const syncHighlightScroll = (event: Event) => {
        const target = event.target as HTMLTextAreaElement | null;
        if (!target) {
            return;
        }
        const wrapper = target.closest(".node-panel__input-wrap");
        if (!wrapper) {
            return;
        }
        const highlight = wrapper.querySelector(
            ".node-panel__input-highlight",
        ) as HTMLElement | null;
        if (!highlight) {
            return;
        }
        highlight.scrollTop = target.scrollTop;
        highlight.scrollLeft = target.scrollLeft;
    };

    return {
        isSearchActive,
        shouldHighlightText,
        getHighlightMarkup,
        shouldHighlightSelect,
        syncHighlightScroll,
    };
};
