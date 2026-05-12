"use client";

import { useCountry } from "@/app/context/CountryProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function BottomCards({ emptyState = false }: { emptyState?: boolean }) {
  const { t, locale } = useTranslation();
  const { setIsOpenModal, setIsOpenModalDemandante } = useCountry();

  const openDemandanteForm = () => {
    setIsOpenModal(true);
    setIsOpenModalDemandante(true);
  };
  const emptyCopy =
    locale === "en"
      ? {
          title: "We still couldn't find the right opportunities for you",
          description:
            "Tell us more about your trip purpose and we'll guide you toward the right next step.",
          cta: "Let's do it",
        }
      : locale === "pt"
        ? {
            title: "Ainda não encontramos oportunidades ideais para você",
            description:
              "Conte-nos mais sobre o propósito da sua viagem e vamos orientá-lo para o próximo passo certo.",
            cta: "Vamos nessa",
          }
        : locale === "it"
          ? {
              title: "Non abbiamo ancora trovato le opportunità giuste per te",
              description:
                "Raccontaci meglio il tuo obiettivo di viaggio e ti guideremo verso il passo successivo più adatto.",
              cta: "Andiamo",
            }
          : {
              title: "Todavía no encontramos oportunidades ideales para vos",
              description:
                "Contanos mejor el propósito de tu viaje y te guiamos hacia el próximo paso indicado.",
              cta: "Vamos por ello",
            };

  return (
    <div className="mt-8 space-y-4">
      <div className="rounded-2xl bg-[#D8F3F0] px-6 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white/70 text-xl">
            {emptyState ? "..." : "🌍"}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#0B2B30]">
              {emptyState ? emptyCopy.title : t("tu_proxima_aventura_titulo")}
            </h3>
            <p className="mt-1 text-sm text-[#6B7C80]">
              {emptyState ? emptyCopy.description : t("tu_proxima_aventura_descripcion")}
            </p>
            {emptyState ? (
              <button
                type="button"
                onClick={openDemandanteForm}
                className="mt-3 inline-flex items-center justify-center rounded-full bg-[#00A9C6] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                {emptyCopy.cta}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white px-6 py-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#D8F3F0] text-xl">
            ✉️
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[#0B2B30]">
              {t("recibe_oportunidades_titulo")}
            </h3>

            <button
              type="button"
              onClick={openDemandanteForm}
              className="mt-3 inline-flex items-center justify-center rounded-full bg-[#00A9C6] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              {t("viajar_por_un_cambio")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
