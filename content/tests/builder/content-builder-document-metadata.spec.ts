import { describe, expect, it } from "vitest";
import {
    createDocumentFromTree,
    type PageConfigInput,
} from "../../app/utils/contentBuilder";

describe("content builder document metadata", () => {
    it("preserves an existing document identity and publication state", () => {
        const config = {
            id: "page-career-compass-draft",
            path: "/career-compass/draft",
            title: "Draft Career Compass",
            seoTitle: "Draft Career Compass",
            seoDescription: "A draft assessment.",
            navigation: true,
            extension: "md",
            publicationState: "draft",
        } as PageConfigInput & {
            id: string;
            publicationState: "draft";
        };

        expect(createDocumentFromTree([], config)).toMatchObject({
            id: "page-career-compass-draft",
            publicationState: "draft",
        });
    });

    it("preserves route access metadata when serializing the builder document", () => {
        const config: PageConfigInput = {
            path: "/assessment",
            title: "Assessment",
            seoTitle: "Assessment",
            seoDescription: "Assessment flow",
            navigation: false,
            extension: "md",
            meta: {
                category: "journey",
                routeAccess: {
                    mode: "entry-session",
                    allowedFrom: ["/landing"],
                    redirectTo: "/landing",
                },
            },
        };

        expect(createDocumentFromTree([], config).meta).toEqual(config.meta);
    });
});
