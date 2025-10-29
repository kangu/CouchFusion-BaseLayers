import type { AsyncComponentLoader } from "vue";
import type { MinimarkNode, MinimarkTree } from "minimark";

export interface Renderable {
    render?: (props: Record<string, unknown>) => unknown;
    ssrRender?: (props: Record<string, unknown>) => unknown;
}

export type ComponentResolver =
    | string
    | Renderable
    | AsyncComponentLoader<Renderable>
    | (() => Promise<unknown>);

export type ComponentResolverMap = Record<string, ComponentResolver>;

export interface HastNode {
    type: string;
    children?: HastNode[];
    value?: unknown;
    [key: string]: unknown;
}

export interface HastText extends HastNode {
    type: "text";
    value?: string;
}

export interface HastComment extends HastNode {
    type: "comment";
    value?: string;
}

export interface HastElement extends HastNode {
    type: "element";
    tag?: string;
    tagName?: string;
    props?: Record<string, unknown>;
    properties?: Record<string, unknown>;
}

export interface HastRoot extends HastNode {
    type: "root";
    children: HastNode[];
}

export interface MinimalTree {
    type: "minimal";
    value: MinimarkTree["value"];
}

export type MinimarkLikeTree = MinimalTree | MinimarkTree;
