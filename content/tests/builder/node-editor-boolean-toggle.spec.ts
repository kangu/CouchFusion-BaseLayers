/** @vitest-environment jsdom */

import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
import type { ComponentDefinition } from "../../app/types/builder";
import {
    createComponentNode,
    expandNode,
    mountNodeEditor,
} from "./node-editor-test-utils";

const definitions: ComponentDefinition[] = [
    {
        id: "settings",
        label: "Settings",
        props: [
            {
                key: "twoFactorAuth",
                label: "Two-factor auth",
                description: "Require a code at sign-in",
                type: "boolean",
            },
        ],
    },
];

describe("NodeEditor boolean toggle", () => {
    it("makes the full field surface activate an accessible spring toggle", async () => {
        const wrapper = mountNodeEditor({
            definitions,
            node: createComponentNode("settings-1", "settings", {
                twoFactorAuth: false,
            }),
        });
        await expandNode(wrapper);

        const field = wrapper.find(
            '[data-content-prop-path="twoFactorAuth"]',
        );
        const input = field.find('input[type="checkbox"]');

        expect(field.element.tagName).toBe("LABEL");
        expect(field.find(".node-panel__field-description").text()).toBe(
            "Require a code at sign-in",
        );
        expect(field.find(".node-panel__boolean-toggle").exists()).toBe(true);
        expect(input.attributes("role")).toBe("switch");
        expect(input.attributes("aria-label")).toBe("Two-factor auth");

        (field.element as HTMLLabelElement).click();
        await nextTick();

        expect((input.element as HTMLInputElement).checked).toBe(true);

        await input.trigger("change");
        await nextTick();

        expect(field.find(".is-animating--on").exists()).toBe(true);
    });
});
