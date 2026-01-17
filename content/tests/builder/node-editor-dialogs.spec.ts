import { describe, expect, it, vi } from "vitest";
import { reactive } from "vue";
import type { ComponentArrayItemField, ComponentPropSchema } from "../../app/types/builder";
import { useNodeEditorDialogs } from "../../app/components/builder/node-editor/composables/useNodeEditorDialogs";

type DialogHarness = ReturnType<typeof createDialogHarness>;

type DialogHarnessOverrides = Partial<
    Parameters<typeof useNodeEditorDialogs>[0]
>;

const createDialogHarness = (overrides: DialogHarnessOverrides = {}) => {
    const propDraft = reactive<Record<string, any>>({});
    const collapsedArrays = reactive<Record<string, boolean>>({});
    const applyArrayProp = vi.fn();
    const reorderArrayItems = vi.fn();
    const moveArrayItemStringArrayItem = vi.fn();
    const moveNestedArrayItem = vi.fn();
    const moveNestedArrayItemStringArrayItem = vi.fn();
    const getArrayItemStringArrayItems = vi.fn().mockReturnValue([]);
    const getNestedArrayItems = vi.fn().mockReturnValue([]);
    const getNestedArrayItemStringArrayItems = vi.fn().mockReturnValue([]);
    const ensureArrayValue = (value: unknown) =>
        Array.isArray(value) ? value : [];
    const ensureStringArray = (value: unknown) =>
        Array.isArray(value) ? value.map((entry) => String(entry ?? "")) : [];
    const createEmptyArrayItem = vi.fn().mockReturnValue({ label: "New" });

    const dialogs = useNodeEditorDialogs({
        propDraft,
        collapsedArrays,
        ensureArrayValue,
        ensureStringArray,
        createEmptyArrayItem,
        applyArrayProp,
        getArrayItemStringArrayItems,
        getNestedArrayItems,
        getNestedArrayItemStringArrayItems,
        reorderArrayItems,
        moveArrayItemStringArrayItem,
        moveNestedArrayItem,
        moveNestedArrayItemStringArrayItem,
        ...overrides,
    });

    return {
        ...dialogs,
        propDraft,
        collapsedArrays,
        applyArrayProp,
        reorderArrayItems,
        moveArrayItemStringArrayItem,
        moveNestedArrayItem,
        moveNestedArrayItemStringArrayItem,
        getArrayItemStringArrayItems,
        getNestedArrayItems,
        getNestedArrayItemStringArrayItems,
        createEmptyArrayItem,
    } as const;
};

const jsonArraySchema = (
    key: string,
    items: ComponentArrayItemField[] = [],
): ComponentPropSchema => ({
    key,
    label: key,
    type: "jsonarray",
    items,
});

const stringArraySchema = (key: string): ComponentPropSchema => ({
    key,
    label: key,
    type: "stringarray",
});

describe("useNodeEditorDialogs", () => {
    it("builds insert positions for jsonarray fields", () => {
        const harness = createDialogHarness();
        const schema = jsonArraySchema("items", [
            { key: "label", label: "Label", type: "text" },
        ]);
        harness.propDraft.items = [{ label: "First" }];

        harness.openInsertDialog(schema);

        expect(harness.insertDialog.key).toBe("items");
        expect(harness.collapsedArrays.items).toBe(false);

        const positions = harness.getInsertPositions();
        expect(positions).toHaveLength(2);
        expect(positions[0].preview).toBe("Beginning → label: First");
        expect(positions[1].preview).toBe("label: First → End");
    });

    it("inserts a jsonarray item and closes the dialog", () => {
        const harness = createDialogHarness();
        const schema = jsonArraySchema("items", [
            { key: "label", label: "Label", type: "text" },
        ]);
        harness.propDraft.items = [{ label: "First" }];
        harness.createEmptyArrayItem.mockReturnValue({ label: "New" });

        harness.openInsertDialog(schema);
        harness.handleInsertAt(1);

        expect(harness.propDraft.items).toEqual([
            { label: "First" },
            { label: "New" },
        ]);
        expect(harness.applyArrayProp).toHaveBeenCalledWith(
            "items",
            harness.propDraft.items,
            "jsonarray",
        );
        expect(harness.insertDialog.key).toBeNull();
    });

    it("inserts a stringarray item and closes the dialog", () => {
        const harness = createDialogHarness();
        const schema = stringArraySchema("keywords");
        harness.propDraft.keywords = ["one", "two"];

        harness.openInsertDialog(schema);
        harness.handleInsertAt(1);

        expect(harness.propDraft.keywords).toEqual(["one", "", "two"]);
        expect(harness.applyArrayProp).toHaveBeenCalledWith(
            "keywords",
            harness.propDraft.keywords,
            "stringarray",
        );
        expect(harness.insertDialog.key).toBeNull();
    });

    it("confirms top-level reorder actions", () => {
        const harness = createDialogHarness();
        harness.propDraft.items = [{ label: "First" }, { label: "Second" }];

        harness.openTopLevelArrayReorderDialog("items", "jsonarray", 0);
        harness.reorderDialog.newIndex = 2;
        harness.confirmReorderDialog();

        expect(harness.reorderArrayItems).toHaveBeenCalledWith(
            "items",
            0,
            1,
            "jsonarray",
        );
        expect(harness.reorderDialog.visible).toBe(false);
    });

    it("confirms array field stringarray reorder actions", () => {
        const harness = createDialogHarness();
        const field = {
            key: "tags",
            label: "Tags",
            type: "stringarray",
        } as Extract<ComponentArrayItemField, { type: "stringarray" }>;
        harness.getArrayItemStringArrayItems.mockReturnValue(["a", "b"]);

        harness.openArrayItemStringArrayReorderDialog("items", 1, field, 0);
        harness.reorderDialog.newIndex = 2;
        harness.confirmReorderDialog();

        expect(harness.moveArrayItemStringArrayItem).toHaveBeenCalledWith(
            "items",
            1,
            field,
            0,
            1,
        );
        expect(harness.reorderDialog.visible).toBe(false);
    });

    it("confirms nested jsonarray reorder actions", () => {
        const harness = createDialogHarness();
        const field = {
            key: "items",
            label: "Items",
            type: "jsonarray",
            items: [],
        } as Extract<ComponentArrayItemField, { type: "jsonarray" }>;
        harness.getNestedArrayItems.mockReturnValue([{}, {}]);

        harness.openNestedJsonArrayReorderDialog("items", 2, field, 0);
        harness.reorderDialog.newIndex = 2;
        harness.confirmReorderDialog();

        expect(harness.moveNestedArrayItem).toHaveBeenCalledWith(
            "items",
            2,
            field,
            0,
            1,
        );
        expect(harness.reorderDialog.visible).toBe(false);
    });

    it("confirms nested stringarray reorder actions", () => {
        const harness = createDialogHarness();
        const field = {
            key: "items",
            label: "Items",
            type: "jsonarray",
            items: [],
        } as Extract<ComponentArrayItemField, { type: "jsonarray" }>;
        const nestedField = {
            key: "tags",
            label: "Tags",
            type: "stringarray",
        } as Extract<ComponentArrayItemField, { type: "stringarray" }>;
        harness.getNestedArrayItemStringArrayItems.mockReturnValue([
            "a",
            "b",
            "c",
        ]);

        harness.openNestedStringArrayReorderDialog(
            "items",
            0,
            field,
            1,
            nestedField,
            0,
        );
        harness.reorderDialog.newIndex = 3;
        harness.confirmReorderDialog();

        expect(harness.moveNestedArrayItemStringArrayItem).toHaveBeenCalledWith(
            "items",
            0,
            field,
            1,
            nestedField,
            0,
            2,
        );
        expect(harness.reorderDialog.visible).toBe(false);
    });
});
