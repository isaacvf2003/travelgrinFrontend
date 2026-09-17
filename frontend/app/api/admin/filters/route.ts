import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function normalizeTaxonomyType(input: unknown) {
  const raw = String(input ?? "").trim().toLowerCase();
  if (["", "default", "inherit", "predeterminado"].includes(raw)) return "";
  if (["voluntariado", "voluntario", "voluntariados", "destino", "destinos"].includes(raw)) return "categoria";
  return raw;
}

export async function GET() {
  const groups = await prisma.filterGroup.findMany({
    include: { options: true },
    orderBy: [{ order: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ ok: true, groups });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const key = String(body.key ?? "").trim();
    const labelI18n = (body.labelI18n ?? null) as Record<string, string> | null;
    const esLabel = String(labelI18n?.es ?? "").trim();
    const label = [esLabel, body.label]
      .map((v) => String(v ?? "").trim())
      .find((v) => v.length) ?? "";
    const type = String(body.type ?? "multi").trim();
    const taxonomyType = normalizeTaxonomyType(body.taxonomyType ?? "categoria") || "categoria";
    const isProfileBlock = Boolean(body.isProfileBlock ?? false);
    const isPublicVisible = body.isPublicVisible !== false;
    const imageUrl = String(body.imageUrl ?? "").trim() || null;
    const order = Number(body.order ?? 10);

    if (!esLabel) {
      return NextResponse.json({ ok: false, error: "El nombre en Español es obligatorio." }, { status: 400 });
    }
    if (!key || !label) {
      return NextResponse.json({ ok: false, error: "Missing key/label" }, { status: 400 });
    }

    if (key === "category" || key === "subcategory") {
      return NextResponse.json(
        { ok: false, error: "Reserved key" },
        { status: 400 }
      );
    }

    const existing = await prisma.filterGroup.findUnique({ where: { key } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "Key already exists" }, { status: 400 });
    }

    const created = await prisma.filterGroup.create({
      data: {
        key,
        label,
        labelI18n: labelI18n ?? { es: label },
        type,
        taxonomyType,
        isProfileBlock,
        isPublicVisible,
        imageUrl,
        order: Number.isFinite(order) ? order : 10,
      },
    });

    return NextResponse.json({ ok: true, group: created });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const group = await prisma.filterGroup.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const allGroups = await prisma.filterGroup.findMany({ select: { id: true } });
  const validGroupIds = new Set(allGroups.map((group) => group.id));
  const categories = await prisma.category.findMany({
    select: { id: true, parentId: true, blockId: true, taxonomyType: true },
  });
  const categoryIds = new Set(categories.map((category) => category.id));
  const childrenByParent = new Map<string, string[]>();
  categories.forEach((category) => {
    if (!category.parentId) return;
    childrenByParent.set(category.parentId, [...(childrenByParent.get(category.parentId) ?? []), category.id]);
  });

  const toDeleteCategoryIds = new Set<string>();
  const queue = categories.filter((category) => category.blockId === id).map((category) => category.id);
  while (queue.length) {
    const currentId = queue.shift()!;
    if (toDeleteCategoryIds.has(currentId)) continue;
    toDeleteCategoryIds.add(currentId);
    (childrenByParent.get(currentId) ?? []).forEach((childId) => queue.push(childId));
  }

  const orphanByMissingBlock = categories
    .filter((category) => category.blockId && !validGroupIds.has(category.blockId))
    .map((category) => category.id);
  const orphanByMissingParent = categories
    .filter((category) => category.parentId && !categoryIds.has(category.parentId))
    .map((category) => category.id);
  const staleOrphanIds = categories
    .filter((category) => !category.blockId && !category.parentId && normalizeTaxonomyType(category.taxonomyType) !== "categoria")
    .map((category) => category.id);

  await prisma.$transaction(async (tx) => {
    await tx.filterOption.deleteMany({ where: { groupId: id } });
    const allIds = Array.from(
      new Set([
        ...Array.from(toDeleteCategoryIds),
        ...orphanByMissingBlock,
        ...orphanByMissingParent,
        ...staleOrphanIds,
      ])
    );
    if (allIds.length) {
      await tx.category.deleteMany({ where: { id: { in: allIds } } });
    }
    await tx.filterGroup.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true });
}
