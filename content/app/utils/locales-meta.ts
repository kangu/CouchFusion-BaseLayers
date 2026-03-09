import flagBg from '../assets/flags/bg.svg?raw'
import flagCs from '../assets/flags/cs.svg?raw'
import flagDa from '../assets/flags/da.svg?raw'
import flagDe from '../assets/flags/de.svg?raw'
import flagEl from '../assets/flags/el.svg?raw'
import flagEn from '../assets/flags/en.svg?raw'
import flagEs from '../assets/flags/es.svg?raw'
import flagFi from '../assets/flags/fi.svg?raw'
import flagFr from '../assets/flags/fr.svg?raw'
import flagHr from '../assets/flags/hr.svg?raw'
import flagHu from '../assets/flags/hu.svg?raw'
import flagIt from '../assets/flags/it.svg?raw'
import flagJa from '../assets/flags/ja.svg?raw'
import flagKo from '../assets/flags/ko.svg?raw'
import flagNl from '../assets/flags/nl.svg?raw'
import flagNo from '../assets/flags/no.svg?raw'
import flagPl from '../assets/flags/pl.svg?raw'
import flagPt from '../assets/flags/pt.svg?raw'
import flagRo from '../assets/flags/ro.svg?raw'
import flagSv from '../assets/flags/sv.svg?raw'
import flagTr from '../assets/flags/tr.svg?raw'
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
  ja: {
    label: '日本語',
    flagSvg: flagJa,
  },
  ko: {
    label: '한국어',
    flagSvg: flagKo,
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
  hu: {
    label: 'Magyar',
    flagSvg: flagHu,
  },
  pl: {
    label: 'Polski',
    flagSvg: flagPl,
  },
  bg: {
    label: 'Български',
    flagSvg: flagBg,
  },
  no: {
    label: 'Norsk',
    flagSvg: flagNo,
  },
  nb: {
    label: 'Norsk',
    flagSvg: flagNo,
  },
  nn: {
    label: 'Norsk',
    flagSvg: flagNo,
  },
  sv: {
    label: 'Svenska',
    flagSvg: flagSv,
  },
  fi: {
    label: 'Suomi',
    flagSvg: flagFi,
  },
  da: {
    label: 'Dansk',
    flagSvg: flagDa,
  },
  hr: {
    label: 'Hrvatski',
    flagSvg: flagHr,
  },
  cs: {
    label: 'Čeština',
    flagSvg: flagCs,
  },
  el: {
    label: 'Ελληνικά',
    flagSvg: flagEl,
  },
  tr: {
    label: 'Türkçe',
    flagSvg: flagTr,
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
