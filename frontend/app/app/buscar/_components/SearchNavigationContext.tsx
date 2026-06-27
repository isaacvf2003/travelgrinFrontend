"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ApplySearchParams = (updater: (draft: URLSearchParams) => void) => void;

type SearchNavigationContextValue = {
  params: URLSearchParams;
  applySearchParams: ApplySearchParams;
  isNavigating: boolean;
};

const SearchNavigationContext = createContext<SearchNavigationContextValue | null>(null);

function nextUrl(pathname: string, sp: URLSearchParams) {
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function canonicalParams(sp: URLSearchParams) {
  const entries = Array.from(sp.entries()).sort(([ka, va], [kb, vb]) => {
    if (ka === kb) return va.localeCompare(vb);
    return ka.localeCompare(kb);
  });
  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

function readCurrentParams(fallback: URLSearchParams) {
  if (typeof window === "undefined") return new URLSearchParams(fallback.toString());
  return new URLSearchParams(window.location.search);
}

export function SearchNavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();

  const params = useMemo(() => new URLSearchParams(sp.toString()), [sp]);
  const [isNavigating, setIsNavigating] = useState(false);
  const navTokenRef = useRef(0);

  useEffect(() => {
    navTokenRef.current += 1;
    setIsNavigating(false);
  }, [sp]);

  const applySearchParams = useCallback<ApplySearchParams>(
    (updater) => {
      const currentCommitted = new URLSearchParams(sp.toString());
      const draft = readCurrentParams(currentCommitted);
      updater(draft);

      if (canonicalParams(draft) === canonicalParams(currentCommitted)) return;

      navTokenRef.current += 1;
      const token = navTokenRef.current;
      setIsNavigating(true);

      router.replace(nextUrl(pathname, draft), { scroll: false });

      window.setTimeout(() => {
        if (navTokenRef.current !== token) return;
        setIsNavigating(false);
      }, 3500);
    },
    [pathname, router, sp]
  );

  const value = useMemo<SearchNavigationContextValue>(
    () => ({
      params,
      applySearchParams,
      isNavigating,
    }),
    [params, applySearchParams, isNavigating]
  );

  return <SearchNavigationContext.Provider value={value}>{children}</SearchNavigationContext.Provider>;
}

export function useSearchNavigation() {
  const ctx = useContext(SearchNavigationContext);
  if (!ctx) {
    throw new Error("useSearchNavigation must be used within SearchNavigationProvider");
  }
  return ctx;
}
