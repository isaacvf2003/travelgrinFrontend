import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const groupId = String(body.groupId ?? "").trim();
    const labelI18n = (body.labelI18n ?? null) as Record<string, string> | null;
    const esLabel = String(labelI18n?.es ?? "").trim();
    const label = [esLabel, body.label]
      .map((v) => String(v ?? "").trim())
      .find((v) => v.length) ?? "";
    const value = String(body.value ?? "").trim();
    const order = Number(body.order ?? 10);
    const parentId = body.parentId ? String(body.parentId) : null;

    if (!Object.keys(body ?? {}).length) {
      return NextResponse.json({ ok: false, error: "Body JSON inválido o vacío." }, { status: 400 });
    }

    if (!esLabel) {
      return NextResponse.json({ ok: false, error: "El label en Español es obligatorio." }, { status: 400 });
    }
    if (!groupId || !label || !value) {
      return NextResponse.json({ ok: false, error: "Missing groupId/label/value" }, { status: 400 });
    }

    const group = await prisma.filterGroup.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ ok: false, error: "Group not found" }, { status: 404 });
    const created = await prisma.filterOption.create({
      data: {
        groupId,
        label,
        labelI18n: labelI18n ?? { es: label },
        value,
        order: Number.isFinite(order) ? order : 10,
        parentId,
      },
    });

    return NextResponse.json({ ok: true, option: created });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  // delete children first
  await prisma.filterOption.deleteMany({ where: { parentId: id } });
  await prisma.filterOption.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
