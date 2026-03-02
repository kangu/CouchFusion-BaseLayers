<script setup lang="ts">
interface AnimationDraft {
    enabled: boolean;
    effect: string;
    easing: string;
    durationMs: number;
    delayMs: number;
    staggerMs: number;
    runOnce: boolean;
    triggerOnView: boolean;
}

interface Props {
    modelValue?: unknown;
    propDefinition?: {
        key?: string;
        label?: string;
    };
    fieldContext?: Record<string, unknown>;
}

const props = defineProps<Props>();
const emit = defineEmits<{
    (event: "update:modelValue", payload: AnimationDraft): void;
}>();

const DEFAULT_DRAFT: AnimationDraft = {
    enabled: false,
    effect: "fade",
    easing: "ease-out",
    durationMs: 400,
    delayMs: 0,
    staggerMs: 0,
    runOnce: true,
    triggerOnView: true,
};

const EFFECT_OPTIONS = [
    { label: "None", value: "none" },
    { label: "Fade", value: "fade" },
    { label: "Slide Up", value: "slide-up" },
    { label: "Slide Down", value: "slide-down" },
    { label: "Slide Left", value: "slide-left" },
    { label: "Slide Right", value: "slide-right" },
    { label: "Zoom In", value: "zoom-in" },
    { label: "Zoom Out", value: "zoom-out" },
];

const EASING_OPTIONS = [
    { label: "Linear", value: "linear" },
    { label: "Ease", value: "ease" },
    { label: "Ease In", value: "ease-in" },
    { label: "Ease Out", value: "ease-out" },
    { label: "Ease In Out", value: "ease-in-out" },
];

const parseInput = (raw: unknown): Partial<AnimationDraft> => {
    if (!raw) {
        return {};
    }
    if (typeof raw === "object" && !Array.isArray(raw)) {
        return raw as Partial<AnimationDraft>;
    }
    if (typeof raw === "string") {
        const trimmed = raw.trim();
        if (!trimmed) {
            return {};
        }
        const normalized = trimmed.startsWith(":")
            ? trimmed.slice(1).trim()
            : trimmed;
        try {
            const parsed = JSON.parse(normalized);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                return parsed as Partial<AnimationDraft>;
            }
        } catch {
            return {};
        }
    }
    return {};
};

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return fallback;
    }
    if (value < min) {
        return min;
    }
    if (value > max) {
        return max;
    }
    return value;
};

const normalizeDraft = (raw: unknown): AnimationDraft => {
    const input = parseInput(raw);
    return {
        enabled: Boolean(input.enabled),
        effect:
            typeof input.effect === "string"
                ? input.effect
                : DEFAULT_DRAFT.effect,
        easing:
            typeof input.easing === "string"
                ? input.easing
                : DEFAULT_DRAFT.easing,
        durationMs: clamp(input.durationMs, 1, 5000, DEFAULT_DRAFT.durationMs),
        delayMs: clamp(input.delayMs, 0, 5000, DEFAULT_DRAFT.delayMs),
        staggerMs: clamp(input.staggerMs, 0, 15000, DEFAULT_DRAFT.staggerMs),
        runOnce:
            typeof input.runOnce === "boolean"
                ? input.runOnce
                : DEFAULT_DRAFT.runOnce,
        triggerOnView:
            typeof input.triggerOnView === "boolean"
                ? input.triggerOnView
                : DEFAULT_DRAFT.triggerOnView,
    };
};

const draft = ref<AnimationDraft>(normalizeDraft(props.modelValue));

watch(
    () => props.modelValue,
    (next) => {
        draft.value = normalizeDraft(next);
    },
    { deep: true },
);

const commit = () => {
    emit("update:modelValue", { ...draft.value });
};
</script>

<template>
    <div class="animation-compact">
        <div class="animation-compact__top">
            <label class="animation-compact__switch">
                <input
                    v-model="draft.enabled"
                    type="checkbox"
                    @change="commit" />
                <span>Enabled</span>
            </label>
            <label class="animation-compact__switch">
                <input
                    v-model="draft.runOnce"
                    type="checkbox"
                    @change="commit" />
                <span>Run Once</span>
            </label>
            <label class="animation-compact__switch">
                <input
                    v-model="draft.triggerOnView"
                    type="checkbox"
                    @change="commit" />
                <span>On View</span>
            </label>
        </div>

        <div class="animation-compact__grid">
            <label class="animation-compact__field">
                <span>Effect</span>
                <select
                    v-model="draft.effect"
                    @change="commit">
                    <option
                        v-for="option in EFFECT_OPTIONS"
                        :key="option.value"
                        :value="option.value">
                        {{ option.label }}
                    </option>
                </select>
            </label>
            <label class="animation-compact__field">
                <span>Easing</span>
                <select
                    v-model="draft.easing"
                    @change="commit">
                    <option
                        v-for="option in EASING_OPTIONS"
                        :key="option.value"
                        :value="option.value">
                        {{ option.label }}
                    </option>
                </select>
            </label>
        </div>

        <div class="animation-compact__meters">
            <label class="animation-compact__meter">
                <span>Delay</span>
                <div class="animation-compact__meter-control">
                    <input
                        v-model.number="draft.delayMs"
                        type="range"
                        min="0"
                        max="5000"
                        step="10"
                        @input="commit" />
                    <input
                        v-model.number="draft.delayMs"
                        type="number"
                        min="0"
                        max="5000"
                        step="10"
                        @change="commit" />
                </div>
            </label>
            <label class="animation-compact__meter">
                <span>Duration</span>
                <div class="animation-compact__meter-control">
                    <input
                        v-model.number="draft.durationMs"
                        type="range"
                        min="1"
                        max="5000"
                        step="10"
                        @input="commit" />
                    <input
                        v-model.number="draft.durationMs"
                        type="number"
                        min="1"
                        max="5000"
                        step="10"
                        @change="commit" />
                </div>
            </label>
            <label class="animation-compact__meter">
                <span>Stagger</span>
                <div class="animation-compact__meter-control">
                    <input
                        v-model.number="draft.staggerMs"
                        type="range"
                        min="0"
                        max="15000"
                        step="10"
                        @input="commit" />
                    <input
                        v-model.number="draft.staggerMs"
                        type="number"
                        min="0"
                        max="15000"
                        step="10"
                        @change="commit" />
                </div>
            </label>
        </div>
    </div>
</template>

<style scoped>
.animation-compact {
    display: grid;
    gap: 0.65rem;
    border: 1px solid #dbe2ef;
    border-radius: 10px;
    background: #f7f9fc;
    padding: 0.65rem;
}

.animation-compact__top {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.animation-compact__switch {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    font-weight: 600;
    color: #1f2937;
}

.animation-compact__grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
}

.animation-compact__field {
    display: grid;
    gap: 0.25rem;
}

.animation-compact__field > span,
.animation-compact__meter > span {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: #4b5563;
}

.animation-compact select,
.animation-compact input[type="number"] {
    width: 100%;
    border: 1px solid #c9d4e6;
    border-radius: 7px;
    padding: 0.35rem 0.45rem;
    font-size: 0.82rem;
    background: #fff;
}

.animation-compact__meters {
    display: grid;
    gap: 0.45rem;
}

.animation-compact__meter {
    display: grid;
    gap: 0.25rem;
}

.animation-compact__meter-control {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 78px;
    gap: 0.45rem;
    align-items: center;
}

.animation-compact input[type="range"] {
    width: 100%;
    accent-color: #0086f9;
}

@media (max-width: 767px) {
    .animation-compact__grid {
        grid-template-columns: minmax(0, 1fr);
    }
}
</style>
