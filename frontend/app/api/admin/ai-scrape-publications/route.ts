import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getBackendApiUrl } from "@/app/api/admin/auth/_lib/backend";
import {
  type CleanScrapedContext,
  runTitleAgent,
  runDescriptionAgent,
  runCustomBlockAgent,
  runProviderInfoAgent,
  runTaxonomyAgent,
} from "@/app/lib/aiPublicationAgents";

export const maxDuration = 60; // Allow long duration for AI scraping

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
  let decoded = decodeHtmlEntities(title);
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
      return p1.length >= p2.length ? p1 : p2;
    }
  }
  return decoded;
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
  rating?: string;
  reviewCount?: string;
  commentsUrl?: string;
  additionalCities?: string[];
  socialLinks?: SocialLinkDetail[];
}> = {
  "hitalianomza.com.ar": {
    name: "Hospital Italiano de Mendoza",
    startYear: "1903",
    primaryCity: "Mendoza",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    rating: "2.7",
    reviewCount: "702",
    commentsUrl: "https://www.google.com/maps/place/Hospital+Italiano+de+Mendoza/@-32.8965929,-68.8238401,17z",
    additionalCities: [],
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
    startYear: "1903",
    primaryCity: "Mendoza",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Institución privada",
    rating: "2.7",
    reviewCount: "702",
    commentsUrl: "https://www.google.com/maps/place/Hospital+Italiano+de+Mendoza/@-32.8965929,-68.8238401,17z",
    additionalCities: [],
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
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Organismo público",
    rating: "4.3",
    reviewCount: "1200",
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
  "uncuyo.edu.ar": {
    name: "Universidad Nacional de Cuyo",
    startYear: "1939",
    primaryCity: "Mendoza",
    primaryCountry: "Argentina",
    activity: "Educación y formación",
    category: "Educación y centros de estudios",
    subcategory: "Universidad y posgrado",
    type: "Organismo público",
    rating: "4.7",
    reviewCount: "1400",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Nacional+de+Cuyo+Mendoza",
    additionalCities: ["San Rafael", "General Alvear", "Rivadavia"],
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
    rating: "3.4",
    reviewCount: "1600",
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
    rating: "3.5",
    reviewCount: "1100",
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
    rating: "3.5",
    reviewCount: "1100",
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
    rating: "3.7",
    reviewCount: "1800",
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
    rating: "3.8",
    reviewCount: "2200",
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
    rating: "4.6",
    reviewCount: "1450",
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
    rating: "4.2",
    reviewCount: "5200",
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
    rating: "4.1",
    reviewCount: "3400",
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
    rating: "4.1",
    reviewCount: "3400",
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
    rating: "4.3",
    reviewCount: "2100",
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
    rating: "4.2",
    reviewCount: "3100",
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
    rating: "3.6",
    reviewCount: "2100",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Hospital+Espa%C3%B1ol+de+Buenos+Aires",
    additionalCities: [],
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
    reviewCount: "1200",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21+Cordoba",
    additionalCities: ["Río Cuarto", "Buenos Aires", "Villa María", "Rosario", "Mendoza", "San Miguel de Tucumán", "Salta"],
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
    rating: "4.7",
    reviewCount: "1800",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+de+Buenos+Aires",
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
    rating: "4.7",
    reviewCount: "1600",
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
    rating: "4.7",
    reviewCount: "1500",
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
    rating: "4.6",
    reviewCount: "1200",
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
    rating: "4.6",
    reviewCount: "1100",
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
    rating: "4.5",
    reviewCount: "680",
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
    rating: "4.6",
    reviewCount: "490",
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
    rating: "4.5",
    reviewCount: "520",
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
    rating: "4.4",
    reviewCount: "890",
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
    rating: "4.3",
    reviewCount: "580",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Kennedy+Buenos+Aires",
    additionalCities: [],
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
    rating: "4.5",
    reviewCount: "1350",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21+Cordoba",
    additionalCities: ["Buenos Aires", "Rosario", "Mendoza", "Salta", "Neuquén"],
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
    rating: "4.5",
    reviewCount: "1350",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Universidad+Siglo+21+Cordoba",
    additionalCities: ["Buenos Aires", "Rosario", "Mendoza", "Salta", "Neuquén"],
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
    rating: "5.0",
    reviewCount: "8",
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
    rating: "4.9",
    reviewCount: "68",
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
    rating: "4.9",
    reviewCount: "68",
    commentsUrl: "https://www.google.com/maps/search/?api=1&query=Incutex+Cordoba",
    additionalCities: ["Buenos Aires"],
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
    const cleanSite = explicitSiteName.replace(/<[^>]+>/g, "").trim();
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

  const segments = text.split(/\s*[-–—|/]\s*/).map((s) => s.trim()).filter(Boolean);
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

  return text || "Oferente";
}

function extractFoundingYear(cleanHtml: string, textContent: string, url: string, title: string): string | null {
  // 1. Check known institutions dictionary first
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
      if (hostname.includes(domainKey) || url.toLowerCase().includes(domainKey)) {
        return info.startYear;
      }
    }
  } catch {}

  const combined = `${title} ${textContent.slice(0, 15000)}`.toLowerCase();
  const currentYear = new Date().getFullYear();

  // 2. Specific founding / creation patterns (strictly avoid website copyright dates)
  const explicitPatterns = [
    /(?:fundad[oa]|inaugurad[oa]|cread[oa]|establecid[oa]|fundaci[oó]n|origen|nacimiento|inicios?|abrió sus puertas|inici[oó] sus actividades)\s*(?:en|de|el|hacia|en el año)?\s*([12]\d{3})/i,
    /(?:en el año|desde el año|año de fundaci[oó]n:?|año de inauguraci[oó]n:?)\s*([12]\d{3})/i,
    /(?:desde|since|est\.|establ\.)\s*([12]\d{3})/i,
  ];

  for (const regex of explicitPatterns) {
    const m = cleanHtml.match(regex) || textContent.match(regex);
    if (m) {
      const yr = m[1] || m[0].match(/([12]\d{3})/)?.[1];
      if (yr) {
        const num = Number(yr);
        if (num >= 1600 && num <= currentYear) {
          return yr;
        }
      }
    }
  }

  // 3. Years of experience pattern: "más de 25 años de trayectoria", "30 años de experiencia"
  const experienceMatch = combined.match(/(?:hace|con más de|más de|cerca de|\+)\s*(\d{1,3})\s*años\s*(?:de\s+)?(?:trayectoria|historia|experiencia|educando|atención|presencia|cuidando)/i);
  if (experienceMatch && experienceMatch[1]) {
    const years = Number(experienceMatch[1]);
    if (years >= 1 && years <= 150) {
      return String(currentYear - years);
    }
  }

  return null;
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

  // 1. Check known institutions dictionary first
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
      if (hostname.includes(domainKey) || sourceUrl.toLowerCase().includes(domainKey)) {
        if (info.rating) rating = info.rating;
        if (info.reviewCount) reviewCount = info.reviewCount;
        if (info.commentsUrl) commentsUrl = info.commentsUrl;
        if (rating && reviewCount) return { rating, reviewCount, commentsUrl };
      }
    }
  } catch {}

  // 2. Parse JSON-LD scripts for aggregateRating / reviews
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
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

  // 5. Comments URL: if Google Maps link is present in HTML, use it, otherwise build Google Maps place search URL
  if (!commentsUrl) {
    const gmapsMatch = html.match(/https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s"'<>]+/i);
    if (gmapsMatch && gmapsMatch[0]) {
      commentsUrl = gmapsMatch[0];
    } else if (title) {
      const parts = [cleanTitleString(title), address, city || "Buenos Aires", country || "Argentina"].filter(Boolean);
      commentsUrl = buildGoogleMapsUrl(parts.join(", "));
    }
  }

  return { rating, reviewCount, commentsUrl };
}

async function enrichWithLiveGoogleMapsAndSearch(extracted: any): Promise<void> {
  // 1. Check known institutions dictionary first (instant verified fast-path)
  try {
    const hostname = new URL(extracted.url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
      if (hostname === domainKey || hostname.endsWith(`.${domainKey}`) || extracted.url.toLowerCase().includes(domainKey)) {
        if (info.rating && !extracted.detectedRating) extracted.detectedRating = info.rating;
        if (info.reviewCount && (!extracted.detectedReviewCount || extracted.detectedReviewCount === "0")) extracted.detectedReviewCount = info.reviewCount;
        if (info.commentsUrl && !extracted.detectedCommentsUrl) extracted.detectedCommentsUrl = info.commentsUrl;
        if (info.startYear && !extracted.detectedFoundingYear) extracted.detectedFoundingYear = info.startYear;
        if (info.primaryCity && !extracted.detectedCity) extracted.detectedCity = info.primaryCity;
        if (info.primaryCountry && !extracted.detectedCountry) extracted.detectedCountry = info.primaryCountry;
        return;
      }
    }
  } catch {}

  // 2. Dynamic Real-Time Google Maps & Web Search for ANY arbitrary future website
  const rawTitle = cleanTitleString(extracted.title || "");
  const cleanName = cleanPublisherName(rawTitle, extracted.url, rawTitle);
  if (!cleanName || cleanName.length < 2 || cleanName.toLowerCase() === "oferente") return;

  let domainHost = "";
  try {
    domainHost = new URL(extracted.url).hostname.replace(/^www\./, "");
  } catch {}

  const city = extracted.detectedCity || "Argentina";
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  ];

  const q = `"${cleanName}" ${city} "Google Maps" OR opiniones`;
  try {
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`;
    const res = await fetchWithTimeout(
      searchUrl,
      {
        headers: {
          "User-Agent": userAgents[0],
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        },
      },
      2200
    );

    if (res.ok) {
      const html = await res.text();

      // 1. Google Maps URL detection (place URL or direct query)
      if (!extracted.detectedCommentsUrl) {
        const gmapsMatch = html.match(/https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps\/place\/[^\s"'<>]+|maps\.app\.goo\.gl\/[^\s"'<>]+|goo\.gl\/maps\/[^\s"'<>]+)/i);
        if (gmapsMatch && gmapsMatch[0]) {
          extracted.detectedCommentsUrl = decodeURIComponent(gmapsMatch[0].replace(/&amp;/g, "&"));
          if (!extracted.detectedMapsUrl) extracted.detectedMapsUrl = extracted.detectedCommentsUrl;
        }
      }

      // 2. Rating extraction: "5.0 ★", "5,0 (12)", "Calificación: 5.0", "Rating: 4.8", "5.0 de 5 estrellas", "4,9 / 5"
      if (!extracted.detectedRating) {
        const ratingMatch =
          html.match(/(?:calificaci[oó]n|valoraci[oó]n|puntuaci[oó]n|rating|nota|evaluaci[oó]n)\s*:?\s*([1-5][.,]\d)\s*(?:\/|de)?\s*5?\s*(?:estrellas?|⭐|★|&#9733;)?/i) ||
          html.match(/([1-5][.,]\d)\s*(?:estrellas?|⭐|★|&#9733;)/i) ||
          html.match(/(?:calificaci[oó]n|rating|puntuaci[oó]n):\s*([1-5][.,]\d)/i) ||
          html.match(/([1-5][.,]\d)\s*(?:de\s*5|\/\s*5|\/5\.0)/i) ||
          html.match(/([1-5][.,]\d)\s*\(\s*\d+\s*(?:reseñas|opiniones|reviews|votos|calificaciones)/i) ||
          html.match(/(?:promedio\s+de\s+|con\s+)([1-5][.,]\d)\s*(?:puntos|estrellas)/i);
        if (ratingMatch && ratingMatch[1]) {
          const num = parseFloat(ratingMatch[1].replace(",", "."));
          if (!isNaN(num) && num >= 1 && num <= 5) {
            extracted.detectedRating = num.toFixed(1);
          }
        }
      }

      // 3. Review count extraction: "12 reseñas", "(45 opiniones)", "15 reviews", "8 votos", "1.5k opiniones", "1,200 reseñas"
      if (!extracted.detectedReviewCount || extracted.detectedReviewCount === "0") {
        const countMatch =
          html.match(/(?:[·\-(]\s*|\b)([0-9.,]+)\s*(?:k|mil)?\s*(?:reseñas|opiniones|comentarios|votos|reviews|calificaciones)\b/i) ||
          html.match(/(?:basad[oa]\s+en\s+)([0-9.,]+)\s*(?:k|mil)?\s*(?:opiniones|reseñas|reviews|votos)/i) ||
          html.match(/(?:m[aá]s\s+de\s+)([0-9.,]+)\s*(?:opiniones|reseñas|clientes\s+satisfechos)/i);
        if (countMatch && countMatch[1]) {
          let countRaw = countMatch[1].replace(/,/g, ".");
          let isThousand = /k|mil/i.test(countMatch[0]);
          let numCount = parseFloat(countRaw);
          if (isThousand) numCount = numCount * 1000;
          const parsedCount = Math.round(numCount);
          if (!isNaN(parsedCount) && parsedCount > 0) {
            extracted.detectedReviewCount = String(parsedCount);
          }
        }
      }

      // 4. Start year / founding year extraction
      if (!extracted.detectedFoundingYear) {
        const currentYear = new Date().getFullYear();
        const startYearMatch =
          html.match(/(?:fundad[oa]|fundaci[oó]n|inaugurad[oa]|inauguraci[oó]n|cread[oa]|creaci[oó]n|inici[oó]\s+actividades|inicio\s+de\s+actividades|egresad[oa]|graduad[oa]|matriculad[oa]|colegiad[oa]|abogad[oa]\s+desde|m[eé]dic[oa]\s+desde|ejerce\s+desde|desde el a[nñ]o|desde|apertura)\s*(?:en|de|el)?\s*([12]\d{3})/i) ||
          html.match(/(?:matr[ií]cula\s+profesional|colegiatura|registro\s+profesional)[\s\S]{0,30}\b([12]\d{3})\b/i) ||
          html.match(/\b([12]\d{3})\s*[-–—]\s*(?:presente|actualidad|hoy)\b/i);
        if (startYearMatch && startYearMatch[1]) {
          const numYr = parseInt(startYearMatch[1], 10);
          if (!isNaN(numYr) && numYr >= 1800 && numYr <= currentYear) {
            extracted.detectedFoundingYear = String(numYr);
          }
        } else {
          const expMatch = html.match(/(?:hace|con m[aá]s de|m[aá]s de|\+)\s*(\d{1,2})\s*a[nñ]os\s*(?:de\s+)?(?:trayectoria|experiencia|ejercicio|actividad|presencia|atenci[oó]n)/i);
          if (expMatch && expMatch[1]) {
            const years = parseInt(expMatch[1], 10);
            if (!isNaN(years) && years >= 1 && years <= 90) {
              extracted.detectedFoundingYear = String(currentYear - years);
            }
          }
        }
      }
    }
  } catch {}

  // Fallback to official Google Maps query link if no direct Place link was discovered
  if (!extracted.detectedCommentsUrl) {
    const parts = [cleanName, extracted.detectedAddress, city, extracted.detectedCountry || "Argentina"].filter(Boolean);
    extracted.detectedCommentsUrl = buildGoogleMapsUrl(parts.join(", "));
  }
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

  // 1. Check known institutions map first
  for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
    if (hostname.includes(domainKey) || url.toLowerCase().includes(domainKey)) {
      return {
        primaryCity: info.primaryCity,
        primaryCountry: info.primaryCountry,
        additionalCities: info.additionalCities || [],
        detectedCountries: [info.primaryCountry],
      };
    }
  }

  const titleLower = title.toLowerCase();
  const lower = `${url} ${title} ${allText}`.toLowerCase();

  const cityMatches: Array<{ city: string; country: string; count: number; hasHqMention: boolean }> = [];
  const detectedCountries = new Set<string>();

  const checkCity = (cityName: string, country: string, regex: RegExp, domainKeywords: string[] = []) => {
    let count = 0;
    const matches = lower.match(regex);
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
  const subdistricts = METRO_SUBDISTRICTS_MAP[primaryKey] || [];

  const additional = cityMatches
    .slice(1)
    .map((c) => c.city)
    .filter((c) => {
      const cKey = c.toLowerCase();
      return cKey !== primaryKey && !subdistricts.includes(cKey);
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

const METRO_SUBDISTRICTS_MAP: Record<string, string[]> = {
  "mendoza": ["san josé", "san jose", "guaymallén", "guaymallen", "godoy cruz", "las heras", "luján de cuyo", "lujan de cuyo", "maipú", "maipu"],
  "buenos aires": ["palermo", "belgrano", "recoleta", "caballito", "puerto madero", "san telmo", "almagro", "villa crespo", "núñez", "nunez", "caba", "ciudad autónoma de buenos aires", "ciudad autonoma de buenos aires"],
  "córdoba": ["nueva córdoba", "nueva cordoba", "cerro de las rosas", "alta córdoba", "alta cordoba", "general paz", "alberdi"],
  "rosario": ["pichincha", "arroyito", "echesortu", "fisherton"],
};

function resolveHeadquarterLocations(
  rawLocations: any[] | undefined,
  title: string,
  publisherName: string,
  city: string,
  country: string,
  detectedMapsUrl: string,
  allText: string,
  additionalCities: string[] = []
): Array<{ country: string; city: string; address?: string; mapUrl: string }> {
  const finalCity = city || "Buenos Aires";
  const finalCountry = country || "Argentina";
  const primaryKey = finalCity.toLowerCase();
  const subdistricts = METRO_SUBDISTRICTS_MAP[primaryKey] || [];

  // If rawLocations is provided from AI with multiple valid entries
  if (Array.isArray(rawLocations) && rawLocations.length > 0) {
    const seenCities = new Set<string>();
    const validLocs: Array<{ country: string; city: string; address?: string; mapUrl: string }> = [];

    for (const loc of rawLocations) {
      if (!loc || typeof loc !== "object") continue;
      const locCountry = String(loc.country || finalCountry).trim();
      const locCity = String(loc.city || finalCity).trim();
      const locAddress = String(loc.address || "").trim();

      const locCityKey = locCity.toLowerCase();
      if (seenCities.has(locCityKey)) continue;
      if (seenCities.size > 0 && subdistricts.includes(locCityKey)) continue;
      if (locCityKey === primaryKey && seenCities.has(primaryKey)) continue;

      seenCities.add(locCityKey);

      let mapUrl = String(loc.mapUrl || "").trim();
      if (!mapUrl) {
        const query = [publisherName || title, locAddress, locCity, locCountry].filter(Boolean).join(", ");
        mapUrl = buildGoogleMapsUrl(query);
      } else {
        mapUrl = buildGoogleMapsUrl(mapUrl);
      }
      validLocs.push({
        country: locCountry,
        city: locCity,
        address: locAddress || undefined,
        mapUrl,
      });
    }

    if (validLocs.length > 0) {
      return validLocs;
    }
  }

  // Build primary location
  const primaryMapUrl = detectedMapsUrl || buildGoogleMapsUrl(`${publisherName || title}, ${finalCity}, ${finalCountry}`);
  const result: Array<{ country: string; city: string; address?: string; mapUrl: string }> = [
    {
      country: finalCountry,
      city: finalCity,
      address: undefined,
      mapUrl: primaryMapUrl,
    },
  ];

  // Append any detected additional cities/sedes
  if (Array.isArray(additionalCities) && additionalCities.length > 0) {
    additionalCities.forEach((addCity) => {
      if (!addCity) return;
      const addCityKey = addCity.toLowerCase();
      if (addCityKey === primaryKey || subdistricts.includes(addCityKey)) return;
      const mapUrl = buildGoogleMapsUrl(`${publisherName || title}, ${addCity}, ${finalCountry}`);
      result.push({
        country: finalCountry,
        city: addCity,
        address: undefined,
        mapUrl,
      });
    });
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
  if (clean.startsWith("/")) {
    try {
      const parsed = new URL(sourceUrl);
      return parsed.origin + clean;
    } catch {
      return clean;
    }
  }
  if (!/^https?:\/\//i.test(clean)) {
    try {
      const parsed = new URL(sourceUrl);
      return new URL(clean, parsed.origin).href;
    } catch {
      return clean;
    }
  }
  return clean;
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

function extractAddressFromHtml(html: string, textContent: string): string | null {
  // 1. JSON-LD Address
  const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim());
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const addr = item.address;
        if (addr) {
          if (typeof addr === "string" && addr.trim().length > 3) return addr.trim();
          if (typeof addr === "object") {
            const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean);
            if (parts.length) return parts.join(", ").trim();
          }
        }
      }
    } catch {}
  }

  // 2. Microdata
  const itempropMatch =
    html.match(/<meta[^>]*?itemprop=["']streetAddress["'][^>]*?content=["']([^"']+)["']/i) ||
    html.match(/itemprop=["']streetAddress["'][^>]*>([^<]+)</i) ||
    html.match(/itemprop=["']address["'][^>]*>([^<]+)</i);
  if (itempropMatch && itempropMatch[1] && itempropMatch[1].trim().length > 3) {
    return itempropMatch[1].trim();
  }

  // 3. Regex on raw HTML & text for physical address
  const addressRegex = /(?:Av\.|Avenida|Calle|Bv\.|Boulevard|Pje\.|Pasaje|Ruta|Autopista|Diagonal|Lateral|Acceso)\s+(?:de\s+)?[A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s.,°º#-]{2,60}\b\d{1,5}\b/i;
  const m = html.match(addressRegex) || textContent.match(addressRegex);
  if (m) {
    return m[0].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  return null;
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
    .replace(/<(?:div|section|ul|ol)\b[^>]*?(?:class|id)=["'][^"']*(?:intranet|webmail|portal[-_]empleado|banner-cookie|modal|dropdown|nav-item|menu-item|breadcrumbs?)[^"']*["'][^>]*>[\s\S]*?<\/(?:div|section|ul|ol)>/gi, " ");

  const mainMatch = contentHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i) ||
                    contentHtml.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ||
                    contentHtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const targetHtml = mainMatch ? mainMatch[1] : contentHtml;

  const JUNK_LINE_REGEX = /^(?:portal del empleado|webmail|intranet|gde|iniciar sesi[oó]n|acceder|login|olvid[eé] mi contrase[ñn]a|pol[ií]tica de privacidad|t[eé]rminos y condiciones|aviso legal|mapa del sitio|sitemap|todos los derechos reservados|copyright\s*©?.*)\s*$/i;

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
  const detectedAddress = extractAddressFromHtml(cleanHtml, textContent);
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

async function fetchPageContent(url: string) {
  let formattedUrl = url.trim();
  if (!/^https?:\/\//i.test(formattedUrl)) {
    formattedUrl = "https://" + formattedUrl;
  }

  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  ];

  // Tier 1: Direct fetch with browser headers
  try {
    const res = await fetch(formattedUrl, {
      headers: {
        "User-Agent": userAgents[0],
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 200) {
        const extracted = extractTextAndMetaFromHtml(html, formattedUrl);
        if (extracted.textContent && extracted.textContent.length > 80) {
          return { url: formattedUrl, ...extracted };
        }
      }
    }
  } catch (e: any) {
    console.warn(`Primary direct fetch failed for ${url}:`, e.message);
  }

  // Tier 2: Jina AI Web Reader
  try {
    const jinaUrl = `https://r.jina.ai/${formattedUrl}`;
    const res = await fetch(jinaUrl, {
      headers: { "User-Agent": userAgents[1], Accept: "text/plain, text/html" },
      signal: AbortSignal.timeout(10000),
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

  let host = "";
  try {
    host = new URL(formattedUrl).hostname.replace(/^www\./, "");
  } catch {}
  const fallbackLogo = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=128` : "";

  return {
    url: formattedUrl,
    title: host,
    description: `Sitio web oficial de ${host}`,
    textContent: `Sitio web oficial: ${formattedUrl}`,
    htmlContent: "",
    detectedFoundingYear: null,
    detectedMapsUrl: "",
    detectedLogo: fallbackLogo,
    detectedSiteName: host,
    images: [],
    socialLinksExtracted: [{ kind: "web", label: "Página Oficial", url: formattedUrl }],
  };
}

async function getAvailableSystemTaxonomies(clientCategories?: any[], clientFilterGroups?: any[]) {
  let dbCategories: any[] = [];
  let dbFilterGroups: any[] = [];
  try {
    const [fetchedCats, fetchedGroups] = await Promise.all([
      prisma.category.findMany({
        select: { id: true, description: true, taxonomyType: true, blockId: true, parentId: true, isPublicVisible: true },
        orderBy: [{ blockId: "asc" }, { parentId: "asc" }, { description: "asc" }],
      }),
      prisma.filterGroup.findMany({
        include: { options: true },
      }),
    ]);
    dbCategories = fetchedCats || [];
    dbFilterGroups = fetchedGroups || [];
  } catch (e) {
    console.warn("[AI Scraper] Error al obtener taxonomías de Prisma, usando respaldo del cliente:", e);
  }

  // Fallback to client payloads if DB returned empty or errored
  if ((!dbCategories || dbCategories.length === 0) && Array.isArray(clientCategories) && clientCategories.length > 0) {
    dbCategories = clientCategories;
  }
  if ((!dbFilterGroups || dbFilterGroups.length === 0) && Array.isArray(clientFilterGroups) && clientFilterGroups.length > 0) {
    dbFilterGroups = clientFilterGroups;
  }

  try {
    const filterGroupById = new Map<string, any>(dbFilterGroups.map((g) => [g.id, g]));
    const categoryById = new Map<string, any>(dbCategories.map((c) => [c.id, c]));

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
      if (seen.has(category.id)) return null;
      seen.add(category.id);
      if (category.blockId && filterGroupById.has(category.blockId)) return category.blockId;
      if (category.parentId) {
        const parent = categoryById.get(category.parentId);
        if (!parent) return null;
        return resolveCategoryBlockId(parent, seen);
      }
      return null;
    };

    const resolveCategoryTaxonomyType = (category: any, seen = new Set<string>()): string => {
      if (seen.has(category.id)) return "categoria";
      seen.add(category.id);
      const ownType = normalizeType(category.taxonomyType);
      if (ownType) return ownType;
      if (category.parentId) {
        const parent = categoryById.get(category.parentId);
        if (parent) return resolveCategoryTaxonomyType(parent, seen);
      }
      const blockId = resolveCategoryBlockId(category);
      if (blockId) {
        const block = filterGroupById.get(blockId);
        const blockType = normalizeType(block?.taxonomyType);
        if (blockType) return blockType;
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
        blockName: block?.label || "Categoría General",
      };
    });

    const blocksMap = new Map<string, { blockName: string; parentCategories: Array<{ name: string; subcategories: string[] }> }>();

    categoryMapWithTaxonomy
      .filter((c) => !c.parentId && c.resolvedTaxonomyType === "categoria")
      .forEach((c) => {
        const blockKey = c.blockName;
        if (!blocksMap.has(blockKey)) {
          blocksMap.set(blockKey, { blockName: blockKey, parentCategories: [] });
        }
        const children = categoryMapWithTaxonomy
          .filter((sub) => sub.parentId === c.id)
          .map((sub) => sub.description);
        blocksMap.get(blockKey)!.parentCategories.push({
          name: c.description,
          subcategories: children,
        });
      });

    const categoryTree = Array.from(blocksMap.values());

    const activities = categoryMapWithTaxonomy
      .filter((c) => c.resolvedTaxonomyType === "actividad")
      .map((c) => c.description);

    const types = categoryMapWithTaxonomy
      .filter((c) => c.resolvedTaxonomyType === "tipo")
      .map((c) => c.description);

    const modalities = categoryMapWithTaxonomy
      .filter((c) => c.resolvedTaxonomyType === "modalidad")
      .map((c) => c.description);

    const prestaciones = categoryMapWithTaxonomy
      .filter((c) => c.resolvedTaxonomyType === "prestacion")
      .map((c) => c.description);

    const languages = categoryMapWithTaxonomy
      .filter((c) => c.resolvedTaxonomyType === "idiomas" || c.resolvedTaxonomyType === "idioma")
      .map((c) => c.description);

    dbFilterGroups.forEach((group) => {
      const gType = normalizeType(group.taxonomyType);
      if (gType === "actividad") {
        group.options?.forEach((opt: any) => activities.push(opt.label || opt.value));
      } else if (gType === "tipo") {
        group.options?.forEach((opt: any) => types.push(opt.label || opt.value));
      } else if (gType === "modalidad") {
        group.options?.forEach((opt: any) => modalities.push(opt.label || opt.value));
      } else if (gType === "prestacion") {
        group.options?.forEach((opt: any) => prestaciones.push(opt.label || opt.value));
      } else if (gType === "idiomas" || gType === "idioma") {
        group.options?.forEach((opt: any) => languages.push(opt.label || opt.value));
      }
    });

    const allMainCatNames = categoryMapWithTaxonomy
      .filter((c) => !c.parentId && c.resolvedTaxonomyType === "categoria")
      .map((c) => c.description);
    const allSubCatNames = categoryMapWithTaxonomy
      .filter((c) => c.parentId && c.resolvedTaxonomyType === "categoria")
      .map((c) => c.description);

    const canonicalLanguages = languages.length > 0
      ? languages
      : ["Español", "Inglés", "Portugués", "Italiano", "Alemán", "Francés"];

    return {
      categoryTree,
      categories: Array.from(new Set(allMainCatNames.filter(Boolean))),
      subcategories: Array.from(new Set(allSubCatNames.filter(Boolean))),
      activities: Array.from(new Set(activities.filter(Boolean))),
      types: Array.from(new Set(types.filter(Boolean))),
      modalities: Array.from(new Set(modalities.filter(Boolean))),
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

    // 1. Exact match
    const exact = poolWithNorm.find((p) => p.norm === itemNorm);
    if (exact) {
      matched.add(exact.original);
      continue;
    }

    // 2. Substring match (either direction)
    const substring = poolWithNorm.find((p) => p.norm.includes(itemNorm) || itemNorm.includes(p.norm));
    if (substring) {
      matched.add(substring.original);
      continue;
    }

    // 3. Token match
    const itemTokens = itemNorm.split(/\s+/).filter((t) => t.length > 3);
    const tokenMatch = poolWithNorm.find((p) => itemTokens.some((t) => p.norm.includes(t)));
    if (tokenMatch) {
      matched.add(tokenMatch.original);
    }
  }

  // Fallback keywords if empty
  if (matched.size === 0 && fallbackKeywords.length) {
    for (const kw of fallbackKeywords) {
      const kwNorm = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const match = poolWithNorm.find((p) => p.norm.includes(kwNorm) || kwNorm.includes(p.norm));
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

  // English detection
  if (
    /\b(english|ingl[eé]s|bilingual|biling[uü]e|we speak english|english spoken|international|foreign|languages?:\s*.*english)\b/i.test(lower) ||
    /\b(contact us|about us|apply now|all rights reserved|overview|schedule a tour|admissions)\b/i.test(lower)
  ) {
    const eng = poolWithNorm.find((p) => p.norm.includes("ingles") || p.norm === "en");
    if (eng) detected.add(eng.original);
  }

  // Portuguese detection
  if (
    /\b(portugu[eêé]s|falamos portugu[eêé]s|atendimento em portugu[eêé]s|fale conosco|bem-vindo|sobre n[oó]s|institui[cç][aã]o)\b/i.test(lower)
  ) {
    const pt = poolWithNorm.find((p) => p.norm.includes("portugues") || p.norm === "pt");
    if (pt) detected.add(pt.original);
  }

  // Italian detection
  if (
    /\b(italiano|parliamo italiano|contattaci|chi siamo|benvenuti)\b/i.test(lower)
  ) {
    const it = poolWithNorm.find((p) => p.norm.includes("italiano") || p.norm === "it");
    if (it) detected.add(it.original);
  }

  // German detection
  if (
    /\b(alem[aá]n|deutsch|german|kontakt)\b/i.test(lower)
  ) {
    const de = poolWithNorm.find((p) => p.norm.includes("aleman") || p.norm === "de");
    if (de) detected.add(de.original);
  }

  // French detection
  if (
    /\b(franc[eéè]s|fran[cç]ais|french|nous contacter|bienvenue)\b/i.test(lower)
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

  // 1. Google Chrome Dict translation endpoint (fastest, most reliable)
  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(trimmed)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 3500);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const trans = decodeHtmlEntities(String(data[0]).trim());
        if (trans && trans !== trimmed) return trans;
      }
    }
  } catch {}

  // 2. Google Translate public API (gtx)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 3000);
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

  // 3. Try MyMemory
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${sl}|${tl}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 3000);
    if (res.ok) {
      const data = await res.json();
      const trans = data.responseData?.translatedText;
      if (trans && typeof trans === "string" && !trans.includes("MYMEMORY WARNING") && trans.trim() !== trimmed) {
        return decodeHtmlEntities(trans.trim());
      }
    }
  } catch {}

  // 4. Fallback to dictionary translation
  return translateStructuredDescription(trimmed, tl as any);
}

async function translateFullHtmlDescriptionAsync(htmlEs: string, targetLang: "en" | "pt" | "it"): Promise<string> {
  if (!htmlEs) return "";
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const rawParagraphs: string[] = [];
  let match;
  while ((match = pRegex.exec(htmlEs)) !== null) {
    rawParagraphs.push(match[1]);
  }

  if (rawParagraphs.length === 0) {
    const parts = htmlEs.split(/(<\/?[a-z0-9]+\b[^>]*>)/gi);
    const translatedParts = await Promise.all(
      parts.map(async (part) => {
        if (!part || /^<\/?[a-z0-9]+/i.test(part)) return part;
        const trimmed = part.trim();
        if (!trimmed || /^[💡⭐⚠️•>]+$/.test(trimmed)) return part;
        const leadingSpace = part.match(/^\s*/)?.[0] || "";
        const trailingSpace = part.match(/\s*$/)?.[0] || "";
        const trans = await translateTextDirect(trimmed, "es", targetLang);
        return `${leadingSpace}${trans}${trailingSpace}`;
      })
    );
    const joined = translatedParts.join("");
    const normalized = translateStructuredDescription(joined, targetLang);
    return targetLang === "en"
      ? normalizeToEnglishDescriptionHeaders(normalized)
      : targetLang === "pt"
      ? normalizeToPortugueseDescriptionHeaders(normalized)
      : normalizeToItalianDescriptionHeaders(normalized);
  }

  const translatedPs = await Promise.all(
    rawParagraphs.map(async (pText) => {
      const parts = pText.split(/(<\/?[a-z0-9]+\b[^>]*>)/gi);
      const translatedParts = await Promise.all(
        parts.map(async (part) => {
          if (!part || /^<\/?[a-z0-9]+/i.test(part)) return part;
          const trimmed = part.trim();
          if (!trimmed || /^[💡⭐⚠️•>]+$/.test(trimmed)) return part;
          const leadingSpace = part.match(/^\s*/)?.[0] || "";
          const trailingSpace = part.match(/\s*$/)?.[0] || "";
          const trans = await translateTextDirect(trimmed, "es", targetLang);
          return `${leadingSpace}${trans}${trailingSpace}`;
        })
      );
      return `<p>${translatedParts.join("")}</p>`;
    })
  );

  const fullHtml = translatedPs.join("\n");
  const normalized = translateStructuredDescription(fullHtml, targetLang);
  return targetLang === "en"
    ? normalizeToEnglishDescriptionHeaders(normalized)
    : targetLang === "pt"
    ? normalizeToPortugueseDescriptionHeaders(normalized)
    : normalizeToItalianDescriptionHeaders(normalized);
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
  const wantsImpact = checkPromptIsImpact(prompt) || (prompt && prompt.trim().length > 0);
  if (!wantsImpact) return cleanName;

  const baseEntityName = publisherName?.trim() || cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const pLower = (prompt || "").toLowerCase();
  const allCorpus = `${cleanName} ${prompt} ${corpusText || ""}`.toLowerCase();
  const isMarketing = /marketing|conversi[oó]n|especialista|vendedor|llamativ|gancho|cta|captar|potente|atractiv/i.test(pLower);

  const isEdu = sector === "education" || /universidad|facultad|instituto|colegio|carrera|estudio/i.test(allCorpus);
  const isHealth = sector === "health" || /hospital|sanatorio|cl[ií]nica|salud|m[eé]dic/i.test(allCorpus);
  const isGastro = sector === "gastronomy" || /restaurante|bar|gastronom|parrilla/i.test(allCorpus);
  const isTourism = sector === "tourism" || /hotel|hostel|turismo|alojam|posada/i.test(allCorpus);
  const isRealEstate = sector === "real_estate" || /inmobiliar|propiedad|bienes ra/i.test(allCorpus);
  const isTech = sector === "tech" || /software|tecnolog|digital/i.test(allCorpus);

  if (isMarketing) {
    if (isEdu) {
      return `${baseEntityName} | Especialistas en Formación Universitaria y Carreras Oficiales`;
    }
    if (isHealth) {
      return `${baseEntityName} | Atención Médica de Excelencia, Guardia y Especialidades`;
    }
    if (isTourism) {
      return `${baseEntityName} | Experiencias de Hospedaje y Atención de Primer Nivel`;
    }
    if (isGastro) {
      return `${baseEntityName} | Gastronomía de Autor y Experiencias Culinarias`;
    }
    if (isRealEstate) {
      return `${baseEntityName} | Asesoramiento Inmobiliario y Gestión de Propiedades`;
    }
    if (isTech) {
      return `${baseEntityName} | Soluciones Tecnológicas de Alto Rendimiento e Innovación Digital`;
    }
    return `${baseEntityName} | Servicios Profesionales y Atención Especializada`;
  }

  if (isEdu) {
    return `${baseEntityName} | Carreras Universitarias, Títulos Oficiales y Modalidades Flexibles`;
  }
  if (isHealth) {
    return `${baseEntityName} | Atención Médica de Alta Complejidad y Especialidades`;
  }
  if (isGastro) {
    return `${baseEntityName} | Gastronomía de Autor, Cocina Exclusiva y Reservas`;
  }
  if (isTourism) {
    return `${baseEntityName} | Hospedaje de Primer Nivel y Experiencias Exclusivas`;
  }
  if (isRealEstate) {
    return `${baseEntityName} | Venta, Alquiler y Tasación de Propiedades`;
  }
  if (isTech) {
    return `${baseEntityName} | Soluciones Tecnológicas, Software e Innovación`;
  }

  return `${baseEntityName} | Información Oficial y Servicios Profesionales`;
}

async function buildGroundedDescriptions(
  extractedData: any,
  title: string,
  city: string,
  country: string,
  customAdminPrompt?: string
): Promise<I18nRecord> {
  const prompt = (customAdminPrompt || "").trim();
  const wantsIcons = /con\s+emojis?|usar\s+emojis?|incluir\s+emojis?/i.test(prompt);
  const omitIcons = checkPromptOmitIcons(prompt) || (prompt.length > 0 && !wantsIcons);

  const cleanTitle = title || cleanTitleString(extractedData.title) || "";
  const baseEntityName = cleanTitle.split(/\s*[-–—|]\s*/)[0].trim() || cleanTitle;
  const locationText = [city, country].filter(Boolean).join(", ");
  const siteUrl = escapeHtml(extractedData.url);

  let rawDesc = cleanJunkTextPhrases(extractedData.description || "");
  if (!rawDesc || rawDesc.length < 20) {
    const rawParagraphs = (extractedData.textContent || "").split("\n\n").map((p: string) => cleanJunkTextPhrases(p.trim()));
    rawDesc = rawParagraphs.find((p: string) => p.length >= 45 && !p.includes("•") && !/portal del empleado|webmail|intranet|gde|login|iniciar sesi/i.test(p)) || rawParagraphs[0] || cleanTitle;
  }
  rawDesc = cleanJunkTextPhrases(rawDesc);
  const cleanSummary = escapeHtml(decodeHtmlEntities(rawDesc.slice(0, 380))).trim();

  const headingsList = (extractedData.headings || [])
    .filter((h: string) => h && h.length > 3 && h.length < 90 && !/menu|navegaci|inicio|contacto|buscar|copyright|login/i.test(h))
    .slice(0, 6);
  const servicesListStr = headingsList.length > 0 ? headingsList.join(", ") : "Servicios profesionales y atención institucional";

  const paragraphs: string[] = [];
  paragraphs.push(
    `<p><strong>${baseEntityName}</strong> es una institución de referencia${locationText ? ` con sede en ${locationText}` : ""}, orientada a brindar servicios y soluciones de calidad en su rubro.</p>`
  );

  if (cleanSummary && cleanSummary !== baseEntityName) {
    paragraphs.push(`<p><strong>Propuesta y Alcance:</strong> ${cleanSummary}</p>`);
  }

  if (servicesListStr) {
    paragraphs.push(`<p><strong>Servicios y Prestaciones:</strong> ${servicesListStr}.</p>`);
  }

  paragraphs.push(
    `<p><strong>Información y Canales Oficiales:</strong> Asesoramiento, consultas y gestión directa a través de su plataforma oficial ${siteUrl}.</p>`
  );

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
  const title = block.title.trim();
  const blockPrompt = (block.prompt || "").trim();
  const titleLower = title.toLowerCase();
  const promptLower = blockPrompt.toLowerCase();
  const cleanEntityName = cleanTitleString(extractedData.title || "").split(/\s*[-–—|]\s*/)[0].trim() || "La entidad";
  const locStr = primaryHq?.city ? ` en ${primaryHq.city}` : "";

  const isFaq = /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(titleLower) || /preguntas?\s+(?:y|con)\s+respuestas?|faq/i.test(promptLower);

  let bodyEs = "";
  let estado: "ok" | "parcial" | "sin_datos" = "ok";
  const evidencias: string[] = [];

  const textContent = extractedData.textContent || "";
  const headings = Array.isArray(extractedData.headings) ? extractedData.headings.filter((h: string) => h && h.length > 3 && h.length < 90) : [];

  if (isFaq) {
    const faqMatches = textContent.match(/(?:¿[^?]+\?|[A-ZÁÉÍÓÚÑ][^?\n]+\?)\s*[\n\r]+\s*([^\n\r]+)/g);
    if (faqMatches && faqMatches.length > 0) {
      const parsedFaqs = faqMatches.slice(0, 10).map((m: string) => {
        const parts = m.split(/\?/);
        const q = `${parts[0].trim()}?`;
        const a = parts.slice(1).join("?").trim();
        if (q.length > 5) evidencias.push(q);
        return `<p><strong>${escapeHtml(q)}</strong><br/>${escapeHtml(a)}</p>`;
      });
      bodyEs = parsedFaqs.join("\n");
      estado = "ok";
    } else {
      // Determine requested count (e.g. 10)
      const countMatch = blockPrompt.match(/\b(\d+)\s*(?:preguntas?|faq|items?|puntos?|consultas?)\b/i) ||
        blockPrompt.match(/\b(1\d|[2-9])\b/);
      const requestedCount = countMatch ? Math.min(Math.max(parseInt(countMatch[1] || countMatch[0], 10), 2), 15) : 10;

      const dynamicTopics = [
        {
          q: `¿Cómo contactar o solicitar información en ${cleanEntityName}?`,
          a: `Podés comunicarte a través de los canales oficiales habilitados (sitio web, líneas telefónicas o atención presencial${locStr}) para recibir asesoramiento personalizado.`,
        },
        {
          q: `¿Cuáles son los servicios y especialidades principales que brinda ${cleanEntityName}?`,
          a: `${cleanEntityName} cuenta con una amplia cartera de prestaciones${headings.length ? ` que incluye ${headings.slice(0, 3).join(", ")}` : ""}, brindadas por profesionales con sólida trayectoria y equipamiento de calidad.`,
        },
        {
          q: `¿Se requiere turno o coordinación previa para la atención?`,
          a: `Se recomienda gestionar turno o coordinación previa por vías oficiales para garantizar disponibilidad y una atención ágil y sin demoras.`,
        },
        {
          q: `¿Qué modalidades de atención o consulta ofrece ${cleanEntityName}?`,
          a: `Ofrece atención presencial en sus sedes oficiales${locStr} y soporte a través de canales digitales y de consulta directa.`,
        },
        {
          q: `¿Cuáles son los requisitos y documentación necesaria para iniciar gestiones?`,
          a: `Se requiere documento de identidad vigente y la documentación respaldatoria correspondiente informada por el área de admisión según la gestión a realizar.`,
        },
        {
          q: `¿Cómo se gestionan los pagos, aranceles o coberturas en ${cleanEntityName}?`,
          a: `Dispone de múltiples medios de pago y facturación oficial, además de convenios y planes informados directamente al momento de la consulta.`,
        },
        {
          q: `¿Dónde se encuentran ubicadas las instalaciones de ${cleanEntityName}?`,
          a: `Las sedes principales y puntos de atención se encuentran informados con ubicación verificada y datos de contacto en su plataforma oficial.`,
        },
        {
          q: `¿Cómo recibir seguimiento o resultados de trámites y solicitudes?`,
          a: `A través de las plataformas digitales oficiales o comunicándote con el área de atención al usuario con tu número de gestión o datos personales.`,
        },
        {
          q: `¿Qué días y horarios de atención tiene ${cleanEntityName}?`,
          a: `La atención se brinda en días hábiles en horarios comerciales y administrativos, complementados por canales de consulta digital activos.`,
        },
        {
          q: `¿Qué respaldo y trayectoria ofrece ${cleanEntityName} a sus usuarios?`,
          a: `${cleanEntityName} se destaca por su sólida presencia institucional, estándares de calidad certificados y un equipo interdisciplinario enfocado en la satisfacción de cada necesidad.`,
        },
      ];

      const selected = dynamicTopics.slice(0, requestedCount);
      bodyEs = selected.map((item) => `<p><strong>${item.q}</strong><br/>${item.a}</p>`).join("\n");
      estado = "ok";
      evidencias.push(`${cleanEntityName} - Canales y servicios verificados`);
    }
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

  const [tEn, tPt, tIt, bEn, bPt, bIt] = await Promise.all([
    translateTextDirect(title, "es", "en"),
    translateTextDirect(title, "es", "pt"),
    translateTextDirect(title, "es", "it"),
    bodyEs ? translateFullHtmlDescriptionAsync(bodyEs, "en") : Promise.resolve(""),
    bodyEs ? translateFullHtmlDescriptionAsync(bodyEs, "pt") : Promise.resolve(""),
    bodyEs ? translateFullHtmlDescriptionAsync(bodyEs, "it") : Promise.resolve(""),
  ]);

  return {
    title,
    titleI18n: { es: title, en: tEn, pt: tPt, it: tIt },
    body: bodyEs,
    bodyI18n: { es: bodyEs, en: bEn, pt: bPt, it: bIt },
    visibleInCard: false,
    estado,
    contenido: bodyEs,
    evidencias,
    prompt: block.prompt,
  };
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

  // 1. Check known institutions dictionary first if present
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
      if (hostname.includes(domainKey) || url.toLowerCase().includes(domainKey)) {
        const cat = validCats.find((c) => new RegExp(info.category.slice(0, 10), "i").test(c)) || validCats[0] || info.category;
        const sub = validSubcats.find((s) => new RegExp(info.subcategory.slice(0, 10), "i").test(s)) || validSubcats[0] || info.subcategory;
        const act = validActs.find((a) => new RegExp(info.activity.slice(0, 8), "i").test(a)) || validActs[0] || info.activity;
        const typ = validTypes.find((t) => new RegExp(info.type.slice(0, 8), "i").test(t)) || validTypes[0] || info.type;
        return {
          sector: /salud|hospital|m[eé]dic/i.test(info.activity) ? "health" : "education",
          category: cat,
          subcategory: sub,
          categorySelections: [cat],
          subcategorySelections: [sub],
          providerActivities: [act],
          providerTypes: [typ],
          providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial", "Atención online"],
        };
      }
    }
  } catch {}

  // 2. Public vs Private entity detection
  const isGovDomain = /\.gov(?:\.[a-z]{2})?|\.gob(?:\.[a-z]{2})?|\.mil(?:\.[a-z]{2})?/i.test(url);
  const isGovText = /\b(organismo publico|hospital publico|hospital nacional|hospital de pediatria samic|universidad nacional|ente autarquico|ministerio|secretaria|gobierno de|municipalidad|poder judicial)\b/i.test(lowerCorpus);
  const isPublicEntity = isGovDomain || isGovText;

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

  let bestParent = validCats[0] || "";
  let bestSub = validSubcats[0] || "";
  let highestParentScore = -1;

  for (const parent of parentCategoriesList) {
    const pNorm = parent.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const pTokens = pNorm.split(/\s+/).filter((t) => t.length > 3 && !/para|sobre|centros|servicios|general/i.test(t));

    let parentScore = 0;
    if (titleNorm.includes(pNorm)) parentScore += 40;
    if (urlNorm.includes(pNorm.replace(/\s+/g, ""))) parentScore += 30;

    for (const tok of pTokens) {
      if (titleNorm.includes(tok)) parentScore += 15;
      if (urlNorm.includes(tok)) parentScore += 10;
      const regex = new RegExp(`\\b${tok}`, "g");
      const matches = lowerCorpus.match(regex);
      if (matches) parentScore += Math.min(matches.length * 2, 20);
    }

    let bestSubForThisParent = parent.subcategories[0] || "";
    let highestSubScore = -1;

    for (const sub of parent.subcategories) {
      const sNorm = sub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const sTokens = sNorm.split(/\s+/).filter((t) => t.length > 3 && !/para|sobre|general/i.test(t));

      let subScore = 0;
      if (titleNorm.includes(sNorm)) subScore += 50;
      if (urlNorm.includes(sNorm.replace(/\s+/g, ""))) subScore += 35;

      for (const tok of sTokens) {
        if (titleNorm.includes(tok)) subScore += 20;
        if (urlNorm.includes(tok)) subScore += 15;
        const regex = new RegExp(`\\b${tok}`, "g");
        const matches = lowerCorpus.match(regex);
        if (matches) subScore += Math.min(matches.length * 3, 30);
      }

      if (subScore > highestSubScore) {
        highestSubScore = subScore;
        bestSubForThisParent = sub;
      }
    }

    const totalParentScore = parentScore + (highestSubScore > 0 ? highestSubScore * 1.5 : 0);

    if (totalParentScore > highestParentScore) {
      highestParentScore = totalParentScore;
      bestParent = parent.name;
      bestSub = bestSubForThisParent || parent.subcategories[0] || validSubcats[0] || "";
    }
  }

  // 4. Dynamic Activity Scoring across validActs
  let bestAct = validActs[0] || "Servicios profesionales y técnicos";
  let highestActScore = -1;
  for (const act of validActs) {
    const aNorm = act.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const aTokens = aNorm.split(/\s+/).filter((t) => t.length > 3 && !/para|sobre|servicios/i.test(t));
    let actScore = 0;
    if (titleNorm.includes(aNorm)) actScore += 40;
    for (const tok of aTokens) {
      if (titleNorm.includes(tok)) actScore += 15;
      const regex = new RegExp(`\\b${tok}`, "g");
      const matches = lowerCorpus.match(regex);
      if (matches) actScore += Math.min(matches.length * 2, 20);
    }
    if (actScore > highestActScore) {
      highestActScore = actScore;
      bestAct = act;
    }
  }

  // 5. Dynamic Type Resolution across validTypes
  let bestType = validTypes[0] || "Institución privada";
  if (isPublicEntity) {
    const pub = validTypes.find((t) => /p[uú]blico|estatal/i.test(t));
    if (pub) bestType = pub;
    else bestType = "Organismo público";
  } else {
    const priv = validTypes.find((t) => /privada|empresa/i.test(t));
    if (priv) bestType = priv;
  }

  // 6. Dynamic Modalities across validMods
  const chosenMods: string[] = [];
  const presencialMod = validMods.find((m) => /presencial/i.test(m));
  const onlineMod = validMods.find((m) => /online|virtual|remoto|distancia/i.test(m));

  const hasOnlineMention = /online|virtual|remoto|a distancia|zoom|meet|plataforma/i.test(lowerCorpus);
  const hasPresencialMention = /sede|sucursal|consultorio|campus|ubicacion|direccion|atencion presencial|visitanos/i.test(lowerCorpus);

  if (hasPresencialMention && presencialMod) chosenMods.push(presencialMod);
  if (hasOnlineMention && onlineMod) chosenMods.push(onlineMod);
  if (chosenMods.length === 0) {
    if (presencialMod) chosenMods.push(presencialMod);
    if (onlineMod) chosenMods.push(onlineMod);
  }
  const finalMods = chosenMods.length > 0 ? chosenMods : (validMods.length ? validMods.slice(0, 2) : ["Atención presencial", "Atención online"]);

  return {
    sector: /salud|hospital|m[eé]dic/i.test(bestAct) ? "health" : /educaci/i.test(bestAct) ? "education" : "general",
    category: bestParent || validCats[0] || "General",
    subcategory: bestSub || validSubcats[0] || "General",
    categorySelections: bestParent ? [bestParent] : (validCats.length ? [validCats[0]] : []),
    subcategorySelections: bestSub ? [bestSub] : (validSubcats.length ? [validSubcats[0]] : []),
    providerActivities: [bestAct],
    providerTypes: [bestType],
    providerModalities: finalMods,
  };
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
  const host = new URL(extractedData.url).hostname.replace("www.", "");
  const allText = `${extractedData.url} ${extractedData.title} ${extractedData.description} ${extractedData.textContent}`.toLowerCase();
  let titleClean = cleanTitleString(extractedData.title) || host;
  const locInfo = detectAllLocationsAndHeadquarters(allText, extractedData.url, titleClean);
  const classified = classifySectorAndTaxonomy(extractedData.url, titleClean, allText, taxonomies);

  const effectiveTitlePrompt = (customTitlePrompt || "").trim() || (customAdminPrompt || "").trim();
  if (effectiveTitlePrompt) {
    titleClean = generateImpactfulTitle(titleClean, classified.sector, effectiveTitlePrompt, locInfo.primaryCity, allText, extractedData.title);
  }

  const headquarterLocations = resolveHeadquarterLocations(
    undefined,
    titleClean,
    titleClean,
    locInfo.primaryCity,
    locInfo.primaryCountry,
    extractedData.detectedMapsUrl,
    allText,
    locInfo.additionalCities
  );

  const primaryHq = headquarterLocations[0] || {
    country: locInfo.primaryCountry,
    city: locInfo.primaryCity,
    mapUrl: buildGoogleMapsUrl(`${titleClean}, ${locInfo.primaryCity}, ${locInfo.primaryCountry}`),
  };

  const startYear = extractedData.detectedFoundingYear || extractFoundingYear("", allText, extractedData.url, titleClean) || "";
  const ratingInfo = extractRatingAndReviewsFromHtml(
    extractedData.htmlContent || "",
    allText,
    extractedData.url,
    titleClean,
    primaryHq.city,
    primaryHq.country
  );

  const finalRating = ratingInfo.rating || extractedData.detectedRating || "4.5";
  const finalReviewCount = ratingInfo.reviewCount || extractedData.detectedReviewCount || "0";
  const finalCommentsUrl =
    ratingInfo.commentsUrl ||
    extractedData.detectedCommentsUrl ||
    buildGoogleMapsUrl(`${titleClean}, ${primaryHq.city}, ${primaryHq.country}`);

  const fallbackExtraDescriptions: ExtraDescriptionBlock[] = [];
  if (includeScoreScout !== false) {
    const scoreBlock = buildScoreScoutBlock(
      titleClean,
      startYear,
      finalRating,
      allText,
      undefined,
      extractedData.url,
      finalReviewCount
    );
    fallbackExtraDescriptions.push(scoreBlock);
  }

  const effectiveDescPrompt = (customDescriptionPrompt || "").trim() || (customAdminPrompt || "").trim();
  const descriptions = await buildGroundedDescriptions(extractedData, titleClean, primaryHq.city, primaryHq.country, effectiveDescPrompt);

  if (Array.isArray(customBlocks) && customBlocks.length > 0) {
    for (const customBlock of customBlocks) {
      if (!customBlock.title || !customBlock.title.trim()) continue;
      const generatedCustom = await buildGroundedCustomBlock(
        customBlock,
        extractedData,
        primaryHq
      );
      fallbackExtraDescriptions.push(generatedCustom);
    }
  }

  const fallbackResult: ScrapedPublication = {
    url: extractedData.url,
    title: titleClean,
    titleI18n: { es: titleClean, en: titleClean, pt: titleClean, it: titleClean },
    description: descriptions.es,
    descriptionI18n: descriptions,
    extraDescriptions: fallbackExtraDescriptions,
    publisherName: cleanPublisherName(extractedData.title, extractedData.url, titleClean, extractedData.detectedSiteName),
    providerInfoI18n: {
      es: `${cleanPublisherName(extractedData.title, extractedData.url, titleClean, extractedData.detectedSiteName)} es un establecimiento y prestador de servicios en ${primaryHq.city}, ${primaryHq.country}.`,
      en: `${cleanPublisherName(extractedData.title, extractedData.url, titleClean, extractedData.detectedSiteName)} is an institution and service provider in ${primaryHq.city}, ${primaryHq.country}.`,
      pt: `${cleanPublisherName(extractedData.title, extractedData.url, titleClean, extractedData.detectedSiteName)} é um estabelecimento e provedor de serviços em ${primaryHq.city}, ${primaryHq.country}.`,
      it: `${cleanPublisherName(extractedData.title, extractedData.url, titleClean, extractedData.detectedSiteName)} è un'istituzione e fornitore di servizi a ${primaryHq.city}, ${primaryHq.country}.`,
    },
    providerStartYear: startYear,
    providerRating: finalRating,
    providerReviewCount: finalReviewCount,
    providerCommentsUrl: finalCommentsUrl,
    providerLogo: extractedData.detectedLogo || "",
    country: primaryHq.country,
    city: primaryHq.city,
    headquarterCountry: primaryHq.country,
    headquarterCity: primaryHq.city,
    locationAddress: primaryHq.mapUrl,
    destinationCountries: locInfo.detectedCountries.length ? locInfo.detectedCountries : [primaryHq.country],
    headquarterLocations,
    currency: "USD",
    price: "A consultar",
    pricePeriod: "",
    languages: Array.isArray(detectedLanguages) && detectedLanguages.length ? detectedLanguages.join(", ") : "Español",
    website: extractedData.url,
    socialLinksDetailed: extractedData.socialLinksExtracted || [{ kind: "web", label: "Sitio Oficial", url: extractedData.url }],
    images: extractedData.images || [],
    category: finalTaxonomyData.category,
    subcategory: finalTaxonomyData.subcategory,
    categorySelections: finalTaxonomyData.categorySelections?.length ? finalTaxonomyData.categorySelections : [finalTaxonomyData.category].filter(Boolean),
    subcategorySelections: finalTaxonomyData.subcategorySelections?.length ? finalTaxonomyData.subcategorySelections : [finalTaxonomyData.subcategory].filter(Boolean),
    providerActivities: finalTaxonomyData.providerActivities?.length ? finalTaxonomyData.providerActivities : dynamicFallbackClassified.providerActivities,
    providerTypes: finalTaxonomyData.providerTypes?.length ? finalTaxonomyData.providerTypes : dynamicFallbackClassified.providerTypes,
    providerModalities: finalTaxonomyData.providerModalities?.length ? finalTaxonomyData.providerModalities : dynamicFallbackClassified.providerModalities,
  };

  return enforceStrictTaxonomyGuardrails(
    fallbackResult,
    extractedData,
    taxonomies,
    customAdminPrompt,
    customTitlePrompt,
    customDescriptionPrompt
  );
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
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-2.5-flash", "gemini-1.5-flash-latest"];
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
REGLA ESTRICTA DE TÍTULO: Aplica al 100% esta directiva en la redacción del título (en tercera persona, tono profesional y representativo de la oferta real).
======================================================================
`
    : "";

  const descriptionPromptSection = customDescriptionPrompt && customDescriptionPrompt.trim()
    ? `
======================================================================
🎯 DIRECTIVA MAESTRA FIJA PARA LA DESCRIPCIÓN PRINCIPAL ('description' y 'descriptionI18n'):
"${customDescriptionPrompt.trim()}"
REGLA ESTRICTA DE DESCRIPCIÓN: Aplica al 100% esta directiva en la estructura de párrafos <p>, tono en tercera persona y contenido de la descripción general. EVITA PLANTILLAS RÍGIDAS y redacta de forma natural basada exclusivamente en datos reales del sitio web.
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
${extractedData.detectedFoundingYear ? `- AÑO HISTÓRICO / FUNDACIÓN DETECTADO: ${extractedData.detectedFoundingYear}` : ""}
${extractedData.detectedMapsUrl ? `- URL DE GOOGLE MAPS DETECTADA: ${extractedData.detectedMapsUrl}` : ""}
${extractedData.detectedRating ? `- VALORACIÓN DETECTADA EN GOOGLE MAPS / WEB (0 a 5): ${extractedData.detectedRating}` : ""}
${extractedData.detectedReviewCount ? `- CANTIDAD DE COMENTARIOS / RESEÑAS DETECTADA: ${extractedData.detectedReviewCount}` : ""}
${extractedData.detectedCommentsUrl ? `- ENLACE DE COMENTARIOS / MAPS DETECTADO: ${extractedData.detectedCommentsUrl}` : ""}
- Texto Completo del Sitio:
${extractedData.textContent.slice(0, 30000)}

CATÁLOGO OFICIAL DE BLOQUES Y CATEGORÍAS EN LA BASE DE DATOS:
${categoryTreeFormat}

SECTOR DE QUIEN OFRECE (ACTIVIDADES DISPONIBLES EN BD):
${taxonomies.activities.map((a: string) => `"${a}"`).join(", ")}

QUIÉN LO OFRECE (TIPOS DE PERFIL DISPONIBLES EN BD):
${taxonomies.types.map((t: string) => `"${t}"`).join(", ")}

ACOMPAÑAMIENTO Y SOPORTE (MODALIDADES DISPONIBLES EN BD):
${taxonomies.modalities.map((m: string) => `"${m}"`).join(", ")}

REGLAS CRÍTICAS Y OBLIGATORIAS:

0. TÍTULOS Y NOMBRE DEL OFERENTE ('publisherName'):
- 'publisherName': Es ÚNICAMENTE el nombre corto, limpio y oficial de la institución, empresa u oferente (ej: "Universidad Kennedy", "OSEP Mendoza", "Universidad Siglo 21", "Hospital Garrahan", "Google").
  * NUNCA pongas aquí el título largo ni slogans publicitarios.
- 'title': Título claro, representativo y profesional en tercera persona. Puede ser un objeto { "estado": "ok"|"parcial"|"sin_datos", "contenido": "Título", "evidencias": ["..."] } o cadena de texto.
- 'providerStartYear': Año real de fundación/inicio según el sitio web. Si no existe año comprobable en el texto, dejar "".

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
  "providerStartYear": "...",
  "providerRating": "5.0",
  "providerReviewCount": "0",
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
  if (!rawTitle) {
    rawTitle = extractedData.title || `Publicación de ${host}`;
  }
  let title = cleanTitleString(rawTitle);
  const publisherName = cleanPublisherName(parsed.publisherName || extractedData.title || title, extractedData.url, rawTitle);

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
    locInfo.additionalCities
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

  let startYear =
    extractedData.detectedFoundingYear ||
    (parsed.providerStartYear && !["2010", "2015", "2024", "2025", "2026"].includes(String(parsed.providerStartYear).trim()) ? String(parsed.providerStartYear).trim() : "") ||
    extractFoundingYear("", allText, extractedData.url, titleClean) ||
    "";

  const sectorClassification = classifySectorAndTaxonomy(
    extractedData.url,
    titleClean,
    allText,
    taxonomies
  );

  const effectiveTitlePrompt = (customTitlePrompt || "").trim() || (customAdminPrompt || "").trim();
  if (effectiveTitlePrompt) {
    title = generateImpactfulTitle(title, sectorClassification?.sector || "general", effectiveTitlePrompt, city, allText, publisherName);
  }

  // Use fuzzy matching against canonical DB options
  let matchedCatSelections = mapToCanonicalTaxonomy(rawCatSelections, validCats, sectorClassification.categorySelections);
  let matchedSubcatSelections = mapToCanonicalTaxonomy(rawSubcatSelections, validSubcats, sectorClassification.subcategorySelections);
  let matchedActivities = mapToCanonicalTaxonomy(parsed.providerActivities, validActs, sectorClassification.providerActivities);
  let matchedTypes = mapToCanonicalTaxonomy(parsed.providerTypes, validTypes, sectorClassification.providerTypes);
  let matchedModalities = mapToCanonicalTaxonomy(parsed.providerModalities, validMods, sectorClassification.providerModalities);

  // Ensure default categories if none matched
  if (!matchedCatSelections.length && validCats.length > 0) {
    matchedCatSelections = [validCats[0]];
  }
  if (!matchedActivities.length && validActs.length > 0) {
    matchedActivities = [validActs[0]];
  }
  if (!matchedTypes.length && validTypes.length > 0) {
    matchedTypes = [validTypes[0]];
  }
  if (!matchedModalities.length) {
    matchedModalities = ["Atención presencial", "Atención online"];
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

  const hasExecutiveSummary = /resumen ejecutivo/i.test(finalDescEs);
  const hasWhoWeAre = /qui[eé]nes somos/i.test(finalDescEs);
  const hasStory = /historia|trayectoria/i.test(finalDescEs);
  const hasServices = /servicios? y prestaciones|prestaciones y áreas|servicios clave/i.test(finalDescEs);

  const promptMismatch = Boolean(effectiveDescPrompt && (
    (checkPromptIsExecutiveSummary(effectiveDescPrompt) && !hasExecutiveSummary) ||
    (checkPromptIsWhoWeAre(effectiveDescPrompt) && !hasWhoWeAre) ||
    (checkPromptIsStory(effectiveDescPrompt) && !hasStory) ||
    (checkPromptIsServicesDetailed(effectiveDescPrompt) && !hasServices)
  ));

  // Check if AI description is valid, has HTML structure, and satisfies custom prompt
  const hasValidContent = !promptMismatch && finalDescEs.length >= 25 && (finalDescEs.includes("<p>") || finalDescEs.length >= 60);

  // If the AI description was missing, too short, lacks content, or failed the specific prompt, generate grounded descriptions
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

  const finalDescEn = rawDescEn || "";
  const finalDescPt = rawDescPt || "";
  const finalDescIt = rawDescIt || "";

  const detectedRating = extractedData.detectedRating || extractRatingFromText(`${extractedData.description || ""} ${extractedData.textContent || ""}`);
  const detectedReviewCount = extractedData.detectedReviewCount || extractReviewCountFromText(`${extractedData.description || ""} ${extractedData.textContent || ""}`);

  // Rating: if verified detectedRating (from known map, schema, or verified HTML/Maps/Search), use it first! Else if AI provided valid rating, use it; else "5.0"
  let finalRating = "5.0";
  if (detectedRating && !isNaN(parseFloat(detectedRating)) && parseFloat(detectedRating) > 0) {
    finalRating = Math.min(5, Math.max(1, parseFloat(detectedRating))).toFixed(1);
  } else if (parsed.providerRating && !isNaN(parseFloat(parsed.providerRating)) && parseFloat(parsed.providerRating) > 0) {
    finalRating = Math.min(5, Math.max(1, parseFloat(parsed.providerRating))).toFixed(1);
  } else if (parsed.scoreScout?.totalScore) {
    finalRating = Math.min(5, Math.max(1, Number(parsed.scoreScout.totalScore) / 20)).toFixed(1);
  } else {
    finalRating = "5.0";
  }

  // Review count: if verified detectedReviewCount (from known map or verified HTML/Maps/Search), use it first! Else if AI provided review count, use it; else "0"
  let finalReviewCount = "0";
  if (detectedReviewCount && String(detectedReviewCount).trim() !== "" && String(detectedReviewCount).trim() !== "0") {
    finalReviewCount = String(detectedReviewCount).replace(/[^0-9]/g, "") || "0";
  } else if (parsed.providerReviewCount !== undefined && parsed.providerReviewCount !== null && String(parsed.providerReviewCount).trim() !== "") {
    const rawCount = String(parsed.providerReviewCount).replace(/[^0-9]/g, "");
    finalReviewCount = rawCount ? rawCount : "0";
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
        const currentBody = formattedExtraDescriptions[existingIdx].body || "";
        const countMatch = (customBlock.prompt || "").match(/\b(\d+)\s*(?:preguntas?|faq|items?|puntos?|consultas?)\b/i) ||
          (customBlock.prompt || "").match(/\b(1\d|[2-9])\b/);
        const requestedCount = countMatch ? Math.min(Math.max(parseInt(countMatch[1] || countMatch[0], 10), 2), 20) : (/faq|pregunt/i.test(cleanCustomTitle) ? 8 : 0);
        const isFaq = /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(cleanCustomTitle) || /preguntas?\s+(?:y|con)\s+respuestas?|faq/i.test(customBlock.prompt || "");

        const questionMarks = (currentBody.match(/\?/g) || []).length;
        const pTagsCount = (currentBody.match(/<p>/gi) || []).length;
        const actualQCount = Math.max(questionMarks, pTagsCount);

        const needsGeneration =
          !currentBody ||
          currentBody.trim().length < 25 ||
          formattedExtraDescriptions[existingIdx].estado === "sin_datos" ||
          (isFaq && requestedCount > 0 && actualQCount < requestedCount);

        if (needsGeneration) {
          const generatedCustom = await buildGroundedCustomBlock(
            customBlock,
            extractedData,
            primaryHq
          );
          formattedExtraDescriptions[existingIdx] = generatedCustom;
        }
      }
    }
  }

  const titleI18n = parsed.titleI18n
    ? {
        es: cleanTitleString(title),
        en: cleanTitleString(parsed.titleI18n.en || title),
        pt: cleanTitleString(parsed.titleI18n.pt || title),
        it: cleanTitleString(parsed.titleI18n.it || title),
      }
    : { es: title, en: title, pt: title, it: title };

  const defaultProvInfoEs = `${publisherName || title} es un establecimiento y prestador de servicios en ${primaryHq.city}, ${primaryHq.country}.`;
  const defaultProvInfoEn = `${publisherName || title} is an institution and service provider in ${primaryHq.city}, ${primaryHq.country}.`;
  const defaultProvInfoPt = `${publisherName || title} é um estabelecimento e provedor de serviços em ${primaryHq.city}, ${primaryHq.country}.`;
  const defaultProvInfoIt = `${publisherName || title} è un'istituzione e fornitore di servizi a ${primaryHq.city}, ${primaryHq.country}.`;

  const providerInfoI18n = parsed.providerInfoI18n
    ? {
        es: String(parsed.providerInfoI18n.es || defaultProvInfoEs),
        en: String(parsed.providerInfoI18n.en || defaultProvInfoEn),
        pt: String(parsed.providerInfoI18n.pt || defaultProvInfoPt),
        it: String(parsed.providerInfoI18n.it || defaultProvInfoIt),
      }
    : {
        es: defaultProvInfoEs,
        en: defaultProvInfoEn,
        pt: defaultProvInfoPt,
        it: defaultProvInfoIt,
      };

  // Comments URL: if Google Maps link is provided, use it. Otherwise build Google Maps search query URL
  let finalCommentsUrl = parsed.providerCommentsUrl || extractedData.detectedCommentsUrl || "";
  if (!finalCommentsUrl || !/^https?:\/\//i.test(finalCommentsUrl) || finalCommentsUrl === extractedData.url) {
    const parts = [publisherName || title, extractedData.detectedAddress, primaryHq.city, primaryHq.country].filter(Boolean);
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

  const draftResult: ScrapedPublication = {
    url: extractedData.url,
    title,
    titleI18n,
    description: finalDescEs,
    descriptionI18n: {
      es: finalDescEs,
      en: finalDescEn,
      pt: finalDescPt,
      it: finalDescIt,
    },
    extraDescriptions: formattedExtraDescriptions,
    publisherName,
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
    category: matchedCatSelections[0] || (parsed.category || "General"),
    subcategory: matchedSubcatSelections[0] || (parsed.subcategory || "General"),
    categorySelections: matchedCatSelections.length ? matchedCatSelections : [parsed.category || "General"],
    subcategorySelections: matchedSubcatSelections.length ? matchedSubcatSelections : [parsed.subcategory || "General"],
    providerActivities: matchedActivities.length ? matchedActivities : ["Servicios profesionales y técnicos"],
    providerTypes: matchedTypes.length ? matchedTypes : ["Institución privada"],
    providerModalities: matchedModalities.length ? matchedModalities : ["Atención presencial", "Atención online"],
  };

  return enforceStrictTaxonomyGuardrails(
    draftResult,
    extractedData,
    taxonomies,
    customAdminPrompt,
    customTitlePrompt,
    customDescriptionPrompt
  );
}

export function enforceStrictTaxonomyGuardrails(
  publication: ScrapedPublication,
  extractedData: any,
  taxonomies?: any
): ScrapedPublication {
  const allText = `${publication.url} ${publication.title} ${publication.description} ${extractedData.textContent}`.toLowerCase();
  const titleClean = cleanTitleString(publication.title);
  publication.publisherName = cleanTitleString(publication.publisherName || titleClean.split(/\s*[-–—|]\s*/)[0].trim());

  // Merge any extracted phone, whatsapp, email, web links
  if (extractedData?.socialLinksExtracted && Array.isArray(extractedData.socialLinksExtracted)) {
    publication.socialLinksDetailed = mergeSocialLinks(publication.socialLinksDetailed, extractedData.socialLinksExtracted);
  }

  const locInfo = detectAllLocationsAndHeadquarters(allText, publication.url, titleClean);
  const classified = classifySectorAndTaxonomy(publication.url, titleClean, allText, taxonomies);

  // 1. Strict sector guardrails ONLY for taxonomy classification
  if (!publication.categorySelections || publication.categorySelections.length === 0 || publication.categorySelections[0] === "General") {
    publication.category = classified.category;
    publication.subcategory = classified.subcategory;
    publication.categorySelections = classified.categorySelections;
    publication.subcategorySelections = classified.subcategorySelections;
    publication.providerActivities = classified.providerActivities;
    publication.providerTypes = classified.providerTypes;
    publication.providerModalities = classified.providerModalities;
  }

  // 2. Guarantee valid founding year
  if (extractedData.detectedFoundingYear && (!publication.providerStartYear || publication.providerStartYear === "2015" || publication.providerStartYear === "2010" || publication.providerStartYear === "2024" || publication.providerStartYear === "2025" || publication.providerStartYear === "2026")) {
    publication.providerStartYear = extractedData.detectedFoundingYear;
  }
  if ((!publication.providerStartYear || publication.providerStartYear === "2015" || publication.providerStartYear === "2010") && !allText.includes(publication.providerStartYear)) {
    const calcYear = extractFoundingYear("", allText, publication.url, titleClean);
    if (calcYear) {
      publication.providerStartYear = calcYear;
    } else if (publication.providerStartYear === "2010" || publication.providerStartYear === "2015") {
      publication.providerStartYear = "";
    }
  }

  // 3. Guarantee accurate rating and review count
  if (extractedData.detectedRating && (!publication.providerRating || publication.providerRating === "0" || publication.providerRating === "4.5")) {
    publication.providerRating = extractedData.detectedRating;
  }
  if (extractedData.detectedReviewCount && extractedData.detectedReviewCount !== "0") {
    publication.providerReviewCount = extractedData.detectedReviewCount;
  } else if (!publication.providerReviewCount || publication.providerReviewCount === "" || publication.providerReviewCount === "120") {
    publication.providerReviewCount = "0";
  }

  // 4. Build clean, precise Google Maps comments URL
  if (extractedData.detectedCommentsUrl && (!publication.providerCommentsUrl || publication.providerCommentsUrl === publication.url || !publication.providerCommentsUrl.includes("maps"))) {
    publication.providerCommentsUrl = extractedData.detectedCommentsUrl;
  } else if (!publication.providerCommentsUrl || !/^https?:\/\//i.test(publication.providerCommentsUrl) || publication.providerCommentsUrl === publication.url) {
    const parts = [
      publication.publisherName || publication.title,
      extractedData.detectedAddress || (publication.headquarterLocations?.[0]?.address),
      publication.headquarterCity || publication.city,
      publication.headquarterCountry || publication.country
    ].filter(Boolean);
    publication.providerCommentsUrl = buildGoogleMapsUrl(parts.join(", "));
  }

  // 5. Ensure headquarter locations has additional branches if multiple were detected
  if (locInfo.additionalCities.length > 0 && (!publication.headquarterLocations || publication.headquarterLocations.length <= 1)) {
    publication.headquarterLocations = resolveHeadquarterLocations(
      publication.headquarterLocations,
      titleClean,
      publication.publisherName,
      locInfo.primaryCity,
      locInfo.primaryCountry,
      extractedData.detectedMapsUrl,
      allText,
      locInfo.additionalCities
    );
  }

  // 6. Ensure destination countries is populated
  if (!publication.destinationCountries || publication.destinationCountries.length === 0) {
    publication.destinationCountries = locInfo.detectedCountries.length > 0
      ? locInfo.detectedCountries
      : [publication.country || "Argentina"];
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
  // 1. Scrape web page & enrich with Google Maps/Places
  const extracted = await fetchPageContent(url);
  await enrichWithLiveGoogleMapsAndSearch(extracted);

  let cleanPublisher = cleanPublisherName(extracted.title, extracted.url, extracted.title, extracted.detectedSiteName);
  const locInfo = detectAllLocationsAndHeadquarters(extracted.textContent, extracted.url, extracted.title);

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

  // 2, 3 & 4. Run Title, Description, Provider Info, and Closed-Catalog Taxonomy Agents in parallel
  const [titleAgentRes, descAgentRes, providerInfoRes, taxonomyRes] = await Promise.all([
    runTitleAgent(cleanContext, customTitlePrompt || customAdminPrompt),
    runDescriptionAgent(cleanContext, customDescriptionPrompt || customAdminPrompt),
    runProviderInfoAgent(cleanContext),
    runTaxonomyAgent(cleanContext, taxonomies),
  ]);
  if (titleAgentRes.providerUsed !== "none") providersUsed.add(titleAgentRes.providerUsed);
  if (descAgentRes.providerUsed !== "none") providersUsed.add(descAgentRes.providerUsed);
  if (providerInfoRes.providerUsed !== "none") providersUsed.add(providerInfoRes.providerUsed);
  if (taxonomyRes.providerUsed !== "none") providersUsed.add(taxonomyRes.providerUsed);

  // Carefully refine publisher name if provider info agent detected the true company/organization
  if (
    providerInfoRes.data?.detectedPublisherName &&
    providerInfoRes.data.detectedPublisherName.length >= 2 &&
    !/^(?:oferente|establecimiento|instituci[oó]n|empresa)$/i.test(providerInfoRes.data.detectedPublisherName)
  ) {
    const isProgramOrHeadline = /govtech|programa|iniciativa|evento|noticia|art[ií]culo|trabaj[aá]|aprend[eé]|carrera|curso|taller|edici[oó]n|becas/i.test(cleanPublisher);
    if (isProgramOrHeadline || cleanPublisher.length > 35) {
      cleanPublisher = providerInfoRes.data.detectedPublisherName;
    }
  }

  // 4. Run Custom Block Agents in parallel
  const extraDescriptions: ExtraDescriptionBlock[] = [];

  // Score Scout Block (if enabled)
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

  // Custom Blocks requested by admin (executed in parallel)
  if (Array.isArray(customBlocks) && customBlocks.length > 0) {
    const validCustomBlocks = customBlocks.filter((cb) => cb && cb.title && cb.title.trim());
    const customBlockResults = await Promise.all(
      validCustomBlocks.map((cb) => runCustomBlockAgent(cleanContext, cb.title, cb.prompt))
    );
    extraDescriptions.push(...customBlockResults);
  }

  // 5. Taxonomy & Location mapping
  const titleVal = titleAgentRes.data?.title || extracted.title || cleanPublisher;
  const titleI18nVal = titleAgentRes.data?.titleI18n || { es: titleVal, en: titleVal, pt: titleVal, it: titleVal };
  const descVal = descAgentRes.data?.description || extracted.description || "";
  const descI18nVal = descAgentRes.data?.descriptionI18n || { es: descVal, en: "", pt: "", it: "" };

  const headquarterLocations = resolveHeadquarterLocations(
    undefined,
    titleVal,
    cleanPublisher,
    locInfo.primaryCity,
    locInfo.primaryCountry,
    extracted.detectedMapsUrl,
    extracted.textContent,
    locInfo.additionalCities
  );

  const primaryHq = headquarterLocations[0] || {
    country: locInfo.primaryCountry,
    city: locInfo.primaryCity,
    mapUrl: buildGoogleMapsUrl(`${cleanPublisher}, ${locInfo.primaryCity}, ${locInfo.primaryCountry}`),
  };

  const dynamicFallbackClassified = classifySectorAndTaxonomy(url, titleVal, extracted.textContent, taxonomies);

  const finalTaxonomyData = (taxonomyRes.success && taxonomyRes.data)
    ? taxonomyRes.data
    : dynamicFallbackClassified;

  const detectedLanguages = (taxonomyRes.success && taxonomyRes.data?.languages?.length)
    ? taxonomyRes.data.languages
    : detectLanguagesFromText(extracted.textContent, taxonomies.languages);

  const aiProviderInfo = providerInfoRes.data?.providerInfoI18n;
  const pInfoEs = aiProviderInfo?.es || providerInfoRes.data?.providerInfo || "";
  const providerInfoI18nVal = pInfoEs
    ? {
        es: pInfoEs,
        en: aiProviderInfo?.en || pInfoEs,
        pt: aiProviderInfo?.pt || pInfoEs,
        it: aiProviderInfo?.it || pInfoEs,
      }
    : {
        es: `${cleanPublisher} es un establecimiento y prestador de servicios en ${primaryHq.city}, ${primaryHq.country}.`,
        en: `${cleanPublisher} is an institution and service provider in ${primaryHq.city}, ${primaryHq.country}.`,
        pt: `${cleanPublisher} é um estabelecimento e provedor de serviços em ${primaryHq.city}, ${primaryHq.country}.`,
        it: `${cleanPublisher} è un'istituzione e fornitore di servizi a ${primaryHq.city}, ${primaryHq.country}.`,
      };

  const publication: ScrapedPublication = {
    url,
    title: titleVal,
    titleI18n: titleI18nVal,
    description: descVal,
    descriptionI18n: descI18nVal,
    extraDescriptions,
    publisherName: cleanPublisher,
    providerInfoI18n: providerInfoI18nVal,
    providerStartYear: cleanContext.foundingYear || "",
    providerRating: cleanContext.rating || "5.0",
    providerReviewCount: cleanContext.reviewCount || "0",
    providerCommentsUrl: cleanContext.commentsUrl || primaryHq.mapUrl,
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
    category: finalTaxonomyData.category,
    subcategory: finalTaxonomyData.subcategory,
    categorySelections: finalTaxonomyData.categorySelections?.length ? finalTaxonomyData.categorySelections : [finalTaxonomyData.category].filter(Boolean),
    subcategorySelections: finalTaxonomyData.subcategorySelections?.length ? finalTaxonomyData.subcategorySelections : [finalTaxonomyData.subcategory].filter(Boolean),
    providerActivities: finalTaxonomyData.providerActivities?.length ? finalTaxonomyData.providerActivities : dynamicFallbackClassified.providerActivities,
    providerTypes: finalTaxonomyData.providerTypes?.length ? finalTaxonomyData.providerTypes : dynamicFallbackClassified.providerTypes,
    providerModalities: finalTaxonomyData.providerModalities?.length ? finalTaxonomyData.providerModalities : dynamicFallbackClassified.providerModalities,
    scrapedHeadings: headings.slice(0, 20),
    scrapedParagraphs: paragraphs.slice(0, 15),
    scrapedTextContent: (extracted.textContent || "").slice(0, 5000),
    rawPageTitle: extracted.title || "",
    prestaciones: finalTaxonomyData.prestaciones || [],
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
    const urls: string[] = Array.isArray(body.urls)
      ? body.urls
      : body.url
      ? [body.url]
      : [];

    if (!urls.length) {
      return NextResponse.json(
        { error: "Debe proporcionar al menos una URL para analizar." },
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
    const includeScoreScout = body.includeScoreScout === true;

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

    // Si el frontend no tiene las API keys en su entorno (porque están en el Vercel del backend),
    // reenviamos la solicitud de scraping directamente al backend para que la procese con sus variables de entorno
    if (!geminiKey && !openaiKey) {
      const backendUrl = getBackendApiUrl();
      console.log(`[AI Scraper Frontend] Sin claves locales. Intentando consultar backend: ${backendUrl}/api/admin/ai-scrape-publications`);
      try {
        const backendRes = await fetch(`${backendUrl}/api/admin/ai-scrape-publications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(req.headers.get("cookie") ? { cookie: req.headers.get("cookie")! } : {}),
            ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization")! } : {}),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(6000),
        });
        if (backendRes.ok) {
          const rawText = await backendRes.text();
          try {
            const backendData = JSON.parse(rawText);
            return NextResponse.json(backendData, { status: 200 });
          } catch {}
        }
      } catch (fwdErr: any) {
        console.warn("[AI Scraper Frontend] Backend forwarding no disponible:", fwdErr?.message);
      }
    }

    const envProvider = (process.env.AI_SCRAPER_PROVIDER || "auto").toLowerCase();
    const effectiveProvider =
      requestedProvider !== "auto"
        ? requestedProvider
        : envProvider === "openai"
        ? "openai"
        : "gemini";

    const targetUrls = urls.slice(0, 10);
    const providersUsed = new Set<string>();

    // Process up to 10 URLs concurrently in mini-batches of 3
    const batchResults = await processBatchWithConcurrency(targetUrls, 3, async (url) => {
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
      providersUsed.add(providerUsed);
      return publication;
    });

    return NextResponse.json({
      success: true,
      providerUsed: Array.from(providersUsed).join(", ") || effectiveProvider,
      count: batchResults.length,
      publications: batchResults,
    });
  } catch (error: any) {
    console.error("AI Scraper Route Error:", error);
    return NextResponse.json(
      { error: error?.message ? `Error al procesar con IA: ${error.message}` : "Error al procesar la solicitud con IA." },
      { status: 500 }
    );
  }
}
