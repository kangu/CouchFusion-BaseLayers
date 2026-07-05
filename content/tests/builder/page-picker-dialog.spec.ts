import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readLayerFile = (path: string) =>
    readFileSync(resolve(process.cwd(), path), "utf8");

describe("builder page picker dialog", () => {
    it("moves page search behind the current URL trigger", () => {
        const admin = readLayerFile(
            "content/app/components/admin/ContentAdminWorkbench.vue",
        );

        expect(admin).toContain("isPagePickerOpen");
        expect(admin).toContain("pagePickerSearchInputRef");
        expect(admin).toContain("openPagePicker");
        expect(admin).toContain("closePagePicker");
        expect(admin).toContain("filteredPagePickerPages");
        expect(admin).toContain("openPageFromPicker");
        expect(admin).toContain("pagePickerTooltip");
        expect(admin).toContain('const title = computed(() => props.title ?? "...")');
        expect(admin).toContain("content-admin-workbench__path-trigger");
        expect(admin).toContain("content-admin-workbench__path-caret");
        expect(admin).toContain(':title="pagePickerTooltip"');
        expect(admin.indexOf('{{ isSavePending ? "Saving…" : "Save" }}')).toBeLessThan(
            admin.indexOf("content-admin-workbench__path-trigger"),
        );
        expect(admin).toContain("content-admin-workbench__page-picker");
        expect(admin).toContain("Search by URL, title, SEO title, or description");
        expect(admin).toContain("pagePickerSearchInputRef.value?.focus()");
        expect(admin).toContain("@click=\"openPageFromPicker(page.path)\"");
        expect(admin).toContain("@keyup.enter=\"openPageFromPicker(page.path)\"");
        expect(admin).toContain("openPageForEditing(path)");
        expect(admin).toContain("if (selectedPath.value === normalizedPath)");
        expect(admin).toContain("return false");
        expect(admin).toContain("isPagePickerOpen.value = false");
        expect(admin).toContain("aria-label=\"Open page picker\"");
        expect(admin).toContain("aria-label=\"Close page picker\"");
        expect(admin).toContain(
            'd="m6.4 18.308l-.708-.708l5.6-5.6l-5.6-5.6l.708-.708l5.6 5.6l5.6-5.6l.708.708l-5.6 5.6l5.6 5.6l-.708.708l-5.6-5.6z"',
        );
        expect(admin).not.toContain("Updated {{ lastUpdatedDisplay }}");
        expect(admin).not.toContain("editor-header__status-time");
        expect(admin).not.toContain("Save Changes");
        expect(admin).not.toContain("content-admin-workbench__path-helper");
        expect(admin).not.toContain('props.title ?? "Content Builder"');
        expect(admin).not.toContain("content-admin-pages-datalist");
        expect(admin).not.toContain("@change=\"handlePageSearchChange\"");
        expect(admin).not.toContain("content-admin-workbench__editor-header");
        expect(admin).not.toContain("content-admin-workbench__sentinel");
        expect(admin).not.toContain("headerFixedStyles");
        expect(admin).not.toContain("isHeaderPinned");
        expect(admin).not.toContain("headerPlaceholderHeight");
    });

    it("moves workbench actions to the top-right header menu", () => {
        const admin = readLayerFile(
            "content/app/components/admin/ContentAdminWorkbench.vue",
        );

        expect(admin).toContain("actionsMenuRef");
        expect(admin).toContain("handleCreatePageFromActionsMenu");
        expect(admin).toContain("handleSiteTypographyFromActionsMenu");
        expect(admin).toContain("handleSiteThemeFromActionsMenu");
        expect(admin).toContain("builderRef.value?.openSiteTypographyPanel()");
        expect(admin).toContain("builderRef.value?.openSiteThemePanel()");
        expect(admin).toContain("content-admin-workbench__actions-menu");
        expect(admin).toContain("content-admin-workbench__actions-trigger");
        expect(admin).toContain("content-admin-workbench__actions-dropdown");
        expect(admin).toContain(
            "content-admin-workbench__button--muted content-admin-workbench__actions-trigger",
        );
        expect(admin).toContain("aria-label=\"Open actions menu\"");
        expect(admin).not.toContain("<span>Actions</span>");
        expect(admin).toContain("content-admin-workbench__history-menu");
        expect(admin).toContain("content-admin-workbench__history-trigger");
        expect(admin).toContain("content-admin-workbench__history-dropdown");
        expect(admin).toContain("aria-label=\"History\"");
        expect(admin).toContain(".content-admin-workbench__translation-trigger {\n    min-width: 2.5rem;");
        expect(admin).toContain(".content-admin-workbench__history-trigger {\n    min-width: 2.5rem;");
        expect(admin).not.toContain(".content-admin-workbench__translation-trigger .content-admin-workbench__icon");
        expect(admin).toContain('viewBox="0 0 16 16"');
        expect(admin).toContain(
            'd="M7.5 3a.5.5 0 0 1 .5.5v5.21l3.248 1.856a.5.5 0 0 1-.496.868l-3.5-2A.5.5 0 0 1 7 9V3.5a.5.5 0 0 1 .5-.5"',
        );
        expect(admin).toContain("New Page");
        expect(admin).toContain("Site Typography");
        expect(admin).toContain("Site Theme");
        expect(admin).toContain("Duplicate");
        expect(admin).toContain("Translate");
        expect(admin).toContain("Render Animations");
        expect(admin).toContain(":class=\"{ 'is-on': forcePreviewMotion }\"");
        expect(admin).not.toContain("Keep Animations Running");
        expect(admin).not.toContain(
            ".content-admin-workbench__actions-item--toggle > span:first-child",
        );
        expect(admin).toContain("Delete");
        expect(admin.indexOf("content-admin-workbench__translation-menu")).toBeLessThan(
            admin.indexOf("content-admin-workbench__history-menu"),
        );
        expect(admin.indexOf("content-admin-workbench__history-menu")).toBeLessThan(
            admin.indexOf("content-admin-workbench__actions-menu"),
        );
        expect(admin).not.toContain("editor-header__history-button");
        expect(admin).not.toContain("editor-header__history-dropdown");
        expect(admin).not.toContain("Open save actions menu");
        expect(admin).not.toContain("editor-header__actions-dropdown");
        expect(admin).not.toContain("editor-header__actions-item");
    });
});
