import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
export const dynamic = "force-dynamic";
const CATEGORY_ICON_META_KEY = "__iconImageUrl";
const CATEGORY_CARD_IMAGE_META_KEY = "__cardImageUrl";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

async function categoryOrderColumnExists() {
  try {
    const tableInfo = await prisma.$queryRaw<Array<{ name: string }>>`PRAGMA table_info("categories")`;
    return tableInfo.some((column) => column.name === "order");
  } catch {
    return false;
  }
}

async function readCategoryOrderMap() {
  if (!(await categoryOrderColumnExists())) return null;
  const rows = await prisma.$queryRaw<Array<{ id: string; order_value: number | null }>>`SELECT "id", [order] as order_value FROM "categories"`;
  const map = new Map<string, number>();
  rows.forEach((row) => map.set(row.id, Number(row.order_value ?? 0)));
  return map;
}

function sortCategoriesWithOrder<T extends { id: string; blockId: string | null; parentId: string | null; description: string }>(
  items: T[],
  orderMap: Map<string, number> | null
) {
  return [...items].sort((a, b) => {
    const blockCompare = String(a.blockId ?? "").localeCompare(String(b.blockId ?? ""));
    if (blockCompare !== 0) return blockCompare;
    const parentCompare = String(a.parentId ?? "").localeCompare(String(b.parentId ?? ""));
    if (parentCompare !== 0) return parentCompare;
    const orderCompare = (orderMap?.get(a.id) ?? 0) - (orderMap?.get(b.id) ?? 0);
    if (orderCompare !== 0) return orderCompare;
    return (a.description ?? "").localeCompare(b.description ?? "");
  });
}

function normalizeTaxonomyType(input: unknown) {
  const raw = String(input ?? "").trim().toLowerCase();
  if (["", "default", "inherit", "predeterminado"].includes(raw)) return "";
  if (["voluntariado", "voluntario", "voluntariados", "destino", "destinos"].includes(raw)) return "categoria";
  return raw;
}

function readCategoryIconFromI18n(i18n: unknown) {
  if (!i18n || typeof i18n !== "object") return null;
  const iconValue = (i18n as Record<string, unknown>)[CATEGORY_ICON_META_KEY];
  const icon = String(iconValue ?? "").trim();
  return icon || null;
}

function readCategoryCardImageFromI18n(i18n: unknown) {
  if (!i18n || typeof i18n !== "object") return null;
  const imageValue = (i18n as Record<string, unknown>)[CATEGORY_CARD_IMAGE_META_KEY];
  const image = String(imageValue ?? "").trim();
  return image || null;
}

function withCategoryIconInI18n(
  i18n: Record<string, string> | null | undefined,
  iconImageUrl: string | null,
  cardImageUrl: string | null
) {
  const next = { ...(i18n ?? {}) } as Record<string, string>;
  if (iconImageUrl) next[CATEGORY_ICON_META_KEY] = iconImageUrl;
  else delete next[CATEGORY_ICON_META_KEY];
  if (cardImageUrl) next[CATEGORY_CARD_IMAGE_META_KEY] = cardImageUrl;
  else delete next[CATEGORY_CARD_IMAGE_META_KEY];
  return next;
}

async function resolveInheritedTaxonomyType(parentId: string | null, blockId: string | null, seen = new Set<string>()): Promise<string | null> {
  if (parentId) {
    if (seen.has(parentId)) return null;
    seen.add(parentId);
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, taxonomyType: true, parentId: true, blockId: true },
    });
    if (!parent) return null;
    const parentType = normalizeTaxonomyType(parent.taxonomyType);
    if (parentType) return parentType;
    return resolveInheritedTaxonomyType(parent.parentId ?? null, parent.blockId ?? blockId, seen);
  }

  if (!blockId) return null;
  const block = await prisma.filterGroup.findUnique({ where: { id: blockId }, select: { taxonomyType: true } });
  const blockType = normalizeTaxonomyType(block?.taxonomyType ?? "");
  return blockType || "categoria";
}

export async function GET() {
  try {
    const [items, orderMap] = await Promise.all([
      prisma.category.findMany({ orderBy: [{ blockId: "asc" }, { parentId: "asc" }, { description: "asc" }] }),
      readCategoryOrderMap(),
    ]);
    const sorted = sortCategoriesWithOrder(items, orderMap).map((item) => ({
      ...item,
      order: orderMap?.get(item.id) ?? 0,
      iconImageUrl: readCategoryIconFromI18n(item.descriptionI18n),
      cardImageUrl: readCategoryCardImageFromI18n(item.descriptionI18n),
    }));
    return NextResponse.json({ ok: true, items: sorted });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error al listar categorías" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const descriptionI18n = (body?.descriptionI18n ?? null) as Record<string, string> | null;
    const esDescription = String(descriptionI18n?.es ?? "").trim();
    const description = [esDescription, body?.description]
      .map((v) => String(v ?? "").trim())
      .find((v) => v.length) ?? "";
    const rawTaxonomyType = normalizeTaxonomyType(body?.taxonomyType ?? "categoria");
    const parentIdRaw = body?.parentId;
    const blockIdRaw = body?.blockId;
    const parentId =
      parentIdRaw === null || parentIdRaw === undefined || parentIdRaw === ""
        ? null
        : parentIdRaw.toString();
    const blockId =
      blockIdRaw === null || blockIdRaw === undefined || blockIdRaw === ""
        ? null
        : blockIdRaw.toString();
    const isPublicVisible = body?.isPublicVisible !== false;
    const isPrimaryCategory = body?.isPrimaryCategory === true;
    const iconImageUrl = String(body?.iconImageUrl ?? "").trim() || null;
    const cardImageUrl = String(body?.cardImageUrl ?? "").trim() || null;

    if (!esDescription) return badRequest("El nombre en Español es obligatorio.");
    if (!description) return badRequest("Falta 'description'.");

    const parentCategory = parentId
      ? await prisma.category.findUnique({ where: { id: parentId }, select: { blockId: true } })
      : null;
    const resolvedBlockId = parentCategory?.blockId ?? blockId;

    const inheritedTaxonomyType = await resolveInheritedTaxonomyType(parentId, resolvedBlockId);
    const taxonomyType = !rawTaxonomyType
      ? String(inheritedTaxonomyType || "categoria").trim()
      : rawTaxonomyType;

    const existing = await prisma.category.findFirst({
      where: { description, parentId },
      select: { id: true },
    });
    if (existing) {
      return badRequest("Ya existe una categoría con ese nombre en ese nivel.");
    }

    const created = await prisma.category.create({
      data: {
        description,
        descriptionI18n: withCategoryIconInI18n(
          descriptionI18n ?? { es: description },
          isPrimaryCategory ? iconImageUrl : null,
          isPrimaryCategory ? cardImageUrl : null
        ),
        taxonomyType,
        parentId,
        blockId: resolvedBlockId,
        isPublicVisible,
        isPrimaryCategory,
      },
    });
    if (await categoryOrderColumnExists()) {
      const maxRows = await prisma.$queryRaw<Array<{ maxOrder: number | null }>>`
        SELECT MAX([order]) as "maxOrder"
        FROM "categories"
        WHERE "id" <> ${created.id}
          AND (
            ("parentId" IS NULL AND ${parentId} IS NULL)
            OR "parentId" = ${parentId}
          )
          AND (
            ("blockId" IS NULL AND ${resolvedBlockId} IS NULL)
            OR "blockId" = ${resolvedBlockId}
          )
      `;
      const nextOrder = Number(maxRows[0]?.maxOrder ?? -1) + 1;
      await prisma.$executeRaw`UPDATE "categories" SET [order] = ${nextOrder} WHERE "id" = ${created.id}`;
      (created as any).order = nextOrder;
    }

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error al crear categoría" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return badRequest("Falta 'id'.");

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error al eliminar categoría" },
      { status: 500 }
    );
  }
}
