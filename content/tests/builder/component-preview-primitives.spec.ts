import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import PreviewDeviceToggle from "../../app/components/builder/PreviewDeviceToggle.vue";
import {
  MOBILE_PREVIEW_WIDTH,
  declaredPreviewDefaults,
} from "../../app/utils/component-preview";

describe("component preview primitives", () => {
  it("returns only explicitly declared defaults, including falsy values", () => {
    expect(
      declaredPreviewDefaults({
        id: "hero",
        label: "Hero",
        props: [
          {
            key: "enabled",
            label: "Enabled",
            type: "boolean",
            default: false,
          },
          { key: "count", label: "Count", type: "number", default: 0 },
          { key: "title", label: "Title", type: "text", default: "" },
          { key: "missing", label: "Missing", type: "text" },
        ],
      }),
    ).toEqual({ enabled: false, count: 0, title: "" });
  });

  it("shares the 375px mobile model and emits accessible device changes", async () => {
    expect(MOBILE_PREVIEW_WIDTH).toBe(375);
    const wrapper = mount(PreviewDeviceToggle, {
      props: { modelValue: "desktop" },
    });

    const desktop = wrapper.get('button[aria-label="Desktop preview"]');
    const mobile = wrapper.get('button[aria-label="Mobile preview"]');
    expect(desktop.attributes("aria-pressed")).toBe("true");
    expect(mobile.attributes("aria-pressed")).toBe("false");

    await mobile.trigger("click");

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["mobile"]);
  });

  it("keeps picker fallbacks and preview overrides while using declared defaults", () => {
    const picker = readFileSync(
      resolve(process.cwd(), "content/app/components/builder/ComponentPickerDialog.vue"),
      "utf8",
    );

    expect(picker).toContain("declaredPreviewDefaults");
    expect(picker).toContain("def.previewProps");
    expect(picker).toContain('case "text"');
    expect(picker).toContain('case "boolean"');
    expect(picker).toContain('case "number"');
    expect(picker).toContain('case "select"');
    expect(picker).toContain('case "jsonarray"');
    expect(picker).toContain('case "json"');
  });
});
// @vitest-environment jsdom
