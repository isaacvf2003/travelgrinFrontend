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
  investigatedWeb?: InvestigatedWebInfo | null
): string {
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

  return `
Eres el Asistente de IA y Lead Copywriter Creativo Senior de Travelgrin (actúas con total libertad, inteligencia y flexibilidad, exactamente como ChatGPT Plus o Gemini Advanced).

🎯 TU MISIÓN:
Comprender a la perfección lo que el usuario pide en su instrucción y generar la MEJOR propuesta posible (con impacto, elegancia, persuasión, variedad estructural y excelente SEO).
- Si hay información investigada de la web o un texto previo de scraping en "TEXTO BASE ACTUAL", UTILÍZALA como fuente de la verdad para describir con precisión qué es el lugar/negocio, qué ofrece, qué servicios o carreras tiene y cuáles son sus diferenciales.
- Si el administrador te da indicaciones desde cero, redacta una propuesta basada exactamente en sus requerimientos.

⚠️ REGLAS MANDATORIAS DE PRIORIDAD MÁXIMA:
1. ENFOQUE PUNTUAL Y QUIÉNES SON:
   - Si el administrador pide "solo hable de quienes son", "lo más puntual", "quiénes somos", "qué es el lugar" o similar:
     Enfócate EXCLUSIVAMENTE en presentar de forma clara, directa y profesional qué es la institución/empresa, qué trayectoria y especialidades tiene y cuál es su rol.
     OMITE precios, vigencias y frases publicitarias huecas ("Una experiencia para superar tus expectativas...").

2. CONTROL DE ICONOS Y EMOJIS:
   - Si el administrador pide "sin icono", "sin iconos", "sin emojis", "sacale los iconos", "no uses iconos", o similar:
     ¡PROHIBIDO TOTALMENTE INCLUIR CUALQUIER EMOJI O ICONO (como 🚀, 🎓, ✨, ⭐, 💡, 💎, 🏆, etc.)! Usa títulos en negrita limpios y viñetas estándar (• o -). No acortes el contenido salvo que expresamente haya pedido acortarlo.
   - Si el administrador pide "con iconos", "con emojis", o una propuesta comercial llamativa:
     Usa emojis modernos y bien elegidos.

3. CONTROL DE LONGITUD (CORTO / LARGO):
   - Si el administrador pide "corta", "corto", "breve", "conciso", "resumido", "puntual", "en pocas palabras":
     ¡GENERA UN TEXTO ULTRA-BREVE Y DIRECTO! Máximo 1 a 2 párrafos cortos o 1 párrafo de presentación + 2 viñetas concisas.
   - Si el administrador pide "hacelo más largo", "más extenso", "con más detalle", "más completo":
     Desarrolla una propuesta amplia, completa y persuasiva.

4. REGLA DE NO REPETIR SIEMPRE EL MISMO MOLDE (VARIEDAD Y FRESCURA):
   - NO uses plantillas rígidas ni repitas siempre la misma frase introductoria.
   - NUNCA uses etiquetas burocráticas como "¿Para quién?:", "Documentación requerida:", "Permanencia:".

5. BLOQUES EXTRA Y FAQ CON CANTIDADES SOLICITADAS:
   - Si se trata de un bloque (extra_block o new_extra_block) y el usuario pide una cantidad específica (ej. "haz que sean 10 preguntas", "agregá 5 items"):
     GENERA EXACTAMENTE la cantidad de items o preguntas solicitadas completas (ej. 10 preguntas y respuestas completas en HTML).
     MANTÉN el título correspondiente (ej. "Preguntas Frecuentes (FAQ)", "Metodología y Proceso de Trabajo") y NUNCA uses el nombre de la institución como título del bloque.

6. AJUSTES Y SEGUIMIENTO:
   - Si el historial indica un ajuste o refinamiento a la propuesta previa:
     ¡Prioriza 100% la indicación más reciente del usuario y aplícala sobre el contenido!

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
  fieldType: FieldType
): Promise<any | null> {
  const models = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
  ];

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
                parts: [{ text: userMessage }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
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
                parts: [{ text: `${systemPrompt}\n\n${userMessage}` }],
              },
            ],
            generationConfig: {
              temperature: 0.7,
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
  fieldType: FieldType = "description"
): Promise<any | null> {
  const models = ["gpt-4o-mini", "gpt-4o"];
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
              { role: "user", content: userMessage },
            ],
            response_format: { type: "json_object" },
            temperature: 0.7,
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

    if (/impact|atenci[oó]n|trabajad|llamativ|potente|fuerte|nivel|profesional|excelen|destac|mejor|buen seo|posicionam/i.test(pLower)) {
      if (hasNegativeConstraint) {
        if (isEducation) {
          const v = [
            "Educación Superior de Vanguardia: Formación Universitaria con Alta Salida Laboral",
            "¡Vení a la Mejor Universidad! Carreras de Grado, Posgrados y Títulos Oficiales",
            "¡Liderá tu Futuro Profesional! Carreras Universitarias y Modalidad Flexible",
            "Excelencia Académica y Títulos Oficiales: Inscripciones Abiertas y Salida Laboral",
            "Carreras Universitarias de Vanguardia: Formación de Alto Nivel y Becas",
            "Tu Futuro Profesional Comienza Hoy: Carreras Oficiales de Primer Nivel",
          ];
          return { title: v[variationIndex % v.length] };
        }
        if (isJudicial) {
          const v = [
            "Soluciones Jurídicas de Excelencia: Asesoramiento y Representación Legal de Alto Nivel",
            "¡Protegé tus Derechos! Estrategia Legal, Trayectoria y Compromiso Profesional",
            "Estudio Jurídico de Vanguardia: Asesoramiento Notarial y Procesal Integral",
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
          `${cleanName} | Carreras de Grado, Posgrados Oficiales y Formación de Vanguardia`,
          `Liderá tu Futuro Profesional en ${cleanName} | Inscripciones Abiertas`,
        ];
        return { title: v[variationIndex % v.length] };
      }
      if (isJudicial) {
        return { title: `${cleanName} | Estudio Jurídico y Asesoramiento Legal Integral` };
      }
      if (isSports) {
        return { title: `${cleanName} | Club Deportivo, Entrenamientos y Pases Oficiales` };
      }
      if (isHealth) {
        return { title: `¡Contratá la mejor atención médica! ${cleanName} | Guardia 24hs y Turnos Online` };
      }
      if (isTourism) {
        return { title: `¡Viví la mejor experiencia! ${cleanName} | Hoteles y Excursiones Oficiales` };
      }
      return { title: `¡Elegí la mejor propuesta! ${cleanName}: Excelencia y Servicios de Primer Nivel` };
    }

    if (/veni|vení|inscribite|estudia|estudiá|entr[aá]|eleg[ií]|sumat|contrat[aá]|asociat|afiliat/i.test(pLower)) {
      if (hasNegativeConstraint) {
        if (isEducation) {
          const v = [
            "¡Inscribite Hoy! Carreras Universitarias Oficiales y Modalidades Flexibles",
            "¡Vení a la Mejor Universidad! Formación de Vanguardia y Títulos Oficiales",
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
        return { title: `¡Elegí Soluciones Profesionales de Vanguardia!` };
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
          "Liderá tu Futuro: Formación Universitaria y Carreras de Vanguardia",
          "Carreras de Grado, Posgrados Oficiales y Becas Universitarias",
          "Educación Superior de Excelencia: Inscripciones Abiertas y Salida Laboral",
          "Tu Futuro Profesional Comienza Hoy: Títulos Oficiales y Prácticas",
        ];
        return { title: v[variationIndex % v.length] };
      }
      const vGeneral = [
        "Excelencia, Confianza y Soluciones Profesionales de Primer Nivel",
        "Servicios de Vanguardia y Atención Personalizada Garantizada",
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

    // Dynamic price / vigencia lines
    let priceLine = "";
    if (!isWhoWeAre && (explicitlyWantsPrice || (facts.price && !omitPrice && !omitIcons && !isShort))) {
      priceLine = isFree ? "<strong>Precio:</strong> Actividad 100% gratuita / Acceso libre." : `<strong>Precio:</strong> ${facts.price || "A consultar según aranceles o tarifas vigentes."}`;
    } else if (isFree && !isWhoWeAre) {
      priceLine = "<strong>Precio:</strong> Actividad 100% gratuita / Acceso libre.";
    }

    let vigenciaLine = "";
    if (!isWhoWeAre && (explicitlyWantsVigencia || (facts.vigencia && !omitVigencia && !isShort))) {
      vigenciaLine = `<strong>Vigencia:</strong> ${facts.vigencia || "Activo; información verificada en canales oficiales."}`;
    }

    // Extract real proposition from scraping / web and clean out news / press-release boilerplate
    let rawValueProp = facts.valueProp || investigatedWeb?.description || "";
    if (!rawValueProp && currentText) {
      const cleanSentences = currentText.replace(/<[^>]+>/g, " ").replace(/&[a-z0-9#]+;/gi, " ").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/);
      rawValueProp = cleanSentences.filter(s => s.length > 25 && !/(?:Vigencia|Precio|Para quién|Diferencial):/i.test(s))[0] || "";
    }

    // Strip news / event / press-release fragments from scraped sentences
    if (/(?:junto\s+a\s+|el\s+presidente\s+|celebr[oó]\s+|inaugur[oó]\s+|en\s+un\s+emotivo|acto\s+|comunicado|haga\s+clic|bienvenidos?\s+al?\s+sitio)/i.test(rawValueProp)) {
      rawValueProp = "";
    }

    if (!rawValueProp) {
      rawValueProp = isHealth
        ? `Institución de salud de alta complejidad${locStr}, reconocida por su trayectoria médica, servicio de emergencias 24hs, tecnología diagnóstica de vanguardia y atención integral de especialidades.`
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

    // 0. SPECIAL: WHO WE ARE / PUNCTUAL INSTITUTIONAL SYNTHESIS
    if (isWhoWeAre) {
      const entityHeading = cleanName ? `<strong>${cleanName}</strong>` : "<strong>Presentación Institucional</strong>";
      const b1 = isHealth ? "Guardia médica continua 24hs y cuerpo de especialistas multidisciplinarios."
        : isEducation ? "Carreras de grado, posgrados y títulos con validez nacional."
        : isSports ? "Instalaciones equipadas y entrenamiento profesional guiado."
        : "Servicios certificados y estándares de calidad comprobados.";

      const b2 = isHealth ? "Tecnología médica de vanguardia para diagnósticos e internación."
        : isEducation ? "Modalidades presenciales y virtuales con campus digital 24/7."
        : isSports ? "Horarios flexibles y programas para todas las disciplinas."
        : "Atención personalizada y asesoramiento continuo.";

      let whoWeAreOutput = [
        `<p>${omitIcons ? "" : "🏛️ "}${entityHeading}: ${rawValueProp}.</p>`,
        `<p>${omitIcons ? "" : "⭐ "}<strong>Aspectos y Servicios Destacados:</strong><br/>• ${b1}<br/>• ${b2}</p>`,
        `<p>${omitIcons ? "" : "📍 "}<strong>Sede y Contacto:</strong> Información institucional y canales directos de atención disponibles${locStr}.</p>`,
      ].join("\n");

      if (omitIcons) whoWeAreOutput = stripEmojisAndIcons(whoWeAreOutput);
      return { description: whoWeAreOutput };
    }

    // 1. SHORT / CONCISE FORMAT
    if (isShort) {
      const shortHooks = isEducation ? [
        `Formación universitaria oficial de vanguardia${locStr}. Carreras de grado, posgrados y modalidades adaptadas a tus metas profesionales.`,
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
        `Servicios profesionales de vanguardia con atención personalizada y soluciones de excelencia${locStr}.`,
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
      let formalOutput = [
        vigenciaLine || priceLine ? `<p>${[vigenciaLine, priceLine].filter(Boolean).join(" ")}</p>` : "",
        `<p>${omitIcons ? "" : "🏛️ "}<strong>Presentación Institucional:</strong> ${rawValueProp}.</p>`,
        `<p>${omitIcons ? "" : "📜 "}<strong>Servicios & Respaldo Oficial:</strong> Programas y prestaciones con estricto cumplimiento normativo, acreditación oficial y estándares de excelencia profesional.</p>`,
        !omitDiferencial ? `<p>${omitIcons ? "" : "⭐ "}<strong>Diferencial Institucional:</strong> ${facts.diff || `Cuerpo profesional de destacada trayectoria, asesoramiento personalizado y canales de comunicación directos.`}</p>` : "",
        !omitExclusiones ? `<p>${omitIcons ? "" : "⚠️ "}<strong>Información Importante:</strong> ${facts.excl || "Consultar requisitos y disponibilidad en los canales institucionales habilitados."}</p>` : "",
        `<p>${omitIcons ? "" : "📍 "}<strong>Ubicación & Contacto:</strong> Sede oficial${locStr}. Canales habilitados para consultas e inscripciones.</p>`,
      ].filter(Boolean).join("\n");

      if (omitIcons) formalOutput = stripEmojisAndIcons(formalOutput);
      return { description: formalOutput };
    }

    // 3. EIGHT DIVERSE DYNAMIC ROTATING LAYOUTS
    const layoutIdx = variationIndex % 8;
    const icons = {
      rocket: omitIcons ? "" : "🚀 ",
      grad: omitIcons ? "" : "🎓 ",
      star: omitIcons ? "" : "⭐ ",
      sparkles: omitIcons ? "" : "✨ ",
      trophy: omitIcons ? "" : "🏆 ",
      diamond: omitIcons ? "" : "💎 ",
      target: omitIcons ? "" : "🎯 ",
      lightbulb: omitIcons ? "" : "💡 ",
      pin: omitIcons ? "" : "📍 ",
      shield: omitIcons ? "" : "🛡️ ",
      users: omitIcons ? "" : "👥 ",
      phone: omitIcons ? "" : "📞 ",
      calendar: omitIcons ? "" : "📅 ",
      bullet: "• ",
    };

    let resHtml = "";

    if (layoutIdx === 0) {
      // Layout 0: Executive Value Pitch
      const hook = isEducation
        ? `${icons.rocket}<strong>Liderá tu futuro con formación universitaria de vanguardia:</strong> ${rawValueProp}. Una propuesta pensada para potenciar tus competencias y acelerar tu inserción profesional en el mercado laboral.`
        : `${icons.rocket}<strong>Propuesta de valor de excelencia:</strong> ${rawValueProp}. Compromiso, trayectoria y servicios diseñados para ofrecer los más altos estándares de calidad.`;

      const reasonsTitle = isEducation ? `${icons.grad}<strong>¿Por qué elegir esta propuesta académica?</strong>` : `${icons.diamond}<strong>Aspectos destacados de la propuesta:</strong>`;
      const b1 = isEducation ? "<strong>Inscripciones ciclo 2026 abiertas:</strong> Oferta integral en carreras de grado, posgrados y diplomaturas oficiales." : "<strong>Calidad certificada:</strong> Procesos verificados y estándares rigurosos en cada prestación.";
      const b2 = isEducation ? (isVirtual ? "<strong>Modalidad virtual interactiva:</strong> Cursado 100% online con campus digital 24/7." : "<strong>Flexibilidad y tecnología:</strong> Cursado presencial y virtual adaptado a tus tiempos.") : "<strong>Atención personalizada:</strong> Asesoramiento continuo por canales oficiales.";
      const b3 = isEducation ? (hasScholarships ? "<strong>Planes de becas y convenios:</strong> Facilidades de pago y aranceles preferenciales." : "<strong>Títulos oficiales de validez nacional:</strong> Articulación directa con empresas e instituciones líderes.") : "<strong>Respaldo verificado:</strong> Seguridad, confianza y auditoría Travelgrin.";

      resHtml = [
        priceLine ? `<p>${priceLine}</p>` : "",
        `<p>${hook}</p>`,
        `<p>${reasonsTitle}<br/>${icons.bullet}${b1}<br/>${icons.bullet}${b2}<br/>${icons.bullet}${b3}</p>`,
        facts.diff && !omitDiferencial ? `<p>${icons.star}<strong>Diferencial:</strong> ${facts.diff}</p>` : "",
        `<p>${icons.pin}<strong>Informes y Consultas:</strong> Sede${locStr} y canales oficiales habilitados.</p>`,
      ].filter(Boolean).join("\n");
    } else if (layoutIdx === 1) {
      // Layout 1: The Transformative Experience
      const hook = isEducation
        ? `${icons.sparkles}<strong>Descubrí una experiencia universitaria transformadora:</strong> ${rawValueProp}. Diseñada para conectar tu vocación con oportunidades concretas y prepararte para destacar en un entorno competitivo.`
        : `${icons.sparkles}<strong>Una experiencia diseñada para superar tus expectativas:</strong> ${rawValueProp}. Calidad, agilidad y soluciones a medida con respaldo profesional.`;

      const b1 = isEducation ? "<strong>Planes de estudio actualizados:</strong> Diseñados junto a referentes del sector." : "<strong>Trayectoria sólida:</strong> Años de experiencia y prestigio en el rubro.";
      const b2 = isEducation ? "<strong>Campus interactivo 24/7:</strong> Recursos digitales de última generación para potenciar tu cursado." : "<strong>Canales directos:</strong> Comunicación fluida y resolución ágil de solicitudes.";
      const b3 = isEducation ? "<strong>Acompañamiento y orientación:</strong> Tutorías personalizadas durante toda tu carrera." : "<strong>Atención de excelencia:</strong> Soluciones pensadas para tu comodidad.";

      resHtml = [
        priceLine ? `<p>${priceLine}</p>` : "",
        `<p>${hook}</p>`,
        `<p>${icons.trophy}<strong>Ventajas competitivas clave:</strong><br/>${icons.bullet}${b1}<br/>${icons.bullet}${b2}<br/>${icons.bullet}${b3}</p>`,
        `<p>${icons.users}<strong>Dirigido a:</strong> ${facts.who || "Quienes buscan formación y servicios de nivel superior con respaldo garantizado."}</p>`,
        `<p>${icons.phone}<strong>Canales habilitados:</strong> Asesoramiento personalizado disponible a través de vías oficiales.</p>`,
      ].filter(Boolean).join("\n");
    } else if (layoutIdx === 2) {
      // Layout 2: Advantage Matrix & Action Focus
      const hook = isEducation
        ? `${icons.target}<strong>Impulsá tu crecimiento profesional con educación superior de élite:</strong> ${rawValueProp}. Formación práctica orientada a resultados reales.`
        : `${icons.target}<strong>Soluciones integrales de alto impacto:</strong> ${rawValueProp}. Eficiencia, transparencia y respaldo garantizado.`;

      const b1 = isEducation ? "<strong>Variedad académica:</strong> Programas de grado, especializaciones y diplomaturas." : "<strong>Servicios integrales:</strong> Cobertura completa de necesidades.";
      const b2 = isEducation ? "<strong>Modalidad híbrida y online:</strong> Estudiá a tu ritmo desde cualquier punto del país." : "<strong>Tecnología aplicada:</strong> Procesos modernos y seguros.";
      const b3 = isEducation ? "<strong>Inserción laboral:</strong> Vinculación activa y programas de pasantías profesionales." : "<strong>Garantía de satisfacción:</strong> Transparencia en aranceles y condiciones.";

      resHtml = [
        priceLine ? `<p>${priceLine}</p>` : "",
        `<p>${hook}</p>`,
        `<p>${icons.shield}<strong>Garantías y Pilares:</strong><br/>${icons.bullet}${b1}<br/>${icons.bullet}${b2}<br/>${icons.bullet}${b3}</p>`,
        `<p>${icons.pin}<strong>Sede y Alcance:</strong> ${cityStr ? `Presencia en ${cityStr}` : "Cobertura regional y nacional"} con gestión digital centralizada.</p>`,
      ].filter(Boolean).join("\n");
    } else if (layoutIdx === 3) {
      // Layout 3: Direct Punchy Overview
      const hook = `${icons.rocket}<strong>${rawValueProp}.</strong> Formación y servicios oficiales con sólida reputación${locStr}.`;
      const b1 = isEducation ? "Títulos oficiales con validez nacional y programas actualizados." : "Atención profesional certificada y personalizada.";
      const b2 = isEducation ? "Cursado flexible y plataformas de vanguardia." : "Respuesta inmediata y seguimiento continuo.";
      const b3 = isEducation ? "Inscripciones abiertas y asesoramiento vocacional." : "Aranceles transparentes y canales directos.";

      resHtml = [
        priceLine ? `<p>${priceLine}</p>` : "",
        `<p>${hook}</p>`,
        `<p><strong>Aspectos fundamentales:</strong><br/>${icons.bullet}${b1}<br/>${icons.bullet}${b2}<br/>${icons.bullet}${b3}</p>`,
        `<p>${icons.phone}<strong>Contacto:</strong> Canales oficiales abiertos para consultas e inscripciones.</p>`,
      ].filter(Boolean).join("\n");
    } else if (layoutIdx === 4) {
      // Layout 4: Innovation & Leadership
      const hook = isEducation
        ? `${icons.diamond}<strong>Liderazgo académico e innovación constante:</strong> ${rawValueProp}. Un modelo educativo que combina rigor conceptual con experiencia práctica de vanguardia.`
        : `${icons.diamond}<strong>Liderazgo e innovación en servicios:</strong> ${rawValueProp}. Experiencia comprobada y estándares superiores de atención.`;

      const b1 = isEducation ? "<strong>Modelo pedagógico innovador:</strong> Clases dinámicas y casos de estudio aplicados." : "<strong>Metodología comprobada:</strong> Soluciones probadas y adaptadas al cliente.";
      const b2 = isEducation ? "<strong>Claustro docente destacado:</strong> Profesionales referentes en su disciplina." : "<strong>Equipo de especialistas:</strong> Trayectoria y solvencia técnica.";
      const b3 = isEducation ? "<strong>Comunidad y networking:</strong> Intercambio enriquecedor entre estudiantes y egresados." : "<strong>Compromiso y cercanía:</strong> Vínculo de confianza a largo plazo.";

      resHtml = [
        priceLine ? `<p>${priceLine}</p>` : "",
        `<p>${hook}</p>`,
        `<p>${icons.lightbulb}<strong>Diferenciales de vanguardia:</strong><br/>${icons.bullet}${b1}<br/>${icons.bullet}${b2}<br/>${icons.bullet}${b3}</p>`,
        `<p>${icons.pin}<strong>Ubicación y Canales:</strong> Información institucional disponible en canales oficiales${locStr}.</p>`,
      ].filter(Boolean).join("\n");
    } else if (layoutIdx === 5) {
      // Layout 5: Editorial Review & Decision Guide
      const hook = isEducation
        ? `${icons.trophy}<strong>Excelencia académica reconocida y trayectoria comprobada:</strong> ${rawValueProp}. Elegir esta institución significa asegurar una formación sólida, respetada y con proyección.`
        : `${icons.trophy}<strong>Reconocimiento institucional y prestigio:</strong> ${rawValueProp}. Respaldado por años de experiencia y satisfacción de usuarios.`;

      const b1 = isEducation ? "<strong>Acreditación oficial:</strong> Carreras y posgrados reconocidos por autoridades ministeriales." : "<strong>Habilitaciones oficiales:</strong> Cumplimiento riguroso de normativas vigentes.";
      const b2 = isEducation ? "<strong>Infraestructura y campus:</strong> Espacios de aprendizaje modernos y equipados." : "<strong>Instalaciones y plataformas:</strong> Infraestructura óptima para un servicio seguro.";
      const b3 = isEducation ? "<strong>Planes accesibles:</strong> Opciones de becas y convenios de pago." : "<strong>Condiciones claras:</strong> Transparencia total en aranceles y modalidades.";

      resHtml = [
        priceLine ? `<p>${priceLine}</p>` : "",
        `<p>${hook}</p>`,
        `<p>${icons.target}<strong>Claves para tu elección:</strong><br/>${icons.bullet}${b1}<br/>${icons.bullet}${b2}<br/>${icons.bullet}${b3}</p>`,
        `<p>${icons.calendar}<strong>Próximos inicios e inscripciones:</strong> Consultá vacantes y cronogramas en las vías de admisión oficial.</p>`,
      ].filter(Boolean).join("\n");
    } else if (layoutIdx === 6) {
      // Layout 6: Key Features & Quick Access FAQ
      const hook = `${icons.rocket}<strong>Todo lo que necesitás saber sobre esta propuesta:</strong> ${rawValueProp}. Información clara y actualizada para tu decisión.`;
      const b1 = isEducation ? "<strong>¿Qué títulos se otorgan?:</strong> Carreras de grado, posgrados y diplomaturas oficiales." : "<strong>¿Qué alcance tiene?:</strong> Servicios personalizados presenciales y remotos.";
      const b2 = isEducation ? "<strong>¿Cómo se cursa?:</strong> Opciones presenciales, semipresenciales y 100% a distancia." : "<strong>¿Cómo se contrata?:</strong> Asesoramiento directo y presupuestos sin compromiso.";
      const b3 = isEducation ? "<strong>¿Cuáles son los requisitos?:</strong> DNI/Pasaporte y certificado de estudios secundarios." : "<strong>¿Qué respaldo ofrece?:</strong> Registro oficial y verificación Travelgrin.";

      resHtml = [
        priceLine ? `<p>${priceLine}</p>` : "",
        `<p>${hook}</p>`,
        `<p>${icons.lightbulb}<strong>Preguntas y Claves Frecuentes:</strong><br/>${icons.bullet}${b1}<br/>${icons.bullet}${b2}<br/>${icons.bullet}${b3}</p>`,
        `<p>${icons.phone}<strong>Más información:</strong> Atención disponible a través de canales oficiales${locStr}.</p>`,
      ].filter(Boolean).join("\n");
    } else {
      // Layout 7: High-Conversion Benefit Story
      const hook = isEducation
        ? `${icons.sparkles}<strong>Tu futuro profesional empieza hoy:</strong> ${rawValueProp}. Da el paso hacia una formación de calidad que te abrirá puertas en el ámbito nacional e internacional.`
        : `${icons.sparkles}<strong>La decisión acertada para tus proyectos:</strong> ${rawValueProp}. Calidad, respaldo y atención personalizada garantizada.`;

      const b1 = isEducation ? "<strong>Convocatoria activa:</strong> Vacantes disponibles para el próximo ciclo lectivo." : "<strong>Disponibilidad inmediata:</strong> Atención y turnos programados ágiles.";
      const b2 = isEducation ? "<strong>Flexibilidad horaria:</strong> Diseñado para compatibilizar estudio, trabajo y vida personal." : "<strong>Flexibilidad y convenios:</strong> Planes adaptados a tus necesidades.";
      const b3 = isEducation ? "<strong>Red de egresados y convenios:</strong> Oportunidades directas de crecimiento y vinculación." : "<strong>Seguridad y confianza:</strong> Atención humana y profesionalismo constante.";

      resHtml = [
        priceLine ? `<p>${priceLine}</p>` : "",
        `<p>${hook}</p>`,
        `<p>${icons.diamond}<strong>Beneficios destacados:</strong><br/>${icons.bullet}${b1}<br/>${icons.bullet}${b2}<br/>${icons.bullet}${b3}</p>`,
        `<p>${icons.pin}<strong>Sede y contacto:</strong> Información oficial y vías de comunicación abiertas para consultas e informes${locStr}.</p>`,
      ].filter(Boolean).join("\n");
    }

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
      const scoreMatch = blockUserCorpus.match(/\b(9\d|8\d|7\d|100)\b/);
      const scoreNum = scoreMatch ? scoreMatch[1] : "95";
      return {
        title: explicitNewTitle || meta.title || `${omitIcons ? "" : "🛡️ "}Score Scout ${scoreNum}/100`,
        body: `Presencia/reputación 24/25 · Contacto verificable 15/15 · Trayectoria/evidencia operativa 20/20 · Claridad propuesta 15/15 · Transparencia/seguridad 15/15 · Datos Institucionales 10/10\nMadurez: Líder · Vínculo: Oficial · Evidencia: Presencia institucional verificada, canales directos y atención al cliente activa.`,
      };
    }

    if (/faq|pregunt|pregunat|duda|consulta|q&a|cuestion/i.test(blockUserCorpus)) {
      // Determine requested count (e.g. "haz que sean 10 pregunats", "5 preguntas", default 3 or 10 if specified)
      const countMatch = prompt.match(/\b(1\d|[2-9])\b/) || userPrompts.match(/\b(1\d|[2-9])\s*(?:pregunt|pregunat|duda|item|punto)/i);
      const requestedCount = countMatch ? Math.min(Math.max(parseInt(countMatch[1] || countMatch[0], 10), 2), 15) : 3;

      const faqPoolEdu = [
        { q: "¿Cómo realizar la inscripción o reserva de vacante?", a: "A través de nuestros canales oficiales presenciales o vía plataforma web con asesoramiento personalizado y validación de requisitos." },
        { q: "¿Cuáles son los medios de pago y financiación habilitados?", a: "Tarjetas de débito/crédito, transferencias bancarias directas y planes de financiación en cuotas con aranceles preferenciales." },
        { q: "¿Los títulos y programas cuentan con validez oficial?", a: "Sí, todos los planes de estudio y carreras poseen acreditación y reconocimiento oficial ministerial." },
        { q: "¿Se puede cursar de manera 100% online o virtual?", a: "Sí, disponemos de campus virtual activo las 24 horas con clases sincrónicas, asincrónicas y soporte tutorial continuo." },
        { q: "¿Cuáles son los requisitos de ingreso?", a: "Presentación de Documento de Identidad (DNI/Pasaporte), certificado de estudios previos y formulario de admisión completo." },
        { q: "¿Existen programas de becas o convenios de descuento?", a: "Sí, contamos con convenios corporativos e institucionales, y programas de becas al mérito y por pronta matriculación." },
        { q: "¿Cómo se rinden los exámenes finales y parciales?", a: "Los exámenes se coordinan a través de la plataforma académica o en sedes habilitadas según la modalidad del programa." },
        { q: "¿Puedo solicitar equivalencias o reconocimiento de materias?", a: "Sí, podés presentar tu plan de estudios previo para evaluación del comité académico sin cargo inicial." },
        { q: "¿Se realizan prácticas profesionales o pasantías laborales?", a: "Sí, articulamos convenios con empresas y organizaciones líderes para inserción laboral y pasantías rentadas." },
        { q: "¿Cómo me contacto para recibir asesoramiento personalizado?", a: "Podés comunicarte directamente a través de nuestros canales de WhatsApp, formulario web o en nuestras sedes de admisión." },
        { q: "¿Cuándo inician las clases y cursos del ciclo 2026?", a: "Las convocatorias se abren periódicamente con ingresos en el primer y segundo semestre." },
        { q: "¿Qué soporte técnico o tutorial tienen los estudiantes?", a: "Disponés de tutores académicos dedicados y mesa de ayuda técnica 24/7 para resolver cualquier inquietud." },
      ];

      const faqPoolHealth = [
        { q: "¿Cómo solicitar un turno médico o consulta de especialidad?", a: "A través de nuestra plataforma de turnos online 24/7 o mediante la central telefónica y WhatsApp oficial." },
        { q: "¿Qué coberturas médicas, obras sociales y prepagas se aceptan?", a: "Atendemos con las principales obras sociales, prepagas de primer nivel y opciones para pacientes particulares." },
        { q: "¿Cuentan con servicio de guardia médica de urgencias 24 horas?", a: "Sí, disponemos de guardia activa permanente con especialistas en clínica médica, pediatría y emergencias." },
        { q: "¿Cómo recibir los resultados de estudios diagnósticos y análisis?", a: "Podés descargarlos directamente desde el portal web del paciente o recibirlos vía correo electrónico seguro." },
        { q: "¿Se atienden consultas médicas virtuales o por telemedicina?", a: "Sí, ofrecemos servicio de videoconsultas programadas con receta digital oficial." },
        { q: "¿Qué documentación debo presentar en la primera consulta?", a: "DNI vigente, credencial de cobertura médica y orden de derivación médica en caso de corresponder." },
        { q: "¿Se realizan chequeos preventivos integrales?", a: "Sí, disponemos de circuitos de chequeo preventivo en un solo día con informes consolidados." },
        { q: "¿Cuáles son los medios de pago para copagos y consultas particulares?", a: "Tarjetas de débito/crédito, transferencias bancarias y efectivo en recepción." },
        { q: "¿Cuentan con internación y quirófanos de alta complejidad?", a: "Sí, nuestras instalaciones están equipadas con tecnología de vanguardia y unidades de cuidados intensivos." },
        { q: "¿Cómo acceder a la atención domiciliaria o traslados?", a: "Coordinando con la central de emergencias habilitada para afiliados y convenios vigentes." },
      ];

      const faqPoolSports = [
        { q: "¿Cómo asociarse o adquirir un pase de entrenamiento?", a: "Podés inscribirte online o presencialmente en administración con DNI y certificado de aptitud física." },
        { q: "¿Qué actividades y disciplinas deportivas están incluidas?", a: "Gimnasio de musculación, clases grupales guiadas, canchas, pileta y entrenamientos personalizados." },
        { q: "¿Cuáles son los horarios de apertura y entrenamiento?", a: "Lunes a viernes de 07:00 a 22:00 hs y sábados de 08:00 a 18:00 hs." },
        { q: "¿Se requiere apto médico para iniciar actividades?", a: "Sí, es obligatorio presentar certificado médico de aptitud física para garantizar la seguridad de todos los socios." },
        { q: "¿Cuáles son los medios de pago y planes de membresía?", a: "Pases mensuales, semestrales o anuales con débito automático, tarjetas y descuentos por grupo familiar." },
        { q: "¿Tienen vestuarios, lockers y estacionamiento?", a: "Sí, contamos con vestuarios climatizados completos, lockers con seguridad y área de estacionamiento vigilado." },
        { q: "¿Se puede tomar una clase de prueba antes de inscribirse?", a: "Sí, coordinando previamente una clase de cortesía para conocer nuestras instalaciones." },
        { q: "¿Hay profesores o entrenadores disponibles en sala?", a: "Contamos permanentemente con profesores de educación física para guiar tu rutina." },
        { q: "¿Organizan torneos internos y eventos deportivos?", a: "Sí, realizamos ligas internas, clínicas de entrenamiento y competencias recreativas todo el año." },
        { q: "¿Cómo reservar canchas o espacios de entrenamiento?", a: "A través de la aplicación oficial del club o en recepción con confirmación inmediata." },
      ];

      const faqPoolGeneral = [
        { q: "¿Cómo contratar o solicitar información del servicio?", a: "A través de nuestros canales oficiales presenciales o vía plataforma web con asesoramiento personalizado." },
        { q: "¿Cuáles son los medios de pago y facturación habilitados?", a: "Tarjetas de débito/crédito, transferencias bancarias directas y planes de financiación vigentes con factura oficial." },
        { q: "¿Se requiere coordinación o turno previo?", a: "Recomendamos contactar con anticipación para asegurar disponibilidad y atención preferencial." },
        { q: "¿Qué documentación o requisitos son necesarios?", a: "Documento de identidad vigente y datos de contacto oficiales para la formalización del servicio." },
        { q: "¿Ofrecen atención o soporte de manera remota?", a: "Sí, contamos con canales digitales y soporte técnico continuo para resolver todas tus gestiones." },
        { q: "¿Cuál es el tiempo de respuesta o entrega del servicio?", a: "Atendemos las solicitudes de manera prioritaria con tiempos ágiles informados desde el primer contacto." },
        { q: "¿Cuentan con promociones o beneficios exclusivos?", a: "Sí, disponemos de planes especiales por suscripción anticipada y beneficios para clientes frecuentes." },
        { q: "¿Qué garantías y respaldo ofrecen en cada prestación?", a: "Todos nuestros procesos cumplen con estrictos estándares de calidad y respaldo verificado Travelgrin." },
        { q: "¿Cuáles son las políticas de cancelación o reprogramación?", a: "Podés solicitar cambios o cancelaciones con previo aviso según los términos y condiciones del servicio." },
        { q: "¿Dónde se encuentran ubicadas las sedes oficiales?", a: "Podés consultar nuestras direcciones oficiales, teléfonos y horarios de atención en el portal." },
        { q: "¿Tienen atención para empresas o grupos corporativos?", a: "Sí, contamos con un área corporativa dedicada a presupuestos y propuestas a medida." },
        { q: "¿Cómo realizar el seguimiento de una solicitud o reclamo?", a: "Con tu número de gestión asignado podés consultar el estado en tiempo real por nuestros canales directos." },
      ];

      const selectedPool = isEduEntity || isEducation ? faqPoolEdu
        : isHealthEntity || isHealth ? faqPoolHealth
        : isSportsEntity || isSports ? faqPoolSports
        : faqPoolGeneral;

      const itemsToTake = selectedPool.slice(0, requestedCount);
      const bodyHtml = itemsToTake
        .map((item) => `<p><strong>${item.q}</strong><br/>${item.a}</p>`)
        .join("");

      const blockTitle = explicitNewTitle || (meta.title && /faq|pregunt/i.test(meta.title) ? meta.title : "Preguntas Frecuentes (FAQ)");

      return {
        title: blockTitle,
        body: bodyHtml,
      };
    }

    // 1. Cómo trabajan / Metodología / Procedimientos / Procesos
    if (/c[oó]mo\s+trabajan|c[oó]mo\s+funciona|metodolog|procedimiento|proceso|modalidad\s+de\s+trabajo|forma\s+de\s+trabajo|c[oó]mo\s+se\s+atiende|pasos|protocolo/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Metodología y Proceso de Trabajo";
      const bodyHtml = isHealthEntity || isHealth ? [
        "<p><strong>1. Admisión y Evaluación Inicial:</strong> Recepción del paciente, registro administrativo y categorización médica según el nivel de complejidad o urgencia.</p>",
        "<p><strong>2. Diagnóstico y Plan Terapéutico:</strong> Realización de estudios de alta complejidad y diseño de tratamientos interdisciplinarios a cargo de especialistas referentes.</p>",
        "<p><strong>3. Seguimiento y Atención Continua:</strong> Monitoreo constante de la evolución médica, asignación de turnos de control y comunicación fluida con el paciente y su familia.</p>",
        "<p><strong>Canales habilitados:</strong> Asistencia permanente y coordinación de consultas a través de nuestros canales oficiales.</p>"
      ].join("") : isEduEntity || isEducation ? [
        "<p><strong>1. Asesoramiento Vocacional y Admisión:</strong> Orientación personalizada para la elección del programa académico y gestión de la matrícula oficial.</p>",
        "<p><strong>2. Cursado y Prácticas Profesionales:</strong> Clases dinámicas con docentes referentes, proyectos reales y acceso continuo al campus digital 24/7.</p>",
        "<p><strong>3. Evaluación y Titulación:</strong> Exámenes programados, tutorías continuas y tramitación oficial de diplomas de validez nacional.</p>",
        "<p><strong>Canales habilitados:</strong> Soporte académico y mesa de ayuda permanente en canales oficiales.</p>"
      ] : isSportsEntity || isSports ? [
        "<p><strong>1. Evaluación Física y Registro:</strong> Apto médico, entrevista de objetivos y diseño de rutina de entrenamiento personalizada.</p>",
        "<p><strong>2. Entrenamientos y Clases Guiadas:</strong> Uso de instalaciones modernas, acompañamiento de profesores certificados y variedad de actividades grupales.</p>",
        "<p><strong>3. Monitoreo de Progreso y Membresías:</strong> Evaluaciones periódicas de rendimiento y gestión de pases flexibles.</p>",
        "<p><strong>Canales habilitados:</strong> Recepción y app del club activas para reservas y consultas.</p>"
      ] : [
        "<p><strong>1. Diagnóstico y Asesoramiento Inicial:</strong> Relevamiento exhaustivo de requerimientos y elaboración de presupuestos transparentes a medida.</p>",
        "<p><strong>2. Ejecución y Control de Calidad:</strong> Prestación del servicio bajo rigurosos estándares técnicos y profesionales certificados.</p>",
        "<p><strong>3. Soporte y Entrega:</strong> Cumplimiento estricto de plazos acordados y garantía de satisfacción continua.</p>",
        "<p><strong>Canales habilitados:</strong> Atención directa y seguimiento personalizado a través de vías oficiales.</p>"
      ].join("");

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
        body: "<p><strong>Cuerpo de profesionales certificados:</strong> Contamos con un equipo interdisciplinario de amplia trayectoria, sólida formación y estricto compromiso ético.</p><p><strong>Atención humana y personalizada:</strong> Cada servicio es abordado con rigor técnico y calidez humana adaptada a las necesidades de cada usuario.</p><p><strong>Actualización constante:</strong> Capacitación y formación continua en las últimas tecnologías e innovaciones del sector.</p><p><strong>Consultas:</strong> Consultá la nómina de profesionales e informes en nuestros canales oficiales habilitados.</p>",
      };
    }

    // 3. Coberturas / Obras Sociales / Prepagas / Seguros / Convenios
    if (/cobertura|obra\s+social|prepaga|seguro|convenio|afiliad/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Coberturas y Obras Sociales Habilitadas";
      return {
        title: blockTitle,
        body: "<p><strong>Convenios institucionales:</strong> Atención integral a través de las principales obras sociales, prepagas y convenios corporativos vigentes.</p><p><strong>Planes particulares y reintegros:</strong> Aranceles preferenciales para consultas particulares con emisión de facturación oficial para reintegros.</p><p><strong>Gestión administrativa ágil:</strong> Asesoramiento previo para autorizaciones y verificación de cobertura en tiempo real.</p><p><strong>Consultas de padrón:</strong> Podés verificar tu cobertura comunicándote con nuestros canales de admisión habilitados.</p>",
      };
    }

    // 4. Turnos / Consultas / Reservas
    if (/turno|consulta|reserva|solicitar\s+atenci|pedir\s+turno/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Gestión de Turnos y Consultas";
      return {
        title: blockTitle,
        body: "<p><strong>Plataforma online 24/7:</strong> Gestión inmediata de turnos y reservas a través de nuestra web oficial o WhatsApp institucional.</p><p><strong>Atención presencial y telefónica:</strong> Recepción y orientación personalizada de lunes a viernes en horario corrido.</p><p><strong>Reprogramación ágil:</strong> Sistema de avisos automáticos y facilidad para confirmar, cancelar o reprogramar citas.</p><p><strong>Canales oficiales:</strong> Comunicate directamente con nuestra central de atención para asegurar tu disponibilidad.</p>",
      };
    }

    if (/requisito|admisi|inscrip|document/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Requisitos de Admisión e Inscripción";
      return {
        title: blockTitle,
        body: "<p><strong>Documentación requerida:</strong> Documento de identidad vigente (DNI o Pasaporte), comprobante de domicilio y antecedentes pertinentes según la actividad.</p><p><strong>Modalidad de presentación:</strong> Gestión presencial en sede oficial o carga digital a través de la plataforma web habilitada.</p><p><strong>Validación y plazos:</strong> Proceso de verificación ágil en 24 a 48 hs hábiles con confirmación por canales oficiales.</p>",
      };
    }

    if (/pago|financi|cuota|tarifa|precio/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Medios de Pago y Financiación";
      return {
        title: blockTitle,
        body: "<p><strong>Opciones disponibles:</strong> Transferencia bancaria, tarjetas de débito/crédito y planes de pago en cuotas según convenios vigentes.</p><p><strong>Beneficios:</strong> Bonificaciones por pago anticipado y convenios institucionales aplicables.</p><p><strong>Facturación:</strong> Emisión automática de comprobantes oficiales y recibos electrónicos de pago.</p>",
      };
    }

    if (/especialidad|servicio|prestacion|prestación|cobertura/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Especialidades y Servicios Destacados";
      return {
        title: blockTitle,
        body: "<p><strong>Áreas de atención:</strong> Consultoría especializada, atención programada y soporte integral continuo.</p><p><strong>Metodología de trabajo:</strong> Enfoque multidisciplinario con tecnología de vanguardia y profesionales de amplia trayectoria.</p><p><strong>Cobertura:</strong> Servicios disponibles tanto en sede central como mediante canales digitales habilitados.</p>",
      };
    }

    if (/horario|guardia|atenci[oó]n|dias?|días?/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Horarios y Canales de Atención";
      return {
        title: blockTitle,
        body: "<p><strong>Atención presencial:</strong> Lunes a Viernes de 08:00 a 20:00 hs / Sábados de 09:00 a 13:00 hs.</p><p><strong>Canales digitales y guardias:</strong> Asistencia y recepción de consultas a través de canales oficiales 24/7.</p>",
      };
    }

    if (/instalacion|instalación|sede|equipamiento|infraestructura|tecnolog/i.test(blockUserCorpus)) {
      const blockTitle = explicitNewTitle || "Instalaciones y Equipamiento de Vanguardia";
      return {
        title: blockTitle,
        body: "<p><strong>Infraestructura moderna:</strong> Espacios climatizados, áreas adaptadas y equipamiento de última generación.</p><p><strong>Seguridad y confort:</strong> Instalaciones diseñadas bajo rigurosos estándares de seguridad, bioseguridad y comodidad.</p><p><strong>Capacidad operativa:</strong> Áreas especializadas preparadas para resolver requerimientos de diversas complejidades.</p>",
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

    // Build rich, structured body using investigated web facts or smart sector template
    const webSnippet = investigatedWeb?.description || investigatedWeb?.snippet || "";
    const cleanTopicDesc = prompt.replace(/^(?:creame|crear|armar|generar|hacer|pone|escribe)\s+(?:un\s+bloque\s+de\s+|un\s+bloque\s+|bloque\s+de\s+|bloque\s+)?/i, "");

    const richCustomBody = [
      `<p><strong>Alcance y propuesta:</strong> ${webSnippet ? webSnippet.slice(0, 200) + "." : `Servicios y prestaciones de excelencia con sólida trayectoria y respaldo institucional verificado.`}</p>`,
      `<p><strong>Aspectos destacados:</strong> Procesos certificados, atención a cargo de personal idóneo y cumplimiento de los más rigurosos estándares de calidad.</p>`,
      `<p><strong>Canales y coordinación:</strong> Asesoramiento personalizado disponible a través de nuestras vías oficiales de comunicación.</p>`
    ].join("");

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
      investigatedWeb
    );

    let aiResult: any = null;

    // 1. Try Gemini Live API with high creative capability
    if (geminiKey) {
      aiResult = await callGeminiApi(geminiKey, systemPrompt, prompt, fieldType);
    }

    // 2. Try OpenAI API if Gemini was not configured or did not return
    if (!aiResult && openaiKey) {
      aiResult = await callOpenAiApi(openaiKey, systemPrompt, prompt);
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
