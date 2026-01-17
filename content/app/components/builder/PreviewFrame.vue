<template>
    <div class="preview-frame-container" :style="{ width: typeof width === 'number' ? width + 'px' : width, height: typeof height === 'number' ? height + 'px' : height }">
        <iframe
            ref="iframeRef"
            class="preview-iframe"
            :style="{ width: typeof width === 'number' ? width + 'px' : width, height: typeof height === 'number' ? height + 'px' : height }"
        ></iframe>
        <Teleport v-if="mounted && iframeBody" :to="iframeBody">
            <div class="preview-content">
                <slot />
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick, computed } from 'vue';

const props = defineProps<{
    width: number | string;
    height: number | string;
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const mounted = ref(false);
const iframeBody = ref<HTMLElement | null>(null);

const formatSize = (val: number | string) => typeof val === 'number' ? `${val}px` : val;

const initIframe = () => {
    const iframe = iframeRef.value;
    if (!iframe) return;

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    // Open and write to document to ensure it's fresh and editable
    doc.open();
    doc.write('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>');
    doc.close();

    // Copy styles from main document
    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    styles.forEach((node) => {
        doc.head.appendChild(node.cloneNode(true));
    });

    // Add required base styles
    const style = doc.createElement('style');
    style.textContent = `
        body { 
            margin: 0; 
            padding: 0;
            overflow-y: auto; /* Allow vertical scrolling */
            width: ${formatSize(props.width)};
            height: ${formatSize(props.height)};
            background-color: white;
        }
        #app {
            width: 100%;
            min-height: 100%;
        }
    `;
    doc.head.appendChild(style);

    // Set target for Teleport
    iframeBody.value = doc.getElementById('app');
    mounted.value = true;
};

onMounted(() => {
    initIframe();
});
</script>

<style scoped>
.preview-frame-container {
    overflow: hidden;
    /* The scaling is handled by the parent via transform */
}

.preview-iframe {
    border: none;
    display: block;
    pointer-events: auto; /* Interact via parent or disable interaction */
}
</style>
