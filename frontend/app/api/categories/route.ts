import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
const CATEGORY_ICON_META_KEY = "__iconImageUrl";
const CATEGORY_CARD_IMAGE_META_KEY = "__cardImageUrl";

async function readCategoryOrderMap() {
  try {
    const tableInfo = await prisma.$queryRaw<Array<{ name: string }>>`PRAGMA table_info("categories")`;
    if (!tableInfo.some((column) => column.name === "order")) return null;
    const rows = await prisma.$queryRaw<Array<{ id: string; order_value: number | null }>>`SELECT "id", [order] as order_value FROM "categories"`;
    const map = new Map<string, number>();
    rows.forEach((row) => map.set(row.id, Number(row.order_value ?? 0)));
    return map;
  } catch {
    return null;
  }
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
export async function GET() {
  const [items, orderMap] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ blockId: "asc" }, { parentId: "asc" }, { description: "asc" }],
    }),
    readCategoryOrderMap(),
  ]);
  const sorted = [...items]
    .sort((a, b) => {
      const blockCompare = String(a.blockId ?? "").localeCompare(String(b.blockId ?? ""));
      if (blockCompare !== 0) return blockCompare;
      const parentCompare = String(a.parentId ?? "").localeCompare(String(b.parentId ?? ""));
      if (parentCompare !== 0) return parentCompare;
      const orderCompare = (orderMap?.get(a.id) ?? 0) - (orderMap?.get(b.id) ?? 0);
      if (orderCompare !== 0) return orderCompare;
      return (a.description || "").localeCompare(b.description || "");
    })
    .map((item) => ({
      ...item,
      order: orderMap?.get(item.id) ?? 0,
      iconImageUrl: readCategoryIconFromI18n(item.descriptionI18n),
      cardImageUrl: readCategoryCardImageFromI18n(item.descriptionI18n),
    }));

  const byId = new Map<string, any>();
  const roots: any[] = [];
  for (const c of sorted) byId.set(c.id, { ...c, children: [] });

  for (const c of sorted) {
    const node = byId.get(c.id);
    if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId).children.push(node);
    else roots.push(node);
  }

  return NextResponse.json({ items: sorted, tree: roots });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const descriptionI18n = (body?.descriptionI18n ?? null) as Record<string, string> | null;
  const description = String(descriptionI18n?.es ?? body?.description ?? "").trim();
  const taxonomyType = String(body?.taxonomyType ?? "").trim();
  const parentId = body?.parentId ? String(body.parentId) : null;
  const isPublicVisible = body?.isPublicVisible !== false;
  const isPrimaryCategory = body?.isPrimaryCategory === true;
  const iconImageUrl = String(body?.iconImageUrl ?? "").trim() || null;
  const cardImageUrl = String(body?.cardImageUrl ?? "").trim() || null;

  if (!description || !taxonomyType) {
    return NextResponse.json(
      { error: "description y taxonomyType son requeridos" },
      { status: 400 }
    );
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
      isPublicVisible,
      isPrimaryCategory,
    },
  });

  return NextResponse.json({ item: created }, { status: 201 });
}
