import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readLayerFile = (path: string) =>
    readFileSync(resolve(process.cwd(), path), "utf8");

describe("builder focused editor mode", () => {
    it("opens preview focus in an isolated focused editor with rollback", () => {
        const workbench = readLayerFile(
            "content/app/components/builder/Workbench.vue",
        );

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
        const workbench = readLayerFile(
            "content/app/components/builder/Workbench.vue",
        );
        const admin = readLayerFile(
            "content/app/components/admin/ContentAdminWorkbench.vue",
        );

        expect(workbench).toContain("onSaveFocusedEdit?: () => Promise<void> | void");
        expect(workbench).toContain("await props.onSaveFocusedEdit?.()");
        expect(admin).toContain(":on-save-focused-edit=\"handleFocusedEditorSave\"");
        expect(admin).toContain("async function handleFocusedEditorSave()");
        expect(workbench).toContain('"focused-edit-change"');
        expect(admin).toContain("const isFocusedEditActive = ref(false)");
        expect(admin).toContain("!isFocusedEditActive &&");
        expect(admin).toContain('class="content-admin-workbench__panel"');
        expect(admin).toContain('@focused-edit-change="');
    });

    it("keeps preview focus requests visible inside the focused editor", () => {
        const workbench = readLayerFile(
            "content/app/components/builder/Workbench.vue",
        );
        const nodeEditor = readLayerFile(
            "content/app/components/builder/NodeEditor.vue",
        );

        expect(workbench).toContain("focusedEditFocusRequest");
        expect(workbench).toContain("uidPath: [session.targetUid]");
        expect(workbench).toContain(":focus-request=\"focusedEditFocusRequest\"");
        expect(workbench).toContain("isolate-layout");
        expect(workbench).toContain('v-if="!isIsolatedEditorActive" class="builder-controls"');
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
        expect(nodeEditor).toContain("const resolveFocusGroup =");
        expect(nodeEditor).toContain("const focusedPropGroup = computed(() =>");
        expect(nodeEditor).toContain("resolveFocusGroup(prop) === activeGroup");
        expect(nodeEditor).toContain("const resolveAroundIndexes =");
        expect(nodeEditor).toContain("const visibleProps = computed(() =>");
        expect(nodeEditor).toContain("const showSupplementalEditors = computed(");
        expect(nodeEditor).toContain("isolateLayout ? '0px' : depth * 16 + 'px'");
        expect(nodeEditor).toContain(":isolate-layout=\"isolateLayout\"");
        expect(nodeEditor).toContain(":focused-prop-display=\"focusedPropDisplay\"");
    });

    it("only flashes the live preview from explicit node editor clicks", () => {
        const nodeEditor = readLayerFile(
            "content/app/components/builder/NodeEditor.vue",
        );

        expect(nodeEditor).toContain('@click="notifyPreviewFocusFromEditorClick"');
        expect(nodeEditor).toContain("const notifyPreviewFocusFromEditorClick = () =>");
        expect(nodeEditor).not.toContain('@focusin="notifyFocus"');
        expect(nodeEditor).not.toContain('@focusin="notifyPreviewFocusFromEditorClick"');
    });

    it("uses a subtle blue hover surface for node editor sections", () => {
        const nodeEditor = readLayerFile(
            "content/app/components/builder/NodeEditor.vue",
        );
        const hoverRuleIndex = nodeEditor.indexOf(
            ".node-panel:not(.node-panel--isolated):hover",
        );
        const hoverRule = nodeEditor.slice(hoverRuleIndex, hoverRuleIndex + 260);

        expect(hoverRuleIndex).toBeGreaterThanOrEqual(0);
        expect(hoverRule).toContain("background: #f8fbff;");
        expect(hoverRule).toContain("border-color: #bfdbfe;");
        expect(hoverRule).toContain("rgba(37, 99, 235");
        expect(nodeEditor).toContain("background-color 0.14s ease");
    });

    it("opens site typography and theme as focused settings editors", () => {
        const workbench = readLayerFile(
            "content/app/components/builder/Workbench.vue",
        );

        expect(workbench).toContain("isSiteTypographyEditorOpen");
        expect(workbench).toContain("isSiteThemeEditorOpen");
        expect(workbench).toContain("isIsolatedEditorActive");
        expect(workbench).toContain("openSiteTypographyPanel");
        expect(workbench).toContain("openSiteThemePanel");
        expect(workbench).toContain("cancelSiteTypographyPanel");
        expect(workbench).toContain("confirmSiteTypographyPanel");
        expect(workbench).toContain("cancelSiteThemePanel");
        expect(workbench).toContain("confirmSiteThemePanel");
        expect(workbench).toContain("Site Typography");
        expect(workbench).toContain("Site Theme");
        expect(workbench).toContain('key="site-typography"');
        expect(workbench).toContain('key="site-theme"');
        expect(workbench).toContain("!isIsolatedEditorActive");
        expect(workbench).toContain("openSiteTypographyPanel,");
        expect(workbench).toContain("openSiteThemePanel,");
        expect(workbench).not.toContain("builder-typography-toggle");
        expect(workbench).not.toContain("builder-theme-toggle");
        expect(workbench).not.toContain("Apply Fonts");
        expect(workbench).not.toContain("Apply Theme");
        expect(workbench).toContain('{{ isTypographyApplying ? "Applying..." : "OK" }}');
        expect(workbench).toContain('{{ isThemeSubmitting ? "Applying..." : "OK" }}');
    });

    it("places content search between add section controls and the section list", () => {
        const workbench = readLayerFile(
            "content/app/components/builder/Workbench.vue",
        );
        const admin = readLayerFile(
            "content/app/components/admin/ContentAdminWorkbench.vue",
        );
        const controlsIndex = workbench.indexOf('class="builder-tree__controls"');
        const searchIndex = workbench.indexOf(
            'class="builder-component-search builder-tree__search"',
        );
        const listIndex = workbench.indexOf('v-if="!builderTree.length"');
        const stickyRuleIndex = workbench.indexOf(".builder-tree__search {");
        const stickyRule = workbench.slice(stickyRuleIndex, stickyRuleIndex + 320);
        const stuckRuleIndex = workbench.indexOf(".builder-tree__search.is-stuck {");
        const stuckRule = workbench.slice(stuckRuleIndex, stuckRuleIndex + 180);
        const iconRuleIndex = workbench.indexOf(".builder-component-search__icon {");
        const iconRule = workbench.slice(iconRuleIndex, iconRuleIndex + 220);
        expect(controlsIndex).toBeGreaterThanOrEqual(0);
        expect(searchIndex).toBeGreaterThan(controlsIndex);
        expect(listIndex).toBeGreaterThan(searchIndex);
        expect(workbench).toContain('v-model="searchQuery"');
        expect(workbench).toContain('placeholder="Search through content..."');
        expect(workbench).toContain('ref="builderTreeSearchRef"');
        expect(workbench).toContain("'is-stuck': isBuilderTreeSearchSticky");
        expect(workbench).toContain("updateBuilderTreeSearchStickyState");
        expect(stickyRule).toContain("position: sticky;");
        expect(stickyRule).toContain("top: 5px;");
        expect(stickyRule).toContain("margin: 10px 0 14px;");
        expect(stuckRule).toContain("background: #f5f9ff;");
        expect(workbench).toContain(".builder-tree__search.is-stuck input");
        expect(iconRule).toContain("position: absolute;");
        expect(iconRule).toContain("width: 22px;");
        expect(iconRule).toContain("height: 22px;");
        expect(admin).not.toContain('class="builder-component-search"');
        expect(admin).not.toContain('placeholder="Search through content..."');
    });

    it("allows the workbench to expand until a 320px live preview remains", () => {
        const workbench = readLayerFile(
            "content/app/components/builder/Workbench.vue",
        );
        const pageRuleIndex = workbench.indexOf(".builder-page {");
        const pageRule = workbench.slice(pageRuleIndex, pageRuleIndex + 220);

        expect(pageRuleIndex).toBeGreaterThanOrEqual(0);
        expect(pageRule).toContain("max-width: calc(100vw - 320px);");
        expect(pageRule).not.toContain("max-width: 1200px;");
    });

    it("lets the inline builder shell expand while capping editor body content", () => {
        const inlineEditor = readLayerFile(
            "content/app/components/inline/InlineLiveEditor.vue",
        );
        const admin = readLayerFile(
            "content/app/components/admin/ContentAdminWorkbench.vue",
        );
        const editorBodyRuleIndex = admin.indexOf(
            ".content-admin-workbench__editor-body {",
        );
        const editorBodyRule = admin.slice(editorBodyRuleIndex, editorBodyRuleIndex + 260);

        expect(inlineEditor).toContain("const MIN_PREVIEW_WIDTH = 320;");
        expect(inlineEditor).toContain("let max = min;");
        expect(inlineEditor).toContain("max = Math.max(min, viewportCap);");
        expect(inlineEditor).not.toContain("const MAX_SIDEBAR_WIDTH = 720;");
        expect(editorBodyRuleIndex).toBeGreaterThanOrEqual(0);
        expect(editorBodyRule).toContain("width: min(100%, 800px);");
        expect(editorBodyRule).toContain("max-width: 800px;");
    });

    it("prevents horizontal scrolling in the inline workbench sidebar", () => {
        const inlineEditor = readLayerFile(
            "content/app/components/inline/InlineLiveEditor.vue",
        );
        const admin = readLayerFile(
            "content/app/components/admin/ContentAdminWorkbench.vue",
        );
        const sidebarRuleIndex = inlineEditor.indexOf(".inline-live-editor__sidebar {");
        const sidebarRule = inlineEditor.slice(sidebarRuleIndex, sidebarRuleIndex + 260);
        const workbenchRuleIndex = inlineEditor.indexOf(".inline-live-editor__workbench {");
        const workbenchRule = inlineEditor.slice(workbenchRuleIndex, workbenchRuleIndex + 240);
        const adminRootRuleIndex = admin.indexOf(".content-admin-workbench {");
        const adminRootRule = admin.slice(adminRootRuleIndex, adminRootRuleIndex + 260);
        const editorBodyRuleIndex = admin.indexOf(".content-admin-workbench__editor-body {");
        const editorBodyRule = admin.slice(editorBodyRuleIndex, editorBodyRuleIndex + 320);

        expect(sidebarRuleIndex).toBeGreaterThanOrEqual(0);
        expect(sidebarRule).toContain("overflow-y: auto;");
        expect(sidebarRule).toContain("overflow-x: hidden;");
        expect(workbenchRule).toContain("width: 100%;");
        expect(workbenchRule).toContain("min-width: 0;");
        expect(adminRootRule).toContain("width: 100%;");
        expect(adminRootRule).toContain("min-width: 0;");
        expect(adminRootRule).toContain("overflow-x: clip;");
        expect(editorBodyRule).toContain("align-self: stretch;");
    });
});
