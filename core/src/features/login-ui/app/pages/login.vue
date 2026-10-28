<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  createError,
  navigateTo,
  useRoute,
  useRequestFetch,
  useState,
} from '#imports'
import { useCouchDBAuth } from '../../../auth-client/app/composables/useCouchDBAuth'
import {
  solveProofOfWork,
  type ProofChallenge,
} from '../../../auth-client/app/utils/proof-of-work'
import {
  canOpen,
  loginDestination,
} from '../../../auth-client/app/utils/access'
import { useCouchDBThemeHead } from '../../../ui-theme/useCouchDBColorScheme'
import CouchMark from '../../../ui-theme/CouchMark.vue'
import SchemeToggle from '../../../ui-theme/SchemeToggle.vue'
const auth = useCouchDBAuth()
if (!auth.initialized.value) await auth.refresh()
if (!auth.settings.value?.features.ui)
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
useCouchDBThemeHead()
const route = useRoute()
const name = ref('')
const password = ref('')
const email = ref('')
const code = ref('')
const emailSent = ref(false)
const emailBusy = ref(false)
const emailError = ref('')
const nostrBusy = ref(false)
const nostrError = ref('')
const verifyingBrowser = ref(false)
interface NostrExtension {
  getPublicKey(): Promise<string>
  signEvent(event: {
    kind: number
    content: string
    tags: string[][]
    created_at: number
  }): Promise<Record<string, unknown>>
}
async function proofPayload() {
  if (!auth.settings.value?.features.proofOfWork) return {}
  verifyingBrowser.value = true
  try {
    const challenge = await requestFetch<ProofChallenge>(
      '/api/couchdb/proof-of-work/challenge',
      { method: 'POST', headers: { 'x-couchdb-csrf': csrf.value } },
    )
    return { proof: await solveProofOfWork(challenge) }
  } finally {
    verifyingBrowser.value = false
  }
}
async function nostrSignIn() {
  nostrBusy.value = true
  nostrError.value = ''
  try {
    const extension = (window as Window & { nostr?: NostrExtension }).nostr
    if (!extension)
      throw new Error('Install or enable a Nostr browser extension to sign in.')
    const pubkey = await extension.getPublicKey()
    const proof = await proofPayload()
    const headers = { 'x-couchdb-csrf': csrf.value }
    const challenge = await requestFetch<{
      id: string
      message: string
      expiresAt: number
    }>('/api/couchdb/login/nostr/challenge', {
      method: 'POST',
      headers,
      body: { pubkey, ...proof },
    })
    const verifyUrl = new URL(
      '/api/couchdb/login/nostr/verify',
      window.location.origin,
    ).href
    const event = await extension.signEvent({
      kind: 27235,
      content: challenge.message,
      tags: [
        ['challenge', challenge.message],
        ['u', verifyUrl],
        ['method', 'POST'],
      ],
      created_at: Math.floor(Date.now() / 1000),
    })
    await requestFetch('/api/couchdb/login/nostr/verify', {
      method: 'POST',
      headers,
      body: { id: challenge.id, event },
    })
    await auth.refresh()
    await redirectAfterLogin()
  } catch (cause) {
    nostrError.value =
      cause instanceof Error
        ? cause.message
        : 'Unable to sign in with Nostr. Please try again.'
  } finally {
    nostrBusy.value = false
  }
}
const csrf = useState<string>('couchdb:csrf', () => '')
const requestFetch = useRequestFetch()
function resetEmail() { emailSent.value=false; code.value='' }
async function emailSubmit() {
  emailBusy.value = true
  emailError.value = ''
  try {
    const headers = { 'x-couchdb-csrf': csrf.value }
    if (!emailSent.value) {
      await requestFetch('/api/couchdb/login/email/request', {
        method: 'POST',
        headers,
        body: { email: email.value, ...(await proofPayload()) },
      })
      emailSent.value = true
    } else {
      await requestFetch('/api/couchdb/login/email/verify', {
        method: 'POST',
        headers,
        body: { email: email.value, code: code.value },
      })
      await auth.refresh()
      await redirectAfterLogin()
    }
  } catch {
    emailError.value =
      'Unable to complete email sign-in. Check your details and try again.'
  } finally {
    emailBusy.value = false
  }
}
const destination = computed(() =>
  auth.settings.value
    ? loginDestination(route.query.redirect, auth.settings.value)
    : '/admin',
)
// Signed in, but the destination would refuse this account (for example /admin without an admin role).
const noAccess = computed(
  () =>
    !!auth.user.value &&
    !!auth.settings.value &&
    !canOpen(destination.value, auth.settings.value, auth.user.value),
)
async function redirectAfterLogin() {
  if (noAccess.value) return
  await navigateTo(destination.value)
}
const heading = computed(() => auth.settings.value?.auth.heading || 'Sign in')
const brandName = computed(() => auth.settings.value?.admin.brandName || 'Workspace')
const footer = computed(() => auth.settings.value?.admin.footerText || auth.settings.value?.admin.siteName || '')
const methodCount = computed(() => {
  const f = auth.settings.value?.features
  return [f?.password, f?.email, f?.nostr].filter(Boolean).length
})
async function submit() {
  try {
    await auth.loginWithPassword(name.value, password.value)
  } catch {
    return
  } finally {
    password.value = ''
  }
  await redirectAfterLogin()
}
async function switchAccount() {
  try {
    await auth.logout()
    name.value = ''
    resetEmail()
  } catch {
    // auth.error carries the message shown in the no-access panel.
  }
}
</script>
<template>
  <main class="cf-ui cf-login">
    <header class="cf-login-top">
      <span class="cf-login-brand"><CouchMark /><b>{{ brandName }}</b></span>
      <SchemeToggle />
    </header>
    <section class="cf-login-panel" aria-labelledby="login-heading">
      <h1 id="login-heading">{{ heading }}</h1>
      <div v-if="noAccess" class="cf-login-block" data-testid="login-no-access">
        <p role="alert" class="cf-login-note">
          You are signed in as
          <strong class="cf-num" data-testid="login-no-access-name">{{ auth.user.value?.name }}</strong>, but this
          account does not have access to this workspace.
        </p>
        <p v-if="auth.error.value" role="alert" class="cf-alert">{{ auth.error.value }}</p>
        <button
          type="button"
          class="cf-btn cf-btn-primary cf-btn-block"
          :disabled="auth.loading.value"
          data-testid="login-switch-account"
          @click="switchAccount"
        >
          {{ auth.loading.value ? 'Signing out…' : 'Sign out and use another account' }}
        </button>
      </div>
      <template v-else>
        <p v-if="auth.settings.value?.features.password" class="cf-login-sub">Use your CouchDB username and password.</p>
        <form v-if="auth.settings.value?.features.password" class="cf-login-block" @submit.prevent="submit">
          <div class="cf-field">
            <label for="couchdb-name">Username</label>
            <input id="couchdb-name" v-model="name" class="cf-input" name="username" autocomplete="username" required :disabled="auth.loading.value" data-testid="login-username" />
          </div>
          <div class="cf-field">
            <label for="couchdb-password">Password</label>
            <input id="couchdb-password" v-model="password" class="cf-input" name="password" type="password" autocomplete="current-password" required :disabled="auth.loading.value" data-testid="login-password" />
          </div>
          <p v-if="auth.error.value" role="alert" class="cf-alert" data-testid="login-error">{{ auth.error.value }}</p>
          <button type="submit" class="cf-btn cf-btn-primary cf-btn-block" :disabled="auth.loading.value" data-testid="login-submit">
            {{ auth.loading.value ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
        <p v-if="methodCount > 1 && auth.settings.value?.features.password" class="cf-login-or"><span>or</span></p>
        <form v-if="auth.settings.value?.features.email" class="cf-login-block" @submit.prevent="emailSubmit">
          <div class="cf-field">
            <label for="couchdb-email">Email address</label>
            <input id="couchdb-email" v-model="email" class="cf-input" type="email" name="email" autocomplete="email" required :disabled="emailBusy || emailSent" />
          </div>
          <template v-if="emailSent">
            <p role="status" class="cf-login-note">If this address can sign in, a code has been sent.</p>
            <div class="cf-field">
              <label for="couchdb-code">Sign-in code</label>
              <input id="couchdb-code" v-model="code" class="cf-input cf-num" name="code" autocomplete="one-time-code" required :disabled="emailBusy" />
            </div>
          </template>
          <p v-if="emailError" role="alert" class="cf-alert">{{ emailError }}</p>
          <button :disabled="emailBusy" type="submit" class="cf-btn cf-btn-block">
            {{ emailBusy ? 'Please wait…' : emailSent ? 'Verify code' : 'Email me a sign-in code' }}
          </button>
          <button v-if="emailSent" type="button" class="cf-link" :disabled="emailBusy" @click="resetEmail">Use another email</button>
        </form>
        <div v-if="auth.settings.value?.features.nostr" class="cf-login-block">
          <button type="button" class="cf-btn cf-btn-block" :disabled="nostrBusy || emailBusy || auth.loading.value" data-testid="login-nostr" @click="nostrSignIn">
            {{ nostrBusy ? 'Connecting…' : 'Sign in with Nostr' }}
          </button>
          <p v-if="nostrError" role="alert" class="cf-alert" data-testid="login-nostr-error">{{ nostrError }}</p>
        </div>
        <p v-if="verifyingBrowser" role="status" class="cf-login-note">Completing browser verification…</p>
        <p v-if="!methodCount" role="status" class="cf-login-note">Sign-in is unavailable.</p>
      </template>
    </section>
    <footer v-if="footer" class="cf-login-foot">{{ footer }}</footer>
  </main>
</template>
<style src="../../../ui-theme/terminal.css"></style>
<style scoped>
.cf-login { display: grid; grid-template-rows: auto 1fr auto; padding: 0 24px; }
.cf-login-top { display: flex; align-items: center; justify-content: space-between; height: 64px; }
.cf-login-brand { display: flex; align-items: center; gap: 10px; font-size: 15px; }
.cf-login-brand b { font-weight: 600; letter-spacing: -0.01em; }
.cf-login-panel { align-self: center; justify-self: center; width: min(100%, 400px); margin: 24px 0 48px; padding: 32px; display: grid; gap: 20px; background: var(--cf-surface); border: 1px solid var(--cf-border); border-radius: 6px; box-shadow: var(--cf-shadow); }
.cf-login-panel h1 { font-size: 24px; line-height: 1.2; font-weight: 700; letter-spacing: -0.015em; }
.cf-login-sub { margin-top: -12px; color: var(--cf-muted); }
.cf-login-block { display: grid; gap: 16px; }
.cf-login-block .cf-link { justify-self: start; }
.cf-login-note { color: var(--cf-muted); line-height: 21px; }
.cf-login-note strong { color: var(--cf-text); font-weight: 500; }
.cf-login-or { display: flex; align-items: center; gap: 12px; color: var(--cf-muted); font-size: 12px; }
.cf-login-or::before, .cf-login-or::after { content: ""; flex: 1; height: 1px; background: var(--cf-border); }
.cf-login-foot { padding: 0 0 24px; text-align: center; color: var(--cf-muted); font-size: 12px; }
@media (max-width: 480px) {
  .cf-login { padding: 0 16px; }
  .cf-login-panel { padding: 24px 20px; margin-top: 8px; }
}
</style>
