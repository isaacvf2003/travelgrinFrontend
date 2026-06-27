"use client";

import React from "react";
import { parseAmount } from "@/app/lib/currency";

type PlanItem = {
  publicationId: string;
  title: string;
  imageUrl?: string | null;
  price?: string | null;
  currency?: string | null;
  pricePeriod?: string | null;
};

type PlanState = {
  items: PlanItem[];
  toggle: (item: PlanItem) => void;
  has: (publicationId: string) => boolean;
  totalLabel: () => string;
  loading: boolean;
};

const PlanContext = React.createContext<PlanState | null>(null);
const PLAN_STORAGE_KEY = "tg_plan_items";
const PLAN_UPDATED_EVENT = "tg-plan-updated";

function parsePriceToNumber(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = parseAmount(value);
  return parsed ?? 0;
}

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<PlanItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  const persistPlan = React.useCallback((nextItems: PlanItem[]) => {
    try {
      window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(nextItems));
      window.dispatchEvent(new CustomEvent(PLAN_UPDATED_EVENT, { detail: { items: nextItems } }));
    } catch {
      // ignore
    }
  }, []);

  const fetchPlan = React.useCallback(async () => {
    try {
      const cachedRaw = window.localStorage.getItem(PLAN_STORAGE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (Array.isArray(cached)) setItems(cached);
      }
    } catch {
      // ignore
    }
    try {
      const res = await fetch("/api/plan", { cache: "no-store", credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setItems(nextItems);
      persistPlan(nextItems);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [persistPlan]);

  React.useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const toggle = React.useCallback(
    (item: PlanItem) => {
      const exists = items.some((x) => x.publicationId === item.publicationId);
      setItems((prev) => {
        const nextItems = exists
          ? prev.filter((x) => x.publicationId !== item.publicationId)
          : [...prev, item];
        persistPlan(nextItems);
        return nextItems;
      });
      const run = async () => {
        try {
          const method = exists ? "DELETE" : "POST";
          await fetch("/api/plan", {
            method,
            headers: { "content-type": "application/json" },
            body: JSON.stringify(item),
            credentials: "include",
          });
          await fetchPlan();
        } catch {
          // ignore
        }
      };
      run();
    },
    [items, fetchPlan, persistPlan]
  );

  const has = React.useCallback(
    (publicationId: string) => items.some((x) => x.publicationId === publicationId),
    [items]
  );

  const totalLabel = React.useCallback(() => {
    const total = items.reduce((sum, it) => sum + parsePriceToNumber(it.price), 0);
    if (!total) return "$0";
    // Simple AR-style formatting
    return new Intl.NumberFormat("es-AR").format(total);
  }, [items]);

  const value: PlanState = React.useMemo(
    () => ({ items, toggle, has, totalLabel, loading }),
    [items, toggle, has, totalLabel, loading]
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = React.useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
