<template>
    <div class="node-panel__margins">
        <div class="node-panel__margins-header">
            <h4>Margins</h4>
            <div class="node-panel__margins-actions">
                <button
                    type="button"
                    class="node-panel__margins-toggle"
                    @click="toggleResponsiveMargins"
                >
                    {{
                        showResponsiveMargins
                            ? "Hide responsive"
                            : "Responsive overrides"
                    }}
                </button>
                <button
                    type="button"
                    class="node-panel__margins-reset"
                    @click="resetMargins"
                >
                    Reset
                </button>
            </div>
        </div>
        <div class="node-panel__margins-grid">
            <label
                v-for="side in marginSides"
                :key="`base-${side.key}`"
                class="node-panel__margin-field"
            >
                <span>{{ side.label }}</span>
                <select
                    :value="marginDraft[side.key].base"
                    @change="
                        handleMarginChange(
                            side.key,
                            'base',
                            ($event.target as HTMLSelectElement).value,
                        )
                    "
                >
                    <option
                        v-for="option in marginOptions"
                        :key="`${side.key}-base-${option.value}`"
                        :value="option.value"
                    >
                        {{ option.label }}
                    </option>
                </select>
            </label>
        </div>
        <Transition name="fade">
            <div
                v-if="showResponsiveMargins"
                class="node-panel__margins-responsive"
            >
                <div
                    v-for="breakpoint in responsiveBreakpoints"
                    :key="breakpoint.key"
                    class="node-panel__margins-row"
                >
                    <div class="node-panel__margin-breakpoint">
                        {{ breakpoint.label }}
                    </div>
                    <div
                        class="node-panel__margins-grid node-panel__margins-grid--responsive"
                    >
                        <label
                            v-for="side in marginSides"
                            :key="`${breakpoint.key}-${side.key}`"
                            class="node-panel__margin-field"
                        >
                            <span>{{ side.short }}</span>
                            <select
                                :value="marginDraft[side.key][breakpoint.key]"
                                @change="
                                    handleMarginChange(
                                        side.key,
                                        breakpoint.key,
                                        (
                                            $event.target as HTMLSelectElement
                                        ).value,
                                    )
                                "
                            >
                                <option
                                    v-for="option in marginOptions"
                                    :key="`${side.key}-${breakpoint.key}-${option.value}`"
                                    :value="option.value"
                                >
                                    {{ option.label }}
                                </option>
                            </select>
                        </label>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup lang="ts">
type MarginSide = "top" | "right" | "bottom" | "left";
type BreakpointKey = "base" | "sm" | "md" | "lg" | "xl";

type MarginOption = { label: string; value: string };
type MarginSideOption = { key: MarginSide; label: string; short: string };
type ResponsiveBreakpoint = {
    key: BreakpointKey;
    label: string;
    short: string;
};

type MarginDraft = Record<MarginSide, Record<BreakpointKey, string>>;

type Props = {
    marginDraft: MarginDraft;
    marginOptions: MarginOption[];
    marginSides: MarginSideOption[];
    responsiveBreakpoints: ResponsiveBreakpoint[];
    showResponsiveMargins: boolean;
    handleMarginChange: (
        side: MarginSide,
        breakpoint: BreakpointKey,
        value: string,
    ) => void;
    resetMargins: () => void;
};

const props = defineProps<Props>();

const emit = defineEmits<{
    (event: "update:showResponsiveMargins", value: boolean): void;
}>();

const toggleResponsiveMargins = () => {
    emit("update:showResponsiveMargins", !props.showResponsiveMargins);
};
</script>
