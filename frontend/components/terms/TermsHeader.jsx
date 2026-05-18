import React from 'react';

export default function TermsHeader() {
  return (
    <header className="relative overflow-hidden bg-primary pt-16 pb-20 px-6 text-center">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-secondary/10 rounded-full -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/5 rounded-full translate-x-1/3 translate-y-1/3" />
      <div className="absolute top-1/2 left-1/4 w-2 h-2 bg-secondary/30 rounded-full" />
      <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-secondary/20 rounded-full" />
      
      <div className="relative z-10 max-w-3xl mx-auto">
        <p className="text-secondary font-heading font-bold text-sm tracking-[0.3em] uppercase mb-4">
          TRAVELGRIN
        </p>
        <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
          Términos de Uso · Privacidad · Reglas de Plataforma
        </h1>
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2 border border-white/10">
          <span className="text-white/70 text-sm font-medium">Versión 1.0</span>
        </div>
      </div>
    </header>
  );
}