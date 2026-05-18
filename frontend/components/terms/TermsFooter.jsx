import React from 'react';
import { Mail } from 'lucide-react';

export default function TermsFooter() {
  return (
    <footer className="mt-16 pt-10 border-t border-border">
      {/* Contact card */}
      <div className="rounded-xl border border-border overflow-hidden mb-10">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          <div className="p-5 bg-primary/5">
            <p className="font-heading font-semibold text-primary text-sm flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contacto legal
            </p>
          </div>
          <div className="p-5">
            <a href="mailto:travelgrin@travelgrin.com" className="text-sm text-secondary font-medium hover:underline">
              travelgrin@travelgrin.com
            </a>
            <p className="text-xs text-muted-foreground mt-1">Asunto sugerido: "Legal"</p>
          </div>
          <div className="p-5">
            <p className="text-xs text-muted-foreground leading-relaxed">
              La recepción de comunicaciones no implica respuesta automática ni resolución favorable.
            </p>
          </div>
        </div>
      </div>

      {/* Final line */}
      <div className="text-center pb-10">
        <p className="text-sm font-heading font-semibold text-primary">
          Travelgrin
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Etapa 1 · Versión 1.0
        </p>
      </div>
    </footer>
  );
}