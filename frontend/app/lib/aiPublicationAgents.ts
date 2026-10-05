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
  const geminiKey =
    (customKey && (customKey.startsWith("AIza") || !customKey.startsWith("sk-")) ? customKey : "") ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "";

  const openaiKey =
    (customKey && customKey.startsWith("sk-") ? customKey : "") ||
    process.env.OPENAI_API_KEY ||
    process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
    "";

  const executeGemini = async (): Promise<string> => {
    if (!geminiKey) throw new Error("GEMINI_API_KEY no disponible.");
    const models = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    let lastErr: any = null;
    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
                },
              ],
              generationConfig: {
                temperature: 0.7,
                responseMimeType: "application/json",
              },
            }),
          }
        );
        if (res.ok) {
          const json = await res.json();
          const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (raw) return raw;
        } else {
          lastErr = new Error(`Gemini ${model}: HTTP ${res.status}`);
        }
      } catch (e: any) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Gemini falló.");
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
            temperature: 0.7,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          const raw = json.choices?.[0]?.message?.content || "";
          if (raw) return raw;
        } else {
          lastErr = new Error(`OpenAI ${model}: HTTP ${res.status}`);
        }
      } catch (e: any) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("OpenAI falló.");
  };

  if (preferredProvider === "openai") {
    try {
      const raw = await executeOpenAI();
      return { rawText: raw, providerUsed: "openai" };
    } catch {
      const raw = await executeGemini();
      return { rawText: raw, providerUsed: "gemini" };
    }
  } else {
    try {
      const raw = await executeGemini();
      return { rawText: raw, providerUsed: "gemini" };
    } catch {
      const raw = await executeOpenAI();
      return { rawText: raw, providerUsed: "openai" };
    }
  }
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
"${prompt || "Crear un título claro, comercial y profesional que mencione el nombre del establecimiento y su propuesta principal."}"

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 6).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 5).join(" | ") || "N/A"}
- Resumen web: "${(context.metaDescription || context.paragraphs?.[0] || "").slice(0, 500)}"

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
    const rawTitle = String(parsed?.contenido || parsed?.title || "").trim();

    if (!rawTitle || rawTitle.length < 2) {
      throw new Error("El modelo devolvió un título vacío o no estructurado.");
    }

    const cleanTitle = cleanTitleString(rawTitle);
    console.log(`6. Normalized Title Output: "${cleanTitle}"`);
    console.log(`7. Validation: OK (Cumple JSON y contenido no vacío)`);

    const [tEn, tPt, tIt] = await Promise.all([
      translateText(cleanTitle, "es", "en"),
      translateText(cleanTitle, "es", "pt"),
      translateText(cleanTitle, "es", "it"),
    ]);

    return {
      success: true,
      data: {
        title: cleanTitle,
        titleI18n: { es: cleanTitle, en: tEn, pt: tPt, it: tIt },
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
"${prompt || "Escribir una descripción profesional en párrafos HTML <p> en tercera persona explicando qué ofrece, su alcance y vías oficiales."}"

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 10).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 8).join(" | ") || "N/A"}
- Párrafos destacados: ${(context.paragraphs || []).slice(0, 6).join("\n") || (context.metaDescription || "")}
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
    let descHtml = String(parsed?.contenido || parsed?.description || "").trim();

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

    const [dEn, dPt, dIt] = await Promise.all([
      translateHtmlParagraphs(descHtml, "en"),
      translateHtmlParagraphs(descHtml, "pt"),
      translateHtmlParagraphs(descHtml, "it"),
    ]);

    return {
      success: true,
      data: {
        description: descHtml,
        descriptionI18n: { es: descHtml, en: dEn, pt: dPt, it: dIt },
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
  blockPrompt?: string
): Promise<ExtraDescriptionBlock> {
  const bTitle = (blockTitle || "Información Adicional").trim();
  const bPrompt = (blockPrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");

  const isFaq =
    /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(bTitle) ||
    /preguntas?\s+(?:y|con)\s+respuestas?|faq/i.test(bPrompt);

  const countMatch = bPrompt.match(/\b(\d+)\s*(?:preguntas?|faq|items?|puntos?|consultas?)\b/i) || bPrompt.match(/\b(1\d|[2-9])\b/);
  const requestedCount = countMatch ? Math.min(Math.max(parseInt(countMatch[1] || countMatch[0], 10), 2), 20) : (isFaq ? 10 : 0);

  const systemPrompt = `Eres un redactor profesional de bloques de información para Travelgrin.
Tu objetivo primordial es cumplir fielmente la directiva editorial del administrador.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "estado": "ok",
  "titulo": "${bTitle}",
  "contenido": "...",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL: Cumple fielmente las instrucciones del administrador para este bloque. Si es de preguntas frecuentes o pide preguntas y respuestas, formatea cada una en HTML <p><strong>¿Pregunta...?</strong><br/>Respuesta clara en tercera persona...</p>. Si es otro tipo de bloque, redacta párrafos estructurados en HTML <p>...</p>.
2. Fidelidad factual: Usa los datos reales del sitio web.
3. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `TÍTULO DEL BLOQUE: "${bTitle}"

=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR PARA ESTE BLOQUE (MÁXIMA PRIORIDAD) ===
"${bPrompt || (isFaq ? `Generar ${requestedCount || 10} preguntas frecuentes con sus respuestas pertinentes basadas en los servicios, turnos, atención y datos del sitio.` : "Redactar información estructurada y útil para este bloque.")}"

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
    let bodyContent = String(parsed?.contenido || parsed?.body || "").trim();

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

    const [tEn, tPt, tIt, bEn, bPt, bIt] = await Promise.all([
      translateText(bTitle, "es", "en"),
      translateText(bTitle, "es", "pt"),
      translateText(bTitle, "es", "it"),
      translateHtmlParagraphs(bodyContent, "en"),
      translateHtmlParagraphs(bodyContent, "pt"),
      translateHtmlParagraphs(bodyContent, "it"),
    ]);

    return {
      title: bTitle,
      titleI18n: { es: bTitle, en: tEn, pt: tPt, it: tIt },
      body: bodyContent,
      bodyI18n: { es: bodyContent, en: bEn, pt: bPt, it: bIt },
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
export async function runProviderInfoAgent(
  context: CleanScrapedContext,
  adminPrompt?: string
): Promise<AgentResult<{ providerInfo: string; providerInfoI18n: I18nRecord }>> {
  const prompt = (adminPrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");

  const systemPrompt = `Eres un redactor profesional para Travelgrin.
Tu objetivo primordial es cumplir fielmente la directiva editorial del administrador.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "estado": "ok",
  "contenido": "Breve descripción del oferente o institución aquí",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL: Cumple estrictamente la directiva del administrador (estilo, tono, longitud y datos requeridos).
2. Concisión: Redacta 1 o 2 oraciones concisas y profesionales en tercera persona.
3. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
"${prompt || `Describir brevemente en 1 o 2 oraciones a ${entityName} y su alcance institucional.`}"

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Resumen o servicios: "${(context.metaDescription || context.paragraphs?.[0] || "").slice(0, 400)}"

GENERA ÚNICAMENTE LA INFORMACIÓN EN ESPAÑOL DENTRO DEL JSON CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

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
    const pInfo = String(parsed?.contenido || parsed?.providerInfo || "").trim();

    if (!pInfo || pInfo.length < 5) {
      throw new Error("El modelo devolvió información de proveedor vacía.");
    }

    const [pEn, pPt, pIt] = await Promise.all([
      translateText(pInfo, "es", "en"),
      translateText(pInfo, "es", "pt"),
      translateText(pInfo, "es", "it"),
    ]);

    return {
      success: true,
      data: {
        providerInfo: pInfo,
        providerInfoI18n: { es: pInfo, en: pEn, pt: pPt, it: pIt },
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
// 5. HELPER PARA LIMPIEZA DE CONTENIDO SCRAPEADO
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
