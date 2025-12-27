<template>
    <div v-if="allowChildren" class="node-panel__children">
        <div class="node-panel__children-actions">
            <select
                :value="modelValue"
                @change="handleSelectChange"
            >
                <option disabled value="">Select component</option>
                <option
                    v-for="option in componentOptions"
                    :key="option.id"
                    :value="option.id"
                >
                    {{ option.label }}
                </option>
            </select>
            <button
                type="button"
                :disabled="!modelValue"
                @click="onAddChildComponent"
            >
                Add child component
            </button>
            <button type="button" @click="onAddChildText(nodeUid)">
                Add text child
            </button>
        </div>
        <p v-if="childHint" class="node-panel__hint">
            {{ childHint }}
        </p>
        <template v-for="child in children" :key="child.uid">
            <slot name="child" :child="child" />
        </template>
    </div>
</template>

<script setup lang="ts">
import type { BuilderNodeChild, ComponentDefinition } from "~/types/builder";

type AddChildTextHandler = (uid: string) => void;

type ChildSlotProps = {
    child: BuilderNodeChild;
};

defineSlots<{ child?: (props: ChildSlotProps) => any }>();

const props = withDefaults(
    defineProps<{
        allowChildren: boolean;
        modelValue: string;
        componentOptions: ComponentDefinition[];
        nodeUid: string;
        childHint?: string;
        children: BuilderNodeChild[];
        onAddChildComponent: () => void;
        onAddChildText: AddChildTextHandler;
    }>(),
    {
        childHint: "",
    },
);

const emit = defineEmits<{
    (event: "update:modelValue", value: string): void;
}>();

const handleSelectChange = (event: Event) => {
    emit(
        "update:modelValue",
        (event.target as HTMLSelectElement).value,
    );
};
</script>
