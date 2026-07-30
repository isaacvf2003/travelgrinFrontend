"use client";

import type { Publication, Category, FilterGroup } from "@/app/lib/types";
import { PublicationCard } from "./PublicationCard";

export default function ResultsGrid({
  items,
  categories,
  filterGroups,
}: {
  items: Publication[];
  categories?: Category[];
  filterGroups?: FilterGroup[];
}) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {items.map((p) => (
        <PublicationCard key={p.id} item={p} categories={categories} filterGroups={filterGroups} />
      ))}
    </div>
  );
}
