import { toHast, fromHast } from "minimark/hast";
import type { MinimarkNode, MinimarkTree } from "minimark";
import { visit as minimarkVisit } from "minimark";
import type { HastRoot } from "../types";

export const decompressTree = (input: MinimarkTree): HastRoot => {
    return toHast({ type: "minimark", value: input.value }) as unknown as HastRoot;
};

export const compressTree = (root: HastRoot): MinimarkTree => {
    return fromHast(root) as MinimarkTree;
};

export const visit = (
    tree: MinimarkTree,
    checker: (node: MinimarkNode) => boolean,
    visitor: (node: MinimarkNode) => void,
) => {
    minimarkVisit({ type: "minimark", value: tree.value }, checker, visitor);
};
