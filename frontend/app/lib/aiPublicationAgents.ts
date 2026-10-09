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
  return title
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—|]\s*(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*$/i, "")
    .replace(/^(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*[-–—|]\s*/i, "")
    .trim();
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
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {}
  }
  try {
    return JSON.parse(trimmed);
  } catch {}
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.substring(first, last + 1));
    } catch {}
  }
  return null;
}

// ----------------------------------------------------------------------------
let cachedWorkingGeminiModel: string | null = "gemini-1.5-flash";

// ----------------------------------------------------------------------------
// Provider Dispatcher (Gemini -> OpenAI -> Controlled Error)
// ----------------------------------------------------------------------------
async function executeModelCall(
  systemPrompt: string,
  userPrompt: string,
  apiKeyParam?: string,
  preferredProvider: "auto" | "gemini" | "openai" = "auto"
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
      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.85,
          responseMimeType: "application/json",
        },
      };

      const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        4500
      );

      if (res.ok) {
        const json = await res.json();
        const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (raw) return raw;
      } else if (res.status === 429) {
        // Breve espera de 300ms y reintento por rate-limit
        await new Promise((r) => setTimeout(r, 300));
        const retryRes = await fetchWithTimeout(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
          4500
        );
        if (retryRes.ok) {
          const json = await retryRes.json();
          const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (raw) return raw;
        }
      }
      return null;
    };

    // 1. Fast-path: Usar modelo en caché (o predeterminado gemini-1.5-flash) directamente en <1s
    if (cachedWorkingGeminiModel) {
      try {
        const result = await callModel(cachedWorkingGeminiModel);
        if (result) return result;
        cachedWorkingGeminiModel = null;
      } catch {
        cachedWorkingGeminiModel = null;
      }
    }

    // 2. Probar candidatos conocidos oficiales (ultra rápidos)
    const candidateModels = [
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash-8b",
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

    // 3. Si ninguno de los candidatos estándar funcionó, consultar ModelService.ListModels como último recurso
    try {
      const listRes = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        { method: "GET" },
        5000
      );
      if (listRes.ok) {
        const listJson = await listRes.json();
        const available = (listJson.models || [])
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
          } catch {}
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

  const systemPrompt = `Eres un redactor profesional de títulos para Travelgrin.
Tu objetivo primordial es cumplir fielmente la directiva editorial del administrador.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "estado": "ok",
  "contenido": "Título redactado aquí",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL: La directiva del administrador es la regla SUPREMA. Si el administrador solicita un estilo específico, tono, longitud exacta (ej: cantidad de palabras o caracteres), palabras obligatorias o exclusiones, DEBES CUMPLIRLO AL 100%.
2. Fidelidad factual: Usa los datos reales del sitio web (nombre, ubicación, especialidad) sin inventar hechos que contradigan la realidad.
3. Formato estricto: Devuelve únicamente el objeto JSON sin texto adicional fuera del JSON.`;

  const userPrompt = `=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
"${prompt || "Crear un título claro, comercial y profesional que mencione el nombre del establecimiento y su propuesta principal."}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 8).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 6).join(" | ") || "N/A"}
- Resumen y párrafos de la web: "${(context.metaDescription || context.paragraphs?.slice(0, 3).join(" ") || context.mainText?.slice(0, 500) || "").slice(0, 600)}"

GENERA ÚNICAMENTE EL TÍTULO EN ESPAÑOL DENTRO DEL JSON CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT-DEBUG: TitleAgent]`);
  console.log(`1. URL: ${context.url}`);
  console.log(`2. Admin Title Prompt: "${prompt || "(Sin prompt personalizado, usando instrucción básica)"}"`);
  console.log(`3. Final User Prompt:\n${userPrompt}`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto"
    );

    console.log(`4. Provider Used: ${providerUsed}`);
    console.log(`5. Raw Model Response: ${rawText}`);

    const parsed = extractJson(rawText);
    let rawTitle = String(
      parsed?.contenido ||
      parsed?.title ||
      parsed?.titulo ||
      parsed?.nombre ||
      parsed?.text ||
      parsed?.resultado ||
      ""
    ).trim();

    if (!rawTitle) {
      // Fallback: Si el modelo devolvió texto plano o markdown
      const cleanedRaw = rawText
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .replace(/^["'{}\s]+|["'{}\s]+$/g, "")
        .trim();
      const firstLine = cleanedRaw.split("\n")[0].trim();
      if (firstLine && firstLine.length >= 2 && firstLine.length <= 160) {
        rawTitle = firstLine;
      }
    }

    if (!rawTitle || rawTitle.length < 2) {
      throw new Error("El modelo devolvió un título vacío o no estructurado.");
    }

    const cleanTitle = cleanTitleString(rawTitle);
    console.log(`6. Normalized Title Output: "${cleanTitle}"`);
    console.log(`7. Validation: OK (Cumple JSON y contenido no vacío)`);

    let tEn = cleanTitle;
    let tPt = cleanTitle;
    let tIt = cleanTitle;
    if (context.autoTranslate !== false) {
      try {
        [tEn, tPt, tIt] = await Promise.all([
          translateText(cleanTitle, "es", "en"),
          translateText(cleanTitle, "es", "pt"),
          translateText(cleanTitle, "es", "it"),
        ]);
      } catch (transErr) {
        console.warn(`[AI-AGENT-DEBUG: TitleAgent] Error no fatal en traducción:`, transErr);
      }
    }

    return {
      success: true,
      data: {
        title: cleanTitle,
        titleI18n: { es: cleanTitle, en: tEn || cleanTitle, pt: tPt || cleanTitle, it: tIt || cleanTitle },
      },
      estado: "ok",
      evidencias: parsed?.evidencias || [entityName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: TitleAgent] ERROR: ${err.message}`);
    return {
      success: false,
      data: null,
      estado: "sin_datos",
      evidencias: [],
      providerUsed: "none",
      error: `Error al generar el título: ${err.message}`,
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

  const systemPrompt = `Eres un redactor profesional de descripciones para Travelgrin.
Tu objetivo primordial es cumplir fielmente la directiva editorial del administrador.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "estado": "ok",
  "contenido": "<p>Primer párrafo...</p><p>Segundo párrafo...</p>",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL: La directiva del administrador es la regla SUPREMA. Si el administrador pide una cantidad exacta de párrafos, longitud máxima, enfoque comercial o informativo, exclusión de precios o inclusión de servicios específicos, DEBES CUMPLIRLO EXACTAMENTE.
2. Formato HTML: Escribe el contenido estructurado en etiquetas de párrafos HTML <p>...</p>.
3. Fidelidad factual: No inventes datos que contradigan la información provista.
4. Formato estricto: Devuelve únicamente el objeto JSON sin texto adicional fuera del JSON.`;

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

GENERA ÚNICAMENTE LA DESCRIPCIÓN EN ESPAÑOL DENTRO DEL JSON CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT-DEBUG: DescriptionAgent]`);
  console.log(`1. URL: ${context.url}`);
  console.log(`2. Admin Description Prompt: "${prompt || "(Sin prompt personalizado, usando instrucción básica)"}"`);
  console.log(`3. Final User Prompt:\n${userPrompt}`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto"
    );

    console.log(`4. Provider Used: ${providerUsed}`);
    console.log(`5. Raw Model Response: ${rawText}`);

    const parsed = extractJson(rawText);
    let descHtml = String(
      parsed?.contenido ||
      parsed?.description ||
      parsed?.descripcion ||
      parsed?.texto ||
      parsed?.body ||
      ""
    ).trim();

    if (!descHtml) {
      // Fallback: Si el modelo devolvió párrafos HTML directamente sin envolver en JSON
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

    // Ensure valid <p> tags
    if (!descHtml.includes("<p>")) {
      descHtml = descHtml
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("\n");
    }

    console.log(`6. Normalized Description Output:\n${descHtml}`);
    console.log(`7. Validation: OK (Cumple JSON y contenido estructurado)`);

    let dEn = descHtml;
    let dPt = descHtml;
    let dIt = descHtml;
    if (context.autoTranslate !== false) {
      try {
        [dEn, dPt, dIt] = await Promise.all([
          translateHtmlParagraphs(descHtml, "en"),
          translateHtmlParagraphs(descHtml, "pt"),
          translateHtmlParagraphs(descHtml, "it"),
        ]);
      } catch (transErr) {
        console.warn(`[AI-AGENT-DEBUG: DescriptionAgent] Error no fatal en traducción:`, transErr);
      }
    }

    return {
      success: true,
      data: {
        description: descHtml,
        descriptionI18n: { es: descHtml, en: dEn || descHtml, pt: dPt || descHtml, it: dIt || descHtml },
      },
      estado: "ok",
      evidencias: parsed?.evidencias || [entityName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: DescriptionAgent] ERROR: ${err.message}`);
    return {
      success: false,
      data: null,
      estado: "sin_datos",
      evidencias: [],
      providerUsed: "none",
      error: `Error al generar la descripción: ${err.message}`,
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
- Si el administrador solicita cambiar el título (ej. "Cambiá el título a Requisitos"), actualiza el campo "titulo" con el nuevo título solicitado.
- Si el administrador solicita agregar o modificar datos (ej. "agrega más opciones de pago y horarios"), realiza el ajuste sobre el contenido manteniendo la coherencia factual.\n`
    : "";

  const systemPrompt = `Eres un redactor profesional de bloques de información para Travelgrin.
Tu objetivo primordial es cumplir fielmente la directiva editorial del administrador.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "estado": "ok",
  "titulo": "${bTitle}",
  "contenido": "<p>...</p>",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL: Cumple fielmente las instrucciones o ajustes del administrador para este bloque. Si pide cambiar el título, define el nuevo título en "titulo". Si pide agregar opciones, preguntas/respuestas, horarios o modificar redacción, aplica las modificaciones en "contenido" formateado en HTML <p>...</p>.
2. TÍTULO LIMPIO: Mantén el título conceptual del bloque ('${bTitle}'). NUNCA agregues el nombre de la institución o empresa ni guiones en el título del bloque.
3. Si es de preguntas frecuentes o pide preguntas y respuestas, formatea cada una en HTML <p><strong>¿Pregunta...?</strong><br/>Respuesta clara en tercera persona...</p>. Si es otro tipo de bloque, redacta párrafos estructurados en HTML <p>...</p>.
4. Fidelidad factual: Usa los datos reales del sitio web provistos.
5. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `TÍTULO DEL BLOQUE: "${bTitle}"
${currentBlockSection}
=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR PARA ESTE BLOQUE (MÁXIMA PRIORIDAD) ===
"${bPrompt || (isFaq ? `Generar ${requestedCount || 10} preguntas frecuentes con sus respuestas pertinentes basadas en los servicios, turnos, atención y datos del sitio.` : "Redactar información estructurada y útil para este bloque.")}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 10).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 8).join(" | ") || "N/A"}
- Párrafos destacados: ${(context.paragraphs || []).slice(0, 6).join("\n") || (context.metaDescription || "")}

GENERA EL CONTENIDO EN ESPAÑOL DENTRO DEL JSON CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT-DEBUG: CustomBlockAgent - ${bTitle}]`);
  console.log(`1. Block Prompt: "${bPrompt || "(Sin prompt específico)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto"
    );

    console.log(`2. Provider Used: ${providerUsed}`);
    console.log(`3. Raw Response: ${rawText}`);

    const parsed = extractJson(rawText);
    let bodyContent = String(
      parsed?.contenido ||
      parsed?.body ||
      parsed?.texto ||
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

    let tEn = genTitle;
    let tPt = genTitle;
    let tIt = genTitle;
    let bEn = bodyContent;
    let bPt = bodyContent;
    let bIt = bodyContent;

    if (context.autoTranslate !== false) {
      try {
        [tEn, tPt, tIt, bEn, bPt, bIt] = await Promise.all([
          translateText(genTitle, "es", "en"),
          translateText(genTitle, "es", "pt"),
          translateText(genTitle, "es", "it"),
          translateHtmlParagraphs(bodyContent, "en"),
          translateHtmlParagraphs(bodyContent, "pt"),
          translateHtmlParagraphs(bodyContent, "it"),
        ]);
      } catch (transErr) {
        console.warn(`[AI-AGENT-DEBUG: CustomBlockAgent - ${genTitle}] Error no fatal en traducción:`, transErr);
      }
    }

    return {
      title: genTitle,
      titleI18n: { es: genTitle, en: tEn || genTitle, pt: tPt || genTitle, it: tIt || genTitle },
      body: bodyContent,
      bodyI18n: { es: bodyContent, en: bEn || bodyContent, pt: bPt || bodyContent, it: bIt || bodyContent },
      visibleInCard: false,
      estado: "ok",
      contenido: bodyContent,
      evidencias: parsed?.evidencias || [entityName],
      prompt: blockPrompt,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: CustomBlockAgent - ${bTitle}] ERROR: ${err.message}`);
    return {
      title: bTitle,
      titleI18n: { es: bTitle, en: bTitle, pt: bTitle, it: bTitle },
      body: "",
      bodyI18n: { es: "", en: "", pt: "", it: "" },
      visibleInCard: false,
      estado: "sin_datos",
      contenido: "",
      evidencias: [],
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
  "nombreOferente": "Nombre oficial y verdadero de la empresa, institución u organización oferente (sé muy cuidadoso para distinguir el nombre de la empresa de títulos de programas, iniciativas, convocatorias o artículos)",
  "contenido": "Breve descripción del oferente o institución aquí (1 o 2 oraciones profesionales basadas en datos reales de la web)",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD:
1. IDENTIFICACIÓN PRECISA DEL OFERENTE: Determina con total precisión el nombre oficial y verdadero de la entidad, empresa u organización responsable. Si el título de la página es un programa, evento, convocatoria o curso (por ejemplo: "Córdoba GovTech", "Programa Talento", "Becas 2024", etc.), identifica cuál es la institución o empresa responsable (por ejemplo: Incutex, Municipalidad de Córdoba, Universidad Siglo 21, etc.) y coloca ese nombre en "nombreOferente".
2. CERO PLANTILLAS GENÉRICAS: Prohibido terminantemente usar frases clichés vacías como "Institución y prestador de servicios en Córdoba". Describe la actividad concreta, trayectoria o propósito real del oferente.
3. Concisión: Redacta 1 o 2 oraciones concisas y profesionales en tercera persona.
4. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- URL: "${context.url}"
- Nombre preliminar detectado: "${entityName}"
- Título original de la página: "${context.rawPageTitle || entityName}"
- Ubicación: "${locationText || "No informada"}"
- Resumen y párrafos de la web:
"${(context.metaDescription || context.paragraphs?.slice(0, 4).join(" ") || context.mainText?.slice(0, 1000) || "").slice(0, 1200)}"

=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (SI APLICA) ===
"${prompt || `Describir con precisión factual y profesional a ${entityName} y su alcance real.`}"${variationDirective}

GENERA EL OBJETO JSON IDENTIFICANDO EL NOMBRE OFICIAL DEL OFERENTE Y SU DESCRIPCIÓN FACTUAL.`;

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

    let pEn = pInfo;
    let pPt = pInfo;
    let pIt = pInfo;
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
        providerInfoI18n: { es: pInfo, en: pEn || pInfo, pt: pPt || pInfo, it: pIt || pInfo },
        detectedPublisherName: detectedPubName || undefined,
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
  const categoriesPool = taxonomies?.categories || [];
  const subcategoriesPool = taxonomies?.subcategories || [];
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
            `=== BLOQUE: ${block.blockName} ===\n` +
            block.parentCategories
              .map(
                (cat: any) =>
                  `  - Categoría Padre: "${cat.name}"\n` +
                  (cat.subcategories && cat.subcategories.length
                    ? `    Subcategorías válidas: ${cat.subcategories.map((s: string) => `"${s}"`).join(", ")}`
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
2. JERARQUÍA CATEGORÍA + SUBCATEGORÍA:
   - 'category': Selecciona 1 categoría padre existente del catálogo.
   - 'subcategory': Selecciona 1 subcategoría que sea hija válida de la categoría padre elegida.
   - 'categorySelections': Array conteniendo la categoría padre elegida.
   - 'subcategorySelections': Array conteniendo la subcategoría elegida.
3. SECTOR / ACTIVIDAD ('providerActivities'):
   - Selecciona 1 o 2 actividades de la lista 'ACTIVIDADES DISPONIBLES' que mejor representen el sector real del oferente.
4. QUIÉN LO OFRECE ('providerTypes'):
   - Selecciona de la lista 'TIPOS DE PERFIL DISPONIBLES' (por ejemplo "Organismo público" para hospitales públicos, universidades nacionales, ministerios o entes de gobierno, o "Institución privada", "Empresa", etc.).
5. MODALIDADES DE ATENCIÓN ('providerModalities'):
   - Selecciona de la lista 'MODALIDADES DISPONIBLES' (ej: "Atención presencial", "Atención online") según lo que ofrezca el sitio.
6. PRESTACIONES ('prestaciones'):
   - Si aplican opciones de la lista 'PRESTACIONES DISPONIBLES', selecciónalas; de lo contrario devuelve un array vacío [].
7. IDIOMAS REALES DEL SERVICIO ('languages'):
   - Analiza el texto del sitio web para detectar los idiomas reales que se hablan, ofrecen o en los que se atiende (ej. atención bilingüe, we speak english, atención en portugués, español).
   - Elige ÚNICAMENTE de la lista 'IDIOMAS DISPONIBLES'. Si no hay mención expresa de otros idiomas, incluye al menos ["Español"].

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
    (context.headings || []).slice(0, 10).join(" | "),
    (context.paragraphs || []).slice(0, 8).join("\n"),
    (context.mainText || "").slice(0, 5000),
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = `Analiza los siguientes datos y clasifica la publicación dentro del catálogo cerrado:
- URL: ${context.url}
- Nombre Oferente / Organización: ${context.publisherName}
- Título Detectado: ${context.rawPageTitle || ""}
- Meta Descripción: ${context.metaDescription || ""}
- Contenido relevante:
${snippet}

Recuerda: Elige ÚNICAMENTE nombres exactos de las listas del catálogo.`;

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto"
    );

    const parsed = extractJson(rawText);
    if (!parsed) {
      throw new Error("Respuesta JSON inválida de IA al clasificar taxonomía.");
    }

    // Strict validation against DB pool
    const rawCat = String(parsed.category || (Array.isArray(parsed.categorySelections) ? parsed.categorySelections[0] : "") || "").trim();
    const rawSub = String(parsed.subcategory || (Array.isArray(parsed.subcategorySelections) ? parsed.subcategorySelections[0] : "") || "").trim();

    const matchedCats = matchToCatalogPool([rawCat], categoriesPool);
    const finalCat = matchedCats[0] || (categoriesPool[0] || "");

    // Verify subcategory is a child if tree is available
    let validSubcatPool = subcategoriesPool;
    if (taxonomies?.categoryTree?.length) {
      const allParentNodes = taxonomies.categoryTree.flatMap((b) => b.parentCategories);
      const matchedNode = allParentNodes.find((p) => p.name.toLowerCase() === finalCat.toLowerCase());
      if (matchedNode && matchedNode.subcategories && matchedNode.subcategories.length > 0) {
        validSubcatPool = matchedNode.subcategories;
      }
    }

    const matchedSubs = matchToCatalogPool([rawSub], validSubcatPool);
    const finalSub = matchedSubs[0] || (validSubcatPool[0] || "");

    const matchedActivities = matchToCatalogPool(
      Array.isArray(parsed.providerActivities) ? parsed.providerActivities : [parsed.providerActivities],
      activitiesPool
    );

    const matchedTypes = matchToCatalogPool(
      Array.isArray(parsed.providerTypes) ? parsed.providerTypes : [parsed.providerTypes],
      typesPool
    );

    const matchedModalities = matchToCatalogPool(
      Array.isArray(parsed.providerModalities) ? parsed.providerModalities : [parsed.providerModalities],
      modalitiesPool
    );

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
        categorySelections: finalCat ? [finalCat] : [],
        subcategorySelections: finalSub ? [finalSub] : [],
        providerActivities: matchedActivities.length ? matchedActivities : (activitiesPool.slice(0, 1)),
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
  const hMatches = cleaned.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi);
  for (const match of hMatches) {
    const text = decodeEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length > 3 && text.length < 120 && !/cookies|men[uú]|login|iniciar|buscar|search/i.test(text)) {
      headings.push(text);
    }
  }

  // Extract paragraphs
  const paragraphs: string[] = [];
  const pMatches = cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi);
  for (const match of pMatches) {
    const text = decodeEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
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
