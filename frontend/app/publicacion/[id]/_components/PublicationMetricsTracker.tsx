"use client";

import { useEffect } from "react";

type MetricType = "view" | "lead" | "favorite" | "share";

function getVisitorId() {
  if (typeof window === "undefined") return "";
  const key = "tg_visitor_id";
  const current = window.localStorage.getItem(key);
  if (current) return current;
  const next = (typeof crypto !== "undefined" && "randomUUID" in crypto) ? crypto.randomUUID() : `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(key, next);
  return next;
}

export async function trackPublicationMetric(publicationId: string, metricType: MetricType) {
  if (!publicationId) return;
  try {
    await fetch("/api/publications/metrics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicationId, metricType, visitorId: getVisitorId() }),
      keepalive: true,
    });
  } catch {
    // silencioso
  }
}

export default function PublicationMetricsTracker({ publicationId }: { publicationId: string }) {
  useEffect(() => {
    trackPublicationMetric(publicationId, "view");
  }, [publicationId]);

  return null;
}
