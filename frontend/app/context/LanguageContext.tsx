'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, type Locale, type TranslationKey } from '../lib/translations'

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('es')

  // Detectar idioma del navegador al inicializar
  useEffect(() => {
    const savedLocale = localStorage.getItem('locale') as Locale
    if (savedLocale && translations[savedLocale]) {
      setLocaleState(savedLocale)
    } else {
      // Auto-detectar del navegador
      const browserLang = navigator.language.split('-')[0] as Locale
      const supportedLocales = ['es', 'en', 'pt', 'it']
      
      if (supportedLocales.includes(browserLang)) {
        setLocaleState(browserLang)
      } else {
        // Si el idioma no está soportado, usar español por defecto
        setLocaleState('es')
      }
    }
  }, [])

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('locale', newLocale)
    // Opcional: cambiar URL si quieres URLs con idioma
    // window.history.pushState({}, '', `/${newLocale}`)
  }

  const t = (key: TranslationKey): string => {
    return translations[locale]?.[key] || translations.es[key]
  }

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

// Exportar el contexto por si se necesita usar directamente
export { LanguageContext };
