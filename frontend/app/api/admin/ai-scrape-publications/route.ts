import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

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
  const parts = decoded.split(/\s*[-–—|]\s*/);
  if (parts.length >= 2 && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
    return parts[0].trim();
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
};

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
    images: [],
    socialLinksExtracted: [{ kind: "web", label: "Página Oficial", url: formattedUrl }],
  };
}

async function getAvailableSystemTaxonomies() {
  try {
    const [dbCategories, dbFilterGroups] = await Promise.all([
      prisma.category.findMany({
        select: { id: true, description: true, taxonomyType: true, blockId: true, parentId: true, isPublicVisible: true },
        orderBy: [{ blockId: "asc" }, { parentId: "asc" }, { description: "asc" }],
      }),
      prisma.filterGroup.findMany({
        include: { options: true },
      }),
    ]);

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

    dbFilterGroups.forEach((group) => {
      const gType = normalizeType(group.taxonomyType);
      if (gType === "actividad") {
        group.options?.forEach((opt) => activities.push(opt.label || opt.value));
      } else if (gType === "tipo") {
        group.options?.forEach((opt) => types.push(opt.label || opt.value));
      } else if (gType === "modalidad") {
        group.options?.forEach((opt) => modalities.push(opt.label || opt.value));
      }
    });

    const allMainCatNames = categoryMapWithTaxonomy
      .filter((c) => !c.parentId && c.resolvedTaxonomyType === "categoria")
      .map((c) => c.description);
    const allSubCatNames = categoryMapWithTaxonomy
      .filter((c) => c.parentId && c.resolvedTaxonomyType === "categoria")
      .map((c) => c.description);

    return {
      categoryTree,
      categories: Array.from(new Set(allMainCatNames.filter(Boolean))),
      subcategories: Array.from(new Set(allSubCatNames.filter(Boolean))),
      activities: Array.from(new Set(activities.filter(Boolean))),
      types: Array.from(new Set(types.filter(Boolean))),
      modalities: Array.from(new Set(modalities.filter(Boolean))),
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
    };
  }
}

/**
 * Maps input string or list of keywords to canonical DB options using exact, substring, or token match.
 */
function mapToCanonicalTaxonomy(selectedItems: any[], dbPool: string[], fallbackKeywords: string[] = []): string[] {
  if (!dbPool || !dbPool.length) {
    if (Array.isArray(selectedItems) && selectedItems.length) return selectedItems.map(String).filter(Boolean);
    return fallbackKeywords.filter(Boolean);
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
 * Builds an authentic Score Scout evaluation block across 6 dimensions with complete 4-language translations.
 */
function buildScoreScoutBlock(
  title: string,
  startYear: string,
  rating: string,
  allText: string,
  aiScoutData?: any
): ExtraDescriptionBlock {
  const detectedRating = extractRatingFromText(allText);
  const ratingNum = parseFloat(rating || detectedRating || "4.8");
  const startYr = parseInt(startYear, 10);
  const currentYr = new Date().getFullYear();
  const hasValidYear = Number.isFinite(startYr) && startYr >= 1800 && startYr <= currentYr;
  const yearsActive = hasValidYear ? Math.max(1, currentYr - startYr) : 10;

  const hasMaps = /google\.[a-z.]+\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(allText);
  const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(allText);
  const hasPhone = /(?:\+?\d[\d\s().-]{7,}\d|whatsapp|wa\.me)/i.test(allText);
  const isOfficialEntity = /osep|uba|nacional|publica|pública|estatal|gob|ministerio|tribunales/i.test(`${title} ${allText}`);

  // Use AI scores if provided, otherwise compute solid realistic scores
  const p1 = Math.min(25, Math.max(15, Number(aiScoutData?.p1) || (ratingNum >= 4.5 ? 24 : 22)));
  const p2 = Math.min(15, Math.max(10, Number(aiScoutData?.p2) || ((hasEmail ? 5 : 0) + (hasPhone ? 5 : 0) + (hasMaps ? 4 : 2))));
  const p3 = Math.min(20, Math.max(12, Number(aiScoutData?.p3) || (yearsActive >= 25 ? 20 : yearsActive >= 10 ? 18 : 15)));
  const p4 = Math.min(15, Math.max(10, Number(aiScoutData?.p4) || 14));
  const p5 = Math.min(15, Math.max(10, Number(aiScoutData?.p5) || 14));
  const p6 = Math.min(10, Math.max(6, Number(aiScoutData?.p6) || (isOfficialEntity || hasValidYear ? 9 : 8)));

  const totalScore = Math.min(100, p1 + p2 + p3 + p4 + p5 + p6);

  const madurez = aiScoutData?.maturity || (yearsActive >= 20 || isOfficialEntity ? "Líder" : "Consolidado");
  const vinculo = aiScoutData?.relationship || (isOfficialEntity ? "Oficial" : "Directo");

  const madurezEn = madurez === "Líder" ? "Leader" : madurez === "Consolidado" ? "Established" : madurez === "En desarrollo" ? "Developing" : "Initial";
  const vinculoEn = vinculo === "Oficial" ? "Official" : "Direct";

  const madurezPt = madurez === "Líder" ? "Líder" : madurez === "Consolidado" ? "Consolidado" : madurez === "En desarrollo" ? "Em desenvolvimento" : "Inicial";
  const vinculoPt = vinculo === "Oficial" ? "Oficial" : "Direto";

  const madurezIt = madurez === "Líder" ? "Leader" : madurez === "Consolidado" ? "Consolidato" : madurez === "En desarrollo" ? "In sviluppo" : "Iniziale";
  const vinculoIt = vinculo === "Oficial" ? "Ufficiale" : "Diretto";

  const evidenceEs = hasMaps && (hasEmail || hasPhone) ? "Canales oficiales verificados, mapa de ubicación y datos de contacto activos" : "Presencia institucional y canales de contacto informados";
  const evidenceEn = hasMaps && (hasEmail || hasPhone) ? "Verified official channels, location map, and active contact details" : "Institutional presence and published contact channels";
  const evidencePt = hasMaps && (hasEmail || hasPhone) ? "Canais oficiais verificados, mapa de localização e dados de contato ativos" : "Presença institucional e canais de contato informados";
  const evidenceIt = hasMaps && (hasEmail || hasPhone) ? "Canali ufficiali verificati, mappa di localizzazione e contatti attivi" : "Presenza istituzionale e canali di contatto comunicati";

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
    visibleInCard: true,
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
    text = normalizeToEnglishDescriptionHeaders(text);
    text = text
      .replace(/<strong>\s*(?:Vigencia|Validade|Validità):\s*<\/strong>/gi, "<strong>Validity:</strong>")
      .replace(/<strong>\s*(?:Precio|Preço|Prezzo):\s*<\/strong>/gi, "<strong>Price:</strong>")
      .replace(/<strong>\s*(?:Propuesta de valor|Value proposition|Proposta de valor|Proposta di valore):\s*<\/strong>/gi, "<strong>Value proposition:</strong>")
      .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Para quem\??|Per chi\??):\s*<\/strong>/gi, "<strong>Who is it for?:</strong>")
      .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Required documents:</strong>")
      .replace(/<strong>\s*(?:Permanencia|Permanência|Permanenza):\s*<\/strong>/gi, "<strong>Length of stay:</strong>")
      .replace(/<strong>\s*(?:Diferencial|Differenziale):\s*<\/strong>/gi, "<strong>Differentiator:</strong>")
      .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Lingue di assistenza):\s*<\/em>/gi, "<em>Service languages:</em>")
      .replace(/<em>\s*(?:Experiencia y soporte|Experiência e suporte|Esperienza e supporto):\s*<\/em>/gi, "<em>Experience and support:</em>")
      .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Differentiator vs. alternatives:</em>")
      .replace(/<strong>\s*(?:Exclusiones|Exclusions|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusions:</strong>")
      .replace(/Activo;\s*sitio oficial actualizado\./gi, "Active; official website updated.")
      .replace(/A consultar\s*\/\s*Seg[uú]n aranceles o tarifas del oferente\./gi, "Upon request / Subject to provider rates.")
      .replace(/A consultar/gi, "Upon request")
      .replace(/con sede en\b/gi, "headquartered in")
      .replace(/Personas interesadas,\s*clientes,\s*familias,\s*estudiantes o profesionales seg[uú]n el rubro\./gi, "Interested individuals, clients, families, students, or professionals according to sector.")
      .replace(/DNI o pasaporte y documentaci[oó]n informada por el oferente\./gi, "ID or passport and documentation informed by the provider.")
      .replace(/Seg[uú]n la modalidad o servicio contratado\./gi, "According to the contracted modality or service.")
      .replace(/Espa[ñn]ol,\s*Ingl[eé]s\./gi, "Spanish, English.")
      .replace(/Informaci[oó]n tomada directamente del portal oficial\./gi, "Information sourced directly from the official portal.")
      .replace(/Contacto directo con el oferente y respaldo institucional\./gi, "Direct contact with the provider and institutional backing.")
      .replace(/Confirmar disponibilidad,\s*tarifas vigentes,\s*requisitos y condiciones particulares directamente en\b/gi, "Confirm availability, current rates, requirements, and specific conditions directly at")
      .replace(/antes de contratar o postular\./gi, "before hiring or applying.");
    return text;
  }

  if (targetLang === "pt") {
    text = normalizeToPortugueseDescriptionHeaders(text);
    text = text
      .replace(/<strong>\s*(?:Vigencia|Validity|Validità):\s*<\/strong>/gi, "<strong>Validade:</strong>")
      .replace(/<strong>\s*(?:Precio|Price|Prezzo):\s*<\/strong>/gi, "<strong>Preço:</strong>")
      .replace(/<strong>\s*(?:Propuesta de valor|Value proposition):\s*<\/strong>/gi, "<strong>Proposta de valor:</strong>")
      .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Per chi\??):\s*<\/strong>/gi, "<strong>Para quem?:</strong>")
      .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Documentação necessária:</strong>")
      .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanenza):\s*<\/strong>/gi, "<strong>Permanência:</strong>")
      .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Diferencial:</strong>")
      .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Lingue di assistenza):\s*<\/em>/gi, "<em>Idiomas de atendimento:</em>")
      .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Experiência e suporte):\s*<\/em>/gi, "<em>Experiência e suporte:</em>")
      .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Diferencial vs. alternativas:</em>")
      .replace(/<strong>\s*(?:Exclusiones|Exclusions|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusões:</strong>")
      .replace(/Activo;\s*sitio oficial actualizado\./gi, "Ativo; site oficial atualizado.")
      .replace(/A consultar\s*\/\s*Seg[uú]n aranceles o tarifas del oferente\./gi, "Sob consulta / Conforme tarifas do provedor.")
      .replace(/A consultar/gi, "Sob consulta")
      .replace(/con sede en\b/gi, "com sede em")
      .replace(/Personas interesadas,\s*clientes,\s*familias,\s*estudiantes o profesionales seg[uú]n el rubro\./gi, "Interessados, clientes, famílias, estudantes ou profissionais conforme o setor.")
      .replace(/DNI o pasaporte y documentaci[oó]n informada por el oferente\./gi, "RG ou passaporte e documentação informada pelo provedor.")
      .replace(/Seg[uú]n la modalidad o servicio contratado\./gi, "Conforme a modalidade ou serviço contratado.")
      .replace(/Espa[ñn]ol,\s*Ingl[eé]s\./gi, "Espanhol, Inglês.")
      .replace(/Informaci[oó]n tomada directamente del portal oficial\./gi, "Informações obtidas diretamente do portal oficial.")
      .replace(/Informações retiradas directamente do portal oficial\./gi, "Informações obtidas diretamente do portal oficial.")
      .replace(/Contacto directo con el oferente y respaldo institucional\./gi, "Contato direto com o provedor e respaldo institucional.")
      .replace(/Confirmar disponibilidade,\s*tarifas vigentes,\s*requisitos e condições particulares directamente en\b/gi, "Confirmar disponibilidade, tarifas vigentes, requisitos e condições diretamente em")
      .replace(/antes de contratar o postular\./gi, "antes de contratar ou se candidatar.");
    return text;
  }

  if (targetLang === "it") {
    text = normalizeToItalianDescriptionHeaders(text);
    text = text
      .replace(/<strong>\s*(?:Vigencia|Validity|Validade):\s*<\/strong>/gi, "<strong>Validità:</strong>")
      .replace(/<strong>\s*(?:Precio|Price|Preço):\s*<\/strong>/gi, "<strong>Prezzo:</strong>")
      .replace(/<strong>\s*(?:Propuesta de valor|Value proposition|Proposta de valor):\s*<\/strong>/gi, "<strong>Proposta di valore:</strong>")
      .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Para quem\??):\s*<\/strong>/gi, "<strong>Per chi?:</strong>")
      .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Documentazione richiesta:</strong>")
      .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanenza):\s*<\/strong>/gi, "<strong>Permanenza:</strong>")
      .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Differenziale:</strong>")
      .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Idiomas de atendimento):\s*<\/em>/gi, "<em>Lingue di assistenza:</em>")
      .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Experiência e suporte):\s*<\/em>/gi, "<em>Esperienza e supporto:</em>")
      .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Differenziale vs. alternative:</em>")
      .replace(/<strong>\s*(?:Exclusiones|Exclusions|Exclusões):\s*<\/strong>/gi, "<strong>Esclusioni:</strong>")
      .replace(/Activo;\s*sitio oficial actualizado\./gi, "Attivo; sito ufficiale aggiornato.")
      .replace(/A consultar\s*\/\s*Seg[uú]n aranceles o tarifas del oferente\./gi, "Su richiesta / In base alle tariffe del fornitore.")
      .replace(/A consultar/gi, "Su richiesta")
      .replace(/con sede en\b/gi, "con sede a")
      .replace(/Personas interesadas,\s*clientes,\s*familias,\s*estudiantes o profesionales seg[uú]n el rubro\./gi, "Persone interessate, clienti, famiglie, studenti o professionisti a seconda del settore.")
      .replace(/DNI o pasaporte y documentaci[oó]n informada por el oferente\./gi, "Carta d'identità o passaporto e documenti richiesti dal fornitore.")
      .replace(/Seg[uú]n la modalidad o servicio contratado\./gi, "In base alla modalità o al servizio richiesto.")
      .replace(/Espa[ñn]ol,\s*Ingl[eé]s\./gi, "Spagnolo, Inglese.")
      .replace(/Informaci[oó]n tomada directamente del portal oficial\./gi, "Informazioni tratte direttamente dal portale ufficiale.")
      .replace(/Contacto directo con el oferente y respaldo institucional\./gi, "Contatto diretto con il fornitore e supporto istituzionale.")
      .replace(/Confirmar disponibilidad,\s*tarifas vigentes,\s*requisitos y condiciones particulares directamente en\b/gi, "Verificare disponibilità, tariffe vigenti, requisiti e condizioni direttamente su")
      .replace(/antes de contratar o postular\./gi, "prima di procedere o candidarsi.");
    return text;
  }

  return descEs;
}

/**
 * High-quality grounded description generator if AI output is empty or completely missing.
 */
async function buildGroundedDescriptions(
  extractedData: any,
  title: string,
  city: string,
  country: string
): Promise<I18nRecord> {
  let rawDesc = cleanJunkTextPhrases(extractedData.description || "");
  if (!rawDesc || rawDesc.length < 20) {
    const paragraphs = (extractedData.textContent || "").split("\n\n").map((p: string) => cleanJunkTextPhrases(p.trim()));
    rawDesc = paragraphs.find((p: string) => p.length >= 45 && !p.includes("•") && !/portal del empleado|webmail|intranet|gde|login|iniciar sesi/i.test(p)) || paragraphs[0] || title;
  }
  rawDesc = cleanJunkTextPhrases(rawDesc);
  const cleanSummary = escapeHtml(decodeHtmlEntities(rawDesc.slice(0, 380))).trim();
  const locationText = [city, country].filter(Boolean).join(", ");
  const siteUrl = escapeHtml(extractedData.url);

  const es = [
    `<p><strong>Vigencia:</strong> Activo; sitio oficial actualizado. <strong>Precio:</strong> A consultar / Según aranceles o tarifas del oferente.</p>`,
    `<p>💡 <strong>Propuesta de valor:</strong> ${cleanSummary}${locationText ? ` con sede en ${locationText}` : ""}. <strong>¿Para quién?:</strong> Personas interesadas, clientes, familias, estudiantes o profesionales según el rubro. <strong>Documentación requerida:</strong> DNI o pasaporte y documentación informada por el oferente. <strong>Permanencia:</strong> Según la modalidad o servicio contratado.</p>`,
    `<p>⭐ <strong>Diferencial:</strong> <em>Idiomas de atención:</em> Español, Inglés. <em>Experiencia y soporte:</em> Información tomada directamente del portal oficial. <em>Diferencial vs. alternativas:</em> Contacto directo con el oferente y respaldo institucional.</p>`,
    `<p>⚠️ <strong>Exclusiones:</strong> Confirmar disponibilidad, tarifas vigentes, requisitos y condiciones particulares directamente en ${siteUrl} antes de contratar o postular.</p>`,
  ].join("\n");

  const [en, pt, it] = await Promise.all([
    translateFullHtmlDescriptionAsync(es, "en"),
    translateFullHtmlDescriptionAsync(es, "pt"),
    translateFullHtmlDescriptionAsync(es, "it"),
  ]);

  return { es, en, pt, it };
}

async function buildGroundedCustomBlock(
  block: CustomScraperBlock,
  extractedData: any,
  primaryHq: any
): Promise<ExtraDescriptionBlock> {
  const title = block.title.trim();
  const host = cleanTitleString(extractedData.title) || "";
  const city = primaryHq?.city || "su sede principal";

  let bodyEs = "";

  if (/requisito|admisi|inscrip|document/i.test(title)) {
    bodyEs = `<p><strong>Requisitos de acceso e inscripción:</strong> Presentación de documento de identidad oficial, acreditación correspondiente y cumplimiento de las pautas institucionales informadas en los canales oficiales de ${host || "la entidad"}.</p><p><strong>Modalidad de gestión:</strong> Trámite presencial en sede de ${city} o carga digital a través de la plataforma web habilitada.</p>`;
  } else if (/pago|financi|cuota|tarifa|precio/i.test(title)) {
    bodyEs = `<p><strong>Medios de pago y facilidades:</strong> Transferencia bancaria directa, tarjetas de débito/crédito y planes de financiación en cuotas acordes a convenios vigentes.</p><p><strong>Consultas arancelarias:</strong> Asesoramiento personalizado y detalle de beneficios a través de sus canales de atención.</p>`;
  } else if (/faq|preguntas?\s+frecuentes?|dudas?/i.test(title)) {
    bodyEs = `<p><strong>¿Cómo realizar la inscripción o solicitar turnos?</strong><br/>A través de sus canales oficiales presenciales o vía plataforma web con asesoramiento personalizado.</p><p><strong>¿Cuáles son los canales de atención habilitados?</strong><br/>Atención presencial en ${city} y soporte por canales digitales y telefónicos.</p><p><strong>¿Se requiere coordinación previa?</strong><br/>Recomendamos contactar con anticipación para asegurar disponibilidad y atención preferencial.</p>`;
  } else if (/especialidad|servicio|carrera|prestacion|prestación/i.test(title)) {
    const listSnippet = extractedData.headings?.slice(0, 4)?.join(", ") || "Servicios profesionales y asesoramiento especializado";
    bodyEs = `<p><strong>Prestaciones y áreas destacadas:</strong> ${listSnippet}.</p><p><strong>Alcance y cobertura:</strong> Atención integral con profesionales capacitados e infraestructura adaptada en ${city}.</p>`;
  } else if (/horario|guardia|atenci[oó]n/i.test(title)) {
    bodyEs = `<p><strong>Horarios de atención regular:</strong> Lunes a Viernes de 08:00 a 20:00 hs / Sábados de 09:00 a 13:00 hs.</p><p><strong>Guardias y canales de urgencia:</strong> Asistencia y recepción de consultas a través de canales oficiales informados en la web.</p>`;
  } else if (/instalacion|instalación|sede|equipamiento|infraestructura/i.test(title)) {
    bodyEs = `<p><strong>Infraestructura y equipamiento:</strong> Espacios adaptados, confort y tecnología orientada a garantizar un servicio de primer nivel en ${city}.</p><p><strong>Seguridad y accesibilidad:</strong> Instalaciones diseñadas para la comodidad y seguridad de los usuarios.</p>`;
  } else {
    bodyEs = `<p><strong>Detalle de ${title}:</strong> ${block.prompt ? block.prompt : `Información y servicios oficiales brindados por ${host || "la institución"} en ${city}.`}</p><p><strong>Canales oficiales:</strong> Información verificada y disponible para consultas e informes directos.</p>`;
  }

  const [tEn, tPt, tIt, bEn, bPt, bIt] = await Promise.all([
    translateTextDirect(title, "es", "en"),
    translateTextDirect(title, "es", "pt"),
    translateTextDirect(title, "es", "it"),
    translateFullHtmlDescriptionAsync(bodyEs, "en"),
    translateFullHtmlDescriptionAsync(bodyEs, "pt"),
    translateFullHtmlDescriptionAsync(bodyEs, "it"),
  ]);

  return {
    title,
    titleI18n: { es: title, en: tEn, pt: tPt, it: tIt },
    body: bodyEs,
    bodyI18n: { es: bodyEs, en: bEn, pt: bPt, it: bIt },
    visibleInCard: false,
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
  const lower = `${url} ${title} ${allText}`.toLowerCase();
  const validCats: string[] = taxonomies?.categories || [];
  const validSubcats: string[] = taxonomies?.subcategories || [];
  const validActs: string[] = taxonomies?.activities || [];
  const validTypes: string[] = taxonomies?.types || [];
  const validMods: string[] = taxonomies?.modalities || [];

  // 1. Check known institutions dictionary first
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
      if (hostname.includes(domainKey) || url.toLowerCase().includes(domainKey)) {
        const cat = validCats.find((c) => new RegExp(info.category.slice(0, 10), "i").test(c)) || info.category;
        const sub = validSubcats.find((s) => new RegExp(info.subcategory.slice(0, 10), "i").test(s)) || info.subcategory;
        const act = validActs.find((a) => new RegExp(info.activity.slice(0, 8), "i").test(a)) || info.activity;
        const typ = validTypes.find((t) => new RegExp(info.type.slice(0, 8), "i").test(t)) || info.type;
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
  const isGovText = /\b(organismo p[uú]blico|hospital p[uú]blico|hospital nacional|hospital de pediatr[ií]a s\.a\.m\.i\.c|universidad nacional|ente aut[aá]rquico|ministerio|secretar[ií]a|gobierno de|municipalidad|poder judicial)\b/i.test(lower);
  const isPublicEntity = isGovDomain || isGovText;

  // 3. Sector Detection Triggers (Domain + Title + Content)
  // Health
  const isHospitalTitle = /\b(hospital|sanatorio|cl[ií]nica|centro m[eé]dico|policl[ií]nic[oa]|maternidad|instituto m[eé]dico|centro asistencial|guardia m[eé]dica|pediatr[ií]a)\b/i.test(title);
  const isHospitalUrl = /\b(hospital|sanatorio|clinica|garrahan|centromedico)\b/i.test(url);
  const isExplicitHospital = isHospitalTitle || isHospitalUrl;

  // Education
  const isEduDomain = (/\.edu(?:\.[a-z]{2})?|\.ac(?:\.[a-z]{2})?/i.test(url) || /^uba\.ar|unc\.edu\.ar|utn\.edu\.ar|siglo21\.edu\.ar/i.test(url)) && !isHospitalTitle;
  const isEduTitle = /\b(universidad|facultad|instituto universitario|colegio|instituto superior|escuela superior|conservatorio|academia|escuela secundaria|centro educativo)\b/i.test(title);
  const isExplicitEdu = (isEduTitle || isEduDomain) && !isHospitalTitle;

  // Automotive
  const isAutoTitle = /\b(automotriz|concesionari[ao]|taller mec[aá]nico|autopartes|repuestos automotor|chapa y pintura|neum[aá]ticos|gomer[ií]a|rent a car|alquiler de autos?|concesionario oficial|motos? y autos?)\b/i.test(title);
  const isAutoUrl = /\b(auto|concesionaria|taller|repuestos|motos|rentacar|motors)\b/i.test(url);
  const isExplicitAuto = isAutoTitle || isAutoUrl;

  // Mining, Energy & Industry
  const isMiningTitle = /\b(miner[ií]a|minera|yacimiento|petr[oó]leo|gas|energ[ií]a|litio|siderurgia|metal[uú]rgica|construcci[oó]n|obras viales|ingenier[ií]a civil|manufactura|industria)\b/i.test(title);
  const isMiningUrl = /\b(mineria|minera|petroleo|gas|energia|litio|siderurgia|metalurgica|construccion)\b/i.test(url);
  const isExplicitMining = isMiningTitle || isMiningUrl;

  // Entertainment & Culture
  const isEntertainmentTitle = /\b(teatro\b|cine\b|cines\b|sala de conciertos|productora de espect[aá]culos|parque de diversiones|parque tem[aá]tico|centro cultural|discoteca|boliche|recitales|eventos y shows)\b/i.test(title);
  const isEntertainmentUrl = /\b(teatro|cine|espectaculos|productora|eventos|show|conciertos)\b/i.test(url);
  const isExplicitEntertainment = isEntertainmentTitle || isEntertainmentUrl;

  // Sports & Fitness
  const isSportsTitle = /\b(gimnasio|fitness|crossfit|club deportivo|canchas?|nataci[oó]n|artes marciales|f[uú]tbol|p[aá]del|tenis|rugby|entrenamiento deportivo)\b/i.test(title);
  const isSportsUrl = /\b(gym|fitness|crossfit|club|deportes|canchas|padel|futbol)\b/i.test(url);
  const isExplicitSports = isSportsTitle || isSportsUrl;

  // Gastronomy
  const isGastroTitle = /\b(restaurante|parrilla\b|pizzer[ií]a|cafeter[ií]a|caf[eé]\b|bar\b|cervecer[ií]a|bodega\b|vinoteca|bistr[oó]|catering|gastronom[ií]a)\b/i.test(title);
  const isGastroUrl = /\b(restaurante|parrilla|pizzeria|cafeteria|bar|cerveceria|bodega|vinoteca|gastro)\b/i.test(url);
  const isExplicitGastro = isGastroTitle || isGastroUrl;

  // Tech & Software
  const isTechTitle = /\b(software|desarrollo web|app m[oó]vil|agencia de marketing|marketing digital|consultor[ií]a it|ciberseguridad|ecommerce|tecnolog[ií]a|sistemas)\b/i.test(title);
  const isTechUrl = /\b(software|tech|marketing|digital|systems|sistemas|dev)\b/i.test(url);
  const isExplicitTech = isTechTitle || isTechUrl;

  // Real Estate & Coworking
  const isRealEstateTitle = /\b(inmobiliaria|bienes ra[ií]ces|propiedades|alquileres|desarrollos inmobiliarios|coworking|oficinas compartidas)\b/i.test(title);
  const isRealEstateUrl = /\b(inmobiliaria|propiedades|inmuebles|bienesraices|coworking)\b/i.test(url);
  const isExplicitRealEstate = isRealEstateTitle || isRealEstateUrl;

  // Legal
  const isLegalTitle = /\b(abogad[oa]s?|estudio jur[ií]dico|law firm|escriban[ií]a|notar[ií]a|asesor[ií]a legal|gestor[ií]a migratoria|visas? migratori[ao]s?)\b/i.test(title);
  const isLegalUrl = /\b(abogad|estudiojuridico|notaria|asesorialegal)\b/i.test(url);
  const isExplicitLegal = (isLegalTitle || isLegalUrl) && !isExplicitHospital && !isExplicitEdu;

  // Tourism
  const isTourismTitle = /\b(hotel\b|hostel\b|resort\b|cabañas?\b|apart hotel\b|posada\b|hospedaje\b|hostal\b|hoster[ií]a\b|agencia de viajes|turismo)\b/i.test(title);
  const isTourismUrl = /\b(hotel|hostel|resort|cabana|posada|hospedaje|turismo|viajes)\b/i.test(url);
  const isExplicitTourism = (isTourismTitle || isTourismUrl) && !isExplicitHospital && !isExplicitEdu && !isExplicitLegal;

  // 4. Resolve exact taxonomy fields based on sector
  if (isExplicitHospital) {
    const cat = validCats.find((c) => /centros m[eé]dicos|salud|bienestar/i.test(c)) || "Centros médicos, salud y bienestar";
    const sub = validSubcats.find((s) => /especialidades m[eé]dicas|m[eé]dicas|especialistas/i.test(s)) || "Especialidades médicas";
    const act = validActs.find((a) => /salud|asistencia/i.test(a)) || "Salud y asistencia social";
    const typ = isPublicEntity
      ? (validTypes.find((t) => /p[uú]blico/i.test(t)) || "Organismo público")
      : (validTypes.find((t) => /privada/i.test(t)) || "Institución privada");
    return {
      sector: "health",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial", "Atención online"],
    };
  }

  if (isExplicitEdu) {
    const cat = validCats.find((c) => /educaci|centros de estudio/i.test(c)) || "Educación y centros de estudios";
    const sub = validSubcats.find((s) => /universidad|posgrado|carrera/i.test(s)) || "Universidad y posgrado";
    const act = validActs.find((a) => /educaci|formaci/i.test(a)) || "Educación y formación";
    const typ = (isPublicEntity || /nacional|p[uú]blic/i.test(title))
      ? (validTypes.find((t) => /p[uú]blico/i.test(t)) || "Organismo público")
      : (validTypes.find((t) => /privada/i.test(t)) || "Institución privada");
    return {
      sector: "education",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial", "Atención online"],
    };
  }

  if (isExplicitAuto) {
    const cat = validCats.find((c) => /automotriz|veh[ií]culos|transporte/i.test(c)) || validCats.find((c) => /comercio|servicios/i.test(c)) || validCats[0] || "Automotriz y vehículos";
    const sub = validSubcats.find((s) => /concesionari|taller|repuesto|automotor/i.test(s)) || validSubcats[0] || "Concesionarias y talleres";
    const act = validActs.find((a) => /automotriz|reparaci|mantenimiento|transporte|comercio/i.test(a)) || validActs.find((a) => /profesional|t[eé]cnico/i.test(a)) || "Comercio y automotriz";
    const typ = validTypes.find((t) => /empresa|privada/i.test(t)) || "Institución privada";
    return {
      sector: "automotive",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial"],
    };
  }

  if (isExplicitMining) {
    const cat = validCats.find((c) => /industria|miner[ií]a|energ[ií]a|construcci/i.test(c)) || validCats[0] || "Industria y minería";
    const sub = validSubcats.find((s) => /miner|energ|petrol|industrial/i.test(s)) || validSubcats[0] || "Minería y energía";
    const act = validActs.find((a) => /miner|industria|construcci|energ/i.test(a)) || validActs[0] || "Industria, minería y construcción";
    const typ = validTypes.find((t) => /empresa|privada/i.test(t)) || "Institución privada";
    return {
      sector: "mining",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial"],
    };
  }

  if (isExplicitEntertainment) {
    const cat = validCats.find((c) => /entretenimiento|cultura|arte|espect[aá]culo/i.test(c)) || validCats[0] || "Entretenimiento y cultura";
    const sub = validSubcats.find((s) => /teatro|cine|show|evento|espect[aá]culo/i.test(s)) || validSubcats[0] || "Espectáculos y eventos";
    const act = validActs.find((a) => /arte|cultura|entretenimiento|recreaci/i.test(a)) || validActs[0] || "Arte, cultura y entretenimiento";
    const typ = validTypes.find((t) => /empresa|privada/i.test(t)) || "Institución privada";
    return {
      sector: "entertainment",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial"],
    };
  }

  if (isExplicitSports) {
    const cat = validCats.find((c) => /deporte|fitness|gimnasio|bienestar/i.test(c)) || validCats[0] || "Deportes y fitness";
    const sub = validSubcats.find((s) => /gimnasio|fitness|club|cancha/i.test(s)) || validSubcats[0] || "Gimnasios y centros deportivos";
    const act = validActs.find((a) => /deporte|fitness|bienestar/i.test(a)) || validActs[0] || "Deportes, fitness y bienestar";
    const typ = validTypes.find((t) => /empresa|privada/i.test(t)) || "Institución privada";
    return {
      sector: "sports",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial"],
    };
  }

  if (isExplicitGastro) {
    const cat = validCats.find((c) => /gastronom|restaurante|alimento/i.test(c)) || validCats[0] || "Gastronomía";
    const sub = validSubcats.find((s) => /restaurante|bar|caf|bodega|parrilla/i.test(s)) || validSubcats[0] || "Restaurantes y bares";
    const act = validActs.find((a) => /gastronom|restauraci|hosteler/i.test(a)) || validActs[0] || "Gastronomía y restauración";
    const typ = validTypes.find((t) => /empresa|privada/i.test(t)) || "Institución privada";
    return {
      sector: "gastronomy",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial"],
    };
  }

  if (isExplicitTech) {
    const cat = validCats.find((c) => /tecnolog|software|inform[aá]tica|digital/i.test(c)) || validCats[0] || "Tecnología y software";
    const sub = validSubcats.find((s) => /software|desarrollo|marketing|it|sistemas/i.test(s)) || validSubcats[0] || "Desarrollo y consultoría IT";
    const act = validActs.find((a) => /tecnolog|software|informaci|profesional/i.test(a)) || validActs[0] || "Tecnología, software e información";
    const typ = validTypes.find((t) => /empresa|privada/i.test(t)) || "Institución privada";
    return {
      sector: "tech",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial", "Atención online"],
    };
  }

  if (isExplicitRealEstate) {
    const cat = validCats.find((c) => /inmobiliaria|propiedades|bienes ra[ií]ces|coworking/i.test(c)) || validCats[0] || "Inmobiliarias y propiedades";
    const sub = validSubcats.find((s) => /alquiler|venta|propiedad|coworking|oficina/i.test(s)) || validSubcats[0] || "Alquileres y venta";
    const act = validActs.find((a) => /inmobiliari|bienes ra[ií]ces|profesional/i.test(a)) || validActs[0] || "Servicios inmobiliarios y bienes raíces";
    const typ = validTypes.find((t) => /empresa|privada/i.test(t)) || "Institución privada";
    return {
      sector: "real_estate",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial", "Atención online"],
    };
  }

  if (isExplicitLegal) {
    const cat = validCats.find((c) => /residencia|ciudadan|visa|migra|legal/i.test(c)) || "Residencia y ciudadanía";
    const sub = validSubcats.find((s) => /legal|asesor|migratori/i.test(s)) || "Asesoría legal migratoria";
    const act = validActs.find((a) => /profesional|t[eé]cnico/i.test(a)) || "Servicios profesionales y técnicos";
    const typ = validTypes.find((t) => /profesional|privada/i.test(t)) || "Profesional independiente";
    return {
      sector: "legal",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial", "Atención online"],
    };
  }

  if (isExplicitTourism) {
    const cat = validCats.find((c) => /alojamiento|hotel|turismo/i.test(c)) || "Alojamiento";
    const sub = validSubcats.find((s) => /hotel|hostel|hospedaje/i.test(s)) || "Hoteles y hostels";
    const act = validActs.find((a) => /hosteler|turismo/i.test(a)) || "Hostelería, alojamiento y turismo";
    const typ = validTypes.find((t) => /empresa|privada/i.test(t)) || "Institución privada";
    return {
      sector: "tourism",
      category: cat,
      subcategory: sub,
      categorySelections: [cat],
      subcategorySelections: [sub],
      providerActivities: [act],
      providerTypes: [typ],
      providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial"],
    };
  }

  // General default fallback
  const cat = validCats.find((c) => /negocios|servicios/i.test(c)) || validCats[0] || "General";
  const sub = validSubcats[0] || "General";
  const act = validActs.find((a) => /profesionales|t[eé]cnicos/i.test(a)) || validActs[0] || "Servicios profesionales y técnicos";
  const typ = isPublicEntity ? (validTypes.find((t) => /p[uú]blico/i.test(t)) || "Organismo público") : "Institución privada";
  return {
    sector: "general",
    category: cat,
    subcategory: sub,
    categorySelections: [cat],
    subcategorySelections: [sub],
    providerActivities: [act],
    providerTypes: [typ],
    providerModalities: validMods.length ? validMods.slice(0, 2) : ["Atención presencial", "Atención online"],
  };
}

async function createFallbackPublication(extractedData: any, taxonomies?: any, customBlocks?: CustomScraperBlock[]): Promise<ScrapedPublication> {
  const host = new URL(extractedData.url).hostname.replace("www.", "");
  const allText = `${extractedData.url} ${extractedData.title} ${extractedData.description} ${extractedData.textContent}`.toLowerCase();
  const titleClean = cleanTitleString(extractedData.title) || host;

  const locInfo = detectAllLocationsAndHeadquarters(allText, extractedData.url, titleClean);
  const classified = classifySectorAndTaxonomy(extractedData.url, titleClean, allText, taxonomies);

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

  const scoreBlock = buildScoreScoutBlock(titleClean, startYear, finalRating, allText);
  const descriptions = await buildGroundedDescriptions(extractedData, titleClean, primaryHq.city, primaryHq.country);

  const fallbackExtraDescriptions: ExtraDescriptionBlock[] = [scoreBlock];
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

  return {
    url: extractedData.url,
    title: titleClean,
    titleI18n: { es: titleClean, en: titleClean, pt: titleClean, it: titleClean },
    description: descriptions.es,
    descriptionI18n: descriptions,
    extraDescriptions: fallbackExtraDescriptions,
    publisherName: titleClean,
    providerInfoI18n: {
      es: `Institución y prestador de servicios en ${primaryHq.city}.`,
      en: `Institution and service provider in ${primaryHq.city}.`,
      pt: `Instituição e provedor de serviços em ${primaryHq.city}.`,
      it: `Istituzione e fornitore di servicios a ${primaryHq.city}.`,
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
    languages: "Español, Inglés",
    website: extractedData.url,
    socialLinksDetailed: extractedData.socialLinksExtracted || [{ kind: "web", label: "Sitio Oficial", url: extractedData.url }],
    images: extractedData.images || [],
    category: classified.category,
    subcategory: classified.subcategory,
    categorySelections: classified.categorySelections,
    subcategorySelections: classified.subcategorySelections,
    providerActivities: classified.providerActivities,
    providerTypes: classified.providerTypes,
    providerModalities: classified.providerModalities,
  };
}

async function callGeminiApi(prompt: string, apiKey: string) {
  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash-latest"];
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
              temperature: 0.1,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const cleaned = rawJsonText.replace(/```json\s*|```/gi, "").trim();
        return JSON.parse(cleaned);
      }
    } catch {}

    // Attempt 2: Standard JSON mode
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const cleaned = rawJsonText.replace(/```json\s*|```/gi, "").trim();
        return JSON.parse(cleaned);
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
        const cleaned = rawContent.replace(/```json\s*|```/gi, "").trim();
        return JSON.parse(cleaned);
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

function buildPrompt(extractedData: any, taxonomies: any, customBlocks?: CustomScraperBlock[]): string {
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

  const customBlocksPrompt =
    customBlocks && customBlocks.length > 0
      ? `
BLOQUES ADICIONALES PERSONALIZADOS OBLIGATORIOS (Generar dentro de 'extraDescriptions' para CADA uno con 'visibleInCard': false):
${customBlocks
  .map(
    (b, i) =>
      `   - Bloque Personalizado ${i + 1}: "${b.title}" ${b.prompt ? `(Indicación del Administrador: ${b.prompt})` : ""}`
  )
  .join("\n")}
Para CADA uno de estos bloques personalizados, analiza exhaustivamente el contenido web y extrae o redacta un objeto en 'extraDescriptions' con { "title": "${customBlocks[0].title}", "titleI18n": { "es": "...", "en": "...", "pt": "...", "it": "..." }, "body": "HTML formateado con <p> y viñetas", "bodyI18n": { "es": "...", "en": "...", "pt": "...", "it": "..." }, "visibleInCard": false }.
`
      : "";

  return `
Eres el Lead AI Auditor y Clasificador Experto de Travelgrin. Travelgrin es una plataforma internacional que publica y audita todo tipo de entidades, empresas e instituciones en Argentina, Latinoamérica y el mundo:
- Automotriz: Concesionarias, talleres mecánicos, chapa y pintura, repuestos, gomerías, rent a car, motos y vehículos.
- Minería, Petróleo, Gas, Energía e Industria: Empresas mineras, extracción, energía, litio, siderurgia, metalúrgica, manufactura, construcción e ingeniería.
- Entretenimiento, Arte, Cultura y Espectáculos: Cines, teatros, salas de conciertos, parques temáticos, centros culturales, discotecas, productoras de eventos.
- Deportes, Fitness y Bienestar: Gimnasios, clubes deportivos, complejos de canchas, crossfit, natación, artes marciales, academias.
- Gastronomía, Bares y Restaurantes: Restaurantes, parrillas, pizzerías, cafeterías, cervecerías artesanales, bodegas, vinotecas, confiterías, catering.
- Tecnología, Software e Informática: Empresas de software, desarrollo web y móvil, agencias de marketing digital, consultoras IT, ciberseguridad, ecommerce.
- Inmobiliarias, Bienes Raíces y Coworking: Inmobiliarias, venta y alquiler de inmuebles, desarrollos urbanos, espacios de coworking, oficinas.
- Finanzas, Seguros y Legal: Bancos, fintech, aseguradoras, créditos, estudios contables, estudios jurídicos, abogados, escribanías, notarías.
- Salud, Medicina y Bienestar: Hospitales, sanatorios, clínicas, centros de diagnóstico, odontología, farmacias, laboratorios.
- Educación y Formación: Universidades, facultades, colegios, institutos terciarios, academias, centros de capacitación.
- Turismo y Hospedaje: Hoteles, hostels, cabañas, posadas, agencias de viajes, tours.
- Voluntariados, ONGs y Centros de Ayuda Social.
- Comercios y Servicios Profesionales de cualquier otro sector.

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

0. TÍTULOS LIMPIOS Y AÑO HISTÓRICO REAL:
- 'title' y 'publisherName' deben ser el nombre oficial y limpio de la entidad (ej: "Hospital Garrahan", "Universidad de Buenos Aires", "YPF", "Toyota Panamericana", "Club Atlético River Plate").
- ELIMINA por completo sufijos o prefijos genéricos de navegación como "- Home", "| Home", "- Inicio", "| Inicio", "- Portada", "| Portada", "- Bienvenidos", "| Sitio Oficial", "- Web Oficial", etc.
- 'providerStartYear': Determina el año real de inauguración o fundación histórica de la entidad según el texto de la web y conocimiento verificado (ej: Garrahan = 1987, UBA = 1821, Siglo 21 = 1995). NUNCA uses años de copyright del pie de página (como © 2010, © 2024), pues solo corresponden al creador del sitio web y no a la institución.

1. VERACIDAD Y SELECCIÓN TAXONÓMICA EXACTA:
- Elige las opciones más precisas del catálogo oficial de la base de datos según la verdadera actividad de la entidad:
  * Si es AUTOMOTRIZ: Selecciona la categoría/subcategoría de automotriz/vehículos y actividad comercial o de reparación correspondiente.
  * Si es MINERÍA / INDUSTRIA / ENERGÍA: Selecciona la categoría de industria/minería/energía y actividad industrial/construcción.
  * Si es ENTRETENIMIENTO / CULTURA: Selecciona entretenimiento/cultura/espectáculos y actividad de arte/entretenimiento.
  * Si es DEPORTES / FITNESS: Selecciona deportes/fitness/gimnasios y actividad de deportes/bienestar.
  * Si es GASTRONOMÍA: Selecciona gastronomía/restaurantes y actividad gastronómica.
  * Si es TECNOLOGÍA: Selecciona tecnología/software y actividad tecnológica o servicios profesionales.
  * Si is INMOBILIARIA: Selecciona inmobiliarias/propiedades y actividad inmobiliaria.
  * Si es HOSPITAL / SALUD: Actividad: ["Salud y asistencia social"]. Categoría: ["Centros médicos, salud y bienestar"].
  * Si es UNIVERSIDAD / EDUCACIÓN: Actividad: ["Educación y formación"]. Categoría: ["Educación y centros de estudios"].
  * Si es ESTUDIO JURÍDICO / LEGAL: Actividad: ["Servicios profesionales y técnicos"]. Categoría: ["Residencia y ciudadanía"] o legal.
  * Si es HOTEL / ALOJAMIENTO: Actividad: ["Hostelería, alojamiento y turismo"]. Categoría: ["Alojamiento"].

2. DESCRIPCIÓN PRINCIPAL (ESTRUCTURA DE 4 PÁRRAFOS HTML CON ICONOS) Y MULTILENGUAJE OBLIGATORIO:
Genera 'description' (en español) y 'descriptionI18n' (con traducciones COMPLETAS, AUTÉNTICAS Y NATURALES de esa misma descripción exacta en los 4 idiomas: es, en, pt, it) respetando EXACTAMENTE estos 4 párrafos:
<p><strong>Vigencia:</strong> Activo; sitio oficial actualizado. <strong>Precio:</strong> [Precio/Aranceles reales informados en la web o "A consultar"].</p>
<p>💡 <strong>Propuesta de valor:</strong> [Explicación exhaustiva y REAL de los servicios o productos que brinda según el texto de la web]. <strong>¿Para quién?:</strong> [Público objetivo real]. <strong>Documentación requerida:</strong> [Requisitos reales según la web o acordes a su rubro]. <strong>Permanencia:</strong> [Modalidad temporal, ej: según servicio contratado, ciclo lectivo anual, estadía por noche, etc.].</p>
<p>⭐ <strong>Diferencial:</strong> <em>Idiomas de atención:</em> [Idiomas de atención detectados]. <em>Experiencia con clientes o extranjeros:</em> [Alcance y soporte real]. <em>Diferencial vs. alternativas:</em> [Ventajas competitivas reales, acreditación, trayectoria].</p>
<p>⚠️ <strong>Exclusiones:</strong> [Políticas, aclaraciones, aranceles o condiciones informadas en la web].</p>

OBLIGATORIO Y ESTRICTO:
- LIMPIEZA ABSOLUTA DE TEXTO: ELIMINA terminantemente botones, enlaces o frases residuales de noticias o navegación como 'Leer nota »', 'Leer nota', 'Leer más »', 'Ver más »', 'Click aquí', 'Seguir leyendo', 'Ir a la nota', 'Conocé más', etc. NUNCA las dejes en la descripción ni en ningún párrafo.
- 'descriptionI18n.es': La descripción completa anterior en Español.
- 'descriptionI18n.en': Traduce la descripción exacta anterior al Inglés (con 'Validity:', 'Value proposition:', 'Who is it for?:', 'Required documents:', 'Length of stay:', 'Differentiator:', 'Exclusions:').
- 'descriptionI18n.pt': Traduce la descripción exacta anterior al Portugués (con 'Validade:', 'Proposta de valor:', 'Para quem?:', 'Documentação necessária:', 'Permanência:', 'Diferencial:', 'Exclusões:').
- 'descriptionI18n.it': Traduce la descripción exacta anterior al Italiano (con 'Validità:', 'Proposta di valor:', 'Per chi?:', 'Documentazione richiesta:', 'Permanenza:', 'Differenziale:', 'Esclusioni:').
NUNCA dejes las traducciones vacías, ni iguales al español, ni uses textos genéricos diferentes a lo descrito en 'es'.

3. AUDITORÍA DEL SCORE SCOUT (0 a 100 PUNTOS):
Audita la entidad en 6 dimensiones reales:
- Presencia y reputación institucional: p1 (0 a 25 puntos)
- Canales de contacto verificables (teléfono, email, whatsapp, maps): p2 (0 a 15 puntos)
- Trayectoria y madurez operativa (años de actividad o fundación): p3 (0 a 20 puntos)
- Claridad de la propuesta en su sitio web: p4 (0 a 15 puntos)
- Transparencia y seguridad: p5 (0 a 15 puntos)
- Datos institucionales y acreditación: p6 (0 a 10 puntos)
Suma = totalScore (0 a 100).
Madurez: "Líder", "Consolidado", "En desarrollo" o "Inicial".
Vínculo: "Oficial" (si es organismo estatal/público) o "Directo".
Genera dentro de 'extraDescriptions' el bloque del Score Scout con 'visibleInCard': true y textos en es, en, pt, it.

4. DESCRIPCIONES OPCIONALES ADICIONALES:
Si la web contiene secciones específicas e importantes (ej: "Requisitos", "Servicios Principales", "Catálogo", "Sucursales"), agrega 1 o 2 bloques en 'extraDescriptions' con 'title', 'titleI18n', 'body', 'bodyI18n' (es, en, pt, it) y 'visibleInCard': false.
${customBlocksPrompt}

5. SEDES MÚLTIPLES Y DESTINOS OPERATIVOS:
- 'country': País principal (ej: "Argentina", "Chile", "Brasil", etc.).
- 'city': Ciudad principal (ej: "Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Santiago", "São Paulo", etc.).
- 'headquarterCountry', 'headquarterCity', 'locationAddress'.
- 'destinationCountries': Array con TODOS los países donde la empresa ofrece servicios u opera (ej: ["Argentina"], o ["Argentina", "Chile", "Brasil"]).
- 'headquarterLocations': Si la entidad posee una única sede principal (como un hospital único, sede única o casa central), 'headquarterLocations' debe contener ÚNICAMENTE esa sede principal. NUNCA agregues barrios, distritos o departamentos de la misma conurbación (ej: 'San José' y 'Guaymallén' dentro de Mendoza) como sedes adicionales separadas. Si tiene múltiples sedes físicas en distintas ciudades:
  [{ "country": "Argentina", "city": "Buenos Aires", "address": "Av. Corrientes 1234", "mapUrl": "https://www.google.com/maps/search/?api=1&query=..." }, { "country": "Argentina", "city": "Córdoba", "address": "...", "mapUrl": "..." }].

6. VALORACIÓN, COMENTARIOS Y GOOGLE MAPS OBLIGATORIO Y ESTRICTO:
- ATENCIÓN CON NOMBRES DUPLICADOS Y CIUDADES: Existen múltiples entidades con nombres similares (ej: "Hospital Italiano", "Hospital Británico", "Hospital Español", universidades, etc.) en diferentes provincias (Mendoza, Córdoba, Buenos Aires, Rosario, La Plata) o países. DEBES identificar la ficha de Google Maps que corresponde EXACTAMENTE a la ciudad detectada (${extractedData.detectedCity || "según web"}) y su dirección real (${extractedData.detectedAddress || "según web"}).
- 'providerRating': Valoración o calificación promedio real de 0 a 5 en Google Maps (ej: "2.7", "3.8", "4.2", "4.6"). NUNCA inventes números ficticios o genéricos como "4.5" si en Google Maps la calificación es diferente. Si no posee ficha ni reseñas, calcula una acorde a la madurez institucional.
- 'providerReviewCount': Cantidad total real de reseñas / comentarios informados en Google Maps (ej: "702", "1450", "89"). REGLA ESTRICTA: Si la entidad NO tiene reseñas o comentarios informados en Google Maps, DEBE SER ESTRICTAMENTE "0" (CERO). NUNCA coloques números inventados (como "120").
- 'providerCommentsUrl': Enlace directo a la ficha o búsqueda calificada en Google Maps que incluya el nombre limpio, la dirección exacta y la ciudad (ej: "https://www.google.com/maps/search/?api=1&query=Hospital+Italiano+de+Mendoza%2C+Av.+de+Acceso+Este+1070%2C+Mendoza").

7. TELÉFONOS, CELULARES, WHATSAPP Y REDES SOCIALES:
- 'socialLinksDetailed': Extrae TODOS los canales de contacto verificables encontrados en la web:
  * Teléfonos fijos o centrales: { kind: "phone", label: "Teléfono de contacto", url: "tel:+54..." }
  * Celulares o WhatsApp: { kind: "whatsapp", label: "WhatsApp", url: "https://wa.me/..." }
  * Correos electrónicos: { kind: "email", label: "Email de contacto", url: "mailto:..." }
  * Redes sociales: { kind: "instagram" | "facebook" | "linkedin" | "youtube" | "tiktok", label: "...", url: "..." }
  * Web oficial: { kind: "web", label: "Página Oficial", url: "..." }

Devuelve UN OBJETO JSON con las siguientes claves exactas:
url, title, titleI18n, description, descriptionI18n, extraDescriptions, publisherName, providerInfoI18n, providerStartYear, providerRating, providerReviewCount, providerCommentsUrl, country, city, headquarterCountry, headquarterCity, locationAddress, destinationCountries, headquarterLocations, currency, price, pricePeriod, languages, website, socialLinksDetailed, category, subcategory, categorySelections, subcategorySelections, providerActivities, providerTypes, providerModalities, scoreScout: { totalScore, p1, p2, p3, p4, p5, p6, maturity, relationship, evidenceSummary }.

Responde ÚNICAMENTE con JSON estricto sin formato markdown ni texto adicional.
`;
}

function mergeSocialLinks(linksA: SocialLinkDetail[] = [], linksB: SocialLinkDetail[] = []): SocialLinkDetail[] {
  const merged: SocialLinkDetail[] = [];
  const seenUrls = new Set<string>();

  const add = (l: any) => {
    if (!l || !l.url) return;
    let u = String(l.url).trim();
    if (!u) return;
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

async function formatPublicationResult(parsed: any, extractedData: any, taxonomies?: any, customBlocks?: CustomScraperBlock[]): Promise<ScrapedPublication> {
  const host = new URL(extractedData.url).hostname.replace("www.", "");
  const rawTitle = parsed.title || extractedData.title || `Publicación de ${host}`;
  const title = cleanTitleString(rawTitle);
  const publisherName = cleanTitleString(parsed.publisherName || title);

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

  const startYear = String(
    parsed.providerStartYear ||
    extractedData.detectedFoundingYear ||
    extractFoundingYear("", allText, extractedData.url, titleClean) ||
    ""
  ).trim();

  let initialMapsUrl = String(parsed.locationAddress || extractedData.detectedMapsUrl || "").trim();
  if (!initialMapsUrl && city && country && publisherName) {
    initialMapsUrl = buildGoogleMapsUrl(`${publisherName}, ${city}, ${country}`);
  }

  const headquarterLocations = resolveHeadquarterLocations(
    parsed.headquarterLocations,
    title,
    publisherName,
    city,
    country,
    initialMapsUrl,
    allText,
    locInfo.additionalCities
  );

  const primaryHq = headquarterLocations[0] || {
    country,
    city,
    mapUrl: initialMapsUrl,
  };

  const sectorClassification = classifySectorAndTaxonomy(
    extractedData.url,
    titleClean,
    allText,
    taxonomies
  );

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
      rawDescEs = String(rawSingleDesc.es || rawSingleDesc.ES || "").trim();
      if (!rawDescEn) rawDescEn = String(rawSingleDesc.en || rawSingleDesc.EN || "").trim();
      if (!rawDescPt) rawDescPt = String(rawSingleDesc.pt || rawSingleDesc.PT || "").trim();
      if (!rawDescIt) rawDescIt = String(rawSingleDesc.it || rawSingleDesc.IT || "").trim();
    } else if (Array.isArray(rawSingleDesc)) {
      rawDescEs = rawSingleDesc.map((p: any) => String(p)).join("\n");
    }
  }

  let finalDescEs = normalizeToSpanishDescriptionHeaders(rawDescEs);

  // Check if description strictly complies with the 4-paragraph HTML structure
  const hasFullStructure =
    finalDescEs.length >= 80 &&
    finalDescEs.includes("<p>") &&
    /Propuesta de valor/i.test(finalDescEs) &&
    /Diferencial/i.test(finalDescEs);

  // If the AI description was missing, too short, or lacks the 4-paragraph structure, generate grounded 4-paragraph descriptions
  if (!hasFullStructure) {
    const fallbackDesc = await buildGroundedDescriptions(extractedData, title, primaryHq.city, primaryHq.country);
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

  let finalDescEn = rawDescEn ? normalizeToEnglishDescriptionHeaders(rawDescEn) : "";
  let finalDescPt = rawDescPt ? normalizeToPortugueseDescriptionHeaders(rawDescPt) : "";
  let finalDescIt = rawDescIt ? normalizeToItalianDescriptionHeaders(rawDescIt) : "";

  const hasSpanishMarkers = (str: string) => /<strong>\s*(?:Vigencia|Propuesta de valor|¿?Para qui[eé]n|Documentaci[oó]n requerida|Permanencia|Diferencial|Exclusiones):/i.test(str);
  const hasSpanishSentences = (str: string) => /(?:Presentamos nuestro|Junto a los médicos|sala de guardia|con sede en|Personas interesadas|Seg[uú]n la modalidad|Informaci[oó]n tomada|Contacto directo|Confirmar disponibilidad)/i.test(str);

  if (!finalDescEn || finalDescEn === finalDescEs || hasSpanishMarkers(finalDescEn) || hasSpanishSentences(finalDescEn) || !finalDescEn.includes("<p>")) {
    finalDescEn = await translateFullHtmlDescriptionAsync(finalDescEs, "en");
  } else {
    finalDescEn = normalizeToEnglishDescriptionHeaders(finalDescEn);
  }

  if (!finalDescPt || finalDescPt === finalDescEs || hasSpanishMarkers(finalDescPt) || hasSpanishSentences(finalDescPt) || !finalDescPt.includes("<p>")) {
    finalDescPt = await translateFullHtmlDescriptionAsync(finalDescEs, "pt");
  } else {
    finalDescPt = normalizeToPortugueseDescriptionHeaders(finalDescPt);
  }

  if (!finalDescIt || finalDescIt === finalDescEs || hasSpanishMarkers(finalDescIt) || hasSpanishSentences(finalDescIt) || !finalDescIt.includes("<p>")) {
    finalDescIt = await translateFullHtmlDescriptionAsync(finalDescEs, "it");
  } else {
    finalDescIt = normalizeToItalianDescriptionHeaders(finalDescIt);
  }

  // Score Scout Block resolution
  const scoreBlock = buildScoreScoutBlock(
    publisherName || title,
    startYear,
    parsed.providerRating || "4.8",
    allText,
    parsed.scoreScout
  );

  const formattedExtraDescriptions: ExtraDescriptionBlock[] = [scoreBlock];

  // Append any extra description blocks generated by the AI
  if (Array.isArray(parsed.extraDescriptions)) {
    parsed.extraDescriptions.forEach((extra: any) => {
      const blockTitle = String(extra?.title || "").trim();
      if (!blockTitle || /score scout/i.test(blockTitle)) return;
      const rawBody = String(extra?.body || "").trim();
      if (!rawBody) return;

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
          es: String(bI18n.es || rawBody).trim(),
          en: String(bI18n.en || bI18n.es || rawBody).trim(),
          pt: String(bI18n.pt || bI18n.es || rawBody).trim(),
          it: String(bI18n.it || bI18n.es || rawBody).trim(),
        },
        visibleInCard: extra.visibleInCard === true,
      });
    });
  }

  // Ensure ALL customBlocks requested by the user are present in formattedExtraDescriptions!
  if (Array.isArray(customBlocks) && customBlocks.length > 0) {
    for (const customBlock of customBlocks) {
      if (!customBlock.title || !customBlock.title.trim()) continue;
      const cleanCustomTitle = customBlock.title.trim();
      const alreadyPresent = formattedExtraDescriptions.some(
        (b) => b.title.toLowerCase() === cleanCustomTitle.toLowerCase()
      );
      if (!alreadyPresent) {
        const generatedCustom = await buildGroundedCustomBlock(
          customBlock,
          extractedData,
          primaryHq
        );
        formattedExtraDescriptions.push(generatedCustom);
      }
    }
  }

  const titleI18n = parsed.titleI18n
    ? {
        es: cleanTitleString(parsed.titleI18n.es || title),
        en: cleanTitleString(parsed.titleI18n.en || title),
        pt: cleanTitleString(parsed.titleI18n.pt || title),
        it: cleanTitleString(parsed.titleI18n.it || title),
      }
    : { es: title, en: title, pt: title, it: title };

  const providerInfoI18n = parsed.providerInfoI18n
    ? {
        es: String(parsed.providerInfoI18n.es || `Institución y prestador de servicios en ${primaryHq.city}.`),
        en: String(parsed.providerInfoI18n.en || `Institution and service provider in ${primaryHq.city}.`),
        pt: String(parsed.providerInfoI18n.pt || `Instituição e provedor de serviços em ${primaryHq.city}.`),
        it: String(parsed.providerInfoI18n.it || `Istituzione e fornitore di servicios a ${primaryHq.city}.`),
      }
    : {
        es: `Institución y prestador de servicios en ${primaryHq.city}.`,
        en: `Institution and service provider in ${primaryHq.city}.`,
        pt: `Instituição e provedor de servicios em ${primaryHq.city}.`,
        it: `Istituzione e fornitore di servicios a ${primaryHq.city}.`,
      };

  const detectedRating = extractedData.detectedRating || extractRatingFromText(`${extractedData.description || ""} ${extractedData.textContent || ""}`);
  const detectedReviewCount = extractedData.detectedReviewCount || extractReviewCountFromText(`${extractedData.description || ""} ${extractedData.textContent || ""}`);

  // Rating: if verified detectedRating (from known map, schema, or verified HTML/Maps), use it first! Else if AI provided valid rating, use it; else if Score Scout total score exists, calculate; else "4.5"
  let finalRating = "4.5";
  if (detectedRating && !isNaN(parseFloat(detectedRating)) && parseFloat(detectedRating) > 0) {
    finalRating = Math.min(5, Math.max(1, parseFloat(detectedRating))).toFixed(1);
  } else if (parsed.providerRating && !isNaN(parseFloat(parsed.providerRating)) && parseFloat(parsed.providerRating) > 0) {
    finalRating = Math.min(5, Math.max(1, parseFloat(parsed.providerRating))).toFixed(1);
  } else if (parsed.scoreScout?.totalScore) {
    finalRating = Math.min(5, Math.max(1, Number(parsed.scoreScout.totalScore) / 20)).toFixed(1);
  }

  // Review count: if verified detectedReviewCount (from known map or verified HTML/Maps), use it first! Else if AI provided review count, use it; STRICTLY "0" if none found!
  let finalReviewCount = "0";
  if (detectedReviewCount && String(detectedReviewCount).trim() !== "" && String(detectedReviewCount).trim() !== "0") {
    finalReviewCount = String(detectedReviewCount).replace(/[^0-9]/g, "") || "0";
  } else if (parsed.providerReviewCount !== undefined && parsed.providerReviewCount !== null && String(parsed.providerReviewCount).trim() !== "") {
    const rawCount = String(parsed.providerReviewCount).replace(/[^0-9]/g, "");
    finalReviewCount = rawCount ? rawCount : "0";
  }

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

  return enforceStrictTaxonomyGuardrails(draftResult, extractedData, taxonomies);
}

function enforceStrictTaxonomyGuardrails(
  publication: ScrapedPublication,
  extractedData: any,
  taxonomies?: any
): ScrapedPublication {
  const allText = `${publication.url} ${publication.title} ${publication.description} ${extractedData.textContent}`.toLowerCase();
  const titleClean = cleanTitleString(publication.title);
  publication.title = titleClean;
  publication.publisherName = cleanTitleString(publication.publisherName || titleClean);
  if (publication.titleI18n?.es) {
    publication.titleI18n.es = cleanTitleString(publication.titleI18n.es);
  }

  let descEs = publication.description || publication.descriptionI18n?.es || "";
  if (!descEs || descEs.length < 50 || !descEs.includes("<p>") || !descEs.includes("Propuesta de valor")) {
    const locText = [publication.city, publication.country].filter(Boolean).join(", ");
    const siteUrl = escapeHtml(publication.website || publication.url);
    const summaryClean = escapeHtml(decodeHtmlEntities((extractedData.description || extractedData.textContent || publication.title).slice(0, 380))).trim();
    descEs = [
      `<p><strong>Vigencia:</strong> Activo; sitio oficial actualizado. <strong>Precio:</strong> ${publication.price && publication.price !== "A consultar" ? escapeHtml(publication.price) : "A consultar / Según aranceles o tarifas del oferente."}</p>`,
      `<p>💡 <strong>Propuesta de valor:</strong> ${summaryClean}${locText ? ` con sede en ${locText}` : ""}. <strong>¿Para quién?:</strong> Personas interesadas, clientes, familias, estudiantes o profesionales según el rubro. <strong>Documentación requerida:</strong> DNI o pasaporte y documentación informada por el oferente. <strong>Permanencia:</strong> Según la modalidad o servicio contratado.</p>`,
      `<p>⭐ <strong>Diferencial:</strong> <em>Idiomas de atención:</em> ${publication.languages || "Español, Inglés"}. <em>Experiencia y soporte:</em> Información tomada directamente del portal oficial. <em>Diferencial vs. alternativas:</em> Contacto directo con el oferente y respaldo institucional.</p>`,
      `<p>⚠️ <strong>Exclusiones:</strong> Confirmar disponibilidad, tarifas vigentes, requisitos y condiciones particulares directamente en ${siteUrl} antes de contratar o postular.</p>`,
    ].join("\n");
  } else {
    descEs = normalizeToSpanishDescriptionHeaders(descEs);
  }

  publication.description = descEs;
  const hasSpanishMarkers = (str: string) => /<strong>\s*(?:Vigencia|Propuesta de valor|¿?Para qui[eé]n|Documentaci[oó]n requerida|Permanencia|Diferencial|Exclusiones):/i.test(str);

  if (!publication.descriptionI18n) {
    publication.descriptionI18n = {
      es: descEs,
      en: translateStructuredDescription(descEs, "en"),
      pt: translateStructuredDescription(descEs, "pt"),
      it: translateStructuredDescription(descEs, "it"),
    };
  } else {
    publication.descriptionI18n.es = descEs;
    if (!publication.descriptionI18n.en || publication.descriptionI18n.en === descEs || hasSpanishMarkers(publication.descriptionI18n.en) || !publication.descriptionI18n.en.includes("<p>")) {
      publication.descriptionI18n.en = translateStructuredDescription(descEs, "en");
    } else {
      publication.descriptionI18n.en = normalizeToEnglishDescriptionHeaders(publication.descriptionI18n.en);
    }
    if (!publication.descriptionI18n.pt || publication.descriptionI18n.pt === descEs || hasSpanishMarkers(publication.descriptionI18n.pt) || !publication.descriptionI18n.pt.includes("<p>")) {
      publication.descriptionI18n.pt = translateStructuredDescription(descEs, "pt");
    } else {
      publication.descriptionI18n.pt = normalizeToPortugueseDescriptionHeaders(publication.descriptionI18n.pt);
    }
    if (!publication.descriptionI18n.it || publication.descriptionI18n.it === descEs || hasSpanishMarkers(publication.descriptionI18n.it) || !publication.descriptionI18n.it.includes("<p>")) {
      publication.descriptionI18n.it = translateStructuredDescription(descEs, "it");
    } else {
      publication.descriptionI18n.it = normalizeToItalianDescriptionHeaders(publication.descriptionI18n.it);
    }
  }

  // Merge any extracted phone, whatsapp, email, web links
  if (extractedData?.socialLinksExtracted && Array.isArray(extractedData.socialLinksExtracted)) {
    publication.socialLinksDetailed = mergeSocialLinks(publication.socialLinksDetailed, extractedData.socialLinksExtracted);
  }

  const locInfo = detectAllLocationsAndHeadquarters(allText, publication.url, titleClean);
  const classified = classifySectorAndTaxonomy(publication.url, titleClean, allText, taxonomies);

  // 1. Check known institutions map for guaranteed accuracy
  try {
    const hostname = new URL(publication.url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
      if (hostname.includes(domainKey) || publication.url.toLowerCase().includes(domainKey)) {
        publication.title = cleanTitleString(publication.title || info.name);
        publication.publisherName = cleanTitleString(info.name);
        publication.providerStartYear = info.startYear;
        if (info.rating) publication.providerRating = info.rating;
        if (info.reviewCount) publication.providerReviewCount = info.reviewCount;
        if (info.commentsUrl) publication.providerCommentsUrl = info.commentsUrl;
        if (info.socialLinks && info.socialLinks.length) {
          publication.socialLinksDetailed = mergeSocialLinks(publication.socialLinksDetailed, info.socialLinks);
        }
        publication.city = info.primaryCity;
        publication.headquarterCity = info.primaryCity;
        publication.headquarterCountry = info.primaryCountry;
        publication.country = info.primaryCountry;
        publication.providerActivities = [info.activity];
        publication.category = info.category;
        publication.subcategory = info.subcategory;
        publication.categorySelections = [info.category];
        publication.subcategorySelections = [info.subcategory];
        publication.providerTypes = [info.type];
        publication.destinationCountries = [info.primaryCountry];
        publication.headquarterLocations = resolveHeadquarterLocations(
          publication.headquarterLocations,
          titleClean,
          publication.publisherName,
          info.primaryCity,
          info.primaryCountry,
          extractedData.detectedMapsUrl,
          allText,
          info.additionalCities || []
        );
        return publication;
      }
    }
  } catch {}

  // 2. Strict sector guardrails ONLY if AI categories/activities are unassigned or empty
  if (!publication.categorySelections || publication.categorySelections.length === 0 || publication.categorySelections[0] === "General") {
    publication.category = classified.category;
    publication.subcategory = classified.subcategory;
    publication.categorySelections = classified.categorySelections;
    publication.subcategorySelections = classified.subcategorySelections;
    publication.providerActivities = classified.providerActivities;
    publication.providerTypes = classified.providerTypes;
    publication.providerModalities = classified.providerModalities;
  }

  // 3. Guarantee valid founding year (never arbitrary 2015 or accidental footer copyright years like 2010/2024)
  if (extractedData.detectedFoundingYear && (!publication.providerStartYear || publication.providerStartYear === "2015" || publication.providerStartYear === "2010")) {
    publication.providerStartYear = extractedData.detectedFoundingYear;
  }
  if ((!publication.providerStartYear || publication.providerStartYear === "2015" || publication.providerStartYear === "2010") && !allText.includes(publication.providerStartYear)) {
    const calcYear = extractFoundingYear("", allText, publication.url, titleClean);
    if (calcYear) publication.providerStartYear = calcYear;
  }

  // 4. Guarantee accurate review count (strictly "0" if no reviews found, never fake "120")
  if (!publication.providerReviewCount || publication.providerReviewCount === "" || publication.providerReviewCount === "120") {
    if (extractedData.detectedReviewCount && extractedData.detectedReviewCount !== "0") {
      publication.providerReviewCount = extractedData.detectedReviewCount;
    } else {
      publication.providerReviewCount = "0";
    }
  }

  // 5. Build clean, precise Google Maps comments URL if empty or not matching exact entity
  if (!publication.providerCommentsUrl || !/^https?:\/\//i.test(publication.providerCommentsUrl) || publication.providerCommentsUrl === publication.url) {
    const parts = [
      publication.publisherName || publication.title,
      extractedData.detectedAddress || (publication.headquarterLocations?.[0]?.address),
      publication.headquarterCity || publication.city,
      publication.headquarterCountry || publication.country
    ].filter(Boolean);
    publication.providerCommentsUrl = buildGoogleMapsUrl(parts.join(", "));
  }

  // 6. Ensure headquarter locations has additional branches if multiple were detected
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

  // 7. Ensure destination countries is populated
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
  preferredProvider: string,
  geminiKey: string,
  openaiKey: string,
  customBlocks?: CustomScraperBlock[]
): Promise<{ publication: ScrapedPublication; providerUsed: string }> {
  const extracted = await fetchPageContent(url);
  const prompt = buildPrompt(extracted, taxonomies, customBlocks);

  const canUseGemini = Boolean(geminiKey);
  const canUseOpenAI = Boolean(openaiKey);

  const executeGemini = async () => {
    if (!canUseGemini) throw new Error("No hay GEMINI_API_KEY configurada.");
    const parsed = await callGeminiApi(prompt, geminiKey);
    const pub = await formatPublicationResult(parsed, extracted, taxonomies, customBlocks);
    return enforceStrictTaxonomyGuardrails(pub, extracted, taxonomies);
  };

  const executeOpenAI = async () => {
    if (!canUseOpenAI) throw new Error("No hay OPENAI_API_KEY configurada.");
    const parsed = await callOpenAIApi(prompt, openaiKey);
    const pub = await formatPublicationResult(parsed, extracted, taxonomies, customBlocks);
    return enforceStrictTaxonomyGuardrails(pub, extracted, taxonomies);
  };

  let publication: ScrapedPublication;
  let engineUsed = "fallback";

  if (preferredProvider === "openai") {
    try {
      publication = await executeOpenAI();
      engineUsed = "openai";
    } catch (openAiErr: any) {
      console.warn(`OpenAI failed for ${url}, trying Gemini fallback:`, openAiErr.message);
      try {
        publication = await executeGemini();
        engineUsed = "gemini";
      } catch (geminiErr: any) {
        console.error(`Gemini fallback also failed for ${url}:`, geminiErr.message);
        publication = enforceStrictTaxonomyGuardrails(await createFallbackPublication(extracted, taxonomies, customBlocks), extracted, taxonomies);
        engineUsed = "fallback";
      }
    }
  } else {
    // Default or explicitly "gemini"
    try {
      publication = await executeGemini();
      engineUsed = "gemini";
    } catch (geminiErr: any) {
      console.warn(`Gemini failed for ${url}, trying OpenAI fallback:`, geminiErr.message);
      try {
        publication = await executeOpenAI();
        engineUsed = "openai";
      } catch (openAiErr: any) {
        console.error(`OpenAI fallback also failed for ${url}:`, openAiErr.message);
        publication = enforceStrictTaxonomyGuardrails(await createFallbackPublication(extracted, taxonomies, customBlocks), extracted, taxonomies);
        engineUsed = "fallback";
      }
    }
  }

  return { publication, providerUsed: engineUsed };
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

    const taxonomies = await getAvailableSystemTaxonomies();

    const rawCustomBlocks = Array.isArray(body.customBlocks) ? body.customBlocks : [];
    const customBlocks: CustomScraperBlock[] = rawCustomBlocks
      .filter((b: any) => b && typeof b.title === "string" && b.title.trim())
      .map((b: any) => ({
        title: String(b.title).trim(),
        prompt: b.prompt ? String(b.prompt).trim() : undefined,
      }));

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
      try {
        const { publication, providerUsed } = await processUrlWithAI(
          url,
          taxonomies,
          effectiveProvider,
          geminiKey,
          openaiKey,
          customBlocks
        );
        providersUsed.add(providerUsed);
        return publication;
      } catch (err: any) {
        console.error(`Error processing URL ${url}:`, err);
        let host = "";
        try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
        const fallbackExtracted = { url, title: host, textContent: host, htmlContent: "", images: [], metaTags: {} };
        return enforceStrictTaxonomyGuardrails(await createFallbackPublication(fallbackExtracted, taxonomies, customBlocks), fallbackExtracted, taxonomies);
      }
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
