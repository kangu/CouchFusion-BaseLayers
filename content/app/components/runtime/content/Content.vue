<script lang="ts">
import {
    Fragment,
    computed,
    defineAsyncComponent,
    defineComponent,
    h,
    resolveComponent,
    toRaw,
} from "vue";
import type { AsyncComponentLoader, PropType, VNodeChild } from "vue";
import { kebabCase, pascalCase } from "./utils/case";
import { toHast } from "minimark/hast";
import type { MinimarkTree } from "minimark";
import type {
    ComponentResolverMap,
    HastElement,
    HastNode,
    HastRoot,
    HastText,
    Renderable,
} from "./types";
import { HTML_TAGS } from "./utils/htmlTags";

const renderFunctions = ["render", "ssrRender", "__ssrInlineRender"] as const;

type RenderContext = {
    tags: Record<string, unknown>;
    resolvers: ComponentResolverMap;
};

type SlotRenderer = {
    name: string;
    children: VNodeChild[];
    nestedSlots: Record<string, () => VNodeChild[]>;
};

type SlotDefinition = { __slot: SlotRenderer };

type RenderedChildren = {
    nodes: VNodeChild[];
    slots: Record<string, () => VNodeChild[]>;
};

type NodeRenderResult =
    | VNodeChild
    | VNodeChild[]
    | SlotDefinition
    | null;

const isSlotDefinition = (value: unknown): value is SlotDefinition => {
    return Boolean(
        value &&
        typeof value === "object" &&
        "__slot" in (value as Record<string, unknown>),
    );
};

function getNodeTag(node: HastElement) {
    return (
        (node.tag as string | undefined) ??
        (node.tagName as string | undefined) ??
        (node as unknown as { name?: string }).name ??
        ""
    );
}

function getNodeProps(node: HastElement) {
    const raw =
        (node.props as Record<string, unknown> | undefined) ??
        (node.properties as Record<string, unknown> | undefined) ??
        {};
    return raw;
}

function shouldIgnoreMap(node: HastElement) {
    const props = getNodeProps(node);
    return typeof props.__ignoreMap !== "undefined";
}

function mapTagName(
    tag: string,
    node: HastElement,
    tags: RenderContext["tags"],
) {
    if (!tag || shouldIgnoreMap(node)) {
        return tag;
    }

    const mapped = tags[tag] ?? tags[pascalCase(tag)] ?? tags[kebabCase(tag)];

    return mapped ?? tag;
}

function normalizeClass(value: unknown) {
    if (Array.isArray(value)) {
        return value.filter(Boolean).join(" ");
    }
    return value;
}

function normalizeProps(raw: Record<string, unknown>) {
    const props = { ...raw };
    if ("__ignoreMap" in props) {
        delete props.__ignoreMap;
    }

    if ("className" in props && !("class" in props)) {
        props.class = props.className;
    }
    if ("class" in props) {
        props.class = normalizeClass(props.class);
    }
    if ("style" in props && Array.isArray(props.style)) {
        props.style = props.style.join(";");
    }

    delete props.className;

    return props;
}

function normalizeComponent(candidate: unknown): unknown {
    if (!candidate) {
        return candidate;
    }

    if (typeof candidate === "object") {
        if (
            renderFunctions.some((fn) =>
                Object.hasOwnProperty.call(candidate, fn),
            )
        ) {
            return candidate;
        }
        if ("__asyncLoader" in (candidate as Record<string, unknown>)) {
            return candidate;
        }
        if ("setup" in (candidate as Record<string, unknown>)) {
            return defineAsyncComponent(() =>
                Promise.resolve(candidate as Renderable),
            );
        }
    }

    if (typeof candidate === "function") {
        return defineAsyncComponent(candidate as AsyncComponentLoader);
    }

    return candidate;
}

function resolveComponentReference(
    target: unknown,
    ctx: RenderContext,
): unknown {
    if (typeof target === "string") {
        const trimmed = target.trim();
        const lower = trimmed.toLowerCase();

        if (lower === "template") {
            return Fragment;
        }

        if (HTML_TAGS.has(lower)) {
            return lower;
        }

        const resolverEntry = ctx.resolvers[target];
        if (resolverEntry) {
            return resolveComponentReference(resolverEntry, ctx);
        }

        try {
            const resolved = resolveComponent(target, false);
            if (resolved && resolved !== target) {
                return normalizeComponent(resolved);
            }
        } catch {
            // ignore component resolution errors and fall back to raw tag
        }

        return target;
    }

    return normalizeComponent(target);
}

function flattenNamedSlots(
    slots: Record<string, () => VNodeChild[]>,
): VNodeChild[] {
    return Object.values(slots).flatMap((renderer) => renderer());
}

function renderChildren(
    nodes: HastNode[] | undefined,
    ctx: RenderContext,
): RenderedChildren {
    const response: RenderedChildren = {
        nodes: [],
        slots: {},
    };

    if (!nodes?.length) {
        return response;
    }

    for (const node of nodes) {
        const output = renderNode(node, ctx);

        if (output === null || typeof output === "undefined") {
            continue;
        }

        if (Array.isArray(output)) {
            response.nodes.push(...output);
            continue;
        }

        if (isSlotDefinition(output)) {
            const { name, children, nestedSlots } = output.__slot;
            response.slots[name] = () => [
                ...children,
                ...flattenNamedSlots(nestedSlots),
            ];
            continue;
        }

        response.nodes.push(output);
    }

    return response;
}

const extractSlotName = (props: Record<string, unknown>): string | null => {
    for (const key of Object.keys(props)) {
        if (key === "v-slot" || key === "slot") {
            const value = props[key];
            if (typeof value === "string" && value.trim().length > 0) {
                return value.trim();
            }
            return "default";
        }
        if (key.startsWith("v-slot:")) {
            return key.slice(7) || "default";
        }
        if (key.startsWith("#")) {
            return key.slice(1) || "default";
        }
    }
    return null;
};

function mergeChildrenAndSlots(
    rendered: RenderedChildren,
): VNodeChild[] {
    return [
        ...rendered.nodes,
        ...flattenNamedSlots(rendered.slots),
    ];
}

function renderNode(
    node: HastNode,
    ctx: RenderContext,
): NodeRenderResult {
    if (!node) {
        return null;
    }

    if (node.type === "root") {
        return mergeChildrenAndSlots(renderChildren(node.children, ctx));
    }

    if (node.type === "text") {
        return (node as HastText).value ?? "";
    }

    if (node.type === "comment") {
        return null;
    }

    if (node.type === "element") {
        const element = node as HastElement;
        const rawTag = getNodeTag(element);
        const mapped = mapTagName(rawTag, element, ctx.tags);
        const component = resolveComponentReference(mapped, ctx);
        const props = normalizeProps(getNodeProps(element));
        const isTemplate =
            typeof rawTag === "string" && rawTag.toLowerCase() === "template";

        if (isTemplate) {
            const slotName = extractSlotName(props);
            const renderedTemplate = renderChildren(element.children, ctx);

            if (!slotName) {
                return mergeChildrenAndSlots(renderedTemplate);
            }

            return {
                __slot: {
                    name: slotName,
                    children: renderedTemplate.nodes,
                    nestedSlots: renderedTemplate.slots,
                },
            };
        }

        const children = renderChildren(element.children, ctx);
        const hasDefaultChildren = children.nodes.length > 0;
        const hasNamedSlots = Object.keys(children.slots).length > 0;
        const isIntrinsic =
            typeof component === "string" || component === Fragment;

        if (!hasDefaultChildren && !hasNamedSlots) {
            return h(component as any, props);
        }

        if (isIntrinsic) {
            const intrinsicChildren = mergeChildrenAndSlots(children);
            return intrinsicChildren.length
                ? h(component as any, props, intrinsicChildren)
                : h(component as any, props);
        }

        const slotObject: Record<string, () => VNodeChild[]> = {};

        if (hasDefaultChildren) {
            slotObject.default = () => children.nodes;
        }

        for (const [name, renderer] of Object.entries(children.slots)) {
            slotObject[name] = renderer;
        }

        if (Object.keys(slotObject).length === 0) {
            return h(component as any, props);
        }

        return h(component as any, props, slotObject);
    }

    if (node.children?.length) {
        return mergeChildrenAndSlots(renderChildren(node.children, ctx));
    }

    return null;
}

export default defineComponent({
    name: "Content",
    props: {
        value: {
            type: Object as PropType<Record<string, unknown>>,
            required: true,
        },
        excerpt: {
            type: Boolean,
            default: false,
        },
        tag: {
            type: String,
            default: "div",
        },
        components: {
            type: Object as PropType<Record<string, unknown>>,
            default: () => ({}),
        },
        data: {
            type: Object as PropType<Record<string, unknown>>,
            default: () => ({}),
        },
        class: {
            type: [String, Object] as PropType<
                string | Record<string, unknown>
            >,
            default: undefined,
        },
        componentResolvers: {
            type: Object as PropType<ComponentResolverMap>,
            default: () => ({}),
        },
    },
    setup(props, { slots }) {
        const debug = import.meta.dev || import.meta.preview;

        const body = computed<HastRoot | undefined>(() => {
            const value = props.value || {};
            let contentBody =
                (value.body as Record<string, unknown> | undefined) || value;

            if (props.excerpt && "excerpt" in value && value.excerpt) {
                contentBody = value.excerpt as Record<string, unknown>;
            }

            if (
                contentBody &&
                typeof (contentBody as Record<string, unknown>).type ===
                    "string"
            ) {
                const bodyType = (contentBody as Record<string, unknown>).type;
                if (bodyType === "minimal" || bodyType === "minimark") {
                    return toHast({
                        type: "minimark",
                        value: (contentBody as { value: MinimarkTree["value"] })
                            .value,
                    }) as unknown as HastRoot;
                }
                if (
                    bodyType === "root" &&
                    Array.isArray(
                        (contentBody as { children?: unknown[] }).children,
                    )
                ) {
                    return contentBody as unknown as HastRoot;
                }
            }

            return undefined;
        });

        const isEmpty = computed(() => !body.value?.children?.length);

        const data = computed(() => {
            const { body: _body, excerpt: _excerpt, ...rest } = props.value;
            return {
                ...rest,
                ...props.data,
            };
        });

        const tags = computed(() => toRaw(props.components));
        const resolvers = computed(() => toRaw(props.componentResolvers));

        return () => {
            const ctx: RenderContext = {
                tags: (tags.value || {}) as Record<string, unknown>,
                resolvers: (resolvers.value || {}) as ComponentResolverMap,
            };

            if (!body.value || isEmpty.value) {
                const slotProps = {
                    body: body.value,
                    data: data.value,
                    "data-content-id": debug
                        ? (props.value as Record<string, unknown>).id
                        : undefined,
                };
                return slots.empty ? slots.empty(slotProps) : null;
            }

            const rootChildren = renderChildren(body.value.children, ctx);
            const renderedRootChildren = mergeChildrenAndSlots(rootChildren);
            const rootProps: Record<string, unknown> = {};
            if (props.class !== undefined) {
                rootProps.class = props.class;
            }
            if (debug && (props.value as Record<string, unknown>).id) {
                rootProps["data-content-id"] = (
                    props.value as Record<string, unknown>
                ).id;
            }

            return renderedRootChildren.length
                ? h(props.tag, rootProps, renderedRootChildren)
                : h(props.tag, rootProps);
        };
    },
});
</script>
