import { useNuxtApp, useRequestFetch, useState } from '#imports'
import type {
  CouchDBUser,
  PublicSettings,
  SessionResponse,
} from '../utils/types'

export function useCouchDBAuth() {
  const user = useState<CouchDBUser | null>('couchdb:user', () => null)
  const settings = useState<PublicSettings | null>(
    'couchdb:settings',
    () => null,
  )
  const csrfToken = useState<string>('couchdb:csrf', () => '')
  const initialized = useState<boolean>('couchdb:initialized', () => false)
  const loading = useState<boolean>('couchdb:loading', () => false)
  const error = useState<string | null>('couchdb:error', () => null)
  const requestFetch = useRequestFetch()
  const app = useNuxtApp() as ReturnType<typeof useNuxtApp> & {
    _couchDBSessionPending?: Promise<SessionResponse>
  }
  function apply(response: SessionResponse) {
    user.value = response.user
    settings.value = response.settings
    csrfToken.value = response.csrfToken
    initialized.value = true
  }
  async function request(
    method: 'GET' | 'POST' | 'DELETE',
    body?: { name: string; password: string },
  ) {
    loading.value = true
    error.value = null
    try {
      const response = await requestFetch<SessionResponse>(
        method === 'POST'
          ? '/api/couchdb/login/password'
          : '/api/couchdb/session',
        {
          method,
          ...(body ? { body } : {}),
          ...(method !== 'GET'
            ? { headers: { 'x-couchdb-csrf': csrfToken.value } }
            : {}),
        },
      )
      apply(response)
      return response
    } catch (cause: unknown) {
      const failure = cause as {
        data?: { statusMessage?: string; message?: string }
        statusMessage?: string
      }
      error.value =
        failure.data?.statusMessage ||
        failure.data?.message ||
        failure.statusMessage ||
        'Unable to complete the request. Please try again.'
      throw cause
    } finally {
      loading.value = false
    }
  }
  async function refresh() {
    if (app._couchDBSessionPending) return app._couchDBSessionPending
    const pending = request('GET')
    app._couchDBSessionPending = pending
    try {
      return await pending
    } finally {
      if (app._couchDBSessionPending === pending)
        delete app._couchDBSessionPending
    }
  }
  async function loginWithPassword(name: string, password: string) {
    if (!initialized.value) await refresh()
    return request('POST', { name, password })
  }
  async function logout() {
    if (!initialized.value) await refresh()
    return request('DELETE')
  }
  return {
    user,
    settings,
    initialized,
    loading,
    error,
    refresh,
    loginWithPassword,
    logout,
    hasRole: (role: string) => user.value?.roles.includes(role) ?? false,
  }
}
