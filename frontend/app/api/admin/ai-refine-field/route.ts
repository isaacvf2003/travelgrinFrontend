import { NextResponse } from "next/server";

export const maxDuration = 60;

type FieldType = "title" | "description" | "provider_info" | "extra_block" | "new_extra_block";

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
  provider?: "auto" | "gemini" | "openai";
  variationIndex?: number;
  scrapedHeadings?: string[];
  scrapedParagraphs?: string[];
  scrapedTextContent?: string;
  rawPageTitle?: string;
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

let cachedRefineModel: string | null = null;

async function callGemini(prompt: string, apiKey: string, temperature = 0.85): Promise<string> {
  const candidateModels = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
  ];
  let lastError: any = null;

  const tryModel = async (model: string): Promise<string | null> => {
    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType: "application/json",
      },
    };

    try {
      let res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify(payload),
        }
      );

      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1200));
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(25000),
            body: JSON.stringify(payload),
          }
        );
      }

      if (res.status === 400) {
        // Fallback without responseMimeType in case model doesn't support structured output
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(25000),
            body: JSON.stringify({
              contents: payload.contents,
              generationConfig: { temperature },
            }),
          }
        );
      }

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        return text.replace(/```json\s*|```/gi, "").trim();
      } else {
        const errText = await res.text().catch(() => "");
        lastError = new Error(`Gemini (${model}): ${errText}`);
      }
    } catch (e: any) {
      lastError = e;
    }
    return null;
  };

  if (cachedRefineModel) {
    try {
      const result = await tryModel(cachedRefineModel);
      if (result) return result;
      cachedRefineModel = null;
    } catch {
      cachedRefineModel = null;
    }
  }

  for (const model of candidateModels) {
    try {
      const result = await tryModel(model);
      if (result) {
        cachedRefineModel = model;
        return result;
      }
    } catch (e: any) {
      lastError = e;
    }
  }

  // Dynamic discovery via ListModels if all fixed models fail
  try {
    const listRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(7000) }
    );
    if (listRes.ok) {
      const listData = await listRes.json();
      const available = (listData.models || [])
        .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
        .map((m: any) => m.name.replace(/^models\//, ""))
        .filter((m: string) => !candidateModels.includes(m));

      for (const model of available) {
        try {
          const result = await tryModel(model);
          if (result) return result;
        } catch (e: any) {
          lastError = e;
        }
      }
    }
  } catch (e) {
    console.error("ListModels discovery fallback error:", e);
  }

  throw lastError || new Error("No se pudo obtener respuesta de Gemini con tu API Key.");
}

async function callOpenAI(prompt: string, apiKey: string, temperature = 0.85): Promise<string> {
  const models = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"];
  let lastError: any = null;

  for (const model of models) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify({
          model,
          temperature,
          messages: [
            {
              role: "system",
              content: "Eres un redactor y editor profesional de Travelgrin. Devuelve ÚNICAMENTE un JSON válido.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || "{}";
        return content.replace(/```json\s*|```/gi, "").trim();
      } else {
        const errText = await res.text();
        lastError = new Error(`OpenAI (${model}): ${errText}`);
      }
    } catch (e: any) {
      lastError = e;
    }
  }
  throw lastError || new Error("No se pudo obtener respuesta de OpenAI.");
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
      apiKey,
      provider = "auto",
      variationIndex = 1,
      scrapedHeadings = [],
      scrapedParagraphs = [],
      scrapedTextContent = "",
      rawPageTitle = "",
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
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";

    const openaiKey =
      (customKey && customKey.startsWith("sk-") ? customKey : "") ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      "";

    const effectiveProvider =
      provider === "openai" || provider === "gemini"
        ? provider
        : openaiKey && !geminiKey
        ? "openai"
        : "gemini";

    const callAI = async (promptStr: string, field: FieldType): Promise<any> => {
      let rawJson = "";
      if (effectiveProvider === "openai" && openaiKey) {
        try {
          rawJson = await callOpenAI(promptStr, openaiKey, 0.85);
        } catch (e) {
          if (geminiKey) rawJson = await callGemini(promptStr, geminiKey, 0.85);
          else throw e;
        }
      } else if (geminiKey) {
        try {
          rawJson = await callGemini(promptStr, geminiKey, 0.85);
        } catch (e) {
          if (openaiKey) rawJson = await callOpenAI(promptStr, openaiKey, 0.85);
          else throw e;
        }
      } else if (openaiKey) {
        rawJson = await callOpenAI(promptStr, openaiKey, 0.85);
      } else {
        throw new Error("No hay una API Key configurada para IA. Por favor ingresá tu clave de Gemini u OpenAI.");
      }

      const parsed = extractJson(rawJson);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }

      // Robust fallback parser if model output had conversational preamble or invalid syntax
      if (field === "title") {
        const titleMatch = rawJson.match(/"title"\s*:\s*"([^"\r\n]+)"/i) || rawJson.match(/title:\s*([^\r\n]+)/i);
        if (titleMatch && titleMatch[1]) {
          return { title: titleMatch[1].trim() };
        }
        const cleaned = rawJson
          .replace(/```[a-z]*|```/gi, "")
          .replace(/^{?\s*"title"?\s*:?\s*"?/i, "")
          .replace(/"?\s*}?$/i, "")
          .replace(/^["'\s]+|["'\s]+$/g, "")
          .trim();
        return { title: cleaned || currentTitle || currentText };
      }

      if (field === "description") {
        const descMatch = rawJson.match(/"description"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*})/i);
        if (descMatch && descMatch[1]) {
          return { description: descMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim() };
        }
        return { description: rawJson.trim() };
      }

      if (field === "extra_block" || field === "new_extra_block") {
        const bodyMatch = rawJson.match(/"body"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*})/i);
        if (bodyMatch && bodyMatch[1]) {
          return { body: bodyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, "\n").trim() };
        }
        return { body: rawJson.trim() };
      }

      return { text: rawJson.trim() };
    };

    const entityName = publisherName || currentTitle || rawPageTitle || "La entidad";
    const contextFacts = [
      entityName ? `Entidad: ${entityName}` : "",
      city || country ? `Ubicación: ${[city, country].filter(Boolean).join(", ")}` : "",
      category ? `Categoría: ${category}` : "",
      url ? `Web: ${url}` : "",
      scrapedHeadings.length ? `Encabezados: ${scrapedHeadings.slice(0, 10).join(" | ")}` : "",
      scrapedParagraphs.length ? `Datos web: ${scrapedParagraphs.slice(0, 6).join(" ")}` : "",
      scrapedTextContent
        ? `Texto web: ${scrapedTextContent.slice(0, 2500)}`
        : (currentText ? `Contenido previo de referencia: ${currentText.replace(/<[^>]+>/g, " ").slice(0, 1500)}` : ""),
    ].filter(Boolean).join("\n");

    const variationDirective = `
======================================================================
DIRECTIVA OBLIGATORIA DE REFORMULACIÓN (VARIACIÓN #${variationIndex || 1}):
- El administrador pulsó "Reformular con IA" porque NO LE GUSTÓ la respuesta anterior y exige una versión NUEVA, DIFERENTE, FRESCA Y ATRACTIVA.
- VALOR PREVIO A REEMPLAZAR Y NO REPETIR: "${(currentText || currentTitle || "").replace(/<[^>]+>/g, " ").slice(0, 500)}"
REGLAS ESTRICTAS:
1. PROHIBIDO repetir exactamente las mismas frases, párrafos o estructura de apertura de la versión previa.
2. MANTÉN RIGUROSAMENTE Y AL 100% EL PROMPT DADO POR EL ADMINISTRADOR: "${prompt}".
3. Utiliza nuevos conectores, otro orden sintáctico o destaca otros servicios y beneficios reales de la entidad.
======================================================================`;

    // 1. TÍTULO
    if (fieldType === "title") {
      const aiPrompt = `Eres un redactor y especialista en marketing para Travelgrin.
Genera un título comercial, atractivo y de alta conversión cumpliendo rigurosamente la instrucción del administrador.
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${variationDirective}
DATOS DE LA ENTIDAD:
${contextFacts}
TÍTULO ACTUAL PREVIO A REEMPLAZAR: "${currentText || currentTitle}"

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: Cumple al pie de la letra lo que el administrador pide en su instrucción (tono de marketing, llamada de atención, palabras clave, estilo o enfoque específico). NUNCA devuelvas solo el nombre seco de la entidad si se pidió impacto comercial.
2. Limpieza: Elimina sufijos y prefijos genéricos de navegación como "- Inicio", "| Home", "Sitio Oficial".
3. Formato estricto: Devuelve ÚNICAMENTE un objeto JSON con:
{
  "title": "Título redactado aquí",
  "titleI18n": {
    "es": "Título redactado aquí",
    "en": "Title in English",
    "pt": "Título em português",
    "it": "Titolo in italiano"
  }
}`;
      const parsed = await callAI(aiPrompt, "title");
      const titleRes = parsed.title || parsed.titleI18n?.es || currentTitle || currentText;
      return NextResponse.json({
        success: true,
        result: { title: titleRes, text: titleRes },
        translations: parsed.titleI18n || { es: titleRes, en: titleRes, pt: titleRes, it: titleRes },
      });
    }

    // 2. DESCRIPCIÓN PRINCIPAL
    if (fieldType === "description") {
      const aiPrompt = `Eres el redactor jefe de Travelgrin.
Tu objetivo es redactar o mejorar la descripción principal de la publicación CUMPLIENDO RIGUROSAMENTE CON LA INSTRUCCIÓN DEL ADMINISTRADOR y basándote en la información real de la entidad.
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${variationDirective}
DESCRIPCIÓN ACTUAL PREVIA A REEMPLAZAR: "${currentText}"
DATOS DE LA ENTIDAD:
${contextFacts}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: Cumple fielmente y al pie de la letra la instrucción del administrador:
   - Si el administrador pide una cantidad exacta de párrafos (ej: "5 párrafos"), REDACTA EXACTAMENTE ESA CANTIDAD DE PÁRRAFOS.
   - Si el administrador pide títulos en negrita o letras negras con su explicación, cada párrafo debe comenzar con <p><strong>Título del Párrafo</strong><br/>Explicación persuasiva y detallada...</p>.
   - Si el administrador pide tono de marketing o conversión, aplícalo con fluidez.
2. CERO PLANTILLAS RÍGIDAS: Prohibido usar etiquetas fijas obligatorias o plantillas genéricas. La redacción debe adaptarse orgánicamente a lo solicitado por el administrador y a los servicios reales de la entidad.
3. Formato HTML limpio: Estructura en párrafos <p>...</p>.
4. Formato estricto: Devuelve ÚNICAMENTE un objeto JSON con:
{
  "description": "<p>Primer párrafo...</p><p>Segundo párrafo...</p>",
  "descriptionI18n": {
    "es": "<p>Contenido en español...</p>",
    "en": "<p>Content in English...</p>",
    "pt": "<p>Conteúdo em português...</p>",
    "it": "<p>Contenuto in italiano...</p>"
  }
}`;
      const parsed = await callAI(aiPrompt, "description");
      const descRes = parsed.description || parsed.descriptionI18n?.es || currentText;
      return NextResponse.json({
        success: true,
        result: { description: descRes, text: descRes },
        translations: parsed.descriptionI18n || { es: descRes, en: descRes, pt: descRes, it: descRes },
      });
    }

    // 3. BLOQUE ADICIONAL (extra_block / new_extra_block)
    if (fieldType === "extra_block" || fieldType === "new_extra_block") {
      const blockTitle = currentTitle || "Información Adicional";
      const isFaq = /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(blockTitle) || /pregunt/i.test(prompt);

      const aiPrompt = `Eres un redactor profesional de bloques de contenido para Travelgrin.
Tu tarea es redactar el contenido para el bloque titulado "${blockTitle}" CUMPLIENDO ESTRICTAMENTE LA INSTRUCCIÓN DEL ADMINISTRADOR.
TÍTULO DEL BLOQUE: "${blockTitle}"
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${variationDirective}
CONTENIDO ACTUAL PREVIO A REEMPLAZAR: "${currentText}"
DATOS DE REFERENCIA DE LA ENTIDAD:
${contextFacts}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: Cumple al 100% y al pie de la letra la instrucción del administrador:
   - Si el administrador especifica una cantidad exacta de preguntas o párrafos, GENERA EXACTAMENTE esa cantidad (ni más ni menos).
   - Si el administrador especifica un formato de texto, estilo, colores (<strong style="color: ...">) o directiva editorial, APLÍCALO EXACTAMENTE como fue solicitado.
   - Si es un bloque de Preguntas Frecuentes y no especificó cantidad, genera entre 4 y 8 preguntas relevantes basadas en los servicios reales de la web en formato <p><strong>¿Pregunta...?</strong><br/>Respuesta clara en tercera persona...</p>.
   - Si es otro tipo de bloque (Requisitos, Propuesta, etc.), redacta párrafos estructurados en HTML <p>...</p>.
2. CERO PLANTILLAS RÍGIDAS: No uses preguntas o respuestas de plantilla fija; adáptalas a los servicios y datos reales de la entidad.
3. Formato estricto: Devuelve ÚNICAMENTE un objeto JSON con:
{
  "title": "${blockTitle}",
  "body": "Contenido enriquecido en HTML",
  "titleI18n": { "es": "${blockTitle}", "en": "...", "pt": "...", "it": "..." },
  "bodyI18n": {
    "es": "Contenido en HTML en español",
    "en": "Content in HTML in English",
    "pt": "Conteúdo em HTML em português",
    "it": "Contenuto in HTML in italiano"
  }
}`;
      const parsed = await callAI(aiPrompt, fieldType);
      const resolvedTitle = parsed.title || blockTitle;
      const resolvedBody = parsed.body || parsed.bodyI18n?.es || "";
      const tI18n = parsed.titleI18n || { es: resolvedTitle, en: resolvedTitle, pt: resolvedTitle, it: resolvedTitle };
      const bI18n = parsed.bodyI18n || { es: resolvedBody, en: resolvedBody, pt: resolvedBody, it: resolvedBody };

      return NextResponse.json({
        success: true,
        result: {
          title: resolvedTitle,
          body: resolvedBody,
          text: resolvedBody,
        },
        translations: {
          titleI18n: tI18n,
          bodyI18n: bI18n,
        },
      });
    }

    // 4. INFORMACIÓN DEL PRESTADOR (provider_info)
    if (fieldType === "provider_info") {
      const aiPrompt = `Eres un redactor institucional de Travelgrin.
Redacta 1 o 2 párrafos institucionales concisos sobre la entidad destacando su trayectoria, acreditación y presencia en ${city || country || "la región"}.
INSTRUCCIÓN DEL ADMINISTRADOR: "${prompt}"
${variationDirective}
TEXTO ACTUAL: "${currentText}"
DATOS DE LA ENTIDAD:
${contextFacts}

Devuelve UN JSON ESTRICTO con:
{
  "providerInfo": "Texto en español",
  "providerInfoI18n": {
    "es": "Texto en español",
    "en": "Text in English",
    "pt": "Texto em português",
    "it": "Testo in italiano"
  }
}`;
      const parsed = await callAI(aiPrompt, "provider_info");
      const infoRes = parsed.providerInfo || parsed.providerInfoI18n?.es || currentText;
      return NextResponse.json({
        success: true,
        result: { providerInfo: infoRes, text: infoRes },
        translations: parsed.providerInfoI18n || { es: infoRes, en: infoRes, pt: infoRes, it: infoRes },
      });
    }

    return NextResponse.json({ error: `Tipo de campo no soportado: ${fieldType}` }, { status: 400 });
  } catch (err: any) {
    console.error("AI Refine Field Route Error:", err);
    return NextResponse.json(
      { error: err?.message || "Error al procesar el prompt con IA." },
      { status: 500 }
    );
  }
}
