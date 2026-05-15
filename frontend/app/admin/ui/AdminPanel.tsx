"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowUpRight, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { pickI18nText, type I18nRecord } from "@/app/lib/i18nContent";
import { optimizeImageAssetList, uploadImageAsset, uploadRemoteImageAssetToCloudinary, type ImageAsset } from "@/app/lib/cloudinaryUpload";
import CountryMultiSelect from "@/components/CountryMultiSelect";
import RichTextEditor from "@/components/RichTextEditor";
import { type AdminSection } from "./AdminControlLayout";

const LANGS = ["es", "en", "pt", "it"] as const;
const IMAGE_FILE_ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif,image/avif,image/bmp,image/tiff,image/heic,image/heif";

async function fileToUploadAsset(file: File) {
  return uploadImageAsset(file, { folder: "admin", maxSizeMB: 0.65, maxWidthOrHeight: 1600 });
}

function imageAssetToUrl(assetOrUrl: ImageAsset | string | null | undefined) {
  if (!assetOrUrl) return "";
  if (typeof assetOrUrl === "string") return assetOrUrl;
  return String(assetOrUrl.url || assetOrUrl.secureUrl || "");
}

type Lang = (typeof LANGS)[number];

type Category = {
  id: string;
  description: string;
  descriptionI18n?: I18nRecord | null;
  iconImageUrl?: string | null;
  cardImageUrl?: string | null;
  taxonomyType: string;
  blockId?: string | null;
  parentId?: string | null;
  order?: number;
  isPublicVisible?: boolean;
  isPrimaryCategory?: boolean;
};

type FilterOption = {
  id: string;
  groupId: string;
  value: string;
  label: string;
  labelI18n?: I18nRecord | null;
  parentId?: string | null;
  order?: number | null;
};

type FilterGroup = {
  id: string;
  key: string;
  label: string;
  labelI18n?: I18nRecord | null;
  imageUrl?: string | null;
  taxonomyType?: string | null;
  isProfileBlock?: boolean | null;
  isPublicVisible?: boolean | null;
  type: "multi" | "single" | "range";
  order?: number | null;
  options: FilterOption[];
};

type PublicationFilterOption = {
  filterOptionId: string;
  filterOption: FilterOption;
};
type ReportItem = {
  id: string;
  publicationId: string;
  publicationTitle?: string | null;
  reason?: string | null;
  details?: string | null;
  fullName?: string | null;
  contact?: string | null;
  email?: string | null;
  createdAt?: string;
};

type Publication = {
  id: string;
  title: string;
  titleI18n?: I18nRecord | null;
  description: string;
  descriptionI18n?: I18nRecord | null;
  status: string;
  featured: boolean;

  category?: string | null;
  categoryI18n?: I18nRecord | null;
  subcategory?: string | null;
  subcategoryI18n?: I18nRecord | null;
  primaryGroupKey?: string | null;
  contentLanguage?: string | null;
  publisherName?: string | null;

  country?: string | null;
  headquarterCountry?: string | null;
  city?: string | null;

  currency?: string | null;
  price?: string | null;

  languages?: string | null;
  images?: string | null;
  website?: string | null;
  socialLinks?: Record<string, string> | null;
  expiration?: string | null;

  fields?: any;
  filterOptions?: PublicationFilterOption[];
  createdAt?: string;
};

type LocationInput = { country: string; city: string; mapUrl: string };
type SocialLinkDetail = { kind: string; label: string; url: string };
type PrestacionButton = { label: string; labelI18n?: I18nRecord; url: string; style: "primary" | "secondary"; bgColor?: string; textColor?: string };
type PrestacionResource = {
  title: string;
  titleI18n?: I18nRecord;
  subtitle: string;
  subtitleI18n?: I18nRecord;
  image: string;
  imageI18n?: I18nRecord;
  prestationRef: string;
  checkItems: string[];
  checkItemsI18n?: I18nRecord[];
  buttons: PrestacionButton[];
  colorNoteTitle?: string;
  colorNoteTitleI18n?: I18nRecord;
  colorNoteText?: string;
  colorNoteTextI18n?: I18nRecord;
  colorNoteBgColor?: string;
  colorNoteTextColor?: string;
};
type PrestacionStep = { title: string; titleI18n?: I18nRecord; subtitle: string; subtitleI18n?: I18nRecord; image?: string; imageI18n?: I18nRecord; prestationRef: string };
type PrestacionFaq = { question: string; questionI18n?: I18nRecord; answer: string; answerI18n?: I18nRecord; prestationRef: string };
type PrestacionColorBlock = { title: string; text: string; bgColor: string; textColor: string; prestationRef: string };
type PrestacionHeroInfoBlock = { title: string; titleI18n?: I18nRecord; text: string; textI18n?: I18nRecord; bgColor: string; textColor: string };

const createEmptyPrestacionResource = (): PrestacionResource => ({
  title: "",
  titleI18n: { es: "" },
  subtitle: "",
  subtitleI18n: { es: "" },
  image: "",
  imageI18n: { es: "" },
  prestationRef: "",
  checkItems: [],
  checkItemsI18n: [],
  buttons: [],
  colorNoteTitle: "",
  colorNoteTitleI18n: { es: "" },
  colorNoteText: "",
  colorNoteTextI18n: { es: "" },
  colorNoteBgColor: "#EEF2FF",
  colorNoteTextColor: "#1E3A8A",
});

const createEmptyPrestacionStep = (): PrestacionStep => ({
  title: "",
  titleI18n: { es: "" },
  subtitle: "",
  subtitleI18n: { es: "" },
  image: "",
  imageI18n: { es: "" },
  prestationRef: "",
});

const createEmptyPrestacionFaq = (): PrestacionFaq => ({
  question: "",
  questionI18n: { es: "" },
  answer: "",
  answerI18n: { es: "" },
  prestationRef: "",
});

const createEmptyPrestacionColorBlock = (): PrestacionColorBlock => ({
  title: "",
  text: "",
  bgColor: "#EEF2FF",
  textColor: "#312E81",
  prestationRef: "",
});

const createEmptyPrestacionHeroInfoBlock = (): PrestacionHeroInfoBlock => ({
  title: "",
  titleI18n: { es: "" },
  text: "",
  textI18n: { es: "" },
  bgColor: "#DBEAFE",
  textColor: "#1E3A8A",
});

type TravelService = {
  id: string;
  taxonomyType: string;
  category: string[] | string;
  typeProfile?: string[] | string | null;
  email: string;
  phone?: string | null;
  name?: string | null;
  status?: string | null;
  isOfrezco?: boolean | null;
  isIntermediario?: boolean | null;
  country?: string | null;
  destinationCountry?: string | null;
  city?: string | null;
  headquarterCountry?: string | null;
  whatSearching?: string | null;
  whatStop?: string | null;
  contanos?: string | null;
  website?: string | null;
  activity?: string[] | string | null;
  modality?: string[] | string | null;
  languages?: string[] | string | null;
  passports?: string[] | string | null;
  venues?: Array<{ country?: string; city?: string; address?: string; mapUrl?: string }> | null;
  providerLogo?: string | null;
  professionalLink?: string | null;
  whatsappLink?: string | null;
  travelerContactLink?: string | null;
  price?: string | null;
  currency?: string | null;
  priceByCurrency?: Array<{ currency?: string; amount?: string }> | null;
  publicationPlan?: string | null;
  images?: string[] | null;
  createdAt?: string;
};

function parseTravelServiceExtra(service: TravelService): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(service.whatSearching ?? "{}"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function serviceEffectiveStatus(service: TravelService): string {
  const raw = String(service.status ?? service.whatStop ?? "").trim().toLowerCase();
  return raw || "pendiente";
}

function receivingModeLabel(mode: unknown): string {
  const normalized = String(mode ?? "").trim().toLowerCase();
  if (normalized === "except") return "Recibe a todos excepto";
  if (normalized === "only") return "Recibe solo lo seleccionado";
  return "Recibe viajeros de todos los países";
}

function parseProviderLinks(raw: string): { website: string; socialLinks: SocialLinkDetail[] } {
  const cleaned = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!cleaned) return { website: "", socialLinks: [] };

  const normalizeUrl = (value: string) => {
    const token = value.trim().replace(/^\/+|\/+$/g, "");
    if (!token) return "";
    if (/^https?:\/\//i.test(token) || /^mailto:/i.test(token)) return token;
    if (token.includes("@") && !token.includes(" ")) return `mailto:${token}`;
    return `https://${token}`;
  };

  const detectKind = (url: string) => {
    const normalized = url.toLowerCase();
    if (normalized.includes("instagram.")) return "instagram";
    if (normalized.includes("facebook.")) return "facebook";
    if (normalized.includes("tiktok.")) return "tiktok";
    if (normalized.includes("youtube.") || normalized.includes("youtu.be")) return "youtube";
    if (normalized.includes("linkedin.")) return "linkedin";
    if (normalized.includes("wa.me") || normalized.includes("whatsapp.")) return "whatsapp";
    if (normalized.startsWith("mailto:")) return "email";
    return "web";
  };

  const tokens = cleaned
    .split(/[\n,;|]+/)
    .flatMap((part) => part.split(/\s{2,}|\s+\/+\s+/))
    .map((part) => part.trim())
    .filter(Boolean);

  const normalizedTokens = Array.from(new Set(tokens.map(normalizeUrl).filter(Boolean)));
  const social = normalizedTokens
    .map((url) => {
      const kind = detectKind(url);
      return {
        kind,
        label: kind === "web" ? "Web" : kind.charAt(0).toUpperCase() + kind.slice(1),
        url,
      };
    })
    .filter((entry) => entry.kind !== "web");
  const websiteEntry = normalizedTokens.find((url) => detectKind(url) === "web") ?? "";
  const fallbackWebsite = websiteEntry || normalizedTokens[0] || "";
  return { website: fallbackWebsite, socialLinks: social };
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    if (res.status === 401 && typeof window !== "undefined") {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/admin/login?next=${encodeURIComponent(next)}`;
    }
    throw new Error(data?.error || data?.message || `Error ${res.status}`);
  }
  return data as T;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const cleaned = String(value ?? "").trim();
    if (cleaned) return cleaned;
  }
  return "";
}

function readPublicationAnalytics(publication: Publication) {
  const analytics = (publication.fields as Record<string, any> | undefined)?.analytics ?? {};
  const toNum = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    views: toNum(analytics.views),
    leads: toNum(analytics.leads),
    favorites: toNum(analytics.favorites),
    shares: toNum(analytics.shares),
  };
}


function getLangValue(i18n: I18nRecord | null | undefined, lang: Lang, fallback = "") {
  return firstNonEmpty(i18n?.[lang], i18n?.es, fallback);
}

function setLangText(base: string, i18n: I18nRecord | undefined, lang: Lang, value: string) {
  const next = { ...(i18n ?? { es: base || "" }), [lang]: value };
  if (lang === "es") next.es = value;
  return next;
}

function firstNonEmptyI18n(i18n?: I18nRecord | null, fallback = "") {
  return firstNonEmpty(i18n?.es, i18n?.en, i18n?.pt, i18n?.it, fallback);
}

function getLangEditValue(i18n: I18nRecord | null | undefined, lang: Lang, fallback = "") {
  const value = i18n?.[lang];
  if (value !== undefined && value !== null) return String(value);
  return String(fallback ?? "");
}

function getLangMediaValue(i18n: I18nRecord | null | undefined, lang: Lang, fallback = "") {
  const value = firstNonEmpty(i18n?.[lang], i18n?.es, fallback);
  if (String(value).startsWith("data:image/")) return "";
  return value;
}


type DashboardStatCardProps = {
  label: string;
  total: number;
  active: number;
  monthly: number;
  activeMonthly: number;
  tone: "blue" | "violet" | "emerald" | "rose";
};

function DashboardStatCard({ label, total, active, monthly, activeMonthly, tone }: DashboardStatCardProps) {
  const tones = {
    blue: "from-blue-50 to-blue-100 border-blue-200 text-blue-700",
    violet: "from-violet-50 to-violet-100 border-violet-200 text-violet-700",
    emerald: "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700",
    rose: "from-rose-50 to-rose-100 border-rose-200 text-rose-700",
  } as const;

  return (
    <div className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-5 shadow-sm`}>
      <p className="text-xs font-semibold uppercase tracking-widest opacity-70">{label}</p>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-4xl font-bold tracking-tight">{total.toLocaleString()}</p>
          <p className="text-xs opacity-70">en sistema</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{active.toLocaleString()}</p>
          <p className="text-xs opacity-70">activos</p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-black/10 pt-2 text-xs">
        <ArrowUpRight className="h-3.5 w-3.5" />
        <span>+{monthly.toLocaleString()} en el mes</span>
        <span className="opacity-70">· activos mes: {activeMonthly.toLocaleString()}</span>
      </div>
    </div>
  );
}

function MiniBars({ values, tone }: { values: number[]; tone: "indigo" | "violet" | "emerald" | "rose" }) {
  const toneMap = {
    indigo: "bg-indigo-500/70",
    violet: "bg-violet-500/70",
    emerald: "bg-emerald-500/70",
    rose: "bg-rose-500/70",
  } as const;

  return (
    <div className="mt-4 flex h-24 items-end gap-1">
      {values.map((value, index) => (
        <div key={`${tone}-${index}`} className="flex-1 rounded-t-sm bg-slate-100">
          <div className={`w-full rounded-t-sm ${toneMap[tone]}`} style={{ height: `${Math.max(value, 8)}%` }} />
        </div>
      ))}
    </div>
  );
}




type ChartPeriod = "days" | "weeks" | "months" | "years";
type ChartMode = "bar" | "line";

type ChartPoint = {
  label: string;
  a: number;
  b?: number;
};

const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const normalizeCountryText = (value: string) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = b.length + 1;
  const cols = a.length + 1;
  const dp = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i += 1) dp[i][0] = i;
  for (let j = 0; j < cols; j += 1) dp[0][j] = j;
  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[rows - 1][cols - 1];
}

function pointsForLine(values: number[], width: number, height: number, maxValue: number, padding = { left: 34, right: 10, top: 8, bottom: 24 }) {
  const usableWidth = Math.max(1, width - padding.left - padding.right);
  const usableHeight = Math.max(1, height - padding.top - padding.bottom);
  const max = Math.max(maxValue, 1);
  return values.map((value, index) => {
    const x = padding.left + (index / Math.max(values.length - 1, 1)) * usableWidth;
    const y = padding.top + (1 - value / max) * usableHeight;
    return { x, y };
  });
}

type StatsChartCardProps = {
  title: string;
  labelA: string;
  labelB?: string;
  colorA: string;
  colorB?: string;
  single?: boolean;
  getData: (period: ChartPeriod, year: number) => ChartPoint[];
};

function StatsChartCard({ title, labelA, labelB, colorA, colorB = "#c7d2fe", single = false, getData }: StatsChartCardProps) {
  const [period, setPeriod] = useState<ChartPeriod>("months");
  const [mode, setMode] = useState<ChartMode>("bar");
  const [year, setYear] = useState(String(Math.max(2026, new Date().getFullYear())));
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const end = Math.max(2026, currentYear);
    return Array.from({ length: end - 2026 + 1 }, (_, index) => String(2026 + index));
  }, [currentYear]);

  useEffect(() => {
    if (yearOptions.includes(year)) return;
    setYear(yearOptions[yearOptions.length - 1] ?? "2026");
  }, [year, yearOptions]);

  const data = useMemo(() => getData(period, Number(year)), [getData, period, year]);
  const first = data.map((d) => d.a);
  const second = data.map((d) => d.b ?? 0);
  const max = Math.max(...data.flatMap((entry) => [entry.a, entry.b ?? 0]), 1);
  const yMax = Math.max(350, Math.ceil(max / 50) * 50);
  const yTicks = Array.from({ length: Math.floor(yMax / 50) + 1 }, (_, index) => index * 50);
  const svgWidth = 560;
  const svgHeight = 160;
  const chartPadding = { left: 34, right: 10, top: 8, bottom: 24 };
  const usableWidth = svgWidth - chartPadding.left - chartPadding.right;
  const usableHeight = svgHeight - chartPadding.top - chartPadding.bottom;

  const lineA = pointsForLine(first, svgWidth, svgHeight, yMax, chartPadding);
  const lineB = pointsForLine(second, svgWidth, svgHeight, yMax, chartPadding);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <div className="rounded-lg bg-slate-100 p-0.5">
            <button className={`rounded-md px-2 py-1 ${mode === "bar" ? "bg-white shadow text-slate-700" : "text-slate-400"}`} onClick={() => setMode("bar")}>Barras</button>
            <button className={`rounded-md px-2 py-1 ${mode === "line" ? "bg-white shadow text-slate-700" : "text-slate-400"}`} onClick={() => setMode("line")}>Líneas</button>
          </div>
          <div className="rounded-lg bg-slate-100 p-0.5">
            {(["days", "weeks", "months", "years"] as ChartPeriod[]).map((value) => (
              <button key={value} className={`rounded-md px-2 py-1 ${period === value ? "bg-white shadow text-indigo-600" : "text-slate-400"}`} onClick={() => setPeriod(value)}>
                {value === "days" ? "Días" : value === "weeks" ? "Semanas" : value === "months" ? "Meses" : "Años"}
              </button>
            ))}
          </div>
          {period !== "years" ? (
            <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600" value={year} onChange={(event) => setYear(event.target.value)}>
              {yearOptions.map((yearValue) => (
                <option key={yearValue} value={yearValue}>{yearValue}</option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="relative">
        {hoverIndex !== null ? (
          <div className="absolute left-2 top-2 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow">
            <p className="font-semibold text-slate-700">{data[hoverIndex]?.label}</p>
            <p style={{ color: colorA }}>{labelA}: {data[hoverIndex]?.a ?? 0}</p>
            {!single ? <p style={{ color: colorB }}>{labelB}: {data[hoverIndex]?.b ?? 0}</p> : null}
          </div>
        ) : null}

        {mode === "bar" ? (
          <div className="grid h-44 grid-cols-12 items-end gap-2">
            {data.map((item, index) => {
              const heightA = `${Math.max(6, (item.a / max) * 100)}%`;
              const heightB = `${Math.max(6, ((item.b ?? 0) / max) * 100)}%`;
              return (
                <div key={`${item.label}-${index}`} className="flex h-full flex-col items-center justify-end gap-1" onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => setHoverIndex(null)}>
                  <div className="flex h-[85%] w-full items-end justify-center gap-1">
                    <span className="w-2 rounded-t-sm" style={{ height: heightA, backgroundColor: colorA }} />
                    {!single ? <span className="w-2 rounded-t-sm" style={{ height: heightB, backgroundColor: colorB }} /> : null}
                  </div>
                  <span className="text-[10px] text-slate-400">{item.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-44 w-full">
            <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-full w-full">
              {yTicks.map((tick) => {
                const y = chartPadding.top + (1 - tick / yMax) * usableHeight;
                return (
                  <g key={`tick-${tick}`}>
                    <line x1={chartPadding.left} y1={y} x2={svgWidth - chartPadding.right} y2={y} stroke="#E5E7EB" strokeWidth="1" />
                    <text x={chartPadding.left - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94A3B8">
                      {tick}
                    </text>
                  </g>
                );
              })}
              {data.map((item, index) => {
                const x = chartPadding.left + (index / Math.max(data.length - 1, 1)) * usableWidth;
                return (
                  <text key={`x-${item.label}-${index}`} x={x} y={svgHeight - 6} textAnchor="middle" fontSize="9" fill="#94A3B8">
                    {item.label}
                  </text>
                );
              })}
              <line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={svgHeight - chartPadding.bottom} stroke="#94A3B8" strokeWidth="1" />
              <line x1={chartPadding.left} y1={svgHeight - chartPadding.bottom} x2={svgWidth - chartPadding.right} y2={svgHeight - chartPadding.bottom} stroke="#94A3B8" strokeWidth="1" />
              <polyline fill="none" stroke={colorA} strokeWidth="3" points={lineA.map((p) => `${p.x},${p.y}`).join(" ")} />
              {!single ? <polyline fill="none" stroke={colorB} strokeWidth="3" points={lineB.map((p) => `${p.x},${p.y}`).join(" ")} /> : null}
              {lineA.map((point, index) => (
                <circle key={`a-${index}`} cx={point.x} cy={point.y} r="6" fill="transparent" onMouseEnter={() => setHoverIndex(index)} onMouseLeave={() => setHoverIndex(null)} />
              ))}
            </svg>
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colorA }} />{labelA}</span>
        {!single ? <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colorB }} />{labelB}</span> : null}
      </div>
    </div>
  );
}

type AdminPanelProps = {
  section: AdminSection;
  publicationsView?: "overview" | "new";
};

export default function AdminPanel({ section, publicationsView = "overview" }: AdminPanelProps) {
  const { locale } = useTranslation();
  const router = useRouter();
  const isNewPublicationPage = publicationsView === "new";
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [travelServices, setTravelServices] = useState<TravelService[]>([]);
  const [countryCatalog, setCountryCatalog] = useState<string[]>([]);
  const [userTab, setUserTab] = useState<"oferentes" | "demandantes">("oferentes");
  const [userSearch, setUserSearch] = useState("");
  const [detailTravelService, setDetailTravelService] = useState<TravelService | null>(null);
  const [detailImageExpanded, setDetailImageExpanded] = useState<string | null>(null);
  const [publicationTab, setPublicationTab] = useState<"publicaciones" | "denuncias">("publicaciones");
  const [publicationSearch, setPublicationSearch] = useState("");
  const [publicationTypeFilter, setPublicationTypeFilter] = useState<"todas" | "publicacion" | "prestacion">("todas");
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});
  const [expandedPanelBlocks, setExpandedPanelBlocks] = useState<Record<string, boolean>>({});
  const [destinationCountrySearch, setDestinationCountrySearch] = useState("");
  const [originCountrySearch, setOriginCountrySearch] = useState("");
  const [passportCountrySearch, setPassportCountrySearch] = useState("");
  const [showPublicationEditor, setShowPublicationEditor] = useState(isNewPublicationPage);

  // --- Category form ---
  const [catLang, setCatLang] = useState<Lang>("es");
  const [catI18n, setCatI18n] = useState<I18nRecord>({ es: "" });
  const [catTaxonomyType, setCatTaxonomyType] = useState("inherit");
  const [catBlockId, setCatBlockId] = useState<string>("");
  const [catParentId, setCatParentId] = useState<string>("");
  const [catError, setCatError] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});
  const [categoryModalMode, setCategoryModalMode] = useState<"category" | "block">("category");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [catPriceMin, setCatPriceMin] = useState("");
  const [catPriceMax, setCatPriceMax] = useState("");
  const [catPriceCurrency, setCatPriceCurrency] = useState("ARS");
  const [catIsPublicVisible, setCatIsPublicVisible] = useState(true);
  const [catIsPrimaryCategory, setCatIsPrimaryCategory] = useState(false);
  const [catIconImageUrl, setCatIconImageUrl] = useState("");
  const [catCardImageUrl, setCatCardImageUrl] = useState("");
  const [catIconImageTouched, setCatIconImageTouched] = useState(false);
  const [catCardImageTouched, setCatCardImageTouched] = useState(false);

  const [blockLang, setBlockLang] = useState<Lang>("es");
  const [blockLabelI18n, setBlockLabelI18n] = useState<I18nRecord>({ es: "" });
  const [blockImageUrl, setBlockImageUrl] = useState("");
  const [blockTaxonomyType, setBlockTaxonomyType] = useState("categoria");
  const [blockIsPublicVisible, setBlockIsPublicVisible] = useState(true);
  const [blockError, setBlockError] = useState("");
  type BlockCategoryDraft = {
    id: string;
    lang: Lang;
    parentDraftId: string;
    taxonomyType: string;
    isPublicVisible: boolean;
    isPrimaryCategory: boolean;
    iconImageUrl: string;
    cardImageUrl: string;
    nameI18n: I18nRecord;
  };
  const [blockCategoryDrafts, setBlockCategoryDrafts] = useState<BlockCategoryDraft[]>([]);

  // --- Filter group form ---
  const [fgLang, setFgLang] = useState<Lang>("es");
  const [fgLabel, setFgLabel] = useState("");
  const [fgLabelI18n, setFgLabelI18n] = useState<I18nRecord>({ es: "" });
  const [fgTaxonomyType, setFgTaxonomyType] = useState("default");
  const [fgIsProfileBlock, setFgIsProfileBlock] = useState(false);
  const [fgError, setFgError] = useState("");

  // --- Filter option form ---
  type FilterOptionDraft = {
    lang: Lang;
    labelI18n: I18nRecord;
    value: string;
    parentId: string;
    order: string;
  };
  const defaultFilterOptionDraft: FilterOptionDraft = {
    lang: "es",
    labelI18n: { es: "" },
    value: "",
    parentId: "",
    order: "10",
  };
  const [foDrafts, setFoDrafts] = useState<Record<string, FilterOptionDraft>>({});

  // --- Publication form ---
  const [pLang, setPLang] = useState<Lang>("es");
  const [pTitle, setPTitle] = useState("");
  const [pTitleI18n, setPTitleI18n] = useState<I18nRecord>({ es: "" });
  const [pDescription, setPDescription] = useState("");
  const [pDescriptionI18n, setPDescriptionI18n] = useState<I18nRecord>({ es: "" });
  const [pPublisherName, setPPublisherName] = useState("");
  const [pProviderEmail, setPProviderEmail] = useState("");
  const [pStatus, setPStatus] = useState("active");
  const [pFeatured, setPFeatured] = useState(false);
  const [pPartner, setPPartner] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [pCategory, setPCategory] = useState("");
  const [pCategoryI18n, setPCategoryI18n] = useState<I18nRecord | null>(null);
  const [pSubcategory, setPSubcategory] = useState("");
  const [pSubcategoryI18n, setPSubcategoryI18n] = useState<I18nRecord | null>(null);
  const [pCategorySelections, setPCategorySelections] = useState<string[]>([]);
  const [pSubcategorySelections, setPSubcategorySelections] = useState<string[]>([]);
  const [pPrimaryGroupKey, setPPrimaryGroupKey] = useState("category");
  const [pCategoryOptionId, setPCategoryOptionId] = useState<string>("");
  const [pSubcategoryOptionId, setPSubcategoryOptionId] = useState<string>("");
  const [pContentLanguage, setPContentLanguage] = useState("es");

  const [pCountry, setPCountry] = useState("");
  const [pHeadquarterCountry, setPHeadquarterCountry] = useState("");
  const [pHeadquarterCity, setPHeadquarterCity] = useState("");
  const [pHeadquarterMapUrl, setPHeadquarterMapUrl] = useState("");
  const [pHeadquarterExtras, setPHeadquarterExtras] = useState<LocationInput[]>([]);
  const [pCity, setPCity] = useState("");
  const [pCurrency, setPCurrency] = useState("ARS");
  const [pPrice, setPPrice] = useState("");
  const [pPricePeriod, setPPricePeriod] = useState("month");
  type ExtraPrice = { currency: string; amount: string };
  const [pExtraPrices, setPExtraPrices] = useState<ExtraPrice[]>([]);
  const [pLanguages, setPLanguages] = useState("");
  const [pImageUrls, setPImageUrls] = useState("");
  const [pImageUploads, setPImageUploads] = useState<string[]>([]);
  const [pImageUploadAssets, setPImageUploadAssets] = useState<ImageAsset[]>([]);
  const [pWebsite, setPWebsite] = useState("");
  const [pLocationAddress, setPLocationAddress] = useState("");
  const [pReceivingCountries, setPReceivingCountries] = useState<string[]>([]);
  const [pReceivingCountriesMode, setPReceivingCountriesMode] = useState<"all" | "only" | "except">("all");
  const [pTourismType, setPTourismType] = useState<"receptivo" | "emisivo">("receptivo");
  type ExtraDescription = {
    title: string;
    body: string;
    titleI18n: I18nRecord;
    bodyI18n: I18nRecord;
    lang: Lang;
    visibleInCard?: boolean;
  };
  const [pExtraDescriptions, setPExtraDescriptions] = useState<ExtraDescription[]>([]);
  const [pProviderInfoLang, setPProviderInfoLang] = useState<Lang>("es");
  const [pProviderInfoI18n, setPProviderInfoI18n] = useState<I18nRecord>({ es: "" });
  const [pProviderRating, setPProviderRating] = useState("4");
  const [pProviderReviewCount, setPProviderReviewCount] = useState("0");
  const [pProviderCommentsUrl, setPProviderCommentsUrl] = useState("");
  const [pProviderStartYear, setPProviderStartYear] = useState("");
  const [pProviderActivity, setPProviderActivity] = useState("");
  const [pProviderType, setPProviderType] = useState("");
  const [pProviderActivities, setPProviderActivities] = useState<string[]>([]);
  const [pProviderTypes, setPProviderTypes] = useState<string[]>([]);
  const [pProviderModalities, setPProviderModalities] = useState<string[]>([]);
  const [pProviderOrigin, setPProviderOrigin] = useState("");
  const [pProviderLogo, setPProviderLogo] = useState("");
  const [pFieldsBase, setPFieldsBase] = useState<Record<string, any>>({});
  const [pSocialLinksDetailed, setPSocialLinksDetailed] = useState<SocialLinkDetail[]>([]);
  const [pExpirationDate, setPExpirationDate] = useState("");
  const [pExpirationTime, setPExpirationTime] = useState("");
  const [openTaxonomyTypePanels, setOpenTaxonomyTypePanels] = useState<Record<string, boolean>>({});
  const [openPublicationPanel, setOpenPublicationPanel] = useState<"category" | null>(null);
  const [expandedPublicationGroups, setExpandedPublicationGroups] = useState<Record<string, boolean>>({});
  const [pPrestaciones, setPPrestaciones] = useState<string[]>([]);
  const [pPrestacionCategory, setPPrestacionCategory] = useState("");
  const [pPrestacionDestinationCountries, setPPrestacionDestinationCountries] = useState<string[]>([]);
  const [pPrestacionHeroImage, setPPrestacionHeroImage] = useState("");
  const [pPrestacionHeroImageI18n, setPPrestacionHeroImageI18n] = useState<I18nRecord>({ es: "" });
  const [pPrestacionHeroTitleI18n, setPPrestacionHeroTitleI18n] = useState<I18nRecord>({ es: "" });
  const [pPrestacionHeroSubtitleI18n, setPPrestacionHeroSubtitleI18n] = useState<I18nRecord>({ es: "" });
  const [pPrestacionHeroInfoBlocks, setPPrestacionHeroInfoBlocks] = useState<PrestacionHeroInfoBlock[]>([createEmptyPrestacionHeroInfoBlock()]);
  const [pPrestacionRelatedIds, setPPrestacionRelatedIds] = useState<string[]>([]);
  const [pPrestacionRelatedSearch, setPPrestacionRelatedSearch] = useState("");
  const [pPrestacionRelatedCategory, setPPrestacionRelatedCategory] = useState("todas");
  const [pEditorMode, setPEditorMode] = useState<"publicacion" | "prestacion">("publicacion");
  const [pApprovedProviderSearch, setPApprovedProviderSearch] = useState("");
  const [pPrestacionResources, setPPrestacionResources] = useState<PrestacionResource[]>([createEmptyPrestacionResource()]);
  const [pPrestacionSteps, setPPrestacionSteps] = useState<PrestacionStep[]>([createEmptyPrestacionStep()]);
  const [pPrestacionFaqs, setPPrestacionFaqs] = useState<PrestacionFaq[]>([createEmptyPrestacionFaq()]);
  const [pPrestacionColorBlocks, setPPrestacionColorBlocks] = useState<PrestacionColorBlock[]>([createEmptyPrestacionColorBlock()]);
  const [resourceItemDrafts, setResourceItemDrafts] = useState<Record<number, string>>({});
  const [resourceButtonDrafts, setResourceButtonDrafts] = useState<Record<number, { label: string; labelI18n: I18nRecord; url: string; style: "primary" | "secondary"; bgColor: string; textColor: string }>>({});

  const [pFilterOptionIds, setPFilterOptionIds] = useState<string[]>([]);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingFilterGroup, setSavingFilterGroup] = useState(false);
  const [savingPublication, setSavingPublication] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [filterOptionError, setFilterOptionError] = useState<Record<string, string>>({});

  const categoryLockRef = useRef(false);
  const filterGroupLockRef = useRef(false);
  const filterOptionLockRef = useRef<Record<string, boolean>>({});
  const publicationLockRef = useRef(false);
  const publicationsTopRef = useRef<HTMLDivElement | null>(null);

  const roots = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const categoryBlocks = useMemo(
    () => [...filterGroups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [filterGroups]
  );
  const rootCategoriesByBlock = useMemo(() => {
    const map = new Map<string, Category[]>();
    roots.forEach((category) => {
      const key = category.blockId ?? "__unassigned__";
      map.set(key, [...(map.get(key) ?? []), category]);
    });
    for (const [key, value] of map) {
      map.set(key, [...value].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.description || "").localeCompare(b.description || "")));
    }
    return map;
  }, [roots]);
  const filterGroupById = useMemo(() => {
    const map = new Map<string, FilterGroup>();
    filterGroups.forEach((group) => map.set(group.id, group));
    return map;
  }, [filterGroups]);
  const categoryTaxonomyTypeByLabel = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => {
      if (c.description) map.set(c.description, c.taxonomyType);
    });
    return map;
  }, [categories]);
  const childrenBy = useMemo(() => {
    const m = new Map<string, Category[]>();
    for (const c of categories) {
      if (c.parentId) m.set(c.parentId, [...(m.get(c.parentId) ?? []), c]);
    }
    for (const [k, arr] of m) arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.description || "").localeCompare(b.description || ""));
    return m;
  }, [categories]);

  const parentSelectedTaxonomyType = useMemo(() => {
    if (!catParentId) return "";
    return categories.find((c) => c.id === catParentId)?.taxonomyType ?? "";
  }, [catParentId, categories]);

  const showCategoryParentSelector = useMemo(() => {
    if (catParentId) return true;
    if (!editingCategoryId) return false;
    const editingCategory = categories.find((category) => category.id === editingCategoryId);
    return Boolean(editingCategory?.parentId);
  }, [catParentId, editingCategoryId, categories]);

  const statusLabel = (value: string) => {
    const map: Record<string, string> = {
      active: "Activo",
      draft: "Borrador",
      paused: "Pausado",
      hidden: "Oculto",
    };
    return map[value] ?? value;
  };

  const linkKindOptions = [
    { value: "linkedin", label: "LinkedIn" },
    { value: "facebook", label: "Facebook" },
    { value: "instagram", label: "Instagram" },
    { value: "tiktok", label: "TikTok" },
    { value: "youtube", label: "YouTube" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "email", label: "Email" },
    { value: "web", label: "Web" },
    { value: "other", label: "Otro" },
  ];

  const buildExpirationIso = () => {
    const normalizedDate = String(pExpirationDate ?? "").trim();
    if (!normalizedDate) return null;

    const [yearText, monthText, dayText] = normalizedDate.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

    const normalizedTime = String(pExpirationTime ?? "").trim();
    const [hourText = "0", minuteText = "0"] = normalizedTime ? normalizedTime.split(":") : [];
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

    const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(localDate.getTime())) return null;
    return localDate.toISOString();
  };

  const setEditingLang = (lang: Lang) => {
    setPLang(lang);
    setPProviderInfoLang(lang);
    window.setTimeout(() => {
      publicationsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  useEffect(() => {
    if (!pCountry.trim()) return;
    if (pHeadquarterCountry.trim()) return;
    setPHeadquarterCountry(pCountry);
  }, [pCountry, pHeadquarterCountry]);

  useEffect(() => {
    if (catParentId) {
      setCatTaxonomyType("inherit");
      const parentCategory = categories.find((c) => c.id === catParentId);
      if (parentCategory?.blockId) setCatBlockId(parentCategory.blockId);
      return;
    }
    if (catTaxonomyType === "inherit") setCatTaxonomyType("inherit");
  }, [catParentId, categories]);

  async function refresh() {
    const [cats, groups, pubs, services, reportsData] = await Promise.all([
      api<{ ok: true; items: Category[] }>("/api/categories").then((d) => d.items),
      api<{ ok: true; groups: FilterGroup[] }>("/api/admin/filters").then((d) => d.groups),
      api<{ ok: true; items: Publication[] }>("/api/admin/publications").then((d) => d.items),
      api<{ ok: true; items: TravelService[] }>("/api/travel-services").then((d) => d.items),
      api<{ ok: true; items: ReportItem[] }>("/api/reports").then((d) => d.items),
    ]);

    setCategories(cats);
    setFilterGroups(groups.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    setPublications(pubs);
    setTravelServices(services);
    setReports(reportsData);
    setExpandedBlocks({});
    setExpandedCategories({});
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await refresh();
      } catch (error) {
        console.error("No se pudo cargar el panel admin", error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    let active = true;
    fetch("https://restcountries.com/v3.1/all?fields=name,translations")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const names = Array.isArray(data)
          ? data
              .map((entry: any) =>
                firstNonEmpty(
                  entry?.translations?.spa?.common,
                  entry?.translations?.es?.common,
                  entry?.name?.common
                )
              )
              .filter(Boolean)
          : [];
        const unique = Array.from(new Set(names.map((name: string) => String(name).trim()))).sort((a, b) => a.localeCompare(b));
        setCountryCatalog(unique);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const normalizeBlockKey = (input: string) => {
    const clean = input
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    if (["precio", "price", "preco", "prezzo"].includes(clean)) return "price";
    return clean;
  };
  const slugifyFilterValue = (input: string) =>
    String(input ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  const normalizeComparable = (input: string) =>
    String(input ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();
  const normalizeTaxonomyTypeAlias = (input: string) => {
    const normalized = normalizeBlockKey(input || "default");
    if (["voluntariado", "voluntario", "voluntariados", "destino", "destinos"].includes(normalized)) return "categoria";
    return normalized;
  };

  const priceSymbolByCurrency: Record<string, string> = {
    ARS: "$",
    USD: "US$",
    EUR: "€",
    BRL: "R$",
    JPY: "¥",
    GBP: "£",
  };

  const createEmptyBlockCategoryDraft = (parentDraftId = ""): BlockCategoryDraft => ({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    lang: "es",
    parentDraftId,
    taxonomyType: "inherit",
    isPublicVisible: true,
    isPrimaryCategory: false,
    iconImageUrl: "",
    cardImageUrl: "",
    nameI18n: { es: "", en: "", pt: "", it: "" },
  });

  const addBlockCategoryDraft = (parentDraftId = "") => {
    setBlockCategoryDrafts((prev) => [...prev, createEmptyBlockCategoryDraft(parentDraftId)]);
  };

  const updateBlockCategoryDraft = (draftId: string, updater: (prev: BlockCategoryDraft) => BlockCategoryDraft) => {
    setBlockCategoryDrafts((prev) => prev.map((item) => (item.id === draftId ? updater(item) : item)));
  };

  const removeBlockCategoryDraft = (draftId: string) => {
    setBlockCategoryDrafts((prev) => {
      const descendantIds = new Set<string>([draftId]);
      let changed = true;
      while (changed) {
        changed = false;
        prev.forEach((item) => {
          if (!descendantIds.has(item.id) && item.parentDraftId && descendantIds.has(item.parentDraftId)) {
            descendantIds.add(item.id);
            changed = true;
          }
        });
      }
      return prev.filter((item) => !descendantIds.has(item.id));
    });
  };

  const blockDraftChildrenByParent = useMemo(() => {
    const map = new Map<string, BlockCategoryDraft[]>();
    blockCategoryDrafts.forEach((draft) => {
      const key = draft.parentDraftId || "__root__";
      map.set(key, [...(map.get(key) ?? []), draft]);
    });
    return map;
  }, [blockCategoryDrafts]);

  const blockRootDrafts = useMemo(
    () => blockCategoryDrafts.filter((draft) => !draft.parentDraftId),
    [blockCategoryDrafts]
  );

  async function addCategory() {
    if (savingCategory || categoryLockRef.current) return;
    categoryLockRef.current = true;
    const baseDescription = firstNonEmpty(catI18n.es);
    if (!baseDescription) {
      setCatError("El nombre en Español es obligatorio.");
      categoryLockRef.current = false;
      return;
    }
    const selectedBlockId = catBlockId;
    if (!catParentId && !selectedBlockId) {
      setCatError("Tenés que seleccionar un bloque para la categoría.");
      categoryLockRef.current = false;
      return;
    }
    setCatError("");
    setSavingCategory(true);

    const parentId = catParentId || null;
    const parentCategory = parentId ? categories.find((c) => c.id === parentId) : null;
    const resolvedBlockId = parentCategory?.blockId ?? (selectedBlockId || null);
    const resolvedBlockTaxonomyType = resolvedBlockId ? String(filterGroupById.get(resolvedBlockId)?.taxonomyType ?? "").trim() : "";

    let taxonomyType = catTaxonomyType;
    if (parentId) {
      taxonomyType = catTaxonomyType === "inherit" ? parentSelectedTaxonomyType || resolvedBlockTaxonomyType || "categoria" : catTaxonomyType;
    }

    if (["inherit", "default", "predeterminado", ""].includes(String(taxonomyType ?? "").trim().toLowerCase())) {
      taxonomyType = parentSelectedTaxonomyType || resolvedBlockTaxonomyType || "categoria";
    }

    try {
      const resolvedCatIconImageUrl = catIsPrimaryCategory ? (catIconImageUrl.trim() || null) : null;
      const resolvedCatCardImageUrl = catIsPrimaryCategory ? (catCardImageUrl.trim() || null) : null;
      const payload = {
        description: baseDescription,
        descriptionI18n: {
          ...catI18n,
          es: baseDescription,
        },
        taxonomyType,
        parentId,
        blockId: resolvedBlockId,
        order: editingCategoryId
          ? categories.find((category) => category.id === editingCategoryId)?.order ?? 0
          : (() => {
              const siblingMax = categories
                .filter((category) => (category.parentId ?? null) === parentId && (category.blockId ?? null) === (resolvedBlockId ?? null))
                .reduce((max, category) => Math.max(max, Number(category.order ?? 0)), -1);
              return siblingMax + 1;
            })(),
        isPublicVisible: catIsPublicVisible,
        isPrimaryCategory: catIsPrimaryCategory,
        iconImageUrl: editingCategoryId
          ? catIsPrimaryCategory
            ? (catIconImageTouched ? resolvedCatIconImageUrl : undefined)
            : null
          : resolvedCatIconImageUrl,
        cardImageUrl: editingCategoryId
          ? catIsPrimaryCategory
            ? (catCardImageTouched ? resolvedCatCardImageUrl : undefined)
            : null
          : resolvedCatCardImageUrl,
      };

      if (editingCategoryId) {
        await api(`/api/admin/categories/${encodeURIComponent(editingCategoryId)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/admin/categories", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });

        try {
          const selectedBlock = resolvedBlockId ? filterGroupById.get(resolvedBlockId) : null;
          if (selectedBlock?.key === "price" && catPriceMin && catPriceMax) {
            const min = Number(catPriceMin);
            const max = Number(catPriceMax);
            if (Number.isFinite(min) && Number.isFinite(max) && min <= max) {
              const currency = String(catPriceCurrency || "ARS").trim().toUpperCase();
              const symbol = priceSymbolByCurrency[currency] ?? `${currency} `;
              await api("/api/admin/filter-options", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  groupId: selectedBlock.id,
                  label: `${symbol}${min} - ${symbol}${max}`,
                  labelI18n: { es: `${symbol}${min} - ${symbol}${max}` },
                  value: `${min}-${max}`,
                }),
              });

              const currencyOptionValue = `currency:${currency}`;
              const existsCurrencyOption = (selectedBlock.options ?? []).some(
                (option) => option.value.toLowerCase() === currencyOptionValue.toLowerCase()
              );
              if (!existsCurrencyOption) {
                await api("/api/admin/filter-options", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({
                    groupId: selectedBlock.id,
                    label: currency,
                    labelI18n: { es: currency },
                    value: currencyOptionValue,
                  }),
                });
              }
            }
          } else if (selectedBlock) {
            const parentOptionId = parentCategory
              ? (selectedBlock.options ?? []).find((option) => option.label === parentCategory.description)?.id ?? ""
              : "";
            const alreadyExists = (selectedBlock.options ?? []).some(
              (option) => option.label === baseDescription && (option.parentId ?? "") === parentOptionId
            );
            if (!alreadyExists) {
              const fallback = Date.now().toString(36);
              const baseValue = slugifyFilterValue(baseDescription) || `opt-${fallback}`;
              const siblingValues = new Set(
                (selectedBlock.options ?? [])
                  .filter((option) => (option.parentId ?? "") === parentOptionId)
                  .map((option) => String(option.value ?? "").toLowerCase())
              );
              let value = baseValue;
              let suffix = 2;
              while (siblingValues.has(value.toLowerCase())) {
                value = `${baseValue}-${suffix}`;
                suffix += 1;
              }
              await api("/api/admin/filter-options", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  groupId: selectedBlock.id,
                  label: baseDescription,
                  labelI18n: {
                    ...catI18n,
                    es: baseDescription,
                  },
                  value,
                  parentId: parentOptionId || null,
                }),
              });
            }
          }
        } catch (syncError) {
          console.warn("Categoría creada, pero no se pudo sincronizar la opción en el bloque.", syncError);
        }
      }

      setCatI18n({ es: "" });
      setCatParentId("");
      setCatBlockId("");
      setEditingCategoryId(null);
      setCatPriceMin("");
      setCatPriceMax("");
      setCatPriceCurrency("ARS");
      setCatIsPublicVisible(true);
      setCatIsPrimaryCategory(false);
      setCatIconImageUrl("");
      setCatCardImageUrl("");
      setCatIconImageTouched(false);
      setCatCardImageTouched(false);
      setShowCategoryModal(false);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar la categoría.";
      setCatError(message);
      return;
    } finally {
      setSavingCategory(false);
      categoryLockRef.current = false;
    }
  }

  async function saveBlockFromModal() {
    if (savingFilterGroup || filterGroupLockRef.current) return;
    filterGroupLockRef.current = true;
    const label = firstNonEmpty(blockLabelI18n.es);
    if (!label) {
      setBlockError("El nombre del bloque en Español es obligatorio.");
      filterGroupLockRef.current = false;
      return;
    }
    setBlockError("");
    setSavingFilterGroup(true);

    try {
      const normalizedKey = normalizeBlockKey(label);
      const blockType = normalizedKey === "price" ? "range" : "multi";
      let savedBlockId = editingBlockId ?? "";
      if (editingBlockId) {
        await api(`/api/admin/filter-groups/${encodeURIComponent(editingBlockId)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label,
            labelI18n: { ...blockLabelI18n, es: label },
            imageUrl: blockImageUrl.trim() || null,
            taxonomyType: blockTaxonomyType,
            isPublicVisible: blockIsPublicVisible,
            type: blockType,
          }),
        });
        savedBlockId = editingBlockId;
      } else {
        const maxOrder = filterGroups.reduce((acc, group) => Math.max(acc, group.order ?? 0), 0);
        const createdGroup = await api<{ ok: true; group: FilterGroup }>("/api/admin/filters", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            key: normalizedKey,
            label,
            labelI18n: { ...blockLabelI18n, es: label },
            imageUrl: blockImageUrl.trim() || null,
            type: blockType,
            taxonomyType: blockTaxonomyType,
            isPublicVisible: blockIsPublicVisible,
            order: maxOrder + 1,
          }),
        });
        savedBlockId = createdGroup.group.id;
      }

      if (!editingBlockId && savedBlockId && blockCategoryDrafts.length) {
        const draftById = new Map(blockCategoryDrafts.map((draft) => [draft.id, draft]));
        const draftIdsByParent = new Map<string, string[]>();
        blockCategoryDrafts.forEach((draft) => {
          const key = draft.parentDraftId || "__root__";
          draftIdsByParent.set(key, [...(draftIdsByParent.get(key) ?? []), draft.id]);
        });
        const createdCategoryIdByDraftId = new Map<string, string>();
        const createdTaxonomyTypeByDraftId = new Map<string, string>();
        const createdFilterOptionIdByDraftId = new Map<string, string>();
        const siblingValuesByParent = new Map<string, Set<string>>();
        const pendingDraftIds = new Set(blockCategoryDrafts.map((draft) => draft.id));
        const isPriceBlock = normalizedKey === "price";

        for (let guard = 0; guard < 200 && pendingDraftIds.size > 0; guard += 1) {
          let progressed = false;
          for (const draftId of Array.from(pendingDraftIds)) {
            const draft = draftById.get(draftId);
            if (!draft) {
              pendingDraftIds.delete(draftId);
              continue;
            }

            const baseDescription = firstNonEmpty(draft.nameI18n.es);
            if (!baseDescription) {
              pendingDraftIds.delete(draftId);
              continue;
            }

            const parentDraftId = draft.parentDraftId || "";
            if (parentDraftId && !createdCategoryIdByDraftId.has(parentDraftId)) continue;

            const parentId = parentDraftId ? createdCategoryIdByDraftId.get(parentDraftId) ?? null : null;
            const siblingKey = parentDraftId || "__root__";
            const siblingDraftIds = draftIdsByParent.get(siblingKey) ?? [];
            const order = Math.max(0, siblingDraftIds.indexOf(draftId));
            const normalizedDraftTaxonomy = normalizeTaxonomyTypeAlias(draft.taxonomyType || "");
            const inheritedTaxonomy = parentDraftId
              ? createdTaxonomyTypeByDraftId.get(parentDraftId) || blockTaxonomyType || "categoria"
              : blockTaxonomyType || "categoria";
            const taxonomyType = ["inherit", "default", "predeterminado", ""].includes(normalizedDraftTaxonomy)
              ? inheritedTaxonomy
              : normalizedDraftTaxonomy;

            const createdCategory = await api<{ ok: true; item: Category }>("/api/admin/categories", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                description: baseDescription,
                descriptionI18n: {
                  ...draft.nameI18n,
                  es: baseDescription,
                },
                taxonomyType,
                parentId,
                blockId: savedBlockId,
                order,
                isPublicVisible: draft.isPublicVisible,
                isPrimaryCategory: draft.isPrimaryCategory,
                iconImageUrl: draft.isPrimaryCategory ? (draft.iconImageUrl.trim() || null) : null,
                cardImageUrl: draft.isPrimaryCategory ? (draft.cardImageUrl.trim() || null) : null,
              }),
            });

            createdCategoryIdByDraftId.set(draftId, createdCategory.item.id);
            createdTaxonomyTypeByDraftId.set(draftId, taxonomyType);

            if (!isPriceBlock) {
              const parentOptionId = parentDraftId ? createdFilterOptionIdByDraftId.get(parentDraftId) ?? "" : "";
              const siblingKey = parentOptionId || "__root__";
              if (!siblingValuesByParent.has(siblingKey)) siblingValuesByParent.set(siblingKey, new Set());
              const siblingValues = siblingValuesByParent.get(siblingKey)!;
              const fallback = Date.now().toString(36);
              const baseValue = slugifyFilterValue(baseDescription) || `opt-${fallback}`;
              let value = baseValue;
              let suffix = 2;
              while (siblingValues.has(value.toLowerCase())) {
                value = `${baseValue}-${suffix}`;
                suffix += 1;
              }
              siblingValues.add(value.toLowerCase());

              const createdOption = await api<{ ok: true; option: FilterOption }>("/api/admin/filter-options", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  groupId: savedBlockId,
                  label: baseDescription,
                  labelI18n: {
                    ...draft.nameI18n,
                    es: baseDescription,
                  },
                  value,
                  parentId: parentOptionId || null,
                }),
              });
              createdFilterOptionIdByDraftId.set(draftId, createdOption.option.id);
            }

            pendingDraftIds.delete(draftId);
            progressed = true;
          }
          if (!progressed) break;
        }
      }

      setBlockLabelI18n({ es: "" });
      setBlockImageUrl("");
      setBlockTaxonomyType("categoria");
      setBlockIsPublicVisible(true);
      setBlockCategoryDrafts([]);
      setEditingBlockId(null);
      setShowCategoryModal(false);
      await refresh();
    } finally {
      setSavingFilterGroup(false);
      filterGroupLockRef.current = false;
    }
  }

  async function deleteCategory(id: string) {
    if (!window.confirm("¿Seguro que querés eliminar esta categoría?")) return;
    await api(`/api/admin/categories/${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  }

  const openCreateCategoryModal = (parentId = "", blockId = "") => {
    setCategoryModalMode("category");
    setCatError("");
    setEditingCategoryId(null);
    setEditingBlockId(null);
    setCatParentId(parentId);
    setCatBlockId(blockId);
    setCatTaxonomyType("inherit");
    setCatI18n({ es: "", en: "", pt: "", it: "" });
    setCatPriceMin("");
    setCatPriceMax("");
    setCatPriceCurrency("ARS");
    setCatIsPublicVisible(true);
    setCatIsPrimaryCategory(false);
    setCatIconImageUrl("");
    setCatCardImageUrl("");
    setCatIconImageTouched(false);
    setCatCardImageTouched(false);
    setShowCategoryModal(true);
  };

  const openCreateBlockModal = () => {
    setCategoryModalMode("block");
    setEditingCategoryId(null);
    setEditingBlockId(null);
    setBlockError("");
    setBlockLabelI18n({ es: "", en: "", pt: "", it: "" });
    setBlockImageUrl("");
    setBlockTaxonomyType("categoria");
    setBlockIsPublicVisible(true);
    setBlockCategoryDrafts([]);
    setShowCategoryModal(true);
  };

  const openEditCategoryModal = (category: Category) => {
    setCategoryModalMode("category");
    setEditingCategoryId(category.id);
    setEditingBlockId(null);
    setCatParentId(category.parentId ?? "");
    setCatBlockId(category.blockId ?? "");
    setCatTaxonomyType(category.taxonomyType || "inherit");
    setCatI18n((category.descriptionI18n as I18nRecord) ?? { es: category.description });
    setCatPriceMin("");
    setCatPriceMax("");
    setCatPriceCurrency("ARS");
    setCatIsPublicVisible(category.isPublicVisible !== false);
    setCatIsPrimaryCategory(category.isPrimaryCategory === true);
    setCatIconImageUrl(category.iconImageUrl ?? "");
    setCatCardImageUrl(category.cardImageUrl ?? "");
    setCatIconImageTouched(false);
    setCatCardImageTouched(false);
    setShowCategoryModal(true);
  };

  const openEditBlockModal = (group: FilterGroup) => {
    setCategoryModalMode("block");
    setEditingBlockId(group.id);
    setEditingCategoryId(null);
    setBlockLang("es");
    setBlockLabelI18n((group.labelI18n as I18nRecord) ?? { es: group.label });
    setBlockImageUrl(group.imageUrl ?? "");
    setBlockTaxonomyType(group.taxonomyType ?? "categoria");
    setBlockIsPublicVisible(group.isPublicVisible !== false);
    setBlockCategoryDrafts([]);
    setShowCategoryModal(true);
  };

  async function addFilterGroup() {
    if (savingFilterGroup || filterGroupLockRef.current) return;
    filterGroupLockRef.current = true;
    const label = firstNonEmpty(fgLabelI18n.es, fgLabel);
    const slugify = (input: string) =>
      input
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    const key = slugify(label);
    const maxOrder = filterGroups.reduce((acc, group) => Math.max(acc, group.order ?? 0), 0);
    const order = maxOrder + 1;

    if (!key || !label) {
      setFgError("El nombre en Español es obligatorio.");
      filterGroupLockRef.current = false;
      return;
    }
    setFgError("");

    setSavingFilterGroup(true);
    try {
      await api("/api/admin/filters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key,
          label,
          labelI18n: {
            ...fgLabelI18n,
            es: label,
          },
          order,
          type: "multi",
          taxonomyType: fgTaxonomyType,
          isProfileBlock: fgIsProfileBlock,
        }),
      });

      setFgLabel("");
      setFgLabelI18n({ es: "" });
      setFgTaxonomyType("default");
      setFgIsProfileBlock(false);
      await refresh();
    } finally {
      setSavingFilterGroup(false);
      filterGroupLockRef.current = false;
    }
  }

  async function deleteFilterGroup(id: string) {
    const block = filterGroups.find((group) => group.id === id);
    if (block?.key === "price") {
      window.alert("El bloque Precio es obligatorio y no se puede eliminar.");
      return;
    }
    if (!window.confirm("¿Seguro que querés eliminar este bloque?")) return;
    await api(`/api/admin/filters?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  }

  const getFoDraft = (groupId: string) => foDrafts[groupId] ?? defaultFilterOptionDraft;

  const updateFoDraft = (groupId: string, updater: (draft: FilterOptionDraft) => FilterOptionDraft) => {
    setFoDrafts((prev) => ({
      ...prev,
      [groupId]: updater(prev[groupId] ?? defaultFilterOptionDraft),
    }));
  };

  async function addFilterOption(groupId: string) {
    if (!groupId) return;
    if (filterOptionLockRef.current[groupId]) return;
    filterOptionLockRef.current[groupId] = true;
    const draft = getFoDraft(groupId);
    const label = firstNonEmpty(draft.labelI18n.es, draft.labelI18n[fgLang]);
    const slugify = (input: string) =>
      input
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
    const value = draft.value.trim() || slugify(label);
    const group = filterGroups.find((item) => item.id === groupId);
    const maxOrder = (group?.options ?? []).reduce((acc, opt) => Math.max(acc, opt.order ?? 0), 0);
    const order = maxOrder + 1;
    const parentId = draft.parentId || null;
    if (!label || !value) {
      setFilterOptionError((prev) => ({ ...prev, [groupId]: "El label en Español es obligatorio." }));
      filterOptionLockRef.current[groupId] = false;
      return;
    }
    setFilterOptionError((prev) => ({ ...prev, [groupId]: "" }));

    try {
      await api("/api/admin/filter-options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          groupId,
          label,
          labelI18n: {
            ...draft.labelI18n,
            es: label,
          },
          value,
          order,
          parentId,
        }),
      });

      setFoDrafts((prev) => ({
        ...prev,
        [groupId]: { ...defaultFilterOptionDraft },
      }));
      await refresh();
    } finally {
      filterOptionLockRef.current[groupId] = false;
    }
  }

  async function deleteFilterOption(id: string) {
    await api(`/api/admin/filter-options?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  }

  function toggleFilterOption(optionId: string, checked: boolean) {
    setPFilterOptionIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(optionId);
      else next.delete(optionId);
      return Array.from(next);
    });
  }

  async function handleImageUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next = await Promise.all(Array.from(files).map((file) => fileToUploadAsset(file)));
    setPImageUploads((prev) => [...prev, ...next.map((asset) => asset.url)]);
    setPImageUploadAssets((prev) => [...prev, ...next]);
  }

  async function handleProviderLogoUpload(file: File | null) {
    if (!file) return;
    const next = await fileToUploadAsset(file);
    setPProviderLogo(next.url);
    setPFieldsBase((prev) => ({ ...prev, providerLogoAsset: next }));
  }

  async function createPublication() {
    if (savingPublication || publicationLockRef.current) return;
    publicationLockRef.current = true;
    const fallbackPrestacionTitle = firstNonEmpty(
      pPrestacionResources[0]?.title,
      pPrestacionSteps[0]?.title,
      pPrestacionFaqs[0]?.question,
      "Prestación"
    );
    const fallbackPrestacionDescription = firstNonEmpty(
      pPrestacionResources[0]?.subtitle,
      pPrestacionColorBlocks[0]?.text,
      pPrestacionSteps[0]?.subtitle,
      "Contenido de prestación"
    );
    const prestacionHeroTitle = firstNonEmptyI18n(pPrestacionHeroTitleI18n);
    const title = pEditorMode === "prestacion"
      ? firstNonEmpty(pPrestacionHeroTitleI18n.es, prestacionHeroTitle, fallbackPrestacionTitle, pTitleI18n.es, pTitle)
      : firstNonEmpty(pTitleI18n.es, pTitle);
    const titleI18n = pEditorMode === "prestacion"
      ? { ...pTitleI18n, ...pPrestacionHeroTitleI18n, es: title }
      : { ...pTitleI18n, es: title };
    const description = pEditorMode === "prestacion"
      ? firstNonEmpty(pDescriptionI18n.es, pDescription, fallbackPrestacionDescription)
      : firstNonEmpty(pDescriptionI18n.es, pDescription);
    if (!title || !description) {
      setSaveMessage("Título y descripción en Español son obligatorios.");
      publicationLockRef.current = false;
      return;
    }
    setSaveMessage("");
    setSavingPublication(true);
    const languages = pLanguages
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const socialLinksDetailed = pSocialLinksDetailed
      .map((entry) => ({
        kind: String(entry.kind ?? "").trim(),
        label: String(entry.label ?? "").trim(),
        url: (() => {
          const rawUrl = String(entry.url ?? "").trim();
          const kind = String(entry.kind ?? "").trim().toLowerCase();
          if (!rawUrl) return "";
          if (kind === "email") {
            if (rawUrl.startsWith("mailto:")) return rawUrl;
            return rawUrl.includes("@") ? `mailto:${rawUrl}` : rawUrl;
          }
          if (/^https?:\/\//i.test(rawUrl) || /^mailto:/i.test(rawUrl)) return rawUrl;
          return `https://${rawUrl}`;
        })(),
      }))
      .filter((entry) => entry.kind && entry.url);
    const socialLinks = socialLinksDetailed.reduce<Record<string, string>>((acc, entry) => {
      if (!acc[entry.kind]) acc[entry.kind] = entry.url;
      return acc;
    }, {});

    const validFilterOptionIds = new Set(filterGroups.flatMap((group) => (group.options ?? []).map((option) => option.id)));
    const selectedGroupOptionIds = new Set<string>(pFilterOptionIds.filter((id) => validFilterOptionIds.has(id)));
    const prestacionGroup = filterGroups.find((group) => {
      const key = normalizeComparable(group.key);
      const taxonomyType = normalizeComparable(String(group.taxonomyType ?? ""));
      return ["prestacion", "prestaciones"].includes(key) || ["prestacion", "prestaciones"].includes(taxonomyType);
    });
    const selectedPrestacionesValues = pEditorMode === "prestacion"
      ? (pPrestacionCategory ? [pPrestacionCategory] : [])
      : pPrestaciones.filter(Boolean);
    if (prestacionGroup?.options?.length) {
      const prestacionOptionIds = new Set(prestacionGroup.options.map((option) => option.id));
      Array.from(selectedGroupOptionIds).forEach((optionId) => {
        if (prestacionOptionIds.has(optionId)) {
          selectedGroupOptionIds.delete(optionId);
        }
      });
      selectedPrestacionesValues.forEach((prestacionValue) => {
        const matchedOption = prestacionGroup.options.find((option) =>
          normalizeComparable(option.value) === normalizeComparable(prestacionValue)
        );
        if (matchedOption?.id) selectedGroupOptionIds.add(matchedOption.id);
      });
    }

    const primaryDestination = normalizeLocation({
      country: pCountry,
      city: pCity,
      mapUrl: pLocationAddress,
    });
    const travelDestinations = uniqueLocations([primaryDestination]);
    const primaryHeadquarter = normalizeLocation({
      country: pHeadquarterCountry,
      city: pHeadquarterCity,
      mapUrl: pHeadquarterMapUrl,
    });
    const extraHeadquarters = pHeadquarterExtras.map((loc) =>
      normalizeLocation({
        country: loc.country,
        city: loc.city,
        mapUrl: loc.mapUrl,
      })
    );
    const headquarterLocations = uniqueLocations([primaryHeadquarter, ...extraHeadquarters]);
    const baseDestinationCountries = travelDestinations
      .map((dest) => dest.country)
      .filter(Boolean);
    const destinationCountries = pEditorMode === "prestacion"
      ? Array.from(new Set(pPrestacionDestinationCountries.map((country) => String(country ?? "").trim()).filter(Boolean)))
      : baseDestinationCountries;

    const normalizedPrestacionCategory = pEditorMode === "prestacion"
      ? firstNonEmpty(pPrestacionCategory)
      : "";
    const existingImageAssets = Array.isArray((pFieldsBase as any).imageAssets)
      ? ((pFieldsBase as any).imageAssets as ImageAsset[])
      : [];
    const uploadedAssetsByUrl = new Map(pImageUploadAssets.map((asset) => [asset.url, asset]));
    const existingAssetsByUrl = new Map(existingImageAssets.map((asset) => [imageAssetToUrl(asset), asset]).filter(([url]) => url));
    const optimizedImageAssets = imageList.length
      ? await Promise.all(imageList.map(async (url) => {
          const existingUpload = uploadedAssetsByUrl.get(url) || existingAssetsByUrl.get(url);
          return existingUpload || uploadRemoteImageAssetToCloudinary(url, { folder: "admin/publications" });
        }))
      : [];
    const optimizedImageList = optimizedImageAssets.map((asset) => asset.url).filter(Boolean);
    const existingProviderLogoAsset = (pFieldsBase as any).providerLogoAsset as ImageAsset | undefined;
    const optimizedProviderLogoAsset = pProviderLogo
      ? (existingProviderLogoAsset && imageAssetToUrl(existingProviderLogoAsset) === pProviderLogo
          ? existingProviderLogoAsset
          : await uploadRemoteImageAssetToCloudinary(pProviderLogo, { folder: "admin/providers" }))
      : null;
    const optimizedProviderLogo = optimizedProviderLogoAsset?.url || pProviderLogo;
    const effectiveCategorySelections = pCategorySelections.filter(Boolean);
    const effectiveSubcategorySelections = pSubcategorySelections.filter(Boolean);

    const payload = {
      title,
      titleI18n,
      description,
      descriptionI18n: {
        ...pDescriptionI18n,
        es: description,
      },
      publisherName: pPublisherName || null,
      status: pStatus,
      featured: pFeatured,

      category: pEditorMode === "prestacion"
        ? (normalizedPrestacionCategory || null)
        : (pCategorySelections[0] || pCategory || null),
      categoryI18n: pCategoryI18n || null,
      subcategory: pEditorMode === "prestacion"
        ? (normalizedPrestacionCategory || null)
        : (pSubcategorySelections[0] || pSubcategory || null),
      subcategoryI18n: pSubcategoryI18n || null,
      primaryGroupKey: pEditorMode === "prestacion" ? "prestacion" : "category",
      contentLanguage: pContentLanguage || null,

      country: pCountry || null,
      headquarterCountry: primaryHeadquarter.country || headquarterLocations[0]?.country || null,
      city: pCity || null,

      currency: pCurrency || null,
      price: pPrice || null,

      languages: languages.length ? languages : null,
      images: optimizedImageList.length ? optimizedImageList : null,
      website: pWebsite || null,
      fields: {
        ...pFieldsBase,
        partner: pPartner,
        providerEmail: pProviderEmail || null,
        locationAddress: pLocationAddress || null,
        providerInfoI18n: Object.keys(pProviderInfoI18n).length ? pProviderInfoI18n : null,
        providerRating: pProviderRating || null,
        providerReviewCount: pProviderReviewCount || null,
        providerCommentsUrl: pProviderCommentsUrl || null,
        providerStartYear: pProviderStartYear || null,
        providerActivity: pProviderActivities[0] || pProviderActivity || null,
        providerType: pProviderTypes[0] || pProviderType || null,
        providerModality: pProviderModalities[0] || null,
        providerActivities: pProviderActivities.filter(Boolean),
        providerTypes: pProviderTypes.filter(Boolean),
        providerModalities: pProviderModalities.filter(Boolean),
        categorySelections: effectiveCategorySelections,
        subcategorySelections: effectiveSubcategorySelections,
        prestaciones: selectedPrestacionesValues,
        prestationHeroImage: firstNonEmptyI18n(pPrestacionHeroImageI18n, pPrestacionHeroImage) || null,
        prestationHeroImageI18n: pPrestacionHeroImageI18n,
        prestationHeroTitle: firstNonEmptyI18n(pPrestacionHeroTitleI18n),
        prestationHeroTitleI18n: pPrestacionHeroTitleI18n,
        prestationHeroSubtitle: firstNonEmptyI18n(pPrestacionHeroSubtitleI18n),
        prestationHeroSubtitleI18n: pPrestacionHeroSubtitleI18n,
        prestationHeroInfoBlocks: pPrestacionHeroInfoBlocks.map((entry) => ({
          ...entry,
          title: firstNonEmptyI18n(entry.titleI18n, entry.title),
          text: firstNonEmptyI18n(entry.textI18n, entry.text),
        })),
        prestationResources: pPrestacionResources.map((entry) => ({
          ...entry,
          title: firstNonEmptyI18n(entry.titleI18n, entry.title),
          subtitle: firstNonEmptyI18n(entry.subtitleI18n, entry.subtitle),
          image: firstNonEmptyI18n(entry.imageI18n, entry.image),
          imageI18n: entry.imageI18n,
          checkItems: (entry.checkItemsI18n ?? [])
            .map((it, idx) => firstNonEmptyI18n(it, entry.checkItems[idx]))
            .filter(Boolean),
          buttons: (entry.buttons ?? []).map((btn) => ({ ...btn, label: firstNonEmptyI18n(btn.labelI18n, btn.label) })),
          colorNoteTitle: firstNonEmptyI18n(entry.colorNoteTitleI18n, entry.colorNoteTitle),
          colorNoteText: firstNonEmptyI18n(entry.colorNoteTextI18n, entry.colorNoteText),
          prestationRef: normalizedPrestacionCategory || "",
        })),
        prestationSteps: pPrestacionSteps.map((entry) => ({ ...entry, title: firstNonEmptyI18n(entry.titleI18n, entry.title), subtitle: firstNonEmptyI18n(entry.subtitleI18n, entry.subtitle), image: firstNonEmptyI18n(entry.imageI18n, entry.image), imageI18n: entry.imageI18n, prestationRef: normalizedPrestacionCategory || "" })),
        prestationFaqs: pPrestacionFaqs.map((entry) => ({ ...entry, question: firstNonEmptyI18n(entry.questionI18n, entry.question), answer: firstNonEmptyI18n(entry.answerI18n, entry.answer), prestationRef: normalizedPrestacionCategory || "" })),
        prestationColorBlocks: pPrestacionColorBlocks.map((entry) => ({ ...entry, prestationRef: normalizedPrestacionCategory || "" })),
        prestationRelatedPublicationIds: pPrestacionRelatedIds,
        providerOrigin: pProviderOrigin || null,
        providerLogo: optimizedProviderLogo || null,
        providerLogoAsset: optimizedProviderLogoAsset || null,
        imageAssets: optimizedImageAssets,
        pricePeriod: pPricePeriod || null,
        priceByCurrency: pExtraPrices
          .map((entry) => ({
            currency: String(entry.currency ?? "").trim().toUpperCase(),
            amount: String(entry.amount ?? "").trim(),
          }))
          .filter((entry) => entry.currency && entry.amount),
        destinationCountries,
        receivingCountries: pReceivingCountriesMode === "all" ? [] : pReceivingCountries,
        receivingCountriesAll: pReceivingCountriesMode === "all",
        receivingCountriesMode: pReceivingCountriesMode,
        travelDestinations: pEditorMode === "prestacion"
          ? destinationCountries.map((country) => ({ country, city: "", mapUrl: "" }))
          : travelDestinations,
        headquarterLocations,
        tourismType: pTourismType,
        extraDescriptions: pExtraDescriptions
          .map((d) => {
            const title = firstNonEmpty(d.titleI18n.es, d.titleI18n[pLang], d.title);
            const body = firstNonEmpty(d.bodyI18n.es, d.bodyI18n[pLang], d.body);
            return {
              title,
              body,
              titleI18n: { ...d.titleI18n, es: firstNonEmpty(d.titleI18n.es, title) },
              bodyI18n: { ...d.bodyI18n, es: firstNonEmpty(d.bodyI18n.es, body) },
              visibleInCard: Boolean(d.visibleInCard),
            };
          })
          .filter((d) => d.title || d.body),
      },
      socialLinks: Object.keys(socialLinks).length ? socialLinks : null,
      expiration: buildExpirationIso(),

      // dynamic groups via many-to-many
      filterOptionIds: Array.from(selectedGroupOptionIds),
    };
    if (socialLinksDetailed.length) {
      (payload.fields as Record<string, any>).socialLinksDetailed = socialLinksDetailed;
    }

    try {
      if (editingId) {
        await api(`/api/admin/publications?id=${encodeURIComponent(editingId)}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/admin/publications", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setSaveMessage(editingId ? "Cambios guardados." : "Publicación creada.");
      window.setTimeout(() => setSaveMessage(""), 4000);

      setPTitle("");
      setPTitleI18n({ es: "" });
      setPDescription("");
      setPDescriptionI18n({ es: "" });
      setPPublisherName("");
      setPProviderEmail("");
      setPFeatured(false);
      setPPartner(false);
      setEditingId(null);
      setPCategory("");
      setPCategoryI18n(null);
      setPSubcategory("");
      setPSubcategoryI18n(null);
      setPCategorySelections([]);
      setPSubcategorySelections([]);
      setPPrimaryGroupKey("category");
      setPCategoryOptionId("");
      setPSubcategoryOptionId("");
      setPContentLanguage("es");
      setPCountry("");
      setPHeadquarterCountry("");
      setPHeadquarterCity("");
      setPHeadquarterMapUrl("");
      setPHeadquarterExtras([]);
      setPCity("");
      setPPrice("");
      setPPricePeriod("month");
      setPExtraPrices([]);
      setPLanguages("");
      setPImageUrls("");
      setPImageUploads([]);
      setPWebsite("");
      setPLocationAddress("");
      setPExtraDescriptions([]);
      setPProviderInfoLang("es");
      setPProviderInfoI18n({ es: "" });
      setPProviderRating("4");
      setPProviderReviewCount("0");
      setPProviderCommentsUrl("");
      setPProviderStartYear("");
      setPProviderActivity("");
      setPProviderType("");
      setPProviderActivities([]);
      setPProviderTypes([]);
      setPProviderModalities([]);
      setPPrestaciones([]);
      setPPrestacionCategory("");
      setPPrestacionDestinationCountries([]);
      setPPrestacionHeroImage("");
      setPPrestacionHeroImageI18n({ es: "" });
      setPPrestacionHeroTitleI18n({ es: "" });
      setPPrestacionHeroSubtitleI18n({ es: "" });
      setPPrestacionHeroInfoBlocks([createEmptyPrestacionHeroInfoBlock()]);
      setPPrestacionRelatedIds([]);
      setPEditorMode("publicacion");
      setPPrestacionResources([createEmptyPrestacionResource()]);
      setPPrestacionSteps([createEmptyPrestacionStep()]);
      setPPrestacionFaqs([createEmptyPrestacionFaq()]);
      setPPrestacionColorBlocks([createEmptyPrestacionColorBlock()]);
      setPProviderOrigin("");
      setPProviderLogo("");
      setPFieldsBase({});
      setPSocialLinksDetailed([]);
      setPExpirationDate("");
      setPExpirationTime("");
      setPFilterOptionIds([]);
      setPTourismType("receptivo");
      await refresh();
      setPublicationTab("publicaciones");
      setPublicationSearch("");
      if (isNewPublicationPage) {
        router.push("/admin?section=publicaciones");
      } else {
        setShowPublicationEditor(false);
        window.setTimeout(() => publicationsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
      }
    } catch (error: any) {
      const message = String(error?.message ?? "").trim();
      setSaveMessage(message ? `No se pudo guardar: ${message}` : "No se pudo guardar la publicación.");
    } finally {
      setSavingPublication(false);
      publicationLockRef.current = false;
    }
  }

  async function deletePublication(id: string) {
    const publication = publications.find((item) => item.id === id);
    const label = publication?.primaryGroupKey === "prestacion" ? "prestación" : "publicación";
    if (!window.confirm(`¿Seguro que querés eliminar esta ${label}? Esta acción no se puede deshacer.`)) return;
    await api(`/api/admin/publications?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await refresh();
  }

  function editPublication(pub: Publication) {
    setShowPublicationEditor(true);
    window.setTimeout(() => publicationsTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    setPTourismType("receptivo");
    setEditingId(pub.id);
    setPTitle(pub.title ?? "");
    setPTitleI18n(pub.titleI18n ?? { es: pub.title ?? "" });
    setPDescription(pub.description ?? "");
    setPDescriptionI18n(pub.descriptionI18n ?? { es: pub.description ?? "" });
    setPPublisherName(pub.publisherName ?? "");
    setPProviderEmail(String((pub.fields as any)?.providerEmail ?? ""));
    setPStatus(pub.status ?? "active");
    setPFeatured(Boolean(pub.featured));
    setPPartner(Boolean((pub.fields as any)?.partner));
    setPCategory(pub.category ?? "");
    setPCategoryI18n(pub.categoryI18n ?? null);
    setPSubcategory(pub.subcategory ?? "");
    setPSubcategoryI18n(pub.subcategoryI18n ?? null);
    const fieldCategorySelections = Array.isArray((pub.fields as any)?.categorySelections)
      ? (pub.fields as any).categorySelections.map((entry: any) => String(entry ?? "").trim()).filter(Boolean)
      : [];
    const fieldSubcategorySelections = Array.isArray((pub.fields as any)?.subcategorySelections)
      ? (pub.fields as any).subcategorySelections.map((entry: any) => String(entry ?? "").trim()).filter(Boolean)
      : [];
    setPCategorySelections(fieldCategorySelections.length ? fieldCategorySelections : (pub.category ? [pub.category] : []));
    setPSubcategorySelections(fieldSubcategorySelections.length ? fieldSubcategorySelections : (pub.subcategory ? [pub.subcategory] : []));
    setPPrimaryGroupKey("category");
    setPCategoryOptionId("");
    setPSubcategoryOptionId("");
    setPContentLanguage(pub.contentLanguage ?? "es");
    setPCountry(pub.country ?? "");
    const headquarterRaw = Array.isArray((pub.fields as any)?.headquarterLocations)
      ? (pub.fields as any).headquarterLocations
          .map((loc: any) => ({
            country: String(loc?.country ?? "").trim(),
            city: String(loc?.city ?? "").trim(),
            mapUrl: String(loc?.mapUrl ?? "").trim(),
          }))
          .filter((loc: any) => loc.country || loc.city || loc.mapUrl)
      : [];
    const primaryHeadquarter = headquarterRaw[0] ?? {
      country: String(pub.headquarterCountry ?? "").trim(),
      city: "",
      mapUrl: "",
    };
    setPHeadquarterCountry(primaryHeadquarter.country);
    setPHeadquarterCity(primaryHeadquarter.city);
    setPHeadquarterMapUrl(primaryHeadquarter.mapUrl);
    setPHeadquarterExtras(headquarterRaw.slice(1));
    setPCity(pub.city ?? "");
    setPCurrency(pub.currency ?? "ARS");
    setPPrice(pub.price ?? "");
    setPPricePeriod((pub.fields as any)?.pricePeriod ?? "month");
    const normalizedPriceByCurrency = Array.isArray((pub.fields as any)?.priceByCurrency)
      ? (pub.fields as any).priceByCurrency
          .map((entry: any) => ({ currency: String(entry?.currency ?? "").trim(), amount: String(entry?.amount ?? "").trim() }))
          .filter((entry: ExtraPrice, index: number, self: ExtraPrice[]) => entry.currency && entry.amount && self.findIndex((item) => item.currency === entry.currency) === index)
      : [];
    setPExtraPrices(normalizedPriceByCurrency.filter((entry: ExtraPrice) => entry.currency !== String(pub.currency ?? "").trim()));
    setPLanguages(
      Array.isArray(pub.languages) ? pub.languages.join(", ") : (pub.languages ?? "")
    );
    const existingImages = Array.isArray(pub.images) ? pub.images : [];
    const imageAssets = Array.isArray((pub.fields as any)?.imageAssets) ? ((pub.fields as any).imageAssets as ImageAsset[]) : [];
    const imageUrls = existingImages.filter((img) => !String(img).startsWith("data:image"));
    const imageUploads = existingImages.filter((img) => String(img).startsWith("data:image"));
    setPImageUrls(imageUrls.join("\n"));
    setPImageUploads(imageUploads);
    setPImageUploadAssets(imageAssets.filter((asset) => imageUploads.includes(imageAssetToUrl(asset))));
    setPWebsite(pub.website ?? "");
    setPFieldsBase((pub.fields as Record<string, any>) ?? {});
    setPLocationAddress((pub.fields as any)?.locationAddress ?? "");
    const destinationRaw = Array.isArray((pub.fields as any)?.travelDestinations)
      ? (pub.fields as any).travelDestinations
          .map((loc: any) => ({
            country: String(loc?.country ?? "").trim(),
            city: String(loc?.city ?? "").trim(),
            mapUrl: String(loc?.mapUrl ?? "").trim(),
          }))
          .filter((loc: any) => loc.country || loc.city || loc.mapUrl)
      : [];
    const fallbackLocations = Array.isArray((pub.fields as any)?.offerLocations)
      ? (pub.fields as any).offerLocations.map((loc: any) => ({
          country: String(loc?.country ?? "").trim(),
          city: String(loc?.region ?? "").trim(),
          mapUrl: String(loc?.address ?? "").trim(),
        }))
      : [];
    const fallbackDestinations = Array.isArray((pub.fields as any)?.destinationCountries)
      ? (pub.fields as any).destinationCountries.map((country: string) => ({
          country: String(country ?? "").trim(),
          city: "",
          mapUrl: "",
        }))
      : [];
    const useCountryFallback = !destinationRaw.length && !fallbackLocations.length;
    const combinedDestinations = uniqueLocations([
      ...destinationRaw,
      ...fallbackLocations,
      ...(useCountryFallback ? fallbackDestinations : []),
    ]);
    const primaryDestinationKey = locationKey(
      normalizeLocation({
        country: pub.country ?? "",
        city: pub.city ?? "",
        mapUrl: (pub.fields as any)?.locationAddress ?? "",
      })
    );
    const rawReceivingMode = String((pub.fields as any)?.receivingCountriesMode ?? "").toLowerCase();
    const resolvedReceivingMode =
      rawReceivingMode === "all" || rawReceivingMode === "only" || rawReceivingMode === "except"
        ? rawReceivingMode
        : (pub.fields as any)?.receivingCountriesAll === false
          ? "only"
          : "all";
    setPReceivingCountries(
      Array.isArray((pub.fields as any)?.receivingCountries)
        ? (pub.fields as any).receivingCountries
        : []
    );
    setPReceivingCountriesMode(resolvedReceivingMode as "all" | "only" | "except");
    setPProviderInfoI18n((pub.fields as any)?.providerInfoI18n ?? { es: "" });
    setPProviderInfoLang("es");
    setPProviderRating(String((pub.fields as any)?.providerRating ?? "4"));
    setPProviderReviewCount(String((pub.fields as any)?.providerReviewCount ?? "0"));
    setPProviderCommentsUrl((pub.fields as any)?.providerCommentsUrl ?? "");
    setPProviderStartYear((pub.fields as any)?.providerStartYear ?? "");
    setPProviderActivity((pub.fields as any)?.providerActivity ?? "");
    setPProviderType((pub.fields as any)?.providerType ?? "");
    const legacyProviderActivity = String((pub.fields as any)?.providerActivity ?? "").trim();
    const legacyProviderType = String((pub.fields as any)?.providerType ?? "").trim();
    const providerActivities = Array.isArray((pub.fields as any)?.providerActivities)
      ? (pub.fields as any).providerActivities.map((entry: any) => String(entry)).filter(Boolean)
      : [];
    const providerTypes = Array.isArray((pub.fields as any)?.providerTypes)
      ? (pub.fields as any).providerTypes.map((entry: any) => String(entry)).filter(Boolean)
      : [];
    setPProviderActivities(providerActivities.length ? providerActivities : (legacyProviderActivity ? [legacyProviderActivity] : []));
    setPProviderTypes(providerTypes.length ? providerTypes : (legacyProviderType ? [legacyProviderType] : []));
    setPProviderModalities(
      Array.isArray((pub.fields as any)?.providerModalities)
        ? (pub.fields as any).providerModalities.map((entry: any) => String(entry))
        : []
    );
    setPProviderOrigin((pub.fields as any)?.providerOrigin ?? "");
    setPProviderLogo((pub.fields as any)?.providerLogo ?? "");
    setPPrestaciones(
      Array.isArray((pub.fields as any)?.prestaciones)
        ? (pub.fields as any).prestaciones.map((entry: any) => String(entry))
        : []
    );
    setPPrestacionCategory(
      Array.isArray((pub.fields as any)?.prestaciones) && (pub.fields as any).prestaciones.length
        ? String((pub.fields as any).prestaciones[0] ?? "")
        : ""
    );
    setPPrestacionDestinationCountries(
      Array.isArray((pub.fields as any)?.destinationCountries)
        ? (pub.fields as any).destinationCountries.map((entry: any) => String(entry ?? "")).filter(Boolean)
        : Array.isArray((pub.fields as any)?.travelDestinations)
          ? (pub.fields as any).travelDestinations.map((entry: any) => String(entry?.country ?? "")).filter(Boolean)
          : pub.country
            ? [String(pub.country)]
            : []
    );
    setPEditorMode(pub.primaryGroupKey === "prestacion" ? "prestacion" : "publicacion");
    setPPrestacionHeroImage(String((pub.fields as any)?.prestationHeroImage ?? ""));
    setPPrestacionHeroImageI18n((pub.fields as any)?.prestationHeroImageI18n ?? { es: String((pub.fields as any)?.prestationHeroImage ?? "") });
    setPPrestacionHeroTitleI18n((pub.fields as any)?.prestationHeroTitleI18n ?? { es: String((pub.fields as any)?.prestationHeroTitle ?? "") });
    setPPrestacionHeroSubtitleI18n((pub.fields as any)?.prestationHeroSubtitleI18n ?? { es: String((pub.fields as any)?.prestationHeroSubtitle ?? "") });
    setPPrestacionHeroInfoBlocks(
      Array.isArray((pub.fields as any)?.prestationHeroInfoBlocks)
        ? (pub.fields as any).prestationHeroInfoBlocks.map((entry: any) => ({
            title: String(entry?.title ?? ""),
            titleI18n: (entry?.titleI18n ?? { es: String(entry?.title ?? "") }) as I18nRecord,
            text: String(entry?.text ?? ""),
            textI18n: (entry?.textI18n ?? { es: String(entry?.text ?? "") }) as I18nRecord,
            bgColor: String(entry?.bgColor ?? "#DBEAFE"),
            textColor: String(entry?.textColor ?? "#1E3A8A"),
          }))
        : [createEmptyPrestacionHeroInfoBlock()]
    );
    setPPrestacionRelatedIds(
      Array.isArray((pub.fields as any)?.prestationRelatedPublicationIds)
        ? (pub.fields as any).prestationRelatedPublicationIds.map((entry: any) => String(entry)).filter(Boolean)
        : []
    );
    setPPrestacionResources(
      Array.isArray((pub.fields as any)?.prestationResources)
        ? (pub.fields as any).prestationResources.map((entry: any) => ({
            title: String(entry?.title ?? ""),
            titleI18n: (entry?.titleI18n ?? { es: String(entry?.title ?? "") }) as I18nRecord,
            subtitle: String(entry?.subtitle ?? ""),
            subtitleI18n: (entry?.subtitleI18n ?? { es: String(entry?.subtitle ?? "") }) as I18nRecord,
            image: String(entry?.image ?? ""),
            imageI18n: (entry?.imageI18n ?? { es: String(entry?.image ?? "") }) as I18nRecord,
            prestationRef: String(entry?.prestationRef ?? ""),
            checkItems: Array.isArray(entry?.checkItems)
              ? entry.checkItems.map((item: any) => String(item)).filter(Boolean)
              : [],
            checkItemsI18n: Array.isArray(entry?.checkItemsI18n)
              ? entry.checkItemsI18n.map((item: any, idx: number) => ((item ?? { es: String(entry?.checkItems?.[idx] ?? "") }) as I18nRecord))
              : Array.isArray(entry?.checkItems)
                ? entry.checkItems.map((item: any) => ({ es: String(item ?? "") }))
                : [],
            buttons: Array.isArray(entry?.buttons)
              ? entry.buttons
                  .map((btn: any) => ({
                    label: String(btn?.label ?? ""),
                    labelI18n: (btn?.labelI18n ?? { es: String(btn?.label ?? "") }) as I18nRecord,
                    url: String(btn?.url ?? ""),
                    style: btn?.style === "secondary" ? "secondary" : "primary",
                    bgColor: String(btn?.bgColor ?? (btn?.style === "secondary" ? "#FFFFFF" : "#2563EB")),
                    textColor: String(btn?.textColor ?? (btn?.style === "secondary" ? "#1D4ED8" : "#FFFFFF")),
                  }))
                  .filter((btn: any) => btn.label || btn.url)
              : [],
            colorNoteTitle: String(entry?.colorNoteTitle ?? ""),
            colorNoteTitleI18n: (entry?.colorNoteTitleI18n ?? { es: String(entry?.colorNoteTitle ?? "") }) as I18nRecord,
            colorNoteText: String(entry?.colorNoteText ?? ""),
            colorNoteTextI18n: (entry?.colorNoteTextI18n ?? { es: String(entry?.colorNoteText ?? "") }) as I18nRecord,
            colorNoteBgColor: String(entry?.colorNoteBgColor ?? "#EEF2FF"),
            colorNoteTextColor: String(entry?.colorNoteTextColor ?? "#1E3A8A"),
          }))
        : [createEmptyPrestacionResource()]
    );
    setPPrestacionSteps(
      Array.isArray((pub.fields as any)?.prestationSteps)
        ? (pub.fields as any).prestationSteps.map((entry: any) => ({
            title: String(entry?.title ?? ""),
            titleI18n: (entry?.titleI18n ?? { es: String(entry?.title ?? "") }) as I18nRecord,
            subtitle: String(entry?.subtitle ?? ""),
            subtitleI18n: (entry?.subtitleI18n ?? { es: String(entry?.subtitle ?? "") }) as I18nRecord,
            image: String(entry?.image ?? ""),
            imageI18n: (entry?.imageI18n ?? { es: String(entry?.image ?? "") }) as I18nRecord,
            prestationRef: String(entry?.prestationRef ?? ""),
          }))
        : [createEmptyPrestacionStep()]
    );
    setPPrestacionFaqs(
      Array.isArray((pub.fields as any)?.prestationFaqs)
        ? (pub.fields as any).prestationFaqs.map((entry: any) => ({ question: String(entry?.question ?? ""), questionI18n: (entry?.questionI18n ?? { es: String(entry?.question ?? "") }) as I18nRecord, answer: String(entry?.answer ?? ""), answerI18n: (entry?.answerI18n ?? { es: String(entry?.answer ?? "") }) as I18nRecord, prestationRef: String(entry?.prestationRef ?? "") }))
        : [createEmptyPrestacionFaq()]
    );
    setPPrestacionColorBlocks(
      Array.isArray((pub.fields as any)?.prestationColorBlocks)
        ? (pub.fields as any).prestationColorBlocks.map((entry: any) => ({
            title: String(entry?.title ?? ""),
            text: String(entry?.text ?? ""),
            bgColor: String(entry?.bgColor ?? "#EEF2FF"),
            textColor: String(entry?.textColor ?? "#312E81"),
            prestationRef: String(entry?.prestationRef ?? ""),
          }))
        : [createEmptyPrestacionColorBlock()]
    );
    setPExtraDescriptions(
      Array.isArray((pub.fields as any)?.extraDescriptions)
        ? (pub.fields as any).extraDescriptions.map((d: any) => {
            const title = String(d?.title ?? "");
            const body = String(d?.body ?? "");
            const titleI18n = (d?.titleI18n ?? null) as I18nRecord | null;
            const bodyI18n = (d?.bodyI18n ?? null) as I18nRecord | null;
            const fallbackTitle = titleI18n?.es ?? title;
            const fallbackBody = bodyI18n?.es ?? body;
            return {
              title: fallbackTitle,
              body: fallbackBody,
              titleI18n: titleI18n ?? { es: fallbackTitle },
              bodyI18n: bodyI18n ?? { es: fallbackBody },
              lang: "es" as Lang,
              visibleInCard: Boolean(d?.visibleInCard),
            };
          })
        : []
    );
    setPTourismType((pub.fields as any)?.tourismType === "emisivo" ? "emisivo" : "receptivo");
    const detailedLinks = Array.isArray((pub.fields as any)?.socialLinksDetailed)
      ? (pub.fields as any).socialLinksDetailed
          .map((entry: any) => ({
            kind: String(entry?.kind ?? ""),
            label: String(entry?.label ?? ""),
            url: String(entry?.url ?? ""),
          }))
          .filter((entry: any) => entry.kind && entry.url)
      : [];
    if (detailedLinks.length) {
      setPSocialLinksDetailed(detailedLinks);
    } else {
      const legacyLinks = pub.socialLinks ?? {};
      const mapped = Object.entries(legacyLinks)
        .map(([kind, url]) => ({
          kind,
          label: "",
          url: String(url ?? ""),
        }))
        .filter((entry) => entry.url);
      setPSocialLinksDetailed(mapped);
    }
    if (pub.expiration) {
      const expirationDate = new Date(pub.expiration);
      if (!Number.isNaN(expirationDate.getTime())) {
        const year = expirationDate.getFullYear();
        const month = String(expirationDate.getMonth() + 1).padStart(2, "0");
        const day = String(expirationDate.getDate()).padStart(2, "0");
        const hours = String(expirationDate.getHours()).padStart(2, "0");
        const minutes = String(expirationDate.getMinutes()).padStart(2, "0");
        setPExpirationDate(`${year}-${month}-${day}`);
        setPExpirationTime(`${hours}:${minutes}`);
      } else {
        setPExpirationDate("");
        setPExpirationTime("");
      }
    } else {
      setPExpirationDate("");
      setPExpirationTime("");
    }
    setPFilterOptionIds((pub.filterOptions ?? []).map((f) => f.filterOptionId));
  }

  function copyPublication(pub: Publication) {
    editPublication(pub);
    setEditingId(null);
    setPStatus("draft");
    setPFeatured(false);
    setPPartner(false);
    setPTitleI18n((prev) => ({ ...prev, es: `${String(prev.es ?? pub.title ?? "").trim()} (copia)` }));
    setPTitle((prev) => `${String(prev || pub.title || "").trim()} (copia)`);
    setSaveMessage("Copia cargada. Editá los campos necesarios y guardá como nueva publicación.");
    window.setTimeout(() => setSaveMessage(""), 4500);
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveMessage("");
    setPTitle("");
    setPTitleI18n({ es: "" });
    setPDescription("");
    setPDescriptionI18n({ es: "" });
    setPPublisherName("");
    setPProviderEmail("");
    setPStatus("active");
    setPFeatured(false);
    setPPartner(false);
    setPCategory("");
    setPCategoryI18n(null);
    setPSubcategory("");
    setPSubcategoryI18n(null);
    setPCategorySelections([]);
    setPSubcategorySelections([]);
    setPPrimaryGroupKey("category");
    setPCategoryOptionId("");
    setPSubcategoryOptionId("");
    setPContentLanguage("es");
    setPCountry("");
    setPHeadquarterCountry("");
    setPHeadquarterCity("");
    setPHeadquarterMapUrl("");
    setPHeadquarterExtras([]);
    setPCity("");
    setPCurrency("ARS");
    setPPrice("");
    setPPricePeriod("month");
    setPLanguages("");
    setPImageUrls("");
    setPImageUploads([]);
    setPWebsite("");
    setPLocationAddress("");
    setPReceivingCountries([]);
    setPReceivingCountriesMode("all");
    setPTourismType("receptivo");
    setPExtraDescriptions([]);
    setPProviderInfoLang("es");
    setPProviderInfoI18n({ es: "" });
    setPProviderRating("4");
    setPProviderReviewCount("0");
    setPProviderCommentsUrl("");
    setPProviderStartYear("");
    setPProviderActivity("");
    setPProviderType("");
    setPProviderActivities([]);
    setPProviderTypes([]);
    setPProviderModalities([]);
    setPPrestaciones([]);
    setPPrestacionDestinationCountries([]);
    setPProviderOrigin("");
    setPProviderLogo("");
    setPFieldsBase({});
    setPSocialLinksDetailed([]);
    setPExpirationDate("");
    setPExpirationTime("");
    setPFilterOptionIds([]);
  }

  const adminFilterGroups = useMemo(() => filterGroups, [filterGroups]);
  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const resolveCategoryBlockId = (category: Category, seen = new Set<string>()): string | null => {
    if (seen.has(category.id)) return null;
    seen.add(category.id);
    if (category.blockId) return filterGroupById.has(category.blockId) ? category.blockId : null;
    if (category.parentId) {
      const parent = categoryById.get(category.parentId);
      if (!parent) return null;
      return resolveCategoryBlockId(parent, seen);
    }
    return null;
  };

  const resolveCategoryTaxonomyType = (category: Category, seen = new Set<string>()): string | null => {
    if (seen.has(category.id)) return null;
    seen.add(category.id);
    const ownTaxonomyType = normalizeTaxonomyTypeAlias(category.taxonomyType || "predeterminado");
    if (ownTaxonomyType && !["", "default", "inherit", "predeterminado"].includes(ownTaxonomyType)) return ownTaxonomyType;
    if (category.parentId) {
      const parent = categoryById.get(category.parentId);
      if (!parent) return null;
      return resolveCategoryTaxonomyType(parent, seen);
    }
    const effectiveBlockId = resolveCategoryBlockId(category);
    if (!effectiveBlockId) return null;
    const blockTaxonomyType = normalizeTaxonomyTypeAlias(filterGroupById.get(effectiveBlockId)?.taxonomyType || "predeterminado");
    if (blockTaxonomyType && !["", "default", "predeterminado"].includes(blockTaxonomyType)) return blockTaxonomyType;
    return "categoria";
  };
  const resolveInheritedCategoryTaxonomyType = (category: Category): string | null => {
    if (category.parentId) {
      const parent = categoryById.get(category.parentId);
      if (!parent) return null;
      return resolveCategoryTaxonomyType(parent);
    }
    const effectiveBlockId = resolveCategoryBlockId(category);
    if (!effectiveBlockId) return null;
    const blockTaxonomyType = normalizeTaxonomyTypeAlias(filterGroupById.get(effectiveBlockId)?.taxonomyType || "predeterminado");
    return blockTaxonomyType || "categoria";
  };
  const getCategoryCustomTaxonomyNotice = (category: Category): string | null => {
    const resolved = resolveCategoryTaxonomyType(category);
    const inherited = resolveInheritedCategoryTaxonomyType(category);
    if (!resolved || !inherited) return null;
    if (resolved === inherited) return null;
    return `Tipo de filtro propio: ${resolved} (no hereda el tipo de filtro del bloque)`;
  };

  const isCategoryRenderable = (category: Category): boolean => {
    if (category.parentId && !categoryById.has(category.parentId)) return false;
    const resolvedTaxonomyType = resolveCategoryTaxonomyType(category);
    if (!resolvedTaxonomyType) return false;
    const effectiveBlockId = resolveCategoryBlockId(category);
    if (!effectiveBlockId) return false;
    return true;
  };

  const validRoots = useMemo(
    () => roots.filter((root) => isCategoryRenderable(root)),
    [roots, categories, filterGroups]
  );

  const modalidadRoots = useMemo(
    () => validRoots.filter((root) => resolveCategoryTaxonomyType(root) === "modalidad"),
    [validRoots, categories, filterGroups]
  );
  const idiomaRoots = useMemo(
    () => validRoots.filter((root) => resolveCategoryTaxonomyType(root) === "idiomas"),
    [validRoots, categories, filterGroups]
  );
  const actividadRoots = useMemo(
    () => validRoots.filter((root) => resolveCategoryTaxonomyType(root) === "actividad"),
    [validRoots, categories, filterGroups]
  );
  const tipoRoots = useMemo(
    () => validRoots.filter((root) => ["tipo", "tipos"].includes(resolveCategoryTaxonomyType(root) || "")),
    [validRoots, categories, filterGroups]
  );
  const prestacionRoots = useMemo(
    () => validRoots.filter((root) => ["prestacion", "prestaciones"].includes(resolveCategoryTaxonomyType(root) || "")),
    [validRoots, categories, filterGroups]
  );

  const publicationCategoryRoots = useMemo(
    () =>
      validRoots.filter((root) => {
        const resolvedTaxonomyType = resolveCategoryTaxonomyType(root);
        return resolvedTaxonomyType === "categoria";
      }),
    [validRoots, categories, filterGroups]
  );

  const groupCategoriesForPublicationPicker = (items: Category[]) => {
    const groups = new Map<string, { label: string; items: Category[] }>();
    items.forEach((category) => {
      const blockId = resolveCategoryBlockId(category) ?? "__sin_bloque__";
      const block = blockId && blockId !== "__sin_bloque__" ? filterGroupById.get(blockId) : null;
      const label = block ? pickI18nText(block.labelI18n ?? null, pLang, block.label) : "Sin bloque";
      if (!groups.has(blockId)) groups.set(blockId, { label, items: [] });
      groups.get(blockId)!.items.push(category);
    });

    return Array.from(groups.entries())
      .map(([key, value]) => ({
        key,
        label: value.label,
        items: value.items.sort((a, b) =>
          pickI18nText(a.descriptionI18n ?? null, pLang, a.description).localeCompare(
            pickI18nText(b.descriptionI18n ?? null, pLang, b.description),
            "es"
          )
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  };

  const publicationCategoryGroups = useMemo(
    () => groupCategoriesForPublicationPicker(publicationCategoryRoots),
    [publicationCategoryRoots, filterGroupById, pLang, categories, filterGroups]
  );

  const linkedPublicationCategoryRoots = useMemo(
    () =>
      validRoots.filter((root) => {
        const resolvedTaxonomyType = resolveCategoryTaxonomyType(root);
        return !["prestacion", "prestaciones"].includes(resolvedTaxonomyType || "");
      }),
    [validRoots, categories, filterGroups]
  );

  const linkedPublicationCategoryGroups = useMemo(
    () => groupCategoriesForPublicationPicker(linkedPublicationCategoryRoots),
    [linkedPublicationCategoryRoots, filterGroupById, pLang, categories, filterGroups]
  );

  const publicationSelectedRoots = useMemo(
    () => publicationCategoryRoots.filter((root) => pCategorySelections.includes(root.description)),
    [publicationCategoryRoots, pCategorySelections]
  );

  const publicationSubcategoryOptions = useMemo(() => {
    const byDescription = new Map<string, Category>();
    publicationSelectedRoots.forEach((root) => {
      (childrenBy.get(root.id) ?? []).forEach((child) => {
        if (!isCategoryRenderable(child) || resolveCategoryTaxonomyType(child) !== "categoria") return;
        byDescription.set(child.description, child);
      });
    });
    return Array.from(byDescription.values());
  }, [publicationSelectedRoots, childrenBy, categories, filterGroups]);

  const publicationSubcategoryPanelMeta = useMemo(() => {
    if (!publicationSelectedRoots.length) return null;
    return {
      selectedCount: publicationSelectedRoots.length,
      categoryLabels: publicationSelectedRoots.map((root) =>
        pickI18nText(root.descriptionI18n ?? null, pLang, root.description)
      ),
    };
  }, [publicationSelectedRoots, pLang]);

  useEffect(() => {
    const activeRoots = pEditorMode === "prestacion" ? linkedPublicationCategoryRoots : publicationCategoryRoots;
    const validCategorySet = new Set(activeRoots.map((root) => root.description));
    const validCategories = pCategorySelections.filter((value) => validCategorySet.has(value));
    if (validCategories.length !== pCategorySelections.length) {
      setPCategorySelections(validCategories);
      return;
    }

    const activeRootIds = new Set(activeRoots.filter((root) => validCategories.includes(root.description)).map((root) => root.id));
    const allowedSubcategories = new Set(
      categories
        .filter((category) => {
          if (!category.parentId || !activeRootIds.has(category.parentId)) return false;
          if (!isCategoryRenderable(category)) return false;
          const taxonomyType = resolveCategoryTaxonomyType(category);
          return pEditorMode === "prestacion"
            ? !["prestacion", "prestaciones"].includes(taxonomyType || "")
            : taxonomyType === "categoria";
        })
        .map((child) => child.description)
    );
    const validSubcategories = pSubcategorySelections.filter((value) => allowedSubcategories.has(value));
    if (validSubcategories.length !== pSubcategorySelections.length) {
      setPSubcategorySelections(validSubcategories);
      return;
    }

    if (pEditorMode === "prestacion") return;

    const firstCategory = validCategories[0] ?? "";
    if (pCategory !== firstCategory) {
      setPCategory(firstCategory);
      const root = publicationCategoryRoots.find((item) => item.description === firstCategory);
      setPCategoryI18n(root ? ((root.descriptionI18n as I18nRecord) ?? { es: root.description }) : null);
    }

    const firstSubcategory = validSubcategories[0] ?? "";
    if (pSubcategory !== firstSubcategory) {
      setPSubcategory(firstSubcategory);
      const child = publicationSubcategoryOptions.find((item) => item.description === firstSubcategory);
      setPSubcategoryI18n(child ? ((child.descriptionI18n as I18nRecord) ?? { es: child.description }) : null);
    }
  }, [
    pCategorySelections,
    pSubcategorySelections,
    publicationCategoryRoots,
    publicationSubcategoryOptions,
    linkedPublicationCategoryRoots,
    categories,
    filterGroups,
    pCategory,
    pSubcategory,
    pEditorMode,
  ]);

  const splitLines = (v: string) =>
    v
      .split(/[\r\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  const normalizeLocation = <T extends { country: string; city: string; mapUrl: string }>(loc: T) => ({
    country: loc.country.trim(),
    city: loc.city.trim(),
    mapUrl: loc.mapUrl.trim(),
  });
  const isLocationFilled = (loc: { country: string; city: string; mapUrl: string }) =>
    Boolean(loc.country || loc.city || loc.mapUrl);
  const uniqueLocations = <T extends { country: string; city: string; mapUrl: string }>(locations: T[]) => {
    const seen = new Set<string>();
    const result: T[] = [];
    locations.forEach((loc) => {
      const normalized = normalizeLocation(loc) as T;
      if (!isLocationFilled(normalized)) return;
      const key = `${normalized.country.toLowerCase()}|${normalized.city.toLowerCase()}|${normalized.mapUrl.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(normalized);
    });
    return result;
  };
  const imageList = useMemo(() => {
    const urls = splitLines(pImageUrls);
    const uploads = pImageUploads.map((item) => String(item).trim()).filter(Boolean);
    const all = [...urls, ...uploads].filter((item) => item.startsWith("http://") || item.startsWith("https://") || item.startsWith("data:image/"));
    return Array.from(new Set(all));
  }, [pImageUrls, pImageUploads]);
  const removeImage = (img: string) => {
    setPImageUploads((prev) => prev.filter((item) => item !== img));
    setPImageUrls((prev) => splitLines(prev).filter((item) => item !== img).join("\n"));
  };
  const [draggingFilterGroupId, setDraggingFilterGroupId] = useState<string | null>(null);
  const orderedFilterGroups = useMemo(
    () => [...adminFilterGroups].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [adminFilterGroups]
  );
  const persistFilterGroupOrder = async (nextGroups: FilterGroup[]) => {
    setFilterGroups(nextGroups);
    await Promise.all(
      nextGroups.map((group, index) =>
        api(`/api/admin/filter-groups/${group.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ order: index }),
        })
      )
    );
  };
  const moveFilterGroup = async (groupId: string, direction: -1 | 1) => {
    const movable = [...orderedFilterGroups];
    const currentIndex = movable.findIndex((group) => group.id === groupId);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= movable.length) return;
    const nextMovable = [...movable];
    [nextMovable[currentIndex], nextMovable[nextIndex]] = [nextMovable[nextIndex], nextMovable[currentIndex]];
    const normalized = nextMovable.map((group, index) => ({ ...group, order: index }));
    await persistFilterGroupOrder(normalized);
  };
  const persistCategoryOrder = async (nextCategories: Category[]) => {
    const byId = new Map(categories.map((category) => [category.id, category]));
    const updated = categories.map((category) => {
      const next = nextCategories.find((candidate) => candidate.id === category.id);
      return next ? { ...category, order: next.order } : category;
    });
    setCategories(updated);
    await Promise.all(
      nextCategories.map((category) => {
        const source = byId.get(category.id) ?? category;
        return api(`/api/admin/categories/${encodeURIComponent(category.id)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            description: source.description,
            descriptionI18n: source.descriptionI18n ?? { es: source.description },
            taxonomyType: source.taxonomyType,
            parentId: source.parentId ?? null,
            blockId: source.blockId ?? null,
            order: category.order ?? 0,
            isPublicVisible: source.isPublicVisible !== false,
            isPrimaryCategory: source.isPrimaryCategory === true,
            iconImageUrl: source.isPrimaryCategory === true ? (source.iconImageUrl ?? null) : null,
            cardImageUrl: source.isPrimaryCategory === true ? (source.cardImageUrl ?? null) : null,
          }),
        });
      })
    );
  };
  const moveCategory = async (categoryId: string, direction: -1 | 1) => {
    const target = categories.find((category) => category.id === categoryId);
    if (!target) return;
    const siblings = categories
      .filter(
        (category) =>
          (category.parentId ?? null) === (target.parentId ?? null)
          && (category.blockId ?? null) === (target.blockId ?? null)
      )
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.description || "").localeCompare(b.description || ""));
    const currentIndex = siblings.findIndex((category) => category.id === categoryId);
    if (currentIndex === -1) return;
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= siblings.length) return;
    const reordered = [...siblings];
    [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];
    const normalized = reordered.map((category, index) => ({ ...category, order: index }));
    await persistCategoryOrder(normalized);
  };
  const handleFilterGroupDrop = async (targetId: string) => {
    if (!draggingFilterGroupId || draggingFilterGroupId === targetId) return;
    const movable = [...orderedFilterGroups];
    const fromIndex = movable.findIndex((group) => group.id === draggingFilterGroupId);
    const toIndex = movable.findIndex((group) => group.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const nextMovable = [...movable];
    const [moved] = nextMovable.splice(fromIndex, 1);
    nextMovable.splice(toIndex, 0, moved);
    const normalized = nextMovable.map((group, index) => ({ ...group, order: index }));
    setDraggingFilterGroupId(null);
    await persistFilterGroupOrder(normalized);
  };
  const locationKey = (loc: { country: string; city: string; mapUrl: string }) =>
    `${loc.country.toLowerCase()}|${loc.city.toLowerCase()}|${loc.mapUrl.toLowerCase()}`;

  const renderLangTabs = (
    active: Lang,
    onChange: (lang: Lang) => void,
    labelBuilder?: (lang: Lang) => string
  ) => (
    <div className="flex flex-wrap gap-2">
      {LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase ${
            active === lang ? "border-[#00A9C6] bg-[#00A9C6]/10 text-[#007D92]" : "border-slate-200 text-slate-500"
          }`}
        >
          {labelBuilder ? labelBuilder(lang) : lang}
        </button>
      ))}
    </div>
  );

  const renderSelectedBadges = (items: string[], onRemove?: (item: string) => void) => {
    if (!items.length) return null;
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-lg border border-[#00A9C6]/40 bg-[#00A9C6]/10 px-2.5 py-1 text-xs font-medium text-[#007D92]"
          >
            {item}
            {onRemove ? (
              <button type="button" onClick={() => onRemove(item)} className="text-[#007D92]/80 hover:text-[#007D92]">
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}
      </div>
    );
  };

  const renderTaxonomyTypeDropdown = (
    typeKey: string,
    rootsList: Category[],
    selectedValues: string[],
    onToggle: (value: string, checked: boolean) => void,
    emptyText: string,
    placeholderText = "Seleccionar opciones"
  ) => {
    if (!rootsList.length) return <div className="mt-2 text-xs text-slate-500">{emptyText}</div>;

    const options = rootsList.flatMap((item) => {
      const rootLabel = pickI18nText(item.descriptionI18n ?? null, pLang, item.description);
      const blockLabel = item.blockId
        ? pickI18nText(filterGroupById.get(item.blockId)?.labelI18n ?? null, pLang, filterGroupById.get(item.blockId)?.label ?? "")
        : "";
      const children = (childrenBy.get(item.id) ?? []).map((sub) => ({
        label: `${rootLabel} > ${pickI18nText(sub.descriptionI18n ?? null, pLang, sub.description)}`,
        value: pickI18nText(sub.descriptionI18n ?? null, pLang, sub.description),
        blockLabel,
      }));
      return [{ label: rootLabel, value: rootLabel, blockLabel }, ...children];
    });

    const isOpen = !!openTaxonomyTypePanels[typeKey];

    return (
      <>
        <button
          type="button"
          onClick={() => setOpenTaxonomyTypePanels((prev) => ({ ...prev, [typeKey]: !prev[typeKey] }))}
          className="mt-3 flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 px-3 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
          <span>{selectedValues.length ? `${selectedValues.length} seleccionadas` : placeholderText}</span>
          {isOpen ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
        </button>

        {isOpen ? (
          <div className="mt-2 max-h-56 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
            {options.map((opt, index) => {
              const checked = selectedValues.includes(opt.value);
              return (
                <label key={`${typeKey}-${opt.value}-${index}`} className="flex items-start gap-2 rounded-lg px-2 py-1 text-sm text-slate-700 hover:bg-white">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onToggle(opt.value, e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#00A9C6]"
                  />
                  <span className="min-w-0 break-words">
                    {opt.blockLabel ? (
                      <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-[#00A9C6]">
                        {opt.blockLabel}:
                      </span>
                    ) : null}
                    <span>{opt.label}</span>
                  </span>
                </label>
              );
            })}
          </div>
        ) : null}

        {renderSelectedBadges(selectedValues, (item) => onToggle(item, false))}
      </>
    );
  };

  const renderCategorySelection = (panel: "category" | "subcategory") => {
    const isPrestacionEditor = pEditorMode === "prestacion";
    const pickerRoots = isPrestacionEditor ? linkedPublicationCategoryRoots : publicationCategoryRoots;
    const pickerGroups = isPrestacionEditor ? linkedPublicationCategoryGroups : publicationCategoryGroups;
    const childIsSelectable = (child: Category) => {
      const taxonomyType = resolveCategoryTaxonomyType(child);
      return isPrestacionEditor ? !["prestacion", "prestaciones"].includes(taxonomyType || "") : taxonomyType === "categoria";
    };

    if (panel === "category") {
      if (!pickerRoots.length) {
        return <div className="mt-3 text-sm text-slate-500">No hay categorías disponibles.</div>;
      }
      return (
        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {pickerGroups.map((group) => (
            <div key={group.key} className="rounded-xl border border-slate-200 bg-white p-2">
              <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#00A9C6]">{group.label}</div>
              <div className="space-y-1">
                {group.items.map((category) => {
                  const checked = pCategorySelections.includes(category.description);
                  const label = pickI18nText(category.descriptionI18n ?? null, pLang, category.description);
                  const children = (childrenBy.get(category.id) ?? []).filter((child) => isCategoryRenderable(child) && childIsSelectable(child));
                  return (
                    <div key={category.id} className="rounded-lg border border-slate-100 p-2">
                      <label className="flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              setPCategorySelections((prev) => prev.filter((value) => value !== category.description));
                              const childDescriptions = children.map((child) => child.description);
                              setPSubcategorySelections((prev) => prev.filter((value) => !childDescriptions.includes(value)));
                              return;
                            }
                            setPCategorySelections((prev) =>
                              prev.includes(category.description) ? prev : [...prev, category.description]
                            );
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-[#00A9C6]"
                        />
                        <span className="font-medium">{label}</span>
                      </label>
                      {children.length ? (
                        <div className="mt-1 space-y-1 pl-6">
                          {children.map((subcategory) => {
                            const subChecked = pSubcategorySelections.includes(subcategory.description);
                            const subLabel = pickI18nText(subcategory.descriptionI18n ?? null, pLang, subcategory.description);
                            return (
                              <label key={subcategory.id} className="flex items-center gap-2 text-xs text-slate-600 hover:bg-slate-50">
                                <input
                                  type="checkbox"
                                  checked={subChecked}
                                  onChange={() => {
                                    if (subChecked) {
                                      setPSubcategorySelections((prev) => prev.filter((value) => value !== subcategory.description));
                                      return;
                                    }
                                    setPSubcategorySelections((prev) =>
                                      prev.includes(subcategory.description) ? prev : [...prev, subcategory.description]
                                    );
                                    setPCategorySelections((prev) =>
                                      prev.includes(category.description) ? prev : [...prev, category.description]
                                    );
                                  }}
                                  className="h-3.5 w-3.5 rounded border-slate-300 text-[#00A9C6]"
                                />
                                <span>{subLabel}</span>
                              </label>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!pCategorySelections.length) {
      return <div className="mt-3 text-sm text-slate-500">Primero seleccioná una categoría.</div>;
    }

    if (!publicationSubcategoryOptions.length) {
      return <div className="mt-3 text-sm text-slate-500">No hay subcategorías para la categoría seleccionada.</div>;
    }

    return (
      <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="rounded-xl border border-slate-200 bg-white p-2">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[#00A9C6]">
            Subcategorías
          </div>
          <div className="px-2 pb-2 text-xs font-medium text-slate-500">
            {publicationSubcategoryPanelMeta
              ? `${publicationSubcategoryPanelMeta.selectedCount} categoría(s) seleccionada(s)`
              : null}
          </div>
          <div className="space-y-1">
            {publicationSubcategoryOptions.map((subcategory) => {
              const checked = pSubcategorySelections.includes(subcategory.description);
              const label = pickI18nText(subcategory.descriptionI18n ?? null, pLang, subcategory.description);
              return (
                <label key={subcategory.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-700 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      if (checked) {
                        setPSubcategorySelections((prev) => prev.filter((value) => value !== subcategory.description));
                        return;
                      }
                      setPSubcategorySelections((prev) =>
                        prev.includes(subcategory.description) ? prev : [...prev, subcategory.description]
                      );
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-[#00A9C6]"
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const activePublications = publications.filter((item) => item.status === "active");
  const featuredPublications = publications.filter((item) => item.featured);
  const monthlyPublications = publications.filter((item) => {
    if (!item.createdAt) return false;
    const created = new Date(item.createdAt);
    const today = new Date();
    return created.getMonth() === today.getMonth() && created.getFullYear() === today.getFullYear();
  }).length;
  const monthlyServices = travelServices.filter((item) => {
    if (!item.createdAt) return false;
    const created = new Date(item.createdAt);
    const today = new Date();
    return created.getMonth() === today.getMonth() && created.getFullYear() === today.getFullYear();
  }).length;

  const isPanelSection = section === "panel";
  const isUsersSection = section === "usuarios";
  const isCategoriesSection = section === "categorias";
  const isPublicationsSection = section === "publicaciones";
  const isConfigSection = section === "configuracion";
  const isContactSection = section === "contacto";

  const paidPublications = publications.filter((item) => {
    const value = String(item.price ?? "").trim();
    return Boolean(value) && value !== "0";
  });
  const freePublicationsList = publications.filter((item) => !String(item.price ?? "").trim() || item.price === "0");
  const freePublications = freePublicationsList.length;

  const userOferentes = travelServices.filter((item) => String(item.taxonomyType ?? "").toLowerCase() === "oferente");
  const userDemandantes = travelServices.filter((item) => String(item.taxonomyType ?? "").toLowerCase() !== "oferente");
  const oferentesPendientes = userOferentes.filter((item) => serviceEffectiveStatus(item) === "pendiente").length;
  const oferentesAprobados = userOferentes.filter((item) => serviceEffectiveStatus(item) === "aprobado").length;
  const oferentesRechazados = userOferentes.filter((item) => serviceEffectiveStatus(item) === "rechazado").length;

  const categoryDashboardRows = useMemo(() => {
    const normalize = (value: string) =>
      String(value ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .trim();

    const publicationMeta = publications.map((publication) => ({
      item: publication,
      category: normalize(String(publication.category ?? "")),
      subcategory: normalize(String(publication.subcategory ?? "")),
      paid: Boolean(String(publication.price ?? "").trim() && publication.price !== "0"),
      destination: firstNonEmpty(publication.country, publication.headquarterCountry),
    }));

    const metricsForLabels = (labels: string[]) => {
      const target = new Set(labels.map(normalize).filter(Boolean));
      const matches = publicationMeta.filter((entry) => target.has(entry.category) || target.has(entry.subcategory));
      const paid = matches.filter((entry) => entry.paid).length;
      const free = matches.length - paid;
      const destination = new Set(matches.map((entry) => entry.destination).filter(Boolean)).size;
      return { total: matches.length, paid, free, destination };
    };

    const labelsForCategory = (category: Category) =>
      [category.description, ...Object.values((category.descriptionI18n ?? {}) as Record<string, string>)].filter(Boolean);

    const blockRows = categoryBlocks.map((block) => {
      const scoped = categories.filter((category) => category.blockId === block.id && category.isPublicVisible !== false);
      const rootsInBlock = scoped.filter((category) => !category.parentId);
      const childrenInBlock = scoped.filter((category) => Boolean(category.parentId));
      const allBlockLabels = scoped.flatMap((category) => labelsForCategory(category));
      const totals = metricsForLabels(allBlockLabels);

      return {
        id: block.id,
        name: pickI18nText(block.labelI18n ?? null, locale, block.label),
        ...totals,
        roots: rootsInBlock.map((root) => {
          const rootChildren = childrenInBlock.filter((child) => child.parentId === root.id);
          const rootMetrics = metricsForLabels(labelsForCategory(root));
          return {
            id: root.id,
            name: pickI18nText(root.descriptionI18n ?? null, locale, root.description),
            ...rootMetrics,
            children: rootChildren.map((child) => {
              const childMetrics = metricsForLabels(labelsForCategory(child));
              return {
                id: child.id,
                name: pickI18nText(child.descriptionI18n ?? null, locale, child.description),
                ...childMetrics,
              };
            }),
          };
        }),
      };
    });

    return { blockRows };
  }, [categories, categoryBlocks, locale, publications]);

  const resolveCountryName = useMemo(() => {
    const normalizedCatalog = countryCatalog.map((country) => ({
      raw: country,
      norm: normalizeCountryText(country),
    }));
    return (input: string | null | undefined) => {
      const normalizedInput = normalizeCountryText(String(input ?? ""));
      if (!normalizedInput) return null;
      const exact = normalizedCatalog.find((entry) => entry.norm === normalizedInput);
      if (exact) return exact.raw;
      const partial = normalizedCatalog.find((entry) => entry.norm.includes(normalizedInput) || normalizedInput.includes(entry.norm));
      if (partial) return partial.raw;
      let best: { raw: string; distance: number } | null = null;
      normalizedCatalog.forEach((entry) => {
        const distance = levenshteinDistance(normalizedInput, entry.norm);
        if (!best || distance < best.distance) best = { raw: entry.raw, distance };
      });
      if (!best) return null;
      const tolerance = Math.max(2, Math.floor(normalizedInput.length * 0.3));
      return best.distance <= tolerance ? best.raw : null;
    };
  }, [countryCatalog]);

  const destinationRows = useMemo(() => {
    const map = new Map<string, { total: number; paid: number; free: number; visits: number }>();
    const countriesBase = countryCatalog.length ? countryCatalog : [];
    countriesBase.forEach((country) => map.set(country, { total: 0, paid: 0, free: 0, visits: 0 }));
    publications.forEach((publication) => {
      const key = resolveCountryName(publication.country);
      if (!key) return;
      const current = map.get(key) ?? { total: 0, paid: 0, free: 0, visits: 0 };
      current.total += 1;
      if (String(publication.price ?? "").trim() && publication.price !== "0") current.paid += 1;
      else current.free += 1;
      current.visits += Math.max(1, Math.round((publication.filterOptions?.length ?? 0) / 2));
      map.set(key, current);
    });
    return Array.from(map.entries())
      .map(([country, values]) => ({ country, ...values }))
      .sort((a, b) => b.total - a.total || a.country.localeCompare(b.country));
  }, [countryCatalog, publications, resolveCountryName]);

  const originRows = useMemo(() => {
    const map = new Map<string, { publications: number; paid: number; free: number; categories: number; destinations: number }>();
    const countriesBase = countryCatalog.length ? countryCatalog : [];
    countriesBase.forEach((country) => map.set(country, { publications: 0, paid: 0, free: 0, categories: 0, destinations: 0 }));
    countriesBase.forEach((country) => {
      const current = map.get(country) ?? { publications: 0, paid: 0, free: 0, categories: 0, destinations: 0 };
      const related = publications.filter((publication) => resolveCountryName(publication.headquarterCountry) === country);
      current.publications = related.length;
      current.paid = related.filter((publication) => String(publication.price ?? "").trim() && publication.price !== "0").length;
      current.free = Math.max(related.length - current.paid, 0);
      current.categories = new Set(related.map((publication) => publication.category).filter(Boolean)).size;
      current.destinations = new Set(
        related
          .map((publication) => resolveCountryName(publication.country))
          .filter(Boolean)
      ).size;
      map.set(country, current);
    });
    return Array.from(map.entries())
      .map(([country, values]) => ({ country, ...values }))
      .sort((a, b) => b.publications - a.publications || a.country.localeCompare(b.country));
  }, [countryCatalog, publications, resolveCountryName]);

  const passportVisitsRows = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const grouped = new Map<string, { total: number; monthly: number; destinations: number }>();
    const countriesBase = countryCatalog.length ? countryCatalog : [];
    countriesBase.forEach((country) => grouped.set(country, { total: 0, monthly: 0, destinations: 0 }));
    travelServices.forEach((service) => {
      const passport = resolveCountryName(service.country);
      if (!passport) return;
      const current = grouped.get(passport) ?? { total: 0, monthly: 0, destinations: 0 };
      current.total += 1;
      if (service.createdAt && new Date(service.createdAt) >= monthStart) current.monthly += 1;
      if (resolveCountryName(service.destinationCountry)) current.destinations += 1;
      grouped.set(passport, current);
    });
    return Array.from(grouped.entries()).map(([country, values]) => ({
      country,
      total: values.total,
      perDay: Math.round(values.monthly / Math.max(now.getDate(), 1)),
      perMonth: values.monthly,
      avgDestinations: values.total ? Math.round(values.destinations / values.total) : 0,
    })).sort((a, b) => b.total - a.total || a.country.localeCompare(b.country));
  }, [countryCatalog, resolveCountryName, travelServices]);

  const visibleDestinationRows = useMemo(() => {
    const term = normalizeCountryText(destinationCountrySearch);
    if (!term) return destinationRows.slice(0, 10);
    return destinationRows.filter((row) => normalizeCountryText(row.country).includes(term));
  }, [destinationCountrySearch, destinationRows]);

  const visibleOriginRows = useMemo(() => {
    const term = normalizeCountryText(originCountrySearch);
    if (!term) return originRows.slice(0, 10);
    return originRows.filter((row) => normalizeCountryText(row.country).includes(term));
  }, [originCountrySearch, originRows]);

  const visiblePassportRows = useMemo(() => {
    const term = normalizeCountryText(passportCountrySearch);
    if (!term) return passportVisitsRows.slice(0, 10);
    return passportVisitsRows.filter((row) => normalizeCountryText(row.country).includes(term));
  }, [passportCountrySearch, passportVisitsRows]);


  const normalizeStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
    const clean = String(value ?? "").trim();
    return clean ? [clean] : [];
  };
  const parseDate = (value: string | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const toDates = (values: Array<string | undefined>) => values.map((value) => parseDate(value)).filter(Boolean) as Date[];

  const seriesFromDates = (aDates: Date[], bDates: Date[] = []) => (period: ChartPeriod, year: number): ChartPoint[] => {
    const currentYear = Math.max(2026, new Date().getFullYear());
    const yearBuckets = Array.from({ length: currentYear - 2026 + 1 }, (_, index) => 2026 + index);
    const base =
      period === "months"
        ? MONTHS_SHORT
        : period === "days"
          ? Array.from({ length: 12 }, (_, index) => String(index + 1))
          : period === "weeks"
            ? Array.from({ length: 12 }, (_, index) => `S${index + 1}`)
            : yearBuckets.map(String);

    const countsA = new Array(base.length).fill(0);
    const countsB = new Array(base.length).fill(0);

    const bucket = (date: Date) => {
      if (period === "years") return yearBuckets.indexOf(date.getFullYear());
      if (date.getFullYear() !== year) return -1;
      if (period === "months") return date.getMonth();
      if (period === "days") return Math.min(11, Math.max(0, date.getDate() - 1));
      const week = Math.floor((date.getDate() - 1) / 3);
      return Math.min(11, Math.max(0, week));
    };

    aDates.forEach((date) => {
      const index = bucket(date);
      if (index >= 0) countsA[index] += 1;
    });
    bDates.forEach((date) => {
      const index = bucket(date);
      if (index >= 0) countsB[index] += 1;
    });

    return base.map((label, index) => ({ label, a: countsA[index], b: bDates.length ? countsB[index] : undefined }));
  };

  const oferentesData = useMemo(
    () => seriesFromDates(toDates(userOferentes.map((item) => item.createdAt)), toDates(userDemandantes.map((item) => item.createdAt))),
    [userDemandantes, userOferentes]
  );
  const demandantesData = useMemo(
    () => seriesFromDates(toDates(userDemandantes.map((item) => item.createdAt)), toDates(userOferentes.map((item) => item.createdAt))),
    [userDemandantes, userOferentes]
  );
  const publicationsData = useMemo(
    () => seriesFromDates(toDates(paidPublications.map((item) => item.createdAt)), toDates(freePublicationsList.map((item) => item.createdAt))),
    [freePublicationsList, paidPublications]
  );
  const reportsData = useMemo(
    () => seriesFromDates(toDates(reports.map((item) => item.createdAt))),
    [reports]
  );

  const selectedUsers = (userTab === "oferentes" ? userOferentes : userDemandantes).filter((item) => {
    const query = userSearch.toLowerCase().trim();
    if (!query) return true;
    const extra = parseTravelServiceExtra(item);
    return [
      item.email,
      item.name,
      ...normalizeStringArray((extra.category as string[] | string | undefined) ?? item.category),
      item.country,
      item.destinationCountry,
      String(extra.whatSearching ?? ""),
      String(extra.whatStop ?? ""),
      ...normalizeStringArray((extra.typeProfile as string[] | string | undefined) ?? item.typeProfile),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const approvedOferentes = useMemo(
    () => userOferentes.filter((item) => serviceEffectiveStatus(item) === "aprobado"),
    [userOferentes]
  );
  const filteredApprovedOferentes = useMemo(() => {
    const query = pApprovedProviderSearch.trim().toLowerCase();
    if (!query) return approvedOferentes;
    return approvedOferentes.filter((service) => {
      const extra = parseTravelServiceExtra(service);
      const label = service.name || String(extra.name ?? "") || "";
      return [label, service.email].some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [approvedOferentes, pApprovedProviderSearch]);

  const publicationsByProviderEmail = useMemo(() => {
    const map = new Map<string, Publication[]>();
    publications.forEach((publication) => {
      const providerEmail = String((publication.fields as any)?.providerEmail ?? "").trim().toLowerCase();
      if (!providerEmail) return;
      const current = map.get(providerEmail) ?? [];
      current.push(publication);
      map.set(providerEmail, current);
    });
    return map;
  }, [publications]);

  const updateTravelServiceStatus = async (id: string, status: "aprobado" | "rechazado" | "falta info" | "pendiente") => {
    const needsReason = status === "rechazado" || status === "falta info";
    const reason = needsReason
      ? window.prompt(`Ingresá el motivo para "${status}" (se enviará por email al oferente):`, "") ?? ""
      : "";
    if (needsReason && !reason.trim()) return;

    await api<{ ok: boolean }>("/api/travel-services", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status, reason: reason.trim() }),
    });
    if (status === "rechazado" || status === "falta info") {
      await deleteTravelService(id);
      return;
    }
    await refresh();
  };

  const deleteTravelService = async (id: string) => {
    await api<{ ok: boolean }>(`/api/travel-services?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (detailTravelService?.id === id) {
      setDetailTravelService(null);
      setDetailImageExpanded(null);
    }
    await refresh();
  };

  const applyOferenteToPublication = (serviceId: string) => {
    const selected = approvedOferentes.find((item) => item.id === serviceId);
    if (!selected) return;
    setPApprovedProviderSearch("");
    const extra = parseTravelServiceExtra(selected);

    const rawCategories = normalizeStringArray((extra.category as string[] | string | undefined) ?? selected.category);
    const byId = new Map(categories.map((category) => [category.id, category]));
    const resolveRoot = (category: Category) => {
      let current: Category | undefined = category;
      let depth = 0;
      while (current?.parentId && depth < 10) {
        current = byId.get(current.parentId);
        depth += 1;
      }
      return current ?? category;
    };
    const categoryAliasToMeta = new Map<string, { value: string; root: string; taxonomy: string | null; parentId: string | null }>();
    categories.forEach((category) => {
      const root = resolveRoot(category);
      const aliases = [category.description, ...Object.values((category.descriptionI18n ?? {}) as Record<string, string>)].filter(Boolean);
      aliases.forEach((alias) => categoryAliasToMeta.set(normalizeComparable(alias), {
        value: category.description,
        root: root.description,
        taxonomy: resolveCategoryTaxonomyType(category),
        parentId: category.parentId ?? null,
      }));
    });
    const selectedCategoryMetas = rawCategories.map((value) => categoryAliasToMeta.get(normalizeComparable(value)) ?? { value, root: value, taxonomy: "categoria", parentId: null });
    const mappedCategories = Array.from(new Set(selectedCategoryMetas.filter((item) => item.taxonomy === "categoria").map((item) => item.root).filter(Boolean)));
    const mappedSubcategories = Array.from(new Set(selectedCategoryMetas.filter((item) => item.taxonomy === "categoria" && item.parentId).map((item) => item.value).filter(Boolean)));
    const categoryActivities = selectedCategoryMetas.filter((item) => item.taxonomy === "actividad").map((item) => item.root || item.value).filter(Boolean);
    const categoryModalities = selectedCategoryMetas.filter((item) => item.taxonomy === "modalidad").map((item) => item.root || item.value).filter(Boolean);
    const categoryTypes = selectedCategoryMetas.filter((item) => ["tipo", "tipos"].includes(item.taxonomy || "")).map((item) => item.root || item.value).filter(Boolean);
    const categoryPrestaciones = selectedCategoryMetas.filter((item) => ["prestacion", "prestaciones"].includes(item.taxonomy || "")).map((item) => item.root || item.value).filter(Boolean);
    const profileTypes = Array.from(new Set([...normalizeStringArray((extra.typeProfile as string[] | string | undefined) ?? selected.typeProfile), ...categoryTypes]));
    const activities = Array.from(new Set([...normalizeStringArray((extra.activity as string[] | string | undefined) ?? selected.activity), ...categoryActivities]));
    const modalities = Array.from(new Set([...normalizeStringArray((extra.modality as string[] | string | undefined) ?? selected.modality), ...categoryModalities]));
    const languages = normalizeStringArray((extra.languages as string[] | string | undefined) ?? selected.languages);
    const images = normalizeStringArray(extra.images as string[] | string | undefined);
    const imageAssets = Array.isArray(extra.imageAssets) ? (extra.imageAssets as ImageAsset[]) : [];
    const priceByCurrency = Array.isArray(extra.priceByCurrency)
      ? (extra.priceByCurrency as Array<Record<string, unknown>>)
          .map((entry) => ({ currency: String(entry.currency ?? "").trim(), amount: String(entry.amount ?? "").trim() }))
          .filter((entry, index, self) => entry.currency && entry.amount && self.findIndex((item) => item.currency === entry.currency) === index)
      : [];
    const providerLogo = String(extra.providerLogo ?? "").trim();
    const explicitLinks = [
      { kind: "linkedin", label: "Profesional", url: String(extra.professionalLink ?? "").trim() },
      { kind: "whatsapp", label: "WhatsApp", url: String(extra.whatsappLink ?? "").trim() },
      { kind: "web", label: "Contacto viajero", url: String(extra.travelerContactLink ?? "").trim() },
    ].filter((entry) => entry.url);
    const extraVenues = Array.isArray(extra.venues) ? extra.venues as Array<Record<string, unknown>> : [];
    const receivingMode = String(extra.receivingCountriesMode ?? "all").toLowerCase();
    const normalizedReceivingMode = receivingMode === "except" || receivingMode === "only" ? receivingMode : "all";
    const receivingCountries = normalizeStringArray(extra.receivingCountries as string[] | string | undefined);

    setPPublisherName(selected.name || String(extra.name ?? "") || selected.email || "");
    setPProviderEmail(selected.email || "");
    setPFeatured(String(extra.publicationPlan ?? selected.publicationPlan ?? "") === "featured");
    setPProviderLogo(providerLogo);
    setPFieldsBase((prev) => ({
      ...prev,
      imageAssets,
      providerLogoAsset: (extra.providerLogoAsset as ImageAsset | undefined) ?? null,
    }));
    setPProviderInfoI18n((prev) => ({ ...prev, es: selected.contanos || prev.es || "" }));
    setPProviderActivities(activities);
    setPProviderTypes(profileTypes);
    setPProviderModalities(modalities);
    setPPrestaciones(Array.from(new Set([...categoryPrestaciones, ...normalizeStringArray(extra.prestaciones as string[] | string | undefined)])));
    setPLanguages(languages.join(", "));
    setPCategorySelections(mappedCategories);
    setPSubcategorySelections(mappedSubcategories);
    setPReceivingCountriesMode(normalizedReceivingMode as "all" | "except" | "only");
    setPReceivingCountries(normalizedReceivingMode === "all" ? [] : receivingCountries);
    setPCountry(selected.destinationCountry || String(extra.destinationCountry ?? ""));
    setPHeadquarterCountry(selected.headquarterCountry || String(extra.headquarterCountry ?? "") || selected.destinationCountry || "");
    setPHeadquarterMapUrl(String(extra.headquarterMapUrl ?? ""));
    setPHeadquarterExtras(extraVenues.map((venue) => ({
      country: String(venue.country ?? ""),
      city: String(venue.city ?? venue.address ?? ""),
      mapUrl: String(venue.mapUrl ?? ""),
    })));
    setPCity(selected.city || String(extra.city ?? ""));
    const { website, socialLinks } = parseProviderLinks(selected.website || String(extra.website ?? ""));
    setPWebsite(website);
    if (socialLinks.length || explicitLinks.length) {
      setPSocialLinksDetailed((prev) => {
        const existingByKind = new Map(prev.map((entry) => [entry.kind, entry]));
        [...socialLinks, ...explicitLinks].forEach((entry) => {
          if (!existingByKind.has(entry.kind)) existingByKind.set(entry.kind, entry);
        });
        return Array.from(existingByKind.values());
      });
    }
    setPPrice(selected.price || String(extra.price ?? ""));
    if (selected.currency || extra.currency) setPCurrency(String(selected.currency || extra.currency));
    setPExtraPrices(priceByCurrency.filter((entry) => entry.currency !== String(selected.currency || extra.currency || "").trim()));
    const uploadImages = images.filter((item) => item.startsWith("data:image/"));
    const remoteImages = images.filter((item) => item.startsWith("http://") || item.startsWith("https://"));
    setPImageUploads(uploadImages);
    setPImageUploadAssets(imageAssets.filter((asset) => uploadImages.includes(imageAssetToUrl(asset))));
    setPImageUrls(remoteImages.join("\n"));
  };


  const detailExtra = detailTravelService ? parseTravelServiceExtra(detailTravelService) : null;
  const isDetailDemandante = String(detailTravelService?.taxonomyType ?? "").toLowerCase() === "demandante";
  const detailLinkedPublications = detailTravelService && !isDetailDemandante
    ? (publicationsByProviderEmail.get(String(detailTravelService.email ?? "").toLowerCase()) ?? [])
    : [];

  const detailTravelServiceModal = detailTravelService ? (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4" onClick={() => { setDetailTravelService(null); setDetailImageExpanded(null); }}>
      <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-slate-900">Detalle completo del {String(detailTravelService.taxonomyType ?? "").toLowerCase() === "oferente" ? "oferente" : "demandante"}</h3>
          <button type="button" onClick={() => { setDetailTravelService(null); setDetailImageExpanded(null); }} className="rounded-lg border border-slate-200 px-3 py-1 text-sm">Cerrar</button>
        </div>
        {isDetailDemandante ? (
          <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <div><b>Email:</b> {detailTravelService.email || "-"}</div>
            <div><b>Estado:</b> {serviceEffectiveStatus(detailTravelService)}</div>
            <div><b>País de pasaporte:</b> {detailTravelService.country || "-"}</div>
            <div><b>Destino:</b> {detailTravelService.destinationCountry || "-"}</div>
            <div className="md:col-span-2"><b>Categoría:</b> {normalizeStringArray((detailExtra?.category as string[] | string | undefined) ?? detailTravelService.category).join(", ") || "-"}</div>
            <div className="md:col-span-2"><b>¿Qué está buscando?:</b> {String(detailExtra?.whatSearching ?? "") || "-"}</div>
            <div className="md:col-span-2"><b>¿Qué le da dudas o preocupa?:</b> {String(detailExtra?.whatStop ?? "") || "-"}</div>
            <div><b>Fecha:</b> {detailTravelService.createdAt ? new Date(detailTravelService.createdAt).toLocaleDateString("es-AR") : "-"}</div>
          </div>
        ) : (
          <div className="grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <div><b>Nombre:</b> {detailTravelService.name || String(detailExtra?.name ?? "-")}</div>
            <div><b>Email:</b> {detailTravelService.email || "-"}</div>
            <div><b>Teléfono:</b> {detailTravelService.phone || String(detailExtra?.phone ?? "-")}</div>
            <div><b>Estado:</b> {serviceEffectiveStatus(detailTravelService)}</div>
            <div><b>Motivo estado:</b> {String(detailExtra?.statusReason ?? "-") || "-"}</div>
            <div><b>Tipo perfil:</b> {normalizeStringArray((detailExtra?.typeProfile as string[] | string | undefined) ?? detailTravelService.typeProfile).join(", ") || "-"}</div>
            <div><b>Categorías:</b> {normalizeStringArray((detailExtra?.category as string[] | string | undefined) ?? detailTravelService.category).join(", ") || "-"}</div>
            <div><b>Actividad:</b> {normalizeStringArray((detailExtra?.activity as string[] | string | undefined) ?? detailTravelService.activity).join(", ") || "-"}</div>
            <div><b>Modalidad:</b> {normalizeStringArray((detailExtra?.modality as string[] | string | undefined) ?? detailTravelService.modality).join(", ") || "-"}</div>
            <div><b>Idiomas:</b> {normalizeStringArray((detailExtra?.languages as string[] | string | undefined) ?? detailTravelService.languages).join(", ") || "-"}</div>
            <div><b>Destino:</b> {detailTravelService.destinationCountry || "-"} / {detailTravelService.city || String(detailExtra?.city ?? "-")}</div>
            <div><b>Sede principal:</b> {detailTravelService.headquarterCountry || String(detailExtra?.headquarterCountry ?? "-")}</div>
            <div className="md:col-span-2"><b>Web/red:</b> {detailTravelService.website || "-"}</div>
            <div className="md:col-span-2"><b>Descripción:</b> {detailTravelService.contanos || "-"}</div>
            <div className="md:col-span-2"><b>¿Qué está buscando?:</b> {String(detailExtra?.whatSearching ?? "") || "-"}</div>
            <div className="md:col-span-2"><b>¿Qué lo frena o preocupa?:</b> {String(detailExtra?.whatStop ?? "") || "-"}</div>
            <div className="md:col-span-2">
              <b>Tipos de viajeros:</b> {receivingModeLabel(detailExtra?.receivingCountriesMode)}
              {normalizeStringArray(detailExtra?.receivingCountries).length
                ? ` (${normalizeStringArray(detailExtra?.receivingCountries).join(", ")})`
                : ""}
            </div>
            <div className="md:col-span-2">
              <b>Imágenes cargadas:</b>
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                {normalizeStringArray(detailExtra?.images).length ? normalizeStringArray(detailExtra?.images).map((img, idx) => (
                  <button key={`${idx}-${img.slice(0, 20)}`} type="button" onClick={() => setDetailImageExpanded(img)} className="overflow-hidden rounded-lg border border-slate-200">
                    <img src={img} alt={`imagen-oferente-${idx + 1}`} className="h-24 w-full object-cover transition hover:scale-105" />
                  </button>
                )) : <span>-</span>}
              </div>
            </div>
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-900">Publicaciones vinculadas: {detailLinkedPublications.length}</div>
              {detailLinkedPublications.length ? (
                <div className="mt-2 space-y-1 text-xs text-slate-700">
                  {detailLinkedPublications.map((publication) => {
                    const metrics = readPublicationAnalytics(publication);
                    return (
                      <div key={`linked-${publication.id}`}>
                        • {publication.title || "Sin título"} — {publication.publisherName || "Sin oferente"} | 👁️ {metrics.views} · 📩 {metrics.leads} · ❤️ {metrics.favorites} · 🔗 {metrics.shares}
                      </div>
                    );
                  })}
                </div>
              ) : <div className="mt-2 text-xs text-slate-500">Este oferente todavía no tiene publicaciones vinculadas.</div>}
            </div>
          </div>
        )}
        {detailImageExpanded ? (
          <div className="fixed inset-0 z-[320] grid place-items-center bg-black/70 p-4" onClick={() => setDetailImageExpanded(null)}>
            <div className="max-h-[90vh] max-w-5xl overflow-hidden rounded-xl border border-white/20 bg-black/20" onClick={(e) => e.stopPropagation()}>
              <img src={detailImageExpanded} alt="imagen ampliada" className="max-h-[90vh] w-auto max-w-[95vw] object-contain" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  const usersSectionCard = (
    <section className="space-y-6">
      {detailTravelServiceModal}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardStatCard
          label="Total Oferentes"
          total={userOferentes.length}
          active={Math.max(1, Math.round(userOferentes.length * 0.8))}
          monthly={monthlyServices}
          activeMonthly={Math.max(1, Math.round(userOferentes.length * 0.2))}
          tone="blue"
        />
        <DashboardStatCard
          label="Total Demandantes"
          total={userDemandantes.length}
          active={Math.max(1, Math.round(userDemandantes.length * 0.37))}
          monthly={monthlyServices}
          activeMonthly={Math.max(1, Math.round(userDemandantes.length * 0.4))}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><b>Total oferentes registrados:</b> {userOferentes.length}</div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><b>Activos/aprobados:</b> {oferentesAprobados}</div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><b>Pendientes:</b> {oferentesPendientes}</div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><b>Rechazados:</b> {oferentesRechazados}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Oferentes por mes: activos vs inactivos</p>
          <MiniBars values={[68, 72, 61, 54, 50, 58]} tone="indigo" />
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Demandantes por mes: activos vs inactivos</p>
          <MiniBars values={[71, 64, 55, 52, 60, 70]} tone="violet" />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
            <button type="button" onClick={() => setUserTab("oferentes")} className={`rounded-md px-3 py-1.5 font-medium ${userTab === "oferentes" ? "bg-white shadow" : "text-slate-500"}`}>Oferentes</button>
            <button type="button" onClick={() => setUserTab("demandantes")} className={`rounded-md px-3 py-1.5 font-medium ${userTab === "demandantes" ? "bg-white shadow" : "text-slate-500"}`}>Demandantes</button>
          </div>
          <input
            value={userSearch}
            onChange={(event) => setUserSearch(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200 sm:w-72"
            placeholder="Buscar..."
          />
        </div>

        <div className="space-y-3">
          {selectedUsers.length ? selectedUsers.map((service) => {
            const serviceExtra = parseTravelServiceExtra(service);
            const serviceStatus = serviceEffectiveStatus(service);
            const isDemandante = String(service.taxonomyType ?? "").toLowerCase() === "demandante";
            const serviceCategories = normalizeStringArray((serviceExtra.category as string[] | string | undefined) ?? service.category);
            const linkedPublications = isDemandante ? [] : publicationsByProviderEmail.get(String(service.email ?? "").toLowerCase()) ?? [];
            const aggregated = linkedPublications.reduce((acc, publication) => {
              const metrics = readPublicationAnalytics(publication);
              acc.views += metrics.views;
              acc.leads += metrics.leads;
              acc.favorites += metrics.favorites;
              acc.shares += metrics.shares;
              return acc;
            }, { views: 0, leads: 0, favorites: 0, shares: 0 });
            return (
            <article key={service.id} className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{service.taxonomyType}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">{serviceStatus}</span>
                    {!isDemandante ? normalizeStringArray(service.typeProfile).map((item) => <span key={item} className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">{item}</span>) : null}
                  </div>
                  {isDemandante ? (
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p className="text-sm font-semibold text-slate-900">{service.email || "Sin email"}</p>
                      <p><b>Categoría:</b> {serviceCategories.join(", ") || "-"}</p>
                      <p><b>Pasaporte:</b> {service.country || "-"} <b className="ml-2">Destino:</b> {service.destinationCountry || "-"}</p>
                      <p><b>Busca:</b> {String(serviceExtra.whatSearching ?? "") || "-"}</p>
                      <p><b>Dudas/preocupación:</b> {String(serviceExtra.whatStop ?? "") || "-"}</p>
                    </div>
                  ) : (
                    <>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{service.name || String(serviceExtra.name ?? "") || "Sin nombre"}</p>
                      <p className="mt-1 text-xs text-slate-500">{service.email}</p>
                      <div className="mt-2 text-xs text-slate-600">
                        <b>Tiene {linkedPublications.length} publicación(es)</b>
                        {linkedPublications.length ? (
                          <div className="mt-1 space-y-1">
                            {linkedPublications.slice(0, 3).map((publication) => (
                              <div key={`${service.id}-${publication.id}`}>• {publication.title || "Sin título"} — {publication.publisherName || "Sin oferente"}</div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">👁️ {aggregated.views} visitas</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">📩 {aggregated.leads} leads</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">❤️ {aggregated.favorites} favoritos</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">🔗 {aggregated.shares} compartidos</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" onClick={() => setDetailTravelService(service)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Detalle</button>
                  {serviceStatus === "pendiente" ? (
                    <>
                      <button type="button" onClick={() => updateTravelServiceStatus(service.id, "aprobado")} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">✅ Aprobado</button>
                      <button type="button" onClick={() => updateTravelServiceStatus(service.id, "rechazado")} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">❌ Rechazado</button>
                      <button type="button" onClick={() => updateTravelServiceStatus(service.id, "falta info")} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">⚠ Falta info</button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => deleteTravelService(service.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-rose-700 hover:bg-rose-50">🗑 Eliminar</button>
                </div>
              </div>
            </article>
          )}) : (
            <div className="rounded-xl border border-slate-100 p-4 text-sm text-slate-500">No hay usuarios para mostrar.</div>
          )}
        </div>
      </div>
    </section>
  );

  const openNewPublicationEditor = () => {
    router.push("/admin/publicaciones/nueva");
  };

  const publicationTypeLabel = (item: Publication) => (item.primaryGroupKey === "prestacion" ? "Prestación" : "Publicación");
  const publicationTypeColors = (item: Publication) =>
    item.primaryGroupKey === "prestacion"
      ? "bg-teal-100 text-teal-700 border-teal-200"
      : "bg-indigo-100 text-indigo-700 border-indigo-200";
  const publicationLanguages = (item: Publication) => {
    const langs = new Set<string>();
    const i18n = [item.titleI18n, item.descriptionI18n];
    i18n.forEach((record) => {
      if (!record) return;
      Object.entries(record).forEach(([lang, value]) => {
        if (String(value ?? "").trim()) langs.add(lang.toUpperCase());
      });
    });
    if (item.contentLanguage) langs.add(String(item.contentLanguage).toUpperCase());
    return Array.from(langs);
  };

  const filteredPublications = publications.filter((item) => {
    const query = publicationSearch.toLowerCase().trim();
    const matchesSearch = !query || [item.title, item.publisherName, item.category, item.subcategory]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
    const matchesType =
      publicationTypeFilter === "todas"
        || (publicationTypeFilter === "prestacion" ? item.primaryGroupKey === "prestacion" : item.primaryGroupKey !== "prestacion");
    return matchesSearch && matchesType;
  });
  const filteredReports = reports.filter((item) => {
    const query = publicationSearch.toLowerCase().trim();
    if (!query) return true;
    return [item.publicationTitle, item.fullName, item.email, item.contact, item.details]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  if (loading) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-48 rounded bg-slate-100" />
          <div className="h-10 rounded bg-slate-100" />
          <div className="h-10 rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {isPanelSection ? (
      <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Usuarios Oferentes"
          total={userOferentes.length}
          active={Math.max(1, Math.round(userOferentes.length * 0.8))}
          monthly={monthlyServices}
          activeMonthly={Math.max(monthlyServices, 1)}
          tone="blue"
        />
        <DashboardStatCard
          label="Usuarios Demandantes"
          total={userDemandantes.length}
          active={Math.max(1, Math.round(userDemandantes.length * 0.37))}
          monthly={monthlyServices}
          activeMonthly={Math.max(1, Math.round(userDemandantes.length * 0.2))}
          tone="violet"
        />
        <DashboardStatCard
          label="Publicaciones Activas"
          total={publications.length}
          active={activePublications.length}
          monthly={monthlyPublications}
          activeMonthly={Math.max(monthlyPublications, featuredPublications.length)}
          tone="emerald"
        />
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100 p-5 text-rose-700 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-widest opacity-70">Reportes / Denuncias</span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-4xl font-bold tracking-tight">{reports.length.toLocaleString()}</p>
              <p className="text-xs opacity-70">en el mes</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold">{new Set(reports.map((report) => report.publicationId).filter(Boolean)).size.toLocaleString()}</p>
              <p className="text-xs opacity-70">usuarios afectados</p>
            </div>
          </div>
          <div className="mt-3 border-t border-rose-200 pt-2 text-xs">+ {reports.length.toLocaleString()} acumulado</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StatsChartCard title="Oferentes: activos vs inactivos" labelA="Activos" labelB="Inactivos" colorA="#6366f1" colorB="#c7d2fe" getData={oferentesData} />
        <StatsChartCard title="Demandantes: activos vs inactivos" labelA="Activos" labelB="Inactivos" colorA="#8b5cf6" colorB="#ddd6fe" getData={demandantesData} />
        <StatsChartCard title="Publicaciones: pagas vs gratis" labelA="Pagas" labelB="Gratis" colorA="#10b981" colorB="#a7f3d0" getData={publicationsData} />
        <StatsChartCard title="Denuncias por período" labelA="Denuncias" colorA="#f43f5e" getData={reportsData} single />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total Publicaciones</p>
          <p className="mt-2 text-3xl font-bold text-slate-800">{publications.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-500">Pagas</p>
          <p className="mt-2 text-3xl font-bold text-violet-700">{paidPublications.length.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Gratis</p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">{freePublications.toLocaleString()}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-700">Categorías</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 text-slate-400 uppercase tracking-wider"><th className="text-left px-5 py-3 font-semibold">Categoría</th><th className="text-center px-3 py-3 font-semibold">Total</th><th className="text-center px-3 py-3 font-semibold">Pagas</th><th className="text-center px-3 py-3 font-semibold">Gratis</th><th className="text-center px-3 py-3 font-semibold">En País Destino</th></tr></thead>
            <tbody>
              {categoryDashboardRows.blockRows.map((block) => {
                const open = expandedPanelBlocks[block.id] ?? false;
                return (
                  <Fragment key={`block-row-${block.id}`}>
                    <tr className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-700 font-semibold">
                        <button type="button" onClick={() => setExpandedPanelBlocks((prev) => ({ ...prev, [block.id]: !open }))} className="inline-flex items-center gap-2">
                          <span className="text-[#00A9C6]">{open ? "▾" : "▸"}</span>
                          <span>{block.name}</span>
                        </button>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700">{block.total}</td>
                      <td className="px-3 py-3 text-center"><span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700">{block.paid}</span></td>
                      <td className="px-3 py-3 text-center"><span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">{block.free}</span></td>
                      <td className="px-3 py-3 text-center text-slate-500">{block.destination}</td>
                    </tr>
                    {open
                      ? block.roots.map((root) => (
                          <Fragment key={`root-${root.id}`}>
                            <tr className="border-t border-slate-50 bg-slate-50/60">
                              <td className="px-5 py-2 pl-10 text-slate-700">{root.name}</td>
                              <td className="px-3 py-2 text-center text-slate-600">{root.total}</td>
                              <td className="px-3 py-2 text-center text-violet-700">{root.paid}</td>
                              <td className="px-3 py-2 text-center text-emerald-700">{root.free}</td>
                              <td className="px-3 py-2 text-center text-slate-500">{root.destination}</td>
                            </tr>
                            {root.children.map((child) => (
                              <tr key={`child-${child.id}`} className="border-t border-slate-50 bg-white">
                                <td className="px-5 py-2 pl-16 text-slate-500">↳ {child.name}</td>
                                <td className="px-3 py-2 text-center text-slate-500">{child.total}</td>
                                <td className="px-3 py-2 text-center text-violet-600">{child.paid}</td>
                                <td className="px-3 py-2 text-center text-emerald-600">{child.free}</td>
                                <td className="px-3 py-2 text-center text-slate-400">{child.destination}</td>
                              </tr>
                            ))}
                          </Fragment>
                        ))
                      : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Países Destino (Demandantes)</h3>
            <input value={destinationCountrySearch} onChange={(event) => setDestinationCountrySearch(event.target.value)} placeholder="Buscar país..." className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-200" />
            <p className="mt-1 text-[11px] text-slate-400">Sin búsqueda: top 10 países con más demandantes.</p>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-400 uppercase tracking-wider"><th className="text-left px-4 py-3 font-semibold">País</th><th className="text-center px-3 py-3 font-semibold">Total</th><th className="text-center px-3 py-3 font-semibold">Pagas</th><th className="text-center px-3 py-3 font-semibold">Gratis</th><th className="text-center px-3 py-3 font-semibold">Visitas</th></tr></thead><tbody>{visibleDestinationRows.map((row) => (<tr key={row.country} className="border-t border-slate-50 hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-700">{row.country}</td><td className="px-3 py-3 text-center text-slate-600">{row.total}</td><td className="px-3 py-3 text-center font-semibold text-violet-600">{row.paid}</td><td className="px-3 py-3 text-center font-semibold text-emerald-600">{row.free}</td><td className="px-3 py-3 text-center font-semibold text-blue-600">{row.visits}</td></tr>))}</tbody></table></div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Países Origen (Oferentes)</h3>
            <input value={originCountrySearch} onChange={(event) => setOriginCountrySearch(event.target.value)} placeholder="Buscar país..." className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-200" />
            <p className="mt-1 text-[11px] text-slate-400">Sin búsqueda: top 10 países con más oferentes.</p>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-400 uppercase tracking-wider"><th className="text-left px-4 py-3 font-semibold">País</th><th className="text-center px-3 py-3 font-semibold">Pubs.</th><th className="text-center px-3 py-3 font-semibold">Pagas</th><th className="text-center px-3 py-3 font-semibold">Gratis</th><th className="text-center px-3 py-3 font-semibold">Cats.</th><th className="text-center px-3 py-3 font-semibold">Destinos</th></tr></thead><tbody>{visibleOriginRows.map((row) => (<tr key={row.country} className="border-t border-slate-50 hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-700">{row.country}</td><td className="px-3 py-3 text-center text-slate-600">{row.publications}</td><td className="px-3 py-3 text-center font-semibold text-violet-600">{row.paid}</td><td className="px-3 py-3 text-center font-semibold text-emerald-600">{row.free}</td><td className="px-3 py-3 text-center text-slate-600">{row.categories}</td><td className="px-3 py-3 text-center font-semibold text-blue-600">{row.destinations}</td></tr>))}</tbody></table></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Visitas por Pasaporte / País de Origen</h3>
          <input value={passportCountrySearch} onChange={(event) => setPassportCountrySearch(event.target.value)} placeholder="Buscar país..." className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-200" />
          <p className="mt-1 text-[11px] text-slate-400">Sin búsqueda: top 10 países con más pasaportes seleccionados.</p>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-400 uppercase tracking-wider"><th className="text-left px-5 py-3 font-semibold">País</th><th className="text-center px-3 py-3 font-semibold">Total</th><th className="text-center px-3 py-3 font-semibold">Prom. por Día</th><th className="text-center px-3 py-3 font-semibold">Prom. por Mes</th><th className="text-center px-3 py-3 font-semibold">Destinos Prom.</th></tr></thead><tbody>{visiblePassportRows.map((row) => (<tr key={row.country} className="border-t border-slate-50 hover:bg-slate-50"><td className="px-5 py-3 font-medium text-slate-700">{row.country}</td><td className="px-3 py-3 text-center font-bold text-blue-600">{row.total.toLocaleString()}</td><td className="px-3 py-3 text-center text-slate-600">{row.perDay}</td><td className="px-3 py-3 text-center text-slate-600">{row.perMonth.toLocaleString()}</td><td className="px-3 py-3 text-center text-slate-500">{row.avgDestinations}</td></tr>))}</tbody></table></div>
      </div>
      </>
      ) : null}

      {isUsersSection ? usersSectionCard : null}

      {isConfigSection ? (
        <section className="rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
          <h2 className="text-2xl font-semibold text-slate-900">Configuración</h2>
          <p className="mt-2 text-sm text-slate-600">Esta sección replica la navegación del panel de control. Aquí podés seguir centralizando ajustes del admin.</p>
        </section>
      ) : null}

      {isContactSection ? (
        <section className="rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
          <h2 className="text-2xl font-semibold text-slate-900">Contacto / Sugerencias</h2>
          <p className="mt-2 text-sm text-slate-600">Canal para sugerencias internas y contacto del equipo administrativo.</p>
        </section>
      ) : null}

      {isCategoriesSection ? (
      <div className="grid gap-8">
      {/* Categorías */}
      <section className="rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {renderLangTabs(catLang, setCatLang)}
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={openCreateBlockModal}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none"
              >
                <Plus className="h-4 w-4" />
                Nuevo bloque
              </button>
              <button
                type="button"
                onClick={() => openCreateCategoryModal()}
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 sm:flex-none"
              >
                <Plus className="h-4 w-4" />
                Nueva categoría
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-4 sm:px-5">
              <h3 className="text-sm font-semibold text-slate-700">Árbol de bloques y categorías</h3>
              <span className="text-xs text-slate-400">{categoryBlocks.length} bloques · {categories.length} categorías</span>
            </div>

            {!categoryBlocks.length ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">No hay bloques todavía.</div>
            ) : (
              <div className="space-y-4 px-2 py-3 sm:px-4 sm:py-4">
                {categoryBlocks.map((block, blockIndex) => {
                  const rootsInBlock = rootCategoriesByBlock.get(block.id) ?? [];
                  const optionRoots = (block.options ?? [])
                    .filter((option) => !option.parentId)
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  const optionChildrenByParent = new Map<string, FilterOption[]>();
                  (block.options ?? []).forEach((option) => {
                    if (!option.parentId) return;
                    optionChildrenByParent.set(option.parentId, [
                      ...(optionChildrenByParent.get(option.parentId) ?? []),
                      option,
                    ]);
                  });
                  optionChildrenByParent.forEach((arr, key) => {
                    optionChildrenByParent.set(
                      key,
                      [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                    );
                  });
                  const isBlockOpen = expandedBlocks[block.id] ?? false;
                  const hasBlockContent = rootsInBlock.length > 0 || optionRoots.length > 0;
                  return (
                    <div key={block.id} className="rounded-2xl border border-slate-100 bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 sm:px-4">
                        <button
                          type="button"
                          onClick={() => hasBlockContent && setExpandedBlocks((prev) => ({ ...prev, [block.id]: !isBlockOpen }))}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <span className="flex h-5 w-5 items-center justify-center text-slate-400">
                            {hasBlockContent ? (isBlockOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="h-4 w-4" />}
                          </span>
                          <span>
                            <p className="text-sm font-semibold text-slate-900">{pickI18nText(block.labelI18n ?? null, catLang, block.label)}</p>
                            <p className="text-xs text-slate-500">Tipo de filtro: {normalizeTaxonomyTypeAlias(block.taxonomyType ?? "categoria")}</p>{block.isPublicVisible === false ? <p className="mt-1 text-xs font-medium text-amber-600">Este bloque es invisible</p> : null}
                          </span>
                        </button>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button type="button" onClick={() => moveFilterGroup(block.id, -1)} disabled={blockIndex === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40">↑</button>
                          <button type="button" onClick={() => moveFilterGroup(block.id, 1)} disabled={blockIndex === categoryBlocks.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40">↓</button>
                          <button type="button" onClick={() => openEditBlockModal(block)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Editar</button>
                          <button type="button" onClick={() => deleteFilterGroup(block.id)} disabled={block.key === "price"} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">Eliminar</button>
                          <button type="button" onClick={() => openCreateCategoryModal("", block.id)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">+ Categoría</button>
                        </div>
                      </div>

                      {isBlockOpen ? (() => {
                        const normalizeTreeLabel = (value: string) => normalizeBlockKey(value || "").trim();
                        const rootNames = new Set(
                          rootsInBlock.map((root) => normalizeTreeLabel(pickI18nText(root.descriptionI18n ?? null, catLang, root.description)))
                        );
                        const fallbackOptionRoots = optionRoots.filter((option) => {
                          const optionName = normalizeTreeLabel(pickI18nText(option.labelI18n ?? null, catLang, option.label));
                          return !rootNames.has(optionName);
                        });

                        if (!rootsInBlock.length && !fallbackOptionRoots.length) {
                          return <div className="px-4 py-4 text-xs text-slate-500">Sin categorías en este bloque.</div>;
                        }

                        return (
                          <div className="divide-y divide-slate-50">
                            {rootsInBlock.map((root) => {
                              const children = childrenBy.get(root.id) ?? [];
                              const rootIndex = rootsInBlock.findIndex((category) => category.id === root.id);
                              const rootName = normalizeTreeLabel(pickI18nText(root.descriptionI18n ?? null, catLang, root.description));
                              const matchingOptionRoot = optionRoots.find(
                                (option) => normalizeTreeLabel(pickI18nText(option.labelI18n ?? null, catLang, option.label)) === rootName
                              );
                              const fallbackChildren = (matchingOptionRoot ? optionChildrenByParent.get(matchingOptionRoot.id) ?? [] : []).filter(
                                (optionChild) => {
                                  const optionChildName = normalizeTreeLabel(
                                    pickI18nText(optionChild.labelI18n ?? null, catLang, optionChild.label)
                                  );
                                  return !children.some(
                                    (categoryChild) =>
                                      normalizeTreeLabel(
                                        pickI18nText(categoryChild.descriptionI18n ?? null, catLang, categoryChild.description)
                                      ) === optionChildName
                                  );
                                }
                              );
                              const isOpen = expandedCategories[root.id] ?? false;
                              const hasChildren = children.length > 0 || fallbackChildren.length > 0;

                              return (
                                <div key={root.id}>
                                  <div className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                                    <button
                                      type="button"
                                      onClick={() => hasChildren && setExpandedCategories((prev) => ({ ...prev, [root.id]: !isOpen }))}
                                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    >
                                      <span className="flex h-5 w-5 items-center justify-center text-slate-400 hover:text-slate-600">
                                        {hasChildren ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="h-4 w-4" />}
                                      </span>
                                      <span className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900">
                                          {pickI18nText(root.descriptionI18n ?? null, catLang, root.description)}
                                          {root.isPrimaryCategory ? <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">Principal</span> : null}
                                        </p>{root.isPublicVisible === false ? <p className="mt-1 text-xs font-medium text-amber-600">Esta categoría es invisible</p> : null}
                                        {getCategoryCustomTaxonomyNotice(root) ? <p className="mt-1 text-xs font-medium text-indigo-600">{getCategoryCustomTaxonomyNotice(root)}</p> : null}
                                      </span>
                                    </button>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      <button type="button" onClick={() => moveCategory(root.id, -1)} disabled={rootIndex === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40">↑</button>
                                      <button type="button" onClick={() => moveCategory(root.id, 1)} disabled={rootIndex === rootsInBlock.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40">↓</button>
                                      <button type="button" onClick={() => openCreateCategoryModal(root.id, block.id)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">+ Sub</button>
                                      <button type="button" onClick={() => openEditCategoryModal(root)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Editar</button>
                                      <button type="button" onClick={() => deleteCategory(root.id)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50">Eliminar</button>
                                    </div>
                                  </div>

                                  {isOpen
                                    ? (
                                        <>
                                          {children.map((child, childIndex) => (
                                            <div key={child.id} className="group flex items-center gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 pl-14 hover:bg-slate-50">
                                              <div className="h-px w-4 bg-slate-200" />
                                              <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-800">
                                                  {pickI18nText(child.descriptionI18n ?? null, catLang, child.description)}
                                                  {child.isPrimaryCategory ? <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">Principal</span> : null}
                                                </div>{child.isPublicVisible === false ? <div className="mt-1 text-xs font-medium text-amber-600">Esta categoría es invisible</div> : null}
                                                {getCategoryCustomTaxonomyNotice(child) ? <div className="mt-1 text-xs font-medium text-indigo-600">{getCategoryCustomTaxonomyNotice(child)}</div> : null}
                                              </div>
                                              <div className="flex flex-wrap items-center justify-end gap-2">
                                                <button type="button" onClick={() => moveCategory(child.id, -1)} disabled={childIndex === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40">↑</button>
                                                <button type="button" onClick={() => moveCategory(child.id, 1)} disabled={childIndex === children.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-40">↓</button>
                                                <button type="button" onClick={() => openEditCategoryModal(child)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-white">Editar</button>
                                                <button type="button" onClick={() => deleteCategory(child.id)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50">Eliminar</button>
                                              </div>
                                            </div>
                                          ))}

                                          {fallbackChildren.map((optionChild) => (
                                            <div
                                              key={optionChild.id}
                                              className="group flex items-center gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 pl-14 hover:bg-slate-50"
                                            >
                                              <div className="h-px w-4 bg-slate-200" />
                                              <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium text-slate-800">
                                                  {pickI18nText(optionChild.labelI18n ?? null, catLang, optionChild.label)}
                                                </div>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => deleteFilterOption(optionChild.id)}
                                                className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                                              >
                                                Eliminar
                                              </button>
                                            </div>
                                          ))}
                                        </>
                                      )
                                    : null}
                                </div>
                              );
                            })}

                            {fallbackOptionRoots.map((rootOption) => {
                              const children = optionChildrenByParent.get(rootOption.id) ?? [];
                              const optionStateKey = `option-${rootOption.id}`;
                              const isOptionOpen = expandedCategories[optionStateKey] ?? false;
                              return (
                                <div key={rootOption.id}>
                                  <div className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                                    <button
                                      type="button"
                                      onClick={() => children.length && setExpandedCategories((prev) => ({ ...prev, [optionStateKey]: !isOptionOpen }))}
                                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                                    >
                                      <span className="flex h-5 w-5 items-center justify-center text-slate-400">
                                        {children.length ? (isOptionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="h-4 w-4" />}
                                      </span>
                                      <span className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900">
                                          {pickI18nText(rootOption.labelI18n ?? null, catLang, rootOption.label)}
                                        </p>
                                      </span>
                                    </button>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => deleteFilterOption(rootOption.id)}
                                        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  </div>
                                  {isOptionOpen ? children.map((child) => (
                                    <div
                                      key={child.id}
                                      className="group flex items-center gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-3 pl-14 hover:bg-slate-50"
                                    >
                                      <div className="h-px w-4 bg-slate-200" />
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-slate-800">
                                          {pickI18nText(child.labelI18n ?? null, catLang, child.label)}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => deleteFilterOption(child.id)}
                                        className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  )) : null}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })() : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {showCategoryModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-3 py-4 sm:px-4 sm:py-8">
            <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-3 shadow-2xl sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="inline-flex rounded-xl bg-slate-100 p-1">
                  <button type="button" onClick={() => setCategoryModalMode("category")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${categoryModalMode === "category" ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}>Categoría</button>
                  <button type="button" onClick={() => setCategoryModalMode("block")} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${categoryModalMode === "block" ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}>Bloque</button>
                </div>
                <button type="button" onClick={() => setShowCategoryModal(false)} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {categoryModalMode === "category" ? (
                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold text-slate-900">{editingCategoryId ? "Editar categoría" : catParentId ? "Nueva subcategoría" : "Nueva categoría"}</h3>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Nombre (multilenguaje)</label>
                    <div className="space-y-2">
                      {LANGS.map((lang) => (
                        <div key={lang} className="flex items-center gap-2">
                          <span className="w-6 text-xs font-bold uppercase text-slate-400">{lang}</span>
                          <input value={catI18n[lang] ?? ""} onChange={(e) => setCatI18n((prev) => ({ ...prev, [lang]: e.target.value }))} className="h-11 flex-1 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-indigo-300" placeholder={`Nombre en ${lang.toUpperCase()}`} />
                        </div>
                      ))}
                    </div>
                    {catError ? <p className="mt-2 text-xs text-red-500">{catError}</p> : null}
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Bloque</label>
                    <select value={catBlockId} onChange={(e) => setCatBlockId(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-indigo-300" disabled={Boolean(catParentId)}>
                      <option value="">Seleccionar bloque</option>
                      {categoryBlocks.map((block) => (
                        <option key={block.id} value={block.id}>{pickI18nText(block.labelI18n ?? null, catLang, block.label)}</option>
                      ))}
                    </select>
                  </div>

                  {showCategoryParentSelector ? (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Categoría padre</label>
                      <select value={catParentId} onChange={(e) => setCatParentId(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">(Ninguna — categoría raíz)</option>
                        {roots
                          .filter((root) => {
                            if (!catBlockId) return true;
                            return root.blockId === catBlockId;
                          })
                          .map((root) => (
                          <option key={root.id} value={root.id}>{pickI18nText(root.descriptionI18n ?? null, catLang, root.description)}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Tipo de filtro</label>
                    <select value={catTaxonomyType} onChange={(e) => setCatTaxonomyType(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-indigo-300">
                      <option value="inherit">Predeterminado (hereda el tipo de filtro del padre)</option>
                      <option value="categoria">categoria</option>
                      <option value="prestacion">prestacion</option>
                      <option value="idiomas">idiomas</option>
                      <option value="modalidad">modalidad</option>
                      <option value="actividad">actividad</option>
                      <option value="tipos">tipos</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={catIsPublicVisible} onChange={(e) => setCatIsPublicVisible(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
                    <span>Visible al público</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={catIsPrimaryCategory} onChange={(e) => setCatIsPrimaryCategory(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
                    <span>Esta categoría es principal (buscador de inicio)</span>
                  </label>
                  {catIsPrimaryCategory ? (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500">Ícono de categoría principal (opcional)</label>
                      <input
                        value={catIconImageUrl.startsWith("data:image/") ? "" : catIconImageUrl}
                        onChange={(e) => {
                          setCatIconImageTouched(true);
                          setCatIconImageUrl(e.target.value);
                        }}
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        placeholder="URL de ícono (opcional)"
                      />
                      <input
                        type="file"
                        accept={IMAGE_FILE_ACCEPT}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void fileToUploadAsset(file).then((asset) => {
                            setCatIconImageTouched(true);
                            setCatIconImageUrl(asset.url);
                          }).catch(() => null);
                          e.currentTarget.value = "";
                        }}
                        className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-600"
                      />
                      {catIconImageUrl ? (
                        <div className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={catIconImageUrl} alt="Preview ícono de categoría" className="h-16 w-16 rounded-lg border border-slate-200 object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setCatIconImageTouched(true);
                              setCatIconImageUrl("");
                            }}
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      ) : null}
                      <p className="text-[11px] text-slate-500">
                        Este ícono se muestra junto al nombre en los buscadores de categorías principales.
                      </p>
                      <label className="mt-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Imagen de card principal (opcional)</label>
                      <input
                        value={catCardImageUrl.startsWith("data:image/") ? "" : catCardImageUrl}
                        onChange={(e) => {
                          setCatCardImageTouched(true);
                          setCatCardImageUrl(e.target.value);
                        }}
                        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                        placeholder="URL de imagen para card (opcional)"
                      />
                      <input
                        type="file"
                        accept={IMAGE_FILE_ACCEPT}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void fileToUploadAsset(file).then((asset) => {
                            setCatCardImageTouched(true);
                            setCatCardImageUrl(asset.url);
                          }).catch(() => null);
                          e.currentTarget.value = "";
                        }}
                        className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-600"
                      />
                      {catCardImageUrl ? (
                        <div className="space-y-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={catCardImageUrl} alt="Preview imagen de card principal" className="h-20 w-full rounded-lg border border-slate-200 object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setCatCardImageTouched(true);
                              setCatCardImageUrl("");
                            }}
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      ) : null}
                      <p className="text-[11px] text-slate-500">
                        Esta imagen se usa como fondo en las cards del bloque &quot;Categorías con propósito&quot;.
                      </p>
                    </div>
                  ) : null}

                  {(() => {
                    const block = catBlockId ? filterGroupById.get(catBlockId) : null;
                    const isPriceBlock = block?.key === "price";
                    if (!isPriceBlock || editingCategoryId) return null;
                    return (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Rango de precio para filtros</label>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input
                            value={catPriceMin}
                            onChange={(e) => setCatPriceMin(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="Mínimo"
                            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                          />
                          <input
                            value={catPriceMax}
                            onChange={(e) => setCatPriceMax(e.target.value.replace(/[^0-9]/g, ""))}
                            placeholder="Máximo"
                            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                          />
                        </div>
                        <div className="mt-2">
                          <select value={catPriceCurrency} onChange={(e) => setCatPriceCurrency(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">
                            <option value="ARS">ARS</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="BRL">BRL</option>
                            <option value="JPY">JPY</option>
                            <option value="GBP">GBP</option>
                          </select>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Al crear la categoría, también se agregará una opción de rango de precio y la moneda al bloque &quot;price&quot;.
                        </p>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowCategoryModal(false)} className="h-10 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                    <button type="button" onClick={addCategory} disabled={savingCategory} className="h-10 rounded-xl bg-indigo-500 px-5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">{savingCategory ? "Guardando..." : editingCategoryId ? "Actualizar categoría" : "Crear categoría"}</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold text-slate-900">{editingBlockId ? "Editar título" : "Nuevo título"}</h3>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Título del bloque (multilenguaje)</label>
                    {renderLangTabs(blockLang, setBlockLang)}
                    <input value={blockLabelI18n[blockLang] ?? ""} onChange={(e) => setBlockLabelI18n((prev) => ({ ...prev, [blockLang]: e.target.value }))} className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-indigo-300" placeholder="Título del bloque" />
                    {blockError ? <p className="mt-2 text-xs text-red-500">{blockError}</p> : null}
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Tipo de filtro</label>
                    <select value={blockTaxonomyType} onChange={(e) => setBlockTaxonomyType(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-indigo-300">
                      <option value="categoria">categoria</option>
                      <option value="prestacion">prestacion</option>
                      <option value="idiomas">idiomas</option>
                      <option value="modalidad">modalidad</option>
                      <option value="actividad">actividad</option>
                      <option value="tipos">tipos</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={blockIsPublicVisible} onChange={(e) => setBlockIsPublicVisible(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
                    <span>Visible al público</span>
                  </label>
                  {!editingBlockId ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Categorías iniciales del título</div>
                          <div className="text-xs text-slate-500">Opcional: creá categorías y subcategorías al mismo tiempo que el título.</div>
                        </div>
                        <button type="button" onClick={() => addBlockCategoryDraft("")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">+ Nueva categoría</button>
                      </div>
                      <div className="space-y-3">
                        {blockRootDrafts.map((draft, draftIndex) => {
                          const subDrafts = blockDraftChildrenByParent.get(draft.id) ?? [];
                          return (
                            <div key={draft.id} className="rounded-xl border border-slate-200 bg-white p-3">
                              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                                Categoría {draftIndex + 1}
                              </div>
                              <div className="mb-2">
                                {renderLangTabs(
                                  draft.lang,
                                  (lang) => updateBlockCategoryDraft(draft.id, (prev) => ({ ...prev, lang }))
                                )}
                              </div>
                              <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                                <input
                                  value={draft.nameI18n[draft.lang] ?? ""}
                                  onChange={(e) =>
                                    updateBlockCategoryDraft(draft.id, (prev) => ({
                                      ...prev,
                                      nameI18n: { ...prev.nameI18n, [prev.lang]: e.target.value },
                                    }))
                                  }
                                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                                  placeholder={`Nombre en ${draft.lang.toUpperCase()}`}
                                />
                                <button type="button" onClick={() => removeBlockCategoryDraft(draft.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">Eliminar</button>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={draft.isPublicVisible}
                                    onChange={(e) =>
                                      updateBlockCategoryDraft(draft.id, (prev) => ({ ...prev, isPublicVisible: e.target.checked }))
                                    }
                                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                                  />
                                  Visible al público
                                </label>
                                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={draft.isPrimaryCategory}
                                    onChange={(e) =>
                                      updateBlockCategoryDraft(draft.id, (prev) => ({ ...prev, isPrimaryCategory: e.target.checked }))
                                    }
                                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                                  />
                                  Visible en la tarjeta
                                </label>
                              </div>
                              {draft.isPrimaryCategory ? (
                                <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Ícono de categoría principal (opcional)</label>
                                  <input
                                    value={draft.iconImageUrl}
                                    onChange={(e) =>
                                      updateBlockCategoryDraft(draft.id, (prev) => ({ ...prev, iconImageUrl: e.target.value }))
                                    }
                                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                    placeholder="URL del ícono"
                                  />
                                  <input
                                    type="file"
                                    accept={IMAGE_FILE_ACCEPT}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      void fileToUploadAsset(file).then((asset) =>
                                        updateBlockCategoryDraft(draft.id, (prev) => ({
                                          ...prev,
                                          iconImageUrl: asset.url,
                                        }))
                                      ).catch(() => null);
                                      e.currentTarget.value = "";
                                    }}
                                    className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-600"
                                  />
                                  {draft.iconImageUrl ? (
                                    <div className="flex items-center gap-2">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={draft.iconImageUrl} alt="Preview ícono categoría principal" className="h-10 w-10 rounded border border-slate-200 object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => updateBlockCategoryDraft(draft.id, (prev) => ({ ...prev, iconImageUrl: "" }))}
                                        className="rounded-lg border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  ) : null}
                                  <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Imagen de card principal (opcional)</label>
                                  <input
                                    value={draft.cardImageUrl}
                                    onChange={(e) =>
                                      updateBlockCategoryDraft(draft.id, (prev) => ({ ...prev, cardImageUrl: e.target.value }))
                                    }
                                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                    placeholder="URL de imagen de card"
                                  />
                                  <input
                                    type="file"
                                    accept={IMAGE_FILE_ACCEPT}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      void fileToUploadAsset(file).then((asset) =>
                                        updateBlockCategoryDraft(draft.id, (prev) => ({
                                          ...prev,
                                          cardImageUrl: asset.url,
                                        }))
                                      ).catch(() => null);
                                      e.currentTarget.value = "";
                                    }}
                                    className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-600"
                                  />
                                  {draft.cardImageUrl ? (
                                    <div className="space-y-2">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={draft.cardImageUrl} alt="Preview imagen card principal" className="h-16 w-full rounded border border-slate-200 object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => updateBlockCategoryDraft(draft.id, (prev) => ({ ...prev, cardImageUrl: "" }))}
                                        className="rounded-lg border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                                      >
                                        Eliminar
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => addBlockCategoryDraft(draft.id)}
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  + Subcategoría
                                </button>
                              </div>
                              <div className="mt-2">
                                <select
                                  value={draft.taxonomyType}
                                  onChange={(e) =>
                                    updateBlockCategoryDraft(draft.id, (prev) => ({ ...prev, taxonomyType: e.target.value }))
                                  }
                                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                >
                                  <option value="inherit">Predeterminado (hereda tipo de filtro del padre o del bloque)</option>
                                  <option value="categoria">categoria</option>
                                  <option value="prestacion">prestacion</option>
                                  <option value="idiomas">idiomas</option>
                                  <option value="modalidad">modalidad</option>
                                  <option value="actividad">actividad</option>
                                  <option value="tipos">tipos</option>
                                </select>
                              </div>

                              {subDrafts.length ? (
                                <div className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                  {subDrafts.map((subDraft, subIndex) => (
                                    <div key={subDraft.id} className="rounded-lg border border-slate-200 bg-white p-2">
                                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                                        Subcategoría {draftIndex + 1}.{subIndex + 1}
                                      </div>
                                      <div className="mb-2">
                                        {renderLangTabs(
                                          subDraft.lang,
                                          (lang) => updateBlockCategoryDraft(subDraft.id, (prev) => ({ ...prev, lang }))
                                        )}
                                      </div>
                                      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                                        <input
                                          value={subDraft.nameI18n[subDraft.lang] ?? ""}
                                          onChange={(e) =>
                                            updateBlockCategoryDraft(subDraft.id, (prev) => ({
                                              ...prev,
                                              nameI18n: { ...prev.nameI18n, [prev.lang]: e.target.value },
                                            }))
                                          }
                                          className="h-9 rounded-lg border border-slate-200 px-3 text-sm"
                                          placeholder={`Nombre en ${subDraft.lang.toUpperCase()}`}
                                        />
                                        <button type="button" onClick={() => removeBlockCategoryDraft(subDraft.id)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">Eliminar</button>
                                      </div>
                                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                        <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                                          <input
                                            type="checkbox"
                                            checked={subDraft.isPublicVisible}
                                            onChange={(e) =>
                                              updateBlockCategoryDraft(subDraft.id, (prev) => ({ ...prev, isPublicVisible: e.target.checked }))
                                            }
                                            className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                                          />
                                          Visible al público
                                        </label>
                                        <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                                          <input
                                            type="checkbox"
                                            checked={subDraft.isPrimaryCategory}
                                            onChange={(e) =>
                                              updateBlockCategoryDraft(subDraft.id, (prev) => ({ ...prev, isPrimaryCategory: e.target.checked }))
                                            }
                                            className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                                          />
                                          Visible en la tarjeta
                                        </label>
                                      </div>
                                      {subDraft.isPrimaryCategory ? (
                                        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Ícono de categoría principal (opcional)</label>
                                          <input
                                            value={subDraft.iconImageUrl}
                                            onChange={(e) =>
                                              updateBlockCategoryDraft(subDraft.id, (prev) => ({ ...prev, iconImageUrl: e.target.value }))
                                            }
                                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                            placeholder="URL del ícono"
                                          />
                                          <input
                                            type="file"
                                            accept={IMAGE_FILE_ACCEPT}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;
                                              void fileToUploadAsset(file).then((asset) =>
                                                updateBlockCategoryDraft(subDraft.id, (prev) => ({
                                                  ...prev,
                                                  iconImageUrl: asset.url,
                                                }))
                                              ).catch(() => null);
                                              e.currentTarget.value = "";
                                            }}
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-600"
                                          />
                                          {subDraft.iconImageUrl ? (
                                            <div className="flex items-center gap-2">
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img src={subDraft.iconImageUrl} alt="Preview ícono subcategoría principal" className="h-10 w-10 rounded border border-slate-200 object-cover" />
                                              <button
                                                type="button"
                                                onClick={() => updateBlockCategoryDraft(subDraft.id, (prev) => ({ ...prev, iconImageUrl: "" }))}
                                                className="rounded-lg border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                                              >
                                                Eliminar
                                              </button>
                                            </div>
                                          ) : null}
                                          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">Imagen de card principal (opcional)</label>
                                          <input
                                            value={subDraft.cardImageUrl}
                                            onChange={(e) =>
                                              updateBlockCategoryDraft(subDraft.id, (prev) => ({ ...prev, cardImageUrl: e.target.value }))
                                            }
                                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                            placeholder="URL de imagen de card"
                                          />
                                          <input
                                            type="file"
                                            accept={IMAGE_FILE_ACCEPT}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;
                                              void fileToUploadAsset(file).then((asset) =>
                                                updateBlockCategoryDraft(subDraft.id, (prev) => ({
                                                  ...prev,
                                                  cardImageUrl: asset.url,
                                                }))
                                              ).catch(() => null);
                                              e.currentTarget.value = "";
                                            }}
                                            className="block w-full text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs file:font-semibold file:text-slate-600"
                                          />
                                          {subDraft.cardImageUrl ? (
                                            <div className="space-y-2">
                                              {/* eslint-disable-next-line @next/next/no-img-element */}
                                              <img src={subDraft.cardImageUrl} alt="Preview imagen card subcategoría principal" className="h-16 w-full rounded border border-slate-200 object-cover" />
                                              <button
                                                type="button"
                                                onClick={() => updateBlockCategoryDraft(subDraft.id, (prev) => ({ ...prev, cardImageUrl: "" }))}
                                                className="rounded-lg border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                                              >
                                                Eliminar
                                              </button>
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : null}
                                      <div className="mt-2">
                                        <select
                                          value={subDraft.taxonomyType}
                                          onChange={(e) =>
                                            updateBlockCategoryDraft(subDraft.id, (prev) => ({ ...prev, taxonomyType: e.target.value }))
                                          }
                                          className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm"
                                        >
                                          <option value="inherit">Predeterminado</option>
                                          <option value="categoria">categoria</option>
                                          <option value="prestacion">prestacion</option>
                                          <option value="idiomas">idiomas</option>
                                          <option value="modalidad">modalidad</option>
                                          <option value="actividad">actividad</option>
                                          <option value="tipos">tipos</option>
                                        </select>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                        {!blockCategoryDrafts.length ? (
                          <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500">
                            Sin categorías iniciales. Podés crearlas luego con <b>+ Nueva categoría</b>.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowCategoryModal(false)} className="h-10 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                    <button type="button" onClick={saveBlockFromModal} disabled={savingFilterGroup} className="h-10 rounded-xl bg-indigo-500 px-5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">{savingFilterGroup ? "Guardando..." : editingBlockId ? "Actualizar bloque" : "Crear bloque"}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>
      </div>
      ) : null}

      {/* Publicaciones */}
      {isPublicationsSection ? (
      <section ref={publicationsTopRef} className="overflow-x-hidden rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
        <details open className="group">
          <summary className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-transparent px-1 py-1 transition hover:border-slate-100 hover:bg-slate-50">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Publicaciones</h2>
              <p className="mt-2 text-sm text-slate-600">
                Las publicaciones aparecen en <b>/buscar</b> y se filtran con múltiples selecciones por bloque.
              </p>
            </div>
            <span className="mt-2 text-sm font-semibold text-[#00A9C6] transition group-open:rotate-180">▾</span>
          </summary>

          {(showPublicationEditor || isNewPublicationPage) ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-semibold text-slate-900">{editingId ? "Editar publicación" : "Nueva publicación"}</h3>
              <button type="button" onClick={() => (isNewPublicationPage ? router.push("/admin?section=publicaciones") : setShowPublicationEditor(false))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Cerrar</button>
            </div>
          <div className="grid gap-5 rounded-2xl bg-slate-50/60 p-3 sm:p-5">
          <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <label className="text-sm font-medium text-slate-700">Idioma de edición</label>
            {renderLangTabs(pLang, setEditingLang)}
            <p className="text-xs text-slate-500">
              Cambia el idioma de todos los campos de texto traducibles (título, descripciones y textos). No modifica nombres propios, URLs ni valores numéricos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPEditorMode("publicacion")} className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold sm:flex-none ${pEditorMode === "publicacion" ? "bg-[#4F46E5] text-white" : "border border-slate-200 bg-white text-slate-700"}`}>Publicación</button>
            <button type="button" onClick={() => { setPEditorMode("prestacion"); if (!pPrestacionResources.length) setPPrestacionResources([createEmptyPrestacionResource()]); if (!pPrestacionSteps.length) setPPrestacionSteps([createEmptyPrestacionStep()]); if (!pPrestacionFaqs.length) setPPrestacionFaqs([createEmptyPrestacionFaq()]); if (!pPrestacionColorBlocks.length) setPPrestacionColorBlocks([createEmptyPrestacionColorBlock()]); }} className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold sm:flex-none ${pEditorMode === "prestacion" ? "bg-[#4F46E5] text-white" : "border border-slate-200 bg-white text-slate-700"}`}>Prestaciones</button>
          </div>
<div className="contents min-w-0">
          {pEditorMode !== "prestacion" ? (
          <>
          <div className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="text-sm font-semibold text-slate-900">Información del oferente</div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Nombre del oferente (aprobado)</label>
              <input
                value={pApprovedProviderSearch}
                onChange={(e) => setPApprovedProviderSearch(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                placeholder="Buscar oferente por nombre o email..."
              />
              <select
                value=""
                onChange={(e) => applyOferenteToPublication(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
              >
                <option value="">Seleccionar oferente aprobado</option>
                {filteredApprovedOferentes.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name ? `${service.name} (email: ${service.email})` : service.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Nombre del oferente</label>
                <input
                  value={pPublisherName}
                  onChange={(e) => setPPublisherName(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="Ej: Ana Pérez"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Descripción del oferente</label>
              <RichTextEditor
                value={pProviderInfoI18n[pLang] ?? ""}
                onChange={(next) => setPProviderInfoI18n((prev) => ({ ...prev, [pLang]: next }))}
                placeholder="Texto visible en el detalle de la publicación..."
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Logo del oferente (URL o archivo)</label>
                <input
                  value={pProviderLogo}
                  onChange={(e) => setPProviderLogo(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="https://..."
                />
                <input
                  type="file"
                  accept={IMAGE_FILE_ACCEPT}
                  onChange={(e) => handleProviderLogoUpload(e.target.files?.[0] ?? null)}
                  className="w-full min-w-0 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#00A9C6]/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#007D92] hover:file:bg-[#00A9C6]/20"
                />
                {pProviderLogo ? (
                  <div className="h-14 w-14 overflow-hidden rounded-full border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pProviderLogo} alt="Logo del oferente" className="h-full w-full object-cover" />
                  </div>
                ) : null}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Inicio de actividad (año)</label>
                <input
                  value={pProviderStartYear}
                  onChange={(e) => setPProviderStartYear(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="2010"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Valoración (0 a 5)</label>
                <input
                  value={pProviderRating}
                  onChange={(e) => setPProviderRating(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="4.5"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Cantidad de comentarios</label>
                <input
                  value={pProviderReviewCount}
                  onChange={(e) => setPProviderReviewCount(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="200"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Link a comentarios</label>
                <input
                  value={pProviderCommentsUrl}
                  onChange={(e) => setPProviderCommentsUrl(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="https://..."
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Actividad</label>
                {renderTaxonomyTypeDropdown(
                  "actividad",
                  actividadRoots,
                  pProviderActivities,
                  (value, checked) =>
                    setPProviderActivities((prev) =>
                      checked ? Array.from(new Set([...prev, value])) : prev.filter((v) => v !== value)
                    ),
                  "No hay categorías con tipo de filtro actividad.",
                  "Seleccionar actividades"
                )}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Tipo</label>
                {renderTaxonomyTypeDropdown(
                  "tipo",
                  tipoRoots,
                  pProviderTypes,
                  (value, checked) =>
                    setPProviderTypes((prev) =>
                      checked ? Array.from(new Set([...prev, value])) : prev.filter((v) => v !== value)
                    ),
                  "No hay categorías con tipo de filtro tipo.",
                  "Seleccionar tipos"
                )}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Modalidad en que ofrece sus servicios</div>
              <div className="mt-1 text-xs text-slate-500">Marcá una o más modalidades (categorías con tipo de filtro modalidad).</div>
              {renderTaxonomyTypeDropdown(
                "modalidad",
                modalidadRoots,
                pProviderModalities,
                (value, checked) =>
                  setPProviderModalities((prev) =>
                    checked ? Array.from(new Set([...prev, value])) : prev.filter((v) => v !== value)
                  ),
                "No hay categorías con tipo de filtro modalidad."
              )}
            </div>

          </div>

          <div className="grid min-w-0 gap-4 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="text-sm font-semibold text-slate-900">Propuesta o publicación</div>

          <div className="grid gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Categorías y sub-categorías</div>
              <div className="mt-1 text-xs text-slate-500">Seleccioná categoría y subcategoría desde un único selector integrado.</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setOpenPublicationPanel((prev) => (prev === "category" ? null : "category"))}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Categoría + subcategoría
                  {openPublicationPanel === "category" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
              {openPublicationPanel ? <div className="mt-3">{renderCategorySelection(openPublicationPanel)}</div> : null}
              {(pCategorySelections.length || pSubcategorySelections.length) ? (
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Seleccionado</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">
                    {pCategorySelections.length ? (
                      <div>
                        <span className="font-semibold">Categorías:</span> {pCategorySelections.join(", ")}
                      </div>
                    ) : null}
                    {pSubcategorySelections.length ? (
                      <div>
                        <span className="font-semibold">Subcategorías:</span> {pSubcategorySelections.join(", ")}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">Añadir prestaciones</div>
              <div className="mt-1 text-xs text-slate-500">Seleccioná prestaciones (categorías con tipo de filtro prestación).</div>
              {renderTaxonomyTypeDropdown(
                "prestacion",
                prestacionRoots,
                pPrestaciones,
                (value, checked) =>
                  setPPrestaciones((prev) =>
                    checked ? Array.from(new Set([...prev, value])) : prev.filter((v) => v !== value)
                  ),
                "No hay categorías con tipo de filtro prestación."
              )}
            </div>

            <div className="flex flex-wrap items-center gap-5">
              <input
                id="featured"
                type="checkbox"
                checked={pFeatured}
                onChange={(e) => setPFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#00A9C6]"
              />
              <label htmlFor="featured" className="text-sm font-medium text-slate-700">
                Destacado
              </label>
              <input
                id="partner"
                type="checkbox"
                checked={pPartner}
                onChange={(e) => setPPartner(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-cyan-600"
              />
              <label htmlFor="partner" className="text-sm font-medium text-slate-700">
                🤝 Partner
              </label>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Estado</label>
                <select
                  value={pStatus}
                  onChange={(e) => setPStatus(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                >
                  <option value="active">Activo</option>
                  <option value="draft">Borrador</option>
                  <option value="paused">Pausado</option>
                  <option value="hidden">Oculto</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Título de la publicación</label>
                <input
                  value={pTitleI18n[pLang] ?? ""}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPTitleI18n((prev) => ({ ...prev, [pLang]: next }));
                    if (pLang === "es") setPTitle(next);
                  }}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="Ej: Acompañamos tu registro..."
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Descripción</label>
              <RichTextEditor
                value={pDescriptionI18n[pLang] ?? ""}
                onChange={(next) => {
                  setPDescriptionI18n((prev) => ({ ...prev, [pLang]: next }));
                  if (pLang === "es") setPDescription(next);
                }}
                placeholder="Texto de la publicación..."
              />
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Descripción opcional</div>
                <button
                  type="button"
                  onClick={() =>
                    setPExtraDescriptions((prev) => [
                      ...prev,
                      { title: "", body: "", titleI18n: { es: "" }, bodyI18n: { es: "" }, lang: "es", visibleInCard: false },
                    ])
                  }
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  + Agregar bloque
                </button>
              </div>

              {pExtraDescriptions.length ? (
                <div className="grid gap-3">
                  {pExtraDescriptions.map((desc, idx) => (
                    <div key={`extra-${idx}`} className="grid gap-2 rounded-xl border border-slate-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold uppercase text-slate-500">Bloque {idx + 1}</div>
                        <button
                          type="button"
                          onClick={() =>
                            setPExtraDescriptions((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Eliminar
                        </button>
                      </div>
                      <input
                        value={desc.titleI18n[pLang] ?? ""}
                        onChange={(e) =>
                          setPExtraDescriptions((prev) =>
                            prev.map((d, i) =>
                              i === idx
                                ? {
                                    ...d,
                                    titleI18n: { ...d.titleI18n, [pLang]: e.target.value },
                                    title: pLang === "es" ? e.target.value : d.title,
                                  }
                                : d
                            )
                          )
                        }
                        className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                        placeholder="Título del bloque"
                      />
                      <RichTextEditor
                        value={desc.bodyI18n[pLang] ?? ""}
                        onChange={(next) =>
                          setPExtraDescriptions((prev) =>
                            prev.map((d, i) =>
                              i === idx
                                ? {
                                    ...d,
                                    bodyI18n: { ...d.bodyI18n, [pLang]: next },
                                    body: pLang === "es" ? next : d.body,
                                  }
                                : d
                            )
                          )
                        }
                        placeholder="Descripción adicional..."
                        minHeightClassName="min-h-[80px]"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Podés agregar más bloques de descripción con un título propio.
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">País (destino del viaje)</label>
                <CountryMultiSelect
                  label="Seleccionar país destino"
                  showLabel={false}
                  selectionMode="single"
                  compact
                  selectedSingle={pCountry}
                  onSingleChange={setPCountry}
                  placeholder="Seleccioná un país destino."
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Ciudad (destino del viaje)</label>
                <input
                  value={pCity}
                  onChange={(e) => setPCity(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="Ciudad de Mendoza"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Ubicación de Google Maps (URL)</label>
                <input
                  value={pLocationAddress}
                  onChange={(e) => setPLocationAddress(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="https://maps.google.com/..."
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Moneda principal</label>
                <select
                  value={pCurrency}
                  onChange={(e) => setPCurrency(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="BRL">BRL</option>
                  <option value="CLP">CLP</option>
                  <option value="COP">COP</option>
                  <option value="MXN">MXN</option>
                  <option value="PEN">PEN</option>
                  <option value="UYU">UYU</option>
                  <option value="JPY">JPY</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Precio</label>
                <input
                  value={pPrice}
                  onChange={(e) => setPPrice(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="150000"
                  disabled={/^precio a convenir$/i.test(String(pPrice).trim())}
                />
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={/^precio a convenir$/i.test(String(pPrice).trim())}
                    onChange={(e) => setPPrice(e.target.checked ? "Precio a convenir" : "")}
                    className="h-4 w-4 rounded border-slate-300 text-[#00A9C6]"
                  />
                  Precio a convenir
                </label>
                {/^precio a convenir$/i.test(String(pPrice).trim()) ? (
                  <input
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    className="h-9 rounded-xl border border-slate-200 px-3 text-xs outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                    placeholder="Texto para mostrar cuando no hay precio"
                  />
                ) : null}
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Periodo de precio</label>
                <select
                  value={pPricePeriod}
                  onChange={(e) => setPPricePeriod(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                >
                  <option value="">Sin período</option>
                  <option value="month">por mes</option>
                  <option value="week">por semana</option>
                  <option value="day">por día</option>
                  <option value="year">por año</option>
                  <option value="once">único</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Precios por moneda</label>
              <div className="space-y-2">
                {pExtraPrices.length ? (
                  pExtraPrices.map((entry, idx) => (
                    <div key={`price-${idx}`} className="flex flex-wrap items-center gap-2">
                      <select
                        value={entry.currency}
                        onChange={(e) =>
                          setPExtraPrices((prev) =>
                            prev.map((item, index) =>
                              index === idx ? { ...item, currency: e.target.value } : item
                            )
                          )
                        }
                        className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                      >
                        <option value="">Moneda</option>
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="BRL">BRL</option>
                        <option value="CLP">CLP</option>
                        <option value="COP">COP</option>
                        <option value="MXN">MXN</option>
                        <option value="PEN">PEN</option>
                        <option value="UYU">UYU</option>
                        <option value="JPY">JPY</option>
                      </select>
                      <input
                        value={entry.amount}
                        onChange={(e) =>
                          setPExtraPrices((prev) =>
                            prev.map((item, index) =>
                              index === idx ? { ...item, amount: e.target.value } : item
                            )
                          )
                        }
                        className="h-10 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                        placeholder="Monto"
                      />
                      <button
                        type="button"
                        onClick={() => setPExtraPrices((prev) => prev.filter((_, index) => index !== idx))}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Quitar
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500">Sumá precios adicionales por moneda.</div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPExtraPrices((prev) => [...prev, { currency: "", amount: "" }])}
                className="mt-2 w-fit rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                + Agregar precio
              </button>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Sedes del oferente y filtro por pasaporte</div>
            <div className="grid gap-3 rounded-xl border border-slate-100 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Sede principal del oferente</div>
              <div className="grid gap-2 md:grid-cols-3">
                <CountryMultiSelect
                  label="País de la sede"
                  showLabel={false}
                  selectionMode="single"
                  compact
                  selectedSingle={pHeadquarterCountry}
                  onSingleChange={setPHeadquarterCountry}
                  placeholder="País de la sede"
                />
                <input
                  value={pHeadquarterCity}
                  onChange={(e) => setPHeadquarterCity(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="Ciudad de la sede"
                />
                <input
                  value={pHeadquarterMapUrl}
                  onChange={(e) => setPHeadquarterMapUrl(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  placeholder="Link de Google Maps (opcional)"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase text-slate-500">Sedes adicionales</div>
                <button
                  type="button"
                  onClick={() => setPHeadquarterExtras((prev) => [...prev, { country: "", city: "", mapUrl: "" }])}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  + Agregar sede
                </button>
              </div>
              {pHeadquarterExtras.length ? (
                <div className="space-y-2">
                  {pHeadquarterExtras.map((loc, idx) => (
                    <div key={`hq-${idx}`} className="grid gap-2 md:grid-cols-3">
                      <CountryMultiSelect
                        label={`País sede adicional ${idx + 1}`}
                        showLabel={false}
                        selectionMode="single"
                        compact
                        selectedSingle={loc.country}
                        onSingleChange={(nextCountry) =>
                          setPHeadquarterExtras((prev) =>
                            prev.map((item, index) =>
                              index === idx ? { ...item, country: nextCountry } : item
                            )
                          )
                        }
                        placeholder="País de la sede"
                      />
                      <input
                        value={loc.city}
                        onChange={(e) =>
                          setPHeadquarterExtras((prev) =>
                            prev.map((item, index) =>
                              index === idx ? { ...item, city: e.target.value } : item
                            )
                          )
                        }
                        className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                        placeholder="Ciudad de la sede"
                      />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <input
                          value={loc.mapUrl}
                          onChange={(e) =>
                            setPHeadquarterExtras((prev) =>
                              prev.map((item, index) =>
                                index === idx ? { ...item, mapUrl: e.target.value } : item
                              )
                            )
                          }
                          className="h-10 flex-1 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                          placeholder="Link de Google Maps (opcional)"
                        />
                        <button
                          type="button"
                          onClick={() => setPHeadquarterExtras((prev) => prev.filter((_, index) => index !== idx))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">Podés sumar más sedes si aplica.</div>
              )}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Filtro por pasaporte</label>
              <select
                value={pReceivingCountriesMode}
                onChange={(e) => setPReceivingCountriesMode(e.target.value as "all" | "only" | "except")}
                className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
              >
                <option value="all">Recibe viajeros de todos los países</option>
                <option value="only">Recibe solo los países seleccionados</option>
                <option value="except">Recibe todos los países excepto los seleccionados</option>
              </select>
            </div>

            {pReceivingCountriesMode === "all" ? (
              <div className="text-xs text-slate-500">No se aplican restricciones por pasaporte.</div>
            ) : (
              <CountryMultiSelect
                label={
                  pReceivingCountriesMode === "except"
                    ? "Países que NO recibe"
                    : "Países que recibe"
                }
                selected={pReceivingCountries}
                onChange={setPReceivingCountries}
                placeholder="Seleccioná países para aplicar el filtro."
              />
            )}

          </div>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Idiomas que se hablan</label>
              {renderTaxonomyTypeDropdown(
                "idiomas",
                idiomaRoots,
                pLanguages.split(",").map((v) => v.trim()).filter(Boolean),
                (value, checked) => {
                  const current = pLanguages.split(",").map((v) => v.trim()).filter(Boolean);
                  const next = checked
                    ? Array.from(new Set([...current, value]))
                    : current.filter((v) => v !== value);
                  setPLanguages(next.join(", "));
                },
                "No hay categorías con tipo de filtro idiomas."
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Fecha y hora de expiración</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="date"
                  value={pExpirationDate}
                  onChange={(e) => setPExpirationDate(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                />
                <input
                  type="time"
                  value={pExpirationTime}
                  onChange={(e) => setPExpirationTime(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  step={60}
                />
              </div>
              <p className="text-xs text-slate-500">La hora es opcional.</p>
            </div>
            <div className="grid gap-2 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Página web</label>
              <input
                value={pWebsite}
                onChange={(e) => setPWebsite(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                placeholder="https://"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium text-slate-700">Imágenes (URLs o subida directa)</label>
            <textarea
              value={pImageUrls}
              onChange={(e) => setPImageUrls(e.target.value)}
              className="min-h-[70px] rounded-xl border border-slate-200 p-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
              placeholder="https://... \nhttps://..."
            />
            <input
              type="file"
              accept={IMAGE_FILE_ACCEPT}
              multiple
              onChange={(e) => handleImageUpload(e.target.files)}
              className="w-full min-w-0 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#00A9C6]/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#007D92] hover:file:bg-[#00A9C6]/20"
            />
            {imageList.length ? (
              <div className="grid gap-3 md:grid-cols-4">
                {imageList.map((img, idx) => (
                  <div key={`${img}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-2">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
                      <button
                        type="button"
                        onClick={() => removeImage(img)}
                        className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs font-semibold text-slate-600 shadow"
                        aria-label="Quitar imagen"
                      >
                        ×
                      </button>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`preview-${idx}`} className="h-full w-full object-cover" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">Redes sociales y contacto</div>
            <div className="space-y-3">
              {pSocialLinksDetailed.map((entry, idx) => (
                <div key={`link-${idx}`} className="grid gap-2 md:grid-cols-[minmax(120px,180px)_1fr_1fr_auto] items-center">
                  <select
                    value={entry.kind}
                    onChange={(e) =>
                      setPSocialLinksDetailed((prev) =>
                        prev.map((item, index) =>
                          index === idx ? { ...item, kind: e.target.value } : item
                        )
                      )
                    }
                    className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                  >
                    {linkKindOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={entry.label}
                    onChange={(e) =>
                      setPSocialLinksDetailed((prev) =>
                        prev.map((item, index) =>
                          index === idx ? { ...item, label: e.target.value } : item
                        )
                      )
                    }
                    className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                    placeholder="Renombre del link (opcional)"
                  />
                  <input
                    value={entry.url}
                    onChange={(e) =>
                      setPSocialLinksDetailed((prev) =>
                        prev.map((item, index) =>
                          index === idx ? { ...item, url: e.target.value } : item
                        )
                      )
                    }
                    className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                    placeholder="Link o email"
                  />
                  <button
                    type="button"
                    onClick={() => setPSocialLinksDetailed((prev) => prev.filter((_, index) => index !== idx))}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Quitar
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setPSocialLinksDetailed((prev) => [
                    ...prev,
                    { kind: "web", label: "", url: "" },
                  ])
                }
                className="w-fit rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              >
                + Agregar link
              </button>
            </div>
          </div>

          </div>

          </>
          ) : null}

          {pEditorMode === "prestacion" ? (
            <div className="grid gap-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Prestación vinculada a la publicación</div>
                <p className="mt-1 text-xs text-slate-500">Elegí a qué categoría con tipo de filtro prestación pertenece esta publicación.</p>
                <div className="mt-3 grid gap-2">
                  <label className="text-xs font-medium text-slate-500">Seleccionar prestación</label>
                  <select
                    value={pPrestacionCategory}
                    onChange={(e) => {
                      const next = e.target.value;
                      setPPrestacionCategory(next);
                      setPPrestaciones(next ? [next] : []);
                    }}
                    className="h-10 rounded-xl border border-slate-200 px-3"
                  >
                    <option value="">Seleccionar prestación</option>
                    {prestacionRoots.map((opt) => (
                      <option key={`prestation-category-${opt.id}`} value={opt.description}>{pickI18nText(opt.descriptionI18n ?? null, pLang, opt.description)}</option>
                    ))}
                  </select>
                  {!prestacionRoots.length ? <div className="text-xs text-slate-500">No hay categorías con tipo de filtro prestación.</div> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Elegir la Categorías o sub-categorías vinculada con la publicacion</div>
                <p className="mt-1 text-xs text-slate-500">Seleccioná categorías y subcategorías relacionadas. Se muestran todas excepto las de tipo prestación.</p>
                <button
                  type="button"
                  onClick={() => setOpenPublicationPanel((prev) => (prev === "category" ? null : "category"))}
                  className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <span>{pCategorySelections.length || pSubcategorySelections.length ? "Editar categorías vinculadas" : "Seleccionar categorías vinculadas"}</span>
                  {openPublicationPanel === "category" ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                {openPublicationPanel ? <div className="mt-3">{renderCategorySelection(openPublicationPanel)}</div> : null}
                {(pCategorySelections.length || pSubcategorySelections.length) ? (
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Vinculado</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      {pCategorySelections.length ? (
                        <div>
                          <span className="font-semibold">Categorías:</span> {pCategorySelections.join(", ")}
                        </div>
                      ) : null}
                      {pSubcategorySelections.length ? (
                        <div>
                          <span className="font-semibold">Subcategorías:</span> {pSubcategorySelections.join(", ")}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Lugar de destino (visibilidad)</div>
                <p className="mt-1 text-xs text-slate-500">Seleccioná uno o más países en los que querés mostrar esta prestación en /buscar.</p>
                <div className="mt-3">
                  <CountryMultiSelect
                    label="Países donde se muestra"
                    selected={pPrestacionDestinationCountries}
                    onChange={setPPrestacionDestinationCountries}
                    placeholder="Seleccioná países destino"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Hero de la prestación</div>
                <p className="mt-1 text-xs text-slate-500">Podés usar una imagen personalizada para el hero del detalle, con título y subtítulo traducibles.</p>
                <div className="mt-3 grid gap-2">
                  <input value={getLangEditValue(pPrestacionHeroTitleI18n, pLang)} onChange={(e) => {
                    const next = e.target.value;
                    setPPrestacionHeroTitleI18n((prev) => setLangText(prev.es ?? "", prev, pLang, next));
                    setPTitleI18n((prev) => setLangText(prev.es ?? "", prev, pLang, next));
                    if (pLang === "es") setPTitle(next);
                  }} className="h-10 rounded-xl border border-slate-200 px-3" placeholder="Título del hero" />
                  <RichTextEditor value={getLangEditValue(pPrestacionHeroSubtitleI18n, pLang)} onChange={(next) => setPPrestacionHeroSubtitleI18n((prev) => setLangText(prev.es ?? "", prev, pLang, next))} placeholder="Subtítulo del hero" minHeightClassName="min-h-[80px]" />
                  <input value={getLangMediaValue(pPrestacionHeroImageI18n, pLang, pPrestacionHeroImage)} onChange={(e) => setPPrestacionHeroImageI18n((prev) => setLangText(prev.es ?? "", prev, pLang, e.target.value))} className="h-10 rounded-xl border border-slate-200 px-3" placeholder="URL de imagen del hero (opcional)" />
                  <input type="file" accept={IMAGE_FILE_ACCEPT} onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    void fileToUploadAsset(file).then((asset) => setPPrestacionHeroImageI18n((prev) => setLangText(prev.es ?? "", prev, pLang, asset.url))).catch(() => null);
                  }} className="w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#00A9C6]/10 file:px-3 file:py-1.5 file:font-semibold file:text-[#007D92]" />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Bloques informativos bajo hero</div>
                <p className="mt-1 text-xs text-slate-500">Estos bloques se muestran justo debajo del hero en el detalle y son traducibles.</p>
                <div className="mt-3 space-y-3">
                  {pPrestacionHeroInfoBlocks.map((block, idx) => (
                    <div key={`hero-info-${idx}`} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Bloque #{idx + 1}</span><button type="button" className="text-red-500" onClick={() => setPPrestacionHeroInfoBlocks((prev) => prev.length <= 1 ? [createEmptyPrestacionHeroInfoBlock()] : prev.filter((_, i) => i !== idx))}>×</button></div>
                      <input value={getLangEditValue(block.titleI18n, pLang)} onChange={(e) => setPPrestacionHeroInfoBlocks((prev) => prev.map((it, i) => i === idx ? { ...it, title: pLang === "es" ? e.target.value : it.title, titleI18n: setLangText(it.title, it.titleI18n, pLang, e.target.value) } : it))} className="h-10 rounded-xl border border-slate-200 px-3" placeholder="Título del bloque" />
                      <RichTextEditor value={getLangEditValue(block.textI18n, pLang)} onChange={(next) => setPPrestacionHeroInfoBlocks((prev) => prev.map((it, i) => i === idx ? { ...it, text: pLang === "es" ? next : it.text, textI18n: setLangText(it.text, it.textI18n, pLang, next) } : it))} placeholder="Texto del bloque" minHeightClassName="min-h-[70px]" />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input type="color" value={block.bgColor} onChange={(e) => setPPrestacionHeroInfoBlocks((prev) => prev.map((it, i) => i === idx ? { ...it, bgColor: e.target.value } : it))} className="h-9 w-12 rounded border border-slate-200" />
                        <input type="color" value={block.textColor} onChange={(e) => setPPrestacionHeroInfoBlocks((prev) => prev.map((it, i) => i === idx ? { ...it, textColor: e.target.value } : it))} className="h-9 w-12 rounded border border-slate-200" />
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setPPrestacionHeroInfoBlocks((prev) => [...prev, createEmptyPrestacionHeroInfoBlock()])} className="mt-3 w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700">+ Agregar bloque informativo</button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">1</span>
                  <div>
                    <div className="text-lg font-semibold text-slate-900">🃏 Tarjetas de Recursos</div>
                    <p className="text-xs text-slate-500">Tarjetas flexibles con título, subtítulo, imagen, ítems check y botones. Cada tarjeta puede tener además un bloque de texto con color.</p>
                    <p className="mt-1 text-[11px] text-slate-400">Estás editando contenidos en idioma: <span className="font-semibold uppercase">{pLang}</span>. En imágenes, podés cargar una por idioma; si no cargás una, se usa la de ES.</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {pPrestacionResources.map((card, idx) => (
                    <div key={`resource-${idx}`} className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tarjeta #{idx + 1}
                        <button type="button" onClick={() => setPPrestacionResources((prev) => prev.length <= 1 ? [createEmptyPrestacionResource()] : prev.filter((_, i) => i !== idx))} className="text-red-500">×</button>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="grid gap-1"><label className="text-xs font-medium text-slate-500">Título</label><input value={getLangEditValue(card.titleI18n, pLang)} onChange={(e) => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, title: pLang === "es" ? e.target.value : it.title, titleI18n: setLangText(it.title, it.titleI18n, pLang, e.target.value) } : it))} className="h-10 rounded-xl border border-slate-200 px-3" placeholder="Ej: Lima Immigration" /></div>
                        {card.title || card.subtitle || card.image || (card.checkItemsI18n ?? []).length || (card.buttons ?? []).length || card.colorNoteTitle || card.colorNoteText ? (
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            {card.image ? <img src={card.image} alt="preview" className="h-28 w-full rounded-lg object-cover" /> : null}
                            {getLangEditValue(card.titleI18n, pLang) ? <div className="mt-2 text-sm font-semibold text-slate-900">{getLangEditValue(card.titleI18n, pLang)}</div> : null}
                            {getLangEditValue(card.subtitleI18n, pLang) ? <div className="mt-1 text-xs text-slate-600">{getLangEditValue(card.subtitleI18n, pLang)}</div> : null}
                            {(card.checkItemsI18n ?? []).length ? (
                              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                                {(card.checkItemsI18n ?? []).slice(0, 3).map((itemI18n, i) => <li key={`prev-check-${idx}-${i}`} className="text-emerald-600">✓ {getLangEditValue(itemI18n, pLang)}</li>)}
                              </ul>
                            ) : null}
                            {(card.colorNoteTitle || card.colorNoteText) ? (
                              <div className="mt-2 rounded-lg p-2 text-xs" style={{ backgroundColor: card.colorNoteBgColor || "#EEF2FF", color: card.colorNoteTextColor || "#1E3A8A" }}>
                                {getLangEditValue(card.colorNoteTitleI18n, pLang) ? <div className="font-semibold">{getLangEditValue(card.colorNoteTitleI18n, pLang)}</div> : null}
                                {getLangEditValue(card.colorNoteTextI18n, pLang) ? <div>{getLangEditValue(card.colorNoteTextI18n, pLang)}</div> : null}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-xl border-2 border-dashed border-slate-200 px-3 py-3 text-center text-xs text-slate-400">Completá los campos para ver la previa</div>
                        )}
                      </div>
                      <div className="mt-2 grid gap-2">
                        <label className="text-xs font-medium text-slate-500">Subtítulo</label><input value={getLangEditValue(card.subtitleI18n, pLang)} onChange={(e) => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, subtitle: pLang === "es" ? e.target.value : it.subtitle, subtitleI18n: setLangText(it.subtitle, it.subtitleI18n, pLang, e.target.value) } : it))} className="h-10 rounded-xl border border-slate-200 px-3" placeholder="Ej: Tu guía de visa personalizada" />
                        <label className="text-xs font-medium text-slate-500">Imagen (URL)</label><input value={getLangMediaValue(card.imageI18n, pLang, card.image)} onChange={(e) => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, image: pLang === "es" ? e.target.value : it.image, imageI18n: setLangText(it.image, it.imageI18n, pLang, e.target.value) } : it))} className="h-10 rounded-xl border border-slate-200 px-3" placeholder="https://..." />
                        <input
                          type="file"
                          accept={IMAGE_FILE_ACCEPT}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            void fileToUploadAsset(file).then((asset) => {
                              setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, image: pLang === "es" ? asset.url : it.image, imageI18n: setLangText(it.image, it.imageI18n, pLang, asset.url) } : it));
                            }).catch(() => null);
                          }}
                          className="w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#00A9C6]/10 file:px-3 file:py-1.5 file:font-semibold file:text-[#007D92]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPPrestacionResources((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? { ...it, image: "", imageI18n: setLangText("", it.imageI18n, pLang, "") }
                                  : it
                              )
                            )
                          }
                          className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600"
                        >
                          Quitar imagen
                        </button>
                      </div>
                      <div className="mt-3">
                        <label className="text-xs font-medium text-slate-500">Ítems con check</label>
                        <div className="mt-1 flex gap-2">
                          <input value={resourceItemDrafts[idx] ?? ""} onChange={(e) => setResourceItemDrafts((prev) => ({ ...prev, [idx]: e.target.value }))} className="h-9 flex-1 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Agregar ítem..." />
                          <button type="button" onClick={() => {
                            const value = (resourceItemDrafts[idx] ?? "").trim();
                            if (!value) return;
                            setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, checkItems: [...(it.checkItems ?? []), pLang === "es" ? value : ""], checkItemsI18n: [...(it.checkItemsI18n ?? []), setLangText("", { es: "" }, pLang, value)] } : it));
                            setResourceItemDrafts((prev) => ({ ...prev, [idx]: "" }));
                          }} className="h-9 w-9 rounded-lg border border-slate-200">+</button>
                        </div>
                        <div className="mt-2 grid gap-2">
                          {(card.checkItemsI18n ?? []).map((itemI18n, itemIdx) => (
                            <div key={`item-${itemIdx}`} className="grid grid-cols-[1fr_auto] gap-2">
                              <input
                                value={getLangEditValue(itemI18n, pLang)}
                                onChange={(e) =>
                                  setPPrestacionResources((prev) =>
                                    prev.map((it, i) => {
                                      if (i !== idx) return it;
                                      const nextI18n = [...(it.checkItemsI18n ?? [])];
                                      const current = nextI18n[itemIdx] ?? { es: it.checkItems?.[itemIdx] ?? "" };
                                      nextI18n[itemIdx] = setLangText(it.checkItems?.[itemIdx] ?? "", current, pLang, e.target.value);
                                      const nextChecks = [...(it.checkItems ?? [])];
                                      if (pLang === "es") nextChecks[itemIdx] = e.target.value;
                                      return { ...it, checkItems: nextChecks, checkItemsI18n: nextI18n };
                                    })
                                  )
                                }
                                className="h-9 rounded-xl border border-slate-200 px-3 text-sm"
                                placeholder={`Ítem con check (${pLang.toUpperCase()})`}
                              />
                              <button type="button" className="h-9 w-9 rounded-lg border border-slate-200 text-red-500" onClick={() => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, checkItems: (it.checkItems ?? []).filter((_, j) => j !== itemIdx), checkItemsI18n: (it.checkItemsI18n ?? []).filter((_, j) => j !== itemIdx) } : it))}>×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 text-xs font-medium text-slate-500">Botones ({(card.buttons ?? []).length}/2)</div><div className="mt-2 grid gap-2 md:grid-cols-[1fr_140px]">
                        <input value={getLangEditValue(resourceButtonDrafts[idx]?.labelI18n, pLang)} onChange={(e) => setResourceButtonDrafts((prev) => ({ ...prev, [idx]: { label: pLang === "es" ? e.target.value : prev[idx]?.label ?? "", labelI18n: setLangText(prev[idx]?.label ?? "", prev[idx]?.labelI18n, pLang, e.target.value), url: prev[idx]?.url ?? "", style: prev[idx]?.style ?? "primary", bgColor: prev[idx]?.bgColor ?? "#2563EB", textColor: prev[idx]?.textColor ?? "#FFFFFF" } }))} className="h-9 rounded-xl border border-slate-200 px-3 text-sm" placeholder={`Texto del botón (${pLang.toUpperCase()})`} />
                        <select value={(resourceButtonDrafts[idx]?.style ?? "primary")} onChange={(e) => setResourceButtonDrafts((prev) => ({ ...prev, [idx]: { label: prev[idx]?.label ?? "", labelI18n: prev[idx]?.labelI18n ?? { es: prev[idx]?.label ?? "" }, url: prev[idx]?.url ?? "", style: e.target.value === "secondary" ? "secondary" : "primary", bgColor: prev[idx]?.bgColor ?? "#2563EB", textColor: prev[idx]?.textColor ?? "#FFFFFF" } }))} className="h-9 rounded-xl border border-slate-200 px-3 text-sm">
                          <option value="primary">Primario</option>
                          <option value="secondary">Secundario</option>
                        </select>
                        <input value={(resourceButtonDrafts[idx]?.url ?? "")} onChange={(e) => setResourceButtonDrafts((prev) => ({ ...prev, [idx]: { label: prev[idx]?.label ?? "", labelI18n: prev[idx]?.labelI18n ?? { es: prev[idx]?.label ?? "" }, url: e.target.value, style: prev[idx]?.style ?? "primary", bgColor: prev[idx]?.bgColor ?? "#2563EB", textColor: prev[idx]?.textColor ?? "#FFFFFF" } }))} className="h-9 rounded-xl border border-slate-200 px-3 text-sm md:col-span-1" placeholder="URL destino (afiliado u otro)" />
                        <button type="button" onClick={() => {
                          const draft = resourceButtonDrafts[idx] ?? { label: "", labelI18n: { es: "" }, url: "", style: "primary" as const, bgColor: "#2563EB", textColor: "#FFFFFF" };
                          const translatedLabel = firstNonEmptyI18n(draft.labelI18n, draft.label);
                          if (!translatedLabel.trim() || !draft.url.trim()) return;
                          if ((card.buttons ?? []).length >= 2) return;
                          setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, buttons: [...(it.buttons ?? []), { label: translatedLabel.trim(), labelI18n: setLangText(draft.label, draft.labelI18n, pLang, translatedLabel.trim()), url: draft.url.trim(), style: draft.style, bgColor: draft.bgColor, textColor: draft.textColor }] } : it));
                          setResourceButtonDrafts((prev) => ({ ...prev, [idx]: { label: "", labelI18n: { es: "" }, url: "", style: "primary", bgColor: "#2563EB", textColor: "#FFFFFF" } }));
                        }} className="h-9 rounded-lg border border-slate-200 text-sm">+</button>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div className="grid gap-1"><label className="text-[11px] text-slate-500">Color botón</label><input type="color" value={(resourceButtonDrafts[idx]?.bgColor ?? "#2563EB")} onChange={(e) => setResourceButtonDrafts((prev) => ({ ...prev, [idx]: { label: prev[idx]?.label ?? "", labelI18n: prev[idx]?.labelI18n ?? { es: prev[idx]?.label ?? "" }, url: prev[idx]?.url ?? "", style: prev[idx]?.style ?? "primary", bgColor: e.target.value, textColor: prev[idx]?.textColor ?? "#FFFFFF" } }))} className="h-9 w-12 rounded border border-slate-200" /></div>
                        <div className="grid gap-1"><label className="text-[11px] text-slate-500">Color texto</label><input type="color" value={(resourceButtonDrafts[idx]?.textColor ?? "#FFFFFF")} onChange={(e) => setResourceButtonDrafts((prev) => ({ ...prev, [idx]: { label: prev[idx]?.label ?? "", labelI18n: prev[idx]?.labelI18n ?? { es: prev[idx]?.label ?? "" }, url: prev[idx]?.url ?? "", style: prev[idx]?.style ?? "primary", bgColor: prev[idx]?.bgColor ?? "#2563EB", textColor: e.target.value } }))} className="h-9 w-12 rounded border border-slate-200" /></div>
                      </div>
                      {(card.buttons ?? []).length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {card.buttons.map((btn, btnIdx) => (
                            <span key={`${getLangEditValue(btn.labelI18n, pLang)}-${btnIdx}`} className="rounded-lg px-2 py-1 text-xs shadow-sm" style={{ backgroundColor: btn.bgColor || (btn.style === "secondary" ? "#FFFFFF" : "#2563EB"), color: btn.textColor || (btn.style === "secondary" ? "#1D4ED8" : "#FFFFFF"), border: btn.style === "secondary" ? "1px solid #C7D2FE" : "1px solid transparent" }}>{getLangEditValue(btn.labelI18n, pLang)}<button type="button" className="ml-2" onClick={() => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, buttons: (it.buttons ?? []).filter((_, j) => j !== btnIdx) } : it))}>×</button></span>
                          ))}
                        </div>
                      ) : null}
                      {(card.buttons ?? []).length ? (
                        <div className="mt-2 grid gap-2">
                          {card.buttons.map((btn, btnIdx) => (
                            <input
                              key={`btn-label-${idx}-${btnIdx}`}
                              value={getLangEditValue(btn.labelI18n, pLang)}
                              onChange={(e) =>
                                setPPrestacionResources((prev) =>
                                  prev.map((it, i) => {
                                    if (i !== idx) return it;
                                    return {
                                      ...it,
                                      buttons: (it.buttons ?? []).map((b, j) =>
                                        j === btnIdx
                                          ? {
                                              ...b,
                                              label: pLang === "es" ? e.target.value : b.label,
                                              labelI18n: setLangText(b.label, b.labelI18n, pLang, e.target.value),
                                            }
                                          : b
                                      ),
                                    };
                                  })
                                )
                              }
                              className="h-9 rounded-xl border border-slate-200 px-3 text-sm"
                              placeholder={`Texto del botón #${btnIdx + 1} (${pLang.toUpperCase()})`}
                            />
                          ))}
                        </div>
                      ) : null}
                      {(card.colorNoteTitle || card.colorNoteText) ? (
                        <div className="mt-3 grid gap-2">
                          <input value={getLangEditValue(card.colorNoteTitleI18n, pLang)} onChange={(e) => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, colorNoteTitle: pLang === "es" ? e.target.value : it.colorNoteTitle, colorNoteTitleI18n: setLangText(it.colorNoteTitle ?? "", it.colorNoteTitleI18n, pLang, e.target.value) } : it))} className="h-9 rounded-xl border border-slate-200 px-3 text-sm" placeholder="Título del bloque de color" />
                          <RichTextEditor value={getLangEditValue(card.colorNoteTextI18n, pLang)} onChange={(next) => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, colorNoteText: pLang === "es" ? next : it.colorNoteText, colorNoteTextI18n: setLangText(it.colorNoteText ?? "", it.colorNoteTextI18n, pLang, next) } : it))} placeholder="Texto del bloque de color" minHeightClassName="min-h-[70px]" />
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <input type="color" value={card.colorNoteBgColor ?? "#EEF2FF"} onChange={(e) => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, colorNoteBgColor: e.target.value } : it))} className="h-9 w-12 rounded border border-slate-200" />
                            <input type="color" value={card.colorNoteTextColor ?? "#1E3A8A"} onChange={(e) => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, colorNoteTextColor: e.target.value } : it))} className="h-9 w-12 rounded border border-slate-200" />
                          </div>
                        </div>
                      ) : null}
                      <button type="button" onClick={() => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, colorNoteTitle: it.colorNoteTitle || "Título", colorNoteText: it.colorNoteText || "Texto destacado", colorNoteBgColor: it.colorNoteBgColor || "#EEF2FF", colorNoteTextColor: it.colorNoteTextColor || "#1E3A8A" } : it))} className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">Agregar bloque de texto con color a esta tarjeta</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setPPrestacionResources((prev) => [...prev, createEmptyPrestacionResource()])} className="mt-3 w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700">+ Agregar tarjeta de recurso</button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">2</span>
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Pasos de uso / Cómo funciona</div>
                    <p className="text-xs text-slate-500">Guía paso a paso para mostrar en la pantalla de detalle.</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa de pasos</div>
                  <div className="mt-3 space-y-3">
                    {pPrestacionSteps.map((step, idx) => (
                      <div key={`step-preview-${idx}`} className="flex gap-3">
                        <div className="grid h-7 w-7 place-items-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{idx + 1}</div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{getLangEditValue(step.titleI18n, pLang) || `Paso ${idx + 1}`}</div>
                          <div className="text-xs text-slate-600">{getLangEditValue(step.subtitleI18n, pLang) || "Descripción del paso..."}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  {pPrestacionSteps.map((step, idx) => (
                    <div key={`step-${idx}`} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Paso {idx + 1}</span><button type="button" className="text-red-500" onClick={() => setPPrestacionSteps((prev) => prev.length <= 1 ? [createEmptyPrestacionStep()] : prev.filter((_, i) => i !== idx))}>🗑</button></div>
                      <input value={getLangEditValue(step.titleI18n, pLang)} onChange={(e) => setPPrestacionSteps((prev) => prev.map((it, i) => i === idx ? { ...it, title: pLang === "es" ? e.target.value : it.title, titleI18n: setLangText(it.title, it.titleI18n, pLang, e.target.value) } : it))} className="h-10 rounded-xl border border-slate-200 px-3" placeholder="Título del paso" />
                      <RichTextEditor value={getLangEditValue(step.subtitleI18n, pLang)} onChange={(next) => setPPrestacionSteps((prev) => prev.map((it, i) => i === idx ? { ...it, subtitle: pLang === "es" ? next : it.subtitle, subtitleI18n: setLangText(it.subtitle, it.subtitleI18n, pLang, next) } : it))} placeholder="Descripción del paso..." minHeightClassName="min-h-[70px]" />
                      <input value={getLangMediaValue(step.imageI18n, pLang, step.image ?? "")} onChange={(e) => setPPrestacionSteps((prev) => prev.map((it, i) => i === idx ? { ...it, image: pLang === "es" ? e.target.value : it.image, imageI18n: setLangText(it.image ?? "", it.imageI18n, pLang, e.target.value) } : it))} className="h-10 rounded-xl border border-slate-200 px-3" placeholder="Imagen URL (opcional)" />
                      <input
                        type="file"
                        accept={IMAGE_FILE_ACCEPT}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          void fileToUploadAsset(file).then((asset) => {
                            setPPrestacionSteps((prev) => prev.map((it, i) => i === idx ? { ...it, image: pLang === "es" ? asset.url : it.image, imageI18n: setLangText(it.image ?? "", it.imageI18n, pLang, asset.url) } : it));
                          }).catch(() => null);
                        }}
                        className="w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#00A9C6]/10 file:px-3 file:py-1.5 file:font-semibold file:text-[#007D92]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPPrestacionSteps((prev) =>
                            prev.map((it, i) =>
                              i === idx
                                ? { ...it, image: "", imageI18n: setLangText("", it.imageI18n, pLang, "") }
                                : it
                            )
                          )
                        }
                        className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600"
                      >
                        Quitar imagen
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setPPrestacionSteps((prev) => [...prev, createEmptyPrestacionStep()])} className="mt-3 w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700">+ Agregar paso</button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-500 text-sm font-semibold text-white">3</span>
                  <div>
                    <div className="text-lg font-semibold text-slate-900">Preguntas frecuentes (FAQs)</div>
                    <p className="text-xs text-slate-500">Se muestran como acordeón en la pantalla de detalle.</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa de FAQs</div>
                  <div className="mt-2 space-y-2">
                    {pPrestacionFaqs.map((faq, idx) => (
                      <details key={`faq-preview-${idx}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <summary className="cursor-pointer font-semibold text-slate-900">{getLangEditValue(faq.questionI18n, pLang) || `Q${idx + 1}`}</summary>
                        {getLangEditValue(faq.answerI18n, pLang) ? <div className="mt-2 text-slate-600">{getLangEditValue(faq.answerI18n, pLang)}</div> : null}
                      </details>
                    ))}
                  </div>
                </div>
                <div className="mt-3 space-y-3">
                  {pPrestacionFaqs.map((faq, idx) => (
                    <div key={`faq-${idx}`} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Q{idx + 1}</span><button type="button" className="text-red-500" onClick={() => setPPrestacionFaqs((prev) => prev.length <= 1 ? [createEmptyPrestacionFaq()] : prev.filter((_, i) => i !== idx))}>🗑</button></div>
                      <input value={getLangEditValue(faq.questionI18n, pLang)} onChange={(e) => setPPrestacionFaqs((prev) => prev.map((it, i) => i === idx ? { ...it, question: pLang === "es" ? e.target.value : it.question, questionI18n: setLangText(it.question, it.questionI18n, pLang, e.target.value) } : it))} className="h-10 rounded-xl border border-slate-200 px-3" placeholder="Pregunta frecuente..." />
                      <RichTextEditor value={getLangEditValue(faq.answerI18n, pLang)} onChange={(next) => setPPrestacionFaqs((prev) => prev.map((it, i) => i === idx ? { ...it, answer: pLang === "es" ? next : it.answer, answerI18n: setLangText(it.answer, it.answerI18n, pLang, next) } : it))} placeholder="Respuesta..." minHeightClassName="min-h-[80px]" />
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setPPrestacionFaqs((prev) => [...prev, createEmptyPrestacionFaq()])} className="mt-3 w-full rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-700">+ Agregar pregunta frecuente</button>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-lg font-semibold text-slate-900">También te puede interesar</div>
                <p className="mt-1 text-xs text-slate-500">Seleccioná publicaciones para mostrar en carrusel al final del detalle.</p>
                <div className="mt-3 grid gap-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      value={pPrestacionRelatedSearch}
                      onChange={(e) => setPPrestacionRelatedSearch(e.target.value)}
                      placeholder="Buscar publicación..."
                      className="h-10 rounded-xl border border-slate-200 px-3"
                    />
                    <select
                      value={pPrestacionRelatedCategory}
                      onChange={(e) => setPPrestacionRelatedCategory(e.target.value)}
                      className="h-10 rounded-xl border border-slate-200 px-3"
                    >
                      <option value="todas">Todas las categorías</option>
                      {Array.from(new Set(publications.map((pub) => String(pub.category ?? "").trim()).filter(Boolean))).map((category) => (
                        <option key={`related-cat-${category}`} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>
                  <select
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      setPPrestacionRelatedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
                    }}
                    className="h-10 rounded-xl border border-slate-200 px-3"
                  >
                    <option value="">Agregar publicación relacionada</option>
                    {publications
                      .filter((pub) => pub.id !== editingId)
                      .filter((pub) => pPrestacionRelatedCategory === "todas" || String(pub.category ?? "").trim() === pPrestacionRelatedCategory)
                      .filter((pub) =>
                        String(pub.title ?? "")
                          .toLowerCase()
                          .includes(pPrestacionRelatedSearch.toLowerCase().trim())
                      )
                      .slice(0, 80)
                      .map((pub) => (
                      <option key={`related-${pub.id}`} value={pub.id}>{pub.title}</option>
                    ))}
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {pPrestacionRelatedIds.map((id) => {
                      const pub = publications.find((item) => item.id === id);
                      return (
                        <span key={id} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700">
                          {pub?.title || id}
                          <button type="button" className="ml-2 text-red-500" onClick={() => setPPrestacionRelatedIds((prev) => prev.filter((entry) => entry !== id))}>×</button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          ) : null}

          <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <label className="text-sm font-medium text-slate-700">Idioma de edición</label>
            {renderLangTabs(pLang, setEditingLang)}
            <p className="text-xs text-slate-500">
              Tocá un idioma para volver arriba con ese idioma seleccionado y completar la publicación en ese idioma.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={createPublication}
              className="h-11 rounded-xl bg-[#00A9C6] px-6 text-sm font-semibold text-white hover:bg-[#0095AE] disabled:cursor-not-allowed disabled:opacity-70"
              disabled={savingPublication}
            >
              {savingPublication
                ? "Guardando..."
                : editingId
                  ? "Guardar cambios"
                  : "Crear publicación"}
            </button>
            {editingId ? (
              <button
                onClick={cancelEdit}
                className="h-11 rounded-xl border border-slate-200 px-6 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar edición
              </button>
            ) : null}
            {saveMessage ? (
              <span className="text-sm font-medium text-emerald-600">{saveMessage}</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>

          ) : null}

          {!isNewPublicationPage ? (
          <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Total</p><p className="mt-2 text-3xl font-bold text-slate-800">{publications.length}</p><p className="text-xs text-slate-400">-3 en el mes · +87 · -8</p></div>
            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-widest text-violet-500">Pagas</p><p className="mt-2 text-3xl font-bold text-violet-700">{paidPublications.length}</p></div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">Gratis</p><p className="mt-2 text-3xl font-bold text-emerald-700">{freePublications}</p></div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <StatsChartCard title="Publicaciones: pagas vs gratis" labelA="Pagas" labelB="Gratis" colorA="#10b981" colorB="#a7f3d0" getData={publicationsData} />
            <StatsChartCard title="Denuncias por período" labelA="Denuncias" colorA="#f43f5e" getData={reportsData} single />
          </div>

          <div className="mt-8 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
                <button type="button" onClick={() => setPublicationTab("publicaciones")} className={`rounded-md px-3 py-1.5 font-medium ${publicationTab === "publicaciones" ? "bg-white shadow" : "text-slate-500"}`}>Publicaciones</button>
                <button type="button" onClick={() => setPublicationTab("denuncias")} className={`rounded-md px-3 py-1.5 font-medium ${publicationTab === "denuncias" ? "bg-white shadow" : "text-slate-500"}`}>Denuncias</button>
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <select
                  value={publicationTypeFilter}
                  onChange={(event) => setPublicationTypeFilter(event.target.value as "todas" | "publicacion" | "prestacion")}
                  className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="todas">Todas</option>
                  <option value="publicacion">Publicaciones</option>
                  <option value="prestacion">Prestaciones</option>
                </select>
                <input value={publicationSearch} onChange={(event) => setPublicationSearch(event.target.value)} placeholder="Buscar..." className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200 sm:w-64" />
                <button type="button" onClick={openNewPublicationEditor} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">+ Nueva</button>
              </div>
            </div>
            <div className="text-lg font-semibold text-slate-900">{publicationTab === "denuncias" ? "Denuncias recibidas" : "Últimas publicaciones"}</div>
            <div className="mt-3 space-y-3">
            {publicationTab === "denuncias" ? filteredReports.map((report) => {
              const isOpen = Boolean(expandedReports[report.id]);
              return (
                <div key={report.id} className="rounded-2xl border border-rose-100 bg-white p-4">
                  <button
                    type="button"
                    onClick={() => setExpandedReports((prev) => ({ ...prev, [report.id]: !prev[report.id] }))}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{report.publicationTitle || "Publicación sin título"}</div>
                        <div className="mt-1 text-xs text-slate-500">Publicación ID: {report.publicationId || "-"}</div>
                        <div className="mt-1 text-xs text-slate-500">Denunciante: {report.fullName || "-"} · {report.email || "-"} · {report.contact || "-"}</div>
                      </div>
                      <span className="text-xs font-semibold text-rose-600">{isOpen ? "Ocultar" : "Ver detalle"}</span>
                    </div>
                  </button>

                  {isOpen ? (
                    <>
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{report.details || "-"}</div>
                      <div className="mt-2 text-xs text-rose-600">{report.reason || "Denuncia"} · {report.createdAt ? new Date(report.createdAt).toLocaleString("es-AR") : ""}</div>
                    </>
                  ) : null}
                </div>
              );
            }) : filteredPublications.map((p) => (
              <div key={p.id} className={`rounded-2xl border bg-white p-4 ${p.primaryGroupKey === "prestacion" ? "border-teal-200" : "border-indigo-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                        {statusLabel(p.status)}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${publicationTypeColors(p)}`}>
                        {publicationTypeLabel(p)}
                      </span>
                      {p.featured ? (
                        <span className="rounded-full bg-[#00A9C6]/10 px-2 py-0.5 text-xs text-[#007D92]">destacado</span>
                      ) : null}
                      {Boolean((p.fields as any)?.partner) ? (
                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs text-cyan-700">🤝 partner</span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{p.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Oferente: {p.publisherName || "Sin nombre"} · Email: {String((p.fields as any)?.providerEmail ?? "-")}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {(() => {
                        return "Bloque: Categorías";
                      })()}
                      {p.category
                        ? ` · ${pickI18nText(p.categoryI18n ?? null, locale, p.category)}${
                            p.subcategory
                              ? ` · ${pickI18nText(p.subcategoryI18n ?? null, locale, p.subcategory)}`
                              : ""
                          }`
                        : " · Sin categoría"}
                      {p.city ? ` · ${p.city}` : ""}
                      {p.country ? `, ${p.country}` : ""}
                      {p.headquarterCountry ? ` · Sede: ${p.headquarterCountry}` : ""}
                    </div>
                    {(() => {
                      const warnings: string[] = [];
                      if (p.status !== "active") {
                        warnings.push(`No visible porque: ${statusLabel(p.status)}`);
                      }
                      if (p.expiration) {
                        const exp = new Date(p.expiration);
                        if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
                          warnings.push("No visible porque: Expirada");
                        }
                      }
                      if (p.primaryGroupKey && p.primaryGroupKey !== "category") {
                        warnings.push("Advertencia: categoría definida en un bloque distinto a categorías.");
                      }
                      const catType = p.category ? categoryTaxonomyTypeByLabel.get(p.category) : null;
                      const subType = p.subcategory ? categoryTaxonomyTypeByLabel.get(p.subcategory) : null;
                      if (catType && subType && catType !== subType) {
                        warnings.push("Advertencia: tipo de filtro y categoría no coinciden.");
                      }
                      return warnings.length ? (
                        <div className="mt-2 space-y-1 text-xs text-amber-600">
                          {warnings.map((warning) => (
                            <div key={warning}>{warning}</div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">👁️ {readPublicationAnalytics(p).views}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">📩 {readPublicationAnalytics(p).leads}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">❤️ {readPublicationAnalytics(p).favorites}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">🔗 {readPublicationAnalytics(p).shares}</span>
                      {publicationLanguages(p).length ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">Idiomas: {publicationLanguages(p).join(", ")}</span>
                      ) : null}
                    </div>

                    {/* show dynamic tags */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(p.filterOptions ?? []).slice(0, 12).map((entry) => (
                        <span
                          key={entry.filterOptionId}
                          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
                        >
                          {pickI18nText(entry.filterOption.labelI18n ?? null, locale, entry.filterOption.label)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() => editPublication(p)}
                      className="rounded-lg border border-[#00A9C6]/40 px-3 py-1.5 text-xs text-[#007D92] hover:bg-[#00A9C6]/10"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => copyPublication(p)}
                      className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50"
                    >
                      Copiar del seleccionado
                    </button>
                    <button
                      onClick={() => deletePublication(p.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
          </>
          ) : null}

        </details>
      </section>
      ) : null}
    </div>
  );
}
