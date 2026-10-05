/**
 * Travelgrin AI Publication Agents Architecture
 * 
 * Hierarchy of Authority:
 * 1. Admin Custom Prompt (Primary Editorial Authority - 100% absolute precedence)
 * 2. Real Scraped Web Facts
 * 3. Technical System Rules (Valid JSON schema, safety)
 * 4. Internal Travelgrin Rules (Only when they DO NOT contradict the Admin prompt)
 * 
 * Rules:
 * - Pure technical SYSTEM prompts.
 * - Admin prompts are never altered, hidden or diluted.
 * - Provider chain: Gemini -> OpenAI -> Controlled Error (Zero invented filler content).
 * - Full support for reformulating with fresh variations respecting past prompts.
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

  if (!geminiKey && !openaiKey) {
    throw new Error(
      "No hay ninguna API Key de IA configurada en el servidor (GEMINI_API_KEY ni OPENAI_API_KEY). Por favor verifica el entorno de Vercel o ingresa tu API Key en la configuración."
    );
  }

  const executeGemini = async (): Promise<string> => {
    if (!geminiKey) throw new Error("GEMINI_API_KEY no disponible.");
    const models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
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
                temperature: 0.75,
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
          const errText = await res.text().catch(() => "");
          lastErr = new Error(`Gemini ${model}: HTTP ${res.status} - ${errText}`);
        }
      } catch (e: any) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("Gemini falló en todos los modelos.");
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
  adminTitlePrompt?: string,
  currentTitle?: string
): Promise<AgentResult<{ title: string; titleI18n: I18nRecord }>> {
  const prompt = (adminTitlePrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const activeCurrent = (currentTitle || context.currentText || "").trim();

  const variationDirective = (context.variationIndex && context.variationIndex >= 1) || activeCurrent
    ? `\n\n=== REGLA OBLIGATORIA DE REFORMULACIÓN (VARIACIÓN #${context.variationIndex || 1}) ===\nEl título actual que tiene el usuario es: "${activeCurrent || "Título previo"}".\nDEBES generar una versión ALTERNATIVA, FRESCA Y DIFERENTE a la actual (usando sinónimos o un enfoque alternativo), y que CUMPLA RIGUROSAMENTE todas las condiciones de la directiva del administrador. ¡ESTÁ TERMINANTEMENTE PROHIBIDO devolver exactamente el mismo título o una repetición trivial!`
    : "";

  const systemPrompt = `Eres un redactor profesional de títulos para la plataforma Travelgrin.
Tu objetivo primordial es cumplir FIELMENTE y de forma MILIMÉTRICA la directiva editorial del administrador.
Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "estado": "ok",
  "contenido": "Título redactado aquí",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD (ORDEN SUPREMO):
1. AUTORIDAD EDITORIAL ABSOLUTA: La directiva del administrador es la regla SUPREMA.
   - Si el administrador exige una cantidad exacta de palabras (ej: "exactamente 4 palabras"), tu título en 'contenido' DEBE TENER EXACTAMENTE ese número de palabras. Cuéntalas antes de responder.
   - Si el administrador prohíbe mencionar la ciudad ("No mencionar la ciudad"), NO menciones ciudades (ej: Mendoza, Buenos Aires, etc.) en el título, incluso si el nombre de la institución la contiene (ej: si es "Hospital Italiano Mendoza", cámbialo a "Hospital Italiano" o utiliza otra redacción para excluir la ciudad).
   - Si prohíbe emojis ("No usar emojis"), NO uses ningún emoji.
   - Si prohíbe signos de exclamación ("No usar signos de exclamación"), NO uses '!' ni '¡'.
   - Si solicita un tono o palabras específicas, acátalo con precisión del 100%.
2. REFORMULACIÓN: Si se solicita reformular respecto a un título actual, genera una propuesta diferente y renovada sin repetir el texto previo.
3. Fidelidad factual: No inventes hechos falsos sobre la entidad real.
4. Formato estricto: Devuelve ÚNICAMENTE el objeto JSON sin ningún texto explicativo fuera de las llaves.`;

  const userPrompt = `=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
"${prompt || "Crear un título claro, comercial y profesional que mencione el nombre del establecimiento y su propuesta principal."}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial detectado: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 6).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 5).join(" | ") || "N/A"}
- Resumen web: "${(context.metaDescription || context.paragraphs?.[0] || "").slice(0, 500)}"

GENERA ÚNICAMENTE EL OBJETO JSON CON EL TÍTULO EN ESPAÑOL DENTRO DE "contenido" CUMPLIENDO ESTRICTAMENTE CADA REGLA DE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT: TitleAgent]`);
  console.log(`- URL: ${context.url}`);
  console.log(`- Admin Title Prompt: "${prompt || "(Sin prompt personalizado)"}"`);
  console.log(`- Current Title to reformulate: "${activeCurrent || "(Ninguno)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto"
    );

    const parsed = extractJson(rawText);
    const rawTitle = String(parsed?.contenido || parsed?.title || "").trim();

    if (!rawTitle || rawTitle.length < 2) {
      throw new Error("El modelo devolvió un título vacío o no estructurado.");
    }

    const cleanTitle = cleanTitleString(rawTitle);
    console.log(`- Generated Title Output: "${cleanTitle}" (Provider: ${providerUsed})`);

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
    console.warn(`[AI-AGENT: TitleAgent] ERROR: ${err.message}`);
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
  adminDescriptionPrompt?: string,
  currentDescription?: string
): Promise<AgentResult<{ description: string; descriptionI18n: I18nRecord }>> {
  const prompt = (adminDescriptionPrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const activeCurrent = (currentDescription || context.currentText || "").trim();

  const variationDirective = (context.variationIndex && context.variationIndex >= 1) || activeCurrent
    ? `\n\n=== REGLA OBLIGATORIA DE REFORMULACIÓN (VARIACIÓN #${context.variationIndex || 1}) ===\nLa descripción actual que tiene el usuario es:\n"${activeCurrent.slice(0, 500)}..."\nDEBES generar una redacción ALTERNATIVA, FRESCA Y DIFERENTE a la actual (estructura y vocabulario renovados), y que CUMPLA RIGUROSAMENTE todas las condiciones de la directiva del administrador. ¡ESTÁ TERMINANTEMENTE PROHIBIDO devolver exactamente las mismas frases o contenido idéntico!`
    : "";

  const systemPrompt = `Eres un redactor profesional de descripciones para la plataforma Travelgrin.
Tu objetivo primordial es cumplir FIELMENTE y de forma EXACTA la directiva editorial del administrador.
Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "estado": "ok",
  "contenido": "<p>Párrafo de descripción aquí...</p>",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD (ORDEN SUPREMO):
1. AUTORIDAD EDITORIAL ABSOLUTA: La directiva del administrador es la regla SUPREMA.
   - Si el administrador pide "exactamente un único párrafo", genera EXACTAMENTE UN SOLO bloque <p>...</p>. No agregues múltiples párrafos.
   - Si pide una longitud máxima (ej: "máximo 1000 caracteres"), ajusta el texto para NO superar esa cantidad de caracteres.
   - Si pide exclusiones estrictas (ej: "No mencionar precios, horarios ni teléfonos", o "sin emojis"), NO los menciones bajo ninguna circunstancia.
   - Si solicita un enfoque específico (ej: comercial, servicios detallados, historia, formal), aplícalo plenamente.
2. REFORMULACIÓN: Si se solicita reformular respecto a una descripción previa, genera una redacción alternativa y fresca sin repetir el texto anterior.
3. Formato HTML: Escribe el texto envuelto en etiquetas <p>...</p>.
4. Formato estricto: Devuelve ÚNICAMENTE el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
"${prompt || "Escribir una descripción profesional en párrafos HTML <p> en tercera persona explicando qué ofrece, su alcance y propuesta de valor."}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 10).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 8).join(" | ") || "N/A"}
- Párrafos destacados: ${(context.paragraphs || []).slice(0, 6).join("\n") || (context.metaDescription || "")}
- Contacto y canales: ${(context.socialLinks || []).map((s) => `${s.label}: ${s.url}`).join(" | ") || "N/A"}

GENERA ÚNICAMENTE EL OBJETO JSON CON LA DESCRIPCIÓN EN ESPAÑOL DENTRO DE "contenido" CUMPLIENDO ESTRICTAMENTE CADA REGLA DE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT: DescriptionAgent]`);
  console.log(`- URL: ${context.url}`);
  console.log(`- Admin Description Prompt: "${prompt || "(Sin prompt personalizado)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto"
    );

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

    console.log(`- Generated Description Output (Provider: ${providerUsed})`);

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
    console.warn(`[AI-AGENT: DescriptionAgent] ERROR: ${err.message}`);
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
  const bTitle = (blockTitle || "Información Adicional").trim();
  const bPrompt = (blockPrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const activeCurrent = (currentBody || context.currentText || "").trim();

  const variationDirective = (context.variationIndex && context.variationIndex >= 1) || activeCurrent
    ? `\n\n=== REGLA OBLIGATORIA DE REFORMULACIÓN (VARIACIÓN #${context.variationIndex || 1}) ===\nEl contenido actual de este bloque es:\n"${activeCurrent.slice(0, 400)}..."\nDEBES generar una redacción ALTERNATIVA, FRESCA Y DIFERENTE a la actual, cumpliendo rigurosamente la directiva del administrador para este bloque. ¡No repitas el texto anterior!`
    : "";

  const isFaq =
    /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(bTitle) ||
    /preguntas?\s+(?:y|con)\s+respuestas?|faq/i.test(bPrompt);

  const countMatch = bPrompt.match(/\b(\d+)\s*(?:preguntas?|faq|items?|puntos?|consultas?)\b/i) || bPrompt.match(/\b(1\d|[2-9])\b/);
  const requestedCount = countMatch ? Math.min(Math.max(parseInt(countMatch[1] || countMatch[0], 10), 2), 20) : (isFaq ? 10 : 0);

  const systemPrompt = `Eres un redactor profesional de bloques de información especializada para Travelgrin.
Tu objetivo primordial es cumplir fielmente la directiva editorial del administrador para este bloque.
Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "estado": "ok",
  "titulo": "${bTitle}",
  "contenido": "<p>Contenido del bloque...</p>",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL: Cumple fielmente las instrucciones del administrador para este bloque.
   - Si es un bloque de Preguntas Frecuentes (FAQ) o pide preguntas y respuestas, formatea cada ítem estrictamente como:
     <p><strong>¿Pregunta aquí...?</strong><br/>Respuesta clara y precisa en tercera persona...</p>
   - Si pide una cantidad específica de ítems o preguntas (ej: ${requestedCount || 10}), genera exactamente esa cantidad.
   - Si es otro tipo de bloque (ej: Requisitos, Formas de pago, Servicios), redacta párrafos estructurados en etiquetas HTML <p>...</p>.
2. REFORMULACIÓN: Si se te indica reformular respecto a un texto previo, genera una propuesta diferente y fresca sin repetir el texto previo.
3. Fidelidad factual: Usa los datos reales del sitio web.
4. Formato estricto: Devuelve ÚNICAMENTE el objeto JSON sin texto adicional fuera del JSON.`;

  const userPrompt = `TÍTULO DEL BLOQUE: "${bTitle}"

=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR PARA ESTE BLOQUE (MÁXIMA PRIORIDAD) ===
"${bPrompt || (isFaq ? `Generar ${requestedCount || 10} preguntas frecuentes con sus respuestas pertinentes basadas en los servicios, turnos, atención y datos del sitio.` : "Redactar información estructurada y útil para este bloque.")}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 10).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 8).join(" | ") || "N/A"}
- Párrafos destacados: ${(context.paragraphs || []).slice(0, 6).join("\n") || (context.metaDescription || "")}

GENERA EL CONTENIDO EN ESPAÑOL DENTRO DEL JSON CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT: CustomBlockAgent - "${bTitle}"]`);
  console.log(`- Block Prompt: "${bPrompt || "(Sin prompt específico)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto"
    );

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
    console.warn(`[AI-AGENT: CustomBlockAgent - "${bTitle}"] ERROR: ${err.message}`);
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
  adminPrompt?: string,
  currentInfo?: string
): Promise<AgentResult<{ providerInfo: string; providerInfoI18n: I18nRecord }>> {
  const prompt = (adminPrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const activeCurrent = (currentInfo || context.currentText || "").trim();

  const variationDirective = (context.variationIndex && context.variationIndex >= 1) || activeCurrent
    ? `\n\n=== REGLA OBLIGATORIA DE REFORMULACIÓN (VARIACIÓN #${context.variationIndex || 1}) ===\nEl texto actual es: "${activeCurrent}".\nDEBES generar una redacción ALTERNATIVA y concisa cumpliendo la directiva del administrador sin repetir el texto previo.`
    : "";

  const systemPrompt = `Eres un redactor profesional para Travelgrin.
Tu objetivo primordial es cumplir fielmente la directiva editorial del administrador.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "estado": "ok",
  "contenido": "Breve descripción institucional del oferente aquí...",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL: Cumple estrictamente la directiva del administrador.
2. Concisión: Redacta 1 o 2 oraciones concisas y profesionales en tercera persona.
3. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
"${prompt || `Describir brevemente en 1 o 2 oraciones a ${entityName} y su alcance institucional.`}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Resumen o servicios: "${(context.metaDescription || context.paragraphs?.[0] || "").slice(0, 400)}"

GENERA ÚNICAMENTE LA INFORMACIÓN EN ESPAÑOL DENTRO DEL JSON CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT: ProviderInfoAgent]`);
  console.log(`- Admin Prompt: "${prompt || "(Sin prompt específico)"}"`);

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
    console.warn(`[AI-AGENT: ProviderInfoAgent] ERROR: ${err.message}`);
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
