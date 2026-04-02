import { reactive, ref } from "vue";
import type { ComponentArrayItemField, ComponentPropSchema } from "~/types/builder";

type InsertDialogState = {
    key: string | null;
    type: "jsonarray" | "stringarray" | null;
    schema: ComponentPropSchema | null;
};

type ReorderDialogContext =
    | {
          kind: "top-level";
          propKey: string;
          arrayType: "jsonarray" | "stringarray";
      }
    | {
          kind: "array-field-stringarray";
          propKey: string;
          parentIndex: number;
          field: Extract<ComponentArrayItemField, { type: "stringarray" }>;
      }
    | {
          kind: "nested-jsonarray";
          propKey: string;
          parentIndex: number;
          field: Extract<ComponentArrayItemField, { type: "jsonarray" }>;
      }
    | {
          kind: "nested-stringarray";
          propKey: string;
          parentIndex: number;
          field: Extract<ComponentArrayItemField, { type: "jsonarray" }>;
          nestedIndex: number;
          nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>;
      };

type ReorderDialogState = {
    visible: boolean;
    context: ReorderDialogContext | null;
    currentIndex: number;
    newIndex: number;
    maxIndex: number;
};

type InsertPosition = { index: number; preview: string };
type NestedInsertDialogContext =
    | {
          kind: "array-field-stringarray";
          propKey: string;
          parentIndex: number;
          field: Extract<ComponentArrayItemField, { type: "stringarray" }>;
      }
    | {
          kind: "nested-jsonarray";
          propKey: string;
          parentIndex: number;
          field: Extract<ComponentArrayItemField, { type: "jsonarray" }>;
      }
    | {
          kind: "nested-stringarray";
          propKey: string;
          parentIndex: number;
          field: Extract<ComponentArrayItemField, { type: "jsonarray" }>;
          nestedIndex: number;
          nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>;
      };

type NestedInsertDialogState = {
    visible: boolean;
    key: string | null;
    type: "jsonarray" | "stringarray" | null;
    context: NestedInsertDialogContext | null;
};
type InsertFocusRequest = {
    path: Array<string | number>;
    token: number;
} | null;

type UseNodeEditorDialogsOptions = {
    propDraft: Record<string, any>;
    collapsedArrays: Record<string, boolean>;
    ensureArrayValue: (value: unknown) => Array<Record<string, any>>;
    ensureStringArray: (value: unknown) => string[];
    createEmptyArrayItem: (
        fields: ComponentArrayItemField[],
    ) => Record<string, unknown>;
    applyArrayProp: (
        key: string,
        value: unknown,
        type: "jsonarray" | "stringarray",
    ) => void;
    getArrayItemStringArrayItems: (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    ) => string[];
    getNestedArrayItems: (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    ) => Array<Record<string, any>>;
    getNestedArrayItemStringArrayItems: (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
        nestedIndex: number,
        nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    ) => string[];
    reorderArrayItems: (
        propKey: string,
        fromIndex: number,
        toIndex: number,
        type: "jsonarray" | "stringarray",
    ) => void;
    moveArrayItemStringArrayItem: (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
        fromIndex: number,
        toIndex: number,
    ) => void;
    moveNestedArrayItem: (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
        fromIndex: number,
        toIndex: number,
    ) => void;
    moveNestedArrayItemStringArrayItem: (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
        nestedIndex: number,
        nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
        fromIndex: number,
        toIndex: number,
    ) => void;
    addArrayItemStringArrayItem: (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    ) => void;
    addNestedArrayItem: (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    ) => void;
    addNestedArrayItemStringArrayItem: (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
        nestedIndex: number,
        nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    ) => void;
};

export const useNodeEditorDialogs = (options: UseNodeEditorDialogsOptions) => {
    const insertDialog = reactive<InsertDialogState>({
        key: null,
        type: null,
        schema: null,
    });

    const reorderDialog = reactive<ReorderDialogState>({
        visible: false,
        context: null,
        currentIndex: 0,
        newIndex: 1,
        maxIndex: 1,
    });
    const nestedInsertDialog = reactive<NestedInsertDialogState>({
        visible: false,
        key: null,
        type: null,
        context: null,
    });
    const insertFocusRequest = ref<InsertFocusRequest>(null);
    let insertFocusToken = 0;

    const openInsertDialog = (schema: ComponentPropSchema) => {
        if (schema.type !== "jsonarray" && schema.type !== "stringarray") {
            return;
        }
        insertDialog.key = schema.key;
        insertDialog.type = schema.type;
        insertDialog.schema = schema;
        options.collapsedArrays[schema.key] = false;
    };

    const closeInsertDialog = () => {
        insertDialog.key = null;
        insertDialog.type = null;
        insertDialog.schema = null;
    };

    const getInsertPositions = (): InsertPosition[] => {
        if (!insertDialog.key || !insertDialog.type) {
            return [];
        }
        const key = insertDialog.key;
        const type = insertDialog.type;
        const items =
            type === "jsonarray"
                ? options.ensureArrayValue(options.propDraft[key])
                : options.ensureStringArray(options.propDraft[key]);
        const positions: InsertPosition[] = [];
        const formatPreview = (value: unknown) => {
            if (type === "stringarray") {
                return String(value ?? "") || "(empty)";
            }
            if (value && typeof value === "object") {
                const entries = Object.entries(value as Record<string, unknown>);
                if (!entries.length) {
                    return "(empty object)";
                }
                return entries
                    .slice(0, 3)
                    .map(
                        ([k, v]) =>
                            `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`,
                    )
                    .join(", ");
            }
            return "(empty)";
        };

        for (let index = 0; index <= items.length; index += 1) {
            const before =
                index > 0 ? formatPreview(items[index - 1]) : "Beginning";
            const after =
                index < items.length ? formatPreview(items[index]) : "End";
            const preview = `${before} → ${after}`;
            positions.push({ index, preview });
        }
        return positions;
    };

    const handleInsertAt = (index: number) => {
        if (!insertDialog.key || !insertDialog.type) {
            return;
        }
        const key = insertDialog.key;
        const type = insertDialog.type;

        if (type === "jsonarray") {
            const schemaItems = insertDialog.schema?.items || [];
            const current = options.ensureArrayValue(options.propDraft[key]);
            const next = [...current];
            next.splice(index, 0, options.createEmptyArrayItem(schemaItems));
            options.propDraft[key] = next;
            options.collapsedArrays[key] = false;
            options.applyArrayProp(key, next, "jsonarray");
            const firstFieldKey = schemaItems[0]?.key;
            insertFocusToken += 1;
            insertFocusRequest.value = {
                path: firstFieldKey
                    ? [key, index, firstFieldKey]
                    : [key, index],
                token: insertFocusToken,
            };
        } else {
            const current = options.ensureStringArray(options.propDraft[key]);
            const next = [...current];
            next.splice(index, 0, "");
            options.propDraft[key] = next;
            options.collapsedArrays[key] = false;
            options.applyArrayProp(key, next, "stringarray");
            insertFocusToken += 1;
            insertFocusRequest.value = {
                path: [key, index],
                token: insertFocusToken,
            };
        }

        closeInsertDialog();
    };

    const openArrayItemStringArrayInsertDialog = (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    ) => {
        nestedInsertDialog.visible = true;
        nestedInsertDialog.key = `${propKey}:${parentIndex}:${field.key}`;
        nestedInsertDialog.type = "stringarray";
        nestedInsertDialog.context = {
            kind: "array-field-stringarray",
            propKey,
            parentIndex,
            field,
        };
    };

    const openNestedJsonArrayInsertDialog = (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
    ) => {
        nestedInsertDialog.visible = true;
        nestedInsertDialog.key = `${propKey}:${parentIndex}:${field.key}`;
        nestedInsertDialog.type = "jsonarray";
        nestedInsertDialog.context = {
            kind: "nested-jsonarray",
            propKey,
            parentIndex,
            field,
        };
    };

    const openNestedStringArrayInsertDialog = (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
        nestedIndex: number,
        nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
    ) => {
        nestedInsertDialog.visible = true;
        nestedInsertDialog.key = `${propKey}:${parentIndex}:${field.key}:${nestedIndex}:${nestedField.key}`;
        nestedInsertDialog.type = "stringarray";
        nestedInsertDialog.context = {
            kind: "nested-stringarray",
            propKey,
            parentIndex,
            field,
            nestedIndex,
            nestedField,
        };
    };

    const closeNestedInsertDialog = () => {
        nestedInsertDialog.visible = false;
        nestedInsertDialog.key = null;
        nestedInsertDialog.type = null;
        nestedInsertDialog.context = null;
    };

    const formatInsertPreview = (type: "jsonarray" | "stringarray", value: unknown) => {
        if (type === "stringarray") {
            return String(value ?? "") || "(empty)";
        }
        if (value && typeof value === "object") {
            const entries = Object.entries(value as Record<string, unknown>);
            if (!entries.length) {
                return "(empty object)";
            }
            return entries
                .slice(0, 3)
                .map(
                    ([k, v]) =>
                        `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`,
                )
                .join(", ");
        }
        return "(empty)";
    };

    const getNestedInsertPositions = (): InsertPosition[] => {
        if (!nestedInsertDialog.context || !nestedInsertDialog.type) {
            return [];
        }
        let items: unknown[] = [];
        const context = nestedInsertDialog.context;
        switch (context.kind) {
            case "array-field-stringarray":
                items = options.getArrayItemStringArrayItems(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                );
                break;
            case "nested-jsonarray":
                items = options.getNestedArrayItems(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                );
                break;
            case "nested-stringarray":
                items = options.getNestedArrayItemStringArrayItems(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                    context.nestedIndex,
                    context.nestedField,
                );
                break;
            default:
                break;
        }

        const positions: InsertPosition[] = [];
        for (let index = 0; index <= items.length; index += 1) {
            const before =
                index > 0
                    ? formatInsertPreview(nestedInsertDialog.type, items[index - 1])
                    : "Beginning";
            const after =
                index < items.length
                    ? formatInsertPreview(nestedInsertDialog.type, items[index])
                    : "End";
            positions.push({ index, preview: `${before} → ${after}` });
        }
        return positions;
    };

    const handleNestedInsertAt = (index: number) => {
        const context = nestedInsertDialog.context;
        if (!context) {
            return;
        }

        switch (context.kind) {
            case "array-field-stringarray": {
                const items = options.getArrayItemStringArrayItems(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                );
                const sourceIndex = items.length;
                options.addArrayItemStringArrayItem(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                );
                if (sourceIndex !== index) {
                    options.moveArrayItemStringArrayItem(
                        context.propKey,
                        context.parentIndex,
                        context.field,
                        sourceIndex,
                        index,
                    );
                }
                insertFocusToken += 1;
                insertFocusRequest.value = {
                    path: [
                        context.propKey,
                        context.parentIndex,
                        context.field.key,
                        index,
                    ],
                    token: insertFocusToken,
                };
                break;
            }
            case "nested-jsonarray": {
                const items = options.getNestedArrayItems(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                );
                const sourceIndex = items.length;
                options.addNestedArrayItem(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                );
                if (sourceIndex !== index) {
                    options.moveNestedArrayItem(
                        context.propKey,
                        context.parentIndex,
                        context.field,
                        sourceIndex,
                        index,
                    );
                }
                const firstFieldKey = context.field.items?.[0]?.key;
                insertFocusToken += 1;
                insertFocusRequest.value = {
                    path: firstFieldKey
                        ? [
                              context.propKey,
                              context.parentIndex,
                              context.field.key,
                              index,
                              firstFieldKey,
                          ]
                        : [
                              context.propKey,
                              context.parentIndex,
                              context.field.key,
                              index,
                          ],
                    token: insertFocusToken,
                };
                break;
            }
            case "nested-stringarray": {
                const items = options.getNestedArrayItemStringArrayItems(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                    context.nestedIndex,
                    context.nestedField,
                );
                const sourceIndex = items.length;
                options.addNestedArrayItemStringArrayItem(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                    context.nestedIndex,
                    context.nestedField,
                );
                if (sourceIndex !== index) {
                    options.moveNestedArrayItemStringArrayItem(
                        context.propKey,
                        context.parentIndex,
                        context.field,
                        context.nestedIndex,
                        context.nestedField,
                        sourceIndex,
                        index,
                    );
                }
                insertFocusToken += 1;
                insertFocusRequest.value = {
                    path: [
                        context.propKey,
                        context.parentIndex,
                        context.field.key,
                        context.nestedIndex,
                        context.nestedField.key,
                        index,
                    ],
                    token: insertFocusToken,
                };
                break;
            }
            default:
                break;
        }
        closeNestedInsertDialog();
    };

    const clearInsertFocusRequest = () => {
        insertFocusRequest.value = null;
    };

    const openTopLevelArrayReorderDialog = (
        propKey: string,
        arrayType: "jsonarray" | "stringarray",
        currentIndex: number,
    ) => {
        const length =
            arrayType === "jsonarray"
                ? options.ensureArrayValue(options.propDraft[propKey]).length
                : options.ensureStringArray(options.propDraft[propKey]).length;
        reorderDialog.visible = true;
        reorderDialog.context = { kind: "top-level", propKey, arrayType };
        reorderDialog.currentIndex = currentIndex;
        reorderDialog.newIndex = currentIndex + 1;
        reorderDialog.maxIndex = Math.max(length, 1);
    };

    const openArrayItemStringArrayReorderDialog = (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "stringarray" }>,
        currentIndex: number,
    ) => {
        const items = options.getArrayItemStringArrayItems(
            propKey,
            parentIndex,
            field,
        );
        reorderDialog.visible = true;
        reorderDialog.context = {
            kind: "array-field-stringarray",
            propKey,
            parentIndex,
            field,
        };
        reorderDialog.currentIndex = currentIndex;
        reorderDialog.newIndex = currentIndex + 1;
        reorderDialog.maxIndex = Math.max(items.length, 1);
    };

    const openNestedJsonArrayReorderDialog = (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
        currentIndex: number,
    ) => {
        const items = options.getNestedArrayItems(propKey, parentIndex, field);
        reorderDialog.visible = true;
        reorderDialog.context = {
            kind: "nested-jsonarray",
            propKey,
            parentIndex,
            field,
        };
        reorderDialog.currentIndex = currentIndex;
        reorderDialog.newIndex = currentIndex + 1;
        reorderDialog.maxIndex = Math.max(items.length, 1);
    };

    const openNestedStringArrayReorderDialog = (
        propKey: string,
        parentIndex: number,
        field: Extract<ComponentArrayItemField, { type: "jsonarray" }>,
        nestedIndex: number,
        nestedField: Extract<ComponentArrayItemField, { type: "stringarray" }>,
        currentIndex: number,
    ) => {
        const items = options.getNestedArrayItemStringArrayItems(
            propKey,
            parentIndex,
            field,
            nestedIndex,
            nestedField,
        );
        reorderDialog.visible = true;
        reorderDialog.context = {
            kind: "nested-stringarray",
            propKey,
            parentIndex,
            field,
            nestedIndex,
            nestedField,
        };
        reorderDialog.currentIndex = currentIndex;
        reorderDialog.newIndex = currentIndex + 1;
        reorderDialog.maxIndex = Math.max(items.length, 1);
    };

    const closeReorderDialog = () => {
        reorderDialog.visible = false;
        reorderDialog.context = null;
        reorderDialog.currentIndex = 0;
        reorderDialog.newIndex = 1;
        reorderDialog.maxIndex = 1;
    };

    const confirmReorderDialog = () => {
        if (!reorderDialog.visible || !reorderDialog.context) {
            return;
        }
        const rawIndex = Number(reorderDialog.newIndex);
        if (!Number.isFinite(rawIndex)) {
            return;
        }
        const clamped = Math.min(
            Math.max(Math.floor(rawIndex), 1),
            reorderDialog.maxIndex,
        );
        const destinationIndex = clamped - 1;
        const context = reorderDialog.context;
        switch (context.kind) {
            case "top-level":
                options.reorderArrayItems(
                    context.propKey,
                    reorderDialog.currentIndex,
                    destinationIndex,
                    context.arrayType,
                );
                break;
            case "array-field-stringarray":
                options.moveArrayItemStringArrayItem(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                    reorderDialog.currentIndex,
                    destinationIndex,
                );
                break;
            case "nested-jsonarray":
                options.moveNestedArrayItem(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                    reorderDialog.currentIndex,
                    destinationIndex,
                );
                break;
            case "nested-stringarray":
                options.moveNestedArrayItemStringArrayItem(
                    context.propKey,
                    context.parentIndex,
                    context.field,
                    context.nestedIndex,
                    context.nestedField,
                    reorderDialog.currentIndex,
                    destinationIndex,
                );
                break;
            default:
                break;
        }
        closeReorderDialog();
    };

    return {
        insertDialog,
        nestedInsertDialog,
        insertFocusRequest,
        reorderDialog,
        openInsertDialog,
        closeInsertDialog,
        getInsertPositions,
        handleInsertAt,
        openArrayItemStringArrayInsertDialog,
        openNestedJsonArrayInsertDialog,
        openNestedStringArrayInsertDialog,
        closeNestedInsertDialog,
        getNestedInsertPositions,
        handleNestedInsertAt,
        clearInsertFocusRequest,
        openTopLevelArrayReorderDialog,
        openArrayItemStringArrayReorderDialog,
        openNestedJsonArrayReorderDialog,
        openNestedStringArrayReorderDialog,
        closeReorderDialog,
        confirmReorderDialog,
    };
};
