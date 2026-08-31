import React from 'react';
import { Mail } from 'lucide-react';

export default function TermsFooter() {
  return (
    <footer className="mt-16 border-t border-[#d7f1f0] pt-10">
      <div className="mb-10 overflow-hidden rounded-3xl border border-[#d7f1f0] bg-white shadow-[0_16px_40px_rgba(9,93,104,0.08)]">
        <div className="grid grid-cols-1 divide-y divide-[#d7f1f0] md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="bg-[#ecfffd] p-5">
            <p className="flex items-center gap-2 text-sm font-extrabold text-[#075965]">
              <Mail className="h-4 w-4" />
              Contacto legal
            </p>
          </div>
          <div className="p-5">
            <a href="mailto:travelgrin@travelgrin.com" className="text-sm font-bold text-[#0799aa] hover:underline">
              travelgrin@travelgrin.com
            </a>
            <p className="mt-1 text-xs text-[#61747a]">Asunto sugerido: Legal</p>
          </div>
          <div className="p-5">
            <p className="text-xs leading-6 text-[#61747a]">
              La recepción de comunicaciones no implica respuesta automática ni resolución favorable.
            </p>
          </div>
        </div>
      </div>

      <div className="pb-3 text-center">
        <p className="text-sm font-extrabold text-[#075965]">
          Travelgrin
        </p>
        <p className="mt-1 text-xs text-[#61747a]">
          Etapa 1 · Versión 1.0
        </p>
      </div>
    </footer>
  );
}
