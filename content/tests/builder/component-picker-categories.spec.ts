import { describe, expect, it } from "vitest";
import {
  buildComponentPickerCategoryTabs,
  filterComponentPickerDefinitions,
  normalizeComponentPickerCategorySettings,
} from "../../app/utils/component-picker-categories";
import type { ComponentDefinition } from "../../app/types/builder";

const definitions: ComponentDefinition[] = [
  { id: "hero-section", label: "Hero", category: "default" },
  { id: "global-footer", label: "Global Footer", category: "global" },
  { id: "annual-report", label: "Annual Report", category: "annual-report" },
  { id: "p", label: "Paragraph", category: "basic" },
];

describe("component picker category resolution", () => {
  it("keeps generated fallback categories when no runtime settings exist", () => {
    const settings = normalizeComponentPickerCategorySettings(null);
    const tabs = buildComponentPickerCategoryTabs(definitions, settings);

    expect(tabs.map((tab) => tab.id)).toEqual([
      "all",
      "default",
      "global",
      "basic-html",
      "annual-report",
    ]);
    expect(
      filterComponentPickerDefinitions(definitions, settings, "annual-report").map(
        (definition) => definition.id,
      ),
    ).toEqual(["annual-report"]);
  });

  it("places admin custom categories after system tabs in configured order", () => {
    const settings = normalizeComponentPickerCategorySettings({
      categories: [
        { id: "landing", label: "Landing", order: 20 },
        { id: "commerce", label: "Commerce", order: 10 },
      ],
      assignments: {},
    });

    const tabs = buildComponentPickerCategoryTabs(definitions, settings);

    expect(tabs.map((tab) => tab.id)).toEqual([
      "all",
      "default",
      "global",
      "basic-html",
      "annual-report",
      "commerce",
      "landing",
    ]);
  });

  it("lets explicit admin assignments override fallback category tabs", () => {
    const settings = normalizeComponentPickerCategorySettings({
      categories: [{ id: "landing", label: "Landing", order: 0 }],
      assignments: {
        "annual-report": ["landing"],
      },
    });

    expect(
      filterComponentPickerDefinitions(definitions, settings, "annual-report").map(
        (definition) => definition.id,
      ),
    ).toEqual([]);
    expect(
      filterComponentPickerDefinitions(definitions, settings, "landing").map(
        (definition) => definition.id,
      ),
    ).toEqual(["annual-report"]);
  });

  it("shows one component in multiple custom categories", () => {
    const settings = normalizeComponentPickerCategorySettings({
      categories: [
        { id: "landing", label: "Landing", order: 0 },
        { id: "marketing", label: "Marketing", order: 1 },
      ],
      assignments: {
        "hero-section": ["landing", "marketing"],
      },
    });

    expect(
      filterComponentPickerDefinitions(definitions, settings, "landing").map(
        (definition) => definition.id,
      ),
    ).toEqual(["hero-section"]);
    expect(
      filterComponentPickerDefinitions(definitions, settings, "marketing").map(
        (definition) => definition.id,
      ),
    ).toEqual(["hero-section"]);
  });
});
