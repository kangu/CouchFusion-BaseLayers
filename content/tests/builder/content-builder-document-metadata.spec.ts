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
});
