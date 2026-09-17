import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

function toInt(v: string | null, def: number) {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.max(1, Math.trunc(n)) : def;
}

function norm(input: any) {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

// Levenshtein with early-exit threshold
function levenshtein(a: string, b: string, max: number) {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (!la || !lb) return Math.max(la, lb);

  // ensure b is shorter for memory
  if (lb > la) return levenshtein(b, a, max);

  let prev = new Array(lb + 1);
  let cur = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= lb; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > max) return max + 1;
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[lb];
}

function splitCsv(raw: string | null) {
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

function parseMultiField(value: any): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  if (raw.includes(",")) return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  return [raw];
}

function normalizeTaxonomyTypeKey(value: string) {
  const key = norm(value);
  if (["tipo", "tipos"].includes(key)) return "tipos";
  if (["prestacion", "prestaciones"].includes(key)) return "prestacion";
  if (["idioma", "idiomas"].includes(key)) return "idiomas";
  return key;
}

function parseMoney(value: string | null) {
  if (!value) return NaN;
  const digits = String(value).replace(/[^\d]/g, "");
  if (!digits) return NaN;
  return Number(digits);
}

function fuzzyIncludes(haystack: string, needleRaw: string) {
  const needle = norm(needleRaw);
  if (!needle) return true;

  const text = norm(haystack);
  if (!text) return false;

  // Quick include
  if (text.includes(needle)) return true;

  const qWords = needle.split(/\s+/).filter(Boolean);
  if (!qWords.length) return true;

  const tokens = text
    .split(/[^\p{L}\p{N}]+/gu)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);

  // Each query word must match at least one token (typo-tolerant)
  for (const w of qWords) {
    const max = w.length <= 4 ? 1 : w.length <= 7 ? 2 : 3;
    let ok = false;
    for (const t of tokens) {
      if (Math.abs(t.length - w.length) > max) continue;
      if (levenshtein(t, w, max) <= max) {
        ok = true;
        break;
      }
    }
    if (!ok) return false;
  }
  return true;
}

function i18nValues(value: any): string[] {
  if (!value || typeof value !== "object") return [];
  return Object.values(value).map((v) => String(v)).filter(Boolean);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const page = toInt(url.searchParams.get("page"), 1);
  const perPage = Math.min(toInt(url.searchParams.get("perPage"), 12), 50);

  const status = url.searchParams.get("status") ?? "active";

  // Fixed filters
  const categoryList = splitCsv(url.searchParams.get("category"));
  const subcategoryList = splitCsv(url.searchParams.get("subcategory"));
  const country = url.searchParams.get("country");
  const primaryGroupKey = String(url.searchParams.get("primaryGroupKey") ?? "").trim();
  const destinationCountry = url.searchParams.get("destinationCountry");
  const passportCountry = country;
  const resolvedDestination = destinationCountry;
  const city = url.searchParams.get("city");
  const q = url.searchParams.get("q");
  const sort = url.searchParams.get("sort") ?? "relevance";

  // Price filters
  const pricePreset = url.searchParams.get("pricePreset");
  const priceMin = url.searchParams.get("priceMin");
  const priceMax = url.searchParams.get("priceMax");
  const priceCurrency = String(url.searchParams.get("priceCurrency") ?? "").trim().toUpperCase();
  const taxonomyTypeList = splitCsv(url.searchParams.get("taxonomyType")).map(norm);

  // Dynamic filter groups (created by admin) - stored via PublicationFilterOption
  const dynamicGroups = await prisma.filterGroup.findMany({
    include: { options: true },
  });
  const dynamicKeys = dynamicGroups.map((g) => g.key).filter((k) => k && k !== "price");

  const categoryTaxonomyTypes = await prisma.category.findMany({
    select: { description: true, taxonomyType: true },
  });
  const taxonomyTypeByCategory = new Map<string, string>();
  categoryTaxonomyTypes.forEach((c) => {
    if (c.description && c.taxonomyType) {
      taxonomyTypeByCategory.set(norm(c.description), String(c.taxonomyType));
    }
  });

  const optionIdByGroupValue = new Map<string, Map<string, Set<string>>>();
  for (const group of dynamicGroups) {
    const valueMap = new Map<string, Set<string>>();
    for (const option of group.options) {
      const valueKey = norm(option.value);
      if (!valueKey) continue;
      if (!valueMap.has(valueKey)) valueMap.set(valueKey, new Set());
      valueMap.get(valueKey)!.add(option.id);
    }
    optionIdByGroupValue.set(group.key, valueMap);
  }

  const hasQueryParam = (key: string) => Boolean(url.searchParams.get(key));
  const taxonomyTypeKeysFromCategories = new Set(
    categoryTaxonomyTypes
      .map((entry) => normalizeTaxonomyTypeKey(String(entry.taxonomyType ?? "")))
      .filter(Boolean)
  );
  const candidateTaxonomyTypeKeys = [
    ...taxonomyTypeKeysFromCategories,
    "actividad",
    "tipos",
    "modalidad",
    "idiomas",
    "prestacion",
    "destino",
    "voluntariado",
  ];
  const dynamicKeysSet = new Set([...dynamicKeys, ...candidateTaxonomyTypeKeys.filter(hasQueryParam)]);
  const allDynamicKeys = Array.from(dynamicKeysSet);

  const publicationValuesByTaxonomyType = (publication: any, rawKey: string) => {
    const key = normalizeTaxonomyTypeKey(rawKey);
    const fields = (publication as any).fields ?? {};
    const values: string[] = [];
    const pushMany = (items: string[]) => {
      for (const item of items) {
        const normalized = norm(item);
        if (normalized) values.push(normalized);
      }
    };

    if (key === "actividad") {
      pushMany(parseMultiField(fields.providerActivities));
      pushMany(parseMultiField(fields.providerActivity));
    }
    if (key === "tipos") {
      pushMany(parseMultiField(fields.providerTypes));
      pushMany(parseMultiField(fields.providerType));
    }
    if (key === "modalidad") {
      pushMany(parseMultiField(fields.providerModalities));
      pushMany(parseMultiField(fields.providerModality));
    }
    if (key === "idiomas") {
      pushMany(parseMultiField((publication as any).languages));
      pushMany(parseMultiField(fields.languages));
    }
    if (key === "prestacion") {
      pushMany(parseMultiField(fields.prestaciones));
    }

    const fieldCategorySelections = Array.isArray((publication as any)?.fields?.categorySelections)
      ? (publication as any).fields.categorySelections.map((entry: any) => norm(String(entry ?? ""))).filter(Boolean)
      : [];
    const fieldSubcategorySelections = Array.isArray((publication as any)?.fields?.subcategorySelections)
      ? (publication as any).fields.subcategorySelections.map((entry: any) => norm(String(entry ?? ""))).filter(Boolean)
      : [];
    const categoryValues = Array.from(new Set([norm((publication as any).category), ...fieldCategorySelections].filter(Boolean)));
    const subcategoryValues = Array.from(
      new Set([norm((publication as any).subcategory), ...fieldSubcategorySelections].filter(Boolean))
    );
    categoryValues.forEach((categoryValue) => {
      const categoryType = normalizeTaxonomyTypeKey(taxonomyTypeByCategory.get(categoryValue) ?? "");
      if (categoryType === key && categoryValue) values.push(categoryValue);
    });
    subcategoryValues.forEach((subcategoryValue) => {
      const subcategoryType = normalizeTaxonomyTypeKey(taxonomyTypeByCategory.get(subcategoryValue) ?? "");
      if (subcategoryType === key && subcategoryValue) values.push(subcategoryValue);
    });

    const filterMatches = ((publication as any).filterOptions ?? []).filter((entry: any) => {
      const tf = normalizeTaxonomyTypeKey(String(entry?.filterOption?.group?.taxonomyType ?? ""));
      return tf === key;
    });
    for (const entry of filterMatches) {
      const option = entry?.filterOption ?? {};
      pushMany(parseMultiField(option.value));
      pushMany(parseMultiField(option.label));
    }

    return Array.from(new Set(values));
  };

  const all = await prisma.publication.findMany({
    where: status ? { status } : undefined,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    include: {
      filterOptions: {
        include: {
          filterOption: {
            include: {
              group: {
                select: { taxonomyType: true },
              },
            },
          },
        },
      },
    },
  });

  const filtered = all.filter((p) => {
    if (primaryGroupKey && String((p as any).primaryGroupKey ?? "").trim() !== primaryGroupKey) {
      return false;
    }

    const expiration = (p as any).expiration;
    if (expiration) {
      const exp = new Date(expiration);
      if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
        return false;
      }
    }
    // Categories / Subcategories (stored as labels)
    if (subcategoryList.length || categoryList.length) {
      const fieldCategorySelections = Array.isArray((p as any)?.fields?.categorySelections)
        ? (p as any).fields.categorySelections.map((entry: any) => norm(String(entry ?? ""))).filter(Boolean)
        : [];
      const fieldSubcategorySelections = Array.isArray((p as any)?.fields?.subcategorySelections)
        ? (p as any).fields.subcategorySelections.map((entry: any) => norm(String(entry ?? ""))).filter(Boolean)
        : [];
      const categoryValues = Array.from(new Set([norm((p as any).category), ...fieldCategorySelections].filter(Boolean)));
      const subcategoryValues = Array.from(new Set([norm((p as any).subcategory), ...fieldSubcategorySelections].filter(Boolean)));
      const wantedSubs = subcategoryList.map(norm);
      const wantedCats = categoryList.map(norm);
      if (wantedSubs.length && !wantedSubs.some((wantedSub) => subcategoryValues.includes(wantedSub))) return false;
      if (wantedCats.length && !wantedCats.some((wantedCat) => categoryValues.includes(wantedCat))) return false;
    }

    if (taxonomyTypeList.length) {
      const subKey = norm((p as any).subcategory);
      const catKey = norm((p as any).category);
      const mapped = taxonomyTypeByCategory.get(subKey) || taxonomyTypeByCategory.get(catKey) || "";
      if (!mapped || !taxonomyTypeList.includes(norm(mapped))) return false;
    }

    if (passportCountry) {
      const target = norm(passportCountry);
      const fields = (p as any).fields ?? {};
      const rawMode = String(fields?.receivingCountriesMode ?? "").toLowerCase();
      const legacyAll = fields?.receivingCountriesAll;
      let mode: "all" | "only" | "except" = "all";
      if (rawMode === "all" || rawMode === "only" || rawMode === "except") {
        mode = rawMode;
      } else if (legacyAll === false) {
        mode = "only";
      }

      const receivingCountries = Array.isArray(fields?.receivingCountries)
        ? fields.receivingCountries.map((c: any) => norm(String(c)))
        : [];

      if (mode === "only" && receivingCountries.length && !receivingCountries.includes(target)) {
        return false;
      }
      if (mode === "except" && receivingCountries.length && receivingCountries.includes(target)) {
        return false;
      }
    }

    if (resolvedDestination) {
      const target = norm(resolvedDestination);
      const destinations = Array.isArray((p as any).fields?.destinationCountries)
        ? (p as any).fields.destinationCountries.map((d: any) => norm(String(d)))
        : [];
      const travelCountries = Array.isArray((p as any).fields?.travelDestinations)
        ? (p as any).fields.travelDestinations
            .map((d: any) => norm(String(d?.country ?? "")))
            .filter(Boolean)
        : [];
      const matchesDestination =
        (destinations.length > 0 && destinations.includes(target)) ||
        (travelCountries.length > 0 && travelCountries.includes(target)) ||
        norm((p as any).country) === target;
      if (!matchesDestination) return false;
    }
    if (city) {
      const targetCity = norm(city);
      const travelCities = Array.isArray((p as any).fields?.travelDestinations)
        ? (p as any).fields.travelDestinations
            .map((d: any) => norm(String(d?.city ?? "")))
            .filter(Boolean)
        : [];
      const headquarterCities = Array.isArray((p as any).fields?.headquarterLocations)
        ? (p as any).fields.headquarterLocations
            .map((d: any) => norm(String(d?.city ?? "")))
            .filter(Boolean)
        : [];
      if (
        norm((p as any).city) !== targetCity &&
        !travelCities.includes(targetCity) &&
        !headquarterCities.includes(targetCity)
      ) {
        return false;
      }
    }

    // Dynamic groups (AND across groups, OR inside each group)
    const selectedOptionIds = new Set((p as any).filterOptions?.map((x: any) => x.filterOptionId) ?? []);
    const hasCategoryContextFilter = Boolean(subcategoryList.length || categoryList.length);
    for (const key of allDynamicKeys) {
      const raw = url.searchParams.get(key);
      if (!raw) continue;
      const wantedValues = splitCsv(raw).map(norm).filter(Boolean);
      if (!wantedValues.length) continue;

      if (key === "prestacion" && (p as any).primaryGroupKey !== "prestacion") {
        if (hasCategoryContextFilter) continue;
        return false;
      }

      const valueMap = optionIdByGroupValue.get(key);
      const wantedIds = new Set<string>();
      if (valueMap) {
        for (const v of wantedValues) {
          const ids = valueMap.get(v);
          if (ids) ids.forEach((id) => wantedIds.add(id));
        }
      }

      let ok = false;
      if (wantedIds.size) {
        for (const id of selectedOptionIds) {
          if (wantedIds.has(id)) {
            ok = true;
            break;
          }
        }
      }

      if (!ok) {
        const publicationValues = publicationValuesByTaxonomyType(p, key);
        ok = wantedValues.some((wanted) => publicationValues.includes(wanted));
      }

      if (!ok) return false;
    }

    // Free text (tolerant to minor typos)
    if (q) {
      const hay = [
        (p as any).title,
        ...i18nValues((p as any).titleI18n),
        (p as any).description,
        ...i18nValues((p as any).descriptionI18n),
        (p as any).country,
        (p as any).city,
        (p as any).category,
        ...i18nValues((p as any).categoryI18n),
        (p as any).subcategory,
        ...i18nValues((p as any).subcategoryI18n),
        (p as any).publisherName,
        ...((p as any).fields?.travelDestinations ?? []).flatMap((d: any) => [
          d?.country,
          d?.city,
        ]),
        ...((p as any).fields?.headquarterLocations ?? []).flatMap((d: any) => [
          d?.country,
          d?.city,
        ]),
        ...(p as any).filterOptions?.map((fo: any) => fo.filterOption?.label ?? "") ?? [],
        ...(p as any).filterOptions?.flatMap((fo: any) => i18nValues(fo.filterOption?.labelI18n)) ?? [],
      ]
        .filter(Boolean)
        .join(" ");
      if (!fuzzyIncludes(hay, q)) return false;
    }

    // Price
    const priceNum = parseMoney((p as any).price);

    if (priceCurrency) {
      const publicationCurrency = String((p as any).currency ?? "").trim().toUpperCase();
      const extraCurrencies = Array.isArray((p as any).fields?.priceByCurrency)
        ? (p as any).fields.priceByCurrency
            .map((entry: any) => String(entry?.currency ?? "").trim().toUpperCase())
            .filter(Boolean)
        : [];
      const hasCurrency = publicationCurrency === priceCurrency || extraCurrencies.includes(priceCurrency);
      if (!hasCurrency) return false;
    }

    if (pricePreset) {
      const presets = splitCsv(pricePreset).map(norm);
      const isNumeric = Number.isFinite(priceNum);
      const presetOk = presets.some((preset) => {
        if (preset === "negotiable") return !isNumeric;
        const match = preset.match(/^(\d+)\s*-\s*(\d+)$/);
        if (match) {
          if (!isNumeric) return false;
          const min = parseMoney(match[1]);
          const max = parseMoney(match[2]);
          return priceNum >= min && priceNum <= max;
        }
        return false;
      });
      if (!presetOk) return false;
    }

    if (priceMin && Number.isFinite(priceNum)) {
      const min = parseMoney(priceMin);
      if (Number.isFinite(min) && priceNum < min) return false;
    }
    if (priceMax && Number.isFinite(priceNum)) {
      const max = parseMoney(priceMax);
      if (Number.isFinite(max) && priceNum > max) return false;
    }
    return true;
  });

  const total = filtered.length;
  if (sort === "priceAsc") {
    filtered.sort((a, b) => {
      const pa = parseMoney((a as any).price);
      const pb = parseMoney((b as any).price);
      const va = Number.isFinite(pa) ? pa : -1;
      const vb = Number.isFinite(pb) ? pb : -1;
      return va - vb;
    });
  } else if (sort === "priceDesc") {
    filtered.sort((a, b) => {
      const pa = parseMoney((a as any).price);
      const pb = parseMoney((b as any).price);
      const va = Number.isFinite(pa) ? pa : Number.POSITIVE_INFINITY;
      const vb = Number.isFinite(pb) ? pb : Number.POSITIVE_INFINITY;
      return vb - va;
    });
  }
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * perPage;
  const items = filtered.slice(start, start + perPage);

  return NextResponse.json({
    ok: true,
    page: safePage,
    perPage,
    total,
    totalPages,
    items,
  });
}
