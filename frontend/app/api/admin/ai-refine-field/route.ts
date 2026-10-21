import { NextResponse } from "next/server";

import {
  enforceFaqCountAndFilter,
  applyPromptColorStyles,
  checkPromptOmitEntityName,
  cleanTitleOmitEntity,
  enforceDescriptionParagraphCount,
  enforceParagraphWordLimit,
  synthesizeMarketingTitle,
  enforceTitleConstraints,
  buildRichProviderInfo,
} from "@/app/lib/aiPublicationAgents";

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
  mainDescription?: string;
  previousBlocks?: Array<{ title: string; body: string }>;
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
      mainDescription = "",
      previousBlocks = [],
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
      const omitName = checkPromptOmitEntityName(prompt);
      const entityLabel = publisherName || currentTitle || "la institución";
      const negativeConstraintNotice = omitName
        ? `\nREGLA CRÍTICA NEGATIVA: El administrador exige expresamente que el título NO CONTENGA EL NOMBRE DE LA INSTITUCIÓN O EMPRESA (${entityLabel}). ESTÁ TERMINANTEMENTE PROHIBIDO incluir '${entityLabel}' o el nombre de la entidad en el título. Genera únicamente el titular, propuesta de valor o eslogan publicitario de alto impacto (ej: 'Carreras Universitarias, Cursado Online y Título Oficial').\n`
        : "";

      const aiPrompt = autoTranslate
        ? `Eres un redactor y especialista en marketing para Travelgrin.
Genera un título comercial, atractivo y de alta conversión cumpliendo rigurosamente la instrucción del administrador.
REGLA ESTRICTA DE LÍMITE DE PALABRAS Y EXTENSIÓN: Si el administrador solicita un límite de palabras (ej: "máximo 25 palabras", "un límite de 25 palabras", "hasta 20 palabras", "menos de 15 palabras", "tope de 25 palabras"): CUMPLE ESTRICTAMENTE Y NO SUPERES esa cantidad de palabras. Cuenta las palabras con exactitud antes de emitir la respuesta. Además, redacta un titular completo, llamativo y atractivo que aproveche bien la extensión solicitada (ej: si pide hasta 25 palabras, aprovecha una extensión sustancial de 15 a 25 palabras; no devuelvas un título telegráfico de solo 5 palabras).
MÁXIMA LIBERTAD Y CERO PLANTILLAS: Cumple fielmente la directiva del administrador sin forzar plantillas predefinidas.
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${negativeConstraintNotice}
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
} `
        : `Eres un redactor y especialista en marketing para Travelgrin.
Genera un título comercial, atractivo y de alta conversión cumpliendo rigurosamente la instrucción del administrador en idioma ${sourceLang}.
REGLA ESTRICTA DE LÍMITE DE PALABRAS Y EXTENSIÓN: Si el administrador solicita un límite de palabras (ej: "máximo 25 palabras", "un límite de 25 palabras", "hasta 20 palabras", "menos de 15 palabras", "tope de 25 palabras"): CUMPLE ESTRICTAMENTE Y NO SUPERES esa cantidad de palabras. Cuenta las palabras con exactitud antes de emitir la respuesta. Además, redacta un titular completo, llamativo y atractivo que aproveche bien la extensión solicitada (ej: si pide hasta 25 palabras, aprovecha una extensión sustancial de 15 a 25 palabras; no devuelvas un título telegráfico de solo 5 palabras).
MÁXIMA LIBERTAD Y CERO PLANTILLAS: Cumple fielmente la directiva del administrador sin forzar plantillas predefinidas.
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${negativeConstraintNotice}
${variationDirective}
DATOS DE LA ENTIDAD:
${contextFacts}
TÍTULO ACTUAL PREVIO A REEMPLAZAR: "${currentText || currentTitle}"

Devuelve ÚNICAMENTE un objeto JSON rápido con:
{
  "title": "Título redactado y fresco aquí"
}`;

      const parsed = await callAI(aiPrompt, "title");
      let titleRes = parsed.title || parsed.titleI18n?.[sourceLang] || parsed.titleI18n?.es || currentTitle || currentText;
      const wantsMarketing = /(?:marketing|conversi[oó]n|llamativ|atenci[oó]n|bastante\s+largo|largo|impactante|vendedor)/i.test(prompt);
      const isBare = titleRes.trim().toLowerCase() === entityLabel.toLowerCase();

      if (omitName) {
        titleRes = cleanTitleOmitEntity(titleRes, entityLabel, publisherName);
        if (!titleRes || titleRes.length < 8) {
          titleRes = synthesizeMarketingTitle(entityLabel, {
            url: url || "",
            publisherName: entityLabel,
            headings: scrapedHeadings,
            paragraphs: scrapedParagraphs,
            mainText: scrapedTextContent,
            city,
            country,
          }, prompt);
        }
      } else if (!titleRes || (isBare && !wantsMarketing)) {
        titleRes = synthesizeMarketingTitle(entityLabel, {
          url: url || "",
          publisherName: entityLabel,
          headings: scrapedHeadings,
          paragraphs: scrapedParagraphs,
          mainText: scrapedTextContent,
          city,
          country,
        }, prompt);
      }
      titleRes = enforceTitleConstraints(titleRes, prompt);
      const translations = parsed.titleI18n || {
        [sourceLang]: titleRes,
        ...(sourceLang === "es" ? { es: titleRes } : {}),
      };
      if (translations) {
        for (const lang of Object.keys(translations)) {
          if (omitName) {
            translations[lang] = cleanTitleOmitEntity(translations[lang], entityLabel, publisherName);
          }
          translations[lang] = enforceTitleConstraints(translations[lang] || titleRes, prompt);
          if (!translations[lang] || translations[lang].length < 8) {
            translations[lang] = titleRes;
          }
        }
      }

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
   - Si pide una cantidad exacta de párrafos (ej: "2 párrafos", "5 párrafos"), REDACTA EXACTAMENTE ESA CANTIDAD DE PÁRRAFOS en HTML <p>...</p>.
   - Si pide subtítulos o títulos con su explicación o pide colores (ej: "con los títulos en letras azules y su explicación", "letras amarillo", etc.), aplica el estilo inline exacto pedido: azul (#0066cc), rojo (#dc2626), amarillo (#ca8a04). Cada párrafo debe comenzar con <p><strong style="color: ...">Título del Párrafo:</strong> Explicación detallada...</p>. Si no pide colores pero pide subtítulos, usa <p><strong>Subtítulo:</strong> Explicación...</p>.
   - REGLA ESTRICTA DE LÍMITE DE PALABRAS EN CADA PÁRRAFO: Si el administrador solicita un límite de palabras en cada párrafo (ej: "máximo 50 palabras en cada párrafo", "un límite de 50 palabras", "hasta 50 palabras"): CUMPLE ESTRICTAMENTE Y NO SUPERES esa cantidad en ningún párrafo. Además, DESARROLLA Y EXPLAYA el contenido con riqueza informativa y persuasión para acercarte a la extensión solicitada (entre 38 y 50 palabras por párrafo; NO escribas párrafos pobres o telegráficos de solo 15-20 palabras). Cuenta las palabras con exactitud antes de emitir la respuesta.
   - Si pide emojis o iconos, inclúyelos con total naturalidad en los subtítulos o texto según lo solicitado.
   - Si pide tono comercial, persuasivo o de conversión, aplícalo con fluidez.
2. CERO PLANTILLAS RÍGIDAS: Prohibido usar plantillas fijas o hablar de clínicas/salud si la entidad es de otro rubro (ej: educación, hotelería, etc.). Redacción personalizada y basada estrictamente en la entidad real.
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
   - Si pide una cantidad exacta de párrafos (ej: "2 párrafos", "5 párrafos"), REDACTA EXACTAMENTE ESA CANTIDAD DE PÁRRAFOS en HTML <p>...</p>.
   - Si pide subtítulos o títulos con su explicación o pide colores (ej: "con los títulos en letras azules y su explicación", "letras amarillo", etc.), aplica el estilo inline exacto pedido: azul (#0066cc), rojo (#dc2626), amarillo (#ca8a04). Cada párrafo debe comenzar con <p><strong style="color: ...">Título del Párrafo:</strong> Explicación persuasiva y detallada con excelente SEO...</p>. Si no pide colores pero pide subtítulos, usa <p><strong>Subtítulo:</strong> Explicación...</p>.
   - REGLA ESTRICTA DE LÍMITE DE PALABRAS EN CADA PÁRRAFO: Si el administrador solicita un límite de palabras en cada párrafo (ej: "máximo 50 palabras en cada párrafo", "un límite de 50 palabras", "hasta 50 palabras"): CUMPLE ESTRICTAMENTE Y NO SUPERES esa cantidad en ningún párrafo. Además, DESARROLLA Y EXPLAYA el contenido con riqueza informativa y persuasión para acercarte a la extensión solicitada (entre 38 y 50 palabras por párrafo; NO escribas párrafos pobres o telegráficos de solo 15-20 palabras). Cuenta las palabras con exactitud antes de emitir la respuesta.
   - Si pide emojis o iconos, inclúyelos con total naturalidad en los subtítulos o texto según lo solicitado.
   - Si pide tono comercial, persuasivo, SEO o de conversión, aplícalo con fluidez.
2. CERO PLANTILLAS RÍGIDAS: Prohibido usar plantillas fijas o hablar de clínicas/salud si la entidad es de otro rubro. Redacción personalizada, humana y directa.
3. Formato HTML limpio: Estructura en párrafos <p>...</p>.
Devuelve ÚNICAMENTE un objeto JSON rápido con:
{
  "description": "<p>Primer párrafo...</p><p>Segundo párrafo...</p>"
}`;

      const parsed = await callAI(aiPrompt, "description");
      let descRes = parsed.description || parsed.descriptionI18n?.[sourceLang] || parsed.descriptionI18n?.es || currentText;
      if (prompt && descRes) {
        descRes = enforceDescriptionParagraphCount(descRes, prompt);
        descRes = enforceParagraphWordLimit(descRes, prompt);
        descRes = applyPromptColorStyles(descRes, prompt);
      }
      const translations = parsed.descriptionI18n || {
        [sourceLang]: descRes,
        ...(sourceLang === "es" ? { es: descRes } : {}),
      };
      if (prompt && translations) {
        for (const lang of Object.keys(translations)) {
          translations[lang] = enforceDescriptionParagraphCount(translations[lang], prompt);
          translations[lang] = enforceParagraphWordLimit(translations[lang], prompt);
          translations[lang] = applyPromptColorStyles(translations[lang], prompt);
        }
      }

      return NextResponse.json({
        success: true,
        result: { description: descRes, text: descRes },
        translations,
      });
    }

    // 3. BLOQUE ADICIONAL (extra_block / new_extra_block)
    if (fieldType === "extra_block" || fieldType === "new_extra_block") {
      const blockTitle = currentTitle || "Información Adicional";

      const previousBlocksSummary = Array.isArray(previousBlocks) && previousBlocks.length > 0
        ? previousBlocks.map((b, idx) => `Bloque previo ${idx + 1} [${b.title}]: ${b.body ? b.body.replace(/<[^>]+>/g, " ").slice(0, 500) : "Sin contenido"}`).join("\n")
        : "";

      const extraContextPrompt = [
        mainDescription ? `DESCRIPCIÓN PRINCIPAL DE LA PUBLICACIÓN (CONTEXTO GENERAL):\n${mainDescription.replace(/<[^>]+>/g, " ").slice(0, 1200)}` : "",
        previousBlocksSummary ? `BLOQUES PREVIOS YA GENERADOS EN LA PUBLICACIÓN:\n${previousBlocksSummary}` : "",
      ].filter(Boolean).join("\n\n");

      const editorialRules = `
REGLAS SUPREMAS DE REDACCIÓN:
1. AUTORIDAD EDITORIAL SUPREMA: Cumple rigurosamente TODO lo que el usuario pida en su instrucción por más inusual o específico que sea:
   - Si pide considerar, mirar o coordinar con la información del bloque anterior o de la descripción principal, UTILIZA ESPECÍFICAMENTE el contexto provisto abajo para responder coherentemente sin contradecirte.
   - Si el usuario pide iconos, emojis, viñetas, colores, preguntas, o estilos particulares, INCLÚYELOS EXACTAMENTE como se solicita.
   - Si el prompt del usuario únicamente especifica formato o colores (ej: "2 preguntas en rojo y su respuesta en negro") sin especificar el tema, EL TEMA DEL BLOQUE ESTÁ RIGUROSAMENTE DEFINIDO POR EL TÍTULO DEL BLOQUE ("${blockTitle}").
   - Si pide una cantidad exacta (ej: 2 preguntas, 3 subtítulos, etc.), REDACTA EXACTAMENTE ESA CANTIDAD.
   - Si se solicitaron colores específicos (ej: preguntas en rojo, respuestas en negro), aplica los estilos inline directamente: <strong style="color: #dc2626;">¿Pregunta?</strong><br/><span style="color: #000000;">Respuesta</span>.
2. CERO PLANTILLAS RÍGIDAS: Adapta la información a la entidad real y al título del bloque; prohibido inventar contenido clínico para entidades no médicas.
3. Formato HTML limpio en párrafos <p>...</p>.`;

      const aiPrompt = autoTranslate
        ? `Eres un redactor profesional de bloques de contenido para Travelgrin.
Tu tarea es redactar el contenido para el bloque titulado "${blockTitle}" CUMPLIENDO ESTRICTAMENTE LA INSTRUCCIÓN DEL ADMINISTRADOR.
TÍTULO DEL BLOQUE: "${blockTitle}"
INSTRUCCIÓN DEL ADMINISTRADOR (MÁXIMA PRIORIDAD): "${prompt}"
${variationDirective}
CONTENIDO ACTUAL PREVIO A REEMPLAZAR: "${currentText}"
DATOS DE REFERENCIA DE LA ENTIDAD:
${contextFacts}
${extraContextPrompt ? `\nCONTEXTO DE DESCRIPCIÓN Y BLOQUES ANTERIORES:\n${extraContextPrompt}\n` : ""}
${editorialRules}

Devuelve ÚNICAMENTE un objeto JSON con:
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
${extraContextPrompt ? `\nCONTEXTO DE DESCRIPCIÓN Y BLOQUES ANTERIORES:\n${extraContextPrompt}\n` : ""}
${editorialRules}

Devuelve ÚNICAMENTE un objeto JSON rápido con:
{
  "title": "${blockTitle}",
  "body": "Contenido enriquecido en párrafos HTML <p>..."
}`;

      const parsed = await callAI(aiPrompt, fieldType);
      const resolvedTitle = parsed.title || blockTitle;
      let resolvedBody = parsed.body || parsed.bodyI18n?.[sourceLang] || parsed.bodyI18n?.es || "";

      // Post-process with count enforcement and color styling to guarantee exact user parameters
      if (resolvedBody) {
        resolvedBody = enforceFaqCountAndFilter(resolvedBody, prompt);
        resolvedBody = applyPromptColorStyles(resolvedBody, prompt);
      }

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
REGLA DE ALEATORIEDAD: Redacta con un enfoque narrativo fresco y diferente (destacando a veces equipamiento/tecnología, a veces trayectoria y prestigio, a veces calidez humana y atención de su equipo multidisciplinario, o liderazgo regional). CERO PLANTILLAS RÍGIDAS.
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
      let infoRes = parsed.providerInfo || parsed.providerInfoI18n?.[sourceLang] || parsed.providerInfoI18n?.es || currentText;
      if (!infoRes || infoRes.includes("es un establecimiento y prestador de servicios") || infoRes.length < 20) {
        infoRes = buildRichProviderInfo(entityName, city || "", country || "", undefined, mainDescription);
      }
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
