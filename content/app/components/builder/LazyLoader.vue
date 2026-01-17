<template>
    <div ref="root" class="lazy-loader" :style="{ minHeight: isLoaded ? undefined : minHeight }">
        <slot v-if="isLoaded" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = withDefaults(defineProps<{
    minHeight?: string;
    rootMargin?: string;
}>(), {
    minHeight: '200px',
    rootMargin: '200px'
});

const root = ref<HTMLElement | null>(null);
const isLoaded = ref(false);
let observer: IntersectionObserver | null = null;

onMounted(() => {
    if ('IntersectionObserver' in window) {
        observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                isLoaded.value = true;
                disconnect();
            }
        }, {
            rootMargin: props.rootMargin
        });

        if (root.value) {
            observer.observe(root.value);
        }
    } else {
        // Fallback for browsers without IntersectionObserver
        isLoaded.value = true;
    }
});

const disconnect = () => {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
};

onUnmounted(() => {
    disconnect();
});
</script>

<style scoped>
.lazy-loader {
    width: 100%;
}
</style>
