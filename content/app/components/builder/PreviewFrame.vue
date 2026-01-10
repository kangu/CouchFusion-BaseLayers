<template>
    <div class="preview-frame-container" :style="{ width: width + 'px', height: height + 'px' }">
        <iframe
            ref="iframeRef"
            class="preview-iframe"
            :style="{ width: width + 'px', height: height + 'px' }"
        ></iframe>
        <Teleport v-if="mounted && iframeBody" :to="iframeBody">
            <div class="preview-content">
                <slot />
            </div>
        </Teleport>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue';

const props = defineProps<{
    width: number;
    height: number;
}>();

const iframeRef = ref<HTMLIFrameElement | null>(null);
const mounted = ref(false);
const iframeBody = ref<HTMLElement | null>(null);

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
            overflow: hidden;
            width: ${props.width}px;
            height: ${props.height}px;
            background-color: white;
        }
        #app {
            width: 100%;
            height: 100%;
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
    pointer-events: none; /* Interact via parent or disable interaction */
}
</style>
