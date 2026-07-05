/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ComponentPickerDialog from "../../app/components/builder/ComponentPickerDialog.vue";
import {
  normalizeComponentPickerCategorySettings,
  type ComponentPickerCategorySettings,
} from "../../app/utils/component-picker-categories";
import type { ComponentDefinition } from "../../app/types/builder";

const categoryMock = vi.hoisted(() => ({
  refs: {} as Record<string, any>,
  fetchAdmin: vi.fn(),
  saveAdmin: vi.fn(),
}));

vi.mock("#content/app/composables/useComponentPickerCategories", async () => {
  const { ref } = await import("vue");
  categoryMock.refs.settings = ref({
    _id: "content-settings:component-picker-categories",
    type: "content-component-picker-categories",
    categories: [],
    assignments: {},
    updatedAt: null,
    updatedBy: null,
  });
  categoryMock.refs.saving = ref(false);
  categoryMock.refs.error = ref(null);
  categoryMock.refs.available = ref(true);
  categoryMock.fetchAdmin.mockImplementation(async () => categoryMock.refs.settings.value);
  categoryMock.saveAdmin.mockImplementation(async (payload: ComponentPickerCategorySettings) => {
    categoryMock.refs.settings.value = payload;
    return categoryMock.refs.settings.value;
  });

  return {
    useComponentPickerCategories: () => ({
      settings: categoryMock.refs.settings,
      saving: categoryMock.refs.saving,
      error: categoryMock.refs.error,
      available: categoryMock.refs.available,
      fetchAdmin: categoryMock.fetchAdmin,
      saveAdmin: categoryMock.saveAdmin,
    }),
  };
});

const componentOptions: ComponentDefinition[] = [
  { id: "hero-section", label: "Hero Section", category: "default" },
  { id: "annual-report", label: "Annual Report", category: "annual-report" },
  { id: "scroll-preview", label: "Scroll Preview", category: "default" },
  {
    id: "GlobalFooter",
    label: "GlobalFooter",
    category: "global",
    previewComponentId: "footer-section",
  },
  { id: "p", label: "Paragraph", category: "basic" },
];

const mountPicker = (options: ComponentDefinition[] = componentOptions) =>
  mount(ComponentPickerDialog, {
    props: {
      isOpen: true,
      componentOptions: options,
    },
    global: {
      stubs: {
        LazyLoader: { template: "<div><slot /></div>" },
        PreviewFrame: { template: "<div><slot /></div>" },
      },
    },
  });

const ScrollPreview = {
  template:
    "<section style='height: 1200px; width: 100%; background: linear-gradient(#fff,#ddd);'>Scrollable preview</section>",
};

const mountPickerWithRealPreviewFrame = () =>
  mount(ComponentPickerDialog, {
    props: {
      isOpen: true,
      componentOptions,
    },
    global: {
      components: {
        ScrollPreview,
      },
      stubs: {
        LazyLoader: { template: "<div><slot /></div>" },
      },
    },
  });

const timestampedComponentOptions: ComponentDefinition[] = [
  {
    id: "alpha-section",
    label: "Alpha Section",
    category: "default",
    lastUpdatedAt: "2026-06-28T08:00:00.000Z",
  },
  {
    id: "beta-section",
    label: "Beta Section",
    category: "default",
    description: "Custom component summary for editors.",
    lastUpdatedAt: "2026-06-30T08:00:00.000Z",
  },
  {
    id: "legacy-section",
    label: "Legacy Section",
    category: "default",
  },
];

describe("ComponentPickerDialog category management", () => {
  beforeEach(() => {
    categoryMock.fetchAdmin.mockClear();
    categoryMock.saveAdmin.mockClear();
    categoryMock.refs.settings.value = normalizeComponentPickerCategorySettings({
      categories: [{ id: "landing", label: "Landing", order: 0 }],
      assignments: {
        "hero-section": ["landing"],
      },
    });
    categoryMock.refs.available.value = true;
    categoryMock.refs.error.value = null;
    categoryMock.refs.saving.value = false;
  });

  it("shows custom tabs and opens admin manage mode without selecting a component", async () => {
    const wrapper = mountPicker();
    await nextTick();
    await nextTick();

    expect(wrapper.find(".component-picker-manage-button").text()).toBe("Categories");
    expect(wrapper.find('[aria-label="Desktop preview"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Mobile preview"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Sort by updated"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="Sort by name"]').exists()).toBe(true);
    expect(wrapper.findAll(".rich-tooltip")).toHaveLength(4);
    expect(wrapper.find('[aria-label="Desktop preview"]').attributes("title")).toBeUndefined();
    expect(wrapper.find('[aria-label="Mobile preview"]').attributes("title")).toBeUndefined();
    expect(wrapper.find('[aria-label="Sort by updated"]').attributes("title")).toBeUndefined();
    expect(wrapper.find('[aria-label="Sort by name"]').attributes("title")).toBeUndefined();
    expect(wrapper.find(".component-picker-density-control__label").text()).toBe(
      "Thumbs",
    );
    expect(wrapper.text()).not.toContain("Manage Categories");
    expect(wrapper.findAll(".component-picker-tab").map((tab) => tab.text())).toContain(
      "Landing",
    );

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Categories")
      ?.trigger("click");
    await nextTick();

    expect(wrapper.find(".component-picker-manage").exists()).toBe(true);
    expect(wrapper.find(".component-picker-manage-button").text()).toBe("Picker");
    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("saves draft category assignments from manage mode", async () => {
    const wrapper = mountPicker();
    await nextTick();
    await nextTick();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Categories")
      ?.trigger("click");
    await nextTick();

    const annualAssignment = wrapper
      .findAll(".component-picker-manage__assignment")
      .find((entry) => entry.text().includes("Annual Report"));
    await annualAssignment?.find("input[type='checkbox']").setValue(true);

    await wrapper.find(".component-picker-manage__save").trigger("click");
    await nextTick();

    expect(categoryMock.saveAdmin).toHaveBeenCalledTimes(1);
    expect(categoryMock.saveAdmin.mock.calls[0][0].assignments).toMatchObject({
      "hero-section": ["landing"],
      "annual-report": ["landing"],
    });
  });

  it("emits a delete event for global component cards", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const wrapper = mountPicker();
    await nextTick();
    await nextTick();

    await wrapper
      .findAll(".component-picker-tab")
      .find((tab) => tab.text() === "Global")
      ?.trigger("click");
    await nextTick();

    await wrapper.find(".delete-global-component-btn").trigger("click");

    expect(wrapper.emitted("delete-global-component")).toEqual([
      ["GlobalFooter"],
    ]);
    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("closes the picker when Escape is pressed", async () => {
    const wrapper = mountPicker();
    await nextTick();
    await nextTick();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();

    expect(wrapper.emitted("close")).toEqual([[]]);
  });

  it("sorts components by newest update timestamp by default", async () => {
    const wrapper = mountPicker(timestampedComponentOptions);
    await nextTick();
    await nextTick();

    expect(wrapper.findAll(".component-name").map((entry) => entry.text())).toEqual([
      "Beta Section",
      "Alpha Section",
      "Legacy Section",
    ]);
    expect(wrapper.findAll(".component-updated-at")).toHaveLength(2);
  });

  it("shows the update timestamp in the top-right card meta position and renders custom descriptions", async () => {
    const wrapper = mountPicker(timestampedComponentOptions);
    await nextTick();
    await nextTick();

    const betaCard = wrapper
      .findAll(".component-card")
      .find((card) => card.text().includes("Beta Section"));

    expect(betaCard).toBeTruthy();
    expect(betaCard!.find(".component-card-meta").text()).toContain("Updated");
    expect(betaCard!.find(".component-id").exists()).toBe(false);
    expect(betaCard!.find(".component-description").text()).toBe(
      "Custom component summary for editors.",
    );
  });

  it("can sort components by name while keeping older registries compatible", async () => {
    const wrapper = mountPicker(timestampedComponentOptions);
    await nextTick();
    await nextTick();

    await wrapper
      .findAll("button")
      .find((button) => button.attributes("aria-label") === "Sort by name")
      ?.trigger("click");
    await nextTick();

    expect(wrapper.findAll(".component-name").map((entry) => entry.text())).toEqual([
      "Alpha Section",
      "Beta Section",
      "Legacy Section",
    ]);

    const legacyCard = wrapper
      .findAll(".component-card")
      .find((card) => card.text().includes("Legacy Section"));
    expect(legacyCard?.find(".component-updated-at").exists()).toBe(false);
  });

  it("selects component thumbnail clicks while forwarding wheel scroll to the iframe", async () => {
    const wrapper = mountPickerWithRealPreviewFrame();
    await nextTick();
    await nextTick();
    await nextTick();

    const scrollCard = wrapper
      .findAll(".component-card")
      .find((card) => card.text().includes("Scroll Preview"));
    expect(scrollCard).toBeTruthy();

    const hitLayer = scrollCard!.find(".component-picker-preview-hit-layer");
    expect(hitLayer.exists()).toBe(true);

    const iframe = scrollCard!.find("iframe").element as HTMLIFrameElement;
    const scrollElement = document.createElement("html");
    const scrollBy = vi.fn(function scrollByMock(this: HTMLElement, options: ScrollToOptions) {
      this.scrollTop += Number(options.top ?? 0);
      this.scrollLeft += Number(options.left ?? 0);
    });
    Object.defineProperty(scrollElement, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(scrollElement, "scrollHeight", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(scrollElement, "scrollTop", {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(scrollElement, "scrollBy", {
      configurable: true,
      value: scrollBy,
    });
    Object.defineProperty(iframe, "contentDocument", {
      configurable: true,
      value: {
        scrollingElement: scrollElement,
      },
    });

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 160,
    });
    hitLayer.element.dispatchEvent(wheelEvent);

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(scrollBy).toHaveBeenCalledWith({
      left: 0,
      top: 160,
      behavior: "auto",
    });
    expect(scrollElement.scrollTop).toBe(160);
    expect(wrapper.emitted("select")).toBeUndefined();

    await hitLayer.trigger("click");

    expect(wrapper.emitted("select")).toEqual([["scroll-preview"]]);
  });
});
