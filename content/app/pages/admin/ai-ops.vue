<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useCodexSessions } from "#content/app/composables/useCodexSessions";
import { useCodexStream } from "#content/app/composables/useCodexStream";
import type {
  CodexConfigInfo,
  CodexSessionCreateResponse,
  CodexSessionStatus,
} from "#content/types/codex-sessions";

definePageMeta({
  layout: false,
  middleware: ["auth"],
});

const runtimeConfig = useRuntimeConfig();
const featureEnabled = computed(() => runtimeConfig.public?.featureCodexSessions === true);

const { creating, createSession, sendInput, stopSession, getStatus, getConfig } =
  useCodexSessions();
const { events, connected, bytes, commandCount, connect, disconnect } = useCodexStream();

const config = ref<CodexConfigInfo | null>(null);
const root = ref("");
const prompt = ref("run tests");
const followup = ref("");
const ttlSec = ref<number | null>(null);
const currentSession = ref<CodexSessionCreateResponse | null>(null);
const status = ref<CodexSessionStatus | null>(null);
const busy = ref(false);
const uiError = ref<string | null>(null);

const hasRootOptions = computed(() => (config.value?.allowedRoots || []).length > 0);
const rootOptions = computed(() => config.value?.allowedRoots || []);

async function loadConfig() {
  try {
    config.value = await getConfig();
    if (hasRootOptions.value && !root.value) {
      root.value = rootOptions.value[0] || "";
    }
  } catch (err: any) {
    uiError.value = err?.statusMessage || err?.message || "Failed to load config";
  }
}

async function handleCreate() {
  if (!featureEnabled.value) {
    uiError.value = "Codex sessions are disabled.";
    return;
  }
  uiError.value = null;
  busy.value = true;
  try {
    const payload: { root: string; prompt: string; ttl_sec?: number } = {
      root: root.value,
      prompt: prompt.value,
    };
    if (ttlSec.value && ttlSec.value > 0) {
      payload.ttl_sec = ttlSec.value;
    }
    const res = await createSession(payload);
    currentSession.value = res;
    status.value = {
      id: res.session_id,
      state: "running",
      created_at: new Date().toISOString(),
      expires_at: res.expires_at,
      last_event: new Date().toISOString(),
    } as CodexSessionStatus;
    connect(res.session_id);
  } catch (err: any) {
    uiError.value = err?.statusMessage || err?.message || "Failed to create session";
  } finally {
    busy.value = false;
  }
}

async function refreshStatus() {
  if (!currentSession.value) return;
  try {
    status.value = await getStatus(currentSession.value.session_id);
  } catch (err: any) {
    uiError.value = err?.statusMessage || err?.message || "Failed to fetch status";
  }
}

async function handleSend(text: string) {
  if (!currentSession.value || !text.trim()) return;
  try {
    await sendInput(currentSession.value.session_id, text.trim());
    followup.value = "";
  } catch (err: any) {
    uiError.value = err?.statusMessage || err?.message || "Failed to send input";
  }
}

async function handleStop() {
  if (!currentSession.value) return;
  try {
    await stopSession(currentSession.value.session_id);
    disconnect();
    await refreshStatus();
  } catch (err: any) {
    uiError.value = err?.statusMessage || err?.message || "Failed to stop session";
  }
}

onMounted(() => {
  loadConfig();
});

const tail = computed(() => events.value.slice(-50));
const lastTail = computed(() => {
  const lastState = [...events.value].reverse().find((e) => e.type === "state");
  try {
    if (lastState?.data) {
      const parsed = JSON.parse(lastState.data);
      return parsed?.tail || "";
    }
  } catch (_err) {
    // ignore parse errors
  }
  return "";
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-6">
    <div class="mx-auto max-w-6xl space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-slate-400">AI Ops</p>
          <h1 class="text-2xl font-semibold text-slate-900">Codex Sessions</h1>
          <p class="text-sm text-slate-600">
            Start and monitor guarded Codex CLI sessions within allowed roots.
          </p>
        </div>
        <div>
          <span
            class="rounded-full px-3 py-1 text-xs font-semibold"
            :class="featureEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
          >
            {{ featureEnabled ? 'Enabled' : 'Disabled' }}
          </span>
        </div>
      </div>

      <div v-if="uiError" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {{ uiError }}
      </div>

      <div class="grid gap-4 lg:grid-cols-[360px,1fr]">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 class="text-sm font-semibold text-slate-900">Start session</h2>
          <p class="mt-1 text-xs text-slate-500">Strict allowlist and discovery caps apply.</p>

          <div class="mt-4 space-y-3">
            <div>
              <label class="text-xs font-medium text-slate-700">Root</label>
              <div class="mt-1">
                <select
                  v-if="hasRootOptions"
                  v-model="root"
                  class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option v-for="r in rootOptions" :key="r" :value="r">{{ r }}</option>
                </select>
                <input
                  v-else
                  v-model="root"
                  type="text"
                  placeholder="/path/to/repo"
                  class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>
            </div>

            <div>
              <label class="text-xs font-medium text-slate-700">Initial prompt</label>
              <textarea
                v-model="prompt"
                rows="4"
                class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="run tests"
              ></textarea>
            </div>

            <div>
              <label class="text-xs font-medium text-slate-700">TTL (seconds, optional)</label>
              <input
                v-model.number="ttlSec"
                type="number"
                min="1"
                class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>

            <div class="flex items-center gap-2 text-xs text-slate-500">
              <span v-if="config?.discoveryCaps?.maxSeconds">⏱ {{ config?.discoveryCaps?.maxSeconds }}s</span>
              <span v-if="config?.discoveryCaps?.maxBytes">• {{ config?.discoveryCaps?.maxBytes }} bytes</span>
              <span v-if="config?.discoveryCaps?.maxCommands">• {{ config?.discoveryCaps?.maxCommands }} cmds</span>
            </div>

            <button
              class="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              :disabled="busy || creating || !featureEnabled"
              @click="handleCreate"
            >
              {{ creating || busy ? 'Starting…' : 'Start session' }}
            </button>
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                <h3 class="text-lg font-semibold text-slate-900">
                  {{ status?.state || 'idle' }}
                </h3>
                <p class="text-xs text-slate-500">Session ID: {{ currentSession?.session_id || '—' }}</p>
              </div>
              <div class="flex items-center gap-2">
                <button
                  class="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                  :disabled="!currentSession"
                  @click="refreshStatus"
                >
                  Refresh
                </button>
                <button
                  class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60"
                  :disabled="!currentSession"
                  @click="handleStop"
                >
                  Stop
                </button>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div class="rounded-lg bg-slate-50 p-3">
                <p class="font-semibold text-slate-700">Bytes</p>
                <p class="mt-1 font-mono">{{ bytes }}</p>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <p class="font-semibold text-slate-700">Commands</p>
                <p class="mt-1 font-mono">{{ commandCount }}</p>
              </div>
              <div class="rounded-lg bg-slate-50 p-3">
                <p class="font-semibold text-slate-700">Connected</p>
                <p class="mt-1 font-mono">{{ connected ? 'yes' : 'no' }}</p>
              </div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-slate-900">Stream</h3>
              <span class="text-xs text-slate-500">showing last 50 events</span>
            </div>
            <div class="mt-3 h-64 overflow-auto rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 font-mono text-[12px] leading-5 text-slate-800">
              <div v-if="tail.length === 0" class="text-slate-400">No output yet.</div>
              <div v-for="(evt, idx) in tail" :key="idx" :class="evt.type === 'state' ? 'text-emerald-700' : ''">
                <span class="text-slate-400">[{{ evt.type }}]</span> {{ evt.data }}
              </div>
            </div>
            <div v-if="lastTail" class="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] font-mono leading-5 text-slate-800">
              <div class="text-xs font-semibold text-slate-600 mb-1">Output tail</div>
              <pre class="whitespace-pre-wrap break-words">{{ lastTail }}</pre>
            </div>
            <div class="mt-3 flex gap-2">
              <input
                v-model="followup"
                type="text"
                placeholder="Send command"
                class="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
                @keyup.enter="handleSend(followup)"
              />
              <button
                class="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                :disabled="!currentSession"
                @click="handleSend(followup)"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
