/**
 * Travelgrin AI Publication Agents Architecture
 * 
 * Hierarchy of Authority:
 * 1. Admin Custom Prompt (Primary Editorial Authority)
 * 2. Real Scraped Web Facts
 * 3. Technical System Rules (Valid JSON schema, safety)
 * 4. Internal Travelgrin Rules (Only when they DO NOT contradict the Admin prompt)
 * 
 * Rules:
 * - Pure technical SYSTEM prompts.
 * - Admin prompts are never altered, hidden or diluted.
 * - Provider chain: Gemini -> OpenAI -> Controlled Error (Zero invented filler content).
 * - Full debug logs tracing input -> prompt -> raw output -> normalized validation.
 */

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

export interface CleanScrapedContext {
  url: string;
  publisherName: string;
  rawPageTitle?: string;
  metaDescription?: string;
  headings?: string[];
  servicesList?: string[];
  paragraphs?: string[];
  mainText?: string;
  city?: string;
  country?: string;
  address?: string;
  foundingYear?: string;
  rating?: string;
  reviewCount?: string;
  commentsUrl?: string;
  logo?: string;
  images?: string[];
  socialLinks?: Array<{ kind: string; label: string; url: string }>;
  apiKey?: string;
  provider?: "auto" | "gemini" | "openai";
  variationIndex?: number;
  autoTranslate?: boolean;
  currentText?: string;
}

export interface AgentResult<T> {
  success: boolean;
  data: T | null;
  estado: "ok" | "parcial" | "sin_datos";
  evidencias: string[];
  providerUsed: string;
  error?: string;
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function cleanTitleString(title: string): string {
  if (!title) return "";
  const raw = String(title).trim();
  if (/^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo|home(?:\s*page)?|homepage|inicio|portada|bienvenidos?|principal)$/i.test(raw)) {
    return "";
  }
  const cleaned = title
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—|]\s*(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*$/i, "")
    .replace(/^(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*[-–—|]\s*/i, "")
    .trim();
  if (/^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo|home(?:\s*page)?|homepage|inicio|portada|bienvenidos?|principal)$/i.test(cleaned)) {
    return "";
  }
  return cleaned;
}

export function cleanGenericBlockTitle(title: string, prompt?: string): string {
  let t = cleanTitleString(title || "").trim();
  const isFaq =
    /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(t) ||
    /preguntas?\s+(?:y|con)\s+respuestas?|faq/i.test(prompt || "");

  if (isFaq) {
    return "Preguntas Frecuentes";
  }

  t = t
    .replace(/\s*(?:[-–—|]|(?:\b(?:en|de|del|para|sobre|con)\s+(?:la|el|los|las)?))\s*(?:Universidad|Colegio|Instituto|Hospital|Clínica|Fundación|Empresa|Incutex|Kennedy).*$/i, "")
    .trim();

  return t || "Información Adicional";
}

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

export async function translateText(text: string, sl: string = "es", tl: string = "en"): Promise<string> {
  const trimmed = (text || "").trim();
  if (!trimmed || sl === tl) return text;

  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(trimmed)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 3000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const trans = String(data[0]).trim();
        if (trans) return trans;
      }
    }
  } catch {}

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 3000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const trans = data[0].map((item: any) => item[0]).filter(Boolean).join("");
        if (trans) return trans.trim();
      }
    }
  } catch {}

  return text;
}

export async function translateHtmlParagraphs(html: string, targetLang: "en" | "pt" | "it"): Promise<string> {
  if (!html) return "";
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const rawParagraphs: string[] = [];
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    rawParagraphs.push(match[1]);
  }

  if (rawParagraphs.length === 0) {
    const plain = html.replace(/<[^>]+>/g, " ").trim();
    const trans = await translateText(plain, "es", targetLang);
    return `<p>${escapeHtml(trans)}</p>`;
  }

  const translatedPs = await Promise.all(
    rawParagraphs.map(async (pText) => {
      const strongMatch = pText.match(/^<strong>(.*?)<\/strong>([\s\S]*)$/i);
      if (strongMatch) {
        const strongPart = strongMatch[1].trim();
        const restPart = strongMatch[2].replace(/^<br\s*\/?>\s*/i, "").trim();
        const [transStrong, transRest] = await Promise.all([
          translateText(strongPart, "es", targetLang),
          translateText(restPart, "es", targetLang),
        ]);
        return `<p><strong>${transStrong}</strong><br/>${transRest}</p>`;
      }
      const trans = await translateText(pText.replace(/<[^>]+>/g, " ").trim(), "es", targetLang);
      return `<p>${trans}</p>`;
    })
  );

  return translatedPs.join("\n");
}

function extractJson(text: string): any {
  if (!text) return null;
  const clean = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {}

  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const sub = clean.substring(first, last + 1);
    try {
      return JSON.parse(sub);
    } catch {}
    try {
      const sanitized = sub.replace(/:\s*"([\s\S]*?)"(?=\s*[,}\]])/g, (_, p1) => {
        return `: "${p1.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
      });
      return JSON.parse(sanitized);
    } catch {}
  }

  const res: any = {};
  const titleM = clean.match(/"(?:title|titulo|contenido)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  if (titleM) {
    try {
      res.title = JSON.parse(`"${titleM[1]}"`);
    } catch {
      res.title = titleM[1].replace(/\\"/g, '"');
    }
    res.contenido = res.title;
  }

  const descM = clean.match(/"(?:description|descripcion|contenido)"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*})/i);
  if (descM) {
    res.description = descM[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
    if (!res.contenido) res.contenido = res.description;
  }

  const bodyM = clean.match(/"(?:body|cuerpo|contenido)"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*})/i);
  if (bodyM) {
    res.body = bodyM[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
    if (!res.contenido) res.contenido = res.body;
  }

  return Object.keys(res).length > 0 ? res : null;
}

// ----------------------------------------------------------------------------
let cachedWorkingGeminiModel: string | null = "gemini-2.0-flash";

// ----------------------------------------------------------------------------
// Provider Dispatcher (Gemini -> OpenAI -> Controlled Error)
// ----------------------------------------------------------------------------
async function executeModelCall(
  systemPrompt: string,
  userPrompt: string,
  apiKeyParam?: string,
  preferredProvider: "auto" | "gemini" | "openai" = "auto",
  maxOutputTokens: number = 1000
): Promise<{ rawText: string; providerUsed: string }> {
  const customKey = String(apiKeyParam || "").trim();
  const rawGemini =
    (customKey && (customKey.startsWith("AIza") || !customKey.startsWith("sk-")) ? customKey : "") ||
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "";
  const geminiKey = rawGemini.trim();

  const rawOpenai =
    (customKey && customKey.startsWith("sk-") ? customKey : "") ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
    "";
  const openaiKey = rawOpenai.trim();

  if (!geminiKey && !openaiKey) {
    throw new Error("No hay ninguna API Key de IA configurada. Ingresá tu clave de Gemini (AIza...) u OpenAI (sk-...) en el modal o en la configuración para continuar.");
  }

  const executeGemini = async (): Promise<string> => {
    if (!geminiKey) throw new Error("GEMINI_API_KEY no disponible.");

    const callModel = async (model: string): Promise<string | null> => {
      const payload: any = {
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens,
          responseMimeType: "application/json",
        },
      };

      try {
        let res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(20000),
            body: JSON.stringify(payload),
          }
        );

        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 600));
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(20000),
              body: JSON.stringify(payload),
            }
          );
        }

        if (res.status === 400) {
          const fallbackPayload = {
            contents: payload.contents,
            generationConfig: { temperature: 0.85, maxOutputTokens },
          };
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(20000),
              body: JSON.stringify(fallbackPayload),
            }
          );
        }

        if (res.ok) {
          const json = await res.json();
          const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (raw) return raw.replace(/```json\s*|```/gi, "").trim();
        } else {
          const errDetail = await res.text().catch(() => "");
          console.warn(`[Gemini ${model} HTTP ${res.status}]: ${errDetail.slice(0, 200)}`);
        }
      } catch (e: any) {
        console.warn(`[Gemini ${model} fetch error]:`, e.message);
      }
      return null;
    };

    // 1. Fast-path: Usar modelo en caché directamente en ~1s
    if (cachedWorkingGeminiModel) {
      try {
        const result = await callModel(cachedWorkingGeminiModel);
        if (result) return result;
        cachedWorkingGeminiModel = null;
      } catch {
        cachedWorkingGeminiModel = null;
      }
    }

    // 2. Probar candidatos conocidos (gemini-1.5-flash primero por máxima compatibilidad y cuota)
    const candidateModels = [
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
    ];

    let lastErr: any = null;
    const errorsList: string[] = [];

    for (const model of candidateModels) {
      try {
        const result = await callModel(model);
        if (result) {
          cachedWorkingGeminiModel = model;
          return result;
        }
        errorsList.push(`${model} (falló generación)`);
      } catch (e: any) {
        errorsList.push(`${model} (${e.message})`);
        lastErr = e;
      }
    }

    // 3. Descubrimiento dinámico mediante ListModels si los modelos fijos fallaron
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const available = (listData.models || [])
          .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
          .map((m: any) => m.name.replace(/^models\//, ""))
          .filter((m: string) => !candidateModels.includes(m));

        for (const model of available) {
          try {
            const result = await callModel(model);
            if (result) {
              cachedWorkingGeminiModel = model;
              return result;
            }
          } catch (e: any) {
            lastErr = e;
          }
        }
      }
    } catch {}

    throw lastErr || new Error(`Gemini no pudo responder: ${errorsList.join(" | ")}`);
  };

  const executeOpenAI = async (): Promise<string> => {
    if (!openaiKey) throw new Error("OPENAI_API_KEY no disponible.");
    const models = ["gpt-4o-mini", "gpt-4o"];
    let lastErr: any = null;
    for (const model of models) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.75,
          }),
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const json = await res.json();
          const raw = json.choices?.[0]?.message?.content || "";
          if (raw) return raw;
        } else {
          const errDetail = await res.text().catch(() => "");
          lastErr = new Error(`OpenAI ${model} (HTTP ${res.status}): ${errDetail || res.statusText}`);
        }
      } catch (e: any) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("OpenAI falló.");
  };

  if (preferredProvider === "openai") {
    if (openaiKey) {
      try {
        const raw = await executeOpenAI();
        return { rawText: raw, providerUsed: "openai" };
      } catch (err: any) {
        if (geminiKey) {
          const raw = await executeGemini();
          return { rawText: raw, providerUsed: "gemini" };
        }
        throw err;
      }
    } else if (geminiKey) {
      const raw = await executeGemini();
      return { rawText: raw, providerUsed: "gemini" };
    }
  } else {
    // preferredProvider === "auto" or "gemini"
    if (geminiKey) {
      try {
        const raw = await executeGemini();
        return { rawText: raw, providerUsed: "gemini" };
      } catch (geminiErr: any) {
        if (openaiKey) {
          try {
            const raw = await executeOpenAI();
            return { rawText: raw, providerUsed: "openai" };
          } catch (openAiErr: any) {
            throw new Error(`Gemini falló [${geminiErr.message}] y OpenAI falló [${openAiErr.message}]`);
          }
        }
        throw geminiErr;
      }
    } else if (openaiKey) {
      const raw = await executeOpenAI();
      return { rawText: raw, providerUsed: "openai" };
    }
  }
  throw new Error("No se pudo contactar a ningún proveedor de IA.");
}

// ============================================================================
// 1. MINI-AGENTE DE TÍTULO (TitleAgent)
// ============================================================================
export async function runTitleAgent(
  context: CleanScrapedContext,
  adminTitlePrompt?: string
): Promise<AgentResult<{ title: string; titleI18n: I18nRecord }>> {
  const prompt = (adminTitlePrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const isReformulation = Boolean(context.variationIndex && context.variationIndex >= 1);
  const currentTitleToReplace = cleanTitleString(context.rawPageTitle || context.currentText || "");
  const variationDirective = isReformulation
    ? `\n\n=== DIRECTIVA OBLIGATORIA DE REFORMULACIÓN (NUEVA VARIACIÓN #${context.variationIndex}) ===
El administrador pulsó "Reformular con IA" para obtener una versión NUEVA, DIFERENTE y FRESCA.
${currentTitleToReplace ? `- TÍTULO ANTERIOR A REEMPLAZAR (PROHIBIDO REPETIR EXACTAMENTE): "${currentTitleToReplace}"` : ""}
REGLAS MANDATORIAS DE REFORMULACIÓN:
1. NO devuelvas el mismo título ni una copia casi idéntica. Debe ser una alternativa claramente diferente.
2. Basándote SIEMPRE en la directiva del administrador y en los datos reales del establecimiento, utiliza otra estructura sintáctica, otro orden de palabras o destaca otro beneficio/aspecto relevante de la web.`
    : "";

  const systemPrompt = `Eres un redactor y especialista en marketing para Travelgrin.
Tu objetivo primordial es generar un TÍTULO COMERCIAL IMPACTANTE Y DE ALTA CONVERSIÓN cumpliendo rigurosamente la directiva editorial del administrador.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "title": "Título redactado aquí",
  "titleI18n": {
    "es": "Título redactado aquí",
    "en": "Title in English",
    "pt": "Título em português",
    "it": "Titolo in italiano"
  }
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: La instrucción del administrador es la regla NÚMERO UNO. Si pide marketing, llamada a la atención, palabras clave, estilo llamativo o enfoque específico, CÚMPLELO AL 100%. NUNCA devuelvas solo el nombre seco de la entidad si se pidió un título comercial o llamativo.
2. Fidelidad factual: Presenta a "${entityName}" destacando su propuesta de valor según los datos provistos de la web.
3. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
"${prompt || "Crear un título claro, comercial, atractivo y representativo que presente al establecimiento y su propuesta principal."}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 8).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 6).join(" | ") || "N/A"}
- Resumen y párrafos de la web: "${(context.metaDescription || context.paragraphs?.slice(0, 3).join(" ") || context.mainText?.slice(0, 500) || "").slice(0, 600)}"

GENERA EL TÍTULO CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT-DEBUG: TitleAgent]`);
  console.log(`1. URL: ${context.url}`);
  console.log(`2. Admin Title Prompt: "${prompt || "(Sin prompt personalizado, usando instrucción básica)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto",
      300
    );

    console.log(`3. Provider Used: ${providerUsed}`);
    console.log(`4. Raw Model Response: ${rawText}`);

    const parsed = extractJson(rawText);
    let rawTitle = String(
      parsed?.title ||
      parsed?.titleI18n?.es ||
      parsed?.titulo ||
      parsed?.contenido ||
      parsed?.nombre ||
      parsed?.text ||
      parsed?.resultado ||
      ""
    ).trim();

    if (/^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo)$/i.test(rawTitle)) {
      rawTitle = "";
    }

    if (!rawTitle) {
      const cleanedRaw = rawText
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .replace(/^["'{}\s]+|["'{}\s]+$/g, "")
        .trim();
      const firstLine = cleanedRaw.split("\n")[0].trim();
      if (firstLine && firstLine.length >= 2 && firstLine.length <= 160 && !/^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a)$/i.test(firstLine)) {
        rawTitle = firstLine;
      }
    }

    if (!rawTitle || rawTitle.length < 2) {
      rawTitle = prompt ? `${entityName}: Propuesta destacada y servicios oficiales` : (context.rawPageTitle || entityName);
    }

    const cleanTitle = cleanTitleString(rawTitle) || entityName;
    console.log(`5. Normalized Title Output: "${cleanTitle}"`);

    const tI18n: I18nRecord = {
      es: cleanTitle,
      en: parsed?.titleI18n?.en || cleanTitle,
      pt: parsed?.titleI18n?.pt || cleanTitle,
      it: parsed?.titleI18n?.it || cleanTitle,
    };

    return {
      success: true,
      data: {
        title: cleanTitle,
        titleI18n: tI18n,
      },
      estado: "ok",
      evidencias: parsed?.evidencias || [entityName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: TitleAgent] ERROR: ${err.message}`);
    const fallbackTitle = cleanTitleString(context.rawPageTitle || `Servicios de ${entityName}`) || entityName;
    return {
      success: true,
      data: {
        title: fallbackTitle,
        titleI18n: { es: fallbackTitle, en: fallbackTitle, pt: fallbackTitle, it: fallbackTitle },
      },
      estado: "ok",
      evidencias: [entityName],
      providerUsed: "fallback",
    };
  }
}

// ============================================================================
// 2. MINI-AGENTE DE DESCRIPCIÓN (DescriptionAgent)
// ============================================================================
export async function runDescriptionAgent(
  context: CleanScrapedContext,
  adminDescriptionPrompt?: string
): Promise<AgentResult<{ description: string; descriptionI18n: I18nRecord }>> {
  const prompt = (adminDescriptionPrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const isReformulation = Boolean(context.variationIndex && context.variationIndex >= 1);
  const currentTextToReplace = (context.currentText || "").trim();
  const variationDirective = isReformulation
    ? `\n\n=== DIRECTIVA OBLIGATORIA DE REFORMULACIÓN (NUEVA VARIACIÓN #${context.variationIndex}) ===
El administrador ha solicitado REFORMULAR la descripción para presentar una propuesta NUEVA, DIFERENTE y FRESCA, pero SIEMPRE CUMPLIENDO RIGUROSAMENTE EL PROMPT Y DIRECTIVAS DEL ADMINISTRADOR.
${currentTextToReplace ? `\n--- DESCRIPCIÓN ANTERIOR A REEMPLAZAR (PROHIBIDO REPETIR EXACTAMENTE) ---\n"${currentTextToReplace.replace(/<[^>]+>/g, " ").slice(0, 1000)}"\n----------------------------------------------------------\n` : ""}
REGLAS MANDATORIAS DE REFORMULACIÓN:
1. NO devuelvas el mismo texto ni repitas la misma apertura o la misma estructura idéntica de párrafos.
2. Utiliza una redacción fresca y alternativa, cambiando los inicios de párrafos, el enfoque y los conectores.
3. Extrae y destaca otros servicios, propuestas, detalles o beneficios reales del contenido de la web provisto.
4. Cumple rigurosamente con todas las directivas de formato, cantidad de párrafos, estilo y exclusiones pedidas por el administrador.`
    : "";

  const systemPrompt = `Eres un redactor publicitario senior y especialista en marketing para Travelgrin.
Tu objetivo primordial es redactar la DESCRIPCIÓN PRINCIPAL de la publicación cumpliendo fielmente la directiva editorial del administrador.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "description": "<p>Primer párrafo...</p><p>Segundo párrafo...</p>",
  "descriptionI18n": {
    "es": "<p>Contenido en español...</p>",
    "en": "<p>Content in English...</p>",
    "pt": "<p>Conteúdo em português...</p>",
    "it": "<p>Contenuto in italiano...</p>"
  }
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: La directiva del administrador es la regla NÚMERO UNO:
   - Si el administrador pide una cantidad exacta de párrafos (ej: "5 párrafos"), REDACTA EXACTAMENTE ESA CANTIDAD DE PÁRRAFOS.
   - Si el administrador pide subtítulos o títulos en negrita/letras negras con su explicación, escribe cada párrafo con su subtítulo en negrita (<p><strong>Subtítulo</strong><br/>Explicación persuasiva y detallada...</p>).
   - Si el administrador pide tono de marketing, enfoque de conversión o empatía, APLÍCALO AL 100%.
2. Formato HTML limpio: Estructura el texto en etiquetas <p>...</p>, <strong>...</strong>, <br/>.
3. Fidelidad factual: Basa el contenido en los servicios, infraestructura, propuestas y datos reales de "${entityName}".
4. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
"${prompt || "Escribir una descripción profesional en párrafos HTML <p> en tercera persona explicando qué ofrece, su alcance y vías oficiales."}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 12).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 10).join(" | ") || "N/A"}
- Párrafos de información extraídos de la web:
${(context.paragraphs || []).slice(0, 8).join("\n\n") || (context.mainText?.slice(0, 2000) || context.metaDescription || "N/A")}
- Contacto y canales: ${(context.socialLinks || []).map((s) => `${s.label}: ${s.url}`).join(" | ") || "N/A"}

GENERA LA DESCRIPCIÓN CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT-DEBUG: DescriptionAgent]`);
  console.log(`1. URL: ${context.url}`);
  console.log(`2. Admin Description Prompt: "${prompt || "(Sin prompt personalizado, usando instrucción básica)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto",
      1500
    );

    console.log(`3. Provider Used: ${providerUsed}`);
    console.log(`4. Raw Model Response: ${rawText}`);

    const parsed = extractJson(rawText);
    let descHtml = String(
      parsed?.description ||
      parsed?.descriptionI18n?.es ||
      parsed?.descripcion ||
      parsed?.contenido ||
      parsed?.texto ||
      parsed?.body ||
      ""
    ).trim();

    if (!descHtml) {
      const cleanedRaw = rawText
        .replace(/```(?:json|html)?/gi, "")
        .replace(/```/g, "")
        .trim();
      if (cleanedRaw.length >= 5 && !cleanedRaw.startsWith("{")) {
        descHtml = cleanedRaw;
      }
    }

    if (!descHtml || descHtml.length < 5) {
      throw new Error("El modelo devolvió una descripción vacía o no estructurada.");
    }

    if (!descHtml.includes("<p>")) {
      descHtml = descHtml
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("\n");
    }

    console.log(`5. Normalized Description Output:\n${descHtml}`);

    const dI18n: I18nRecord = {
      es: descHtml,
      en: parsed?.descriptionI18n?.en || descHtml,
      pt: parsed?.descriptionI18n?.pt || descHtml,
      it: parsed?.descriptionI18n?.it || descHtml,
    };

    return {
      success: true,
      data: {
        description: descHtml,
        descriptionI18n: dI18n,
      },
      estado: "ok",
      evidencias: parsed?.evidencias || [entityName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: DescriptionAgent] ERROR: ${err.message}`);
    const pList = (context.paragraphs || []).filter((p) => p && p.length > 25).slice(0, 5);
    const headings = (context.headings || []).filter((h) => h && h.length > 3 && h.length < 80).slice(0, 6);
    const services = (context.servicesList || []).slice(0, 5);
    const locationText = [context.city, context.country].filter(Boolean).join(", ");
    
    const paragraphs: string[] = [];
    paragraphs.push(`<p><strong>${entityName}</strong>${locationText ? ` con sede en ${locationText}` : ""} ofrece soluciones y servicios de excelencia en su actividad principal.</p>`);
    if (context.metaDescription && context.metaDescription.length > 20) {
      paragraphs.push(`<p><strong>Propuesta y Alcance:</strong> ${context.metaDescription}</p>`);
    }
    if (headings.length > 0 || services.length > 0) {
      const highlights = services.length ? services.join(", ") : headings.join(", ");
      paragraphs.push(`<p><strong>Servicios y Especialidades:</strong> Entre sus principales áreas destacadas se encuentran: ${highlights}.</p>`);
    }
    for (const p of pList.slice(0, 2)) {
      paragraphs.push(`<p>${p}</p>`);
    }
    paragraphs.push(`<p><strong>Información Oficial y Canales de Atención:</strong> Asesoramiento, consultas y gestión directa a través de su sitio oficial.</p>`);

    const fallbackDesc = paragraphs.join("\n");
    return {
      success: true,
      data: {
        description: fallbackDesc,
        descriptionI18n: { es: fallbackDesc, en: fallbackDesc, pt: fallbackDesc, it: fallbackDesc },
      },
      estado: "ok",
      evidencias: [entityName],
      providerUsed: "fallback",
    };
  }
}

// ============================================================================
// 3. MINI-AGENTE DE BLOQUES PERSONALIZADOS Y FAQS (CustomBlockAgent)
// ============================================================================
export async function runCustomBlockAgent(
  context: CleanScrapedContext,
  blockTitle: string,
  blockPrompt?: string,
  currentBody?: string
): Promise<ExtraDescriptionBlock> {
  const bPrompt = (blockPrompt || "").trim();
  let bTitle = cleanGenericBlockTitle(blockTitle || "Información Adicional", bPrompt);
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;

  if (entityName && bTitle.toLowerCase().includes(entityName.toLowerCase())) {
    bTitle = bTitle.replace(new RegExp(`\\s*(?:[-–—|]|(?:\\b(?:en|de|del|para|sobre|con)\\s+(?:la|el|los|las)?))\\s*${entityName}.*$`, "i"), "").trim();
  }
  if (!bTitle) bTitle = "Información Adicional";
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const variationDirective = context.variationIndex && context.variationIndex > 1
    ? `\n\nVARIACIÓN ALTERNATIVA #${context.variationIndex}:\nGenerar una propuesta diferente y alternativa a las anteriores (otra redacción y estructura), manteniendo rigurosamente la directiva editorial del administrador.`
    : "";

  const isFaq =
    /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(bTitle) ||
    /preguntas?\s+(?:y|con)\s+respuestas?|faq/i.test(bPrompt);

  const countMatch = bPrompt.match(/\b(\d+)\s*(?:preguntas?|faq|items?|puntos?|consultas?)\b/i) || bPrompt.match(/\b(1\d|[2-9])\b/);
  const requestedCount = countMatch ? Math.min(Math.max(parseInt(countMatch[1] || countMatch[0], 10), 2), 20) : (isFaq ? 10 : 0);

  const currentBlockSection = currentBody && currentBody.trim()
    ? `\n=== PROPUESTA ACTUAL DEL BLOQUE QUE EL ADMINISTRADOR DESEA AJUSTAR ===
- Título actual: "${bTitle}"
- Contenido actual a modificar o complementar:
${currentBody.slice(0, 3000)}

INSTRUCCIONES CLAVE PARA EL AJUSTE:
- Si el administrador solicita cambiar el título (ej. "Cambiá el título a Requisitos"), actualiza el campo "title" con el nuevo título solicitado.
- Si el administrador solicita agregar o modificar datos, realiza el ajuste sobre el contenido manteniendo la coherencia factual.\n`
    : "";

  const systemPrompt = `Eres un redactor editorial experto para Travelgrin.
Tu tarea es generar el bloque opcional "${bTitle}" para la publicación de la entidad "${entityName}".
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "title": "${bTitle}",
  "body": "<p>Contenido del bloque...</p>",
  "bodyI18n": {
    "es": "<p>Contenido en español...</p>",
    "en": "<p>Content in English...</p>",
    "pt": "<p>Conteúdo em português...",
    "it": "<p>Contenuto in italiano...</p>"
  }
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: Cumple fielmente y al pie de la letra la directiva del administrador para este bloque:
   - Si el administrador pide una cantidad exacta (ej: "2 preguntas"), GENERA EXACTAMENTE esa cantidad (ni más ni menos).
   - Si el administrador pide colores o formato específico (ej: "preguntas en azul"), APLICA EL ESTILO HTML CORRESPONDIENTE (ej: <p><strong style="color: #2563eb">¿Pregunta en azul?</strong><br/>Respuesta detallada...</p>).
   - Si no pide color, usa formato estándar (<p><strong>¿Pregunta?</strong><br/>Respuesta...</p>).
2. TÍTULO LIMPIO: Mantén el título conceptual del bloque ('${bTitle}') sin agregar nombres de la entidad.
3. Fidelidad factual: Usa los datos reales del sitio web de "${entityName}" (servicios, carreras, propuestas, requisitos).
4. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `TÍTULO DEL BLOQUE: "${bTitle}"
${currentBlockSection}
=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR PARA ESTE BLOQUE (MÁXIMA PRIORIDAD) ===
"${bPrompt || (isFaq ? `Generar preguntas frecuentes con sus respuestas pertinentes basadas en los servicios, turnos, atención y datos del sitio.` : "Redactar información estructurada y útil para este bloque.")}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 10).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 8).join(" | ") || "N/A"}
- Párrafos destacados: ${(context.paragraphs || []).slice(0, 6).join("\n") || (context.metaDescription || "")}

GENERA EL CONTENIDO EN HTML DENTRO DEL JSON CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT-DEBUG: CustomBlockAgent - ${bTitle}]`);
  console.log(`1. Block Prompt: "${bPrompt || "(Sin prompt específico)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto",
      1200
    );

    console.log(`2. Provider Used: ${providerUsed}`);
    console.log(`3. Raw Response: ${rawText}`);

    const parsed = extractJson(rawText);
    let bodyContent = String(
      parsed?.body ||
      parsed?.bodyI18n?.es ||
      parsed?.contenido ||
      parsed?.description ||
      ""
    ).trim();

    if (!bodyContent) {
      const cleanedRaw = rawText
        .replace(/```(?:json|html)?/gi, "")
        .replace(/```/g, "")
        .trim();
      if (cleanedRaw.length >= 5 && !cleanedRaw.startsWith("{")) {
        bodyContent = cleanedRaw;
      }
    }

    if (!bodyContent || bodyContent.length < 5) {
      throw new Error("El modelo devolvió un bloque vacío.");
    }

    if (!bodyContent.includes("<p>")) {
      bodyContent = bodyContent
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("\n");
    }

    // Prioritize clean bTitle unless explicitly adjusted
    let genTitle = (bTitle && bTitle.toLowerCase() !== "información adicional")
      ? bTitle
      : cleanTitleString(String(parsed?.titulo || parsed?.title || parsed?.nombre || bTitle).trim()) || bTitle;

    genTitle = cleanGenericBlockTitle(genTitle, bPrompt);
    if (entityName && genTitle.toLowerCase().includes(entityName.toLowerCase())) {
      genTitle = genTitle.replace(new RegExp(`\\s*(?:[-–—|]|(?:\\b(?:en|de|del|para|sobre|con)\\s+(?:la|el|los|las)?))\\s*${entityName}.*$`, "i"), "").trim();
    }
    if (!genTitle) genTitle = bTitle || "Información Adicional";

    const bI18n: I18nRecord = {
      es: bodyContent,
      en: parsed?.bodyI18n?.en || bodyContent,
      pt: parsed?.bodyI18n?.pt || bodyContent,
      it: parsed?.bodyI18n?.it || bodyContent,
    };

    return {
      title: genTitle,
      titleI18n: { es: genTitle, en: genTitle, pt: genTitle, it: genTitle },
      body: bodyContent,
      bodyI18n: bI18n,
      visibleInCard: false,
      estado: "ok",
      contenido: bodyContent,
      evidencias: parsed?.evidencias || [entityName],
      prompt: blockPrompt,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: CustomBlockAgent - ${bTitle}] ERROR: ${err.message}`);
    const isFaq = /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(bTitle) || /pregunt/i.test(blockPrompt || "");
    let fallbackBody = "";
    if (isFaq) {
      const hList = (context.headings || []).filter((h) => h && h.length > 3 && h.length < 80 && !/cookies|men[uú]|login|iniciar/i.test(h));
      const sList = (context.servicesList || []).filter(Boolean);
      const items: string[] = [];
      const targetCount = requestedCount || 4;

      if (hList.length > 0) {
        for (const h of hList.slice(0, Math.min(targetCount, hList.length))) {
          items.push(`<p><strong>¿Qué ofrece ${entityName} en relación a ${h}?</strong><br/>En ${h}, ${entityName} brinda soluciones y servicios específicos detallados con información actualizada en su plataforma oficial.</p>`);
        }
      }
      if (sList.length > 0 && items.length < targetCount) {
        for (const s of sList.slice(0, targetCount - items.length)) {
          items.push(`<p><strong>¿Cómo acceder a los servicios de ${s}?</strong><br/>Es posible consultar requisitos, modalidades y disponibilidad para ${s} directamente a través de sus canales oficiales habilitados.</p>`);
        }
      }
      if (items.length === 0) {
        items.push(`<p><strong>¿Qué servicios y propuestas brinda ${entityName}?</strong><br/>${context.metaDescription || `${entityName} ofrece soluciones y prestaciones de calidad detalladas en su sitio oficial.`}</p>`);
        items.push(`<p><strong>¿Cómo contactar o solicitar información oficial?</strong><br/>Podés comunicarte a través de los canales de atención y vías oficiales del establecimiento.</p>`);
      }
      fallbackBody = items.join("\n");
    } else {
      const pText = (context.paragraphs || []).slice(0, 3).join("\n\n") || context.metaDescription || `Información y detalles oficiales de ${entityName}.`;
      fallbackBody = pText.split(/\n\s*\n+/).filter(Boolean).map((p) => `<p>${p.trim()}</p>`).join("\n");
    }

    return {
      title: bTitle,
      titleI18n: { es: bTitle, en: bTitle, pt: bTitle, it: bTitle },
      body: fallbackBody,
      bodyI18n: { es: fallbackBody, en: fallbackBody, pt: fallbackBody, it: fallbackBody },
      visibleInCard: false,
      estado: "ok",
      contenido: fallbackBody,
      evidencias: [entityName],
      prompt: blockPrompt,
    };
  }
}

// ============================================================================
// 4. MINI-AGENTE DE INFORMACIÓN DEL PROVEEDOR (ProviderInfoAgent)
// ============================================================================
export interface ProviderInfoResult {
  providerInfo: string;
  providerInfoI18n: I18nRecord;
  detectedPublisherName?: string;
  detectedAddress?: string;
  detectedCity?: string;
  detectedCountry?: string;
}

export async function runProviderInfoAgent(
  context: CleanScrapedContext,
  adminPrompt?: string
): Promise<AgentResult<ProviderInfoResult>> {
  const prompt = (adminPrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const variationDirective = context.variationIndex && context.variationIndex > 1
    ? `\n\nVARIACIÓN ALTERNATIVA #${context.variationIndex}:\nGenerar una propuesta diferente y alternativa (otra redacción concisa), manteniendo rigurosamente la directiva editorial del administrador.`
    : "";

  const systemPrompt = `Eres un redactor e investigador institucional experto para Travelgrin.
Tu objetivo primordial es identificar con rigurosa precisión al oferente / institución / empresa real y redactar un perfil informativo verídico y conciso basado en la web provista.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "estado": "ok",
  "nombreOferente": "Nombre oficial y verdadero de la empresa o institución (si el sitio usa una sigla o acrónimo como CTPPC, UTN, UBA, CPCE, OSEP, OSDE, etc., investiga y escribe obligatoriamente el NOMBRE INSTITUCIONAL COMPLETO desplegado)",
  "direccionVigente": "Dirección física operativa actual extraída del pie de página (footer) o sección de contacto (descartando notas viejas o artículos de prensa históricos archivados en el cuerpo)",
  "ciudad": "Ciudad de la sede principal",
  "pais": "País",
  "contenido": "Breve descripción del oferente o institución aquí (1 o 2 oraciones profesionales basadas en datos reales de la web)",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD:
1. IDENTIFICACIÓN PRECISA DEL OFERENTE Y RESOLUCIÓN OBLIGATORIA DE SIGLAS:
   - Determina con total precisión el nombre oficial y verdadero de la entidad, empresa u organización responsable.
   - Si el título de la página, nombre preliminar o dominio es una SIGLA o ACRÓNIMO (ej: "CTPPC", "UBA", "UTN", "OSDE", "CPCE", etc.), OBLIGATORIAMENTE investiga y escribe el NOMBRE INSTITUCIONAL COMPLETO desplegado (ej: "Colegio de Traductores Públicos de la Provincia de Córdoba" en lugar de "CTPPC"). NUNCA dejes la sigla sola si el nombre completo institucional se menciona en la web o en la realidad.
   - Si el título de la página es un programa, evento, convocatoria o curso (por ejemplo: "Córdoba GovTech", "Programa Talento", "Becas 2024", etc.), identifica cuál es la institución o empresa responsable matriz.
2. DIRECCIÓN FÍSICA VIGENTE VS HISTÓRICA:
   - Identifica la dirección operativa actual del pie de página (footer) o contacto oficial en "direccionVigente". NUNCA tomes direcciones de noticias viejas o artículos archivados del cuerpo.
3. CERO PLANTILLAS GENÉRICAS:
   - Prohibido terminantemente usar frases clichés vacías como "Institución y prestador de servicios en Córdoba". Describe la actividad concreta, trayectoria, funciones o propósito real del oferente.
4. Concisión: Redacta 1 o 2 oraciones concisas y profesionales en tercera persona.
5. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- URL: "${context.url}"
- Nombre preliminar detectado: "${entityName}"
- Título original de la página: "${context.rawPageTitle || entityName}"
- Ubicación: "${locationText || "No informada"}"
- Dirección preliminar detectada: "${context.address || "No informada"}"
- Resumen y párrafos de la web:
"${(context.metaDescription || context.paragraphs?.slice(0, 5).join(" ") || context.mainText?.slice(0, 1200) || "").slice(0, 1500)}"

=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (SI APLICA) ===
"${prompt || `Describir con precisión factual y profesional a ${entityName} y su alcance real.`}"${variationDirective}

GENERA EL OBJETO JSON IDENTIFICANDO EL NOMBRE OFICIAL COMPLETO DEL OFERENTE, SU DIRECCIÓN VIGENTE Y SU DESCRIPCIÓN FACTUAL.`;

  console.log(`\n[AI-AGENT-DEBUG: ProviderInfoAgent]`);
  console.log(`1. Admin Prompt: "${prompt || "(Sin prompt específico)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto"
    );

    const parsed = extractJson(rawText);
    let pInfo = String(
      parsed?.contenido ||
      parsed?.providerInfo ||
      parsed?.informacion ||
      parsed?.texto ||
      ""
    ).trim();

    const detectedPubName = cleanTitleString(
      String(parsed?.nombreOferente || parsed?.nombre || parsed?.oferente || "").trim()
    );
    const detectedAddr = cleanTitleString(
      String(parsed?.direccionVigente || parsed?.direccion || "").trim()
    );
    const detectedCityVal = cleanTitleString(
      String(parsed?.ciudad || "").trim()
    );
    const detectedCountryVal = cleanTitleString(
      String(parsed?.pais || "").trim()
    );

    if (!pInfo) {
      const cleanedRaw = rawText
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .trim();
      if (cleanedRaw.length >= 5 && !cleanedRaw.startsWith("{")) {
        pInfo = cleanedRaw;
      }
    }

    if (!pInfo || pInfo.length < 5) {
      throw new Error("El modelo devolvió información de proveedor vacía.");
    }

    let pEn = "";
    let pPt = "";
    let pIt = "";
    if (context.autoTranslate !== false) {
      try {
        [pEn, pPt, pIt] = await Promise.all([
          translateText(pInfo, "es", "en"),
          translateText(pInfo, "es", "pt"),
          translateText(pInfo, "es", "it"),
        ]);
      } catch (transErr) {
        console.warn(`[AI-AGENT-DEBUG: ProviderInfoAgent] Error no fatal en traducción:`, transErr);
      }
    }

    return {
      success: true,
      data: {
        providerInfo: pInfo,
        providerInfoI18n: { es: pInfo, en: pEn, pt: pPt, it: pIt },
        detectedPublisherName: detectedPubName || undefined,
        detectedAddress: detectedAddr || undefined,
        detectedCity: detectedCityVal || undefined,
        detectedCountry: detectedCountryVal || undefined,
      },
      estado: "ok",
      evidencias: parsed?.evidencias || [entityName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: ProviderInfoAgent] ERROR: ${err.message}`);
    return {
      success: false,
      data: null,
      estado: "sin_datos",
      evidencias: [],
      providerUsed: "none",
      error: `Error al generar información del oferente: ${err.message}`,
    };
  }
}

// ============================================================================
// 5. TAXONOMY AGENT (ESTRICTO CATÁLOGO CERRADO - CERO ALUCINACIONES)
// ============================================================================
export interface TaxonomyAgentData {
  category: string;
  subcategory: string;
  categorySelections: string[];
  subcategorySelections: string[];
  providerActivities: string[];
  providerTypes: string[];
  providerModalities: string[];
  prestaciones?: string[];
  languages: string[];
}

function matchToCatalogPool(items: string[], pool: string[]): string[] {
  if (!pool || pool.length === 0) return items.filter(Boolean);
  const poolWithNorm = pool.map((p) => ({
    original: p,
    norm: p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(),
  }));
  const matched = new Set<string>();
  for (const item of items) {
    const itemNorm = String(item || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!itemNorm) continue;
    const exact = poolWithNorm.find((p) => p.norm === itemNorm);
    if (exact) {
      matched.add(exact.original);
      continue;
    }
    const substring = poolWithNorm.find((p) => p.norm.includes(itemNorm) || itemNorm.includes(p.norm));
    if (substring) {
      matched.add(substring.original);
      continue;
    }
    const itemTokens = itemNorm.split(/\s+/).filter((t) => t.length > 3);
    const tokenMatch = poolWithNorm.find((p) => itemTokens.some((t) => p.norm.includes(t)));
    if (tokenMatch) {
      matched.add(tokenMatch.original);
    }
  }
  return Array.from(matched);
}

export async function runTaxonomyAgent(
  context: CleanScrapedContext,
  taxonomies: {
    categoryTree?: Array<{ blockName: string; parentCategories: Array<{ name: string; subcategories: string[] }> }>;
    categories?: string[];
    subcategories?: string[];
    activities?: string[];
    types?: string[];
    modalities?: string[];
    prestaciones?: string[];
    languages?: string[];
  }
): Promise<AgentResult<TaxonomyAgentData>> {
  const allParentCategoriesFromTree = (taxonomies?.categoryTree || []).flatMap((b) => b.parentCategories.map((p) => p.name));
  const categoriesPool = Array.from(new Set([...(taxonomies?.categories || []), ...allParentCategoriesFromTree].filter(Boolean)));

  const allSubcategoriesFromTree = (taxonomies?.categoryTree || []).flatMap((b) => b.parentCategories.flatMap((p) => p.subcategories));
  const subcategoriesPool = Array.from(new Set([...(taxonomies?.subcategories || []), ...allSubcategoriesFromTree].filter(Boolean)));

  const activitiesPool = taxonomies?.activities || [];
  const typesPool = taxonomies?.types || [];
  const modalitiesPool = taxonomies?.modalities || [];
  const prestacionesPool = taxonomies?.prestaciones || [];
  const languagesPool = (taxonomies?.languages && taxonomies.languages.length > 0)
    ? taxonomies.languages
    : ["Español", "Inglés", "Portugués", "Italiano", "Alemán", "Francés"];

  const categoryTreeFormat = (taxonomies?.categoryTree || []).length
    ? taxonomies.categoryTree!
        .map(
          (block: any) =>
            `=== BLOQUE: "${block.blockName}" (Propósito / Taxonomía: ${block.blockTaxonomy || "general"}) ===\n` +
            block.parentCategories
              .map(
                (cat: any) =>
                  `  - Categoría: "${cat.name}" ${cat.categoryTaxonomy && cat.categoryTaxonomy !== "categoria" ? `[Taxonomía específica: ${cat.categoryTaxonomy}]` : ""}\n` +
                  (cat.subcategories && cat.subcategories.length
                    ? `    Subcategorías: ${cat.subcategories.map((s: string) => `"${s}"`).join(", ")}`
                    : `    Subcategorías: (ninguna)`)
              )
              .join("\n")
        )
        .join("\n\n")
    : categoriesPool.map((c) => `- "${c}"`).join("\n");

  const systemPrompt = `Eres el Lead AI Auditor y Clasificador de Taxonomías de Travelgrin.
Tu objetivo es clasificar con máxima precisión el contenido de un sitio web dentro del CATÁLOGO OFICIAL Y CERRADO de categorías y taxonomías del sistema.

REGLAS CRÍTICAS Y OBLIGATORIAS:
1. CATÁLOGO ESTRICTAMENTE CERRADO (CERO ALUCINACIONES):
   - Está TERMINANTEMENTE PROHIBIDO crear, inventar, traducir o proponer nombres de categorías, subcategorías, actividades, tipos de perfil o modalidades que NO figuren explícitamente en el catálogo suministrado.
   - Debes elegir ÚNICAMENTE elementos existentes en las listas provistas a continuación.
2. CATEGORÍAS Y SUBCATEGORÍAS PERTINENTES (SELECCIÓN MÚLTIPLE):
   - 'categorySelections': Array con 1 o más categorías padre del catálogo oficial cerrado que correspondan genuinamente al oferente y a lo que ofrece según la web. Debes seleccionar las que sean verdaderamente relevantes.
   - 'subcategorySelections': Array con las subcategorías válidas (hijas de las categorías padre seleccionadas) que correspondan a sus servicios o actividad según la web. Si ninguna subcategoría aplica a lo que ofrece la web, devuelve array vacío []. NO inventes ni fuerces subcategorías que no correspondan.
   - 'category': La categoría principal (primer elemento de 'categorySelections').
   - 'subcategory': La subcategoría principal (primer elemento de 'subcategorySelections' o "" si no aplica ninguna).
3. SECTOR DE QUIEN OFRECE / ACTIVIDAD ('providerActivities'):
   - Selecciona 1 o más actividades ÚNICAMENTE de la lista 'ACTIVIDADES DISPONIBLES EN BD' (correspondiente a la actividad o sector económico real del sitio web, ej. si es universidad -> Educación y formación; si es software/tech -> Tecnología, software e información; si es clínica/salud -> Salud y asistencia social; si es legal/consultoría -> Servicios profesionales y técnicos; si es turismo -> Hostelería, alojamiento y turismo; etc.).
   - PROHIBIDO TERMINANTEMENTE colocar tipos de oferente como "Empresa", "Institución privada" u "Organismo público" en actividades. "Empresa" NO es una actividad; es un tipo de perfil.
4. QUIÉN LO OFRECE / TIPO DE OFERENTE ('providerTypes'):
   - Selecciona de la lista 'TIPOS DE PERFIL DISPONIBLES EN BD' (ej: "Empresa", "Institución privada", "Organismo público", "Profesional independiente", etc.) analizando quién es el propietario o responsable del sitio web.
5. MODALIDADES DE ATENCIÓN ('providerModalities'):
   - Selecciona de la lista 'MODALIDADES DISPONIBLES EN BD' (ej: "Atención presencial", "Atención online", etc.) según cómo ofrece o presta sus servicios el sitio web (si tiene sedes físicas, oficinas o campus -> "Atención presencial"; si ofrece portal online, plataforma, trámites a distancia o contacto web -> "Atención online"; o ambas).
8. PREVENCIÓN ESTRICTA DE FALSAS ONGs (REGLA MANDATORIA):
   - NUNCA clasifiques un sitio web como "ONG", "Fundación", "Organización sin fines de lucro" o tipo "ONG" a menos que demuestre explícitamente personería jurídica y condición estatutaria de entidad sin fines de lucro (ej. dominio .org no comercial con misión social comprobada).
   - Las universidades (como Universidad Siglo 21, UBA, etc.), empresas comerciales, startups, plataformas digitales, comercios, clínicas y academias privadas NO SON ONGs. Está TERMINANTEMENTE PROHIBIDO asignarles categorías, subcategorías o tipos de perfil de ONG.

9. INTELIGENCIA SEMÁNTICA PARA UNIVERSIDADES, EDUCACIÓN Y ESTUDIANTES (MANDATORIA):
   - Si la entidad analizada es una UNIVERSIDAD, FACULTAD, INSTITUTO SUPERIOR O COLEGIO (por ejemplo, "Universidad Siglo 21", universidades nacionales o privadas, campus, facultades, carreras universitarias):
     a) Es una institución de educación orientada a ESTUDIANTES y carreras profesionales.
     b) Si en el catálogo existen categorías o subcategorías que mencionen "Estudiantes", "Para estudiantes", "Universidades", "Educación", "Cursos", "Carreras", "Formación", "Vida universitaria", "Posgrados" o afines, DEBES seleccionarlas en 'categorySelections' y 'subcategorySelections'.
     c) Su actividad económica debe ser de educación (ej. "Educación y formación", "Educación").
     d) Su tipo de oferente debe ser "Institución privada" (para universidades privadas como Siglo 21) u "Organismo público" (para universidades estatales/nacionales). NUNCA ONG.

10. INTELIGENCIA SEMÁNTICA PARA SALUD, OBRAS SOCIALES Y HOSPITALES (MANDATORIA):
   - Si la entidad analizada es una OBRA SOCIAL, HOSPITAL, CLÍNICA, SANATORIO, PREPAGA O CENTRO MÉDICO (por ejemplo, "OSEP Mendoza", hospitales, sanatorios, centros de diagnóstico o salud):
     a) Su actividad económica ('providerActivities') DEBE ser 'Salud y asistencia social' (o la opción de salud disponible en BD).
     b) Si es obra social de empleados públicos u hospital público (ej: OSEP): su tipo de oferente ('providerTypes') DEBE ser 'Organismo público'. Si es clínica privada: 'Institución privada'. NUNCA ONG.
     c) En categorías ('categorySelections') y subcategorías: selecciona todas las opciones del catálogo que mejor definan lo que ofrece (ej: 'Servicio especializado', 'Funcionario público' si es obra social pública, 'Profesional', y cualquier categoría o subcategoría de salud, medicina o trámites que el administrador haya creado en el catálogo).

11. COMPRENSIÓN DINÁMICA DE NUEVAS TAXONOMÍAS CREADAS POR EL ADMINISTRADOR:
   - El catálogo es completamente dinámico y el administrador puede crear nuevas categorías, subcategorías o actividades en cualquier momento.
   - Analiza semánticamente el concepto de CADA opción disponible en las listas abajo y selecciona todas las que coincidan genuinamente con el sitio analizado. NUNCA uses plantillas fijas.

12. ENTENDIMIENTO PROFUNDO DE BLOQUES Y TAXONOMÍAS DEL ADMINISTRADOR:
   - El administrador de Travelgrin crea BLOQUES con nombres específicos (ej: 'Actividad', 'Tipo de Perfil', 'Modalidad en que ofrece sus servicios', 'Categorías y subcategorías', etc.) y les asigna un tipo de taxonomía.
   - Además, dentro de un bloque pueden existir categorías con una taxonomía diferente (por ejemplo, una categoría con taxonomía 'actividad' o 'tipo').
   - Analiza la información de CADA bloque con sus categorías y subcategorías creadas por el admin (SIN USAR PLANTILLAS).
   - Relaciona los títulos de los bloques y las categorías para entender exactamente a qué se refiere cada una.
   - Selecciona ÚNICAMENTE lo que corresponda de forma REAL y EXACTA al sitio web escrapeado:
     a) 'providerActivities': La actividad o sector económico REAL de la organización (ej: si es una universidad -> 'Educación y formación'; si es estudio jurídico / legal -> 'Servicios profesionales y técnicos' o afín; si es cámara de comercio / red de negocios -> 'Actividades de asociaciones y organizaciones' o 'Servicios empresariales'; si es hospital / salud -> 'Salud y asistencia social').
     b) 'providerTypes': El tipo de perfil REAL según lo que es la entidad (ej: si es privada comercial -> 'Institución privada' o 'Empresa'; si es estatal -> 'Organismo público'; etc.).
     c) 'providerModalities': Las modalidades de atención REALES ('Atención presencial' si tiene ubicación física, sedes o campus; 'Atención online' si opera digitalmente, turnos o plataforma; o ambas).
     d) 'categorySelections' y 'subcategorySelections': Las categorías y subcategorías que correspondan al contenido y propuesta de la web.
   - NUNCA inventes 'General' como categoría ni como subcategoría a menos que exista explícitamente en el catálogo. Si no hay subcategorías que apliquen, devuelve array vacío [].

13. DIRECTIVAS ESPECÍFICAS DE CLASIFICACIÓN FACTUAL POR SECTOR:
   a) MODA, INDUMENTARIA Y TEXTIL:
      - Si la entidad o web ofrece moda, ropa, calzado, indumentaria, accesorios de moda, diseño textil, colecciones de temporada o alta costura:
        * 'providerActivities': DEBE ser 'Moda y diseño' (o la opción de moda/diseño disponible en BD).
        * 'categorySelections': Selecciona la/s categoría/s del catálogo que correspondan a moda, indumentaria, diseño o compras.
   b) MEDIOS, CULTURA Y ENTRETENIMIENTO:
      - Si la entidad ofrece espectáculos, teatro, cine, conciertos, música, eventos culturales o recreativos, festivales, arte, producción audiovisual o entretenimiento nocturno:
        * 'providerActivities': DEBE ser 'Medios, cultura y entretenimiento' (o 'Arte, cultura y entretenimiento' según BD).
        * 'categorySelections': Selecciona la/s categoría/s de entretenimiento, cultura o eventos del catálogo.
   c) ASESORAMIENTO LEGAL, VISAS, CIUDADANÍA Y TRÁMITES MIGRATORIOS (ej: consultoras legales, CBI, estudios jurídicos):
        * 'providerActivities': DEBE ser 'Servicios profesionales y técnicos'.
        * PROHIBIDO TERMINANTEMENTE colocar 'Bienes raíces' a una consultora legal o de inmigración (incluso si tramitan residencia por inversión). 'Bienes raíces' es ÚNICAMENTE para agencias inmobiliarias y venta/alquiler de propiedades.
        * 'categorySelections': 'Gestiones migratorias y visas' (o la categoría migratoria/legal correspondiente).
        * 'subcategorySelections': 'Residencia y ciudadanía', 'Visas de entrada', 'Permisos de trabajo', etc. según corresponda a lo que ofrece la web.
   d) BIENES RAÍCES / INMOBILIARIA:
      - Solo seleccionar 'Bienes raíces' si la web es de una empresa inmobiliaria, broker o desarrolladora de inmuebles cuya actividad central sea comprar, vender o alquilar propiedades o lotes.
   e) TECNOLOGÍA Y DIGITAL:
      - 'providerActivities': 'Tecnologías de la información y comunicación' (o 'Tecnología, software e información').
   f) TURISMO Y ALOJAMIENTO:
      - 'providerActivities': 'Hostelería, alojamiento y turismo'.

CATÁLOGO DE BLOQUES, CATEGORÍAS Y SUBCATEGORÍAS DISPONIBLES EN BD:
${categoryTreeFormat}

ACTIVIDADES DISPONIBLES EN BD:
${activitiesPool.map((a) => `"${a}"`).join(", ")}

TIPOS DE PERFIL DISPONIBLES EN BD:
${typesPool.map((t) => `"${t}"`).join(", ")}

MODALIDADES DISPONIBLES EN BD:
${modalitiesPool.map((m) => `"${m}"`).join(", ")}

PRESTACIONES DISPONIBLES EN BD:
${prestacionesPool.map((p) => `"${p}"`).join(", ")}

IDIOMAS DISPONIBLES EN BD:
${languagesPool.map((l) => `"${l}"`).join(", ")}

Responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "category": "...",
  "subcategory": "...",
  "categorySelections": ["..."],
  "subcategorySelections": ["..."],
  "providerActivities": ["..."],
  "providerTypes": ["..."],
  "providerModalities": ["..."],
  "prestaciones": ["..."],
  "languages": ["..."]
}`;

  const snippet = [
    (context.headings || []).slice(0, 15).join(" | "),
    (context.paragraphs || []).slice(0, 12).join("\n"),
    (context.mainText || "").slice(0, 4500),
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = `Lee con detenimiento e infórmate a fondo sobre lo que ofrece esta entidad en su web para clasificarla con máxima precisión en el catálogo cerrado:
- URL: ${context.url}
- Nombre Oferente / Organización: ${context.publisherName}
- Título Detectado: ${context.rawPageTitle || ""}
- Meta Descripción: ${context.metaDescription || ""}
- Ubicación: ${[context.city, context.country].filter(Boolean).join(", ")}
- Contenido relevante y servicios detectados:
${snippet}

INSTRUCCIONES CLAVE DE SELECCIÓN:
1. 'providerActivities': Selecciona la actividad o sector económico REAL de la organización de la lista de ACTIVIDADES DISPONIBLES EN BD (NUNCA pongas "Empresa", "Institución privada" ni tipos de perfil aquí).
2. 'providerTypes': Selecciona el tipo de entidad REAL de la lista de TIPOS DE PERFIL DISPONIBLES EN BD.
3. 'providerModalities': Selecciona la o las modalidades REALES ("Atención presencial" si tiene sede o local físico, "Atención online" si opera de forma digital o remota, o ambas).
4. 'categorySelections': Selecciona la/s categoría/s del catálogo que mejor correspondan a lo que ofrece la entidad según su web.
5. 'subcategorySelections': Selecciona ÚNICAMENTE las subcategorías (hijas de las categorías seleccionadas) que apliquen de verdad a sus servicios. Si ninguna subcategoría aplica, devuelve array vacío []. NO inventes ni fuerces subcategorías innecesarias.
Recuerda: Elige ÚNICAMENTE nombres exactos de las listas provistas.`;

  try {
    let parsed: any = null;
    let providerUsed = "semantic-catalog-engine";

    try {
      const res = await executeModelCall(
        systemPrompt,
        userPrompt,
        context.apiKey,
        context.provider || "auto"
      );
      providerUsed = res.providerUsed;
      parsed = extractJson(res.rawText);
    } catch (errCall: any) {
      console.warn(`[AI-AGENT-DEBUG: TaxonomyAgent] LLM call failed or unavailable, falling back to dynamic catalog evaluation: ${errCall.message}`);
    }

    if (!parsed) {
      parsed = {
        categorySelections: [],
        subcategorySelections: [],
        category: "",
        subcategory: "",
        providerActivities: [],
        providerTypes: [],
        providerModalities: [],
        prestaciones: [],
        languages: ["Español"],
      };
    }

    const fullTextCorpus = `${context.rawPageTitle || ""} ${context.headings?.join(" ") || ""} ${context.paragraphs?.join(" ") || ""} ${context.mainText || ""} ${context.url} ${context.publisherName || ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const isHealthEntity =
      /\b(salud|medico|medica|medicos|medicas|medicina|clinica|hospital|sanatorio|obra social|prepaga|paciente|pacientes|enfermeria|atencion medica|consultorio|consultorios|asistencial|prestaciones medicas|farmacia|odontologia|psicologia|pediatria|traumatologia|cardiologia|osep|ioma|pami|osde|swiss medical)\b/i.test(fullTextCorpus) ||
      /osep|hospital|clinica|sanatorio|salud/i.test(context.url || "");

    const isEducationalEntity =
      /\b(universidad|facultad|carrera|carreras|grado|posgrado|licenciatura|tecnicatura|alumno|alumnos|estudiante|estudiantes|vida estudiantil|campus|matricula|aranceles|inscripciones|ingreso|becas|academico|academica|educacion|educativo|docente|profesorado|instituto superior|colegio|escuela|centro de estudios|siglo 21)\b/i.test(fullTextCorpus) ||
      /\.edu(?:\.[a-z]{2})?/i.test(context.url || "");

    const isLegalOrConsulting =
      /\b(abogado|abogada|abogados|estudio juridico|notario|notaria|escribano|escribania|derecho|legal|migratorio|migracion|visas|visa|ciudadania|residencia|contable|auditoria|consultoria|asesoria fiscal|traduccion publica|cbi argentina|allende|brea)\b/i.test(fullTextCorpus) ||
      /legal|migra|visas|estudio/i.test(context.url || "");

    const isFashionOrDesign =
      /\b(moda|modas|diseno de indumentaria|indumentaria|textil|textiles|vestimenta|ropa|calzado|alta costura|fashion|prendas|confeccion|desfile|coleccion primavera|tendencias de moda|marcas de ropa)\b/i.test(fullTextCorpus);

    const isEntertainmentOrCulture =
      /\b(entretenimiento|espectaculo|espectaculos|teatro|cine|musica|concierto|conciertos|arte|cultura|cultural|eventos culturales|festival|festivales|recreacion|audiovisual|productora|producciones|galeria de arte|museo|museos|discoteca|boliche|ocio)\b/i.test(fullTextCorpus);

    const isRealEstate =
      /\b(inmobiliaria|inmobiliario|bienes raices|alquiler de propiedades|venta de casas|inmuebles|real estate|desarrollos inmobiliarios|lotes|terrenos)\b/i.test(fullTextCorpus) &&
      !isLegalOrConsulting;

    const isTourismEntity =
      /\b(hotel|hostel|alojamiento|hospedaje|posada|cabaña|cabañas|resort|turismo|viajes|excursion|excursiones|agencia de viajes|tour|tours)\b/i.test(fullTextCorpus);

    const isTechEntity =
      /\b(software|tecnologia|tecnologias|app|aplicacion|sistemas|desarrollo web|programacion|informatica|it|ciberseguridad|telecomunicaciones|saas|plataforma digital)\b/i.test(fullTextCorpus);

    const isAuthenticOng =
      (/\.org(?:\.[a-z]{2})?|\.ngo(?:\.[a-z]{2})?/i.test(context.url || "")) &&
      /\b(sin fines de lucro|organismo no gubernamental|asociacion civil sin fines de lucro|fundacion sin fines de lucro|donaciones para la fundacion)\b/i.test(fullTextCorpus) &&
      !isEducationalEntity &&
      !isHealthEntity &&
      !/\b(empresa s\.a\.|empresa s\.r\.l\.|sociedad anonima|startup|e-commerce|tienda online|hotel|agencia de viajes|clinica privada|sanatorio privado)\b/i.test(fullTextCorpus);

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

    // Strict multi-select category validation against DB pool
    const rawCategories: string[] = [
      ...(Array.isArray(parsed.categorySelections) ? parsed.categorySelections : []),
      parsed.category,
    ]
      .map((c) => String(c || "").trim())
      .filter(Boolean)
      .filter((c) => isAuthenticOng || !isOngMatch(c));

    let matchedCats = matchToCatalogPool(rawCategories, categoriesPool);

    // If educational entity, proactively ensure student/education categories from pool are included
    if (isEducationalEntity) {
      const eduPoolCategories = categoriesPool.filter(isStudentEduMatch);
      for (const eduCat of eduPoolCategories) {
        if (!matchedCats.includes(eduCat)) {
          matchedCats.push(eduCat);
        }
      }
    }

    if (isLegalOrConsulting) {
      const migraCat = categoriesPool.find((c) => /gesti[oó]n.*migra|visas/i.test(c));
      if (migraCat && !matchedCats.includes(migraCat)) {
        matchedCats.push(migraCat);
      }
    }

    if (isFashionOrDesign) {
      const fashionCat = categoriesPool.find((c) => /moda|dise[nñ]o|indumentaria|textil/i.test(c));
      if (fashionCat && !matchedCats.includes(fashionCat)) {
        matchedCats.push(fashionCat);
      }
    }

    if (isEntertainmentOrCulture) {
      const entCat = categoriesPool.find((c) => /entretenimiento|cultura|arte|espect[aá]culo/i.test(c));
      if (entCat && !matchedCats.includes(entCat)) {
        matchedCats.push(entCat);
      }
    }

    // Filter out ONG categories if not an authentic ONG
    if (!isAuthenticOng) {
      matchedCats = matchedCats.filter((c) => !isOngMatch(c));
    }

    const nonOngPool = isAuthenticOng ? categoriesPool : categoriesPool.filter((c) => !isOngMatch(c));

    // Dynamic semantic matching across all available DB categories if AI did not return a valid exact match
    if (matchedCats.length === 0 && nonOngPool.length > 0) {
      const scoredCats: { cat: string; score: number }[] = [];
      for (const catName of nonOngPool) {
        const cNorm = catName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const cTokens = cNorm.split(/\s+/).filter((t) => t.length > 3 && !/para|sobre|centros|servicios|general/i.test(t));
        let score = 0;

        // Hard negative constraint: If entity is medical/health, NEVER match visa/migration categories!
        if (isHealthEntity && /visa|migra|residencia|ciudadan|pasaporte/i.test(cNorm)) {
          continue;
        }
        // If entity is university/education, NEVER match visa/migration categories
        if (isEducationalEntity && /visa|migra/i.test(cNorm)) {
          continue;
        }

        if (fullTextCorpus.includes(cNorm)) score += 50;
        for (const tok of cTokens) {
          if (fullTextCorpus.includes(tok)) score += 15;
        }

        // Check child subcategories belonging to this category in the categoryTree
        if (taxonomies?.categoryTree?.length) {
          const allParentNodes = taxonomies.categoryTree.flatMap((b) => b.parentCategories);
          const matchedNode = allParentNodes.find((p) => p.name.toLowerCase() === catName.toLowerCase());
          if (matchedNode && Array.isArray(matchedNode.subcategories)) {
            for (const sub of matchedNode.subcategories) {
              const sNorm = sub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              const sTokens = sNorm.split(/\s+/).filter((t) => t.length > 3 && !/para|sobre|general/i.test(t));
              if (fullTextCorpus.includes(sNorm)) score += 35;
              for (const tok of sTokens) {
                if (fullTextCorpus.includes(tok)) score += 10;
              }
            }
          }
        }

        if (isEducationalEntity && isStudentEduMatch(catName)) score += 60;
        if (isHealthEntity && /salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|obra\s*social|prepaga/i.test(cNorm)) score += 80;

        if (score >= 25) {
          scoredCats.push({ cat: catName, score });
        }
      }

      scoredCats.sort((a, b) => b.score - a.score);
      if (scoredCats.length > 0) {
        matchedCats = [scoredCats[0].cat];
        if (scoredCats[1] && scoredCats[1].score >= 35 && scoredCats[1].score >= scoredCats[0].score * 0.7) {
          matchedCats.push(scoredCats[1].cat);
        }
      }
    }

    // Safety guardrail: Medical entities must NEVER contain visa or immigration categories
    if (isHealthEntity) {
      matchedCats = matchedCats.filter((c) => !/visa|migra|residencia|ciudadan|pasaporte/i.test(c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    }

    // Never output "General" if not explicitly part of the categories pool in DB
    const finalCategories = matchedCats.filter((c) => c !== "General" || categoriesPool.includes("General"));
    const finalCat = finalCategories[0] || "";

    // Collect all valid subcategories belonging to any of the selected categories
    let validSubcatPool: string[] = [];
    if (taxonomies?.categoryTree?.length) {
      const allParentNodes = taxonomies.categoryTree.flatMap((b) => b.parentCategories);
      finalCategories.forEach((catName) => {
        const matchedNode = allParentNodes.find((p) => p.name.toLowerCase() === catName.toLowerCase());
        if (matchedNode && Array.isArray(matchedNode.subcategories) && matchedNode.subcategories.length > 0) {
          validSubcatPool.push(...matchedNode.subcategories);
        }
      });
    }
    if (validSubcatPool.length === 0 && finalCategories.length === 0) {
      validSubcatPool = subcategoriesPool;
    }
    validSubcatPool = Array.from(new Set(validSubcatPool.filter(Boolean)));
    if (!isAuthenticOng) {
      validSubcatPool = validSubcatPool.filter((s) => !isOngMatch(s));
    }

    // Strict multi-select subcategory validation
    const rawSubcategories: string[] = [
      ...(Array.isArray(parsed.subcategorySelections) ? parsed.subcategorySelections : []),
      parsed.subcategory,
    ]
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .filter((s) => isAuthenticOng || !isOngMatch(s));

    let matchedSubs = matchToCatalogPool(rawSubcategories, validSubcatPool);

    // Only if the AI returned no subcategories at all, check if an exact subcategory phrase exists in the text
    if (matchedSubs.length === 0 && rawSubcategories.length === 0 && validSubcatPool.length > 0) {
      for (const sub of validSubcatPool) {
        if (matchedSubs.includes(sub)) continue;
        if (!isAuthenticOng && isOngMatch(sub)) continue;

        const sNorm = sub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (isHealthEntity && /visa|migra|residencia|ciudadan|pasaporte/i.test(sNorm)) continue;
        if (isEducationalEntity && /visa|migra/i.test(sNorm)) continue;

        // Require genuine presence of the full subcategory name in scraped text
        if (sNorm.length >= 4 && fullTextCorpus.includes(sNorm)) {
          matchedSubs.push(sub);
        }
      }
    }

    if (!isAuthenticOng) {
      matchedSubs = matchedSubs.filter((s) => !isOngMatch(s));
    }
    if (isHealthEntity) {
      matchedSubs = matchedSubs.filter((s) => !/visa|migra|residencia|ciudadan|pasaporte/i.test(s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    }

    // Strip phantom "General" if not explicitly in subcategories catalog
    matchedSubs = matchedSubs.filter((s) => s !== "General" || subcategoriesPool.includes("General"));

    // Completely remove blind fallback to validSubcatPool[0]: If no subcategory legitimately matches, leave empty
    const finalSub = matchedSubs[0] || "";

    // Activities: strictly match against activitiesPool and NEVER allow items from typesPool (e.g. Empresa)
    const rawActivities = Array.isArray(parsed.providerActivities) ? parsed.providerActivities : [parsed.providerActivities];
    const matchedActivities = matchToCatalogPool(rawActivities, activitiesPool);
    let cleanActivities = matchedActivities.filter((a) => !typesPool.includes(a));

    if (isEducationalEntity) {
      const eduAct = activitiesPool.find((a) => /educaci|formaci|ensenan/i.test(a));
      if (eduAct && !cleanActivities.includes(eduAct)) {
        cleanActivities = [eduAct, ...cleanActivities];
      }
    }

    if (isHealthEntity) {
      const healthAct = activitiesPool.find((a) => /salud|asistencia|social|medic/i.test(a));
      if (healthAct && !cleanActivities.includes(healthAct)) {
        cleanActivities = [healthAct, ...cleanActivities];
      }
    }

    if (isFashionOrDesign) {
      const fashionAct = activitiesPool.find((a) => /moda|dise[nñ]o|textil/i.test(a));
      if (fashionAct && !cleanActivities.includes(fashionAct)) {
        cleanActivities = [fashionAct, ...cleanActivities];
      }
    }

    if (isEntertainmentOrCulture) {
      const entAct = activitiesPool.find((a) => /entretenimiento|cultura|arte|medio/i.test(a));
      if (entAct && !cleanActivities.includes(entAct)) {
        cleanActivities = [entAct, ...cleanActivities];
      }
    }

    if (isLegalOrConsulting) {
      const legalAct = activitiesPool.find((a) => /profesional|tecnico|legal|consult|jurid/i.test(a));
      if (legalAct && !cleanActivities.includes(legalAct)) {
        cleanActivities = [legalAct, ...cleanActivities];
      }
      // Strictly prevent false real estate assignment
      cleanActivities = cleanActivities.filter((a) => !/bienes\s*ra[ií]ces|inmobiliari/i.test(a));
    }

    if (cleanActivities.length === 0 && activitiesPool.length > 0) {
      const sanitizedPool = activitiesPool.filter((a) => !typesPool.includes(a));
      const poolToUse = sanitizedPool.length > 0 ? sanitizedPool : activitiesPool;
      const scoredActsList: { act: string; score: number }[] = [];
      for (const act of poolToUse) {
        const aNorm = act.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const aTokens = aNorm.split(/\s+/).filter((t) => t.length > 3 && !/para|sobre|servicios/i.test(t));
        let score = 0;
        if (fullTextCorpus.includes(aNorm)) score += 40;
        for (const tok of aTokens) {
          if (fullTextCorpus.includes(tok)) score += 15;
        }
        if (isHealthEntity && /salud|asistencia|social|medic/i.test(aNorm)) {
          score += 60;
        }
        if (isEducationalEntity && /educaci|formaci/i.test(aNorm)) {
          score += 60;
        }
        if (isLegalOrConsulting && /profesional|tecnico|legal|consult/i.test(aNorm)) {
          score += 70;
        }
        if (isLegalOrConsulting && /bienes\s*ra[ií]ces|inmobiliari/i.test(aNorm)) {
          continue; // NEVER score real estate for legal consultancies!
        }
        if (isFashionOrDesign && /moda|dise[nñ]o|textil/i.test(aNorm)) {
          score += 70;
        }
        if (isEntertainmentOrCulture && /entretenimiento|cultura|arte|medio/i.test(aNorm)) {
          score += 70;
        }
        if (isTechEntity && /tecnolog|informaci|comunicaci/i.test(aNorm)) {
          score += 50;
        }
        if (isTourismEntity && /hosteler|alojam|turism/i.test(aNorm)) {
          score += 50;
        }
        if (score > 0) scoredActsList.push({ act, score });
      }
      scoredActsList.sort((a, b) => b.score - a.score);
      if (scoredActsList.length > 0) {
        cleanActivities.push(scoredActsList[0].act);
        if (scoredActsList[1] && scoredActsList[1].score >= 25 && scoredActsList[1].score >= scoredActsList[0].score * 0.6) {
          cleanActivities.push(scoredActsList[1].act);
        }
      } else if (poolToUse[0]) {
        cleanActivities.push(poolToUse[0]);
      }
    }

    let matchedTypes = matchToCatalogPool(
      Array.isArray(parsed.providerTypes) ? parsed.providerTypes : [parsed.providerTypes],
      typesPool
    );

    if (!isAuthenticOng) {
      matchedTypes = matchedTypes.filter((t) => !isOngMatch(t));
    }

    if (isEducationalEntity && matchedTypes.length === 0) {
      const isPublicGov =
        /\b(\.gov|\.gob|\.mil)\b/i.test(context.url || "") ||
        /\b(universidad nacional|hospital publico|organismo publico|ministerio|gobierno)\b/i.test(fullTextCorpus);
      const chosenType = isPublicGov
        ? typesPool.find((t) => /p[uú]blico|estatal/i.test(t))
        : typesPool.find((t) => /privada|empresa/i.test(t));
      if (chosenType) matchedTypes.push(chosenType);
    }

    const matchedModalities = matchToCatalogPool(
      Array.isArray(parsed.providerModalities) ? parsed.providerModalities : [parsed.providerModalities],
      modalitiesPool
    );

    if (matchedModalities.length === 0 && modalitiesPool.length > 0) {
      const presencial = modalitiesPool.find((m) => /presencial/i.test(m));
      const online = modalitiesPool.find((m) => /online|virtual/i.test(m));
      const hasOnlineMention = /online|virtual|remoto|a distancia|zoom|meet|plataforma|app|web|portal|turnos/i.test(fullTextCorpus);
      const hasPresencialMention = /sede|sedes|sucursal|sucursales|consultorio|consultorios|campus|ubicacion|direccion|atencion presencial|visitanos|delegacion|delegaciones/i.test(fullTextCorpus);
      if (hasPresencialMention && presencial) matchedModalities.push(presencial);
      if (hasOnlineMention && online) matchedModalities.push(online);
      if (matchedModalities.length === 0) {
        if (presencial) matchedModalities.push(presencial);
        if (online) matchedModalities.push(online);
      }
    }

    const matchedPrestaciones = matchToCatalogPool(
      Array.isArray(parsed.prestaciones) ? parsed.prestaciones : [parsed.prestaciones],
      prestacionesPool
    );

    const matchedLanguages = matchToCatalogPool(
      Array.isArray(parsed.languages) ? parsed.languages : [parsed.languages],
      languagesPool
    );

    return {
      success: true,
      data: {
        category: finalCat,
        subcategory: finalSub,
        categorySelections: finalCategories,
        subcategorySelections: matchedSubs,
        providerActivities: cleanActivities.length ? cleanActivities : (activitiesPool.filter((a) => !typesPool.includes(a)).slice(0, 1)),
        providerTypes: matchedTypes.length ? matchedTypes : (typesPool.slice(0, 1)),
        providerModalities: matchedModalities.length ? matchedModalities : (modalitiesPool.slice(0, 2)),
        prestaciones: matchedPrestaciones,
        languages: matchedLanguages.length ? matchedLanguages : ["Español"],
      },
      estado: "ok",
      evidencias: [context.url, context.publisherName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: TaxonomyAgent] ERROR: ${err.message}`);
    return {
      success: false,
      data: null,
      estado: "sin_datos",
      evidencias: [],
      providerUsed: "none",
      error: `Error al clasificar taxonomía con IA: ${err.message}`,
    };
  }
}

// ============================================================================
// 6. HELPER PARA LIMPIEZA DE CONTENIDO SCRAPEADO
// ============================================================================
export function cleanScrapedHtmlText(html: string): {
  headings: string[];
  paragraphs: string[];
  mainText: string;
} {
  if (!html) return { headings: [], paragraphs: [], mainText: "" };

  function decodeEntities(str: string): string {
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

  // Strip scripts, styles, iframes, nav, footer, headers, cookies notices, etc.
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Extract headings h1, h2, h3
  const headings: string[] = [];
  const hRegex = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let hMatch: RegExpExecArray | null;
  while ((hMatch = hRegex.exec(cleaned)) !== null) {
    const text = decodeEntities(hMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length > 3 && text.length < 120 && !/cookies|men[uú]|login|iniciar|buscar|search/i.test(text)) {
      headings.push(text);
    }
  }

  // Extract paragraphs
  const paragraphs: string[] = [];
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(cleaned)) !== null) {
    const text = decodeEntities(pMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length > 25 && !/cookies|pol[ií]tica de privacidad|todos los derechos reservados|copyright/i.test(text)) {
      paragraphs.push(text);
    }
  }

  const plainText = decodeEntities(cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

  return {
    headings: Array.from(new Set(headings)).slice(0, 15),
    paragraphs: Array.from(new Set(paragraphs)).slice(0, 15),
    mainText: plainText.slice(0, 4000),
  };
}

// ============================================================================
// 7. UNIFIED PUBLICATION AGENT (UN SOLO LLAMADO DE IA INTEGRAL DE MÁXIMA EFICIENCIA)
// ============================================================================
export interface UnifiedPublicationInput {
  context: CleanScrapedContext;
  customTitlePrompt?: string;
  customDescriptionPrompt?: string;
  customBlocks?: CustomScraperBlock[];
  taxonomies?: any;
  includeScoreScout?: boolean;
}

export interface UnifiedPublicationOutput {
  title: string;
  titleI18n: I18nRecord;
  description: string;
  descriptionI18n: I18nRecord;
  extraDescriptions: ExtraDescriptionBlock[];
  providerInfo: string;
  providerInfoI18n: I18nRecord;
  detectedPublisherName?: string;
  detectedAddress?: string;
  detectedCity?: string;
  detectedCountry?: string;
  taxonomyData: TaxonomyAgentData;
  providerUsed: string;
}

export async function runUnifiedPublicationAgent(
  input: UnifiedPublicationInput
): Promise<AgentResult<UnifiedPublicationOutput>> {
  const { context, taxonomies } = input;
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const titlePrompt = (input.customTitlePrompt || "").trim();
  const descPrompt = (input.customDescriptionPrompt || "").trim();
  const customBlocksList = Array.isArray(input.customBlocks)
    ? input.customBlocks.filter((b) => b && b.title && b.title.trim())
    : [];

  const catPool: string[] = taxonomies?.categories || [];
  const subPool: string[] = taxonomies?.subcategories || [];
  const activitiesPool: string[] = taxonomies?.activities || [];
  const typesPool: string[] = taxonomies?.types || [];
  const modalitiesPool: string[] = taxonomies?.modalities || [];

  let customBlocksDirective = "";
  if (customBlocksList.length > 0) {
    customBlocksDirective =
      `\n=== BLOQUES PERSONALIZADOS OBLIGATORIOS (DEBES GENERAR CADA UNO EN "customBlocks") ===\n` +
      customBlocksList
        .map(
          (b, i) =>
            `[Bloque ${i + 1}] Título: "${b.title}"\nDirectiva del administrador: "${b.prompt || "Generar contenido estructurado y relevante para este bloque."}"`
        )
        .join("\n\n");
  }

  const systemPrompt = `Eres el Director Editorial y Redactor Senior de Travelgrin.
Tu objetivo es auditar el sitio web y generar una publicación completa, atractiva y de alta calidad para la entidad, CUMPLIENDO RIGUROSAMENTE LAS DIRECTIVAS EDITORIALES DEL ADMINISTRADOR.

HIERARQUÍA DE AUTORIDAD EDITORIAL (REGLAS SUPREMAS):
1. AUTORIDAD EDITORIAL SUPREMA: Las instrucciones del administrador son la regla NÚMERO UNO:
   - TÍTULO: Si el administrador pide enfoque de marketing, especialista en conversión o título que llame la atención, REDACTA UN TÍTULO COMERCIAL IMPACTANTE. NUNCA devuelvas solo el nombre seco de la entidad si se pidió impacto comercial.
   - DESCRIPCIÓN PRINCIPAL: Si el administrador pide una cantidad exacta de párrafos (ej: "5 párrafos"), REDACTA EXACTAMENTE ESA CANTIDAD DE PÁRRAFOS. Si pide subtítulos/títulos en negrita o letras negras y su explicación, estructura cada párrafo como <p><strong>Título del Párrafo</strong><br/>Explicación persuasiva y detallada...</p>. Si pide tono de marketing o conversión, aplícalo.
   - BLOQUES PERSONALIZADOS: Genera cada bloque solicitado en el array "customBlocks". Si pide Preguntas Frecuentes, formula preguntas inteligentes y respuestas claras sobre los servicios del sitio en formato HTML (<p><strong>¿Pregunta?</strong><br/>Respuesta...</p>). Si pidió cantidad o colores específicos, cúmplelo.
2. CERO PLANTILLAS RÍGIDAS FIJAS: No uses esquemas estáticos repetitivos. Cada publicación debe redactarse a medida según la actividad real de la entidad y las instrucciones del administrador.
3. Fidelidad factual: Basa los textos en los servicios, ofertas, propuestas y datos reales de la web de "${entityName}".
4. Formato estricto: Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura:
{
  "title": "Título comercial y atractivo",
  "titleI18n": { "es": "Título", "en": "Title", "pt": "Título", "it": "Titolo" },
  "description": "<p>Primer párrafo...</p><p>Segundo párrafo...</p>",
  "descriptionI18n": { "es": "<p>...</p>", "en": "<p>...</p>", "pt": "<p>...</p>", "it": "<p>...</p>" },
  "customBlocks": [
    {
      "title": "Nombre del bloque",
      "body": "<p>Contenido HTML...</p>",
      "bodyI18n": { "es": "<p>...</p>", "en": "<p>...</p>", "pt": "<p>...</p>", "it": "<p>...</p>" }
    }
  ],
  "providerInfo": "Resumen institucional conciso de 1 o 2 oraciones",
  "providerInfoI18n": { "es": "...", "en": "...", "pt": "...", "it": "..." },
  "detectedPublisherName": "Nombre oficial completo de la entidad (resolviendo siglas si aplica)",
  "detectedAddress": "Dirección física vigente del pie de página o contacto",
  "category": "Nombre exacto de categoría del catálogo",
  "subcategory": "Nombre exacto de subcategoría del catálogo",
  "providerActivities": ["Actividad del catálogo"],
  "providerTypes": ["Tipo del catálogo"],
  "providerModalities": ["Modalidad del catálogo"]
}`;

  const userPrompt = `=== DIRECTIVAS EDITORIALES DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
1. DIRECTIVA PARA EL TÍTULO:
"${titlePrompt || "Crear un título claro, comercial, atractivo y representativo que presente al establecimiento y su propuesta principal."}"

2. DIRECTIVA PARA LA DESCRIPCIÓN PRINCIPAL:
"${descPrompt || "Escribir una descripción profesional en párrafos HTML <p> explicando qué ofrece, su alcance y vías oficiales."}"
${customBlocksDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- URL: "${context.url}"
- Nombre preliminar detectado: "${entityName}"
- Título original de la web: "${context.rawPageTitle || entityName}"
- Meta descripción de la web: "${context.metaDescription || "N/A"}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales del sitio: ${(context.headings || []).slice(0, 12).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 10).join(" | ") || "N/A"}
- Párrafos de texto extraídos de la web:
${(context.paragraphs || []).slice(0, 8).join("\n\n") || (context.mainText?.slice(0, 2500) || "N/A")}

=== CATÁLOGO DE TAXONOMÍA (SELECCIONAR VALORES EXACTOS DE AQUÍ) ===
- Categorías disponibles: ${catPool.slice(0, 20).join(", ") || "General"}
- Subcategorías disponibles: ${subPool.slice(0, 25).join(", ") || "General"}
- Actividades disponibles: ${activitiesPool.slice(0, 15).join(", ") || "Servicios"}
- Tipos de oferente disponibles: ${typesPool.slice(0, 15).join(", ") || "Empresa"}
- Modalidades disponibles: ${modalitiesPool.slice(0, 10).join(", ") || "Presencial"}

GENERA EL OBJETO JSON COMPLETO CUMPLIENDO ESTRICTAMENTE TODAS LAS DIRECTIVAS EDITORIALES DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT-DEBUG: UnifiedPublicationAgent] URL: ${context.url}`);
  console.log(`- Title Prompt: "${titlePrompt || "(estándar)"}"`);
  console.log(`- Desc Prompt: "${descPrompt || "(estándar)"}"`);
  console.log(`- Custom Blocks: ${customBlocksList.length}`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto",
      3500
    );

    const parsed = extractJson(rawText);
    if (!parsed) {
      throw new Error("No se pudo parsear el JSON de la respuesta unificada.");
    }

    // 1. TÍTULO
    let rawTitle = String(parsed.title || parsed.titleI18n?.es || parsed.titulo || "").trim();
    if (/^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo)$/i.test(rawTitle)) {
      rawTitle = "";
    }
    const cleanTitle = cleanTitleString(rawTitle) || entityName;
    const titleI18n: I18nRecord = {
      es: cleanTitle,
      en: parsed.titleI18n?.en || cleanTitle,
      pt: parsed.titleI18n?.pt || cleanTitle,
      it: parsed.titleI18n?.it || cleanTitle,
    };

    // 2. DESCRIPCIÓN PRINCIPAL
    let rawDesc = String(parsed.description || parsed.descriptionI18n?.es || parsed.descripcion || parsed.contenido || "").trim();
    if (!rawDesc.includes("<p>") && rawDesc) {
      rawDesc = rawDesc
        .split(/\n\s*\n+/)
        .map((p: string) => p.trim())
        .filter(Boolean)
        .map((p: string) => `<p>${p}</p>`)
        .join("\n");
    }
    if (!rawDesc || rawDesc.length < 10) {
      throw new Error("Descripción unificada vacía o inválida.");
    }
    const descriptionI18n: I18nRecord = {
      es: rawDesc,
      en: parsed.descriptionI18n?.en || rawDesc,
      pt: parsed.descriptionI18n?.pt || rawDesc,
      it: parsed.descriptionI18n?.it || rawDesc,
    };

    // 3. BLOQUES PERSONALIZADOS
    const extraDescriptions: ExtraDescriptionBlock[] = [];
    const parsedBlocks = Array.isArray(parsed.customBlocks) ? parsed.customBlocks : [];

    for (let i = 0; i < customBlocksList.length; i++) {
      const cb = customBlocksList[i];
      const bTitle = cleanGenericBlockTitle(cb.title, cb.prompt);
      const matched =
        parsedBlocks.find((pb: any) =>
          pb &&
          typeof pb.title === "string" &&
          (pb.title.toLowerCase().includes(bTitle.toLowerCase()) || bTitle.toLowerCase().includes(pb.title.toLowerCase()))
        ) || parsedBlocks[i];

      let bodyHtml = String(matched?.body || matched?.contenido || matched?.description || "").trim();
      if (!bodyHtml.includes("<p>") && bodyHtml) {
        bodyHtml = bodyHtml
          .split(/\n\s*\n+/)
          .map((p: string) => p.trim())
          .filter(Boolean)
          .map((p: string) => `<p>${p}</p>`)
          .join("\n");
      }

      if (!bodyHtml || bodyHtml.length < 10) {
        // Fallback a generación individual
        try {
          const indiv = await runCustomBlockAgent(context, cb.title, cb.prompt);
          bodyHtml = indiv.body;
        } catch {
          bodyHtml = `<p>Información detallada sobre ${bTitle} disponible en el sitio oficial.</p>`;
        }
      }

      extraDescriptions.push({
        title: bTitle,
        titleI18n: {
          es: bTitle,
          en: matched?.titleI18n?.en || bTitle,
          pt: matched?.titleI18n?.pt || bTitle,
          it: matched?.titleI18n?.it || bTitle,
        },
        body: bodyHtml,
        bodyI18n: {
          es: bodyHtml,
          en: matched?.bodyI18n?.en || bodyHtml,
          pt: matched?.bodyI18n?.pt || bodyHtml,
          it: matched?.bodyI18n?.it || bodyHtml,
        },
        visibleInCard: false,
        estado: "ok",
        prompt: cb.prompt,
      });
    }

    // 4. INFORMACIÓN DEL PROVEEDOR
    let pInfo = String(parsed.providerInfo || parsed.providerInfoI18n?.es || "").trim();
    if (!pInfo) {
      pInfo = `${entityName} es un establecimiento y prestador de servicios${locationText ? ` con sede en ${locationText}` : ""}.`;
    }
    const providerInfoI18n: I18nRecord = {
      es: pInfo,
      en: parsed.providerInfoI18n?.en || pInfo,
      pt: parsed.providerInfoI18n?.pt || pInfo,
      it: parsed.providerInfoI18n?.it || pInfo,
    };

    // 5. TAXONOMÍA
    const matchedCats = matchToCatalogPool(
      Array.isArray(parsed.categorySelections) ? parsed.categorySelections : (parsed.category ? [parsed.category] : []),
      catPool
    );
    const matchedSubs = matchToCatalogPool(
      Array.isArray(parsed.subcategorySelections) ? parsed.subcategorySelections : (parsed.subcategory ? [parsed.subcategory] : []),
      subPool
    );
    const matchedActs = matchToCatalogPool(
      Array.isArray(parsed.providerActivities) ? parsed.providerActivities : [],
      activitiesPool
    );
    const matchedTypes = matchToCatalogPool(
      Array.isArray(parsed.providerTypes) ? parsed.providerTypes : [],
      typesPool
    );
    const matchedModalities = matchToCatalogPool(
      Array.isArray(parsed.providerModalities) ? parsed.providerModalities : [],
      modalitiesPool
    );

    const taxonomyData: TaxonomyAgentData = {
      category: matchedCats[0] || catPool[0] || "",
      subcategory: matchedSubs[0] || subPool[0] || "",
      categorySelections: matchedCats.length ? matchedCats : (matchedCats[0] ? [matchedCats[0]] : []),
      subcategorySelections: matchedSubs.length ? matchedSubs : (matchedSubs[0] ? [matchedSubs[0]] : []),
      providerActivities: matchedActs.length ? matchedActs : (activitiesPool.slice(0, 1)),
      providerTypes: matchedTypes.length ? matchedTypes : (typesPool.slice(0, 1)),
      providerModalities: matchedModalities.length ? matchedModalities : (modalitiesPool.slice(0, 2)),
      prestaciones: Array.isArray(parsed.prestaciones) ? parsed.prestaciones : [],
      languages: ["Español"],
    };

    return {
      success: true,
      data: {
        title: cleanTitle,
        titleI18n,
        description: rawDesc,
        descriptionI18n,
        extraDescriptions,
        providerInfo: pInfo,
        providerInfoI18n,
        detectedPublisherName: cleanTitleString(String(parsed.detectedPublisherName || "").trim()) || undefined,
        detectedAddress: cleanTitleString(String(parsed.detectedAddress || "").trim()) || undefined,
        detectedCity: cleanTitleString(String(parsed.city || "").trim()) || undefined,
        detectedCountry: cleanTitleString(String(parsed.country || "").trim()) || undefined,
        taxonomyData,
        providerUsed,
      },
      estado: "ok",
      evidencias: [entityName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: UnifiedPublicationAgent] ERROR: ${err.message}`);
    return {
      success: false,
      data: null,
      estado: "sin_datos",
      evidencias: [],
      providerUsed: "none",
      error: `Error en agente unificado: ${err.message}`,
    };
  }
}

