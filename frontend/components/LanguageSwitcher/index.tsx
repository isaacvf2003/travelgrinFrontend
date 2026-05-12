'use client'
import { useTranslation } from "../../app/hooks/useTranslation"
import type { Locale } from '../../app/lib/translations'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useTranslation()

  const languages: { code: Locale; name: string; flag: string }[] = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' }
  ]

  return (
    <div className="flex gap-2">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => setLocale(lang.code)}
          className={`px-3 py-1 rounded-lg transition-colors ${
            locale === lang.code
              ? 'bg-teal-100 text-teal-700 font-medium'
              : 'hover:bg-gray-100 text-gray-600'
          }`}
        >
          <span className="mr-1">{lang.flag}</span>
          {lang.name}
        </button>
      ))}
    </div>
  )
}
