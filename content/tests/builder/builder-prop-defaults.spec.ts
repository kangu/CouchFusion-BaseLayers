/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineComponent, h, type PropType } from "vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import ContentDocument from "../../app/components/runtime/content/Content.vue";
import type { BuilderNode, ComponentDefinition } from "../../app/types/builder";
import {
    applyBuilderPropDefaults,
    normalizeBuilderComponentProps,
    normalizeBuilderJsonProps,
    serializeNode,
    type MinimalContentEntry,
} from "../../app/utils/contentBuilder";
import {
    createComponentNode,
    createRegistry,
    expandNode,
    mountNodeEditor,
} from "./node-editor-test-utils";

// A block whose registry defaults equal its component defaults, as the
// registry generator extracts them. `badges` has a component default the
// registry could not capture (a factory), so it has no registry default.
const NAV_DEFAULT = [
    { id: "sala", label: "Sala" },
    { id: "harta", label: "Harta" },
];
const KEYWORDS_DEFAULT = ["prost", "idiot"];
const CTA_DEFAULT = { label: "Bilete", href: "#bilete" };
const SETTINGS_DEFAULT = { theme: "dark" };

const definitions: ComponentDefinition[] = [
    {
        id: "site-header",
        label: "Site header",
        props: [
            { key: "title", label: "Title", type: "text", default: "Casa" },
            {
                key: "intro",
                label: "Intro",
                type: "textarea",
                default: "Două rânduri de introducere",
            },
            { key: "columns", label: "Columns", type: "number", default: 3 },
            { key: "sticky", label: "Sticky", type: "boolean", default: true },
            {
                key: "variant",
                label: "Variant",
                type: "select",
                options: [
                    { label: "Light", value: "light" },
                    { label: "Dark", value: "dark" },
                ],
                default: "dark",
            },
            {
                key: "keywords",
                label: "Keywords",
                type: "stringarray",
                default: KEYWORDS_DEFAULT,
            },
            {
                key: "navItems",
                label: "Menu",
                type: "jsonarray",
                items: [
                    { key: "id", label: "Id", type: "text" },
                    { key: "label", label: "Label", type: "text" },
                ],
                default: NAV_DEFAULT,
            },
            {
                key: "cta",
                label: "CTA",
                type: "jsonobject",
                fields: [
                    { key: "label", label: "Label", type: "text" },
                    { key: "href", label: "Link", type: "text" },
                ],
                default: CTA_DEFAULT,
            },
            {
                key: "settings",
                label: "Settings",
                type: "json",
                default: SETTINGS_DEFAULT,
            },
            {
                key: "badges",
                label: "Badges",
                type: "stringarray",
            },
        ],
    },
];

const lookup = createRegistry(definitions).lookup;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The Workbench's load step for one stored block (`deserializeEntry`). */
const loadStoredProps = (
    stored: Record<string, unknown>,
    component = "site-header",
) => {
    const props = clone(stored);
    normalizeBuilderJsonProps(
        component,
        normalizeBuilderComponentProps(component, props, lookup),
        lookup,
    );
    return applyBuilderPropDefaults(component, props, lookup);
};

const loadedNode = (stored: Record<string, unknown> = {}): BuilderNode =>
    createComponentNode("header-1", "site-header", loadStoredProps(stored));

const FULL_BUILDER_PROPS = {
    title: "Casa",
    intro: "Două rânduri de introducere",
    columns: 3,
    sticky: true,
    variant: "dark",
    ":keywords": JSON.stringify(KEYWORDS_DEFAULT),
    ":navItems": JSON.stringify(NAV_DEFAULT),
    ":cta": JSON.stringify(CTA_DEFAULT),
    settings: SETTINGS_DEFAULT,
};

describe("loading a stored block into the builder", () => {
    it("fills every prop a {} block lacks with its registry default, encoded as the builder saves it", () => {
        expect(loadStoredProps({})).toEqual(FULL_BUILDER_PROPS);
    });

    it("leaves a list without a registry default missing, so the component keeps its own default", () => {
        const props = loadStoredProps({});
        expect(props).not.toHaveProperty(":badges");
        expect(props).not.toHaveProperty("badges");
    });

    it("keeps stored values, including empty ones, under either key", () => {
        const props = loadStoredProps({
            title: "",
            sticky: false,
            columns: 0,
            ":navItems": "[]",
            ":keywords": '["tont"]',
            cta: { label: "Intră", href: "/intra" },
        });

        expect(props).toMatchObject({
            title: "",
            sticky: false,
            columns: 0,
            ":navItems": "[]",
            ":keywords": '["tont"]',
            cta: { label: "Intră", href: "/intra" },
            intro: "Două rânduri de introducere",
            variant: "dark",
        });
        expect(props).not.toHaveProperty(":cta");
    });

    it("reads Vue-bound keys and bare lists before deciding a prop is missing", () => {
        const props = loadStoredProps({
            ":columns": "5",
            navItems: [{ id: "x", label: "X" }],
        });

        expect(props.columns).toBe(5);
        expect(props[":navItems"]).toBe('[{"id":"x","label":"X"}]');
        expect(props).not.toHaveProperty("navItems");
    });

    it("does not share default objects with the registry", () => {
        const first = loadStoredProps({});
        (first.settings as Record<string, unknown>).theme = "light";

        expect(SETTINGS_DEFAULT.theme).toBe("dark");
        expect(loadStoredProps({}).settings).toEqual({ theme: "dark" });
    });

    it("leaves components without a definition untouched", () => {
        expect(loadStoredProps({}, "unknown-block")).toEqual({});
    });

    it("still turns a stored value that is not a list into an empty list", () => {
        const props = normalizeBuilderJsonProps(
            "site-header",
            { badges: null },
            lookup,
        );
        expect(props).toEqual({ ":badges": "[]" });
    });

    it("saves a loaded {} block like a newly added one, with no empty values", () => {
        const entry = serializeNode(loadedNode()) as MinimalContentEntry[];

        expect(entry[0]).toBe("site-header");
        expect(entry[1]).toEqual(FULL_BUILDER_PROPS);
        for (const value of Object.values(entry[1] as Record<string, unknown>)) {
            expect(value).not.toBe("");
            expect(value).not.toBe("[]");
        }
    });

    it("runs in the Workbench after the paragraph alignment step", () => {
        const workbench = readFileSync(
            resolve(process.cwd(), "content/app/components/builder/Workbench.vue"),
            "utf8",
        );
        const start = workbench.indexOf("const deserializeEntry");
        const body = workbench.slice(
            start,
            workbench.indexOf("const deserializeTree", start),
        );

        expect(body).toContain("normalizeBuilderJsonProps(");
        const paragraphStep = body.indexOf('if (component === "p")');
        const defaultsStep = body.indexOf(
            "applyBuilderPropDefaults(component, node.props, registry.lookup)",
        );
        expect(paragraphStep).toBeGreaterThan(-1);
        expect(defaultsStep).toBeGreaterThan(paragraphStep);
        expect(workbench).not.toContain("const normalizeJsonProps");
    });
});

const SiteHeader = defineComponent({
    name: "TestSiteHeader",
    props: {
        title: { type: String, default: "Casa" },
        intro: { type: String, default: "Două rânduri de introducere" },
        columns: { type: Number, default: 3 },
        sticky: { type: Boolean, default: true },
        variant: { type: String, default: "dark" },
        keywords: {
            type: Array as PropType<string[]>,
            default: () => [...KEYWORDS_DEFAULT],
        },
        navItems: {
            type: Array as PropType<Array<{ id: string; label: string }>>,
            default: () => clone(NAV_DEFAULT),
        },
        cta: {
            type: Object as PropType<{ label: string; href: string }>,
            default: () => ({ ...CTA_DEFAULT }),
        },
        settings: {
            type: Object as PropType<{ theme: string }>,
            default: () => ({ ...SETTINGS_DEFAULT }),
        },
        badges: {
            type: Array as PropType<string[]>,
            default: () => ["nou"],
        },
    },
    setup(props) {
        return () =>
            h(
                "header",
                {
                    class: ["site-header", props.variant, { sticky: props.sticky }],
                    "data-columns": props.columns,
                    "data-theme": props.settings.theme,
                },
                [
                    h("h1", props.title),
                    h("p", props.intro),
                    h(
                        "nav",
                        props.navItems.map((item) =>
                            h("a", { href: `#${item.id}` }, item.label),
                        ),
                    ),
                    h(
                        "ul",
                        { class: "keywords" },
                        props.keywords.map((word) => h("li", word)),
                    ),
                    h("a", { class: "cta", href: props.cta.href }, props.cta.label),
                    h(
                        "ul",
                        { class: "badges" },
                        props.badges.map((badge) => h("li", badge)),
                    ),
                ],
            );
    },
});

const renderBody = async (value: MinimalContentEntry[]) => {
    const wrapper = mount(ContentDocument, {
        props: {
            value: {
                id: "page-/test",
                path: "/test",
                body: { type: "minimal", value },
                meta: {},
            },
            components: { "site-header": SiteHeader },
        },
    });
    await flushPromises();
    return wrapper;
};

const withoutBuilderAttributes = (html: string) =>
    html.replace(/\s(?:data-builder-uid)="[^"]*"/g, "");

describe("inline preview of a {} block", () => {
    beforeEach(() => {
        const runtimeConfig = {
            dbLoginPrefix: "test-builder-prop-defaults",
            public: { content: {} },
        };
        (globalThis as any).useRoute = () => ({ path: "/test" });
        (globalThis as any).useRuntimeConfig = () => runtimeConfig;
        (globalThis as any).useAppConfig = () => ({ content: {} });
    });

    it("renders like the public page", async () => {
        const publicPage = await renderBody([["site-header", {}]]);
        const preview = await renderBody([
            serializeNode(loadedNode(), {
                annotateBuilderUids: true,
            }) as MinimalContentEntry,
        ]);

        expect(publicPage.findAll("nav a")).toHaveLength(2);
        expect(publicPage.findAll(".badges li")).toHaveLength(1);
        expect(withoutBuilderAttributes(preview.html())).toBe(
            publicPage.html(),
        );
    });
});

describe("node editor on a loaded {} block", () => {
    it("shows the registry defaults in its fields", async () => {
        const wrapper = mountNodeEditor({ definitions, node: loadedNode() });
        await expandNode(wrapper);

        const field = (key: string) =>
            wrapper.find(`[data-content-prop-path="${key}"]`);

        expect(
            (field("title").find("input").element as HTMLInputElement).value,
        ).toBe("Casa");
        expect(
            (field("intro").find("textarea").element as HTMLTextAreaElement)
                .value,
        ).toBe("Două rânduri de introducere");
        expect(
            (field("columns").find("input").element as HTMLInputElement).value,
        ).toBe("3");
        expect(
            (field("sticky").find('input[type="checkbox"]')
                .element as HTMLInputElement).checked,
        ).toBe(true);
        expect(field("navItems").find(".node-panel__array-toggle").text()).toContain(
            "(2)",
        );
        expect(field("keywords").text()).toContain("prost");
        const ctaValues = field("cta")
            .findAll("input")
            .map((input) => (input.element as HTMLInputElement).value);
        expect(ctaValues).toEqual(expect.arrayContaining(["Bilete", "#bilete"]));
    });

    it("writes nothing back into the node when it opens", async () => {
        for (const node of [loadedNode(), createComponentNode("raw", "site-header", {})]) {
            const wrapper = mountNodeEditor({ definitions, node });
            await expandNode(wrapper);
            await flushPromises();

            expect(wrapper.props("onUpdateProp")).not.toHaveBeenCalled();
        }
    });
});
