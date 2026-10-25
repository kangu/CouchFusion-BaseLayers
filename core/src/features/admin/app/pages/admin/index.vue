<script setup lang="ts">
import { definePageMeta } from '#imports'
import { useCouchDBAuth } from '../../../../auth-client/app/composables/useCouchDBAuth'
definePageMeta({ layout: 'admin-workspace', title: 'Overview' })
const { user } = useCouchDBAuth()
</script>
<template>
  <section data-testid="admin-overview">
    <p class="eyebrow">Workspace / Overview</p>
    <h1>
      Welcome, <span data-testid="admin-welcome-name">{{ user?.name }}</span
      >.
    </h1>
    <p class="intro">
      Your administration workspace is ready. Choose a section from the
      navigation to get started.
    </p>
    <div class="status">
      <span aria-hidden="true" class="dot" /> Signed in
      <span class="status-name">{{ user?.name }}</span>
    </div>
  </section>
</template>
<style scoped>
.eyebrow {
  font: 11px monospace;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #73796f;
}
h1 {
  font-size: clamp(28px, 4vw, 48px);
  font-weight: 450;
  letter-spacing: -0.045em;
  margin: 32px 0 14px;
  overflow-wrap: anywhere;
}
.intro {
  max-width: 540px;
  font-size: 15px;
  color: #73796f;
  line-height: 1.7;
}
.status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 48px;
  padding: 20px 0;
  border-top: 1px solid #dfe2d8;
  font-size: 12px;
}
.dot {
  width: 6px;
  height: 6px;
  background: #527341;
  border-radius: 50%;
}
.status-name {
  margin-left: auto;
  color: #73796f;
}
</style>
