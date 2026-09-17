import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/api/_lib/guard";

export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;

  const groups = await prisma.filterGroup.findMany({
    orderBy: { order: "asc" },
    include: {
      options: { orderBy: [{ order: "asc" }, { label: "asc" }] },
    },
  });
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  const { error } = requireAdmin();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    key: string;
    label: string;
    type: "multi" | "single" | "range";
    order: number;
  }>;

  if (!body.key || !body.label || !body.type) {
    return NextResponse.json({ error: "key, label and type are required" }, { status: 400 });
  }

  const created = await prisma.filterGroup.create({
    data: {
      key: body.key,
      label: body.label,
      type: body.type,
      order: body.order ?? 0,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
