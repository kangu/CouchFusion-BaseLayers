/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SectionPlacementDialog from "../../app/components/builder/SectionPlacementDialog.vue";
import type { BuilderNodeChild } from "../../app/types/builder";
import type { MinimalContentDocument } from "../../app/utils/contentBuilder";

const createNode = (uid: string, component = "hero"): BuilderNodeChild => ({
    uid,
    type: "component",
    component,
    props: {},
    children: [],
});

const createDocument = (component: string): MinimalContentDocument => ({
    id: `content/${component}`,
    title: component,
    body: {
        type: "minimal",
        value: [[component, {}]],
    },
    extension: "md",
    meta: {},
    navigation: true,
    path: `/${component}`,
    seo: {
        title: component,
        description: "",
        image: null,
    },
    stem: component,
});

const mountDialog = (overrides: Record<string, unknown> = {}) =>
    mount(SectionPlacementDialog, {
        props: {
            isOpen: true,
            nodes: [createNode("intro"), createNode("features")],
            sectionNamesByUid: {
                intro: "Intro",
                features: "Features",
            },
            selectedComponentLabel: "Hero",
            sectionName: "New Landing Hero",
            initialInsertIndex: 1,
            serializedSectionDocuments: [
                { uid: "intro", document: createDocument("intro") },
                { uid: "features", document: createDocument("features") },
            ],
            globalComponents: [],
            ...overrides,
        },
        global: {
            stubs: {
                Content: {
                    props: ["value"],
                    template:
                        "<div class=\"content-render-stub\">{{ value?.title }}</div>",
                },
            },
        },
    });

describe("SectionPlacementDialog", () => {
    it("renders a clickable placement gap before, between, and after sections", async () => {
        const wrapper = mountDialog();

        const gaps = wrapper.findAll(".section-placement-dialog__gap");
        expect(gaps).toHaveLength(3);
        expect(gaps.map((gap) => gap.attributes("data-insert-index"))).toEqual([
            "0",
            "1",
            "2",
        ]);
        expect(wrapper.findAll(".section-placement-dialog__preview")).toHaveLength(2);
        expect(wrapper.text()).toContain("Hero");
        expect(wrapper.text()).toContain("New Landing Hero");

        await gaps[2].trigger("click");

        expect(wrapper.emitted("insert")).toEqual([[2]]);
    });

    it("highlights the suggested insertion gap without inserting automatically", () => {
        const wrapper = mountDialog({ initialInsertIndex: 1 });

        const highlighted = wrapper.find(
            ".section-placement-dialog__gap[data-suggested='true']",
        );

        expect(highlighted.exists()).toBe(true);
        expect(highlighted.attributes("data-insert-index")).toBe("1");
        expect(wrapper.emitted("insert")).toBeUndefined();
    });

    it("shows one placement target for an empty page", async () => {
        const wrapper = mountDialog({
            nodes: [],
            sectionNamesByUid: {},
            serializedSectionDocuments: [],
            initialInsertIndex: null,
        });

        const gaps = wrapper.findAll(".section-placement-dialog__gap");
        expect(gaps).toHaveLength(1);
        expect(gaps[0].attributes("data-insert-index")).toBe("0");
        expect(wrapper.find(".section-placement-dialog__empty").exists()).toBe(true);

        await gaps[0].trigger("click");

        expect(wrapper.emitted("insert")).toEqual([[0]]);
    });

    it("cancels without emitting an insert", async () => {
        const wrapper = mountDialog();

        await wrapper.find(".section-placement-dialog__cancel").trigger("click");

        expect(wrapper.emitted("cancel")).toHaveLength(1);
        expect(wrapper.emitted("insert")).toBeUndefined();
    });
});
