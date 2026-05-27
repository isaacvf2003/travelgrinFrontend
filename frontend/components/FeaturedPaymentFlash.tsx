"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { useCountry } from "@/app/context/CountryProvider";

export default function FeaturedPaymentFlash() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { setIsOpenModal, setIsOpenModalOferente } = useCountry();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) return;
    const status = String(searchParams.get("featuredPayment") ?? "").trim().toLowerCase();
    if (!status) return;
    shownRef.current = true;

    if (status === "success" || status === "approved" || status === "paid") {
      toast.success("Tu pago fue procesado. Pronto verás la publicación en la web.", { duration: 7000 });
    } else if (status === "cancel" || status === "cancelled" || status === "back") {
      toast("Pago no completado. Podés intentarlo nuevamente cuando quieras.", { duration: 6000 });
      setTimeout(() => {
        setIsOpenModal(true);
        setIsOpenModalOferente(true);
      }, 350);
    } else {
      toast("Estamos verificando el estado de tu pago.", { duration: 6000 });
    }

    const next = new URLSearchParams(searchParams.toString());
    next.delete("featuredPayment");
    next.delete("serviceId");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, setIsOpenModal, setIsOpenModalOferente]);

  return null;
}
