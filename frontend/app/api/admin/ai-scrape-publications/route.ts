import { NextResponse } from "next/server";

export const maxDuration = 60; // Allow long duration for AI scraping

export type I18nRecord = Record<string, string>;

export interface ExtraDescriptionBlock {
  title: string;
  titleI18n: I18nRecord;
  body: string;
  bodyI18n: I18nRecord;
  visibleInCard: boolean;
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
  let decoded = decodeHtmlEntities(title);
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
  additionalCities?: string[];
}> = {
  "garrahan.gov.ar": {
    name: "Hospital Garrahan",
    startYear: "1987",
    primaryCity: "Buenos Aires",
    primaryCountry: "Argentina",
    activity: "Salud y asistencia social",
    category: "Centros médicos, salud y bienestar",
    subcategory: "Especialidades médicas",
    type: "Organismo público",
    additionalCities: [],
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
    additionalCities: ["San Justo"],
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

function detectAllLocationsAndHeadquarters(allText: string, url: string, title: string): {
  primaryCity: string;
  primaryCountry: string;
  additionalCities: string[];
} {
  const lower = `${url} ${title} ${allText}`.toLowerCase();

  // Check known institutions map first
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    for (const [domainKey, info] of Object.entries(KNOWN_INSTITUTIONS_MAP)) {
      if (hostname.includes(domainKey) || url.toLowerCase().includes(domainKey)) {
        return {
          primaryCity: info.primaryCity,
          primaryCountry: info.primaryCountry,
          additionalCities: info.additionalCities || [],
        };
      }
    }
  } catch {}

  const cityMatches: Array<{ city: string; country: string; count: number; hasHqMention: boolean }> = [];

  const checkCity = (cityName: string, country: string, regex: RegExp) => {
    const matches = lower.match(regex);
    if (matches && matches.length > 0) {
      const hasHq =
        new RegExp(`(?:sede central|campus principal|casa central|rectorado|sede principal|campus central|casa matriz)[^.\\n]{0,60}${regex.source}`, "i").test(lower) ||
        new RegExp(`${regex.source}[^.\\n]{0,60}(?:sede central|campus principal|casa central|rectorado|sede principal)`, "i").test(lower);
      cityMatches.push({ city: cityName, country, count: matches.length, hasHqMention: hasHq });
    }
  };

  // Argentina cities
  checkCity("Córdoba", "Argentina", /\bc[oó]rdoba\b|\bcba\b/gi);
  checkCity("Río Cuarto", "Argentina", /r[ií]o cuarto/gi);
  checkCity("Villa María", "Argentina", /villa mar[ií]a/gi);
  checkCity("Villa Carlos Paz", "Argentina", /villa carlos paz/gi);
  checkCity("Buenos Aires", "Argentina", /buenos aires|caba|capital federal|palermo|recoleta|belgrano|puerto madero/gi);
  checkCity("La Plata", "Argentina", /la plata/gi);
  checkCity("Mar del Plata", "Argentina", /mar del plata/gi);
  checkCity("Rosario", "Argentina", /rosario/gi);
  checkCity("Santa Fe", "Argentina", /\bsanta fe\b/gi);
  checkCity("Mendoza", "Argentina", /mendoza|godoy cruz|guaymall[eé]n|san rafael/gi);
  checkCity("San Miguel de Tucumán", "Argentina", /tucum[aá]n/gi);
  checkCity("Salta", "Argentina", /\bsalta\b|cafayate/gi);
  checkCity("San Salvador de Jujuy", "Argentina", /jujuy/gi);
  checkCity("Neuquén", "Argentina", /neuqu[eé]n/gi);
  checkCity("San Carlos de Bariloche", "Argentina", /bariloche/gi);
  checkCity("San Juan", "Argentina", /san juan/gi);
  checkCity("San Luis", "Argentina", /san luis/gi);
  checkCity("Puerto Iguazú", "Argentina", /iguaz[uú]|posadas/gi);
  checkCity("Ushuaia", "Argentina", /ushuaia/gi);

  // Chile
  checkCity("Santiago", "Chile", /santiago de chile|\bsantiago\b/gi);
  checkCity("Valparaíso", "Chile", /valpara[ií]so|viña del mar/gi);
  checkCity("Concepción", "Chile", /concepci[oó]n/gi);

  // Brasil
  checkCity("São Paulo", "Brasil", /s[aã]o paulo/gi);
  checkCity("Rio de Janeiro", "Brasil", /rio de janeiro/gi);
  checkCity("Florianópolis", "Brasil", /florian[oó]polis/gi);

  // Other countries
  checkCity("Montevideo", "Uruguay", /montevideo/gi);
  checkCity("Bogotá", "Colombia", /bogot[aá]/gi);
  checkCity("Medellín", "Colombia", /medell[ií]n/gi);
  checkCity("Ciudad de México", "México", /ciudad de m[eé]xico|\bcdmx\b/gi);
  checkCity("Madrid", "España", /madrid/gi);
  checkCity("Barcelona", "España", /barcelona/gi);
  checkCity("Roma", "Italia", /roma\b/gi);
  checkCity("Milano", "Italia", /milano|milan\b/gi);

  if (cityMatches.length === 0) {
    return {
      primaryCity: "Córdoba",
      primaryCountry: "Argentina",
      additionalCities: [],
    };
  }

  // Sort candidate cities: HQ mention first, then occurrence count
  cityMatches.sort((a, b) => {
    if (a.hasHqMention && !b.hasHqMention) return -1;
    if (!a.hasHqMention && b.hasHqMention) return 1;
    return b.count - a.count;
  });

  const primary = cityMatches[0];
  const additional = cityMatches
    .slice(1)
    .map((c) => c.city)
    .filter((c) => c !== primary.city);

  return {
    primaryCity: primary.city,
    primaryCountry: primary.country,
    additionalCities: Array.from(new Set(additional)),
  };
}

function detectCityAndProvince(allText: string, url: string, title = ""): { city: string; country: string; province?: string } {
  const loc = detectAllLocationsAndHeadquarters(allText, url, title);
  return {
    city: loc.primaryCity,
    country: loc.primaryCountry,
  };
}

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
  // If rawLocations is provided from AI with multiple valid entries
  if (Array.isArray(rawLocations) && rawLocations.length > 0) {
    const validLocs = rawLocations
      .map((loc) => {
        if (!loc || typeof loc !== "object") return null;
        const locCountry = String(loc.country || country || "Argentina").trim();
        const locCity = String(loc.city || city || "Córdoba").trim();
        const locAddress = String(loc.address || "").trim();
        let mapUrl = String(loc.mapUrl || "").trim();
        if (!mapUrl) {
          const query = [publisherName || title, locAddress, locCity, locCountry].filter(Boolean).join(", ");
          mapUrl = buildGoogleMapsUrl(query);
        } else {
          mapUrl = buildGoogleMapsUrl(mapUrl);
        }
        return {
          country: locCountry,
          city: locCity,
          address: locAddress || undefined,
          mapUrl,
        };
      })
      .filter((loc): loc is { country: string; city: string; address: string | undefined; mapUrl: string } => Boolean(loc && loc.city));

    if (validLocs.length > 0) {
      return validLocs;
    }
  }

  // Build primary location
  const primaryMapUrl = detectedMapsUrl || buildGoogleMapsUrl(`${publisherName || title}, ${city}, ${country}`);
  const result: Array<{ country: string; city: string; address?: string; mapUrl: string }> = [
    {
      country: country || "Argentina",
      city: city || "Córdoba",
      address: undefined,
      mapUrl: primaryMapUrl,
    },
  ];

  // Append any detected additional cities/sedes
  if (Array.isArray(additionalCities) && additionalCities.length > 0) {
    additionalCities.forEach((addCity) => {
      if (!addCity || addCity.toLowerCase() === (city || "").toLowerCase()) return;
      const mapUrl = buildGoogleMapsUrl(`${publisherName || title}, ${addCity}, ${country}`);
      result.push({
        country: country || "Argentina",
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
    .map((l) => l.trim())
    .filter((l) => l && !JUNK_LINE_REGEX.test(l))
    .join("\n");

  let pageDescription = decodeHtmlEntities(getMetaTag("og:description") || getMetaTag("description") || "");
  if (!pageDescription || pageDescription.length < 20 || JUNK_LINE_REGEX.test(pageDescription)) {
    const paragraphs = textContent.split("\n\n").map((p) => p.trim());
    const candidate = paragraphs.find((p) => p.length >= 45 && !p.includes("•") && !JUNK_LINE_REGEX.test(p));
    if (candidate) {
      pageDescription = candidate.slice(0, 350).trim();
    }
  }

  const detectedFoundingYear = extractFoundingYear(cleanHtml, textContent, sourceUrl, pageTitle);

  const mapsRegex = /https?:\/\/(?:www\.)?(?:google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)[^\s"'<>]+/gi;
  const mapsMatches = cleanHtml.match(mapsRegex) || [];
  const detectedMapsUrl = mapsMatches[0] || "";

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const emailsFound = Array.from(new Set(cleanHtml.match(emailRegex) || []))
    .filter((e) => !e.includes(".png") && !e.includes(".jpg") && !e.includes(".svg") && !e.includes("wixpress"))
    .slice(0, 3);

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

  emailsFound.forEach((email) => {
    socialLinksExtracted.push({ kind: "email", label: "Email de contacto", url: `mailto:${email}` });
  });

  socialPatterns.forEach(({ kind, regex, label }) => {
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
    detectedMapsUrl,
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

/**
 * Fallback description generator if AI output is empty or completely missing.
 */
function buildGroundedDescriptions(
  extractedData: any,
  title: string,
  city: string,
  country: string
): I18nRecord {
  let rawDesc = extractedData.description;
  if (!rawDesc || rawDesc.length < 20) {
    const paragraphs = (extractedData.textContent || "").split("\n\n").map((p: string) => p.trim());
    rawDesc = paragraphs.find((p: string) => p.length >= 45 && !p.includes("•") && !/portal del empleado|webmail|intranet|gde|login|iniciar sesi/i.test(p)) || paragraphs[0] || title;
  }
  const cleanSummary = escapeHtml(decodeHtmlEntities(rawDesc.slice(0, 320)));
  const locationText = [city, country].filter(Boolean).join(", ");
  const siteUrl = escapeHtml(extractedData.url);

  const es = [
    `<p><strong>Vigencia:</strong> Activo; sitio oficial actualizado. <strong>Precio:</strong> A consultar / Según aranceles o tarifas del oferente.</p>`,
    `<p>💡 <strong>Propuesta de valor:</strong> ${cleanSummary}${locationText ? ` con sede en ${locationText}` : ""}. <strong>¿Para quién?:</strong> Personas interesadas, clientes, familias, estudiantes o profesionales según el rubro. <strong>Documentación requerida:</strong> DNI o pasaporte y documentación informada por el oferente. <strong>Permanencia:</strong> Según la modalidad o servicio contratado.</p>`,
    `<p>⭐ <strong>Diferencial:</strong> <em>Idiomas de atención:</em> Español, Inglés. <em>Experiencia y soporte:</em> Información tomada directamente del portal oficial. <em>Diferencial vs. alternativas:</em> Contacto directo con el oferente y respaldo institucional.</p>`,
    `<p>⚠️ <strong>Exclusiones:</strong> Confirmar disponibilidad, tarifas vigentes, requisitos y condiciones particulares directamente en ${siteUrl} antes de contratar o postular.</p>`,
  ].join("\n");

  const en = [
    `<p><strong>Validity:</strong> Active; official website updated. <strong>Price:</strong> Upon request / Subject to provider rates.</p>`,
    `<p>💡 <strong>Value proposition:</strong> ${cleanSummary}${locationText ? ` based in ${locationText}` : ""}. <strong>Who is it for?:</strong> Interested individuals, clients, families, students, or professionals according to sector. <strong>Required documents:</strong> ID or passport and specific documentation informed by the provider. <strong>Length of stay:</strong> According to service modality.</p>`,
    `<p>⭐ <strong>Differentiator:</strong> <em>Service languages:</em> Spanish, English. <em>Experience and support:</em> Information sourced directly from the official portal. <em>Differentiator vs. alternatives:</em> Direct contact with provider and institutional backing.</p>`,
    `<p>⚠️ <strong>Exclusions:</strong> Confirm availability, current rates, requirements, and conditions directly on ${siteUrl} before hiring or applying.</p>`,
  ].join("\n");

  const pt = [
    `<p><strong>Validade:</strong> Ativo; site oficial atualizado. <strong>Preço:</strong> Sob consulta / Conforme tarifas do provedor.</p>`,
    `<p>💡 <strong>Proposta de valor:</strong> ${cleanSummary}${locationText ? ` com sede em ${locationText}` : ""}. <strong>Para quem?:</strong> Interessados, clientes, famílias, estudantes ou profissionais conforme o setor. <strong>Documentação necessária:</strong> RG ou passaporte e documentos informados pelo provedor. <strong>Permanência:</strong> Conforme o serviço contratado.</p>`,
    `<p>⭐ <strong>Diferencial:</strong> <em>Idiomas de atendimento:</em> Espanhol, Inglês. <em>Experiência e suporte:</em> Informações obtidas diretamente do portal oficial. <em>Diferencial vs. alternativas:</em> Contato direto com o provedor e respaldo institucional.</p>`,
    `<p>⚠️ <strong>Exclusões:</strong> Confirmar disponibilidade, tarifas, requisitos e condições diretamente em ${siteUrl} antes da contratação.</p>`,
  ].join("\n");

  const it = [
    `<p><strong>Validità:</strong> Attivo; sito ufficiale aggiornato. <strong>Prezzo:</strong> Su richiesta / In base alle tariffe del fornitore.</p>`,
    `<p>💡 <strong>Proposta di valore:</strong> ${cleanSummary}${locationText ? ` con sede a ${locationText}` : ""}. <strong>Per chi?:</strong> Persone interessate, clienti, famiglie, studenti o professionisti a seconda del settore. <strong>Documentazione richiesta:</strong> Carta d'identità o passaporto e documenti richiesti dal fornitore. <strong>Permanenza:</strong> In base al servizio richiesto.</p>`,
    `<p>⭐ <strong>Differenziale:</strong> <em>Lingue di assistenza:</em> Spagnolo, Inglese. <em>Esperienza e supporto:</em> Informazioni tratte direttamente dal portale ufficiale. <em>Differenziale vs. alternative:</em> Contatto diretto con il fornitore e supporto istituzionale.</p>`,
    `<p>⚠️ <strong>Esclusioni:</strong> Verificare disponibilità, tariffe, requisiti e condizioni direttamente su ${siteUrl} prima di procedere.</p>`,
  ].join("\n");

  return { es, en, pt, it };
}

function classifySectorAndTaxonomy(
  url: string,
  title: string,
  allText: string,
  taxonomies?: any
): {
  sector: "education" | "health" | "legal" | "tourism" | "coworking" | "sports" | "volunteer" | "general";
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

  // 3. Explicit sector triggers based on primary domain / institution identity
  const isExplicitHospital =
    /\b(hospital|sanatorio|cl[ií]nica|centro m[eé]dico|centro asistencial|guardia m[eé]dica|pediatr[ií]a|maternidad|policl[ií]nic[oa]|salud pedi[aá]trica|atenci[oó]n m[eé]dica|urgencias m[eé]dicas)\b/i.test(title) ||
    /\b(hospital|sanatorio|garrahan|clinica|centro-medico)\b/i.test(url) ||
    /\b(hospital de pediatr[ií]a|hospital p[uú]blico|guardia m[eé]dica|atenci[oó]n pedi[aá]trica|especialidades m[eé]dicas)\b/i.test(lower);

  const isEduDomain = (/\.edu(?:\.[a-z]{2})?|\.ac(?:\.[a-z]{2})?/i.test(url)) && !isExplicitHospital;
  const isExplicitEdu =
    (/\b(universidad|facultad|campus universitario|colegio|instituto superior|conservatorio)\b/i.test(title) ||
    isEduDomain) && !isExplicitHospital;

  const isExplicitLegal =
    /\b(abogad[oa]s?|estudio jur[ií]dico|law firm|escriban[ií]a|notar[ií]a|asesor[ií]a legal|visas? migratori[ao]s?|tr[aá]mites migratorios|ciudadan[ií]a)\b/i.test(title) ||
    /\b(abogad|estudiojuridico|notaria)\b/i.test(url);

  const isExplicitTourism =
    /\b(hotel\b|hostel\b|resort\b|cabañas?\b|apart hotel\b|posada\b|hospedaje\b|hostal\b)\b/i.test(title) ||
    /\b(hotel|hostel|resort|cabana)\b/i.test(url);

  // Health priority check
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

  // Education priority check
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

  // Legal priority check
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

  // Tourism priority check
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

  // 4. Weighted scoring fallback for general web pages
  const eduKeywords = (lower.match(/universidad|facultad|carrera|licenciatura|posgrado|maestr[ií]a|diplomatura|campus universitario|oferta acad[eé]mica|inscripciones|ingreso acad[eé]mico|estudiantes|alumnos|colegio|instituto de formaci[oó]n|tecnicatura/gi) || []).length;
  const eduScore = eduKeywords * 2;

  const cleanHealthText = lower.replace(/ciencias de la salud|facultad de medicina|facultad de ciencias m[eé]dicas|carrera de m[eé]dico|carrera de enfermer[ií]a|carrera de kinesiolog[ií]a|departamento de salud/gi, "");
  const healthKeywords = (cleanHealthText.match(/hospital|sanatorio|cl[ií]nica m[eé]dica|centro asistencial|guardia m[eé]dica|guardia 24hs|internaci[oó]n|quir[oó]fano|obra social|prepaga|cartilla m[eé]dica|turnos m[eé]dicos|m[eé]dicos especialistas|odontolog[ií]a|pediatr[ií]a/gi) || []).length;
  const healthScore = healthKeywords * 3;

  const legalKeywords = (lower.match(/abogad|estudio jur[ií]dico|asesor[ií]a legal|derecho civil|derecho penal|derecho laboral|notar[ií]a|escriban[ií]a|visas? migratori|tr[aá]mites migratorios|ciudadan[ií]a/gi) || []).length;
  const legalScore = legalKeywords * 3;

  const tourismKeywords = (lower.match(/hotel\b|hostel\b|alojamiento|cabañas?|resort|apart hotel|habitaciones|check-in|check-out|desayuno buffet|estad[ií]a tur[ií]stica/gi) || []).length;
  const tourismScore = tourismKeywords * 3;

  const volunteerKeywords = (lower.match(/voluntariado|ayuda social|sin fines de lucro|\bong\b|comedor comunitario|asociaci[oó]n civil/gi) || []).length;
  const volunteerScore = volunteerKeywords * 3;

  const maxScore = Math.max(healthScore, eduScore, legalScore, tourismScore, volunteerScore);

  if (maxScore > 0 && maxScore === healthScore) {
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

  if (maxScore > 0 && maxScore === eduScore) {
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

  if (maxScore > 0 && maxScore === legalScore) {
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

  if (maxScore > 0 && maxScore === tourismScore) {
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

  if (maxScore > 0 && maxScore === volunteerScore) {
    const cat = validCats.find((c) => /voluntari|ayuda/i.test(c)) || "Voluntariados y Centros de Ayuda";
    const sub = validSubcats.find((s) => /ayuda|comunitaria/i.test(s)) || "Voluntariado social";
    const act = validActs.find((a) => /asistencia|social/i.test(a)) || "Salud y asistencia social";
    const typ = validTypes.find((t) => /sin [aá]nimo|ong|fundaci[oó]n/i.test(t)) || "Organismo sin ánimo de lucro";
    return {
      sector: "volunteer",
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

function createFallbackPublication(extractedData: any, taxonomies?: any): ScrapedPublication {
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
  const scoreBlock = buildScoreScoutBlock(titleClean, startYear, "4.8", allText);
  const descriptions = buildGroundedDescriptions(extractedData, titleClean, primaryHq.city, primaryHq.country);

  return {
    url: extractedData.url,
    title: titleClean,
    titleI18n: { es: titleClean, en: titleClean, pt: titleClean, it: titleClean },
    description: descriptions.es,
    descriptionI18n: descriptions,
    extraDescriptions: [scoreBlock],
    publisherName: titleClean,
    providerInfoI18n: {
      es: `Institución y prestador de servicios en ${primaryHq.city}.`,
      en: `Institution and service provider in ${primaryHq.city}.`,
      pt: `Instituição e provedor de serviços em ${primaryHq.city}.`,
      it: `Istituzione e fornitore di servicios a ${primaryHq.city}.`,
    },
    providerStartYear: startYear,
    providerRating: extractRatingFromText(allText) || "4.8",
    providerReviewCount: extractReviewCountFromText(allText) || "120",
    providerCommentsUrl: extractedData.url,
    providerLogo: extractedData.detectedLogo || "",
    country: primaryHq.country,
    city: primaryHq.city,
    headquarterCountry: primaryHq.country,
    headquarterCity: primaryHq.city,
    locationAddress: primaryHq.mapUrl,
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

function buildPrompt(extractedData: any, taxonomies: any): string {
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

  return `
Eres el Lead AI Auditor y Clasificador Experto de Travelgrin. Travelgrin es una plataforma internacional que publica y audita todo tipo de entidades:
- Universidades, Facultades, Colegios, Institutos, Cursos y Centros Académicos.
- Obras Sociales, Hospitales, Clínicas, Sanatorios y Centros de Salud.
- Hoteles, Hostels, Cabañas, Apartamentos y Alojamientos Turísticos.
- Estudios Jurídicos, Abogados, Notarías, Gestorías y Visas Migratorias.
- Coworkings, Inmobiliarias, Bienes Raíces y Espacios de Trabajo.
- Empresas de Tecnología, Software, Consultoría y Marketing.
- Restaurantes, Bares, Cafeterías y Gastronomía.
- Gimnasios, Deportes, Centros de Fitness y Aventura.
- Voluntariados, ONGs y Centros de Ayuda Social.
- Comercios y Servicios Profesionales de cualquier otro sector.

DATOS EXTRAÍDOS DE LA WEB:
- URL: ${extractedData.url}
- Título Detectado: ${extractedData.title}
- Meta Descripción: ${extractedData.description}
${extractedData.detectedFoundingYear ? `- AÑO HISTÓRICO / FUNDACIÓN DETECTADO: ${extractedData.detectedFoundingYear}` : ""}
${extractedData.detectedMapsUrl ? `- URL DE GOOGLE MAPS DETECTADA: ${extractedData.detectedMapsUrl}` : ""}
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
- 'title' y 'publisherName' deben ser el nombre oficial y limpio de la entidad (ej: "Hospital Garrahan", "Universidad de Buenos Aires", "Universidad Siglo 21").
- ELIMINA por completo sufijos o prefijos genéricos de navegación como "- Home", "| Home", "- Inicio", "| Inicio", "- Portada", "| Portada", "- Bienvenidos", "| Sitio Oficial", "- Web Oficial", etc.
- 'providerStartYear': Utiliza tu conocimiento mundial profundo y el texto del sitio para determinar el año real de inauguración o fundación de la entidad (ej: Hospital Garrahan = 1987, UBA = 1821, Universidad Siglo 21 = 1995, Hospital Italiano = 1853). NUNCA uses años de copyright del pie de página (como © 2010, © 2024), pues solo corresponden al creador del sitio web y no a la institución.

1. VERACIDAD Y CERO MEZCLA DE RUBROS:
- Basa tu análisis EXCLUSIVAMENTE en la naturaleza central de lo que esta entidad ofrece en la realidad:
  * Si es HOSPITAL / SANATORIO / CLÍNICA / CENTRO MÉDICO / PEDIATRÍA:
    - Describe servicios médicos, guardias, consultas, internación y especialidades médicas.
    - Actividad: ["Salud y asistencia social"] (OBLIGATORIO).
    - Categoría: ["Centros médicos, salud y bienestar"] (OBLIGATORIO).
    - Subcategoría: ["Especialidades médicas"] (o Diagnóstico y laboratorio según corresponda).
    - Tipo: Si es estatal, nacional, provincial o .gov/.gob: ["Organismo público"]. Si es privado: ["Institución privada"].
    - PROHIBIDO clasificarlo como educación o formación, ni como "Curso o formación", aunque tenga programas de residencia o docencia médica.
  * Si es UNIVERSIDAD / FACULTAD / CENTRO EDUCATIVO:
    - Describe carreras de grado, posgrados, maestrías, cursos, investigación y admisiones.
    - Actividad: ["Educación y formación"] (OBLIGATORIO).
    - Categoría: ["Educación y centros de estudios"] (OBLIGATORIO).
    - Subcategoría: ["Universidad y posgrado"] (o Idiomas / Becas / Certificados).
    - Tipo: Si es pública/nacional: ["Organismo público"]. Si es privada: ["Institución privada"].
  * Si es ESTUDIO JURÍDICO / ABOGADOS / VISAS / MIGRACIÓN:
    - Describe asesoría legal, trámites migratorios, representación y gestoría.
    - Actividad: ["Servicios profesionales y técnicos"].
    - Categoría: ["Residencia y ciudadanía"] o ["Asesoría legal migratoria"].
    - Tipo: ["Profesional independiente"] (si es unipersonal) o ["Institución privada"].
  * Si es HOTEL / HOSTEL / TURISMO / ALOJAMIENTO:
    - Describe habitaciones, servicios, desayuno, estadías y reservas turísticas.
    - Actividad: ["Hostelería, alojamiento y turismo"].
    - Categoría: ["Alojamiento"].
    - Subcategoría: ["Hoteles y hostels"].
    - Tipo: ["Institución privada"].

2. DESCRIPCIÓN PRINCIPAL (ESTRUCTURA DE 4 PÁRRAFOS HTML CON ICONOS):
Genera 'description' (en español) y 'descriptionI18n' (con traducciones fieles en es, en, pt, it) respetando EXACTAMENTE estos 4 párrafos:
<p><strong>Vigencia:</strong> Activo; sitio oficial actualizado. <strong>Precio:</strong> [Precio/Aranceles reales informados en la web o "A consultar"].</p>
<p>💡 <strong>Propuesta de valor:</strong> [Explicación exhaustiva y REAL de los servicios o productos que brinda según el texto de la web]. <strong>¿Para quién?:</strong> [Público objetivo real]. <strong>Documentación requerida:</strong> [Requisitos reales según la web o acordes a su rubro]. <strong>Permanencia:</strong> [Modalidad temporal, ej: según servicio contratado, ciclo lectivo anual, estadía por noche, etc.].</p>
<p>⭐ <strong>Diferencial:</strong> <em>Idiomas de atención:</em> [Idiomas de atención detectados]. <em>Experiencia con clientes o extranjeros:</em> [Alcance y soporte real]. <em>Diferencial vs. alternativas:</em> [Ventajas competitivas reales, acreditación, trayectoria].</p>
<p>⚠️ <strong>Exclusiones:</strong> [Políticas, aclaraciones, aranceles o condiciones informadas en la web].</p>

3. AUDITORÍA DEL SCORE SCOUT (0 a 100 PUNTOS):
Audita la entidad en 6 dimensiones reales:
- Presencia y reputación institucional: p1 (0 a 25 puntos)
- Canales de contacto verificables (teléfono, email, whatsapp, maps): p2 (0 a 15 puntos)
- Trayectoria y madurez operativa (años de actividad o fundación): p3 (0 a 20 puntos)
- Claridad de la propuesta en su sitio web: p4 (0 a 15 puntos)
- Transparencia y seguridad: p5 (0 a 15 puntos)
- Datos institucionales y acreditación: p6 (0 a 10 puntos)
Suma = totalScore (0 a 100).
Madurez: "Líder" (si es una entidad histórica o de gran escala), "Consolidado" (si tiene trayectoria sólida y comprobable), "En desarrollo" o "Inicial".
Vínculo: "Oficial" (si es organismo estatal o universidad oficial) o "Directo".
Genera dentro de 'extraDescriptions' el bloque del Score Scout con 'visibleInCard': true y textos en es, en, pt, it.

4. DESCRIPCIONES OPCIONALES ADICIONALES:
Además del bloque Score Scout, si la web contiene secciones específicas e importantes (como "Requisitos de Admisión", "Servicios Principales", "Cartilla de Prestadores", "Políticas de Estadía"), agrega 1 o 2 bloques en 'extraDescriptions' con 'title', 'titleI18n', 'body', 'bodyI18n' (es, en, pt, it) y 'visibleInCard': false.

5. TAXONOMÍAS ASIGNADAS (DEL CATÁLOGO OFICIAL DE LA BD):
- 'category': Categoría padre más relevante de la BD.
- 'subcategory': Subcategoría específica más relevante de la BD.
- 'categorySelections': Array con las categorías seleccionadas.
- 'subcategorySelections': Array con las subcategorías seleccionadas.
- 'providerActivities': Array de actividades seleccionadas de la lista de BD.
- 'providerTypes': Array de tipos de perfil seleccionados de la lista de BD.
- 'providerModalities': Array de modalidades seleccionadas de la lista de BD.

6. SEDES MÚLTIPLES Y UBICACIÓN:
- 'country', 'city', 'headquarterCountry', 'headquarterCity', 'locationAddress'.
- 'headquarterLocations': [{ "country": "...", "city": "...", "address": "...", "mapUrl": "https://www.google.com/maps/search/?api=1&query=..." }].

Devuelve UN OBJETO JSON con las siguientes claves exactas:
url, title, titleI18n, description, descriptionI18n, extraDescriptions, publisherName, providerInfoI18n, providerStartYear, providerRating, providerReviewCount, providerCommentsUrl, country, city, headquarterCountry, headquarterCity, locationAddress, headquarterLocations, currency, price, pricePeriod, languages, website, socialLinksDetailed, category, subcategory, categorySelections, subcategorySelections, providerActivities, providerTypes, providerModalities, scoreScout: { totalScore, p1, p2, p3, p4, p5, p6, maturity, relationship, evidenceSummary }.

Responde ÚNICAMENTE con JSON estricto sin formato markdown ni texto adicional.
`;
}

function formatPublicationResult(parsed: any, extractedData: any, taxonomies?: any): ScrapedPublication {
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

  let matchedCatSelections: string[] = rawCatSelections.length > 0 ? rawCatSelections : sectorClassification.categorySelections;
  let matchedSubcatSelections: string[] = rawSubcatSelections.length > 0 ? rawSubcatSelections : sectorClassification.subcategorySelections;
  let matchedActivities: string[] = Array.isArray(parsed.providerActivities) && parsed.providerActivities.length > 0
    ? parsed.providerActivities
    : sectorClassification.providerActivities;
  let matchedTypes: string[] = Array.isArray(parsed.providerTypes) && parsed.providerTypes.length > 0
    ? parsed.providerTypes
    : sectorClassification.providerTypes;
  let matchedModalities: string[] = Array.isArray(parsed.providerModalities) && parsed.providerModalities.length > 0
    ? parsed.providerModalities
    : sectorClassification.providerModalities;

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

  // Preserve the AI-generated structured description
  const rawDescI18n = parsed.descriptionI18n || {};
  let finalDescEs = String(rawDescI18n.es || parsed.description || "").trim();
  let finalDescEn = String(rawDescI18n.en || finalDescEs).trim();
  let finalDescPt = String(rawDescI18n.pt || finalDescEs).trim();
  let finalDescIt = String(rawDescI18n.it || finalDescEs).trim();

  // If the AI description was missing or too short, use grounded fallback
  if (finalDescEs.length < 50) {
    const fallbackDesc = buildGroundedDescriptions(extractedData, title, primaryHq.city, primaryHq.country);
    finalDescEs = fallbackDesc.es;
    finalDescEn = fallbackDesc.en;
    finalDescPt = fallbackDesc.pt;
    finalDescIt = fallbackDesc.it;
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
        pt: `Instituição e provedor de serviços em ${primaryHq.city}.`,
        it: `Istituzione e fornitore di servicios a ${primaryHq.city}.`,
      };

  const detectedRating = extractRatingFromText(`${extractedData.description || ""} ${extractedData.textContent || ""}`);
  const detectedReviewCount = extractReviewCountFromText(`${extractedData.description || ""} ${extractedData.textContent || ""}`);

  const logoUrl =
    (isValidLogoUrl(extractedData.detectedLogo) ? extractedData.detectedLogo : "") ||
    (isValidLogoUrl(parsed.providerLogo) ? parsed.providerLogo : "") ||
    "";

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
    providerRating: String(detectedRating || parsed.providerRating || "4.8"),
    providerReviewCount: String(detectedReviewCount || parsed.providerReviewCount || "120"),
    providerCommentsUrl: parsed.providerCommentsUrl || extractedData.url,
    providerLogo: logoUrl,
    country: primaryHq.country || country,
    city: primaryHq.city || city,
    headquarterCountry: primaryHq.country || parsed.headquarterCountry || country,
    headquarterCity: primaryHq.city || parsed.headquarterCity || city,
    locationAddress: primaryHq.mapUrl || initialMapsUrl,
    headquarterLocations,
    currency: parsed.currency || "USD",
    price: String(parsed.price && !/precio a convenir/i.test(parsed.price) ? parsed.price : "A consultar"),
    pricePeriod: parsed.pricePeriod || "",
    languages: parsed.languages || "Español, Inglés",
    website: parsed.website || extractedData.url,
    socialLinksDetailed:
      Array.isArray(parsed.socialLinksDetailed) && parsed.socialLinksDetailed.length
        ? parsed.socialLinksDetailed
        : extractedData.socialLinksExtracted || [{ kind: "web", label: "Sitio Oficial", url: extractedData.url }],
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

  // 2. Strict sector guardrails for ANY web publication
  if (classified.sector === "health") {
    publication.providerActivities = [classified.providerActivities[0] || "Salud y asistencia social"];
    publication.category = classified.category;
    publication.subcategory = classified.subcategory;
    publication.categorySelections = classified.categorySelections;
    publication.subcategorySelections = classified.subcategorySelections;
    publication.providerTypes = classified.providerTypes;
  } else if (classified.sector === "education") {
    publication.providerActivities = [classified.providerActivities[0] || "Educación y formación"];
    publication.category = classified.category;
    publication.subcategory = classified.subcategory;
    publication.categorySelections = classified.categorySelections;
    publication.subcategorySelections = classified.subcategorySelections;
    publication.providerTypes = classified.providerTypes;
  } else if (classified.sector === "legal") {
    publication.providerActivities = [classified.providerActivities[0] || "Servicios profesionales y técnicos"];
    publication.category = classified.category;
    publication.subcategory = classified.subcategory;
    publication.categorySelections = classified.categorySelections;
    publication.subcategorySelections = classified.subcategorySelections;
  } else if (classified.sector === "tourism") {
    publication.providerActivities = [classified.providerActivities[0] || "Hostelería, alojamiento y turismo"];
    publication.category = classified.category;
    publication.subcategory = classified.subcategory;
    publication.categorySelections = classified.categorySelections;
    publication.subcategorySelections = classified.subcategorySelections;
  }

  // 3. Guarantee valid founding year (never arbitrary 2015 or accidental footer copyright years like 2010/2024)
  if (extractedData.detectedFoundingYear && (!publication.providerStartYear || publication.providerStartYear === "2015" || publication.providerStartYear === "2010")) {
    publication.providerStartYear = extractedData.detectedFoundingYear;
  }
  if ((!publication.providerStartYear || publication.providerStartYear === "2015" || publication.providerStartYear === "2010") && !allText.includes(publication.providerStartYear)) {
    const calcYear = extractFoundingYear("", allText, publication.url, titleClean);
    if (calcYear) publication.providerStartYear = calcYear;
  }

  // 4. Ensure headquarter locations has additional branches if multiple were detected
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

  return publication;
}

async function processUrlWithAI(
  url: string,
  taxonomies: any,
  preferredProvider: string,
  geminiKey: string,
  openaiKey: string
): Promise<{ publication: ScrapedPublication; providerUsed: string }> {
  const extracted = await fetchPageContent(url);
  const prompt = buildPrompt(extracted, taxonomies);

  const canUseGemini = Boolean(geminiKey);
  const canUseOpenAI = Boolean(openaiKey);

  const executeGemini = async () => {
    if (!canUseGemini) throw new Error("No hay GEMINI_API_KEY configurada.");
    const parsed = await callGeminiApi(prompt, geminiKey);
    return formatPublicationResult(parsed, extracted, taxonomies);
  };

  const executeOpenAI = async () => {
    if (!canUseOpenAI) throw new Error("No hay OPENAI_API_KEY configurada.");
    const parsed = await callOpenAIApi(prompt, openaiKey);
    return formatPublicationResult(parsed, extracted, taxonomies);
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
        publication = enforceStrictTaxonomyGuardrails(createFallbackPublication(extracted, taxonomies), extracted, taxonomies);
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
        publication = enforceStrictTaxonomyGuardrails(createFallbackPublication(extracted, taxonomies), extracted, taxonomies);
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
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((item) => fn(item)));
    results.push(...chunkResults);
  }
  return results;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const urls: string[] = Array.isArray(body.urls)
      ? body.urls.filter(Boolean)
      : body.url
      ? [body.url]
      : [];

    if (!urls.length) {
      return NextResponse.json({ error: "Debe proporcionar al menos una URL válida." }, { status: 400 });
    }

    const taxonomies = await getAvailableSystemTaxonomies();

    const envProvider = (process.env.AI_PROVIDER || "").toLowerCase();
    const requestedProvider = String(body.provider || "").toLowerCase();

    const customApiKey = String(body.apiKey || "").trim();

    const geminiKey =
      (customApiKey && (customApiKey.startsWith("AIza") || !customApiKey.startsWith("sk-")) ? customApiKey : "") ||
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";

    const openaiKey =
      (customApiKey && customApiKey.startsWith("sk-") ? customApiKey : "") ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      "";

    const effectiveProvider =
      requestedProvider === "openai" || requestedProvider === "gemini"
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
          openaiKey
        );
        providersUsed.add(providerUsed);
        return publication;
      } catch (err: any) {
        console.error(`Error processing URL ${url}:`, err);
        let host = "";
        try { host = new URL(url).hostname.replace(/^www\./, ""); } catch {}
        const fallbackExtracted = { url, title: host, textContent: host, htmlContent: "", images: [], metaTags: {} };
        return enforceStrictTaxonomyGuardrails(createFallbackPublication(fallbackExtracted, taxonomies), fallbackExtracted, taxonomies);
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
