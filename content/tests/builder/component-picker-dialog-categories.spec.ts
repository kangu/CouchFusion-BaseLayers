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
  {
    id: "GlobalFooter",
    label: "GlobalFooter",
    category: "global",
    previewComponentId: "footer-section",
  },
  { id: "p", label: "Paragraph", category: "basic" },
];

const mountPicker = () =>
  mount(ComponentPickerDialog, {
    props: {
      isOpen: true,
      componentOptions,
    },
    global: {
      stubs: {
        LazyLoader: { template: "<div><slot /></div>" },
        PreviewFrame: { template: "<div><slot /></div>" },
      },
    },
  });

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

    expect(wrapper.findAll(".component-picker-tab").map((tab) => tab.text())).toContain(
      "Landing",
    );

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Manage Categories")
      ?.trigger("click");
    await nextTick();

    expect(wrapper.find(".component-picker-manage").exists()).toBe(true);
    expect(wrapper.emitted("select")).toBeUndefined();
  });

  it("saves draft category assignments from manage mode", async () => {
    const wrapper = mountPicker();
    await nextTick();
    await nextTick();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Manage Categories")
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
});
