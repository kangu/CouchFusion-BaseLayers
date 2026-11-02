import { computed } from 'vue'
import { useCookie, useHead } from '#imports'
import { useCouchDBAuth } from '../auth-client/app/composables/useCouchDBAuth'

export type CouchDBColorScheme = 'system' | 'light' | 'dark'
const COOKIE = 'couchdb_color_scheme'
const isScheme = (v: unknown): v is CouchDBColorScheme =>
  v === 'system' || v === 'light' || v === 'dark'

/** The person's colour scheme: their own choice (a cookie) or the workspace default (admin_theme). */
export function useCouchDBColorScheme() {
  const auth = useCouchDBAuth()
  const cookie = useCookie<string | null>(COOKIE, {
    default: () => null,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  const scheme = computed<CouchDBColorScheme>(() =>
    isScheme(cookie.value)
      ? cookie.value
      : (auth.settings.value?.admin.theme ?? 'system'),
  )
  return {
    scheme,
    setScheme: (next: CouchDBColorScheme) => {
      cookie.value = next
    },
  }
}

/** Puts the scheme on <html> during SSR so the first paint has the right colours, and loads the two faces. */
export function useCouchDBThemeHead() {
  const { scheme } = useCouchDBColorScheme()
  useHead({
    htmlAttrs: { 'data-cf-scheme': scheme },
    link: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
      },
    ],
  })
}
