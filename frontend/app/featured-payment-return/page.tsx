"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ReturnStatus = "success" | "cancel" | "pending";

function normalizeStatus(raw: string): ReturnStatus {
  const value = raw.trim().toLowerCase();
  if (["success", "approved", "paid", "ok"].includes(value)) return "success";
  if (["cancel", "cancelled", "canceled", "back", "failed", "rejected"].includes(value)) return "cancel";
  return "pending";
}

export default function FeaturedPaymentReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = useMemo(
    () => normalizeStatus(String(searchParams.get("status") ?? searchParams.get("payment_status") ?? searchParams.get("result") ?? "")),
    [searchParams],
  );
  const serviceId = String(searchParams.get("serviceId") ?? "").trim();
  const [secondsLeft, setSecondsLeft] = useState(6);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (secondsLeft > 0) return;
    const params = new URLSearchParams();
    params.set("featuredPayment", status);
    if (serviceId) params.set("serviceId", serviceId);
    router.replace(`/?${params.toString()}`);
  }, [router, secondsLeft, serviceId, status]);

  const title =
    status === "success"
      ? "Pago procesado"
      : status === "cancel"
        ? "Pago no completado"
        : "Verificando pago";
  const description =
    status === "success"
      ? "Tu pago fue procesado y estamos validando la publicación destacada."
      : status === "cancel"
        ? "Volviste sin completar el pago. Podés intentar nuevamente cuando quieras."
        : "Estamos recibiendo la confirmación del pago.";

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl items-center justify-center px-4">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-[#273166]">{title}</h1>
        <p className="mt-3 text-slate-600">{description}</p>
        <p className="mt-5 text-sm text-slate-500">
          Te redirigimos en <span className="font-semibold text-[#0B8FA3]">{secondsLeft}</span> segundos.
        </p>
      </section>
    </main>
  );
}

