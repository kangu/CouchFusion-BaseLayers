/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import {
    createComponentNode,
    expandNode,
    findFieldByLabel,
    mountNodeEditor,
} from "./node-editor-test-utils";

describe("NodeEditor search highlights", () => {
    it("renders highlight overlays for matching text inputs and textareas", async () => {
        const node = createComponentNode("node-1", "hero", {
            title: "Alpha Beta",
            description: "Alpha details here",
            count: 10,
            variant: "secondary",
            uiVariant: "secondary",
            keywords: [],
            items: [],
        });

        const wrapper = mountNodeEditor({ node, searchQuery: "alpha" });
        await expandNode(wrapper);

        const titleField = findFieldByLabel(wrapper, "Title");
        expect(titleField).toBeTruthy();
        expect(
            titleField!.find(".node-panel__input-highlight mark").exists(),
        ).toBe(true);

        const descriptionField = findFieldByLabel(wrapper, "Description");
        expect(descriptionField).toBeTruthy();
        expect(
            descriptionField!.find(".node-panel__input-highlight mark").exists(),
        ).toBe(true);
    });

    it("marks select fields but skips highlights for number inputs", async () => {
        const node = createComponentNode("node-1", "hero", {
            title: "",
            description: "",
            count: 42,
            variant: "primary",
            uiVariant: "primary",
            keywords: [],
            items: [],
        });

        const wrapper = mountNodeEditor({ node, searchQuery: "primary" });
        await expandNode(wrapper);

        const variantField = findFieldByLabel(wrapper, "Variant");
        expect(variantField).toBeTruthy();
        expect(variantField!.classes()).toContain("node-panel__field--match");

        const uiVariantField = findFieldByLabel(wrapper, "UI Variant");
        expect(uiVariantField).toBeTruthy();
        expect(uiVariantField!.classes()).toContain("node-panel__field--match");

        await wrapper.setProps({ searchQuery: "42" });
        await nextTick();

        const countField = findFieldByLabel(wrapper, "Count");
        expect(countField).toBeTruthy();
        expect(countField!.find(".node-panel__input-highlight").exists()).toBe(
            false,
        );
    });

    it("syncs textarea scroll with the highlight overlay", async () => {
        const node = createComponentNode("node-1", "hero", {
            title: "Alpha",
            description: "Alpha content with more text to scroll",
            count: 0,
            variant: "secondary",
            uiVariant: "secondary",
            keywords: [],
            items: [],
        });

        const wrapper = mountNodeEditor({ node, searchQuery: "alpha" });
        await expandNode(wrapper);

        const descriptionField = findFieldByLabel(wrapper, "Description");
        expect(descriptionField).toBeTruthy();

        const textarea = descriptionField!.find("textarea");
        const highlight = descriptionField!.find(".node-panel__input-highlight");

        expect(highlight.exists()).toBe(true);

        textarea.element.scrollTop = 12;
        textarea.element.scrollLeft = 4;
        await textarea.trigger("scroll");

        expect((highlight.element as HTMLElement).scrollTop).toBe(12);
        expect((highlight.element as HTMLElement).scrollLeft).toBe(4);
    });
});
