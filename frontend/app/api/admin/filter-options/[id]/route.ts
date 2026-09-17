import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/api/_lib/guard";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const { error } = requireAdmin();
  if (error) return error;

  const body = (await req.json()) as {
    label?: string;
    labelI18n?: Record<string, string> | null;
    value?: string;
    order?: number;
    parentId?: string | null;
  };

  const updated = await prisma.filterOption.update({
    where: { id: params.id },
    data: {
      label: body.label,
      labelI18n: body.labelI18n ?? undefined,
      value: body.value,
      order: body.order,
      parentId: body.parentId,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  const { error } = requireAdmin();
  if (error) return error;

  await prisma.filterOption.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
