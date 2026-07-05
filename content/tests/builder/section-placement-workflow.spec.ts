import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readLayerFile = (path: string) =>
    readFileSync(resolve(process.cwd(), path), "utf8");

describe("builder section placement workflow", () => {
    it("routes named root sections through the visual placement dialog", () => {
        const workbench = readLayerFile(
            "content/app/components/builder/Workbench.vue",
        );

        expect(workbench).toContain("SectionPlacementDialog");
        expect(workbench).toContain("isSectionPlacementDialogOpen");
        expect(workbench).toContain("confirmRootSectionPlacement");
        expect(workbench).toContain("serializedSectionDocuments");
        expect(workbench).toContain("previewGlobalComponents");
        expect(workbench).toContain("pendingInsertedSectionFocus");
        expect(workbench).toContain(
            "isSectionPlacementDialogOpen.value = true",
        );
        expect(workbench).toContain(
            ":global-components=\"previewGlobalComponents\"",
        );
        expect(workbench).toContain(
            "@insert=\"confirmRootSectionPlacement\"",
        );
        expect(workbench).toContain("block: \"start\"");
        expect(workbench).toContain("forceScroll: true");
    });
});
