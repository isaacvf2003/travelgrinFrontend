import React from 'react';
import { Mail } from 'lucide-react';
import { useTranslation } from '@/app/hooks/useTranslation';

const footerTranslations: Record<string, { legalContact: string; subjectHint: string; disclaimer: string; brand: string; version: string }> = {
  es: {
    legalContact: "Contacto legal",
    subjectHint: "Asunto sugerido: Legal",
    disclaimer: "La recepción de comunicaciones no implica respuesta automática ni resolución favorable.",
    brand: "Travelgrin",
    version: "Etapa 1 · Versión 1.0"
  },
  en: {
    legalContact: "Legal Contact",
    subjectHint: "Suggested subject: Legal",
    disclaimer: "Receiving communications does not imply an automatic response or a favorable resolution.",
    brand: "Travelgrin",
    version: "Stage 1 · Version 1.0"
  },
  pt: {
    legalContact: "Contato legal",
    subjectHint: "Assunto sugerido: Legal",
    disclaimer: "A recepção de comunicações não implica resposta automática ou resolução favorável.",
    brand: "Travelgrin",
    version: "Etapa 1 · Versão 1.0"
  },
  it: {
    legalContact: "Contatti legali",
    subjectHint: "Oggetto consigliato: Legal",
    disclaimer: "La ricezione di comunicazioni non comporta una risposta automatica o una risoluzione favorevole.",
    brand: "Travelgrin",
    version: "Fase 1 · Versione 1.0"
  }
};

export default function TermsFooter() {
  const { locale } = useTranslation();
  const t = footerTranslations[locale] || footerTranslations.es;

  return (
    <footer className="mt-16 border-t border-[#d7f1f0] pt-10">
      <div className="mb-10 overflow-hidden rounded-3xl border border-[#d7f1f0] bg-white shadow-[0_16px_40px_rgba(9,93,104,0.08)]">
        <div className="grid grid-cols-1 divide-y divide-[#d7f1f0] md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="bg-[#ecfffd] p-5">
            <p className="flex items-center gap-2 text-sm font-extrabold text-[#075965]">
              <Mail className="h-4 w-4" />
              {t.legalContact}
            </p>
          </div>
          <div className="p-5">
            <a href="mailto:travelgrin@travelgrin.com" className="text-sm font-bold text-[#0799aa] hover:underline">
              travelgrin@travelgrin.com
            </a>
            <p className="mt-1 text-xs text-[#61747a]">{t.subjectHint}</p>
          </div>
          <div className="p-5">
            <p className="text-xs leading-6 text-[#61747a]">
              {t.disclaimer}
            </p>
          </div>
        </div>
      </div>

      <div className="pb-3 text-center">
        <p className="text-sm font-extrabold text-[#075965]">
          {t.brand}
        </p>
        <p className="mt-1 text-xs text-[#61747a]">
          {t.version}
        </p>
      </div>
    </footer>
  );
}
