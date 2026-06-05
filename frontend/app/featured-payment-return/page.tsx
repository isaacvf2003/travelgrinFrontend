"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ReturnStatus = "success" | "cancel" | "pending";
type ReturnLocale = "es" | "en" | "pt" | "it";

const RETURN_TEXT: Record<ReturnLocale, {
  successTitle: string;
  successDescription: string;
  cancelTitle: string;
  cancelDescription: string;
  pendingTitle: string;
  pendingDescription: string;
  redirecting: string;
  seconds: string;
}> = {
  es: {
    successTitle: "Pago procesado",
    successDescription: "Tu pago fue aceptado y la solicitud ya quedó lista para revisión del admin.",
    cancelTitle: "Pago no completado",
    cancelDescription: "Volviste sin completar el pago. Podés intentarlo nuevamente cuando quieras.",
    pendingTitle: "Verificando pago",
    pendingDescription: "Estamos recibiendo la confirmación del pago.",
    redirecting: "Te redirigimos en",
    seconds: "segundos.",
  },
  en: {
    successTitle: "Payment processed",
    successDescription: "Your payment was accepted and the request is ready for admin review.",
    cancelTitle: "Payment not completed",
    cancelDescription: "You returned without completing the payment. You can try again whenever you want.",
    pendingTitle: "Checking payment",
    pendingDescription: "We are receiving the payment confirmation.",
    redirecting: "Redirecting in",
    seconds: "seconds.",
  },
  pt: {
    successTitle: "Pagamento processado",
    successDescription: "Seu pagamento foi aceito e a solicitação ficou pronta para revisão do admin.",
    cancelTitle: "Pagamento não concluído",
    cancelDescription: "Você voltou sem concluir o pagamento. Pode tentar novamente quando quiser.",
    pendingTitle: "Verificando pagamento",
    pendingDescription: "Estamos recebendo a confirmação do pagamento.",
    redirecting: "Redirecionamos em",
    seconds: "segundos.",
  },
  it: {
    successTitle: "Pagamento elaborato",
    successDescription: "Il pagamento è stato accettato e la richiesta è pronta per la revisione dell'admin.",
    cancelTitle: "Pagamento non completato",
    cancelDescription: "Sei tornato senza completare il pagamento. Puoi riprovare quando vuoi.",
    pendingTitle: "Verifica del pagamento",
    pendingDescription: "Stiamo ricevendo la conferma del pagamento.",
    redirecting: "Ti reindirizziamo tra",
    seconds: "secondi.",
  },
};

function normalizeStatus(raw: string): ReturnStatus {
  const value = raw.trim().toLowerCase();
  if (["success", "approved", "paid", "completed", "ok"].includes(value)) return "success";
  if (["cancel", "cancelled", "canceled", "back", "failed", "rejected", "not_found", "no_payment", "error"].includes(value)) return "cancel";
  return "pending";
}

export default function FeaturedPaymentReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryStatus = useMemo(
    () => normalizeStatus(String(searchParams.get("status") ?? searchParams.get("payment_status") ?? searchParams.get("result") ?? "")),
    [searchParams],
  );
  const serviceId = String(searchParams.get("serviceId") ?? "").trim();
  const localeParam = String(searchParams.get("locale") ?? "es").trim().toLowerCase();
  const locale = (["es", "en", "pt", "it"].includes(localeParam) ? localeParam : "es") as ReturnLocale;
  const copy = RETURN_TEXT[locale];
  const [secondsLeft, setSecondsLeft] = useState(2);
  const [resolvedResult, setResolvedResult] = useState<ReturnStatus>(queryStatus);
  const [hasNotifiedModal, setHasNotifiedModal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let ignore = false;
    const resolveAndNotify = async () => {
      if (serviceId) {
        try {
          window.sessionStorage.removeItem(`tg-featured-payment-launch:${serviceId}`);
        } catch {}
      }
      let nextResult = queryStatus;
      if (serviceId) {
        try {
          const response = await fetch("/api/payments/featured/return", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serviceId, status: queryStatus }),
          });
          const data = await response.json().catch(() => ({}));
          nextResult = response.ok && data?.ok !== false ? normalizeStatus(String(data?.status ?? queryStatus)) : "cancel";
        } catch {
          nextResult = "cancel";
        }
      }
      if (ignore) return;
      setResolvedResult(nextResult);
      const payload = JSON.stringify({
        status: nextResult,
        serviceId,
        at: Date.now(),
      });
      try {
        window.localStorage.setItem("tg-featured-payment-result", payload);
      } catch {}
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage({ type: "tg-featured-payment-result", status: nextResult, serviceId }, window.location.origin);
          window.opener.focus();
        } catch {}
      }
      setHasNotifiedModal(true);
    };
    void resolveAndNotify();
    return () => {
      ignore = true;
    };
  }, [queryStatus, serviceId]);

  useEffect(() => {
    if (!serviceId || resolvedResult !== "pending") return;
    const timer = window.setTimeout(() => {
      fetch("/api/payments/featured/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, status: "check" }),
      })
        .then((response) => response.json().catch(() => ({})))
        .then((data) => {
          if (data?.status) setResolvedResult(normalizeStatus(String(data.status)));
        })
        .catch(() => null);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [resolvedResult, serviceId]);

  useEffect(() => {
    if (!hasNotifiedModal) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [hasNotifiedModal]);

  useEffect(() => {
    if (!hasNotifiedModal) return;
    if (secondsLeft > 0) return;
    if (window.opener && !window.opener.closed) {
      try {
        window.close();
        return;
      } catch {}
    }
    const params = new URLSearchParams();
    params.set("featuredPayment", resolvedResult);
    if (serviceId) params.set("serviceId", serviceId);
    router.replace(`/panel-oferente?${params.toString()}`);
  }, [hasNotifiedModal, resolvedResult, router, secondsLeft, serviceId]);

  const title =
    resolvedResult === "success"
      ? copy.successTitle
      : resolvedResult === "cancel"
        ? copy.cancelTitle
        : copy.pendingTitle;
  const description =
    resolvedResult === "success"
      ? copy.successDescription
      : resolvedResult === "cancel"
        ? copy.cancelDescription
        : copy.pendingDescription;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center px-4">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-[#273166]">{title}</h1>
        <p className="mt-3 text-slate-600">{description}</p>
        {hasNotifiedModal ? (
          <p className="mt-5 text-sm text-slate-500">
            {copy.redirecting} <span className="font-semibold text-[#0B8FA3]">{secondsLeft}</span> {copy.seconds}
          </p>
        ) : null}
      </section>
    </main>
  );
}
