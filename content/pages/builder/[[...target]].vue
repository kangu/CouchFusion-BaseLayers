<script setup lang="ts">
import { computed, ref } from "vue";
import InlineLiveEditor from "#content/app/components/inline/InlineLiveEditor.vue";

definePageMeta({
    layout: false,
    middleware: ["auth"],
});

const runtimeConfig = useRuntimeConfig();
const route = useRoute();

const previewBaseUrl = ref<string | null>(null);

if (import.meta.server) {
    const configured =
        runtimeConfig.public?.siteUrl || runtimeConfig.public?.siteURL;
    previewBaseUrl.value =
        typeof configured === "string" && configured.trim()
            ? configured.trim()
            : null;
}

if (import.meta.client) {
    previewBaseUrl.value = window.location.origin;
    console.info(
        "[content-layer] builder preview base url set to",
        previewBaseUrl.value,
    );
}

const normalizedSegments = computed<string[]>(() => {
    const param = route.params.target;
    if (!param) {
        return [];
    }
    if (Array.isArray(param)) {
        return param
            .filter((segment): segment is string => typeof segment === "string")
            .map((segment) => segment.trim())
            .filter((segment) => segment.length > 0);
    }
    if (typeof param === "string" && param.trim().length > 0) {
        return [param.trim()];
    }
    return [];
});

const initialPath = computed(() => {
    if (normalizedSegments.value.length === 0) {
        return "/";
    }
    return `/${normalizedSegments.value.join("/")}`;
});
</script>

<template>
    <InlineLiveEditor
        :preview-base-url="previewBaseUrl"
        :initial-path="initialPath"
        iframe-title="Content builder live preview"
    />
</template>
