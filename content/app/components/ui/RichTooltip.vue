<template>
    <span
        ref="triggerRef"
        class="rich-tooltip"
        @mouseenter="open"
        @mouseleave="close"
        @focusin="open"
        @focusout="close"
        @keydown.esc="close"
    >
        <slot :describedby="tooltipId" />
    </span>
    <Teleport to="body">
        <div
            :id="tooltipId"
            ref="tooltipRef"
            class="rich-tooltip__bubble"
            :class="[`rich-tooltip__bubble--${effectivePlacement}`, { 'is-open': isOpen }]"
            :style="tooltipStyle"
            role="tooltip"
            :aria-hidden="isOpen ? 'false' : 'true'"
        >
            <div class="rich-tooltip__content">
                <strong class="rich-tooltip__title">{{ title }}</strong>
                <span v-if="description" class="rich-tooltip__description">
                    {{ description }}
                </span>
                <span v-if="shortcut" class="rich-tooltip__shortcut">{{ shortcut }}</span>
            </div>
        </div>
    </Teleport>
</template>

<script lang="ts">
let tooltipCounter = 0;
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import type { CSSProperties } from "vue";

defineOptions({
    name: "RichTooltip",
});

type TooltipPlacement = "top" | "bottom";

const props = withDefaults(
    defineProps<{
        title: string;
        description?: string;
        shortcut?: string;
        placement?: TooltipPlacement;
        maxWidth?: number;
    }>(),
    {
        description: "",
        shortcut: "",
        placement: "bottom",
        maxWidth: 260,
    },
);

const tooltipId = `rich-tooltip-${++tooltipCounter}`;
const triggerRef = ref<HTMLElement | null>(null);
const tooltipRef = ref<HTMLElement | null>(null);
const isOpen = ref(false);
let listenersAttached = false;
const effectivePlacement = ref<TooltipPlacement>(props.placement);
const position = ref({
    top: 0,
    left: 0,
});

const tooltipStyle = computed<CSSProperties>(() => ({
    maxWidth: `${props.maxWidth}px`,
    top: `${position.value.top}px`,
    left: `${position.value.left}px`,
}));

const canUseViewport = () => typeof window !== "undefined" && typeof document !== "undefined";

const updatePosition = () => {
    if (!canUseViewport() || !triggerRef.value || !tooltipRef.value) {
        return;
    }

    const triggerRect = triggerRef.value.getBoundingClientRect();
    const tooltipRect = tooltipRef.value.getBoundingClientRect();
    const gap = 10;
    const viewportPadding = 12;
    const requestedPlacement = props.placement;
    const hasRoomAbove = triggerRect.top >= tooltipRect.height + gap + viewportPadding;
    const hasRoomBelow =
        window.innerHeight - triggerRect.bottom >= tooltipRect.height + gap + viewportPadding;

    if (requestedPlacement === "top" && hasRoomAbove) {
        effectivePlacement.value = "top";
    } else if (requestedPlacement === "bottom" && hasRoomBelow) {
        effectivePlacement.value = "bottom";
    } else {
        effectivePlacement.value = hasRoomAbove && !hasRoomBelow ? "top" : "bottom";
    }

    const rawLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const minLeft = viewportPadding;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - tooltipRect.width - viewportPadding);
    const top =
        effectivePlacement.value === "top"
            ? triggerRect.top - tooltipRect.height - gap
            : triggerRect.bottom + gap;

    position.value = {
        top: Math.max(viewportPadding, top),
        left: Math.min(Math.max(rawLeft, minLeft), maxLeft),
    };
};

const addViewportListeners = () => {
    if (!canUseViewport()) {
        return;
    }

    if (listenersAttached) {
        return;
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    listenersAttached = true;
};

const removeViewportListeners = () => {
    if (!canUseViewport()) {
        return;
    }

    if (!listenersAttached) {
        return;
    }

    window.removeEventListener("resize", updatePosition);
    window.removeEventListener("scroll", updatePosition, true);
    listenersAttached = false;
};

const open = async () => {
    if (isOpen.value) {
        updatePosition();
        return;
    }

    isOpen.value = true;
    await nextTick();
    updatePosition();
    addViewportListeners();
};

const close = () => {
    isOpen.value = false;
    removeViewportListeners();
};

onBeforeUnmount(() => {
    close();
});
</script>

<style scoped>
.rich-tooltip {
    display: inline-flex;
    align-items: center;
}

.rich-tooltip__bubble {
    position: fixed;
    z-index: 10000;
    pointer-events: none;
    opacity: 0;
    transform: translateY(-2px) scale(0.98);
    transform-origin: center top;
    transition:
        opacity 0.14s ease,
        transform 0.14s ease;
}

.rich-tooltip__bubble.is-open {
    opacity: 1;
    transform: translateY(0) scale(1);
}

.rich-tooltip__bubble--top {
    transform-origin: center bottom;
}

.rich-tooltip__content {
    display: grid;
    gap: 4px;
    border: 1px solid rgba(148, 163, 184, 0.32);
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.96);
    box-shadow: 0 14px 38px rgba(15, 23, 42, 0.2);
    color: #f8fafc;
    padding: 9px 10px;
    font-size: 0.78rem;
    line-height: 1.3;
}

.rich-tooltip__title {
    color: #ffffff;
    font-size: 0.8rem;
    font-weight: 750;
    letter-spacing: 0;
}

.rich-tooltip__description {
    color: #cbd5e1;
    white-space: pre-line;
}

.rich-tooltip__shortcut {
    justify-self: start;
    margin-top: 2px;
    border-radius: 6px;
    background: rgba(248, 250, 252, 0.12);
    color: #e2e8f0;
    padding: 2px 6px;
    font-size: 0.68rem;
    font-weight: 700;
}
</style>
