import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";

import { getBaseUrl } from "@/app/lib/baseUrl";
import type { Category, FilterGroup, Publication } from "@/app/lib/types";
import { convertAmount, formatCurrency, type CurrencyCode } from "@/app/lib/currency";

import Filters from "./_components/Filters";
import ResultsGrid from "./_components/ResultsGrid";
import { PlanProvider } from "./_components/PlanStore";
import SearchBar from "./_components/SearchBar";
import ClientBottomCards from "./_components/ClientBottomCards";
import MobileFiltersDrawer from "./_components/MobileFiltersDrawer";
import SearchForm from "./_components/SearchForm";
import SearchHeader from "./_components/SearchHeader";
import PaginationControls from "./_components/PaginationControls";
import { SearchNavigationProvider } from "./_components/SearchNavigationContext";
import ServicesPromoPanel from "./_components/ServicesPromoPanel";
import PrestacionesSectionHeader from "./_components/PrestacionesSectionHeader";
import HideOnScroll from "./_components/HideOnScroll";
import ScrollAwareFiltersAside from "./_components/ScrollAwareFiltersAside";
import TranslatedText from "@/components/TranslatedText";

type SearchParams = Record<string, string | string[] | undefined>;

function spGet(sp: SearchParams, key: string) {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function normalizeFilterValue(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[,\-/_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCsvValue(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function humanizeFilterValue(value: string) {
  return String(value ?? "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPricePresetLabel(rawValue: string, baseLabel: string, selectedCurrency: CurrencyCode) {
  if (selectedCurrency === "ARS" || rawValue === "negotiable") return baseLabel;
  const normalizedValue = String(rawValue ?? "").replace(/\./g, "").replace(/\s+/g, "").trim();
  const rangeMatch = normalizedValue.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const min = Math.round(convertAmount(Number(rangeMatch[1]), "ARS", selectedCurrency));
    const max = Math.round(convertAmount(Number(rangeMatch[2]), "ARS", selectedCurrency));
    return `${formatCurrency(min, selectedCurrency)} - ${formatCurrency(max, selectedCurrency)}`;
  }
  const openMatch = normalizedValue.match(/^(\d+)\+$/) ?? normalizedValue.match(/^\+(\d+)$/);
  if (openMatch) {
    const min = Math.round(convertAmount(Number(openMatch[1]), "ARS", selectedCurrency));
    return `+ ${formatCurrency(min, selectedCurrency)}`;
  }
  return baseLabel;
}

function buildQuery(sp: SearchParams, overrides: Record<string, string | undefined> = {}) {
  const q = new URLSearchParams();
  const excludedKeys = new Set(Object.entries(overrides).filter(([, value]) => value === undefined).map(([key]) => key));
  for (const [k, v] of Object.entries(sp)) {
    if (excludedKeys.has(k) || Object.prototype.hasOwnProperty.call(overrides, k)) continue;
    if (Array.isArray(v)) {
      v.filter(Boolean).forEach((value) => q.append(k, value));
    } else if (typeof v === "string" && v) {
      q.set(k, v);
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "string" && value) q.set(key, value);
  }
  return q.toString();
}

async function loadCategories() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/categories`, {
    cache: "no-store",
  });
  if (!res.ok) return [] as Category[];
  const data = (await res.json()) as { items?: Category[]; tree?: Category[] };
  // For most UI we want the nested tree (to show subcategories).
  return (data.items ?? data.tree ?? []) as Category[];
}

type PublicationsResponse = {
  items: Publication[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

async function loadPublications(sp: SearchParams, overrides: Record<string, string | undefined> = {}): Promise<PublicationsResponse> {
  const base = await getBaseUrl();
  const qs = buildQuery(sp, overrides);
  const res = await fetch(`${base}/api/publications${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) return { items: [], total: 0, page: 1, perPage: Number(overrides.perPage ?? 12), totalPages: 1 };
  const data = (await res.json()) as {
    items?: Publication[];
    data?: Publication[];
    total?: number;
    page?: number;
    perPage?: number;
    totalPages?: number;
  };

  return {
    items: (data.items ?? data.data ?? []) as Publication[],
    total: Number(data.total ?? 0),
    page: Number(data.page ?? 1),
    perPage: Number(data.perPage ?? 12),
    totalPages: Math.max(1, Number(data.totalPages ?? 1)),
  };
}

async function loadFilterGroups() {
  const base = await getBaseUrl();
  const res = await fetch(`${base}/api/filters`, { cache: "no-store" });
  if (!res.ok) return [] as FilterGroup[];
  const data = (await res.json()) as { ok?: boolean; groups?: FilterGroup[] };
  return data.groups ?? [];
}

function hasSelectedPrestacionFilter(sp: SearchParams, filterGroups: FilterGroup[]) {
  const aliases = new Set(["prestacion", "prestaciones", "service", "services"]);
  filterGroups.forEach((group) => {
    const key = normalizeFilterValue(group.key);
    const label = normalizeFilterValue(group.label);
    const taxonomyType = normalizeFilterValue(String(group.taxonomyType ?? ""));
    if (aliases.has(key) || aliases.has(label) || aliases.has(taxonomyType)) aliases.add(group.key);
  });

  return Array.from(aliases).some((key) => Boolean(spGet(sp, key)));
}
function priceToNumber(p: Publication) {
  if (!p?.price) return null;
  const raw = String(p.price);
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function publicationTextSignals(item: Publication) {
  const fields = ((item as any)?.fields ?? {}) as Record<string, unknown>;
  const filterOptionLabels = (item.filterOptions ?? []).flatMap((entry) => [
    String((entry as any)?.filterOption?.label ?? ""),
    String((entry as any)?.filterOption?.value ?? ""),
    String((entry as any)?.filterOption?.group?.label ?? ""),
    String((entry as any)?.filterOption?.group?.key ?? ""),
  ]);
  const categorySelections = Array.isArray(fields.categorySelections) ? fields.categorySelections : [];
  const subcategorySelections = Array.isArray(fields.subcategorySelections) ? fields.subcategorySelections : [];

  return normalizeText(
    [
      item.category,
      item.subcategory,
      item.primaryGroupKey,
      ...filterOptionLabels,
      ...categorySelections,
      ...subcategorySelections,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function publicationFilterValues(item: Publication) {
  const fields = ((item as any)?.fields ?? {}) as Record<string, unknown>;
  const categorySelections = Array.isArray(fields.categorySelections) ? fields.categorySelections : [];
  const subcategorySelections = Array.isArray(fields.subcategorySelections) ? fields.subcategorySelections : [];
  const filterOptionLabels = (item.filterOptions ?? []).flatMap((entry) => [
    String((entry as any)?.filterOption?.label ?? ""),
    String((entry as any)?.filterOption?.value ?? ""),
  ]);

  return Array.from(
    new Set(
      [
        item.category,
        item.subcategory,
        ...categorySelections,
        ...subcategorySelections,
        ...filterOptionLabels,
      ]
        .map((value) => normalizeFilterValue(String(value ?? "")))
        .filter(Boolean)
    )
  );
}

function filterItemsByAllSelectedCategories(items: Publication[], rawCategory: string, categories: Category[]) {
  const selected = splitCsvValue(rawCategory).map(normalizeFilterValue).filter(Boolean);
  if (selected.length <= 1) return items;

  const categoryByLabel = new Map(categories.map((category) => [normalizeFilterValue(category.description), category]));
  const childrenByParent = new Map<string, Category[]>();
  categories.forEach((category) => {
    if (!category.parentId) return;
    childrenByParent.set(category.parentId, [...(childrenByParent.get(category.parentId) ?? []), category]);
  });

  const allowedLabelsFor = (label: string) => {
    const root = categoryByLabel.get(label);
    const allowed = new Set<string>([label]);
    if (!root) return allowed;
    const queue = [root.id];
    const seen = new Set(queue);
    while (queue.length) {
      const current = queue.shift()!;
      (childrenByParent.get(current) ?? []).forEach((child) => {
        if (seen.has(child.id)) return;
        seen.add(child.id);
        allowed.add(normalizeFilterValue(child.description));
        queue.push(child.id);
      });
    }
    return allowed;
  };

  return items.filter((item) => {
    const values = publicationFilterValues(item);
    return selected.every((selectedLabel) => {
      const allowed = allowedLabelsFor(selectedLabel);
      return values.some((value) => allowed.has(value));
    });
  });
}

function isFeaturedPublication(item: Publication) {
  const fromRoot = Boolean((item as any)?.featured);
  const signalText = publicationTextSignals(item);
  const byText = hasKeyword(signalText, ["destacado", "destaque", "featured", "top"]);
  return fromRoot || byText;
}

function publicationPriority(item: Publication) {
  const featured = isFeaturedPublication(item) ? 1 : 0;
  if (featured) return 1;
  return 0;
}

function sortPublications(list: Publication[], sort?: string, priceCurrency?: string, prioritizeCurrency = false) {
  const arr = [...list];
  const effectiveSort = sort === "featured" ? "relevance" : sort;

  // precio: menor a mayor
  if (effectiveSort === "priceAsc") {
    arr.sort((a, b) => {
      const pa = priceToNumber(a);
      const pb = priceToNumber(b);
      const aWithoutNumericPrice = pa == null;
      const bWithoutNumericPrice = pb == null;

      if (aWithoutNumericPrice && bWithoutNumericPrice) {
        const paPriority = publicationPriority(a);
        const pbPriority = publicationPriority(b);
        if (pbPriority !== paPriority) return pbPriority - paPriority;
        return 0;
      }

      if (aWithoutNumericPrice) return -1;
      if (bWithoutNumericPrice) return 1;

      return pa - pb;
    });
    return arr;
  }


  // precio: mayor a menor
  if (effectiveSort === "priceDesc") {
    arr.sort((a, b) => {
      const pa = priceToNumber(a);
      const pb = priceToNumber(b);
      const aWithoutNumericPrice = pa == null;
      const bWithoutNumericPrice = pb == null;

      if (aWithoutNumericPrice && bWithoutNumericPrice) return 0;
      if (aWithoutNumericPrice) return 1;
      if (bWithoutNumericPrice) return -1;

      return pb - pa;
    });
    return arr;
  }

  // relevance/default/featured: prioridad por badges, luego más nuevos
  arr.sort((a, b) => {
    const paPriority = publicationPriority(a);
    const pbPriority = publicationPriority(b);
    if (pbPriority !== paPriority) return pbPriority - paPriority;

    if (priceCurrency && prioritizeCurrency) {
      const hasCurrency = (item: Publication) => {
        const main = String(item.currency ?? "").trim().toUpperCase() === priceCurrency.toUpperCase();
        const fields = (item.fields ?? {}) as Record<string, unknown>;
        const priceByCurrency = Array.isArray(fields.priceByCurrency) ? fields.priceByCurrency : [];
        const extra = priceByCurrency
          .map((entry) => (entry && typeof entry === "object" ? String((entry as { currency?: unknown }).currency ?? "").trim().toUpperCase() : ""))
          .filter(Boolean)
          .includes(priceCurrency.toUpperCase());
        return main || extra;
      };
      const pa = priceToNumber(a);
      const pb = priceToNumber(b);
      if (pa == null && pb != null) return -1;
      if (pb == null && pa != null) return 1;
      const aMatches = hasCurrency(a) ? 1 : 0;
      const bMatches = hasCurrency(b) ? 1 : 0;
      if (bMatches !== aMatches) return bMatches - aMatches;
    }

    const da = new Date(a?.createdAt ?? 0).getTime() || 0;
    const db = new Date(b?.createdAt ?? 0).getTime() || 0;
    return db - da;
  });

  return arr;
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const sp = await Promise.resolve(searchParams);
  const destinationCountry = spGet(sp, "destinationCountry") ?? "";
  const hasDestinationSelected = Boolean(destinationCountry.trim());
  const hasUsefulSearchFilters = Boolean(
    [
      "q",
      "city",
      "category",
      "subcategory",
      "prestacion",
      "primaryGroupKey",
      "taxonomyType",
      "browse",
    ].some((key) => {
      const value = spGet(sp, key);
      return typeof value === "string" && Boolean(value.trim());
    })
  );
  const shouldActivateResults = hasDestinationSelected || hasUsefulSearchFilters;
  const [categories, filterGroups] = await Promise.all([
    loadCategories(),
    loadFilterGroups(),
  ]);
  const hasPrestacionFilter = hasSelectedPrestacionFilter(sp, filterGroups);
  const normalPage = spGet(sp, "page") ?? "1";
  const prestacionesPage = spGet(sp, "prestacionesPage") ?? "1";
  const emptyPublicationsPayload = { items: [], total: 0, page: 1, perPage: 15, totalPages: 1 };
  const emptyPrestacionesPayload = { items: [], total: 0, page: 1, perPage: 10, totalPages: 1 };
  const [publicationsPayload, prestacionesPayload] = shouldActivateResults
    ? hasPrestacionFilter
      ? [await loadPublications(sp, { page: normalPage, perPage: "15", prestacionesPage: undefined }), null]
      : await Promise.all([
          loadPublications(sp, { page: normalPage, perPage: "15", excludePrimaryGroupKey: "prestacion", prestacionesPage: undefined }),
          loadPublications(sp, { page: prestacionesPage, perPage: "10", primaryGroupKey: "prestacion", prestacionesPage: undefined }),
        ])
    : [emptyPublicationsPayload, hasPrestacionFilter ? null : emptyPrestacionesPayload];
  const visibleBlockIds = new Set(filterGroups.map((group) => group.id));
  const publicCategories = categories.filter(
    (category) => category.isPublicVisible !== false && (!category.blockId || visibleBlockIds.has(category.blockId))
  );
  const { items, total, page, perPage, totalPages } = publicationsPayload;
  const q = spGet(sp, "q") ?? "";
  const city = spGet(sp, "city") ?? "";
  const categoryId = spGet(sp, "category") ?? "";
  const sort = spGet(sp, "sort") ?? "relevance";
  const priceCurrency = spGet(sp, "priceCurrency") ?? "";
  const hasActivePriceFilter = Boolean(
    spGet(sp, "pricePreset") || spGet(sp, "priceMin") || spGet(sp, "priceMax")
  );
  const sortedItems = sortPublications(items, sort, priceCurrency, hasActivePriceFilter);
  const visibleSortedItems = filterItemsByAllSelectedCategories(sortedItems, categoryId, publicCategories);
  const prestacionesItems = prestacionesPayload ? sortPublications(prestacionesPayload.items, sort, priceCurrency, hasActivePriceFilter) : [];
  const visiblePrestacionesItems = filterItemsByAllSelectedCategories(prestacionesItems, categoryId, publicCategories);
  const visibleTotal = categoryId && splitCsvValue(categoryId).length > 1 ? visibleSortedItems.length : total;
  const visibleTotalPages = categoryId && splitCsvValue(categoryId).length > 1
    ? Math.max(1, Math.ceil(visibleTotal / perPage))
    : totalPages;

  const preservedEntries = Object.entries(sp).filter(([key]) => key !== "q");
  const subcategoryId = spGet(sp, "subcategory") ?? "";
  const shownCountry = destinationCountry;
  const breadcrumbItems = [shownCountry, city].filter(Boolean);

  const optionLabelMap = new Map<string, string>();
  filterGroups.forEach((group) => {
    group.options?.forEach((opt) => {
      optionLabelMap.set(`${group.key}:${opt.value}`, opt.label);
      optionLabelMap.set(`${group.key}:${normalizeFilterValue(String(opt.value ?? ""))}`, opt.label);
    });
  });

  const selectedFilters: string[] = [];
  if (q) selectedFilters.push(`“${q}”`);
  if (categoryId) {
    const matchedCategory = publicCategories.find(
      (category) => normalizeFilterValue(category.description) === normalizeFilterValue(categoryId)
    );
    selectedFilters.push(matchedCategory?.description ?? humanizeFilterValue(categoryId));
  }
  if (subcategoryId) {
    const matchedSubcategory = publicCategories.find(
      (category) => normalizeFilterValue(category.description) === normalizeFilterValue(subcategoryId)
    );
    selectedFilters.push(matchedSubcategory?.description ?? humanizeFilterValue(subcategoryId));
  }

  for (const [key, value] of Object.entries(sp)) {
    if (
      ["q", "country", "destinationCountry", "city", "category", "subcategory", "page", "prestacionesPage", "sort", "priceCurrency", "browse"].includes(key)
    )
      continue;
    const rawValues = Array.isArray(value)
      ? value.filter(Boolean).flatMap((v) => splitCsvValue(String(v)))
      : typeof value === "string" && value
        ? splitCsvValue(value)
        : [];

    if (key === "pricePreset") {
      const selectedCurrency = (priceCurrency || "ARS") as CurrencyCode;
      rawValues.forEach((v) => {
        const baseLabel =
          optionLabelMap.get(`${key}:${v}`) ??
          optionLabelMap.get(`${key}:${normalizeFilterValue(String(v))}`) ??
          humanizeFilterValue(String(v));
        selectedFilters.push(formatPricePresetLabel(String(v), baseLabel, selectedCurrency));
      });
      continue;
    }

    rawValues.forEach((v) =>
      selectedFilters.push(
        optionLabelMap.get(`${key}:${v}`) ??
          optionLabelMap.get(`${key}:${normalizeFilterValue(String(v))}`) ??
          humanizeFilterValue(String(v))
      )
    );
  }

  const normalizedSeen = new Set<string>();
  const dedupedFilters = selectedFilters.filter((value) => {
    const key = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
    if (normalizedSeen.has(key)) return false;
    normalizedSeen.add(key);
    return true;
  });

  return (
    <>
      <main className="min-h-screen bg-white">
        <PlanProvider>
          <SearchNavigationProvider>
          {/* Header full width */}
          <div id="home">
            <NavBar />
          </div>

          {/* Barra de búsqueda (full width, como Figma) */}
          <div className="relative z-[180] bg-[#D8F3F0] py-4 shadow-sm shadow-[#0B2B30]/5">
            <div className="mx-auto max-w-6xl px-4">
              <SearchBar />
            </div>
          </div>

          <div className="mx-auto max-w-6xl px-4 pb-12 pt-7">
            {/* Título + breadcrumbs */}
            <HideOnScroll
              className="z-20 bg-white py-3 md:sticky md:top-[5rem]"
              mobileThresholdVh={0.45}
              mobileRevealOnScrollUp={false}
            >
              <SearchHeader breadcrumbItems={breadcrumbItems} dedupedFilters={dedupedFilters} />
            </HideOnScroll>

            <div className="grid gap-7 md:grid-cols-[320px_1fr]">
              {/* Desktop/Tablet: filtros visibles */}
              <ScrollAwareFiltersAside>
                <Filters categories={publicCategories} filterGroups={filterGroups} />
              </ScrollAwareFiltersAside>

              <section id="resultados">
                {shouldActivateResults ? (
                <HideOnScroll
                  className="sticky top-[5.25rem] z-30 mb-6 bg-white py-2 md:top-[190px] md:py-3"
                  hiddenClassName="-translate-y-full opacity-0 pointer-events-none md:-translate-y-8"
                  mobileThresholdVh={0.65}
                >
                  <div className="mb-4">
                    <ServicesPromoPanel filterGroups={filterGroups} publications={hasPrestacionFilter ? visibleSortedItems : [...visibleSortedItems, ...visiblePrestacionesItems]} />
                  </div>
                  <SearchForm q={q} preservedEntries={preservedEntries} />
                </HideOnScroll>
                ) : null}

                <div>
                  {shouldActivateResults ? (
                  <>
                  <div id="publicaciones-normales">
                  <ResultsGrid items={visibleSortedItems} />

                  <PaginationControls
                    currentPage={page}
                    totalPages={visibleTotalPages}
                    totalItems={visibleTotal}
                    pageSize={perPage}
                    searchParams={sp}
                    pageParam="page"
                    anchor="publicaciones-normales"
                    label={hasPrestacionFilter ? "Paginación general de publicaciones" : "Paginación de publicaciones normales"}
                    clearParams={hasPrestacionFilter ? ["prestacionesPage"] : []}
                  />
                </div>

                {/* These two cards are always shown below the results (Figma) */}
                <ClientBottomCards emptyState={!visibleSortedItems.length && !visiblePrestacionesItems.length} />

                {!hasPrestacionFilter && prestacionesPayload ? (
                  <section id="publicaciones-prestaciones" className="mt-8">
                    {visiblePrestacionesItems.length ? <PrestacionesSectionHeader /> : null}

                    <ResultsGrid items={visiblePrestacionesItems} />

                    <PaginationControls
                      currentPage={prestacionesPayload.page}
                      totalPages={prestacionesPayload.totalPages}
                      totalItems={prestacionesPayload.total}
                      pageSize={prestacionesPayload.perPage}
                      searchParams={sp}
                      pageParam="prestacionesPage"
                      anchor="publicaciones-prestaciones"
                      label="Paginación de publicaciones de prestaciones"
                    />
                  </section>
                ) : null}
                  </>
                  ) : (
                    <div className="rounded-3xl border border-[#BDECF2] bg-[#EFFBFD] p-6 text-center text-[#0B6B7A] shadow-sm">
                      <h2 className="text-lg font-semibold"><TranslatedText id="elegir_destino_para_oportunidades" /></h2>
                      <p className="mt-2 text-sm text-slate-600">
                        <TranslatedText id="destino_activa_publicaciones" />
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>

          {/* Mobile: botón flotante + drawer */}
            <MobileFiltersDrawer categories={publicCategories} filterGroups={filterGroups} />

          </SearchNavigationProvider>
        </PlanProvider>

        <footer>
          <Footer />
        </footer>
      </main>
    </>
  );
}
