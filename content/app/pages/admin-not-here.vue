<script setup lang="ts">
const pageTitle = 'Admin layout not configured'
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex items-center justify-center px-6 py-10">
    <div class="max-w-xl w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-[0_18px_45px_-30px_rgba(15,23,42,0.4)] text-center">
      <p class="text-sm font-semibold uppercase tracking-[0.15em] text-slate-400">Admin</p>
      <h1 class="mt-2 text-2xl font-semibold text-slate-900">{{ pageTitle }}</h1>
      <p class="mt-3 text-sm text-slate-600">
        This route expects an <code class="px-1 rounded bg-slate-100 text-xs">admin</code> layout from the consuming app. Please add
        <code class="px-1 rounded bg-slate-100 text-xs">layouts/admin.vue</code> to your app to replace this fallback.
      </p>
      <p class="mt-3 text-xs text-slate-500">You are seeing this message because the admin layout is missing or not loaded.</p>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'AdminFallbackPage'
}
</script>
