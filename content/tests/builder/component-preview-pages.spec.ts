/** @vitest-environment jsdom */
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ComponentPreviewRender from "../../runtime/component-preview/ComponentPreviewRender.vue";
import ComponentPreviewShell from "../../runtime/component-preview/ComponentPreviewShell.vue";

const route = {
  params: { componentId: "hero" },
  query: { token: "preview-secret" },
};

beforeEach(() => {
  vi.stubGlobal("definePageMeta", vi.fn());
  vi.stubGlobal("useRoute", () => route);
  vi.stubGlobal("useComponentRegistry", () => ({
    registry: {
      lookup: { hero: { id: "hero", label: "Hero" } },
    },
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe("component preview pages", () => {
  it("switches the native render iframe between desktop and 375px mobile", async () => {
    const wrapper = mount(ComponentPreviewShell, {
      global: {
        stubs: {
          ClientOnly: { template: "<div><slot /></div>" },
          RichTooltip: { template: "<span><slot /></span>" },
        },
      },
    });

    const frame = wrapper.get("[data-render-frame]");
    expect(frame.attributes("style")).toContain("width: 100%");
    expect(frame.attributes("src")).toContain(
      "/__couchfusion/components/render/hero?token=preview-secret",
    );

    await wrapper.get('button[aria-label="Mobile preview"]').trigger("click");
    expect(wrapper.get("[data-render-frame]").attributes("style")).toContain(
      "width: 375px",
    );

    const firstKey = wrapper.get("[data-render-frame]").attributes("data-refresh");
    await wrapper.get('button[aria-label="Refresh preview"]').trigger("click");
    expect(wrapper.get("[data-render-frame]").attributes("data-refresh")).not.toBe(
      firstKey,
    );
  });

  it("renders a registered component with declared defaults only", async () => {
    const HeroPreview = {
      props: ["enabled", "title", "synthetic"],
      template:
        '<output data-hero>{{ JSON.stringify({ enabled, title, synthetic }) }}</output>',
    };
    vi.stubGlobal("useComponentRegistry", () => ({
      registry: {
        lookup: {
          hero: {
            id: "hero",
            label: "Hero",
            previewComponentId: "HeroPreview",
            previewProps: { title: "override", synthetic: "preview" },
            props: [
              {
                key: "enabled",
                label: "Enabled",
                type: "boolean",
                default: false,
              },
              { key: "title", label: "Title", type: "text" },
            ],
          },
        },
      },
    }));

    const wrapper = mount(ComponentPreviewRender, {
      global: {
        components: { HeroPreview },
        stubs: {
          NuxtErrorBoundary: { template: "<div><slot /></div>" },
        },
      },
    });
    await flushPromises();

    expect(wrapper.get("[data-hero]").text()).toBe(
      JSON.stringify({ enabled: false }),
    );
  });

  it("keeps an unknown component inside a usable not-found state", () => {
    vi.stubGlobal("useComponentRegistry", () => ({
      registry: { lookup: {} },
    }));

    const wrapper = mount(ComponentPreviewRender);

    expect(wrapper.get('[role="status"]').text()).toContain(
      'Component "hero" is not registered',
    );
  });
});
