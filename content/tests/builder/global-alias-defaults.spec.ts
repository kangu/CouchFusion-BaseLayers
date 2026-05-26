import { describe, expect, it } from "vitest";
import {
    applyGlobalAliasDefaultsToNode,
    applyGlobalAliasDefaultsToTree,
} from "../../app/utils/global-alias-defaults";
import type { BuilderNodeChild } from "../../app/types/builder";

const componentNode = (
    uid: string,
    component: string,
    props: Record<string, any> = {},
    children: BuilderNodeChild[] = [],
): BuilderNodeChild => ({
    uid,
    type: "component",
    component,
    props,
    children,
});

describe("global alias default hydration", () => {
    it("applies saved defaults to a newly inserted alias node immediately", () => {
        const node = componentNode("node-1", "GlobalFooter", {
            title: "Local title",
            __builderSectionId: "section-1",
        });

        const changed = applyGlobalAliasDefaultsToNode(node, {
            GlobalFooter: {
                title: "Default title",
                links: [{ label: "Home", href: "/" }],
                __builderIgnored: "ignore me",
            },
        });

        expect(changed).toBe(true);
        expect(node.props.title).toBe("Local title");
        expect(node.props.links).toEqual([{ label: "Home", href: "/" }]);
        expect(node.props.__builderSectionId).toBe("section-1");
        expect(node.props.__builderIgnored).toBeUndefined();
    });

    it("deep-clones defaults so node edits do not mutate the global registry defaults", () => {
        const defaults = {
            GlobalFooter: {
                links: [{ label: "Home", href: "/" }],
            },
        };
        const node = componentNode("node-1", "GlobalFooter");

        applyGlobalAliasDefaultsToNode(node, defaults);
        (node.props.links as Array<Record<string, string>>)[0].label = "Start";

        expect(defaults.GlobalFooter.links[0].label).toBe("Home");
    });

    it("hydrates matching aliases recursively in an existing tree", () => {
        const tree = [
            componentNode("node-1", "section", {}, [
                componentNode("node-2", "GlobalFooter"),
            ]),
        ];

        const changed = applyGlobalAliasDefaultsToTree(tree, {
            GlobalFooter: {
                title: "Footer",
            },
        });

        expect(changed).toBe(true);
        const child = (tree[0] as any).children[0];
        expect(child.props.title).toBe("Footer");
    });
});
