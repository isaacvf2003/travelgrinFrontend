"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function safeBase64Decode(value: string) {
  try {
    if (!value) return "";
    return atob(value);
  } catch {
    return "";
  }
}

export default function FeaturedPaymentLaunchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectEncoded = String(searchParams.get("redirect") ?? "").trim();
  const serviceId = String(searchParams.get("serviceId") ?? "").trim();
  const status = String(searchParams.get("state") ?? "").trim().toLowerCase();
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
    const payload = JSON.stringify({
      status: "cancel",
      serviceId,
      at: Date.now(),
    });
    try {
      window.localStorage.setItem("tg-featured-payment-result", payload);
    } catch {}
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: "tg-featured-payment-result", status: "cancel", serviceId }, window.location.origin);
        window.opener.focus();
      } catch {}
    }
    fetch("/api/payments/featured/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceId, status: "cancel" }),
    }).catch(() => null).finally(() => {
      try {
        window.close();
      } catch {}
      router.replace(`/panel-oferente?featuredPayment=cancel&serviceId=${encodeURIComponent(serviceId)}`);
    });
  }, [redirectUrl, router, serviceId, status, storageKey]);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center px-4">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-[#273166]">
          {status === "preparing" ? "Preparando pago" : "Conectando con dLocal Go"}
        </h1>
        <p className="mt-3 text-slate-600">
          {status === "preparing"
            ? "Estamos generando tu checkout seguro en una pestana aparte."
            : "Te estamos enviando al checkout. Si volves atras o cerras esta pestana, el pago se marcara como cancelado."}
        </p>
      </section>
    </main>
  );
}
