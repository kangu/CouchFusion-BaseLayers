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
});
