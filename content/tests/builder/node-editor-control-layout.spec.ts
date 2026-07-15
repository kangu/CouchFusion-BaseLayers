import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const richTextFieldSource = readFileSync(
    new URL(
        "../../app/components/admin/ContentRichTextField.vue",
        import.meta.url,
    ),
    "utf8",
);
const nodeEditorSource = readFileSync(
    new URL("../../app/components/builder/NodeEditor.vue", import.meta.url),
    "utf8",
);

describe("NodeEditor control layout", () => {
    it("forces rich text fields to fill their available width", () => {
        const rootRule = richTextFieldSource.match(
            /\.rich-text-field\s*\{([^}]*)\}/,
        )?.[1];

        expect(rootRule).toContain("width: 100%;");
        expect(rootRule).toContain("min-width: 0;");
    });

    it("renders native field inputs on an explicit white background", () => {
        const inputRule = nodeEditorSource.match(
            /:deep\(\.node-panel__field input\),\s*:deep\(\.node-panel__field textarea\),\s*:deep\(\.node-panel__field select\)\s*\{([^}]*)\}/,
        )?.[1];

        expect(inputRule).toContain("background: #ffffff;");
    });
});

