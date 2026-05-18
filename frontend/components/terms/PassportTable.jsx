import React from 'react';

export default function PassportTable() {
  return (
    <div className="my-6 rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="bg-primary/5 p-5 border-b md:border-b-0 md:border-r border-border">
          <p className="font-heading font-semibold text-primary text-sm mb-1">
            Dato de pasaporte al registrarse
          </p>
        </div>
        <div className="p-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Al crear tu cuenta como usuario viajero, deberás indicar el país de tu pasaporte. Este dato es necesario para personalizar la experiencia y mostrarte oportunidades relevantes para tu perfil migratorio o de viaje. Es tratado de acuerdo con lo establecido en la sección de Privacidad de este documento.
          </p>
        </div>
      </div>
    </div>
  );
}