import { describe, expect, it } from "vitest";
import {
    summarizeArrayValue,
    summarizeNodeEditorValue,
} from "../../app/utils/node-editor-summary";
import type { ComponentArrayItemField } from "../../app/types/builder";

const fields: ComponentArrayItemField[] = [
    { key: "title", label: "Title", type: "text" },
    { key: "description", label: "Description", type: "textarea" },
    {
        key: "links",
        label: "Links",
        type: "jsonarray",
        items: [{ key: "label", label: "Label", type: "text" }],
    },
];

describe("node editor summaries", () => {
    it("trims long primitive values to a compact single line", () => {
        expect(
            summarizeNodeEditorValue(
                "Bitcoin jobs. Delivered.\nStop searching for generic crypto boards.",
                { maxLength: 34 },
            ),
        ).toBe("Bitcoin jobs. Delivered. Stop sear...");
    });

    it("summarizes object values from readable named fields", () => {
        expect(
            summarizeNodeEditorValue(
                {
                    title: "Fast setup",
                    description: "Deploy a landing page quickly",
                    links: [{ label: "Docs" }, { label: "Pricing" }],
                },
                { fields, maxLength: 80 },
            ),
        ).toBe("Title: Fast setup · Description: Deploy a landing page quickly · Links: 2 items");
    });

    it("summarizes arrays without index numbering", () => {
        expect(
            summarizeArrayValue(
                [
                    { title: "Fast setup", description: "Short" },
                    { title: "Custom theme", description: "Palette" },
                ],
                { fields, maxItems: 2, maxLength: 80 },
            ),
        ).toBe("Fast setup · Custom theme");
    });
});
