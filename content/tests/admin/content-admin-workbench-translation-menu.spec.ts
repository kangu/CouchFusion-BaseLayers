import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = () =>
    readFileSync(
        resolve(
            process.cwd(),
            "app/components/admin/ContentAdminWorkbench.vue",
        ),
        "utf8",
    );

describe("ContentAdminWorkbench translation menu", () => {
    it("owns active locale switching in the top translation menu", () => {
        const component = source();

        expect(component).toContain("handleSelectActiveLocale(locale)");
        expect(component).toContain("content-admin-workbench__translation-locales");
        expect(component).toContain('v-for="locale in availableLocales"');
        expect(component).not.toContain('class="editor-header__locale"');
        expect(component).not.toContain("v-model=\"activeLocale\"");
    });

    it("does not render a no-language fallback action", () => {
        const component = source();

        expect(component).toContain('v-if="translationLocaleOptions.length"');
        expect(component).toContain("Translate to");
        expect(component).not.toContain("Choose new language");
        expect(component).not.toContain("No languages available");
    });
});
