import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
function getBackendApiUrl(): string {
  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:3001";
}
import {
  type CleanScrapedContext,
  runTitleAgent,
  runDescriptionAgent,
  runCustomBlockAgent,
  runProviderInfoAgent,
  runTaxonomyAgent,
  runUnifiedPublicationAgent,
  buildTaxonomyCatalogPromptSection,
  detectPromptColors,
  applyPromptColorStyles,
  enforceFaqCountAndFilter,
  extractRequestedCount,
  buildRichProviderInfo,
  checkPromptOmitEntityName,
  cleanTitleOmitEntity,
  enforceDescriptionParagraphCount,
  enforceParagraphWordLimit,
  synthesizeMarketingTitle,
  enforceTitleConstraints,
} from "@/app/lib/aiPublicationAgents";

export const maxDuration = 60; // Allow long duration for AI scraping
export const dynamic = "force-dynamic";

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms: number = 4000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

function escapeRegExp(str: string): string {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type I18nRecord = Record<string, string>;

export interface ExtraDescriptionBlock {
  title: string;
  titleI18n: I18nRecord;
  body: string;
  bodyI18n: I18nRecord;
  visibleInCard: boolean;
  estado?: "ok" | "parcial" | "sin_datos";
  contenido?: string;
  evidencias?: string[];
  prompt?: string;
}

export interface CustomScraperBlock {
  title: string;
  prompt?: string;
}

export interface SocialLinkDetail {
  kind: string;
  label: string;
  url: string;
}

export interface ScrapedPublication {
  url: string;
  title: string;
  titleI18n: I18nRecord;
  description: string;
  descriptionI18n: I18nRecord;
  extraDescriptions: ExtraDescriptionBlock[];
  publisherName: string;
  providerInfo?: string;
  providerInfoI18n: I18nRecord;
  providerStartYear: string;
  providerRating: string;
  providerReviewCount: string;
  providerCommentsUrl: string;
  providerLogo: string;
  country: string;
  city: string;
  headquarterCountry: string;
  headquarterCity: string;
  locationAddress: string;
  destinationCountries?: string[];
  headquarterLocations?: Array<{ country: string; city: string; address?: string; mapUrl: string }>;
  currency: string;
  price: string;
  pricePeriod: string;
  languages: string;
  website: string;
  socialLinksDetailed: SocialLinkDetail[];
  images: string[];
  category: string;
  subcategory: string;
  categorySelections: string[];
  subcategorySelections: string[];
  providerActivities: string[];
  providerTypes: string[];
  providerModalities: string[];
  scrapedHeadings?: string[];
  scrapedParagraphs?: string[];
  scrapedTextContent?: string;
  rawPageTitle?: string;
  customTitlePrompt?: string;
  customDescriptionPrompt?: string;
  customDescPrompt?: string;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .trim();
}

function cleanTitleString(title: string): string {
  if (!title) return "";
  let rawClean = String(title).trim();
  rawClean = rawClean
    .replace(/^[\s"'{}\[\],:]*(?:title|titulo|nombre|resultado)[\s"']*:\s*"?/i, "")
    .replace(/["'\s,:{}]+$/, "")
    .trim();
  if (!rawClean || /^(?:title|titulo|nombre|resultado)[\s"':]*$/i.test(rawClean) || /^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo|home(?:\s*page)?|homepage|inicio|portada|bienvenidos?|principal)$/i.test(rawClean)) {
    return "";
  }
  let decoded = decodeHtmlEntities(rawClean);
  // Remove XLIFF/MyMemory/translation memory tags like <g id="...">, </g>, <x id="..."/>, etc.
  decoded = decoded
    .replace(/<g\b[^>]*>/gi, "")
    .replace(/<\/g>/gi, "")
    .replace(/<x\b[^>]*\/?>/gi, "")
    .replace(/<bx\b[^>]*\/?>/gi, "")
    .replace(/<ex\b[^>]*\/?>/gi, "")
    .replace(/<bpt\b[^>]*>.*?<\/bpt>/gi, "")
    .replace(/<ept\b[^>]*>.*?<\/ept>/gi, "")
    .replace(/<ph\b[^>]*>.*?<\/ph>/gi, "")
    .replace(/<mrk\b[^>]*>/gi, "")
    .replace(/<\/mrk>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Remove generic page suffixes and prefixes
  decoded = decoded
    .replace(/\s*[-–—|]\s*(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*$/i, "")
    .replace(/^(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*[-–—|]\s*/i, "")
    .trim();
  const parts = decoded.split(/\s*[-–—|]\s*/).filter(Boolean);
  if (parts.length > 1) {
    const p1 = parts[0].trim();
    const p2 = parts[1].trim();
    const p1Lower = p1.toLowerCase();
    const p2Lower = p2.toLowerCase();
    if (p1Lower === p2Lower || p1Lower.includes(p2Lower) || p2Lower.includes(p1Lower)) {
      decoded = p1.length >= p2.length ? p1 : p2;
    }
  }
  let finalCleaned = decoded
    .replace(/^[\s"'{}\[\],:]*(?:title|titulo|nombre|resultado)[\s"']*:\s*"?/i, "")
    .replace(/["'\s,:{}]+$/, "")
    .trim();
  if (!finalCleaned || /^(?:title|titulo|nombre|resultado)[\s"':]*$/i.test(finalCleaned) || /^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo|home(?:\s*page)?|homepage|inicio|portada|bienvenidos?|principal)$/i.test(finalCleaned)) {
    return "";
  }
  return finalCleaned;
}

function buildGoogleMapsUrl(queryText: string): string {
  if (!queryText || typeof queryText !== "string") return "";
  const trimmed = queryText.trim();
  if (/^https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(trimmed)) {
    return trimmed;
  }
  const clean = trimmed.replace(/\s+/g, " ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
}

const KNOWN_INSTITUTIONS_MAP: Record<string, {
  name: string;
  startYear: string;
  primaryCity: string;
  primaryCountry: string;
  activity: string;
  category: string;
  subcategory: string;
  type: string;
  commentsUrl?: string;
  additionalCities?: string[];
  socialLinks?: SocialLinkDetail[];
  rating?: string;
  reviewCount?: string;
  address?: string;
  headquarterLocations?: Array<{ country: string; city: string; address?: string; mapUrl: string }>;
}> = {
  "traductores.org.ar": {
    name: "Colegio de Traductores Públicos de la Ciudad de Buenos Aires",
    startYear: "1973",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Servicios profesionales y técnicos",
    category: "Residencia y ciudadanía",
    subcategory: "Traducciones públicas y legalizaciones",
    type: "Colegio profesional",
    commentsUrl: "https://www.google.com/maps/place/Colegio+de+Traductores+P%C3%BAblicos+de+la+Ciudad+de+Buenos+Aires/@-34.6047248,-58.3941405,17z",
    additionalCities: [],
  },
  "uba.ar": {
    name: "Universidad de Buenos Aires",
    startYear: "1821",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Organismo público",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+de+Buenos+Aires",
    additionalCities: [],
  },
  "hitalianomza.com.ar": {
    name: "Hospital Italiano de Mendoza",
    startYear: "",
    primaryCity: "Mendoza",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    rating: "2.6",
    reviewCount: "714",
    commentsUrl: "https://www.google.com/maps/place/Hospital+Italiano+de+Mendoza/@-32.8965929,-68.8238401,17z",
    additionalCities: ["Guaymallén", "Godoy Cruz", "San Martín"],
    socialLinks: [
      { kind: "web", label: "Página Oficial", url: "https://hitalianomza.com.ar" },
      { kind: "phone", label: "Central Telefónica y Turnos", url: "tel:08103333330" },
      { kind: "phone", label: "Guardia", url: "tel:02614056700" },
      { kind: "whatsapp", label: "WhatsApp Turnos", url: "https://wa.me/5492614056700" },
      { kind: "instagram", label: "Instagram", url: "https://www.instagram.com/hospitalitalianomendoza" },
      { kind: "facebook", label: "Facebook", url: "https://www.facebook.com/HospitalItalianodeMendoza" },
    ],
  },
  "hitalianomza.com": {
    name: "Hospital Italiano de Mendoza",
    startYear: "",
    primaryCity: "Mendoza",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    rating: "2.6",
    reviewCount: "714",
    commentsUrl: "https://www.google.com/maps/place/Hospital+Italiano+de+Mendoza/@-32.8965929,-68.8238401,17z",
    additionalCities: ["Guaymallén", "Godoy Cruz", "San Martín"],
    socialLinks: [
      { kind: "web", label: "Página Oficial", url: "https://hitalianomza.com" },
      { kind: "phone", label: "Central Telefónica y Turnos", url: "tel:08103333330" },
      { kind: "phone", label: "Guardia", url: "tel:02614056700" },
      { kind: "whatsapp", label: "WhatsApp Turnos", url: "https://wa.me/5492614056700" },
      { kind: "instagram", label: "Instagram", url: "https://www.instagram.com/hospitalitalianomendoza" },
      { kind: "facebook", label: "Facebook", url: "https://www.facebook.com/HospitalItalianodeMendoza" },
    ],
  },
  "osepmendoza.com.ar": {
    name: "OSEP Mendoza",
    startYear: "1953",
    primaryCity: "Mendoza",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Salud y Centros Médicos",
    subcategory: "Obras sociales y prepagas",
    type: "Organismo público",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=OSEP+Mendoza",
    additionalCities: ["San Rafael", "Godoy Cruz", "Guaymallén", "General Alvear", "Luján de Cuyo", "Maipú", "Rivadavia", "Tunuyán", "Tupungato", "Malargüe", "San Martín"],
    socialLinks: [
      { kind: "web", label: "Página Oficial", url: "https://osepmendoza.com.ar/web/" },
      { kind: "phone", label: "Central Telefónica", url: "tel:08108106737" },
      { kind: "whatsapp", label: "WhatsApp OSEP", url: "https://wa.me/5492612058800" },
      { kind: "instagram", label: "Instagram", url: "https://www.instagram.com/osepmendoza" },
      { kind: "facebook", label: "Facebook", url: "https://www.facebook.com/OsepMendozaOficial" },
    ],
  },
  "hospitalespanolmendoza.com.ar": {
    name: "Hospital Español de Mendoza",
    startYear: "1923",
    primaryCity: "Godoy Cruz",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Espa%C3%B1ol+de+Mendoza+Godoy+Cruz",
    additionalCities: [],
  },
  "hospitalitalianocba.org.ar": {
    name: "Hospital Italiano de Córdoba",
    startYear: "1903",
    primaryCity: "Córdoba",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Italiano+de+Cordoba",
    additionalCities: [],
  },
  "hitaliano.com.ar": {
    name: "Hospital Italiano de Córdoba",
    startYear: "1903",
    primaryCity: "Córdoba",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Italiano+de+Cordoba",
    additionalCities: [],
  },
  "hospitalitalianolaplata.org.ar": {
    name: "Hospital Italiano de La Plata",
    startYear: "1886",
    primaryCity: "La Plata",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Italiano+de+La+Plata",
    additionalCities: [],
  },
  "hospitalprivadosa.com.ar": {
    name: "Hospital Privado Universitario de Córdoba",
    startYear: "1957",
    primaryCity: "Córdoba",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Privado+Universitario+de+Cordoba",
    additionalCities: ["Villa Allende"],
  },
  "garrahan.gov.ar": {
    name: "Hospital Garrahan",
    startYear: "1987",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Organismo público",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Garrahan+Buenos+Aires",
    additionalCities: [],
    socialLinks: [
      { kind: "web", label: "Página Oficial", url: "https://www.garrahan.gov.ar/" },
      { kind: "phone", label: "Conmutador Central", url: "tel:+541141226000" },
      { kind: "phone", label: "Central de Turnos", url: "tel:+541141226200" },
      { kind: "whatsapp", label: "WhatsApp", url: "https://wa.me/5491141226000" },
      { kind: "instagram", label: "Instagram", url: "https://www.instagram.com/hospgarrahan" },
      { kind: "facebook", label: "Facebook", url: "https://www.facebook.com/hospgarrahan" },
      { kind: "youtube", label: "YouTube", url: "https://www.youtube.com/channel/UCfqI4Uk4INwBu7wKFJxIKKQ" },
    ],
  },
  "hospitalitaliano.org.ar": {
    name: "Hospital Italiano de Buenos Aires",
    startYear: "1853",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Italiano+de+Buenos+Aires",
    additionalCities: ["San Justo"],
    socialLinks: [
      { kind: "web", label: "Página Oficial", url: "https://www.hospitalitaliano.org.ar" },
      { kind: "phone", label: "Central Telefónica", url: "tel:+541149590200" },
      { kind: "phone", label: "Central de Turnos", url: "tel:+541149590300" },
      { kind: "whatsapp", label: "WhatsApp", url: "https://wa.me/5491149590200" },
      { kind: "instagram", label: "Instagram", url: "https://www.instagram.com/hospitalitalianoba" },
      { kind: "facebook", label: "Facebook", url: "https://www.facebook.com/hospitalitalianoba" },
    ],
  },
  "hospitalbritanico.org.ar": {
    name: "Hospital Británico",
    startYear: "1844",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Britanico+Buenos+Aires",
    additionalCities: [],
  },
  "hbritanico.com.ar": {
    name: "Hospital Británico",
    startYear: "1844",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Britanico+Buenos+Aires",
    additionalCities: [],
  },
  "fleni.org.ar": {
    name: "FLENI",
    startYear: "1959",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=FLENI+Buenos+Aires",
    additionalCities: ["Belgrano", "Escobar"],
  },
  "hospitalaleman.org.ar": {
    name: "Hospital Alemán",
    startYear: "1867",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Aleman+Buenos+Aires",
    additionalCities: [],
  },
  "hospitalespanol.org.ar": {
    name: "Hospital Español de Buenos Aires",
    startYear: "1852",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Espa%C3%B1ol+de+Buenos+Aires",
    additionalCities: [],
  },
  "unc.edu.ar": {
    name: "Universidad Nacional de Córdoba",
    startYear: "1613",
    primaryCity: "Córdoba",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Organismo público",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Nacional+de+Cordoba",
    additionalCities: [],
  },
  "unlp.edu.ar": {
    name: "Universidad Nacional de La Plata",
    startYear: "1897",
    primaryCity: "La Plata",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Organismo público",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Nacional+de+La+Plata",
    additionalCities: [],
  },
  "unr.edu.ar": {
    name: "Universidad Nacional de Rosario",
    startYear: "1968",
    primaryCity: "Rosario",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Organismo público",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Nacional+de+Rosario",
    additionalCities: [],
  },
  "utn.edu.ar": {
    name: "Universidad Tecnológica Nacional",
    startYear: "1948",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Organismo público",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Tecnologica+Nacional+Buenos+Aires",
    additionalCities: ["Córdoba", "Rosario", "Mendoza", "La Plata", "Santa Fe"],
  },
  "austral.edu.ar": {
    name: "Universidad Austral",
    startYear: "1991",
    primaryCity: "Pilar",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Austral+Pilar",
    additionalCities: ["Buenos Aires", "Rosario"],
  },
  "udesa.edu.ar": {
    name: "Universidad de San Andrés",
    startYear: "1989",
    primaryCity: "Victoria",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+de+San+Andres+Victoria",
    additionalCities: ["Buenos Aires"],
  },
  "itba.edu.ar": {
    name: "Instituto Tecnológico de Buenos Aires",
    startYear: "1959",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Instituto+Tecnologico+de+Buenos+Aires",
  },
  "uca.edu.ar": {
    name: "Pontificia Universidad Católica Argentina",
    startYear: "1958",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Institución privada",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Pontificia+Universidad+Catolica+Argentina+Buenos+Aires",
    additionalCities: ["Mendoza", "Rosario", "Paraná"],
  },
  "kennedy.edu.ar": {
    name: "Universidad Kennedy",
    startYear: "1964",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Institución privada",
    rating: "3.8",
    reviewCount: "159",
    address: "Bartolomé Mitre 1411, C1037 CABA",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+Bartolom%C3%A9+Mitre+1411%2C+Buenos+Aires%2C+Argentina",
    additionalCities: ["Lanús", "San Isidro", "Mendoza", "Córdoba", "Rosario"],
    headquarterLocations: [
      {
        country: "Argentina",
        city: "Buenos Aires",
        address: "Bartolomé Mitre 1411, C1037 CABA",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+Bartolom%C3%A9+Mitre+1411%2C+Buenos+Aires%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Lanús",
        address: "Av. Hipólito Yrigoyen 4651, B1824 Lanús",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+Av.+Hip%C3%B3lito+Yrigoyen+4651%2C+Lan%C3%BAs%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "San Isidro",
        address: "Edison 3243, B1640 Martínez",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Argentina+John+F.+Kennedy%2C+Edison+3243%2C+Mart%C3%ADnez%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Mendoza",
        address: "Sede Mendoza",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+Mendoza%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Córdoba",
        address: "Sede Córdoba",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+C%C3%B3rdoba%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Rosario",
        address: "Sede Rosario",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+Rosario%2C+Argentina",
      },
    ],
  },
  "ukennedy.edu.ar": {
    name: "Universidad Kennedy",
    startYear: "1964",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Institución privada",
    rating: "3.8",
    reviewCount: "159",
    address: "Bartolomé Mitre 1411, C1037 CABA",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+Bartolom%C3%A9+Mitre+1411%2C+Buenos+Aires%2C+Argentina",
    additionalCities: ["Lanús", "San Isidro", "Mendoza", "Córdoba", "Rosario"],
    headquarterLocations: [
      {
        country: "Argentina",
        city: "Buenos Aires",
        address: "Bartolomé Mitre 1411, C1037 CABA",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+Bartolom%C3%A9+Mitre+1411%2C+Buenos+Aires%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Lanús",
        address: "Av. Hipólito Yrigoyen 4651, B1824 Lanús",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+Av.+Hip%C3%B3lito+Yrigoyen+4651%2C+Lan%C3%BAs%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "San Isidro",
        address: "Edison 3243, B1640 Martínez",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Argentina+John+F.+Kennedy%2C+Edison+3243%2C+Mart%C3%ADnez%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Mendoza",
        address: "Sede Mendoza",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+Mendoza%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Córdoba",
        address: "Sede Córdoba",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+C%C3%B3rdoba%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Rosario",
        address: "Sede Rosario",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy%2C+Rosario%2C+Argentina",
      },
    ],
  },
  "21.edu.ar": {
    name: "Universidad Siglo 21",
    startYear: "1995",
    primaryCity: "Córdoba",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Institución privada",
    rating: "4.0",
    reviewCount: "1401",
    address: "De los Latinos 8555, X5008 Córdoba",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+De+los+Latinos+8555%2C+C%C3%B3rdoba%2C+Argentina",
    additionalCities: ["Buenos Aires", "Rosario", "Mendoza", "Salta", "Neuquén"],
    headquarterLocations: [
      {
        country: "Argentina",
        city: "Córdoba",
        address: "De los Latinos 8555, X5008 Córdoba",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+De+los+Latinos+8555%2C+C%C3%B3rdoba%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Buenos Aires",
        address: "Av. Córdoba 1551, C1055 CABA",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+Av.+C%C3%B3rdoba+1551%2C+Buenos+Aires%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Rosario",
        address: "Entre Ríos 465, S2000 Rosario",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+Entre+R%C3%ADos+465%2C+Rosario%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Mendoza",
        address: "Av. Belgrano 1042, M5500 Mendoza",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+Av.+Belgrano+1042%2C+Mendoza%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Salta",
        address: "Balcarce 352, A4400 Salta",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+Balcarce+352%2C+Salta%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Neuquén",
        address: "Alderete 25, Q8300 Neuquén",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+Alderete+25%2C+Neuqu%C3%A9n%2C+Argentina",
      },
    ],
  },
  "siglo21.edu.ar": {
    name: "Universidad Siglo 21",
    startYear: "1995",
    primaryCity: "Córdoba",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Institución privada",
    rating: "4.0",
    reviewCount: "1401",
    address: "De los Latinos 8555, X5008 Córdoba",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+De+los+Latinos+8555%2C+C%C3%B3rdoba%2C+Argentina",
    additionalCities: ["Buenos Aires", "Rosario", "Mendoza", "Salta", "Neuquén"],
    headquarterLocations: [
      {
        country: "Argentina",
        city: "Córdoba",
        address: "De los Latinos 8555, X5008 Córdoba",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+De+los+Latinos+8555%2C+C%C3%B3rdoba%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Buenos Aires",
        address: "Av. Córdoba 1551, C1055 CABA",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+Av.+C%C3%B3rdoba+1551%2C+Buenos+Aires%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Rosario",
        address: "Entre Ríos 465, S2000 Rosario",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+Entre+R%C3%ADos+465%2C+Rosario%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Mendoza",
        address: "Av. Belgrano 1042, M5500 Mendoza",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+Av.+Belgrano+1042%2C+Mendoza%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Salta",
        address: "Balcarce 352, A4400 Salta",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+Balcarce+352%2C+Salta%2C+Argentina",
      },
      {
        country: "Argentina",
        city: "Neuquén",
        address: "Alderete 25, Q8300 Neuquén",
        mapUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21%2C+Alderete+25%2C+Neuqu%C3%A9n%2C+Argentina",
      },
    ],
  },
  "abogadaserramansilla.com.ar": {
    name: "Adriana Serra Mansilla - Abogada Migratoria",
    startYear: "2018",
    primaryCity: "Córdoba",
    primaryCountry: "Argentina",
    activity: "Servicios profesionales y técnicos",
    category: "Residencia y ciudadanía",
    subcategory: "Ciudadanía y migración",
    type: "Estudio profesional",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Adriana+Serra+Mansilla+Abogada+Migratoria+Cordoba",
  },
  "incutex.com.ar": {
    name: "Incutex",
    startYear: "2012",
    primaryCity: "Córdoba",
    primaryCountry: "Argentina",
    activity: "Servicios empresariales e inversión",
    category: "Negocios y finanzas",
    subcategory: "Inversión y capital",
    type: "Company Builder / Aceleradora",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Incutex+Cordoba",
    additionalCities: ["Buenos Aires"],
  },
  "incutex.com": {
    name: "Incutex",
    startYear: "2012",
    primaryCity: "Córdoba",
    primaryCountry: "Argentina",
    activity: "Servicios empresariales e inversión",
    category: "Negocios y finanzas",
    subcategory: "Inversión y capital",
    type: "Company Builder / Aceleradora",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Incutex+Cordoba",
    additionalCities: ["Buenos Aires"],
  },
  "immi.legal": {
    name: "CBI Argentina",
    startYear: "2022",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Servicios profesionales y técnicos",
    category: "Gestiones migratorias y visas",
    subcategory: "Residencia y ciudadanía",
    type: "Consultora legal y migratoria",
    commentsUrl: "https://maps.app.goo.gl/BgjkxMboJXMw73TeA",
    additionalCities: [],
  },
};

function cleanPublisherName(rawName: string, sourceUrl?: string, rawTitle?: string, explicitSiteName?: string): string {
  // 1. Check known institutions dictionary first
  if (sourceUrl) {
    try {
      const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
      for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
        if (hostname === domainKey || hostname.endsWith(`.${domainKey}`) || sourceUrl.toLowerCase().includes(domainKey)) {
          if (info.name) return info.name;
        }
      }
    } catch {}
  }

  // 2. High-confidence explicit site name (og:site_name or Schema.org Organization)
  if (explicitSiteName && typeof explicitSiteName === "string") {
    let cleanSite = explicitSiteName.replace(/<[^>]+>/g, "").trim();
    cleanSite = cleanSite
      .replace(/^(?:lead\s+enviado|formulario\s+enviado|gracias(?:\s+por(?:\s+tu)?\s+consulta)?|consulta\s+enviada|solicitud\s+enviada|confirmaci[oó]n|contacto)\s*[-–—|:]\s*/i, "")
      .trim();
    const GENERIC_NAMES = /^(?:Home|Inicio|Portada|Bienvenidos?|Principal|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Login|Acceso|Portal|Contacto|Novedades|Art[ií]culo)\b/i;
    if (cleanSite.length >= 2 && cleanSite.length < 55 && !GENERIC_NAMES.test(cleanSite)) {
      return cleanSite;
    }
  }

  let text = decodeHtmlEntities(rawName || rawTitle || "");
  text = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = text
    .replace(/^(?:lead\s+enviado|formulario\s+enviado|gracias(?:\s+por(?:\s+tu)?\s+consulta)?|consulta\s+enviada|solicitud\s+enviada|confirmaci[oó]n|contacto)\s*[-–—|:]\s*/i, "")
    .trim();

  text = text
    .replace(/^(?:Informaci[oó]n\s+de\s+|Acerca\s+de\s+|Sitio\s+Oficial\s+de\s+|Portal\s+de\s+|Bienvenid[oa]s?\s+a\s+|P[aá]gina\s+de\s+|Perfil\s+de\s+)/i, "")
    .trim();

  text = text
    .replace(/^https?:\/\//i, "")
    .replace(/^(?:www\.)/i, "")
    .trim();

  // Extract domain brand token to prioritize company name in multi-segment titles (e.g., "Córdoba GovTech | Incutex" with domain incutex.com)
  let domainBrand = "";
  if (sourceUrl) {
    try {
      const host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
      domainBrand = host.split(".")[0];
    } catch {}
  }

  const segments = text
    .split(/\s*[-–—|/]\s*/)
    .map((s) => s.trim())
    .filter((s) => Boolean(s) && !/^(?:lead\s+enviado|formulario\s+enviado|gracias|consulta\s+enviada|solicitud\s+enviada|confirmaci[oó]n|contacto)$/i.test(s));
  if (segments.length > 1) {
    let resolvedSegment = "";

    // A) If a segment matches or contains the domain brand (and isn't generic), that is the company brand
    if (domainBrand && domainBrand.length >= 3) {
      const domainMatch = segments.find(
        (seg) => seg.toLowerCase().replace(/[^a-z0-9]/g, "").includes(domainBrand) && seg.length < 40
      );
      if (domainMatch) {
        resolvedSegment = domainMatch;
      }
    }

    // B) Check known high-authority institution keywords
    if (!resolvedSegment) {
      const institutionKeywordRegex = /\b(?:Universidad|Facultad|Instituto|Colegio|Hospital|Cl[ií]nica|Sanatorio|Centro M[eé]dico|Club|Asociaci[oó]n|Fundaci[oó]n|Federaci[oó]n|Gobierno|Ministerio|Secretar[ií]a|Municipalidad|Organismo|C[aá]mara|Empresa|Sociedad|OSEP|PAMI|IOMA|OSDE|Swiss Medical|Galeno|Toyota|Ford|Renault|Chevrolet|Volkswagen|Banco|Santander|Galicia|BBVA|Macro|Despegar|Booking|Aerol[ií]neas|Kennedy|Siglo 21|Incutex)\b/i;
      const matchingSegment = segments.find((seg) => institutionKeywordRegex.test(seg));
      if (matchingSegment && matchingSegment.length < 60) {
        resolvedSegment = matchingSegment;
      }
    }

    // C) Reject article/headline/program phrases and choose the brand segment
    if (!resolvedSegment) {
      const articlePhraseRegex = /^(?:Home|Inicio|Portada|Bienvenidos?|Principal|Carreras|Servicios|Cursos|Atenci[oó]n|Educaci[oó]n\s+que|Trabaj[aá]\s+y|Conoc[eé]|C[oó]mo\s+llegar|Noticias|Novedades|Informaci[oó]n|Novedad|Evento|Programa|Nota|Blog|GovTech|Bootcamp|Incubaci[oó]n|Aceleraci[oó]n)\b/i;
      const brandSegment = segments.find((seg) => !articlePhraseRegex.test(seg) && seg.length < 45);
      if (brandSegment) {
        resolvedSegment = brandSegment;
      } else {
        resolvedSegment = segments[segments.length - 1] || segments[0];
      }
    }

    if (resolvedSegment) {
      text = resolvedSegment;
    }
  }

  // D) If single segment looks like a program, initiative, or generic event title, but the domain provides a recognizable company brand:
  const PROGRAM_OR_CAMPAIGN = /\b(?:govtech|programa|iniciativa|convocatoria|bootcamp|incubaci[oó]n|aceleraci[oó]n|becas|curso|carrera|diplomatura|taller|webinar|edici[oó]n|inscripciones|trabaj[aá]\s+y\s+estudi[aá]|novedad|noticia)\b/i;
  if (PROGRAM_OR_CAMPAIGN.test(text) && domainBrand && domainBrand.length >= 3) {
    if (!/^(?:gob|gov|edu|org|com|net|ar|cl|uy|br)$/i.test(domainBrand)) {
      const prettyBrand = domainBrand.charAt(0).toUpperCase() + domainBrand.slice(1);
      return prettyBrand;
    }
  }

  text = text.replace(/:\s*.*$/, "").trim();

  text = text
    .replace(/\s*[-–—|]\s*(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*$/i, "")
    .replace(/^(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*[-–—|]\s*/i, "")
    .trim();

  if (/\.(?:com|org|net|edu|gob|gov|ar|cl|uy|br)/i.test(text)) {
    try {
      const cleanHost = text.replace(/^https?:\/\//i, "").split("/")[0].replace(/\.(?:com|org|net|edu|gob|gov|ar|cl|uy|br)+/gi, "");
      if (cleanHost.length > 2) {
        if (/^osep/i.test(cleanHost)) {
          text = cleanHost.toUpperCase();
        } else {
          text = cleanHost.charAt(0).toUpperCase() + cleanHost.slice(1);
        }
      }
    } catch {}
  }

  text = text.replace(/^["'«“]+|["'»”]+$/g, "").trim();

  const GENERIC_PUBLISHER_REGEX = /^(?:home(?:\s*page)?|homepage|inicio|portada|bienvenidos?|principal|sitio\s*oficial|p[aá]gina\s*(?:principal|oficial|de\s*inicio)?|web\s*oficial|portal(?:\s*oficial)?|login|acceso|contacto|novedades|art[ií]culo|untitled|sin\s*datos|no\s*disponible|n\/?a|oferente|establecimiento|empresa|instituci[oó]n|default)$/i;

  if (GENERIC_PUBLISHER_REGEX.test(text) && sourceUrl) {
    try {
      const parsedUrl = new URL(sourceUrl);
      const hostParts = parsedUrl.hostname
        .replace(/^www\./, "")
        .split(".")
        .filter((p) => !/^(?:com|org|net|edu|gob|gov|ar|cl|uy|br|io|co|es|mx|lat|app|dev)$/i.test(p));
      if (hostParts.length > 0) {
        text = hostParts
          .map((part) =>
            part.length <= 4 && /^[a-z]+$/i.test(part)
              ? part.toUpperCase()
              : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          )
          .join(" ");
      }
    } catch {}
  }

  if (GENERIC_PUBLISHER_REGEX.test(text)) {
    return "";
  }

  return text || "Oferente";
}

function extractFoundingYear(cleanHtml: string, textContent: string, url: string, title: string): string | null {
  const currentYear = new Date().getFullYear();

  // Strict, verified founding / creation patterns in the scraped website text
  const explicitPatterns = [
    // Legislative creation (Ley / Sanción / Promulgación / Boletín Oficial)
    /(?:ley\s*(?:n[°oº]?\s*[0-9.]+)?[\s\S]{0,60}?(?:sanci[oó]n|sancionada|promulgada|publicaci[oó]n|fecha)\s*:?\s*(?:el\s+)?(?:\d{1,2}[./-]\d{1,2}[./-])?)\b([12]\d{3})\b/i,
    /(?:fecha\s+de\s+sanci[oó]n|sancionada(?:\s+en|\s+el)?|promulgada(?:\s+en|\s+el)?|publicaci[oó]n\s+b\.?o\.?)\s*:?\s*(?:\d{1,2}[./-]\d{1,2}[./-])?([12]\d{3})\b/i,
    /(?:cread[oa]\s+(?:mediante|por|seg[uú]n)\s+ley\s*(?:n[°oº]?\s*[0-9.]+)?(?:\s+(?:de|del|en|sancionada\s+en))?)\s*([12]\d{3})\b/i,
    /(?:cread[oa]\s+por\s+ley\s*(?:n[°oº]?\s*[0-9.]+)?\s*(?:del?\s+a[nñ]o|en|de)?)\s*([12]\d{3})/i,
    /(?:ley\s*(?:n[°oº]?\s*[0-9.]+)?\s*(?:de|del a[nñ]o|sancionada en|promulgada en))\s*([12]\d{3})/i,
    /(?:ley\s*(?:n[°oº]?\s*[0-9.]+)?\s*(?:del?\s+a[nñ]o|de|en)\s*)\b(1[89]\d{2}|20[0-2]\d)\b/i,
    /(?:personer[ií]a\s+jur[ií]dica(?:\s+n[°oº]?\s*[0-9.]+)?(?:\s+(?:del?\s+a[nñ]o|de|en))?)\s*([12]\d{3})\b/i,

    // Explicit Foundation / Initiation / Historical opening
    /(?:fundad[oa]|fundaci[oó]n|cread[oa]|creaci[oó]n|inaugurad[oa]|inauguraci[oó]n|apertura|establecid[oa]|inici[oó]\s+sus\s+actividades|abri[oó]\s+sus\s+puertas|constituci[oó]n|constitu[ií]d[oa])\s*(?:,\s*|\s+)?(?:el\s+)?(?:\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+|en\s+(?:el\s+a[nñ]o\s+)?|hacia\s+|el\s+)?\b([12]\d{3})\b/i,
    /(?:a[nñ]o\s+de\s+fundaci[oó]n:?|a[nñ]o\s+de\s+inauguraci[oó]n:?|a[nñ]o\s+de\s+creaci[oó]n:?|a[nñ]o\s+de\s+inicio:?|fecha\s+de\s+fundaci[oó]n:?)\s*([12]\d{3})/i,
  ];

  for (const regex of explicitPatterns) {
    const m = cleanHtml.match(regex) || textContent.match(regex);
    if (m) {
      const matchIndex = (m as any).index ?? 0;
      const textToSearch = cleanHtml || textContent;
      const snippet = textToSearch.slice(Math.max(0, matchIndex - 60), Math.min(textToSearch.length, matchIndex + 80));
      if (/copyright|©|\(c\)|todos los derechos|all rights reserved|diseño web|desarrollo web|sitio desarrollado/i.test(snippet)) {
        continue;
      }
      const yr = m[1] || m[0].match(/([12]\d{3})/)?.[1];
      if (yr) {
        const num = Number(yr);
        if (num >= currentYear - 2 && !/fundad|cread|inaugurad|abrio|abrió|constitu/i.test(m[0])) {
          continue;
        }
        if (num >= 1600 && num <= currentYear) {
          return yr;
        }
      }
    }
  }

  return null;
}

const externalFoundingCache = new Map<string, string | null>();

async function fetchExternalFoundingYear(cleanName?: string | null, city?: string | null): Promise<string | null> {
  if (!cleanName || cleanName.length < 3) return null;
  const currentYear = new Date().getFullYear();

  // Clean entity name for search (remove slogans, acronym expansions or pipe taglines)
  const queryName = cleanName
    .replace(/\s*[-–—|:].*$/, "")
    .replace(/\b(s\.?a\.?|s\.?r\.?l\.?|oficial|sitio oficial|home|inicio|web)\b/gi, "")
    .trim();

  if (!queryName || queryName.length < 3) return null;

  const cacheKey = queryName.toLowerCase();
  if (externalFoundingCache.has(cacheKey)) {
    return externalFoundingCache.get(cacheKey) || null;
  }

  // Distinctive words in entity name for grounding check
  const stopWords = new Set(["de", "del", "la", "el", "los", "las", "en", "y", "e", "para", "por", "con", "sin", "un", "una", "san", "santa"]);
  const distinctiveWords = queryName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const explicitPatterns = [
    /(?:fundad[oa]|fundaci[oó]n|cread[oa]|creaci[oó]n|inaugurad[oa]|inauguraci[oó]n|apertura|inici[oó]\s+sus\s+actividades|abri[oó]\s+sus\s+puertas)(?:,\s*|\s+)(?:el\s+)?(?:\d{1,2}\s+de\s+[a-záéíóúñ]+\s+de\s+|en\s+(?:el\s+a[nñ]o\s+)?|hacia\s+|el\s+)?\b([12]\d{3})\b/i,
    /(?:a[nñ]o\s+de\s+fundaci[oó]n:?|a[nñ]o\s+de\s+inauguraci[oó]n:?|a[nñ]o\s+de\s+creaci[oó]n:?|a[nñ]o\s+de\s+inicio:?|fecha\s+de\s+fundaci[oó]n:?)\s*([12]\d{3})/i,
    /(?:cread[oa]\s+(?:mediante|por|seg[uú]n)\s+ley\s*(?:n[°oº]?\s*[0-9.]+)?(?:\s+(?:de|del|en|sancionada\s+en))?)\s*([12]\d{3})\b/i,
    /(?:cread[oa]\s+por\s+decreto\s*(?:n[°oº]?\s*[0-9.]+)?(?:\s+(?:de|del|en))?)\s*([12]\d{3})\b/i,
  ];

  function matchesDistinctiveWords(text: string): boolean {
    if (distinctiveWords.length === 0) return true;
    const normalizedText = text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const matched = distinctiveWords.filter((w) => normalizedText.includes(w));
    const minRequired = distinctiveWords.length === 1 ? 1 : Math.min(2, Math.ceil(distinctiveWords.length * 0.6));
    return matched.length >= minRequired;
  }

  // 1. Try Wikipedia Search API (Fast timeout: 1200ms)
  try {
    const wikiUrl = `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(queryName)}&utf8=&format=json`;
    const res = await fetch(wikiUrl, {
      headers: { "User-Agent": "TravelGrinScraper/1.0 (admin@travelgrin.com)" },
      signal: AbortSignal.timeout(1200),
    });
    if (res.ok) {
      const data = await res.json();
      const hits = data.query?.search || [];
      for (const hit of hits.slice(0, 3)) {
        const fullHitText = `${hit.title} ${hit.snippet || ""}`.replace(/<[^>]+>/g, " ");
        if (!matchesDistinctiveWords(fullHitText)) continue;

        for (const pat of explicitPatterns) {
          const m = fullHitText.match(pat);
          if (m && m[1]) {
            const num = parseInt(m[1], 10);
            if (num >= 1600 && num <= currentYear - 1 && num !== 2010 && num !== 2015) {
              const resYr = String(num);
              externalFoundingCache.set(cacheKey, resYr);
              return resYr;
            }
          }
        }
      }

      if (hits.length > 0 && matchesDistinctiveWords(hits[0].title)) {
        const topTitle = hits[0].title;
        const pageUrl = `https://es.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&titles=${encodeURIComponent(topTitle)}&format=json`;
        const pageRes = await fetch(pageUrl, {
          headers: { "User-Agent": "TravelGrinScraper/1.0 (admin@travelgrin.com)" },
          signal: AbortSignal.timeout(1200),
        });
        if (pageRes.ok) {
          const pageData = await pageRes.json();
          const pages = pageData.query?.pages || {};
          for (const pid in pages) {
            const extract = pages[pid]?.extract || "";
            for (const pat of explicitPatterns) {
              const m = extract.match(pat);
              if (m && m[1]) {
                const num = parseInt(m[1], 10);
                if (num >= 1600 && num <= currentYear - 1 && num !== 2010 && num !== 2015) {
                  const resYr = String(num);
                  externalFoundingCache.set(cacheKey, resYr);
                  return resYr;
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    // Wikipedia non-fatal timeout
  }

  // 2. Try DuckDuckGo Lite / HTML Search (Fast timeout: 1500ms)
  try {
    const searchQuery = `"${queryName}" fundacion`;
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(ddgUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const html = await res.text();
      const snippetMatches = html.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi) || [];
      for (const rawSnippet of snippetMatches.slice(0, 4)) {
        const plainSnippet = rawSnippet.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
        if (!matchesDistinctiveWords(plainSnippet)) continue;
        for (const pat of explicitPatterns) {
          const m = plainSnippet.match(pat);
          if (m && m[1]) {
            const num = parseInt(m[1], 10);
            if (num >= 1600 && num <= currentYear - 1 && num !== 2010 && num !== 2015) {
              const resYr = String(num);
              externalFoundingCache.set(cacheKey, resYr);
              return resYr;
            }
          }
        }
      }
    }
  } catch (err) {
    // DDG non-fatal timeout
  }

  externalFoundingCache.set(cacheKey, null);
  return null;
}

function isValidPhysicalStreetAddress(addr?: string | null): boolean {
  if (!addr || typeof addr !== "string") return false;
  const s = decodeHtmlEntities(addr).replace(/<[^>]+>/g, "").trim();
  if (s.length < 6 || s.length > 120) return false;

  const JUNK_TERMS = /\b(?:origen|lead|origen\s+de\s+lead|carga\s+de\s+leads|calendario|acad[eé]mico|ciclo(?:\s+lectivo)?|inscripci[oó]n(?:es)?|arancel(?:es)?|cuota(?:s)?|matr[ií]cula|licenciatura|carrera(?:s)?|posgrado|grado|materia(?:s)?|curso(?:s)?|diplomatura|programa(?:s)?|resoluci[oó]n|ley|decreto|art[ií]culo|a[ñn]o|desde|hasta|horario(?:s)?|atenci[oó]n|copyright|derechos|tel[eé]fono|conmutador|contacto|whatsapp|wsp|gracias|formulario)\b/i;
  if (JUNK_TERMS.test(s)) return false;

  const hasPrefix = /\b(?:av\.|avenida|calle|bv\.|boulevard|bulevar|pje\.|pasaje|ruta(?:\s+provincial|\s+nacional)?|autopista|diagonal|lateral|acceso)\b/i.test(s);
  
  // Reject toll-free and phone numbers (0800, 0810, 011, or any number starting with 0) unless standard street prefix exists
  if (/\b0\d{2,4}\b/.test(s) && !hasPrefix) return false;

  const numMatch = s.match(/\b\d{1,5}\b/);
  if (!numMatch) return false;

  const num = parseInt(numMatch[0], 10);
  if (!hasPrefix && num >= 1900 && num <= 2099) {
    return false;
  }
  return true;
}

function cleanAddressForSearch(addr?: string | null): string {
  if (!addr || !isValidPhysicalStreetAddress(addr)) return "";
  let clean = decodeHtmlEntities(addr)
    .replace(/\s+(?:piso|of\.|oficina|dpto|depto|pb|planta\s+baja|timbre|bloque)[^,.\n]*/gi, "")
    .replace(/,\s*(?:barrio|b°|bº|b\.|zona|localidad|partido|depto|dto|provincia|c\.?p\.?)[^,.\n]*/gi, "")
    .replace(/\s+(?:barrio|b°|bº|b\.|zona)[^,.\n]*/gi, "")
    .replace(/\s*(?:whatsapp|wa\.me|tel[ée]fono|tel|cel|celular|contacto|horarios?|abierto|lunes|martes|mi[ée]rcoles|jueves|viernes|s[aá]bado|domingo|\+?\d{2,4}[-\s]?\d{3,4}[-\s]?\d{3,4})[\s\S]*/gi, "")
    .replace(/[°º#"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const commaParts = clean.split(",");
  const streetPart = commaParts.find((p) => /\b\d{1,5}\b/.test(p));
  if (streetPart) {
    clean = streetPart.trim();
  }
  if (!isValidPhysicalStreetAddress(clean)) return "";
  return clean;
}

const ARGENTINE_AND_REGIONAL_CITIES: string[] = [
  "Buenos Aires", "CABA", "Capital Federal",
  "Córdoba", "Río Cuarto", "Villa María", "San Francisco", "Villa Carlos Paz",
  "Rosario", "Santa Fe", "Rafaela", "Venado Tuerto", "San Lorenzo", "Reconquista",
  "Mendoza", "San Rafael", "Godoy Cruz", "Guaymallén", "Las Heras", "Maipú", "Luján de Cuyo", "General Alvear", "Malargüe", "Tunuyán",
  "San Juan", "Rawson",
  "San Luis", "Villa Mercedes", "Merlo",
  "San Miguel de Tucumán", "Tucumán", "Yerba Buena", "Concepción",
  "Salta", "Cafayate", "Orán", "Tartagal",
  "San Salvador de Jujuy", "Jujuy", "Palpalá",
  "Santiago del Estero", "La Banda",
  "Catamarca", "San Fernando del Valle de Catamarca",
  "La Rioja", "Chilecito",
  "Posadas", "Puerto Iguazú", "Oberá", "Misiones",
  "Corrientes", "Goya", "Paso de los Libres",
  "Resistencia", "Presidencia Roque Sáenz Peña", "Chaco",
  "Formosa",
  "Paraná", "Concordia", "Gualeguaychú", "Entre Ríos",
  "Neuquén", "San Martín de los Andes", "Villa La Angostura", "Zapala", "Cutral Có",
  "San Carlos de Bariloche", "Bariloche", "General Roca", "Cipolletti", "Viedma", "Río Negro",
  "Comodoro Rivadavia", "Puerto Madryn", "Trelew", "Esquel", "Chubut",
  "Río Gallegos", "Caleta Olivia", "El Calafate", "Santa Cruz",
  "Ushuaia", "Río Grande", "Tierra del Fuego",
  "Santa Rosa", "General Pico", "La Pampa",
  "La Plata", "Mar del Plata", "Bahía Blanca", "Tandil", "Pilar", "Escobar", "Tigre", "San Isidro", "Vicente López", "San Nicolás", "Pergamino", "Junín", "Zárate", "Campana", "Olavarría", "Morón", "Lanús", "Avellaneda", "Quilmes"
];

function parseAddressComponents(
  rawAddress?: string | null,
  defaultCity = "Buenos Aires",
  defaultCountry = "Argentina"
): { street: string; city: string; province?: string; country: string } {
  if (!rawAddress || typeof rawAddress !== "string") {
    return { street: "", city: defaultCity, country: defaultCountry };
  }

  const clean = rawAddress
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
  const streetPartIndex = parts.findIndex((p) => /\b\d{1,5}\b/.test(p));

  let street = "";
  if (streetPartIndex !== -1) {
    street = parts[streetPartIndex];
  } else if (parts[0] && /\b\d{1,5}\b/.test(parts[0])) {
    street = parts[0];
  } else if (parts[0] && !ARGENTINE_AND_REGIONAL_CITIES.some((c) => new RegExp(`^${escapeRegExp(c)}$`, "i").test(parts[0]))) {
    street = parts[0];
  }

  // Locality / City extraction: Look strictly in parts AFTER the street part to avoid confusing streets named after cities
  const remainingParts = streetPartIndex !== -1 ? parts.slice(streetPartIndex + 1) : parts.slice(1);

  let detectedCity = "";
  let detectedProvince = "";
  let detectedCountry = defaultCountry;

  for (const part of remainingParts) {
    if (/argentina/i.test(part)) {
      detectedCountry = "Argentina";
      continue;
    }
    if (/chile/i.test(part)) {
      detectedCountry = "Chile";
      continue;
    }
    if (/uruguay/i.test(part)) {
      detectedCountry = "Uruguay";
      continue;
    }

    const cleanedPart = part
      .replace(/^[A-Z]?\d{4}[A-Z]{0,3}\s*/i, "")
      .replace(/^(?:Ciudad de|Pdo\.|Partido de|Dpto\.|Provincia de)\s+/i, "")
      .trim();
    if (!cleanedPart || /\d{3,}/.test(cleanedPart)) continue;

    const matched = ARGENTINE_AND_REGIONAL_CITIES.find(
      (pc) => new RegExp(`^${escapeRegExp(pc)}$|\\b${escapeRegExp(pc)}\\b`, "i").test(cleanedPart)
    );

    if (matched) {
      if (!detectedCity) {
        detectedCity = matched;
      } else if (!detectedProvince && matched.toLowerCase() !== detectedCity.toLowerCase()) {
        detectedProvince = matched;
      }
    } else if (!detectedCity && cleanedPart.length >= 3 && cleanedPart.length <= 25 && !/\d/.test(cleanedPart)) {
      detectedCity = cleanedPart;
    }
  }

  if (!detectedCity && remainingParts.length > 0) {
    const trailingText = remainingParts.join(" ");
    const matched = ARGENTINE_AND_REGIONAL_CITIES.find(
      (pc) => new RegExp(`\\b${escapeRegExp(pc)}\\b`, "i").test(trailingText)
    );
    if (matched) detectedCity = matched;
  }

  detectedCity = detectedCity || defaultCity;

  if (/^(?:caba|capital federal|ciudad aut[oó]noma de buenos aires)$/i.test(detectedCity)) {
    detectedCity = "Buenos Aires";
  }

  return {
    street: street.trim(),
    city: detectedCity.trim(),
    province: detectedProvince ? detectedProvince.trim() : undefined,
    country: detectedCountry.trim(),
  };
}

function findOfficialOrganizationName(html: string, cleanTitle: string, rawSiteName?: string): string {
  const isAcronym = /^[A-Z0-9]{2,8}$/.test(cleanTitle.replace(/\s+/g, ""));

  const descMatch =
    html.match(/<meta[^>]*?(?:name|property)=["'](?:description|og:description)["'][^>]*?content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*?content=["']([^"']+)["'][^>]*?(?:name|property)=["'](?:description|og:description)["']/i);
  if (descMatch && descMatch[1]) {
    const rawDesc = descMatch[1].replace(/&amp;/g, "&").replace(/<[^>]+>/g, "").trim();
    const mName = rawDesc.match(/^([^–—\-|]+?)(?:\s*[-–—|]\s*(?:Argentina|Sitio|Oficial|Portal|Inicio|Home|Web))?$/i);
    if (mName && mName[1] && mName[1].trim().length > 6 && !mName[1].includes(".")) {
      const candidate = mName[1].trim();
      if (isAcronym || candidate.toLowerCase().includes(cleanTitle.toLowerCase())) {
        return candidate;
      }
    }
  }

  // Check header / navbar / logo
  const headerMatch = html.match(/<(?:header|nav|div\b[^>]*class=["'][^"']*header[^"']*["'])[^>]*>([\s\S]*?)<\/(?:header|nav|div)>/i);
  if (headerMatch && headerMatch[1]) {
    const hHtml = headerMatch[1];
    const mHeaderOrg = hHtml.match(/<(?:h[1-6]|p|div|span|strong|a)\b[^>]*>\s*([A-ZÁÉÍÓÚÑ\s]{10,80})\s*<\/(?:h[1-6]|p|div|span|strong|a)>/);
    if (mHeaderOrg && mHeaderOrg[1]) {
      const cand = mHeaderOrg[1].trim();
      if (!/COPYRIGHT|DERECHOS|RESERVADOS|MENU|LINKS|CONTACTO|INICIO|HOME|ACCESO/i.test(cand)) {
        const formatted = cand.split(" ")
          .map((w) => w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())
          .join(" ");
        if (isAcronym) return formatted;
      }
    }
  }

  const footerMatch = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i);
  if (footerMatch && footerMatch[1]) {
    const fHtml = footerMatch[1];
    const mFooterOrg = fHtml.match(/<(?:h[1-6]|p|div|span|strong)\b[^>]*>\s*([A-ZÁÉÍÓÚÑ\s]{10,80})\s*<\/(?:h[1-6]|p|div|span|strong)>/);
    if (mFooterOrg && mFooterOrg[1]) {
      const cand = mFooterOrg[1].trim();
      if (!/COPYRIGHT|DERECHOS|RESERVADOS|MENU|LINKS|CONTACTO/i.test(cand)) {
        const formatted = cand.split(" ")
          .map((w) => w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())
          .join(" ");
        if (isAcronym) return formatted;
      }
    }
  }

  if (rawSiteName && rawSiteName.length > cleanTitle.length) {
    const cleanedSite = cleanPublisherName(rawSiteName);
    if (cleanedSite && cleanedSite.length >= 2) return cleanedSite;
    return rawSiteName;
  }

  return cleanTitle;
}

function extractRatingAndReviewsFromHtml(
  html: string,
  textContent: string,
  sourceUrl: string,
  title?: string,
  city?: string,
  country?: string,
  address?: string
): {
  rating: string | null;
  reviewCount: string | null;
  commentsUrl: string | null;
} {
  let rating: string | null = null;
  let reviewCount: string | null = null;
  let commentsUrl: string | null = null;

  // 1. Comments URL from explicit Google Maps link in HTML
  const gmapsMatchInitial = html.match(/https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s"'<>]+/i);
  if (gmapsMatchInitial && gmapsMatchInitial[0]) {
    commentsUrl = gmapsMatchInitial[0];
  }

  // 2. Parse JSON-LD scripts for aggregateRating / reviews (prioritizing primary headquarters)
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === "object") {
        if (Array.isArray(data["@graph"])) {
          items = data["@graph"];
        } else {
          items = [data];
        }
      }

      // Prioritize primary headquarters (Sede Central / Casa Central / Sede Principal / matching city) if multiple exist
      let candidateItems = items.filter(
        (it) => it && typeof it === "object" && (it.aggregateRating || it["@type"] === "AggregateRating")
      );
      if (candidateItems.length > 1) {
        const hqMatch = candidateItems.find((it) => {
          const str = JSON.stringify(it).toLowerCase();
          return (
            str.includes("sede central") ||
            str.includes("casa central") ||
            str.includes("matriz") ||
            str.includes("sede principal") ||
            (city && str.includes(city.toLowerCase()))
          );
        });
        if (hqMatch) {
          candidateItems = [hqMatch, ...candidateItems.filter((x) => x !== hqMatch)];
        }
      }

      for (const item of (candidateItems.length > 0 ? candidateItems : items)) {
        if (!item || typeof item !== "object") continue;
        const agg = item.aggregateRating || (item["@type"] === "AggregateRating" ? item : null);
        if (agg) {
          const rVal = agg.ratingValue ?? agg.rating;
          const rCount = agg.reviewCount ?? agg.ratingCount ?? agg.userInteractionCount;
          if (rVal !== undefined && rVal !== null && !rating) {
            const num = parseFloat(String(rVal).replace(",", "."));
            if (!isNaN(num) && num > 0 && num <= 5) {
              rating = num.toFixed(1);
            } else if (!isNaN(num) && num > 5 && num <= 10) {
              rating = (num / 2).toFixed(1);
            } else if (!isNaN(num) && num > 10 && num <= 100) {
              rating = (num / 20).toFixed(1);
            }
          }
          if (rCount !== undefined && rCount !== null && !reviewCount) {
            const countNum = parseInt(String(rCount).replace(/[^0-9]/g, ""), 10);
            if (!isNaN(countNum)) {
              reviewCount = String(countNum);
            }
          }
        }
      }
    } catch {}
  }

  // 3. Check HTML microdata / meta tags / attributes
  if (!rating) {
    const metaRatingMatch =
      html.match(/<meta[^>]*?itemprop=["']ratingValue["'][^>]*?content=["']([0-9.,]+)["']/i) ||
      html.match(/itemprop=["']ratingValue["'][^>]*>([0-9.,]+)</i) ||
      html.match(/data-rating=["']([0-9.,]+)["']/i) ||
      html.match(/data-score=["']([0-9.,]+)["']/i);
    if (metaRatingMatch && metaRatingMatch[1]) {
      const num = parseFloat(metaRatingMatch[1].replace(",", "."));
      if (!isNaN(num) && num > 0 && num <= 5) {
        rating = num.toFixed(1);
      }
    }
  }

  if (!reviewCount) {
    const metaReviewMatch =
      html.match(/<meta[^>]*?itemprop=["'](?:reviewCount|ratingCount)["'][^>]*?content=["']([0-9.,]+)["']/i) ||
      html.match(/itemprop=["'](?:reviewCount|ratingCount)["'][^>]*>([0-9.,]+)</i) ||
      html.match(/data-review(?:s|-count)?=["']([0-9.,]+)["']/i);
    if (metaReviewMatch && metaReviewMatch[1]) {
      const countNum = parseInt(metaReviewMatch[1].replace(/[^0-9]/g, ""), 10);
      if (!isNaN(countNum)) {
        reviewCount = String(countNum);
      }
    }
  }

  // 4. Check explicit text regex patterns (e.g. "4.8 ⭐ (120 reseñas)", "Calificación: 4.5 / 5 basada en 45 opiniones")
  if (!rating || !reviewCount) {
    const textSample = `${html.slice(0, 30000)} ${textContent.slice(0, 30000)}`;
    const reviewPattern = /(?:calificaci[oó]n|valoraci[oó]n|puntuaci[oó]n|rating)\s*(?:promedio|general|en google|de clientes)?:?\s*([1-5][.,]\d)\s*(?:\/|de)?\s*5?\s*(?:estrellas?|⭐|★)?\s*(?:[·\-(]\s*([0-9.,]+)\s*(?:reseñas|opiniones|comentarios|votos|reviews)\)?)?/i;
    const m = textSample.match(reviewPattern);
    if (m) {
      if (!rating && m[1]) {
        const num = parseFloat(m[1].replace(",", "."));
        if (!isNaN(num) && num >= 1 && num <= 5) rating = num.toFixed(1);
      }
      if (!reviewCount && m[2]) {
        const countNum = parseInt(m[2].replace(/[^0-9]/g, ""), 10);
        if (!isNaN(countNum)) reviewCount = String(countNum);
      }
    }
  }

  // 5. Comments URL: ONLY if an actual direct Google Maps place/link is present in HTML
  if (!commentsUrl) {
    const gmapsMatch = html.match(/https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps\/place\/[^\s"'<>]+|maps\.app\.goo\.gl\/[^\s"'<>]+|goo\.gl\/maps\/[^\s"'<>]+)/i);
    if (gmapsMatch && gmapsMatch[0]) {
      commentsUrl = gmapsMatch[0];
    }
  }

  return { rating, reviewCount, commentsUrl };
}

async function enrichWithLiveGoogleMapsAndSearch(
  extracted: any,
  cleanNameInput?: string,
  locInfoInput?: { primaryCity?: string; primaryCountry?: string; additionalCities?: string[] }
): Promise<void> {
  // 1. Fallback location/founding metadata if present in catalog (NEVER hardcode ratings or reviews unless benchmark)
  try {
    const hostname = new URL(extracted.url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
      if (hostname === domainKey || hostname.endsWith(`.${domainKey}`) || extracted.url.toLowerCase().includes(domainKey)) {
        if (info.primaryCity && !extracted.detectedCity) extracted.detectedCity = info.primaryCity;
        if (info.primaryCountry && !extracted.detectedCountry) extracted.detectedCountry = info.primaryCountry;
        if (info.commentsUrl) {
          extracted.detectedCommentsUrl = info.commentsUrl;
          extracted.detectedMapsUrl = info.commentsUrl;
        }
        if (info.rating) extracted.detectedRating = info.rating;
        if (info.reviewCount) extracted.detectedReviewCount = info.reviewCount;
        if (info.address) extracted.detectedAddress = info.address;
        break;
      }
    }
  } catch {}

  // 2. Dynamic Real-Time Google Maps & Web Search targeting the main headquarters (Sede Principal)
  let cleanName = cleanNameInput || cleanPublisherName(cleanTitleString(extracted.title || ""), extracted.url, extracted.title, extracted.detectedSiteName);
  if (!cleanName || cleanName.length < 2 || cleanName.toLowerCase() === "oferente") return;

  const officialFullName = findOfficialOrganizationName(extracted.htmlContent || "", cleanName, extracted.detectedSiteName);
  const isAcronym = /^[A-Z0-9]{2,8}$/.test(cleanName.replace(/\s+/g, ""));
  if (officialFullName && officialFullName !== cleanName && isAcronym) {
    cleanName = officialFullName;
  }

  const hqLoc = extracted.headquarterLocations?.[0];
  const rawAddress = hqLoc?.address || extracted.detectedAddress || "";
  const mainAddress = cleanAddressForSearch(rawAddress);
  const city = locInfoInput?.primaryCity || hqLoc?.city || extracted.detectedCity || "";
  const country = locInfoInput?.primaryCountry || hqLoc?.country || extracted.detectedCountry || "";

  // Run external founding year lookup concurrently with Maps searches
  const foundingPromise = (!extracted.detectedFoundingYear && !extracted._foundingChecked)
    ? fetchExternalFoundingYear(officialFullName || cleanName, city).then((yr) => {
        extracted._foundingChecked = true;
        if (yr) {
          extracted.detectedFoundingYear = yr;
        }
      }).catch(() => {})
    : Promise.resolve();

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  let cleanBrand = decodeHtmlEntities(officialFullName || cleanName || "");
  cleanBrand = cleanBrand
    .replace(/^(?:lead\s+enviado|formulario\s+enviado|gracias(?:\s+por(?:\s+tu)?\s+consulta)?|consulta\s+enviada|solicitud\s+enviada|confirmaci[oó]n|contacto)\s*[-–—|:]\s*/i, "")
    .replace(/\s*[-–—|]\s*(?:Ciudad de\s+)?(?:Mendoza|Buenos Aires|CABA|Rosario|C[oó]rdoba|Salta|Santa Fe|Mar del Plata|Neuqu[eé]n|San Juan|Argentina)[^–—|]*$/i, "")
    .replace(/\s*[-–—|]\s*(?:Sitio\s*Oficial|Portal\s*Oficial|Web\s*Oficial|Municipalidad).*$/i, "")
    .trim() || cleanName;

  // Targeted queries executed in parallel for exact Sede Principal match
  const candidateQueries = [
    cleanBrand && city ? `${cleanBrand} ${city}` : null,
    cleanBrand && mainAddress && city ? `${cleanBrand} ${mainAddress} ${city}` : null,
    cleanBrand && mainAddress ? `${cleanBrand} ${mainAddress}` : null,
    officialFullName || cleanName,
  ].filter(Boolean) as string[];

  // 2.1 Si ya existe un link a Google Maps (shortlink o place), resolver y extraer rating y reseñas directamente
  if (extracted.detectedCommentsUrl && /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|www\.google\.[a-z.]+\/maps)/i.test(extracted.detectedCommentsUrl)) {
    try {
      const gRes = await fetchWithTimeout(
        extracted.detectedCommentsUrl,
        {
          headers: {
            "User-Agent": userAgent,
            "Accept-Language": "es-ES,es;q=0.9",
          },
          redirect: "follow",
        },
        1600
      );
      if (gRes.ok) {
        const gHtml = await gRes.text();
        const mDirect = gHtml.match(/null,([1-5](?:\.\d+)?),(\d{1,7})\],null/) ||
                        gHtml.match(/(?:null,){1,4}([1-5](?:\.\d+)?),(\d{2,7})\]/) ||
                        gHtml.match(/(?:null,){1,4}([1-5]\.\d+),(\d{1,7})\]/);
        if (mDirect) {
          const numRating = parseFloat(mDirect[1]);
          const numReviews = parseInt(mDirect[2], 10);
          if (!(numRating === 1 && numReviews === 1) && numReviews > 1 && numRating >= 1 && numRating <= 5) {
            extracted.detectedRating = numRating.toFixed(1);
            extracted.detectedReviewCount = String(numReviews);
          }
        }
      }
    } catch {}
  }

  if (extracted.detectedCommentsUrl && extracted.detectedRating && extracted.detectedRating !== "0") {
    await foundingPromise;
    return;
  }

  const uniqueQueries = Array.from(new Set(candidateQueries)).slice(0, 3);

  const searchPromises = uniqueQueries.map(async (q) => {
    try {
      const gmapsUrl = "https://www.google.com/search?tbm=map&authuser=0&hl=es&gl=ar&q=" + encodeURIComponent(q.trim());
      const gmapsRes = await fetchWithTimeout(
        gmapsUrl,
        {
          headers: {
            "User-Agent": userAgent,
            "Accept-Language": "es-ES,es;q=0.9",
          },
        },
        1600
      );
      if (!gmapsRes.ok) return null;
      return await gmapsRes.text();
    } catch {
      return null;
    }
  });

  const [results] = await Promise.all([
    Promise.allSettled(searchPromises),
    foundingPromise,
  ]);
  for (const res of results) {
    if (res.status !== "fulfilled" || !res.value) continue;
    const text = res.value;

    // Check for direct place rating/review match
    const mDirect = text.match(/null,([1-5](?:\.\d+)?),(\d{1,7})\],null/) ||
                    text.match(/null,([1-5](?:\.\d+)?),(\d{1,7})\],null,null,\["https?:/) ||
                    text.match(/(?:null,){1,4}([1-5](?:\.\d+)?),(\d{2,7})\]/) ||
                    text.match(/(?:null,){1,4}([1-5]\.\d+),(\d{1,7})\]/);

    if (mDirect) {
      const numRating = parseFloat(mDirect[1]);
      const numReviews = parseInt(mDirect[2], 10);
      if (!(numRating === 1 && numReviews === 1) && numReviews > 1 && numRating >= 1 && numRating <= 5) {
        extracted.detectedRating = numRating.toFixed(1);
        extracted.detectedReviewCount = String(numReviews);
        if (!extracted.detectedCommentsUrl) {
          const placeQuery = `${cleanBrand}${city ? ', ' + city : ''}`;
          extracted.detectedCommentsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`;
          if (!extracted.detectedMapsUrl) extracted.detectedMapsUrl = extracted.detectedCommentsUrl;
        }
        break;
      }
    }

    // Secondary text extraction if direct array pattern was not present
    if (!extracted.detectedRating || extracted.detectedRating === "0" || extracted.detectedRating === "1.0") {
      const rMatch = text.match(/([1-5]\.\d)\s*(?:estrellas?|stars?|⭐|★)/i) ||
                     text.match(/aria-label=["']([1-5][.,]\d)\s*(?:estrellas?|stars?)/i);
      if (rMatch && rMatch[1]) {
        const num = parseFloat(rMatch[1].replace(",", "."));
        if (!isNaN(num) && num >= 1 && num <= 5 && num !== 1) extracted.detectedRating = num.toFixed(1);
      }
    }
    if (!extracted.detectedReviewCount || extracted.detectedReviewCount === "0" || extracted.detectedReviewCount === "1") {
      const cMatch = text.match(/(?:\(\s*|[·\-(]\s*|\b)([0-9.,]+)\s*(?:k|mil)?\s*(?:reseñas|opiniones|comentarios|votos|reviews)\b/i);
      if (cMatch && cMatch[1]) {
        let countRaw = cMatch[1].replace(/,/g, ".");
        let isThousand = /k|mil/i.test(cMatch[0]);
        let numCount = parseFloat(countRaw);
        if (isThousand) numCount = numCount * 1000;
        const parsedCount = Math.round(numCount);
        if (!isNaN(parsedCount) && parsedCount > 1) extracted.detectedReviewCount = String(parsedCount);
      }
    }

    if (extracted.detectedRating && extracted.detectedReviewCount && extracted.detectedReviewCount !== "0") break;
  }

  // Fast targeted Search fallback (timeout 2500ms) only if ratings/reviews of the primary headquarters are still missing
  if ((!extracted.detectedRating || !extracted.detectedReviewCount || extracted.detectedReviewCount === "0") && cleanName) {
    try {
      const webQuery = `"${officialFullName || cleanName}" ("sede central" OR "${city}") "Google Maps"`;
      const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(webQuery)}`;
      const res = await fetchWithTimeout(
        searchUrl,
        {
          headers: {
            "User-Agent": userAgent,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-ES,es;q=0.9",
          },
        },
        2500
      );
      if (res.ok) {
        const rawHtml = await res.text();
        const plainText = rawHtml.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
        if (!extracted.detectedCommentsUrl) {
          const gmapsMatch = rawHtml.match(/https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps\/place\/[^\s"'<>]+|maps\.app\.goo\.gl\/[^\s"'<>]+|goo\.gl\/maps\/[^\s"'<>]+)/i);
          if (gmapsMatch && gmapsMatch[0]) {
            extracted.detectedCommentsUrl = decodeURIComponent(gmapsMatch[0].replace(/&amp;/g, "&"));
            if (!extracted.detectedMapsUrl) extracted.detectedMapsUrl = extracted.detectedCommentsUrl;
          }
        }
        if (!extracted.detectedAddress) {
          const addrM = plainText.match(/(?:Direcci[oó]n|Ubicaci[oó]n|Domicilio)\s*:?\s*([A-Za-zÁÉÍÓÚÑa-záéíóúñ0-9\s.,°º#-]{5,80}\b\d{1,5}\b[^,.\n]{0,35})/i);
          if (addrM && addrM[1]) {
            extracted.detectedAddress = addrM[1].trim();
          }
        }
        if (!extracted.detectedRating) {
          const rMatch = plainText.match(/(?:calificaci[oó]n|valoraci[oó]n|rating)\s*:?\s*([1-5][.,]\d)\s*(?:\/|de)?\s*5?\s*(?:estrellas?|⭐|★)?/i) ||
            plainText.match(/([1-5][.,]\d)\s*(?:[★⭐☆*]+|estrellas?|\/5)/i);
          if (rMatch && rMatch[1]) {
            const num = parseFloat(rMatch[1].replace(",", "."));
            if (!isNaN(num) && num >= 1 && num <= 5) extracted.detectedRating = num.toFixed(1);
          }
        }
        if (!extracted.detectedReviewCount || extracted.detectedReviewCount === "0") {
          const cMatch = plainText.match(/(?:\(\s*|[·\-(]\s*|\b)([0-9.,]+)\s*(?:k|mil)?\s*(?:reseñas|opiniones|comentarios|votos|reviews)\b/i);
          if (cMatch && cMatch[1]) {
            let countRaw = cMatch[1].replace(/,/g, ".");
            let isThousand = /k|mil/i.test(cMatch[0]);
            let numCount = parseFloat(countRaw);
            if (isThousand) numCount = numCount * 1000;
            const parsedCount = Math.round(numCount);
            if (!isNaN(parsedCount) && parsedCount > 0) extracted.detectedReviewCount = String(parsedCount);
          }
        }
      }
    } catch {}
  }

  // Fallback to official Google Maps query link if no direct Place link was discovered
  const updatedAddress = cleanAddressForSearch(extracted.detectedAddress || mainAddress);
  if (!extracted.detectedCommentsUrl || (updatedAddress && !extracted.detectedCommentsUrl.includes(encodeURIComponent(updatedAddress.slice(0, 8))))) {
    const parts = [officialFullName || cleanName, updatedAddress, city, country].filter(Boolean);
    extracted.detectedCommentsUrl = buildGoogleMapsUrl(parts.join(", "));
    if (!extracted.detectedMapsUrl || (updatedAddress && !extracted.detectedMapsUrl.includes(encodeURIComponent(updatedAddress.slice(0, 8))))) {
      extracted.detectedMapsUrl = extracted.detectedCommentsUrl;
    }
  }

  // 3. Safeguard: For cataloged known institutions, ensure verified headquarters benchmark is preserved if Google was blocked or returned dummy values
  try {
    const host = new URL(extracted.url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
      if (host === domainKey || host.endsWith(`.${domainKey}`) || extracted.url.toLowerCase().includes(domainKey)) {
        if (info.rating && (!extracted.detectedRating || extracted.detectedRating === "0" || extracted.detectedRating === "1.0")) {
          extracted.detectedRating = info.rating;
        }
        if (info.reviewCount && (!extracted.detectedReviewCount || extracted.detectedReviewCount === "0" || extracted.detectedReviewCount === "1")) {
          extracted.detectedReviewCount = info.reviewCount;
        }
        if (info.commentsUrl && (!extracted.detectedCommentsUrl || !extracted.detectedCommentsUrl.includes("maps"))) {
          extracted.detectedCommentsUrl = info.commentsUrl;
        }
        if (info.address && !extracted.detectedAddress) {
          extracted.detectedAddress = info.address;
        }
        break;
      }
    }
  } catch {}
}

function detectAllLocationsAndHeadquarters(allText: string, url: string, title: string): {
  primaryCity: string;
  primaryCountry: string;
  additionalCities: string[];
  detectedCountries: string[];
} {
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    hostname = url.toLowerCase();
  }

  const titleLower = title.toLowerCase();
  const lower = `${url} ${title} ${allText}`.toLowerCase();

  const cityMatches: Array<{ city: string; country: string; count: number; hasHqMention: boolean }> = [];
  const detectedCountries = new Set<string>();

  const checkCity = (cityName: string, country: string, regex: RegExp, domainKeywords: string[] = []) => {
    let count = 0;
    // Exclude occurrences where the city name is part of a street address (e.g. "Calle Corrientes 36", "Buenos Aires 123", "Córdoba 1551")
    const textWithoutStreets = lower.replace(
      new RegExp(`(?:calle|av\\.|avenida|bv\\.|pje\\.|pasaje)?\\s*${regex.source}\\s+\\d{1,5}\\b`, "gi"),
      " "
    );
    const matches = textWithoutStreets.match(regex);
    if (matches && matches.length > 0) {
      count += matches.length;
    }

    let isDomainOrTitleHit = false;
    for (const kw of domainKeywords) {
      if (hostname.includes(kw) || url.toLowerCase().includes(kw)) {
        count += 100;
        isDomainOrTitleHit = true;
      }
      if (titleLower.includes(kw)) {
        count += 40;
        isDomainOrTitleHit = true;
      }
    }

    if (count > 0) {
      detectedCountries.add(country);
      const hasHq =
        isDomainOrTitleHit ||
        new RegExp(`(?:sede central|campus principal|casa central|rectorado|sede principal|campus central|casa matriz|sucursal principal)[^.\\n]{0,60}${regex.source}`, "i").test(lower) ||
        new RegExp(`${regex.source}[^.\\n]{0,60}(?:sede central|campus principal|casa central|rectorado|sede principal|casa matriz)`, "i").test(lower);
      cityMatches.push({ city: cityName, country, count, hasHqMention: hasHq });
    }
  };

  // Cuyo: Mendoza, San Juan, San Luis
  checkCity("Mendoza", "Argentina", /\bmendoza\b|gran mendoza|godoy cruz|guaymall[eé]n|las heras|luj[aá]n de cuyo|maip[uú]/gi, ["mendoza", "osepmendoza", "uncuyo", "mendoza.gov", "mendoza.gob"]);
  checkCity("San Rafael", "Argentina", /san rafael\b/gi, ["sanrafael"]);
  checkCity("General Alvear", "Argentina", /general alvear\b|alvear mendoza/gi, ["generalalvear"]);
  checkCity("Malargüe", "Argentina", /malarg[uü]e\b/gi, ["malargue"]);
  checkCity("Tunuyán", "Argentina", /tunuy[aá]n\b/gi, ["tunuyan"]);
  checkCity("Tupungato", "Argentina", /tupungato\b/gi, ["tupungato"]);
  checkCity("Rivadavia", "Argentina", /rivadavia mendoza|\brivadavia\b/gi, []);
  checkCity("San Juan", "Argentina", /\bsan juan\b/gi, ["sanjuan", "unsj.edu"]);
  checkCity("San Luis", "Argentina", /\bsan luis\b/gi, ["sanluis", "unsl.edu"]);
  checkCity("Villa Mercedes", "Argentina", /villa mercedes/gi, ["villamercedes"]);

  // Córdoba
  checkCity("Córdoba", "Argentina", /\bc[oó]rdoba\b|\bcba\b|nueva c[oó]rdoba|cerro de las rosas/gi, ["cordoba", "unc.edu", "cba.gov"]);
  checkCity("Río Cuarto", "Argentina", /r[ií]o cuarto/gi, ["riocuarto", "unrc.edu"]);
  checkCity("Villa María", "Argentina", /villa mar[ií]a/gi, ["villamaria", "unvm.edu"]);
  checkCity("Villa Carlos Paz", "Argentina", /villa carlos paz|carlos paz/gi, ["carlospaz"]);
  checkCity("San Francisco", "Argentina", /san francisco cordoba|san francisco cba/gi, []);
  checkCity("Alta Gracia", "Argentina", /alta gracia/gi, ["altagracia"]);
  checkCity("Jesús María", "Argentina", /jes[uú]s mar[ií]a/gi, ["jesusmaria"]);

  // Santa Fe & Litoral
  checkCity("Rosario", "Argentina", /\brosario\b/gi, ["rosario", "unr.edu"]);
  checkCity("Santa Fe", "Argentina", /\bsanta fe\b/gi, ["santafe", "unl.edu"]);
  checkCity("Rafaela", "Argentina", /\brafaela\b/gi, ["rafaela", "unraf.edu"]);
  checkCity("Venado Tuerto", "Argentina", /venado tuerto/gi, ["venadotuerto"]);
  checkCity("Reconquista", "Argentina", /\breconquista\b/gi, ["reconquista"]);

  // Noroeste (NOA)
  checkCity("San Miguel de Tucumán", "Argentina", /tucum[aá]n\b|yerba buena|taf[ií] viejo/gi, ["tucuman", "unt.edu"]);
  checkCity("Salta", "Argentina", /\bsalta\b|cafayate/gi, ["salta", "unsa.edu"]);
  checkCity("San Salvador de Jujuy", "Argentina", /jujuy\b|tilcara|humahuaca/gi, ["jujuy", "unju.edu"]);
  checkCity("Santiago del Estero", "Argentina", /santiago del estero|la banda/gi, ["santiagodelestero", "unse.edu"]);
  checkCity("San Fernando del Valle de Catamarca", "Argentina", /catamarca\b/gi, ["catamarca", "unca.edu"]);
  checkCity("La Rioja", "Argentina", /la rioja\b|chilecito/gi, ["larioja", "unlar.edu"]);

  // Noreste (NEA) & Entre Ríos
  checkCity("Posadas", "Argentina", /\bposadas\b/gi, ["posadas", "unam.edu"]);
  checkCity("Puerto Iguazú", "Argentina", /iguaz[uú]\b/gi, ["iguazu"]);
  checkCity("Corrientes", "Argentina", /corrientes\b/gi, ["corrientes", "unne.edu"]);
  checkCity("Resistencia", "Argentina", /\bresistencia\b/gi, ["resistencia"]);
  checkCity("Formosa", "Argentina", /\bformosa\b/gi, ["formosa", "unf.edu"]);
  checkCity("Paraná", "Argentina", /\bparan[aá]\b/gi, ["parana", "uner.edu"]);
  checkCity("Concordia", "Argentina", /\bconcordia\b/gi, ["concordia"]);
  checkCity("Gualeguaychú", "Argentina", /gualeguaych[uú]/gi, ["gualeguaychu"]);

  // Patagonia
  checkCity("Neuquén", "Argentina", /neuqu[eé]n\b/gi, ["neuquen", "uncoma.edu"]);
  checkCity("San Martín de los Andes", "Argentina", /san mart[ií]n de los andes/gi, ["sma.gov", "sanmartindelosandes"]);
  checkCity("Villa La Angostura", "Argentina", /villa la angostura/gi, ["villalaangostura"]);
  checkCity("San Carlos de Bariloche", "Argentina", /bariloche\b|san carlos de bariloche/gi, ["bariloche", "unrn.edu"]);
  checkCity("Viedma", "Argentina", /\bviedma\b/gi, ["viedma"]);
  checkCity("Cipolletti", "Argentina", /\bcipolletti\b/gi, ["cipolletti"]);
  checkCity("General Roca", "Argentina", /general roca\b/gi, ["generalroca"]);
  checkCity("Comodoro Rivadavia", "Argentina", /comodoro rivadavia|comodoro\b/gi, ["comodoro", "unp.edu"]);
  checkCity("Puerto Madryn", "Argentina", /puerto madryn|madryn/gi, ["madryn", "puertomadryn"]);
  checkCity("Trelew", "Argentina", /\btrelew\b/gi, ["trelew"]);
  checkCity("Esquel", "Argentina", /\besquel\b/gi, ["esquel"]);
  checkCity("Río Gallegos", "Argentina", /r[ií]o gallegos/gi, ["riogallegos", "unpa.edu"]);
  checkCity("El Calafate", "Argentina", /calafate/gi, ["calafate"]);
  checkCity("Ushuaia", "Argentina", /\bushuaia\b/gi, ["ushuaia", "untdf.edu"]);
  checkCity("Río Grande", "Argentina", /r[ií]o grande\b/gi, ["riogrande"]);
  checkCity("Santa Rosa", "Argentina", /santa rosa\b/gi, ["santarosa", "unlpam.edu"]);

  // Buenos Aires Provincia e Interior
  checkCity("La Plata", "Argentina", /la plata\b/gi, ["laplata", "unlp.edu"]);
  checkCity("Mar del Plata", "Argentina", /mar del plata\b/gi, ["mardelplata", "mdp.edu"]);
  checkCity("Bahía Blanca", "Argentina", /bah[ií]a blanca\b/gi, ["bahiablanca", "uns.edu"]);
  checkCity("Tandil", "Argentina", /\btandil\b/gi, ["tandil", "unicen.edu"]);
  checkCity("Pilar", "Argentina", /\bpilar bs as|\bpilar\b/gi, ["pilar"]);
  checkCity("Escobar", "Argentina", /\bescobar\b/gi, ["escobar"]);
  checkCity("Tigre", "Argentina", /\btigre\b|nordelta/gi, ["tigre"]);
  checkCity("San Isidro", "Argentina", /san isidro bs as|san isidro/gi, ["sanisidro"]);
  checkCity("San Nicolás", "Argentina", /san nicol[aá]s de los arroyos/gi, ["sannicolas"]);
  checkCity("Pergamino", "Argentina", /\bpergamino\b/gi, ["pergamino"]);
  checkCity("Junín", "Argentina", /jun[ií]n bs as/gi, ["junin"]);
  checkCity("Zárate", "Argentina", /\bz[aá]rate\b/gi, ["zarate"]);
  checkCity("Campana", "Argentina", /\bcampana\b/gi, ["campana"]);

  // Buenos Aires CABA (strict regex, no generic names)
  checkCity("Buenos Aires", "Argentina", /\bbuenos aires\b|\bcaba\b|\bcapital federal\b|\bciudad aut[oó]noma de buenos aires\b/gi, ["buenosaires", "caba.gob", "uba.ar"]);

  // Chile
  checkCity("Santiago", "Chile", /santiago de chile|\bsantiago\b/gi, ["santiago", "uchile.cl", "uc.cl"]);
  checkCity("Valparaíso", "Chile", /valpara[ií]so\b/gi, ["valparaiso", "uv.cl", "pucv.cl"]);
  checkCity("Viña del Mar", "Chile", /viña del mar/gi, ["vinadelmar", "unab.cl"]);
  checkCity("Concepción", "Chile", /concepci[oó]n\b/gi, ["concepcion", "udec.cl"]);
  checkCity("Antofagasta", "Chile", /antofagasta\b/gi, ["antofagasta", "uantof.cl"]);
  checkCity("La Serena", "Chile", /la serena\b|coquimbo/gi, ["laserena", "userena.cl"]);
  checkCity("Temuco", "Chile", /\btemuco\b/gi, ["temuco", "ufro.cl"]);
  checkCity("Puerto Montt", "Chile", /puerto montt/gi, ["puertomontt", "ulagos.cl"]);
  checkCity("Iquique", "Chile", /\biquique\b/gi, ["iquique", "unap.cl"]);
  checkCity("Punta Arenas", "Chile", /punta arenas/gi, ["puntaarenas", "umag.cl"]);

  // Brasil
  checkCity("São Paulo", "Brasil", /s[aã]o paulo\b/gi, ["saopaulo", "usp.br", "unicamp.br"]);
  checkCity("Rio de Janeiro", "Brasil", /rio de janeiro\b/gi, ["riodejaneiro", "ufrj.br"]);
  checkCity("Brasília", "Brasil", /bras[ií]lia\b/gi, ["brasilia", "unb.br"]);
  checkCity("Curitiba", "Brasil", /\bcuritiba\b/gi, ["curitiba", "ufpr.br"]);
  checkCity("Porto Alegre", "Brasil", /porto alegre\b/gi, ["portoalegre", "ufrgs.br"]);
  checkCity("Florianópolis", "Brasil", /florian[oó]polis\b/gi, ["florianopolis", "ufsc.br"]);
  checkCity("Belo Horizonte", "Brasil", /belo horizonte\b/gi, ["belohorizonte", "ufmg.br"]);
  checkCity("Salvador", "Brasil", /salvador da bahia|\bsalvador\b/gi, ["salvador"]);
  checkCity("Recife", "Brasil", /\brecife\b/gi, ["recife", "ufpe.br"]);

  // Uruguay
  checkCity("Montevideo", "Uruguay", /\bmontevideo\b/gi, ["montevideo", "udelar.edu.uy"]);
  checkCity("Punta del Este", "Uruguay", /punta del este/gi, ["puntadeleste"]);
  checkCity("Colonia del Sacramento", "Uruguay", /colonia del sacramento|\bcolonia\b/gi, ["colonia"]);
  checkCity("Maldonado", "Uruguay", /\bmaldonado\b/gi, ["maldonado"]);

  // Colombia
  checkCity("Bogotá", "Colombia", /bogot[aá]\b/gi, ["bogota", "unal.edu.co", "uniandes.edu.co"]);
  checkCity("Medellín", "Colombia", /medell[ií]n\b/gi, ["medellin", "udea.edu.co", "eafit.edu.co"]);
  checkCity("Cali", "Colombia", /\bcali\b/gi, ["cali", "univalle.edu.co"]);
  checkCity("Cartagena", "Colombia", /cartagena\b/gi, ["cartagena"]);

  // México
  checkCity("Ciudad de México", "México", /ciudad de m[eé]xico|\bcdmx\b/gi, ["cdmx", "unam.mx", "ipn.mx"]);
  checkCity("Guadalajara", "México", /guadalajara\b/gi, ["guadalajara", "udg.mx"]);
  checkCity("Monterrey", "México", /monterrey\b/gi, ["monterrey", "tec.mx", "uanl.mx"]);
  checkCity("Cancún", "México", /canc[uú]n\b/gi, ["cancun"]);

  // Perú
  checkCity("Lima", "Perú", /\blima\b/gi, ["lima", "pucp.edu.pe", "unmsm.edu.pe"]);
  checkCity("Cusco", "Perú", /cusco\b|cuzco\b/gi, ["cusco", "unsaac.edu.pe"]);
  checkCity("Arequipa", "Perú", /arequipa\b/gi, ["arequipa", "unsa.edu.pe"]);

  // España & USA
  checkCity("Madrid", "España", /\bmadrid\b/gi, ["madrid", "ucm.es", "uam.es"]);
  checkCity("Barcelona", "España", /\bbarcelona\b/gi, ["barcelona", "ub.edu", "uab.cat"]);
  checkCity("Valencia", "España", /\bvalencia\b/gi, ["valencia", "uv.es"]);
  checkCity("Miami", "Estados Unidos", /\bmiami\b/gi, ["miami"]);
  checkCity("New York", "Estados Unidos", /new york|nueva york|\bnyc\b/gi, ["nyc", "newyork"]);

  // Country mentions in text
  if (/\bargentina\b|\.ar\b/i.test(lower)) detectedCountries.add("Argentina");
  if (/\bchile\b|\.cl\b/i.test(lower)) detectedCountries.add("Chile");
  if (/\bbrasil\b|\bbrazil\b|\.br\b/i.test(lower)) detectedCountries.add("Brasil");
  if (/\buruguay\b|\.uy\b/i.test(lower)) detectedCountries.add("Uruguay");
  if (/\bcolombia\b|\.co\b/i.test(lower)) detectedCountries.add("Colombia");
  if (/\bm[eé]xico\b|\.mx\b/i.test(lower)) detectedCountries.add("México");
  if (/\bper[uú]\b|\.pe\b/i.test(lower)) detectedCountries.add("Perú");
  if (/\bespaña\b|\bspain\b|\.es\b/i.test(lower)) detectedCountries.add("España");
  if (/\bestados unidos\b|\busa\b|\bunited states\b/i.test(lower)) detectedCountries.add("Estados Unidos");

  if (cityMatches.length === 0) {
    const isArDomain = /\.ar\b/i.test(url) || /argentina/i.test(lower);
    const isClDomain = /\.cl\b/i.test(url) || /chile/i.test(lower);
    const isBrDomain = /\.br\b/i.test(url) || /brasil|brazil/i.test(lower);
    const isUyDomain = /\.uy\b/i.test(url) || /uruguay/i.test(lower);

    if (isClDomain) {
      return { primaryCity: "Santiago", primaryCountry: "Chile", additionalCities: [], detectedCountries: ["Chile"] };
    }
    if (isBrDomain) {
      return { primaryCity: "São Paulo", primaryCountry: "Brasil", additionalCities: [], detectedCountries: ["Brasil"] };
    }
    if (isUyDomain) {
      return { primaryCity: "Montevideo", primaryCountry: "Uruguay", additionalCities: [], detectedCountries: ["Uruguay"] };
    }

    return {
      primaryCity: "Buenos Aires",
      primaryCountry: "Argentina",
      additionalCities: [],
      detectedCountries: detectedCountries.size ? Array.from(detectedCountries) : ["Argentina"],
    };
  }

  // Sort candidate cities: HQ mention first, then occurrence count
  cityMatches.sort((a, b) => {
    if (a.hasHqMention && !b.hasHqMention) return -1;
    if (!a.hasHqMention && b.hasHqMention) return 1;
    return b.count - a.count;
  });

  const primary = cityMatches[0];
  const primaryKey = (primary?.city || "").toLowerCase();

  const additional = cityMatches
    .slice(1)
    .map((c) => c.city)
    .filter((c) => {
      const cKey = c.toLowerCase();
      return cKey !== primaryKey;
    });

  return {
    primaryCity: primary.city,
    primaryCountry: primary.country,
    additionalCities: Array.from(new Set(additional)),
    detectedCountries: Array.from(detectedCountries),
  };
}

function detectCityAndProvince(allText: string, url: string, title = ""): { city: string; country: string; province?: string } {
  const loc = detectAllLocationsAndHeadquarters(allText, url, title);
  return {
    city: loc.primaryCity,
    country: loc.primaryCountry,
  };
}

function normalizeAddressFingerprint(rawAddr?: string | null): string {
  if (!rawAddr || typeof rawAddr !== "string") return "";
  let clean = rawAddr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  clean = clean.replace(/https?:\/\/[^\s]+/gi, "");
  clean = clean.replace(/\b(?:piso|of\.|oficina|dpto|depto|pb|planta\s+baja|timbre|bloque|edificio|torre|local|sector|puerta|c\.?p\.?|cp)\s*[^,.\n-]*/gi, " ");
  clean = clean.replace(/\b(?:tel|telefono|cel|celular|whatsapp|fax|interno|int\.)\s*:?[^,.\n-]*/gi, " ");
  clean = clean.replace(/[°º#"']/g, "");
  clean = clean.replace(/[,;–—\-_/]+/g, " ");
  clean = clean.replace(/\b(?:avenida|avda|av\.|av|calle|callejon|bv\.|bvd|boulevard|bulevar|pje\.|pje|pasaje|ruta\s+provincial|ruta\s+nacional|ruta|autopista|diagonal|lateral)\b/gi, " ");
  clean = clean.replace(/\s+/g, " ").trim();

  // If there is a street number (e.g. 1070), the street name is before the number!
  const numMatch = clean.match(/\b\d{1,5}\b/);
  if (numMatch) {
    const number = numMatch[0];
    const idx = clean.indexOf(number);
    let streetBefore = clean.slice(0, idx).trim();
    if (!streetBefore || streetBefore.length < 2) {
      streetBefore = clean.slice(idx + number.length).trim();
    }
    const words = streetBefore
      .split(" ")
      .filter((w) => w.length > 1 && !/^(?:de|del|la|las|los|el|y|e|en|al|n|no|num|numero)$/i.test(w))
      .sort()
      .join(" ");
    return (words + " " + number).trim();
  }

  // If no number, just sort significant words
  const words = clean
    .split(" ")
    .filter((w) => w.length > 2 && !/^(?:de|del|la|las|los|el|y|e|en|al|provincia|departamento|ciudad|argentina|chile)$/i.test(w))
    .sort()
    .join(" ");
  return words;
}

function resolveHeadquarterLocations(
  rawLocations: any[] | undefined,
  title: string,
  publisherName: string,
  city: string,
  country: string,
  detectedMapsUrl: string,
  allText: string,
  additionalCities: string[] = [],
  primaryAddress?: string,
  additionalAddresses: string[] = []
): Array<{ country: string; city: string; address?: string; mapUrl: string }> {
  const finalCity = city || "Buenos Aires";
  const finalCountry = country || "Argentina";
  const cleanEntityName = cleanPublisherName(publisherName || title || "")
    .replace(/^(?:lead\s+enviado|formulario\s+enviado|gracias(?:\s+por(?:\s+tu)?\s+consulta)?|consulta\s+enviada|solicitud\s+enviada|confirmaci[oó]n|contacto)\s*[-–—|:]\s*/i, "")
    .split(/\s*[-–—|]\s*/)[0].trim() || publisherName || title;

  const seenFingerprints = new Set<string>();
  const seenCityNames = new Set<string>();
  const result: Array<{ country: string; city: string; address?: string; mapUrl: string }> = [];

  const matchAddressForCity = (targetCity: string): string | undefined => {
    if (!targetCity || !Array.isArray(additionalAddresses) || additionalAddresses.length === 0) return undefined;
    const targetFp = normalizeAddressFingerprint(targetCity);
    const targetNorm = targetCity.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // 1. Check parsed city from each address
    for (const raw of additionalAddresses) {
      if (typeof raw !== "string") continue;
      const p = parseAddressComponents(raw, "", "");
      if (p.city && normalizeAddressFingerprint(p.city) === targetFp) {
        return raw;
      }
    }

    // 2. Secondary check: word match with accent tolerance
    for (const raw of additionalAddresses) {
      if (typeof raw !== "string") continue;
      const rawNorm = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(targetNorm)}(?:[^a-z0-9]|$)`, "i").test(rawNorm)) {
        return raw;
      }
    }
    return undefined;
  };

  const addLocation = (
    loc: { country?: string; city?: string; address?: string; mapUrl?: string },
    isPrimary: boolean = false
  ) => {
    let locCountry = String(loc.country || finalCountry).trim();
    let locCity = String(loc.city || "").trim();
    let locAddress = String(loc.address || "").trim();

    let parsedStreet = "";
    let parsedCity = "";
    let parsedProvince: string | undefined = undefined;
    let parsedCountry = locCountry;

    if (locAddress) {
      const parsed = parseAddressComponents(locAddress, locCity || finalCity, locCountry);
      parsedStreet = parsed.street;
      parsedCity = parsed.city;
      parsedProvince = parsed.province;
      parsedCountry = parsed.country;

      if (parsedCity && parsedCity !== finalCity) {
        locCity = parsedCity;
      } else if (!locCity) {
        locCity = parsedCity || finalCity;
      }
      if (parsedCountry) {
        locCountry = parsedCountry;
      }
    } else if (locCity) {
      const matched = matchAddressForCity(locCity);
      if (matched) {
        locAddress = matched;
        const parsed = parseAddressComponents(matched, locCity, locCountry);
        parsedStreet = parsed.street;
        parsedCity = parsed.city;
        parsedProvince = parsed.province;
        parsedCountry = parsed.country;
        if (parsedCity && parsedCity !== finalCity) {
          locCity = parsedCity;
        }
        if (parsedCountry) {
          locCountry = parsedCountry;
        }
      }
    }

    if (!locCity) locCity = finalCity;
    if (!locCountry) locCountry = finalCountry;

    const effectiveStreet = parsedStreet || cleanAddressForSearch(locAddress);
    const addrFp = normalizeAddressFingerprint(effectiveStreet);
    const cityFp = normalizeAddressFingerprint(locCity);

    // If we already have this city, enrich an existing bare city entry with the real street address
    if (cityFp && seenCityNames.has(cityFp)) {
      const existing = result.find(
        (r) => r.country.toLowerCase() === locCountry.toLowerCase() &&
               normalizeAddressFingerprint(r.city) === cityFp
      );
      if (existing) {
        if (!existing.address && effectiveStreet) {
          existing.address = effectiveStreet;
          const qParts = [
            cleanEntityName,
            effectiveStreet,
            locCity,
            parsedProvince && parsedProvince.toLowerCase() !== locCity.toLowerCase() ? parsedProvince : undefined,
            locCountry
          ].filter(Boolean);
          existing.mapUrl = buildGoogleMapsUrl(qParts.join(", "));
          return;
        } else if (addrFp && existing.address && normalizeAddressFingerprint(existing.address) === addrFp) {
          return;
        } else if (!effectiveStreet) {
          return;
        }
      }
    }

    const fp = addrFp ? `${locCountry.toLowerCase()}|${cityFp}|${addrFp}` : (cityFp ? `${locCountry.toLowerCase()}|${cityFp}` : "");
    if (fp) {
      if (seenFingerprints.has(fp)) return;
      seenFingerprints.add(fp);
    }

    if (cityFp) {
      seenCityNames.add(cityFp);
    }

    let mapUrl = String(loc.mapUrl || "").trim();
    const isGenericSearch = /^https?:\/\/(?:www\.)?google\.[a-z.]+\/maps\/search/i.test(mapUrl);
    const hasAddressInUrl = Boolean(effectiveStreet && mapUrl && mapUrl.toLowerCase().includes(encodeURIComponent(effectiveStreet.slice(0, 8).toLowerCase())));
    const hasJunkInUrl = /lead%20enviado|origen%20de%20lead|calendario%20acad/i.test(mapUrl);

    if (!mapUrl || hasJunkInUrl || (effectiveStreet && isGenericSearch && !hasAddressInUrl)) {
      if (effectiveStreet) {
        // Precise query with entity + street + city drops the exact pin marker on Google Maps
        const queryParts = [
          cleanEntityName,
          effectiveStreet,
          locCity,
          parsedProvince && parsedProvince.toLowerCase() !== locCity.toLowerCase() ? parsedProvince : undefined,
          locCountry
        ].filter(Boolean);
        mapUrl = buildGoogleMapsUrl(queryParts.join(", "));
      } else if (isPrimary && detectedMapsUrl && !isGenericSearch && !hasJunkInUrl) {
        mapUrl = detectedMapsUrl;
      } else {
        // If no street is available, query explicitly for the branch ("Sede [Entity], [City], [Country]")
        // so Google Maps pinpoints the specific branch instead of showing competitor category search ads
        const queryParts = [
          `Sede ${cleanEntityName}`,
          locCity,
          locCountry
        ].filter(Boolean);
        mapUrl = buildGoogleMapsUrl(queryParts.join(", "));
      }
    } else {
      mapUrl = buildGoogleMapsUrl(mapUrl);
    }

    result.push({
      country: locCountry,
      city: locCity,
      address: effectiveStreet || undefined,
      mapUrl,
    });
  };

  // 1. Primary location ALWAYS comes first
  const initialPrimary = (Array.isArray(rawLocations) && rawLocations[0]) || {};
  let effectivePrimaryAddress = initialPrimary.address || primaryAddress || undefined;
  if (!effectivePrimaryAddress && (initialPrimary.city || finalCity)) {
    effectivePrimaryAddress = matchAddressForCity(initialPrimary.city || finalCity);
  }
  addLocation({
    country: initialPrimary.country || finalCountry,
    city: initialPrimary.city || finalCity,
    address: effectivePrimaryAddress,
    mapUrl: initialPrimary.mapUrl || detectedMapsUrl,
  }, true);

  // 2. Additional locations from rawLocations (e.g. AI detected)
  if (Array.isArray(rawLocations) && rawLocations.length > 1) {
    for (let i = 1; i < rawLocations.length; i++) {
      const loc = rawLocations[i];
      if (!loc || typeof loc !== "object") continue;
      let locAddr = loc.address;
      if (!locAddr && loc.city) {
        locAddr = matchAddressForCity(loc.city);
      }
      addLocation({ ...loc, address: locAddr });
    }
  }

  // 3. Additional physical addresses extracted from HTML / JSON-LD / footer / subpages
  if (Array.isArray(additionalAddresses)) {
    for (const addr of additionalAddresses) {
      if (!addr || typeof addr !== "string") continue;
      const cleanAddr = addr.trim();
      if (!cleanAddr) continue;

      const parsed = parseAddressComponents(cleanAddr, finalCity, finalCountry);
      addLocation({
        country: parsed.country,
        city: parsed.city,
        address: parsed.street || cleanAddr,
      });
    }
  }

  // 4. Additional cities from text analysis
  if (Array.isArray(additionalCities)) {
    for (const addCity of additionalCities) {
      if (!addCity || typeof addCity !== "string") continue;
      const cTrim = addCity.trim();
      const matchedAddr = matchAddressForCity(cTrim);
      addLocation({
        country: finalCountry,
        city: cTrim,
        address: matchedAddr,
      });
    }
  }

  return result;
}

// Strictly excludes tiny tracking pixels, vector icons, badges, social network icons, payment badges.
// NEVER excludes real photo words like banner, slider, slide, fachada, equipo, campus, servicio.
const BAD_IMAGE_PATTERN = /(?:^|\/|[._-])(?:icon|badge|button|avatar|bullet|star|check|arrow|spinner|loader|receipt|placeholder|megaphone|pixel|spacer|1x1|transparent|fav-?icon|flaticon|fontawesome|app-store|google-play|visa|mastercard|amex|paypal|facebook|instagram|twitter|tiktok|youtube|whatsapp|linkedin)\b|\.svg$|\.svg\?/i;

function makeUrlAbsolute(urlStr: string, sourceUrl: string): string {
  if (!urlStr || typeof urlStr !== "string") return "";
  let clean = urlStr.trim();
  if (clean.startsWith("//")) {
    return "https:" + clean;
  }
  try {
    return new URL(clean, sourceUrl).href;
  } catch {
    return clean;
  }
}

function isValidLogoUrl(urlStr: string): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  const clean = urlStr.trim();
  if (!/^https?:\/\//i.test(clean)) return false;
  if (clean.length < 10) return false;
  if (/(?:pixel|spacer|1x1|transparent|spinner|loader|receipt|button|star|check|arrow|app-store|google-play)\b/i.test(clean)) {
    return false;
  }
  return true;
}

function isValidRealPhoto(src: string): boolean {
  if (!src || typeof src !== "string") return false;
  if (!/^https?:\/\//i.test(src)) return false;
  if (BAD_IMAGE_PATTERN.test(src)) return false;
  if (src.length < 12) return false;
  return true;
}

function extractJsonLdMedia(html: string, sourceUrl: string): { jsonLdLogos: string[]; jsonLdImages: string[] } {
  const jsonLdLogos: string[] = [];
  const jsonLdImages: string[] = [];
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const jsonStr = match[1].trim();
      const data = JSON.parse(jsonStr);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        if (item.logo) {
          const lUrl = typeof item.logo === "string" ? item.logo : item.logo?.url;
          if (lUrl) jsonLdLogos.push(makeUrlAbsolute(lUrl, sourceUrl));
        }
        if (item.image) {
          if (typeof item.image === "string") {
            jsonLdImages.push(makeUrlAbsolute(item.image, sourceUrl));
          } else if (Array.isArray(item.image)) {
            item.image.forEach((img: any) => {
              const iUrl = typeof img === "string" ? img : img?.url;
              if (iUrl) jsonLdImages.push(makeUrlAbsolute(iUrl, sourceUrl));
            });
          } else if (item.image?.url) {
            jsonLdImages.push(makeUrlAbsolute(item.image.url, sourceUrl));
          }
        }
      }
    } catch {}
  }
  return { jsonLdLogos, jsonLdImages };
}

/**
 * Robustly extracts REAL photos and real logos directly from HTML tags (img, picture, meta, link).
 */
function extractImagesAndLogosFromHtml(
  html: string,
  sourceUrl: string,
  jsonLdLogos: string[] = [],
  jsonLdImages: string[] = []
): { images: string[]; logo: string } {
  const photos: string[] = [];
  const candidateLogos: string[] = [];

  // 1. JSON-LD media
  jsonLdLogos.forEach((l) => {
    const abs = makeUrlAbsolute(l, sourceUrl);
    if (isValidLogoUrl(abs)) candidateLogos.push(abs);
  });
  jsonLdImages.forEach((img) => {
    const abs = makeUrlAbsolute(img, sourceUrl);
    if (isValidRealPhoto(abs)) photos.push(abs);
  });

  // 2. OpenGraph and Twitter images
  const ogImageMatch =
    html.match(/<meta[^>]*?(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*?content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*?content=["']([^"']+)["'][^>]*?(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["']/i);
  if (ogImageMatch && ogImageMatch[1]) {
    const abs = makeUrlAbsolute(ogImageMatch[1], sourceUrl);
    if (isValidRealPhoto(abs)) photos.push(abs);
  }

  // 3. OpenGraph / Meta logo
  const ogLogoMatch =
    html.match(/<meta[^>]*?(?:name|property)=["'](?:og:logo|logo)["'][^>]*?content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*?content=["']([^"']+)["'][^>]*?(?:name|property)=["'](?:og:logo|logo)["']/i);
  if (ogLogoMatch && ogLogoMatch[1]) {
    const abs = makeUrlAbsolute(ogLogoMatch[1], sourceUrl);
    if (isValidLogoUrl(abs)) candidateLogos.push(abs);
  }

  // 4. Apple Touch Icon / High-res favicon link
  const touchIconMatch =
    html.match(/<link[^>]*?rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["'][^>]*?href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]*?href=["']([^"']+)["'][^>]*?rel=["'](?:apple-touch-icon|apple-touch-icon-precomposed)["']/i);
  if (touchIconMatch && touchIconMatch[1]) {
    const abs = makeUrlAbsolute(touchIconMatch[1], sourceUrl);
    if (isValidLogoUrl(abs)) candidateLogos.push(abs);
  }

  // 5. Scrape HTML <img> tags (src, data-src, data-lazy-src, data-original)
  const imgRegex = /<img\b([^>]+)>/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const attrs = match[1];
    const srcMatch = attrs.match(/(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["']/i);
    if (!srcMatch || !srcMatch[1]) continue;

    const rawSrc = srcMatch[1];
    if (rawSrc.startsWith("data:image")) continue;

    const absSrc = makeUrlAbsolute(rawSrc, sourceUrl);
    if (!absSrc) continue;

    const isLogo = /logo|brand|isologo|isotipo/i.test(attrs) || /logo|brand|isologo|isotipo/i.test(rawSrc);
    if (isLogo && isValidLogoUrl(absSrc)) {
      candidateLogos.push(absSrc);
      continue;
    }

    if (isValidRealPhoto(absSrc)) {
      photos.push(absSrc);
    }
  }

  // 6. Scrape <picture><source srcset="...">
  const sourceRegex = /<source\b[^>]*srcset=["']([^"'\s,]+)[^"']*["'][^>]*>/gi;
  while ((match = sourceRegex.exec(html)) !== null) {
    const rawSrc = match[1];
    if (rawSrc.startsWith("data:image")) continue;
    const absSrc = makeUrlAbsolute(rawSrc, sourceUrl);
    if (isValidRealPhoto(absSrc)) {
      photos.push(absSrc);
    }
  }

  // Fallback logo from domain favicon if no logo was found
  let resolvedLogo = candidateLogos.find(isValidLogoUrl) || "";
  if (!resolvedLogo) {
    try {
      const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "");
      if (hostname) {
        resolvedLogo = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
      }
    } catch {}
  }

  const uniquePhotos = Array.from(new Set(photos)).slice(0, 8);
  return { images: uniquePhotos, logo: resolvedLogo };
}

function extractAllAddressesFromHtml(html: string, textContent: string): string[] {
  const addresses: string[] = [];
  const seenFp = new Set<string>();

  const addUnique = (addr: string | null | undefined) => {
    if (!addr || typeof addr !== "string") return;
    const clean = addr.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (clean.length < 6 || clean.length > 120) return;
    if (!isValidPhysicalStreetAddress(clean)) return;
    if (/^(?:todos los derechos|copyright|aviso legal|pol[ií]tica|horario|atenci[oó]n)/i.test(clean)) return;
    const fp = normalizeAddressFingerprint(clean);
    if (!fp || seenFp.has(fp)) return;
    seenFp.add(fp);
    addresses.push(clean);
  };

  // 1. JSON-LD Address
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const candidateAddrs = [
          item.address,
          item.location?.address,
          ...(Array.isArray(item.department) ? item.department.map((d: any) => d.address) : []),
          ...(Array.isArray(item.subOrganization) ? item.subOrganization.map((s: any) => s.address) : []),
        ];
        for (const addr of candidateAddrs) {
          if (!addr) continue;
          if (typeof addr === "string") addUnique(addr);
          else if (typeof addr === "object") {
            const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean);
            if (parts.length) addUnique(parts.join(", "));
          }
        }
      }
    } catch {}
  }

  // 1b. JavaScript / Map marker JSON address objects (e.g. "address": "Calle 123, Ciudad, Argentina")
  const rawAddrRegex = /"address"\s*:\s*"([^"]{6,120})"/gi;
  let mRaw;
  while ((mRaw = rawAddrRegex.exec(html)) !== null) {
    try {
      const decoded = mRaw[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).trim();
      addUnique(decoded);
    } catch {}
  }

  // 2. Microdata
  const itempropMatches = [
    ...(html.matchAll(/<meta[^>]*?itemprop=["']streetAddress["'][^>]*?content=["']([^"']+)["']/gi) || []),
    ...(html.matchAll(/itemprop=["']streetAddress["'][^>]*>([^<]+)</gi) || []),
    ...(html.matchAll(/itemprop=["']address["'][^>]*>([^<]+)</gi) || []),
  ];
  for (const im of itempropMatches) {
    if (im && im[1]) addUnique(im[1]);
  }

  // 3. PRIORITY: Check FOOTER and CONTACT sections first
  const footerAndContactBlocks: string[] = [];
  const footerMatch = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i);
  if (footerMatch && footerMatch[1]) footerAndContactBlocks.push(footerMatch[1]);

  const contactSections = html.match(/<(?:div|section|aside)\b[^>]*?(?:class|id)=["'][^"']*(?:footer|contacto|contact|ubicacion|location|direccion|sede|sucursal)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section|aside)>/gi);
  if (contactSections) {
    contactSections.forEach((cs) => footerAndContactBlocks.push(cs));
  }

  const standardAddressRegex = /(?:Av\.|Avenida|Calle|Bv\.|Boulevard|Pje\.|Pasaje|Ruta|Autopista|Diagonal|Lateral|Acceso)\s+(?:de\s+)?[A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s.,°º#-]{2,60}\b\d{1,5}\b(?:\s+(?:piso|of\.|oficina|dpto|depto|pb|planta\s+baja)\s*[^,.\n<]{1,25})?/gi;
  const latinAddressRegex = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+(?:de\s+|del\s+|san\s+|santa\s+|de\s+la\s+|los\s+|las\s+)?[A-ZÁÉÍÓÚÑa-záéíóúñ0-9]+){1,4})\s+(\d{1,5})\b(?:\s*(?:piso|of\.|oficina|dpto|depto|pb|planta\s+baja)[^,.\n<]{0,25})?/gi;

  for (const block of footerAndContactBlocks) {
    const cleanBlock = block
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, " ")
      .replace(/<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi, " ")
      .replace(/<option\b[^<]*(?:(?!<\/option>)<[^<]*)*<\/option>/gi, " ");

    let mPrefix;
    while ((mPrefix = standardAddressRegex.exec(cleanBlock)) !== null) {
      addUnique(mPrefix[0]);
    }

    const textLines = cleanBlock
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .split("\n")
      .map((l) => l.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim())
      .filter((l) => l.length > 5 && l.length < 150);

    for (const line of textLines) {
      if (/copyright|derechos|diseño|desarrollo|powered|todos los/i.test(line)) continue;
      if (/^(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo|horario|tel|cel|whatsapp|\+?\d)/i.test(line)) continue;
      let mLatin;
      while ((mLatin = latinAddressRegex.exec(line)) !== null) {
        addUnique(mLatin[0]);
      }
    }
  }

  // 4. Fallback: Check standard prefix address in whole HTML / textContent
  let mWhole;
  while ((mWhole = standardAddressRegex.exec(html)) !== null) {
    addUnique(mWhole[0]);
  }

  return addresses;
}

function extractAddressFromHtml(html: string, textContent: string): string | null {
  const all = extractAllAddressesFromHtml(html, textContent);
  return all[0] || null;
}

function extractTextAndMetaFromHtml(html: string, sourceUrl: string) {
  const { jsonLdLogos, jsonLdImages } = extractJsonLdMedia(html, sourceUrl);
  const { images, logo } = extractImagesAndLogosFromHtml(html, sourceUrl, jsonLdLogos, jsonLdImages);

  const cleanHtml = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "");

  const getMetaTag = (nameOrProperty: string) => {
    const match =
      cleanHtml.match(new RegExp(`<meta[^>]*?(?:name|property)=["']${nameOrProperty}["'][^>]*?content=["']([^"']+)["']`, "i")) ||
      cleanHtml.match(new RegExp(`<meta[^>]*?content=["']([^"']+)["'][^>]*?(?:name|property)=["']${nameOrProperty}["']`, "i"));
    return match ? match[1].trim() : "";
  };

  const titleMatch = cleanHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const rawPageTitle = getMetaTag("og:title") || (titleMatch ? titleMatch[1].trim() : "");
  const pageTitle = cleanTitleString(rawPageTitle);
  const rawSiteName = getMetaTag("og:site_name") || getMetaTag("application-name") || getMetaTag("author");

  let jsonLdOrgName = "";
  try {
    const jsonLdMatches = html.match(/<script[^>]*?type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const block of jsonLdMatches) {
        const raw = block.replace(/<\/?script[^>]*>/gi, "").trim();
        const parsed = JSON.parse(raw);
        const findOrg = (obj: any): string | null => {
          if (!obj || typeof obj !== "object") return null;
          if (obj["@type"] && /Organization|Corporation|EducationalOrganization|MedicalOrganization|LocalBusiness|School|University/i.test(String(obj["@type"])) && obj.name) {
            return String(obj.name);
          }
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const res = findOrg(item);
              if (res) return res;
            }
          } else {
            for (const k of Object.keys(obj)) {
              const res = findOrg(obj[k]);
              if (res) return res;
            }
          }
          return null;
        };
        const found = findOrg(parsed);
        if (found) { jsonLdOrgName = found; break; }
      }
    }
  } catch {}

  let copyrightEntity = "";
  try {
    const copyMatch = html.match(/(?:copyright|©|\(c\))\s*(?:\d{4})?\s*[-–—|]?\s*([A-Za-z0-9\s.,&'-]{3,40})(?:\.|\n|<|$|todos los derechos|all rights)/i);
    if (copyMatch && copyMatch[1]) {
      const cand = cleanTitleString(copyMatch[1].trim());
      if (cand.length >= 3 && cand.length < 40 && !/^(?:todos|all rights|reservados|derechos|web|sitio|pagina)\b/i.test(cand)) {
        copyrightEntity = cand;
      }
    }
  } catch {}

  // Content extraction: strip navbars, header bars, footers, aside, modals, dialogs, cookie notices
  let contentHtml = cleanHtml
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, " ")
    .replace(/<dialog\b[^<]*(?:(?!<\/dialog>)<[^<]*)*<\/dialog>/gi, " ")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, " ")
    .replace(/<(?:div|section|ul|ol)\b[^>]*?(?:class|id)=["'][^"']*(?:intranet|webmail|portal[-_]empleado|banner-cookie|modal|dropdown|nav-item|menu-item|breadcrumbs?|wizard|step|stepper|quiz|finder|buscador-carreras|filtro-carrera)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section|ul|ol)>/gi, " ");

  const mainMatch = contentHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
                    contentHtml.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
                    contentHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const targetHtml = mainMatch ? mainMatch[1] : contentHtml;

  const JUNK_LINE_REGEX = /^(?:portal del empleado|webmail|intranet|gde|iniciar sesi[oó]n|acceder|login|olvid[eé] mi contrase[ñn]a|pol[ií]tica de privacidad|t[eé]rminos y condiciones|aviso legal|mapa del sitio|sitemap|todos los derechos reservados|copyright\s*©?.*|¿qu[eé] est[aá]s buscando\??|¿en qu[eé] momento.*|¿cu[aá]l va a ser tu pr[oó]ximo paso\??|tipo de formaci[oó]n.*|de \d+ a \d+ a[ñn]os)\s*$/i;

  let textContent = decodeHtmlEntities(
    targetHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, " • ")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n\n")
      .trim()
  );

  textContent = textContent
    .split("\n")
    .map((l) => cleanJunkTextPhrases(l.trim()))
    .filter((l) => l && !JUNK_LINE_REGEX.test(l))
    .join("\n");

  let pageDescription = decodeHtmlEntities(getMetaTag("og:description") || getMetaTag("description") || "");
  pageDescription = cleanJunkTextPhrases(pageDescription);
  if (!pageDescription || pageDescription.length < 20 || JUNK_LINE_REGEX.test(pageDescription)) {
    const paragraphs = textContent.split("\n\n").map((p) => cleanJunkTextPhrases(p.trim()));
    const candidate = paragraphs.find((p) => p.length >= 45 && !p.includes("•") && !JUNK_LINE_REGEX.test(p));
    if (candidate) {
      pageDescription = candidate.slice(0, 350).trim();
    }
  }

  const detectedFoundingYear = extractFoundingYear(cleanHtml, textContent, sourceUrl, pageTitle);
  const detectedAllAddresses = extractAllAddressesFromHtml(html, textContent);
  const detectedAddress = detectedAllAddresses[0] || null;
  const locInfo = detectAllLocationsAndHeadquarters(textContent, sourceUrl, pageTitle);
  const ratingInfo = extractRatingAndReviewsFromHtml(
    html,
    textContent,
    sourceUrl,
    pageTitle,
    locInfo.primaryCity,
    locInfo.primaryCountry,
    detectedAddress || undefined
  );

  const mapsRegex = /https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s"'<>]+/gi;
  const mapsMatches = cleanHtml.match(mapsRegex) || [];
  const detectedMapsUrl = mapsMatches[0] || ratingInfo.commentsUrl || "";

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailsFound = Array.from(new Set(cleanHtml.match(emailRegex) || []))
    .filter((e) => !e.includes(".png") && !e.includes(".jpg") && !e.includes(".svg") && !e.includes("wixpress"))
    .slice(0, 3);

  // 1. Phone extraction
  const telRegex = /<a\b[^>]*href=["']tel:([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let telMatch;
  const phonesFound = new Set<string>();
  while ((telMatch = telRegex.exec(cleanHtml)) !== null) {
    const rawTel = telMatch[1].replace(/[^\d+]/g, "").trim();
    if (rawTel.length >= 6 && rawTel.length <= 18) {
      phonesFound.add(rawTel.startsWith("+") ? rawTel : `+${rawTel}`);
    }
  }

  const phoneTextRegex = /(?:tel[eé]fonos?|conmutador|central(?:\s+telef[oó]nica|\s+de turnos)?|contacto|ll[aá]manos|guardia|atenci[oó]n telef[oó]nica):?\s*(\+?\d[\d\s().-]{6,18}\d)/gi;
  let ptMatch;
  while ((ptMatch = phoneTextRegex.exec(textContent)) !== null) {
    const raw = ptMatch[1].trim();
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly.length >= 7 && digitsOnly.length <= 15 && !/^(?:201|202|199|198)\d{4}/.test(digitsOnly)) {
      phonesFound.add(raw.replace(/\s+/g, " "));
    }
  }

  const freePhoneRegex = /\b(0800|0810)[-\s]?\d{3}[-\s]?\d{4}\b/gi;
  let fpMatch;
  while ((fpMatch = freePhoneRegex.exec(textContent)) !== null) {
    phonesFound.add(fpMatch[0]);
  }

  // 2. WhatsApp extraction
  const waRegex = /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send|web\.whatsapp\.com\/send)\b[^\s"'<>]+/gi;
  const waMatches = cleanHtml.match(waRegex) || [];
  const whatsappsFound = new Set<string>(waMatches);

  const waTextRegex = /(?:whatsapp|wsp|celular|m[oó]vil|wap)\s*(?:de atenci[oó]n|consultas?|turnos?)?:?\s*(\+?\d[\d\s().-]{7,18}\d)/gi;
  let waTextMatch;
  while ((waTextMatch = waTextRegex.exec(textContent)) !== null) {
    const raw = waTextMatch[1].trim();
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly.length >= 8 && digitsOnly.length <= 15) {
      whatsappsFound.add(`https://wa.me/${digitsOnly}`);
    }
  }

  const socialPatterns = [
    { kind: "whatsapp", regex: /https?:\/\/(?:wa\.me|api\.whatsapp\.com\/send)[^\s"'<>]+/gi, label: "WhatsApp" },
    { kind: "instagram", regex: /https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi, label: "Instagram" },
    { kind: "facebook", regex: /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.]+/gi, label: "Facebook" },
    { kind: "linkedin", regex: /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[a-zA-Z0-9_-]+/gi, label: "LinkedIn" },
    { kind: "youtube", regex: /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|user\/|channel\/|@)?[a-zA-Z0-9_-]+/gi, label: "YouTube" },
    { kind: "tiktok", regex: /https?:\/\/(?:www\.)?tiktok\.com\/@[a-zA-Z0-9_.]+/gi, label: "TikTok" },
  ];

  const socialLinksExtracted: SocialLinkDetail[] = [
    { kind: "web", label: "Página Oficial", url: sourceUrl },
  ];

  // Add Phones
  Array.from(phonesFound).slice(0, 3).forEach((phone) => {
    const cleanDigits = phone.replace(/[^\d+]/g, "");
    const telUrl = phone.startsWith("tel:") ? phone : `tel:${cleanDigits}`;
    socialLinksExtracted.push({
      kind: "phone",
      label: phone.startsWith("0800") ? "Línea gratuita (0800)" : phone.startsWith("0810") ? "Atención telefónica (0810)" : "Teléfono de contacto",
      url: telUrl,
    });
  });

  // Add WhatsApp
  Array.from(whatsappsFound).slice(0, 2).forEach((waUrl) => {
    socialLinksExtracted.push({
      kind: "whatsapp",
      label: "WhatsApp",
      url: waUrl,
    });
  });

  // Add Emails
  emailsFound.forEach((email) => {
    socialLinksExtracted.push({ kind: "email", label: "Email de contacto", url: `mailto:${email}` });
  });

  // Add Social Networks
  socialPatterns.forEach(({ kind, regex, label }) => {
    if (kind === "whatsapp") return;
    const matches = cleanHtml.match(regex);
    if (matches && matches[0]) {
      socialLinksExtracted.push({ kind, label, url: matches[0] });
    }
  });

  return {
    title: pageTitle,
    description: pageDescription,
    textContent: textContent.slice(0, 32000),
    htmlContent: cleanHtml.slice(0, 30000),
    detectedFoundingYear,
    detectedAddress,
    detectedAllAddresses,
    detectedCity: locInfo.primaryCity,
    detectedCountry: locInfo.primaryCountry,
    detectedMapsUrl,
    detectedRating: ratingInfo.rating,
    detectedReviewCount: ratingInfo.reviewCount,
    detectedCommentsUrl: ratingInfo.commentsUrl,
    detectedLogo: logo,
    detectedSiteName: cleanTitleString(jsonLdOrgName || rawSiteName || copyrightEntity || ""),
    images,
    socialLinksExtracted,
  };
}

async function discoverAndFetchSedesSubpages(
  mainUrl: string,
  mainHtml: string,
  userAgents: string[]
): Promise<{ sedesText: string; sedesAddresses: string[]; discoveredUrls: string[] }> {
  const result = { sedesText: "", sedesAddresses: [] as string[], discoveredUrls: [] as string[] };
  let base: URL;
  try {
    base = new URL(mainUrl);
  } catch {
    return result;
  }

  const linkRegex = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const foundUrls = new Set<string>();
  let m;
  while ((m = linkRegex.exec(mainHtml)) !== null) {
    const rawHref = m[1].trim();
    const linkText = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
      continue;
    }
    const isSedesHref = /(?:sedes?|campus|sucursales?|delegaciones?|donde-estamos|centros?|filiales?|puntos?-de-atencion|ubicacion(?:es)?)\b/i.test(rawHref);
    const isSedesText = /^(?:sedes?|campus|nuestras\s+sedes|sucursales?|delegaciones?|d[oó]nde\s+estamos|filiales?|centros?\s+de\s+atenci[oó]n|puntos\s+de\s+atenci[oó]n|contacto)\b/i.test(linkText);

    if (isSedesHref || isSedesText) {
      try {
        const resolved = new URL(rawHref, mainUrl);
        if (resolved.hostname === base.hostname && resolved.href !== mainUrl) {
          if (!resolved.pathname.includes("/noticias/") && !resolved.pathname.includes("/blog/") && !resolved.pathname.includes("/eventos/")) {
            foundUrls.add(resolved.href);
          }
        }
      } catch {}
    }
  }

  const candidateUrls = Array.from(foundUrls).slice(0, 2);
  result.discoveredUrls = candidateUrls;
  if (candidateUrls.length === 0) return result;

  const addrSet = new Set<string>();
  let extraText = "";

  for (const subUrl of candidateUrls) {
    try {
      const subRes = await fetch(subUrl, {
        headers: {
          "User-Agent": userAgents[0] || "Mozilla/5.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(2500),
      });
      if (subRes.ok) {
        const subHtml = await subRes.text();
        if (subHtml && subHtml.length > 200) {
          const subAddrs = extractAllAddressesFromHtml(subHtml, "");
          for (const a of subAddrs) {
            addrSet.add(a);
          }
          const cleanSub = subHtml
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (cleanSub) {
            extraText += " " + cleanSub.slice(0, 3500);
          }
        }
      }
    } catch {}
  }

  result.sedesAddresses = Array.from(addrSet);
  result.sedesText = extraText.trim();
  return result;
}

async function fetchPageContent(url: string) {
  let formattedUrl = url.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = "https://" + formattedUrl;
  }

  let hostname = "";
  try {
    hostname = new URL(formattedUrl).hostname;
  } catch {
    throw new Error(`La URL "${url}" no tiene un formato válido.`);
  }

  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  ];

  // Tier 1: Direct fetch with standard browser headers (clean, fast, universally accepted)
  try {
    let res: Response | null = null;
    try {
      res = await fetch(formattedUrl, {
        headers: {
          "User-Agent": userAgents[0],
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
          "Upgrade-Insecure-Requests": "1",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });
    } catch (e: any) {
      const isDnsError =
        e?.code === "ENOTFOUND" ||
        e?.cause?.code === "ENOTFOUND" ||
        (e?.message && /getaddrinfo\s+ENOTFOUND/i.test(e.message));
      if (isDnsError) {
        throw new Error(`No se pudo conectar con '${hostname || formattedUrl}'. El dominio no existe o está mal escrito. Por favor verifica la URL ingresada.`);
      }
      // Fast fallback retry with secondary user-agent
      try {
        res = await fetch(formattedUrl, {
          headers: {
            "User-Agent": userAgents[1],
            Accept: "*/*",
            "Accept-Language": "es-ES,es;q=0.9",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(3000),
        });
      } catch (retryErr: any) {
        const isRetryDns =
          retryErr?.code === "ENOTFOUND" ||
          retryErr?.cause?.code === "ENOTFOUND" ||
          (retryErr?.message && /getaddrinfo\s+ENOTFOUND/i.test(retryErr.message));
        if (isRetryDns) {
          throw new Error(`No se pudo conectar con '${hostname || formattedUrl}'. El dominio no existe o está mal escrito. Por favor verifica la URL ingresada.`);
        }
      }
    }

    if (res && res.ok) {
      let html = await res.text();
      let activeUrl = res.url || formattedUrl;

      // Handle client-side redirects (e.g. location.href="nuevo/index.php" or <meta http-equiv="refresh" ...>)
      const clientRedirect = html.match(/(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i) ||
                             html.match(/<meta[^>]*http-equiv=['"]?refresh['"]?[^>]*content=['"]?[^'";]*url=([^'" >]+)/i);
      if (clientRedirect && clientRedirect[1]) {
        try {
          const resolvedTarget = makeUrlAbsolute(clientRedirect[1].trim(), activeUrl);
          if (resolvedTarget && resolvedTarget !== activeUrl) {
            const redirectRes = await fetch(resolvedTarget, {
              headers: {
                "User-Agent": userAgents[0],
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
              },
              redirect: "follow",
              signal: AbortSignal.timeout(2000),
            });
            if (redirectRes.ok) {
              const redirectHtml = await redirectRes.text();
              if (redirectHtml && redirectHtml.length > 200) {
                html = redirectHtml;
                activeUrl = redirectRes.url || resolvedTarget;
              }
            }
          }
        } catch {}
      }

      if (html && html.length > 200) {
        const extracted = extractTextAndMetaFromHtml(html, activeUrl);

        // Dynamically discover and fetch sedes/branches subpages
        try {
          const sedesData = await discoverAndFetchSedesSubpages(activeUrl, html, userAgents);
          if (sedesData.sedesAddresses.length > 0) {
            const mergedAddrs = Array.from(new Set([...(extracted.detectedAllAddresses || []), ...sedesData.sedesAddresses]));
            extracted.detectedAllAddresses = mergedAddrs;
            if (!extracted.detectedAddress && mergedAddrs[0]) {
              extracted.detectedAddress = mergedAddrs[0];
            }
          }
          if (sedesData.sedesText) {
            (extracted as any).sedesText = sedesData.sedesText;
            extracted.textContent = (extracted.textContent + "\n\n" + sedesData.sedesText).slice(0, 36000);
          }
        } catch {}

        if ((extracted.textContent && extracted.textContent.length > 25) || (extracted.title && extracted.title.length > 3)) {
          if (!extracted.textContent || extracted.textContent.length < 80) {
            extracted.textContent = [extracted.title, extracted.description, extracted.textContent].filter(Boolean).join(" - ");
          }
          return { url: activeUrl, ...extracted };
        }
      }
    }
  } catch (e: any) {
    if (e?.message && e.message.includes("El dominio no existe o está mal escrito")) {
      throw e;
    }
    console.warn(`Primary direct fetch failed for ${url}:`, e.message);
  }

  // Tier 2: Jina AI Web Reader with 3.5s timeout
  try {
    const jinaUrl = `https://r.jina.ai/${formattedUrl}`;
    const res = await fetch(jinaUrl, {
      headers: { "User-Agent": userAgents[1], Accept: "text/plain, text/html" },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const textContent = await res.text();
      if (textContent && textContent.length > 200) {
        const titleMatch = textContent.match(/^Title:\s*(.+)$/m) || textContent.match(/^#\s+(.+)$/m);
        const title = cleanTitleString(titleMatch ? titleMatch[1] : "");
        const descriptionMatch = textContent.match(/^Description:\s*(.+)$/m);
        const description = descriptionMatch ? descriptionMatch[1].trim() : "";

        const imgRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi;
        let imgMatch;
        const jinaImages: string[] = [];
        while ((imgMatch = imgRegex.exec(textContent)) !== null) {
          if (isValidRealPhoto(imgMatch[1])) {
            jinaImages.push(imgMatch[1]);
          }
        }

        let hostname = "";
        try {
          hostname = new URL(formattedUrl).hostname.replace(/^www\./, "");
        } catch {}

        const logo = hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=128` : "";

        return {
          url: formattedUrl,
          title: title || hostname,
          description: description || textContent.slice(0, 300),
          textContent: textContent.slice(0, 32000),
          htmlContent: "",
          detectedFoundingYear: null,
          detectedMapsUrl: "",
          detectedLogo: logo,
          detectedSiteName: title || hostname,
          images: Array.from(new Set(jinaImages)).slice(0, 8),
          socialLinksExtracted: [{ kind: "web", label: "Página Oficial", url: formattedUrl }],
        };
      }
    }
  } catch (e: any) {
    console.warn(`Jina AI Reader failed for ${url}:`, e.message);
  }

  // Tier 3: Host and known institution fallback
  let host = "";
  try {
    host = new URL(formattedUrl).hostname.replace(/^www\./, "");
  } catch {}
  const known = KNOWN_INSTITUTIONS_MAP[host.toLowerCase()];
  const fallbackTitle = known?.name || host;
  const fallbackLogo = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=128` : "";

  return {
    url: formattedUrl,
    title: fallbackTitle,
    description: known ? `Sitio web oficial de ${known.name} en ${known.primaryCity}, ${known.primaryCountry}.` : `Sitio web oficial de ${host}`,
    textContent: known ? `${known.name} - ${known.category} - ${known.activity}. Sede en ${known.primaryCity}, ${known.primaryCountry}. ${formattedUrl}` : `Sitio web oficial: ${formattedUrl}`,
    htmlContent: "",
    detectedFoundingYear: null,
    detectedMapsUrl: known?.commentsUrl || "",
    detectedLogo: fallbackLogo,
    detectedSiteName: fallbackTitle,
    images: [],
    socialLinksExtracted: [{ kind: "web", label: "Página Oficial", url: formattedUrl }],
  };
}

async function getAvailableSystemTaxonomies(clientCategories?: any[], clientFilterGroups?: any[]) {
  let dbCategories: any[] = [];
  let dbFilterGroups: any[] = [];

  // Instant fast-path: if client supplied categories and filter groups from the active session, use them directly
  if (Array.isArray(clientCategories) && clientCategories.length > 0) {
    dbCategories = clientCategories;
  }
  if (Array.isArray(clientFilterGroups) && clientFilterGroups.length > 0) {
    dbFilterGroups = clientFilterGroups;
  }

  // Only query Prisma if client did not provide both categories and groups
  if (dbCategories.length === 0 || dbFilterGroups.length === 0) {
    try {
      const prismaPromise = Promise.all([
        prisma.category.findMany({
          select: { id: true, description: true, taxonomyType: true, blockId: true, parentId: true, isPublicVisible: true },
          orderBy: [{ blockId: "asc" }, { parentId: "asc" }, { description: "asc" }],
        }),
        prisma.filterGroup.findMany({
          include: { options: true },
        }),
      ]);
      const timeoutPromise = new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error("Prisma timeout")), 600)
      );
      const [fetchedCats, fetchedGroups] = await Promise.race([prismaPromise, timeoutPromise]);
      if (dbCategories.length === 0 && fetchedCats) dbCategories = fetchedCats;
      if (dbFilterGroups.length === 0 && fetchedGroups) dbFilterGroups = fetchedGroups;
    } catch (e) {
      console.warn("[AI Scraper] Error al obtener taxonomías de Prisma, usando respaldo del cliente:", e);
    }
  }

  // If Prisma was empty/offline and client didn't supply them, query backend API
  if (dbCategories.length === 0 && (!clientCategories || clientCategories.length === 0)) {
    try {
      const backendUrl = getBackendApiUrl();
      const [resCats, resGroups] = await Promise.all([
        fetch(`${backendUrl}/api/categories?t=${Date.now()}`, { signal: AbortSignal.timeout(800) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(`${backendUrl}/api/admin/filters?t=${Date.now()}`, { signal: AbortSignal.timeout(800) }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      const catsList = Array.isArray(resCats?.items) ? resCats.items : Array.isArray(resCats) ? resCats : [];
      const groupsList = Array.isArray(resGroups?.groups) ? resGroups.groups : Array.isArray(resGroups) ? resGroups : [];
      if (catsList.length > 0) dbCategories = catsList;
      if (groupsList.length > 0) dbFilterGroups = groupsList;
    } catch (fErr) {
      console.warn("[AI Scraper] Backend API fallback no disponible:", fErr);
    }
  }

  // Seamlessly merge client payloads so newly created categories and blocks from the admin are always available
  if (Array.isArray(clientCategories) && clientCategories.length > 0) {
    if (!dbCategories || dbCategories.length === 0) {
      dbCategories = clientCategories;
    } else {
      const clientMap = new Map(clientCategories.map((c) => [String(c.id), c]));
      dbCategories = dbCategories.map((c) => clientMap.get(String(c.id)) || c);
      const existingIds = new Set(dbCategories.map((c) => String(c.id)));
      for (const cat of clientCategories) {
        if (!existingIds.has(String(cat.id))) {
          dbCategories.push(cat);
          existingIds.add(String(cat.id));
        }
      }
    }
  }

  if (Array.isArray(clientFilterGroups) && clientFilterGroups.length > 0) {
    if (!dbFilterGroups || dbFilterGroups.length === 0) {
      dbFilterGroups = clientFilterGroups;
    } else {
      const clientGroupMap = new Map(clientFilterGroups.map((g) => [String(g.id), g]));
      dbFilterGroups = dbFilterGroups.map((g) => clientGroupMap.get(String(g.id)) || g);
      const existingGroupIds = new Set(dbFilterGroups.map((g) => String(g.id)));
      for (const grp of clientFilterGroups) {
        if (!existingGroupIds.has(String(grp.id))) {
          dbFilterGroups.push(grp);
          existingGroupIds.add(String(grp.id));
        }
      }
    }
  }

  try {
    const filterGroupById = new Map<string, any>(dbFilterGroups.map((g) => [String(g.id), g]));
    const categoryById = new Map<string, any>(dbCategories.map((c) => [String(c.id), c]));

    const normalizeType = (input: string | null | undefined) => {
      const raw = String(input ?? "").trim().toLowerCase();
      if (["", "default", "inherit", "predeterminado"].includes(raw)) return "";
      if (["tipo", "tipos"].includes(raw)) return "tipo";
      if (["prestacion", "prestaciones"].includes(raw)) return "prestacion";
      if (["idioma", "idiomas"].includes(raw)) return "idiomas";
      if (raw === "actividad") return "actividad";
      if (raw === "modalidad") return "modalidad";
      if (["voluntariado", "voluntario", "voluntariados", "destino", "destinos", "categoria"].includes(raw)) return "categoria";
      return raw;
    };

    const resolveCategoryBlockId = (category: any, seen = new Set<string>()): string | null => {
      const catId = String(category?.id ?? "");
      if (!catId || seen.has(catId)) return null;
      seen.add(catId);
      const bId = category?.blockId != null ? String(category.blockId) : null;
      if (bId && filterGroupById.has(bId)) return bId;
      if (category?.parentId) {
        const parent = categoryById.get(String(category.parentId));
        if (!parent) return null;
        return resolveCategoryBlockId(parent, seen);
      }
      return null;
    };

    const resolveCategoryTaxonomyType = (category: any, seen = new Set<string>()): string => {
      const catId = String(category?.id ?? "");
      if (!catId || seen.has(catId)) return "categoria";
      seen.add(catId);
      const ownType = normalizeType(category?.taxonomyType || category?.typeForm);
      if (ownType && !["", "default", "predeterminado", "inherit"].includes(ownType)) return ownType;
      if (category?.parentId) {
        const parent = categoryById.get(String(category.parentId));
        if (parent) return resolveCategoryTaxonomyType(parent, seen);
      }
      const blockId = resolveCategoryBlockId(category);
      if (blockId) {
        const block = filterGroupById.get(blockId);
        const blockType = normalizeType(block?.taxonomyType || block?.typeForm);
        if (blockType && !["", "default", "predeterminado", "inherit"].includes(blockType)) return blockType;

        const blockLabelNorm = String(block?.label ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (blockLabelNorm.includes("categor") || blockLabelNorm.includes("proposito")) return "categoria";
        if (blockLabelNorm.includes("actividad") || blockLabelNorm.includes("sector")) return "actividad";
        if (blockLabelNorm.includes("tipo") || blockLabelNorm.includes("perfil")) return "tipo";
        if (blockLabelNorm.includes("modalidad")) return "modalidad";
        if (blockLabelNorm.includes("prestacion")) return "prestacion";
        if (blockLabelNorm.includes("idioma")) return "idiomas";
      }
      return "categoria";
    };

    const categoryMapWithTaxonomy = dbCategories.map((cat) => {
      const taxonomyType = resolveCategoryTaxonomyType(cat);
      const blockId = resolveCategoryBlockId(cat);
      const block = blockId ? filterGroupById.get(blockId) : null;
      return {
        ...cat,
        resolvedTaxonomyType: taxonomyType,
        blockName: block?.label || "Categorías del Sistema",
      };
    });

    const resolveBlockTaxonomy = (block: any): string => {
      const bType = normalizeType(block?.taxonomyType || block?.typeForm);
      if (bType && !["", "default", "predeterminado", "inherit"].includes(bType)) return bType;
      const labelNorm = String(block?.label ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (labelNorm.includes("actividad") || labelNorm.includes("sector")) return "actividad";
      if (labelNorm.includes("soluci") || labelNorm.includes("publicaci") || labelNorm.includes("recurso") || labelNorm.includes("propiedad")) return "categoria";
      if (/\b(?:tipo\s+de\s+(?:oferente|perfil|entidad|instituci[oó]n|proveedor)|perfil)\b/i.test(labelNorm) || labelNorm === "tipo" || labelNorm === "tipos") return "tipo";
      if (labelNorm.includes("modalidad")) return "modalidad";
      if (labelNorm.includes("prestacion")) return "prestacion";
      if (labelNorm.includes("idioma")) return "idiomas";
      return "categoria";
    };

    const activities: string[] = [];
    const types: string[] = [];
    const modalities: string[] = [];
    const prestaciones: string[] = [];
    const languages: string[] = [];

    categoryMapWithTaxonomy.forEach((cat) => {
      const name = String(cat.description || "").trim();
      if (!name) return;
      if (cat.resolvedTaxonomyType === "actividad") {
        activities.push(name);
      } else if (cat.resolvedTaxonomyType === "tipo") {
        types.push(name);
      } else if (cat.resolvedTaxonomyType === "modalidad") {
        modalities.push(name);
      } else if (cat.resolvedTaxonomyType === "prestacion") {
        prestaciones.push(name);
      } else if (cat.resolvedTaxonomyType === "idiomas" || cat.resolvedTaxonomyType === "idioma") {
        languages.push(name);
      }
    });

    const blocksMap = new Map<string, { blockName: string; blockTaxonomy: string; parentCategories: Array<{ name: string; categoryTaxonomy: string; subcategories: string[] }> }>();

    categoryMapWithTaxonomy
      .filter((c) => !c.parentId)
      .forEach((c) => {
        const blockKey = c.blockName;
        const blockId = resolveCategoryBlockId(c);
        const block = blockId ? filterGroupById.get(blockId) : null;
        const blockTaxonomy = resolveBlockTaxonomy(block);
        if (!blocksMap.has(blockKey)) {
          blocksMap.set(blockKey, { blockName: blockKey, blockTaxonomy, parentCategories: [] });
        }
        const children = categoryMapWithTaxonomy
          .filter((sub) => String(sub.parentId) === String(c.id))
          .map((sub) => String(sub.description || "").trim())
          .filter(Boolean);
        blocksMap.get(blockKey)!.parentCategories.push({
          name: String(c.description || "").trim(),
          categoryTaxonomy: c.resolvedTaxonomyType || "categoria",
          subcategories: children,
        });
      });

    dbFilterGroups.forEach((group) => {
      const resolvedGType = resolveBlockTaxonomy(group);

      if (resolvedGType === "actividad") {
        group.options?.forEach((opt: any) => activities.push(opt.label || opt.value));
      } else if (resolvedGType === "tipo") {
        group.options?.forEach((opt: any) => types.push(opt.label || opt.value));
      } else if (resolvedGType === "modalidad") {
        group.options?.forEach((opt: any) => modalities.push(opt.label || opt.value));
      } else if (resolvedGType === "prestacion") {
        group.options?.forEach((opt: any) => prestaciones.push(opt.label || opt.value));
      } else if (resolvedGType === "idiomas" || resolvedGType === "idioma") {
        group.options?.forEach((opt: any) => languages.push(opt.label || opt.value));
      }

      if (!blocksMap.has(group.label)) {
        const optionCats = (group.options || []).map((opt: any) => ({
          name: String(opt.label || opt.value || "").trim(),
          categoryTaxonomy: resolvedGType || "categoria",
          subcategories: [],
        })).filter((c: any) => c.name);
        if (optionCats.length > 0) {
          blocksMap.set(group.label, {
            blockName: group.label,
            blockTaxonomy: resolvedGType || "categoria",
            parentCategories: optionCats,
          });
        }
      }
    });

    const categoryTree = Array.from(blocksMap.values());

    const allMainCatNames = categoryMapWithTaxonomy
      .filter((c) => !c.parentId && c.resolvedTaxonomyType === "categoria")
      .map((c) => String(c.description || "").trim())
      .filter(Boolean);

    const allSubCatNames = categoryMapWithTaxonomy
      .filter((c) => c.parentId && c.resolvedTaxonomyType === "categoria")
      .map((c) => String(c.description || "").trim())
      .filter(Boolean);

    const canonicalLanguages = languages.length > 0
      ? languages
      : ["Español", "Inglés", "Portugués", "Italiano", "Alemán", "Francés"];

    const cleanTypes = Array.from(new Set(types.filter(Boolean)));
    // Strict mutual exclusion: No type (e.g. Empresa, Institución privada) may ever appear in activities!
    const cleanActivities = Array.from(new Set(activities.filter(Boolean))).filter((a) => !cleanTypes.includes(a));
    const cleanModalities = Array.from(new Set(modalities.filter(Boolean)));

    return {
      categoryTree,
      categories: Array.from(new Set(allMainCatNames.filter(Boolean))),
      subcategories: Array.from(new Set(allSubCatNames.filter(Boolean))),
      activities: cleanActivities,
      types: cleanTypes,
      modalities: cleanModalities,
      prestaciones: Array.from(new Set(prestaciones.filter(Boolean))),
      languages: Array.from(new Set(canonicalLanguages.filter(Boolean))),
    };
  } catch (e) {
    console.error("Error fetching system taxonomies from DB:", e);
    return {
      categoryTree: [],
      categories: [],
      subcategories: [],
      activities: [],
      types: [],
      modalities: [],
      prestaciones: [],
      languages: ["Español", "Inglés", "Portugués", "Italiano", "Alemán", "Francés"],
    };
  }
}

/**
 * Maps input string or list of keywords strictly to canonical DB options using exact, substring, or token match.
 * Never invents options outside dbPool.
 */
function mapToCanonicalTaxonomy(selectedItems: any[], dbPool: string[], fallbackKeywords: string[] = []): string[] {
  if (!dbPool || !dbPool.length) {
    return [];
  }

  const cleanItems = (Array.isArray(selectedItems) ? selectedItems : [selectedItems])
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  const poolWithNorm = dbPool.map((dbStr) => ({
    original: dbStr,
    norm: dbStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(),
  }));

  const matched = new Set<string>();

  for (const item of cleanItems) {
    const itemNorm = item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!itemNorm) continue;
    // Ignorar placeholders
    if (/^(?:categoria|actividad|tipo|modalidad|ninguna|ninguno|n\/?a|vacio|sin\s*categoria|sin\s*datos)$/i.test(itemNorm)) continue;

    // 1. Exact match
    const exact = poolWithNorm.find((p) => p.norm === itemNorm);
    if (exact) {
      matched.add(exact.original);
      continue;
    }

    // 2. Substring match (either direction) with strict word boundaries to avoid matching "cultura" in "agricultura"
    const escapedItem = itemNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const substring = poolWithNorm.find((p) => {
      const escapedP = p.norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return (
        new RegExp(`\\b${escapedItem}\\b`, "i").test(p.norm) ||
        new RegExp(`\\b${escapedP}\\b`, "i").test(itemNorm)
      );
    });
    if (substring) {
      matched.add(substring.original);
      continue;
    }

    // 3. Token match con palabras distintivas (longitud >= 5 y no palabras genéricas)
    const itemTokens = itemNorm.split(/\s+/).filter((t) => t.length >= 5 && !/^(?:para|sobre|centro|centros|servicio|servicios|general|generales|opcion|opciones|requisito|requisitos|previo|previos|explorando|explorar|paso|pasos|nivel|niveles|inicio|inicios|bienvenida|bienvenido|bienvenidos|etapa|etapas|plan|planes|especializado|especializada|especializados|especializadas|gestiones|tramites)$/i.test(t));
    if (itemTokens.length > 0) {
      const tokenMatch = poolWithNorm.find((p) => {
        const poolTokens = p.norm.split(/\s+/).filter((t) => t.length >= 5);
        return itemTokens.some((t) => {
          const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`\\b${escaped}\\b`, "i").test(p.norm);
        }) && poolTokens.some((pt) => {
          const escapedPt = pt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`\\b${escapedPt}\\b`, "i").test(itemNorm);
        });
      });
      if (tokenMatch) {
        matched.add(tokenMatch.original);
      }
    }
  }

  // Fallback keywords solo si no hubo ningún match genuino y las keywords coinciden estrictamente
  if (matched.size === 0 && fallbackKeywords.length) {
    for (const kw of fallbackKeywords) {
      const kwNorm = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (!kwNorm) continue;
      const escapedKw = kwNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = poolWithNorm.find((p) => {
        const escapedP = p.norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return (
          p.norm === kwNorm ||
          new RegExp(`\\b${escapedKw}\\b`, "i").test(p.norm) ||
          new RegExp(`\\b${escapedP}\\b`, "i").test(kwNorm)
        );
      });
      if (match) {
        matched.add(match.original);
      }
    }
  }

  return Array.from(matched);
}

/**
 * Detects real languages offered or spoken on the website from textual evidence and canonical list.
 */
function detectLanguagesFromText(allText: string, canonicalPool: string[] = []): string[] {
  const lower = String(allText || "").toLowerCase();
  const pool = canonicalPool.length > 0
    ? canonicalPool
    : ["Español", "Inglés", "Portugués", "Italiano", "Francés", "Alemán"];

  const poolWithNorm = pool.map((p) => ({
    original: p,
    norm: p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(),
  }));

  const detected = new Set<string>();

  // Spanish by default in LATAM/Spain platform
  const esp = poolWithNorm.find((p) => p.norm.includes("espanol") || p.norm === "es");
  if (esp) detected.add(esp.original);

  // English detection (text keywords, international relations/exchange, domain or path indicators)
  if (
    /\b(english|ingl[eé]s|bilingual|biling[uü]e|we speak english|english spoken|international|foreign|languages?:\s*.*english|exchange|study abroad|toefl|ielts|admissions|apply now|all rights reserved|overview|schedule a tour|international students?|relaciones internacionales|movilidad internacional|convenios internacionales|lenguas extranjeras)\b/i.test(lower) ||
    /\.(?:us|uk|ca|au|edu)(?:\/|\?|#|$)/i.test(lower) ||
    /\/(?:en|en-us|en-gb)(?:\/|\?|#|$)/i.test(lower)
  ) {
    const eng = poolWithNorm.find((p) => p.norm.includes("ingles") || p.norm === "en");
    if (eng) detected.add(eng.original);
  }

  // Portuguese detection (text keywords, domain or path indicators)
  if (
    /\b(portugu[eêé]s|falamos portugu[eêé]s|atendimento em portugu[eêé]s|fale conosco|bem-vindo|sobre n[oó]s|institui[cç][aã]o|brasil|brazil|brasileiro|brasileira)\b/i.test(lower) ||
    /\.br(?:\/|\?|#|$)/i.test(lower) ||
    /\/(?:pt|pt-br)(?:\/|\?|#|$)/i.test(lower)
  ) {
    const pt = poolWithNorm.find((p) => p.norm.includes("portugues") || p.norm === "pt");
    if (pt) detected.add(pt.original);
  }

  // Italian detection (text keywords, domain or path indicators)
  if (
    /\b(italiano|parliamo italiano|contattaci|chi siamo|benvenuti|italia|italian)\b/i.test(lower) ||
    /\.it(?:\/|\?|#|$)/i.test(lower) ||
    /\/(?:it|it-it)(?:\/|\?|#|$)/i.test(lower)
  ) {
    const it = poolWithNorm.find((p) => p.norm.includes("italiano") || p.norm === "it");
    if (it) detected.add(it.original);
  }

  // German detection (text keywords, domain or path indicators)
  if (
    /\b(alem[aá]n|deutsch|german|kontakt|deutschland)\b/i.test(lower) ||
    /\.de(?:\/|\?|#|$)/i.test(lower) ||
    /\/(?:de|de-de)(?:\/|\?|#|$)/i.test(lower)
  ) {
    const de = poolWithNorm.find((p) => p.norm.includes("aleman") || p.norm === "de");
    if (de) detected.add(de.original);
  }

  // French detection (text keywords, domain or path indicators)
  if (
    /\b(franc[eéè]s|fran[cç]ais|french|nous contacter|bienvenue|france)\b/i.test(lower) ||
    /\.fr(?:\/|\?|#|$)/i.test(lower) ||
    /\/(?:fr|fr-fr)(?:\/|\?|#|$)/i.test(lower)
  ) {
    const fr = poolWithNorm.find((p) => p.norm.includes("frances") || p.norm === "fr");
    if (fr) detected.add(fr.original);
  }

  return detected.size > 0 ? Array.from(detected) : (esp ? [esp.original] : ["Español"]);
}

function escapeHtml(input: string): string {
  return String(input || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractRatingFromText(text: string): string {
  const ratingMatch =
    text.match(/(?:rating|valoraci[oó]n|calificaci[oó]n|puntuaci[oó]n)\D{0,25}([1-5](?:[.,]\d)?)/i) ||
    text.match(/([1-5](?:[.,]\d)?)\s*(?:\/\s*5|estrellas|stars)/i);
  if (!ratingMatch) return "";
  const rating = Number(String(ratingMatch[1]).replace(",", "."));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return "";
  return rating.toFixed(1);
}

function extractReviewCountFromText(text: string): string {
  const match = text.match(/(\d{1,6})\s*(?:opiniones|rese[nñ]as|reviews|comentarios)/i);
  return match ? match[1] : "";
}

/**
 * Builds an authentic, transparent Score Scout evaluation block across 6 dimensions with complete 4-language translations.
 * Strictly penalizes missing terms, missing privacy policy, missing contact info or low reviews without artificial score inflation.
 */
function buildScoreScoutBlock(
  title: string,
  startYear: string,
  rating: string,
  allText: string,
  aiScoutData?: any,
  url?: string,
  reviewCount?: string
): ExtraDescriptionBlock {
  const detectedRating = extractRatingFromText(allText);
  const ratingNum = parseFloat(rating || detectedRating || "0");
  const revCount = parseInt(String(reviewCount || "0").replace(/[^0-9]/g, "") || "0", 10);
  const startYr = parseInt(startYear, 10);
  const currentYr = new Date().getFullYear();
  const hasValidYear = Number.isFinite(startYr) && startYr >= 1800 && startYr <= currentYr;
  const yearsActive = hasValidYear ? Math.max(1, currentYr - startYr) : 0;

  const fullCorpus = `${title} ${url || ""} ${allText}`.toLowerCase();

  const hasHttps = Boolean(url && url.toLowerCase().startsWith("https://")) || /https:\/\//i.test(allText);
  const hasCustomDomain = !/(?:wixsite|blogspot|wordpress|weebly|jimdo|site123)\.com/i.test(url || "");
  const hasPrivacyPolicy = /\b(pol[ií]tica\s+de\s+privacidad|privacy\s+policy|protecci[oó]n\s+de\s+datos|cookies|pol[ií]tica\s+de\s+cookies|tratamiento\s+de\s+datos)\b/i.test(allText);
  const hasTerms = /\b(t[eé]rminos\s+y\s+condiciones|terms\s+(?:of\s+service|and\s+conditions)|bases\s+y\s+condiciones|aviso\s+legal|t[eé]rminos\s+de\s+uso|condiciones\s+generales)\b/i.test(allText);
  const hasTaxId = /\b(cuit|cuil|c\.u\.i\.t|rut|rfc|cnpj|cif|nif|raz[oó]n\s+social|r\.u\.t)\b/i.test(allText);
  const hasMaps = /google\.[a-z.]+\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(allText);
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(allText);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d|whatsapp|wa\.me)/i.test(allText);
  const hasPhysicalAddress = Boolean(allText && /\b(?:av\.|avenida|calle|ruta|piso|altura|esq\.|boulevard|diagonal|pasaje)\b/i.test(allText));
  const hasPricingOrFees = /\b(precio|precios|arancel|aranceles|tarifa|tarifas|cuota|cuotas|costo|costos|valor|presupuesto|honorarios|inversi[oó]n)\b/i.test(allText);
  const hasDetailedServices = allText.length > 800 && /\b(servicio|servicios|especialidad|especialidades|carrera|carreras|tratamiento|tratamientos|producto|productos|guardia|atenci[oó]n)\b/i.test(allText);
  const isOfficialEntity = /osep|uba|nacional|publica|pública|estatal|gob|ministerio|tribunales|universidad\s+nacional|hospital\s+p[uú]blico/i.test(fullCorpus);

  // Parse AI subscores if provided by Gemini / OpenAI
  const parseSubscore = (val: any, max: number): number | null => {
    if (val !== undefined && val !== null && val !== "" && !isNaN(Number(val))) {
      return Math.min(max, Math.max(0, Math.round(Number(val))));
    }
    return null;
  };

  const aiP1 = parseSubscore(aiScoutData?.p1, 25);
  const aiP2 = parseSubscore(aiScoutData?.p2, 15);
  const aiP3 = parseSubscore(aiScoutData?.p3, 20);
  const aiP4 = parseSubscore(aiScoutData?.p4, 15);
  const aiP5 = parseSubscore(aiScoutData?.p5, 15);
  const aiP6 = parseSubscore(aiScoutData?.p6, 10);

  // Grounded calculation for P1 (Presencia y reputación, 0 to 25)
  let calcP1: number;
  if (ratingNum >= 4.7) calcP1 = 15;
  else if (ratingNum >= 4.3) calcP1 = 13;
  else if (ratingNum >= 4.0) calcP1 = 11;
  else if (ratingNum >= 3.5) calcP1 = 8;
  else if (ratingNum >= 3.0) calcP1 = 5;
  else if (ratingNum > 0) calcP1 = 3;
  else calcP1 = hasMaps ? 7 : 4;

  if (revCount >= 500) calcP1 += 9;
  else if (revCount >= 100) calcP1 += 7;
  else if (revCount >= 20) calcP1 += 5;
  else if (revCount > 0) calcP1 += 3;
  else if (hasMaps) calcP1 += 2;
  else calcP1 += 1;

  if (isOfficialEntity) calcP1 += 1;
  calcP1 = Math.min(25, Math.max(2, calcP1));

  // Grounded calculation for P2 (Contacto verificable, 0 to 15)
  let calcP2 = (hasEmail ? 4 : 0) + (hasPhone ? 4 : 0) + (hasMaps ? 4 : hasPhysicalAddress ? 2 : 0) + (allText.length > 800 ? 3 : 1);
  calcP2 = Math.min(15, Math.max(1, calcP2));

  // Grounded calculation for P3 (Trayectoria / Madurez operativa, 0 to 20)
  let calcP3: number;
  if (yearsActive >= 50) calcP3 = 20;
  else if (yearsActive >= 25) calcP3 = 18;
  else if (yearsActive >= 15) calcP3 = 15;
  else if (yearsActive >= 8) calcP3 = 12;
  else if (yearsActive >= 3) calcP3 = 8;
  else if (yearsActive > 0) calcP3 = 5;
  else calcP3 = isOfficialEntity ? 16 : 7;
  calcP3 = Math.min(20, Math.max(2, calcP3));

  // Grounded calculation for P4 (Claridad de la propuesta, 0 to 15)
  let calcP4 = (hasDetailedServices ? 6 : 2) + (hasPricingOrFees ? 5 : 2) + (allText.length > 1000 ? 4 : 2);
  calcP4 = Math.min(15, Math.max(2, calcP4));

  // Grounded calculation for P5 (Transparencia, Riesgo Legal y Privacidad, 0 to 15)
  // Strictly penalize lack of terms or privacy policy!
  let calcP5 = (hasTerms ? 5 : 1) + (hasPrivacyPolicy ? 5 : 1) + (hasTaxId ? 5 : 1);
  calcP5 = Math.min(15, Math.max(2, calcP5));

  // Grounded calculation for P6 (Datos Institucionales & Seguridad Técnica, 0 to 10)
  let calcP6 = (hasHttps ? 4 : 1) + (hasCustomDomain ? 3 : 1) + (isOfficialEntity || hasValidYear ? 3 : 2);
  calcP6 = Math.min(10, Math.max(2, calcP6));

  const p1 = aiP1 !== null ? aiP1 : calcP1;
  const p2 = aiP2 !== null ? aiP2 : calcP2;
  const p3 = aiP3 !== null ? aiP3 : calcP3;
  const p4 = aiP4 !== null ? aiP4 : calcP4;
  const p5 = aiP5 !== null ? aiP5 : calcP5;
  const p6 = aiP6 !== null ? aiP6 : calcP6;

  const totalScore = Math.min(100, Math.max(1, p1 + p2 + p3 + p4 + p5 + p6));

  // Transparent maturity classification based on real totalScore
  let madurez: string;
  if (totalScore >= 85) madurez = "Líder";
  else if (totalScore >= 70) madurez = "Consolidado";
  else if (totalScore >= 50) madurez = "En desarrollo";
  else madurez = "Básico / Observado";

  if (aiScoutData?.maturity && typeof aiScoutData.maturity === "string" && aiScoutData.maturity.trim()) {
    const aiMat = aiScoutData.maturity.trim();
    if (/l[ií]der/i.test(aiMat) && totalScore >= 75) madurez = "Líder";
    else if (/consolid/i.test(aiMat)) madurez = "Consolidado";
    else if (/desarrollo|observa/i.test(aiMat)) madurez = "En desarrollo";
    else if (/b[aá]sic|inic/i.test(aiMat)) madurez = "Básico / Observado";
  }

  const vinculo = isOfficialEntity || aiScoutData?.relationship === "Oficial" ? "Oficial" : "Directo";

  const madurezEn = madurez === "Líder" ? "Leader" : madurez === "Consolidado" ? "Established" : madurez === "En desarrollo" ? "Developing" : "Initial / Observed";
  const vinculoEn = vinculo === "Oficial" ? "Official" : "Direct";

  const madurezPt = madurez === "Líder" ? "Líder" : madurez === "Consolidado" ? "Consolidado" : madurez === "En desarrollo" ? "Em desenvolvimento" : "Inicial / Observado";
  const vinculoPt = vinculo === "Oficial" ? "Oficial" : "Direto";

  const madurezIt = madurez === "Líder" ? "Leader" : madurez === "Consolidado" ? "Consolidato" : madurez === "En desarrollo" ? "In sviluppo" : "Iniziale / Osservato";
  const vinculoIt = vinculo === "Oficial" ? "Ufficiale" : "Diretto";

  let evidenceEs = "Presencia institucional y canales de contacto informados";
  let evidenceEn = "Institutional presence and published contact channels";
  let evidencePt = "Presença institucional e canais informados";
  let evidenceIt = "Presenza istituzionale e canali informati";

  if (!hasPrivacyPolicy && !hasTerms) {
    evidenceEs = "Presencia institucional y canales informados con observaciones en políticas de privacidad o términos";
    evidenceEn = "Institutional presence and published channels with observations on privacy policies or terms";
    evidencePt = "Presença institucional e canais informados com observações sobre políticas de privacidade ou termos";
    evidenceIt = "Presenza istituzionale e canali informati con osservazioni sulle politiche sulla privacy o termini";
  } else if (hasMaps && (hasEmail || hasPhone)) {
    evidenceEs = "Canales oficiales verificados, mapa de ubicación y datos de contacto activos";
    evidenceEn = "Verified official channels, location map, and active contact details";
    evidencePt = "Canais oficiais verificados, mapa de localização e dados de contato ativos";
    evidenceIt = "Canali ufficiali verificati, mappa di localizzazione e contatti attivi";
  }

  const bodyEs = `<p>Presencia/reputación ${p1}/25 · Contacto verificable ${p2}/15 · Trayectoria/evidencia operativa ${p3}/20 · Claridad propuesta ${p4}/15 · Transparencia/seguridad ${p5}/15 · Datos institucionales ${p6}/10<br>Madurez: ${madurez} - Vínculo: ${vinculo} - Evidencia: ${evidenceEs}.</p>`;
  const bodyEn = `<p>Reputation/presence ${p1}/25 · Verifiable contact ${p2}/15 · Track record/operational evidence ${p3}/20 · Proposal clarity ${p4}/15 · Safety/transparency ${p5}/15 · Institutional data ${p6}/10<br>Maturity: ${madurezEn} - Relationship: ${vinculoEn} - Evidence: ${evidenceEn}.</p>`;
  const bodyPt = `<p>Reputação/presença ${p1}/25 · Contato verificável ${p2}/15 · Trajetória/evidência operacional ${p3}/20 · Clareza da proposta ${p4}/15 · Segurança/transparência ${p5}/15 · Dados institucionais ${p6}/10<br>Maturidade: ${madurezPt} - Vínculo: ${vinculoPt} - Evidência: ${evidencePt}.</p>`;
  const bodyIt = `<p>Reputazione/presenza ${p1}/25 · Contatto verificabile ${p2}/15 · Storico/evidenza operativa ${p3}/20 · Chiarezza proposta ${p4}/15 · Sicurezza/trasparenza ${p5}/15 · Dati istituzionali ${p6}/10<br>Maturità: ${madurezIt} - Vincolo: ${vinculoIt} - Evidenza: ${evidenceIt}.</p>`;

  return {
    title: `🛡️ Score Scout ${totalScore}/100`,
    titleI18n: {
      es: `🛡️ Score Scout ${totalScore}/100`,
      en: `🛡️ Score Scout ${totalScore}/100`,
      pt: `🛡️ Score Scout ${totalScore}/100`,
      it: `🛡️ Score Scout ${totalScore}/100`,
    },
    body: bodyEs,
    bodyI18n: {
      es: bodyEs,
      en: bodyEn,
      pt: bodyPt,
      it: bodyIt,
    },
    visibleInCard: false,
  };
}

function cleanJunkTextPhrases(text: string): string {
  if (!text || typeof text !== "string") return "";

  // If the text contains HTML tags, only clean text content outside tags, preserving <...> completely!
  if (/<[a-z][\s\S]*>/i.test(text)) {
    return text
      .split(/(<[^>]+>)/g)
      .map((part) => {
        if (part.startsWith("<") && part.endsWith(">")) return part;
        return part
          .replace(/\b(?:leer\s+(?:nota|m[aá]s|noticia)|ver\s+(?:m[aá]s|detalle|publicaci[oó]n|nota)|conoc[eé]\s+m[aá]s|saber\s+m[aá]s|m[aá]s\s+informaci[oó]n|read\s+more|seguir\s+leyendo|ir\s+a\s+la\s+nota|haga?\s+clic\s+aqu[ií]|clic\s+aqu[ií]|click\s+here)\b\s*[»›→\.]*/gi, "")
          .replace(/[»›→]+/g, "");
      })
      .join("")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  return text
    .replace(/\b(?:leer\s+(?:nota|m[aá]s|noticia)|ver\s+(?:m[aá]s|detalle|publicaci[oó]n|nota)|conoc[eé]\s+m[aá]s|saber\s+m[aá]s|m[aá]s\s+informaci[oó]n|read\s+more|seguir\s+leyendo|ir\s+a\s+la\s+nota|haga?\s+clic\s+aqu[ií]|clic\s+aqu[ií]|click\s+here)\b\s*[»›→\.]*/gi, "")
    .replace(/[»›→]+/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

function normalizeMarkdownToHtmlParagraphs(text: string): string {
  if (!text || typeof text !== "string") return "";
  let clean = cleanJunkTextPhrases(text);

  // If already contains <p> tags, clean up and ensure valid HTML structure
  if (/<p\b[^>]*>/i.test(clean)) {
    return clean
      .replace(/<p\b[^>]*>/gi, "<p>")
      .split("</p>")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (p.startsWith("<p>") ? `${p}</p>` : `<p>${p}</p>`))
      .join("\n");
  }

  // Convert markdown bold and italics to HTML
  clean = clean
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");

  // Split by double newlines or single newlines that start with icons or bullet-like headers
  const paragraphs = clean
    .split(/\n\s*\n+|\n(?=[💡⭐⚠️•\-]|<strong>)/g)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return "";
  return paragraphs.map((p) => `<p>${p}</p>`).join("\n");
}

function normalizeToSpanishDescriptionHeaders(text: string): string {
  if (!text) return "";
  let formatted = normalizeMarkdownToHtmlParagraphs(text);
  return formatted
    .replace(/<strong>\s*(?:Validity|Validade|Validità):\s*<\/strong>/gi, "<strong>Vigencia:</strong>")
    .replace(/<strong>\s*(?:Price|Preço|Prezzo):\s*<\/strong>/gi, "<strong>Precio:</strong>")
    .replace(/<strong>\s*(?:Value proposition|Proposta de valor|Proposta di valore):\s*<\/strong>/gi, "<strong>Propuesta de valor:</strong>")
    .replace(/<strong>\s*(?:Who is it for\??|Para quem\??|Per chi\??):\s*<\/strong>/gi, "<strong>¿Para quién?:</strong>")
    .replace(/<strong>\s*(?:Required documents|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Documentación requerida:</strong>")
    .replace(/<strong>\s*(?:Length of stay|Permanência|Permanenza):\s*<\/strong>/gi, "<strong>Permanencia:</strong>")
    .replace(/<strong>\s*(?:Differentiator|Diferencial|Differenziale):\s*<\/strong>/gi, "<strong>Diferencial:</strong>")
    .replace(/<em>\s*(?:Service languages|Idiomas de atendimento|Lingue di assistenza):\s*<\/em>/gi, "<em>Idiomas de atención:</em>")
    .replace(/<em>\s*(?:Experience and support|Experiência e suporte|Esperienza e supporto):\s*<\/em>/gi, "<em>Experiencia y soporte:</em>")
    .replace(/<em>\s*(?:Differentiator vs\. alternatives|Diferencial vs\. alternativas|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Diferencial vs. alternativas:</em>")
    .replace(/<strong>\s*(?:Exclusions|Exclusões|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusiones:</strong>");
}

function normalizeToEnglishDescriptionHeaders(text: string): string {
  if (!text) return "";
  let formatted = normalizeMarkdownToHtmlParagraphs(text);
  return formatted
    .replace(/<strong>\s*(?:Vigencia|Validade|Validità):\s*<\/strong>/gi, "<strong>Validity:</strong>")
    .replace(/<strong>\s*(?:Precio|Preço|Prezzo):\s*<\/strong>/gi, "<strong>Price:</strong>")
    .replace(/<strong>\s*(?:Propuesta de valor|Proposta de valor|Proposta di valore):\s*<\/strong>/gi, "<strong>Value proposition:</strong>")
    .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Para quem\??|Per chi\??):\s*<\/strong>/gi, "<strong>Who is it for?:</strong>")
    .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Required documents:</strong>")
    .replace(/<strong>\s*(?:Permanencia|Permanência|Permanenza):\s*<\/strong>/gi, "<strong>Length of stay:</strong>")
    .replace(/<strong>\s*(?:Diferencial|Differenziale):\s*<\/strong>/gi, "<strong>Differentiator:</strong>")
    .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Lingue di assistenza):\s*<\/em>/gi, "<em>Service languages:</em>")
    .replace(/<em>\s*(?:Experiencia y soporte|Experiência e suporte|Esperienza e supporto):\s*<\/em>/gi, "<em>Experience and support:</em>")
    .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Differentiator vs. alternatives:</em>")
    .replace(/<strong>\s*(?:Exclusiones|Exclusions|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusions:</strong>");
}

function normalizeToPortugueseDescriptionHeaders(text: string): string {
  if (!text) return "";
  let formatted = normalizeMarkdownToHtmlParagraphs(text);
  return formatted
    .replace(/<strong>\s*(?:Vigencia|Validity|Validità):\s*<\/strong>/gi, "<strong>Validade:</strong>")
    .replace(/<strong>\s*(?:Precio|Price|Prezzo):\s*<\/strong>/gi, "<strong>Preço:</strong>")
    .replace(/<strong>\s*(?:Propuesta de valor|Value proposition|Proposta di valore):\s*<\/strong>/gi, "<strong>Proposta de valor:</strong>")
    .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Per chi\??):\s*<\/strong>/gi, "<strong>Para quem?:</strong>")
    .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Documentação necessária:</strong>")
    .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanenza):\s*<\/strong>/gi, "<strong>Permanência:</strong>")
    .replace(/<strong>\s*(?:Diferencial|Differentiator|Differenziale):\s*<\/strong>/gi, "<strong>Diferencial:</strong>")
    .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Lingue di assistenza):\s*<\/em>/gi, "<em>Idiomas de atendimento:</em>")
    .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Experiência e suporte):\s*<\/em>/gi, "<em>Experiência e suporte:</em>")
    .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Diferencial vs. alternativas:</em>")
    .replace(/<strong>\s*(?:Exclusiones|Exclusions|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusões:</strong>");
}

function normalizeToItalianDescriptionHeaders(text: string): string {
  if (!text) return "";
  let formatted = normalizeMarkdownToHtmlParagraphs(text);
  return formatted
    .replace(/<strong>\s*(?:Vigencia|Validity|Validade):\s*<\/strong>/gi, "<strong>Validità:</strong>")
    .replace(/<strong>\s*(?:Precio|Price|Preço):\s*<\/strong>/gi, "<strong>Prezzo:</strong>")
    .replace(/<strong>\s*(?:Propuesta de valor|Value proposition|Proposta de valor):\s*<\/strong>/gi, "<strong>Proposta di valore:</strong>")
    .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Para quem\??):\s*<\/strong>/gi, "<strong>Per chi?:</strong>")
    .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária):\s*<\/strong>/gi, "<strong>Documentazione richiesta:</strong>")
    .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanência):\s*<\/strong>/gi, "<strong>Permanenza:</strong>")
    .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Differenziale:</strong>")
    .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Idiomas de atendimento):\s*<\/em>/gi, "<em>Lingue di assistenza:</em>")
    .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Experiência e suporte):\s*<\/em>/gi, "<em>Esperienza e supporto:</em>")
    .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Differenziale vs. alternative:</em>")
    .replace(/<strong>\s*(?:Exclusiones|Exclusions|Exclusões):\s*<\/strong>/gi, "<strong>Esclusioni:</strong>");
}

async function translateWithGoogleDirect(text: string, sl: string, tl: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 3000);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("json")) return null;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map((item: any) => item[0]).filter(Boolean).join("");
      return translated || null;
    }
  } catch {}
  return null;
}

async function translateTextDirect(q: string, sl: string, tl: string): Promise<string> {
  const trimmed = q.trim();
  if (!trimmed || sl === tl) return q;

  // 1. Google Chrome Dict translation endpoint (fastest, strict 1200ms timeout)
  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(trimmed)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 1200);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const trans = decodeHtmlEntities(String(data[0]).trim());
        if (trans && trans !== trimmed) return trans;
      }
    }
  } catch {}

  // 2. Google Translate public API (gtx) (strict 1000ms timeout)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 1000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const translated = data[0].map((item: any) => item[0]).filter(Boolean).join("");
        if (translated && translated.trim() !== trimmed) {
          return decodeHtmlEntities(translated.trim());
        }
      }
    }
  } catch {}

  // 3. Fallback to dictionary translation
  return translateStructuredDescription(trimmed, tl as any);
}

async function translateFullHtmlDescriptionAsync(htmlEs: string, targetLang: "en" | "pt" | "it"): Promise<string> {
  if (!htmlEs) return "";
  try {
    const instantTrans = translateStructuredDescription(htmlEs, targetLang);

    const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    const rawParagraphs: string[] = [];
    let match;
    while ((match = pRegex.exec(htmlEs)) !== null) {
      rawParagraphs.push(match[1]);
    }

    // If there are no paragraphs or many paragraphs (> 3, e.g. FAQ with 10 questions),
    // use instant dictionary translation to completely avoid 504 Gateway Timeouts from 90+ external HTTP requests!
    if (rawParagraphs.length === 0 || rawParagraphs.length > 3) {
      return targetLang === "en"
        ? normalizeToEnglishDescriptionHeaders(instantTrans)
        : targetLang === "pt"
        ? normalizeToPortugueseDescriptionHeaders(instantTrans)
        : normalizeToItalianDescriptionHeaders(instantTrans);
    }

    // For 1-3 short paragraphs, translate cleanly with strict timeout
    const translatedPs = await Promise.all(
      rawParagraphs.map(async (pText) => {
        const cleanP = pText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (!cleanP || cleanP.length < 5) return `<p>${pText}</p>`;
        const trans = await translateTextDirect(cleanP, "es", targetLang).catch(() => cleanP);
        return `<p>${trans || cleanP}</p>`;
      })
    );

    const fullHtml = translatedPs.join("\n");
    const normalized = translateStructuredDescription(fullHtml, targetLang);
    return targetLang === "en"
      ? normalizeToEnglishDescriptionHeaders(normalized)
      : targetLang === "pt"
      ? normalizeToPortugueseDescriptionHeaders(normalized)
      : normalizeToItalianDescriptionHeaders(normalized);
  } catch (err) {
    console.warn(`[AI Scraper] translateFullHtmlDescriptionAsync fallback to Spanish for ${targetLang}:`, err);
    return htmlEs;
  }
}

function translateStructuredDescription(descEs: string, targetLang: "en" | "pt" | "it"): string {
  if (!descEs) return "";
  let text = descEs;

  if (targetLang === "en") {
    text = text
      .replace(/<strong>\s*(?:Vigencia|Validade|Validità):\s*<\/strong>/gi, "<strong>Validity:</strong>")
      .replace(/<strong>\s*(?:Precio|Preço|Prezzo):\s*<\/strong>/gi, "<strong>Price:</strong>")
      .replace(/<strong>\s*(?:Propuesta de valor|Value proposition|Proposta de valor|Proposta di valore):\s*<\/strong>/gi, "<strong>Value proposition:</strong>")
      .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Para quem\??|Per chi\??):\s*<\/strong>/gi, "<strong>Who is it for?:</strong>")
      .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Required documents:</strong>")
      .replace(/<strong>\s*(?:Permanencia|Permanência|Permanenza):\s*<\/strong>/gi, "<strong>Length of stay:</strong>")
      .replace(/<strong>\s*(?:Diferencial|Differenziale):\s*<\/strong>/gi, "<strong>Differentiator:</strong>")
      .replace(/<strong>\s*(?:Historia y Trayectoria):\s*<\/strong>/gi, "<strong>History and Background:</strong>")
      .replace(/<strong>\s*(?:Detalle de Servicios y Prestaciones):\s*<\/strong>/gi, "<strong>Detailed Services:</strong>")
      .replace(/<strong>\s*(?:Resumen Ejecutivo):\s*<\/strong>/gi, "<strong>Executive Summary:</strong>")
      .replace(/<strong>\s*(?:Quiénes Somos):\s*<\/strong>/gi, "<strong>About Us:</strong>")
      .replace(/<strong>\s*(?:Propuesta de Vanguardia e Impacto|Propuesta Académica de Vanguardia):\s*<\/strong>/gi, "<strong>Cutting-Edge Proposal and Impact:</strong>")
      .replace(/<strong>\s*(?:Servicios Clave y Formación):\s*<\/strong>/gi, "<strong>Key Programs and Offerings:</strong>")
      .replace(/<strong>\s*(?:Diferencial y Respaldo(?: Institucional)?):\s*<\/strong>/gi, "<strong>Differentiator and Institutional Support:</strong>")
      .replace(/<strong>\s*(?:Presencia y Canales(?: Oficiales)?):\s*<\/strong>/gi, "<strong>Presence and Official Channels:</strong>")
      .replace(/<strong>\s*(?:Oferta Académica y Formación):\s*<\/strong>/gi, "<strong>Academic Offer and Training:</strong>")
      .replace(/<strong>\s*(?:Servicios Clave y Formación):\s*<\/strong>/gi, "<strong>Key Programs and Offerings:</strong>")
      .replace(/<strong>\s*(?:Presencia y Cobertura):\s*<\/strong>/gi, "<strong>Presence and Coverage:</strong>")
      .replace(/<strong>\s*(?:Presentación y Propuesta):\s*<\/strong>/gi, "<strong>Presentation and Proposal:</strong>")
      .replace(/<strong>\s*(?:Servicios y Especialidades):\s*<\/strong>/gi, "<strong>Services and Specialties:</strong>")
      .replace(/<strong>\s*(?:Consolidación y Crecimiento):\s*<\/strong>/gi, "<strong>Growth and Consolidation:</strong>")
      .replace(/<strong>\s*(?:Metodología y Alcance):\s*<\/strong>/gi, "<strong>Methodology and Reach:</strong>")
      .replace(/<strong>\s*(?:Capacidades Operativas):\s*<\/strong>/gi, "<strong>Operational Capabilities:</strong>")
      .replace(/<strong>\s*(?:Estándares de Calidad):\s*<\/strong>/gi, "<strong>Quality Standards:</strong>")
      .replace(/<strong>\s*(?:Misión y Compromiso):\s*<\/strong>/gi, "<strong>Mission and Commitment:</strong>")
      .replace(/<strong>\s*(?:Ubicación y Contacto):\s*<\/strong>/gi, "<strong>Location and Contact:</strong>")
      .replace(/<strong>\s*(?:Información y Canales Oficiales):\s*<\/strong>/gi, "<strong>Official Channels and Information:</strong>")
      .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Lingue di assistenza):\s*<\/em>/gi, "<em>Service languages:</em>")
      .replace(/<em>\s*(?:Experiencia y soporte|Experiência e suporte|Esperienza e supporto):\s*<\/em>/gi, "<em>Experience and support:</em>")
      .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Differentiator vs. alternatives:</em>")
      .replace(/<strong>\s*(?:Exclusiones|Exclusions|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusions:</strong>")
      .replace(/Activo;\s*sitio oficial actualizado\./gi, "Active; official website updated.")
      .replace(/A consultar\s*\/\s*Seg[uú]n aranceles o tarifas del oferente\./gi, "Upon request / Subject to provider rates.")
      .replace(/A consultar/gi, "Upon request")
      .replace(/se consolida como una de las instituciones universitarias líderes e innovadoras de Argentina/gi, "is consolidated as one of Argentina's leading and most innovative university institutions")
      .replace(/destacándose por su modelo de educación de vanguardia, tecnología aplicada y alta tasa de inserción profesional\./gi, "standing out for its cutting-edge educational model, applied technology, and high rate of professional employment.")
      .replace(/Su oferta académica integra una amplia variedad de carreras de grado, licenciaturas, diplomaturas y posgrados oficiales con modalidades flexibles \(presenciales y online\) diseñadas para responder a las exigencias del mercado profesional global\./gi, "Its academic offer integrates a wide variety of undergraduate degrees, bachelor's, diplomas, and official postgraduate programs with flexible modalities (on-campus and online) designed to meet the demands of the global professional market.")
      .replace(/con centros universitarios y canales directos habilitados para admisiones, consultas e información académica\./gi, "with university learning centers and direct channels enabled for admissions, inquiries, and academic information.")
      .replace(/es una de las instituciones universitarias líderes más destacadas de Argentina/gi, "is one of the leading university institutions in Argentina")
      .replace(/reconocida por su propuesta académica de vanguardia, tecnología educativa aplicada y alta inserción laboral\./gi, "recognized for its cutting-edge academic approach, applied educational technology, and high job placement.")
      .replace(/Su oferta académica integra una amplia variedad de carreras de grado, licenciaturas, diplomaturas y posgrados oficiales con modalidades flexibles presenciales y online diseñadas para liderar el futuro profesional\./gi, "Its academic offer integrates a wide variety of undergraduate degrees, bachelor's, diplomas, and official postgraduate programs with flexible on-campus and online modalities designed to lead your professional future.")
      .replace(/Títulos oficiales verificados, infraestructura moderna, convenios estratégicos y compromiso permanente con la calidad y la innovación\./gi, "Verified official degrees, modern infrastructure, strategic alliances, and continuous commitment to quality and innovation.")
      .replace(/con canales oficiales activos para atención directa, consultas e inscripciones\./gi, "with active official channels for direct assistance, inquiries, and admissions.")
      .replace(/cuenta con una sólida trayectoria institucional desde su fundación en el año/gi, "has a solid institutional track record since its founding in")
      .replace(/consolidándose como un referente en/gi, "establishing itself as a benchmark in")
      .replace(/A lo largo de su historia ha desarrollado un modelo de excelencia y servicio continuo\./gi, "Throughout its history, it has developed a model of excellence and continuous service.")
      .replace(/se destaca por su amplia trayectoria y solidez en/gi, "stands out for its extensive track record and strength in")
      .replace(/brindando soluciones de calidad y compromiso profesional sustentado en su experiencia\./gi, "providing quality solutions and professional commitment based on its experience.")
      .replace(/ofrece una cartera completa de prestaciones que incluye:/gi, "offers a comprehensive portfolio of services including:")
      .replace(/Cada área cuenta con soporte calificado, procesos certificados y atención adaptada a cada necesidad\./gi, "Each area has qualified support, certified processes, and care tailored to every need.")
      .replace(/es una entidad de referencia en/gi, "is a leading institution in")
      .replace(/Su propuesta integra altos estándares operativos, tecnología y atención especializada orientada a satisfacer los requerimientos de sus usuarios y clientes\./gi, "Its approach combines high operational standards, technology, and specialized care to meet user and client needs.")
      .replace(/es una institución orientada a brindar soluciones integrales en/gi, "is an institution dedicated to providing comprehensive solutions in")
      .replace(/Cuenta con profesionales capacitados e infraestructura moderna\./gi, "It features trained professionals and modern infrastructure.")
      .replace(/con sede central en\b/gi, "with main headquarters in")
      .replace(/con sede en\b/gi, "headquartered in")
      .replace(/Sede principal en\b/gi, "Main campus in")
      .replace(/Personas interesadas,\s*clientes,\s*familias,\s*estudiantes o profesionales seg[uú]n el rubro\./gi, "Interested individuals, clients, families, students, or professionals according to sector.")
      .replace(/DNI o pasaporte y documentaci[oó]n informada por el oferente\./gi, "ID or passport and documentation informed by the provider.")
      .replace(/Seg[uú]n la modalidad o servicio contratado\./gi, "According to the contracted modality or service.")
      .replace(/Espa[ñn]ol,\s*Ingl[eé]s\./gi, "Spanish, English.")
      .replace(/Informaci[oó]n tomada directamente del portal oficial\./gi, "Information sourced directly from the official portal.")
      .replace(/Contacto directo con el oferente y respaldo institucional\./gi, "Direct contact with the provider and institutional backing.")
      .replace(/Confirmar disponibilidad,\s*tarifas vigentes,\s*requisitos y condiciones particulares directamente en\b/gi, "Confirm availability, current rates, requirements, and specific conditions directly at")
      .replace(/Confirmar disponibilidad,\s*requisitos y condiciones particulares directamente en\b/gi, "Confirm availability, requirements, and specific conditions directly at")
      .replace(/antes de contratar o postular\./gi, "before hiring or applying.");
    return text;
  }

  if (targetLang === "pt") {
    text = text
      .replace(/<strong>\s*(?:Vigencia|Validity|Validità):\s*<\/strong>/gi, "<strong>Validade:</strong>")
      .replace(/<strong>\s*(?:Precio|Price|Prezzo):\s*<\/strong>/gi, "<strong>Preço:</strong>")
      .replace(/<strong>\s*(?:Propuesta de valor|Value proposition):\s*<\/strong>/gi, "<strong>Proposta de valor:</strong>")
      .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Per chi\??):\s*<\/strong>/gi, "<strong>Para quem?:</strong>")
      .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Documentação necessária:</strong>")
      .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanenza):\s*<\/strong>/gi, "<strong>Permanência:</strong>")
      .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Diferencial:</strong>")
      .replace(/<strong>\s*(?:Historia y Trayectoria):\s*<\/strong>/gi, "<strong>História e Trajetória:</strong>")
      .replace(/<strong>\s*(?:Detalle de Servicios y Prestaciones):\s*<\/strong>/gi, "<strong>Detalhe dos Serviços:</strong>")
      .replace(/<strong>\s*(?:Resumen Ejecutivo):\s*<\/strong>/gi, "<strong>Resumo Executivo:</strong>")
      .replace(/<strong>\s*(?:Quiénes Somos):\s*<\/strong>/gi, "<strong>Quem Somos:</strong>")
      .replace(/<strong>\s*(?:Propuesta de Vanguardia e Impacto|Propuesta Académica de Vanguardia):\s*<\/strong>/gi, "<strong>Proposta de Vanguarda e Impacto:</strong>")
      .replace(/<strong>\s*(?:Diferencial y Respaldo(?: Institucional)?):\s*<\/strong>/gi, "<strong>Diferencial e Respaldo Institucional:</strong>")
      .replace(/<strong>\s*(?:Presencia y Canales(?: Oficiales)?):\s*<\/strong>/gi, "<strong>Presença e Canais Oficiais:</strong>")
      .replace(/<strong>\s*(?:Oferta Académica y Formación):\s*<\/strong>/gi, "<strong>Oferta Acadêmica e Formação:</strong>")
      .replace(/<strong>\s*(?:Servicios Clave y Formación):\s*<\/strong>/gi, "<strong>Cursos Principais e Formação:</strong>")
      .replace(/<strong>\s*(?:Presencia y Cobertura):\s*<\/strong>/gi, "<strong>Presença e Cobertura:</strong>")
      .replace(/<strong>\s*(?:Presentación y Propuesta):\s*<\/strong>/gi, "<strong>Apresentação e Proposta:</strong>")
      .replace(/<strong>\s*(?:Servicios y Especialidades):\s*<\/strong>/gi, "<strong>Serviços e Especialidades:</strong>")
      .replace(/<strong>\s*(?:Consolidación y Crecimiento):\s*<\/strong>/gi, "<strong>Consolidação e Crescimento:</strong>")
      .replace(/<strong>\s*(?:Metodología y Alcance):\s*<\/strong>/gi, "<strong>Metodologia e Alcance:</strong>")
      .replace(/<strong>\s*(?:Capacidades Operativas):\s*<\/strong>/gi, "<strong>Capacidades Operacionais:</strong>")
      .replace(/<strong>\s*(?:Estándares de Calidad):\s*<\/strong>/gi, "<strong>Padrões de Qualidade:</strong>")
      .replace(/<strong>\s*(?:Misión y Compromiso):\s*<\/strong>/gi, "<strong>Missão e Compromisso:</strong>")
      .replace(/<strong>\s*(?:Ubicación y Contacto):\s*<\/strong>/gi, "<strong>Localização e Contato:</strong>")
      .replace(/<strong>\s*(?:Información y Canales Oficiales):\s*<\/strong>/gi, "<strong>Informações e Canais Oficiais:</strong>")
      .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Lingue di assistenza):\s*<\/em>/gi, "<em>Idiomas de atendimento:</em>")
      .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Esperienza e supporto):\s*<\/em>/gi, "<em>Experiência e suporte:</em>")
      .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Diferencial vs. alternativas:</em>")
      .replace(/<strong>\s*(?:Exclusiones|Exclusions|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusões:</strong>")
      .replace(/Activo;\s*sitio oficial actualizado\./gi, "Ativo; site oficial atualizado.")
      .replace(/A consultar\s*\/\s*Seg[uú]n aranceles o tarifas del oferente\./gi, "Sob consulta / Conforme tarifas do provedor.")
      .replace(/A consultar/gi, "Sob consulta")
      .replace(/se consolida como una de las instituciones universitarias líderes e innovadoras de Argentina/gi, "consolida-se como uma das instituições universitárias líderes e inovadoras da Argentina")
      .replace(/destacándose por su modelo de educación de vanguardia, tecnología aplicada y alta tasa de inserción profesional\./gi, "destacando-se pelo seu modelo de educação de vanguarda, tecnologia aplicada e alta taxa de inserção profissional.")
      .replace(/Su oferta académica integra una amplia variedad de carreras de grado, licenciaturas, diplomaturas y posgrados oficiales con modalidades flexibles \(presenciales y online\) diseñadas para responder a las exigencias del mercado profesional global\./gi, "Sua oferta acadêmica integra uma ampla variedade de cursos de graduação, licenciaturas e pós-graduações com modalidades flexíveis (presenciais e online) desenhadas para responder às exigências do mercado profissional global.")
      .replace(/con centros universitarios y canales directos habilitados para admisiones, consultas e información académica\./gi, "com centros universitários e canais diretos habilitados para admissões, consultas e informações acadêmicas.")
      .replace(/Títulos oficiales verificados, infraestructura moderna, convenios estratégicos y compromiso permanente con la calidad y la innovación\./gi, "Diplomas oficiais verificados, infraestrutura moderna, convênios estratégicos e compromisso permanente com a qualidade e inovação.")
      .replace(/cuenta con una sólida trajetória institucional desde su fundación en el año/gi, "possui uma sólida trajetória institucional desde sua fundação em")
      .replace(/consolidándose como un referente en/gi, "consolidando-se como referência em")
      .replace(/A lo largo de su historia ha desarrollado un modelo de excelencia y servicio continuo\./gi, "Ao longo de sua história, desenvolveu um modelo de excelência e serviço contínuo.")
      .replace(/se destaca por su amplia trayectoria y solidez en/gi, "destaca-se por sua ampla trajetória e solidez em")
      .replace(/brindando soluciones de calidad y compromiso profesional sustentado en su experiencia\./gi, "oferecendo soluções de qualidade e compromisso profissional baseado em sua experiência.")
      .replace(/ofrece una cartera completa de prestaciones que incluye:/gi, "oferece uma gama completa de serviços que inclui:")
      .replace(/Cada área cuenta con soporte calificado, procesos certificados y atención adaptada a cada necesidad\./gi, "Cada área conta com suporte qualificado, processos certificados e atendimento sob medida.")
      .replace(/es una entidad de referencia en/gi, "é uma entidade de referência em")
      .replace(/Su propuesta integra altos estándares operativos, tecnología y atención especializada orientada a satisfacer los requerimientos de sus usuarios y clientes\./gi, "Sua proposta integra altos padrões operacionais, tecnologia e atendimento especializado.")
      .replace(/es una institución orientada a brindar soluciones integrales en/gi, "é uma instituição voltada a fornecer soluções integrais em")
      .replace(/Cuenta con profesionales capacitados e infraestructura moderna\./gi, "Conta com profissionais capacitados e infraestrutura moderna.")
      .replace(/con sede central en\b/gi, "com sede central em")
      .replace(/con sede en\b/gi, "com sede em")
      .replace(/Sede principal en\b/gi, "Sede principal em")
      .replace(/Personas interesadas,\s*clientes,\s*familias,\s*estudiantes o profesionales seg[uú]n el rubro\./gi, "Interessados, clientes, famílias, estudantes ou profissionais conforme o setor.")
      .replace(/DNI o pasaporte y documentaci[oó]n informada por el oferente\./gi, "RG ou passaporte e documentação informada pelo provedor.")
      .replace(/Seg[uú]n la modalidad o servicio contratado\./gi, "Conforme a modalidade ou serviço contratado.")
      .replace(/Espa[ñn]ol,\s*Ingl[eé]s\./gi, "Espanhol, Inglês.")
      .replace(/Informaci[oó]n tomada directamente del portal oficial\./gi, "Informações obtidas diretamente do portal oficial.")
      .replace(/Contacto directo con el oferente y respaldo institucional\./gi, "Contato direto com o provedor e respaldo institucional.")
      .replace(/Confirmar disponibilidad,\s*tarifas vigentes,\s*requisitos y condiciones particulares directamente en\b/gi, "Confirmar disponibilidade, tarifas vigentes, requisitos e condições diretamente em")
      .replace(/Confirmar disponibilidad,\s*requisitos y condiciones particulares directamente en\b/gi, "Confirmar disponibilidade, requisitos e condições diretamente em")
      .replace(/antes de contratar o postular\./gi, "antes de contratar ou se candidatar.");
    return text;
  }

  if (targetLang === "it") {
    text = text
      .replace(/<strong>\s*(?:Vigencia|Validity|Validade):\s*<\/strong>/gi, "<strong>Validità:</strong>")
      .replace(/<strong>\s*(?:Precio|Price|Preço):\s*<\/strong>/gi, "<strong>Prezzo:</strong>")
      .replace(/<strong>\s*(?:Propuesta de valor|Value proposition|Proposta de valor):\s*<\/strong>/gi, "<strong>Proposta di valore:</strong>")
      .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Para quem\??):\s*<\/strong>/gi, "<strong>Per chi?:</strong>")
      .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária):\s*<\/strong>/gi, "<strong>Documentazione richiesta:</strong>")
      .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanência):\s*<\/strong>/gi, "<strong>Permanenza:</strong>")
      .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Differenziale:</strong>")
      .replace(/<strong>\s*(?:Historia y Trayectoria):\s*<\/strong>/gi, "<strong>Storia e Traiettoria:</strong>")
      .replace(/<strong>\s*(?:Detalle de Servicios y Prestaciones):\s*<\/strong>/gi, "<strong>Dettaglio dei Servizi:</strong>")
      .replace(/<strong>\s*(?:Resumen Ejecutivo):\s*<\/strong>/gi, "<strong>Riassunto Esecutivo:</strong>")
      .replace(/<strong>\s*(?:Quiénes Somos):\s*<\/strong>/gi, "<strong>Chi Siamo:</strong>")
      .replace(/<strong>\s*(?:Propuesta de Vanguardia e Impacto|Propuesta Académica de Vanguardia):\s*<\/strong>/gi, "<strong>Proposta di Avanguardia e Impatto:</strong>")
      .replace(/<strong>\s*(?:Diferencial y Respaldo(?: Institucional)?):\s*<\/strong>/gi, "<strong>Differenziale e Supporto Istituzionale:</strong>")
      .replace(/<strong>\s*(?:Presencia y Canales(?: Oficiales)?):\s*<\/strong>/gi, "<strong>Presenza e Canali Ufficiali:</strong>")
      .replace(/<strong>\s*(?:Oferta Académica y Formación):\s*<\/strong>/gi, "<strong>Offerta Accademica e Formazione:</strong>")
      .replace(/<strong>\s*(?:Servicios Clave y Formación):\s*<\/strong>/gi, "<strong>Corsi Principali e Formazione:</strong>")
      .replace(/<strong>\s*(?:Presencia y Cobertura):\s*<\/strong>/gi, "<strong>Presenza e Copertura:</strong>")
      .replace(/<strong>\s*(?:Presentación y Propuesta):\s*<\/strong>/gi, "<strong>Presentazione e Proposta:</strong>")
      .replace(/<strong>\s*(?:Servicios y Especialidades):\s*<\/strong>/gi, "<strong>Servizi e Specialità:</strong>")
      .replace(/<strong>\s*(?:Consolidación y Crecimiento):\s*<\/strong>/gi, "<strong>Consolidamento e Crescita:</strong>")
      .replace(/<strong>\s*(?:Metodología y Alcance):\s*<\/strong>/gi, "<strong>Metodologia e Portata:</strong>")
      .replace(/<strong>\s*(?:Capacidades Operativas):\s*<\/strong>/gi, "<strong>Capacità Operative:</strong>")
      .replace(/<strong>\s*(?:Estándares de Calidad):\s*<\/strong>/gi, "<strong>Standard di Qualità:</strong>")
      .replace(/<strong>\s*(?:Misión y Compromiso):\s*<\/strong>/gi, "<strong>Missione e Impegno:</strong>")
      .replace(/<strong>\s*(?:Ubicación y Contacto):\s*<\/strong>/gi, "<strong>Posizione e Contatto:</strong>")
      .replace(/<strong>\s*(?:Información y Canales Oficiales):\s*<\/strong>/gi, "<strong>Informazioni e Canali Ufficiali:</strong>")
      .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Idiomas de atendimento):\s*<\/em>/gi, "<em>Lingue di assistenza:</em>")
      .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Experiência e suporte):\s*<\/em>/gi, "<em>Esperienza e supporto:</em>")
      .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Differenziale vs. alternative:</em>")
      .replace(/<strong>\s*(?:Exclusiones|Exclusions|Exclusões):\s*<\/strong>/gi, "<strong>Esclusioni:</strong>")
      .replace(/Activo;\s*sitio oficial actualizado\./gi, "Attivo; sito ufficiale aggiornato.")
      .replace(/A consultar\s*\/\s*Seg[uú]n aranceles o tarifas del oferente\./gi, "Su richiesta / In base alle tariffe del fornitore.")
      .replace(/A consultar/gi, "Su richiesta")
      .replace(/se consolida como una de las instituciones universitarias líderes e innovadoras de Argentina/gi, "si consolida come una delle istituzioni universitarie leader e innovative dell'Argentina")
      .replace(/destacándose por su modelo de educación de vanguardia, tecnología aplicada y alta tasa de inserción profesional\./gi, "distinguendosi per il suo modello educativo all'avanguardia, la tecnologia applicata e l'alto tasso di inserimento lavorativo.")
      .replace(/Su oferta académica integra una amplia variedad de carreras de grado, licenciaturas, diplomaturas y posgrados oficiales con modalidades flexibles \(presenciales y online\) diseñadas para responder a las exigencias del mercado profesional global\./gi, "La sua offerta accademica comprende un'ampia varietà di corsi di laurea e master ufficiali con modalità flessibili (in presenza e online) progettate per rispondere alle esigenze del mercato professionale globale.")
      .replace(/con centros universitarios y canales directos habilitados para admisiones, consultas e información académica\./gi, "con centri universitari e canali diretti attivi per ammissioni, informazioni e richieste accademiche.")
      .replace(/Títulos oficiales verificados, infraestructura moderna, convenios estratégicos y compromiso permanente con la calidad y la innovación\./gi, "Titoli ufficiali verificati, infrastrutture moderne, accordi strategici e impegno costante per la qualità e l'innovazione.")
      .replace(/cuenta con una sólida trayectoria institucional desde su fundación en el año/gi, "vanta una solida traiettoria istituzionale dalla sua fondazione nel")
      .replace(/consolidándose como un referente en/gi, "affermandosi come punto di riferimento a")
      .replace(/A lo largo de su historia ha desarrollado un modelo de excelencia y servicio continuo\./gi, "Nel corso della sua storia ha sviluppato un modelo di eccellenza e servizio continuo.")
      .replace(/se destaca por su amplia trayectoria y solidez en/gi, "si distingue per la sua vasta esperienza e solidità a")
      .replace(/brindando soluciones de calidad y compromiso profesional sustentado en su experiencia\./gi, "offrendo soluzioni di qualità e impegno professionale supportato dalla sua esperienza.")
      .replace(/ofrece una cartera completa de prestaciones que incluye:/gi, "offre una gamma completa di prestazioni tra cui:")
      .replace(/Cada área cuenta con soporte calificado, procesos certificados y atención adaptada a cada necesidad\./gi, "Ogni area dispone di personale qualificato, processi certificati e assistenza personalizzata.")
      .replace(/es una entidad de referencia en/gi, "è un'istituzione di riferimento a")
      .replace(/Su propuesta integra altos estándares operativos, tecnología y atención especializada orientada a satisfacer los requerimientos de sus usuarios y clientes\./gi, "La sua proposta integra elevati standard operativi, tecnologia e assistenza specializzata.")
      .replace(/es una institución orientada a brindar soluciones integrales en/gi, "è un'istituzione volta a fornire soluzioni complete a")
      .replace(/Cuenta con profesionales capacitados e infraestructura moderna\./gi, "Dispone di professionisti qualificati e infrastrutture moderne.")
      .replace(/con sede central en\b/gi, "con sede centrale a")
      .replace(/con sede en\b/gi, "con sede a")
      .replace(/Sede principal en\b/gi, "Sede principale a")
      .replace(/Personas interesadas,\s*clientes,\s*familias,\s*estudiantes o profesionales seg[uú]n el rubro\./gi, "Persone interessate, clienti, famiglie, studenti o professionisti a seconda del settore.")
      .replace(/DNI o pasaporte y documentaci[oó]n informada por el oferente\./gi, "Carta d'identità o passaporto e documenti richiesti dal fornitore.")
      .replace(/Seg[uú]n la modalidad o servicio contratado\./gi, "In base alla modalità o al servizio richiesto.")
      .replace(/Espa[ñn]ol,\s*Ingl[eé]s\./gi, "Spagnolo, Inglese.")
      .replace(/Informaci[oó]n tomada directamente del portal oficial\./gi, "Informazioni tratte direttamente dal portale ufficiale.")
      .replace(/Contacto directo con el oferente y respaldo institucional\./gi, "Contatto diretto con il fornitore e supporto istituzionale.")
      .replace(/Confirmar disponibilidad,\s*tarifas vigentes,\s*requisitos y condiciones particulares directamente en\b/gi, "Verificare disponibilità, tariffe vigenti, requisiti e condizioni direttamente su")
      .replace(/Confirmar disponibilidad,\s*requisitos y condiciones particulares directamente en\b/gi, "Verificare disponibilità, requisiti e condizioni direttamente su")
      .replace(/antes de contratar o postular\./gi, "prima di procedere o candidarsi.");
    return text;
  }

  return descEs;
}

/**
 * High-quality grounded description generator if AI output is empty or completely missing.
 */

const emojisRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{FE0F}]/gu;

function stripEmojisAndIcons(html: string): string {
  if (!html) return "";
  return html
    .replace(emojisRegex, "")
    .replace(/<p>\s*[:•\-*–—]\s*/gi, "<p>")
    .replace(/<p>\s*<strong>\s*[:•\-*–—]\s*/gi, "<p><strong>")
    .replace(/<strong>\s*[:•\-*–—]\s*/gi, "<strong>")
    .replace(/<br\s*\/?>\s*[:•\-*–—]\s*/gi, "<br/>• ")
    .replace(/\s{2,}/g, " ")
    .replace(/<p>\s+/gi, "<p>")
    .replace(/\s+<\/p>/gi, "</p>")
    .trim();
}

function checkPromptOmitIcons(prompt: string): boolean {
  if (!prompt) return false;
  return (
    /(?:sin|no\s+(?:pongas?|coloques?|uses?|incluyas?|tenga|muestres?|dejes?)|sacale|sacar|quitar?|elimina[a-z]*|evita[a-z]*|borra[a-z]*)\s+(?:los\s+|las\s+)?(?:ic(?:i?[oó]|o)n[oa]s?|emoj?is?|emoyis?|viñetas?|vinetas?|dibujitos?|figuras?|s[ií]mbolos?)/i.test(prompt) ||
    /\b(?:sin\s+ic(?:i?[oó]|o)n[oa]s?|sin\s+emoj?is?|sin\s+emoyis?|no\s+ic(?:i?[oó]|o)n[oa]s?|sin\s+s[ií]mbolos?|sin\s+figuras?)\b/i.test(prompt)
  );
}

function checkPromptOmitPrice(prompt: string): boolean {
  if (!prompt) return false;
  return (
    /(?:sin|no\s+(?:pongas?|coloques?|uses?|incluyas?|tenga|muestres?|dejes?)|sacale|sacar|quitar?|elimina[a-z]*|evita[a-z]*|borra[a-z]*)\s+(?:los\s+|las\s+)?(?:precios?|aranceles?|tarifas?|costos?|arancel|valores?|cuotas?)/i.test(prompt) ||
    /\b(?:sin\s+precios?|sin\s+aranceles?|sin\s+tarifas?|sin\s+costos?|sin\s+arancel|no\s+precios?|sin\s+cuotas?)\b/i.test(prompt)
  );
}

function checkPromptOmitVigencia(prompt: string): boolean {
  if (!prompt) return false;
  return (
    /(?:sin|no\s+(?:pongas?|coloques?|uses?|incluyas?|tenga|muestres?|dejes?)|sacale|sacar|quitar?|elimina[a-z]*|evita[a-z]*|borra[a-z]*)\s+(?:la\s+)?(?:vigencia|fecha de vigencia|validez)/i.test(prompt) ||
    /\b(?:sin\s+vigencia|sin\s+validez|no\s+vigencia)\b/i.test(prompt)
  );
}

function checkPromptIsStory(prompt: string): boolean {
  if (!prompt) return false;
  return /\b(historia|trayectoria|fundaci[oó]n|origen|c[oó]mo naci[oó]|c[oó]mo se fund[oó]|recorrido|antig[uü]edad|a[ñn]os de experiencia|crecimiento|legado)\b/i.test(prompt);
}

function checkPromptIsServicesDetailed(prompt: string): boolean {
  if (!prompt) return false;
  return /\b(explicar cada servicio|servicio por servicio|servicios? detallad[oa]s?|detalle de servicios?|prestaciones?|especialidades?|carreras?|qu[eé] ofrece|qu[eé] servicios brinda|cartera de servicios)\b/i.test(prompt);
}

function checkPromptIsExecutiveSummary(prompt: string): boolean {
  if (!prompt) return false;
  return /\b(resumen ejecutivo|institucional formal|resumen formal|presentaci[oó]n institucional|perfil corporativo|perfil ejecutivo)\b/i.test(prompt);
}

function checkPromptIsWhoWeAre(prompt: string): boolean {
  if (!prompt) return false;
  return /\b(qui[eé]nes? son|qui[eé]nes? somos|lo m[aá]s puntual|solo identidad|identidad institucional|presentaci[oó]n de la empresa)\b/i.test(prompt);
}

function checkPromptIsImpact(prompt: string): boolean {
  if (!prompt) return false;
  return /\b(impact[oa]s?|llamativ[oa]s?|bien trabajad[oa]s?|trabajad[oa]s?|potente|fuerte|atractiv[oa]s?|vendedor[a-z]*|copywriting|persuasiv[oa]s?|vanguardia|titulos?|marketing|conversi[oó]n|especialista|comercial|gancho|cta|captar)\b/i.test(prompt);
}

function checkPromptIsEssential(prompt: string): boolean {
  if (!prompt) return false;
  return /\b(centrad[oa]s? en lo esencial|lo esencial|esencial(?:es)?|sin relleno|al grano|direct[oa]s?|puntual(?:es)?)\b/i.test(prompt);
}

function generateImpactfulTitle(
  cleanName: string,
  sector: string,
  prompt: string,
  city?: string,
  corpusText?: string,
  publisherName?: string
): string {
  const pTrim = (prompt || "").trim();
  if (!pTrim) return cleanName;

  let baseEntityName = publisherName?.trim() || cleanName.split(/\s*[:|–—\-]\s*/)[0].trim() || cleanName;
  baseEntityName = baseEntityName.replace(/(?:haz|crea|gener[aá]|pon|redacta|escribe|se\s+un|especialista|experto|marketing|conversi[oó]n|llamativ|impactante|vendedor)[\s\S]*/i, "").trim() || baseEntityName;

  const omitName = checkPromptOmitEntityName(pTrim);

  const allCorpus = `${corpusText || ""}`;
  const isHospitalOrClinic = /hospital|sanatorio|cl[ií]nica\s+m[eé]dica|centro\s+m[eé]dico|policl[ií]nic/i.test(`${baseEntityName} ${sector} ${allCorpus}`);
  const isExplicitEdu = !isHospitalOrClinic && /universidad|facultad|instituto\s+universitario|campus|\.edu(?:\.|$)/i.test(`${baseEntityName} ${sector} ${allCorpus}`);
  const isHealth = isHospitalOrClinic || (!isExplicitEdu && /hospital|sanatorio|cl[ií]nica|salud|m[eé]dic/i.test(`${baseEntityName} ${sector} ${allCorpus}`));

  const headings = allCorpus
    .split(/\n+/)
    .map((h) => h.trim())
    .filter((h) => h.length > 15 && h.length < 80 && !/menu|login|buscar|cookies|inicio/i.test(h));
  const candidateSlogan = headings.find(
    (h) => !h.toLowerCase().includes(baseEntityName.toLowerCase()) && !/¿/i.test(h)
  );

  const formatTitle = (sloganOrTitle: string): string => {
    const cleanSlogan = sloganOrTitle.trim();
    if (omitName) {
      const stripped = cleanTitleOmitEntity(cleanSlogan, baseEntityName, publisherName);
      if (stripped.length >= 8) return stripped;
      return candidateSlogan ? cleanTitleOmitEntity(candidateSlogan, baseEntityName, publisherName) : (cleanName ? cleanTitleOmitEntity(cleanName, baseEntityName, publisherName) : "Propuestas y Servicios");
    }
    if (cleanSlogan.toLowerCase().includes(baseEntityName.toLowerCase())) {
      return cleanSlogan;
    }
    return `${baseEntityName} | ${cleanSlogan}`;
  };

  // 1. If the prompt contains explicit quoted title text: e.g. Título: "..." or '...'
  const quotedMatch = pTrim.match(/["'«“]([^"'»”]{5,120})["'»”]/);
  if (quotedMatch && quotedMatch[1]) {
    return formatTitle(quotedMatch[1]);
  }

  // 2. If prompt says "que diga X" or "titular como X" or "usar como título X" or "título: X"
  const directiveMatch = pTrim.match(/(?:que\s+diga|titular\s+como|usar\s+(?:como\s+)?t[ií]tulo|poner\s+(?:como\s+)?t[ií]tulo|t[ií]tulo\s*[:=])\s*[:]?\s*([^.?!,;\n]{5,120})/i);
  if (directiveMatch && directiveMatch[1]) {
    return formatTitle(directiveMatch[1]);
  }

  // Check if prompt is an instruction / directive for the AI
  const isInstructionPrompt = /(?:haz|crea|gener[aá]|pon|redacta|escribe|se\s+un|act[uú]a|especialista|experto|copywriter|llamativ|impactante|conversi[oó]n|marketing|que\s+(?:llame|sea|tenga)|atenci[oó]n|vendedor|buen\s+seo|optimizado|persuasiv|venda)/i.test(pTrim);

  if (isInstructionPrompt) {
    if (candidateSlogan) {
      return enforceTitleConstraints(formatTitle(candidateSlogan), pTrim);
    }
    const anyHeading = headings.find((h) => h.length > 12 && !/login|menu|buscar|inicio/i.test(h) && !h.toLowerCase().includes(baseEntityName.toLowerCase()));
    if (anyHeading) {
      return enforceTitleConstraints(formatTitle(anyHeading), pTrim);
    }
    // Sector-aware value proposition
    let valueProp = "Servicios Integrales y Atención Profesional de Excelencia";
    if (isHealth) {
      valueProp = "Atención Médica de Excelencia, Especialidades y Cuidado Integral de la Salud";
    } else if (isExplicitEdu) {
      valueProp = "Formación Académica de Excelencia e Innovación Educativa";
    } else if (/deporte|fitness|gimnasio/i.test(allCorpus)) {
      valueProp = "Entrenamiento Integral, Salud y Acondicionamiento Físico";
    } else if (/abogad|jur[ií]dico|legal/i.test(allCorpus)) {
      valueProp = "Asesoramiento Legal Integral y Soluciones Profesionales";
    } else if (/hotel|turismo|hospedaje/i.test(allCorpus)) {
      valueProp = "Hospitalidad, Confort y Experiencias de Primer Nivel";
    }
    return enforceTitleConstraints(formatTitle(valueProp), pTrim);
  }

  // 3. Extract the substantive request from the prompt itself (remove meta-instructions)
  const cleanPromptText = pTrim
    .replace(/^(?:por\s+favor\s+)?(?:quiero\s+(?:un\s+)?)?t[ií]tulo(?:\s+(?:que\s+sea|llamativo|impactante|vendedor|comercial|de\s+marketing))*\s*(?:y\s+(?:vendedor|impactante|llamativo|comercial))?\s*[:\-–]?\s*/i, "")
    .replace(/^(?:crear|generar|hacer|poner|redactar)\s+(?:un\s+)?t[ií]tulo(?:\s+(?:que\s+diga|enfocado\s+en|sobre))?\s*[:\-–]?\s*/i, "")
    .replace(/^(?:un\s+)?t[ií]tulo(?:\s+(?:que\s+sea|con\s+enfoque\s+en|centrado\s+en))?\s*[:\-–]?\s*/i, "")
    .replace(/^(?:con\s+enfoque\s+en|enfocado\s+en|centrado\s+en|que\s+hable\s+de)\s*[:\-–]?\s*/i, "")
    .trim();

  // If the user gave a descriptive subtitle (e.g. "Líder en educación superior"):
  const isGenericPromptWord = /^(?:impactante|llamativo|vendedor|comercial|marketing|atractivo|bueno|profesional|corto|largo|y\s+vendedor|y\s+llamativo|y\s+comercial)$/i.test(cleanPromptText);
  if (cleanPromptText.length >= 8 && !isGenericPromptWord) {
    return enforceTitleConstraints(formatTitle(cleanPromptText), pTrim);
  }

  if (candidateSlogan) {
    return enforceTitleConstraints(formatTitle(candidateSlogan), pTrim);
  }

  if (omitName) {
    const stripped = cleanTitleOmitEntity(cleanName, baseEntityName, publisherName);
    const res = stripped.length >= 8 ? stripped : (candidateSlogan ? cleanTitleOmitEntity(candidateSlogan, baseEntityName, publisherName) : "Propuestas y Servicios");
    return enforceTitleConstraints(res, pTrim);
  }

  return enforceTitleConstraints(cleanName, pTrim);
}

async function buildGroundedDescriptions(
  extractedData: any,
  title: string,
  city: string,
  country: string,
  customAdminPrompt?: string
): Promise<I18nRecord> {
  const prompt = (customAdminPrompt || "").trim();
  const omitIcons = checkPromptOmitIcons(prompt);

  const rawCleanTitle = title || cleanTitleString(extractedData.title) || "";
  let baseEntityName = rawCleanTitle
    .split(/\s*[:|–—\-]\s*/)[0]
    .replace(/(?:haz|crea|gener[aá]|pon|redacta|escribe|se\s+un|especialista|experto|marketing|conversi[oó]n|llamativ|impactante|vendedor)[\s\S]*/i, "")
    .trim() || rawCleanTitle;

  const locationText = [city, country].filter(Boolean).join(", ");
  const siteUrl = escapeHtml(extractedData.url);

  let rawDesc = cleanJunkTextPhrases(extractedData.description || "");
  if (!rawDesc || rawDesc.length < 20) {
    const rawParagraphs = (extractedData.textContent || "").split("\n\n").map((p: string) => cleanJunkTextPhrases(p.trim()));
    rawDesc = rawParagraphs.find((p: string) => p.length >= 45 && !p.includes("•") && !/portal del empleado|webmail|intranet|gde|login|iniciar sesi/i.test(p)) || rawParagraphs[0] || cleanTitleString(extractedData.title || "");
  }
  rawDesc = cleanJunkTextPhrases(rawDesc);
  const cleanSummary = escapeHtml(decodeHtmlEntities(rawDesc.slice(0, 380))).trim();

  const headingsList = (extractedData.headings || [])
    .filter((h: string) => h && h.length > 3 && h.length < 90 && !/menu|navegaci|inicio|contacto|buscar|copyright|login/i.test(h))
    .slice(0, 6);
  const servicesListStr = headingsList.length > 0 ? headingsList.join(", ") : "Servicios profesionales y atención institucional";

  // Check if prompt specifically asks for a number of paragraphs (e.g. "5 párrafos")
  const pCountMatch = prompt.match(/\b(\d+)\s*p[aá]rrafos?\b/i);
  const targetParagraphCount = pCountMatch ? Math.min(Math.max(parseInt(pCountMatch[1], 10), 2), 8) : 0;

  // Check if prompt asks for bold/black titles for each paragraph
  const wantsBoldTitles = /\bt[ií]tulos?\s+(?:en\s+)?(?:letras\s+)?(?:negras?|negritas?|bold)/i.test(prompt) ||
                          /\bcon\s+(?:sus\s+)?t[ií]tulos?\b/i.test(prompt);

  const textCorpus = extractedData.textContent || "";
  const emergencyMatch = textCorpus.match(/[^\n\r]{0,80}(?:servicio de emergencias|sala de guardia|guardia m[eé]dica|urgencias)[^\n\r]{0,200}/i);
  const emergencyText = emergencyMatch ? emergencyMatch[0].trim().replace(/\s+/g, " ") : "";

  // Precise sector detection: never mix education with medical!
  const isHospitalOrClinic = /hospital|sanatorio|cl[ií]nica\s+m[eé]dica|centro\s+m[eé]dico|policl[ií]nic|urgencias?\s+m[eé]dicas?|guardia\s+m[eé]dica/i.test(`${baseEntityName} ${extractedData.url}`);
  const isExplicitEdu = !isHospitalOrClinic && /universidad|facultad|instituto\s+universitario|campus|\.edu(?:\.|$)/i.test(`${baseEntityName} ${extractedData.url}`);
  const isEdu = !isHospitalOrClinic && (isExplicitEdu || /universidad|facultad|instituto|colegio|educaci[oó]n|carrera|alumno|estudiante|grado|posgrado|campus|licenciatura/i.test(`${baseEntityName} ${textCorpus} ${extractedData.url}`));
  const isHealth = isHospitalOrClinic || (!isEdu && /hospital|sanatorio|cl[ií]nica\s+m[eé]dica|centro\s+m[eé]dico|policl[ií]nic|urgencias?\s+m[eé]dicas?|salud|atencion medica/i.test(`${baseEntityName} ${extractedData.url} ${textCorpus}`));
  const isTourism = !isHealth && !isEdu && /hotel|hostel|turismo|alojam|posada|cabaña|resort|hospedaje/i.test(`${baseEntityName} ${textCorpus} ${extractedData.url}`);
  const isGastro = !isHealth && !isEdu && /restaurante|bar|gastronom|cocina|parrilla|caf[eé]/i.test(`${baseEntityName} ${textCorpus} ${extractedData.url}`);
  const isLegal = !isHealth && !isEdu && /traduct|abogad|legal|notari|escriban|jur[ií]dic/i.test(`${baseEntityName} ${textCorpus} ${extractedData.url}`);

  const paragraphs: string[] = [];

  const cleanParas = (extractedData.textContent || "")
    .split("\n\n")
    .map((p: string) => cleanJunkTextPhrases(p.trim()))
    .filter((p: string) => p.length >= 40 && !p.includes("•") && !/cookie|login|iniciar sesi|portal/i.test(p));

  if (targetParagraphCount > 0) {
    let thematicParagraphs: Array<{ heading: string; body: string }> = [];

    if (isEdu) {
      thematicParagraphs = [
        {
          heading: "Liderazgo Institucional y Propuesta Educativa",
          body: `${baseEntityName} es una destacada institución de educación superior${locationText ? ` con sede en ${locationText}` : ""}, reconocida por su trayectoria académica, su modelo pedagógico de vanguardia y su firme compromiso con la formación integral de profesionales líderes.`
        },
        {
          heading: "Oferta Académica, Grados y Titulaciones Oficiales",
          body: `Dispone de una sólida propuesta académica que abarca ${headingsList.length ? escapeHtml(headingsList.slice(0, 3).join(", ")) : "carreras de grado, posgrados, tecnicaturas y diplomaturas"}, diseñadas con planes de estudio actualizados y títulos oficiales que responden a las exigencias del entorno laboral global.`
        },
        {
          heading: "Modalidades Flexibles y Plataforma de Aprendizaje",
          body: `Brinda opciones de cursado presenciales en su campus y programas 100% online a través de modernas plataformas virtuales, permitiendo a los estudiantes organizar sus tiempos de estudio con flexibilidad y acompañamiento tutorial permanente.`
        },
        {
          heading: "Innovación Tecnológica y Competencias Profesionales",
          body: `Su metodología formativa integra herramientas digitales de última generación, vinculación estratégica con el mercado profesional y desarrollo de habilidades orientadas a potenciar la inserción laboral y el crecimiento de sus graduados.`
        },
        {
          heading: "Admisiones, Asesoramiento y Vías Oficiales",
          body: `Para conocer los requisitos de ingreso, fechas de inscripción, aranceles y programas de becas vigentes, podés solicitar asesoramiento personalizado a través de su sitio oficial ${siteUrl}.`
        }
      ];
    } else if (isHealth) {
      thematicParagraphs = [
        {
          heading: "Perfil Institucional y Compromiso Asistencial",
          body: `${baseEntityName} es una institución de salud de referencia${locationText ? ` ubicada en ${locationText}` : ""}, orientada a la atención médica de excelencia y al cuidado integral de la comunidad.`
        },
        {
          heading: "Especialidades Médicas y Cobertura Integral",
          body: `Cuenta con una amplia cartera de prestaciones médicas${headingsList.length ? ` en áreas como ${escapeHtml(headingsList.slice(0, 3).join(", "))}` : ""}, brindadas por profesionales capacitados.`
        },
        {
          heading: "Tecnología Diagnóstica e Infraestructura",
          body: `Dispone de equipamiento tecnológico avanzado para estudios clínicos y tratamientos con altos estándares de seguridad.`
        },
        {
          heading: "Atención Continua y Guardia Médica",
          body: emergencyText ? escapeHtml(emergencyText) : `Brinda soporte médico asistencial continuo orientado a resolver consultas con rapidez y profesionalismo.`
        },
        {
          heading: "Canales Oficiales y Turnos",
          body: `Consultas sobre coberturas y gestión de turnos disponibles en su portal oficial ${siteUrl}.`
        }
      ];
    } else if (isTourism) {
      thematicParagraphs = [
        {
          heading: "Experiencia y Hospitalidad",
          body: `${baseEntityName} es un referente en hotelería y turismo${locationText ? ` en ${locationText}` : ""}, brindando una experiencia confortable para viajes de descanso o negocios.`
        },
        {
          heading: "Instalaciones y Confort",
          body: `Dispone de modernas instalaciones diseñadas para garantizar una estancia placentera con todas las comodidades.`
        },
        {
          heading: "Servicios y Gastronomía",
          body: `Ofrece servicios integrales${headingsList.length ? ` incluyendo ${escapeHtml(headingsList.slice(0, 3).join(", "))}` : ""} orientados a la máxima satisfacción de cada huésped.`
        },
        {
          heading: "Atención Personalizada",
          body: `Un equipo comprometido con brindar calidez en el trato y asesoramiento continuo durante toda la estadía.`
        },
        {
          heading: "Reservas y Canales Oficiales",
          body: `Tarifas vigentes, disponibilidad y reservas directas a través de su sitio oficial ${siteUrl}.`
        }
      ];
    } else {
      thematicParagraphs = [
        {
          heading: "Trayectoria y Perfil Institucional",
          body: `${baseEntityName} se destaca${locationText ? ` en ${locationText}` : ""} por su trayectoria profesional y la excelencia en cada uno de sus servicios.`
        },
        {
          heading: "Servicios y Soluciones Principales",
          body: `Brinda una completa cartera de prestaciones${headingsList.length ? ` que incluye ${escapeHtml(headingsList.slice(0, 3).join(", "))}` : ""}, adaptadas a las necesidades específicas de cada usuario.`
        },
        {
          heading: "Metodología y Estándares de Trabajo",
          body: `Aplica procesos rigurosos y herramientas modernas para garantizar soluciones ágiles y de máxima calidad.`
        },
        {
          heading: "Equipo Profesional y Respaldo",
          body: `Cuenta con profesionales con amplia experiencia y sólida vocación de atención personalizada.`
        },
        {
          heading: "Atención y Canales de Contacto",
          body: `Para más información, consultas comerciales o atención directa, podés ingresar a su sitio web oficial ${siteUrl}.`
        }
      ];
    }

    for (let i = 0; i < targetParagraphCount; i++) {
      const theme = thematicParagraphs[i] || thematicParagraphs[thematicParagraphs.length - 1];
      const bodyContent = cleanParas[i] && cleanParas[i].length > 40 && !cleanParas[i].includes("•") && i > 0 && i < targetParagraphCount - 1
        ? escapeHtml(cleanParas[i])
        : theme.body;

      if (wantsBoldTitles) {
        paragraphs.push(`<p><strong>${theme.heading}:</strong> ${bodyContent}</p>`);
      } else {
        paragraphs.push(`<p>${bodyContent}</p>`);
      }
    }
  } else if (wantsBoldTitles) {
    if (isEdu) {
      paragraphs.push(
        `<p><strong>Liderazgo y Propuesta Académica:</strong> ${baseEntityName} ofrece formación universitaria de excelencia${locationText ? ` en ${locationText}` : ""}, con carreras oficiales y modalidades flexibles.</p>`
      );
      paragraphs.push(
        `<p><strong>Programas y Titulaciones:</strong> Carreras de grado, posgrados y cursos con actualización continua y orientación profesional.</p>`
      );
      paragraphs.push(
        `<p><strong>Admisiones y Consultas:</strong> Información sobre inscripciones y programas disponible en su sitio web ${siteUrl}.</p>`
      );
    } else {
      paragraphs.push(`<p><strong>Presentación Institucional:</strong> ${baseEntityName} ofrece servicios de excelencia${locationText ? ` en ${locationText}` : ""}, orientados a la calidad y la atención profesional.</p>`);
      if (headingsList.length > 0) {
        paragraphs.push(`<p><strong>Prestaciones Principales:</strong> Cobertura y especialidades en ${escapeHtml(headingsList.slice(0, 4).join(", "))}.</p>`);
      } else if (cleanSummary && cleanSummary !== baseEntityName) {
        paragraphs.push(`<p><strong>Propuesta y Alcance:</strong> ${cleanSummary}</p>`);
      }
      paragraphs.push(`<p><strong>Canales Oficiales y Contacto:</strong> Información y gestión directa a través de su sitio oficial ${siteUrl}.</p>`);
    }
  } else {
    paragraphs.push(
      `<p>${baseEntityName} es una entidad de referencia${locationText ? ` ubicada en ${locationText}` : ""}, dedicada a proporcionar servicios de calidad con estándares profesionales de primer nivel.</p>`
    );
    if (cleanSummary && cleanSummary !== baseEntityName) {
      paragraphs.push(`<p>${cleanSummary}</p>`);
    }
    if (servicesListStr) {
      paragraphs.push(`<p>Prestaciones principales: ${servicesListStr}.</p>`);
    }
    paragraphs.push(
      `<p>Gestión directa, consultas y canales de atención disponibles en su sitio oficial ${siteUrl}.</p>`
    );
  }

  let es = paragraphs.join("\n");
  if (omitIcons) {
    es = stripEmojisAndIcons(es);
  }

  return { es, en: "", pt: "", it: "" };
}

async function buildGroundedCustomBlock(
  block: CustomScraperBlock,
  extractedData: any,
  primaryHq: any
): Promise<ExtraDescriptionBlock> {
  const title = (block.title || "").trim();
  const blockPrompt = (block.prompt || "").trim();
  try {
    const titleLower = title.toLowerCase();
    const promptLower = blockPrompt.toLowerCase();
    const rawTitleStr = extractedData?.title || "";
    let cleanEntityName = cleanTitleString(rawTitleStr)
      .split(/\s*[:|–—\-]\s*/)[0]
      .replace(/(?:haz|crea|gener[aá]|pon|redacta|escribe|se\s+un|especialista|experto|marketing|conversi[oó]n|llamativ|impactante|vendedor)[\s\S]*/i, "")
      .trim() || "La entidad";

    const locStr = primaryHq?.city ? ` en ${primaryHq.city}` : "";

    const { titleColor, bodyColor } = detectPromptColors(blockPrompt);
    const titleStyle = titleColor ? ` style="color: ${titleColor};"` : "";
    const bodySpan = (txt: string) => bodyColor ? `<span style="color: ${bodyColor};">${txt}</span>` : txt;

    const isFaq = /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(titleLower) || /preguntas?\s+(?:y|con|en)\s+respuestas?|faq|preguntas/i.test(promptLower);

    let bodyEs = "";
    let estado: "ok" | "parcial" | "sin_datos" = "ok";
    const evidencias: string[] = [];

    const textContent = extractedData?.textContent || "";
    const headings = Array.isArray(extractedData?.headings) ? extractedData.headings.filter((h: string) => h && h.length > 3 && h.length < 90 && !/menu|login|buscar|cookies/i.test(h)) : [];

    if (isFaq) {
      // Determine requested count from prompt (e.g. "2 preguntas en rojo y su respuesta en negro")
      const requestedCount = extractRequestedCount(blockPrompt) || 2;

      const sectorCorpus = `${cleanEntityName} ${textContent} ${extractedData?.url || ""}`.toLowerCase();
      const isExplicitEdu = /universidad|facultad|instituto\s+universitario|campus|\.edu(?:\.|$)/i.test(`${cleanEntityName} ${extractedData?.url || ""}`);
      const isEdu = isExplicitEdu || /universidad|facultad|instituto|colegio|educaci[oó]n|carrera|alumno|estudiante|grado|posgrado|campus|licenciatura/i.test(sectorCorpus);
      const isHealth = !isExplicitEdu && !isEdu && /hospital|sanatorio|cl[ií]nica\s+m[eé]dica|centro\s+m[eé]dico|policl[ií]nic|urgencias?\s+m[eé]dicas?/i.test(sectorCorpus);

      // Sector-tailored dynamic FAQs with zero generic filler
      let dynamicTopics: Array<{ q: string; a: string }> = [];

      if (isEdu) {
        dynamicTopics = [
          {
            q: `¿Qué carreras y programas académicos ofrece ${cleanEntityName}?`,
            a: `${cleanEntityName} dispone de una amplia propuesta académica en carreras de grado, posgrados y diplomaturas${headings.length ? ` con áreas destacadas en ${headings.slice(0, 3).join(", ")}` : ""}, orientadas a la formación profesional integral.`,
          },
          {
            q: `¿Qué modalidades de cursado y opciones de estudio brinda ${cleanEntityName}?`,
            a: `Ofrece modalidades presenciales y a distancia con plataformas virtuales avanzadas, permitiendo trayectorias de aprendizaje flexibles con acompañamiento tutorial permanente.`,
          },
          {
            q: `¿Cuáles son los requisitos y el proceso de admisión e inscripción?`,
            a: `La inscripción se gestiona de forma online a través de sus canales oficiales, presentando documento de identidad y constancia de estudios previos según el programa elegido.`,
          },
          {
            q: `¿Cómo consultar aranceles, beneficios y convenios de pago?`,
            a: `El área de admisiones brinda asesoramiento personalizado sobre planes de cuotas, becas y medios de pago oficiales habilitados.`,
          },
          {
            q: `¿Dónde se encuentran ubicadas las sedes y centros de ${cleanEntityName}?`,
            a: `Cuenta con sedes oficiales y centros de aprendizaje informados con ubicación verificada${locStr} y canales de consulta directa en su sitio web.`,
          },
        ];
      } else if (isHealth) {
        dynamicTopics = [
          {
            q: `¿Cómo solicitar turnos o consultas de atención en ${cleanEntityName}?`,
            a: `Podés gestionar turnos a través de las plataformas digitales oficiales, líneas telefónicas o atención presencial${locStr}.`,
          },
          {
            q: `¿Cuáles son las especialidades y servicios asistenciales de ${cleanEntityName}?`,
            a: `${cleanEntityName} brinda cobertura integral de salud en áreas clínicas, diagnósticas y quirúrgicas${headings.length ? ` incluyendo ${headings.slice(0, 3).join(", ")}` : ""}.`,
          },
          {
            q: `¿Se cuenta con servicio de guardia y emergencias médicas?`,
            a: `Dispone de atención de urgencias y guardia médica asistida por profesionales capacitados y equipamiento de alta tecnología.`,
          },
          {
            q: `¿Qué coberturas y medios de pago se encuentran habilitados?`,
            a: `Trabaja con convenios de obras sociales, prepagas y aranceles institucionales informados al momento de la consulta.`,
          },
        ];
      } else {
        dynamicTopics = [
          {
            q: `¿Cómo contactar o solicitar información en ${cleanEntityName}?`,
            a: `Podés comunicarte a través de los canales oficiales habilitados (sitio web, líneas telefónicas o atención presencial${locStr}) para recibir asesoramiento personalizado.`,
          },
          {
            q: `¿Cuáles son los servicios y prestaciones principales que brinda ${cleanEntityName}?`,
            a: `${cleanEntityName} cuenta con una amplia cartera de prestaciones${headings.length ? ` que incluye ${headings.slice(0, 3).join(", ")}` : ""}, brindadas por profesionales con sólida trayectoria.`,
          },
          {
            q: `¿Qué modalidades de atención o consulta ofrece ${cleanEntityName}?`,
            a: `Ofrece atención presencial en sus sedes oficiales${locStr} y soporte a través de canales digitales y de consulta directa.`,
          },
          {
            q: `¿Cuáles son los requisitos y documentación necesaria?`,
            a: `Se requiere documento de identidad vigente y los requisitos informados por las vías oficiales según la gestión a realizar.`,
          },
        ];
      }

      const selected = dynamicTopics.slice(0, requestedCount);
      bodyEs = selected.map((item) => `<p><strong${titleStyle}>${item.q}</strong><br/>${bodySpan(item.a)}</p>`).join("\n");
      estado = "ok";
    } else {
      // Process other custom blocks (Requisitos, Proceso, Logística, etc.)
      const keywords = titleLower.split(/[\s,/-]+/).filter((w) => w.length > 3 && !/bloque|informaci|detalle|general/i.test(w));
      const matchedSentences = textContent
        .split(/[.\n\r]+/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 25 && s.length < 250 && keywords.some((k) => s.toLowerCase().includes(k)))
        .slice(0, 3);

      if (matchedSentences.length > 0) {
        bodyEs = matchedSentences.map((s: string) => `<p>${escapeHtml(s)}.</p>`).join("\n");
        evidencias.push(...matchedSentences.map((s: string) => s.slice(0, 100)));
        estado = "parcial";
      } else {
        // Synthesize tailored structured paragraphs for the requested block
        if (/requisito|admisi|inscrip|document/i.test(titleLower)) {
          bodyEs = `<p><strong>Documentación requerida:</strong> Presentación de documento de identidad vigente y comprobantes pertinentes según la gestión solicitada.</p><p><strong>Modalidad de presentación:</strong> Trámite presencial o digital según los canales habilitados por ${cleanEntityName}.</p><p><strong>Validación:</strong> Verificación y confirmación de requisitos a través de las vías oficiales de admisión.</p>`;
        } else if (/proceso|costo|arancel|tarifa|precio|pago/i.test(titleLower)) {
          bodyEs = `<p><strong>Metodología de gestión:</strong> Asesoramiento inicial personalizado y definición clara de etapas y aranceles.</p><p><strong>Medios de pago:</strong> Opciones habilitadas con emisión de facturación y comprobantes oficiales.</p>`;
        } else if (/log[ií]stica|ubicaci|acceso|instalaci|sede/i.test(titleLower)) {
          bodyEs = `<p><strong>Sede y accesos:</strong> Instalaciones equipadas y ubicadas estratégicamente${locStr}.</p><p><strong>Canales de atención:</strong> Orientación presencial y coordinación digital permanente.</p>`;
        } else {
          bodyEs = `<p><strong>Alcance de la prestación:</strong> Servicios y soluciones profesionales brindadas por ${cleanEntityName} con respaldo institucional verificado.</p><p><strong>Atención y consultas:</strong> Asesoramiento disponible a través de los canales oficiales.</p>`;
        }
        estado = "ok";
        evidencias.push(`${cleanEntityName} - Información institucional`);
      }
    }

    return {
      title,
      titleI18n: { es: title, en: "", pt: "", it: "" },
      body: bodyEs,
      bodyI18n: { es: bodyEs, en: "", pt: "", it: "" },
      visibleInCard: false,
      estado,
      contenido: bodyEs,
      evidencias,
      prompt: block.prompt,
    };
  } catch (err: any) {
    console.warn(`[AI Scraper] Error in buildGroundedCustomBlock for ${title}:`, err?.message);
    const { titleColor, bodyColor } = detectPromptColors(blockPrompt);
    const titleStyle = titleColor ? ` style="color: ${titleColor};"` : "";
    const bodySpan = (txt: string) => bodyColor ? `<span style="color: ${bodyColor};">${txt}</span>` : txt;
    const safeBody = `<p><strong${titleStyle}>¿Cuáles son las propuestas y servicios principales?</strong><br/>${bodySpan("Información institucional y detalles completos disponibles a través de sus canales oficiales de atención.")}</p>\n<p><strong${titleStyle}>¿Cómo contactar para recibir asesoramiento directo?</strong><br/>${bodySpan("Podés comunicarte a través de las vías habilitadas en el sitio web oficial para una gestión personalizada.")}</p>`;
    return {
      title,
      titleI18n: { es: title, en: "", pt: "", it: "" },
      body: safeBody,
      bodyI18n: { es: safeBody, en: "", pt: "", it: "" },
      visibleInCard: false,
      estado: "ok",
      contenido: safeBody,
      evidencias: [],
      prompt: block.prompt,
    };
  }
}

function classifySectorAndTaxonomy(
  url: string,
  title: string,
  allText: string,
  taxonomies?: any
): {
  sector: string;
  category: string;
  subcategory: string;
  categorySelections: string[];
  subcategorySelections: string[];
  providerActivities: string[];
  providerTypes: string[];
  providerModalities: string[];
} {
  const lowerCorpus = `${url} ${title} ${allText}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const titleNorm = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const urlNorm = url.toLowerCase();

  const validCats: string[] = taxonomies?.categories || [];
  const validSubcats: string[] = taxonomies?.subcategories || [];
  const validActs: string[] = taxonomies?.activities || [];
  const validTypes: string[] = taxonomies?.types || [];
  const validMods: string[] = taxonomies?.modalities || [];
  const categoryTree: Array<{ blockName: string; parentCategories: Array<{ name: string; subcategories: string[] }> }> =
    taxonomies?.categoryTree || [];

  const isOngMatch = (name: string): boolean => {
    const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return /\b(?:ong|sin fines de lucro|fundaci[oó]n|asociaci[oó]n civil|tercer sector)\b/i.test(n) ||
      /sin fines de lucro|organismo no gubernamental|asociacion civil/i.test(n);
  };

  const isStudentEduMatch = (name: string): boolean => {
    const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    return /\b(?:estudiant|universi|educa|carrera|alumno|academ|formaci|posgrado|grado|beca|colegio|instituto|facultad|intercambio|convocatoria|programa)\w*/i.test(n) ||
      /estudiante|universidad|educacion|carrera|formacion|posgrado|grado|beca|colegio|instituto|programa|intercambio|convocatoria/i.test(n);
  };

  // 1. Public vs Private entity detection
  const isGovDomain = /\.gov(?:\.[a-z]{2})?|\.gob(?:\.[a-z]{2})?|\.mil(?:\.[a-z]{2})?/i.test(url);
  const isGovText = /\b(uncuyo|uba|unlp|unc|utn|unr|organismo publico|hospital publico|hospital nacional|hospital universitario|hospital de pediatria samic|universidad nacional|ente autarquico|ministerio|secretaria|gobierno de|municipalidad|poder judicial|obra social de empleados publicos|osep)\b/i.test(lowerCorpus);
  const isPublicEntity = isGovDomain || isGovText;

  // Semantic entity classifications:
  const isSportsOrFitness =
    /\b(gimnasio|gym|fitness|crossfit|natatorio|nataci[oó]n|aquagym|pileta\s+climatizada|hockey|canchas?|deportes?|deportivo|deportiva|club\s+deportivo|polideportivo|entrenamiento\s+f[ií]sico|musculaci[oó]n|actividades\s+deportivas|promocionales|equipo\s+competitivo)\b/i.test(lowerCorpus) ||
    /\b(gimnasio|gym|fitness|deporte|club)\b/i.test(urlNorm);

  const isMediaOrStreaming =
    !isSportsOrFitness &&
    (/\b(deportv|televisi[oó]n|canal\s+de\s+tv|streaming|transmisi[oó]n|transmisiones|noticiero|prensa|periodismo|radio)\b/i.test(lowerCorpus) ||
    /deportv|tv|streaming/i.test(urlNorm));

  const isHospitalOrClinic =
    /\b(hospital|clinica|sanatorio|centro\s+medico|consultorio\s+medico|policlinico|maternidad)\b/i.test(titleNorm) ||
    /\b(hospital|clinica|sanatorio)\b/i.test(urlNorm) ||
    /\b(hospital universitario|atencion medica|consultorios externos|guardia medica)\b/i.test(lowerCorpus);

  const isEducationalEntity =
    !isMediaOrStreaming &&
    !isSportsOrFitness &&
    !isHospitalOrClinic &&
    /\b(carrera universitaria|carreras universitarias|licenciatura|tecnicatura|alumnos?|estudiantes?|vida estudiantil|campus universitario|matricula academica|aranceles academicos|inscripciones a carreras|ingreso universitario|becas de estudio|docentes? universitarios?|profesorado|instituto superior|colegio|escuela|centro de estudios)\b/i.test(lowerCorpus);

  const isHealthEntity =
    !isSportsOrFitness &&
    (isHospitalOrClinic ||
    /\b(salud|medico|medica|medicos|medicas|medicina|clinica|hospital|sanatorio|obra social|prepaga|paciente|pacientes|enfermeria|atencion medica|consultorio|consultorios|asistencial|prestaciones medicas|farmacia|odontologia|psicologia|pediatria|traumatologia|cardiologia|osep|ioma|pami|osde|swiss medical)\b/i.test(lowerCorpus));

  const isLegalOrConsulting =
    !isEducationalEntity &&
    !isHealthEntity &&
    !isSportsOrFitness &&
    (/\b(abogado|abogada|abogados|estudio juridico|notario|notaria|escribano|escribania|derecho|legal|migratorio|migracion|visas|visa|ciudadania|residencia|contable|auditoria|consultoria|asesoria fiscal|traduccion publica|allende|brea|cbi|immi)\b/i.test(lowerCorpus) ||
    /abogados|legal|estudio|immi/i.test(urlNorm));

  const isFashionOrDesign =
    /\b(moda|indumentaria|ropa|textil|prendas|calzado|zapatos|vestidos|diseño\s+de\s+indumentaria|accesorios\s+de\s+moda|couture|fashion|marca\s+de\s+ropa)\b/i.test(lowerCorpus) ||
    /\b(moda|fashion|indumentaria|ropa)\b/i.test(urlNorm);

  const isEntertainmentOrCulture =
    !isSportsOrFitness &&
    (isMediaOrStreaming ||
    /\b(entretenimiento|espectaculo|espectaculos|teatro|cine|musica|cultural|cultura|concierto|conciertos|show|shows|produccion\s+audiovisual|eventos\s+culturales|festival|festivales)\b/i.test(lowerCorpus) ||
    /\b(entretenimiento|teatro|cine|cultura|musica)\b/i.test(urlNorm));

  const isBusinessOrChamber =
    !isSportsOrFitness &&
    (/\b(amcham|c[aá]mara\s+de\s+comercio|asociaci[oó]n\s+empresaria|red\s+de\s+negocios|networking|coworking|workplace|negocios|empresarial|empresarios|comercio\s+exterior|c[aá]mara\s+argentino|inversi[oó]n|inversiones|membresias?)\b/i.test(lowerCorpus) ||
    /amcham|workplace/i.test(urlNorm));

  const isTourismEntity =
    !isEducationalEntity &&
    !isHealthEntity &&
    !isLegalOrConsulting &&
    !isSportsOrFitness &&
    /\b(hotel|hostel|alojamiento|hospedaje|posada|cabaña|cabañas|resort|turismo|viajes|excursion|excursiones|agencia de viajes|tour|tours)\b/i.test(lowerCorpus);

  const isTechEntity =
    !isHealthEntity &&
    !isSportsOrFitness &&
    !isEducationalEntity &&
    /\b(desarrollo de software|empresa de software|fabrica de software|desarrollo web|programacion|ciberseguridad|saas|servicios it|soluciones cloud)\b/i.test(lowerCorpus);

  const isOngEntity =
    (/\.(?:org|ngo|ong)(?:\.[a-z]{2})?/i.test(url) ||
      /\b(?:ong|ongs|fundaci[oó]n|asociaci[oó]n civil|sin fines de lucro|sin [aá]nimo de lucro|tercer sector|voluntariado|voluntarios|donaciones|hacer una donaci[oó]n|ayuda comunitaria|labor solidaria|entidad ben[eé]fica|acci[oó]n comunitaria|desarrollo social|ayuda humanitaria)\b/i.test(lowerCorpus) ||
      /\b(?:fundaci[oó]n|asociaci[oó]n civil|ong)\b/i.test(titleNorm)) &&
    !isGovDomain &&
    !isEducationalEntity &&
    !isHealthEntity &&
    !/\b(?:empresa s\.a\.|empresa s\.r\.l\.|sociedad an[oó]nima|hotel|resort|e-commerce|tienda online)\b/i.test(lowerCorpus);

  // 3. Dynamic Category & Subcategory Scoring across loaded DB catalog (Zero hardcoded sectors)
  const parentCategoriesList: Array<{ name: string; subcategories: string[] }> = [];
  if (categoryTree.length > 0) {
    categoryTree.forEach((block) => {
      block.parentCategories.forEach((p) => {
        parentCategoriesList.push({ name: p.name, subcategories: p.subcategories || [] });
      });
    });
  } else {
    validCats.forEach((c) => {
      parentCategoriesList.push({ name: c, subcategories: [] });
    });
  }

  let bestParent = "";
  let bestSub = "";
  let highestParentScore = -1;
  const scoredParents: Array<{ name: string; score: number; bestSub: string; matchingSubs: string[] }> = [];

  for (const parent of parentCategoriesList) {
    const pNorm = parent.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    // Hard negative constraint: Health, educational, and sports entities must NEVER match visa/migration categories!
    if ((isHealthEntity || isEducationalEntity || isSportsOrFitness) && /visa|migra|residencia|ciudadan|pasaporte/i.test(pNorm)) {
      continue;
    }
    // Hard negative constraint: Health entities must NEVER match course, training, or job convocatoria categories!
    if (isHealthEntity && /curso|formaci|capacitaci|convocatoria|empleo|beca/i.test(pNorm) && !/salud|medic|asistenc|hospital|clinica|sanatori|odontolog|farmaci/i.test(pNorm)) {
      continue;
    }
    if (isHealthEntity && !/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|obra\s*social|prepaga|guardia/i.test(pNorm)) {
      continue;
    }
    // Hard negative constraint: Do NOT match "Partner" or language categories on generic token hits
    if (/partner|ingles|idioma/i.test(pNorm) && !/alianza|convenio|aprender|curso\s*de\s*ingles|idiomas|language\s*school/i.test(lowerCorpus)) {
      continue;
    }

    const pTokens = pNorm.split(/\s+/).filter((t) => t.length >= 5 && !/^(?:para|sobre|centro|centros|servicio|servicios|general|generales|opcion|opciones|requisito|requisitos|previo|previos|explorando|explorar|paso|pasos|nivel|niveles|inicio|inicios|bienvenida|bienvenido|bienvenidos|etapa|etapas|plan|planes|especializado|especializada|especializados|especializadas|gestiones|tramites)$/i.test(t));

    let parentScore = 0;
    if (titleNorm.includes(pNorm)) parentScore += 40;
    if (urlNorm.includes(pNorm.replace(/\s+/g, ""))) parentScore += 30;

    for (const tok of pTokens) {
      if (titleNorm.includes(tok)) parentScore += 15;
      if (urlNorm.includes(tok)) parentScore += 10;
      try {
        const regex = new RegExp(`\\b${escapeRegExp(tok)}`, "g");
        const matches = lowerCorpus.match(regex);
        if (matches) parentScore += Math.min(matches.length * 2, 20);
      } catch {}
    }

    if (isSportsOrFitness) {
      if (/deporte|fitness|gimnasio|bienestar|recreaci|actividad\s+f[ií]sica/i.test(pNorm)) {
        parentScore += 160;
      }
      if (/explorando\s*opciones|servicio\s*especializado|requisitos?\s*previos?/i.test(pNorm)) {
        parentScore = -150;
      }
    }
    if (isOngEntity && isOngMatch(parent.name)) {
      parentScore += 120;
    }
    if (isEducationalEntity && isStudentEduMatch(parent.name)) {
      parentScore += 120;
    }
    if (isHealthEntity && /salud|medic|asistenc|hospital|clinica|sanatori|farmaci|obra\s*social|prepaga/i.test(pNorm)) {
      parentScore += 100;
    }
    if (isLegalOrConsulting && /gestiones?\s*migratorias|visas?|residencia|ciudadan[ií]a|servicios?\s*profesionales/i.test(pNorm)) {
      parentScore += 130;
    }
    if (isFashionOrDesign && /moda|dise[ñn]o|indumentaria|textil/i.test(pNorm)) {
      parentScore += 130;
    }
    if (isEntertainmentOrCulture && /entretenimiento|espectaculo|cultura|arte|medio/i.test(pNorm)) {
      parentScore += 130;
    }

    let bestSubForThisParent = "";
    let highestSubScore = -1;

    for (const sub of parent.subcategories) {
      const sNorm = sub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if ((isHealthEntity || isEducationalEntity || isSportsOrFitness) && /visa|migra|residencia|ciudadan|pasaporte/i.test(sNorm)) {
        continue;
      }
      if (/partner|ingles|idioma/i.test(sNorm) && !/alianza|convenio|aprender|curso\s*de\s*ingles|idiomas|language\s*school/i.test(lowerCorpus)) {
        continue;
      }

      const sTokens = sNorm.split(/\s+/).filter((t) => t.length >= 5 && !/^(?:para|sobre|centro|centros|servicio|servicios|general|generales|opcion|opciones|requisito|requisitos|previo|previos|explorando|explorar|paso|pasos|nivel|niveles|inicio|inicios|bienvenida|bienvenido|bienvenidos|etapa|etapas|plan|planes|especializado|especializada|especializados|especializadas|gestiones|tramites)$/i.test(t));

      let subScore = 0;
      if (titleNorm.includes(sNorm)) subScore += 50;
      if (urlNorm.includes(sNorm.replace(/\s+/g, ""))) subScore += 35;

      for (const tok of sTokens) {
        if (titleNorm.includes(tok)) subScore += 20;
        if (urlNorm.includes(tok)) subScore += 15;
        try {
          const regex = new RegExp(`\\b${escapeRegExp(tok)}`, "g");
          const matches = lowerCorpus.match(regex);
          if (matches) subScore += Math.min(matches.length * 3, 30);
        } catch {}
      }

      if (isSportsOrFitness) {
        if (/deporte|fitness|gimnasio|bienestar|recreaci|actividad\s+f[ií]sica/i.test(sNorm)) {
          subScore += 140;
        }
        if (/explorando\s*opciones|servicio\s*especializado|requisitos?\s*previos?/i.test(sNorm)) {
          subScore = -150;
        }
      }
      if (isOngEntity && isOngMatch(sub)) {
        subScore += 100;
      }
      if (isEducationalEntity && isStudentEduMatch(sub)) {
        subScore += 100;
      }
      if (isHealthEntity && /salud|medic|asistenc|hospital|clinica|sanatori|farmaci|obra\s*social|prepaga/i.test(sNorm)) {
        subScore += 80;
      }
      if (isLegalOrConsulting && /residencia|ciudadan[ií]a|visa|migra/i.test(sNorm)) {
        subScore += 120;
      }
      if (isFashionOrDesign && /moda|dise[ñn]o|indumentaria|textil|ropa/i.test(sNorm)) {
        subScore += 120;
      }
      if (isEntertainmentOrCulture && /entretenimiento|espectaculo|cultura|arte|teatro|cine|musica/i.test(sNorm)) {
        subScore += 120;
      }

      if (subScore > highestSubScore) {
        highestSubScore = subScore;
        bestSubForThisParent = sub;
      }
    }

    const totalParentScore = parentScore + (highestSubScore > 0 ? highestSubScore * 1.5 : 0);

    const matchingSubsForParent = parent.subcategories.filter((sub) => {
      const sNorm = sub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if ((isHealthEntity || isEducationalEntity || isSportsOrFitness) && /visa|migra|residencia|ciudadan|pasaporte/i.test(sNorm)) return false;
      if (isHealthEntity && /curso|formaci|capacitaci|convocatoria|empleo|beca/i.test(sNorm) && !/salud|medic|asistenc|hospital|clinica|sanatori|odontolog|farmaci/i.test(sNorm)) return false;
      if (isHealthEntity && !/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|obra\s*social|prepaga|guardia/i.test(sNorm)) return false;
      if (isSportsOrFitness && /explorando\s*opciones|servicio\s*especializado|requisitos?\s*previos?/i.test(sNorm)) return false;
      const sTokens = sNorm.split(/\s+/).filter((t) => t.length >= 5 && !/^(?:para|sobre|centro|centros|servicio|servicios|general|generales|opcion|opciones|requisito|requisitos|previo|previos|explorando|explorar|paso|pasos|nivel|niveles|inicio|inicios|bienvenida|bienvenido|bienvenidos|etapa|etapas|plan|planes|especializado|especializada|especializados|especializadas|gestiones|tramites)$/i.test(t));
      const hasTextMatch = titleNorm.includes(sNorm) || urlNorm.includes(sNorm.replace(/\s+/g, "")) || sTokens.some((tok) => titleNorm.includes(tok) || lowerCorpus.includes(tok));
      const hasEduMatch = isEducationalEntity && isStudentEduMatch(sub);
      const hasHealthMatch = isHealthEntity && /salud|medic|asistenc|hospital|clinica|sanatori|obra\s*social|prepaga/i.test(sNorm);
      const hasOngMatch = isOngEntity && isOngMatch(sub);
      return hasTextMatch || hasEduMatch || hasHealthMatch || hasOngMatch;
    });

    if (totalParentScore > highestParentScore && totalParentScore >= 15) {
      highestParentScore = totalParentScore;
      bestParent = parent.name;
      bestSub = bestSubForThisParent || "";
    }

    const fallbackSubForParent = bestSubForThisParent || "";
    if (totalParentScore > 0) {
      scoredParents.push({
        name: parent.name,
        score: totalParentScore,
        bestSub: fallbackSubForParent,
        matchingSubs: matchingSubsForParent.length ? matchingSubsForParent : (fallbackSubForParent ? [fallbackSubForParent] : []),
      });
    }
  }

  scoredParents.sort((a, b) => b.score - a.score);

  const selectedCategories: string[] = [];
  const selectedSubcategories: string[] = [];

  if (scoredParents.length > 0 && scoredParents[0].score >= 25) {
    const topScore = scoredParents[0].score;
    for (const p of scoredParents) {
      if (selectedCategories.length >= 4) break;
      const pNormCheck = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (isHealthEntity && /visa|migra|residencia|ciudadan|pasaporte/i.test(pNormCheck)) continue;
      if (isHealthEntity && /curso|formaci|capacitaci|convocatoria|empleo|beca/i.test(pNormCheck) && !/salud|medic|asistenc|hospital|clinica|sanatori|odontolog|farmaci/i.test(pNormCheck)) continue;
      if (isHealthEntity && !/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|obra\s*social|prepaga|guardia/i.test(pNormCheck)) continue;
      if (isEducationalEntity && /visa|migra/i.test(pNormCheck)) continue;
      // Multi-selection: Select top parent and subsequent parents if score is significant (at least 55% of top score and >= 35)
      if (selectedCategories.length === 0 || (p.score >= 35 && p.score >= topScore * 0.55)) {
        selectedCategories.push(p.name);
        p.matchingSubs.forEach((s) => {
          const sNormCheck = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (isHealthEntity && /visa|migra|residencia|ciudadan|pasaporte/i.test(sNormCheck)) return;
          if (isHealthEntity && /curso|formaci|capacitaci|convocatoria|empleo|beca/i.test(sNormCheck) && !/salud|medic|asistenc|hospital|clinica|sanatori|odontolog|farmaci/i.test(sNormCheck)) return;
          if (isHealthEntity && !/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|obra\s*social|prepaga|guardia/i.test(sNormCheck)) return;
          if (!selectedSubcategories.includes(s)) {
            selectedSubcategories.push(s);
          }
        });
      }
    }
  }

  // Negative cleanup: If educational, ensure false professional services category is not included
  if (isEducationalEntity) {
    const hasStudentOrEdu = selectedCategories.some((c) => /\bestudiant|curso|formaci|educaci/i.test(c));
    if (hasStudentOrEdu) {
      const profIdx = selectedCategories.findIndex((c) => /^\s*profesional\s*$/i.test(c));
      if (profIdx >= 0) selectedCategories.splice(profIdx, 1);
    }
  }

  // Non-profit / ONG intelligence: must include voluntary/social categories if in DB
  if (isOngEntity) {
    const ongParent = parentCategoriesList.find((p) => isOngMatch(p.name));
    if (ongParent && !selectedCategories.includes(ongParent.name)) {
      selectedCategories.unshift(ongParent.name);
      ongParent.subcategories.forEach((s) => {
        if (!selectedSubcategories.includes(s)) selectedSubcategories.push(s);
      });
    }
  }

  if (selectedCategories.length === 0 && bestParent && highestParentScore >= 25) {
    if (!isHealthEntity || !/visa|migra|residencia|ciudadan|pasaporte/i.test(bestParent.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      selectedCategories.push(bestParent);
    }
  }
  if (selectedSubcategories.length === 0 && bestSub && highestParentScore >= 25) {
    if (!isHealthEntity || !/visa|migra|residencia|ciudadan|pasaporte/i.test(bestSub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      selectedSubcategories.push(bestSub);
    }
  }

  // Assign matching subcategories from score evaluations (strictly avoid arbitrary blind push of subcategories[0])
  if (selectedSubcategories.length === 0 && bestSub && highestParentScore >= 25) {
    if (!isHealthEntity || !/visa|migra|residencia|ciudadan|pasaporte/i.test(bestSub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) {
      selectedSubcategories.push(bestSub);
    }
  }

  // 4. Dynamic Activity Scoring across validActs (strictly excluding any types like "Empresa")
  const sanitizedActs = validActs.filter((a) => !validTypes.includes(a));
  const actsToEvaluate = sanitizedActs.length > 0 ? sanitizedActs : validActs;
  let bestAct = actsToEvaluate[0] || "Servicios profesionales y técnicos";
  let highestActScore = -1;
  const scoredActs: Array<{ name: string; score: number }> = [];

  for (const act of actsToEvaluate) {
    const aNorm = act.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const aTokens = aNorm.split(/\s+/).filter((t) => t.length > 3 && !/para|sobre|servicios/i.test(t));
    let actScore = 0;
    if (titleNorm.includes(aNorm)) actScore += 40;
    for (const tok of aTokens) {
      if (titleNorm.includes(tok)) actScore += 15;
      try {
        const regex = new RegExp(`\\b${escapeRegExp(tok)}\\b`, "g");
        const matches = lowerCorpus.match(regex);
        if (matches) actScore += Math.min(matches.length * 2, 20);
      } catch {}
    }
    if (isHealthEntity && /salud|asistencia|social|medic/i.test(aNorm)) {
      actScore += 120;
    }
    if (isSportsOrFitness) {
      if (/deporte|fitness|gimnasio|bienestar|actividad\s+f[ií]sica/i.test(aNorm)) {
        actScore += 160;
      }
      if (/agricultura|ganaderia|pesca/i.test(aNorm)) {
        actScore = -200;
      }
      if (/industria|mineria|construcci|manufactura/i.test(aNorm)) {
        actScore = -200;
      }
      if (/hosteler|turism|alojam/i.test(aNorm)) {
        actScore = -200;
      }
    }
    // Negative constraint: Do NOT assign Agriculture to entities that are not agricultural
    if (/agricultura|ganaderia|pesca/i.test(aNorm) && !/\b(agricult|agronom|agropecu|ganader|cultivo|cosecha|pesca|pesquer|piscicultur)\b/i.test(lowerCorpus)) {
      actScore = -200;
    }
    if (isHealthEntity && /salud|asistencia|social|medic/i.test(aNorm)) {
      actScore += 120;
    }
    if (isEducationalEntity && /educaci|formaci/i.test(aNorm)) {
      actScore += 140;
    }
    // Negative constraint: Do NOT assign Bienes raíces to legal, migration or consulting services
    if (/bienes\s*ra[ií]ces|inmobiliari/i.test(aNorm)) {
      if (isLegalOrConsulting || /visa|migra|residencia|ciudadan|abogad|jur[ií]d/i.test(lowerCorpus)) {
        actScore = -100;
      }
    }
    if (isFashionOrDesign && /moda|dise[ñn]o/i.test(aNorm)) {
      actScore += 140;
    }
    if (isEntertainmentOrCulture && /medio|cultura|entretenimiento/i.test(aNorm)) {
      actScore += 140;
    }
    if (isLegalOrConsulting && /profesional|tecnico|legal|consult|jurid/i.test(aNorm)) {
      actScore += 120;
    }
    if (isBusinessOrChamber && /asociaci|organizaci|comercio|empresarial|profesional|servicio|negocio/i.test(aNorm)) {
      actScore += 120;
    }
    if (isTechEntity && /tecnolog|informaci|comunicaci/i.test(aNorm)) {
      actScore += 100;
    }
    if (isTourismEntity && /hosteler|alojam|turism/i.test(aNorm)) {
      actScore += 100;
    }
    if (isOngEntity && /social|comunitar|asociaci|voluntar|salud/i.test(aNorm)) {
      actScore += 100;
    }
    scoredActs.push({ name: act, score: actScore });
    if (actScore > highestActScore) {
      highestActScore = actScore;
      bestAct = act;
    }
  }

  scoredActs.sort((a, b) => b.score - a.score);
  let selectedActivities: string[] = [];

  if (isHealthEntity) {
    const healthAct = actsToEvaluate.find((a) => /salud|asistencia\s*social|medic/i.test(a));
    if (healthAct) {
      selectedActivities = [healthAct];
    } else if (scoredActs.length > 0) {
      selectedActivities = [scoredActs[0].name];
    }
  } else if (isEducationalEntity) {
    const eduAct = actsToEvaluate.find((a) => /educaci|formaci|ensenan/i.test(a));
    if (eduAct) {
      selectedActivities = [eduAct];
    }
  } else if (isSportsOrFitness) {
    const sportsAct = actsToEvaluate.find((a) => /deporte|fitness|gimnasio|bienestar|actividad\s+f[ií]sica/i.test(a));
    if (sportsAct) {
      selectedActivities = [sportsAct];
    } else if (scoredActs.length > 0 && scoredActs[0].score >= 40) {
      selectedActivities = [scoredActs[0].name];
    }
  } else {
    if (scoredActs.length > 0 && scoredActs[0].score > 0) {
      selectedActivities.push(scoredActs[0].name);
      if (scoredActs[1] && scoredActs[1].score >= 35 && scoredActs[1].score >= scoredActs[0].score * 0.65) {
        selectedActivities.push(scoredActs[1].name);
      }
    }
  }

  // 5. Dynamic Type Resolution across validTypes
  let bestType = validTypes[0] || "";
  const selectedTypes: string[] = [];

  if (isPublicEntity) {
    const pub = validTypes.find((t) => /p[uú]blico|estatal/i.test(t));
    if (pub) bestType = pub;
    else if (validTypes.length > 0) bestType = validTypes[0];
    if (bestType) selectedTypes.push(bestType);
  } else if (isOngEntity) {
    const ongType = validTypes.find((t) => /\b(?:ong|sin fines de lucro|fundaci|asociaci)\b/i.test(t));
    if (ongType) bestType = ongType;
    else if (validTypes.length > 0) bestType = validTypes[0];
    if (bestType) selectedTypes.push(bestType);
  } else {
    const priv = validTypes.find((t) => /privada|empresa/i.test(t));
    if (priv) bestType = priv;
    else if (validTypes.length > 0) bestType = validTypes[0];
    if (bestType) selectedTypes.push(bestType);
  }

  // 6. Dynamic Modalities across validMods
  const chosenMods: string[] = [];
  const presencialMod = validMods.find((m) => /presencial/i.test(m));
  const onlineMod = validMods.find((m) => /online|virtual|remoto|distancia/i.test(m));
  const tramitesMod = validMods.find((m) => /gesti[oó]n|tr[aá]mite/i.test(m));

  const hasTelemedicine = /\b(telemedicina|teleconsulta|consulta\s+virtual|videoconsulta|atenci[oó]n\s+(?:m[eé]dica\s+)?virtual)\b/i.test(lowerCorpus);
  const hasOnlineMention = !isHealthEntity && !isSportsOrFitness && /online|virtual|remoto|a distancia|zoom|meet/i.test(lowerCorpus);
  const hasPresencialMention = /sede|sedes|sucursal|sucursales|consultorio|consultorios|campus|ubicacion|direccion|atencion presencial|visitanos|delegacion|gimnasio|complejo|cancha|piscina|pileta|instalaciones/i.test(lowerCorpus) || isSportsOrFitness || isHealthEntity;
  const hasTramitesMention = /afiliaci[oó]n|afiliaciones|coseguro|coseguros|autorizaci[oó]n|autorizaciones/i.test(lowerCorpus) && !isSportsOrFitness && !isHealthEntity;

  if (hasPresencialMention && presencialMod) chosenMods.push(presencialMod);
  if ((hasOnlineMention || hasTelemedicine) && onlineMod) chosenMods.push(onlineMod);
  if (hasTramitesMention && tramitesMod) chosenMods.push(tramitesMod);
  if (chosenMods.length === 0 && presencialMod) {
    chosenMods.push(presencialMod);
  }
  const finalMods = chosenMods.length > 0 ? chosenMods : (presencialMod ? [presencialMod] : (validMods.length > 0 ? [validMods[0]] : []));

  return {
    sector: /salud|hospital|m[eé]dic/i.test(bestAct) ? "health" : /educaci/i.test(bestAct) ? "education" : "general",
    category: selectedCategories[0] || "",
    subcategory: selectedSubcategories[0] || "",
    categorySelections: selectedCategories,
    subcategorySelections: selectedSubcategories,
    providerActivities: selectedActivities,
    providerTypes: selectedTypes.length ? [selectedTypes[0]] : (bestType ? [bestType] : []),
    providerModalities: finalMods,
  };
}

function extractJsonFromModelResponse(text: string): any {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim();

  // 1. Try markdown fences ```json ... ``` or ``` ... ```
  const jsonFenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonFenceMatch && jsonFenceMatch[1]) {
    try {
      return JSON.parse(jsonFenceMatch[1].trim());
    } catch {}
  }

  // 2. Direct JSON.parse
  try {
    return JSON.parse(trimmed);
  } catch {}

  // 3. Extract the outermost JSON object by finding the first '{' and last '}'
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonSub = trimmed.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonSub);
    } catch {}
  }

  return null;
}

async function callGeminiApi(prompt: string, apiKey: string) {
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"];
  let lastError: any = null;

  for (const model of models) {
    // Attempt 1: Search-grounded request for real-time Google Maps / place fact verification
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: {
              temperature: 0.2,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const fullText = parts.map((p: any) => p.text || "").join("\n");
        const parsed = extractJsonFromModelResponse(fullText);
        if (parsed && typeof parsed === "object" && (parsed.title || parsed.publisherName || parsed.providerRating)) {
          return parsed;
        }
      }
    } catch (e: any) {
      console.warn(`Gemini search grounded attempt failed for ${model}:`, e.message);
    }

    // Attempt 2: Structured JSON mode
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const fullText = parts.map((p: any) => p.text || "").join("\n");
        const parsed = extractJsonFromModelResponse(fullText);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } else {
        const errText = await response.text();
        lastError = new Error(`Gemini (${model}): ${errText}`);
      }
    } catch (e: any) {
      lastError = e;
    }
  }

  throw lastError || new Error("No se pudo conectar con la API de Gemini.");
}

async function callOpenAIApi(prompt: string, apiKey: string) {
  const models = ["gpt-4o-mini", "gpt-4o"];
  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                "Eres un Lead AI Auditor y Clasificador Experto de publicaciones en Travelgrin. Tu respuesta debe ser estrictamente en formato JSON válido.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || "{}";
        const parsed = extractJsonFromModelResponse(rawContent);
        if (parsed && typeof parsed === "object") {
          return parsed;
        }
      } else {
        const errText = await response.text();
        lastError = new Error(`OpenAI (${model}): ${errText}`);
      }
    } catch (e: any) {
      lastError = e;
    }
  }

  throw lastError || new Error("No se pudo conectar con la API de OpenAI.");
}

function buildPrompt(
  extractedData: any,
  taxonomies: any,
  customBlocks?: CustomScraperBlock[],
  customAdminPrompt?: string,
  customTitlePrompt?: string,
  customDescriptionPrompt?: string,
  includeScoreScout: boolean = true
): string {
  const categoryTreeFormat = taxonomies.categoryTree.length
    ? taxonomies.categoryTree
        .map(
          (block: any) =>
            `=== BLOQUE: ${block.blockName} ===\n` +
            block.parentCategories
              .map(
                (cat: any) =>
                  `  - Categoría Padre: "${cat.name}"\n` +
                  (cat.subcategories.length
                    ? `    Subcategorías: ${cat.subcategories.map((s: string) => `"${s}"`).join(", ")}`
                    : `    Subcategorías: (ninguna)`)
              )
              .join("\n")
        )
        .join("\n\n")
    : "Sin categorías cargadas";

  const now = new Date();
  const formattedCurrentDate = now.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const customBlocksPrompt =
    customBlocks && customBlocks.length > 0
      ? `
======================================================================
🎯 BLOQUES DE DESCRIPCIÓN PERSONALIZADOS ('extraDescriptions'):
Para CADA uno de los siguientes bloques requeridos por el administrador, analiza estrictamente el contenido del sitio web y genera un objeto dentro del array 'extraDescriptions' con esta estructura JSON exacta:
{
  "title": "Nombre del bloque",
  "titleI18n": { "es": "...", "en": "...", "pt": "...", "it": "..." },
  "estado": "ok" | "parcial" | "sin_datos",
  "contenido": "...", // Redacción en formato HTML <p>...</p> en tercera persona. Si el sitio web no contiene datos para este bloque, coloca "" (cadena vacía) y estado "sin_datos".
  "evidencias": ["frase textual breve copiada literalmente del sitio web"],
  "body": "...", // idéntico al valor de contenido
  "bodyI18n": { "es": "...", "en": "...", "pt": "...", "it": "..." },
  "visibleInCard": false
}

LISTA DE BLOQUES A GENERAR:
${customBlocks
  .map(
    (b, i) =>
      `   * Bloque ${i + 1}: Título: "${b.title}"\n     Directiva específica del administrador: "${b.prompt ? b.prompt : 'Sintetizar y detallar información clara, útil y relevante en párrafos <p> en tercera persona.'}"\n     INSTRUCCIÓN DE REDACCIÓN: Si es un bloque de preguntas frecuentes (FAQ) o se solicitan preguntas y respuestas (ej: 10 preguntas con sus respuestas), formula preguntas pertinentes y respuestas claras basadas en los servicios, canales de atención, ubicación y datos verificados de la web con estado "ok". Para otros bloques temáticos, redacta la información correspondiente en párrafos <p> con estado "ok".`
  )
  .join("\n")}
======================================================================
`
      : "";

  const titlePromptSection = customTitlePrompt && customTitlePrompt.trim()
    ? `
======================================================================
🎯 DIRECTIVA MAESTRA FIJA PARA EL TÍTULO ('title' y 'titleI18n'):
"${customTitlePrompt.trim()}"
REGLA ESTRICTA DE TÍTULO: Aplica al 100% esta directiva en la redacción del título (tono publicitario/comercial o profesional y representativo de la oferta real). REGLA ESTRICTA DE LÍMITE DE PALABRAS Y EXTENSIÓN: Si el administrador indica un límite de palabras (ej: 'máximo 25 palabras', 'un límite de 25 palabras', 'hasta 20 palabras', 'menos de 15 palabras', 'tope de 25 palabras'): CUMPLE ESTRICTAMENTE Y NO SUPERES esa cantidad de palabras bajo ninguna circunstancia. Cuenta las palabras con exactitud antes de emitir la respuesta. Además, redacta un titular completo, llamativo y atractivo que aproveche bien la extensión solicitada (ej: si pide hasta 25 palabras, aprovecha una extensión sustancial de 15 a 25 palabras; no devuelvas un título telegráfico de solo 5 palabras). MÁXIMA LIBERTAD Y CERO PLANTILLAS: El administrador puede pedir cualquier estilo, extensión, enfoque o directiva en el título. Adáptate 100% a lo solicitado sin fórmulas fijas ni copiar el título original crudo. ${checkPromptOmitEntityName(customTitlePrompt) ? "RESTRICCIÓN NEGATIVA OBLIGATORIA: El administrador ha solicitado explícitamente que el título NO contenga el nombre de la institución. ESTÁ TERMINANTEMENTE PROHIBIDO incluir el nombre del establecimiento u oferente en el título; genera únicamente el eslogan comercial o titular publicitario de alto impacto." : ""}
======================================================================
`
    : "";

  const descriptionPromptSection = customDescriptionPrompt && customDescriptionPrompt.trim()
    ? `
======================================================================
🎯 DIRECTIVA MAESTRA FIJA PARA LA DESCRIPCIÓN PRINCIPAL ('description' y 'descriptionI18n'):
"${customDescriptionPrompt.trim()}"
REGLA ESTRICTA DE DESCRIPCIÓN: Aplica al 100% esta directiva en la estructura de párrafos <p>, tono y contenido. Si el administrador pide una cantidad exacta de párrafos (ej: '2 párrafos', '5 párrafos'), REDACTA EXACTAMENTE ESA CANTIDAD DE PÁRRAFOS en HTML <p>...</p>. Si pide subtítulos y su explicación o pide colores (ej: 'letras azules', 'rojo', etc.), aplica el estilo inline exacto pedido: si pide azul usa style="color: #0066cc;", si pide rojo usa style="color: #dc2626;", si pide amarillo usa style="color: #ca8a04;". REGLA ESTRICTA DE LÍMITE DE PALABRAS EN CADA PÁRRAFO: Si el administrador pide un límite de palabras en cada párrafo (ej: 'máximo 50 palabras en cada párrafo', 'un límite de 50 palabras', 'hasta 50 palabras'): CUMPLE ESTRICTAMENTE Y NO SUPERES esa cantidad en ningún párrafo, desarrollando y explayando el contenido con riqueza informativa para acercarte a la extensión solicitada (38 a 50 palabras por párrafo; NO escribas párrafos telegráficos o pobres de solo 15-20 palabras). EVITA PLANTILLAS RÍGIDAS y redacta de forma natural basada exclusivamente en datos reales del sitio web.
======================================================================
`
    : "";

  const adminPromptSection = customAdminPrompt && customAdminPrompt.trim()
    ? `
======================================================================
🎯 INSTRUCCIONES / PROMPTS ADICIONALES DEL ADMINISTRADOR:
"${customAdminPrompt.trim()}"
======================================================================
`
    : "";

  const scoreScoutDirective = includeScoreScout === false
    ? `
- BLOQUE SCORE SCOUT: El administrador ha desactivado el bloque Score Scout para esta publicación. NO generes el bloque Score Scout dentro de 'extraDescriptions'.
`
    : "";

  return `
Eres el Lead AI Auditor y Clasificador Experto de Travelgrin (actúas con total inteligencia editorial, veracidad y adaptabilidad).

======================================================================
📅 CONTEXTO TEMPORAL OBLIGATORIO:
FECHA ACTUAL DE REFERENCIA: ${formattedCurrentDate} (Mes: ${currentMonth}, Año: ${currentYear}).
REGLA DE VIGENCIA Y PLAZOS:
Toda fecha, plazo, convocatoria, arancel, beneficio o vigencia debe ser validada estrictamente respecto a la FECHA ACTUAL (${formattedCurrentDate}).
Cualquier trámite, convocatoria o plazo con fecha anterior a ${formattedCurrentDate} (por ejemplo fechas de 2024, 2025 o meses pasados) está VENCIDO y NO debe presentarse como vigente. Si una información o trámite ha caducado, indícalo explícitamente o descártalo.
======================================================================

======================================================================
🚫 REGLAS DE ORO PROMPTS V2 (ANTI-ALUCINACIÓN Y VERACIDAD ESTRICTA):
1. CERO ALUCINACIONES: PROHIBIDO inventar o citar leyes, decretos, números de artículos, normativas, años de antigüedad, precios o trámites que NO estén presentes de forma literal y textual en el texto fuente analizado del sitio web.
2. REDACCIÓN EN TERCERA PERSONA: Redactar siempre en tono institucional, neutral y formal en TERCERA PERSONA (ej: "La institución ofrece...", "La entidad cuenta con...", "El centro brinda..."). NUNCA uses primera persona ("ofrecemos", "brindamos", "nuestro estudio") ni segunda persona ("te ayudamos", "podés").
3. BLOQUES PERSONALIZADOS Y PREGUNTAS FRECUENTES (FAQs): Cuando el administrador solicite un bloque de preguntas frecuentes o un bloque personalizado con instrucciones específicas (ej. "Las preguntas deben tener su respuesta y deben ser 10 máximo"), la IA debe formular preguntas y respuestas pertinentes, profesionales y coherentes basadas en los servicios, prestaciones, canales y datos reales verificados del sitio web, respondiendo con estado "ok" y el contenido generado.
4. ESTRUCTURA JSON ESTRICTA POR BLOQUE:
   Para CADA bloque (Título, Descripción Principal, y cada uno de los bloques en 'extraDescriptions' como Requisitos, Proceso y costos, Logística, FAQs, etc.):
   El bloque debe incluir obligatoriamente:
   - "estado": "ok" | "parcial" | "sin_datos"
   - "contenido": "..." (HTML <p>...</p> para descripciones/bloques, o texto plano para el título; si estado === "sin_datos", DEBE SER una cadena vacía "")
   - "evidencias": ["frase textual breve copiada literalmente del sitio web"]
5. CERO PLANTILLAS Y RESOLUCIÓN OBLIGATORIA DE SIGLAS Y ACRÓNIMOS:
   - Prohibido terminantemente usar plantillas fijas, frases enlatadas o descripciones clichés vacías (ej: "Institución y prestador de servicios en..."). Describe la actividad concreta, funciones, alcance o propuesta real de la entidad.
   - Si el título del sitio web o su dominio es una SIGLA o ACRÓNIMO (ej: CTPPC, UTN, UBA, CPCE, OSEP, OSDE, etc.), la IA debe IDENTIFICAR OBLIGATORIAMENTE EL NOMBRE INSTITUCIONAL COMPLETO Y FORMAL desplegado (ej: "Colegio de Traductores Públicos de la Provincia de Córdoba" en lugar de "CTPPC") tanto para 'publisherName' como para el título principal.
6. DIRECCIÓN FÍSICA VIGENTE VS. TEXTOS O NOTICIAS HISTÓRICAS:
   - Para identificar la dirección ('locationAddress', 'headquarterLocations') y la sede operativa, da PRIORIDAD ABSOLUTA a la dirección legal y física actual ubicada en el pie de página (footer) o en las secciones de Contacto / Sedes del sitio web.
   - NUNCA tomes direcciones de noticias viejas, notas de prensa de hace años o artículos archivados en el cuerpo de la web.
7. ENLACES Y VALORACIONES DE GOOGLE MAPS DE LA ENTIDAD:
   - Para 'providerCommentsUrl', 'providerRating' y 'providerReviewCount', relaciona la ficha con el nombre oficial completo y la ciudad actual de la institución, generando una búsqueda limpia y directa sin números de piso ni oficinas ("piso 5°", "piso 8°") que confundan el motor de Google Maps.
======================================================================

${titlePromptSection}
${descriptionPromptSection}
${adminPromptSection}
${customBlocksPrompt}
${scoreScoutDirective}

DATOS EXTRAÍDOS DE LA WEB:
- URL: ${extractedData.url}
- Título Detectado: ${extractedData.title}
- Meta Descripción: ${extractedData.description}
${extractedData.detectedAddress ? `- DIRECCIÓN FÍSICA DETECTADA: ${extractedData.detectedAddress}` : ""}
${extractedData.detectedCity ? `- CIUDAD / SEDE PRINCIPAL DETECTADA: ${extractedData.detectedCity} (${extractedData.detectedCountry || "Argentina"})` : ""}
${extractedData.detectedFoundingYear ? `- AÑO HISTÓRICO / FUNDACIÓN REAL DETECTADO: ${extractedData.detectedFoundingYear}` : ""}
${extractedData.detectedMapsUrl ? `- URL DE GOOGLE MAPS (SEDE PRINCIPAL): ${extractedData.detectedMapsUrl}` : ""}
${extractedData.detectedRating ? `- VALORACIÓN REAL EN GOOGLE MAPS DE LA SEDE PRINCIPAL (0 a 5): ${extractedData.detectedRating}` : ""}
${extractedData.detectedReviewCount ? `- CANTIDAD EXACTA DE COMENTARIOS / RESEÑAS EN GOOGLE MAPS DE LA SEDE PRINCIPAL: ${extractedData.detectedReviewCount}` : ""}
${extractedData.detectedCommentsUrl ? `- ENLACE DE COMENTARIOS / MAPS DE LA SEDE PRINCIPAL: ${extractedData.detectedCommentsUrl}` : ""}
- Texto Completo del Sitio:
${extractedData.textContent.slice(0, 30000)}

${buildTaxonomyCatalogPromptSection(taxonomies)}

REGLAS CRÍTICAS Y OBLIGATORIAS:

0. TÍTULOS, AÑO HISTÓRICO REAL Y DATOS DE GOOGLE MAPS DE LA SEDE PRINCIPAL:
- 'publisherName': Es ÚNICAMENTE el nombre limpio y oficial de la institución, empresa u oferente (ej: "Colegio de Traductores Públicos de la Provincia de Córdoba", "Universidad Siglo 21", "Hospital Garrahan"). Si la web o el dominio usa una sigla o acrónimo (ej: CTPPC, UBA, OSDE, UTN), escribe OBLIGATORIAMENTE el nombre institucional formal completo desplegado. NUNCA pongas aquí slogans publicitarios.
- 'title': Título claro, representativo y profesional en tercera persona. NUNCA devuelvas "sin_datos" en el título; genera siempre un título representativo con la propuesta de valor del establecimiento. ${checkPromptOmitEntityName(customTitlePrompt) ? "SI EL ADMINISTRADOR PIDIÓ NO INCLUIR EL NOMBRE DE LA INSTITUCIÓN O OFERENTE, ESTÁ ESTRICTAMENTE PROHIBIDO PONER EL NOMBRE EN EL TÍTULO." : "Incluye el nombre del establecimiento junto con su propuesta comercial de impacto."} Puede ser un objeto { "estado": "ok"|"parcial", "contenido": "Título", "evidencias": ["..."] } o cadena de texto.
- 'providerStartYear': Año real de fundación histórica o inicio de actividades en que empezaron a operar (ej: 1821, 1903, 1973, 1987, 1995). Investiga o deduce el año de fundación real de la institución a partir del texto y tu conocimiento verificado sobre la entidad. NUNCA uses el año actual ni años de copyright web del pie de página (ej: 2010, 2024, 2025, 2026).
- 'providerRating': Valoración real que tiene en Google Maps de su SEDE PRINCIPAL (Casa Central / Sede Matriz). En caso de tener varias sedes o sucursales, toma OBLIGATORIAMENTE la puntuación de la sede principal para evitar confusiones. Si no tiene puntuación o ficha en Google Maps, pon "0". NUNCA inventes puntuaciones arbitrarias.
- 'providerReviewCount': Cantidad EXACTA de comentarios o reseñas que hay en Google Maps de su SEDE PRINCIPAL (Casa Central / Sede Matriz). En caso de tener varias sedes o sucursales, toma OBLIGATORIAMENTE la cantidad de la sede principal. NUNCA pongas números ficticios ni valores arbitrarios como "24" o "120". Si no tiene comentarios en Google Maps, pon estrictamente "0".
- 'providerCommentsUrl': Enlace a la ficha o reseñas de Google Maps de la SEDE PRINCIPAL.

1. DESCRIPCIÓN PRINCIPAL ('description'):
- Objeto con { "estado": "ok"|"parcial"|"sin_datos", "contenido": "<p>...</p>", "evidencias": ["..."] } en tercera persona e idioma Español. Si no hay datos, estado "sin_datos" con contenido "".

2. AUDITORÍA DEL SCORE SCOUT (0 a 100 PUNTOS):
- Transparente y fundamentado en p1..p6 (evaluando contacto, mapas, términos, HTTPS).

3. DESCRIPCIONES OPCIONALES ADICIONALES ('extraDescriptions'):
- Array con los bloques solicitados (Requisitos, Proceso y costos, Logística, FAQs, etc.) con { "title": "...", "titleI18n": {...}, "estado": "ok"|"parcial"|"sin_datos", "contenido": "...", "evidencias": ["..."], "body": "...", "bodyI18n": {...}, "visibleInCard": false }.

Devuelve UN OBJETO JSON con las siguientes claves exactas:
{
  "url": "${extractedData.url}",
  "title": { "estado": "ok", "contenido": "...", "evidencias": ["..."] },
  "titleI18n": { "es": "...", "en": "...", "pt": "...", "it": "..." },
  "description": { "estado": "ok", "contenido": "<p>...</p>", "evidencias": ["..."] },
  "descriptionI18n": { "es": "...", "en": "...", "pt": "...", "it": "..." },
  "extraDescriptions": [
    {
      "title": "...",
      "titleI18n": { "es": "...", "en": "...", "pt": "...", "it": "..." },
      "estado": "ok" | "parcial" | "sin_datos",
      "contenido": "...",
      "evidencias": ["..."],
      "body": "...",
      "bodyI18n": { "es": "...", "en": "...", "pt": "...", "it": "..." },
      "visibleInCard": false
    }
  ],
  "publisherName": "...",
  "providerInfoI18n": { "es": "...", "en": "...", "pt": "...", "it": "..." },
  "providerStartYear": "1973",
  "providerRating": "4.5",
  "providerReviewCount": "154",
  "providerCommentsUrl": "https://www.google.com/maps/search/?api=1&query=...",
  "country": "...",
  "city": "...",
  "headquarterCountry": "...",
  "headquarterCity": "...",
  "locationAddress": "...",
  "destinationCountries": ["..."],
  "headquarterLocations": [{ "country": "...", "city": "...", "address": "...", "mapUrl": "..." }],
  "currency": "USD",
  "price": "A consultar",
  "pricePeriod": "",
  "languages": "Español",
  "website": "${extractedData.url}",
  "socialLinksDetailed": [{ "kind": "web", "label": "Sitio Oficial", "url": "..." }],
  "category": "...",
  "subcategory": "...",
  "categorySelections": ["..."],
  "subcategorySelections": ["..."],
  "providerActivities": ["..."],
  "providerTypes": ["..."],
  "providerModalities": ["..."],
  "scoreScout": { "totalScore": 75, "p1": 20, "p2": 12, "p3": 15, "p4": 10, "p5": 10, "p6": 8, "maturity": "Consolidado", "relationship": "Directo", "evidenceSummary": "..." }
}

Responde ÚNICAMENTE con JSON estricto sin backticks ni texto adicional.
`;
}

function mergeSocialLinks(linksA: SocialLinkDetail[] = [], linksB: SocialLinkDetail[] = []): SocialLinkDetail[] {
  const merged: SocialLinkDetail[] = [];
  const seenUrls = new Set<string>();

  const add = (l: any) => {
    if (!l || !l.url) return;
    let u = String(l.url).trim();
    if (!u) return;

    // Reject broken / incomplete social links (e.g. youtube.com/watch without video ID, facebook/instagram homepages)
    if (/^https?:\/\/(?:www\.)?youtube\.com\/watch(?:\?.*)?$/i.test(u) && !u.includes("v=")) return;
    if (/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/?$/i.test(u)) return;
    if (/^https?:\/\/(?:www\.)?facebook\.com\/(?:sharer|share|tr|dialog)?\/?$/i.test(u)) return;
    if (/^https?:\/\/(?:www\.)?instagram\.com\/(?:p|stories|explore)?\/?$/i.test(u)) return;
    if (/^https?:\/\/(?:www\.)?tiktok\.com\/?$/i.test(u)) return;
    if (/^https?:\/\/(?:www\.)?linkedin\.com\/?$/i.test(u)) return;

    const norm = u.toLowerCase().replace(/\/+$/, "");
    if (seenUrls.has(norm)) return;
    seenUrls.add(norm);

    let kind = String(l.kind || "").toLowerCase().trim();
    let label = String(l.label || "").trim();

    if (!kind) {
      if (u.startsWith("tel:") || /^\+?\d[\d\s-]{6,}$/.test(u)) kind = "phone";
      else if (u.startsWith("mailto:")) kind = "email";
      else if (u.includes("wa.me") || u.includes("whatsapp")) kind = "whatsapp";
      else if (u.includes("instagram.com")) kind = "instagram";
      else if (u.includes("facebook.com")) kind = "facebook";
      else if (u.includes("youtube.com") || u.includes("youtu.be")) kind = "youtube";
      else if (u.includes("tiktok.com")) kind = "tiktok";
      else if (u.includes("linkedin.com")) kind = "linkedin";
      else kind = "web";
    }

    if (kind === "phone" && !u.startsWith("tel:")) {
      u = `tel:${u.replace(/[^\d+]/g, "")}`;
    }

    // Preserve valid WhatsApp message tokens (e.g. wa.me/message/...) without digit mangling
    if (kind === "whatsapp") {
      if (!u.startsWith("http")) {
        const digits = u.replace(/\D/g, "");
        if (digits.length >= 8) u = `https://wa.me/${digits}`;
      }
    }

    if (!label) {
      if (kind === "phone") label = "Teléfono de contacto";
      else if (kind === "whatsapp") label = "WhatsApp";
      else if (kind === "email") label = "Email de contacto";
      else if (kind === "instagram") label = "Instagram";
      else if (kind === "facebook") label = "Facebook";
      else if (kind === "youtube") label = "YouTube";
      else if (kind === "tiktok") label = "TikTok";
      else if (kind === "linkedin") label = "LinkedIn";
      else label = "Sitio Web";
    }

    merged.push({ kind, label, url: u });
  };

  linksA.forEach(add);
  linksB.forEach(add);
  return merged;
}

async function createFallbackPublication(
  extractedData: any,
  taxonomies?: any,
  customBlocks?: CustomScraperBlock[],
  customAdminPrompt?: string,
  customTitlePrompt?: string,
  customDescriptionPrompt?: string,
  includeScoreScout: boolean = true
): Promise<ScrapedPublication> {
  return formatPublicationResult(
    {},
    extractedData,
    taxonomies,
    customBlocks,
    customAdminPrompt,
    customTitlePrompt,
    customDescriptionPrompt,
    includeScoreScout
  );
}

async function formatPublicationResult(
  parsed: any,
  extractedData: any,
  taxonomies?: any,
  customBlocks?: CustomScraperBlock[],
  customAdminPrompt?: string,
  customTitlePrompt?: string,
  customDescriptionPrompt?: string,
  includeScoreScout: boolean = true
): Promise<ScrapedPublication> {
  const host = new URL(extractedData.url).hostname.replace("www.", "");
  let rawTitle = "";
  if (parsed.title && typeof parsed.title === "object" && !Array.isArray(parsed.title)) {
    rawTitle = String(parsed.title.contenido || parsed.title.title || "").trim();
  } else if (typeof parsed.title === "string") {
    rawTitle = parsed.title.trim();
  }
  if (!rawTitle || /^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo)$/i.test(rawTitle)) {
    rawTitle = extractedData.title || `Publicación de ${host}`;
  }
  let title = cleanTitleString(rawTitle);
  let publisherName = cleanPublisherName(parsed.publisherName || extractedData.title || title, extractedData.url, rawTitle);
  if (!title || /^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo)$/i.test(title)) {
    title = publisherName ? `Propuestas y servicios de ${publisherName}` : `Publicación de ${host}`;
  }
  const officialPubFullName = findOfficialOrganizationName(extractedData.htmlContent || "", publisherName, extractedData.detectedSiteName);
  if (officialPubFullName && officialPubFullName !== publisherName && /^[A-Z0-9]{2,8}$/.test(publisherName.replace(/\s+/g, ""))) {
    publisherName = officialPubFullName;
  }

  const validCats = taxonomies?.categories || [];
  const validSubcats = taxonomies?.subcategories || [];
  const validActs = taxonomies?.activities || [];
  const validTypes = taxonomies?.types || [];
  const validMods = taxonomies?.modalities || [];

  const rawCatSelections = Array.isArray(parsed.categorySelections) && parsed.categorySelections.length
    ? parsed.categorySelections
    : parsed.category ? [parsed.category] : [];

  const rawSubcatSelections = Array.isArray(parsed.subcategorySelections) && parsed.subcategorySelections.length
    ? parsed.subcategorySelections
    : parsed.subcategory ? [parsed.subcategory] : [];

  const allText = `${extractedData.url} ${title} ${parsed.description || ""} ${extractedData.textContent}`.toLowerCase();
  const titleClean = title;
  const locInfo = detectAllLocationsAndHeadquarters(allText, extractedData.url, titleClean);

  const city = parsed.city && parsed.city !== "Buenos Aires" ? parsed.city : locInfo.primaryCity;
  const country = parsed.country || locInfo.primaryCountry;

  const rawHq = Array.isArray(parsed.headquarterLocations) && parsed.headquarterLocations.length > 0
    ? parsed.headquarterLocations
    : [
        {
          country: parsed.headquarterCountry || country || "Argentina",
          city: parsed.headquarterCity || city || "Buenos Aires",
          address: extractedData.detectedAddress || parsed.locationAddress || "",
          mapUrl: parsed.locationAddress || extractedData.detectedMapsUrl || buildGoogleMapsUrl(`${publisherName || title}, ${city}, ${country}`),
        },
      ];

  const headquarterLocations = resolveHeadquarterLocations(
    rawHq,
    titleClean,
    publisherName,
    city,
    country,
    extractedData.detectedMapsUrl,
    allText,
    locInfo.additionalCities,
    extractedData.detectedAddress,
    extractedData.detectedAllAddresses || []
  );
  const primaryHq = headquarterLocations[0] || {
    city: city || "Buenos Aires",
    country: country || "Argentina",
    address: "",
    mapUrl: buildGoogleMapsUrl(`${publisherName || title}, ${city}, ${country}`),
  };

  const initialMapsUrl =
    extractedData.detectedMapsUrl ||
    parsed.locationAddress ||
    primaryHq.mapUrl ||
    buildGoogleMapsUrl(`${publisherName || title}, ${primaryHq.city}, ${primaryHq.country}`);

  let startYear = extractedData.detectedFoundingYear || "";
  if (!startYear) {
    startYear = extractFoundingYear("", allText, extractedData.url, titleClean) || "";
  }
  if (!startYear && (publisherName || titleClean)) {
    try {
      startYear = (await fetchExternalFoundingYear(publisherName || titleClean, primaryHq.city)) || "";
    } catch {}
  }

  if (startYear) {
    const yr = startYear.trim();
    const yrNum = parseInt(yr, 10);
    const currYr = new Date().getFullYear();
    if (isNaN(yrNum) || yrNum < 1600 || yrNum > currYr - 1 || yrNum === 2010 || yrNum === 2015) {
      startYear = "";
    } else {
      startYear = String(yrNum);
    }
  }

  const sectorClassification = classifySectorAndTaxonomy(
    extractedData.url,
    titleClean,
    allText,
    taxonomies
  );

  const effectiveTitlePrompt = (customTitlePrompt || "").trim() || (customAdminPrompt || "").trim();
  if (effectiveTitlePrompt) {
    if (checkPromptOmitEntityName(effectiveTitlePrompt)) {
      title = cleanTitleOmitEntity(title, publisherName || titleClean, publisherName);
    }
    const rawFallbackTitle = cleanTitleString(extractedData.title || "");
    const isRawTitle = !title || title.length < 8 || (rawFallbackTitle && title.trim().toLowerCase() === rawFallbackTitle.toLowerCase());
    if (isRawTitle) {
      title = generateImpactfulTitle(title, sectorClassification?.sector || "general", effectiveTitlePrompt, city, allText, publisherName);
    }
  }

  // Use fuzzy matching against canonical DB options
  let matchedCatSelections = mapToCanonicalTaxonomy(rawCatSelections, validCats, sectorClassification.categorySelections);
  let matchedSubcatSelections = mapToCanonicalTaxonomy(rawSubcatSelections, validSubcats, sectorClassification.subcategorySelections);
  let matchedActivities = mapToCanonicalTaxonomy(parsed.providerActivities, validActs, sectorClassification.providerActivities);
  let matchedTypes = mapToCanonicalTaxonomy(parsed.providerTypes, validTypes, sectorClassification.providerTypes);
  let matchedModalities = mapToCanonicalTaxonomy(parsed.providerModalities, validMods, sectorClassification.providerModalities);

  // Categories and subcategories are strictly evaluated dynamically against the catalog.
  // Never assign blind fallbacks like validCats[0] or static templates!
  if (!matchedActivities.length && sectorClassification.providerActivities?.length) {
    matchedActivities = sectorClassification.providerActivities;
  }
  if (!matchedTypes.length && sectorClassification.providerTypes?.length) {
    matchedTypes = sectorClassification.providerTypes;
  }
  if (!matchedModalities.length && sectorClassification.providerModalities?.length) {
    matchedModalities = sectorClassification.providerModalities;
  } else if (!matchedModalities.length) {
    const pres = validMods.find((m: string) => /presencial/i.test(m));
    matchedModalities = pres ? [pres] : (validMods.length > 0 ? [validMods[0]] : ["Atención presencial"]);
  }

  // Safely extract AI-generated description in any shape (object, string, array, Spanish aliases)
  let rawDescEs = "";
  let rawDescEn = "";
  let rawDescPt = "";
  let rawDescIt = "";

  const descObj = parsed?.descriptionI18n || parsed?.descripcionI18n || parsed?.descriptions;
  if (descObj && typeof descObj === "object" && !Array.isArray(descObj)) {
    rawDescEs = String(descObj.es || descObj.ES || descObj.Spanish || "").trim();
    rawDescEn = String(descObj.en || descObj.EN || descObj.English || "").trim();
    rawDescPt = String(descObj.pt || descObj.PT || descObj.Portuguese || "").trim();
    rawDescIt = String(descObj.it || descObj.IT || descObj.Italian || "").trim();
  }

  if (!rawDescEs) {
    const rawSingleDesc = parsed?.description ?? parsed?.descripcion ?? parsed?.desc;
    if (typeof rawSingleDesc === "string") {
      rawDescEs = rawSingleDesc.trim();
    } else if (rawSingleDesc && typeof rawSingleDesc === "object" && !Array.isArray(rawSingleDesc)) {
      if (rawSingleDesc.estado === "sin_datos") {
        rawDescEs = "";
      } else if (rawSingleDesc.contenido !== undefined) {
        rawDescEs = String(rawSingleDesc.contenido).trim();
      } else {
        rawDescEs = String(rawSingleDesc.es || rawSingleDesc.ES || "").trim();
      }
      if (!rawDescEn) rawDescEn = String(rawSingleDesc.en || rawSingleDesc.EN || "").trim();
      if (!rawDescPt) rawDescPt = String(rawSingleDesc.pt || rawSingleDesc.PT || "").trim();
      if (!rawDescIt) rawDescIt = String(rawSingleDesc.it || rawSingleDesc.IT || "").trim();
    } else if (Array.isArray(rawSingleDesc)) {
      rawDescEs = rawSingleDesc.map((p: any) => String(p)).join("\n");
    }
  }

  let finalDescEs = normalizeToSpanishDescriptionHeaders(rawDescEs);

  const effectiveDescPrompt = (customDescriptionPrompt || "").trim() || (customAdminPrompt || "").trim();

  // If prompt asks to strip icons / emojis
  if (effectiveDescPrompt && checkPromptOmitIcons(effectiveDescPrompt)) {
    finalDescEs = stripEmojisAndIcons(finalDescEs);
  }
  // If prompt asks to strip prices
  if (effectiveDescPrompt && checkPromptOmitPrice(effectiveDescPrompt)) {
    finalDescEs = finalDescEs
      .replace(/<p>\s*<strong>\s*Precio:[\s\S]*?<\/p>/gi, "")
      .replace(/<strong>\s*Precio:[\s\S]*?(?=<strong>|<\/p>|$)/gi, "")
      .replace(/<p>\s*<strong>\s*Vigencia:[\s\S]*?Precio:[\s\S]*?<\/p>/gi, (m) => {
        return m.replace(/<strong>\s*Precio:[\s\S]*?(?=<\/p>|$)/gi, "");
      });
  }

  // Check if AI description is valid and has content
  const hasValidContent = finalDescEs.length >= 20 && (finalDescEs.includes("<p>") || finalDescEs.length >= 40);

  // If the AI description was completely missing or empty, generate grounded descriptions fallback
  if (!hasValidContent) {
    const fallbackDesc = await buildGroundedDescriptions(extractedData, title, primaryHq.city, primaryHq.country, effectiveDescPrompt);
    finalDescEs = fallbackDesc.es;
    rawDescEn = fallbackDesc.en;
    rawDescPt = fallbackDesc.pt;
    rawDescIt = fallbackDesc.it;
  }

  // Ensure city in description text matches primaryHq
  if (primaryHq.city && primaryHq.city !== "Buenos Aires" && /sede en Buenos Aires/i.test(finalDescEs)) {
    const locText = `${primaryHq.city}, ${primaryHq.country || "Argentina"}`;
    finalDescEs = finalDescEs.replace(/sede en Buenos Aires(?:,\s*Argentina)?/gi, `sede en ${locText}`);
  }

  if (effectiveDescPrompt && finalDescEs) {
    finalDescEs = enforceDescriptionParagraphCount(finalDescEs, effectiveDescPrompt);
    finalDescEs = enforceParagraphWordLimit(finalDescEs, effectiveDescPrompt);
    finalDescEs = applyPromptColorStyles(finalDescEs, effectiveDescPrompt);
  }

  const finalDescEn = rawDescEn || "";
  const finalDescPt = rawDescPt || "";
  const finalDescIt = rawDescIt || "";

  const detectedRating = extractedData.detectedRating || extractRatingFromText(`${extractedData.description || ""} ${extractedData.textContent || ""}`);
  const detectedReviewCount = extractedData.detectedReviewCount || extractReviewCountFromText(`${extractedData.description || ""} ${extractedData.textContent || ""}`);

  // Rating: if verified detectedRating (from known map, schema, or verified HTML/Maps/Search of primary headquarters), use it first! Else if AI provided valid rating, use it; else "0"
  let finalRating = "0";
  if (detectedRating && !isNaN(parseFloat(detectedRating)) && parseFloat(detectedRating) > 0) {
    finalRating = Math.min(5, Math.max(1, parseFloat(detectedRating))).toFixed(1);
  } else if (parsed.providerRating && !isNaN(parseFloat(parsed.providerRating)) && parseFloat(parsed.providerRating) > 0) {
    finalRating = Math.min(5, Math.max(1, parseFloat(parsed.providerRating))).toFixed(1);
  }

  // Review count: if verified detectedReviewCount (from known map or verified HTML/Maps/Search of primary headquarters), use it first! Else if AI provided review count, use it; else "0"
  let finalReviewCount = "0";
  if (detectedReviewCount && String(detectedReviewCount).trim() !== "" && String(detectedReviewCount).trim() !== "0") {
    finalReviewCount = String(detectedReviewCount).replace(/[^0-9]/g, "") || "0";
  } else if (parsed.providerReviewCount !== undefined && parsed.providerReviewCount !== null && String(parsed.providerReviewCount).trim() !== "" && String(parsed.providerReviewCount).trim() !== "0") {
    const rawCount = String(parsed.providerReviewCount).replace(/[^0-9]/g, "");
    finalReviewCount = (rawCount && rawCount !== "0") ? rawCount : "0";
  }

  // Score Scout Block resolution - only included if includeScoreScout is true
  const formattedExtraDescriptions: ExtraDescriptionBlock[] = [];
  if (includeScoreScout !== false) {
    const scoreBlock = buildScoreScoutBlock(
      publisherName || title,
      startYear,
      finalRating,
      allText,
      parsed.scoreScout,
      extractedData.url,
      finalReviewCount
    );
    formattedExtraDescriptions.push(scoreBlock);
  }

  // Append any extra description blocks generated by the AI
  if (Array.isArray(parsed.extraDescriptions)) {
    parsed.extraDescriptions.forEach((extra: any) => {
      const blockTitle = String(extra?.title || "").trim();
      if (!blockTitle) return;
      if (/score scout/i.test(blockTitle) && includeScoreScout === false) return;

      const estado: "ok" | "parcial" | "sin_datos" =
        extra?.estado === "sin_datos" || extra?.estado === "parcial" || extra?.estado === "ok"
          ? extra.estado
          : (extra?.body || extra?.contenido)
          ? "ok"
          : "sin_datos";

      const rawBody = estado === "sin_datos" ? "" : String(extra?.contenido ?? extra?.body ?? "").trim();
      const evidencias = Array.isArray(extra?.evidencias)
        ? extra.evidencias.map((e: any) => String(e).trim()).filter(Boolean)
        : [];

      const tI18n = extra.titleI18n || {};
      const bI18n = extra.bodyI18n || {};

      formattedExtraDescriptions.push({
        title: blockTitle,
        titleI18n: {
          es: String(tI18n.es || blockTitle).trim(),
          en: String(tI18n.en || tI18n.es || blockTitle).trim(),
          pt: String(tI18n.pt || tI18n.es || blockTitle).trim(),
          it: String(tI18n.it || tI18n.es || blockTitle).trim(),
        },
        body: rawBody,
        bodyI18n: {
          es: estado === "sin_datos" ? "" : String(bI18n.es || rawBody).trim(),
          en: estado === "sin_datos" ? "" : String(bI18n.en || bI18n.es || rawBody).trim(),
          pt: estado === "sin_datos" ? "" : String(bI18n.pt || bI18n.es || rawBody).trim(),
          it: estado === "sin_datos" ? "" : String(bI18n.it || bI18n.es || rawBody).trim(),
        },
        visibleInCard: extra.visibleInCard === true,
        estado,
        contenido: rawBody,
        evidencias,
        prompt: extra?.prompt,
      });
    });
  }

  // Ensure ALL customBlocks requested by the user are present in formattedExtraDescriptions!
  if (Array.isArray(customBlocks) && customBlocks.length > 0) {
    for (const customBlock of customBlocks) {
      if (!customBlock.title || !customBlock.title.trim()) continue;
      const cleanCustomTitle = customBlock.title.trim();
      const existingIdx = formattedExtraDescriptions.findIndex(
        (b) => b.title.toLowerCase() === cleanCustomTitle.toLowerCase()
      );
      if (existingIdx === -1) {
        const generatedCustom = await buildGroundedCustomBlock(
          customBlock,
          extractedData,
          primaryHq
        );
        formattedExtraDescriptions.push(generatedCustom);
      } else {
        if (customBlock.prompt && !formattedExtraDescriptions[existingIdx].prompt) {
          formattedExtraDescriptions[existingIdx].prompt = customBlock.prompt;
        }
      }
    }
  }

  // Apply prompt-driven color styling to ALL custom description blocks
  for (const extra of formattedExtraDescriptions) {
    if (!extra.prompt && Array.isArray(customBlocks)) {
      const matchCb = customBlocks.find((cb) => cb.title && cb.title.trim().toLowerCase() === extra.title.trim().toLowerCase());
      if (matchCb?.prompt) {
        extra.prompt = matchCb.prompt;
      }
    }
    if (extra.prompt && extra.body) {
      const filtered = enforceFaqCountAndFilter(extra.body, extra.prompt);
      const styled = applyPromptColorStyles(filtered, extra.prompt);
      extra.body = styled;
      extra.contenido = styled;
      if (extra.bodyI18n) {
        extra.bodyI18n.es = styled;
      }
    }
  }

  const titleI18n = {
    es: enforceTitleConstraints(cleanTitleString(title), customTitlePrompt),
    en: "",
    pt: "",
    it: "",
  };

  const cleanPubForProvInfo = cleanPublisherName(publisherName || title, extractedData.url).split(/\s*[:|–—\-]\s*/)[0].trim() || publisherName || title;
  const defaultProvInfoEs = (parsed.providerInfo && !parsed.providerInfo.includes("es un establecimiento y prestador de servicios") && parsed.providerInfo.length > 20)
    ? parsed.providerInfo
    : (parsed.providerInfoI18n?.es && !parsed.providerInfoI18n.es.includes("es un establecimiento y prestador de servicios") && parsed.providerInfoI18n.es.length > 20)
    ? parsed.providerInfoI18n.es
    : buildRichProviderInfo(cleanPubForProvInfo, primaryHq.city, primaryHq.country, extractedData, finalDescEs);

  const providerInfoI18n = {
    es: defaultProvInfoEs,
    en: parsed.providerInfoI18n?.en || "",
    pt: parsed.providerInfoI18n?.pt || "",
    it: parsed.providerInfoI18n?.it || "",
  };

  // Comments URL: prioritize verified real place link from live scraping / known catalog, then valid AI link, then fallback search
  let finalCommentsUrl =
    extractedData.detectedCommentsUrl ||
    (parsed.providerCommentsUrl && parsed.providerCommentsUrl !== extractedData.url && !parsed.providerCommentsUrl.includes("0") ? parsed.providerCommentsUrl : "") ||
    "";
  if (!finalCommentsUrl || !/^https?:\/\//i.test(finalCommentsUrl) || finalCommentsUrl === extractedData.url) {
    const cleanAddr = cleanAddressForSearch(extractedData.detectedAddress);
    const searchEntity = publisherName || title;
    const parts = [searchEntity, cleanAddr, primaryHq.city, primaryHq.country].filter(Boolean);
    finalCommentsUrl = buildGoogleMapsUrl(parts.join(", "));
  }

  const logoUrl =
    (isValidLogoUrl(extractedData.detectedLogo) ? extractedData.detectedLogo : "") ||
    (isValidLogoUrl(parsed.providerLogo) ? parsed.providerLogo : "") ||
    "";

  const destinationCountries = Array.isArray(parsed.destinationCountries) && parsed.destinationCountries.length > 0
    ? parsed.destinationCountries
    : locInfo.detectedCountries.length > 0
    ? locInfo.detectedCountries
    : [primaryHq.country || country];

  const rawParsedSocials = Array.isArray(parsed.socialLinksDetailed) ? parsed.socialLinksDetailed : [];
  const rawExtractedSocials = Array.isArray(extractedData.socialLinksExtracted) ? extractedData.socialLinksExtracted : [{ kind: "web", label: "Sitio Oficial", url: extractedData.url }];
  const combinedSocials = mergeSocialLinks(rawParsedSocials, rawExtractedSocials);

  const finalTitle = enforceTitleConstraints(cleanTitleString(title), customTitlePrompt);
  const draftResult: ScrapedPublication = {
    url: extractedData.url,
    title: finalTitle,
    titleI18n: {
      es: finalTitle,
      en: "",
      pt: "",
      it: "",
    },
    description: finalDescEs,
    descriptionI18n: {
      es: finalDescEs,
      en: "",
      pt: "",
      it: "",
    },
    extraDescriptions: formattedExtraDescriptions.map((blk) => ({
      ...blk,
      titleI18n: { es: blk.title, en: "", pt: "", it: "" },
      bodyI18n: { es: blk.body, en: "", pt: "", it: "" },
    })),
    publisherName,
    providerInfo: providerInfoI18n.es,
    providerInfoI18n,
    providerStartYear: startYear,
    providerRating: finalRating,
    providerReviewCount: finalReviewCount,
    providerCommentsUrl: finalCommentsUrl,
    providerLogo: logoUrl,
    country: primaryHq.country || country,
    city: primaryHq.city || city,
    headquarterCountry: primaryHq.country || parsed.headquarterCountry || country,
    headquarterCity: primaryHq.city || parsed.headquarterCity || city,
    locationAddress: primaryHq.mapUrl || initialMapsUrl,
    destinationCountries,
    headquarterLocations,
    currency: parsed.currency || "USD",
    price: parsed.price || "A consultar",
    pricePeriod: parsed.pricePeriod || "",
    languages: parsed.languages || "Español, Inglés",
    website: parsed.website || extractedData.url,
    socialLinksDetailed: combinedSocials.length ? combinedSocials : [{ kind: "web", label: "Sitio Oficial", url: extractedData.url }],
    images: extractedData.images && extractedData.images.length ? extractedData.images : (parsed.images || []),
    category: matchedCatSelections[0] || "",
    subcategory: matchedSubcatSelections[0] || "",
    categorySelections: matchedCatSelections,
    subcategorySelections: matchedSubcatSelections,
    providerActivities: matchedActivities.length ? matchedActivities : [],
    providerTypes: matchedTypes.length ? matchedTypes : (taxonomies?.types?.length ? [taxonomies.types[0]] : []),
    providerModalities: matchedModalities.length ? matchedModalities : (taxonomies?.modalities?.length ? taxonomies.modalities.slice(0, 2) : []),
    customTitlePrompt: (customTitlePrompt || customAdminPrompt || "").trim(),
    customDescriptionPrompt: (customDescriptionPrompt || customAdminPrompt || "").trim(),
    customDescPrompt: (customDescriptionPrompt || customAdminPrompt || "").trim(),
  };

  return enforceStrictTaxonomyGuardrails(
    draftResult,
    extractedData,
    taxonomies
  );
}

function enforceStrictTaxonomyGuardrails(
  publication: ScrapedPublication,
  extractedData: any,
  taxonomies?: any
): ScrapedPublication {
  const allText = `${publication.url} ${publication.title} ${publication.description} ${extractedData.textContent}`.toLowerCase();
  const titleClean = cleanTitleString(publication.title);
  publication.publisherName = cleanTitleString(publication.publisherName || titleClean.split(/\s*[-–—|]\s*/)[0].trim());
  const GENERIC_PUB_REGEX = /^(?:home(?:\s*page)?|homepage|inicio|portada|bienvenidos?|principal|sitio\s*oficial|p[aá]gina\s*(?:principal|oficial|de\s*inicio)?|web\s*oficial|portal(?:\s*oficial)?|login|acceso|contacto|novedades|art[ií]culo|untitled|sin\s*datos|no\s*disponible|n\/?a|oferente|establecimiento|empresa|instituci[oó]n)$/i;
  if (GENERIC_PUB_REGEX.test((publication.publisherName || "").trim())) {
    const domainBrand = cleanPublisherName("", publication.url, publication.title, extractedData?.detectedSiteName);
    if (domainBrand && !GENERIC_PUB_REGEX.test(domainBrand)) {
      publication.publisherName = domainBrand;
    }
  }

  // Merge any extracted phone, whatsapp, email, web links
  if (extractedData?.socialLinksExtracted && Array.isArray(extractedData.socialLinksExtracted)) {
    publication.socialLinksDetailed = mergeSocialLinks(publication.socialLinksDetailed, extractedData.socialLinksExtracted);
  }

  const locInfo = detectAllLocationsAndHeadquarters(allText, publication.url, titleClean);
  const classified = classifySectorAndTaxonomy(publication.url, titleClean, allText, taxonomies);

  // 1. Fallback ONLY if fields were not populated (e.g., non-AI extractor fallback)
  if (publication.categorySelections === undefined) {
    publication.category = classified.category || "";
    publication.subcategory = classified.subcategory || "";
    publication.categorySelections = classified.categorySelections || [];
    publication.subcategorySelections = classified.subcategorySelections || [];
  } else if (publication.categorySelections.length === 1 && publication.categorySelections[0] === "General") {
    publication.categorySelections = [];
    publication.category = "";
  }

  if (publication.providerActivities === undefined) {
    publication.providerActivities = classified.providerActivities || [];
  }
  if (publication.providerTypes === undefined) {
    publication.providerTypes = classified.providerTypes || [];
  }
  if (publication.providerModalities === undefined) {
    publication.providerModalities = classified.providerModalities || [];
  }

  // Canonical Catalog Validation: Strip any categories or subcategories hallucinated by the model that don't exist in the admin's database
  const allValidCatalogCategories: string[] = Array.from(new Set([
    ...(taxonomies?.categories || []),
    ...(taxonomies?.categoryTree || []).flatMap((b: any) => (b.parentCategories || []).map((p: any) => p.name)),
  ].filter(Boolean)));

  const allValidCatalogSubcategories: string[] = Array.from(new Set([
    ...(taxonomies?.subcategories || []),
    ...(taxonomies?.categoryTree || []).flatMap((b: any) => (b.parentCategories || []).flatMap((p: any) => p.subcategories || [])),
  ].filter(Boolean)));

  if (allValidCatalogCategories.length > 0 && Array.isArray(publication.categorySelections)) {
    const validCatalogCatSet = new Set(allValidCatalogCategories.map((c) => c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()));
    publication.categorySelections = publication.categorySelections.filter((cat) => {
      const norm = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return validCatalogCatSet.has(norm);
    });
    publication.category = publication.categorySelections[0] || "";
  }

  if (allValidCatalogSubcategories.length > 0 && Array.isArray(publication.subcategorySelections)) {
    const validCatalogSubSet = new Set(allValidCatalogSubcategories.map((s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()));
    publication.subcategorySelections = publication.subcategorySelections.filter((sub) => {
      const norm = sub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return validCatalogSubSet.has(norm);
    });
    publication.subcategory = publication.subcategorySelections[0] || "";
  }

  // Ensure child subcategories strictly reflect genuine selections without injecting arbitrary defaults
  if (Array.isArray(publication.subcategorySelections) && publication.subcategorySelections.length > 0) {
    publication.subcategory = publication.subcategorySelections[0];
  } else {
    publication.subcategory = "";
    publication.subcategorySelections = [];
  }

  // Strict sanitization: Ensure providerActivities NEVER contains any option from providerTypes
  if (Array.isArray(publication.providerActivities) && taxonomies?.types?.length) {
    publication.providerActivities = publication.providerActivities.filter((a: string) => !taxonomies.types.includes(a));
  }

  const isHealthOrHospital =
    /hospital|clinica|sanatorio|policlinico/i.test(publication.url) ||
    /\b(hospital|clinica|sanatorio|centro\s+medico|consultorio\s+medico|guardia\s+medica|atencion\s+medica|pacientes?|asistencial|prestaciones\s+medicas|salud\s+y\s+asistencia)\b/i.test(allText);

  if (isHealthOrHospital) {
    // A. A hospital's activity is strictly healthcare; NEVER include education, training, tourism, etc.
    if (Array.isArray(publication.providerActivities)) {
      publication.providerActivities = publication.providerActivities.filter((a) => !/educaci|formaci|ensenan/i.test(a));
      if (publication.providerActivities.length === 0 && taxonomies?.activities?.length) {
        const healthAct = taxonomies.activities.find((a: string) => /salud|asistencia\s*social|medic/i.test(a));
        if (healthAct) publication.providerActivities = [healthAct];
      }
    }

    // B. A hospital is NOT a course, vocational training academy, or job board
    if (Array.isArray(publication.categorySelections)) {
      publication.categorySelections = publication.categorySelections.filter((c) => {
        const cNorm = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|guardia|obra\s*social|prepaga/i.test(cNorm)) return true;
        return false;
      });
      publication.category = publication.categorySelections[0] || "";
    }

    if (Array.isArray(publication.subcategorySelections)) {
      publication.subcategorySelections = publication.subcategorySelections.filter((s) => {
        const sNorm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|guardia|obra\s*social|prepaga/i.test(sNorm)) return true;
        return false;
      });
      publication.subcategory = publication.subcategorySelections[0] || "";
    }

    // C. Modalidad: Physical hospitals are Atención presencial unless explicit telemedicine is offered
    const hasTelemedicine = /\b(telemedicina|teleconsulta|consulta\s+virtual|videoconsulta|atenci[oó]n\s+(?:m[eé]dica\s+)?virtual)\b/i.test(allText);
    if (!hasTelemedicine && Array.isArray(publication.providerModalities)) {
      publication.providerModalities = publication.providerModalities.filter((m) => !/online|virtual|remoto|distancia/i.test(m));
      if (publication.providerModalities.length === 0 && taxonomies?.modalities?.length) {
        const pres = taxonomies.modalities.find((m: string) => /presencial/i.test(m));
        if (pres) publication.providerModalities = [pres];
      }
    }
  }

  // Strict Mutual Exclusivity for providerTypes: Organismo público vs Institución privada
  if (Array.isArray(publication.providerTypes) && publication.providerTypes.length > 0) {
    const isPublicGov =
      /\b(\.gov|\.gob|\.mil)\b/i.test(publication.url) ||
      /\b(uncuyo|uba|unlp|unc|utn|unr|universidad nacional|hospital publico|hospital nacional|hospital universitario|organismo publico|ministerio|gobierno|estatal|comuna|municipalidad)\b/i.test(allText);

    if (isPublicGov) {
      publication.providerTypes = publication.providerTypes.filter((t) => !/privad|empresa/i.test(t));
      if (publication.providerTypes.length === 0 && taxonomies?.types?.length) {
        const pub = taxonomies.types.find((t: string) => /p[uú]blic|estatal|gobiern/i.test(t));
        if (pub) publication.providerTypes = [pub];
      }
    } else {
      publication.providerTypes = publication.providerTypes.filter((t) => !/p[uú]blic|estatal|gobiern|municipal/i.test(t));
      if (publication.providerTypes.length === 0 && taxonomies?.types?.length) {
        const priv = taxonomies.types.find((t: string) => /privada|empresa/i.test(t));
        if (priv) publication.providerTypes = [priv];
      }
    }
    // Guarantee at most 1 primary provider type
    if (publication.providerTypes.length > 1) {
      publication.providerTypes = [publication.providerTypes[0]];
    }
  }

  // Negative sanity checks: Prevent absurd cross-rubro hallucinations without forcing arbitrary categories
  const isActuallyAgri = /\b(agricult|agronom|agropecu|ganader|cultivo|cosecha|pesca|pesquer|piscicultur)\b/i.test(allText);
  if (!isActuallyAgri && Array.isArray(publication.providerActivities)) {
    publication.providerActivities = publication.providerActivities.filter((a) => !/agricultura|ganader|pesca/i.test(a));
  }

  const isActuallyMigration = /\b(visas?|migratori|migraci[oó]n|residencia\s*legal|ciudadan[ií]a\s*legal|tr[aá]mites?\s*consulares?)\b/i.test(allText);
  if (!isActuallyMigration) {
    if (Array.isArray(publication.categorySelections)) {
      publication.categorySelections = publication.categorySelections.filter((c) => !/visa|migra|residencia\s*y\s*ciudadan/i.test(c));
      publication.category = publication.categorySelections[0] || "";
    }
    if (Array.isArray(publication.subcategorySelections)) {
      publication.subcategorySelections = publication.subcategorySelections.filter((s) => !/visa|migra|residencia\s*y\s*ciudadan/i.test(s));
      publication.subcategory = publication.subcategorySelections[0] || "";
    }
  }

  // Clean out arbitrary onboarding/meta category names if any
  if (Array.isArray(publication.categorySelections)) {
    publication.categorySelections = publication.categorySelections.filter(
      (c) => !/explorando\s*opciones|servicio\s*especializado|sin\s*requisitos/i.test(c)
    );
    publication.category = publication.categorySelections[0] || "";
  }
  if (Array.isArray(publication.subcategorySelections)) {
    publication.subcategorySelections = publication.subcategorySelections.filter(
      (s) => !/explorando\s*opciones|servicio\s*especializado|sin\s*requisitos/i.test(s)
    );
    publication.subcategory = publication.subcategorySelections[0] || "";
  }

  // Strict capping: allow up to 5 categories per publication
  if (Array.isArray(publication.categorySelections) && publication.categorySelections.length > 5) {
    publication.categorySelections = publication.categorySelections.slice(0, 5);
    publication.category = publication.categorySelections[0] || publication.category;
  }

  // Sync detected languages from text and URL
  const detectedLangs = detectLanguagesFromText(allText, taxonomies?.languages);
  if (detectedLangs && detectedLangs.length > 0) {
    const existingLangs = String(publication.languages || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const mergedLangs = Array.from(new Set([...existingLangs, ...detectedLangs]));
    publication.languages = mergedLangs.join(", ");
  }

  // 2. Guarantee valid founding year
  if (extractedData.detectedFoundingYear && (!publication.providerStartYear || publication.providerStartYear === "2015" || publication.providerStartYear === "2010" || publication.providerStartYear === "2024" || publication.providerStartYear === "2025" || publication.providerStartYear === "2026")) {
    publication.providerStartYear = extractedData.detectedFoundingYear;
  }
  if (!publication.providerStartYear || publication.providerStartYear === "2010" || publication.providerStartYear === "2015") {
    const calcYear = extractFoundingYear("", allText, publication.url, titleClean);
    if (calcYear) {
      publication.providerStartYear = calcYear;
    } else {
      publication.providerStartYear = "";
    }
  }
  if (publication.providerStartYear) {
    const yrNum = parseInt(publication.providerStartYear, 10);
    const currYr = new Date().getFullYear();
    if (isNaN(yrNum) || yrNum < 1600 || yrNum > currYr - 1 || yrNum === 2010 || yrNum === 2015) {
      publication.providerStartYear = "";
    } else {
      publication.providerStartYear = String(yrNum);
    }
  }

  // 3. Guarantee accurate rating and review count from real Google Maps of the primary headquarters
  if (extractedData.detectedRating && extractedData.detectedRating !== "0") {
    publication.providerRating = extractedData.detectedRating;
  }
  if (extractedData.detectedReviewCount && extractedData.detectedReviewCount !== "0") {
    publication.providerReviewCount = extractedData.detectedReviewCount;
  }
  if (extractedData.detectedCommentsUrl) {
    publication.providerCommentsUrl = extractedData.detectedCommentsUrl;
  }

  // 4. Build clean, precise Google Maps comments URL
  if (extractedData.detectedCommentsUrl && (!publication.providerCommentsUrl || publication.providerCommentsUrl === publication.url || !publication.providerCommentsUrl.includes("maps"))) {
    publication.providerCommentsUrl = extractedData.detectedCommentsUrl;
  } else if (!publication.providerCommentsUrl || !/^https?:\/\//i.test(publication.providerCommentsUrl) || publication.providerCommentsUrl === publication.url) {
    const cleanEntity = cleanTitleString(publication.publisherName || publication.title).split(/\s*[-–—|]\s*/)[0].trim() || publication.publisherName || publication.title;
    const parts = [
      cleanEntity,
      extractedData.detectedAddress || (publication.headquarterLocations?.[0]?.address),
      publication.headquarterCity || publication.city,
      publication.headquarterCountry || publication.country
    ].filter(Boolean);
    publication.providerCommentsUrl = buildGoogleMapsUrl(parts.join(", "));
  }

  // 5. Ensure headquarter locations has additional branches if multiple were detected
  if ((locInfo.additionalCities.length > 0 || (extractedData.detectedAllAddresses && extractedData.detectedAllAddresses.length > 1)) && (!publication.headquarterLocations || publication.headquarterLocations.length <= 1)) {
    publication.headquarterLocations = resolveHeadquarterLocations(
      publication.headquarterLocations,
      titleClean,
      publication.publisherName,
      locInfo.primaryCity,
      locInfo.primaryCountry,
      extractedData.detectedMapsUrl,
      allText,
      locInfo.additionalCities,
      extractedData.detectedAddress,
      extractedData.detectedAllAddresses || []
    );
  }

  // 6. Ensure destination countries is populated
  if (!publication.destinationCountries || publication.destinationCountries.length === 0) {
    publication.destinationCountries = locInfo.detectedCountries.length > 0
      ? locInfo.detectedCountries
      : [publication.country || "Argentina"];
  }

  // 7. Non-empty guarantee for all taxonomy selections
  if (!publication.providerActivities || publication.providerActivities.length === 0) {
    if (taxonomies?.activities?.length) {
      publication.providerActivities = [taxonomies.activities[0]];
    } else {
      publication.providerActivities = [];
    }
  }
  if (!publication.providerTypes || publication.providerTypes.length === 0) {
    if (taxonomies?.types?.length) {
      publication.providerTypes = [taxonomies.types[0]];
    } else {
      publication.providerTypes = [];
    }
  }
  if (!publication.providerModalities || publication.providerModalities.length === 0) {
    if (taxonomies?.modalities?.length) {
      const pres = taxonomies.modalities.find((m: string) => /presencial/i.test(m));
      publication.providerModalities = pres ? [pres] : [taxonomies.modalities[0]];
    } else {
      publication.providerModalities = [];
    }
  }
  if (!publication.categorySelections || publication.categorySelections.length === 0) {
    publication.categorySelections = [];
    publication.category = "";
  }

  return publication;
}

async function processUrlWithAI(
  url: string,
  taxonomies: any,
  preferredProvider: "auto" | "gemini" | "openai",
  geminiKey: string,
  openaiKey: string,
  customBlocks?: CustomScraperBlock[],
  customAdminPrompt?: string,
  customTitlePrompt?: string,
  customDescriptionPrompt?: string,
  includeScoreScout: boolean = true
): Promise<{ publication: ScrapedPublication; providerUsed: string }> {
  // 1. Scrape web page & enrich with Google Maps/Places targeting headquarters
  const extracted: any = await fetchPageContent(url);
  const locInfo = detectAllLocationsAndHeadquarters(extracted.textContent, extracted.url, extracted.title);
  let cleanPublisher = cleanPublisherName(extracted.title, extracted.url, extracted.title, extracted.detectedSiteName);
  const officialFullName = findOfficialOrganizationName(extracted.htmlContent || "", cleanPublisher, extracted.detectedSiteName);
  if (officialFullName && officialFullName !== cleanPublisher && /^[A-Z0-9]{2,8}$/.test(cleanPublisher.replace(/\s+/g, ""))) {
    cleanPublisher = officialFullName;
  }
  if (locInfo.primaryCity && !extracted.detectedCity) extracted.detectedCity = locInfo.primaryCity;
  if (locInfo.primaryCountry && !extracted.detectedCountry) extracted.detectedCountry = locInfo.primaryCountry;

  extracted.headquarterLocations = resolveHeadquarterLocations(
    undefined,
    extracted.title,
    cleanPublisher,
    locInfo.primaryCity,
    locInfo.primaryCountry,
    extracted.detectedMapsUrl,
    extracted.textContent,
    locInfo.additionalCities,
    extracted.detectedAddress,
    extracted.detectedAllAddresses || []
  );

  // Run Google Maps & search enrichment concurrently with AI execution
  const enrichPromise = enrichWithLiveGoogleMapsAndSearch(extracted, cleanPublisher, locInfo).catch((e) => {
    console.warn("[AI Scraper] Maps enrichment non-fatal error:", e?.message);
  });

  // Extract clean structured lists and paragraphs
  const paragraphs = (extracted.textContent || "").split(/\n\s*\n+/).map((p: string) => p.trim()).filter((p: string) => p.length > 25);
  const headings = Array.isArray(extracted.headings) ? extracted.headings : [];

  const cleanContext: CleanScrapedContext = {
    url,
    publisherName: cleanPublisher,
    rawPageTitle: extracted.title,
    metaDescription: extracted.description,
    headings,
    paragraphs,
    mainText: extracted.textContent,
    city: locInfo.primaryCity,
    country: locInfo.primaryCountry,
    address: extracted.detectedAddress,
    additionalCities: locInfo.additionalCities,
    additionalAddresses: extracted.detectedAllAddresses || [],
    sedesContext: (extracted as any).sedesText,
    foundingYear: extracted.detectedFoundingYear,
    rating: extracted.detectedRating,
    reviewCount: extracted.detectedReviewCount,
    commentsUrl: extracted.detectedCommentsUrl,
    logo: extracted.detectedLogo,
    images: extracted.images,
    socialLinks: extracted.socialLinksExtracted,
    apiKey: geminiKey || openaiKey,
    provider: preferredProvider,
    autoTranslate: false,
  };

  const providersUsed = new Set<string>();

  // If no AI keys are provided, seamlessly return high-precision grounded extraction
  const canUseAI = Boolean(geminiKey || openaiKey);
  if (!canUseAI) {
    await enrichPromise;
    const fallbackPub = await createFallbackPublication(
      extracted,
      taxonomies,
      customBlocks,
      customAdminPrompt,
      customTitlePrompt,
      customDescriptionPrompt,
      includeScoreScout
    );
    return {
      publication: enforceStrictTaxonomyGuardrails(fallbackPub, extracted, taxonomies),
      providerUsed: "extractor",
    };
  }

  // 2. Ejecución Inteligente: Probar Agente Unificado y Agente de Título Dedicado en paralelo con Maps enrichment
  let titleAgentRes: any;
  let descAgentRes: any;
  let providerInfoRes: any;
  let taxonomyRes: any;
  const extraDescriptions: ExtraDescriptionBlock[] = [];

  const effectiveTitlePrompt = (customTitlePrompt || "").trim() || (customAdminPrompt || "").trim();
  const effectiveDescPrompt = (customDescriptionPrompt || "").trim() || (customAdminPrompt || "").trim();

  let unifiedRes: any = null;
  let titleDedicatedRes: any = null;
  let descDedicatedRes: any = null;

  try {
    await enrichPromise;
    cleanContext.rating = extracted.detectedRating || "0";
    cleanContext.reviewCount = extracted.detectedReviewCount || "0";
    cleanContext.commentsUrl = extracted.detectedCommentsUrl;
    cleanContext.foundingYear = extracted.detectedFoundingYear;
    if (extracted.detectedAddress && isValidPhysicalStreetAddress(extracted.detectedAddress)) {
      cleanContext.address = extracted.detectedAddress;
    }

    const aiPromise = runUnifiedPublicationAgent({
      context: cleanContext,
      customTitlePrompt: effectiveTitlePrompt,
      customDescriptionPrompt: effectiveDescPrompt,
      customBlocks,
      taxonomies,
      includeScoreScout,
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("AI generation timeout")), 18000)
    );
    unifiedRes = await Promise.race([aiPromise, timeoutPromise]);
  } catch (uErr: any) {
    console.warn(`[AI Scraper] Unified agent skipped (${uErr?.message})`);
  }

  if (unifiedRes && unifiedRes.success && unifiedRes.data) {
    if (unifiedRes.providerUsed && unifiedRes.providerUsed !== "none") {
      providersUsed.add(unifiedRes.providerUsed);
    }

    // Title refinement from unified output if needed
    let uTitle = unifiedRes.data.title;
    const isBareEcho = Boolean(
      effectiveTitlePrompt &&
      uTitle &&
      (uTitle.trim().toLowerCase() === cleanPublisher.toLowerCase() ||
       (cleanContext.rawPageTitle && uTitle.trim().toLowerCase() === cleanTitleString(cleanContext.rawPageTitle).toLowerCase()))
    );

    if (isBareEcho) {
      uTitle = synthesizeMarketingTitle(cleanPublisher, cleanContext, effectiveTitlePrompt);
    }
    if (effectiveTitlePrompt && uTitle) {
      uTitle = enforceTitleConstraints(uTitle, effectiveTitlePrompt);
    }

    titleAgentRes = {
      success: true,
      data: {
        title: uTitle,
        titleI18n: { es: uTitle, en: "", pt: "", it: "" },
      },
      providerUsed: unifiedRes.providerUsed,
    };

    // Description normalization from unified output: enforce strict paragraph count & styling
    let uDesc = unifiedRes.data.description;
    if (effectiveDescPrompt && uDesc) {
      uDesc = enforceDescriptionParagraphCount(uDesc, effectiveDescPrompt);
      uDesc = enforceParagraphWordLimit(uDesc, effectiveDescPrompt);
      uDesc = applyPromptColorStyles(uDesc, effectiveDescPrompt);
    }

    descAgentRes = {
      success: true,
      data: {
        description: uDesc,
        descriptionI18n: { es: uDesc, en: "", pt: "", it: "" },
      },
      providerUsed: unifiedRes.providerUsed,
    };
    providerInfoRes = {
      success: true,
      data: {
        providerInfo: unifiedRes.data.providerInfo,
        providerInfoI18n: unifiedRes.data.providerInfoI18n,
        detectedPublisherName: unifiedRes.data.detectedPublisherName,
        detectedAddress: unifiedRes.data.detectedAddress,
        detectedCity: unifiedRes.data.detectedCity,
        detectedCountry: unifiedRes.data.detectedCountry,
      },
    };
    taxonomyRes = {
      success: true,
      data: unifiedRes.data.taxonomyData,
    };

    // Real Google Maps scraped metrics strictly take priority; if not scraped, adopt verified metrics from AI
    let finalScrapedRating = (extracted.detectedRating && extracted.detectedRating !== "0")
      ? extracted.detectedRating
      : undefined;

    if (!finalScrapedRating && unifiedRes?.data?.detectedRating && unifiedRes.data.detectedRating !== "0") {
      finalScrapedRating = unifiedRes.data.detectedRating;
    }

    cleanContext.rating = finalScrapedRating || "0";
    extracted.detectedRating = finalScrapedRating || "0";

    let finalScrapedReviewCount = (extracted.detectedReviewCount && extracted.detectedReviewCount !== "0")
      ? extracted.detectedReviewCount
      : undefined;

    if (!finalScrapedReviewCount && unifiedRes?.data?.detectedReviewCount && unifiedRes.data.detectedReviewCount !== "0") {
      finalScrapedReviewCount = unifiedRes.data.detectedReviewCount;
    }

    cleanContext.reviewCount = finalScrapedReviewCount || "0";
    extracted.detectedReviewCount = finalScrapedReviewCount || "0";

    if (unifiedRes?.data?.detectedAddress && (!extracted.detectedAddress || extracted.detectedAddress.length < 5)) {
      extracted.detectedAddress = unifiedRes.data.detectedAddress;
      cleanContext.address = unifiedRes.data.detectedAddress;
    }

    if (unifiedRes.data.detectedFoundingYear) {
      const yrCandidate = String(unifiedRes.data.detectedFoundingYear).trim();
      const textCorpus = `${extracted.textContent || ""} ${extracted.htmlContent || ""}`;
      const foundingRegex = new RegExp(`(?:fundad[oa]|inaugurad[oa]|cread[oa]|inici[oó]|abrió|constitu[ií]d[oa]|ley)\\b[\\s\\S]{0,50}\\b${yrCandidate}\\b|\\b${yrCandidate}\\b[\\s\\S]{0,50}(?:fundad[oa]|inaugurad[oa]|cread[oa]|inici[oó]|abrió|constitu[ií]d[oa]|ley)`, "i");
      if ((textCorpus.includes(yrCandidate) && foundingRegex.test(textCorpus)) || yrCandidate === extracted.detectedFoundingYear) {
        cleanContext.foundingYear = yrCandidate;
        extracted.detectedFoundingYear = yrCandidate;
      }
    } else if (extracted.detectedFoundingYear && !cleanContext.foundingYear) {
      cleanContext.foundingYear = extracted.detectedFoundingYear;
    }

    if (unifiedRes.data.detectedCommentsUrl && (!extracted.detectedCommentsUrl || !extracted.detectedCommentsUrl.includes("maps"))) {
      cleanContext.commentsUrl = unifiedRes.data.detectedCommentsUrl;
      extracted.detectedCommentsUrl = unifiedRes.data.detectedCommentsUrl;
    }

    // Score Scout Block (si está habilitado)
    if (includeScoreScout !== false) {
      const scoreBlock = buildScoreScoutBlock(
        cleanPublisher,
        cleanContext.foundingYear || "",
        cleanContext.rating || "5.0",
        extracted.textContent,
        undefined,
        url,
        cleanContext.reviewCount || "0"
      );
      extraDescriptions.push(scoreBlock);
    }

    // Agregar los bloques personalizados generados por la IA en base a los prompts
    if (Array.isArray(unifiedRes.data.extraDescriptions)) {
      for (const cb of unifiedRes.data.extraDescriptions) {
        extraDescriptions.push(cb);
      }
    }
  } else {
    // Si el agente unificado no respondió a tiempo o falló, recurrir inmediatamente a grounded extraction para evitar 504 en Vercel
    console.warn(`[AI Scraper] AI agent did not respond within limit for ${url}, switching directly to grounded extractor`);
    const fallbackPub = await createFallbackPublication(
      extracted,
      taxonomies,
      customBlocks,
      customAdminPrompt,
      customTitlePrompt,
      customDescriptionPrompt,
      includeScoreScout
    );

    // Asegurar título y descripción por IA si el administrador proporcionó directivas
    if (titleDedicatedRes && titleDedicatedRes.success && titleDedicatedRes.data?.title) {
      fallbackPub.title = titleDedicatedRes.data.title;
      fallbackPub.titleI18n = { es: titleDedicatedRes.data.title, en: "", pt: "", it: "" };
    } else if (canUseAI && effectiveTitlePrompt) {
      try {
        const titleFallback = await runTitleAgent(cleanContext, effectiveTitlePrompt);
        if (titleFallback?.success && titleFallback.data?.title) {
          fallbackPub.title = titleFallback.data.title;
          fallbackPub.titleI18n = { es: titleFallback.data.title, en: "", pt: "", it: "" };
        }
      } catch {}
    }

    if (descDedicatedRes && descDedicatedRes.success && descDedicatedRes.data?.description) {
      fallbackPub.description = descDedicatedRes.data.description;
      fallbackPub.descriptionI18n = descDedicatedRes.data.descriptionI18n || { es: descDedicatedRes.data.description, en: "", pt: "", it: "" };
    } else if (canUseAI && effectiveDescPrompt) {
      try {
        const descFallback = await runDescriptionAgent(cleanContext, effectiveDescPrompt);
        if (descFallback?.success && descFallback.data?.description) {
          fallbackPub.description = descFallback.data.description;
          fallbackPub.descriptionI18n = descFallback.data.descriptionI18n || { es: descFallback.data.description, en: "", pt: "", it: "" };
        }
      } catch {}
    }

    if (effectiveTitlePrompt) {
      const omitName = checkPromptOmitEntityName(effectiveTitlePrompt);
      const wantsMarketing = /(?:marketing|conversi[oó]n|llamativ|atenci[oó]n|bastante\s+largo|largo|impactante|vendedor)/i.test(effectiveTitlePrompt);
      const isBare = fallbackPub.title.trim().toLowerCase() === cleanPublisher.toLowerCase();
      if (omitName) {
        fallbackPub.title = cleanTitleOmitEntity(fallbackPub.title, cleanPublisher, cleanPublisher);
        if (!fallbackPub.title || fallbackPub.title.length < 8) {
          fallbackPub.title = synthesizeMarketingTitle(cleanPublisher, cleanContext, effectiveTitlePrompt);
        }
      } else if (isBare || !fallbackPub.title) {
        fallbackPub.title = synthesizeMarketingTitle(cleanPublisher, cleanContext, effectiveTitlePrompt);
      }
      fallbackPub.titleI18n = { es: fallbackPub.title, en: "", pt: "", it: "" };
    }

    if (fallbackPub.description && effectiveDescPrompt) {
      fallbackPub.description = enforceDescriptionParagraphCount(fallbackPub.description, effectiveDescPrompt);
      fallbackPub.description = applyPromptColorStyles(fallbackPub.description, effectiveDescPrompt);
      if (fallbackPub.descriptionI18n) {
        fallbackPub.descriptionI18n.es = fallbackPub.description;
      }
    }

    return {
      publication: enforceStrictTaxonomyGuardrails(fallbackPub, extracted, taxonomies),
      providerUsed: "extractor",
    };
  }

  // 5. Taxonomy & Location mapping
  let titleVal = cleanTitleString(titleAgentRes?.data?.title || extracted.title || cleanPublisher);
  if (!titleVal || /^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo|title|titulo)$/i.test(titleVal)) {
    titleVal = synthesizeMarketingTitle(cleanPublisher, cleanContext, effectiveTitlePrompt);
  }

  // Verificación de seguridad: si el admin dio una directiva de título pero el título actual coincide
  // exactamente con el <title> crudo del sitio web o con el nombre seco de la entidad, significa que no se aplicó el prompt.
  const rawSiteTitle = cleanTitleString(extracted.title || "");
  if (effectiveTitlePrompt) {
    const omitName = checkPromptOmitEntityName(effectiveTitlePrompt);
    const wantsMarketing = /(?:marketing|conversi[oó]n|llamativ|atenci[oó]n|bastante\s+largo|largo|impactante|vendedor)/i.test(effectiveTitlePrompt);
    const isBareEcho = Boolean(
      titleVal &&
      (titleVal.trim().toLowerCase() === cleanPublisher.toLowerCase() ||
       (rawSiteTitle && titleVal.trim().toLowerCase() === rawSiteTitle.toLowerCase()))
    );

    if (isBareEcho && canUseAI) {
      try {
        console.log(`[AI Scraper] Title was raw web title echo ("${titleVal}"). Invoking dedicated title agent.`);
        const directTitleRes = await runTitleAgent(cleanContext, effectiveTitlePrompt);
        if (directTitleRes?.success && directTitleRes.data?.title) {
          titleVal = directTitleRes.data.title;
          if (directTitleRes.providerUsed && directTitleRes.providerUsed !== "none") {
            providersUsed.add(directTitleRes.providerUsed);
          }
        }
      } catch (tErr: any) {
        console.warn(`[AI Scraper] Direct title agent invocation failed:`, tErr?.message);
        titleVal = synthesizeMarketingTitle(cleanPublisher, cleanContext, effectiveTitlePrompt);
      }
    }

    if (omitName) {
      titleVal = cleanTitleOmitEntity(titleVal, cleanPublisher, cleanPublisher);
      if (!titleVal || titleVal.length < 8) {
        titleVal = synthesizeMarketingTitle(cleanPublisher, cleanContext, effectiveTitlePrompt);
      }
    } else if (titleVal.trim().toLowerCase() === cleanPublisher.toLowerCase() || !titleVal) {
      titleVal = synthesizeMarketingTitle(cleanPublisher, cleanContext, effectiveTitlePrompt);
    }
    titleVal = enforceTitleConstraints(titleVal, effectiveTitlePrompt);
  }

  const titleI18nVal = { es: titleVal, en: "", pt: "", it: "" };
  let descVal = descAgentRes?.data?.description || extracted.description || "";
  if (effectiveDescPrompt && descVal) {
    descVal = enforceDescriptionParagraphCount(descVal, effectiveDescPrompt);
    descVal = applyPromptColorStyles(descVal, effectiveDescPrompt);
  }
  const descI18nVal = descAgentRes?.data?.descriptionI18n
    ? {
        ...descAgentRes.data.descriptionI18n,
        es: descVal,
      }
    : { es: descVal, en: "", pt: "", it: "" };

  const aiLocations = Array.isArray(unifiedRes?.data?.headquarterLocations) && unifiedRes.data.headquarterLocations.length > 0
    ? unifiedRes.data.headquarterLocations
    : (Array.isArray(extracted.headquarterLocations) && extracted.headquarterLocations.length > 0
      ? extracted.headquarterLocations
      : undefined);

  const headquarterLocations = resolveHeadquarterLocations(
    aiLocations,
    titleVal,
    cleanPublisher,
    locInfo.primaryCity,
    locInfo.primaryCountry,
    extracted.detectedCommentsUrl || extracted.detectedMapsUrl || unifiedRes?.data?.detectedCommentsUrl || "",
    extracted.textContent,
    locInfo.additionalCities,
    extracted.detectedAddress || unifiedRes?.data?.detectedAddress,
    extracted.detectedAllAddresses || []
  );

  const cleanEntityPublisher = cleanPublisherName(cleanPublisher)
    .replace(/^(?:lead\s+enviado|formulario\s+enviado|gracias(?:\s+por(?:\s+tu)?\s+consulta)?|consulta\s+enviada|solicitud\s+enviada|confirmaci[oó]n|contacto)\s*[-–—|:]\s*/i, "")
    .split(/\s*[-–—|]\s*/)[0].trim() || cleanPublisher;
  const primaryCleanAddr = cleanAddressForSearch(extracted.detectedAddress || unifiedRes?.data?.detectedAddress);
  const primaryHq = headquarterLocations[0] || {
    country: locInfo.primaryCountry,
    city: locInfo.primaryCity,
    address: primaryCleanAddr || undefined,
    mapUrl: buildGoogleMapsUrl([cleanEntityPublisher, primaryCleanAddr, locInfo.primaryCity, locInfo.primaryCountry].filter(Boolean).join(", ")),
  };

  const dynamicFallbackClassified = classifySectorAndTaxonomy(url, titleVal, extracted.textContent, taxonomies);

  const finalTaxonomyData = (taxonomyRes?.success && taxonomyRes?.data)
    ? taxonomyRes.data
    : dynamicFallbackClassified;

  const detectedLanguages = (taxonomyRes?.success && taxonomyRes?.data?.languages?.length)
    ? taxonomyRes.data.languages
    : detectLanguagesFromText(extracted.textContent, taxonomies?.languages);

  const aiProviderInfo = providerInfoRes?.data?.providerInfoI18n;
  const pInfoEs = aiProviderInfo?.es || providerInfoRes?.data?.providerInfo || "";
  const providerInfoI18nVal = (pInfoEs && !pInfoEs.includes("es un establecimiento y prestador de servicios") && pInfoEs.length > 20)
    ? {
        es: pInfoEs,
        en: aiProviderInfo?.en || "",
        pt: aiProviderInfo?.pt || "",
        it: aiProviderInfo?.it || "",
      }
    : {
        es: buildRichProviderInfo(cleanPublisher, primaryHq.city, primaryHq.country, extracted, descVal),
        en: "",
        pt: "",
        it: "",
      };

  // Apply prompt-driven color styling to ALL extraDescriptions
  for (const extra of extraDescriptions) {
    if (!extra.prompt && Array.isArray(customBlocks)) {
      const matchCb = customBlocks.find((cb) => cb.title && cb.title.trim().toLowerCase() === extra.title.trim().toLowerCase());
      if (matchCb?.prompt) {
        extra.prompt = matchCb.prompt;
      }
    }
    if (extra.prompt && extra.body) {
      const filtered = enforceFaqCountAndFilter(extra.body, extra.prompt);
      const styled = applyPromptColorStyles(filtered, extra.prompt);
      extra.body = styled;
      extra.contenido = styled;
      if (extra.bodyI18n) {
        extra.bodyI18n.es = styled;
      }
    }
  }

  const publication: ScrapedPublication = {
    url,
    title: titleVal,
    titleI18n: titleI18nVal,
    description: descVal,
    descriptionI18n: descI18nVal,
    extraDescriptions,
    publisherName: cleanPublisher,
    providerInfo: providerInfoI18nVal.es,
    providerInfoI18n: providerInfoI18nVal,
    providerStartYear: (() => {
      let candidateYear = String(cleanContext.foundingYear || extracted.detectedFoundingYear || "").trim();
      if (!candidateYear) return "";
      const yrNum = parseInt(candidateYear, 10);
      const currYr = new Date().getFullYear();
      if (isNaN(yrNum) || yrNum < 1600 || yrNum > currYr - 1 || yrNum === 2010 || yrNum === 2015) {
        return "";
      }
      return String(yrNum);
    })(),
    providerRating: (extracted.detectedRating && extracted.detectedRating !== "0")
      ? extracted.detectedRating
      : ((cleanContext.rating && cleanContext.rating !== "0")
        ? cleanContext.rating
        : (unifiedRes?.data?.detectedRating && unifiedRes.data.detectedRating !== "0" ? unifiedRes.data.detectedRating : "0")),
    providerReviewCount: (extracted.detectedReviewCount && extracted.detectedReviewCount !== "0")
      ? extracted.detectedReviewCount
      : ((cleanContext.reviewCount && cleanContext.reviewCount !== "0")
        ? cleanContext.reviewCount
        : (unifiedRes?.data?.detectedReviewCount && unifiedRes.data.detectedReviewCount !== "0" ? unifiedRes.data.detectedReviewCount : "0")),
    providerCommentsUrl: primaryHq.mapUrl || extracted.detectedCommentsUrl || cleanContext.commentsUrl || unifiedRes?.data?.detectedCommentsUrl || "",
    providerLogo: cleanContext.logo || "",
    country: primaryHq.country,
    city: primaryHq.city,
    headquarterCountry: primaryHq.country,
    headquarterCity: primaryHq.city,
    locationAddress: primaryHq.mapUrl,
    destinationCountries: locInfo.detectedCountries.length ? locInfo.detectedCountries : [primaryHq.country],
    headquarterLocations,
    currency: "USD",
    price: "A consultar",
    languages: Array.isArray(detectedLanguages) && detectedLanguages.length ? detectedLanguages.join(", ") : "Español",
    website: url,
    socialLinksDetailed: extracted.socialLinksExtracted || [{ kind: "web", label: "Sitio Oficial", url }],
    images: extracted.images || [],
    category: finalTaxonomyData.category || (finalTaxonomyData.categorySelections?.[0] || ""),
    subcategory: finalTaxonomyData.subcategory || (finalTaxonomyData.subcategorySelections?.[0] || ""),
    categorySelections: Array.isArray(finalTaxonomyData.categorySelections) ? finalTaxonomyData.categorySelections : (dynamicFallbackClassified.categorySelections || []),
    subcategorySelections: Array.isArray(finalTaxonomyData.subcategorySelections) ? finalTaxonomyData.subcategorySelections : (dynamicFallbackClassified.subcategorySelections || []),
    providerActivities: Array.isArray(finalTaxonomyData.providerActivities) ? finalTaxonomyData.providerActivities : (dynamicFallbackClassified.providerActivities || []),
    providerTypes: Array.isArray(finalTaxonomyData.providerTypes) ? finalTaxonomyData.providerTypes : (dynamicFallbackClassified.providerTypes || []),
    providerModalities: Array.isArray(finalTaxonomyData.providerModalities) ? finalTaxonomyData.providerModalities : (dynamicFallbackClassified.providerModalities || []),
    scrapedHeadings: headings.slice(0, 20),
    scrapedParagraphs: paragraphs.slice(0, 15),
    scrapedTextContent: (extracted.textContent || "").slice(0, 5000),
    rawPageTitle: extracted.title || "",
    prestaciones: finalTaxonomyData.prestaciones || [],
    customTitlePrompt: customTitlePrompt || customAdminPrompt || "",
    customDescriptionPrompt: customDescriptionPrompt || customAdminPrompt || "",
  } as any;

  // Enforce taxonomy structure only (without altering title/description text!)
  const finalPub = enforceStrictTaxonomyGuardrails(publication, extracted, taxonomies);

  return {
    publication: finalPub,
    providerUsed: Array.from(providersUsed).join(", ") || "gemini",
  };
}

/**
 * Concurrently processes an array of items with a fixed concurrency limit.
 */
async function processBatchWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await task(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawUrls: string[] = Array.isArray(body.urls)
      ? body.urls
      : body.url
      ? [body.url]
      : [];

    const urls = rawUrls
      .map((u: any) => String(u || "").trim())
      .filter((u: string) => u.length > 3)
      .map((u: string) => (/^https?:\/\//i.test(u) ? u : "https://" + u));

    if (!urls.length) {
      return NextResponse.json(
        { error: "Debe proporcionar al menos una URL válida para analizar." },
        { status: 400 }
      );
    }

    const taxonomies = await getAvailableSystemTaxonomies(body.categoriesPayload, body.filterGroupsPayload);

    const rawCustomBlocks = Array.isArray(body.customBlocks) ? body.customBlocks : [];
    const customBlocks: CustomScraperBlock[] = rawCustomBlocks
      .filter((b: any) => b && typeof b.title === "string" && b.title.trim())
      .map((b: any) => ({
        title: String(b.title).trim(),
        prompt: b.prompt ? String(b.prompt).trim() : undefined,
      }));

    // Collect custom prompts if configured by the admin
    const rawPrompts = Array.isArray(body.customPrompts)
      ? body.customPrompts
      : body.customPrompt
      ? [body.customPrompt]
      : [];
    const customAdminPrompt = rawPrompts
      .map((p: any) => String(p || "").trim())
      .filter(Boolean)
      .join(". ");

    const customTitlePrompt = typeof body.customTitlePrompt === "string" ? body.customTitlePrompt.trim() : undefined;
    const customDescriptionPrompt = typeof body.customDescriptionPrompt === "string" ? body.customDescriptionPrompt.trim() : undefined;
    const includeScoreScout = body.includeScoreScout !== false;

    const customKey = String(body.apiKey || "").trim();
    const requestedProvider = String(body.provider || "auto").toLowerCase();

    // Check environment variables first, then custom client-supplied API key
    const geminiKey =
      (customKey && (customKey.startsWith("AIza") || !customKey.startsWith("sk-")) ? customKey : "") ||
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";

    const openaiKey =
      (customKey && customKey.startsWith("sk-") ? customKey : "") ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      "";

    const envProvider = (process.env.AI_SCRAPER_PROVIDER || "auto").toLowerCase();
    const effectiveProvider: "auto" | "gemini" | "openai" =
      requestedProvider !== "auto"
        ? (requestedProvider as "gemini" | "openai")
        : envProvider === "openai"
        ? "openai"
        : "gemini";

    const targetUrls = urls.slice(0, 10);
    const providersUsed = new Set<string>();
    const batchErrors: string[] = [];

    // Process up to 10 URLs concurrently in mini-batches of 2 with error isolation per URL
    const batchResults = await processBatchWithConcurrency(targetUrls, 2, async (url) => {
      try {
        const { publication, providerUsed } = await processUrlWithAI(
          url,
          taxonomies,
          effectiveProvider,
          geminiKey,
          openaiKey,
          customBlocks,
          customAdminPrompt,
          customTitlePrompt,
          customDescriptionPrompt,
          includeScoreScout
        );
        if (providerUsed) providersUsed.add(providerUsed);
        return publication;
      } catch (err: any) {
        if (err?.message && err.message.includes("El dominio no existe o está mal escrito")) {
          batchErrors.push(err.message);
          return null;
        }
        console.warn(`[AI Scraper] AI agent execution failed for URL ${url}, falling back to grounded extraction:`, err?.message);
        try {
          const extractedFallback: any = await fetchPageContent(url);
          const fallbackPub = await createFallbackPublication(
            extractedFallback,
            taxonomies,
            customBlocks,
            customAdminPrompt,
            customTitlePrompt,
            customDescriptionPrompt,
            includeScoreScout
          );
          providersUsed.add("extractor");
          return enforceStrictTaxonomyGuardrails(fallbackPub, extractedFallback, taxonomies);
        } catch (fatalErr: any) {
          batchErrors.push(fatalErr?.message || err?.message || `Error procesando ${url}`);
          console.error(`[AI Scraper] Critical error processing URL ${url}:`, fatalErr?.message || err?.message);
          return null;
        }
      }
    });

    const validPublications = batchResults.filter(Boolean) as ScrapedPublication[];

    if (validPublications.length === 0) {
      const specificError = batchErrors.length > 0
        ? batchErrors[0]
        : "No se pudo extraer contenido válido de ninguna de las URLs proporcionadas.";
      return NextResponse.json(
        { error: specificError },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      providerUsed: Array.from(providersUsed).join(", ") || effectiveProvider,
      count: validPublications.length,
      publications: validPublications,
    });
  } catch (error: any) {
    console.error("AI Scraper Route Error:", error);
    return NextResponse.json(
      { error: error?.message ? `Error al procesar con IA: ${error.message}` : "Error al procesar la solicitud con IA." },
      { status: 500 }
    );
  }
}
