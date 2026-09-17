"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCountry } from "@/app/context/CountryProvider";
import { useTranslation } from "@/app/hooks/useTranslation";
import { claritySetTag, clarityEvent } from "@/app/lib/clarity";

function ClarityTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  let selectedCountry: string | undefined;
  try {
    const countryContext = useCountry();
    selectedCountry = countryContext?.selectedCountry;
  } catch {}

  let locale: string | undefined;
  try {
    const translation = useTranslation();
    locale = translation?.locale;
  } catch {}

  useEffect(() => {
    if (!pathname) return;
    try {
      const queryString = searchParams?.toString();
      const fullUrl = queryString ? `${pathname}?${queryString}` : pathname;

      claritySetTag("page_path", pathname);
      claritySetTag("full_url", fullUrl);

      let section = "home";
      if (pathname.startsWith("/buscar")) section = "buscar";
      else if (pathname.startsWith("/prestacion") || pathname.startsWith("/prestaciones")) section = "prestaciones";
      else if (pathname.startsWith("/publicacion")) section = "publicacion";
      else if (pathname.startsWith("/panel-oferente") || pathname.startsWith("/tgn-panel-control")) section = "panel_administracion";
      else if (pathname.startsWith("/mi-plan")) section = "planes";
      else if (pathname.startsWith("/quienes-somos")) section = "nosotros";

      claritySetTag("section", section);
      clarityEvent(`navigate_${section}`);
    } catch {}
  }, [pathname, searchParams]);

  useEffect(() => {
    if (selectedCountry) {
      try {
        claritySetTag("selected_country", selectedCountry);
      } catch {}
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (locale) {
      try {
        claritySetTag("language", locale);
      } catch {}
    }
  }, [locale]);

  useEffect(() => {
    try {
      const userToken = typeof window !== "undefined" ? (localStorage.getItem("travelgrin_token") || localStorage.getItem("token")) : null;
      const userRole = typeof window !== "undefined" ? (localStorage.getItem("travelgrin_role") || localStorage.getItem("user_role")) : null;

      if (userToken) {
        claritySetTag("auth_status", "logged_in");
        if (userRole) {
          claritySetTag("user_role", userRole);
        }
      } else {
        claritySetTag("auth_status", "visitor");
      }
    } catch {}
  }, [pathname]);

  return null;
}

export default function ClarityTracker() {
  return <ClarityTrackerInner />;
}
