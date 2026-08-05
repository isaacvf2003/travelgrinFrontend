import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/app/lib/baseUrl";
import { pickI18nText } from "@/app/lib/i18nContent";
import { publicationPath } from "@/app/lib/publicationSlug";
import type { Publication } from "@/app/lib/types";

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://travelgrin.com").replace(/\/$/, "");
}

function getLastModified(value: string | null | undefined) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : new Date();
}

async function loadPublications(): Promise<Publication[]> {
  try {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/api/publications?perPage=100`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: Publication[]; data?: Publication[] };
    return data.items ?? data.data ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/buscar`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/quienes-somos`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/term-condicion`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const publicationRoutes = (await loadPublications()).map((item) => {
    const locale = (item.contentLanguage ?? "es") as Parameters<typeof pickI18nText>[1];
    const title = pickI18nText(item.titleI18n ?? null, locale, item.title);
    const basePath = item.primaryGroupKey === "prestacion" ? "prestaciones" : "publicacion";

    return {
      url: `${siteUrl}${publicationPath(item.id, title, basePath)}`,
      lastModified: getLastModified(item.updatedAt ?? item.createdAt),
      changeFrequency: "weekly" as const,
      priority: item.featured ? 0.8 : 0.7,
    };
  });

  return [...staticRoutes, ...publicationRoutes];
}
