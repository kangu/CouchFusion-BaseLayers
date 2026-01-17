import { describe, expect, it } from "vitest";
import {
    doesNodeMatchSearch,
    filterNodesBySearch,
    matchesSearchValue,
    normalizeSearchQuery,
} from "../../app/utils/builderSearch";
import type { BuilderNodeChild } from "../../app/types/builder";

const createTextNode = (uid: string, value: string): BuilderNodeChild => ({
    uid,
    type: "text",
    value,
});

const createComponentNode = (
    uid: string,
    component: string,
    props: Record<string, unknown> = {},
    children: BuilderNodeChild[] = [],
): BuilderNodeChild => ({
    uid,
    type: "component",
    component,
    props,
    children,
});

describe("builderSearch", () => {
    it("normalizes search queries", () => {
        expect(normalizeSearchQuery("  Hero Block ")).toBe("hero block");
        expect(normalizeSearchQuery("")).toBe("");
        expect(normalizeSearchQuery(undefined)).toBe("");
    });

    it("matches primitives, arrays, objects, and avoids circular refs", () => {
        expect(matchesSearchValue("Hello World", "hello")).toBe(true);
        expect(matchesSearchValue(42, "42")).toBe(true);
        expect(matchesSearchValue(false, "false")).toBe(true);
        expect(matchesSearchValue(["Alpha", "Bravo"], "bra")).toBe(true);
        expect(
            matchesSearchValue({ title: "Alpha", meta: { tag: "match" } }, "match"),
        ).toBe(true);

        const circular: Record<string, any> = { title: "match" };
        circular.self = circular;
        expect(matchesSearchValue(circular, "match")).toBe(true);
        expect(matchesSearchValue(circular, "missing")).toBe(false);
    });

    it("matches text nodes, component props, and nested children", () => {
        const textNode = createTextNode("text-1", "Needle in haystack");
        expect(doesNodeMatchSearch(textNode, "needle")).toBe(true);

        const templateNode = createComponentNode("tpl-1", "template", {
            slot: "hero",
            heading: "Welcome",
        });
        expect(doesNodeMatchSearch(templateNode, "hero")).toBe(true);

        const parentNode = createComponentNode("parent-1", "container", {
            title: "Parent",
        });
        parentNode.children = [createTextNode("child-1", "Nested match")];
        expect(doesNodeMatchSearch(parentNode, "nested")).toBe(true);
        expect(doesNodeMatchSearch(parentNode, "missing")).toBe(false);
    });

    it("filters nodes while keeping parents with matching descendants", () => {
        const matchingPropNode = createComponentNode("node-1", "card", {
            title: "Match me",
        });
        const matchingChildNode = createComponentNode(
            "node-2",
            "wrapper",
            {},
            [createTextNode("node-2-text", "Child match")],
        );
        const nonMatchingNode = createComponentNode("node-3", "card", {
            title: "Other",
        });

        const result = filterNodesBySearch(
            [matchingPropNode, matchingChildNode, nonMatchingNode],
            "match",
        );

        expect(result.map((node) => node.uid)).toEqual(["node-1", "node-2"]);
    });
});
