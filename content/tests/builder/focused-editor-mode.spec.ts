import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readLayerFile = (path: string) =>
    readFileSync(resolve(process.cwd(), path), "utf8");

describe("builder focused editor mode", () => {
    it("opens preview focus in an isolated focused editor with rollback", () => {
        const workbench = readLayerFile("app/components/builder/Workbench.vue");

        expect(workbench).toContain("focusedEditSession");
        expect(workbench).toContain("focusedEditDisplayTitle");
        expect(workbench).toContain("openFocusedEditSession");
        expect(workbench).toContain("cancelFocusedEditSession");
        expect(workbench).toContain("confirmFocusedEditSession");
        expect(workbench).toContain("restoreTreeFocusAfterFocusedEdit");
        expect(workbench).toContain("applyTreeFocusRequest");
        expect(workbench).toContain("waitForFocusedTreeSettle");
        expect(workbench).toContain("focusedEditSnapshot");
        expect(workbench).toContain("loadDocument(focusedEditSession.value.snapshot)");
        expect(workbench).toContain("void restoreTreeFocusAfterFocusedEdit(session)");
        expect(workbench).toContain("builder-focused-editor");
        expect(workbench).toContain('name="builder-focused-editor"');
    });

    it("uses the app save path from the focused editor save bar", () => {
        const workbench = readLayerFile("app/components/builder/Workbench.vue");
        const admin = readLayerFile(
            "app/components/admin/ContentAdminWorkbench.vue",
        );

        expect(workbench).toContain("onSaveFocusedEdit?: () => Promise<void> | void");
        expect(workbench).toContain("await props.onSaveFocusedEdit?.()");
        expect(admin).toContain(":on-save-focused-edit=\"handleFocusedEditorSave\"");
        expect(admin).toContain("async function handleFocusedEditorSave()");
        expect(workbench).toContain('"focused-edit-change"');
        expect(admin).toContain("const isFocusedEditActive = ref(false)");
        expect(admin).toContain('v-if="!isFocusedEditActive" class="content-admin-workbench__panel"');
        expect(admin).toContain('@focused-edit-change="');
    });

    it("keeps preview focus requests visible inside the focused editor", () => {
        const workbench = readLayerFile("app/components/builder/Workbench.vue");
        const nodeEditor = readLayerFile(
            "app/components/builder/NodeEditor.vue",
        );

        expect(workbench).toContain("focusedEditFocusRequest");
        expect(workbench).toContain("uidPath: [session.targetUid]");
        expect(workbench).toContain(":focus-request=\"focusedEditFocusRequest\"");
        expect(workbench).toContain("isolate-layout");
        expect(workbench).toContain('v-if="!focusedEditSession" class="builder-controls"');
        expect(workbench).toContain("focusedShowFieldsAround");
        expect(workbench).toContain("focusedShowAllFields");
        expect(workbench).toContain(":focused-prop-display=\"focusedPropDisplay\"");
        expect(workbench).toContain("flex-wrap: nowrap;");
        expect(workbench).toContain("min-width: 82px;");
        expect(nodeEditor).toContain("{ immediate: true }");
        expect(nodeEditor).toContain(
            "!props.focusRequest?.uidPath.includes(props.node.uid)",
        );
        expect(nodeEditor).toContain("waitForFocusTarget");
        expect(nodeEditor).toContain("focusedPropDisplay?: \"active\" | \"around\" | \"all\"");
        expect(nodeEditor).toContain("node.type === 'component' && !isolateLayout");
        expect(workbench).toContain('{{ isFocusedEditSaving ? "Saving..." : "OK" }}');
        expect(nodeEditor).toContain("const visibleProps = computed(() =>");
        expect(nodeEditor).toContain("const showSupplementalEditors = computed(");
        expect(nodeEditor).toContain("isolateLayout ? '0px' : depth * 16 + 'px'");
        expect(nodeEditor).toContain(":isolate-layout=\"isolateLayout\"");
        expect(nodeEditor).toContain(":focused-prop-display=\"focusedPropDisplay\"");
    });
});
