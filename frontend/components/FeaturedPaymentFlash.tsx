"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { useCountry } from "@/app/context/CountryProvider";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function FeaturedPaymentFlash() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { setIsOpenModal, setIsOpenModalOferente } = useCountry();
  const { locale } = useTranslation();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) return;
    const status = String(searchParams.get("featuredPayment") ?? "").trim().toLowerCase();
    const serviceId = String(searchParams.get("serviceId") ?? "").trim();
    if (!status) return;
    shownRef.current = true;

    const i18n = {
      es: {
        paid: "Tu pago fue procesado. Pronto verás la publicación en la web.",
        cancel: "Pago no completado. Podés intentarlo nuevamente cuando quieras.",
        check: "Estamos verificando el estado de tu pago.",
        free: "Tu publicación seguirá en plan gratis.",
        u120: "Elegiste destacar por 120 días. Completá el pago para activarlo.",
        umonth: "Elegiste plan mensual. Completá el pago para activarlo.",
      },
      en: {
        paid: "Your payment was processed. You will soon see your publication on the website.",
        cancel: "Payment not completed. You can try again whenever you want.",
        check: "We are checking your payment status.",
        free: "Your publication will remain on the free plan.",
        u120: "You chose 120-day featured. Complete payment to activate it.",
        umonth: "You chose monthly plan. Complete payment to activate it.",
      },
      pt: {
        paid: "Seu pagamento foi processado. Em breve você verá sua publicação no site.",
        cancel: "Pagamento não concluído. Você pode tentar novamente quando quiser.",
        check: "Estamos verificando o status do seu pagamento.",
        free: "Sua publicação continuará no plano gratuito.",
        u120: "Você escolheu destaque por 120 dias. Conclua o pagamento para ativar.",
        umonth: "Você escolheu plano mensal. Conclua o pagamento para ativar.",
      },
      it: {
        paid: "Il tuo pagamento è stato elaborato. Presto vedrai la pubblicazione sul sito.",
        cancel: "Pagamento non completato. Puoi riprovare quando vuoi.",
        check: "Stiamo verificando lo stato del tuo pagamento.",
        free: "La tua pubblicazione rimarrà nel piano gratuito.",
        u120: "Hai scelto evidenza per 120 giorni. Completa il pagamento per attivarla.",
        umonth: "Hai scelto il piano mensile. Completa il pagamento per attivarlo.",
      },
    } as const;
    const tx = i18n[(locale as keyof typeof i18n) ?? "es"] ?? i18n.es;

    const showToastForStatus = (resolvedStatus: string) => {
      if (resolvedStatus === "success" || resolvedStatus === "approved" || resolvedStatus === "paid") {
        toast.success(tx.paid, { duration: 7000 });
      } else if (resolvedStatus === "cancel" || resolvedStatus === "cancelled" || resolvedStatus === "back" || resolvedStatus === "failed") {
        toast(tx.cancel, { duration: 6000 });
        setTimeout(() => {
          setIsOpenModal(true);
          setIsOpenModalOferente(true);
        }, 350);
      } else if (resolvedStatus === "keep_free") {
        toast.success(tx.free, { duration: 6000 });
      } else if (resolvedStatus === "upgrade_one_time") {
        toast.success(tx.u120, { duration: 6000 });
        setTimeout(() => {
          setIsOpenModal(true);
          setIsOpenModalOferente(true);
        }, 350);
      } else if (resolvedStatus === "upgrade_monthly") {
        toast.success(tx.umonth, { duration: 6000 });
        setTimeout(() => {
          setIsOpenModal(true);
          setIsOpenModalOferente(true);
        }, 350);
      } else {
        toast(tx.check, { duration: 6000 });
      }
    };

    const reconcile = async () => {
      let resolvedStatus = status;
      if (serviceId) {
        try {
          const response = await fetch("/api/payments/featured/return", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serviceId, status }),
          });
          const data = await response.json().catch(() => ({}));
          const backendStatus = String(data?.status ?? "").trim().toLowerCase();
          if (response.ok && backendStatus) {
            resolvedStatus =
              ["paid", "approved", "completed", "success"].includes(backendStatus) ? "paid" :
              ["processing", "pending"].includes(backendStatus) ? "check" :
              ["failed", "cancelled"].includes(backendStatus) ? "cancel" :
              status;
          }
        } catch {
          resolvedStatus = status;
        }
      }
      showToastForStatus(resolvedStatus);
    };

    void reconcile();

    const next = new URLSearchParams(searchParams.toString());
    next.delete("featuredPayment");
    next.delete("serviceId");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [locale, pathname, router, searchParams, setIsOpenModal, setIsOpenModalOferente]);

  return null;
}
