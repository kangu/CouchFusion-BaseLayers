/** @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import NodeEditor from "../../app/components/builder/NodeEditor.vue";
import {
    createComponentNode,
    createRegistry,
} from "./node-editor-test-utils";
import type { ComponentDefinition } from "../../app/types/builder";

const localizedDefinitions: ComponentDefinition[] = [
    {
        id: "hero",
        label: "Hero",
        allowChildren: false,
        props: [
            {
                key: "title",
                label: "Title",
                type: "text",
                localized: true,
            },
        ],
    },
];

const mountLocalizedNodeEditor = (showTranslateSection: boolean) =>
    mount(NodeEditor, {
        props: {
            node: createComponentNode("hero-1", "hero", { title: "Hello" }),
            registry: createRegistry(localizedDefinitions),
            componentOptions: localizedDefinitions,
            showTranslateSection,
            onUpdateProp: vi.fn(),
            onUpdateText: vi.fn(),
            onAddChildComponent: vi.fn(),
            onAddChildText: vi.fn(),
            onRemove: vi.fn(),
            onClone: vi.fn(),
            onTranslateField: vi.fn(),
            onToggleTranslateFieldSelection: vi.fn(),
            isTranslateFieldSelected: () => false,
        },
    });

describe("NodeEditor translation controls", () => {
    it("hides inline field translation controls when translation mode is off", () => {
        const wrapper = mountLocalizedNodeEditor(false);

        expect(wrapper.find(".node-panel__translate-inline-wrap").exists()).toBe(
            false,
        );
        expect(wrapper.find(".node-panel__field--localized").exists()).toBe(false);
    });

    it("shows inline field translation controls when translation mode is on", () => {
        const wrapper = mountLocalizedNodeEditor(true);

        expect(wrapper.find(".node-panel__translate-inline-wrap").exists()).toBe(
            true,
        );
        expect(wrapper.find(".node-panel__field--localized").exists()).toBe(true);
    });
});
