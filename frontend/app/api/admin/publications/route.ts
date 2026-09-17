import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const items = await prisma.publication.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 50,
    include: {
      filterOptions: {
        include: { filterOption: true },
      },
    },
  });
  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const created = await prisma.publication.create({
      data: {
        title: String(body.title ?? "").trim(),
        titleI18n: body.titleI18n ?? null,
        description: String(body.description ?? "").trim(),
        descriptionI18n: body.descriptionI18n ?? null,
        status: String(body.status ?? "active"),
        featured: Boolean(body.featured),

        category: body.category ?? null,
        categoryI18n: body.categoryI18n ?? null,
        subcategory: body.subcategory ?? null,
        subcategoryI18n: body.subcategoryI18n ?? null,
        primaryGroupKey: body.primaryGroupKey ?? null,
        contentLanguage: body.contentLanguage ?? null,
        publisherName: body.publisherName ?? null,

        country: body.country ?? null,
        headquarterCountry: body.headquarterCountry ?? null,
        city: body.city ?? null,

        currency: body.currency ?? null,
        price: body.price ?? null,

        languages: body.languages ?? null,
        images: body.images ?? null,
        website: body.website ?? null,
        socialLinks: body.socialLinks ?? null,
        expiration: body.expiration ?? null,

        fields: body.fields ?? {},
        filterOptions: {
          create: Array.isArray(body.filterOptionIds)
            ? body.filterOptionIds.map((id: string) => ({ filterOptionId: id }))
            : [],
        },
      },
      include: {
        filterOptions: {
          include: { filterOption: true },
        },
      },
    });

    return NextResponse.json({ ok: true, item: created });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });
    }
    const body = await req.json();
    const filterOptionIds = Array.isArray(body.filterOptionIds) ? body.filterOptionIds : [];

    const updated = await prisma.publication.update({
      where: { id },
      data: {
        title: String(body.title ?? "").trim(),
        titleI18n: body.titleI18n ?? null,
        description: String(body.description ?? "").trim(),
        descriptionI18n: body.descriptionI18n ?? null,
        status: String(body.status ?? "active"),
        featured: Boolean(body.featured),

        category: body.category ?? null,
        categoryI18n: body.categoryI18n ?? null,
        subcategory: body.subcategory ?? null,
        subcategoryI18n: body.subcategoryI18n ?? null,
        primaryGroupKey: body.primaryGroupKey ?? null,
        contentLanguage: body.contentLanguage ?? null,
        publisherName: body.publisherName ?? null,

        country: body.country ?? null,
        headquarterCountry: body.headquarterCountry ?? null,
        city: body.city ?? null,

        currency: body.currency ?? null,
        price: body.price ?? null,

        languages: body.languages ?? null,
        images: body.images ?? null,
        website: body.website ?? null,
        socialLinks: body.socialLinks ?? null,
        expiration: body.expiration ?? null,
        fields: body.fields ?? {},

        filterOptions: {
          deleteMany: {},
          create: filterOptionIds.map((filterOptionId: string) => ({ filterOptionId })),
        },
      },
      include: {
        filterOptions: {
          include: { filterOption: true },
        },
      },
    });

    return NextResponse.json({ ok: true, item: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  await prisma.publication.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
