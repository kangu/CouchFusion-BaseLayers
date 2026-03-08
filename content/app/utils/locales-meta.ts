import flagDe from '../assets/flags/de.svg?raw'
import flagEn from '../assets/flags/en.svg?raw'
import flagEs from '../assets/flags/es.svg?raw'
import flagFr from '../assets/flags/fr.svg?raw'
import flagIt from '../assets/flags/it.svg?raw'
import flagNl from '../assets/flags/nl.svg?raw'
import flagPt from '../assets/flags/pt.svg?raw'
import flagRo from '../assets/flags/ro.svg?raw'
import flagZh from '../assets/flags/zh.svg?raw'

export interface LocaleMeta {
  label: string
  flagSvg: string
}

const LOCALE_META_BY_CODE: Record<string, LocaleMeta> = {
  en: {
    label: 'English',
    flagSvg: flagEn,
  },
  fr: {
    label: 'Francais',
    flagSvg: flagFr,
  },
  de: {
    label: 'Deutsch',
    flagSvg: flagDe,
  },
  es: {
    label: 'Espanol',
    flagSvg: flagEs,
  },
  it: {
    label: 'Italiano',
    flagSvg: flagIt,
  },
  pt: {
    label: 'Portugues',
    flagSvg: flagPt,
  },
  nl: {
    label: 'Nederlands',
    flagSvg: flagNl,
  },
  zh: {
    label: '中文',
    flagSvg: flagZh,
  },
  ro: {
    label: 'Romana',
    flagSvg: flagRo,
  },
}

const warnedMissingLocaleMeta = new Set<string>()

const normalizeLocaleCode = (localeCode: string): string =>
  localeCode.toLowerCase().trim()

const resolveLocaleMetaKeyCandidates = (localeCode: string): string[] => {
  const normalized = normalizeLocaleCode(localeCode)
  const language = normalized.split('-')[0]

  if (language === normalized) {
    return [normalized]
  }

  return [normalized, language]
}

export const hasLocaleMeta = (localeCode: string): boolean =>
  resolveLocaleMetaKeyCandidates(localeCode).some(
    (key) => typeof LOCALE_META_BY_CODE[key] !== 'undefined',
  )

export const resolveLocaleMeta = (localeCode: string): LocaleMeta => {
  for (const key of resolveLocaleMetaKeyCandidates(localeCode)) {
    const matched = LOCALE_META_BY_CODE[key]
    if (matched) {
      return matched
    }
  }

  const normalized = normalizeLocaleCode(localeCode)
  if (import.meta.dev && !warnedMissingLocaleMeta.has(normalized)) {
    warnedMissingLocaleMeta.add(normalized)
    console.warn(
      `[locales-meta] Missing label/flag for locale "${localeCode}". Add it in layers/content/app/utils/locales-meta.ts and layers/content/app/assets/flags/*.svg.`,
    )
  }

  return {
    label: localeCode.toUpperCase(),
    flagSvg: '',
  }
}
