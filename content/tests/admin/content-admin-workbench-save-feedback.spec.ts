import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readLayerFile = (path: string) =>
    readFileSync(resolve(process.cwd(), path), "utf8");

describe("ContentAdminWorkbench save feedback", () => {
    it("uses the approved pulse-confirmation preset after a successful save", () => {
        const component = readLayerFile(
            "content/app/components/admin/ContentAdminWorkbench.vue",
        );

        expect(component).toContain("isSaveConfirmed");
        expect(component).toContain("showSaveConfirmedState");
        expect(component).toContain("pendingDocumentChanges");
        expect(component).toContain("pendingChangeCount");
        expect(component).toContain("pendingChangeTooltipDescription");
        expect(component).toContain("collectDocumentLeafValues");
        expect(component).toContain("content-admin-workbench__save-bar");
        expect(component).toContain("saveBarStyle");
        expect(component).toContain("isSaveBarPositioned");
        expect(component).toContain("syncSaveBarPosition");
        expect(component).toContain("workbenchRef,\n    (workbench)");
        expect(component).toContain("updateFocusedEditorSaveClearance");
        expect(component).toContain("focusedEditorNeedsSaveClearance");
        expect(component).toContain("ResizeObserver");
        expect(component).toContain('v-show="isSaveBarPositioned"');
        expect(component).toContain("ready to save");
        expect(component).toContain('placement="top"');
        expect(component).toContain("window.setTimeout");
        expect(component).toContain("1000");
        expect(component).toContain("showSaveConfirmedState();");
        expect(component).toContain(
            "content-admin-workbench__button--save-confirmed",
        );
        expect(component).toContain(
            "content-admin-workbench__button--save-pulse",
        );
        expect(component).toContain("content-admin-workbench__save-float");
        expect(component).toContain("content-admin-workbench__save-float--raised");
        expect(component).toContain(
            ".content-admin-workbench__save-float {\n    position: fixed;",
        );
        expect(component).toContain(".editor-canvas__workbench {\n    position: relative;");
        expect(component).toContain("right: 1.5rem;");
        expect(component).toContain("min-height: max(600px, calc(100dvh - 6rem));");
        expect(component).toContain("bottom: 1.5rem;");
        expect(component).toContain("bottom: 6rem;");
        expect(component).toContain("left: 1.5rem;");
        expect(component).toContain("min-height: 4.25rem;");
        expect(component).toContain('isSavePending ? "Saving…" : isSaveConfirmed ? "✓ Saved" : "Save"');
        expect(component).toContain("--save-pulse-duration: 520ms");
        expect(component).toContain("--save-pulse-scale: 1.06");
        expect(component).toContain("--save-ring-spread: 18px");
        expect(component).toContain("--save-ring-opacity: 0.73");
        expect(component).toContain("cubic-bezier(.34,1.56,.64,1)");
    });

    it("supports bounded Save-bar dragging and an icon-only discard control", () => {
        const component = readLayerFile(
            "content/app/components/admin/ContentAdminWorkbench.vue",
        );

        expect(component).toContain("saveBarCustomPosition");
        expect(component).toContain("handleSaveBarDragStart");
        expect(component).toContain("handleSaveBarDragHandleDoubleClick");
        expect(component).toContain("persistSaveBarPosition");
        expect(component).toContain("restoreSaveBarPosition");
        expect(component).toContain("SAVE_BAR_POSITION_STORAGE_KEY");
        expect(component).toContain("setPointerCapture");
        expect(component).toContain("content-admin-workbench__save-drag-grip");
        expect(component).toContain("content-admin-workbench__save-float--bouncing");
        expect(component).toContain('@dblclick="handleSaveBarDragHandleDoubleClick"');
        expect(component).toContain("const sidebarInset = 0;");
        expect(component).not.toContain("workbenchBounds.right - sidebarInset");
        expect(component).toContain("handleDiscardDocumentChanges");
        expect(component).toContain("content-admin-workbench__discard-changes");
        expect(component).toContain("isDiscardChangesConfirmOpen");
        expect(component).toContain("openDiscardChangesConfirm");
        expect(component).toContain("content-admin-workbench__discard-popover");
        expect(component).toContain('aria-label="Discard unsaved changes"');
        expect(component).toContain('viewBox="0 0 512 512"');
        expect(component).not.toContain("confirmReloadDiscard");
        expect(component).not.toContain("content-admin-workbench__save-reset-position");
    });

    it("does not present document identity or publication metadata as authored changes", () => {
        const component = readLayerFile(
            "content/app/components/admin/ContentAdminWorkbench.vue",
        );

        expect(component).toContain('const [rootKey] = path.split(".");');
        expect(component).toContain('"id",');
        expect(component).toContain('"publicationState",');
        expect(component).toContain('"stem",');
    });
});
