/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { defineComponent, nextTick } from "vue";
import {
    createComponentNode,
    createTextNode,
    expandNode,
    findFieldByLabel,
    mountNodeEditor,
} from "./node-editor-test-utils";

const NodeEditorStub = defineComponent({
    name: "NodeEditor",
    props: {
        node: {
            type: Object,
            required: true,
        },
    },
    template: "<div class=\"node-editor-stub\" :data-uid=\"node.uid\"></div>",
});

describe("NodeEditor search filtering", () => {
    it("filters props, array items, and extra props by search query", async () => {
        const node = createComponentNode("node-1", "hero", {
            title: "Hello world",
            description: "Not matched",
            count: 3,
            variant: "primary",
            uiVariant: "primary",
            keywords: ["match-keyword", "misc"],
            items: [
                { label: "Alpha", tags: ["red", "blue"] },
                { label: "Match item", tags: ["match-tag", "other"] },
            ],
            extra: "extra match value",
            dataId: "neutral",
        });

        const wrapper = mountNodeEditor({ node, searchQuery: "match" });
        await expandNode(wrapper);

        expect(findFieldByLabel(wrapper, "Title")).toBeUndefined();
        const itemsField = findFieldByLabel(wrapper, "Items");
        expect(itemsField).toBeTruthy();
        const keywordsField = findFieldByLabel(wrapper, "Keywords");
        expect(keywordsField).toBeTruthy();

        const itemsToggle = itemsField!.find(".node-panel__array-toggle");
        await itemsToggle.trigger("click");
        await nextTick();

        const visibleItems = itemsField!
            .findAll(".node-panel__array-item")
            .filter(
                (item) =>
                    !item.classes().includes("node-panel__array-item--nested") &&
                    item.isVisible(),
            );
        expect(visibleItems).toHaveLength(1);

        const nestedToggle = itemsField!.find(
            ".node-panel__array--nested .node-panel__array-toggle",
        );
        await nestedToggle.trigger("click");
        await nextTick();

        const visibleNestedItems = itemsField!
            .findAll(".node-panel__array-item--nested")
            .filter((item) => item.isVisible());
        expect(visibleNestedItems).toHaveLength(1);

        const keywordsToggle = keywordsField!.find(".node-panel__array-toggle");
        await keywordsToggle.trigger("click");
        await nextTick();

        const visibleKeywords = keywordsField!
            .findAll(".node-panel__array-item")
            .filter((item) => item.isVisible());
        expect(visibleKeywords).toHaveLength(1);

        expect(findFieldByLabel(wrapper, "extra")).toBeTruthy();
        expect(findFieldByLabel(wrapper, "dataId")).toBeUndefined();
    });

    it("keeps child nodes that match search while filtering siblings", async () => {
        const node = createComponentNode("parent-1", "hero", { title: "Parent" }, [
            createTextNode("text-1", "Needle text"),
            createComponentNode("child-1", "child", { subtitle: "Other" }),
        ]);

        const wrapper = mountNodeEditor({
            node,
            searchQuery: "needle",
            stubs: { NodeEditor: NodeEditorStub },
        });

        await expandNode(wrapper);

        const stubs = wrapper.findAll(".node-editor-stub");
        expect(stubs).toHaveLength(1);
        expect(stubs[0].attributes("data-uid")).toBe("text-1");
    });
});
