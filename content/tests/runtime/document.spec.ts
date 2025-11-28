/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import ContentDocument from "../../app/components/runtime/content/Content.vue";
import type {
  HastElement,
  HastNode,
  HastRoot,
  HastText,
} from "../../app/components/runtime/content/types";

const HeroBlock = defineComponent({
  name: "TestHeroBlock",
  props: {
    title: {
      type: String,
      required: true,
    },
    cta: {
      type: String,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    return () =>
      h("section", { class: "hero-block" }, [
        h("h1", props.title),
        props.cta ? h("a", { class: "hero-cta" }, props.cta) : null,
        ...(slots.subheading ? slots.subheading() : []),
        ...(slots.default ? slots.default() : []),
      ]);
  },
});

const CardBlock = defineComponent({
  name: "TestCardBlock",
  props: {
    heading: {
      type: String,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    return () =>
      h("article", { class: "card-block" }, [
        props.heading ? h("h2", props.heading) : null,
        ...(slots.default ? slots.default() : []),
        ...(slots.footer
          ? [h("footer", { class: "card-footer" }, slots.footer())]
          : []),
      ]);
  },
});

const textNode = (value: string): HastText => ({
  type: "text",
  value,
});

const elementNode = (
  tagName: string,
  properties: Record<string, unknown> = {},
  children: HastNode[] = [],
): HastElement => ({
  type: "element",
  tagName,
  properties,
  children,
});

const createDocumentValue = (body: HastRoot) => ({
  id: `doc-${Math.random().toString(16).slice(2)}`,
  body,
});

describe("Content runtime <Content> renderer", () => {
  beforeEach(() => {
    const runtimeConfig = {
      dbLoginPrefix: "test-content-runtime",
      public: { content: {} },
    };

    (globalThis as any).useRuntimeConfig = () => runtimeConfig;
    (globalThis as any).useAppConfig = () => ({ content: {} });
  });

  it("renders plain markup from a HAST root", () => {
    const body: HastRoot = {
      type: "root",
      children: [
        elementNode("p", {}, [textNode("Hello, minimark renderer!")]),
        elementNode("ul", {}, [
          elementNode("li", {}, [textNode("First item")]),
          elementNode("li", {}, [textNode("Second item")]),
        ]),
      ],
    };

    const wrapper = mount(ContentDocument, {
      props: {
        value: createDocumentValue(body),
      },
    });

    expect(wrapper.html()).toContain("<p>Hello, minimark renderer!</p>");
    expect(wrapper.findAll("li")).toHaveLength(2);
  });

  it("renders registered content components with props and named slots", async () => {
    const body: HastRoot = {
      type: "root",
      children: [
        elementNode("hero-block", { title: "Welcome", cta: "Explore" }, [
          elementNode("template", { "v-slot:subheading": "" }, [
            elementNode("p", {}, [textNode("Subheading copy")]),
          ]),
          elementNode("p", {}, [textNode("Hero description body copy.")]),
        ]),
        elementNode("card-block", { heading: "Feature Card" }, [
          elementNode("p", {}, [textNode("Card content area.")]),
          elementNode("template", { "v-slot:footer": "" }, [
            elementNode("span", {}, [textNode("Footer callout")]),
          ]),
        ]),
      ],
    };

    const wrapper = mount(ContentDocument, {
      props: {
        value: createDocumentValue(body),
        components: {
          "hero-block": HeroBlock,
          "card-block": CardBlock,
        },
      },
    });
    await flushPromises();

    const html = wrapper.html();
    expect(html).toContain("hero-block");

    const hero = wrapper.find("section.hero-block");
    expect(hero.exists()).toBe(true);
    expect(hero.text()).toContain("Welcome");
    expect(hero.text()).toContain("Explore");
    expect(hero.text()).toContain("Subheading copy");
    expect(hero.text()).toContain("Hero description body copy.");

    const card = wrapper.find("article.card-block");
    expect(card.exists()).toBe(true);
    expect(card.text()).toContain("Feature Card");
    expect(card.text()).toContain("Card content area.");
    const footer = card.find("footer.card-footer");
    expect(footer.exists()).toBe(true);
    expect(footer.text()).toContain("Footer callout");
  });
});
