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

    it("animates the root add-section button before opening the picker", () => {
        const workbench = readLayerFile(
            "content/app/components/builder/Workbench.vue",
        );

        expect(workbench).toContain("openRootPickerWithAnimation");
        expect(workbench).toContain("isAddSectionButtonPlaying");
        expect(workbench).toContain("addSectionSparkles");
        expect(workbench).toContain("@click=\"openRootPickerWithAnimation\"");
        expect(workbench).toContain("builder-add-section-button__ripple");
        expect(workbench).toContain("builder-add-section-button__sparkle");
        expect(workbench).toContain("addSectionPickerTimer = setTimeout");
        expect(workbench).toContain("}, 280)");
        expect(workbench).toContain("openRootPicker();");
        expect(workbench).toContain("--duration: 440ms;");
        expect(workbench).toContain("--scale-peak: 1.08;");
        expect(workbench).toContain("--lift: -2px;");
        expect(workbench).toContain("--rotate: 90deg;");
        expect(workbench).toContain("--ripple-scale: 1.65;");
        expect(workbench).toContain("--glow: 18px;");
        expect(workbench).toContain("--sparkle-distance: 44px;");
        expect(workbench).toContain("--radius: 10px;");
        expect(workbench).toContain("--accent: #34aaf4;");
        expect(workbench).toContain("--accent-2: #abf75f;");
        expect(workbench).toContain("--ease: cubic-bezier(.2, .86, .24, 1.12);");
        expect(workbench).not.toContain("isAddSectionButtonPurple");
        expect(workbench).not.toContain("'is-purple'");
        expect(workbench).not.toContain(".builder-add-section-button.is-purple");
        expect(workbench).not.toContain("--purple-duration");
    });
});
