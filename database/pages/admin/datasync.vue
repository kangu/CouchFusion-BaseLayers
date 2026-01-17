<script setup lang="ts">
/**
 * Admin data sync placeholder page for database tooling.
 */
definePageMeta({
    middleware: ["admin-auth"],
});
</script>

<template>
    <section class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div class="max-w-2xl">
            <h1 class="text-2xl font-semibold text-gray-900">
                Database Data Sync
            </h1>
            <p class="mt-2 text-sm text-gray-600">
                This placeholder will hold database synchronization tooling for
                admins.
            </p>
        </div>
    </section>
</template>
