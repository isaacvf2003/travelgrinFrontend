import React from 'react';
import { useTranslation } from '@/app/hooks/useTranslation';

const navTranslations: Record<string, Record<string, string>> = {
  es: {
    content: "Contenido",
    queEs: "¿Qué es Travelgrin?",
    definiciones: "1. Definiciones Clave",
    naturaleza: "2. Naturaleza del Servicio",
    registro: "3. Registro y Elegibilidad",
    oferentes: "4. Obligaciones Oferentes",
    viajeros: "5. Reglas Viajeros",
    privacidad: "6. Privacidad y Datos",
    propiedad: "7. Propiedad Intelectual",
    responsabilidad: "8. Limitación de Responsabilidad",
    modelo: "9. Modelo Comercial",
    modificaciones: "10. Modificaciones y Contacto"
  },
  en: {
    content: "Content",
    queEs: "What is Travelgrin?",
    definiciones: "1. Key Definitions",
    naturaleza: "2. Nature of the Service",
    registro: "3. Registration and Eligibility",
    oferentes: "4. Provider Obligations",
    viajeros: "5. Traveler Rules",
    privacidad: "6. Privacy and Data",
    propiedad: "7. Intellectual Property",
    responsabilidad: "8. Limitation of Liability",
    modelo: "9. Business Model",
    modificaciones: "10. Modifications and Contact"
  },
  pt: {
    content: "Conteúdo",
    queEs: "O que é o Travelgrin?",
    definiciones: "1. Definições Chave",
    naturaleza: "2. Natureza do Serviço",
    registro: "3. Registro e Elegibilidade",
    oferentes: "4. Obrigações dos Ofertantes",
    viajeros: "5. Regras para Viajantes",
    privacidad: "6. Privacidade e Dados",
    propiedad: "7. Propriedade Intelectual",
    responsabilidad: "8. Limitação de Responsabilidade",
    modelo: "9. Modelo Comercial",
    modificaciones: "10. Modificações e Contato"
  },
  it: {
    content: "Contenuto",
    queEs: "Cos'è Travelgrin?",
    definiciones: "1. Definizioni Chiave",
    naturaleza: "2. Natura del Servizio",
    registro: "3. Registrazione ed Elegibilità",
    oferentes: "4. Obblighi dei Fornitori",
    viajeros: "5. Regole per i Viaggiatori",
    privacidad: "6. Privacy e Dati",
    propiedad: "7. Proprietà Intellettuale",
    responsabilidad: "8. Limitazione di Responsabilità",
    modelo: "9. Modello Commerciale",
    modificaciones: "10. Modifiche e Contatti"
  }
};

export default function TermsNav() {
  const { locale } = useTranslation();
  const t = navTranslations[locale] || navTranslations.es;

  const sections = [
    { id: 'que-es', label: t.queEs },
    { id: 'definiciones', label: t.definiciones },
    { id: 'naturaleza', label: t.naturaleza },
    { id: 'registro', label: t.registro },
    { id: 'oferentes', label: t.oferentes },
    { id: 'viajeros', label: t.viajeros },
    { id: 'privacidad', label: t.privacidad },
    { id: 'propiedad', label: t.propiedad },
    { id: 'responsabilidad', label: t.responsabilidad },
    { id: 'modelo', label: t.modelo },
    { id: 'modificaciones', label: t.modificaciones },
  ];

  return (
    <nav className="sticky top-24 rounded-[1.75rem] border border-white/80 bg-white/90 p-4 shadow-[0_18px_45px_rgba(9,93,104,0.10)] backdrop-blur">
      <p className="mb-4 px-3 text-xs font-extrabold uppercase tracking-[0.24em] text-[#08aeba]">
        {t.content}
      </p>
      <ul className="space-y-1.5">
        {sections.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-[#52676e] transition-all duration-200 hover:translate-x-1 hover:bg-[#e9fbfa] hover:text-[#075965]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[#08d9bd]/45 transition-all group-hover:bg-[#08aeba] group-hover:shadow-[0_0_0_4px_rgba(8,217,189,0.14)]" />
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
