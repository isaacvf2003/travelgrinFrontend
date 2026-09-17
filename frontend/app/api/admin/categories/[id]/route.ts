import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
const CATEGORY_ICON_META_KEY = "__iconImageUrl";
const CATEGORY_CARD_IMAGE_META_KEY = "__cardImageUrl";

async function categoryOrderColumnExists() {
  try {
    const tableInfo = await prisma.$queryRaw<Array<{ name: string }>>`PRAGMA table_info("categories")`;
    return tableInfo.some((column) => column.name === "order");
  } catch {
    return false;
  }
}

function normalizeTaxonomyType(input: unknown) {
  const raw = String(input ?? "").trim().toLowerCase();
  if (["", "default", "inherit", "predeterminado"].includes(raw)) return "";
  if (["voluntariado", "voluntario", "voluntariados", "destino", "destinos"].includes(raw)) return "categoria";
  return raw;
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

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Partial<{
    description: string;
    descriptionI18n: Record<string, string> | null;
    taxonomyType: string;
    parentId: string | null;
    blockId: string | null;
    isPublicVisible: boolean;
    isPrimaryCategory: boolean;
    iconImageUrl: string | null;
    cardImageUrl: string | null;
    order: number;
  }>;

  const parentId = body.parentId ?? null;
  const blockId = body.blockId ?? null;
  const rawTaxonomyType = normalizeTaxonomyType(body.taxonomyType ?? "categoria");

  const parentCategory = parentId
    ? await prisma.category.findUnique({ where: { id: parentId }, select: { blockId: true } })
    : null;
  const resolvedBlockId = parentCategory?.blockId ?? blockId;
  const inheritedTaxonomyType = await resolveInheritedTaxonomyType(parentId, resolvedBlockId);
  const resolvedTaxonomyType = !rawTaxonomyType
    ? String(inheritedTaxonomyType || "categoria").trim()
    : rawTaxonomyType;

  const existingCategory = await prisma.category.findUnique({
    where: { id: params.id },
    select: { descriptionI18n: true, isPrimaryCategory: true },
  });
  if (!existingCategory) {
    return NextResponse.json({ ok: false, error: "Categoría no encontrada" }, { status: 404 });
  }
  const iconImageUrlInput = String(body.iconImageUrl ?? "").trim() || null;
  const cardImageUrlInput = String(body.cardImageUrl ?? "").trim() || null;
  const iconImageUrl =
    body.iconImageUrl === undefined
      ? readCategoryIconFromI18n(existingCategory.descriptionI18n)
      : iconImageUrlInput;
  const cardImageUrl =
    body.cardImageUrl === undefined
      ? readCategoryCardImageFromI18n(existingCategory.descriptionI18n)
      : cardImageUrlInput;
  const isPrimaryCategory =
    body.isPrimaryCategory === undefined ? existingCategory.isPrimaryCategory === true : body.isPrimaryCategory === true;

  const updated = await prisma.category.update({
    where: { id: params.id },
    data: {
      description: body.description,
      descriptionI18n: body.descriptionI18n
        ? withCategoryIconInI18n(
            body.descriptionI18n,
            isPrimaryCategory ? iconImageUrl : null,
            isPrimaryCategory ? cardImageUrl : null
          )
        : withCategoryIconInI18n(
            (existingCategory.descriptionI18n as Record<string, string> | null | undefined) ?? null,
            isPrimaryCategory ? iconImageUrl : null,
            isPrimaryCategory ? cardImageUrl : null
          ),
      taxonomyType: resolvedTaxonomyType,
      parentId,
      blockId,
      isPublicVisible: body.isPublicVisible,
      isPrimaryCategory,
    },
  });
  if (Number.isFinite(Number(body.order)) && await categoryOrderColumnExists()) {
    await prisma.$executeRaw`UPDATE "categories" SET [order] = ${Number(body.order)} WHERE "id" = ${params.id}`;
    (updated as any).order = Number(body.order);
  }

  return NextResponse.json({ ok: true, item: updated });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const target = await prisma.category.findUnique({
    where: { id: params.id },
    select: { id: true, blockId: true, description: true, taxonomyType: true },
  });
  if (!target) return NextResponse.json({ ok: false, error: "Categoría no encontrada" }, { status: 404 });

  const categories = await prisma.category.findMany({
    select: { id: true, parentId: true, blockId: true, description: true, taxonomyType: true },
  });
  const childrenByParent = new Map<string, Array<{ id: string; blockId: string | null; description: string; taxonomyType: string }>>();
  categories.forEach((category) => {
    if (!category.parentId) return;
    childrenByParent.set(category.parentId, [
      ...(childrenByParent.get(category.parentId) ?? []),
      { id: category.id, blockId: category.blockId, description: category.description, taxonomyType: category.taxonomyType },
    ]);
  });

  const toDeleteIds = new Set<string>();
  const categoryIdsByBlock = new Map<string, Set<string>>();
  const queue = [{ id: target.id, blockId: target.blockId, description: target.description, taxonomyType: target.taxonomyType }];
  while (queue.length) {
    const current = queue.shift()!;
    if (toDeleteIds.has(current.id)) continue;
    toDeleteIds.add(current.id);
    const normalizedTaxonomyType = normalizeTaxonomyType(current.taxonomyType || "");
    if (current.blockId && normalizedTaxonomyType !== "categoria") {
      const bucket = categoryIdsByBlock.get(current.blockId) ?? new Set<string>();
      bucket.add(current.id);
      categoryIdsByBlock.set(current.blockId, bucket);
    }
    (childrenByParent.get(current.id) ?? []).forEach((child) => queue.push(child));
  }

  await prisma.$transaction(async (tx) => {
    for (const [blockId, categoryIds] of categoryIdsByBlock.entries()) {
      const options = await tx.filterOption.findMany({
        where: { groupId: blockId },
        select: { id: true, label: true, parentId: true },
      });
      const byLabel = new Map<string, string[]>();
      options.forEach((option) => byLabel.set(option.label, [...(byLabel.get(option.label) ?? []), option.id]));
      const categoryDescriptions = categories
        .filter((category) => categoryIds.has(category.id))
        .map((category) => category.description);
      const seedIds = categoryDescriptions.flatMap((description) => byLabel.get(description) ?? []);
      const toDeleteOptionIds = new Set(seedIds);
      let changed = true;
      while (changed) {
        changed = false;
        options.forEach((option) => {
          if (option.parentId && toDeleteOptionIds.has(option.parentId) && !toDeleteOptionIds.has(option.id)) {
            toDeleteOptionIds.add(option.id);
            changed = true;
          }
        });
      }
      if (toDeleteOptionIds.size) {
        await tx.filterOption.deleteMany({ where: { id: { in: Array.from(toDeleteOptionIds) } } });
      }
    }
    await tx.category.deleteMany({ where: { id: { in: Array.from(toDeleteIds) } } });
  });

  return NextResponse.json({ ok: true });
}
