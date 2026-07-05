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
});
