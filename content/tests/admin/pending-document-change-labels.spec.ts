import { describe, expect, it } from "vitest";
import { resolveDocumentSectionName } from "../../app/utils/pending-document-changes";

describe("pending document change labels", () => {
    it("resolves a root section name from builder metadata", () => {
        const document = {
            body: {
                type: "minimal",
                value: [
                    [
                        "content-section",
                        {
                            __builderSectionId: "intro-section",
                            background: "white",
                        },
                    ],
                ],
            },
            meta: {
                builder: {
                    sectionNamesById: {
                        "intro-section": "Intro",
                    },
                },
            },
        };

        expect(
            resolveDocumentSectionName(document, "body.value.0.1.background"),
        ).toBe("Intro");
    });
});
