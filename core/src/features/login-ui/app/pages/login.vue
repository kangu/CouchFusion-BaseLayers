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
import { safeRedirect } from '../../../auth-client/app/utils/redirect'
const auth = useCouchDBAuth()
if (!auth.initialized.value) await auth.refresh()
if (!auth.settings.value?.features.ui)
  throw createError({ statusCode: 404, statusMessage: 'Page not found' })
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
async function redirectAfterLogin() {
  const destination = safeRedirect(
    route.query.redirect,
    safeRedirect(auth.settings.value?.auth.redirectPath, '/admin'),
  )
  await navigateTo(destination === route.path ? '/admin' : destination)
}
const heading = computed(() => auth.settings.value?.auth.heading || 'Sign in')
async function submit() {
  try {
    await auth.loginWithPassword(name.value, password.value)
    password.value = ''
    await redirectAfterLogin()
  } catch {
    password.value = ''
  }
}
</script>
<template>
  <main class="login-page">
    <section class="login-panel" aria-labelledby="login-heading">
      <p class="eyebrow">
        {{ auth.settings.value?.admin.brandName || 'Workspace' }}
      </p>
      <h1 id="login-heading">{{ heading }}</h1>
      <form
        v-if="auth.settings.value?.features.password"
        @submit.prevent="submit"
      >
        <label for="couchdb-name">Username</label>
        <input
          id="couchdb-name"
          v-model="name"
          name="username"
          autocomplete="username"
          required
          :disabled="auth.loading.value"
          data-testid="login-username"
        />
        <label for="couchdb-password">Password</label>
        <input
          id="couchdb-password"
          v-model="password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
          :disabled="auth.loading.value"
          data-testid="login-password"
        />
        <p v-if="auth.error.value" role="alert" data-testid="login-error">
          {{ auth.error.value }}
        </p>
        <button
          type="submit"
          :disabled="auth.loading.value"
          data-testid="login-submit"
        >
          {{ auth.loading.value ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
      <form
        v-if="auth.settings.value?.features.email"
        @submit.prevent="emailSubmit"
      >
        <label for="couchdb-email">Email address</label>
        <input
          id="couchdb-email"
          v-model="email"
          type="email"
          name="email"
          autocomplete="email"
          required
          :disabled="emailBusy || emailSent"
        />
        <template v-if="emailSent">
          <p role="status">
            If this address can sign in, a code has been sent.
          </p>
          <label for="couchdb-code">Sign-in code</label>
          <input
            id="couchdb-code"
            v-model="code"
            name="code"
            autocomplete="one-time-code"
            required
            :disabled="emailBusy"
          />
        </template>
        <p v-if="emailError" role="alert">{{ emailError }}</p>
        <button :disabled="emailBusy" type="submit">
          {{
            emailBusy
              ? 'Please wait…'
              : emailSent
                ? 'Verify code'
                : 'Email a sign-in code'
          }}
        </button>
        <button
          v-if="emailSent"
          type="button"
          :disabled="emailBusy"
          @click="resetEmail"
        >
          Use another email
        </button>
      </form>
      <div v-if="auth.settings.value?.features.nostr" class="nostr-login">
        <button
          type="button"
          :disabled="nostrBusy || emailBusy || auth.loading.value"
          data-testid="login-nostr"
          @click="nostrSignIn"
        >
          {{ nostrBusy ? 'Connecting…' : 'Sign in with Nostr' }}
        </button>
        <p v-if="nostrError" role="alert" data-testid="login-nostr-error">
          {{ nostrError }}
        </p>
      </div>
      <p v-if="verifyingBrowser" role="status">
        Completing browser verification…
      </p>
      <p
        v-if="
          !auth.settings.value?.features.password &&
          !auth.settings.value?.features.email &&
          !auth.settings.value?.features.nostr
        "
        role="status"
      >
        Sign-in is unavailable.
      </p>
    </section>
  </main>
</template>
<style scoped>
:global(body) {
  margin: 0;
}
.nostr-login button {
  width: 100%;
}
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: #f4f3ef;
  color: #242722;
  font-family: system-ui, sans-serif;
  padding: 24px;
  box-sizing: border-box;
}
.login-panel {
  width: min(100%, 360px);
}
.eyebrow {
  font: 11px monospace;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #646a60;
}
h1 {
  font-size: 36px;
  font-weight: 500;
  letter-spacing: -0.04em;
  margin: 18px 0 32px;
}
form {
  display: grid;
  gap: 10px;
}
label {
  font-size: 13px;
  margin-top: 12px;
}
input {
  font: inherit;
  padding: 12px;
  background: white;
  border: 1px solid #c9cdc2;
  border-radius: 3px;
}
button {
  margin-top: 18px;
  background: #273a2b;
  color: white;
  border: 0;
  padding: 13px;
  font: inherit;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
}
input:focus-visible,
button:focus-visible {
  outline: 2px solid #657d51;
  outline-offset: 3px;
}
[role='alert'] {
  color: #9a302d;
  font-size: 14px;
}
</style>
