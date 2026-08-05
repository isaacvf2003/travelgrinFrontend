import React from 'react';
import { useTranslation } from '@/app/hooks/useTranslation';

const tableTranslations: Record<string, { title: string; body: string }> = {
  es: {
    title: "Dato de pasaporte al registrarse",
    body: "Al crear tu cuenta como usuario viajero, deberás indicar el país de tu pasaporte. Este dato es necesario para personalizar la experiencia y mostrarte oportunidades relevantes para tu perfil migratorio o de viaje. Es tratado de acuerdo con lo establecido en la sección de Privacidad de este documento."
  },
  en: {
    title: "Passport data when registering",
    body: "When creating your traveler user account, you must indicate your passport country. This information is required to personalize your experience and show you opportunities relevant to your travel or immigration profile. It is treated in accordance with the Privacy section of this document."
  },
  pt: {
    title: "Dados de passaporte ao registrar-se",
    body: "Ao criar sua conta como usuário viajante, você deverá indicar o país do seu passaporte. Esta informação é necessária para personalizar a experiência e mostrar-lhe oportunidades relevantes para o seu perfil migratorio ou de viagem. Ela é tratada em conformidade com o estabelecido na seção de Privacidade deste documento."
  },
  it: {
    title: "Dati del passaporto alla registrazione",
    body: "Quando crei il tuo account come utente viaggiatore, dovrai indicare il paese del tuo passaporto. Questa informazione è necessaria per personalizzare l'esperienza e mostrarti opportunità rilevanti per il tuo profilo migratorio o di viaggio. Vengono trattati in conformità con quanto stabilito nella sezione Privacy di questo documento."
  }
};

export default function PassportTable() {
  const { locale } = useTranslation();
  const t = tableTranslations[locale] || tableTranslations.es;

  return (
    <div className="my-7 overflow-hidden rounded-3xl border border-[#d7f1f0] bg-white shadow-[0_16px_40px_rgba(9,93,104,0.08)]">
      <div className="grid grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="border-b border-[#d7f1f0] bg-[#ecfffd] p-5 md:border-b-0 md:border-r">
          <p className="text-sm font-extrabold text-[#075965]">
            {t.title}
          </p>
        </div>
        <div className="p-5">
          <p className="text-sm leading-7 text-[#40535a]">
            {t.body}
          </p>
        </div>
      </div>
    </div>
  );
}
