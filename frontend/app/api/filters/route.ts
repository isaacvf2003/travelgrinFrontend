import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function parseRange(value: string) {
  const match = String(value ?? "").trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

// Public: used by the search page to render dynamic filter groups.
export async function GET() {
  const groups = await prisma.filterGroup.findMany({
    where: { isProfileBlock: false, isPublicVisible: true },
    orderBy: { order: "asc" },
    include: {
      options: {
        orderBy: [{ order: "asc" }, { label: "asc" }],
      },
    },
  });

  const normalized = groups.map((g) => {
    if (g.key !== "price") return g;

    const ranges = g.options
      .map((opt) => parseRange(opt.value))
      .filter((opt): opt is { min: number; max: number } => Boolean(opt));

    const min = ranges.length ? Math.min(...ranges.map((r) => r.min)) : 0;
    const max = ranges.length ? Math.max(...ranges.map((r) => r.max)) : 1000000;

    return { ...g, min, max };
  });

  return NextResponse.json({ ok: true, groups: normalized });
}
