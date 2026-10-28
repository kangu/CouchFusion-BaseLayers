<script setup lang="ts">
import { computed } from 'vue'
import { definePageMeta, useAsyncData, useRequestFetch } from '#imports'
import { useCouchDBAuth } from '../../../../auth-client/app/composables/useCouchDBAuth'
definePageMeta({ layout: 'admin-workspace', title: 'Overview' })

interface Person {
  name: string
  roles: string[]
}
const auth = useCouchDBAuth()
const requestFetch = useRequestFetch()
const user = computed(() => auth.user.value)
const adminRoles = computed(() => auth.settings.value?.admin.roles ?? [])
const siteName = computed(
  () => auth.settings.value?.admin.siteName || auth.settings.value?.admin.brandName || 'this workspace',
)

const { data, error, status, refresh } = useAsyncData('couchdb-admin-people', () =>
  requestFetch<{ users: Person[] }>('/api/couchdb/admin/users'),
)
const people = computed(() => data.value?.users ?? [])
const isAdmin = (p: Person) => p.roles.some((r) => adminRoles.value.includes(r))
const counts = computed(() => {
  const all = people.value
  const admins = all.filter(isAdmin).length
  const noRole = all.filter((p) => !p.roles.length).length
  return { all: all.length, admins, other: all.length - admins - noRole, noRole }
})
const shown = computed(() =>
  [...people.value]
    .sort((a, b) => Number(isAdmin(b)) - Number(isAdmin(a)) || a.name.localeCompare(b.name))
    .slice(0, 8),
)
const loading = computed(() => status.value === 'pending' && !data.value)
const tints = ['#e8eef7', '#f6e9e4', '#e6f2ea', '#f3eadf', '#ece8f5', '#e4f0f3', '#f5e6ee', '#eef0e2']
const tint = (name: string) => tints[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % tints.length]
const kpis = computed(() => [
  { label: 'People', value: counts.value.all, note: 'can sign in' },
  { label: 'Admins', value: counts.value.admins, note: `with ${adminRoles.value.join(' or ') || 'an admin role'}` },
  { label: 'Other roles', value: counts.value.other, note: 'site or module roles' },
  { label: 'No role', value: counts.value.noRole, note: counts.value.noRole ? 'cannot open this workspace' : 'everyone has a role' },
])
</script>
<template>
  <section class="cf-page" data-testid="admin-overview">
    <div class="cf-title-row">
      <div>
        <h1>Overview</h1>
        <p>
          Signed in to {{ siteName }} as
          <b data-testid="admin-welcome-name">{{ user?.name }}</b>
          <template v-if="user?.roles.length"> with {{ user.roles.length > 1 ? 'the roles' : 'the role' }} {{ user.roles.join(', ') }}</template>.
        </p>
      </div>
    </div>

    <div class="cf-kpis" aria-label="People with access">
      <div v-for="k in kpis" :key="k.label" class="cf-kpi">
        <div class="cf-kpi-label">{{ k.label }}</div>
        <div class="cf-kpi-value">
          <span v-if="loading" class="cf-skeleton" />
          <span v-else-if="error" class="cf-muted">—</span>
          <template v-else>{{ k.value }}</template>
        </div>
        <div class="cf-kpi-note">{{ k.note }}</div>
      </div>
    </div>

    <div class="cf-grid">
      <section class="cf-panel cf-span-8" aria-labelledby="ov-people">
        <header>
          <h2 id="ov-people">People</h2>
          <span v-if="!error && !loading" class="cf-meta">{{ shown.length }} of {{ counts.all }} · admins first</span>
        </header>
        <div v-if="error" class="cf-empty" role="status">
          <span>Couldn’t load people from _users. <button type="button" class="cf-link" @click="refresh()">Retry</button></span>
        </div>
        <table v-else class="cf-table ov-table">
          <thead>
            <tr><th scope="col">Person</th><th scope="col">Roles</th><th scope="col" class="cf-n">Workspace</th></tr>
          </thead>
          <tbody>
            <template v-if="loading">
              <tr v-for="i in 4" :key="i"><td><span class="cf-skeleton" style="width: 12ch" /></td><td><span class="cf-skeleton" style="width: 8ch" /></td><td class="cf-n"><span class="cf-skeleton" /></td></tr>
            </template>
            <template v-else>
            <tr v-for="p in shown" :key="p.name">
              <td>
                <span class="ov-person"><span class="cf-avatar" :style="{ '--cf-tint': tint(p.name) }" aria-hidden="true">{{ p.name[0] }}</span><span class="cf-num">{{ p.name }}</span></span>
              </td>
              <td>
                <span class="ov-roles">
                  <span v-for="r in p.roles" :key="r" class="cf-pill" :class="{ 'cf-pill-ink': adminRoles.includes(r) }">{{ r }}</span>
                  <span v-if="!p.roles.length" class="cf-muted">No role</span>
                </span>
              </td>
              <td class="cf-n">
                <span v-if="isAdmin(p)" class="cf-pill cf-pill-pos">Can open</span>
                <span v-else class="cf-muted">—</span>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </section>

      <section class="cf-panel cf-span-4" aria-labelledby="ov-session">
        <header><h2 id="ov-session">Your session</h2></header>
        <dl class="cf-kv">
          <div><dt>Username</dt><dd class="cf-num">{{ user?.name }}</dd></div>
          <div>
            <dt>Your roles</dt>
            <dd>
              <span v-for="r in user?.roles" :key="r" class="cf-pill">{{ r }}</span>
              <span v-if="!user?.roles.length" class="cf-muted">—</span>
            </dd>
          </div>
          <div>
            <dt>Opens this workspace</dt>
            <dd><span v-for="r in adminRoles" :key="r" class="cf-pill cf-pill-ink">{{ r }}</span></dd>
          </div>
          <div><dt>Session</dt><dd>Native CouchDB cookie</dd></div>
        </dl>
      </section>
    </div>
  </section>
</template>
<style scoped>
.ov-person { display: flex; align-items: center; gap: 12px; }
.ov-roles { display: flex; flex-wrap: wrap; gap: 4px; }
/* phone: two-line rows, the person and their access on line 1, roles on line 2 */
@media (max-width: 640px) {
  .ov-table thead { display: none; }
  .ov-table, .ov-table tbody { display: block; }
  .ov-table tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; padding: 12px 0; border-bottom: 1px solid var(--cf-rule); }
  .ov-table tr:last-child { border-bottom: 0; }
  .ov-table td { display: block; padding: 0; border: 0; }
  .ov-table td:nth-child(2) { grid-column: 1 / -1; grid-row: 2; padding-left: 40px; }
  .ov-table td:nth-child(3) { grid-column: 2; grid-row: 1; align-self: center; }
}
</style>
