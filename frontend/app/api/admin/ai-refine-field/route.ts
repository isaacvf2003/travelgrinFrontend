import { NextResponse } from "next/server";

export const maxDuration = 60;

type FieldType = "title" | "description" | "provider_info" | "extra_block" | "new_extra_block";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface RefineFieldRequest {
  fieldType: FieldType;
  currentText?: string;
  currentTitle?: string;
  prompt: string;
  publisherName?: string;
  category?: string;
  city?: string;
  country?: string;
  url?: string;
  sourceLang?: string;
  autoTranslate?: boolean;
  apiKey?: string;
  conversationHistory?: ConversationMessage[];
  variationIndex?: number;
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
    .trim();
}

function cleanTitleString(title: string): string {
  if (!title) return "";
  let decoded = decodeHtmlEntities(title);
  decoded = decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—|]\s*(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*$/i, "")
    .replace(/^(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*[-–—|]\s*/i, "")
    .trim();
  return decoded;
}

function cleanBaseEntityName(text: string, publisherName?: string): string {
  let base = cleanTitleString(publisherName || text || "");
  if (!base && text) base = cleanTitleString(text);
  
  const pipeParts = base.split(/\s*[-–—|]\s*/).filter(Boolean);
  if (pipeParts.length > 1) {
    const p1 = pipeParts[0].trim();
    const p2 = pipeParts[1].trim();
    if (p1.toLowerCase().includes(p2.toLowerCase()) || p2.toLowerCase().includes(p1.toLowerCase())) {
      base = p1.length >= p2.length ? p1 : p2;
    } else {
      base = p1;
    }
  }
  return base.trim();
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms: number = 15000): Promise<Response> {
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

async function translateWithGoogleDirect(text: string, sl: string, tl: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 4000);
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

  const gRes = await translateWithGoogleDirect(trimmed, sl, tl);
  if (gRes && gRes.trim() && gRes.trim() !== trimmed) {
    return cleanTitleString(gRes.trim());
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${sl}|${tl}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 4000);
    if (res.ok) {
      const data = await res.json();
      const trans = data.responseData?.translatedText;
      if (trans && typeof trans === "string" && !trans.includes("MYMEMORY WARNING")) {
        return cleanTitleString(trans.trim());
      }
    }
  } catch {}

  return q;
}

function normalizeToEnglishDescriptionHeaders(text: string): string {
  if (!text) return "";
  return text
    .replace(/<strong>\s*(?:Vigencia|Validade|Validità):\s*<\/strong>/gi, "<strong>Validity:</strong>")
    .replace(/<strong>\s*(?:Precio|Preço|Prezzo):\s*<\/strong>/gi, "<strong>Price:</strong>")
    .replace(/<strong>\s*(?:Propuesta de valor|Proposta de valor|Proposta di valore):\s*<\/strong>/gi, "<strong>Value proposition:</strong>")
    .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Para quem\??|Per chi\??):\s*<\/strong>/gi, "<strong>Who is it for?:</strong>")
    .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Required documents:</strong>")
    .replace(/<strong>\s*(?:Permanencia|Permanência|Permanenza):\s*<\/strong>/gi, "<strong>Length of stay:</strong>")
    .replace(/<strong>\s*(?:Diferencial|Differenziale):\s*<\/strong>/gi, "<strong>Differentiator:</strong>")
    .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Idiomas de atendimento|Lingue di assistenza):\s*<\/em>/gi, "<em>Service languages:</em>")
    .replace(/<em>\s*(?:Experiencia y soporte|Experiência e suporte|Esperienza e supporto):\s*<\/em>/gi, "<em>Experience and support:</em>")
    .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Differentiator vs. alternatives:</em>")
    .replace(/<strong>\s*(?:Exclusiones|Exclusões|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusions:</strong>");
}

function normalizeToPortugueseDescriptionHeaders(text: string): string {
  if (!text) return "";
  return text
    .replace(/<strong>\s*(?:Vigencia|Validity|Validità):\s*<\/strong>/gi, "<strong>Validade:</strong>")
    .replace(/<strong>\s*(?:Precio|Price|Prezzo):\s*<\/strong>/gi, "<strong>Preço:</strong>")
    .replace(/<strong>\s*(?:Propuesta de valor|Value proposition):\s*<\/strong>/gi, "<strong>Proposta de valor:</strong>")
    .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Per chi\??):\s*<\/strong>/gi, "<strong>Para quem?:</strong>")
    .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Documentação necessária:</strong>")
    .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanenza):\s*<\/strong>/gi, "<strong>Permanência:</strong>")
    .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Diferencial:</strong>")
    .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Lingue di assistenza):\s*<\/em>/gi, "<em>Idiomas de atendimento:</em>")
    .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Esperienza e supporto):\s*<\/em>/gi, "<em>Experiência e suporte:</em>")
    .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Diferencial vs. alternativas:</em>")
    .replace(/<strong>\s*(?:Exclusiones|Exclusions|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusões:</strong>");
}

function normalizeToItalianDescriptionHeaders(text: string): string {
  if (!text) return "";
  return text
    .replace(/<strong>\s*(?:Vigencia|Validity|Validade):\s*<\/strong>/gi, "<strong>Validità:</strong>")
    .replace(/<strong>\s*(?:Precio|Price|Preço):\s*<\/strong>/gi, "<strong>Prezzo:</strong>")
    .replace(/<strong>\s*(?:Propuesta de valor|Value proposition|Proposta de valor):\s*<\/strong>/gi, "<strong>Proposta di valore:</strong>")
    .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Para quem\??):\s*<\/strong>/gi, "<strong>Per chi?:</strong>")
    .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária):\s*<\/strong>/gi, "<strong>Documentazione richiesta:</strong>")
    .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanência):\s*<\/strong>/gi, "<strong>Permanenza:</strong>")
    .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Differenziale:</strong>")
    .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Idiomas de atendimento):\s*<\/em>/gi, "<em>Lingue di assistenza:</em>")
    .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Esperienza e supporto):\s*<\/em>/gi, "<em>Esperienza e supporto:</em>")
    .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternative):\s*<\/em>/gi, "<em>Differenziale vs. alternative:</em>")
    .replace(/<strong>\s*(?:Exclusiones|Exclusions|Exclusões):\s*<\/strong>/gi, "<strong>Esclusioni:</strong>");
}

async function translateFullHtml(htmlEs: string, targetLang: "en" | "pt" | "it"): Promise<string> {
  if (!htmlEs) return "";
  const parts = htmlEs.split(/(<\/?[a-z0-9]+(?:\s+[^>]*)?>)/gi);
  const translatedParts = await Promise.all(
    parts.map(async (part) => {
      if (!part || /^<\/?[a-z0-9]+/i.test(part)) return part;
      const trimmed = part.trim();
      if (!trimmed || /^[💡⭐⚠️•>🚀🎯🏆💎📅📍📞⚖️🩺🛡️✨🌟⏱️👥🍣🎓🏠\s]+$/u.test(trimmed)) return part;
      const leadingSpace = part.match(/^\s*/)?.[0] || "";
      const trailingSpace = part.match(/\s*$/)?.[0] || "";
      const trans = await translateTextDirect(trimmed, "es", targetLang);
      return `${leadingSpace}${trans}${trailingSpace}`;
    })
  );
  const joined = translatedParts.join("");
  return targetLang === "en"
    ? normalizeToEnglishDescriptionHeaders(joined)
    : targetLang === "pt"
    ? normalizeToPortugueseDescriptionHeaders(joined)
    : normalizeToItalianDescriptionHeaders(joined);
}

function extractJsonFromText(raw: string): any {
  if (!raw) return null;
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

interface InvestigatedWebInfo {
  url: string;
  pageTitle?: string;
  description?: string;
  headings?: string[];
  listItems?: string[];
  snippet?: string;
}

function extractScrapedFacts(html: string) {
  if (!html) return { valueProp: "", who: "", diff: "", price: "", vigencia: "", doc: "", perm: "", excl: "", rawText: "" };
  
  const clean = decodeHtmlEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  
  const extractSection = (labelRegex: RegExp, nextLabelsRegex: RegExp) => {
    const match = html.match(labelRegex);
    if (!match) return "";
    const startIndex = match.index! + match[0].length;
    const remaining = html.slice(startIndex);
    const nextMatch = remaining.match(nextLabelsRegex);
    const rawContent = nextMatch ? remaining.slice(0, nextMatch.index) : remaining;
    return decodeHtmlEntities(rawContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  };

  const topLevelKeys = /<strong>\s*(?:Vigencia|Validade|Validità|Precio|Preço|Prezzo|Propuesta de valor|Proposta de valor|Proposta di valore|Value proposition|¿?Para quién\??|Para quem\??|Per chi\??|Who is it for\??|Documentación requerida|Required documents|Permanencia|Permanência|Length of stay|Diferencial|Differenziale|Differentiator|Exclusiones|Exclusões|Esclusioni|Exclusions):|<\/p>/i;

  const vigencia = extractSection(/<strong>\s*(?:Vigencia|Validade|Validità|Validity):\s*<\/strong>/i, topLevelKeys);
  const price = extractSection(/<strong>\s*(?:Precio|Preço|Prezzo|Price):\s*<\/strong>/i, topLevelKeys);
  const valueProp = extractSection(/<strong>\s*(?:Propuesta de valor|Proposta de valor|Proposta di valore|Value proposition):\s*<\/strong>/i, topLevelKeys);
  const who = extractSection(/<strong>\s*(?:¿?Para quién\??|Para quem\??|Per chi\??|Who is it for\??):\s*<\/strong>/i, topLevelKeys);
  const doc = extractSection(/<strong>\s*(?:Documentación requerida|Required documents|Documentação necessária|Documentazione richiesta):\s*<\/strong>/i, topLevelKeys);
  const perm = extractSection(/<strong>\s*(?:Permanencia|Permanência|Permanenza|Length of stay):\s*<\/strong>/i, topLevelKeys);
  const diff = extractSection(/<strong>\s*(?:Diferencial|Differenziale|Differentiator):\s*<\/strong>/i, /<strong>\s*(?:Exclusiones|Exclusões|Esclusioni|Exclusions):|<\/p>/i);
  const excl = extractSection(/<strong>\s*(?:Exclusiones|Exclusões|Esclusioni|Exclusions):\s*<\/strong>/i, /<\/p>|$/i);

  return { vigencia, price, valueProp, who, doc, perm, diff, excl, rawText: clean };
}

async function quickInvestigateUrl(rawUrl: string): Promise<InvestigatedWebInfo | null> {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  let targetUrl = rawUrl.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }
  try {
    const res = await fetchWithTimeout(
      targetUrl,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        },
      },
      7000
    );
    if (!res.ok) return null;
    let html = await res.text();
    html = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ");

    const ogTitleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i);
    const titleTagMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = ogTitleMatch ? ogTitleMatch[1] : titleTagMatch ? titleTagMatch[1] : "";

    const ogDescMatch =
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i) ||
      html.match(/<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i);
    const description = ogDescMatch ? ogDescMatch[1] : "";

    const headings: string[] = [];
    const hRegex = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let hMatch;
    while ((hMatch = hRegex.exec(html)) !== null && headings.length < 12) {
      const cleanH = decodeHtmlEntities(hMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      if (cleanH.length > 3 && cleanH.length < 140 && !headings.includes(cleanH)) {
        headings.push(cleanH);
      }
    }

    const listItems: string[] = [];
    const liRegex = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch;
    while ((liMatch = liRegex.exec(html)) !== null && listItems.length < 8) {
      const cleanLi = decodeHtmlEntities(liMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      if (cleanLi.length > 15 && cleanLi.length < 150 && !listItems.includes(cleanLi)) {
        listItems.push(cleanLi);
      }
    }

    const paragraphs: string[] = [];
    const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    let pMatch;
    while ((pMatch = pRegex.exec(html)) !== null && paragraphs.length < 10) {
      const cleanP = decodeHtmlEntities(pMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
      if (cleanP.length > 25 && cleanP.length < 350) {
        paragraphs.push(cleanP);
      }
    }

    const snippet = [...paragraphs, ...listItems].join(" ");

    return {
      url: targetUrl,
      pageTitle: cleanTitleString(pageTitle),
      description: cleanTitleString(description),
      headings,
      listItems,
      snippet: snippet.slice(0, 1600),
    };
  } catch {
    return null;
  }
}

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

function checkOmitIcons(prompt: string, conversationHistory: ConversationMessage[] | string = []): boolean {
  const isPromptOmit = (p: string) =>
    /(?:sin|no\s+(?:pongas?|coloques?|uses?|incluyas?|tenga|muestres?|dejes?)|sacale|sacar|quitar?|elimina[a-z]*|evita[a-z]*|borra[a-z]*)\s+(?:los\s+|las\s+)?(?:ic(?:i?[oó]|o)n[oa]s?|emoj?is?|emoyis?|viñetas?|vinetas?|dibujitos?|figuras?|s[ií]mbolos?)/i.test(p) ||
    /\b(?:sin\s+ic(?:i?[oó]|o)n[oa]s?|sin\s+emoj?is?|sin\s+emoyis?|no\s+ic(?:i?[oó]|o)n[oa]s?|sin\s+s[ií]mbolos?|sin\s+figuras?)\b/i.test(p);

  const isPromptWithIcons = (p: string) =>
    /(?:con|agregale?|ponele?|inclui|incluye|usar?)\s+(?:los\s+|las\s+)?(?:ic(?:i?[oó]|o)n[oa]s?|emoj?is?|emoyis?|viñetas?|vinetas?|dibujitos?|figuras?|s[ií]mbolos?)/i.test(p) ||
    /\b(?:con\s+ic(?:i?[oó]|o)n[oa]s?|con\s+emoj?is?|con\s+emoyis?)\b/i.test(p);

  // 1. Check latest prompt first
  if (isPromptOmit(prompt)) return true;
  if (isPromptWithIcons(prompt)) return false;

  // 2. Normalize history
  let userMessages: string[] = [];
  if (Array.isArray(conversationHistory)) {
    userMessages = conversationHistory
      .filter((m) => m && (typeof m === "string" || m.role === "user"))
      .map((m) => (typeof m === "string" ? m : m.content))
      .reverse();
  } else if (typeof conversationHistory === "string") {
    userMessages = [conversationHistory];
  }

  for (const msg of userMessages) {
    if (isPromptOmit(msg)) return true;
    if (isPromptWithIcons(msg)) return false;
  }

  return false;
}

function checkIsShort(prompt: string, conversationHistory: ConversationMessage[] | string = []): boolean {
  const isPromptLong = (p: string) =>
    /\b(?:larg[oa]s?|m[aá]s\s+larg[oa]s?|hazl[oa]\s+m[aá]s\s+larg[oa]s?|hacel[oa]\s+m[aá]s\s+larg[oa]s?|extens[oa]s?|ampli[oa]s?|complet[oa]s?|desarroll(?:ar|a|ado|ada)?|m[aá]s\s+texto|m[aá]s\s+contenido|m[aá]s\s+detalle|con\s+m[aá]s\s+detalle|expand(?:ir|e|ido)?|detallad[oa]s?)\b/i.test(p);

  const isPromptShort = (p: string) =>
    /\b(?:cort[oa]s?|breve|breves|direct[oa]s?|resum(?:en|id[oa]|ilo|ila)?|s[ií]ntesis|concis[oa]s?|pocas?\s+palabras|en\s+un\s+p[aá]rrafo|en\s+dos\s+p[aá]rrafos|poco\s+texto|sint[eé]tic[oa]s?|puntual(?:es)?|lo\s+m[aá]s\s+puntual|solo\s+qui[eé]nes?\s+son|solo\s+hable\s+de\s+qui[eé]nes?\s+son|qui[eé]nes?\s+somos|al\s+grano|sin\s+relleno)\b/i.test(p);

  // 1. Check latest prompt first
  if (isPromptShort(prompt)) return true;
  if (isPromptLong(prompt)) return false;

  // 2. Check conversation history in reverse order (newest to oldest)
  let userMessages: string[] = [];
  if (Array.isArray(conversationHistory)) {
    userMessages = conversationHistory
      .filter((m) => m && (typeof m === "string" || m.role === "user"))
      .map((m) => (typeof m === "string" ? m : m.content))
      .reverse();
  } else if (typeof conversationHistory === "string") {
    userMessages = [conversationHistory];
  }

  for (const msg of userMessages) {
    if (isPromptShort(msg)) return true;
    if (isPromptLong(msg)) return false;
  }

  return false;
}

function buildSystemRefinePrompt(
  fieldType: FieldType,
  currentText: string,
  prompt: string,
  meta: { title?: string; publisherName?: string; category?: string; city?: string; country?: string; url?: string },
  conversationHistory: ConversationMessage[] = [],
  investigatedWeb?: InvestigatedWebInfo | null,
  variationIndex: number = 0
): string {
  const now = new Date();
  const formattedCurrentDate = now.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const historyStr = conversationHistory.length > 0
    ? conversationHistory.map(m => `${m.role === "user" ? "Administrador" : "Asistente"}: "${m.content}"`).join("\n")
    : "Sin historial previo";

  const investigatedSection = investigatedWeb
    ? `
🌐 INFORMACIÓN INVESTIGADA EN TIEMPO REAL DEL SITIO WEB:
- URL Oficial: ${investigatedWeb.url}
- Título oficial de la página: ${investigatedWeb.pageTitle || "N/A"}
- Descripción oficial de la página: ${investigatedWeb.description || "N/A"}
- Secciones, servicios y títulos destacados: ${investigatedWeb.headings?.join(" | ") || "N/A"}
- Aspectos clave detectados: ${investigatedWeb.listItems?.join(" | ") || "N/A"}
- Contenido / Síntesis real extraída del sitio: ${investigatedWeb.snippet || "N/A"}
`
    : "";

  const variationDirectives = [
    "ÁNGULO COMERCIAL Y DIRECTO: Enfócate en la solución inmediata, propuesta de valor concreta y llamado a la acción persuasivo.",
    "ÁNGULO INSTITUCIONAL Y PRESTIGIO: Destaca solidez, trayectoria, acreditaciones y rigurosidad profesional.",
    "ÁNGULO BENEFICIOS Y DIFERENCIALES: Enfócate en las ventajas clave, métodos de atención modernos y conveniencia para el usuario.",
    "ÁNGULO CERCANO Y CONSULTIVO: Tono empático, resolutivo y consultivo enfocado en acompañamiento integral.",
    "ÁNGULO ESTRATÉGICO Y RESULTADOS: Síntesis ejecutiva de alto impacto, celeridad y efectividad comprobable.",
    "ÁNGULO DE SERVICIOS Y ESPECIALIDADES: Desglose claro de prestaciones, cobertura y capacidades operativas.",
    "ÁNGULO INNOVADOR Y VANGUARDISTA: Métodos modernos, atención digital ágil y soluciones simplificadas.",
    "ÁNGULO DE CONFIABILIDAD Y TRANSPARENCIA: Enfoque en seguridad jurídica, honestidad en presupuestos y respaldo integral.",
  ];
  const currentDirective = variationDirectives[Math.abs(variationIndex) % variationDirectives.length];

  return `
Eres el Asistente de Inteligencia Artificial y Lead Copywriter Creativo Supremo de Travelgrin (actúas con total libertad, inteligencia y flexibilidad).

======================================================================
📅 CONTEXTO TEMPORAL OBLIGATORIO:
FECHA ACTUAL DE REFERENCIA: ${formattedCurrentDate}
REGLA DE VIGENCIA Y PLAZOS:
Toda fecha, plazo, convocatoria, arancel o vigencia debe ser validada respecto a la FECHA ACTUAL (${formattedCurrentDate}). Cualquier trámite o plazo anterior a ${formattedCurrentDate} (por ejemplo fechas de 2024, 2025 o meses pasados) está VENCIDO y NO debe presentarse como vigente.

🚫 REGLAS DE ORO PROMPTS V2 (ANTI-ALUCINACIÓN Y CERO PLANTILLAS):
- CERO ALUCINACIONES: PROHIBIDO inventar o citar leyes, decretos, números de artículos, normativas, años de antigüedad, precios o trámites que no correspondan con la información verificada de la entidad.
- CERO PLANTILLAS / CERO TEXTOS ENLATADOS: PROHIBIDO usar textos prefabricados o plantillas fijas. Debes generar el contenido de forma 100% dinámica y orgánica en función exclusiva de la instrucción del administrador y los datos reales de la entidad.
- REDACCIÓN EN TERCERA PERSONA: Redactar siempre en tono institucional y profesional en TERCERA PERSONA.
======================================================================

🔄 DIRECTIVA OBLIGATORIA DE VARIACIÓN Y ROTACIÓN (VERSIÓN #${variationIndex + 1}):
- ¡ES IMPERATIVO QUE ESTA RESPUESTA SEA COMPLETAMENTE DIFERENTE A CUALQUIER PROPUESTA PREVIA!
- Si el texto actual ya tiene un enfoque, redacción o estructura, CAMBIA TOTALMENTE el ángulo, el gancho inicial, el vocabulario, las preguntas y la disposición de ideas.
- En esta iteración debes adoptar preferentemente el enfoque: "${currentDirective}".
- En títulos: prueba un formato totalmente distinto (ej: frase de impacto con beneficio directo, pregunta potente, o gancho comercial enfocado en soluciones).
- En descripciones y bloques: cambia los títulos de las secciones, el orden de los argumentos, los conectores y las preguntas planteadas.

🎯 TU MISIÓN FUNDAMENTAL:
Comprender a la perfección la idea, tono, cantidad de items y visión que el administrador pide en su instrucción, sin importar qué tan concisa, extensa, con errores ortográficos (ej. 'pregunats', 'iciono', 'descipcion', 'haslo', 'kiero', 'preecios') o informal ('broh', 'ponele', 'hacelo', 'sacale', 'dejame') sea su solicitud. Debes alinearte 100% a lo que él busque transmitir.

💡 LIBERTAD TOTAL, GENERACIÓN DINÁMICA Y CERO LIMITACIONES:
- NO estás atado a moldes ni plantillas fijas. Tienes total autonomía para redactar con el estilo que mejor cumpla la visión del administrador.
- Si el administrador te pide algo "bien trabajado, llamativo, de impacto o centrado en lo esencial", genera contenido potente, atractivo, profesional y sin textos de relleno.
- Tienes libertad para usar emojis elegantes o no usarlos según el estilo solicitado (o si expresamente te pide sin emojis).

EJEMPLOS DE ORIENTACIÓN PARA TÍTULOS (ESTILOS PURAMENTE ILUSTRATIVOS - NO COPIAR LITERALMENTE):
• Impacto / Acción Comercial: "¡Estudiá Carreras Universitarias con Alta Salida Laboral en [Nombre]!"
• Descriptivo y Beneficios: "[Nombre] - Carreras Oficiales, Modalidad Online y Becas"
• Invitacional / Cercano: "¡Inscribite Hoy en [Nombre] y Liderá tu Futuro Profesional!"
• Especialidades Médicas: "[Nombre de Clínica] | Atención Médica de Alta Complejidad y Guardia 24hs"
• Servicios y Asesoramiento: "[Nombre de Estudio] | Asesoramiento Jurídico y Notarial Integral"
• Limpio / Institucional: "[Nombre de la Entidad]"

REGLAS CLAVE PARA TÍTULOS:
- Adapta el título 100% a la intención de la instrucción del admin (si pide algo llamativo, o una pregunta, o un beneficio concreto, o eliminar palabras repetitivas).
- NUNCA fuerces palabras clichés como "de vanguardia" ni la misma estructura con barras "|" a menos que el usuario lo pida. ¡Sé fresco, variado y creativo!

EJEMPLOS DE ORIENTACIÓN PARA DESCRIPCIONES:
• Impacto y Esencial: Párrafos directos con gancho institucional, propuesta formativa/servicios clave, diferenciales y canales oficiales.
• Servicios Detallados: Desglose completo de prestaciones, especialidades, tecnologías y métodos de atención.
• Historia y Trayectoria: Reseña histórica de fundación, madurez institucional, hitos y solidez.
• Resumen Ejecutivo: Síntesis concisa de operaciones, capacidades y estándares de calidad.

⚠️ REGLAS Y RESTRICCIONES SOLICITADAS POR EL USUARIO:
1. ENFOQUE PUNTUAL Y QUIÉNES SON:
   - Si el administrador pide "solo hable de quienes son", "lo más puntual", "quiénes somos", "qué es el lugar" o similar:
     Enfócate EXCLUSIVAMENTE en presentar de forma clara, directa y profesional qué es la institución/empresa, qué trayectoria y especialidades tiene y cuál es su rol.
     OMITE precios, vigencias y frases publicitarias huecas.

2. CONTROL DE ICONOS Y EMOJIS:
   - Si el administrador pide "sin icono", "sin iconos", "sin emojis", "sin iciono", "sacale los iconos", "no uses iconos", o similar:
     ¡PROHIBIDO TOTALMENTE INCLUIR CUALQUIER EMOJI O ICONO (como 🚀, 🎓, ✨, ⭐, 💡, 💎, 🏆, etc.)! Usa títulos en negrita limpios y viñetas estándar (• o -).
   - Si el administrador pide "con iconos", "con emojis", o una propuesta comercial llamativa:
     Usa emojis modernos y bien elegidos.

3. PRECIOS Y VIGENCIAS:
   - Si el administrador pide "sin precio", "sacale los precios", "no precios", "sin costo" o "sin vigencia":
     Elimina de inmediato esas líneas y concéntrate en el contenido sustancial.

4. CONTROL DE LONGITUD (CORTO / LARGO):
   - Si el administrador pide "corta", "corto", "breve", "conciso", "resumido", "puntual", "en pocas palabras":
     ¡GENERA UN TEXTO ULTRA-BREVE Y DIRECTO! Máximo 1 a 2 párrafos cortos o 1 párrafo de presentación + 2 viñetas concisas.
   - Si el administrador pide "hacelo más largo", "más extenso", "con más detalle", "explicando servicio por servicio", "más completo":
     Desarrolla una propuesta amplia, completa, estructurada y persuasiva.

5. REGLA DE VARIEDAD Y FRESCURA:
   - NO uses plantillas rígidas ni repitas siempre la misma frase introductoria.
   - NUNCA uses etiquetas burocráticas como "¿Para quién?:", "Documentación requerida:", "Permanencia:" salvo que el usuario expresamente lo solicite.

6. BLOQUES EXTRA Y FAQ CON CANTIDADES SOLICITADAS:
   - Si se trata de un bloque (extra_block o new_extra_block) y el usuario pide una cantidad específica (ej. "haz que sean 10 preguntas", "agregá 5 items", "máximo 10 preguntas con sus respuestas"):
     GENERA EXACTAMENTE la cantidad de items o preguntas solicitadas completas (ej. 10 preguntas y respuestas completas en HTML con <p><strong>¿...?</strong><br/>...</p>).
     MANTÉN el título correspondiente (ej. "Preguntas Frecuentes (FAQ)", "Metodología y Proceso de Trabajo", etc.) y NUNCA uses el nombre de la institución como título del bloque.

7. AJUSTES Y SEGUIMIENTO:
   - Si el historial indica un ajuste o refinamiento a la propuesta previa:
     ¡Prioriza 100% la indicación más reciente del usuario y aplícala sobre el contenido para acercarte a su idea exacta!

📋 CONTEXTO DE LA PUBLICACIÓN:
- Categoría / Rubro: ${meta.category || "No especificada"}
- Título actual: ${meta.title || "No especificado"}
- Entidad / Marca: ${meta.publisherName || "No especificada"}
- Ubicación: ${meta.city || ""}${meta.country ? `, ${meta.country}` : ""}
- Web: ${meta.url || ""}
${investigatedSection}

💬 HISTORIAL DE LA CONVERSACIÓN:
${historyStr}

TIPO DE CAMPO: "${fieldType}"
TEXTO BASE ACTUAL:
"""
${currentText || "(campo actualmente vacío o nuevo)"}
"""

INSTRUCCIÓN DEL ADMINISTRADOR:
"""
${prompt}
"""

FORMATO DE SALIDA (SOLAMENTE OBJETO JSON VÁLIDO):
- Si fieldType === "title": {"title": "Título optimizado respetando todas las restricciones"}
- Si fieldType === "description": {"description": "HTML con párrafos <p> y viñetas respetando todas las restricciones"}
- Si fieldType === "provider_info": {"providerInfo": "Texto de síntesis institucional"}
- Si fieldType === "extra_block" O "new_extra_block": {"title": "Título del bloque", "body": "Cuerpo con formato"}

RESPONDE ÚNICAMENTE EL OBJETO JSON VÁLIDO.
`;
}

function extractForbiddenTerms(userPrompts: string, cleanName?: string, publisherName?: string): string[] {
  const forbidden = new Set<string>();
  const lower = userPrompts.toLowerCase();

  // If general 'sin nombre' / 'no pongas la marca' / 'omiti nombre' is detected
  if (
    /(?:sin|no\s+(?:pongas?|coloques?|menciones?|uses?|incluyas?|digas?)|omit[a-z]*|sacale|sacar|quitar?)\s+(?:el\s+|la\s+)?(?:nombre|marca|entidad|instituci[oó]n|empresa|local)/i.test(
      lower
    )
  ) {
    if (cleanName) forbidden.add(cleanName.toLowerCase());
    if (publisherName) forbidden.add(publisherName.toLowerCase());
    if (cleanName) cleanName.split(/\s+/).forEach((w) => { if (w.length > 3) forbidden.add(w.toLowerCase()); });
  }

  // Extract explicit phrases after negative verbs (e.g. 'no coloques ni menciones siglo 21')
  const negMatches = lower.matchAll(
    /(?:no\s+(?:hace falta|coloques?|menciones?|pongas?|uses?|incluyas?|digas?|nombres?|aparezca|tenga|poner|mencionar|colocar)|sin\s+|omit[a-z]*|sacale|sacar|quitar?|elimina[a-z]*|evita[a-z]*)(?:\s+ni\s+(?:coloques?|menciones?|pongas?|uses?|incluyas?|digas?|nombres?|poner|mencionar|colocar))?\s+([^.,;!?:()]+)/gi
  );
  for (const m of negMatches) {
    let target = m[1].trim();
    target = target.replace(/\b(?:debe|tiene que|quiero|hacelo|hacerlo|que sea|para que|con buen|y con|pero|ademas|además)\b[\s\S]*/i, "").trim();
    target = target.replace(/^(?:el|la|los|las|un|una|unos|unas|al|a)\s+/i, "").trim();
    if (target.length >= 2 && !/^(?:nombre|marca|nada|eso|esto|titulo|título|descripcion|descripción|iconos?|emojis?)$/i.test(target)) {
      forbidden.add(target);
      target.split(/\s+/).forEach((w) => { if (w.length > 2) forbidden.add(w); });
    }
  }

  if (cleanName && lower.includes(cleanName.toLowerCase())) {
    if (/(?:no\s+(?:coloques?|menciones?|pongas?|uses?|incluyas?|digas?)|sin|omit|sacale|sacar|quita)/i.test(lower)) {
      forbidden.add(cleanName.toLowerCase());
      cleanName.split(/\s+/).forEach((w) => { if (w.length > 2) forbidden.add(w); });
    }
  }

  return Array.from(forbidden);
}

function sanitizeForbiddenTerms(text: string, forbiddenTerms: string[]): string {
  if (!text || !forbiddenTerms || forbiddenTerms.length === 0) return text;
  let result = text;
  for (const term of forbiddenTerms) {
    if (!term || term.trim().length < 2) continue;
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:Universidad\\s+|Instituto\\s+|Estudio\\s+|Club\\s+|Cl[ií]nica\\s+)?${escaped}`, "gi");
    result = result.replace(regex, "");
  }
  return result
    .replace(/\s+(?:en|estudiá en|estudia en|con|de|del|para|por|a|al|hacia|desde)\s*(?=[-–—|:;,]|$)/gi, "")
    .replace(/\s*[-–—|:]\s*[-–—|:]+/g, " | ")
    .replace(/\s*[-–—|:,]\s*$/g, "")
    .replace(/^\s*[-–—|:,]\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeAiResponse(parsed: any, fieldType: FieldType): any {
  if (!parsed || typeof parsed !== "object") return parsed;
  const result: any = { ...parsed };

  // Normalize title
  if (!result.title && (result.titulo || result.name || result.nombre)) {
    result.title = result.titulo || result.name || result.nombre;
  }

  // Normalize description
  if (!result.description && (result.descripcion || result.html || result.text || result.texto || result.contenido)) {
    result.description = result.descripcion || result.html || result.text || result.texto || result.contenido;
  }

  // Normalize body (for extra_block / new_extra_block)
  if (!result.body && (result.cuerpo || result.contenido || result.content || result.description || result.descripcion || result.texto)) {
    result.body = result.cuerpo || result.contenido || result.content || result.description || result.descripcion || result.texto;
  }

  // Normalize providerInfo
  if (!result.providerInfo && (result.provider_info || result.info || result.informacion || result.descripcion_oferente || result.descripcion)) {
    result.providerInfo = result.provider_info || result.info || result.informacion || result.descripcion_oferente || result.descripcion;
  }

  return result;
}

async function callGeminiApi(
  geminiKey: string,
  systemPrompt: string,
  userMessage: string,
  fieldType: FieldType,
  variationIndex: number = 0
): Promise<any | null> {
  const models = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
  ];

  const enrichedUserMessage = variationIndex > 0
    ? `${userMessage}\n\n[INSTRUCCIÓN ESTRICTA DE ROTACIÓN: Variación #${variationIndex + 1}. Prohibido devolver la misma plantilla, texto o estructura que la versión anterior. Genera un contenido completamente fresco, variado y con otro vocabulario y orden.]`
    : userMessage;

  for (const model of models) {
    try {
      const resp = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: enrichedUserMessage }],
              },
            ],
            generationConfig: {
              temperature: 0.85,
              responseMimeType: "application/json",
            },
          }),
        },
        15000
      );

      if (resp.ok) {
        const data = await resp.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = extractJsonFromText(rawText);
        if (parsed && typeof parsed === "object") {
          return normalizeAiResponse(parsed, fieldType);
        }
      }
    } catch {}

    try {
      const resp = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: `${systemPrompt}\n\n${enrichedUserMessage}` }],
              },
            ],
            generationConfig: {
              temperature: 0.85,
            },
          }),
        },
        15000
      );

      if (resp.ok) {
        const data = await resp.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = extractJsonFromText(rawText);
        if (parsed && typeof parsed === "object") {
          return normalizeAiResponse(parsed, fieldType);
        } else if (rawText && fieldType === "title") {
          const cleaned = cleanTitleString(rawText.replace(/[\{\}"]/g, "").replace(/title\s*:\s*/i, ""));
          if (cleaned) return { title: cleaned };
        }
      }
    } catch {}
  }

  return null;
}

async function callOpenAiApi(
  openaiKey: string,
  systemPrompt: string,
  userMessage: string,
  fieldType: FieldType = "description",
  variationIndex: number = 0
): Promise<any | null> {
  const models = ["gpt-4o-mini", "gpt-4o"];
  const enrichedUserMessage = variationIndex > 0
    ? `${userMessage}\n\n[INSTRUCCIÓN ESTRICTA DE ROTACIÓN: Variación #${variationIndex + 1}. Genera una propuesta diferente a las versiones previas.]`
    : userMessage;

  for (const model of models) {
    try {
      const resp = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: enrichedUserMessage },
            ],
            response_format: { type: "json_object" },
            temperature: 0.85,
          }),
        },
        15000
      );
      if (resp.ok) {
        const data = await resp.json();
        const rawContent = data.choices?.[0]?.message?.content || "";
        const parsed = extractJsonFromText(rawContent);
        if (parsed && typeof parsed === "object") {
          return normalizeAiResponse(parsed, fieldType);
        }
      }
    } catch {}
  }
  return null;
}

// Intelligent Semantic NLP Generator with 8 Dynamic Rotating Layouts
function generateSemanticAiFallback(
  fieldType: FieldType,
  currentText: string,
  prompt: string,
  meta: { title?: string; publisherName?: string; category?: string; city?: string; country?: string; url?: string },
  conversationHistory: ConversationMessage[] = [],
  variationIndex: number = 0,
  investigatedWeb?: InvestigatedWebInfo | null
): any {
  const userPrompts = [
    ...conversationHistory.filter((m) => m.role === "user").map((m) => m.content),
    prompt,
  ].join(" ").toLowerCase();

  const pLower = prompt.toLowerCase().trim();
  const cleanName = cleanBaseEntityName(currentText || meta.title || investigatedWeb?.pageTitle || "", meta.publisherName || investigatedWeb?.pageTitle);
  const cityStr = meta.city || "";
  const catLower = (meta.category || "").toLowerCase();
  const titleLower = (meta.title || investigatedWeb?.pageTitle || "").toLowerCase();
  const pubLower = (meta.publisherName || investigatedWeb?.pageTitle || "").toLowerCase();
  const entityCorpus = `${pubLower} ${titleLower} ${catLower} ${meta.url || ""} ${currentText || ""} ${investigatedWeb?.description || ""} ${investigatedWeb?.headings?.join(" ") || ""}`.toLowerCase();

  const isEduEntity = /\b(universidad|facultad|instituto|colegio|educaci[oó]n|acad[eé]m|posgrado|grado|m[aá]ster|licenciatura|terciario|carrera|estudio universitario)\b/i.test(entityCorpus);
  const isHealthEntity = /\b(salud|m[eé]dic|cl[ií]nic|hospital|guardia|odont|psic|obra social|prepaga|sanatorio|farmac|terapia)\b/i.test(entityCorpus);
  const isSportsEntity = /\b(deport|club|gym|gimnasio|futbol|fútbol|rugby|tenis|p[aá]del|nataci|entrenam|fitness|b[aá]squet|atlet)\b/i.test(entityCorpus);
  const isFoodEntity = /\b(gastronom|restauran|bar\b|caf[eé]|comida|parrilla|bistr[oó]|cena|almuerzo|degustac|sushi|buffet)\b/i.test(entityCorpus);
  const isRealEstateEntity = /\b(inmobiliar|propiedad|bienes ra[ií]ces|alquiler|tasaci|lote|terreno|departamento|casa en venta)\b/i.test(entityCorpus);
  const isTourismEntity = /\b(turism|viaje|hotel|alojam|excursi|vuelo|hostel|tour|hospedaje|posada|cabaña|resort)\b/i.test(entityCorpus);
  const isJudicialEntity = /\b(judicial|abogad|estudio jur[ií]dic|leyes|derecho|notar|escriban|litigio|defensa penal)\b/i.test(entityCorpus) && !isEduEntity;

  const promptHasTorneo = /\b(torneo|campeonato|copa|fixture|f[uú]tbol|p[aá]del)\b/i.test(userPrompts);
  const promptHasGastro = /\b(buffet|sushi|tenedor libre|restaurante|degustaci[oó]n|cena show)\b/i.test(userPrompts);
  const promptHasCourse = /\b(curso\b|masterclass|taller\b|workshop|capacitaci[oó]n)\b/i.test(userPrompts);
  const promptHasLegal = /\b(abogad[oa]s?|estudio jur[ií]dico|divorcio|sucesi[oó]n|notar[ií]a|escriban[ií]a|defensa penal)\b/i.test(userPrompts);
  const promptHasHealth = /\b(guardia m[eé]dica|consultorio m[eé]dico|odontol|cl[ií]nica|hospital)\b/i.test(userPrompts);
  const promptHasEdu = /\b(universidad|facultad|carreras? de grado|posgrado|instituto superior|colegio)\b/i.test(userPrompts);

  let sector: "education" | "health" | "sports" | "food" | "realestate" | "tourism" | "judicial" | "general" = "general";
  if (promptHasEdu || isEduEntity) sector = "education";
  else if (promptHasHealth || isHealthEntity) sector = "health";
  else if (promptHasTorneo || isSportsEntity) sector = "sports";
  else if (promptHasGastro || isFoodEntity) sector = "food";
  else if (promptHasLegal || isJudicialEntity) sector = "judicial";
  else if (isRealEstateEntity) sector = "realestate";
  else if (isTourismEntity) sector = "tourism";

  const isEducation = sector === "education";
  const isHealth = sector === "health";
  const isSports = sector === "sports";
  const isFood = sector === "food";
  const isJudicial = sector === "judicial";
  const isRealEstate = sector === "realestate";
  const isTourism = sector === "tourism";

  const hasNegativeConstraint =
    /(?:no\s+(?:hace falta|coloques?|menciones?|pongas?|uses?|incluyas?|digas?|nombres?|aparezca|tenga|poner|mencionar|colocar)|sin\s+|omit[a-z]*|sacale|sacar|quitar?|elimina[a-z]*|evita[a-z]*)/i.test(
      userPrompts
    );

  const omitIcons = checkOmitIcons(prompt, conversationHistory);
  const isShort = checkIsShort(prompt, conversationHistory);

  if (fieldType === "title") {
    if (isShort || /corto|breve|directo|solo nombre|s[ií]ntesis|concis/i.test(pLower)) {
      if (hasNegativeConstraint) {
        if (isEducation) {
          const v = [
            "Carreras de Grado y Posgrados Oficiales",
            "Educación Superior de Excelencia y Salida Laboral",
            "Formación Universitaria Oficial y Modalidad Flexible",
            "Títulos Oficiales y Carreras Universitarias",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isHealth) {
          const v = [
            "Atención Médica y Especialidades 24hs",
            "Cobertura de Salud Integral y Turnos Online",
            "Centro Médico de Excelencia y Guardia Activa",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isSports) {
          const v = [
            "Actividades Deportivas y Pases Oficiales",
            "Centro de Entrenamiento y Deporte Integral",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isJudicial) {
          const v = [
            "Asesoramiento Jurídico y Consultoría Legal",
            "Servicios Jurídicos y Notariales Integrales",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isFood) {
          const v = [
            "Gastronomía de Autor y Reservas",
            "Menú Gourmet y Platos Exclusivos",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isTourism) {
          const v = [
            "Alojamientos y Excursiones Exclusivas",
            "Turismo y Hospedaje Oficial",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isRealEstate) {
          const v = [
            "Venta, Alquiler y Tasación de Propiedades",
            "Gestión Inmobiliaria Integral",
          ];
          return { title: v[variationIndex % v.length] };
        }
        return { title: "Servicios Profesionales de Excelencia" };
      }
      return { title: cleanName };
    }

    // 0. Marketing, Conversión, Especialista o Enfoque Comercial
    if (/marketing|conversi[oó]n|especialista|vendedor|llamativ|gancho|cta|captar|potente|atractiv/i.test(pLower)) {
      if (isJudicial || /abogad|migrat|jur[ií]dic|legal|ciudadan|extranjer|residencia/i.test(`${cleanName} ${prompt} ${meta.title || ''} ${entityCorpus}`)) {
        const v = [
          `${cleanName} | Especialista Líder en Derecho Migratorio, Ciudadanías y Radicaciones`,
          `¡Tu Residencia y Ciudadanía con Éxito Asegurado! | ${cleanName} - Asesoría Legal`,
          `${cleanName}: Soluciones Migratorias Rápidas, Ciudadanía Italiana y Residencia Argentina`,
          `Especialista en Trámites Migratorios y Extranjería | ${cleanName} - Asesoramiento Integral`,
          `${cleanName} | Consultoría Legal Estratégica: Gestión Segura de Visas y Nacionalidades`,
          `¿Buscás Regularizar tu Situación Migratoria? ${cleanName} te Asesora con Respaldo Total`,
          `Estudio Jurídico Especializado en Migraciones | ${cleanName} - Atención Remota y Presencial`,
          `${cleanName} | Seguridad Jurídica y Celeridad en Trámites Consulares y Notariales`,
        ];
        return { title: v[Math.abs(variationIndex) % v.length] };
      }
      if (isEducation) {
        const v = [
          `${cleanName} | Formación Universitaria Líder con Alta Salida Laboral e Inscripciones Abiertas`,
          `¡Impulsá tu Futuro Profesional! ${cleanName} | Carreras Oficiales y Becas Disponibles`,
          `${cleanName}: Carreras de Vanguardia y Modalidad Flexible Diseñadas para tu Éxito`,
          `Especialistas en Educación Superior | ${cleanName} - Campus Virtual 24/7`,
          `${cleanName} | Títulos Oficiales con Validez Nacional y Rápida Inserción Laboral`,
          `¿Querés una Carrera Universitaria de Primer Nivel? Estudiá en ${cleanName}`,
          `${cleanName} | Excelencia Académica y Programas Diseñados para Trabajar`,
          `Liderá el Mercado Laboral con ${cleanName} | Inscripciones Abiertas`,
        ];
        return { title: v[Math.abs(variationIndex) % v.length] };
      }
      if (isHealth) {
        const v = [
          `${cleanName} | Especialistas Médicos de Primer Nivel: Guardia 24hs y Turnos Inmediatos`,
          `¡Cuidá tu Salud con los Mejores Profesionales! ${cleanName} | Cobertura Médica Integral`,
          `${cleanName}: Centro de Salud Líder con Tecnología Avanzada y Atención Humanizada`,
          `Especialistas en Medicina y Diagnóstico | ${cleanName} - Turnos Online Sin Demoras`,
          `${cleanName} | Excelencia Médica, Guardia Activa y Consultorios Multidisciplinarios`,
          `¿Buscás Atención Médica de Alta Complejidad? ${cleanName} te Ofrece Seguridad Total`,
          `${cleanName} | Sanatorio y Especialidades con Cobertura para Toda la Familia`,
          `Atención Médica Inmediata y Especialistas Referentes | ${cleanName}`,
        ];
        return { title: v[Math.abs(variationIndex) % v.length] };
      }
      const vGen = [
        `${cleanName} | Especialistas en Soluciones Profesionales de Alto Impacto y Conversión`,
        `¡Resultados Concretos y Calidad Verificada! ${cleanName} | Asesoramiento Inmediato`,
        `${cleanName}: Calidad, Trayectoria y Soluciones Estratégicas a Medida`,
        `Servicios Profesionales de Referencia | ${cleanName} - Atención Personalizada`,
        `${cleanName} | Máxima Eficiencia y Respaldo Garantizado para tus Proyectos`,
        `¿Buscás Asesoramiento de Primer Nivel? Elegí ${cleanName} con Confianza`,
        `${cleanName} | Experiencia Comprobada y Soluciones Integrales para vos`,
        `Líderes en el Rubro | ${cleanName} - Atención Ágil y Resultados Concretos`,
      ];
      return { title: vGen[Math.abs(variationIndex) % vGen.length] };
    }

    if (/impact|atenci[oó]n|trabajad|llamativ|potente|fuerte|nivel|profesional|excelen|destac|mejor|buen seo|posicionam/i.test(pLower)) {
      if (hasNegativeConstraint) {
        if (isEducation) {
          const v = [
            "Educación Superior de Excelencia: Formación Universitaria con Alta Salida Laboral",
            "¡Vení a la Mejor Universidad! Carreras de Grado, Posgrados y Títulos Oficiales",
            "¡Liderá tu Futuro Profesional! Carreras Universitarias y Modalidad Flexible",
            "Excelencia Académica y Títulos Oficiales: Inscripciones Abiertas y Salida Laboral",
            "Carreras Universitarias Oficiales: Formación de Alto Nivel y Becas",
            "Tu Futuro Profesional Comienza Hoy: Carreras Oficiales de Primer Nivel",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isJudicial) {
          const v = [
            "Soluciones Jurídicas de Excelencia: Asesoramiento y Representación Legal de Alto Nivel",
            "¡Protegé tus Derechos! Estrategia Legal, Trayectoria y Compromiso Profesional",
            "Estudio Jurídico Integral: Asesoramiento Notarial y Procesal Especializado",
            "Asesoramiento Legal Estratégico: Soluciones Jurídicas y Notariales Efectivas",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isSports) {
          const v = [
            "¡Entrená al Máximo Nivel! Instalaciones Deportivas, Clases y Pases Oficiales",
            "Centro Deportivo de Alto Rendimiento: Actividades para Todas las Edades y Niveles",
            "¡Viví tu Pasión Deportiva! Instalaciones Modernas y Entrenamiento Profesional",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isHealth) {
          const v = [
            `¡Atención Médica de Excelencia en ${cityStr || 'tu ciudad'}! Guardia 24hs y Especialidades`,
            "Cobertura de Salud Integral: Profesionales de Trayectoria y Turnos Online Inmediatos",
            "Cuidá tu Salud con los Mejores Especialistas: Tecnología Médica y Atención Humana",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isTourism) {
          const v = [
            "¡Descubrí Experiencias Inolvidables! Alojamientos Exclusivos y Excursiones Oficiales",
            "Destinos Únicos y Estadías de Primer Nivel: Tarifas Preferenciales y Asesoramiento",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isFood) {
          const v = [
            "¡Viví una Experiencia Gastronómica Inolvidable! Cocina de Autor y Sabores Exclusivos",
            "Propuesta Gastronómica de Excelencia: Menú Gourmet, Eventos y Reservas Online",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isRealEstate) {
          const v = [
            `Oportunidades Inmobiliarias Exclusivas en ${cityStr || 'la región'}: Venta, Alquiler y Tasaciones`,
            "Inversiones y Propiedades de Primer Nivel: Asesoramiento Inmobiliario y Notarial Seguro",
          ];
          return { title: v[variationIndex % v.length] };
        }
        const vGen = [
          "Servicios Profesionales de Excelencia: Calidad, Trayectoria y Soluciones a Medida",
          "Liderazgo, Confianza y Soluciones de Primer Nivel con Respaldo Verificado",
        ];
        return { title: vGen[variationIndex % vGen.length] };
      }

      if (isEducation) {
        const v = [
          `¡Vení a la mejor universidad! Estudiá en ${cleanName} | Carreras de Grado y Posgrados`,
          `${cleanName} | Carreras Universitarias, Títulos Oficiales y Modalidades Flexibles`,
          `Liderá tu Futuro Profesional en ${cleanName} | Inscripciones Abiertas`,
        ];
        return { title: v[variationIndex % v.length] };
      }
      if (isJudicial) {
        const v = [
          `${cleanName} | Estudio Jurídico y Asesoramiento Legal Integral`,
          `${cleanName} | Abogacía Especializada, Consultoría y Representación Legal`,
          `${cleanName} | Servicios Jurídicos de Excelencia: Respaldo, Trayectoria y Confianza`,
          `${cleanName} | Asesoría Legal Estratégica y Resolución Efectiva de Casos`,
        ];
        return { title: v[Math.abs(variationIndex) % v.length] };
      }
      if (isSports) {
        const v = [
          `${cleanName} | Club Deportivo, Entrenamientos y Pases Oficiales`,
          `${cleanName} | Centro Deportivo de Alto Rendimiento e Instalaciones Modernas`,
          `¡Viví el Deporte en ${cleanName}! Actividades y Membresías Flexibles`,
        ];
        return { title: v[Math.abs(variationIndex) % v.length] };
      }
      if (isHealth) {
        const v = [
          `¡Contratá la mejor atención médica! ${cleanName} | Guardia 24hs y Turnos Online`,
          `${cleanName} | Centro Médico de Excelencia y Guardia Activa 24 Horas`,
          `${cleanName} | Consultorios de Especialidad y Diagnóstico Médico Integral`,
        ];
        return { title: v[Math.abs(variationIndex) % v.length] };
      }
      if (isTourism) {
        const v = [
          `¡Viví la mejor experiencia! ${cleanName} | Hoteles y Excursiones Oficiales`,
          `${cleanName} | Hospedaje de Primer Nivel, Confort y Reservas Exclusivas`,
        ];
        return { title: v[Math.abs(variationIndex) % v.length] };
      }
      const vGen = [
        `¡Elegí la mejor propuesta! ${cleanName}: Excelencia y Servicios de Primer Nivel`,
        `${cleanName} | Soluciones Profesionales de Alta Calidad y Respaldo Institucional`,
        `${cleanName} | Servicios Destacados, Trayectoria y Asesoramiento Personalizado`,
      ];
      return { title: vGen[Math.abs(variationIndex) % vGen.length] };
    }

    if (/veni|vení|inscribite|estudia|estudiá|entr[aá]|eleg[ií]|sumat|contrat[aá]|asociat|afiliat/i.test(pLower)) {
      if (hasNegativeConstraint) {
        if (isEducation) {
          const v = [
            "¡Inscribite Hoy! Carreras Universitarias Oficiales y Modalidades Flexibles",
            "¡Vení a la Mejor Universidad! Formación de Excelencia y Títulos Oficiales",
            "¡Elegí tu Futuro Profesional! Carreras de Grado y Posgrados Oficiales",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isHealth) {
          return { title: `¡Elegí la Mejor Opción en Salud en ${cityStr || 'tu ciudad'}! Planes y Turnos Online` };
        }
        if (isSports) {
          return { title: `¡Sumate a las Mejores Actividades Deportivas en ${cityStr || 'tu ciudad'}!` };
        }
        if (isJudicial) {
          return { title: `¡Protegé tus Derechos con Asesoramiento Legal Especializado en ${cityStr || 'tu ciudad'}!` };
        }
        return { title: `¡Elegí Soluciones Profesionales de Excelencia!` };
      }

      if (isEducation) {
        const v = [
          `¡Vení a la mejor universidad! Estudiá en ${cleanName}`,
          `¡Inscribite hoy en ${cleanName}! Carreras Oficiales y Modalidades Flexibles`,
          `¡Elegí tu futuro en ${cleanName}! Carreras de Grado y Posgrados`,
        ];
        return { title: v[variationIndex % v.length] };
      }
      if (isJudicial) {
        return { title: `¡Protegé tus Derechos con ${cleanName}! Asesoramiento Jurídico en ${cityStr || 'tu ciudad'}` };
      }
      if (isSports) {
        return { title: `¡Sumate a ${cleanName}! Tu Club Deportivo en ${cityStr || 'tu ciudad'}` };
      }
      if (isHealth) {
        return { title: `¡Elegí la mejor opción en salud! ${cleanName} en ${cityStr || 'tu ciudad'}` };
      }
      return { title: `¡Vení a conocer ${cleanName}! Experiencia y Calidad Garantizada` };
    }

    if (hasNegativeConstraint) {
      if (isEducation) {
        const v = [
          "¡Vení a la Mejor Universidad! Carreras Oficiales y Modalidades Flexibles",
          "Liderá tu Futuro: Formación Universitaria y Carreras Oficiales",
          "Carreras de Grado, Posgrados Oficiales y Becas Universitarias",
          "Educación Superior de Excelencia: Inscripciones Abiertas y Salida Laboral",
          "Tu Futuro Profesional Comienza Hoy: Títulos Oficiales y Prácticas",
        ];
        return { title: v[variationIndex % v.length] };
      }
      const vGeneral = [
        "Excelencia, Confianza y Soluciones Profesionales de Primer Nivel",
        "Servicios Profesionales y Atención Personalizada Garantizada",
        "Calidad, Trayectoria y Respaldo Institucional Verificado",
      ];
      return { title: vGeneral[variationIndex % vGeneral.length] };
    }

    const vDefault = [
      `${cleanName}: Servicios Oficiales y Atención Personalizada`,
      `${cleanName} | Calidad, Trayectoria y Soluciones Profesionales`,
      `${cleanName} - Excelencia Institucional y Canales Oficiales`,
    ];
    return { title: vDefault[variationIndex % vDefault.length] };
  }

  if (fieldType === "description") {
    const facts = extractScrapedFacts(currentText);
    const isFree = /gratis|sin costo|gratuito|libre/i.test(userPrompts);
    const isFormal = /formal|institucional|seri[oa]|protocolar/i.test(userPrompts);

    const explicitlyWantsPrice = /(?:coloc|agreg|pon|inclu|mostr|dej|con)\w*\s+(?:el\s+)?(?:precio|arancel|tarifa|costo|cuota)/i.test(prompt) || /(?:coloc|agreg|pon|inclu|mostr|dej|con)\w*\s+(?:el\s+)?(?:precio|arancel|tarifa|costo|cuota)/i.test(userPrompts);
    const explicitlyWantsVigencia = /(?:coloc|agreg|pon|inclu|mostr|dej|con)\w*\s+(?:la\s+)?(?:vigencia|validez)/i.test(prompt) || /(?:coloc|agreg|pon|inclu|mostr|dej|con)\w*\s+(?:la\s+)?(?:vigencia|validez)/i.test(userPrompts);

    const omitPrice = !isFree && /(?:quit|sin|sac|no|ocult|omit|elimina|evita)\w*\s+(?:el\s+|los\s+)?(?:precios?|aranceles?|tarifas?|costos?)/i.test(prompt) ||
      (!isFree && /(?:quit|sin|sac|no|ocult|omit|elimina|evita)\w*\s+(?:el\s+|los\s+)?(?:precios?|aranceles?|tarifas?|costos?)/i.test(userPrompts) && !explicitlyWantsPrice);

    const omitVigencia = /(?:quit|sin|sac|no|ocult|omit|elimina)\w*\s+(?:la\s+)?(?:vigencia|validez)/i.test(prompt) ||
      (/(?:quit|sin|sac|no|ocult|omit|elimina)\w*\s+(?:la\s+)?(?:vigencia|validez)/i.test(userPrompts) && !explicitlyWantsVigencia);

    const omitExclusiones = /(?:quit|sin|sac|no|ocult|omit)\w*\s+(?:exclusi|advertencia)/i.test(userPrompts);
    const omitDiferencial = /(?:quit|sin|sac|no|ocult|omit)\w*\s+(?:diferencial)/i.test(userPrompts);

    const hasScholarships = /beca|descuent|promoci|financi|bonific|cuota|arancel/i.test(userPrompts);
    const isVirtual = /virtual|online|distancia|remot|modalidad/i.test(userPrompts);
    const hasEmergency = /emergencia|guardia|24\/7|24hs|urgencia/i.test(userPrompts);
    const locStr = cityStr ? ` en ${cityStr}` : "";

    // Specific custom creations from scratch
    if (promptHasTorneo) {
      const pTourney = [
        `<p>${omitIcons ? "" : "🏆 "}<strong>Torneo & Competencia:</strong> ¡Sumate al torneo más emocionante${locStr}! Categorías abiertas y competitivas con arbitraje federado y organización profesional.</p>`,
        `<p>${omitIcons ? "" : "📅 "}<strong>Cronograma & Modalidad:</strong> Fase de grupos, eliminación directa y gran final con cobertura fotográfica y premiación en vivo.</p>`,
        `<p>${omitIcons ? "" : "💎 "}<strong>Premios & Reconocimientos:</strong> Premios en efectivo para el podio, trofeos de campeón y subcampeón, hidratación y distinciones individuales.</p>`,
        !omitPrice ? `<p><strong>Inscripción:</strong> ${isFree ? "Actividad gratuita / Libre acceso." : "A consultar según categoría y conformación del equipo."}</p>` : "",
        !omitExclusiones ? `<p>${omitIcons ? "" : "⚠️ "}<strong>Exclusiones:</strong> Cupos limitados por orden de registro. Presentación de apto físico y lista de buena fe obligatoria.</p>` : "",
      ].filter(Boolean).join("\n");
      return { description: omitIcons ? stripEmojisAndIcons(pTourney) : pTourney };
    }

    if (promptHasGastro) {
      const pGastro = [
        `<p>${omitIcons ? "" : "🍣 "}<strong>Experiencia Gastronómica:</strong> Disfrutá de una propuesta culinaria de autor${locStr}, combinando materias primas frescas y sabores únicos.</p>`,
        `<p>${omitIcons ? "" : "✨ "}<strong>Menú & Variedades:</strong> Entradas gourmet, piezas selectas de sushi, opciones artesanales y destacada carta de vinos y coctelería.</p>`,
        `<p>${omitIcons ? "" : "⭐ "}<strong>Ambiente & Diferencial:</strong> Espacio climatizado, atención esmerada y atmósfera ideal para celebraciones, parejas y encuentros de amigos.</p>`,
        !omitPrice ? `<p><strong>Precio:</strong> ${isFree ? "Acceso libre." : "A consultar según menú o servicio elegido."}</p>` : "",
        `<p>${omitIcons ? "" : "📍 "}<strong>Reservas:</strong> Se sugiere reserva previa a través de canales oficiales para garantizar la mejor ubicación.</p>`,
      ].filter(Boolean).join("\n");
      return { description: omitIcons ? stripEmojisAndIcons(pGastro) : pGastro };
    }

    if (promptHasCourse) {
      const pCourse = [
        `<p>${omitIcons ? "" : "🎓 "}<strong>Capacitación Profesional:</strong> Formación intensiva diseñada para adquirir herramientas prácticas de alta demanda${locStr}.</p>`,
        `<p>${omitIcons ? "" : "💡 "}<strong>Contenidos & Metodología:</strong> Clases dinámicas, proyectos reales, material descargable y tutoría personalizada durante todo el cursado.</p>`,
        `<p>${omitIcons ? "" : "⭐ "}<strong>Certificación:</strong> Diploma de finalización con aval institucional para enriquecer tu perfil y trayectoria profesional.</p>`,
        !omitPrice ? `<p><strong>Aranceles:</strong> ${isFree ? "Curso 100% gratuito." : hasScholarships ? "Planes de pago en cuotas y becas al mérito." : "A consultar según modalidad elegida."}</p>` : "",
        !omitExclusiones ? `<p>${omitIcons ? "" : "⚠️ "}<strong>Exclusiones:</strong> Cupos reducidos por grupo para garantizar un seguimiento personalizado.</p>` : "",
      ].filter(Boolean).join("\n");
      return { description: omitIcons ? stripEmojisAndIcons(pCourse) : pCourse };
    }

    if (promptHasLegal) {
      const pLegalSpec = [
        `<p>${omitIcons ? "" : "⚖️ "}<strong>Asesoramiento Jurídico Especializado:</strong> Soluciones legales estratégicas con sólida trayectoria, atención personalizada y estricta confidencialidad${locStr}.</p>`,
        `<p>${omitIcons ? "" : "💡 "}<strong>Áreas de Actuación:</strong> Gestión de acuerdos, trámites sucesorios, resolución de conflictos y representación procesal directa.</p>`,
        `<p>${omitIcons ? "" : "⭐ "}<strong>Compromiso & Respaldo:</strong> Diagnóstico claro desde la primera consulta, transparencia en honorarios y defensa rigurosa de tus derechos.</p>`,
        !omitPrice ? `<p><strong>Honorarios:</strong> ${isFree ? "Primera consulta informativa sin cargo." : "Regidos por ley arancelaria y convenios particulares."}</p>` : "",
        `<p>${omitIcons ? "" : "📞 "}<strong>Consultas & Turnos:</strong> Coordinación de entrevistas presenciales o virtuales a través de nuestros canales oficiales.</p>`,
      ].filter(Boolean).join("\n");
      return { description: omitIcons ? stripEmojisAndIcons(pLegalSpec) : pLegalSpec };
    }

    const isWhoWeAre = /\b(?:qui[eé]nes?\s+son|qui[eé]nes?\s+somos|qui[eé]n\s+es|de\s+qui[eé]nes?\s+son|acerca\s+de|sobre\s+la\s+instituci[oó]n|sobre\s+la\s+empresa|s[oó]lo\s+hable\s+de|s[oó]lo\s+nombre\s+de|presentaci[oó]n\s+institucional|lo\s+m[aá]s\s+puntual|puntual|sin\s+relleno|al\s+grano)\b/i.test(userPrompts);
    const isStory = /\b(?:historia|trayectoria|origen|inicios|como\s+naci[oó]|fundaci[oó]n|fundada|cu[eé]ntame\s+la\s+historia|contame\s+la\s+historia|relato|recorrido\s+hist[oó]rico)\b/i.test(userPrompts);
    const isExecutiveSummary = /\b(?:resumen\s+ejecutivo|informe\s+ejecutivo|executive\s+summary|s[ií]ntesis\s+directiva|evaluaci[oó]n\s+general|auditor[ií]a\s+general)\b/i.test(userPrompts);
    const isServicesDetailed = /\b(?:servicio\s+por\s+servicio|cada\s+servicio|todas?\s+las?\s+especialidades|explicame\s+los\s+servicios|detalle\s+de\s+servicios|prestaciones|servicios\s+que\s+tienen|qu[eé]\s+servicios|hacelo\s+m[aá]s\s+larg[oa]|hazlo\s+m[aá]s\s+larg[oa]|bien\s+larg[oa]|bien\s+desarrollad[oa]|extens[oa]|ampli[oa]|con\s+mucho\s+detalle)\b/i.test(userPrompts);

    // Dynamic price / vigencia lines
    let priceLine = "";
    if (!isWhoWeAre && !isStory && !isExecutiveSummary && (explicitlyWantsPrice || (facts.price && !omitPrice && !omitIcons && !isShort))) {
      priceLine = isFree ? "<strong>Precio:</strong> Actividad 100% gratuita / Acceso libre." : `<strong>Precio:</strong> ${facts.price || "A consultar según aranceles o tarifas vigentes."}`;
    } else if (isFree && !isWhoWeAre && !isStory && !isExecutiveSummary) {
      priceLine = "<strong>Precio:</strong> Actividad 100% gratuita / Acceso libre.";
    }

    let vigenciaLine = "";
    if (!isWhoWeAre && !isStory && !isExecutiveSummary && (explicitlyWantsVigencia || (facts.vigencia && !omitVigencia && !isShort))) {
      vigenciaLine = `<strong>Vigencia:</strong> ${facts.vigencia || "Activo; información verificada en canales oficiales."}`;
    }

    // Extract real proposition from scraping / web and clean out news / press-release boilerplate
    let rawValueProp = facts.valueProp || investigatedWeb?.description || "";
    if (!rawValueProp && currentText) {
      let cleanText = currentText
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z0-9#]+;/gi, " ")
        .replace(/^[\s\S]*?(?:Soluciones integrales de alto impacto|Una experiencia diseñada para superar tus expectativas|Propuesta de valor de excelencia|Liderá tu futuro|Liderazgo e innovación|Aspectos fundamentales)[:\s-]*/i, "")
        .replace(/^[\s\p{Emoji}\u200d\uFE0F•–—|:]+/gu, "")
        .replace(/\s+/g, " ")
        .trim();
      const cleanSentences = cleanText.split(/(?<=[.!?])\s+/);
      rawValueProp = cleanSentences.filter(s => s.length > 25 && !/(?:Vigencia|Precio|Para quién|Diferencial|Informes y Consultas|Contacto):/i.test(s))[0] || cleanText.slice(0, 180);
    }

    if (rawValueProp) {
      rawValueProp = rawValueProp
        .replace(/^[\s\S]*?(?:Soluciones integrales de alto impacto|Una experiencia diseñada para superar tus expectativas|Propuesta de valor de excelencia|Liderá tu futuro|Liderazgo e innovación|Aspectos fundamentales)[:\s-]*/i, "")
        .replace(/^[\s\p{Emoji}\u200d\uFE0F•–—|:]+/gu, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Strip news / event / press-release fragments from scraped sentences
    if (/(?:junto\s+a\s+|el\s+presidente\s+|celebr[oó]\s+|inaugur[oó]\s+|en\s+un\s+emotivo|acto\s+|comunicado|haga\s+clic|bienvenidos?\s+al?\s+sitio)/i.test(rawValueProp)) {
      rawValueProp = "";
    }

    if (!rawValueProp) {
      rawValueProp = isHealth
        ? `Institución de salud de alta complejidad${locStr}, reconocida por su trayectoria médica, servicio de emergencias 24hs, tecnología diagnóstica avanzada y atención integral de especialidades.`
        : isEducation
        ? `Institución de educación superior y formación universitaria${locStr}, destacada por su excelencia académica, carreras de grado, posgrados oficiales y alta inserción laboral.`
        : isSports
        ? `Centro de entrenamiento e institución deportiva de referencia${locStr}, equipada con instalaciones modernas y programas integrales para todas las edades.`
        : isFood
        ? `Propuesta gastronómica de autor${locStr}, reconocida por sus materias primas seleccionadas, sabores auténticos y atención esmerada.`
        : isJudicial
        ? `Estudio jurídico y consultoría profesional estratégica${locStr}, respaldada por sólida trayectoria, solvencia técnica y estricta confidencialidad.`
        : `Organización líder en su rubro${locStr}, respaldada por trayectoria verificada, calidad en sus prestaciones y atención personalizada.`;
    }
    rawValueProp = rawValueProp.replace(/\.\s*$/, "").trim();

    // 0. SPECIAL: STORY & HISTORICAL ORIGIN
    if (isStory) {
      const storyTitle = cleanName ? `<strong>Historia y Trayectoria de ${cleanName}</strong>` : "<strong>Historia y Trayectoria Institucional</strong>";
      const storyContent = [
        `<p>${omitIcons ? "" : "📜 "}${storyTitle}: Con décadas de dedicación ininterrumpida y un compromiso inquebrantable con la comunidad${locStr}, la institución ha consolidado un legado de excelencia, innovación y servicio.</p>`,
        `<p>${omitIcons ? "" : "🏛️ "}<strong>Evolución y Logros:</strong> A lo largo de su trayectoria, ha incorporado equipamiento de alta complejidad, cuerpos profesionales de primera línea y metodologías modernas orientadas a brindar la máxima calidad de atención.</p>`,
        `<p>${omitIcons ? "" : "⭐ "}<strong>Compromiso y Actualidad:</strong> Hoy continúa liderando su rubro combinando calidez humana, rigurosidad técnica y constante superación en beneficio de usuarios y profesionales.</p>`,
        `<p>${omitIcons ? "" : "📍 "}<strong>Presencia Oficial:</strong> Sede principal y canales de contacto informados y activos para atención y consultas.</p>`
      ].join("\n");
      return { description: omitIcons ? stripEmojisAndIcons(storyContent) : storyContent };
    }

    // 0.1 SPECIAL: EXECUTIVE SUMMARY
    if (isExecutiveSummary) {
      const summaryHeading = cleanName ? `<strong>Resumen Ejecutivo: ${cleanName}</strong>` : "<strong>Resumen Ejecutivo</strong>";
      const execIdx = Math.abs(variationIndex) % 6;
      let execContent = "";

      if (execIdx === 0) {
        // Variation 0: Strategic Overview & Operational Excellence
        execContent = [
          `<p>${omitIcons ? "" : "📊 "}${summaryHeading}: ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "🎯 "}<strong>Capacidades Operativas Clave:</strong> Estructura profesional interdisciplinaria, procesos certificados y capacidad de respuesta integral en ${cityStr || "la región"}.</p>`,
          `<p>${omitIcons ? "" : "🛡️ "}<strong>Estándares de Calidad y Seguridad:</strong> Riguroso apego normativo, respaldo institucional continuo y auditoría de procesos verificada.</p>`,
          `<p>${omitIcons ? "" : "📞 "}<strong>Vías de Acceso y Coordinación:</strong> Canales oficiales directos para información, turnos, aranceles y gestiones administrativas.</p>`
        ].join("\n");
      } else if (execIdx === 1) {
        // Variation 1: Strategic Advisory & Market Leadership
        execContent = [
          `<p>${omitIcons ? "" : "💼 "}<strong>Síntesis Directiva y Posicionamiento:</strong> ${cleanName ? `${cleanName} se consolida como una firma referente` : "Firma referente"} en ${rawValueProp}. Combina solvencia técnica, visión estratégica y un riguroso estándar de servicio orientado a resultados comprobables.</p>`,
          `<p>${omitIcons ? "" : "🚀 "}<strong>Diferenciales y Ventajas Competitivas:</strong> Metodología de gestión ágil, comunicación permanente y soluciones personalizadas diseñadas para reducir tiempos de tramitación y maximizar el éxito en cada gestión.</p>`,
          `<p>${omitIcons ? "" : "🌐 "}<strong>Alcance Operativo:</strong> Asesoramiento personalizado presencial y modalidad 100% remota con atención nacional e internacional.</p>`,
          `<p>${omitIcons ? "" : "🤝 "}<strong>Compromiso y Confiabilidad:</strong> Transparencia absoluta en honorarios y cumplimiento estricto de acuerdos contractuales.</p>`
        ].join("\n");
      } else if (execIdx === 2) {
        // Variation 2: Institutional Backing & Problem-Solution Model
        execContent = [
          `<p>${omitIcons ? "" : "🏛️ "}<strong>Perfil Institucional y Propuesta de Valor:</strong> Con sólida trayectoria${cityStr ? ` en ${cityStr}` : ""}, ${cleanName || "la institución"} ofrece un modelo integral de asistencia profesional: ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "🔍 "}<strong>Diagnóstico y Metodología:</strong> Análisis exhaustivo de cada requerimiento desde el primer contacto para estructurar planes de acción claros, viables y eficientes.</p>`,
          `<p>${omitIcons ? "" : "⚖️ "}<strong>Seguridad Jurídica y Respaldo:</strong> Procesos auditados, matriculación oficial y estricta confidencialidad en el tratamiento de expedientes y datos sensibles.</p>`,
          `<p>${omitIcons ? "" : "📱 "}<strong>Atención Directa:</strong> Consultas y coordinación de turnos habilitados por canales digitales oficiales.</p>`
        ].join("\n");
      } else if (execIdx === 3) {
        // Variation 3: Client Success & Comprehensive Management
        execContent = [
          `<p>${omitIcons ? "" : "⭐ "}<strong>Informe Ejecutivo de Prestaciones:</strong> ${rawValueProp}. Especialistas en brindar soluciones prácticas ante trámites y gestiones complejas.</p>`,
          `<p>${omitIcons ? "" : "👥 "}<strong>Destinatarios y Cobertura:</strong> Orientado a particulares, familias, profesionales y corporaciones que demandan celeridad, rigor técnico y atención humana personalizada.</p>`,
          `<p>${omitIcons ? "" : "📈 "}<strong>Efectividad y Acompañamiento:</strong> Seguimiento paso a paso con reportes periódicos de avance hasta la conclusión definitiva de cada trámite.</p>`,
          `<p>${omitIcons ? "" : "💬 "}<strong>Canales Habilitados:</strong> Mesa de consulta directa disponible para evaluación preliminar de casos.</p>`
        ].join("\n");
      } else if (execIdx === 4) {
        // Variation 4: Key Pillars & Governance
        execContent = [
          `<p>${omitIcons ? "" : "📑 "}<strong>Dictamen y Resumen Ejecutivo:</strong> ${cleanName ? `${cleanName} - ` : ""}${rawValueProp}. Enfoque multidisciplinario sustentado en pilares de calidad, confianza y celeridad.</p>`,
          `<p>${omitIcons ? "" : "✨ "}<strong>Fortalezas Operativas:</strong> Equipo altamente capacitado, soporte tecnológico para gestión documental digital y presencia activa en canales formales de atención.</p>`,
          `<p>${omitIcons ? "" : "🔒 "}<strong>Garantía de Satisfacción:</strong> Compromiso ético y legal en cada etapa del servicio con información transparente sobre viabilidad y plazos.</p>`,
          `<p>${omitIcons ? "" : "📍 "}<strong>Coordinación General:</strong> Asesoramiento continuo por canales de contacto centralizados.</p>`
        ].join("\n");
      } else {
        // Variation 5: High-Impact Strategic Synthesis
        execContent = [
          `<p>${omitIcons ? "" : "💎 "}<strong>Evaluación Estratégica:</strong> Soluciones profesionales de alto impacto brindadas por ${cleanName || "el oferente"}. ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "🎯 "}<strong>Enfoque a Resultados:</strong> Simplificación de procesos burocráticos y optimización de tiempos para garantizar la tranquilidad de los clientes.</p>`,
          `<p>${omitIcons ? "" : "🛡️ "}<strong>Transparencia y Solidez:</strong> Respaldo verificado, aranceles informados con antelación y acompañamiento legal integral.</p>`,
          `<p>${omitIcons ? "" : "📩 "}<strong>Contacto Oficial:</strong> Vías de atención y agenda de consultas abiertas para coordinación inmediata.</p>`
        ].join("\n");
      }

      return { description: omitIcons ? stripEmojisAndIcons(execContent) : execContent };
    }

    // 0.2 SPECIAL: DETAILED SERVICE-BY-SERVICE BREAKDOWN
    if (isServicesDetailed) {
      const servicesTitle = isHealth ? "Especialidades y Servicios Médicos Integrales"
        : isEducation ? "Oferta Académica y Programas de Formación"
        : isSports ? "Disciplinas, Actividades y Entrenamiento"
        : "Servicios y Soluciones Especializadas";

      const s1 = isHealth ? "<strong>Atención Médica y Consultorios de Especialidad:</strong> Cobertura integral en clínica, cardiología, traumatología, pediatría y especialidades quirúrgicas."
        : isEducation ? "<strong>Carreras de Grado y Posgrados Oficiales:</strong> Planes de estudio modernos con validez ministerial y alta salida laboral."
        : isSports ? "<strong>Musculación y Clases Guiadas:</strong> Equipamiento biomecánico de última generación y seguimiento con profesores de educación física."
        : "<strong>Consultoría y Soluciones Integrales:</strong> Prestaciones diseñadas a medida de cada requerimiento con estándares certificados.";

      const s2 = isHealth ? "<strong>Guardia de Emergencias e Internación 24hs:</strong> Servicio continuo para la atención de urgencias y cuidados intensivos con tecnología médica de punta."
        : isEducation ? "<strong>Campus Virtual y Cursado Híbrido:</strong> Plataforma digital 24/7 con recursos multimedia interactivos y tutoría docente permanente."
        : isSports ? "<strong>Actividades Grupales y Canchas:</strong> Amplia grilla horaria con disciplinas recreativas y competitivas para todas las edades."
        : "<strong>Metodología de Trabajo Comprobada:</strong> Procesos rigurosos, cumplimiento estricto de plazos y atención personalizada.";

      const s3 = isHealth ? "<strong>Diagnóstico por Imágenes y Laboratorio:</strong> Equipamiento de alta resolución para estudios precisos y entrega ágil de resultados."
        : isEducation ? "<strong>Pasantías y Vinculación Profesional:</strong> Convenios institucionales con empresas líderes para inserción laboral efectiva."
        : isSports ? "<strong>Instalaciones y Confort:</strong> Vestuarios climatizados, lockers de seguridad y estacionamiento vigilado."
        : "<strong>Garantía de Satisfacción y Respaldo:</strong> Soporte post-servicio continuo y transparencia total en cotizaciones.";

      const detailedContent = [
        priceLine ? `<p>${priceLine}</p>` : "",
        `<p>${omitIcons ? "" : "💡 "}<strong>Presentación:</strong> ${rawValueProp}.</p>`,
        `<p>${omitIcons ? "" : "🏥 "}<strong>${servicesTitle}:</strong><br/>• ${s1}<br/>• ${s2}<br/>• ${s3}</p>`,
        `<p>${omitIcons ? "" : "⭐ "}<strong>Diferencial Institucional:</strong> ${facts.diff || "Años de trayectoria, cuerpo profesional de primer nivel y compromiso constante con la calidad."}</p>`,
        `<p>${omitIcons ? "" : "📍 "}<strong>Ubicación y Canales:</strong> Atención presencial y digital a través de canales habilitados${locStr}.</p>`
      ].filter(Boolean).join("\n");

      return { description: omitIcons ? stripEmojisAndIcons(detailedContent) : detailedContent };
    }

    // 0. SPECIAL: WHO WE ARE / PUNCTUAL INSTITUTIONAL SYNTHESIS
    if (isWhoWeAre) {
      const whoIdx = Math.abs(variationIndex) % 6;
      let whoWeAreOutput = "";
      if (whoIdx === 0) {
        const b1 = isLegal || isJudicial ? "Asesoría especializada en derecho migratorio, radicaciones, doble nacionalidad y visas consulares." : isHealth ? "Guardia médica continua 24hs y cuerpo de especialistas multidisciplinarios." : isEducation ? "Carreras de grado, posgrados y títulos con validez nacional." : "Servicios certificados y estándares de calidad comprobados.";
        const b2 = isLegal || isJudicial ? "Gestión remota nacional e internacional con respaldo jurídico integral." : isHealth ? "Tecnología médica avanzada para diagnósticos e internación." : isEducation ? "Modalidades presenciales y virtuales con campus digital 24/7." : "Atención personalizada y asesoramiento continuo.";
        whoWeAreOutput = [
          `<p>${omitIcons ? "" : "🏛️ "}<strong>Quiénes Somos:</strong> ${cleanName ? `${cleanName} es una entidad referente en ` : ""}${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "⭐ "}<strong>Aspectos y Servicios Destacados:</strong><br/>• ${b1}<br/>• ${b2}</p>`,
          `<p>${omitIcons ? "" : "📍 "}<strong>Sede y Contacto:</strong> Información institucional y canales directos de atención disponibles${locStr}.</p>`,
        ].join("\n");
      } else if (whoIdx === 1) {
        whoWeAreOutput = [
          `<p>${omitIcons ? "" : "🎯 "}<strong>Nuestra Identidad y Misión:</strong> ${cleanName || "La institución"} orienta su labor profesional a resolver las necesidades de cada usuario con máxima dedicación: ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "🤝 "}<strong>Compromiso y Ética:</strong> Transparencia, confidencialidad y vocación de servicio en cada gestión y consulta.</p>`,
          `<p>${omitIcons ? "" : "📞 "}<strong>Vías de Comunicación:</strong> Canales oficiales directos habilitados para asesoramiento personalizado.</p>`,
        ].join("\n");
      } else if (whoIdx === 2) {
        whoWeAreOutput = [
          `<p>${omitIcons ? "" : "💼 "}<strong>Presentación Institucional:</strong> Con sólida presencia y trayectoria${locStr}, ${cleanName ? `el equipo de ${cleanName}` : "nuestro equipo"} se especializa en ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "🔍 "}<strong>Metodología de Trabajo:</strong> Diagnóstico detallado desde el primer contacto para brindar soluciones eficaces y seguras.</p>`,
          `<p>${omitIcons ? "" : "📍 "}<strong>Atención y Canales:</strong> Atención presencial y asistencia remota centralizada por vías digitales.</p>`,
        ].join("\n");
      } else if (whoIdx === 3) {
        whoWeAreOutput = [
          `<p>${omitIcons ? "" : "👥 "}<strong>Quiénes Integran el Equipo:</strong> Profesionales capacitados con amplia experiencia y sólida formación técnica: ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "🛡️ "}<strong>Garantía de Respaldo:</strong> Procesos transparentes, comunicación permanente y cumplimiento normativo estricto.</p>`,
          `<p>${omitIcons ? "" : "💬 "}<strong>Consultas:</strong> Mesa de informes y orientación disponible para todos los interesados.</p>`,
        ].join("\n");
      } else if (whoIdx === 4) {
        whoWeAreOutput = [
          `<p>${omitIcons ? "" : "📌 "}<strong>Perfil Institucional Conciso:</strong> ${cleanName ? `${cleanName} - ` : ""}${rawValueProp}. Enfoque directo, profesional y orientado a resultados concretos.</p>`,
          `<p>${omitIcons ? "" : "✨ "}<strong>Valores Clave:</strong> Excelencia operativa, calidez en la atención y rigurosidad técnica.</p>`,
          `<p>${omitIcons ? "" : "🌐 "}<strong>Acceso y Gestión:</strong> Plataforma oficial y canales de consulta habilitados permanentemente.</p>`,
        ].join("\n");
      } else {
        whoWeAreOutput = [
          `<p>${omitIcons ? "" : "🌟 "}<strong>Acerca de ${cleanName || "la Entidad"}:</strong> Referente destacado por su trayectoria, calidad en sus prestaciones y compromiso constante: ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "🚀 "}<strong>Diferencial Operativo:</strong> Asesoramiento personalizado adaptado a cada caso, reduciendo tiempos y asegurando respuestas claras.</p>`,
          `<p>${omitIcons ? "" : "📩 "}<strong>Atención Directa:</strong> Consultas e información coordinadas a través de sus canales oficiales.</p>`,
        ].join("\n");
      }

      if (omitIcons) whoWeAreOutput = stripEmojisAndIcons(whoWeAreOutput);
      return { description: whoWeAreOutput };
    }

    // 1. SHORT / CONCISE FORMAT
    if (isShort) {
      const shortHooks = isEducation ? [
        `Formación universitaria oficial de excelencia${locStr}. Carreras de grado, posgrados y modalidades adaptadas a tus metas profesionales.`,
        `Educación superior de excelencia: Programas académicos líderes con títulos de validez nacional y alta inserción laboral.`,
        `Impulsá tu carrera con carreras universitarias y posgrados oficiales: Flexibilidad horaria, campus digital y cuerpo docente de primer nivel.`,
      ] : isHealth ? [
        `Atención médica integral con guardia médica activa y consultorios de especialidades de primer nivel${locStr}.`,
        `Cobertura de salud de excelencia: Profesionales de destacada trayectoria y asignación inmediata de turnos online.`,
      ] : isSports ? [
        `Centro de entrenamiento y actividades deportivas integrales con instalaciones modernas${locStr}.`,
        `Entrená al máximo nivel: Espacios equipados, clases guiadas y planes de membresía flexibles.`,
      ] : [
        `${rawValueProp}. Calidad certificada, trayectoria profesional y atención personalizada.`,
        `Servicios profesionales de excelencia con atención personalizada y soluciones a medida${locStr}.`,
      ];

      const chosenHook = shortHooks[variationIndex % shortHooks.length];

      const bullet1 = isEducation ? "Carreras de grado y posgrados con títulos oficiales de validez nacional."
        : isHealth ? "Especialidades médicas multidisciplinarias y guardia continua."
        : isSports ? "Equipamiento de última generación y seguimiento profesional."
        : "Soluciones a medida y asesoramiento especializado.";

      const bullet2 = isEducation ? (isVirtual ? "Modalidad 100% online con cursado flexible 24/7." : "Modalidades presenciales y a distancia con campus interactivo.")
        : isHealth ? "Turnos online y convenios con principales coberturas."
        : isSports ? "Horarios flexibles y actividades para todas las edades."
        : "Canales oficiales directos para consultas y presupuestos.";

      const bulletsBlock = `<p><strong>Puntos clave:</strong><br/>• ${bullet1}<br/>• ${bullet2}</p>`;

      let shortOutput = [
        priceLine ? `<p>${priceLine}</p>` : "",
        `<p><strong>Propuesta destacada:</strong> ${chosenHook}</p>`,
        bulletsBlock,
      ].filter(Boolean).join("\n");

      if (omitIcons) {
        shortOutput = stripEmojisAndIcons(shortOutput);
      }
      return { description: shortOutput };
    }

    // 2. FORMAL INSTITUTIONAL FORMAT
    if (isFormal) {
      const formalIdx = Math.abs(variationIndex) % 6;
      let formalOutput = "";
      if (formalIdx === 0) {
        formalOutput = [
          vigenciaLine || priceLine ? `<p>${[vigenciaLine, priceLine].filter(Boolean).join(" ")}</p>` : "",
          `<p>${omitIcons ? "" : "🏛️ "}<strong>Presentación Institucional:</strong> ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "📜 "}<strong>Servicios & Respaldo Oficial:</strong> Programas y prestaciones con estricto cumplimiento normativo, acreditación oficial y estándares de excelencia profesional.</p>`,
          !omitDiferencial ? `<p>${omitIcons ? "" : "⭐ "}<strong>Diferencial Institucional:</strong> ${facts.diff || `Cuerpo profesional de destacada trayectoria, asesoramiento personalizado y canales de comunicación directos.`}</p>` : "",
          !omitExclusiones ? `<p>${omitIcons ? "" : "⚠️ "}<strong>Información Importante:</strong> ${facts.excl || "Consultar requisitos y disponibilidad en los canales institucionales habilitados."}</p>` : "",
          `<p>${omitIcons ? "" : "📍 "}<strong>Ubicación & Contacto:</strong> Sede oficial${locStr}. Canales habilitados para consultas e inscripciones.</p>`,
        ].filter(Boolean).join("\n");
      } else if (formalIdx === 1) {
        formalOutput = [
          `<p>${omitIcons ? "" : "⚖️ "}<strong>Marco Institucional y Operativo:</strong> ${cleanName || "La entidad"} desarrolla sus actividades bajo rigurosos protocolos técnicos y de calidad: ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "📋 "}<strong>Áreas de Cobertura y Especialidad:</strong> Servicios integrales diseñados con base en las normativas vigentes y mejores prácticas del sector.</p>`,
          `<p>${omitIcons ? "" : "🛡️ "}<strong>Garantía de Seguridad Jurídica:</strong> Confidencialidad absoluta, matriculación oficial y respaldo institucional continuo.</p>`,
          `<p>${omitIcons ? "" : "📞 "}<strong>Mesa de Entradas y Atención:</strong> Canales institucionales formales habilitados para recepción de trámites.</p>`,
        ].join("\n");
      } else if (formalIdx === 2) {
        formalOutput = [
          `<p>${omitIcons ? "" : "📜 "}<strong>Reseña y Competencias Profesionales:</strong> ${rawValueProp}. Trayectoria consolidada en ${cityStr || "su jurisdicción"}.</p>`,
          `<p>${omitIcons ? "" : "🔍 "}<strong>Estándares de Auditoría:</strong> Procesos certificados orientados a la máxima exactitud técnica y satisfacción del usuario.</p>`,
          `<p>${omitIcons ? "" : "🏛️ "}<strong>Sede y Vías Formales:</strong> Asistencia presencial programada y gestión electrónica habilitada.</p>`,
        ].join("\n");
      } else if (formalIdx === 3) {
        formalOutput = [
          `<p>${omitIcons ? "" : "📑 "}<strong>Síntesis Corporativa Oficial:</strong> ${cleanName ? `${cleanName} opera como una institución de referencia` : "Institución de referencia"} en ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "✨ "}<strong>Pilares Institucionales:</strong> Responsabilidad profesional, transparencia en costos y celeridad en la resolución de expedientes.</p>`,
          `<p>${omitIcons ? "" : "📍 "}<strong>Dependencias Oficiales:</strong> Canales centralizados de atención ciudadana y corporativa.</p>`,
        ].join("\n");
      } else if (formalIdx === 4) {
        formalOutput = [
          `<p>${omitIcons ? "" : "🎯 "}<strong>Declaración de Prestaciones Institucionales:</strong> ${rawValueProp}. Metodología orientada a la excelencia y respaldo normativo.</p>`,
          `<p>${omitIcons ? "" : "🤝 "}<strong>Atención Especializada:</strong> Asesoramiento a particulares, instituciones y empresas con profesionales matriculados.</p>`,
          `<p>${omitIcons ? "" : "📩 "}<strong>Contacto Institucional:</strong> Consultas formales y coordinación por vías oficiales.</p>`,
        ].join("\n");
      } else {
        formalOutput = [
          `<p>${omitIcons ? "" : "💎 "}<strong>Dictamen Institucional:</strong> ${cleanName || "El prestador"} consolida su propuesta de valor: ${rawValueProp}.</p>`,
          `<p>${omitIcons ? "" : "🔒 "}<strong>Compromiso y Confiabilidad:</strong> Procedimientos auditados, información fehaciente y resguardo integral de datos.</p>`,
          `<p>${omitIcons ? "" : "🌐 "}<strong>Canales Habilitados:</strong> Plataforma digital y vías presenciales oficiales para atención al público.</p>`,
        ].join("\n");
      }

      if (omitIcons) formalOutput = stripEmojisAndIcons(formalOutput);
      return { description: formalOutput };
    }

    // Dynamic, organic description generator based strictly on entity facts and investigated web context
    const webHeadings = investigatedWeb?.headings || [];
    const webSnippet = investigatedWeb?.snippet || investigatedWeb?.description || "";
    const cleanEntityTitle = cleanName || "La entidad";

    const headingsStr = webHeadings.length > 0 ? webHeadings.slice(0, 4).join(", ") : "";

    const dynamicParagraphs: string[] = [];

    // Paragraph 1: Main identity & proposition
    if (isHealth) {
      dynamicParagraphs.push(
        `<p><strong>${cleanEntityTitle}</strong> es un centro médico y asistencial de referencia${locStr}, enfocado en brindar atención médica de calidad, consultorios de especialidad y guardia médica activa.</p>`
      );
    } else if (isEducation) {
      dynamicParagraphs.push(
        `<p><strong>${cleanEntityTitle}</strong> es una institución educativa de nivel superior${locStr}, comprometida con la excelencia académica, la formación profesional y el desarrollo integral de sus estudiantes.</p>`
      );
    } else if (isJudicial) {
      dynamicParagraphs.push(
        `<p><strong>${cleanEntityTitle}</strong> es un estudio profesional especializado en asesoramiento jurídico, consultoría legal y representación técnica${locStr}.</p>`
      );
    } else if (isSports) {
      dynamicParagraphs.push(
        `<p><strong>${cleanEntityTitle}</strong> es un centro deportivo y de entrenamiento${locStr}, dedicado a promover la actividad física, la salud y la formación atlética.</p>`
      );
    } else {
      dynamicParagraphs.push(
        `<p><strong>${cleanEntityTitle}</strong> es una organización con sólida trayectoria${locStr}, orientada a brindar servicios y soluciones integrales de alta calidad en su rubro.</p>`
      );
    }

    // Paragraph 2: Real extracted proposal & services
    if (headingsStr) {
      dynamicParagraphs.push(
        `<p><strong>Servicios y Especialidades:</strong> Su oferta integral abarca ${headingsStr}, brindados por profesionales idóneos con equipamiento adecuado.</p>`
      );
    } else if (webSnippet) {
      dynamicParagraphs.push(
        `<p><strong>Propuesta y Alcance:</strong> ${escapeHtml(webSnippet.slice(0, 240))}.</p>`
      );
    } else {
      dynamicParagraphs.push(
        `<p><strong>Prestaciones Destacadas:</strong> Asistencia personalizada, procesos coordinados y estándares rigurosos de atención para satisfacer los requerimientos de sus usuarios.</p>`
      );
    }

    // Paragraph 3: Price / Vigencia if applicable
    if (priceLine) {
      dynamicParagraphs.push(`<p>${priceLine}</p>`);
    }

    // Paragraph 4: Official channels & contact
    dynamicParagraphs.push(
      `<p><strong>Información y Canales Oficiales:</strong> Consultas, turnos y asesoramiento coordinados a través de su plataforma oficial y vías habilitadas de comunicación.</p>`
    );

    let resHtml = dynamicParagraphs.join("\n");

    if (omitIcons) {
      resHtml = stripEmojisAndIcons(resHtml);
    }

    return { description: resHtml };
  }

  if (fieldType === "provider_info") {
    const entityNoun = hasNegativeConstraint
      ? isEducation
        ? "Esta institución educativa"
        : isJudicial
        ? "Este estudio profesional"
        : isSports
        ? "Esta entidad deportiva"
        : isHealth
        ? "Este centro de salud"
        : "Esta organización"
      : cleanName || "La entidad";

    if (isEducation) {
      return {
        providerInfo: `${entityNoun} se destaca por su trayectoria académica, innovación pedagógica y compromiso con el desarrollo profesional${cityStr ? ` en ${cityStr}` : ""}.`,
      };
    }
    if (isJudicial) {
      return {
        providerInfo: `${entityNoun} es un estudio profesional reconocido por su rigurosidad técnica, trayectoria legal y sólida defensa de los intereses de sus clientes${cityStr ? ` en ${cityStr}` : ""}.`,
      };
    }
    if (isSports) {
      return {
        providerInfo: `${entityNoun} es una institución deportiva comprometida con el desarrollo atlético, vida saludable y formación integral${cityStr ? ` en ${cityStr}` : ""}.`,
      };
    }
    if (isHealth) {
      return {
        providerInfo: `${entityNoun} es un centro de salud de referencia, enfocado en brindar atención médica multidisciplinaria, guardias permanentes y calidad humana${cityStr ? ` en ${cityStr}` : ""}.`,
      };
    }
    return {
      providerInfo: `${entityNoun} es una organización con amplia experiencia y sólida trayectoria, reconocida por la calidad y seriedad de sus servicios${cityStr ? ` en ${cityStr}` : ""}.`,
    };
  }

  // Extra block or new extra block
  if (fieldType === "extra_block" || fieldType === "new_extra_block") {
    const blockUserCorpus = `${pLower} ${meta.title || ""} ${currentText} ${userPrompts}`.toLowerCase();

    // Check if user specifically requested a title change
    let explicitNewTitle = "";
    const changeTitleMatch = prompt.match(/(?:cambi[aá]|modific[aá]|pon[eé]|renombr[aá]|t[ií]tulo(?:\s*:|\s+a))\s+(?:el\s+t[ií]tulo\s+(?:a|por)\s+|a\s+|por\s+)?([^,.;:\n]+)/i);
    if (changeTitleMatch && !/(?:10|pregunta|mas|largo|corto|sin icono|requisito)/i.test(changeTitleMatch[1].trim())) {
      explicitNewTitle = changeTitleMatch[1].trim();
      explicitNewTitle = explicitNewTitle.charAt(0).toUpperCase() + explicitNewTitle.slice(1);
    }

    if (/score|scout|puntaje|auditor|madurez/i.test(blockUserCorpus)) {
      const scoreMatch = blockUserCorpus.match(/\b(100|[1-9]\d|\d)\b/);
      const targetScore = scoreMatch ? Math.min(100, Math.max(10, parseInt(scoreMatch[1], 10))) : 68;

      const p1 = Math.min(25, Math.max(2, Math.round(targetScore * 0.25)));
      const p2 = Math.min(15, Math.max(1, Math.round(targetScore * 0.15)));
      const p3 = Math.min(20, Math.max(2, Math.round(targetScore * 0.20)));
      const p4 = Math.min(15, Math.max(2, Math.round(targetScore * 0.15)));
      const p5 = Math.min(15, Math.max(2, Math.round(targetScore * 0.15)));
      const p6 = Math.min(10, Math.max(1, targetScore - (p1 + p2 + p3 + p4 + p5)));

      const realTotal = Math.min(100, p1 + p2 + p3 + p4 + p5 + p6);
      const mad = realTotal >= 85 ? "Líder" : realTotal >= 70 ? "Consolidado" : realTotal >= 50 ? "En desarrollo" : "Básico / Observado";
      const vin = /oficial/i.test(blockUserCorpus) ? "Oficial" : "Directo";
      const evi = realTotal < 75
        ? "Presencia institucional y canales informados con observaciones en políticas de privacidad o términos"
        : "Canales oficiales verificados, mapa de ubicación y datos de contacto activos";

      return {
        title: explicitNewTitle || meta.title || `${omitIcons ? "" : "🛡️ "}Score Scout ${realTotal}/100`,
        body: `<p>Presencia/reputación ${p1}/25 · Contacto verificable ${p2}/15 · Trayectoria/evidencia operativa ${p3}/20 · Claridad propuesta ${p4}/15 · Transparencia/seguridad ${p5}/15 · Datos institucionales ${p6}/10<br>Madurez: ${mad} - Vínculo: ${vin} - Evidencia: ${evi}.</p>`,
      };
    }

    if (/faq|pregunt|pregunat|duda|consulta|q&a|cuestion/i.test(blockUserCorpus)) {
      // Determine requested count (e.g. "10 preguntas con sus respuestas", "10 maximo", etc.)
      const countMatch = prompt.match(/\b(\d+)\s*(?:preguntas?|faq|items?|puntos?|consultas?)\b/i) ||
        prompt.match(/\b(1\d|[2-9])\b/) ||
        userPrompts.match(/\b(\d+)\s*(?:preguntas?|faq|items?|puntos?)/i);
      const requestedCount = countMatch ? Math.min(Math.max(parseInt(countMatch[1] || countMatch[0], 10), 2), 20) : 10;

      // Extract real keywords and headings from web investigation
      const webHeadings = investigatedWeb?.headings || [];
      const webSnippet = investigatedWeb?.snippet || investigatedWeb?.description || "";
      const locText = cityStr ? ` en ${cityStr}` : "";

      // Dynamic question generator topics tailored to the entity's sector and real data
      const dynamicTopics = [
        {
          q: (name: string) => `¿Cómo contactar o solicitar información en ${name}?`,
          a: (name: string) => `Podés comunicarte a través de los canales oficiales habilitados (sitio web, líneas telefónicas o atención presencial${locText}) para recibir asesoramiento personalizado.`,
        },
        {
          q: (name: string) => `¿Cuáles son los servicios y especialidades principales que brinda ${name}?`,
          a: (name: string) => `${name} cuenta con una amplia cartera de prestaciones${webHeadings.length ? ` que incluye ${webHeadings.slice(0, 3).join(", ")}` : ""}, brindadas por profesionales con sólida trayectoria y equipamiento de calidad.`,
        },
        {
          q: (name: string) => `¿Se requiere turno o coordinación previa para la atención?`,
          a: (name: string) => `Se recomienda gestionar turno o coordinación previa por vías oficiales para garantizar disponibilidad y una atención ágil y sin demoras.`,
        },
        {
          q: (name: string) => `¿Qué modalidades de atención o consulta ofrece ${name}?`,
          a: (name: string) => `Ofrece atención presencial en sus sedes oficiales${locText} y soporte a través de canales digitales y de consulta directa.`,
        },
        {
          q: (name: string) => `¿Cuáles son los requisitos y documentación necesaria para iniciar gestiones?`,
          a: (name: string) => `Se requiere documento de identidad vigente y la documentación respaldatoria correspondiente informada por el área de admisión según la gestión a realizar.`,
        },
        {
          q: (name: string) => `¿Cómo se gestionan los pagos, aranceles o coberturas en ${name}?`,
          a: (name: string) => `Dispone de múltiples medios de pago y facturación oficial, además de convenios y planes informados directamente al momento de la consulta.`,
        },
        {
          q: (name: string) => `¿Dónde se encuentran ubicadas las instalaciones de ${name}?`,
          a: (name: string) => `Las sedes principales y puntos de atención se encuentran informados con ubicación verificada y datos de contacto en su plataforma oficial.`,
        },
        {
          q: (name: string) => `¿Cómo recibir seguimiento o resultados de trámites y solicitudes?`,
          a: (name: string) => `A través de las plataformas digitales oficiales o comunicándote con el área de atención al usuario con tu número de gestión o datos personales.`,
        },
        {
          q: (name: string) => `¿Qué días y horarios de atención tiene ${name}?`,
          a: (name: string) => `La atención se brinda en días hábiles en horarios comerciales y administrativos, complementados por canales de consulta digital activos.`,
        },
        {
          q: (name: string) => `¿Qué respaldo y trayectoria ofrece ${name} a sus usuarios?`,
          a: (name: string) => `${name} se destaca por su sólida presencia institucional, estándares de calidad certificados y un equipo interdisciplinario enfocado en la satisfacción de cada necesidad.`,
        },
        {
          q: (name: string) => `¿Tienen programas de atención personalizada o asesoramiento continuo?`,
          a: (name: string) => `Sí, cada solicitud es evaluada de manera individual para brindar soluciones ajustadas a cada caso particular con seguimiento integral.`,
        },
        {
          q: (name: string) => `¿Cómo verificar novedades, convocatorias o información actualizada de ${name}?`,
          a: (name: string) => `Toda la información y actualizaciones se publican periódicamente en sus vías oficiales de comunicación y portales autorizados.`,
        },
      ];

      // Rotate and vary based on variationIndex
      const rotOffset = (Math.abs(variationIndex) * 2) % dynamicTopics.length;
      const rotated = [...dynamicTopics.slice(rotOffset), ...dynamicTopics.slice(0, rotOffset)];
      const itemsToTake = rotated.slice(0, requestedCount);

      const bodyHtml = itemsToTake
        .map((item) => `<p><strong>${item.q(cleanName)}</strong><br/>${item.a(cleanName)}</p>`)
        .join("\n");

      const blockTitle = explicitNewTitle || (meta.title && /faq|pregunt/i.test(meta.title) ? meta.title : "Preguntas Frecuentes (FAQ)");

      return {
        title: blockTitle,
        body: bodyHtml,
      };
    }

    // 1. Cómo trabajan / Metodología / Procedimientos / Procesos
    if (/c[oó]mo\s+trabajan|c[oó]mo\s+funciona|metodolog|procedimiento|proceso|modalidad\s+de\s+trabajo|forma\s+de\s+trabajo|c[oó]mo\s+se\s+atiende|pasos|protocolo/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Metodología y Proceso de Trabajo";
      const bodyHtml = [
        `<p><strong>1. Recepción y Diagnóstico Inicial:</strong> Relevamiento de necesidades, registro administrativo y orientación personalizada para canalizar cada requerimiento.</p>`,
        `<p><strong>2. Ejecución y Desarrollo:</strong> Prestación del servicio bajo estándares de calidad, protocolos rigurosos y coordinación a cargo de profesionales calificados.</p>`,
        `<p><strong>3. Seguimiento y Soporte Continuo:</strong> Monitoreo de resultados, atención de consultas y comunicación permanente por canales oficiales.</p>`,
        `<p><strong>Coordinación:</strong> Asistencia directa y asesoramiento disponible en vías oficiales de ${cleanName}.</p>`
      ].join("\n");

      return {
        title: blockTitle,
        body: bodyHtml,
      };
    }

    // 2. Equipo / Profesionales / Staff / Médicos / Docentes
    if (/equipo|profesional|m[eé]dic|staff|especialista|docente|claustro|qui[eé]nes\s+somos/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Equipo Profesional y Especialistas";
      return {
        title: blockTitle,
        body: `<p><strong>Cuerpo interdisciplinario:</strong> ${cleanName} cuenta con un equipo calificado de sólida formación técnica y compromiso profesional.</p><p><strong>Atención personalizada:</strong> Cada requerimiento es abordado con rigor y cercanía para ofrecer respuestas integrales.</p><p><strong>Consultas:</strong> Consultá información institucional y vías de contacto en los canales oficiales.</p>`,
      };
    }

    // 3. Coberturas / Obras Sociales / Prepagas / Seguros / Convenios
    if (/cobertura|obra\s+social|prepaga|seguro|convenio|afiliad/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Coberturas y Convenios Habilitados";
      return {
        title: blockTitle,
        body: `<p><strong>Convenios institucionales:</strong> Atención coordinada con entidades, coberturas y modalidades vigentes para facilitar el acceso a las prestaciones.</p><p><strong>Consultas particulares:</strong> Opciones para usuarios particulares con emisión de comprobantes oficiales.</p><p><strong>Verificación:</strong> Confirmá convenios y requisitos vigentes a través de los canales de admisión de ${cleanName}.</p>`,
      };
    }

    // 4. Turnos / Consultas / Reservas
    if (/turno|consulta|reserva|solicitar\s+atenci|pedir\s+turno/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Gestión de Turnos y Consultas";
      return {
        title: blockTitle,
        body: `<p><strong>Canales digitales y telefónicos:</strong> Gestión ágil de consultas y citas a través de las vías oficiales de ${cleanName}.</p><p><strong>Atención coordinada:</strong> Orientación personalizada para seleccionar el horario y modalidad más conveniente.</p><p><strong>Contacto directo:</strong> Comunicate con la central habilitada para asegurar tu reserva.</p>`,
      };
    }

    if (/requisito|admisi|inscrip|document/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Requisitos de Admisión e Inscripción";
      return {
        title: blockTitle,
        body: `<p><strong>Documentación general:</strong> Presentación de documento de identidad vigente y antecedentes correspondientes a la gestión solicitada.</p><p><strong>Canales de presentación:</strong> Trámite presencial o digital según la vía habilitada por ${cleanName}.</p><p><strong>Confirmación:</strong> Validación de requisitos y comunicación de avances por vías oficiales.</p>`,
      };
    }

    if (/pago|financi|cuota|tarifa|precio/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Medios de Pago y Financiación";
      return {
        title: blockTitle,
        body: `<p><strong>Opciones habilitadas:</strong> Múltiples medios de pago oficiales y planes informados al momento de coordinar el servicio.</p><p><strong>Comprobantes:</strong> Emisión de facturación electrónica y recibos oficiales para respaldo administrativo.</p>`,
      };
    }

    if (/especialidad|servicio|prestacion|prestación|cobertura/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Especialidades y Servicios Destacados";
      return {
        title: blockTitle,
        body: `<p><strong>Áreas de cobertura:</strong> Prestaciones integrales y soporte especializado a cargo de ${cleanName}.</p><p><strong>Calidad operativa:</strong> Procesos certificados y enfoque adaptado a cada necesidad.</p><p><strong>Información:</strong> Consultá el detalle completo de prestaciones en sus canales oficiales.</p>`,
      };
    }

    if (/horario|guardia|atenci[oó]n|dias?|días?/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Horarios y Canales de Atención";
      return {
        title: blockTitle,
        body: `<p><strong>Horarios habilitados:</strong> Atención presencial en días y horarios administrativos informados en la sede oficial de ${cleanName}.</p><p><strong>Canales digitales:</strong> Recepción continua de consultas a través de su plataforma web y vías directas.</p>`,
      };
    }

    if (/instalacion|instalación|sede|equipamiento|infraestructura|tecnolog/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Instalaciones y Equipamiento";
      return {
        title: blockTitle,
        body: `<p><strong>Infraestructura:</strong> Espacios acondicionados y equipamiento adecuado para el desarrollo de las actividades de ${cleanName}.</p><p><strong>Seguridad y confort:</strong> Instalaciones preparadas para brindar atención de calidad y cumplimiento normativo.</p>`,
      };
    }

    // Generic custom block with smart title extraction and structured body
    let customTitle = explicitNewTitle || "";
    if (!customTitle) {
      const cleanPromptTopic = prompt
        .replace(/^(?:crea|crear|armar|generar|hacer|pone|escribe|redacta)\s+(?:un\s+bloque\s+de\s+|un\s+bloque\s+|bloque\s+de\s+|bloque\s+|una\s+seccion\s+de\s+|seccion\s+de\s+|secci[oó]n\s+)?/i, "")
        .replace(/^(?:informaci[oó]n\s+(?:de|sobre)\s+|detalle\s+(?:de|sobre)\s+|datos\s+(?:de|sobre)\s+)/i, "")
        .trim();

      if (cleanPromptTopic.length >= 3 && !/hospital|universidad|colegio|empresa/i.test(cleanPromptTopic)) {
        customTitle = cleanPromptTopic.charAt(0).toUpperCase() + cleanPromptTopic.slice(1);
      } else {
        customTitle = "Información y Servicios";
      }
    }

    // Build rich, structured body using investigated web facts
    const webSnippet = investigatedWeb?.description || investigatedWeb?.snippet || "";

    const richCustomBody = [
      `<p><strong>Alcance y propuesta:</strong> ${webSnippet ? webSnippet.slice(0, 200) + "." : `Servicios y prestaciones brindadas por ${cleanName} con respaldo institucional verificado.`}</p>`,
      `<p><strong>Aspectos destacados:</strong> Atención a cargo de personal idóneo y cumplimiento de estándares de calidad.</p>`,
      `<p><strong>Canales y coordinación:</strong> Asesoramiento personalizado disponible a través de las vías oficiales de ${cleanName}.</p>`
    ].join("\n");

    return {
      title: customTitle,
      body: richCustomBody,
    };
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body: RefineFieldRequest = await req.json();
    const {
      fieldType,
      currentText = "",
      prompt,
      currentTitle = "",
      publisherName = "",
      category = "",
      city = "",
      country = "",
      url = "",
      autoTranslate = true,
      apiKey,
      conversationHistory = [],
      variationIndex = 0,
    } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Debe ingresar una instrucción o prompt para la IA." }, { status: 400 });
    }

    const customKey = String(apiKey || "").trim();
    const geminiKey =
      (customKey && (customKey.startsWith("AIza") || !customKey.startsWith("sk-")) ? customKey : "") ||
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.GOOGLE_AI_KEY ||
      process.env.GEMINI_APIKEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
      "";

    const openaiKey =
      (customKey && customKey.startsWith("sk-") ? customKey : "") ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      "";

    // 0. Live Web Investigation if URL is present in prompt or metadata
    const promptUrlMatch = prompt.match(
      /(https?:\/\/[^\s,;()]+|www\.[a-zA-Z0-9-]+\.[^\s,;()]+|[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*(?:\.(?:com|edu|org|net|gov|gob|mil|int|io|co|cl|uy|bo|pe|br|lat|es|mx|ar|it|us|info|biz|me|app|dev|tech))+(?:\/[^\s,;()]*)?)/i
    );
    const targetInvestigateUrl = promptUrlMatch ? promptUrlMatch[0] : (url && url.trim() ? url.trim() : "");

    let investigatedWeb: InvestigatedWebInfo | null = null;
    if (targetInvestigateUrl) {
      investigatedWeb = await quickInvestigateUrl(targetInvestigateUrl);
    }

    const cleanName = cleanBaseEntityName(
      currentText || currentTitle || investigatedWeb?.pageTitle || "",
      publisherName || investigatedWeb?.pageTitle
    );

    const userAllPrompts = [
      ...conversationHistory.filter((m) => m.role === "user").map((m) => m.content),
      prompt,
    ].join(" ");

    const omitIcons = checkOmitIcons(prompt, conversationHistory);
    const forbiddenTerms = extractForbiddenTerms(userAllPrompts, cleanName, publisherName);

    const systemPrompt = buildSystemRefinePrompt(
      fieldType,
      currentText,
      prompt,
      {
        title: currentTitle || investigatedWeb?.pageTitle,
        publisherName: publisherName || investigatedWeb?.pageTitle,
        category,
        city,
        country,
        url: targetInvestigateUrl || url,
      },
      conversationHistory,
      investigatedWeb,
      variationIndex
    );

    let aiResult: any = null;

    // 1. Try Gemini Live API with high creative capability
    if (geminiKey) {
      aiResult = await callGeminiApi(geminiKey, systemPrompt, prompt, fieldType, variationIndex);
    }

    // 2. Try OpenAI API if Gemini was not configured or did not return
    if (!aiResult && openaiKey) {
      aiResult = await callOpenAiApi(openaiKey, systemPrompt, prompt, fieldType, variationIndex);
    }

    // 3. Fallback to advanced Semantic NLP Generator
    if (!aiResult) {
      aiResult = generateSemanticAiFallback(
        fieldType,
        currentText,
        prompt,
        {
          title: currentTitle || investigatedWeb?.pageTitle,
          publisherName: publisherName || investigatedWeb?.pageTitle,
          category,
          city,
          country,
          url: targetInvestigateUrl || url,
        },
        conversationHistory,
        variationIndex,
        investigatedWeb
      );
    }

    // 4. Guarantee 100% adherence to negative constraints & icon omission
    if (aiResult) {
      if (omitIcons) {
        if (fieldType === "title" && aiResult.title) {
          aiResult.title = stripEmojisAndIcons(aiResult.title);
        }
        if (fieldType === "description" && aiResult.description) {
          aiResult.description = stripEmojisAndIcons(aiResult.description);
        }
        if (fieldType === "provider_info" && aiResult.providerInfo) {
          aiResult.providerInfo = stripEmojisAndIcons(aiResult.providerInfo);
        }
        if (fieldType === "extra_block" || fieldType === "new_extra_block") {
          if (aiResult.title) aiResult.title = stripEmojisAndIcons(aiResult.title);
          if (aiResult.body) aiResult.body = stripEmojisAndIcons(aiResult.body);
        }
      }

      if (forbiddenTerms.length > 0) {
        if (fieldType === "title" && aiResult.title) {
          aiResult.title = sanitizeForbiddenTerms(aiResult.title, forbiddenTerms);
          if (!aiResult.title || aiResult.title.length < 10) {
            const fb = generateSemanticAiFallback(
              fieldType,
              currentText,
              prompt,
              {
                title: currentTitle || investigatedWeb?.pageTitle,
                publisherName: publisherName || investigatedWeb?.pageTitle,
                category,
                city,
                country,
                url: targetInvestigateUrl || url,
              },
              conversationHistory,
              variationIndex,
              investigatedWeb
            );
            aiResult.title = fb.title || aiResult.title;
          }
        }
        if (fieldType === "description" && aiResult.description) {
          aiResult.description = sanitizeForbiddenTerms(aiResult.description, forbiddenTerms);
        }
        if (fieldType === "provider_info" && aiResult.providerInfo) {
          aiResult.providerInfo = sanitizeForbiddenTerms(aiResult.providerInfo, forbiddenTerms);
        }
        if ((fieldType === "extra_block" || fieldType === "new_extra_block") && aiResult.body) {
          aiResult.body = sanitizeForbiddenTerms(aiResult.body, forbiddenTerms);
        }
      }
    }


    // Handle translations if autoTranslate is requested
    let translations: Record<string, any> = {};
    if (autoTranslate) {
      if (fieldType === "title" && aiResult?.title) {
        const tEs = aiResult.title;
        const [en, pt, it] = await Promise.all([
          translateTextDirect(tEs, "es", "en"),
          translateTextDirect(tEs, "es", "pt"),
          translateTextDirect(tEs, "es", "it"),
        ]);
        translations = { es: tEs, en, pt, it };
      } else if (fieldType === "description" && aiResult?.description) {
        const dEs = aiResult.description;
        const [en, pt, it] = await Promise.all([
          translateFullHtml(dEs, "en"),
          translateFullHtml(dEs, "pt"),
          translateFullHtml(dEs, "it"),
        ]);
        translations = { es: dEs, en, pt, it };
      } else if (fieldType === "provider_info" && aiResult?.providerInfo) {
        const pEs = aiResult.providerInfo;
        const [en, pt, it] = await Promise.all([
          translateTextDirect(pEs, "es", "en"),
          translateTextDirect(pEs, "es", "pt"),
          translateTextDirect(pEs, "es", "it"),
        ]);
        translations = { es: pEs, en, pt, it };
      } else if ((fieldType === "extra_block" || fieldType === "new_extra_block") && aiResult?.title && aiResult?.body) {
        const tEs = aiResult.title;
        const bEs = aiResult.body;
        const [tEn, tPt, tIt, bEn, bPt, bIt] = await Promise.all([
          translateTextDirect(tEs, "es", "en"),
          translateTextDirect(tEs, "es", "pt"),
          translateTextDirect(tEs, "es", "it"),
          translateFullHtml(bEs, "en"),
          translateFullHtml(bEs, "pt"),
          translateFullHtml(bEs, "it"),
        ]);
        translations = {
          titleI18n: { es: tEs, en: tEn, pt: tPt, it: tIt },
          bodyI18n: { es: bEs, en: bEn, pt: bPt, it: bIt },
        };
      }
    }

    return NextResponse.json({
      success: true,
      result: aiResult,
      translations,
    });
  } catch (error: any) {
    console.error("AI Refine Field Route Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar el prompt con IA." },
      { status: 500 }
    );
  }
}
