"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type LaunchLocale = "es" | "en" | "pt" | "it";
type LaunchStatus = "success" | "cancel" | "pending";

const LAUNCH_TEXT: Record<LaunchLocale, { preparingTitle: string; preparingDescription: string; connectingTitle: string; connectingDescription: string }> = {
  es: {
    preparingTitle: "Preparando pago",
    preparingDescription: "Estamos generando tu checkout seguro.",
    connectingTitle: "Conectando con dLocal Go",
    connectingDescription: "Te estamos enviando al checkout seguro.",
  },
  en: {
    preparingTitle: "Preparing payment",
    preparingDescription: "We are creating your secure checkout.",
    connectingTitle: "Connecting with dLocal Go",
    connectingDescription: "We are taking you to the secure checkout.",
  },
  pt: {
    preparingTitle: "Preparando pagamento",
    preparingDescription: "Estamos criando seu checkout seguro.",
    connectingTitle: "Conectando com dLocal Go",
    connectingDescription: "Estamos levando voce ao checkout seguro.",
  },
  it: {
    preparingTitle: "Preparazione del pagamento",
    preparingDescription: "Stiamo creando il tuo checkout sicuro.",
    connectingTitle: "Connessione con dLocal Go",
    connectingDescription: "Ti stiamo portando al checkout sicuro.",
  },
};

function safeBase64Decode(value: string) {
  try {
    if (!value) return "";
    return atob(value);
  } catch {
    return "";
  }
}

function normalizeResult(raw: string): LaunchStatus {
  const value = String(raw ?? "").trim().toLowerCase();
  if (["success", "approved", "paid", "completed", "ok"].includes(value)) return "success";
  if (["pending", "processing", "in_process", "authorized"].includes(value)) return "pending";
  return "cancel";
}

export default function FeaturedPaymentLaunchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectEncoded = String(searchParams.get("redirect") ?? "").trim();
  const serviceId = String(searchParams.get("serviceId") ?? "").trim();
  const status = String(searchParams.get("state") ?? "").trim().toLowerCase();
  const localeParam = String(searchParams.get("locale") ?? "es").trim().toLowerCase();
  const locale = (["es", "en", "pt", "it"].includes(localeParam) ? localeParam : "es") as LaunchLocale;
  const copy = LAUNCH_TEXT[locale];
  const redirectUrl = useMemo(() => safeBase64Decode(redirectEncoded), [redirectEncoded]);
  const storageKey = useMemo(() => `tg-featured-payment-launch:${serviceId || "unknown"}`, [serviceId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (status === "preparing" || !serviceId || !redirectUrl) return;
    const alreadyLaunched = window.sessionStorage.getItem(storageKey) === "1";
    if (!alreadyLaunched) {
      window.sessionStorage.setItem(storageKey, "1");
      window.location.replace(redirectUrl);
      return;
    }

    window.sessionStorage.removeItem(storageKey);
    fetch("/api/payments/featured/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, status: "cancel" }),
    })
      .then((response) => response.json().catch(() => ({})))
      .then((data) => normalizeResult(String(data?.status ?? "cancel")))
      .catch(() => "cancel" as const)
      .then((resolvedStatus) => {
        const payload = JSON.stringify({
          status: resolvedStatus,
          serviceId,
          at: Date.now(),
        });
        try {
          window.localStorage.setItem("tg-featured-payment-result", payload);
        } catch {}
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: "tg-featured-payment-result", status: resolvedStatus, serviceId }, window.location.origin);
            window.opener.focus();
          } catch {}
        }
        try {
          window.close();
        } catch {}
        router.replace(`/panel-oferente?featuredPayment=${resolvedStatus}&serviceId=${encodeURIComponent(serviceId)}`);
      });
  }, [redirectUrl, router, serviceId, status, storageKey]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center px-4">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-[#273166]">
          {status === "preparing" ? copy.preparingTitle : copy.connectingTitle}
        </h1>
        <p className="mt-3 text-slate-600">
          {status === "preparing" ? copy.preparingDescription : copy.connectingDescription}
        </p>
      </section>
    </main>
  );
}
