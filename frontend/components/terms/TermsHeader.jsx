import React from 'react';

export default function TermsHeader() {
  return (
    <header className="relative isolate overflow-hidden bg-[#075965] px-5 pb-20 pt-20 text-center sm:px-6 lg:pb-24 lg:pt-24">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_20%_20%,rgba(8,217,189,0.28),transparent_28%),radial-gradient(circle_at_82%_10%,rgba(255,255,255,0.16),transparent_24%),linear-gradient(135deg,#075965_0%,#087483_52%,#08b8c6_100%)]" />
      <div className="absolute -left-24 -top-24 -z-10 h-72 w-72 rounded-full border border-white/15 bg-white/5 blur-sm" />
      <div className="absolute -bottom-32 right-[-4rem] -z-10 h-96 w-96 rounded-full border border-[#08d9bd]/25 bg-[#08d9bd]/10" />
      <div className="absolute left-[12%] top-1/2 h-3 w-3 rounded-full bg-[#08d9bd]/60 shadow-[0_0_28px_rgba(8,217,189,0.75)]" />
      <div className="absolute right-[22%] top-1/3 h-2 w-2 rounded-full bg-white/60" />

      <div className="relative z-10 mx-auto max-w-4xl">
        <p className="mb-5 text-sm font-extrabold uppercase tracking-[0.35em] text-[#08d9bd]">
          TRAVELGRIN
        </p>
        <h1 className="text-balance text-3xl font-black leading-tight text-white sm:text-4xl lg:text-6xl">
          Términos de Uso · Privacidad · Reglas de Plataforma
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/82 sm:text-lg">
          Información clara, ordenada y actualizada para usar Travelgrin con confianza.
        </p>
        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/12 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(0,0,0,0.14)] backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-[#08d9bd] shadow-[0_0_16px_rgba(8,217,189,0.9)]" />
          Versión 1.0
        </div>
      </div>
    </header>
  );
}
