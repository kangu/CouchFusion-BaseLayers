import { reactive } from "vue";
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
        } else {
            const current = options.ensureStringArray(options.propDraft[key]);
            const next = [...current];
            next.splice(index, 0, "");
            options.propDraft[key] = next;
            options.collapsedArrays[key] = false;
            options.applyArrayProp(key, next, "stringarray");
        }

        closeInsertDialog();
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
        reorderDialog,
        openInsertDialog,
        closeInsertDialog,
        getInsertPositions,
        handleInsertAt,
        openTopLevelArrayReorderDialog,
        openArrayItemStringArrayReorderDialog,
        openNestedJsonArrayReorderDialog,
        openNestedStringArrayReorderDialog,
        closeReorderDialog,
        confirmReorderDialog,
    };
};
