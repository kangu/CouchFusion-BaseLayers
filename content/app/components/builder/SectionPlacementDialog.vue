<template>
    <div
        v-if="isOpen"
        class="section-placement-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="section-placement-dialog-title"
        @click.self="cancel"
    >
        <div class="section-placement-dialog__panel">
            <header class="section-placement-dialog__header">
                <div>
                    <span class="section-placement-dialog__eyebrow">
                        Place new section
                    </span>
                    <h3 id="section-placement-dialog-title">
                        {{ sectionName }}
                    </h3>
                    <p>
                        {{ selectedComponentLabel }}
                    </p>
                </div>
                <button
                    type="button"
                    class="section-placement-dialog__cancel"
                    aria-label="Cancel placement"
                    @click="cancel"
                >
                    &times;
                </button>
            </header>

            <div class="section-placement-dialog__body">
                <p
                    v-if="!previewEntries.length"
                    class="section-placement-dialog__empty"
                >
                    This page has no sections yet.
                </p>

                <template
                    v-for="(gap, index) in placementGaps"
                    :key="`gap-${gap.index}`"
                >
                    <button
                        type="button"
                        class="section-placement-dialog__gap"
                        :class="{
                            'section-placement-dialog__gap--suggested':
                                gap.isSuggested,
                        }"
                        :data-insert-index="String(gap.index)"
                        :data-suggested="gap.isSuggested ? 'true' : 'false'"
                        @click="insert(gap.index)"
                    >
                        <span
                            class="section-placement-dialog__gap-icon"
                            aria-hidden="true"
                        >
                            +
                        </span>
                        <span>Insert here</span>
                    </button>

                    <article
                        v-if="previewEntries[index]"
                        class="section-placement-dialog__preview"
                    >
                        <header class="section-placement-dialog__preview-header">
                            <strong>{{ previewEntries[index].label }}</strong>
                            <span>{{ previewEntries[index].componentLabel }}</span>
                        </header>
                        <div class="section-placement-dialog__preview-frame">
                            <div class="section-placement-dialog__preview-scale">
                                <Content
                                    :value="previewEntries[index].document"
                                    :global-components="globalComponents"
                                />
                            </div>
                            <div
                                class="section-placement-dialog__preview-fade"
                                aria-hidden="true"
                            />
                        </div>
                    </article>
                </template>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { BuilderNodeChild } from "~/types/builder";
import type { ContentGlobalComponentEntry } from "#content/utils/global-components";
import type { MinimalContentDocument } from "../../utils/contentBuilder";
import { Content } from "../runtime/content";

export type SectionPlacementPreviewDocument = {
    uid: string;
    document: MinimalContentDocument;
};

const props = defineProps<{
    isOpen: boolean;
    nodes: BuilderNodeChild[];
    sectionNamesByUid: Record<string, string>;
    selectedComponentLabel: string;
    sectionName: string;
    initialInsertIndex: number | null;
    serializedSectionDocuments: SectionPlacementPreviewDocument[];
    globalComponents: ContentGlobalComponentEntry[];
}>();

const emit = defineEmits<{
    (event: "insert", index: number): void;
    (event: "cancel"): void;
}>();

const documentByUid = computed(
    () =>
        new Map(
            props.serializedSectionDocuments.map((entry) => [
                entry.uid,
                entry.document,
            ]),
        ),
);

const previewEntries = computed(() =>
    props.nodes
        .map((node) => {
            const document = documentByUid.value.get(node.uid);
            if (!document) {
                return null;
            }

            return {
                uid: node.uid,
                label:
                    props.sectionNamesByUid[node.uid]?.trim() ||
                    "Unnamed section",
                componentLabel:
                    node.type === "component" ? node.component : "Text",
                document,
            };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
);

const normalizedInitialInsertIndex = computed(() => {
    if (props.initialInsertIndex === null) {
        return null;
    }
    return Math.max(
        0,
        Math.min(props.initialInsertIndex, props.nodes.length),
    );
});

const placementGaps = computed(() => {
    const count = props.nodes.length;
    return Array.from({ length: count + 1 }, (_, index) => ({
        index,
        isSuggested: normalizedInitialInsertIndex.value === index,
    }));
});

const insert = (index: number) => {
    emit("insert", index);
};

const cancel = () => {
    emit("cancel");
};
</script>

<style scoped>
.section-placement-dialog {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
    background: rgba(15, 23, 42, 0.36);
}

.section-placement-dialog__panel {
    width: min(760px, 100%);
    max-height: min(820px, calc(100vh - 36px));
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    border: 1px solid #dbe3ef;
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
}

.section-placement-dialog__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 16px 18px;
    border-bottom: 1px solid #e2e8f0;
}

.section-placement-dialog__eyebrow {
    display: block;
    margin-bottom: 4px;
    color: #2563eb;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.section-placement-dialog__header h3,
.section-placement-dialog__header p {
    margin: 0;
}

.section-placement-dialog__header h3 {
    color: #0f172a;
    font-size: 1rem;
    font-weight: 800;
    line-height: 1.25;
}

.section-placement-dialog__header p {
    margin-top: 3px;
    color: #64748b;
    font-size: 0.82rem;
}

.section-placement-dialog__cancel {
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    background: #ffffff;
    color: #334155;
    font-size: 1.3rem;
    line-height: 1;
    cursor: pointer;
}

.section-placement-dialog__body {
    min-height: 0;
    overflow: auto;
    padding: 16px 18px 18px;
}

.section-placement-dialog__empty {
    margin: 0 0 10px;
    color: #64748b;
    font-size: 0.82rem;
    text-align: center;
}

.section-placement-dialog__gap {
    width: 100%;
    min-height: 42px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px dashed #bfdbfe;
    border-radius: 10px;
    background: #f8fafc;
    color: #1d4ed8;
    font-size: 0.82rem;
    font-weight: 800;
    cursor: pointer;
    transition:
        border-color 140ms ease,
        background 140ms ease,
        box-shadow 140ms ease;
}

.section-placement-dialog__gap:hover,
.section-placement-dialog__gap:focus-visible,
.section-placement-dialog__gap--suggested {
    border-color: #2563eb;
    background: #eff6ff;
    box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.18);
}

.section-placement-dialog__gap-icon {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #dbeafe;
    color: #1d4ed8;
    font-size: 1rem;
    line-height: 1;
}

.section-placement-dialog__preview {
    margin: 10px 0;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #ffffff;
}

.section-placement-dialog__preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    border-bottom: 1px solid #e2e8f0;
    color: #0f172a;
    font-size: 0.78rem;
}

.section-placement-dialog__preview-header span {
    min-width: 0;
    overflow: hidden;
    color: #64748b;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.section-placement-dialog__preview-frame {
    --section-placement-preview-scale: 0.5;
    position: relative;
    height: 210px;
    overflow: hidden;
    background: #f8fafc;
}

.section-placement-dialog__preview-scale {
    width: calc(100% / var(--section-placement-preview-scale));
    transform: scale(var(--section-placement-preview-scale));
    transform-origin: top left;
    pointer-events: none;
    background: #ffffff;
}

.section-placement-dialog__preview-fade {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 36px;
    pointer-events: none;
    background: linear-gradient(
        to bottom,
        rgba(248, 250, 252, 0),
        #f8fafc
    );
}

@media (max-width: 720px) {
    .section-placement-dialog {
        align-items: stretch;
        padding: 10px;
    }

    .section-placement-dialog__panel {
        max-height: calc(100vh - 20px);
    }

    .section-placement-dialog__preview-frame {
        --section-placement-preview-scale: 0.42;
        height: 180px;
    }
}
</style>
