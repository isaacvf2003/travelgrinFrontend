import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const body = (await req.json().catch(() => ({}))) as Partial<{
    label: string;
    labelI18n: Record<string, string> | null;
    taxonomyType: string;
    imageUrl: string | null;
    isProfileBlock: boolean;
    isPublicVisible: boolean;
    type: "multi" | "single" | "range";
    order: number;
  }>;

  const updated = await prisma.filterGroup.update({
    where: { id: params.id },
    data: {
      label: body.label,
      labelI18n: body.labelI18n ?? undefined,
      taxonomyType: body.taxonomyType,
      imageUrl: body.imageUrl ?? undefined,
      isProfileBlock: body.isProfileBlock,
      isPublicVisible: body.isPublicVisible,
      type: body.type,
      order: body.order,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: Params) {
  await prisma.filterGroup.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
