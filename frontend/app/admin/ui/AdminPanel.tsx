"use client";

import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpRight, Building2, ChevronDown, ChevronRight, FileText, ImageIcon, Languages, MapPinned, MessageSquareMore, Plus, UserRound, X } from "lucide-react";
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

function isUsableImageUrl(value: string) {
  const url = String(value ?? "").trim();
  if (url.startsWith("data:image/")) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("res.cloudinary.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const uploadIndex = parts.indexOf("upload");
      if (uploadIndex >= 0) {
        const afterUpload = parts.slice(uploadIndex + 1);
        const last = afterUpload.at(-1) ?? "";
        return afterUpload.length >= 2 && /\.[a-z0-9]+($|\?)/i.test(last);
      }
    }
    return true;
  } catch {
    return false;
  }
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
  visibleInCard?: boolean;
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

function isFeedbackReport(item: ReportItem) {
  return String(item.reason ?? "").toLowerCase() === "feedback" || String(item.publicationId ?? "") === "feedback-general";
}

type PromoCodeItem = {
  id: string;
  code: string;
  discountPercent: number;
  expiresAt: string | null;
  maxUses: number | null;
  usedCount: number;
  scope?: "all" | "partners";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FeaturedPlanPriceItem = {
  id: string;
  country: string | null;
  planType: "featured_120d" | "featured_monthly";
  currency: "ARS" | "USD";
  amount: number;
  providerMode?: "api" | null;
  providerResourceId?: string | null;
  providerCheckoutUrl?: string | null;
  providerRaw?: unknown | null;
  durationDays?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type DlocalSubscriptionPlanItem = {
  id: string;
  featuredPlanPriceId: string | null;
  country: string | null;
  currency: "ARS" | "USD";
  name: string;
  description: string | null;
  amount: number;
  frequencyType: "MONTHLY";
  frequencyValue: number;
  dayOfMonth: number | null;
  maxPeriods: number | null;
  successUrl: string | null;
  backUrl: string | null;
  errorUrl: string | null;
  notificationUrl: string | null;
  manualSubscribeUrl: string | null;
  providerMode: "api" | "manual";
  dlocalPlanId: string | null;
  planToken: string | null;
  subscribeUrl: string | null;
  providerRaw?: unknown | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

type TravelServicePaymentItem = {
  id: string;
  serviceId: string;
  payerEmail: string | null;
  provider: string;
  paymentType: "one_time" | "monthly";
  planType: "featured_120d" | "featured_monthly";
  currency: string | null;
  amount: number | null;
  promoCode: string | null;
  externalReference: string | null;
  providerPaymentId: string | null;
  checkoutUrl: string | null;
  status: "pending" | "processing" | "paid" | "failed" | "cancelled";
  returnStatus: string | null;
  raw?: unknown | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DashboardServiceHistory = {
  sourceId: string;
  taxonomyType: string;
  lifecycleStatus: string;
  isDeleted: boolean;
  country?: string;
  destinationCountry?: string;
  headquarterCountry?: string;
  publicationPlan?: string;
  categories?: string[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
};

type DashboardPublicationHistory = {
  sourceId: string;
  status: string;
  isDeleted: boolean;
  featured: boolean;
  price?: string;
  country?: string;
  headquarterCountry?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
};

type DashboardPassportSelection = {
  id: string;
  country: string;
  source?: string;
  createdAt?: string;
};

type DashboardDestinationSearch = {
  id: string;
  passportCountry?: string;
  destinationCountry: string;
  category?: string;
  source?: string;
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
  updatedAt?: string;
};

function parseTravelServiceExtra(service: TravelService): Record<string, unknown> {
  try {
    const parsed = JSON.parse(String(service.whatSearching ?? "{}"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function providerDisplayName(service: TravelService): string {
  const extra = parseTravelServiceExtra(service);
  const candidate = String(extra.name ?? (extra.providerName as string | undefined) ?? (service as any).providerName ?? "").trim();
  if (candidate) return normalizeVisibleText(candidate);
  const email = String(service.email ?? "").trim();
  if (!email) return "Sin nombre";
  return email.split("@")[0] || email;
}

function providerRootEmail(service: TravelService): string {
  const extra = parseTravelServiceExtra(service);
  return [
    extra.portalOwnerEmail,
    extra.ownerEmail,
    extra.submittedEmail,
    service.email,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .find((value) => value.includes("@")) ?? "";
}

function normalizeVisibleText(value: string): string {
  const raw = String(value ?? "");
  if (!raw) return "";

  const broken = "(?:[^A-Za-z\\s]{1,120})";
  const noisy = "(?:[^A-Za-z\\s]*[ÃÂâ�][^A-Za-z\\s]*){1,120}";
  const contextualRepairs: Array<[RegExp, string]> = [
    [new RegExp(`CATEGOR${broken}AS`, "g"), "CATEGORÍAS"],
    [new RegExp(`CATEGOR${broken}A`, "g"), "CATEGORÍA"],
    [new RegExp(`T${broken}TULO`, "g"), "TÍTULO"],
    [new RegExp(`SUBT${broken}TULO`, "g"), "SUBTÍTULO"],
    [new RegExp(`P${broken}BLICO`, "g"), "PÚBLICO"],
    [new RegExp(`PA${broken}S`, "g"), "PAÍS"],
    [new RegExp(`Categor${broken}as`, "g"), "Categorías"],
    [new RegExp(`Categor${broken}a`, "g"), "Categoría"],
    [new RegExp(`Publicaci${broken}n`, "g"), "Publicación"],
    [new RegExp(`Prestaci${broken}n`, "g"), "Prestación"],
    [new RegExp(`Informaci${broken}n`, "g"), "Información"],
    [new RegExp(`Descripci${broken}n`, "g"), "Descripción"],
    [new RegExp(`categor${broken}as`, "gi"), "categorías"],
    [new RegExp(`categor${broken}a`, "gi"), "categoría"],
    [new RegExp(`subcategor${broken}as`, "gi"), "subcategorías"],
    [new RegExp(`subcategor${broken}a`, "gi"), "subcategoría"],
    [new RegExp(`publicaci${broken}nes`, "gi"), "publicaciones"],
    [new RegExp(`publicaci${broken}n`, "gi"), "publicación"],
    [new RegExp(`prestaci${broken}nes`, "gi"), "prestaciones"],
    [new RegExp(`prestaci${broken}n`, "gi"), "prestación"],
    [new RegExp(`informaci${broken}n`, "gi"), "información"],
    [new RegExp(`descripci${broken}n`, "gi"), "descripción"],
    [new RegExp(`configuraci${broken}n`, "gi"), "configuración"],
    [new RegExp(`navegaci${broken}n`, "gi"), "navegación"],
    [new RegExp(`edici${broken}n`, "gi"), "edición"],
    [new RegExp(`expiraci${broken}n`, "gi"), "expiración"],
    [new RegExp(`valoraci${broken}n`, "gi"), "valoración"],
    [new RegExp(`opci${broken}nes`, "gi"), "opciones"],
    [new RegExp(`opci${broken}n`, "gi"), "opción"],
    [new RegExp(`acci${broken}n`, "gi"), "acción"],
    [new RegExp(`secci${broken}n`, "gi"), "sección"],
    [new RegExp(`selecci${broken}n`, "gi"), "selección"],
    [new RegExp(`t${broken}tulo`, "gi"), "título"],
    [new RegExp(`t${broken}tulos`, "gi"), "títulos"],
    [new RegExp(`subt${broken}tulo`, "gi"), "subtítulo"],
    [new RegExp(`subt${broken}tulos`, "gi"), "subtítulos"],
    [new RegExp(`p${broken}blico`, "gi"), "público"],
    [new RegExp(`pa${broken}s`, "gi"), "país"],
    [new RegExp(`pa${broken}ses`, "gi"), "países"],
    [new RegExp(`a${broken}o`, "gi"), "año"],
    [new RegExp(`a${broken}os`, "gi"), "años"],
    [new RegExp(`d${broken}a`, "gi"), "día"],
    [new RegExp(`d${broken}as`, "gi"), "días"],
    [new RegExp(`m${broken}s`, "gi"), "más"],
    [new RegExp(`m${broken}ltiples`, "gi"), "múltiples"],
    [new RegExp(`aqu${broken}`, "gi"), "aquí"],
    [new RegExp(`todav${broken}a`, "gi"), "todavía"],
    [new RegExp(`tambi${broken}n`, "gi"), "también"],
    [new RegExp(`pod${broken}s`, "gi"), "podés"],
    [new RegExp(`cre${broken}`, "gi"), "creá"],
    [new RegExp(`c${broken}digo`, "gi"), "código"],
    [new RegExp(`c${broken}mo`, "gi"), "cómo"],
    [new RegExp(`p${broken}gina`, "gi"), "página"],
    [new RegExp(`m${broken}nimo`, "gi"), "mínimo"],
    [new RegExp(`m${broken}ximo`, "gi"), "máximo"],
    [new RegExp(`prop${broken}sito`, "gi"), "propósito"],
    [new RegExp(`Seleccion${broken}`, "g"), "Seleccioná"],
    [new RegExp(`seleccion${broken}`, "g"), "seleccioná"],
    [new RegExp(`Eleg${broken}`, "g"), "Elegí"],
    [new RegExp(`eleg${broken}`, "g"), "elegí"],
    [new RegExp(`Complet${broken}`, "g"), "Completá"],
    [new RegExp(`complet${broken}`, "g"), "completá"],
    [new RegExp(`mostrar${broken}`, "gi"), "mostrará"],
    [new RegExp(`num${broken}ricos`, "gi"), "numéricos"],
    [new RegExp(`qu${broken}`, "gi"), "qué"],
    [new RegExp(`quer${broken}s`, "gi"), "querés"],
    [new RegExp(`est${broken}`, "gi"), "está"],
    [new RegExp(`enviar${broken}`, "gi"), "enviará"],
    [new RegExp(`ingres${broken}`, "gi"), "ingresá"],
    [new RegExp(`guard${broken}`, "gi"), "guardá"],
    [new RegExp(`ubicaci${broken}n`, "gi"), "ubicación"],
    [new RegExp(`a${broken}adir`, "gi"), "añadir"],
    [new RegExp(`im${broken}genes`, "gi"), "imágenes"],
    [new RegExp(`imagen${broken}es`, "gi"), "imágenes"],
    [new RegExp(`b${broken}squeda`, "gi"), "búsqueda"],
    [new RegExp(`gu${broken}a`, "gi"), "guía"],
    [new RegExp(`bot${broken}n`, "gi"), "botón"],
    [new RegExp(`acorde${broken}n`, "gi"), "acordeón"],
    [new RegExp(`í?tems`, "gi"), "ítems"],
    [new RegExp(`P${broken}rez`, "g"), "Pérez"],
    [new RegExp(`Acompa${broken}amos`, "g"), "Acompañamos"],
    [new RegExp(`acompa${broken}amos`, "g"), "acompañamos"],
    [new RegExp(`Espa${broken}ol`, "g"), "Español"],
    [new RegExp(`espa${broken}ol`, "g"), "español"],
    [new RegExp(`Ten${broken}s`, "g"), "Tenés"],
    [new RegExp(`ten${broken}s`, "g"), "tenés"],
    [new RegExp(`Est${broken}s`, "g"), "Estás"],
    [new RegExp(`est${broken}s`, "g"), "estás"],
    [new RegExp(`M${broken}nimo`, "g"), "Mínimo"],
    [new RegExp(`m${broken}nimo`, "g"), "mínimo"],
    [new RegExp(`M${broken}ximo`, "g"), "Máximo"],
    [new RegExp(`m${broken}ximo`, "g"), "máximo"],
  ];
  const noisyContextualRepairs: Array<[RegExp, string]> = [
    [new RegExp(`categor${noisy}as`, "gi"), "categorías"],
    [new RegExp(`categor${noisy}a`, "gi"), "categoría"],
    [new RegExp(`subcategor${noisy}as`, "gi"), "subcategorías"],
    [new RegExp(`subcategor${noisy}a`, "gi"), "subcategoría"],
    [new RegExp(`publicaci${noisy}nes`, "gi"), "publicaciones"],
    [new RegExp(`publicaci${noisy}n`, "gi"), "publicación"],
    [new RegExp(`prestaci${noisy}nes`, "gi"), "prestaciones"],
    [new RegExp(`prestaci${noisy}n`, "gi"), "prestación"],
    [new RegExp(`informaci${noisy}n`, "gi"), "información"],
    [new RegExp(`descripci${noisy}n`, "gi"), "descripción"],
    [new RegExp(`configuraci${noisy}n`, "gi"), "configuración"],
    [new RegExp(`edici${noisy}n`, "gi"), "edición"],
    [new RegExp(`expiraci${noisy}n`, "gi"), "expiración"],
    [new RegExp(`valoraci${noisy}n`, "gi"), "valoración"],
    [new RegExp(`opci${noisy}nes`, "gi"), "opciones"],
    [new RegExp(`opci${noisy}n`, "gi"), "opción"],
    [new RegExp(`acci${noisy}n`, "gi"), "acción"],
    [new RegExp(`selecci${noisy}n`, "gi"), "selección"],
    [new RegExp(`ubicaci${noisy}n`, "gi"), "ubicación"],
    [new RegExp(`t${noisy}tulo`, "gi"), "título"],
    [new RegExp(`subt${noisy}tulo`, "gi"), "subtítulo"],
    [new RegExp(`p${noisy}blico`, "gi"), "público"],
    [new RegExp(`pa${noisy}ses`, "gi"), "países"],
    [new RegExp(`pa${noisy}s`, "gi"), "país"],
    [new RegExp(`a${noisy}os`, "gi"), "años"],
    [new RegExp(`a${noisy}o`, "gi"), "año"],
    [new RegExp(`d${noisy}as`, "gi"), "días"],
    [new RegExp(`d${noisy}a`, "gi"), "día"],
    [new RegExp(`m${noisy}s`, "gi"), "más"],
    [new RegExp(`m${noisy}ltiples`, "gi"), "múltiples"],
    [new RegExp(`b${noisy}squeda`, "gi"), "búsqueda"],
    [new RegExp(`gu${noisy}a`, "gi"), "guía"],
    [new RegExp(`bot${noisy}n`, "gi"), "botón"],
    [new RegExp(`c${noisy}mo`, "gi"), "cómo"],
    [new RegExp(`p${noisy}gina`, "gi"), "página"],
    [new RegExp(`acorde${noisy}n`, "gi"), "acordeón"],
    [new RegExp(`im${noisy}genes`, "gi"), "imágenes"],
    [new RegExp(`a${noisy}adir`, "gi"), "añadir"],
    [new RegExp(`tambi${noisy}n`, "gi"), "también"],
    [new RegExp(`todav${noisy}a`, "gi"), "todavía"],
    [new RegExp(`pod${noisy}s`, "gi"), "podés"],
    [new RegExp(`num${noisy}ricos`, "gi"), "numéricos"],
    [new RegExp(`qu${noisy}`, "gi"), "qué"],
    [new RegExp(`quer${noisy}s`, "gi"), "querés"],
    [new RegExp(`est${noisy}`, "gi"), "está"],
    [new RegExp(`enviar${noisy}`, "gi"), "enviará"],
    [new RegExp(`ingres${noisy}`, "gi"), "ingresá"],
    [new RegExp(`guard${noisy}`, "gi"), "guardá"],
    [new RegExp(`seleccion${noisy}`, "gi"), "seleccioná"],
    [new RegExp(`eleg${noisy}`, "gi"), "elegí"],
    [new RegExp(`complet${noisy}`, "gi"), "completá"],
    [new RegExp(`mostrar${noisy}`, "gi"), "mostrará"],
    [new RegExp(`Espa${noisy}ol`, "g"), "Español"],
    [new RegExp(`espa${noisy}ol`, "g"), "español"],
    [new RegExp(`P${noisy}rez`, "g"), "Pérez"],
    [new RegExp(`Acompa${noisy}amos`, "g"), "Acompañamos"],
    [new RegExp(`acompa${noisy}amos`, "g"), "acompañamos"],
  ];

  let normalized = raw
    .replace(/ÃƒÂ¡/g, "á")
    .replace(/ÃƒÂ©/g, "é")
    .replace(/ÃƒÂ­/g, "í")
    .replace(/ÃƒÂ³/g, "ó")
    .replace(/ÃƒÂº/g, "ú")
    .replace(/ÃƒÂ±/g, "ñ")
    .replace(/ÃƒÂ¼/g, "ü")
    .replace(/ÃƒÂ/g, "Á")
    .replace(/ÃƒÂ‰/g, "É")
    .replace(/ÃƒÂ/g, "Í")
    .replace(/ÃƒÂ“/g, "Ó")
    .replace(/ÃƒÂš/g, "Ú")
    .replace(/ÃƒÂ‘/g, "Ñ")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã¼/g, "ü")
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã/g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Â¿/g, "¿")
    .replace(/Â¡/g, "¡")
    .replace(/â†’/g, "→")
    .replace(/â€”/g, "—")
    .replace(/â€“/g, "–")
    .replace(/â€œ/g, '“')
    .replace(/â€/g, '”')
    .replace(/â€˜/g, '‘')
    .replace(/â€™/g, '’');

  for (const [pattern, replacement] of contextualRepairs) {
    normalized = normalized.replace(pattern, replacement);
  }

  for (const [pattern, replacement] of noisyContextualRepairs) {
    normalized = normalized.replace(pattern, replacement);
  }

  normalized = normalized
    .replace(/\uFFFD/g, "")
    .replace(/ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½/g, "")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â/g, "")
    .replace(/publicaciónes/gi, "publicaciones")
    .replace(/prestaciónes/gi, "prestaciones")
    .replace(/opciónes/gi, "opciones")
    .replace(/selecciónes/gi, "selecciones");

  return normalized.replace(/\s+/g, ' ').trim();
}

function normalizeAdminDomTree(root: HTMLElement) {
  const normalizeIfNeeded = (value: string) => {
    if (!/[ÃÂâ�Æƒ€]/.test(value)) return value;
    return normalizeVisibleText(value);
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode = walker.nextNode();

  while (currentNode) {
    const textNode = currentNode as Text;
    const parent = textNode.parentElement;
    const rawValue = textNode.nodeValue ?? "";

    if (parent && !["SCRIPT", "STYLE"].includes(parent.tagName)) {
      const nextValue = normalizeIfNeeded(rawValue);
      if (nextValue !== rawValue) {
        textNode.nodeValue = nextValue;
      }
    }

    currentNode = walker.nextNode();
  }

  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    ["placeholder", "data-placeholder", "title", "aria-label", "alt"].forEach((attr) => {
      const attrValue = element.getAttribute(attr);
      if (!attrValue) return;
      const nextValue = normalizeIfNeeded(attrValue);
      if (nextValue !== attrValue) {
        element.setAttribute(attr, nextValue);
      }
    });

    if (element instanceof HTMLInputElement && ["button", "submit", "reset"].includes(element.type)) {
      const nextValue = normalizeIfNeeded(element.value);
      if (nextValue !== element.value) {
        element.value = nextValue;
      }
    }
  });
}

function serviceEffectiveStatus(service: TravelService): string {
  const raw = String(service.status ?? service.whatStop ?? "").trim().toLowerCase();
  if (["approved", "active", "activo"].includes(raw)) return "aprobado";
  if (raw === "rejected") return "rechazado";
  if (raw === "needs_info") return "falta info";
  if (["pending", ""].includes(raw)) return "pendiente";
  return raw || "pendiente";
}

function isReviewableTravelService(service: TravelService, extra?: Record<string, unknown>): boolean {
  const currentStatus = serviceEffectiveStatus(service);
  const wasResubmitted = String(extra?.resubmittedAt ?? "").trim().length > 0;
  const paymentStatus = String(extra?.paymentStatus ?? extra?.paymentReturnStatus ?? "").trim().toLowerCase();
  const paymentReadyForAdminReview = extra?.paymentReadyForAdminReview === true || ["paid", "approved", "completed", "success", "ok"].includes(paymentStatus);
  return (
    currentStatus === "pendiente" ||
    currentStatus === "pending_review" ||
    currentStatus === "pendiente_revision" ||
    (currentStatus === "pendiente_pago" && paymentReadyForAdminReview) ||
    (currentStatus === "falta info" && wasResubmitted)
  );
}

function isPublicationLinkedReviewRequest(extra?: Record<string, unknown>): boolean {
  const requestKind = String(extra?.requestKind ?? "").trim().toLowerCase();
  return (
    requestKind === "edit_publication" ||
    requestKind === "renew_free" ||
    requestKind === "renew_featured_120d" ||
    requestKind === "renew_featured_monthly" ||
    requestKind === "upgrade_featured_120d" ||
    requestKind === "upgrade_featured_monthly"
  );
}

function travelServiceActivityTime(service: TravelService): number {
  const extra = parseTravelServiceExtra(service);
  const candidates = [
    extra.resubmittedAt,
    extra.statusUpdatedAt,
    service.updatedAt,
    service.createdAt,
  ];
  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isNaN(time)) return time;
  }
  return 0;
}

function normalizeLifecycleStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function isActiveServiceLifecycle(status: unknown) {
  const normalized = normalizeLifecycleStatus(status);
  return ["aprobado", "active", "activo"].includes(normalized);
}

function booleanLike(value: unknown) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "si", "sí", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off", ""].includes(normalized)) return false;
  }
  return Boolean(value);
}

function isActivePublicationLifecycle(status: unknown) {
  const normalized = normalizeLifecycleStatus(status);
  return ["active", "activo", "published", "publicado"].includes(normalized);
}

function receivingModeLabel(mode: unknown): string {
  const normalized = String(mode ?? "").trim().toLowerCase();
  if (normalized === "except") return "Recibe a todos excepto";
  if (normalized === "only") return "Recibe solo lo seleccionado";
  return "Recibe viajeros de todos los países";
}

function normalizeProviderPlanLabel(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "featured_monthly" || normalized === "monthly") return "Plan mensual";
  if (normalized === "featured_120d" || normalized === "featured") return "Destacado 120 días";
  return "Gratis 60 días";
}

function linkedPublicationPlanLabel(publication: Publication): string {
  const fields = (publication.fields && typeof publication.fields === "object" ? publication.fields : {}) as Record<string, unknown>;
  const explicitPlan = fields.publicationPlan ?? fields.requestedPlan ?? fields.planType;
  if (String(explicitPlan ?? "").trim()) return normalizeProviderPlanLabel(explicitPlan);
  return publication.featured ? "Destacado 120 días" : "Gratis 60 días";
}

function paymentStatusLabel(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "paid") return "Aceptado";
  if (normalized === "processing") return "En proceso";
  if (normalized === "pending") return "Pendiente";
  if (normalized === "failed") return "Rechazado";
  if (normalized === "cancelled") return "Cancelado";
  return String(value ?? "-") || "-";
}

function paymentStatusClasses(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "paid") return "bg-emerald-100 text-emerald-700";
  if (normalized === "processing") return "bg-amber-100 text-amber-700";
  if (normalized === "pending") return "bg-sky-100 text-sky-700";
  if (normalized === "failed" || normalized === "cancelled") return "bg-rose-100 text-rose-700";
  return "bg-slate-100 text-slate-700";
}

function readRefundSnapshot(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "-";
  const source = raw as Record<string, unknown>;
  const direct = String(source.refundStatus ?? source.refund_status ?? source.refunded ?? "").trim();
  if (direct) return direct;
  const providerRaw = source.providerRaw;
  if (providerRaw && typeof providerRaw === "object") {
    const nested = providerRaw as Record<string, unknown>;
    const nestedValue = String(nested.refundStatus ?? nested.refund_status ?? nested.refunded ?? "").trim();
    if (nestedValue) return nestedValue;
  }
  return "-";
}

function parseRefundSnapshot(raw: unknown) {
  if (!raw || typeof raw !== "object") return {} as Record<string, unknown>;
  return raw as Record<string, unknown>;
}

function refundStatusLabel(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "refund_requested") return "Solicitado";
  if (normalized === "refund_reviewing") return "En revisión";
  if (normalized === "refund_rejected") return "Rechazado";
  if (normalized === "refund_processing") return "Procesando";
  if (normalized === "refunded") return "Reembolsado";
  if (normalized === "refund_failed") return "Fallido";
  return String(value ?? "-") || "-";
}

function paymentConfirmedForRefund(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["paid", "approved", "completed", "success"].includes(normalized);
}

function providerRequestKindDisplayLabel(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "renew_free") return "Renovacion gratis";
  if (normalized === "renew_featured_120d") return "Renovacion destacado 120 dias";
  if (normalized === "renew_featured_monthly") return "Renovacion plan mensual";
  if (normalized === "upgrade_featured_120d") return "Cambio de publicacion gratis a destacado";
  if (normalized === "upgrade_featured_monthly") return "Cambio de publicacion gratis a plan mensual";
  if (normalized === "downgrade_free") return "Volver a gratis";
  if (normalized === "edit_publication") return "Edicion de publicacion";
  return "Nueva publicacion";
}

function providerRequestKindLabel(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "renew_free") return "Renovación gratis";
  if (normalized === "renew_featured_120d") return "Renovación destacado 120 días";
  if (normalized === "renew_featured_monthly") return "Renovación plan mensual";
  if (normalized === "upgrade_featured_120d") return "Upgrade a destacado 120 días";
  if (normalized === "upgrade_featured_monthly") return "Upgrade a plan mensual";
  if (normalized === "downgrade_free") return "Volver a gratis";
  if (normalized === "edit_publication") return "Edición de publicación";
  return "Nueva publicación";
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
  const res = await fetch(url, { cache: "no-store", ...init });
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
    const cleaned = normalizeVisibleText(String(value ?? "").trim());
    if (cleaned) return cleaned;
  }
  return "";
}

function readPublicationAnalytics(publication: Publication) {
  const fields = (publication.fields as Record<string, any> | undefined) ?? {};
  const analytics = fields.analytics ?? {};
  const toNum = (value: unknown) => {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const firstMetric = (...values: unknown[]) => {
    for (const value of values) {
      const parsed = toNum(value);
      if (parsed > 0) return parsed;
    }
    return 0;
  };
  return {
    views: firstMetric(analytics.views, analytics.visits, fields.views, fields.visitCount, fields.visits),
    leads: firstMetric(analytics.leads, analytics.leadCount, fields.leads, fields.leadCount, fields.contractCount),
    favorites: firstMetric(analytics.favorites, analytics.favoriteCount, fields.favorites, fields.favoriteCount),
    shares: firstMetric(analytics.shares, analytics.shareCount, fields.shares, fields.shareCount, fields.sharedCount),
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
      <p className="text-xs font-semibold uppercase tracking-widest opacity-70">{normalizeVisibleText(label)}</p>
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
        <p className="text-sm font-semibold text-slate-700">{normalizeVisibleText(title)}</p>
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
            <p style={{ color: colorA }}>{normalizeVisibleText(labelA)}: {data[hoverIndex]?.a ?? 0}</p>
            {!single ? <p style={{ color: colorB }}>{normalizeVisibleText(labelB ?? "")}: {data[hoverIndex]?.b ?? 0}</p> : null}
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
        <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colorA }} />{normalizeVisibleText(labelA)}</span>
        {!single ? <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: colorB }} />{normalizeVisibleText(labelB ?? "")}</span> : null}
      </div>
    </div>
  );
}

type AdminPanelProps = {
  section: AdminSection;
  publicationsView?: "overview" | "new";
};

type EditorSectionTone = "sky" | "indigo" | "emerald" | "amber" | "slate";
type OferenteDestinationMode = "all" | "some";

function AdminEditorSection({
  id,
  tone,
  icon,
  title,
  description,
  children,
}: {
  id?: string;
  tone: EditorSectionTone;
  icon: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const tones: Record<EditorSectionTone, { shell: string; header: string; icon: string; text: string }> = {
    sky: {
      shell: "border-sky-200/80 bg-white shadow-[0_18px_45px_rgba(14,165,233,0.08)]",
      header: "border-sky-100 bg-gradient-to-r from-sky-50 via-cyan-50 to-white",
      icon: "bg-sky-500 text-white shadow-[0_10px_24px_rgba(14,165,233,0.22)]",
      text: "text-sky-700",
    },
    indigo: {
      shell: "border-indigo-200/80 bg-white shadow-[0_18px_45px_rgba(79,70,229,0.08)]",
      header: "border-indigo-100 bg-gradient-to-r from-indigo-50 via-blue-50 to-white",
      icon: "bg-indigo-600 text-white shadow-[0_10px_24px_rgba(79,70,229,0.22)]",
      text: "text-indigo-700",
    },
    emerald: {
      shell: "border-emerald-200/80 bg-white shadow-[0_18px_45px_rgba(16,185,129,0.08)]",
      header: "border-emerald-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-white",
      icon: "bg-emerald-600 text-white shadow-[0_10px_24px_rgba(16,185,129,0.22)]",
      text: "text-emerald-700",
    },
    amber: {
      shell: "border-amber-200/80 bg-white shadow-[0_18px_45px_rgba(245,158,11,0.08)]",
      header: "border-amber-100 bg-gradient-to-r from-amber-50 via-orange-50 to-white",
      icon: "bg-amber-500 text-white shadow-[0_10px_24px_rgba(245,158,11,0.22)]",
      text: "text-amber-700",
    },
    slate: {
      shell: "border-slate-200/80 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.06)]",
      header: "border-slate-100 bg-gradient-to-r from-slate-50 via-white to-white",
      icon: "bg-slate-700 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]",
      text: "text-slate-700",
    },
  };
  const currentTone = tones[tone];

  return (
    <section id={id} className={`overflow-hidden rounded-[28px] border ${currentTone.shell}`}>
      <div className={`border-b px-5 py-4 sm:px-6 ${currentTone.header}`}>
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${currentTone.icon}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className={`text-[11px] font-bold uppercase tracking-[0.22em] ${currentTone.text}`}>
              Bloque
            </div>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{title}</h3>
            {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-4 sm:p-6">{children}</div>
    </section>
  );
}

export default function AdminPanel({ section, publicationsView = "overview" }: AdminPanelProps) {
  const { locale, t } = useTranslation();
  const router = useRouter();
  const adminRootRef = useRef<HTMLDivElement | null>(null);
  const isNewPublicationPage = publicationsView === "new";
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>([]);
  const [filterGroups, setFilterGroups] = useState<FilterGroup[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [travelServices, setTravelServices] = useState<TravelService[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [featuredPlanPrices, setFeaturedPlanPrices] = useState<FeaturedPlanPriceItem[]>([]);
  const [dlocalSubscriptionPlans, setDlocalSubscriptionPlans] = useState<DlocalSubscriptionPlanItem[]>([]);
  const [travelServicePayments, setTravelServicePayments] = useState<TravelServicePaymentItem[]>([]);
  const [dashboardServiceHistory, setDashboardServiceHistory] = useState<DashboardServiceHistory[]>([]);
  const [dashboardPublicationHistory, setDashboardPublicationHistory] = useState<DashboardPublicationHistory[]>([]);
  const [dashboardPassportSelections, setDashboardPassportSelections] = useState<DashboardPassportSelection[]>([]);
  const [dashboardDestinationSearches, setDashboardDestinationSearches] = useState<DashboardDestinationSearch[]>([]);
  const [countryCatalog, setCountryCatalog] = useState<string[]>([]);
  const [userTab, setUserTab] = useState<"oferentes" | "demandantes">("oferentes");
  const [userSearch, setUserSearch] = useState("");
  const [detailTravelService, setDetailTravelService] = useState<TravelService | null>(null);
  const [detailPaymentEmail, setDetailPaymentEmail] = useState<string | null>(null);
  const [detailImageExpanded, setDetailImageExpanded] = useState<string | null>(null);
  const [publicationTab, setPublicationTab] = useState<"publicaciones" | "denuncias">("publicaciones");
  const [publicationSearch, setPublicationSearch] = useState("");
  const [publicationTypeFilter, setPublicationTypeFilter] = useState<"todas" | "publicacion" | "prestacion">("todas");
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [promoCodeDraft, setPromoCodeDraft] = useState("");
  const [promoDiscountDraft, setPromoDiscountDraft] = useState("10");
  const [promoExpiresDraft, setPromoExpiresDraft] = useState("");
  const [promoMaxUsesDraft, setPromoMaxUsesDraft] = useState("");
  const [promoScopeDraft, setPromoScopeDraft] = useState<"all" | "partners">("all");
  const [promoActiveDraft, setPromoActiveDraft] = useState(true);
  const [promoEditId, setPromoEditId] = useState<string | null>(null);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoMessage, setPromoMessage] = useState("");
  const [priceRuleCountryDraft, setPriceRuleCountryDraft] = useState("");
  const [priceRulePlanTypeDraft, setPriceRulePlanTypeDraft] = useState<"featured_120d" | "featured_monthly">("featured_120d");
  const [priceRuleCurrencyDraft, setPriceRuleCurrencyDraft] = useState<"ARS" | "USD">("USD");
  const [priceRuleAmountDraft, setPriceRuleAmountDraft] = useState("");
  const [priceRuleDurationDaysDraft, setPriceRuleDurationDaysDraft] = useState("120");
  const [priceRuleDefaultDraft, setPriceRuleDefaultDraft] = useState(false);
  const [priceRuleActiveDraft, setPriceRuleActiveDraft] = useState(true);
  const [priceRuleEditId, setPriceRuleEditId] = useState<string | null>(null);
  const [priceRuleSaving, setPriceRuleSaving] = useState(false);
  const [priceRuleMessage, setPriceRuleMessage] = useState("");
  const [priceRuleProviderModeDraft, setPriceRuleProviderModeDraft] = useState<"api" | "manual">("api");
  const [priceRuleSubscriptionPlanIdDraft, setPriceRuleSubscriptionPlanIdDraft] = useState<string | null>(null);
  const [priceRuleSubscriptionNameDraft, setPriceRuleSubscriptionNameDraft] = useState("");
  const [priceRuleSubscriptionDescriptionDraft, setPriceRuleSubscriptionDescriptionDraft] = useState("");
  const [priceRuleSubscriptionDayOfMonthDraft, setPriceRuleSubscriptionDayOfMonthDraft] = useState("");
  const [priceRuleSubscriptionMaxPeriodsDraft, setPriceRuleSubscriptionMaxPeriodsDraft] = useState("");
  const [priceRuleSubscriptionSuccessUrlDraft, setPriceRuleSubscriptionSuccessUrlDraft] = useState("");
  const [priceRuleSubscriptionBackUrlDraft, setPriceRuleSubscriptionBackUrlDraft] = useState("");
  const [priceRuleSubscriptionErrorUrlDraft, setPriceRuleSubscriptionErrorUrlDraft] = useState("");
  const [priceRuleSubscriptionNotificationUrlDraft, setPriceRuleSubscriptionNotificationUrlDraft] = useState("");
  const [priceRuleSubscriptionManualUrlDraft, setPriceRuleSubscriptionManualUrlDraft] = useState("");
  const [priceRuleShowUrlConfigDraft, setPriceRuleShowUrlConfigDraft] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Record<string, boolean>>({});
  const [expandedPanelBlocks, setExpandedPanelBlocks] = useState<Record<string, boolean>>({});
  const [destinationCountrySearch, setDestinationCountrySearch] = useState("");
  const [originCountrySearch, setOriginCountrySearch] = useState("");
  const [passportCountrySearch, setPassportCountrySearch] = useState("");
  const [showPublicationEditor, setShowPublicationEditor] = useState(isNewPublicationPage);

  useEffect(() => {
    const root = adminRootRef.current;
    if (!root) return;

    let scheduled = false;
    const runNormalization = () => {
      normalizeAdminDomTree(root);
    };

    runNormalization();

    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        runNormalization();
      });
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "data-placeholder", "title", "aria-label", "alt", "value"],
    });

    return () => {
      observer.disconnect();
    };
  }, [section, publicationsView, loading]);

  useEffect(() => {
    if (priceRulePlanTypeDraft !== "featured_monthly") return;
    if (!priceRuleSubscriptionNameDraft) {
      setPriceRuleSubscriptionNameDraft(priceRuleCountryDraft && priceRuleCountryDraft !== "__ALL__"
        ? `Plan mensual ${priceRuleCountryDraft}`
        : "Plan mensual Travelgrin");
    }
  }, [
    priceRuleCountryDraft,
    priceRulePlanTypeDraft,
    priceRuleSubscriptionNameDraft,
  ]);

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
  const [blockVisibleInCard, setBlockVisibleInCard] = useState(false);
  const [initialBlockVisibleInCard, setInitialBlockVisibleInCard] = useState(false);
  const [blockError, setBlockError] = useState("");
  type BlockCategoryDraft = {
    id: string;
    lang: Lang;
    parentDraftId: string;
    taxonomyType: string;
    isPublicVisible: boolean;
    isPrimaryCategory: boolean;
    visibleInCard: boolean;
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
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentSectionTab, setPaymentSectionTab] = useState<"featured120" | "paid" | "pending" | "rejected" | "refunded">("featured120");
  const [approvedProviderPickerOpen, setApprovedProviderPickerOpen] = useState(false);
  const [approvedProviderExpandedEmail, setApprovedProviderExpandedEmail] = useState<string | null>(null);
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
  const [oferenteDestinationMode, setOferenteDestinationMode] = useState<OferenteDestinationMode>("all");
  const [oferenteDestinationCountries, setOferenteDestinationCountries] = useState<string[]>([]);
  const [oferenteDestinationSaving, setOferenteDestinationSaving] = useState(false);
  const [oferenteDestinationSaved, setOferenteDestinationSaved] = useState(false);
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
      rejected: "Rechazado",
      needs_info: "Falta info",
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
    const [cats, groups, pubs, services, reportsData, oferenteDestinations, dashboardHistory, promoCodesData, featuredPlanPricesData, dlocalSubscriptionPlansData, travelServicePaymentsData] = await Promise.all([
      api<{ ok: true; items: Category[] }>("/api/categories").then((d) => d.items),
      api<{ ok: true; groups: FilterGroup[] }>("/api/admin/filters").then((d) => d.groups),
      api<{ ok: true; items: Publication[] }>("/api/admin/publications").then((d) => d.items),
      api<{ ok: true; items: TravelService[] }>("/api/travel-services").then((d) => d.items),
      api<{ ok: true; items: ReportItem[] }>("/api/reports").then((d) => d.items),
      api<{ ok: true; mode?: OferenteDestinationMode; countries?: string[] }>("/api/admin/oferente-destinations").catch(() => ({ ok: true, mode: "all", countries: [] })),
      api<{
        ok: true;
        serviceHistory?: DashboardServiceHistory[];
        publicationHistory?: DashboardPublicationHistory[];
        passportSelections?: DashboardPassportSelection[];
        destinationSearches?: DashboardDestinationSearch[];
      }>("/api/admin/dashboard-history").catch(() => ({ ok: true, serviceHistory: [], publicationHistory: [], passportSelections: [], destinationSearches: [] })),
      api<{ ok: true; items: PromoCodeItem[] }>("/api/admin/promo-codes").catch(() => ({ ok: true, items: [] })),
      api<{ ok: true; items: FeaturedPlanPriceItem[] }>("/api/admin/featured-plan-prices").catch(() => ({ ok: true, items: [] })),
      api<{ ok: true; items: DlocalSubscriptionPlanItem[] }>("/api/admin/dlocal-subscription-plans").catch(() => ({ ok: true, items: [] })),
      api<{ ok: true; items: TravelServicePaymentItem[] }>("/api/admin/travel-service-payments").catch(() => ({ ok: true, items: [] })),
    ]);

    setCategories(cats);
    setFilterGroups(
      groups
        .filter((group) => group.key !== "oferente_destination_availability")
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    );
    setPublications(pubs);
    setTravelServices(services);
    setReports(reportsData);
    setDashboardServiceHistory(Array.isArray(dashboardHistory?.serviceHistory) ? dashboardHistory.serviceHistory : []);
    setDashboardPublicationHistory(Array.isArray(dashboardHistory?.publicationHistory) ? dashboardHistory.publicationHistory : []);
    setDashboardPassportSelections(Array.isArray(dashboardHistory?.passportSelections) ? dashboardHistory.passportSelections : []);
    setDashboardDestinationSearches(Array.isArray(dashboardHistory?.destinationSearches) ? dashboardHistory.destinationSearches : []);
    setPromoCodes(Array.isArray(promoCodesData?.items) ? promoCodesData.items : []);
    setFeaturedPlanPrices(Array.isArray(featuredPlanPricesData?.items) ? featuredPlanPricesData.items : []);
    setDlocalSubscriptionPlans(Array.isArray(dlocalSubscriptionPlansData?.items) ? dlocalSubscriptionPlansData.items : []);
    setTravelServicePayments(Array.isArray(travelServicePaymentsData?.items) ? travelServicePaymentsData.items : []);
    setOferenteDestinationMode(oferenteDestinations?.mode === "some" ? "some" : "all");
    setOferenteDestinationCountries(
      Array.isArray(oferenteDestinations?.countries)
        ? oferenteDestinations.countries.map((entry) => String(entry ?? "").trim()).filter(Boolean)
        : []
    );
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
    fetch("/api/countries")
      .then((res) => res.json())
      .then((payload) => {
        if (!active) return;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const names = Array.isArray(items)
          ? items
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

  async function applyOferenteDestinationConfig() {
    try {
      setOferenteDestinationSaving(true);
      setOferenteDestinationSaved(false);
      const payload = {
        mode: oferenteDestinationMode,
        countries: oferenteDestinationMode === "some" ? oferenteDestinationCountries : [],
      };
      const response = await api<{ ok: true; mode?: OferenteDestinationMode; countries?: string[] }>(
        "/api/admin/oferente-destinations",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      setOferenteDestinationMode(response?.mode === "some" ? "some" : "all");
      setOferenteDestinationCountries(
        Array.isArray(response?.countries)
          ? response.countries.map((entry) => String(entry ?? "").trim()).filter(Boolean)
          : []
      );
      setOferenteDestinationSaved(true);
      window.setTimeout(() => setOferenteDestinationSaved(false), 3500);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "No se pudo aplicar la configuración.");
      window.setTimeout(() => setSaveMessage(""), 3500);
    } finally {
      setOferenteDestinationSaving(false);
    }
  }

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
  const formatAdminTaxonomyTypeLabel = (input: string) => {
    switch (normalizeTaxonomyTypeAlias(input || "categoria")) {
      case "categoria":
        return "Categoría";
      case "prestacion":
        return "Prestación";
      case "idiomas":
        return "Idiomas";
      case "modalidad":
        return "Modalidad";
      case "actividad":
        return "Actividad";
      case "tipos":
        return "Tipos";
      default: {
        const trimmed = String(input ?? "").trim();
        return trimmed ? `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}` : "Categoría";
      }
    }
  };
  const formatAdminBlockLabel = (label: string, taxonomyType: string) => {
    const trimmedLabel = String(label ?? "").trim();
    if (!trimmedLabel) return formatAdminTaxonomyTypeLabel(taxonomyType);
    return normalizeComparable(trimmedLabel) === normalizeComparable(taxonomyType)
      ? formatAdminTaxonomyTypeLabel(taxonomyType)
      : trimmedLabel;
  };

  const priceSymbolByCurrency: Record<string, string> = {
    ARS: "$",
    USD: "US$",
    EUR: "€",
    BRL: "R$",
    JPY: "¥",
    GBP: "£",
  };

  const createEmptyBlockCategoryDraft = (
    parentDraftId = "",
    visibleInCardDefault = false,
  ): BlockCategoryDraft => ({
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    lang: "es",
    parentDraftId,
    taxonomyType: "inherit",
    isPublicVisible: true,
    isPrimaryCategory: false,
    visibleInCard: !parentDraftId && visibleInCardDefault,
    iconImageUrl: "",
    cardImageUrl: "",
    nameI18n: { es: "", en: "", pt: "", it: "" },
  });

  const addBlockCategoryDraft = (parentDraftId = "") => {
    setBlockCategoryDrafts((prev) => [
      ...prev,
      createEmptyBlockCategoryDraft(parentDraftId, blockVisibleInCard),
    ]);
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
        visibleInCard: catIsPrimaryCategory,
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
        if (blockVisibleInCard !== initialBlockVisibleInCard) {
          const blockCategories = categories.filter((category) => category.blockId === savedBlockId);
          await Promise.all(blockCategories.map((category) =>
            api(`/api/admin/categories/${encodeURIComponent(category.id)}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                description: category.description,
                descriptionI18n: category.descriptionI18n ?? { es: category.description },
                taxonomyType: category.taxonomyType || "inherit",
                parentId: category.parentId ?? null,
                blockId: category.blockId ?? savedBlockId,
                isPublicVisible: category.isPublicVisible !== false,
                isPrimaryCategory: category.isPrimaryCategory === true,
                visibleInCard: blockVisibleInCard ? (category.visibleInCard ?? category.isPrimaryCategory) === true : false,
                iconImageUrl:
                  blockVisibleInCard && ((category.visibleInCard ?? category.isPrimaryCategory) === true)
                    ? (category.iconImageUrl ?? null)
                    : null,
                cardImageUrl:
                  blockVisibleInCard && ((category.visibleInCard ?? category.isPrimaryCategory) === true)
                    ? (category.cardImageUrl ?? null)
                    : null,
                order: category.order ?? 0,
              }),
            })
          ));
        }
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
        const normalizedDrafts = blockCategoryDrafts.map((draft) => ({
          ...draft,
          visibleInCard: blockVisibleInCard ? draft.visibleInCard : false,
        }));
        const draftById = new Map(normalizedDrafts.map((draft) => [draft.id, draft]));
        const draftIdsByParent = new Map<string, string[]>();
        normalizedDrafts.forEach((draft) => {
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
                visibleInCard: draft.visibleInCard,
                iconImageUrl: draft.visibleInCard ? (draft.iconImageUrl.trim() || null) : null,
                cardImageUrl: draft.visibleInCard ? (draft.cardImageUrl.trim() || null) : null,
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
      setBlockVisibleInCard(false);
      setInitialBlockVisibleInCard(false);
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
    const shouldStartAsPrimaryCategory = Boolean(
      blockId &&
      !parentId &&
    categories.some((category) => category.blockId === blockId && (category.visibleInCard ?? category.isPrimaryCategory) === true)
    );
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
    setCatIsPrimaryCategory(shouldStartAsPrimaryCategory);
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
    setBlockVisibleInCard(false);
    setInitialBlockVisibleInCard(false);
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
    const nextBlockLabelI18n = { es: "", en: "", pt: "", it: "", ...((group.labelI18n as I18nRecord) ?? { es: group.label }) };
    const rawSpanishLabel = String(nextBlockLabelI18n.es || group.label || "").trim();
    const taxonomyAlias = normalizeTaxonomyTypeAlias(group.taxonomyType ?? "categoria");
    if (normalizeComparable(rawSpanishLabel) === normalizeComparable(taxonomyAlias)) {
      nextBlockLabelI18n.es = formatAdminTaxonomyTypeLabel(taxonomyAlias);
    }
    setBlockLabelI18n(nextBlockLabelI18n);
    setBlockImageUrl(group.imageUrl ?? "");
    setBlockTaxonomyType(group.taxonomyType ?? "categoria");
    setBlockIsPublicVisible(group.isPublicVisible !== false);
    const hasVisibleInCard = categories.some((category) => category.blockId === group.id && (category.visibleInCard ?? category.isPrimaryCategory) === true);
    setBlockVisibleInCard(hasVisibleInCard);
    setInitialBlockVisibleInCard(hasVisibleInCard);
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
    const selectedPrestacionRoot = pEditorMode === "prestacion"
      ? prestacionRoots.find((option) => normalizeComparable(option.description) === normalizeComparable(normalizedPrestacionCategory))
      : null;
    const selectedPrestacionCategoryI18n = normalizedPrestacionCategory
      ? (selectedPrestacionRoot?.descriptionI18n ?? { es: normalizedPrestacionCategory })
      : null;
    const existingImageAssets = Array.isArray((pFieldsBase as any).imageAssets)
      ? ((pFieldsBase as any).imageAssets as ImageAsset[])
      : [];
    const uploadedAssetsByUrl = new Map<string, ImageAsset>(pImageUploadAssets.map((asset) => [asset.url, asset] as const));
    const existingAssetsByUrl = new Map<string, ImageAsset>(
      existingImageAssets
        .map((asset) => [imageAssetToUrl(asset), asset] as const)
        .filter((entry): entry is readonly [string, ImageAsset] => Boolean(entry[0]))
    );
    const optimizedImageAssets: ImageAsset[] = imageList.length
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
      categoryI18n: pEditorMode === "prestacion"
        ? selectedPrestacionCategoryI18n
        : (pCategoryI18n || null),
      subcategory: pEditorMode === "prestacion"
        ? (normalizedPrestacionCategory || null)
        : (pSubcategorySelections[0] || pSubcategory || null),
      subcategoryI18n: pEditorMode === "prestacion"
        ? selectedPrestacionCategoryI18n
        : (pSubcategoryI18n || null),
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
              visibleInCard: booleanLike(d.visibleInCard),
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
    if (pStatus === "active") {
      (payload.fields as Record<string, any>).needsAdminReview = false;
      (payload.fields as Record<string, any>).adminReviewReason = null;
      (payload.fields as Record<string, any>).adminReviewResolvedAt = new Date().toISOString();
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

  async function updatePublicationStatus(id: string, status: "active" | "rejected" | "needs_info") {
    await api("/api/admin/publications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
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
    const existingImages = Array.isArray(pub.images)
      ? pub.images
      : typeof pub.images === "string"
        ? splitLines(pub.images)
        : [];
    const imageAssets = Array.isArray((pub.fields as any)?.imageAssets) ? ((pub.fields as any).imageAssets as ImageAsset[]) : [];
    const existingImageEntries = Array.from(
      new Set(
        [
          ...existingImages.flatMap((img) => splitLines(String(img ?? ""))),
          ...imageAssets.map((asset) => imageAssetToUrl(asset)).map((url) => String(url ?? "").trim()).filter(Boolean),
        ].filter((url) => Boolean(url) && isUsableImageUrl(String(url)))
      )
    );
    const imageUrls = existingImageEntries.filter((img) => !String(img).startsWith("data:image"));
    const imageUploads = existingImageEntries.filter((img) => String(img).startsWith("data:image"));
    setPImageUrls(imageUrls.join("\n"));
    setPImageUploads(imageUploads);
    setPImageUploadAssets(imageAssets);
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
    const resolvedPrestacionCategory =
      String((pub.fields as any)?.prestationResources?.[0]?.prestationRef ?? "").trim() ||
      String((pub.fields as any)?.prestationSteps?.[0]?.prestationRef ?? "").trim() ||
      String((pub.fields as any)?.prestationFaqs?.[0]?.prestationRef ?? "").trim() ||
      String((pub.fields as any)?.prestationColorBlocks?.[0]?.prestationRef ?? "").trim() ||
      (Array.isArray((pub.fields as any)?.prestaciones) && (pub.fields as any).prestaciones.length
        ? String((pub.fields as any).prestaciones[0] ?? "").trim()
        : "");
    setPPrestacionCategory(resolvedPrestacionCategory);
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
              visibleInCard: booleanLike(d?.visibleInCard),
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
      .split(/\r?\n+/)
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
    const all = [...urls, ...uploads].filter(isUsableImageUrl);
    return Array.from(new Set(all));
  }, [pImageUrls, pImageUploads]);
  const removeImage = (img: string) => {
    setPImageUploads((prev) => prev.filter((item) => item !== img));
    setPImageUrls((prev) => splitLines(prev).filter((item) => item !== img).join("\n"));
    setPImageUploadAssets((prev) => prev.filter((asset) => imageAssetToUrl(asset) !== img));
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
            visibleInCard: (source.visibleInCard ?? source.isPrimaryCategory) === true,
            iconImageUrl: (source.visibleInCard ?? source.isPrimaryCategory) === true ? (source.iconImageUrl ?? null) : null,
            cardImageUrl: (source.visibleInCard ?? source.isPrimaryCategory) === true ? (source.cardImageUrl ?? null) : null,
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

  const today = new Date();
  const isCurrentMonthDate = (value?: string | null) => {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  const activePublicationHistory = dashboardPublicationHistory.filter(
    (item) => !item.isDeleted && isActivePublicationLifecycle(item.status)
  );
  const activePublications = activePublicationHistory;
  const monthlyActivePublications = activePublicationHistory.filter((item) => isCurrentMonthDate(item.createdAt)).length;

  const isPanelSection = section === "panel";
  const isUsersSection = section === "usuarios";
  const isCategoriesSection = section === "categorias";
  const isPublicationsSection = section === "publicaciones";
  const isFeedbackSection = section === "feedback";
  const isHowWorksSection = section === "como-funciona";
  const isConfigSection = section === "configuracion";
  const isContactSection = section === "contacto";


  const HOME_HOW_TAG = "home-how-it-works";
  const isHomeHowPublication = (item?: Publication | null) => String(item?.category ?? "") === HOME_HOW_TAG;
  const homeHowPublication = publications.find((item) => String(item.category ?? "") === HOME_HOW_TAG);
  const [homeHowTitle, setHomeHowTitle] = useState("Cómo funciona");
  const [homeHowTitleI18n, setHomeHowTitleI18n] = useState<I18nRecord>({ es: "Cómo funciona" });
  const [homeHowSteps, setHomeHowSteps] = useState<any[]>([{ title: "", titleI18n: { es: "" }, subtitle: "", subtitleI18n: { es: "" }, image: "", imageI18n: { es: "" } }]);
  const [homeHowSaving, setHomeHowSaving] = useState(false);
  const [homeHowSaveMessage, setHomeHowSaveMessage] = useState("");

  useEffect(() => {
    const steps = Array.isArray((homeHowPublication as any)?.fields?.prestationSteps) ? (homeHowPublication as any).fields.prestationSteps : [];
    const title = String((homeHowPublication as any)?.title ?? "Cómo funciona") || "Cómo funciona";
    setHomeHowTitle(title);
    setHomeHowTitleI18n((homeHowPublication as any)?.titleI18n ?? { es: title });
    setHomeHowSteps(steps.length ? steps : [{ title: "", titleI18n: { es: "" }, subtitle: "", subtitleI18n: { es: "" }, image: "", imageI18n: { es: "" } }]);
  }, [homeHowPublication?.id]);

  const homeHowHasContent = (step: any) => Boolean(
    step?.title || step?.subtitle || step?.image ||
    Object.values((step?.titleI18n ?? {}) as Record<string, string>).some(Boolean) ||
    Object.values((step?.subtitleI18n ?? {}) as Record<string, string>).some(Boolean) ||
    Object.values((step?.imageI18n ?? {}) as Record<string, string>).some(Boolean)
  );

  const deleteHomeHowPublication = async () => {
    if (!homeHowPublication?.id) return;
    const response = await fetch(`/api/admin/publications?id=${homeHowPublication.id}`, { method: "DELETE" });
    if (!response.ok) throw new Error("No se pudo quitar la seccion.");
    await refresh();
  };

  const removeHomeHowStep = (idx: number) => {
    const nextSteps = homeHowSteps.filter((_, i) => i !== idx);
    setHomeHowSteps(nextSteps);
    setHomeHowSaveMessage("");
    if (!nextSteps.some(homeHowHasContent) && homeHowPublication?.id) {
      setHomeHowSaving(true);
      void deleteHomeHowPublication()
        .then(() => setHomeHowSaveMessage("Se quito la publicacion de Como funciona."))
        .catch(() => setHomeHowSaveMessage("No se pudo quitar. Intenta nuevamente."))
        .finally(() => setHomeHowSaving(false));
    }
  };

  const saveHomeHowWorks = async () => {
    setHomeHowSaving(true);
    setHomeHowSaveMessage("");
    try {
      const stepsToPublish = homeHowSteps.filter(homeHowHasContent);
      if (!stepsToPublish.length) {
        await deleteHomeHowPublication();
        setHomeHowSaveMessage("No hay pasos para publicar.");
        setHomeHowSaving(false);
        return;
      }
      const resolvedTitle = firstNonEmptyI18n(homeHowTitleI18n, homeHowTitle) || "Cómo funciona";
      const payload = {
        title: resolvedTitle,
        titleI18n: { ...homeHowTitleI18n, es: homeHowTitleI18n.es || resolvedTitle },
        description: "Sección Home: Cómo funciona",
        status: "active",
        featured: false,
        category: HOME_HOW_TAG,
        primaryGroupKey: "home-how-it-works",
        fields: { prestationSteps: stepsToPublish },
        filterOptionIds: [],
      };
      const url = homeHowPublication?.id ? `/api/admin/publications?id=${homeHowPublication.id}` : "/api/admin/publications";
      const method = homeHowPublication?.id ? "PUT" : "POST";
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("No se pudo guardar la seccion.");
      await refresh();
      setHomeHowSaveMessage("Se guardo exitosamente.");
    } catch {
      setHomeHowSaveMessage("No se pudo guardar. Intenta nuevamente.");
    } finally { setHomeHowSaving(false); }
  };
  const paidPublications = publications.filter((item) => {
    const value = String(item.price ?? "").trim();
    return Boolean(value) && value !== "0";
  });
  const freePublicationsList = publications.filter((item) => !String(item.price ?? "").trim() || item.price === "0");
  const freePublications = freePublicationsList.length;

  const userOferentes = travelServices.filter((item) => String(item.taxonomyType ?? "").toLowerCase() === "oferente");
  const userDemandantes = travelServices.filter((item) => String(item.taxonomyType ?? "").toLowerCase() !== "oferente");
  const uniqueUserOferentes = useMemo(() => {
    const grouped = new Map<string, TravelService>();
    userOferentes.forEach((item) => {
      const key = providerRootEmail(item) || `service:${item.id}`;
      const current = grouped.get(key);
      const currentTime = current ? travelServiceActivityTime(current) : 0;
      const nextTime = travelServiceActivityTime(item);
      if (!current || nextTime >= currentTime) grouped.set(key, item);
    });
    return Array.from(grouped.values()).sort((a, b) => travelServiceActivityTime(b) - travelServiceActivityTime(a));
  }, [userOferentes]);
  const firstOferenteDisplayNameByEmail = useMemo(() => {
    const grouped = new Map<string, TravelService>();
    userOferentes.forEach((item) => {
      const key = providerRootEmail(item) || `service:${item.id}`;
      const current = grouped.get(key);
      const currentTime = current?.createdAt ? new Date(current.createdAt).getTime() : Number.POSITIVE_INFINITY;
      const nextTime = item.createdAt ? new Date(item.createdAt).getTime() : Number.POSITIVE_INFINITY;
      if (!current || nextTime < currentTime) grouped.set(key, item);
    });
    return new Map(Array.from(grouped.entries()).map(([key, item]) => [key, providerDisplayName(item)]));
  }, [userOferentes]);
  const activeUserOferentes = uniqueUserOferentes.filter((item) => isActiveServiceLifecycle(serviceEffectiveStatus(item))).length;
  const inactiveUserOferentes = Math.max(uniqueUserOferentes.length - activeUserOferentes, 0);
  const activeUserDemandantes = userDemandantes.filter((item) => isActiveServiceLifecycle(serviceEffectiveStatus(item))).length;
  const inactiveUserDemandantes = Math.max(userDemandantes.length - activeUserDemandantes, 0);
  const oferentesPendientes = uniqueUserOferentes.filter((item) => serviceEffectiveStatus(item) === "pendiente").length;
  const oferentesAprobados = uniqueUserOferentes.filter((item) => serviceEffectiveStatus(item) === "aprobado").length;
  const oferentesRechazados = uniqueUserOferentes.filter((item) => serviceEffectiveStatus(item) === "rechazado").length;

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
      const best = normalizedCatalog.reduce<{ raw: string; distance: number } | null>((current, entry) => {
        const distance = levenshteinDistance(normalizedInput, entry.norm);
        return !current || distance < current.distance ? { raw: entry.raw, distance } : current;
      }, null);
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
      const fields = (publication.fields as Record<string, any> | undefined) ?? {};
      const rawCountries = [
        publication.country,
        ...(Array.isArray(fields.destinationCountries) ? fields.destinationCountries : []),
        ...(Array.isArray(fields.travelDestinations) ? fields.travelDestinations.map((entry: any) => entry?.country) : []),
      ];
      const keys = Array.from(new Set(rawCountries.map((country) => resolveCountryName(String(country ?? ""))).filter(Boolean))) as string[];
      keys.forEach((key) => {
        const current = map.get(key) ?? { total: 0, paid: 0, free: 0, visits: 0 };
        current.total += 1;
        if (String(publication.price ?? "").trim() && publication.price !== "0") current.paid += 1;
        else current.free += 1;
        map.set(key, current);
      });
    });

    dashboardDestinationSearches.forEach((search) => {
      const key = resolveCountryName(search.destinationCountry);
      if (!key) return;
      const current = map.get(key) ?? { total: 0, paid: 0, free: 0, visits: 0 };
      current.total += 1;
      current.visits += 1;
      map.set(key, current);
    });

    return Array.from(map.entries())
      .map(([country, values]) => ({ country, ...values }))
      .sort((a, b) => b.visits - a.visits || b.total - a.total || a.country.localeCompare(b.country));
  }, [countryCatalog, dashboardDestinationSearches, publications, resolveCountryName]);

  const originRows = useMemo(() => {
    const map = new Map<string, { publications: number; paid: number; free: number; categories: number; destinations: number; categorySet: Set<string>; destinationSet: Set<string> }>();
    const countriesBase = countryCatalog.length ? countryCatalog : [];
    countriesBase.forEach((country) =>
      map.set(country, { publications: 0, paid: 0, free: 0, categories: 0, destinations: 0, categorySet: new Set(), destinationSet: new Set() })
    );

    dashboardServiceHistory
      .filter((entry) => normalizeLifecycleStatus(entry.taxonomyType) === "oferente")
      .forEach((entry) => {
        const key = resolveCountryName(firstNonEmpty(entry.country, entry.headquarterCountry));
        if (!key) return;
        const current = map.get(key) ?? { publications: 0, paid: 0, free: 0, categories: 0, destinations: 0, categorySet: new Set(), destinationSet: new Set() };
        current.publications += 1;
        if (["featured", "monthly", "featured_120d", "featured_monthly"].includes(normalizeLifecycleStatus(entry.publicationPlan))) current.paid += 1;
        else current.free += 1;
        (entry.categories ?? []).forEach((category) => {
          if (category) current.categorySet.add(category);
        });
        const destination = resolveCountryName(entry.destinationCountry);
        if (destination) current.destinationSet.add(destination);
        current.categories = current.categorySet.size;
        current.destinations = current.destinationSet.size;
        map.set(key, current);
      });

    return Array.from(map.entries())
      .map(([country, values]) => ({
        country,
        publications: values.publications,
        paid: values.paid,
        free: values.free,
        categories: values.categories,
        destinations: values.destinations,
      }))
      .sort((a, b) => b.publications - a.publications || a.country.localeCompare(b.country));
  }, [countryCatalog, dashboardServiceHistory, resolveCountryName]);

  const passportVisitsRows = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const grouped = new Map<string, { total: number; monthly: number; destinationSet: Set<string> }>();
    const countriesBase = countryCatalog.length ? countryCatalog : [];
    countriesBase.forEach((country) => grouped.set(country, { total: 0, monthly: 0, destinationSet: new Set() }));

    dashboardPassportSelections.forEach((selection) => {
      const passport = resolveCountryName(selection.country);
      if (!passport) return;
      const current = grouped.get(passport) ?? { total: 0, monthly: 0, destinationSet: new Set() };
      current.total += 1;
      if (selection.createdAt && new Date(selection.createdAt) >= monthStart) current.monthly += 1;
      grouped.set(passport, current);
    });

    dashboardDestinationSearches.forEach((search) => {
      const passport = resolveCountryName(search.passportCountry);
      const destination = resolveCountryName(search.destinationCountry);
      if (!passport || !destination) return;
      const current = grouped.get(passport) ?? { total: 0, monthly: 0, destinationSet: new Set() };
      current.total += 1;
      if (search.createdAt && new Date(search.createdAt) >= monthStart) current.monthly += 1;
      current.destinationSet.add(destination);
      grouped.set(passport, current);
    });

    return Array.from(grouped.entries())
      .map(([country, values]) => ({
        country,
        total: values.total,
        perDay: Math.round(values.monthly / Math.max(now.getDate(), 1)),
        perMonth: values.monthly,
        avgDestinations: values.destinationSet.size,
      }))
      .sort((a, b) => b.total - a.total || a.country.localeCompare(b.country));
  }, [countryCatalog, dashboardDestinationSearches, dashboardPassportSelections, resolveCountryName]);

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

  const oferenteHistoryRows = useMemo(
    () => dashboardServiceHistory.filter((item) => normalizeLifecycleStatus(item.taxonomyType) === "oferente"),
    [dashboardServiceHistory]
  );
  const demandanteHistoryRows = useMemo(
    () => dashboardServiceHistory.filter((item) => normalizeLifecycleStatus(item.taxonomyType) !== "oferente"),
    [dashboardServiceHistory]
  );
  const monthlyUserOferentes = uniqueUserOferentes.filter((item) => isCurrentMonthDate(item.createdAt)).length;
  const monthlyActiveUserOferentes = uniqueUserOferentes.filter(
    (item) => isActiveServiceLifecycle(serviceEffectiveStatus(item)) && isCurrentMonthDate(item.createdAt)
  ).length;
  const monthlyUserDemandantes = demandanteHistoryRows.filter((item) => isCurrentMonthDate(item.createdAt)).length;
  const monthlyActiveUserDemandantes = demandanteHistoryRows.filter(
    (item) => !item.isDeleted && isActiveServiceLifecycle(item.lifecycleStatus) && isCurrentMonthDate(item.createdAt)
  ).length;
  const oferentesData = useMemo(
    () =>
      seriesFromDates(
        toDates(oferenteHistoryRows.filter((item) => !item.isDeleted && isActiveServiceLifecycle(item.lifecycleStatus)).map((item) => item.createdAt)),
        toDates(oferenteHistoryRows.filter((item) => item.isDeleted || !isActiveServiceLifecycle(item.lifecycleStatus)).map((item) => item.createdAt))
      ),
    [oferenteHistoryRows]
  );
  const demandantesData = useMemo(
    () =>
      seriesFromDates(
        toDates(demandanteHistoryRows.filter((item) => !item.isDeleted && isActiveServiceLifecycle(item.lifecycleStatus)).map((item) => item.createdAt)),
        toDates(demandanteHistoryRows.filter((item) => item.isDeleted || !isActiveServiceLifecycle(item.lifecycleStatus)).map((item) => item.createdAt))
      ),
    [demandanteHistoryRows]
  );
  const publicationsData = useMemo(
    () =>
      seriesFromDates(
        toDates(
          dashboardPublicationHistory
            .filter((item) => Boolean(String(item.price ?? "").trim()) && item.price !== "0")
            .map((item) => item.createdAt)
        ),
        toDates(
          dashboardPublicationHistory
            .filter((item) => !String(item.price ?? "").trim() || item.price === "0")
            .map((item) => item.createdAt)
        )
    ),
    [dashboardPublicationHistory]
  );
  const feedbackReports = useMemo(
    () => reports.filter(isFeedbackReport),
    [reports]
  );
  const complaintReports = useMemo(
    () => reports.filter((item) => !isFeedbackReport(item)),
    [reports]
  );
  const reportsData = useMemo(
    () => seriesFromDates(toDates(complaintReports.map((item) => item.createdAt))),
    [complaintReports]
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
  const selectedOferenteCards = useMemo(() => {
    const grouped = new Map<string, TravelService>();
    selectedUsers.forEach((item) => {
      if (String(item.taxonomyType ?? "").toLowerCase() !== "oferente") return;
      const key = providerRootEmail(item);
      if (!key) return;
      const current = grouped.get(key);
      const currentTime = current ? travelServiceActivityTime(current) : 0;
      const nextTime = travelServiceActivityTime(item);
      if (!current || nextTime >= currentTime) grouped.set(key, item);
    });
    return Array.from(grouped.values()).sort((a, b) => {
      const aTime = travelServiceActivityTime(a);
      const bTime = travelServiceActivityTime(b);
      return bTime - aTime;
    });
  }, [selectedUsers]);

  const approvedOferentes = useMemo(
    () => userOferentes.filter((item) => serviceEffectiveStatus(item) === "aprobado"),
    [userOferentes]
  );
  const serviceSubmissionCountsByEmail = useMemo(() => {
    const map = new Map<string, number>();
    travelServices.forEach((service) => {
      const email = providerRootEmail(service);
      if (!email) return;
      map.set(email, (map.get(email) ?? 0) + 1);
    });
    return map;
  }, [travelServices]);
  const filteredApprovedOferentes = useMemo(() => {
    const query = pApprovedProviderSearch.trim().toLowerCase();
    if (!query) return approvedOferentes;
    return approvedOferentes.filter((service) => {
      const label = providerDisplayName(service);
      return [label, service.email].some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [approvedOferentes, pApprovedProviderSearch]);
  const approvedOferentesGrouped = useMemo(() => {
    const groups = new Map<string, { email: string; label: string; services: TravelService[] }>();
    filteredApprovedOferentes.forEach((service) => {
      const email = providerRootEmail(service);
      if (!email) return;
      const label = providerDisplayName(service);
      const current = groups.get(email) ?? { email, label, services: [] };
      current.services.push(service);
      if (!current.label && label) current.label = label;
      groups.set(email, current);
    });
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        services: [...group.services].sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        }),
      }))
      .sort((a, b) => {
        const aTime = a.services[0]?.createdAt ? new Date(a.services[0].createdAt).getTime() : 0;
        const bTime = b.services[0]?.createdAt ? new Date(b.services[0].createdAt).getTime() : 0;
        return bTime - aTime;
      });
  }, [filteredApprovedOferentes]);
  const visibleFeaturedPlanPrices = useMemo(
    () => featuredPlanPrices.filter((item) => item.planType !== "featured_monthly"),
    [featuredPlanPrices]
  );
  const visibleTravelServicePayments = useMemo(
    () => travelServicePayments.filter((item) => item.planType !== "featured_monthly"),
    [travelServicePayments]
  );
  const paymentCounts = useMemo(() => ({
    featured120: visibleTravelServicePayments.length,
    paid: visibleTravelServicePayments.filter((item) => item.status === "paid").length,
    pending: visibleTravelServicePayments.filter((item) => item.status === "pending" || item.status === "processing").length,
    rejected: visibleTravelServicePayments.filter((item) => item.status === "failed" || item.status === "cancelled").length,
    refunded: visibleTravelServicePayments.filter((item) => readRefundSnapshot(item.raw) !== "-").length,
  }), [visibleTravelServicePayments]);
  const paymentSections = useMemo(() => {
    const buildGroups = (items: TravelServicePaymentItem[]) => {
      const grouped = new Map<string, { email: string; label: string; latestAt: number; items: TravelServicePaymentItem[] }>();
      items.forEach((item) => {
        const email = String(item.payerEmail ?? "").trim().toLowerCase();
        if (!email) return;
        const relatedService = userOferentes.find((service) => String(service.email ?? "").trim().toLowerCase() === email);
        const current = grouped.get(email) ?? {
          email,
          label: relatedService ? providerDisplayName(relatedService) : (email.split("@")[0] || email),
          latestAt: 0,
          items: [],
        };
        current.items.push(item);
        const nextTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
        if (nextTime >= current.latestAt) {
          current.latestAt = nextTime;
          current.label = relatedService ? providerDisplayName(relatedService) : current.label;
        }
        grouped.set(email, current);
      });
      return Array.from(grouped.values())
        .map((group) => ({
          ...group,
          items: [...group.items].sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTime - aTime;
          }),
        }))
        .sort((a, b) => b.latestAt - a.latestAt);
    };

    return [
      {
        key: "featured120",
        title: "Movimientos de pago",
        items: buildGroups(visibleTravelServicePayments),
      },
      {
        key: "paid",
        title: "Pagos aceptados",
        items: buildGroups(visibleTravelServicePayments.filter((item) => item.status === "paid")),
      },
      {
        key: "pending",
        title: "Pagos pendientes / en proceso",
        items: buildGroups(visibleTravelServicePayments.filter((item) => item.status === "pending" || item.status === "processing")),
      },
      {
        key: "rejected",
        title: "Pagos rechazados / cancelados",
        items: buildGroups(visibleTravelServicePayments.filter((item) => item.status === "failed" || item.status === "cancelled")),
      },
      {
        key: "refunded",
        title: "Reembolsos",
        items: buildGroups(visibleTravelServicePayments.filter((item) => readRefundSnapshot(item.raw) !== "-")),
      },
    ];
  }, [userOferentes, visibleTravelServicePayments]);
  const visiblePaymentSections = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();
    if (!query) return paymentSections;
    return paymentSections.map((section) => ({
      ...section,
      items: section.items.filter((group) =>
        [group.label, group.email].some((value) => String(value ?? "").toLowerCase().includes(query))
      ),
    }));
  }, [paymentSearch, paymentSections]);
  const selectedPaymentSection = visiblePaymentSections.find((section) => section.key === paymentSectionTab) ?? visiblePaymentSections[0] ?? null;

  const publicationsByProviderEmail = useMemo(() => {
    const map = new Map<string, Publication[]>();
    publications.forEach((publication) => {
      const fields = (publication.fields as any) ?? {};
      const candidateEmails = [
        fields.providerEmail,
        fields.publisherEmail,
        fields.email,
        fields.contactEmail,
        fields.portalOwnerEmail,
        fields.ownerEmail,
        fields.provider?.email,
        fields.oferente?.email,
      ]
        .map((value) => String(value ?? "").trim().toLowerCase())
        .filter((value, index, self) => value.includes("@") && self.indexOf(value) === index);
      candidateEmails.forEach((providerEmail) => {
        const current = map.get(providerEmail) ?? [];
        current.push(publication);
        map.set(providerEmail, current);
      });
    });
    return map;
  }, [publications]);

  const publicationsById = useMemo(() => {
    const map = new Map<string, Publication>();
    publications.forEach((publication) => map.set(String(publication.id), publication));
    return map;
  }, [publications]);

  const reviewableEditRequestByPublicationId = useMemo(() => {
    const map = new Map<string, TravelService>();
    [...travelServices]
      .sort((a, b) => travelServiceActivityTime(a) - travelServiceActivityTime(b))
      .forEach((service) => {
        const extra = parseTravelServiceExtra(service);
        let sourcePublicationId = String(extra.sourcePublicationId ?? "").trim();
        if (!sourcePublicationId) {
          const sourceServiceId = String(extra.sourceServiceId ?? "").trim();
          const matchedPublication = sourceServiceId
            ? publications.find((publication) => {
                const fields = (publication.fields && typeof publication.fields === "object" ? publication.fields : {}) as Record<string, unknown>;
                return (
                  String(fields.sourceServiceId ?? "").trim() === sourceServiceId ||
                  String((publication as any).sourceServiceId ?? "").trim() === sourceServiceId ||
                  String((publication as any).relatedSubmissionId ?? "").trim() === sourceServiceId
                );
              })
            : null;
          sourcePublicationId = matchedPublication ? String(matchedPublication.id) : "";
        }
        if (!isPublicationLinkedReviewRequest(extra) || !sourcePublicationId) return;
        if (!isReviewableTravelService(service, extra)) return;
        map.set(sourcePublicationId, service);
      });
    return map;
  }, [publications, travelServices]);

  const updateTravelServiceStatus = async (id: string, status: "aprobado" | "rechazado" | "falta info" | "pendiente") => {
    const currentService = travelServices.find((service) => service.id === id);
    const currentExtra = currentService ? parseTravelServiceExtra(currentService) : {};
    const isLinkedPublicationReview = isPublicationLinkedReviewRequest(currentExtra);
    const needsReason = status === "rechazado" || status === "falta info";
    const reason = needsReason
      ? window.prompt(`Ingresá el motivo visible para "${status}":`, "") ?? ""
      : "";
    if (needsReason && !reason.trim()) {
      window.alert("El motivo es obligatorio para marcar la solicitud como Rechazado o Falta info.");
      return;
    }

    const statusPayload =
      status === "rechazado"
        ? "rejected"
        : status === "falta info"
          ? "needs_info"
          : status;

    await api<{ ok: boolean }>("/api/travel-services", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, status: statusPayload, reason: reason.trim() }),
    });
    await refresh();
    if (status === "aprobado" && isLinkedPublicationReview) {
      const requestKind = String(currentExtra.requestKind ?? "").trim().toLowerCase();
      const isRenewal = requestKind === "renew_free" || requestKind === "renew_featured_120d" || requestKind === "renew_featured_monthly";
      window.alert(isRenewal
        ? "Solicitud aprobada. La publicacion vinculada fue renovada y ya tiene nueva fecha de vencimiento."
        : "Solicitud aprobada. La publicacion vinculada quedo en Borrador para que la revises, ajustes y la guardes como Activo cuando este lista.");
    }
  };

  const updateRefundStatus = async (
    submissionId: string,
    action: "review" | "reject" | "approve_and_execute",
  ) => {
    const reason = action === "reject"
      ? (window.prompt("Ingresá el motivo interno para rechazar el reembolso:", "") ?? "").trim()
      : "";
    if (action === "reject" && !reason) {
      window.alert("El motivo es obligatorio para rechazar el reembolso.");
      return;
    }

    const response = await api<{ ok: boolean; item?: { refundStatus?: string; refundProviderError?: string } }>(
      "/api/admin/travel-service-payments/refund",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ submissionId, action, reason }),
      },
    );

    if (response?.item?.refundStatus === "refund_failed" && response?.item?.refundProviderError) {
      window.alert(`El refund quedó en estado fallido: ${response.item.refundProviderError}`);
    }

    if (detailTravelService?.id === submissionId) {
      setDetailTravelService(null);
      setDetailImageExpanded(null);
    }
    if (detailPaymentEmail) {
      setDetailPaymentEmail(null);
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
    setApprovedProviderPickerOpen(false);
    setApprovedProviderExpandedEmail(null);
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
    const detailedFormLinks = Array.isArray(extra.socialLinksDetailed)
      ? (extra.socialLinksDetailed as Array<Record<string, unknown>>)
          .map((entry) => ({
            kind: String(entry.kind ?? "web").trim() || "web",
            label: String(entry.label ?? "").trim(),
            url: String(entry.url ?? "").trim(),
          }))
          .filter((entry) => entry.url)
      : [];
    const extraVenues = Array.isArray(extra.venues) ? extra.venues as Array<Record<string, unknown>> : [];
    const receivingMode = String(extra.receivingCountriesMode ?? "all").toLowerCase();
    const normalizedReceivingMode = receivingMode === "except" || receivingMode === "only" ? receivingMode : "all";
    const receivingCountries = normalizeStringArray(extra.receivingCountries as string[] | string | undefined);

    setPPublisherName(providerDisplayName(selected));
    setPProviderEmail(selected.email || "");
    const selectedPlanRaw = String(extra.requestedPlan ?? extra.publicationPlan ?? selected.publicationPlan ?? "").trim().toLowerCase();
    const isSelectedPaidPlan = ["featured", "featured_120d", "monthly", "featured_monthly"].includes(selectedPlanRaw);
    setPFeatured(isSelectedPaidPlan);
    setPProviderLogo(providerLogo);
    setPFieldsBase((prev) => ({
      ...prev,
      imageAssets,
      providerLogoAsset: (extra.providerLogoAsset as ImageAsset | undefined) ?? null,
      sourceServiceId: selected.id,
      requestKind: String(extra.requestKind ?? "").trim() || null,
      previousPlan: String(extra.previousPlan ?? "").trim() || null,
      requestedPlan: String(extra.requestedPlan ?? extra.publicationPlan ?? selected.publicationPlan ?? "").trim() || null,
      publicationPlan:
        ["monthly", "featured_monthly"].includes(selectedPlanRaw)
          ? "monthly"
          : ["featured", "featured_120d"].includes(selectedPlanRaw)
            ? "featured"
            : "basic_free",
    }));
    const textSection = (title: string, value: unknown) => {
      const text = Array.isArray(value)
        ? value.map((entry) => String(entry ?? "").trim()).filter(Boolean).join("\n")
        : String(value ?? "").trim();
      return text ? `${title}\n${text}` : "";
    };
    const publicationDescriptionParts = [
      textSection("Descripcion general", selected.contanos || extra.contanos || extra.description),
      isSelectedPaidPlan ? textSection("Incluye", extra.included) : "",
      isSelectedPaidPlan ? textSection("No incluye", extra.notIncluded) : "",
    ].filter(Boolean);
    const publicationDescription = publicationDescriptionParts.join("\n\n");
    if (publicationDescription) {
      setPDescription(publicationDescription);
      setPDescriptionI18n((prev) => ({ ...prev, es: publicationDescription }));
    }
    const providerProfileText = String(extra.providerDescription ?? extra.providerInfo ?? "").trim();
    setPProviderInfoI18n((prev) => ({ ...prev, es: providerProfileText || prev.es || "" }));
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
    const linkByKey = new Map<string, SocialLinkDetail>();
    [...detailedFormLinks, ...socialLinks, ...explicitLinks].forEach((entry) => {
      const key = `${entry.kind}:${entry.url}`;
      if (!linkByKey.has(key)) linkByKey.set(key, entry);
    });
    setPSocialLinksDetailed(Array.from(linkByKey.values()));
    const primaryPrice = selected.price || String(extra.price ?? "") || String(priceByCurrency[0]?.amount ?? "");
    const primaryCurrency = String(selected.currency || extra.currency || priceByCurrency[0]?.currency || "").trim();
    setPPrice(primaryPrice);
    if (primaryCurrency) setPCurrency(primaryCurrency);
    setPExtraPrices(priceByCurrency.filter((entry, index) => index > 0 || entry.currency !== primaryCurrency));
    const selectedExpirationRaw = String((selected as any).expirationAt || extra.expirationAt || "").trim();
    if (selectedExpirationRaw) {
      const selectedExpiration = new Date(selectedExpirationRaw);
      if (!Number.isNaN(selectedExpiration.getTime())) {
        setPExpirationDate(`${selectedExpiration.getFullYear()}-${String(selectedExpiration.getMonth() + 1).padStart(2, "0")}-${String(selectedExpiration.getDate()).padStart(2, "0")}`);
        setPExpirationTime(`${String(selectedExpiration.getHours()).padStart(2, "0")}:${String(selectedExpiration.getMinutes()).padStart(2, "0")}`);
      } else {
        setPExpirationDate("");
        setPExpirationTime("");
      }
    } else {
      setPExpirationDate("");
      setPExpirationTime("");
    }
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
  const detailRelatedServices = detailTravelService && !isDetailDemandante
    ? userOferentes
        .filter((item) => String(item.email ?? "").trim().toLowerCase() === String(detailTravelService.email ?? "").trim().toLowerCase())
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
    : [];
  const detailRelatedPayments = detailTravelService && !isDetailDemandante
    ? travelServicePayments.filter((item) => detailRelatedServices.some((service) => service.id === item.serviceId))
    : [];
  const detailCurrentPayment = detailTravelService && !isDetailDemandante
    ? [...detailRelatedPayments]
        .filter((item) => item.serviceId === detailTravelService.id)
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })[0] ?? null
    : null;
  const detailCurrentRefund = parseRefundSnapshot({
    ...(detailCurrentPayment?.raw && typeof detailCurrentPayment.raw === "object" ? detailCurrentPayment.raw as Record<string, unknown> : {}),
    ...(detailExtra ?? {}),
  });
  const detailResumeUrl = String(detailExtra?.resumeUrl ?? "").trim();
  const detailResubmittedAt = String(detailExtra?.resubmittedAt ?? "").trim();
  const detailVisibleStatus = !detailTravelService
    ? "-"
    : !isDetailDemandante
      ? (String(detailTravelService.status ?? "").trim().toLowerCase() === "needs_info" && detailResubmittedAt
        ? t("providerPortal.status.resubmittedForReview")
        : String(detailTravelService.status ?? "").trim().toLowerCase() === "needs_info"
          ? t("providerPortal.status.needsInfo")
          : String(detailTravelService.status ?? "").trim().toLowerCase() === "rejected"
            ? t("providerPortal.status.rejected")
            : serviceEffectiveStatus(detailTravelService))
      : serviceEffectiveStatus(detailTravelService);
  const detailPaymentServices = detailPaymentEmail
    ? userOferentes
        .filter((item) => String(item.email ?? "").trim().toLowerCase() === detailPaymentEmail)
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
    : [];
  const detailPaymentItems = detailPaymentEmail
    ? travelServicePayments
        .filter((item) => String(item.payerEmail ?? "").trim().toLowerCase() === detailPaymentEmail)
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        })
    : [];
  const detailPaymentLabel = detailPaymentServices[0]
    ? providerDisplayName(detailPaymentServices[0])
    : (detailPaymentEmail ? (detailPaymentEmail.split("@")[0] || detailPaymentEmail) : "");

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
          <div className="space-y-3 text-sm text-slate-700">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-900">Solicitud</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div><b>Nombre:</b> {detailTravelService.name || String(detailExtra?.name ?? "-")}</div>
                  <div><b>Email:</b> {detailTravelService.email || "-"}</div>
                  <div><b>Teléfono:</b> {detailTravelService.phone || String(detailExtra?.phone ?? "-")}</div>
                  <div><b>Estado:</b> {detailVisibleStatus}</div>
                  <div><b>Tipo de solicitud:</b> {providerRequestKindDisplayLabel(detailExtra?.requestKind)}</div>
                  <div><b>Plan solicitado:</b> {normalizeProviderPlanLabel(detailExtra?.requestedPlan ?? detailExtra?.planType)}</div>
                  <div><b>Plan anterior:</b> {detailExtra?.previousPlan ? normalizeProviderPlanLabel(detailExtra?.previousPlan) : "-"}</div>
                  <div><b>{t("admin.request.reason")}:</b> {String(detailExtra?.statusReason ?? "-") || "-"}</div>
                  <div><b>Creada:</b> {detailTravelService.createdAt ? new Date(detailTravelService.createdAt).toLocaleString("es-AR") : "-"}</div>
                  <div><b>{t("admin.request.updatedAt")}:</b> {detailExtra?.statusUpdatedAt ? new Date(String(detailExtra.statusUpdatedAt)).toLocaleString("es-AR") : "-"}</div>
                  <div><b>{t("admin.request.resubmittedAt")}:</b> {detailResubmittedAt ? new Date(detailResubmittedAt).toLocaleString("es-AR") : "-"}</div>
                  <div><b>Origen:</b> {detailExtra?.sourceServiceId ? normalizeVisibleText(`solicitud/publicación ${String(detailExtra.sourceServiceId)}`) : "-"}</div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-900">Pago</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div><b>Estado:</b> {paymentStatusLabel(detailCurrentPayment?.status ?? detailExtra?.paymentStatus ?? "-")}</div>
                  <div><b>{t("admin.request.paymentReference")}:</b> {detailCurrentPayment?.externalReference || "-"}</div>
                  <div><b>Monto:</b> {String(detailCurrentPayment?.currency ?? "-")} {String(detailCurrentPayment?.amount ?? "-")}</div>
                  <div><b>CupÃ³n:</b> {String(detailCurrentPayment?.promoCode ?? detailExtra?.promoCode ?? "").trim() || "-"}</div>
                  <div><b>dLocal payment id:</b> {detailCurrentPayment?.providerPaymentId || "-"}</div>
                </div>
                {String(detailTravelService.status ?? "").trim().toLowerCase() === "needs_info" && detailResumeUrl ? (
                  <div className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-2 text-xs text-cyan-900">
                    <b>{t("admin.request.resumeLink")}:</b> <span className="break-all">{detailResumeUrl}</span>
                  </div>
                ) : null}
                {String(detailExtra?.monthlySubscriptionStatus ?? "").trim().toLowerCase() === "cancelled" ? (
                  <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-2 text-xs text-violet-900">
                    <b>Suscripción mensual cancelada:</b> esta publicación queda activa hasta {detailExtra?.expirationAt ? new Date(String(detailExtra.expirationAt)).toLocaleString("es-AR") : "su vencimiento actual"} y después queda pausada si no se reactiva.
                  </div>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {String(detailCurrentRefund.refundStatus ?? "").trim() ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-sm font-semibold text-slate-900">Reembolso</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div><b>{t("admin.request.refundStatus")}:</b> {String(detailCurrentRefund.refundStatus ?? "").trim() ? refundStatusLabel(detailCurrentRefund.refundStatus) : "-"}</div>
                  <div><b>{t("admin.request.refundAmount")}:</b> {String(detailCurrentRefund.refundCurrency ?? detailCurrentPayment?.currency ?? "-")} {String(detailCurrentRefund.refundAmount ?? detailCurrentPayment?.amount ?? "-")}</div>
                  <div><b>Refund ref:</b> {String(detailCurrentRefund.refundProviderReference ?? "-") || "-"}</div>
                  <div><b>{t("admin.request.providerError")}:</b> {String(detailCurrentRefund.refundProviderError ?? "-") || "-"}</div>
                  <div><b>Solicitado:</b> {detailCurrentRefund.refundRequestedAt ? new Date(String(detailCurrentRefund.refundRequestedAt)).toLocaleString("es-AR") : "-"}</div>
                  <div><b>Procesando:</b> {detailCurrentRefund.refundProcessingAt ? new Date(String(detailCurrentRefund.refundProcessingAt)).toLocaleString("es-AR") : "-"}</div>
                </div>
                {String(detailCurrentRefund.refundStatus ?? "").trim().toLowerCase() === "refund_processing" ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                    {t("providerPortal.refund.pendingNotice")}
                  </div>
                ) : null}
              </div>
              ) : null}
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 text-sm font-semibold text-slate-900">Datos enviados</div>
                <div className="grid gap-2 md:grid-cols-2">
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
                </div>
                <div className="mt-3">
                  <b>Imágenes cargadas:</b>
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {normalizeStringArray(detailExtra?.images).length ? normalizeStringArray(detailExtra?.images).map((img, idx) => (
                      <button key={`${idx}-${img.slice(0, 20)}`} type="button" onClick={() => setDetailImageExpanded(img)} className="overflow-hidden rounded-lg border border-slate-200">
                        <img src={img} alt={`imagen-oferente-${idx + 1}`} className="h-24 w-full object-cover transition hover:scale-105" />
                      </button>
                    )) : <span>-</span>}
                  </div>
                </div>
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
                        [{normalizeVisibleText(linkedPublicationPlanLabel(publication))}] {normalizeVisibleText(publication.title || "Sin título")} - {normalizeVisibleText(publication.publisherName || "Sin oferente")} | Visitas: {metrics.views} - Leads: {metrics.leads} - Favoritos: {metrics.favorites} - Compartidos: {metrics.shares}
                      </div>
                    );
                  })}
                </div>
              ) : <div className="mt-2 text-xs text-slate-500">Este oferente todavía no tiene publicaciones vinculadas.</div>}
            </div>
            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Historial de solicitudes del oferente</div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700">{detailRelatedServices.length} solicitud(es)</span>
              </div>
              <div className="mt-3 space-y-2">
                {detailRelatedServices.map((service) => {
                  const extra = parseTravelServiceExtra(service);
                  const payment = detailRelatedPayments.find((item) => item.serviceId === service.id);
                  const currentStatus = serviceEffectiveStatus(service);
                  const canReviewUpdatedSubmission = isReviewableTravelService(service, extra);
                  const refundData = parseRefundSnapshot({
                    ...(payment?.raw && typeof payment.raw === "object" ? payment.raw as Record<string, unknown> : {}),
                    ...extra,
                  });
                  const refundStatus = String(refundData.refundStatus ?? "").trim().toLowerCase();
                  const canHandleRefund = ["refund_requested", "refund_reviewing"].includes(refundStatus)
                    && paymentConfirmedForRefund(payment?.status ?? extra.paymentStatus ?? "");
                  const isSelectedHistory = service.id === detailTravelService.id;
                  return (
                    <div
                      key={`history-${service.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailTravelService(service)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setDetailTravelService(service);
                        }
                      }}
                      className={`cursor-pointer rounded-xl border p-3 text-xs text-slate-700 outline-none transition hover:border-[#00A9C6]/70 hover:bg-cyan-50/40 focus:ring-2 focus:ring-[#00A9C6]/30 ${isSelectedHistory ? "border-[#00A9C6] bg-cyan-50 shadow-[0_0_0_3px_rgba(0,169,198,0.12)]" : "border-slate-200 bg-slate-50"}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2 py-1 font-semibold">{normalizeProviderPlanLabel(extra.requestedPlan ?? extra.publicationPlan)}</span>
                        <span className="rounded-full bg-white px-2 py-1">{providerRequestKindDisplayLabel(extra.requestKind)}</span>
                        <span className="rounded-full bg-white px-2 py-1">{currentStatus === "falta info" && extra.resubmittedAt ? t("providerPortal.status.resubmittedForReview") : currentStatus}</span>
                        <span className={`rounded-full px-2 py-1 ${paymentStatusClasses(payment?.status ?? extra.paymentStatus ?? "-")}`}>Pago: {paymentStatusLabel(payment?.status ?? extra.paymentStatus ?? "-")}</span>
                        {refundStatus ? <span className="rounded-full bg-white px-2 py-1">{refundStatusLabel(refundStatus)}</span> : null}
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <div><b>ID solicitud:</b> {service.id}</div>
                        <div><b>Fecha:</b> {service.createdAt ? new Date(service.createdAt).toLocaleString("es-AR") : "-"}</div>
                        <div><b>Plan anterior:</b> {extra.previousPlan ? normalizeProviderPlanLabel(extra.previousPlan) : "-"}</div>
                        <div><b>Referencia de pago:</b> {payment?.externalReference || "-"}</div>
                        <div><b>{t("admin.request.reason")}:</b> {String(extra.statusReason ?? "-") || "-"}</div>
                        <div><b>{t("admin.request.updatedAt")}:</b> {extra.statusUpdatedAt ? new Date(String(extra.statusUpdatedAt)).toLocaleString("es-AR") : "-"}</div>
                        <div><b>{t("admin.request.refundStatus")}:</b> {refundStatus ? refundStatusLabel(refundStatus) : "-"}</div>
                        <div><b>Refund ref:</b> {String(refundData.refundProviderReference ?? "-") || "-"}</div>
                      </div>
                      {refundStatus ? (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                          <div><b>{t("admin.request.refundAmount")}:</b> {String(refundData.refundCurrency ?? payment?.currency ?? "-")} {String(refundData.refundAmount ?? payment?.amount ?? "-")}</div>
                          {String(refundData.refundAdminReason ?? "").trim() ? <div><b>Motivo admin:</b> {String(refundData.refundAdminReason)}</div> : null}
                          {String(refundData.refundProviderError ?? "").trim() ? <div><b>{t("admin.request.providerError")}:</b> {String(refundData.refundProviderError)}</div> : null}
                        </div>
                      ) : null}
                      {refundStatus === "refund_processing" ? (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
                          {t("providerPortal.refund.pendingNotice")}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {isSelectedHistory ? (
                          <span className="rounded-lg border border-[#00A9C6]/30 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#007D94]">Solicitud seleccionada</span>
                        ) : null}
                        {canReviewUpdatedSubmission ? (
                          <>
                            <button type="button" onClick={(event) => { event.stopPropagation(); updateTravelServiceStatus(service.id, "aprobado"); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100">Aprobado</button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); updateTravelServiceStatus(service.id, "rechazado"); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100">Rechazado</button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); updateTravelServiceStatus(service.id, "falta info"); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-100">Falta info</button>
                          </>
                        ) : null}
                        {canHandleRefund ? (
                          <>
                            {refundStatus === "refund_requested" ? (
                              <button type="button" onClick={(event) => { event.stopPropagation(); updateRefundStatus(service.id, "review"); }} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 hover:bg-amber-50">Revisar refund</button>
                            ) : null}
                            <button type="button" onClick={(event) => { event.stopPropagation(); updateRefundStatus(service.id, "reject"); }} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 hover:bg-rose-50">Rechazar refund</button>
                            <button type="button" onClick={(event) => { event.stopPropagation(); updateRefundStatus(service.id, "approve_and_execute"); }} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 hover:bg-emerald-50">Aprobar y ejecutar refund</button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
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

  const detailPaymentModal = detailPaymentEmail ? (
    <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/40 p-4" onClick={() => setDetailPaymentEmail(null)}>
      <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">{detailPaymentLabel}</h3>
            <p className="text-sm text-slate-500">{detailPaymentEmail}</p>
          </div>
          <button type="button" onClick={() => setDetailPaymentEmail(null)} className="rounded-lg border border-slate-200 px-3 py-1 text-sm">Cerrar</button>
        </div>
        <div className="space-y-3">
          {detailPaymentItems.map((item) => {
            const linkedService = detailPaymentServices.find((service) => service.id === item.serviceId);
            const linkedExtra = linkedService ? parseTravelServiceExtra(linkedService) : {};
            const canReviewUpdatedSubmission = linkedService ? isReviewableTravelService(linkedService, linkedExtra) : false;
            const refundData = parseRefundSnapshot({
              ...(item.raw && typeof item.raw === "object" ? item.raw as Record<string, unknown> : {}),
              ...linkedExtra,
            });
            const refundStatus = String(refundData.refundStatus ?? "").trim().toLowerCase();
            const canHandleRefund = Boolean(linkedService)
              && ["refund_requested", "refund_reviewing"].includes(refundStatus)
              && paymentConfirmedForRefund(item.status);
            return (
              <div key={`detail-payment-${item.id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2 py-1 font-semibold">{item.planType === "featured_monthly" ? "Plan mensual" : "Destacado 120 días"}</span>
                  <span className="rounded-full bg-white px-2 py-1">{item.paymentType === "monthly" ? "Suscripcion" : "Pago unico"}</span>
                  <span className="rounded-full bg-white px-2 py-1">{item.currency || "-"} {item.amount ?? "-"}</span>
                  <span className={`rounded-full px-2 py-1 ${paymentStatusClasses(item.status)}`}>{paymentStatusLabel(item.status)}</span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div><b>Solicitud:</b> {item.serviceId}</div>
                  <div><b>Fecha:</b> {item.createdAt ? new Date(item.createdAt).toLocaleString("es-AR") : "-"}</div>
                  <div><b>Referencia:</b> {item.externalReference || "-"}</div>
                  <div><b>Pago dLocal:</b> {item.providerPaymentId || "-"}</div>
                  <div><b>CupÃ³n:</b> {String(item.promoCode ?? linkedExtra.promoCode ?? "").trim() || "-"}</div>
                  <div><b>Pagado:</b> {item.paidAt ? new Date(item.paidAt).toLocaleString("es-AR") : "-"}</div>
                  <div><b>Retorno:</b> {item.returnStatus || "-"}</div>
                  {refundStatus ? <div><b>Reembolso:</b> {refundStatusLabel(refundStatus)}</div> : null}
                  {refundStatus ? <div><b>Refund ref:</b> {String(refundData.refundProviderReference ?? "-") || "-"}</div> : null}
                  <div><b>Tipo de solicitud:</b> {providerRequestKindDisplayLabel(linkedExtra.requestKind)}</div>
                </div>
                {refundStatus ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <div><b>Monto:</b> {String(refundData.refundCurrency ?? item.currency ?? "-")} {String(refundData.refundAmount ?? item.amount ?? "-")}</div>
                    {String(refundData.refundAdminReason ?? "").trim() ? <div><b>Motivo admin:</b> {String(refundData.refundAdminReason)}</div> : null}
                    {String(refundData.refundProviderError ?? "").trim() ? <div><b>Error provider:</b> {String(refundData.refundProviderError)}</div> : null}
                  </div>
                ) : null}
                {linkedService ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setDetailPaymentEmail(null); setDetailTravelService(linkedService); }} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100">
                      Ver solicitud completa
                    </button>
                    {canReviewUpdatedSubmission ? (
                      <>
                        <button type="button" onClick={() => updateTravelServiceStatus(linkedService.id, "aprobado")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100">Aprobado</button>
                        <button type="button" onClick={() => updateTravelServiceStatus(linkedService.id, "rechazado")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100">Rechazado</button>
                        <button type="button" onClick={() => updateTravelServiceStatus(linkedService.id, "falta info")} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-100">Falta info</button>
                      </>
                    ) : null}
                    {canHandleRefund ? (
                      <>
                        {refundStatus === "refund_requested" ? (
                          <button type="button" onClick={() => updateRefundStatus(linkedService.id, "review")} className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-amber-50">Revisar refund</button>
                        ) : null}
                        <button type="button" onClick={() => updateRefundStatus(linkedService.id, "reject")} className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-rose-50">Rechazar refund</button>
                        <button type="button" onClick={() => updateRefundStatus(linkedService.id, "approve_and_execute")} className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-emerald-50">Aprobar y ejecutar refund</button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
          {!detailPaymentItems.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No hay movimientos para este usuario.</div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  const resetPromoForm = () => {
    setPromoEditId(null);
    setPromoCodeDraft("");
    setPromoDiscountDraft("10");
    setPromoExpiresDraft("");
    setPromoMaxUsesDraft("");
    setPromoScopeDraft("all");
    setPromoActiveDraft(true);
  };

  const resetPriceRuleForm = () => {
    setPriceRuleEditId(null);
    setPriceRuleCountryDraft("");
    setPriceRulePlanTypeDraft("featured_120d");
    setPriceRuleCurrencyDraft("USD");
    setPriceRuleAmountDraft("");
    setPriceRuleDurationDaysDraft("120");
    setPriceRuleDefaultDraft(false);
    setPriceRuleActiveDraft(true);
    setPriceRuleProviderModeDraft("api");
    setPriceRuleSubscriptionPlanIdDraft(null);
    setPriceRuleSubscriptionNameDraft("");
    setPriceRuleSubscriptionDescriptionDraft("");
    setPriceRuleSubscriptionDayOfMonthDraft("");
    setPriceRuleSubscriptionMaxPeriodsDraft("");
    setPriceRuleSubscriptionSuccessUrlDraft("");
    setPriceRuleSubscriptionBackUrlDraft("");
    setPriceRuleSubscriptionErrorUrlDraft("");
    setPriceRuleSubscriptionNotificationUrlDraft("");
    setPriceRuleSubscriptionManualUrlDraft("");
    setPriceRuleShowUrlConfigDraft(false);
  };

  const findSubscriptionPlanForPriceRule = (priceRuleId: string | null | undefined) =>
    dlocalSubscriptionPlans.find((item) => item.featuredPlanPriceId === priceRuleId) ?? null;

  const savePriceRule = async () => {
    setPriceRuleSaving(true);
    setPriceRuleMessage("");
    try {
      const isAllCountries = priceRuleCountryDraft === "__ALL__";
      const isDefaultRule = priceRuleDefaultDraft || isAllCountries;
      if (priceRulePlanTypeDraft === "featured_monthly") {
        const payload = {
          id: priceRuleSubscriptionPlanIdDraft ?? undefined,
          planType: "featured_monthly",
          country: isDefaultRule ? "" : priceRuleCountryDraft,
          providerCountry: isDefaultRule ? "Todos los países" : priceRuleCountryDraft,
          currency: priceRuleCurrencyDraft,
          amount: Number(priceRuleAmountDraft),
          durationDays: Number(priceRuleDurationDaysDraft || 120),
          isDefault: isDefaultRule,
          isActive: priceRuleActiveDraft,
          providerMode: priceRuleProviderModeDraft,
          name: priceRuleSubscriptionNameDraft,
          description: priceRuleSubscriptionDescriptionDraft,
          dayOfMonth: priceRuleSubscriptionDayOfMonthDraft || null,
          maxPeriods: priceRuleSubscriptionMaxPeriodsDraft || null,
          manualSubscribeUrl: priceRuleProviderModeDraft === "manual" ? (priceRuleSubscriptionManualUrlDraft || null) : null,
        };
        const response = await api<{ ok: true; items: DlocalSubscriptionPlanItem[]; priceItems: FeaturedPlanPriceItem[] }>("/api/admin/dlocal-subscription-plans", {
          method: priceRuleSubscriptionPlanIdDraft ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setDlocalSubscriptionPlans(Array.isArray(response.items) ? response.items : []);
        setFeaturedPlanPrices(Array.isArray(response.priceItems) ? response.priceItems : []);
      } else {
        const payload = {
          id: priceRuleEditId ?? undefined,
          planType: priceRulePlanTypeDraft,
          country: isDefaultRule ? "" : priceRuleCountryDraft,
          currency: priceRuleCurrencyDraft,
          amount: Number(priceRuleAmountDraft),
          durationDays: Number(priceRuleDurationDaysDraft || 120),
          isDefault: isDefaultRule,
          isActive: priceRuleActiveDraft,
        };
        const response = await api<{ ok: true; items: FeaturedPlanPriceItem[] }>("/api/admin/featured-plan-prices", {
          method: priceRuleEditId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setFeaturedPlanPrices(Array.isArray(response.items) ? response.items : []);
      }
      setPriceRuleMessage(priceRuleEditId || priceRuleSubscriptionPlanIdDraft ? "Precio actualizado." : "Precio creado.");
      resetPriceRuleForm();
    } catch (error) {
      setPriceRuleMessage(error instanceof Error ? error.message : "No se pudo guardar el precio.");
    } finally {
      setPriceRuleSaving(false);
    }
  };

  const editPriceRule = (item: FeaturedPlanPriceItem) => {
    const linkedPlan = item.planType === "featured_monthly" ? findSubscriptionPlanForPriceRule(item.id) : null;
    setPriceRuleEditId(item.id);
    setPriceRuleSubscriptionPlanIdDraft(linkedPlan?.id ?? null);
    setPriceRuleCountryDraft(item.isDefault ? "__ALL__" : (item.country ?? ""));
    setPriceRulePlanTypeDraft(item.planType === "featured_monthly" ? "featured_monthly" : "featured_120d");
    setPriceRuleCurrencyDraft(item.currency === "ARS" ? "ARS" : "USD");
    setPriceRuleAmountDraft(String(item.amount ?? ""));
    setPriceRuleDurationDaysDraft(String(item.durationDays ?? 120));
    setPriceRuleDefaultDraft(Boolean(item.isDefault));
    setPriceRuleActiveDraft(Boolean(item.isActive));
    setPriceRuleProviderModeDraft(linkedPlan?.providerMode === "manual" ? "manual" : "api");
    setPriceRuleSubscriptionNameDraft(linkedPlan?.name ?? "");
    setPriceRuleSubscriptionDescriptionDraft(linkedPlan?.description ?? "");
    setPriceRuleSubscriptionDayOfMonthDraft(linkedPlan?.dayOfMonth ? String(linkedPlan.dayOfMonth) : "");
    setPriceRuleSubscriptionMaxPeriodsDraft(linkedPlan?.maxPeriods ? String(linkedPlan.maxPeriods) : "");
    setPriceRuleSubscriptionSuccessUrlDraft("");
    setPriceRuleSubscriptionBackUrlDraft("");
    setPriceRuleSubscriptionErrorUrlDraft("");
    setPriceRuleSubscriptionNotificationUrlDraft("");
    setPriceRuleSubscriptionManualUrlDraft(linkedPlan?.manualSubscribeUrl ?? "");
    setPriceRuleShowUrlConfigDraft(false);
    setPriceRuleMessage("");
  };

  const deletePriceRule = async (id: string) => {
    setPriceRuleSaving(true);
    setPriceRuleMessage("");
    try {
      const item = featuredPlanPrices.find((entry) => entry.id === id) ?? null;
      if (item?.planType === "featured_monthly") {
        const linkedPlan = findSubscriptionPlanForPriceRule(id);
        if (linkedPlan?.id) {
          const response = await api<{ ok: true; items: DlocalSubscriptionPlanItem[]; priceItems: FeaturedPlanPriceItem[] }>(
            `/api/admin/dlocal-subscription-plans?id=${encodeURIComponent(linkedPlan.id)}`,
            { method: "DELETE" },
          );
          setDlocalSubscriptionPlans(Array.isArray(response.items) ? response.items : []);
          setFeaturedPlanPrices(Array.isArray(response.priceItems) ? response.priceItems : []);
        } else {
          const response = await api<{ ok: true; items: FeaturedPlanPriceItem[] }>(`/api/admin/featured-plan-prices?id=${encodeURIComponent(id)}`, {
            method: "DELETE",
          });
          setFeaturedPlanPrices(Array.isArray(response.items) ? response.items : []);
        }
      } else {
        const response = await api<{ ok: true; items: FeaturedPlanPriceItem[] }>(`/api/admin/featured-plan-prices?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        setFeaturedPlanPrices(Array.isArray(response.items) ? response.items : []);
      }
      if (priceRuleEditId === id) resetPriceRuleForm();
      setPriceRuleMessage("Precio eliminado.");
    } catch (error) {
      setPriceRuleMessage(error instanceof Error ? error.message : "No se pudo eliminar el precio.");
    } finally {
      setPriceRuleSaving(false);
    }
  };

  const generateRandomPromoCode = () => {
    const token = `TG-${Math.random().toString(36).slice(2, 6).toUpperCase()}${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    setPromoCodeDraft(token);
  };

  const savePromoCode = async () => {
    setPromoSaving(true);
    setPromoMessage("");
    try {
      const normalizedExpiresAt = promoExpiresDraft
        ? (/^\d{4}-\d{2}-\d{2}$/.test(promoExpiresDraft) ? `${promoExpiresDraft}T00:00` : promoExpiresDraft)
        : null;
      const payload = {
        id: promoEditId ?? undefined,
        code: promoCodeDraft,
        discountPercent: Number(promoDiscountDraft),
        expiresAt: normalizedExpiresAt,
        maxUses: promoMaxUsesDraft || null,
        scope: promoScopeDraft,
        isActive: promoActiveDraft,
      };
      const response = await api<{ ok: true; items: PromoCodeItem[] }>("/api/admin/promo-codes", {
        method: promoEditId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setPromoCodes(Array.isArray(response.items) ? response.items : []);
      setPromoMessage(promoEditId ? "Código promocional actualizado." : "Código promocional creado.");
      resetPromoForm();
    } catch (error) {
      setPromoMessage(error instanceof Error ? error.message : "No se pudo guardar el codigo.");
    } finally {
      setPromoSaving(false);
    }
  };

  const editPromoCode = (item: PromoCodeItem) => {
    setPromoEditId(item.id);
    setPromoCodeDraft(item.code);
    setPromoDiscountDraft(String(item.discountPercent || 0));
    setPromoExpiresDraft(item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : "");
    setPromoMaxUsesDraft(item.maxUses === null ? "" : String(item.maxUses));
    setPromoScopeDraft(item.scope === "partners" ? "partners" : "all");
    setPromoActiveDraft(Boolean(item.isActive));
    setPromoMessage("");
  };

  const deletePromoCode = async (id: string) => {
    setPromoSaving(true);
    setPromoMessage("");
    try {
      const response = await api<{ ok: true; items: PromoCodeItem[] }>(`/api/admin/promo-codes?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setPromoCodes(Array.isArray(response.items) ? response.items : []);
      if (promoEditId === id) resetPromoForm();
      setPromoMessage("Código promocional eliminado.");
    } catch (error) {
      setPromoMessage(error instanceof Error ? error.message : "No se pudo eliminar el codigo.");
    } finally {
      setPromoSaving(false);
    }
  };

  const usersSectionCard = (
    <section className="space-y-6">
      {detailTravelServiceModal}
      {detailPaymentModal}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardStatCard
          label="Total Oferentes"
          total={uniqueUserOferentes.length}
          active={activeUserOferentes}
          monthly={monthlyUserOferentes}
          activeMonthly={monthlyActiveUserOferentes}
          tone="blue"
        />
        <DashboardStatCard
          label="Total Demandantes"
          total={userDemandantes.length}
          active={activeUserDemandantes}
          monthly={monthlyUserDemandantes}
          activeMonthly={monthlyActiveUserDemandantes}
          tone="violet"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><b>Total oferentes registrados:</b> {uniqueUserOferentes.length}</div>
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
          <div className="mb-3">
          <p className="text-sm font-semibold text-slate-900">Precios de planes por pais</p>
            <p className="text-xs text-slate-500">Configura los valores del destacado por 120 dias por pais de pasaporte. Si no hay regla del pais, se usa la regla por defecto.</p>
          </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-8">
            <select value="featured_120d" onChange={() => setPriceRulePlanTypeDraft("featured_120d")} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
              <option value="featured_120d">Pago unico 120 dias</option>
            </select>
            <select value={priceRuleCountryDraft} onChange={(event) => {
              const value = event.target.value;
            setPriceRuleCountryDraft(value);
            if (value === "__ALL__") {
              setPriceRuleDefaultDraft(true);
              setPriceRuleCurrencyDraft("USD");
            }
          }} disabled={priceRuleDefaultDraft && priceRuleCountryDraft !== "__ALL__"} className="h-10 rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-100">
            <option value="">Seleccionar pais</option>
            <option value="__ALL__">Todos los paises</option>
            {countryCatalog.map((country) => <option key={`rule-country-${country}`} value={country}>{country}</option>)}
          </select>
          <select value={priceRuleCurrencyDraft} onChange={(event) => setPriceRuleCurrencyDraft((event.target.value === "ARS" ? "ARS" : "USD"))} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </select>
          <input value={priceRuleAmountDraft} onChange={(event) => setPriceRuleAmountDraft(event.target.value)} placeholder="Monto" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          <input value={priceRuleDurationDaysDraft} onChange={(event) => setPriceRuleDurationDaysDraft(event.target.value.replace(/\D/g, ""))} placeholder="Días" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" title="Duración del pago único en días" />
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs text-slate-700">
            <input type="checkbox" checked={priceRuleDefaultDraft} onChange={(event) => {
              const checked = event.target.checked;
              setPriceRuleDefaultDraft(checked);
              if (checked) {
                setPriceRuleCountryDraft("__ALL__");
                setPriceRuleCurrencyDraft("USD");
              } else if (priceRuleCountryDraft === "__ALL__") {
                setPriceRuleCountryDraft("");
              }
            }} className="h-4 w-4 rounded border-slate-300 text-[#00A9C6]" />
            Regla por defecto
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs text-slate-700 md:col-span-1">
            <input type="checkbox" checked={priceRuleActiveDraft} onChange={(event) => setPriceRuleActiveDraft(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#00A9C6]" />
            Activo
          </label>
        </div>
        {priceRulePlanTypeDraft === "featured_monthly" ? (
          <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50/40 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Plan mensual real de dLocal Go</p>
                <p className="text-xs text-slate-500">
                  Podés crearlo por API o guardar un subscribe_url manual como fallback. Si elegís
                  {" "}
                  <span className="font-medium text-slate-700">Todos los países</span>
                  {" "}
                  se crea en dLocal Go con
                  {" "}
                  <span className="font-medium text-slate-700">Todos los países</span>
                  {" "}
                  y
                  {" "}
                  <span className="font-medium text-slate-700">moneda USD</span>.
                </p>
              </div>
              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                {priceRuleProviderModeDraft === "manual" ? "Modo manual" : "Modo API"}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <select
                value={priceRuleProviderModeDraft}
                onChange={(event) => setPriceRuleProviderModeDraft(event.target.value === "manual" ? "manual" : "api")}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="api">Crear plan real por API</option>
                <option value="manual">Usar subscribe_url manual</option>
              </select>
              <input
                value={priceRuleSubscriptionNameDraft}
                onChange={(event) => setPriceRuleSubscriptionNameDraft(event.target.value)}
                placeholder="Nombre del plan"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
              <input
                value={priceRuleSubscriptionDescriptionDraft}
                onChange={(event) => setPriceRuleSubscriptionDescriptionDraft(event.target.value)}
                placeholder="Descripción"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2"
              />
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 md:col-span-2">
                País de los suscriptores en dLocal Go:{" "}
                <span className="font-semibold text-slate-900">
                  {priceRuleCountryDraft && priceRuleCountryDraft !== "__ALL__" ? priceRuleCountryDraft : "Todos los países (regla global en USD)"}
                </span>
              </div>
              <input
                value={priceRuleSubscriptionDayOfMonthDraft}
                onChange={(event) => setPriceRuleSubscriptionDayOfMonthDraft(event.target.value)}
                placeholder="Día del mes (opcional)"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
              <input
                value={priceRuleSubscriptionMaxPeriodsDraft}
                onChange={(event) => setPriceRuleSubscriptionMaxPeriodsDraft(event.target.value)}
                placeholder="Máximo de períodos (opcional)"
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
              />
              {priceRuleProviderModeDraft === "manual" ? (
                <>
                  <div className="md:col-span-2">
                    <button
                      type="button"
                      onClick={() => setPriceRuleShowUrlConfigDraft((current) => !current)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {priceRuleShowUrlConfigDraft ? "Ocultar URL manual" : "Añadir URL manual"}
                    </button>
                  </div>
                  {priceRuleShowUrlConfigDraft ? (
                    <input
                      value={priceRuleSubscriptionManualUrlDraft}
                      onChange={(event) => setPriceRuleSubscriptionManualUrlDraft(event.target.value)}
                      placeholder="manual_subscribe_url"
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm md:col-span-2"
                    />
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" onClick={savePriceRule} disabled={priceRuleSaving} className="rounded-lg bg-[#00A9C6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0095AE] disabled:opacity-60">
            {priceRuleEditId ? "Guardar precio" : "Crear precio"}
          </button>
          {priceRuleEditId ? (
            <button type="button" onClick={resetPriceRuleForm} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Cancelar edicion
            </button>
          ) : null}
          {priceRuleMessage ? <span className="text-xs font-medium text-emerald-600">{priceRuleMessage}</span> : null}
        </div>
        <div className="mt-3 space-y-2">
          {visibleFeaturedPlanPrices.length ? visibleFeaturedPlanPrices.map((item) => {
            const linkedPlan = item.planType === "featured_monthly" ? findSubscriptionPlanForPriceRule(item.id) : null;
            return (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2 py-1 font-semibold">{item.isDefault ? "DEFECTO" : (item.country || "-")}</span>
                  <span className="rounded-full bg-white px-2 py-1 font-semibold">{item.planType === "featured_monthly" ? "MENSUAL" : `${item.durationDays ?? 120} DIAS`}</span>
                  <span>{item.currency}</span>
                  <span>{item.amount}</span>
                <span className="rounded-full bg-white px-2 py-1">
                  Modo: {item.planType === "featured_monthly" ? (linkedPlan?.providerMode === "manual" ? "Manual" : "dLocal API") : "dLocal API"}
                </span>
                  {item.planType === "featured_monthly" ? (
                    <>
                      {linkedPlan?.dlocalPlanId ? (
                        <span className="max-w-[280px] truncate rounded-full bg-white px-2 py-1">Plan: {linkedPlan.dlocalPlanId}</span>
                      ) : null}
                    </>
                  ) : item.providerResourceId ? (
                  <span className="max-w-[280px] truncate rounded-full bg-white px-2 py-1">Recurso: {item.providerResourceId}</span>
                ) : null}
                <span className="max-w-[320px] truncate">
                  {item.planType === "featured_monthly"
                    ? linkedPlan?.providerMode === "manual"
                      ? "Suscripción mensual con fallback manual activo"
                      : "Suscripción mensual real de dLocal Go"
                    : "Checkout: se genera por API al pagar"}
                </span>
                <span className={`rounded-full px-2 py-0.5 ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{item.isActive ? "Activo" : "Inactivo"}</span>
              </div>
              <div className="flex items-center gap-2">
                {item.planType === "featured_monthly" && (linkedPlan?.subscribeUrl || linkedPlan?.manualSubscribeUrl) ? (
                  <>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(linkedPlan?.subscribeUrl || linkedPlan?.manualSubscribeUrl || "");
                          setPriceRuleMessage("subscribe_url copiado.");
                        } catch {
                          setPriceRuleMessage("No se pudo copiar el subscribe_url.");
                        }
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-100"
                    >
                      Copiar URL
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(linkedPlan?.subscribeUrl || linkedPlan?.manualSubscribeUrl || "", "_blank", "noopener,noreferrer")}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-100"
                    >
                      Ver checkout
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={() => editPriceRule(item)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-100">Editar</button>
                <button type="button" onClick={() => { void deletePriceRule(item.id); }} className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-rose-700 hover:bg-rose-50">Eliminar</button>
              </div>
            </div>
          )}) : (
              <div className="rounded-xl border border-slate-100 p-3 text-xs text-slate-500">Aun no hay precios configurados.</div>
            )}
          </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Códigos promocionales</p>
            <p className="text-xs text-slate-500">Se aplican al plan mensual de publicación destacada.</p>
          </div>
          <button type="button" onClick={generateRandomPromoCode} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Generar aleatorio
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <input value={promoCodeDraft} onChange={(event) => setPromoCodeDraft(event.target.value.toUpperCase())} placeholder="Código" className="h-10 rounded-xl border border-slate-200 px-3 text-sm md:col-span-1" />
          <input value={promoDiscountDraft} onChange={(event) => setPromoDiscountDraft(event.target.value)} placeholder="% descuento" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          <input type="datetime-local" value={promoExpiresDraft} onChange={(event) => setPromoExpiresDraft(event.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700" title="Fecha de vencimiento" />
          <input value={promoMaxUsesDraft} onChange={(event) => setPromoMaxUsesDraft(event.target.value)} placeholder="Límite usos" className="h-10 rounded-xl border border-slate-200 px-3 text-sm" />
          <select value={promoScopeDraft} onChange={(event) => setPromoScopeDraft(event.target.value === "partners" ? "partners" : "all")} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700">
            <option value="all">Todas las personas</option>
            <option value="partners">Solo partners</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={promoActiveDraft} onChange={(event) => setPromoActiveDraft(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#00A9C6]" />
            Activo
          </label>
          <button type="button" onClick={savePromoCode} disabled={promoSaving} className="rounded-lg bg-[#00A9C6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0095AE] disabled:opacity-60">
            {promoEditId ? "Guardar cambios" : "Crear código"}
          </button>
          {promoEditId ? (
            <button type="button" onClick={resetPromoForm} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Cancelar edición
            </button>
          ) : null}
          {promoMessage ? <span className="text-xs font-medium text-emerald-600">{promoMessage}</span> : null}
        </div>
        <div className="mt-3 space-y-2">
          {promoCodes.length ? promoCodes.map((item) => {
            const remaining = item.maxUses === null ? "Ilimitado" : Math.max(item.maxUses - item.usedCount, 0).toString();
            return (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2 py-1 font-semibold">{item.code}</span>
                  <span>{item.discountPercent}%</span>
                  <span>Usos: {item.usedCount}{item.maxUses !== null ? `/${item.maxUses}` : ""}</span>
                  <span>Disponibles: {remaining}</span>
                  <span>Vence: {item.expiresAt ? new Date(item.expiresAt).toLocaleString("es-AR") : "Sin vencimiento"}</span>
                  <span className={`rounded-full px-2 py-0.5 ${(item.scope ?? "all") === "partners" ? "bg-cyan-100 text-cyan-700" : "bg-white text-slate-600"}`}>
                    {(item.scope ?? "all") === "partners" ? "Solo partners" : "Todas las personas"}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{item.isActive ? "Activo" : "Inactivo"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => editPromoCode(item)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 hover:bg-slate-100">Editar</button>
                  <button type="button" onClick={() => { void deletePromoCode(item.id); }} className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-rose-700 hover:bg-rose-50">Eliminar</button>
                </div>
              </div>
            );
          }) : (
            <div className="rounded-xl border border-slate-100 p-3 text-xs text-slate-500">Aún no hay códigos promocionales.</div>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Pagos y cobros de planes</p>
            <p className="text-xs text-slate-500">Registro interno de cada intento y pago asociado a publicaciones destacadas de 120 dias.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{visibleTravelServicePayments.length} registros</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { key: "featured120", label: "Movimientos de pago", count: paymentCounts.featured120 },
            { key: "paid", label: "Pagos aceptados", count: paymentCounts.paid },
            { key: "pending", label: "Pagos pendientes", count: paymentCounts.pending },
            { key: "rejected", label: "Pagos rechazados/cancelados", count: paymentCounts.rejected },
            { key: "refunded", label: "Reembolsos", count: paymentCounts.refunded },
          ].map((item) => (
            <button
              key={`payment-tab-${item.key}`}
              type="button"
              onClick={() => setPaymentSectionTab(item.key as typeof paymentSectionTab)}
              className={`rounded-xl border p-3 text-left text-xs transition ${
                paymentSectionTab === item.key
                  ? "border-[#00A9C6] bg-cyan-50 text-slate-950 shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
              }`}
            >
              <span className="font-semibold">{item.label}:</span> {item.count}
            </button>
          ))}
        </div>
        <div className="mt-3">
          <input
            value={paymentSearch}
            onChange={(event) => setPaymentSearch(event.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
            placeholder="Buscar usuario por nombre o email..."
          />
        </div>
        <div className="mt-4">
          {selectedPaymentSection ? [selectedPaymentSection].map((section) => (
            <div key={`payment-section-${section.key}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{section.title}</div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-700">{section.items.length}</span>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {section.items.length ? section.items.map((group) => {
                  const latest = group.items[0];
                  const paidCount = group.items.filter((item) => item.status === "paid").length;
                  const pendingCount = group.items.filter((item) => item.status === "pending" || item.status === "processing").length;
                  const cancelledCount = group.items.filter((item) => item.status === "failed" || item.status === "cancelled").length;
                  return (
                    <div key={`${section.key}-${group.email}`} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-700">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900">{group.label}</div>
                          <div className="truncate text-slate-500">{group.email}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDetailPaymentEmail(group.email)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        >
                          Detalle
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-100 px-2 py-1">Movimientos de pago: {group.items.length}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">Pagos aceptados: {paidCount}</span>
                        <span className="rounded-full bg-sky-50 px-2 py-1 text-sky-700">Pagos pendientes: {pendingCount}</span>
                        <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-700">Pagos cancelados/rechazados: {cancelledCount}</span>
                      </div>
                      {latest ? (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div><span className="font-semibold text-slate-800">Último plan:</span> {latest.planType === "featured_monthly" ? "Plan mensual" : "Destacado 120 días"}</div>
                          <div><span className="font-semibold text-slate-800">Último estado:</span> {paymentStatusLabel(latest.status)}</div>
                          <div><span className="font-semibold text-slate-800">Último monto:</span> {latest.currency || "-"} {latest.amount ?? "-"}</div>
                          <div><span className="font-semibold text-slate-800">Último movimiento:</span> {latest.createdAt ? new Date(latest.createdAt).toLocaleString("es-AR") : "-"}</div>
                        </div>
                      ) : null}
                    </div>
                  );
                }) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">Sin registros en esta sección.</div>
                )}
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Sin registros para mostrar.
            </div>
          )}
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
            placeholder="Buscar por nombre o email..."
          />
        </div>

        <div className="space-y-3">
          {(userTab === "oferentes" ? selectedOferenteCards : selectedUsers).length ? (userTab === "oferentes" ? selectedOferenteCards : selectedUsers).map((service) => {
            const serviceExtra = parseTravelServiceExtra(service);
            const serviceStatus = serviceEffectiveStatus(service);
            const isDemandante = String(service.taxonomyType ?? "").toLowerCase() === "demandante";
            const serviceCategories = normalizeStringArray((serviceExtra.category as string[] | string | undefined) ?? service.category);
            const linkedPublications = isDemandante ? [] : publicationsByProviderEmail.get(String(service.email ?? "").toLowerCase()) ?? [];
            const totalSubmissionsByEmail = serviceSubmissionCountsByEmail.get(String(service.email ?? "").toLowerCase()) ?? 1;
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
                      <p className="mt-2 text-sm font-semibold text-slate-900">{firstOferenteDisplayNameByEmail.get(providerRootEmail(service) || `service:${service.id}`) ?? providerDisplayName(service)}</p>
                      <p className="mt-1 text-xs text-slate-500">{service.email}</p>
                      <p className="mt-2 text-xs text-slate-600"><b>Este email envió:</b> {totalSubmissionsByEmail} solicitud(es)</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200">
                          Solicitud: {providerRequestKindDisplayLabel(serviceExtra.requestKind)}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 ring-1 ring-slate-200">
                          Plan solicitado: {normalizeProviderPlanLabel(serviceExtra.requestedPlan ?? serviceExtra.planType)}
                        </span>
                        {serviceExtra.previousPlan ? (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 ring-1 ring-indigo-200">
                            Plan anterior: {normalizeProviderPlanLabel(serviceExtra.previousPlan)}
                          </span>
                        ) : null}
                      </div>
                      {serviceExtra.sourceServiceId ? (
                        <p className="mt-2 text-xs text-slate-600">
                          <b>Origen:</b> {normalizeVisibleText(`solicitud/publicación ${String(serviceExtra.sourceServiceId)}`)}
                        </p>
                      ) : null}
                      <div className="mt-2 text-xs text-slate-600">
                        <b>Tiene {linkedPublications.length} publicación(es)</b>
                        {linkedPublications.length ? (
                          <div className="mt-1 space-y-1">
                            {linkedPublications.slice(0, 3).map((publication) => (
                              <div key={`${service.id}-${publication.id}`}>
                                [{normalizeVisibleText(linkedPublicationPlanLabel(publication))}] {normalizeVisibleText(publication.title || "Sin título")} — {normalizeVisibleText(publication.publisherName || "Sin oferente")}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">Visitas: {aggregated.views}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">Leads: {aggregated.leads}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">Favoritos: {aggregated.favorites}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5">Compartidos: {aggregated.shares}</span>
                      </div>
                      {String(serviceExtra.monthlySubscriptionStatus ?? "").trim().toLowerCase() === "cancelled" ? (
                        <p className="mt-2 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs text-violet-900">
                          <b>Suscripción mensual cancelada:</b> la publicación vinculada sigue activa hasta su vencimiento actual y luego queda pausada si no se reactiva.
                        </p>
                      ) : null}
                      {String(serviceExtra.statusReason ?? "").trim() ? (
                        <p className="mt-2 text-xs text-slate-600">
                          <b>Motivo estado:</b> {String(serviceExtra.statusReason)}
                        </p>
                      ) : null}
                      {serviceExtra.statusUpdatedAt ? (
                        <p className="mt-1 text-xs text-slate-600">
                          <b>Estado actualizado:</b> {new Date(String(serviceExtra.statusUpdatedAt)).toLocaleString("es-AR")}
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button type="button" onClick={() => setDetailTravelService(service)} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Detalle</button>
                  {isReviewableTravelService(service, serviceExtra) ? (
                    <>
                      <button type="button" onClick={() => updateTravelServiceStatus(service.id, "aprobado")} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Aprobado</button>
                      <button type="button" onClick={() => updateTravelServiceStatus(service.id, "rechazado")} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Rechazado</button>
                      <button type="button" onClick={() => updateTravelServiceStatus(service.id, "falta info")} className="rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50">Falta info</button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => deleteTravelService(service.id)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-rose-700 hover:bg-rose-50">Eliminar</button>
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

  const filteredPublications = publications
    .filter((item) => {
      if (isHomeHowPublication(item)) return false;
      const query = publicationSearch.toLowerCase().trim();
      const matchesSearch = !query || [item.title, item.publisherName, item.category, item.subcategory]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesType =
        publicationTypeFilter === "todas"
          || (publicationTypeFilter === "prestacion" ? item.primaryGroupKey === "prestacion" : item.primaryGroupKey !== "prestacion");
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      const rank = (item: Publication) => {
        if (reviewableEditRequestByPublicationId.has(item.id)) return 0;
        const fields = (item.fields as any) ?? {};
        if (fields.needsAdminReview === true || String(fields.adminReviewReason ?? "").trim()) return 1;
        return 2;
      };
      const rankDiff = rank(a) - rank(b);
      if (rankDiff !== 0) return rankDiff;
      const timeFor = (item: Publication) => new Date(String((item as any).updatedAt ?? item.createdAt ?? 0)).getTime();
      return timeFor(b) - timeFor(a);
    });
  const filteredReports = complaintReports.filter((item) => {
    const query = publicationSearch.toLowerCase().trim();
    if (!query) return true;
    return [item.publicationTitle, item.fullName, item.email, item.contact, item.details]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const filteredFeedbackReports = feedbackReports.filter((item) => {
    const query = feedbackSearch.toLowerCase().trim();
    if (!query) return true;
    return [item.fullName, item.email, item.details, item.createdAt]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });
  const selectedFeedback =
    filteredFeedbackReports.find((item) => item.id === selectedFeedbackId) ??
    filteredFeedbackReports[0] ??
    null;

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
    <div ref={adminRootRef} className="min-w-0 space-y-4 sm:space-y-6">
      {isPanelSection ? (
      <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          label="Usuarios Oferentes"
          total={uniqueUserOferentes.length}
          active={activeUserOferentes}
          monthly={monthlyUserOferentes}
          activeMonthly={monthlyActiveUserOferentes}
          tone="blue"
        />
        <DashboardStatCard
          label="Usuarios Demandantes"
          total={userDemandantes.length}
          active={activeUserDemandantes}
          monthly={monthlyUserDemandantes}
          activeMonthly={monthlyActiveUserDemandantes}
          tone="violet"
        />
        <DashboardStatCard
          label="Publicaciones Activas"
          total={activePublications.length}
          active={activePublications.length}
          monthly={monthlyActivePublications}
          activeMonthly={monthlyActivePublications}
          tone="emerald"
        />
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100 p-5 text-rose-700 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <span className="text-xs font-semibold uppercase tracking-widest opacity-70">Reportes / Denuncias</span>
          </div>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-4xl font-bold tracking-tight">{complaintReports.length.toLocaleString()}</p>
              <p className="text-xs opacity-70">en el mes</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold">{new Set(complaintReports.map((report) => report.publicationId).filter(Boolean)).size.toLocaleString()}</p>
              <p className="text-xs opacity-70">usuarios afectados</p>
            </div>
          </div>
          <div className="mt-3 border-t border-rose-200 pt-2 text-xs">+ {complaintReports.length.toLocaleString()} acumulado</div>
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

      <div className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <MapPinned className="h-4 w-4 text-[#00A9C6]" />
              Seleccionar los destino disponible para el registro del oferente
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Solo modifica el campo País destino que aplica tu propuesta en el registro de oferentes.
            </p>
          </div>
          {oferenteDestinationSaved ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Cambios aplicado
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="radio"
              name="oferente-destination-mode-dashboard"
              checked={oferenteDestinationMode === "all"}
              onChange={() => setOferenteDestinationMode("all")}
            />
            Habilitar todos los destinos
          </label>
          <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input
              type="radio"
              name="oferente-destination-mode-dashboard"
              checked={oferenteDestinationMode === "some"}
              onChange={() => setOferenteDestinationMode("some")}
            />
            Habilitar algunos
          </label>
        </div>

        {oferenteDestinationMode === "some" ? (
          <div className="mt-4">
            <CountryMultiSelect
              label="Destinos habilitados"
              selected={oferenteDestinationCountries}
              onChange={setOferenteDestinationCountries}
              placeholder="Seleccioná uno o más países destino"
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={applyOferenteDestinationConfig}
          disabled={oferenteDestinationSaving}
          className="mt-4 rounded-xl bg-[#00A9C6] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0193ab] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {oferenteDestinationSaving ? "Aplicando..." : "Aplicar cambios"}
        </button>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100"><h3 className="text-sm font-semibold text-slate-700">Categorías</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="bg-slate-50 text-slate-400 uppercase tracking-wider"><th className="text-left px-5 py-3 font-semibold">Categoría</th><th className="text-center px-3 py-3 font-semibold">Total</th><th className="text-center px-3 py-3 font-semibold">Pagas</th><th className="text-center px-3 py-3 font-semibold">Gratis</th><th className="text-center px-3 py-3 font-semibold">En país destino</th></tr></thead>
            <tbody>
              {categoryDashboardRows.blockRows.map((block) => {
                const open = expandedPanelBlocks[block.id] ?? false;
                return (
                  <Fragment key={`block-row-${block.id}`}>
                    <tr className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-5 py-3 text-slate-700 font-semibold">
                        <button type="button" onClick={() => setExpandedPanelBlocks((prev) => ({ ...prev, [block.id]: !open }))} className="inline-flex items-center gap-2">
                          <span className="text-[#00A9C6]">{open ? "?" : "?"}</span>
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
                                <td className="px-5 py-2 pl-16 text-slate-500"><span className="mr-1 text-slate-300">-</span>{child.name}</td>
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
            <h3 className="text-sm font-semibold text-slate-700">Países destino (demandantes)</h3>
            <input value={destinationCountrySearch} onChange={(event) => setDestinationCountrySearch(event.target.value)} placeholder="Buscar país..." className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-200" />
            <p className="mt-1 text-[11px] text-slate-400">Sin búsqueda: top 10 países con más demandantes.</p>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-400 uppercase tracking-wider"><th className="text-left px-4 py-3 font-semibold">País</th><th className="text-center px-3 py-3 font-semibold">Total</th><th className="text-center px-3 py-3 font-semibold">Pagas</th><th className="text-center px-3 py-3 font-semibold">Gratis</th><th className="text-center px-3 py-3 font-semibold">Visitas</th></tr></thead><tbody>{visibleDestinationRows.map((row) => (<tr key={row.country} className="border-t border-slate-50 hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-700">{row.country}</td><td className="px-3 py-3 text-center text-slate-600">{row.total}</td><td className="px-3 py-3 text-center font-semibold text-violet-600">{row.paid}</td><td className="px-3 py-3 text-center font-semibold text-emerald-600">{row.free}</td><td className="px-3 py-3 text-center font-semibold text-blue-600">{row.visits}</td></tr>))}</tbody></table></div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">Países origen (oferentes)</h3>
            <input value={originCountrySearch} onChange={(event) => setOriginCountrySearch(event.target.value)} placeholder="Buscar país..." className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-200" />
            <p className="mt-1 text-[11px] text-slate-400">Sin búsqueda: top 10 países con más oferentes.</p>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-400 uppercase tracking-wider"><th className="text-left px-4 py-3 font-semibold">País</th><th className="text-center px-3 py-3 font-semibold">Pubs.</th><th className="text-center px-3 py-3 font-semibold">Pagas</th><th className="text-center px-3 py-3 font-semibold">Gratis</th><th className="text-center px-3 py-3 font-semibold">Cats.</th><th className="text-center px-3 py-3 font-semibold">Destinos</th></tr></thead><tbody>{visibleOriginRows.map((row) => (<tr key={row.country} className="border-t border-slate-50 hover:bg-slate-50"><td className="px-4 py-3 font-medium text-slate-700">{row.country}</td><td className="px-3 py-3 text-center text-slate-600">{row.publications}</td><td className="px-3 py-3 text-center font-semibold text-violet-600">{row.paid}</td><td className="px-3 py-3 text-center font-semibold text-emerald-600">{row.free}</td><td className="px-3 py-3 text-center text-slate-600">{row.categories}</td><td className="px-3 py-3 text-center font-semibold text-blue-600">{row.destinations}</td></tr>))}</tbody></table></div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Visitas por pasaporte / país de origen</h3>
          <input value={passportCountrySearch} onChange={(event) => setPassportCountrySearch(event.target.value)} placeholder="Buscar país..." className="mt-2 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-200" />
          <p className="mt-1 text-[11px] text-slate-400">Sin búsqueda: top 10 países con más pasaportes seleccionados.</p>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="bg-slate-50 text-slate-400 uppercase tracking-wider"><th className="text-left px-5 py-3 font-semibold">País</th><th className="text-center px-3 py-3 font-semibold">Total</th><th className="text-center px-3 py-3 font-semibold">Prom. por día</th><th className="text-center px-3 py-3 font-semibold">Prom. por mes</th><th className="text-center px-3 py-3 font-semibold">Destinos prom.</th></tr></thead><tbody>{visiblePassportRows.map((row) => (<tr key={row.country} className="border-t border-slate-50 hover:bg-slate-50"><td className="px-5 py-3 font-medium text-slate-700">{row.country}</td><td className="px-3 py-3 text-center font-bold text-blue-600">{row.total.toLocaleString()}</td><td className="px-3 py-3 text-center text-slate-600">{row.perDay}</td><td className="px-3 py-3 text-center text-slate-600">{row.perMonth.toLocaleString()}</td><td className="px-3 py-3 text-center text-slate-500">{row.avgDestinations}</td></tr>))}</tbody></table></div>
      </div>
      </>
      ) : null}

      {isUsersSection ? usersSectionCard : null}

      {isFeedbackSection ? (
        <section className="rounded-3xl border border-slate-100 bg-white p-3 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
                <MessageSquareMore className="h-6 w-6 text-indigo-600" />
                Feedback
              </h2>
              <p className="mt-2 text-sm text-slate-600">Mensajes enviados desde el boton de feedback del sitio.</p>
            </div>
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">Total</p>
              <p className="text-2xl font-bold text-indigo-700">{feedbackReports.length.toLocaleString()}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,360px)_1fr]">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <input
                value={feedbackSearch}
                onChange={(event) => setFeedbackSearch(event.target.value)}
                placeholder="Buscar por usuario, email o mensaje..."
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                {filteredFeedbackReports.map((item) => {
                  const active = selectedFeedback?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedFeedbackId(item.id)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${
                        active
                          ? "border-indigo-200 bg-white shadow-sm"
                          : "border-transparent bg-white/70 hover:border-slate-200 hover:bg-white"
                      }`}
                    >
                      <div className="text-sm font-semibold text-slate-900">{normalizeVisibleText(item.fullName || "Usuario sin nombre")}</div>
                      <div className="mt-1 break-all text-xs text-slate-500">{normalizeVisibleText(item.email || item.contact || "-")}</div>
                      <div className="mt-2 line-clamp-2 text-xs text-slate-500">{normalizeVisibleText(item.details || "Sin mensaje")}</div>
                      <div className="mt-2 text-[11px] font-medium text-indigo-500">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString("es-AR") : ""}
                      </div>
                    </button>
                  );
                })}
                {!filteredFeedbackReports.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                    No hay feedback para mostrar.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="min-h-[360px] rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
              {selectedFeedback ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Usuario</p>
                      <h3 className="mt-1 text-xl font-semibold text-slate-900">{normalizeVisibleText(selectedFeedback.fullName || "Usuario sin nombre")}</h3>
                      <p className="mt-1 break-all text-sm text-slate-500">{normalizeVisibleText(selectedFeedback.email || selectedFeedback.contact || "-")}</p>
                    </div>
                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                      {selectedFeedback.createdAt ? new Date(selectedFeedback.createdAt).toLocaleString("es-AR") : "Sin fecha"}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Mensaje</p>
                    <div className="mt-2 whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                      {normalizeVisibleText(selectedFeedback.details || "Sin mensaje")}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500">
                  Selecciona un usuario para ver el mensaje.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

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

      {isHowWorksSection ? (
        <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-2xl font-semibold text-slate-900">Cómo funciona</h2>
          <p className="mt-2 text-sm text-slate-600">Armá aquí los pasos que se publican en la Home.</p>
          <div className="mt-3">{renderLangTabs(pLang, setEditingLang)}</div>
          <div className="mt-4 space-y-3">
            <input value={getLangEditValue(homeHowTitleI18n, pLang, pLang === "es" ? homeHowTitle : "")} onChange={(e) => {
              const next = e.target.value;
              if (pLang === "es") setHomeHowTitle(next);
              setHomeHowTitleI18n((prev) => setLangText(homeHowTitle, prev, pLang, next));
            }} className="h-10 w-full rounded-xl border border-slate-200 px-3" placeholder={`Título de la sección (${pLang.toUpperCase()})`} />
            {homeHowSteps.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">No hay pasos. Presioná <b>+ Agregar paso</b>.</div> : null}
            {homeHowSteps.map((step, idx) => (
              <div key={`home-step-${idx}`} className="grid gap-2 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between"><div className="text-xs font-semibold text-slate-500">Paso {idx + 1}</div><button type="button" className="text-red-500 text-xs" onClick={() => removeHomeHowStep(idx)}>Quitar paso</button></div>
                <input value={getLangEditValue(step.titleI18n, pLang)} onChange={(e) => setHomeHowSteps((prev) => prev.map((it, i) => i === idx ? { ...it, title: pLang === "es" ? e.target.value : it.title, titleI18n: setLangText(it.title ?? "", it.titleI18n, pLang, e.target.value) } : it))} className="h-10 rounded-xl border border-slate-200 px-3" placeholder="Título del paso" />
                <RichTextEditor value={getLangEditValue(step.subtitleI18n, pLang)} onChange={(next) => setHomeHowSteps((prev) => prev.map((it, i) => i === idx ? { ...it, subtitle: pLang === "es" ? next : it.subtitle, subtitleI18n: setLangText(it.subtitle ?? "", it.subtitleI18n, pLang, next) } : it))} placeholder="Descripción" minHeightClassName="min-h-[80px]" />
                <label className="text-xs font-medium text-slate-500">Subir imagen desde tu dispositivo</label>
                <input type="file" accept={IMAGE_FILE_ACCEPT} onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; void fileToUploadAsset(file).then((asset) => setHomeHowSteps((prev) => prev.map((it, i) => i === idx ? { ...it, image: pLang === "es" ? asset.url : it.image, imageI18n: setLangText(it.image ?? "", it.imageI18n, pLang, asset.url) } : it))).catch(() => null); e.currentTarget.value = ""; }} className="w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#00A9C6]/10 file:px-3 file:py-1.5 file:font-semibold file:text-[#007D92]" />
                {getLangEditValue(step.imageI18n, pLang) ? <div className="text-[11px] text-emerald-700">Imagen cargada</div> : <div className="text-[11px] text-slate-400">Aún sin imagen</div>}
                <button type="button" onClick={() => setHomeHowSteps((prev) => prev.map((it, i) => i === idx ? { ...it, image: "", imageI18n: setLangText("", it.imageI18n, pLang, "") } : it))} className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600">Quitar imagen</button>
              </div>
            ))}
            <button type="button" onClick={() => setHomeHowSteps((prev) => [...prev, { title: "", titleI18n: { es: "" }, subtitle: "", subtitleI18n: { es: "" }, image: "", imageI18n: { es: "" } }])} className="rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm">+ Agregar paso</button>
            <button type="button" onClick={saveHomeHowWorks} disabled={homeHowSaving} className="rounded-xl bg-[#00A9C6] px-4 py-2 text-sm font-semibold text-white">{homeHowSaving ? "Guardando..." : "Guardar y publicar"}</button>
            {homeHowSaveMessage ? <div className={`text-sm font-semibold ${homeHowSaveMessage.startsWith("No") ? "text-red-600" : "text-emerald-700"}`}>{homeHowSaveMessage}</div> : null}
          </div>
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
                  const blockHasVisibleCardCategory = rootsInBlock.some((category) => {
                    if ((category.visibleInCard ?? category.isPrimaryCategory) === true) return true;
                    return (childrenBy.get(category.id) ?? []).some((child) => (child.visibleInCard ?? child.isPrimaryCategory) === true);
                  });
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
                            <p className="text-sm font-semibold text-slate-900">{formatAdminBlockLabel(pickI18nText(block.labelI18n ?? null, catLang, block.label), block.taxonomyType ?? "categoria")}</p>
                            <p className="text-xs text-slate-500">Tipo de filtro: {formatAdminTaxonomyTypeLabel(block.taxonomyType ?? "categoria")}</p>{block.isPublicVisible === false ? <p className="mt-1 text-xs font-medium text-amber-600">Este bloque es invisible</p> : null}
                            {blockHasVisibleCardCategory ? <p className="mt-1 text-xs font-semibold text-indigo-600">Visible en tarjeta</p> : null}
                          </span>
                        </button>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button type="button" onClick={() => moveFilterGroup(block.id, -1)} disabled={blockIndex === 0} title="Subir bloque" aria-label="Subir bloque" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => moveFilterGroup(block.id, 1)} disabled={blockIndex === categoryBlocks.length - 1} title="Bajar bloque" aria-label="Bajar bloque" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" /></button>
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
                                          {(root.visibleInCard ?? root.isPrimaryCategory) ? <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-700">Visible en tarjeta</span> : null}
                                        </p>{root.isPublicVisible === false ? <p className="mt-1 text-xs font-medium text-amber-600">Esta categoría es invisible</p> : null}
                                        {getCategoryCustomTaxonomyNotice(root) ? <p className="mt-1 text-xs font-medium text-indigo-600">{getCategoryCustomTaxonomyNotice(root)}</p> : null}
                                      </span>
                                    </button>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      <button type="button" onClick={() => moveCategory(root.id, -1)} disabled={rootIndex === 0} title="Subir categoría" aria-label="Subir categoría" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" /></button>
                                      <button type="button" onClick={() => moveCategory(root.id, 1)} disabled={rootIndex === rootsInBlock.length - 1} title="Bajar categoría" aria-label="Bajar categoría" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" /></button>
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
                                                  {(child.visibleInCard ?? child.isPrimaryCategory) ? <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-700">Visible en tarjeta</span> : null}
                                                </div>{child.isPublicVisible === false ? <div className="mt-1 text-xs font-medium text-amber-600">Esta categoría es invisible</div> : null}
                                                {getCategoryCustomTaxonomyNotice(child) ? <div className="mt-1 text-xs font-medium text-indigo-600">{getCategoryCustomTaxonomyNotice(child)}</div> : null}
                                              </div>
                                              <div className="flex flex-wrap items-center justify-end gap-2">
                                                <button type="button" onClick={() => moveCategory(child.id, -1)} disabled={childIndex === 0} title="Subir subcategoría" aria-label="Subir subcategoría" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" /></button>
                                                <button type="button" onClick={() => moveCategory(child.id, 1)} disabled={childIndex === children.length - 1} title="Bajar subcategoría" aria-label="Bajar subcategoría" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" /></button>
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
                        <option key={block.id} value={block.id}>{formatAdminBlockLabel(pickI18nText(block.labelI18n ?? null, catLang, block.label), block.taxonomyType ?? "categoria")}</option>
                      ))}
                    </select>
                  </div>

                  {showCategoryParentSelector ? (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Categoría padre</label>
                      <select value={catParentId} onChange={(e) => setCatParentId(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">(Ninguna, categoría raíz)</option>
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
                      <option value="categoria">Categoría</option>
                      <option value="prestacion">Prestación</option>
                      <option value="idiomas">Idiomas</option>
                      <option value="modalidad">Modalidad</option>
                      <option value="actividad">Actividad</option>
                      <option value="tipos">Tipos</option>
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
                      <option value="categoria">Categoría</option>
                      <option value="prestacion">Prestación</option>
                      <option value="idiomas">Idiomas</option>
                      <option value="modalidad">Modalidad</option>
                      <option value="actividad">Actividad</option>
                      <option value="tipos">Tipos</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input type="checkbox" checked={blockIsPublicVisible} onChange={(e) => setBlockIsPublicVisible(e.target.checked)} className="h-4 w-4 rounded border-slate-300 accent-indigo-600" />
                    <span>Visible al público</span>
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={blockVisibleInCard}
                      onChange={(e) => setBlockVisibleInCard(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                    />
                    <span>Visible en la tarjeta (aplica al bloque completo)</span>
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
                              <div className={`grid gap-2 ${blockVisibleInCard ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
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
                                {blockVisibleInCard ? (
                                  <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={draft.visibleInCard}
                                      onChange={(e) =>
                                        updateBlockCategoryDraft(draft.id, (prev) => ({ ...prev, visibleInCard: e.target.checked }))
                                      }
                                      className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                                    />
                                    Visible en la tarjeta
                                  </label>
                                ) : null}
                              </div>
                              <label className="mt-2 flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={draft.isPrimaryCategory}
                                  onChange={(e) =>
                                    updateBlockCategoryDraft(draft.id, (prev) => ({ ...prev, isPrimaryCategory: e.target.checked }))
                                  }
                                  className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                                />
                                Categoría principal del bloque
                              </label>
                              {draft.visibleInCard ? (
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
                                      <div className={`mt-2 grid gap-2 ${blockVisibleInCard ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
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
                                        {blockVisibleInCard ? (
                                          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                                            <input
                                              type="checkbox"
                                              checked={subDraft.visibleInCard}
                                              onChange={(e) =>
                                                updateBlockCategoryDraft(subDraft.id, (prev) => ({ ...prev, visibleInCard: e.target.checked }))
                                              }
                                              className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                                            />
                                            Visible en la tarjeta
                                          </label>
                                        ) : null}
                                      </div>
                                      <label className="mt-2 flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={subDraft.isPrimaryCategory}
                                          onChange={(e) =>
                                            updateBlockCategoryDraft(subDraft.id, (prev) => ({ ...prev, isPrimaryCategory: e.target.checked }))
                                          }
                                          className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                                        />
                                        Categoría principal del bloque
                                      </label>
                                      {subDraft.visibleInCard ? (
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
            <ChevronDown className="mt-2 h-4 w-4 text-[#00A9C6] transition group-open:rotate-180" />
          </summary>

          {(showPublicationEditor || isNewPublicationPage) ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-xl font-semibold text-slate-900">{editingId ? "Editar publicación" : "Nueva publicación"}</h3>
              <button type="button" onClick={() => (isNewPublicationPage ? router.push("/admin?section=publicaciones") : setShowPublicationEditor(false))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">Cerrar</button>
            </div>
          <div className="grid gap-5 rounded-[28px] bg-gradient-to-b from-slate-50 to-[#F8FBFD] p-3 sm:p-5">
          {pEditorMode === "prestacion" ? (
            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
              <label className="text-sm font-medium text-slate-700">Idioma de edición</label>
              {renderLangTabs(pLang, setEditingLang)}
              <p className="text-xs text-slate-500">
                Cambia el idioma de todos los campos de texto traducibles (título, descripciones y textos). No modifica nombres propios, URLs ni valores numéricos.
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm shadow-slate-200/60">
            <button type="button" onClick={() => setPEditorMode("publicacion")} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition sm:flex-none ${pEditorMode === "publicacion" ? "bg-[#273166] text-white shadow-[0_12px_30px_rgba(39,49,102,0.22)]" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>Publicación</button>
            <button type="button" onClick={() => { setPEditorMode("prestacion"); if (!pPrestacionResources.length) setPPrestacionResources([createEmptyPrestacionResource()]); if (!pPrestacionSteps.length) setPPrestacionSteps([createEmptyPrestacionStep()]); if (!pPrestacionFaqs.length) setPPrestacionFaqs([createEmptyPrestacionFaq()]); if (!pPrestacionColorBlocks.length) setPPrestacionColorBlocks([createEmptyPrestacionColorBlock()]); }} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition sm:flex-none ${pEditorMode === "prestacion" ? "bg-[#273166] text-white shadow-[0_12px_30px_rgba(39,49,102,0.22)]" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>Prestaciones</button>
          </div>
<div className="contents min-w-0">
          {pEditorMode !== "prestacion" ? (
          <>
          <AdminEditorSection
            id="admin-publicacion-oferente"
            tone="slate"
            icon={<UserRound className="h-5 w-5" />}
            title="Información del oferente"
            description="Completá primero los datos base del perfil que se mostrará junto a la publicación."
          >
            <div className="grid gap-2">
              <label className="text-sm font-medium text-slate-700">Nombre del oferente (aprobado)</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setApprovedProviderPickerOpen((prev) => !prev)}
                  className="flex h-auto min-h-10 w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:ring-2 focus:ring-[#00A9C6]/30"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">
                      {pProviderEmail ? `${pPublisherName || "Sin nombre"} (${pProviderEmail})` : "Seleccionar oferente aprobado"}
                    </div>
                    {pProviderEmail ? (
                      <div className="truncate text-xs text-slate-500">Elegí una solicitud aprobada para autocompletar la publicación.</div>
                    ) : null}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition ${approvedProviderPickerOpen ? "rotate-180" : ""}`} />
                </button>
                {approvedProviderPickerOpen ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <input
                      value={pApprovedProviderSearch}
                      onChange={(e) => setPApprovedProviderSearch(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                      placeholder="Buscar oferente por nombre o email..."
                    />
                    <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                      {approvedOferentesGrouped.length ? approvedOferentesGrouped.map((group) => (
                        <div key={`provider-group-${group.email}`} className="rounded-xl border border-slate-200 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => setApprovedProviderExpandedEmail((prev) => prev === group.email ? null : group.email)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900">{group.label}</div>
                              <div className="truncate text-xs text-slate-500">{group.email}</div>
                            </div>
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                              {group.services.length} solicitud(es)
                            </span>
                          </button>
                          {approvedProviderExpandedEmail === group.email ? (
                            <div className="space-y-2 border-t border-slate-200 bg-white p-3">
                              {group.services.map((service) => {
                                const extra = parseTravelServiceExtra(service);
                                const identifier = service.name && service.name !== group.label ? service.name : `Solicitud ${service.id.slice(0, 8)}`;
                                return (
                                  <button
                                    key={service.id}
                                    type="button"
                                    onClick={() => applyOferenteToPublication(service.id)}
                                    className="block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left hover:bg-slate-100"
                                  >
                                    <div className="font-medium text-slate-900">{identifier}</div>
                                    <div className="mt-1 text-xs text-slate-600">
                                      {[
                                        providerRequestKindDisplayLabel(extra.requestKind),
                                        normalizeProviderPlanLabel(extra.requestedPlan ?? extra.publicationPlan),
                                        service.createdAt ? new Date(service.createdAt).toLocaleDateString("es-AR") : "",
                                      ].filter(Boolean).join(" | ")}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      )) : (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                          No hay oferentes aprobados para mostrar.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
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

            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4">
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

          </AdminEditorSection>

          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-2 shadow-sm shadow-slate-200/60">
            <a href="#admin-publicacion-propuesta" className="rounded-full bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100">Propuesta o publicación</a>
            <a href="#admin-publicacion-ubicacion-precio" className="rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100">Ubicación y precio</a>
            <a href="#admin-publicacion-sedes" className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">Sedes y filtro por pasaporte</a>
            <a href="#admin-publicacion-idiomas-contacto" className="rounded-full bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">Idiomas, expiración y contacto</a>
            <a href="#admin-publicacion-imagenes" className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">Imágenes</a>
          </div>

          <AdminEditorSection
            id="admin-publicacion-propuesta"
            tone="indigo"
            icon={<FileText className="h-5 w-5" />}
            title="Propuesta o publicación"
            description="Definí el contenido principal, cómo se clasifica y qué información verá primero la persona usuaria."
          >
          <div className="grid gap-4">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/45 p-4">
              <div className="text-sm font-semibold text-slate-900">Categorías y subcategorías</div>
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
                <div className="mt-4 rounded-xl border border-indigo-100 bg-white/90 p-3">
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

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/45 p-4">
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

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-indigo-100 bg-white/90 p-3">
              <label htmlFor="featured" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                <input
                  id="featured"
                  type="checkbox"
                  checked={pFeatured}
                  onChange={(e) => setPFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#00A9C6]"
                />
                Destacado
              </label>
              <label htmlFor="partner" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                <input
                  id="partner"
                  type="checkbox"
                  checked={pPartner}
                  onChange={(e) => setPPartner(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                />
                Partner
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

            <div className="grid gap-3 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm shadow-indigo-100/60">
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
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={booleanLike(desc.visibleInCard)}
                          onChange={(e) =>
                            setPExtraDescriptions((prev) =>
                              prev.map((d, i) =>
                                i === idx
                                  ? {
                                      ...d,
                                      visibleInCard: e.target.checked,
                                    }
                                  : d
                              )
                            )
                          }
                          className="h-4 w-4 rounded border-slate-300 text-[#00A9C6] focus:ring-[#00A9C6]"
                        />
                        Visible en la tarjeta
                      </label>
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
          </AdminEditorSection>

          <AdminEditorSection
            id="admin-publicacion-ubicacion-precio"
            tone="sky"
            icon={<MapPinned className="h-5 w-5" />}
            title="Ubicación y precio"
            description="Agrupá destino, ciudad, mapa y la configuración comercial en un mismo bloque más fácil de completar."
          >
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

            <div className="grid gap-2 rounded-2xl border border-sky-100 bg-sky-50/45 p-4">
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
          </AdminEditorSection>

          <AdminEditorSection
            id="admin-publicacion-sedes"
            tone="emerald"
            icon={<Building2 className="h-5 w-5" />}
            title="Sedes y filtro por pasaporte"
            description="Separá claramente dónde opera el oferente y desde qué países puede recibir viajeros."
          >
            <div className="grid gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/45 p-4">
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
            <div className="grid gap-2 rounded-2xl border border-emerald-100 bg-white/90 p-4">
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

            <div className="grid gap-2 rounded-2xl border border-emerald-100 bg-white/90 p-4">
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
          </AdminEditorSection>

          <AdminEditorSection
            id="admin-publicacion-idiomas-contacto"
            tone="amber"
            icon={<Languages className="h-5 w-5" />}
            title="Idiomas, expiración y contacto"
            description="Terminá la configuración pública y operativa de la publicación sin mezclarla con el material visual."
          >
          <div className="grid gap-3 rounded-2xl border border-amber-100 bg-amber-50/45 p-4">
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

          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2 rounded-2xl border border-amber-100 bg-white/90 p-4">
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
            <div className="grid gap-2 rounded-2xl border border-amber-100 bg-white/90 p-4 md:col-span-2">
              <label className="text-sm font-medium text-slate-700">Página web</label>
              <input
                value={pWebsite}
                onChange={(e) => setPWebsite(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                placeholder="https://"
              />
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-amber-100 bg-white p-4 shadow-sm shadow-amber-100/70">
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
          <div className="grid gap-2 rounded-2xl border border-amber-100 bg-white/90 p-4">
            <label className="text-sm font-medium text-slate-700">Idioma de edición</label>
            {renderLangTabs(pLang, setEditingLang)}
            <p className="text-xs text-slate-500">
              Cambia el idioma de todos los campos traducibles de esta publicación sin tocar URLs, nombres propios ni precios.
            </p>
          </div>
          </AdminEditorSection>

          <AdminEditorSection
            id="admin-publicacion-imagenes"
            tone="slate"
            icon={<ImageIcon className="h-5 w-5" />}
            title="Imágenes"
            description="Cargá o pegá URLs de las imágenes en un bloque aparte para que el flujo del formulario sea más limpio."
          >
          <div className="grid gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/65 p-4">
            <label className="text-sm font-medium text-slate-700">Imágenes (URLs o subida directa)</label>
            <textarea
              value={pImageUrls}
              onChange={(e) => setPImageUrls(e.target.value)}
              className="min-h-[90px] rounded-xl border border-slate-200 bg-white p-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
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
                  <div key={`${img}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm shadow-slate-200/60">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-slate-100">
                      <button
                        type="button"
                        onClick={() => removeImage(img)}
                        className="absolute right-2 top-2 z-10 grid h-6 w-6 place-items-center rounded-full bg-white/90 text-xs font-semibold text-slate-600 shadow"
                        aria-label="Quitar imagen"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`preview-${idx}`} className="h-full w-full object-cover" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          </AdminEditorSection>

          </>
          ) : null}

          {pEditorMode === "prestacion" ? (
            <div className="grid gap-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <label className="text-sm font-semibold text-slate-900">Estado de la prestación</label>
                <select
                  value={pStatus}
                  onChange={(e) => setPStatus(e.target.value)}
                  className="mt-3 h-10 w-full rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-[#00A9C6]/30"
                >
                  <option value="active">Activo</option>
                  <option value="draft">Borrador</option>
                  <option value="paused">Pausado</option>
                  <option value="hidden">Oculto</option>
                </select>
              </div>
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
                <div className="text-sm font-semibold text-slate-900">Elegir categorías o subcategorías vinculadas con la publicación</div>
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
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Bloque #{idx + 1}</span><button type="button" aria-label="Eliminar bloque" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" onClick={() => setPPrestacionHeroInfoBlocks((prev) => prev.length <= 1 ? [createEmptyPrestacionHeroInfoBlock()] : prev.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></button></div>
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
                      <div className="text-lg font-semibold text-slate-900">Tarjetas de recursos</div>
                      <p className="text-xs text-slate-500">Tarjetas flexibles con título, subtítulo, imagen, ítems con check y botones. Cada tarjeta puede tener además un bloque de texto con color.</p>
                      <p className="mt-1 text-[11px] text-slate-400">Estás editando contenidos en idioma: <span className="font-semibold uppercase">{pLang}</span>. En imágenes, podés cargar una por idioma; si no cargás una, se usa la de ES.</p>
                    </div>
                </div>
                <div className="mt-4 space-y-3">
                  {pPrestacionResources.map((card, idx) => (
                    <div key={`resource-${idx}`} className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Tarjeta #{idx + 1}
                        <button type="button" aria-label="Eliminar tarjeta" onClick={() => setPPrestacionResources((prev) => prev.length <= 1 ? [createEmptyPrestacionResource()] : prev.filter((_, i) => i !== idx))} className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><X className="h-3.5 w-3.5" /></button>
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
                              <button type="button" aria-label="Eliminar ítem" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-red-500" onClick={() => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, checkItems: (it.checkItems ?? []).filter((_, j) => j !== itemIdx), checkItemsI18n: (it.checkItemsI18n ?? []).filter((_, j) => j !== itemIdx) } : it))}><X className="h-3.5 w-3.5" /></button>
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
                            <span key={`${getLangEditValue(btn.labelI18n, pLang)}-${btnIdx}`} className="rounded-lg px-2 py-1 text-xs shadow-sm" style={{ backgroundColor: btn.bgColor || (btn.style === "secondary" ? "#FFFFFF" : "#2563EB"), color: btn.textColor || (btn.style === "secondary" ? "#1D4ED8" : "#FFFFFF"), border: btn.style === "secondary" ? "1px solid #C7D2FE" : "1px solid transparent" }}>{getLangEditValue(btn.labelI18n, pLang)}<button type="button" aria-label="Quitar botón" className="ml-2 inline-flex align-middle" onClick={() => setPPrestacionResources((prev) => prev.map((it, i) => i === idx ? { ...it, buttons: (it.buttons ?? []).filter((_, j) => j !== btnIdx) } : it))}><X className="h-3 w-3" /></button></span>
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
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Paso {idx + 1}</span><button type="button" aria-label="Eliminar paso" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" onClick={() => setPPrestacionSteps((prev) => prev.length <= 1 ? [createEmptyPrestacionStep()] : prev.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></button></div>
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
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span>Q{idx + 1}</span><button type="button" aria-label="Eliminar pregunta" className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50" onClick={() => setPPrestacionFaqs((prev) => prev.length <= 1 ? [createEmptyPrestacionFaq()] : prev.filter((_, i) => i !== idx))}><X className="h-3.5 w-3.5" /></button></div>
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
                          <button type="button" aria-label="Quitar publicación relacionada" className="ml-2 inline-flex align-middle text-red-500" onClick={() => setPPrestacionRelatedIds((prev) => prev.filter((entry) => entry !== id))}><X className="h-3 w-3" /></button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          ) : null}

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
              const isFeedback = String(report.reason ?? "").toLowerCase() === "feedback" || String(report.publicationId ?? "") === "feedback-general";
              const reportedPublication = publicationsById.get(String(report.publicationId ?? ""));
              const reportedPath = reportedPublication?.primaryGroupKey === "prestacion"
                ? `/prestaciones/${encodeURIComponent(report.publicationId)}`
                : `/publicacion/${encodeURIComponent(report.publicationId)}`;
              return (
                <div key={report.id} className="rounded-2xl border border-rose-100 bg-white p-4">
                  <button
                    type="button"
                    onClick={() => setExpandedReports((prev) => ({ ...prev, [report.id]: !prev[report.id] }))}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {normalizeVisibleText(isFeedback ? "Feedback general" : (report.publicationTitle || "Publicación sin título"))}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">Publicación ID: {normalizeVisibleText(report.publicationId || "-")}</div>
                        <div className="mt-1 text-xs text-slate-500">Denunciante: {normalizeVisibleText(report.fullName || "-")} · {normalizeVisibleText(report.email || "-")} · {normalizeVisibleText(report.contact || "-")}</div>
                      </div>
                      <span className="text-xs font-semibold text-rose-600">{isOpen ? "Ocultar" : "Ver detalle"}</span>
                    </div>
                  </button>

                  {isOpen ? (
                    <>
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{report.details || "-"}</div>
                      {report.publicationId && !isFeedback ? (
                        <a
                          href={reportedPath}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                        >
                          Abrir publicación denunciada
                        </a>
                      ) : null}
                      <div className="mt-2 text-xs text-rose-600">{normalizeVisibleText(report.reason || "Denuncia")} · {report.createdAt ? new Date(report.createdAt).toLocaleString("es-AR") : ""}</div>
                    </>
                  ) : null}
                </div>
              );
            }) : filteredPublications.map((p) => {
              const publicationEditRequest = reviewableEditRequestByPublicationId.get(p.id);
              const publicationNeedsAdminReview = Boolean((p.fields as any)?.needsAdminReview) || Boolean(String((p.fields as any)?.adminReviewReason ?? "").trim());
              return (
              <div key={p.id} className={`rounded-2xl border bg-white p-4 ${publicationEditRequest || publicationNeedsAdminReview ? "border-amber-300 bg-amber-50/40 shadow-[0_0_0_1px_rgba(245,158,11,0.18)]" : p.primaryGroupKey === "prestacion" ? "border-teal-200" : "border-indigo-200"}`}>
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
                        <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-xs text-cyan-700">partner</span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-base font-semibold text-slate-900">{normalizeVisibleText(p.title)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Oferente: {normalizeVisibleText(p.publisherName || "Sin nombre")} · Email: {normalizeVisibleText(String((p.fields as any)?.providerEmail ?? "-"))}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Creada: {p.createdAt ? new Date(p.createdAt).toLocaleString("es-AR") : "-"}
                    </div>
                    {publicationEditRequest || publicationNeedsAdminReview ? (
                      <div className="mt-2 rounded-xl border border-amber-200 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                        {publicationEditRequest
                          ? `Revision pendiente: ${providerRequestKindDisplayLabel(parseTravelServiceExtra(publicationEditRequest).requestKind)}. Revisar solicitud antes de publicar.`
                          : "Revision pendiente: upgrade aprobado. Revisar, ajustar y guardar como Activo para publicarla."}
                      </div>
                    ) : null}
                    <div className="mt-1 text-sm text-slate-600">
                      {(() => {
                        return "Bloque: Categorías";
                      })()}
                      {p.category
                        ? ` · ${normalizeVisibleText(pickI18nText(p.categoryI18n ?? null, locale, p.category))}${
                            p.subcategory
                              ? ` · ${normalizeVisibleText(pickI18nText(p.subcategoryI18n ?? null, locale, p.subcategory))}`
                              : ""
                          }`
                        : " · Sin categoría"}
                      {p.city ? ` · ${normalizeVisibleText(p.city)}` : ""}
                      {p.country ? `, ${normalizeVisibleText(p.country)}` : ""}
                      {p.headquarterCountry ? ` · Sede: ${normalizeVisibleText(p.headquarterCountry)}` : ""}
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
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">Visitas: {readPublicationAnalytics(p).views}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">Leads: {readPublicationAnalytics(p).leads}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">Favoritos: {readPublicationAnalytics(p).favorites}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5">Compartidos: {readPublicationAnalytics(p).shares}</span>
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
                    <a
                      href={p.primaryGroupKey === "prestacion" ? `/prestaciones/${encodeURIComponent(p.id)}` : `/publicacion/${encodeURIComponent(p.id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-cyan-200 px-3 py-1.5 text-xs text-cyan-700 hover:bg-cyan-50"
                    >
                      Ver detalle
                    </a>
                    {publicationEditRequest ? (
                      <>
                        <button
                          type="button"
                          onClick={() => updateTravelServiceStatus(publicationEditRequest.id, "aprobado")}
                          className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                        >
                          Aceptar
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTravelServiceStatus(publicationEditRequest.id, "rechazado")}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                        >
                          Rechazar
                        </button>
                        <button
                          type="button"
                          onClick={() => updateTravelServiceStatus(publicationEditRequest.id, "falta info")}
                          className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50"
                        >
                          Falta info
                        </button>
                      </>
                    ) : null}
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
            )})}
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
