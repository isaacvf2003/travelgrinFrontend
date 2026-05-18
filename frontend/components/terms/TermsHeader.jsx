import Image from 'next/image';
import React from 'react';

export default function TermsHeader() {
  return (
    <header className="relative isolate overflow-hidden bg-[#075965] bg-[url(/fondo-frase-libre.webp)] bg-cover bg-center px-5 pb-20 pt-20 text-center sm:px-6 lg:pb-24 lg:pt-24">
      <div className="absolute inset-0 bg-[#075965]/55" />

      <div className="relative z-10 mx-auto max-w-4xl">
        <Image
          src="/logo-navbar.png"
          alt="TravelGrin"
          width={150}
          height={62}
          priority
          className="mx-auto mb-5 h-auto w-[130px] object-contain sm:w-[150px]"
        />
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
