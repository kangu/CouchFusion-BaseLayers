import { defineComponent, nextTick } from "vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { vi } from "vitest";
import type {
    BuilderNode,
    BuilderNodeChild,
    ComponentDefinition,
    ComponentRegistry,
} from "../../app/types/builder";
import NodeEditor from "../../app/components/builder/NodeEditor.vue";

export const TestSelect = defineComponent({
    name: "TestSelect",
    props: {
        modelValue: {
            type: [String, Number, Boolean],
            default: "",
        },
        propDefinition: {
            type: Object,
            default: () => ({}),
        },
        fieldContext: {
            type: Object,
            default: () => ({}),
        },
    },
    emits: ["update:modelValue"],
    template: "<div class=\"test-select\"></div>",
});

export const createComponentDefinitions = (): ComponentDefinition[] => [
    {
        id: "hero",
        label: "Hero",
        allowChildren: true,
        props: [
            { key: "title", label: "Title", type: "text" },
            { key: "description", label: "Description", type: "textarea" },
            { key: "count", label: "Count", type: "number" },
            {
                key: "variant",
                label: "Variant",
                type: "select",
                options: [
                    { label: "Primary", value: "primary" },
                    { label: "Secondary", value: "secondary" },
                ],
            },
            {
                key: "uiVariant",
                label: "UI Variant",
                type: "select",
                ui: { component: "TestSelect" },
                options: [
                    { label: "Primary", value: "primary" },
                    { label: "Secondary", value: "secondary" },
                ],
            },
            { key: "keywords", label: "Keywords", type: "stringarray" },
            {
                key: "items",
                label: "Items",
                type: "jsonarray",
                items: [
                    { key: "label", label: "Label", type: "text" },
                    { key: "tags", label: "Tags", type: "stringarray" },
                ],
            },
        ],
    },
    {
        id: "child",
        label: "Child",
        allowChildren: false,
        props: [{ key: "subtitle", label: "Subtitle", type: "text" }],
    },
    {
        id: "template",
        label: "Template",
        allowChildren: true,
        props: [{ key: "slot", label: "Slot", type: "text" }],
    },
];

export const createRegistry = (
    definitions: ComponentDefinition[],
): ComponentRegistry => ({
    list: definitions,
    lookup: Object.fromEntries(
        definitions.map((definition) => [definition.id, definition]),
    ),
});

export const createComponentNode = (
    uid: string,
    component: string,
    props: Record<string, unknown> = {},
    children: BuilderNodeChild[] = [],
): BuilderNode => ({
    uid,
    type: "component",
    component,
    props,
    children,
});

export const createTextNode = (uid: string, value: string): BuilderNodeChild => ({
    uid,
    type: "text",
    value,
});

type MountNodeEditorOptions = {
    node: BuilderNodeChild;
    searchQuery?: string;
    definitions?: ComponentDefinition[];
    globalAliasIds?: string[];
    stubs?: Record<string, any>;
};

export const mountNodeEditor = (options: MountNodeEditorOptions) => {
    const definitions = options.definitions ?? createComponentDefinitions();
    const registry = createRegistry(definitions);

    return mount(NodeEditor, {
        props: {
            node: options.node,
            registry,
            componentOptions: definitions,
            searchQuery: options.searchQuery,
            globalAliasIds: options.globalAliasIds,
            onUpdateProp: vi.fn(),
            onUpdateText: vi.fn(),
            onAddChildComponent: vi.fn(),
            onAddChildText: vi.fn(),
            onRemove: vi.fn(),
            onClone: vi.fn(),
        },
        global: {
            components: { TestSelect },
            stubs: options.stubs,
        },
    });
};

export const findFieldByLabel = (wrapper: VueWrapper, label: string) =>
    wrapper
        .findAll(".node-panel__field")
        .find((field) => field.find("span").text() === label);

export const expandNode = async (wrapper: VueWrapper) => {
    const toggle = wrapper.find("button.node-panel__toggle[data-state]");
    await toggle.trigger("click");
    await nextTick();
};
