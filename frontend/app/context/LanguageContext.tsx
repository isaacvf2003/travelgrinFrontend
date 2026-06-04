'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { translations, type Locale, type TranslationKey } from '../lib/translations'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

function normalizeVisibleText(value: string) {
  let current = String(value ?? '')
  const replacements: Array<[RegExp, string]> = [
    [/Ã¡/g, 'á'],
    [/Ã©/g, 'é'],
    [/Ã­/g, 'í'],
    [/Ã³/g, 'ó'],
    [/Ãº/g, 'ú'],
    [/Ã±/g, 'ñ'],
    [/Ã¼/g, 'ü'],
    [/Â¿/g, '¿'],
    [/Â¡/g, '¡'],
    [/publicaciÒ³n/gi, 'publicación'],
    [/descripciÒ³n/gi, 'descripción'],
    [/revisiÒ³n/gi, 'revisión'],
    [/secciÒ³n/gi, 'sección'],
    [/enviÒ³/gi, 'envió'],
    [/querÒ©s/gi, 'querés'],
    [/podÒ©s/gi, 'podés'],
    [/acÒ¡/gi, 'acá'],
    [/dÒ­as/gi, 'días'],
    [/Òºnico/gi, 'único'],
    [/galerÒ­a/gi, 'galería'],
    [/imÒ¡genes/gi, 'imágenes'],
    [/sesiÒ³n/gi, 'sesión'],
  ]

  for (const [pattern, replacement] of replacements) current = current.replace(pattern, replacement)

  try {
    const decoded = decodeURIComponent(escape(current))
    if (decoded && decoded !== current) {
      current = decoded
      for (const [pattern, replacement] of replacements) current = current.replace(pattern, replacement)
    }
  } catch {}

  return current
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es')

  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale
    if (savedLocale && translations[savedLocale]) {
      setLocaleState(savedLocale)
    } else {
      const browserLang = navigator.language.split('-')[0] as Locale
      const supportedLocales = ['es', 'en', 'pt', 'it']

      if (supportedLocales.includes(browserLang)) {
        setLocaleState(browserLang)
      } else {
        setLocaleState('es')
      }
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
  }

  const t = (key: TranslationKey): string => {
    const value = translations[locale]?.[key] || translations.es[key]
    return normalizeVisibleText(value)
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export { LanguageContext }
