/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import RichTooltip from "../../app/components/ui/RichTooltip.vue";

describe("RichTooltip", () => {
  it("shows rich tooltip content on hover and keeps the trigger described", async () => {
    const wrapper = mount(RichTooltip, {
      attachTo: document.body,
      props: {
        title: "Desktop preview",
        description: "Show component thumbnails at desktop width.",
      },
      slots: {
        default: `<template #default="{ describedby }">
          <button type="button" :aria-describedby="describedby">Preview</button>
        </template>`,
      },
    });

    const trigger = wrapper.find(".rich-tooltip");
    const button = wrapper.find("button");
    const describedby = button.attributes("aria-describedby");

    expect(describedby).toMatch(/^rich-tooltip-/);
    expect(document.getElementById(describedby!)).not.toBeNull();
    expect(document.getElementById(describedby!)?.getAttribute("aria-hidden")).toBe("true");

    await trigger.trigger("mouseenter");
    await nextTick();

    const tooltip = document.getElementById(describedby!);
    expect(tooltip?.getAttribute("role")).toBe("tooltip");
    expect(tooltip?.getAttribute("aria-hidden")).toBe("false");
    expect(tooltip?.textContent).toContain("Desktop preview");
    expect(tooltip?.textContent).toContain("Show component thumbnails at desktop width.");

    await trigger.trigger("mouseleave");
    await nextTick();

    expect(tooltip?.getAttribute("aria-hidden")).toBe("true");

    wrapper.unmount();
  });
});
