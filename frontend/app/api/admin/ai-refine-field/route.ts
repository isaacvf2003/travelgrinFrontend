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

async function callGemini(prompt: string, apiKey: string, temperature = 0.92): Promise<string> {
  const candidateModels = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
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
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify(payload),
        }
      );

      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1000));
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(15000),
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
            signal: AbortSignal.timeout(15000),
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
          const result = await tryModel(model);
          if (result) {
            cachedRefineModel = model;
            return result;
          }
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

async function callOpenAI(prompt: string, apiKey: string, temperature = 0.92): Promise<string> {
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
        signal: AbortSignal.timeout(18000),
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
      sourceLang = "es",
      autoTranslate = false,
      apiKey,
      provider = "auto",
      variationIndex = 1,
      scrapedHeadings = [],
      scrapedParagraphs = [],
      scrapedTextContent = "",
      rawPageTitle = "",
    } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ success: false, error: "Debe ingresar una instrucción o prompt para la IA." }, { status: 400 });
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
          rawJson = await callOpenAI(promptStr, openaiKey, 0.92);
        } catch (e) {
          if (geminiKey) rawJson = await callGemini(promptStr, geminiKey, 0.92);
          else throw e;
        }
      } else if (geminiKey) {
        try {
          rawJson = await callGemini(promptStr, geminiKey, 0.92);
        } catch (e) {
          if (openaiKey) rawJson = await callOpenAI(promptStr, openaiKey, 0.92);
          else throw e;
        }
      } else if (openaiKey) {
        rawJson = await callOpenAI(promptStr, openaiKey, 0.92);
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

    const randomSalt = Math.floor(Math.random() * 900000) + 100000;
    const variationDirective = `
======================================================================
DIRECTIVA OBLIGATORIA DE REFORMULACIÓN CREATIVA (INTENTO / VARIACIÓN #${variationIndex || 1} - SEMILLA: ${randomSalt}):
- El usuario pulsó "Reformular con IA" porque exige una versión NUEVA, COMPLETAMENTE DIFERENTE, FRESCA Y CON ALTO IMPACTO.
- TEXTO PREVIO A REEMPLAZAR Y NO REPETIR: "${(currentText || currentTitle || "").replace(/<[^>]+>/g, " ").slice(0, 450)}"
REGLAS ESTRICTAS DE VARIACIÓN:
1. TOTALMENTE PROHIBIDO repetir exactamente las mismas frases de inicio, conectores o idéntica estructura que la versión anterior.
2. Utiliza una apertura novedosa, palabras clave frescas, enfoque dinámico y atractivo comercial.
3. CUMPLE RIGUROSAMENTE CON LA INSTRUCCIÓN O PROMPT DEL ADMINISTRADOR: "${prompt}".
======================================================================`;

    // 1. TÍTULO
    if (fieldType === "title") {
      const aiPrompt = autoTranslate
        ? `Eres un redactor y especialista en marketing para Travelgrin.
Genera un título comercial, atractivo y de alta conversión cumpliendo rigurosamente la instrucción del administrador.
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${variationDirective}
DATOS DE LA ENTIDAD:
${contextFacts}
TÍTULO ACTUAL PREVIO A REEMPLAZAR: "${currentText || currentTitle}"

Devuelve ÚNICAMENTE un objeto JSON con:
{
  "title": "Título redactado aquí",
  "titleI18n": {
    "es": "Título en español",
    "en": "Title in English",
    "pt": "Título em português",
    "it": "Titolo in italiano"
  }
}`
        : `Eres un redactor y especialista en marketing para Travelgrin.
Genera un título comercial, atractivo y de alta conversión cumpliendo rigurosamente la instrucción del administrador en idioma ${sourceLang}.
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${variationDirective}
DATOS DE LA ENTIDAD:
${contextFacts}
TÍTULO ACTUAL PREVIO A REEMPLAZAR: "${currentText || currentTitle}"

Devuelve ÚNICAMENTE un objeto JSON rápido con:
{
  "title": "Título redactado y fresco aquí"
}`;

      const parsed = await callAI(aiPrompt, "title");
      const titleRes = parsed.title || parsed.titleI18n?.[sourceLang] || parsed.titleI18n?.es || currentTitle || currentText;
      const translations = parsed.titleI18n || {
        [sourceLang]: titleRes,
        ...(sourceLang === "es" ? { es: titleRes } : {}),
      };

      return NextResponse.json({
        success: true,
        result: { title: titleRes, text: titleRes },
        translations,
      });
    }

    // 2. DESCRIPCIÓN PRINCIPAL
    if (fieldType === "description") {
      const aiPrompt = autoTranslate
        ? `Eres el redactor jefe de Travelgrin.
Tu objetivo es redactar o mejorar la descripción principal de la publicación CUMPLIENDO RIGUROSAMENTE CON LA INSTRUCCIÓN DEL ADMINISTRADOR y basándote en la información real de la entidad.
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${variationDirective}
DESCRIPCIÓN ACTUAL PREVIA A REEMPLAZAR: "${currentText}"
DATOS DE LA ENTIDAD:
${contextFacts}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: Cumple fielmente y al pie de la letra la instrucción del administrador:
   - Si pide una cantidad exacta de párrafos (ej: "5 párrafos"), REDACTA EXACTAMENTE ESA CANTIDAD DE PÁRRAFOS.
   - Si pide subtítulos en negrita o letras negras y su explicación, cada párrafo debe comenzar con <p><strong>Título del Párrafo</strong><br/>Explicación persuasiva y detallada...</p>.
   - Si pide tono comercial, persuasivo o de conversión, aplícalo con fluidez.
2. CERO PLANTILLAS RÍGIDAS: La redacción debe ser fresca y personalizada a los servicios de la entidad.
3. Formato HTML limpio: Estructura en párrafos <p>...</p>.
Devuelve ÚNICAMENTE un objeto JSON con:
{
  "description": "<p>Primer párrafo...</p><p>Segundo párrafo...</p>",
  "descriptionI18n": {
    "es": "<p>Contenido en español...</p>",
    "en": "<p>Content in English...</p>",
    "pt": "<p>Conteúdo em português...</p>",
    "it": "<p>Contenuto in italiano...</p>"
  }
}`
        : `Eres el redactor jefe de Travelgrin.
Tu objetivo es redactar o mejorar la descripción principal de la publicación CUMPLIENDO RIGUROSAMENTE CON LA INSTRUCCIÓN DEL ADMINISTRADOR en idioma ${sourceLang} y basándote en la información real de la entidad.
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${variationDirective}
DESCRIPCIÓN ACTUAL PREVIA A REEMPLAZAR: "${currentText}"
DATOS DE LA ENTIDAD:
${contextFacts}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: Cumple fielmente y al pie de la letra la instrucción del administrador:
   - Si pide una cantidad exacta de párrafos (ej: "5 párrafos"), REDACTA EXACTAMENTE ESA CANTIDAD DE PÁRRAFOS en HTML <p>...</p>.
   - Si pide subtítulos en negrita o letras negras y su explicación, cada párrafo debe comenzar con <p><strong>Título del Párrafo</strong><br/>Explicación persuasiva y detallada...</p>.
   - Si pide tono comercial, persuasivo o de conversión, aplícalo con fluidez.
2. CERO PLANTILLAS RÍGIDAS: Redacción personalizada, humana y directa.
3. Formato HTML limpio: Estructura en párrafos <p>...</p>.
Devuelve ÚNICAMENTE un objeto JSON rápido con:
{
  "description": "<p>Primer párrafo...</p><p>Segundo párrafo...</p>"
}`;

      const parsed = await callAI(aiPrompt, "description");
      const descRes = parsed.description || parsed.descriptionI18n?.[sourceLang] || parsed.descriptionI18n?.es || currentText;
      const translations = parsed.descriptionI18n || {
        [sourceLang]: descRes,
        ...(sourceLang === "es" ? { es: descRes } : {}),
      };

      return NextResponse.json({
        success: true,
        result: { description: descRes, text: descRes },
        translations,
      });
    }

    // 3. BLOQUE ADICIONAL (extra_block / new_extra_block)
    if (fieldType === "extra_block" || fieldType === "new_extra_block") {
      const blockTitle = currentTitle || "Información Adicional";

      const aiPrompt = autoTranslate
        ? `Eres un redactor profesional de bloques de contenido para Travelgrin.
Tu tarea es redactar el contenido para el bloque titulado "${blockTitle}" CUMPLIENDO ESTRICTAMENTE LA INSTRUCCIÓN DEL ADMINISTRADOR.
TÍTULO DEL BLOQUE: "${blockTitle}"
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${variationDirective}
CONTENIDO ACTUAL PREVIO A REEMPLAZAR: "${currentText}"
DATOS DE REFERENCIA DE LA ENTIDAD:
${contextFacts}

REGLAS:
1. Cumple al 100% la instrucción del administrador (cantidad de preguntas si es FAQ, formato, negritas, estilos).
2. Si es Preguntas Frecuentes, genera formato <p><strong>¿Pregunta...?</strong><br/>Respuesta detallada...</p>.
3. Devuelve ÚNICAMENTE un objeto JSON con:
{
  "title": "${blockTitle}",
  "body": "Contenido enriquecido en HTML <p>...",
  "titleI18n": { "es": "${blockTitle}", "en": "...", "pt": "...", "it": "..." },
  "bodyI18n": { "es": "<p>...</p>", "en": "<p>...</p>", "pt": "<p>...</p>", "it": "<p>...</p>" }
}`
        : `Eres un redactor profesional de bloques de contenido para Travelgrin.
Tu tarea es redactar el contenido para el bloque titulado "${blockTitle}" CUMPLIENDO ESTRICTAMENTE LA INSTRUCCIÓN DEL ADMINISTRADOR en idioma ${sourceLang}.
TÍTULO DEL BLOQUE: "${blockTitle}"
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${variationDirective}
CONTENIDO ACTUAL PREVIO A REEMPLAZAR: "${currentText}"
DATOS DE REFERENCIA DE LA ENTIDAD:
${contextFacts}

REGLAS:
1. Cumple al 100% la instrucción del administrador (cantidad de preguntas si es FAQ, formato, negritas, estilos).
2. Si es Preguntas Frecuentes, genera formato <p><strong>¿Pregunta...?</strong><br/>Respuesta detallada...</p>.
3. Devuelve ÚNICAMENTE un objeto JSON rápido con:
{
  "title": "${blockTitle}",
  "body": "Contenido enriquecido en párrafos HTML <p>..."
}`;

      const parsed = await callAI(aiPrompt, fieldType);
      const resolvedTitle = parsed.title || blockTitle;
      const resolvedBody = parsed.body || parsed.bodyI18n?.[sourceLang] || parsed.bodyI18n?.es || "";

      const tI18n = parsed.titleI18n || {
        [sourceLang]: resolvedTitle,
        ...(sourceLang === "es" ? { es: resolvedTitle } : {}),
      };
      const bI18n = parsed.bodyI18n || {
        [sourceLang]: resolvedBody,
        ...(sourceLang === "es" ? { es: resolvedBody } : {}),
      };

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
      const aiPrompt = autoTranslate
        ? `Eres un redactor institucional de Travelgrin.
Redacta 1 o 2 párrafos institucionales concisos sobre la entidad destacando su trayectoria, acreditación y presencia en ${city || country || "la región"}.
INSTRUCCIÓN DEL ADMINISTRADOR: "${prompt}"
${variationDirective}
TEXTO ACTUAL: "${currentText}"
DATOS DE LA ENTIDAD:
${contextFacts}

Devuelve UN JSON con:
{
  "providerInfo": "Texto en español",
  "providerInfoI18n": {
    "es": "Texto en español",
    "en": "Text in English",
    "pt": "Texto em português",
    "it": "Testo in italiano"
  }
}`
        : `Eres un redactor institucional de Travelgrin.
Redacta 1 o 2 párrafos institucionales concisos sobre la entidad destacando su trayectoria, acreditación y presencia en ${city || country || "la región"} en idioma ${sourceLang}.
INSTRUCCIÓN DEL ADMINISTRADOR: "${prompt}"
${variationDirective}
TEXTO ACTUAL: "${currentText}"
DATOS DE LA ENTIDAD:
${contextFacts}

Devuelve UN JSON rápido con:
{
  "providerInfo": "Texto institucional conciso y fresco"
}`;

      const parsed = await callAI(aiPrompt, "provider_info");
      const infoRes = parsed.providerInfo || parsed.providerInfoI18n?.[sourceLang] || parsed.providerInfoI18n?.es || currentText;
      const translations = parsed.providerInfoI18n || {
        [sourceLang]: infoRes,
        ...(sourceLang === "es" ? { es: infoRes } : {}),
      };

      return NextResponse.json({
        success: true,
        result: { providerInfo: infoRes, text: infoRes },
        translations,
      });
    }

    return NextResponse.json({ success: false, error: `Tipo de campo no soportado: ${fieldType}` }, { status: 400 });
  } catch (err: any) {
    console.error("AI Refine Field Route Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Error al procesar la reformulación con IA.",
      },
      { status: 500 }
    );
  }
}
