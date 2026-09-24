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
Comprender a la perfección lo que el usuario pide en su instrucción y generar la MEJOR propuesta posible (con impacto, elegancia, persuasión y excelente SEO).
- Si hay información investigada de la web o un texto previo de scraping en "TEXTO BASE ACTUAL", UTILÍZALA como fuente de la verdad para describir con precisión qué es el lugar/negocio, qué ofrece, qué servicios o carreras tiene y cuáles son sus diferenciales.
- Si el administrador te da indicaciones desde cero (ej: "Gimnasio SportClub en Belgrano..." o "Haceme una propuesta atractiva para esta clínica"), redacta una descripción completa y persuasiva basada en sus requerimientos.

⚠️ REGLAS MANDATORIAS DE PRIORIDAD MÁXIMA (NEGACIONES Y RESTRICCIONES):
1. RESPETO ABSOLUTO A INSTRUCCIONES NEGATIVAS:
   - Si el administrador te pide NO colocar, NO mencionar, omitir, sacar o excluir alguna palabra, nombre, marca o entidad (ejemplo: "no coloques ni menciones siglo 21", "sin el nombre", "sacale X"):
     ¡TIENES PROHIBIDO ABSOLUTAMENTE INCLUIR ESA PALABRA O NOMBRE EN TU RESPUESTA!
   - Si pide no mencionar la marca/nombre, genera un título o texto enfocado en el beneficio, la llamada a la acción, las ventajas y el SEO sin nombrar jamás dicha marca o entidad.

2. MANEJO DE PRECIOS Y VIGENCIAS (EN DESCRIPCIÓN):
   - Si el administrador pide QUITAR o NO INCLUIR precios/vigencias ("quitar precios", "sin precio", "sacale precios", "no pongas precio ni vigencia", "poner que es gratis"):
     ¡OMITE POR COMPLETO <strong>Precio:</strong> Y/O <strong>Vigencia:</strong>! Si además pide indicar que es gratis, coloca "<strong>Precio:</strong> Actividad 100% gratuita / Acceso libre".
   - Si el administrador pide COLOCAR o INCLUIR precios/vigencias ("coloca precios", "agrega vigencia", "con aranceles", "con precios"):
     ¡INCLÚYELOS de manera clara y destacada! Formato: <strong>Vigencia:</strong> ... <strong>Precio:</strong> ...
   - Si el administrador NO especifica sobre precios y pide una descripción atractiva, persuasiva, con iconos y buen SEO:
     Crea una descripción magnética estructurada en párrafos con negritas y emojis que describa qué es, qué hace, propuesta de valor, diferenciales y puntos clave, incluyendo los datos prácticos de referencia.

3. REGLAS PARA DESCRIPCIÓN (fieldType === "description"):
   - Tienes LIBERTAD TOTAL para crear la estructura HTML que mejor comunique y venda la propuesta.
   - Utiliza formato HTML limpio (<p>, <strong>, <em>, <ul><li>, etc.) y emojis modernos y llamativos (💡, 🚀, 🎯, 🏆, 💎, 📅, 📍, 📞, ⚖️, 🩺, 🛡️, ✨, 🌟, ⏱️, 👥, 🍣, 🎓, 🏠, etc.).
   - Resalta con claridad:
     1) QUÉ ES y QUÉ HACE (propuesta de valor atractiva y persuasiva con alto impacto SEO).
     2) SERVICIOS / CARRERAS / ESPECIALIDADES / BENEFICIOS destacados basados en la web o en lo que pidió el admin.
     3) DIFERENCIALES y PÚBLICO OBJETIVO (¿Por qué elegirlo? ¿Para quién es?).
     4) DATOS PRÁCTICOS (Vigencia, Precios/Aranceles si corresponden, Requisitos, etc.).

4. REGLAS PARA TÍTULOS (fieldType === "title"):
   - Sé persuasivo, llamativo, comercial y con alto impacto SEO respetando cualquier restricción negativa.

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
TEXTO BASE ACTUAL (SI VIENE DE SCRAPING O EDICIÓN PREVIA):
"""
${currentText || "(campo actualmente vacío o nuevo)"}
"""

INSTRUCCIÓN DEL ADMINISTRADOR:
"""
${prompt}
"""

FORMATO DE SALIDA (SOLAMENTE OBJETO JSON VÁLIDO):
- Si fieldType === "title": {"title": "Propuesta de título optimizada respetando estrictamente todas las restricciones del usuario"}
- Si fieldType === "description": {"description": "HTML con los párrafos formateados respetando todas las restricciones y pedidos del usuario"}
- Si fieldType === "provider_info": {"providerInfo": "Texto de síntesis institucional de alto nivel"}
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
    if (target.length >= 2 && !/^(?:nombre|marca|nada|eso|esto|titulo|título|descripcion|descripción)$/i.test(target)) {
      forbidden.add(target);
      target.split(/\s+/).forEach((w) => { if (w.length > 2) forbidden.add(w); });
    }
  }

  if (cleanName && lower.includes(cleanName.toLowerCase())) {
    if (/(?:no\s+(?:coloques?|menciones?|pongas?|uses?|incluyas?|digas?)|sin|omit|sacale|sacar|quita)/i.test(lower)) {
      forbidden.add(cleanName.toLowerCase());
      cleanName.split(/\s+/).forEach((w) => { if (w.length > 2) forbidden.add(w.toLowerCase()); });
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
    // Attempt 1: systemInstruction + user content with responseMimeType
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
          return parsed;
        }
      } else {
        const errText = await resp.text().catch(() => "");
        console.error(`Gemini API Error (${model}) [${resp.status}]:`, errText);
      }
    } catch (e: any) {
      console.error(`Gemini fetch error (${model}):`, e?.message);
    }

    // Attempt 2: contents with combined prompt
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
          return parsed;
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
  userMessage: string
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
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

// Intelligent Semantic NLP Generator for instant local generation & fallback
function generateSemanticAiFallback(
  fieldType: FieldType,
  currentText: string,
  prompt: string,
  meta: { title?: string; publisherName?: string; category?: string; city?: string; country?: string; url?: string },
  conversationHistory: ConversationMessage[] = [],
  variationIndex: number = 0,
  investigatedWeb?: InvestigatedWebInfo | null
): any {
  // ONLY look at USER prompts, never assistant responses
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
  const entityCorpus = `${pubLower} ${titleLower} ${catLower} ${meta.url || ""} ${investigatedWeb?.description || ""} ${investigatedWeb?.headings?.join(" ") || ""}`.toLowerCase();

  // 1. Explicit domain indicators from context (Category, Title, Publisher, URL)
  const isEduEntity = /\b(universidad|facultad|instituto|colegio|educaci[oó]n|acad[eé]m|posgrado|grado|m[aá]ster|licenciatura|terciario|carrera|estudio universitario)\b/i.test(entityCorpus);
  const isHealthEntity = /\b(salud|m[eé]dic|cl[ií]nic|hospital|guardia|odont|psic|obra social|prepaga|sanatorio|farmac|terapia)\b/i.test(entityCorpus);
  const isSportsEntity = /\b(deport|club|gym|gimnasio|futbol|fútbol|rugby|tenis|p[aá]del|nataci|entrenam|fitness|b[aá]squet|atlet)\b/i.test(entityCorpus);
  const isFoodEntity = /\b(gastronom|restauran|bar\b|caf[eé]|comida|parrilla|bistr[oó]|cena|almuerzo|degustac|sushi|buffet)\b/i.test(entityCorpus);
  const isRealEstateEntity = /\b(inmobiliar|propiedad|bienes ra[ií]ces|alquiler|tasaci|lote|terreno|departamento|casa en venta)\b/i.test(entityCorpus);
  const isTourismEntity = /\b(turism|viaje|hotel|alojam|excursi|vuelo|hostel|tour|hospedaje|posada|cabaña|resort)\b/i.test(entityCorpus);
  const isJudicialEntity = /\b(judicial|abogad|estudio jur[ií]dic|leyes|derecho|notar|escriban|litigio|defensa penal)\b/i.test(entityCorpus) && !isEduEntity;

  // 2. Explicit prompt overrides (User is typing from scratch about a specific topic)
  const promptHasTorneo = /\b(torneo|campeonato|copa|fixture|f[uú]tbol|p[aá]del)\b/i.test(userPrompts);
  const promptHasGastro = /\b(buffet|sushi|tenedor libre|restaurante|degustaci[oó]n|cena show)\b/i.test(userPrompts);
  const promptHasCourse = /\b(curso\b|masterclass|taller\b|workshop|capacitaci[oó]n)\b/i.test(userPrompts);
  const promptHasLegal = /\b(abogad[oa]s?|estudio jur[ií]dico|divorcio|sucesi[oó]n|notar[ií]a|escriban[ií]a|defensa penal)\b/i.test(userPrompts);
  const promptHasHealth = /\b(guardia m[eé]dica|consultorio m[eé]dico|odontol|cl[ií]nica|hospital)\b/i.test(userPrompts);
  const promptHasEdu = /\b(universidad|facultad|carreras? de grado|posgrado|instituto superior|colegio)\b/i.test(userPrompts);

  // Resolved Sector:
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

  // Comprehensive Negative Constraint Check across all user turns and Spanish variations
  const hasNegativeConstraint =
    /(?:no\s+(?:hace falta|coloques?|menciones?|pongas?|uses?|incluyas?|digas?|nombres?|aparezca|tenga|poner|mencionar|colocar)|sin\s+|omit[a-z]*|sacale|sacar|quitar?|elimina[a-z]*|evita[a-z]*)/i.test(
      userPrompts
    );

  if (fieldType === "title") {
    // 1. Short / Direct / Name only / Concise
    if (/corto|breve|directo|solo nombre|s[ií]ntesis|concis/i.test(pLower)) {
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

    // 2. High Impact / Attention-grabbing / Trabajado / Potente / Llamativo / Mejor / SEO
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

    // 3. Direct Invitation / Call to action (veni a la mejor..., contrata..., inscribite...)
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

    // 4. Commercial / Attractive / Slogan / Futuro
    if (/atractiv|comercial|vent|promo|publicit|futuro/i.test(pLower)) {
      if (hasNegativeConstraint) {
        if (isEducation) {
          const v = [
            "Tu Futuro Profesional Comienza Hoy: Carreras de Grado y Posgrados Oficiales",
            "Formación de Vanguardia y Alta Salida Laboral: Inscripciones Abiertas",
          ];
          return { title: v[variationIndex % v.length] };
        }
        return { title: "Calidad Garantizada, Trayectoria y Beneficios Exclusivos" };
      }
      if (isEducation) {
        return { title: `Estudiá en ${cleanName} | Tu Futuro Profesional Comienza Hoy` };
      }
      return { title: `${cleanName} | Calidad Garantizada y Beneficios Exclusivos` };
    }

    // 5. Careers / Programs / Degrees / Scholarships / Online
    if (/carrera|grado|posgrado|master|curso|beca|inscrip|online|virtual|distancia/i.test(pLower)) {
      if (hasNegativeConstraint) {
        if (isEducation) {
          const v = [
            "Carreras de Grado, Posgrados Oficiales y Becas Universitarias",
            "Carreras Universitarias 100% Online: Cursado Flexible y Títulos Oficiales",
            "Carreras Oficiales de Vanguardia: Inscripciones Abiertas y Planes de Beca",
          ];
          return { title: v[variationIndex % v.length] };
        }
      }
      return { title: `${cleanName} | Carreras de Grado, Posgrados e Inscripciones Abiertas` };
    }

    // 6. Emergency / Health / Guardias
    if (/guardia|turno|consulta|especialidad/i.test(pLower)) {
      if (hasNegativeConstraint) {
        return { title: "Guardia Médica Activa 24hs y Asignación de Turnos Online" };
      }
      return { title: `${cleanName} | Guardia Médica 24hs y Turnos Online` };
    }

    // 7. General pool fallback
    if (hasNegativeConstraint) {
      if (isEducation) {
        const v = [
          "¡Vení a la Mejor Universidad! Carreras Oficiales y Modalidades Flexibles",
          "Liderá tu Futuro: Formación Universitaria y Carreras de Vanguardia",
          "Carreras de Grado, Posgrados Oficiales y Becas Universitarias",
          "Educación Superior de Excelencia: Inscripciones Abiertas y Salida Laboral",
          "Tu Futuro Profesional Comienza Hoy: Títulos Oficiales y Prácticas",
          "¡Inscribite Hoy! Carreras Universitarias Oficiales y Modalidad Flexible",
        ];
        return { title: v[variationIndex % v.length] };
      }
      if (isJudicial) {
        const v = [
          "Asesoramiento Legal de Excelencia: Soluciones Jurídicas Integrales",
          "Defensa y Representación Jurídica: Turnos y Consultas Especializadas",
          "¡Protegé tus Derechos! Asesoramiento Jurídico y Notarial de Vanguardia",
        ];
        return { title: v[variationIndex % v.length] };
      }
      if (isSports) {
        const v = [
          "¡Entrená al Máximo Nivel! Actividades Deportivas y Pases Mensuales",
          "Centro Deportivo de Alto Rendimiento: Instalaciones y Membresías",
          "¡Sumate al Deporte! Clases, Torneos y Espacios de Entrenamiento",
        ];
        return { title: v[variationIndex % v.length] };
      }
      if (isHealth) {
        const v = [
          `¡Contratá la Mejor Cobertura Médica en ${cityStr || 'tu ciudad'}!`,
          "Atención Médica de Excelencia: Guardia 24hs y Especialidades",
          "Planes de Salud Integrales: Cobertura Médica y Turnos Online",
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
    const isShort = /corto|breve|directo|resum|s[ií]ntesis|concis|bullet/i.test(userPrompts);
    const isFormal = /formal|institucional|seri[oa]|protocolar/i.test(userPrompts);
    const isPersuasive = /persuasiv|trabajad|atractiv|mejor.*descr|vende|copy|impact|llamativ|ganch|seduc|destac|icono|icon/i.test(userPrompts);

    const explicitlyWantsPrice = /(?:coloc|agreg|pon|inclu|mostr|dej|con)\w*\s+(?:el\s+)?(?:precio|arancel|tarifa|costo|cuota)/i.test(userPrompts);
    const explicitlyWantsVigencia = /(?:coloc|agreg|pon|inclu|mostr|dej|con)\w*\s+(?:la\s+)?(?:vigencia|validez)/i.test(userPrompts);

    const omitPrice = !isFree && /quit.*precio|sin.*precio|sac.*precio|no.*precio|ocult.*precio|omit.*precio|elimina.*precio|no hace falta.*precio|sacale.*precio/i.test(userPrompts);
    const omitVigencia = /quit.*vigencia|sin.*vigencia|sac.*vigencia|no.*vigencia|omit.*vigencia|sacale.*vigencia/i.test(userPrompts);
    const omitExclusiones = /quit.*exclusi|sin.*exclusi|sac.*exclusi|no.*exclusi|sin.*advertencia/i.test(userPrompts);
    const omitDiferencial = /quit.*diferencial|sin.*diferencial|sac.*diferencial/i.test(userPrompts);

    const hasScholarships = /beca|descuent|promoci|financi|bonific|cuota|arancel/i.test(userPrompts);
    const isVirtual = /virtual|online|distancia|remot|modalidad/i.test(userPrompts);
    const hasEmergency = /emergencia|guardia|24\/7|24hs|urgencia/i.test(userPrompts);
    const locStr = cityStr ? ` en ${cityStr}` : "";

    // Specific Formal Institutional Overrides by Domain
    if (isFormal && isEducation) {
      const pFormalEdu = [
        `<p>🏛️ <strong>Formación Académica e Institucional:</strong> ${facts.valueProp || `Institución universitaria de excelencia, comprometida con la formación pedagógica y el desarrollo profesional continuo${locStr}.`}</p>`,
        `<p>🎓 <strong>Oferta Académica & Títulos Oficiales:</strong> Carreras de grado, posgrados y diplomaturas con planes de estudio acreditados por organismos oficiales.</p>`,
        `<p>⭐ <strong>Respaldo Institucional:</strong> ${facts.diff || `Claustro docente de destacada trayectoria, vinculación institucional y campus tecnológico adaptado a las demandas actuales.`}</p>`,
        !omitPrice ? `<p><strong>Aranceles & Becas:</strong> ${facts.price || "Información arancelaria institucional y programas de becas académicas al mérito."}</p>` : "",
        !omitExclusiones ? `<p>⚠️ <strong>Exclusiones:</strong> ${facts.excl || "Consultar cupos por cohorte y requisitos de ingreso en canales oficiales."}</p>` : "",
        `<p>📍 <strong>Información & Admisión:</strong> Canales oficiales habilitados para consultas de planes de estudio y proceso de admisión.</p>`,
      ].filter(Boolean).join("\n");
      return { description: pFormalEdu };
    }

    if (isFormal && isHealth) {
      const pFormalHealth = [
        `<p>🏥 <strong>Atención Médica Institucional:</strong> ${facts.valueProp || `Centro de salud de referencia dedicado a la prevención, diagnóstico y tratamiento médico con los más altos estándares clínicos${locStr}.`}</p>`,
        `<p>🩺 <strong>Cuerpo Médico & Especialidades:</strong> Equipo multidisciplinario de profesionales especialistas y tecnología diagnóstica de última generación.</p>`,
        `<p>⭐ <strong>Calidad & Seguridad:</strong> ${facts.diff || `Protocolos asistenciales certificados, guardia médica activa y atención humana personalizada.`}</p>`,
        !omitPrice ? `<p><strong>Cobertura:</strong> ${facts.price || "Convenios con obras sociales, prepagas y aranceles particulares."}</p>` : "",
        `<p>📍 <strong>Turnos & Consultas:</strong> Canales oficiales para asignación de turnos programados e información asistencial.</p>`,
      ].filter(Boolean).join("\n");
      return { description: pFormalHealth };
    }

    if (isFormal && isJudicial) {
      const pFormalJud = [
        `<p>⚖️ <strong>Servicios Jurídicos Institucionales:</strong> ${facts.valueProp || `Estudio profesional especializado en asesoramiento legal integral, consultoría corporativa y representación procesal${locStr}.`}</p>`,
        `<p>📜 <strong>Rigor Técnico & Estrategia:</strong> Gestión de procesos judiciales y extrajudiciales bajo estrictos principios de ética, confidencialidad y solvencia jurídica.</p>`,
        `<p>⭐ <strong>Trayectoria & Respaldo:</strong> ${facts.diff || `Sólida experiencia en la defensa de derechos e intereses de particulares, empresas y organizaciones.`}</p>`,
        !omitPrice ? `<p><strong>Honorarios:</strong> ${facts.price || "Determinados con transparencia conforme a la ley arancelaria y convenios particulares."}</p>` : "",
        `<p>📞 <strong>Entrevistas & Consultas:</strong> Canales oficiales para coordinar entrevistas y evaluación preliminar de casos.</p>`,
      ].filter(Boolean).join("\n");
      return { description: pFormalJud };
    }

    // 1. Custom creation from scratch: Tournaments & Sporting Events
    if (promptHasTorneo) {
      const pTourney = [
        `<p>🏆 <strong>Torneo & Competencia:</strong> ¡Sumate al torneo más emocionante${locStr}! Categorías abiertas y competitivas con arbitraje federado y organización profesional.</p>`,
        `<p>📅 <strong>Cronograma & Modalidad:</strong> Fase de grupos, eliminación directa y gran final con cobertura fotográfica y premiación en vivo.</p>`,
        `<p>💎 <strong>Premios & Reconocimientos:</strong> Premios en efectivo para el podio, trofeos de campeón y subcampeón, hidratación y distinciones individuales.</p>`,
        !omitPrice ? `<p><strong>Inscripción:</strong> ${isFree ? "Actividad gratuita / Libre acceso." : "A consultar según categoría y conformación del equipo."}</p>` : "",
        !omitExclusiones ? `<p>⚠️ <strong>Exclusiones:</strong> Cupos limitados por orden de registro. Presentación de apto físico y lista de buena fe obligatoria.</p>` : "",
      ].filter(Boolean).join("\n");
      return { description: pTourney };
    }

    // 2. Custom creation from scratch: Gastronomy, Buffet, Sushi, Tasting
    if (promptHasGastro) {
      const pGastro = [
        `<p>🍣 <strong>Experiencia Gastronómica:</strong> Disfrutá de una propuesta culinaria de autor${locStr}, combinando materias primas frescas y sabores únicos.</p>`,
        `<p>✨ <strong>Menú & Variedades:</strong> Entradas gourmet, piezas selectas de sushi, opciones artesanales y destacada carta de vinos y coctelería.</p>`,
        `<p>⭐ <strong>Ambiente & Diferencial:</strong> Espacio climatizado, atención esmerada y atmósfera ideal para celebraciones, parejas y encuentros de amigos.</p>`,
        !omitPrice ? `<p><strong>Precio:</strong> ${isFree ? "Acceso libre." : "A consultar según menú o servicio elegido."}</p>` : "",
        `<p>📍 <strong>Reservas:</strong> Se sugiere reserva previa a través de canales oficiales para garantizar la mejor ubicación.</p>`,
      ].filter(Boolean).join("\n");
      return { description: pGastro };
    }

    // 3. Custom creation from scratch: Course, Workshop, Masterclass
    if (promptHasCourse) {
      const pCourse = [
        `<p>🎓 <strong>Capacitación Profesional:</strong> Formación intensiva diseñada para adquirir herramientas prácticas de alta demanda${locStr}.</p>`,
        `<p>💡 <strong>Contenidos & Metodología:</strong> Clases dinámicas, proyectos reales, material descargable y tutoría personalizada durante todo el cursado.</p>`,
        `<p>⭐ <strong>Certificación:</strong> Diploma de finalización con aval institucional para enriquecer tu perfil y trayectoria profesional.</p>`,
        !omitPrice ? `<p><strong>Aranceles:</strong> ${isFree ? "Curso 100% gratuito." : hasScholarships ? "Planes de pago en cuotas y becas al mérito." : "A consultar según modalidad elegida."}</p>` : "",
        !omitExclusiones ? `<p>⚠️ <strong>Exclusiones:</strong> Cupos reducidos por grupo para garantizar un seguimiento personalizado.</p>` : "",
      ].filter(Boolean).join("\n");
      return { description: pCourse };
    }

    // 4. Custom creation from scratch: Specific Legal Services
    if (promptHasLegal) {
      const pLegalSpec = [
        `<p>⚖️ <strong>Asesoramiento Jurídico Especializado:</strong> Soluciones legales estratégicas con sólida trayectoria, atención personalizada y estricta confidencialidad${locStr}.</p>`,
        `<p>💡 <strong>Áreas de Actuación:</strong> Gestión de acuerdos, trámites sucesorios, resolución de conflictos y representación procesal directa.</p>`,
        `<p>⭐ <strong>Compromiso & Respaldo:</strong> Diagnóstico claro desde la primera consulta, transparencia en honorarios y defensa rigurosa de tus derechos.</p>`,
        !omitPrice ? `<p><strong>Honorarios:</strong> ${isFree ? "Primera consulta informativa sin cargo." : "Regidos por ley arancelaria y convenios particulares."}</p>` : "",
        `<p>📞 <strong>Consultas & Turnos:</strong> Coordinación de entrevistas presenciales o virtuales a través de nuestros canales oficiales.</p>`,
      ].filter(Boolean).join("\n");
      return { description: pLegalSpec };
    }

    // 5. Short / Bullet style requested
    if (isShort) {
      const vpShort = facts.valueProp || investigatedWeb?.description || (publisherName ? `Servicios de vanguardia y atención especializada con ${publisherName}${locStr}.` : `Propuesta integral de excelencia y atención profesional${locStr}.`);
      let p1Short = "";
      if (!omitVigencia) p1Short += `<strong>Vigencia:</strong> ${facts.vigencia || "Activo; información verificada en canales oficiales."} `;
      if (!omitPrice) {
        p1Short += isFree ? "<strong>Precio:</strong> Actividad 100% gratuita." : `<strong>Precio:</strong> ${facts.price || "A consultar según modalidad."}`;
      }
      p1Short = p1Short.trim();

      const pShort = [
        p1Short ? `<p>${p1Short}</p>` : "",
        `<p>🎯 <strong>Puntos Clave:</strong> ${vpShort}</p>`,
        `<p>💡 <strong>Servicios & Beneficios:</strong> Asesoramiento personalizado, canales directos y gestión ágil.</p>`,
        `<p>👥 <strong>Público:</strong> ${facts.who || "Personas y profesionales que buscan servicios oficiales garantizados."}</p>`,
      ].filter(Boolean).join("\n");
      return { description: pShort };
    }

    // 6. Standard & Persuasive Generator using real scraped facts / investigated web data
    let p1Content = "";
    if (!omitVigencia) {
      p1Content += `<strong>Vigencia:</strong> ${facts.vigencia || "Activo; información verificada en canales oficiales."} `;
    }
    if (!omitPrice) {
      if (isFree) {
        p1Content += "<strong>Precio:</strong> Actividad 100% gratuita / Acceso libre sin costo.";
      } else if (hasScholarships) {
        p1Content += "<strong>Precio:</strong> Planes con becas arancelarias y facilidades de pago.";
      } else if (facts.price) {
        p1Content += `<strong>Precio:</strong> ${facts.price}`;
      } else {
        p1Content += "<strong>Precio:</strong> A consultar / Según aranceles o tarifas del oferente.";
      }
    }
    p1Content = p1Content.trim();
    const p1 = p1Content ? `<p>${p1Content}</p>` : "";

    // Dynamic Paragraph 2: Sector-tailored value proposition + scraped facts integration
    let valueProp = facts.valueProp;

    if (!valueProp) {
      if (investigatedWeb?.description) {
        valueProp = investigatedWeb.description;
      } else if (investigatedWeb?.snippet) {
        valueProp = investigatedWeb.snippet.slice(0, 240);
      } else if (isEducation) {
        const vEdu = [
          `Formación académica de alto nivel con programas adaptados a la demanda profesional y laboral${locStr}.`,
          `Una propuesta educativa de vanguardia enfocada en el desarrollo de competencias, liderazgo e innovación académica${locStr}.`,
          `Educación superior de excelencia con claustro docente destacado, vinculación con el sector productivo y amplia inserción profesional${locStr}.`,
        ];
        valueProp = vEdu[variationIndex % vEdu.length];
      } else if (isJudicial) {
        const vJud = [
          `Asesoramiento y representación jurídica especializada con enfoque estratégico, confidencialidad y sólida experiencia procesal${locStr}.`,
          `Defensa integral de derechos con soluciones legales ágiles y personalizadas para personas, profesionales y empresas${locStr}.`,
          `Servicios jurídicos y notariales de excelencia, basados en la rigurosidad técnica, ética y compromiso con los intereses de cada cliente${locStr}.`,
        ];
        valueProp = vJud[variationIndex % vJud.length];
      } else if (isSports) {
        const vSpo = [
          `Instalaciones deportivas de primer nivel, actividades supervisadas por profesionales certificados y programas adaptados${locStr}.`,
          `Un centro deportivo integral para potenciar el rendimiento físico, la salud y el bienestar en un ambiente activo y moderno${locStr}.`,
          `Práctica deportiva, entrenamiento funcional y actividades recreativas con infraestructura de última generación${locStr}.`,
        ];
        valueProp = vSpo[variationIndex % vSpo.length];
      } else if (isHealth) {
        const vHea = [
          `Atención médica especializada con tecnología avanzada, consultorios modernos y un equipo médico de excelencia${locStr}.`,
          `Cobertura y asistencia en salud integral, orientada a la prevención, diagnóstico oportuno y cuidado humano personalizado${locStr}.`,
          `Centro de salud de referencia con atención multidisciplinaria, turnos ágiles y los más altos estándares de calidad médica${locStr}.`,
        ];
        valueProp = vHea[variationIndex % vHea.length];
      } else if (isTourism) {
        const vTou = [
          `Hospedaje de excelencia y experiencias turísticas memorables${locStr}, con servicios de primer nivel y confort asegurado.`,
          `Destinos y servicios turísticos pensados para tu descanso y disfrute, con asesoramiento personalizado y tarifas preferenciales${locStr}.`,
          `Infraestructura turística de calidad, atención cálida y propuestas exclusivas para estadías inolvidables${locStr}.`,
        ];
        valueProp = vTou[variationIndex % vTou.length];
      } else if (isFood) {
        const vFoo = [
          `Experiencia gastronómica destacada por la frescura de sus ingredientes, cocina de autor y atención esmerada${locStr}.`,
          `Propuesta culinaria de excelencia con menú variado, ambiente acogedor y servicios para eventos y celebraciones${locStr}.`,
          `Sabores auténticos, calidad gourmet y un servicio dedicado a brindar una experiencia memorable en cada visita${locStr}.`,
        ];
        valueProp = vFoo[variationIndex % vFoo.length];
      } else if (isRealEstate) {
        const vRea = [
          `Gestión y asesoramiento inmobiliario integral${locStr}, especializado en operaciones seguras, tasaciones y oportunidades de inversión.`,
          `Intermediación profesional en compra, venta y alquiler de propiedades con transparencia y respaldo de confianza${locStr}.`,
          `Desarrollos y propiedades seleccionadas con alta rentabilidad y asesoramiento legal-notarial en cada etapa${locStr}.`,
        ];
        valueProp = vRea[variationIndex % vRea.length];
      } else {
        const vGen = [
          `Servicios profesionales de excelencia con respaldo institucional verificado y atención personalizada${locStr}.`,
          `Soluciones integrales de alta calidad respaldadas por una sólida trayectoria y estándares de atención rigurosos${locStr}.`,
          `Calidad, confianza y vocación de servicio orientadas a superar las expectativas de cada usuario${locStr}.`,
        ];
        valueProp = vGen[variationIndex % vGen.length];
      }
    }

    if (isPersuasive && valueProp && !valueProp.toLowerCase().includes("vanguardia") && !valueProp.toLowerCase().includes("líder")) {
      valueProp = valueProp.replace(/\.\s*$/, "") + ". Formación de vanguardia y propuesta líder orientada al éxito profesional y laboral.";
    }

    if (isVirtual) {
      valueProp += " Modalidad 100% online con campus interactivo de última generación y cursado flexible.";
    }
    if (hasScholarships) {
      valueProp += " Opciones de becas de estudio, bonificaciones arancelarias y facilidades de pago.";
    }
    if (hasEmergency) {
      valueProp += " Servicio de guardia médica activa y atención de emergencias disponible las 24 horas.";
    }

    const paraQuien = facts.who || (
      isEducation
        ? "Estudiantes, graduados y profesionales que buscan formación oficial de calidad."
        : isJudicial
        ? "Particulares, empresas y profesionales que requieren asesoramiento legal confiable."
        : isSports
        ? "Deportistas, familias y personas interesadas en una vida activa y saludable."
        : isHealth
        ? "Pacientes y familias que buscan atención médica especializada y de confianza."
        : isTourism
        ? "Viajeros, turistas y familias que buscan descanso y confort garantizado."
        : isFood
        ? "Comensales y amantes de la buena gastronomía que valoran calidad y ambiente."
        : isRealEstate
        ? "Inversores, compradores y familias en búsqueda de propiedades y operaciones seguras."
        : "Usuarios y clientes que buscan servicios profesionales garantizados."
    );

    const docReq = facts.doc || (
      isJudicial
        ? "DNI o Pasaporte y documentación correspondiente al caso a gestionar."
        : isHealth
        ? "DNI o Pasaporte y credencial de cobertura médica (si corresponde)."
        : isSports
        ? "DNI vigente y certificado de aptitud física."
        : isRealEstate
        ? "DNI y documentación registral pertinente para la operación."
        : "Identificación oficial (DNI / Pasaporte) y requisitos particulares de la gestión."
    );

    const perm = facts.perm || (isShort ? "Según plan contratado." : "De acuerdo con la modalidad o período solicitado.");

    const p2 = `<p>💡 <strong>Propuesta de valor:</strong> ${valueProp} <strong>¿Para quién?:</strong> ${paraQuien} <strong>Documentación requerida:</strong> ${docReq} <strong>Permanencia:</strong> ${perm}</p>`;

    // Dynamic Paragraph 3: Diferencial
    let p3 = "";
    if (!omitDiferencial) {
      const diffVs = facts.diff || (
        isEducation
          ? "<em>Idiomas de atención:</em> Español, Inglés. <em>Experiencia y soporte:</em> Acompañamiento especializado en cada etapa. <em>Diferencial vs. alternativas:</em> Programas oficiales actualizados y articulación directa con el campo laboral."
          : isJudicial
          ? "<em>Idiomas de atención:</em> Español, Inglés. <em>Experiencia y soporte:</em> Acompañamiento especializado. <em>Diferencial vs. alternativas:</em> Estrategia jurídica personalizada y seguimiento procesal directo."
          : isSports
          ? "<em>Idiomas de atención:</em> Español, Inglés. <em>Experiencia y soporte:</em> Acompañamiento continuo. <em>Diferencial vs. alternativas:</em> Instalaciones de alto nivel y cuerpo técnico calificado."
          : isHealth
          ? "<em>Idiomas de atención:</em> Español, Inglés. <em>Experiencia y soporte:</em> Acompañamiento médico continuo. <em>Diferencial vs. alternativas:</em> Guardia médica continua y especialistas de trayectoria."
          : "<em>Idiomas de atención:</em> Español, Inglés. <em>Experiencia y soporte:</em> Acompañamiento especializado en cada etapa. <em>Diferencial vs. alternativas:</em> Canales oficiales directos y auditoría de calidad Travelgrin."
      );

      p3 = facts.diff ? `<p>⭐ <strong>Diferencial:</strong> ${facts.diff}</p>` : `<p>⭐ <strong>Diferencial:</strong> ${diffVs}</p>`;
    }

    // Dynamic Paragraph 4: Exclusiones
    let p4 = "";
    if (!omitExclusiones) {
      const exclText = facts.excl || (
        isEducation
          ? "Consultar fechas de inscripción, equivalencias y cupos por cohorte en los canales oficiales."
          : isJudicial
          ? "La viabilidad procesal queda sujeta a la revisión previa de los antecedentes y documentación del caso."
          : isHealth
          ? "Ciertas prestaciones de alta complejidad pueden requerir autorización previa de la obra social o prepaga."
          : isSports
          ? "Apto físico médico obligatorio antes de iniciar actividades y cupos sujetos a capacidad de instalaciones."
          : isTourism
          ? "Tarifas y disponibilidad sujetas a temporada y políticas de cancelación vigentes."
          : "Verificar disponibilidad horaria y requerimientos previos de ingreso antes de concurrir."
      );

      p4 = `<p>⚠️ <strong>Exclusiones:</strong> ${exclText}</p>`;
    }

    const paragraphs = [p1, p2, p3, p4].filter(Boolean).join("\n");
    return { description: paragraphs };
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
  if (/score|scout|puntaje|auditor|madurez/i.test(`${pLower} ${currentText}`)) {
    const scoreMatch = pLower.match(/\b(9\d|8\d|7\d|100)\b/);
    const scoreNum = scoreMatch ? scoreMatch[1] : "95";
    return {
      title: `🛡️ Score Scout ${scoreNum}/100`,
      body: `Presencia/reputación 24/25 · Contacto verificable 15/15 · Trayectoria/evidencia operativa 20/20 · Claridad propuesta 15/15 · Transparencia/seguridad 15/15 · Datos Institucionales 10/10\nMadurez: Líder · Vínculo: Oficial · Evidencia: Presencia institucional verificada, canales directos y atención al cliente activa.`,
    };
  }

  if (/requisito|admisi|inscrip|document/i.test(pLower)) {
    return {
      title: "Requisitos de Admisión e Inscripción",
      body: "<p><strong>Documentación requerida:</strong> Documento de identidad vigente (DNI o Pasaporte), comprobante de domicilio y antecedentes pertinentes según la actividad.</p><p><strong>Modalidad de presentación:</strong> Gestión presencial en sede oficial o carga digital a través de la plataforma web habilitada.</p>",
    };
  }
  if (/pago|financi|cuota|tarifa|precio/i.test(pLower)) {
    return {
      title: "Medios de Pago y Financiación",
      body: "<p><strong>Opciones disponibles:</strong> Transferencia bancaria, tarjetas de débito/crédito y planes de pago en cuotas según convenios vigentes.</p><p><strong>Beneficios:</strong> Bonificaciones por pago anticipado y convenios institucionales aplicables.</p>",
    };
  }
  return {
    title: "Información y Condiciones",
    body: `<p><strong>Detalle del servicio:</strong> ${prompt}.</p><p><strong>Recomendación:</strong> Consultar directamente en los canales de contacto oficial para coordinar turnos o recibir asesoramiento específico.</p>`,
  };
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

    // 4. Guarantee 100% adherence to negative constraints with Post-Sanitization
    if (aiResult && forbiddenTerms.length > 0) {
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
