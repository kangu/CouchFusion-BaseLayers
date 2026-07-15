<template>
    <span
        class="node-panel__boolean-toggle"
        :class="animationClass"
    >
        <input
            type="checkbox"
            class="node-panel__boolean-input"
            role="switch"
            :aria-label="label"
            :checked="modelValue"
            @change="handleChange"
        />
        <span
            class="node-panel__boolean-track"
            aria-hidden="true"
            @animationend="animationDirection = null"
        >
            <span class="node-panel__boolean-thumb" />
        </span>
    </span>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
    modelValue: boolean;
    label: string;
}>();

const emit = defineEmits<{
    "update:modelValue": [value: boolean];
}>();

const animationDirection = ref<"on" | "off" | null>(null);

const animationClass = computed(() =>
    animationDirection.value
        ? `is-animating--${animationDirection.value}`
        : undefined,
);

/** Applies the native checkbox value and starts its direction-specific motion. */
const handleChange = (event: Event) => {
    const checked = (event.target as HTMLInputElement).checked;
    animationDirection.value = checked ? "on" : "off";
    emit("update:modelValue", checked);
};
</script>

<style scoped>
.node-panel__boolean-toggle {
    --toggle-duration: 360ms;
    --toggle-easing: cubic-bezier(0.34, 1.56, 0.64, 1);
    --toggle-overshoot: 3px;
    --toggle-press-scale: 0.86;
    --toggle-track-width: 62px;
    --toggle-track-height: 30px;
    --toggle-thumb-size: 24px;
    --toggle-shadow-blur: 10px;
    --toggle-color-duration: 220ms;
    --toggle-thumb-gap: calc(
        (var(--toggle-track-height) - var(--toggle-thumb-size)) / 2
    );
    --toggle-thumb-travel: calc(
        var(--toggle-track-width) - var(--toggle-thumb-size) -
            (var(--toggle-thumb-gap) * 2)
    );

    position: relative;
    display: inline-flex;
    flex: 0 0 auto;
    width: var(--toggle-track-width);
    height: var(--toggle-track-height);
}

.node-panel__boolean-input {
    position: absolute;
    z-index: 2;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
}

.node-panel__boolean-track {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    overflow: visible;
    border: 1px solid rgba(107, 121, 142, 0.08);
    border-radius: 999px;
    background: #cbd3df;
    box-shadow: inset 0 1px 2px rgba(42, 55, 76, 0.11);
    pointer-events: none;
    transition:
        background-color var(--toggle-color-duration) ease,
        box-shadow var(--toggle-color-duration) ease;
}

.node-panel__boolean-thumb {
    position: absolute;
    top: var(--toggle-thumb-gap);
    left: var(--toggle-thumb-gap);
    width: var(--toggle-thumb-size);
    height: var(--toggle-thumb-size);
    border-radius: 50%;
    background: #ffffff;
    box-shadow:
        0 3px var(--toggle-shadow-blur) rgba(37, 48, 66, 0.22),
        0 1px 2px rgba(37, 48, 66, 0.16);
    transform: translateX(0) translateY(-1px) scale(1);
    will-change: transform;
}

.node-panel__boolean-input:checked + .node-panel__boolean-track {
    background: #2563eb;
    box-shadow: inset 0 1px 2px rgba(12, 45, 122, 0.22);
}

.node-panel__boolean-input:checked
    + .node-panel__boolean-track
    .node-panel__boolean-thumb {
    transform: translateX(var(--toggle-thumb-travel)) translateY(-1px) scale(1);
}

.node-panel__boolean-input:focus-visible + .node-panel__boolean-track {
    outline: 3px solid rgba(37, 99, 235, 0.24);
    outline-offset: 4px;
}

.node-panel__boolean-toggle:hover .node-panel__boolean-track {
    box-shadow:
        inset 0 1px 2px rgba(42, 55, 76, 0.13),
        0 0 0 4px rgba(37, 99, 235, 0.07);
}

.is-animating--on .node-panel__boolean-thumb {
    animation: node-boolean-on var(--toggle-duration) var(--toggle-easing) both;
}

.is-animating--off .node-panel__boolean-thumb {
    animation: node-boolean-off var(--toggle-duration) var(--toggle-easing) both;
}

@keyframes node-boolean-on {
    0% {
        transform: translateX(0) translateY(-1px) scale(1);
    }
    16% {
        transform: translateX(1px) translateY(-1px) scaleX(var(--toggle-press-scale))
            scaleY(calc(2 - var(--toggle-press-scale)));
    }
    74% {
        transform: translateX(
                calc(var(--toggle-thumb-travel) + var(--toggle-overshoot))
            )
        translateY(-1px)
            scale(1.02, 0.98);
    }
    100% {
        transform: translateX(var(--toggle-thumb-travel)) translateY(-1px) scale(1);
    }
}

@keyframes node-boolean-off {
    0% {
        transform: translateX(var(--toggle-thumb-travel)) scale(1);
    }
    16% {
        transform: translateX(calc(var(--toggle-thumb-travel) - 1px))
            scaleX(var(--toggle-press-scale))
            scaleY(calc(2 - var(--toggle-press-scale)));
    }
    74% {
        transform: translateX(calc(0px - var(--toggle-overshoot)))
            scale(1.02, 0.98);
    }
    100% {
        transform: translateX(0) scale(1);
    }
}

@media (prefers-reduced-motion: reduce) {
    .node-panel__boolean-toggle {
        --toggle-duration: 1ms;
        --toggle-overshoot: 0px;
        --toggle-press-scale: 1;
    }

    .node-panel__boolean-track {
        transition-duration: 1ms;
    }
}
</style>
