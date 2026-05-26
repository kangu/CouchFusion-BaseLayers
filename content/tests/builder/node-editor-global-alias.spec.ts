/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import {
    createComponentNode,
    mountNodeEditor,
} from "./node-editor-test-utils";

describe("NodeEditor global alias styling", () => {
    it("marks global alias component nodes with a distinctive badge", () => {
        const wrapper = mountNodeEditor({
            node: createComponentNode("node-1", "GlobalFooter"),
            globalAliasIds: ["GlobalFooter"],
        });

        expect(wrapper.classes()).toContain("node-panel--global-alias");

        const badge = wrapper.find(".node-panel__global-badge");
        expect(badge.exists()).toBe(true);
        expect(badge.text()).toBe("Global");
    });

    it("does not mark regular component nodes as global aliases", () => {
        const wrapper = mountNodeEditor({
            node: createComponentNode("node-1", "hero"),
            globalAliasIds: ["GlobalFooter"],
        });

        expect(wrapper.classes()).not.toContain("node-panel--global-alias");
        expect(wrapper.find(".node-panel__global-badge").exists()).toBe(false);
    });
});
