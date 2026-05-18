import React from 'react';

export default function PassportTable() {
  return (
    <div className="my-7 overflow-hidden rounded-3xl border border-[#d7f1f0] bg-white shadow-[0_16px_40px_rgba(9,93,104,0.08)]">
      <div className="grid grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="border-b border-[#d7f1f0] bg-[#ecfffd] p-5 md:border-b-0 md:border-r">
          <p className="text-sm font-extrabold text-[#075965]">
            Dato de pasaporte al registrarse
          </p>
        </div>
        <div className="p-5">
          <p className="text-sm leading-7 text-[#40535a]">
            Al crear tu cuenta como usuario viajero, deberás indicar el país de tu pasaporte. Este dato es necesario para personalizar la experiencia y mostrarte oportunidades relevantes para tu perfil migratorio o de viaje. Es tratado de acuerdo con lo establecido en la sección de Privacidad de este documento.
          </p>
        </div>
      </div>
    </div>
  );
}
