import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readLayerFile = (path: string) =>
    readFileSync(resolve(process.cwd(), path), "utf8");

describe("section placement preview scroll focus", () => {
    it("supports forced top alignment for inserted section focus messages", () => {
        const liveUpdates = readLayerFile(
            "content/app/composables/useContentLiveUpdates.ts",
        );
        const inlineEditor = readLayerFile(
            "content/app/components/inline/InlineLiveEditor.vue",
        );
        const workbench = readLayerFile(
            "content/app/components/builder/Workbench.vue",
        );

        expect(liveUpdates).toContain("forceScroll?: boolean");
        expect(liveUpdates).toContain("scrollBlock?: ScrollLogicalPosition");
        expect(liveUpdates).toContain("data.payload!.forceScroll === true");
        expect(liveUpdates).toContain("block: scrollBlock");
        expect(inlineEditor).toContain("forceScroll?: boolean");
        expect(inlineEditor).toContain("scrollBlock?: ScrollLogicalPosition");
        expect(inlineEditor).toContain("forceScroll");
        expect(workbench).toContain("forceScroll?: boolean");
        expect(workbench).toContain("block?: ScrollLogicalPosition");
    });

    it("always clears preview focus highlights after the flash duration", () => {
        const liveUpdates = readLayerFile(
            "content/app/composables/useContentLiveUpdates.ts",
        );

        expect(liveUpdates).toContain("let highlightedElement: HTMLElement | null = null");
        expect(liveUpdates).toContain("const clearElementShadow = (element: HTMLElement | null)");
        expect(liveUpdates).toContain("highlightedElement = null");
        expect(liveUpdates).toContain("const scheduleHighlightClear = () =>");
        expect(liveUpdates).toContain("clearElementShadow(highlightedElement)");
        expect(liveUpdates).toContain("scheduleHighlightClear()");
        expect(liveUpdates).not.toContain("if (mode !== 'flash')");
        expect(liveUpdates).not.toContain("scheduleHighlightClear(mode)");
    });

    it("shows the live preview iframe width while resizing panels", () => {
        const inlineEditor = readLayerFile(
            "content/app/components/inline/InlineLiveEditor.vue",
        );

        expect(inlineEditor).toContain("previewFrameRef");
        expect(inlineEditor).toContain("previewFrameWidth");
        expect(inlineEditor).toContain("const isDividerResizeActive = computed(");
        expect(inlineEditor).toContain("pendingDividerDrag.value || isDraggingDivider.value");
        expect(inlineEditor).toContain("updatePreviewFrameSizeLabel");
        expect(inlineEditor).toContain("inline-live-editor__resize-label");
        expect(inlineEditor).toContain('v-if="isDividerResizeActive"');
        expect(inlineEditor).not.toContain('v-if="isDraggingDivider"');
        expect(inlineEditor).toContain("Preview {{ previewFrameWidthLabel }}");
        expect(inlineEditor).toContain("position: fixed;");
        expect(inlineEditor).toContain("top: 12px;");
        expect(inlineEditor).toContain("right: 12px;");
    });
});
