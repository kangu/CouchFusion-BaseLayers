/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import FontBrowserDialog from "../../app/components/builder/FontBrowserDialog.vue";

const fonts = [
  {
    slug: "space-grotesk",
    label: "Space Grotesk",
    category: "sans-serif",
    defSubset: "latin",
    isVariable: true,
    styles: ["normal"],
    weights: [400, 700],
    variants: { latin: 2 },
  },
  {
    slug: "playfair-display",
    label: "Playfair Display",
    category: "serif",
    defSubset: "latin",
    isVariable: false,
    styles: ["normal", "italic"],
    weights: [400, 700, 900],
    variants: { latin: 6 },
  },
] as const;

describe("FontBrowserDialog", () => {
  it("filters Bunny fonts and emits install for the selected family", async () => {
    const wrapper = mount(FontBrowserDialog, {
      props: {
        isOpen: true,
        fonts,
        loading: false,
        installing: false,
      },
      global: {
        stubs: {
          Teleport: true,
        },
      },
    });

    await wrapper.find("input[type='search']").setValue("space");

    expect(wrapper.findAll(".font-browser-card")).toHaveLength(1);
    expect(wrapper.find(".font-browser-card").text()).toContain("Space Grotesk");
    expect(wrapper.find(".font-browser-card__sample").attributes("style")).toContain(
      "Space Grotesk",
    );

    await wrapper.find(".font-browser-card__install").trigger("click");

    expect(wrapper.emitted("install")).toEqual([[fonts[0]]]);
  });
});
