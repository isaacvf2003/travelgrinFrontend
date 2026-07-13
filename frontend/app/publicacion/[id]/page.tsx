import Link from "next/link";
import type { Metadata } from "next";
import PublicationGallery from "./_components/PublicationGallery";

import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import I18nText from "@/components/I18nText";
import TranslatedText from "@/components/TranslatedText";
import { getBaseUrl } from "@/app/lib/baseUrl";
import { pickI18nText } from "@/app/lib/i18nContent";
import { extractPublicationIdFromParam } from "@/app/lib/publicationSlug";
import type { Publication } from "@/app/lib/types";
import { PlanProvider } from "@/app/buscar/_components/PlanStore";
import ProviderInfo from "./_components/ProviderInfo";
import OtherOpportunitiesCarousel from "./_components/OtherOpportunitiesCarousel";
import PublicationSidebarCard from "./_components/PublicationSidebarCard";
import ContactAccordion, { type ContactEntry } from "./_components/ContactAccordion";
import PrestacionesToAdd from "./_components/PrestacionesToAdd";
import PublicationMetricsTracker from "./_components/PublicationMetricsTracker";
import ReportPublicationCard from "./_components/ReportPublicationCard";
import TravelRecommendationAction from "./_components/TravelRecommendationAction";

type PageProps = {
  params: { id: string };
  searchParams?: { img?: string; priceCurrency?: string; returnTo?: string; country?: string; destinationCountry?: string };
};

type DetailCategory = {
  id?: string | number | null;
  description?: string | null;
  descriptionI18n?: Record<string, string> | null;
  parentId?: string | number | null;
  isPrimaryCategory?: boolean | null;
  visibleInCard?: boolean | null;
  taxonomyType?: string | null;
};

function safeUrl(src: any) {
  if (!src) return null;
  const s = String(src);
  if (!s) return null;
  return s;
}


function normalizeTaxonomyType(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function resolvePublicationLanguages(item: any): string[] {
  const fromField: string[] = Array.isArray(item?.languages)
    ? item.languages
    : item?.languages
      ? [item.languages]
      : [];

  const fromIdiomaTaxonomyType: string[] = Array.isArray(item?.filterOptions)
    ? item.filterOptions
        .filter((entry: any) => {
          const taxonomyType = normalizeTaxonomyType(entry?.filterOption?.group?.taxonomyType);
          return taxonomyType === "idioma" || taxonomyType === "idiomas";
        })
        .map((entry: any) => String(entry?.filterOption?.label ?? "").trim())
        .filter(Boolean)
    : [];

  const preferred = fromIdiomaTaxonomyType.length ? fromIdiomaTaxonomyType : fromField;

  return Array.from(new Set(preferred.map((lang: string) => String(lang).trim()).filter(Boolean)));
}

const COUNTRY_FLAG_MAP: Record<string, string> = {
  ar: "🇦🇷",
  argentina: "🇦🇷",
  cl: "🇨🇱",
  chile: "🇨🇱",
  uy: "🇺🇾",
  uruguay: "🇺🇾",
  py: "🇵🇾",
  paraguay: "🇵🇾",
  br: "🇧🇷",
  brasil: "🇧🇷",
  brazil: "🇧🇷",
  pe: "🇵🇪",
  peru: "🇵🇪",
  perú: "🇵🇪",
  bo: "🇧🇴",
  bolivia: "🇧🇴",
  co: "🇨🇴",
  colombia: "🇨🇴",
  mx: "🇲🇽",
  mexico: "🇲🇽",
  méxico: "🇲🇽",
  es: "🇪🇸",
  espana: "🇪🇸",
  españa: "🇪🇸",
  it: "🇮🇹",
  italia: "🇮🇹",
  fr: "🇫🇷",
  francia: "🇫🇷",
  de: "🇩🇪",
  alemania: "🇩🇪",
  us: "🇺🇸",
  "estados unidos": "🇺🇸",
  ca: "🇨🇦",
  canada: "🇨🇦",
  canadá: "🇨🇦",
};


function safeBuscarHref(returnTo?: string) {
  const raw = String(returnTo ?? "").trim();
  if (!raw) return "/buscar";
  try {
    const decoded = decodeURIComponent(raw);
    return decoded.startsWith("/buscar") ? decoded : "/buscar";
  } catch {
    return raw.startsWith("/buscar") ? raw : "/buscar";
  }
}

function extractEmailAddress(rawHref: string): string {
  const raw = String(rawHref ?? "").trim();
  if (!raw) return "";

  if (/^mailto:/i.test(raw)) {
    return raw.replace(/^mailto:/i, "").split("?")[0].trim();
  }

  if (raw.includes("@") && !/^https?:\/\//i.test(raw)) {
    return raw.trim();
  }

  try {
    const url = new URL(raw);
    const toParam = url.searchParams.get("to") ?? "";
    if (toParam) {
      const decodedTo = decodeURIComponent(toParam);
      if (/^https?:\/\/mail\.google\.com\/mail\//i.test(decodedTo) || /^mailto:/i.test(decodedTo)) {
        return extractEmailAddress(decodedTo);
      }
      if (decodedTo.includes("@")) {
        return decodedTo.split("?")[0].trim();
      }
    }

    const pathname = decodeURIComponent(url.pathname);
    const maybeMail = pathname.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
    if (maybeMail) return maybeMail;
  } catch {
    // ignore parse errors
  }

  const fallbackMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return fallbackMatch?.[0] ?? "";
}

function normalizeContactHref(kind: string, rawHref: string) {
  const raw = String(rawHref ?? "").trim();
  if (!raw) return "#";
  const normalizedKind = kind.toLowerCase();

  if (normalizedKind === "email") {
    const email = extractEmailAddress(raw);
    if (!email) return "#";
    return `https://mail.google.com/mail/u/0/?view=cm&fs=1&tf=1&to=${encodeURIComponent(email)}`;
  }

  if (normalizedKind === "whatsapp") {
    try {
      if (/^https?:\/\//i.test(raw)) {
        const url = new URL(raw);
        const phoneParam = url.searchParams.get("phone");
        const textParam = url.searchParams.get("text");
        const digitsFromPhone = String(phoneParam ?? "").replace(/\D/g, "");
        if (digitsFromPhone) {
          return `https://api.whatsapp.com/send?phone=${digitsFromPhone}${textParam ? `&text=${encodeURIComponent(textParam)}` : ""}`;
        }
        const digitsFromUrl = `${url.hostname}${url.pathname}`.replace(/\D/g, "");
        if (digitsFromUrl) return `https://api.whatsapp.com/send?phone=${digitsFromUrl}`;
      }
    } catch {
      // ignore parse failures and continue
    }

    const digits = raw.replace(/\D/g, "");
    return digits ? `https://api.whatsapp.com/send?phone=${digits}` : "#";
  }

  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 6 && /^[+()\-\s.\d]+$/.test(raw)) {
    return `tel:${raw.replace(/[^\d+]/g, "")}`;
  }
  return `https://${raw.replace(/^\/+/, "")}`;
}

function searchParamsFromBuscarHref(href: string) {
  const query = href.includes("?") ? href.slice(href.indexOf("?") + 1).split("#")[0] : "";
  return new URLSearchParams(query);
}

function buildBuscarHref(params: URLSearchParams, key: "category" | "subcategory", value: string) {
  const next = new URLSearchParams(params.toString());
  next.set(key, value);
  next.delete("page");
  next.delete("prestacionesPage");
  return `/buscar?${next.toString()}`;
}

function flagFromAlpha2Code(alpha2Code: string) {
  const code = alpha2Code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(...[...code].map((char) => 127397 + char.charCodeAt(0)));
}

function getCountryFlag(country: string) {
  const raw = String(country ?? "").trim();
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
  const tokenized = raw.split(/\s+/).map((token) =>
    token
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim()
  );
  const candidates = [normalized, ...tokenized].filter(Boolean);
  for (const key of candidates) {
    const fromCode = flagFromAlpha2Code(key);
    if (fromCode) return fromCode;
    if (COUNTRY_FLAG_MAP[key]) return COUNTRY_FLAG_MAP[key];
  }
  return "🏳️";
}

const DETAIL_COUNTRY_CODE_MAP: Record<string, string> = {
  ar: "AR",
  argentina: "AR",
  albania: "AL",
  alemania: "DE",
  andorra: "AD",
  br: "BR",
  brasil: "BR",
  brazil: "BR",
  ca: "CA",
  canada: "CA",
  cl: "CL",
  chile: "CL",
  co: "CO",
  colombia: "CO",
  de: "DE",
  es: "ES",
  espana: "ES",
  fr: "FR",
  francia: "FR",
  it: "IT",
  italia: "IT",
  mx: "MX",
  mexico: "MX",
  pe: "PE",
  peru: "PE",
  py: "PY",
  paraguay: "PY",
  us: "US",
  uy: "UY",
  uruguay: "UY",
};

function getDetailCountryCode(country: string) {
  const raw = String(country ?? "").trim();
  const normalizeCountry = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();
  const candidates = [normalizeCountry(raw), ...raw.split(/\s+/).map(normalizeCountry)].filter(Boolean);
  for (const key of candidates) {
    const code = key.toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) return code;
    if (DETAIL_COUNTRY_CODE_MAP[key]) return DETAIL_COUNTRY_CODE_MAP[key];
  }
  return "";
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await Promise.resolve(params);
  const resolvedId = extractPublicationIdFromParam(id);

  try {
    const base = await getBaseUrl();
    const res = await fetch(`${base}/api/publications/${resolvedId}`, {
      cache: "no-store",
    });
    if (!res.ok) return { title: "TravelGrin" };

    const payload = (await res.json()) as { item?: Publication } | Publication;
    const item = ("item" in payload ? payload.item : payload) as Publication;
    const locale = (item.contentLanguage ?? "es") as Parameters<typeof pickI18nText>[1];
    const title = pickI18nText(item.titleI18n ?? null, locale, item.title).trim();

    return { title: title ? `${title} | TravelGrin` : "TravelGrin" };
  } catch {
    return { title: "TravelGrin" };
  }
}

export default async function PublicacionDetalle({ params, searchParams }: PageProps) {
  const { id } = await Promise.resolve(params);
  const resolvedId = extractPublicationIdFromParam(id);
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const base = await getBaseUrl();

  const res = await fetch(`${base}/api/publications/${resolvedId}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    return (
      <div className="min-h-screen bg-white">
        <NavBar />
        <main className="mx-auto max-w-6xl px-4 py-16">
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-gray-700">
            <TranslatedText id="publicacion_no_encontrada" />
            <div className="mt-6">
              <Link className="text-teal-600 underline" href="/buscar">
                <TranslatedText id="volver_busqueda" />
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const payload = (await res.json()) as { item?: Publication } | Publication;
  const item = ("item" in payload ? payload.item : payload) as Publication;

  const locale = (item.contentLanguage ?? "es") as Parameters<typeof pickI18nText>[1];
  const [filtersRes, categoriesRes] = await Promise.all([
    fetch(`${base}/api/filters`, { cache: "no-store" }),
    fetch(`${base}/api/categories`, { cache: "no-store" }),
  ]);
  const filtersPayload = filtersRes.ok ? await filtersRes.json() : { groups: [] };
  const filterGroups = Array.isArray(filtersPayload?.groups) ? filtersPayload.groups : [];
  const categoriesPayload = categoriesRes.ok ? await categoriesRes.json() : { items: [] };
  const categories = (Array.isArray(categoriesPayload?.items) ? categoriesPayload.items : []) as DetailCategory[];
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();
  const prestacionesGroup = filterGroups.find((group: any) => {
    const key = normalize(String(group?.key ?? ""));
    const taxonomyType = normalize(String(group?.taxonomyType ?? ""));
    return taxonomyType === "prestacion" || key === "prestacion" || key === "prestaciones";
  });
  const selectedPrestacionesLabels = new Set(
    (item as any).filterOptions
      ?.filter((fo: any) => fo.filterOption?.groupId === prestacionesGroup?.id)
      ?.map((fo: any) =>
        pickI18nText(fo.filterOption?.labelI18n ?? null, locale, String(fo.filterOption?.label ?? ""))
      ) ?? []
  );
  const selectedPrestacionesFromFields = new Set(
    Array.isArray((item as any).fields?.prestaciones)
      ? (item as any).fields.prestaciones.map((entry: any) => String(entry ?? "")).filter(Boolean)
      : []
  );
  const selectedPrestacionesNormalized = new Set(
    [...Array.from(selectedPrestacionesLabels), ...Array.from(selectedPrestacionesFromFields)]
      .map((entry) => normalize(String(entry ?? "")))
      .filter(Boolean)
  );
  const includedPrestacionesChips = Array.from(
    new Set(
      [
        ...Array.from(selectedPrestacionesLabels),
        ...Array.from(selectedPrestacionesFromFields),
      ].map((entry) => String(entry ?? "").trim()).filter(Boolean)
    )
  );
  const prestacionesCategories = categories.filter((cat: any) => {
    const taxonomyType = normalize(String(cat?.taxonomyType ?? ""));
    return ["prestacion", "prestaciones"].includes(taxonomyType);
  });
  const prestacionesToAdd = prestacionesCategories.filter((cat: any) => {
    const label = pickI18nText(cat.descriptionI18n ?? null, locale, String(cat.description ?? ""));
    const normalizedLabel = normalize(label);
    if (!normalizedLabel) return false;
    return !selectedPrestacionesNormalized.has(normalizedLabel);
  });
  const prestacionesToAddChips = prestacionesToAdd
    .map((cat: any) => ({
      id: String(cat.id),
      label: pickI18nText(cat.descriptionI18n ?? null, locale, String(cat.description ?? "")),
      value: String(cat.description ?? "").trim(),
    }))
    .filter((chip: any) => chip.value)
    .filter((chip: any, index: number, arr: any[]) => arr.findIndex((it) => normalize(it.value) === normalize(chip.value)) === index);

  const imgsRaw = (item.images as any) ?? [];
  const imgs = Array.isArray(imgsRaw) ? imgsRaw.map(safeUrl).filter((url): url is string => Boolean(url)) : [];
  const planImageUrl = imgs[0] ?? null;

  const socialLinks = (item.socialLinks ?? {}) as Record<string, string>;
  const languages = resolvePublicationLanguages(item);
  const extraDescriptions = Array.isArray((item as any).fields?.extraDescriptions)
    ? (item as any).fields.extraDescriptions
        .map((d: any) => ({
          title: String(d?.title ?? "").trim(),
          body: String(d?.body ?? "").trim(),
          titleI18n: d?.titleI18n ?? null,
          bodyI18n: d?.bodyI18n ?? null,
        }))
        .filter((d: any) => d.title || d.body || d.titleI18n || d.bodyI18n)
    : [];
  const providerInfoI18n = ((item as any).fields?.providerInfoI18n ?? null) as Record<string, string> | null;
  const providerRating = (item as any).fields?.providerRating ?? null;
  const providerReviewCount = (item as any).fields?.providerReviewCount ?? null;
  const providerCommentsUrl = (item as any).fields?.providerCommentsUrl ?? null;
  const providerStartYear = (item as any).fields?.providerStartYear ?? null;
  const providerActivity = (item as any).fields?.providerActivity ?? null;
  const providerType = (item as any).fields?.providerType ?? null;
  const parseMultiProviderField = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
    const raw = String(value ?? "").trim();
    if (!raw) return [];
    if (raw.includes(",")) {
      return raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
    return [raw];
  };
  const providerActivities = parseMultiProviderField((item as any).fields?.providerActivities);
  const providerTypes = parseMultiProviderField((item as any).fields?.providerTypes);
  if (!providerActivities.length && providerActivity) providerActivities.push(...parseMultiProviderField(providerActivity));
  if (!providerTypes.length && providerType) providerTypes.push(...parseMultiProviderField(providerType));
  const providerOrigin = (item as any).fields?.providerOrigin ?? null;
  const providerLogo = (item as any).fields?.providerLogo ?? null;
  const fields = ((item as any).fields ?? {}) as Record<string, any>;
  const locationAddress = String((item as any).fields?.locationAddress ?? "").trim();
  const pricePeriod = (item as any).fields?.pricePeriod ?? "month";
  const normalizeLocation = (loc: { country: string; city: string; mapUrl: string }) => ({
    country: loc.country.trim(),
    city: loc.city.trim(),
    mapUrl: loc.mapUrl.trim(),
  });
  const uniqueLocations = (locations: Array<{ country: string; city: string; mapUrl: string }>) => {
    const seen = new Set<string>();
    const result: Array<{ country: string; city: string; mapUrl: string }> = [];
    locations.forEach((loc) => {
      const normalized = normalizeLocation(loc);
      if (!normalized.country && !normalized.city && !normalized.mapUrl) return;
      const key = `${normalized.country.toLowerCase()}|${normalized.city.toLowerCase()}|${normalized.mapUrl.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(normalized);
    });
    return result;
  };
  const legacyDestinationCountries = Array.isArray((item as any).fields?.destinationCountries)
    ? (item as any).fields.destinationCountries.filter(Boolean)
    : [];
  const legacyOfferLocations = Array.isArray((item as any).fields?.offerLocations)
    ? (item as any).fields.offerLocations
        .map((loc: any) => ({
          country: String(loc?.country ?? "").trim(),
          city: String(loc?.region ?? "").trim(),
          mapUrl: String(loc?.address ?? "").trim(),
        }))
        .filter((loc: any) => loc.country || loc.city || loc.mapUrl)
    : [];
  const rawTravelDestinations = Array.isArray((item as any).fields?.travelDestinations)
    ? (item as any).fields.travelDestinations.map((loc: any) => ({
        country: String(loc?.country ?? "").trim(),
        city: String(loc?.city ?? "").trim(),
        mapUrl: String(loc?.mapUrl ?? "").trim(),
      }))
    : [];
  const hasStructuredDestinations = rawTravelDestinations.length > 0;
  const hasLegacyLocations = legacyOfferLocations.length > 0;
  const travelDestinations = uniqueLocations([
    ...rawTravelDestinations,
    normalizeLocation({
      country: String(item.country ?? "").trim(),
      city: String(item.city ?? "").trim(),
      mapUrl: locationAddress,
    }),
    ...legacyOfferLocations,
    ...(!hasStructuredDestinations && !hasLegacyLocations
      ? legacyDestinationCountries.map((country: string) => ({
          country: String(country ?? "").trim(),
          city: "",
          mapUrl: "",
        }))
      : []),
  ]);
  const headquartersInfo = String((item as any).fields?.headquartersInfo ?? "").trim();
  const rawHeadquarterLocations = Array.isArray((item as any).fields?.headquarterLocations)
    ? (item as any).fields.headquarterLocations.map((loc: any) => ({
        country: String(loc?.country ?? "").trim(),
        city: String(loc?.city ?? "").trim(),
        mapUrl: String(loc?.mapUrl ?? "").trim(),
      }))
    : [];
  const headquarterLocations = uniqueLocations([
    ...rawHeadquarterLocations,
    ...(item.headquarterCountry
      ? [{ country: String(item.headquarterCountry ?? "").trim(), city: "", mapUrl: "" }]
      : []),
  ]);
  const subcategoryLabels = item.subcategory
    ? [pickI18nText(item.subcategoryI18n ?? null, locale, item.subcategory)]
    : [];
  const fieldCategoryLabels = Array.isArray((item as any).fields?.categorySelections)
    ? (item as any).fields.categorySelections.map((value: any) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const fieldSubcategoryLabels = Array.isArray((item as any).fields?.subcategorySelections)
    ? (item as any).fields.subcategorySelections.map((value: any) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const categoryLabels = Array.from(
    new Set(
      [
        item.category ? pickI18nText(item.categoryI18n ?? null, locale, item.category) : "",
        ...fieldCategoryLabels,
      ].filter(Boolean)
    )
  );
  const mergedSubcategoryLabels = Array.from(new Set([...subcategoryLabels, ...fieldSubcategoryLabels].filter(Boolean)));
  const categoryById = new Map<string, DetailCategory>(
    categories.filter((cat) => cat.id != null).map((cat) => [String(cat.id), cat])
  );
  const categoryByLabel = new Map<string, DetailCategory>();
  categories.forEach((cat) => {
    const raw = String(cat?.description ?? "").trim();
    const label = pickI18nText(cat?.descriptionI18n ?? null, locale, raw);
    [raw, label].filter(Boolean).forEach((value) => categoryByLabel.set(normalize(String(value)), cat));
  });
  const primaryDestination =
    travelDestinations[0] ??
    normalizeLocation({
      country: String(item.country ?? "").trim(),
      city: String(item.city ?? "").trim(),
      mapUrl: locationAddress,
    });
  const buscarHref = safeBuscarHref(resolvedSearchParams.returnTo);
  const buscarParams = searchParamsFromBuscarHref(buscarHref);
  const selectedDestinationCountry = String(
    resolvedSearchParams.destinationCountry ??
      resolvedSearchParams.country ??
      buscarParams.get("destinationCountry") ??
      buscarParams.get("country") ??
      ""
  ).trim();
  const breadcrumbCountry = selectedDestinationCountry || String(primaryDestination.country ?? "").trim();
  const breadcrumbCountryLabel = breadcrumbCountry.replace(/^[A-Za-z]{2}\s+/, "").trim() || breadcrumbCountry;
  const breadcrumbCountryCode = getDetailCountryCode(breadcrumbCountry);
  const breadcrumbSources = [
    ...categoryLabels.map((label) => ({ label, param: "category" as const, value: String(item.category ?? label) })),
    ...mergedSubcategoryLabels.map((label) => ({ label, param: "subcategory" as const, value: String(item.subcategory ?? label) })),
  ].filter((entry) => entry.label);
  const primaryBreadcrumbSources = breadcrumbSources
    .map((entry) => {
      const matched = categoryByLabel.get(normalize(entry.value)) ?? categoryByLabel.get(normalize(entry.label));
      if (matched && (matched.visibleInCard ?? matched.isPrimaryCategory) === true) {
        return {
          label: pickI18nText(matched.descriptionI18n ?? null, locale, String(matched.description ?? entry.label)),
          param: entry.param,
          value: String(matched.description ?? entry.value),
        };
      }
      const parent = matched?.parentId ? categoryById.get(String(matched.parentId)) : null;
      if (parent && (parent.visibleInCard ?? parent.isPrimaryCategory) === true) {
        return {
          label: pickI18nText(parent.descriptionI18n ?? null, locale, String(parent.description ?? entry.label)),
          param: "category" as const,
          value: String(parent.description ?? entry.value),
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ label: string; param: "category" | "subcategory"; value: string }>;
  const breadcrumbCategories = (primaryBreadcrumbSources.length ? primaryBreadcrumbSources : breadcrumbSources)
    .filter((entry, index, arr) => entry.label && arr.findIndex((it) => normalize(it.label)) === index);
  const publicationCode = `PUB-${String(item.id ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "000000"}`;

  const primaryGroup =
    item.primaryGroupKey && item.primaryGroupKey !== "category"
      ? filterGroups.find((group: any) => group.key === item.primaryGroupKey)
      : null;
  const primaryGroupTags = primaryGroup
    ? ((item as any).filterOptions ?? [])
        .filter((fo: any) => fo.filterOption?.groupId === primaryGroup.id)
        .map((fo: any) =>
          pickI18nText(fo.filterOption?.labelI18n ?? null, locale, String(fo.filterOption?.label ?? ""))
        )
        .filter(Boolean)
    : [];
  const detailedLinks = Array.isArray((item as any).fields?.socialLinksDetailed)
    ? (item as any).fields.socialLinksDetailed
        .map((entry: any) => ({
          kind: String(entry?.kind ?? ""),
          label: String(entry?.label ?? ""),
          url: String(entry?.url ?? ""),
        }))
        .filter((entry: any) => entry.kind && entry.url)
    : [];
  const kindLabels: Record<string, string> = {
    linkedin: "LinkedIn",
    facebook: "Facebook",
    instagram: "Instagram",
    tiktok: "TikTok",
    youtube: "YouTube",
    whatsapp: "WhatsApp",
    email: "Email",
    web: "Web",
    other: "Enlace",
  };
  const detailedEntries = detailedLinks.map((entry: any) => {
    const label = entry.label || kindLabels[entry.kind] || "Enlace";
    const href = normalizeContactHref(entry.kind, entry.url);
    return {
      label,
      href,
      icon: entry.kind === "web" ? "web" : entry.kind,
    };
  });
  const contactEntries = [
    ...detailedEntries,
    item.website
      ? { label: "Web", href: normalizeContactHref("web", item.website), icon: "web" }
      : null,
    socialLinks.linkedin
      ? { label: "LinkedIn", href: normalizeContactHref("linkedin", socialLinks.linkedin), icon: "linkedin" }
      : null,
    socialLinks.facebook
      ? { label: "Facebook", href: normalizeContactHref("facebook", socialLinks.facebook), icon: "facebook" }
      : null,
    socialLinks.instagram
      ? { label: "Instagram", href: normalizeContactHref("instagram", socialLinks.instagram), icon: "instagram" }
      : null,
    socialLinks.tiktok
      ? { label: "TikTok", href: normalizeContactHref("tiktok", socialLinks.tiktok), icon: "tiktok" }
      : null,
    socialLinks.youtube
      ? { label: "YouTube", href: normalizeContactHref("youtube", socialLinks.youtube), icon: "youtube" }
      : null,
    socialLinks.whatsapp
      ? { label: "WhatsApp", href: normalizeContactHref("whatsapp", socialLinks.whatsapp), icon: "whatsapp" }
      : null,
    socialLinks.email
      ? {
          label: "Email",
          href: normalizeContactHref("email", socialLinks.email),
          icon: "email",
        }
      : null,
    socialLinks.other
      ? { label: "Enlace", href: normalizeContactHref("other", socialLinks.other), icon: "other" }
      : null,
  ].filter(Boolean).filter((entry, index, arr) => {
    const key = `${entry.icon}|${entry.href}`.toLowerCase();
    return arr.findIndex((it) => `${it.icon}|${it.href}`.toLowerCase() === key) === index;
  }) as ContactEntry[];

  // Intento traer â€œotras oportunidadesâ€
  let others: Publication[] = [];
  try {
    const qs = new URLSearchParams();
    if (item.country) {
      qs.set("country", String(item.country));
      qs.set("destinationCountry", String(item.country));
    }
    if (item.subcategory) qs.set("subcategory", String(item.subcategory));
    else if (item.category) qs.set("category", String(item.category));
    qs.set("perPage", "12");
    const r = await fetch(`${base}/api/publications?${qs.toString()}`, { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      const list = Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : [];
      others = list.filter((p: any) => String(p?.id) !== String(item?.id)) as Publication[];
    }
  } catch {
    // ok
  }

  return (
    <div className="min-h-screen bg-[#F3F5F7]">
      <NavBar />

      <PlanProvider>
        <main className="mx-auto max-w-6xl px-3 py-6 sm:px-4">
          {/* Breadcrumb */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link className="text-gray-600 hover:text-gray-900" href="/">
              <TranslatedText id="inicio" />
            </Link>
            <span>›</span>
            <Link className="text-gray-600 hover:text-gray-900" href={buscarHref}>
              <TranslatedText id="buscar" />
            </Link>
            {breadcrumbCategories.map((entry) => (
              <span key={`${entry.param}-${entry.label}`} className="inline-flex items-center gap-2">
                <span>›</span>
                <Link
                  className="text-gray-600 hover:text-gray-900"
                  href={buildBuscarHref(buscarParams, entry.param, entry.value)}
                >
                  {entry.label}
                </Link>
              </span>
            ))}
            {breadcrumbCountry ? (
              <>
                <span>›</span>
                <span className="inline-flex items-center gap-1 text-gray-600">
                  {breadcrumbCountryCode ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://flagcdn.com/20x15/${breadcrumbCountryCode.toLowerCase()}.png`}
                      alt={breadcrumbCountryLabel}
                      className="h-[12px] w-[16px] rounded-[2px] object-cover"
                    />
                  ) : null}
                  <span>{breadcrumbCountryLabel}</span>
                </span>
              </>
            ) : null}
          </div>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* LEFT: Galería + contenido */}
          <section className="min-w-0">
            {/* GALERÍA (como Figma) */}
            <div className="rounded-3xl border border-gray-200 bg-white p-4 md:p-5">
              <PublicationGallery images={imgs} title={item.title} />
            </div>

            <PublicationSidebarCard
              className="mt-6 lg:hidden"
              publicationId={String(item.id)}
              title={item.title}
              titleI18n={item.titleI18n ?? null}
              layout="split"
              featured={item.featured}
              partner={Boolean((item as any)?.partner ?? (item as any)?.fields?.partner)}
              publisherName={item.publisherName}
              providerLogo={providerLogo}
              languages={languages}
              locationCity={primaryDestination.city || null}
              locationCountry={primaryDestination.country || null}
              mapUrl={primaryDestination.mapUrl || null}
              primaryGroupTags={primaryGroupTags}
              category={item.category}
              categoryI18n={(item as any).categoryI18n ?? null}
              subcategory={item.subcategory}
              subcategoryI18n={(item as any).subcategoryI18n ?? null}
              categoryLabels={categoryLabels}
              subcategoryLabels={mergedSubcategoryLabels}
              price={item.price}
              currency={item.currency}
              pricePeriod={pricePeriod}
              displayCurrency={resolvedSearchParams.priceCurrency ?? null}
              priceOverrides={(item as any).fields?.priceByCurrency ?? []}
              imageUrl={planImageUrl}
            />

            {/* Card principal (texto) */}
            <div className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              {/* Meta */}
              <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span title={String(item.id)}>
                  <TranslatedText id="id_publicacion" />: {publicationCode}
                </span>
              </div>

              <div className="mt-4">
                <h2 className="text-xl font-semibold text-[#0B8FA3] md:text-2xl">
                  <TranslatedText id="descripcion_oportunidad" />
                </h2>
                <div className="mt-2 whitespace-pre-wrap text-base leading-7 text-gray-700 md:text-lg">
                  <I18nText value={item.descriptionI18n} fallback={item.description} rich />
                </div>
              </div>

              {extraDescriptions.length ? (
                <div className="mt-5 space-y-4">
                  {extraDescriptions.map((desc: any, idx: number) => (
                    <div key={`${desc.title}-${idx}`} className="rounded-2xl border border-[#BDECF2] bg-[#EFFBFD] p-4">
                      {desc.title || desc.titleI18n ? (
                        <h3 className="text-xl font-semibold text-[#0B8FA3]">
                          <I18nText value={desc.titleI18n} fallback={desc.title} />
                        </h3>
                      ) : null}
                      {desc.body || desc.bodyI18n ? (
                        <div className="mt-2 whitespace-pre-wrap text-base leading-7 text-gray-700 md:text-lg">
                          <I18nText value={desc.bodyI18n} fallback={desc.body} rich />
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {includedPrestacionesChips.length ? (
                <div className="mt-5 rounded-2xl border border-[#BDECF2] bg-[#EFFBFD] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#0B8FA3]">
                    <TranslatedText id="publicacion_incluye_siguiente_recurso" />
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {includedPrestacionesChips.map((label) => (
                      <span key={label} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#0B8FA3] ring-1 ring-[#BDECF2]">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

            </div>

            {/* Prestaciones */}
            {prestacionesToAddChips.length ? (
              <PrestacionesToAdd chips={prestacionesToAddChips} currentPublicationId={String(item.id)} />
            ) : null}

            {/* Otras oportunidades (desktop) */}
            {others.length ? (
              <div className="mt-8 hidden lg:block">
                <OtherOpportunitiesCarousel items={others} />
              </div>
            ) : null}
          </section>

          {/* RIGHT: Sidebar (mantengo tu lógica pero con look más figma) */}
          <aside className="min-w-0 space-y-3 lg:sticky lg:top-24 lg:self-start">
            <PublicationSidebarCard
              className="hidden lg:block"
              publicationId={String(item.id)}
              title={item.title}
              titleI18n={item.titleI18n ?? null}
              featured={item.featured}
              partner={Boolean((item as any)?.partner ?? (item as any)?.fields?.partner)}
              publisherName={item.publisherName}
              providerLogo={providerLogo}
              languages={languages}
              locationCity={primaryDestination.city || null}
              locationCountry={primaryDestination.country || null}
              mapUrl={primaryDestination.mapUrl || null}
              primaryGroupTags={primaryGroupTags}
              category={item.category}
              categoryI18n={(item as any).categoryI18n ?? null}
              subcategory={item.subcategory}
              subcategoryI18n={(item as any).subcategoryI18n ?? null}
              categoryLabels={categoryLabels}
              subcategoryLabels={mergedSubcategoryLabels}
              price={item.price}
              currency={item.currency}
              pricePeriod={pricePeriod}
              displayCurrency={resolvedSearchParams.priceCurrency ?? null}
              priceOverrides={(item as any).fields?.priceByCurrency ?? []}
              imageUrl={planImageUrl}
            />
            {/* Conectar */}
            <ContactAccordion entries={contactEntries} publicationId={String(item.id)} />
            <TravelRecommendationAction />
            <PublicationMetricsTracker publicationId={String(item.id)} />

            <ProviderInfo
              value={providerInfoI18n}
              rating={providerRating}
              reviewCount={providerReviewCount}
              commentsUrl={providerCommentsUrl}
              startYear={providerStartYear}
              activity={providerActivity}
              providerType={providerType}
              activityList={providerActivities}
              providerTypeList={providerTypes}
              origin={providerOrigin}
              logo={providerLogo}
              headquartersInfo={headquartersInfo}
              headquarterLocations={headquarterLocations}
            />

            <ReportPublicationCard publicationId={String(item.id)} publicationTitle={item.title || ""} />

            {/* Otras oportunidades (mobile/tablet) */}
            {others.length ? (
              <div className="lg:hidden">
                <OtherOpportunitiesCarousel items={others} />
              </div>
            ) : null}
          </aside>
        </div>
      </main>
    </PlanProvider>

      <Footer />
    </div>
  );
}

