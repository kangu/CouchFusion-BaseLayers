<template>
    <div class="node-panel__remote-select">
        <select
            v-model="selectedValue"
            :disabled="isSelectDisabled"
        >
            <option disabled value="">
                {{ loadingLabel }}
            </option>
            <option
                v-for="option in effectiveOptions"
                :key="`${String(option.value)}-${option.label}`"
                :value="option.value"
            >
                {{ option.label }}
            </option>
        </select>
        <small v-if="errorMessage" class="node-panel__error">
            {{ errorMessage }}
        </small>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type {
    BuilderSelectOptionValue,
    ComponentArrayItemField,
    ComponentPropSchema,
    ComponentSelectOption,
} from "~/types/builder";

const props = withDefaults(
    defineProps<{
        modelValue: unknown;
        schema: ComponentPropSchema | ComponentArrayItemField;
        placeholder?: string;
        disabled?: boolean;
    }>(),
    {
        placeholder: "Select",
        disabled: false,
    },
);

const emit = defineEmits<{
    (event: "update:modelValue", value: BuilderSelectOptionValue): void;
}>();

const selectedValue = computed({
    get: () => props.modelValue as any,
    set: (value: BuilderSelectOptionValue) =>
        emit("update:modelValue", value),
});

const remoteOptions = ref<ComponentSelectOption[]>([]);
const loading = ref(false);
const errorMessage = ref("");

const staticOptions = computed<ComponentSelectOption[]>(() =>
    Array.isArray(props.schema.options) ? props.schema.options : [],
);

const remoteConfig = computed(() => {
    const config = props.schema.ui?.remoteOptions;
    if (!config || typeof config !== "object") {
        return null;
    }
    if (typeof config.url !== "string" || !config.url.trim()) {
        return null;
    }
    if (
        typeof config.labelPath !== "string" ||
        !config.labelPath.trim() ||
        typeof config.valuePath !== "string" ||
        !config.valuePath.trim()
    ) {
        return null;
    }
    return {
        url: config.url.trim(),
        itemsPath:
            typeof config.itemsPath === "string" && config.itemsPath.trim()
                ? config.itemsPath.trim()
                : "",
        labelPath: config.labelPath.trim(),
        valuePath: config.valuePath.trim(),
    };
});

const hasRemoteSource = computed(() => Boolean(remoteConfig.value));

const effectiveOptions = computed<ComponentSelectOption[]>(() =>
    hasRemoteSource.value ? remoteOptions.value : staticOptions.value,
);

const loadingLabel = computed(() =>
    loading.value ? "Loading options..." : props.placeholder,
);

const isSelectDisabled = computed(
    () => Boolean(props.disabled) || Boolean(errorMessage.value),
);

const tokenizePath = (path: string): string[] =>
    path
        .replace(/\[(\d+)\]/g, ".$1")
        .split(".")
        .map((segment) => segment.trim())
        .filter(Boolean);

const getByPath = (source: unknown, path: string): unknown => {
    if (!path) {
        return source;
    }
    const segments = tokenizePath(path);
    let current: unknown = source;
    for (const segment of segments) {
        if (current === null || current === undefined) {
            return undefined;
        }
        if (typeof current !== "object") {
            return undefined;
        }
        current = (current as Record<string, unknown>)[segment];
    }
    return current;
};

const loadRemoteOptions = async () => {
    if (!remoteConfig.value) {
        return;
    }

    loading.value = true;
    errorMessage.value = "";

    try {
        const response = await fetch(remoteConfig.value.url, {
            credentials: "include",
        });

        if (!response.ok) {
            throw new Error(`Failed to load options (${response.status})`);
        }

        const payload = await response.json();
        const candidates = remoteConfig.value.itemsPath
            ? getByPath(payload, remoteConfig.value.itemsPath)
            : payload;

        if (!Array.isArray(candidates)) {
            throw new Error("Options payload is not an array");
        }

        const mapped = candidates
            .map((candidate) => {
                const label = getByPath(candidate, remoteConfig.value!.labelPath);
                const value = getByPath(candidate, remoteConfig.value!.valuePath);
                if (
                    (typeof label !== "string" && typeof label !== "number") ||
                    (typeof value !== "string" &&
                        typeof value !== "number" &&
                        typeof value !== "boolean")
                ) {
                    return null;
                }
                return {
                    label: String(label),
                    value,
                } satisfies ComponentSelectOption;
            })
            .filter((entry): entry is ComponentSelectOption => Boolean(entry));

        remoteOptions.value = mapped;
    } catch (error: any) {
        remoteOptions.value = [];
        errorMessage.value =
            error?.message || "Failed to load remote select options.";
    } finally {
        loading.value = false;
    }
};

onMounted(async () => {
    if (!hasRemoteSource.value) {
        return;
    }
    await loadRemoteOptions();
});
</script>
