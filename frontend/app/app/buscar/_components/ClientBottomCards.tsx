"use client";

import BottomCards from "./BottomCards";

export default function ClientBottomCards({ emptyState = false }: { emptyState?: boolean }) {
  return <BottomCards emptyState={emptyState} />;
}
