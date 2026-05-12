"use client";

import type { Publication } from "@/app/lib/types";
import { PublicationCard } from "./PublicationCard";

export default function ResultsGrid({
  items,
}: {
  items: Publication[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {items.map((p) => (
        <PublicationCard key={p.id} item={p} />
      ))}
    </div>
  );
}
