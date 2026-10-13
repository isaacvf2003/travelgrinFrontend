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

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(25000),
        body: JSON.stringify(payload),
      }
    );

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return text.replace(/```json\s*|```/gi, "").trim();
    } else if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 400));
      const retryRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(25000),
          body: JSON.stringify(payload),
        }
      );
      if (retryRes.ok) {
        const data = await retryRes.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        return text.replace(/```json\s*|```/gi, "").trim();
      }
      const errText = await retryRes.text();
      lastError = new Error(`Gemini (${model}): ${errText}`);
    } else {
      const errText = await res.text();
      lastError = new Error(`Gemini (${model}): ${errText}`);
    }
    return null;
  };

  for (const model of candidateModels) {
    try {
      const result = await tryModel(model);
      if (result) return result;
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
      scrapedHeadings.length ? `Encabezados: ${scrapedHeadings.slice(0, 8).join(" | ")}` : "",
      scrapedParagraphs.length ? `Datos web: ${scrapedParagraphs.slice(0, 5).join(" ")}` : "",
      scrapedTextContent ? `Texto: ${scrapedTextContent.slice(0, 2000)}` : "",
    ].filter(Boolean).join("\n");

    const variationDirective = `
======================================================================
VARIACIÓN #${variationIndex || 1} (SOLICITUD DE RESPUESTA TOTALMENTE DIFERENTE):
- El administrador está reformulando y exige una propuesta TOTALMENTE DISTINTA a la anterior.
- VALOR ACTUAL PREVIO A DESCARTAR / SUPERAR: "${currentText || currentTitle}"
- NO repitas la misma estructura de frases, ni el mismo orden de ideas, ni los mismos adjetivos de la versión previa.
- Explora un nuevo enfoque persuasivo, dinámico y atractivo respetando la veracidad de los datos de la entidad y la instrucción del administrador.
======================================================================`;

    // 1. TÍTULO
    if (fieldType === "title") {
      const aiPrompt = `Eres un redactor y editor profesional de Travelgrin.
Genera un título comercial, atractivo y representativo para la publicación de la siguiente entidad cumpliendo la instrucción del administrador.
INSTRUCCIÓN DEL ADMINISTRADOR: "${prompt}"
${variationDirective}
DATOS DE LA ENTIDAD:
${contextFacts}
TÍTULO ACTUAL: "${currentText || currentTitle}"

REGLAS:
- Elimina sufijos y prefijos genéricos de navegación como "- Inicio", "| Home", "Sitio Oficial".
- Debe ser atractivo, claro y en español.
- Genera también traducciones a en, pt, it.

Devuelve UN JSON ESTRICTO con:
{
  "title": "Título en español",
  "titleI18n": {
    "es": "Título en español",
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
Tu objetivo es redactar o mejorar la descripción principal de la publicación cumpliendo con la instrucción del administrador y basándote en la información real de la entidad.
INSTRUCCIÓN DEL ADMINISTRADOR: "${prompt}"
${variationDirective}
DESCRIPCIÓN ACTUAL: "${currentText}"
DATOS DE LA ENTIDAD:
${contextFacts}

PAUTAS DE REDACCIÓN:
- Redacta de forma profesional, fluida, humana y atractiva en párrafos HTML (<p>...</p>).
- Cumple fielmente las instrucciones del administrador (por ejemplo, si pide párrafos con subtítulos en negrita, tono comercial, resumen, etc.).
- PROHIBIDO usar plantillas rígidas o etiquetas repetitivas obligatorias como 'Vigencia:' o 'Propuesta de valor:' a menos que el administrador lo haya solicitado expresamente.
- No inventes datos ficticios; describe los servicios reales que ofrece la entidad.
- Genera también las traducciones a en, pt, it correspondientes.

Devuelve UN JSON ESTRICTO con:
{
  "description": "Texto completo en español estructurado en párrafos HTML (<p>...</p>)",
  "descriptionI18n": {
    "es": "Texto completo en español estructurado en párrafos HTML",
    "en": "Complete text in English formatted in HTML paragraphs",
    "pt": "Texto completo em português formatado em parágrafos HTML",
    "it": "Testo completo in italiano formattato in paragrafi HTML"
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
      const isFaq = /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(blockTitle) || /faq|preguntas/i.test(prompt);

      const aiPrompt = `Eres un redactor profesional de bloques de contenido para Travelgrin.
Tu tarea es redactar el contenido para un bloque específico titulado "${blockTitle}" cumpliendo estrictamente la instrucción del administrador.
TÍTULO DEL BLOQUE: "${blockTitle}"
INSTRUCCIÓN DEL ADMINISTRADOR: "${prompt}"
${variationDirective}
CONTENIDO ACTUAL DEL BLOQUE: "${currentText}"
DATOS DE REFERENCIA DE LA ENTIDAD:
${contextFacts}

REGLAS DE FORMATO:
- Si el bloque es de Preguntas Frecuentes (FAQ) o pide preguntas y respuestas: redacta entre 5 y 10 preguntas y respuestas relevantes en formato HTML: <p><strong>¿Pregunta...?</strong><br/>Respuesta clara en tercera persona basada en los servicios...</p>.
- Si es otro tipo de bloque (ej. Requisitos, Modalidades, Servicios, Aranceles): redacta párrafos estructurados y profesionales en HTML <p>...</p>.
- NUNCA devuelvas el contenido vacío.
- Genera también las traducciones a es, en, pt, it.

Devuelve UN JSON ESTRICTO con:
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
