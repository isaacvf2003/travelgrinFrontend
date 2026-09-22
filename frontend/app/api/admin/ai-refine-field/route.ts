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

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms: number = 5000): Promise<Response> {
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
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 3000);
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
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 3000);
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
    .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Experiência e suporte):\s*<\/em>/gi, "<em>Esperienza e supporto:</em>")
    .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives):\s*<\/em>/gi, "<em>Differenziale vs. alternative:</em>")
    .replace(/<strong>\s*(?:Exclusiones|Exclusions|Exclusões):\s*<\/strong>/gi, "<strong>Esclusioni:</strong>");
}

async function translateFullHtml(htmlEs: string, targetLang: "en" | "pt" | "it"): Promise<string> {
  if (!htmlEs) return "";
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const rawParagraphs: string[] = [];
  let match;
  while ((match = pRegex.exec(htmlEs)) !== null) {
    rawParagraphs.push(match[1]);
  }

  if (rawParagraphs.length === 0) {
    const parts = htmlEs.split(/(<\/?[a-z0-9]+\b[^>]*>)/gi);
    const translatedParts = await Promise.all(
      parts.map(async (part) => {
        if (!part || /^<\/?[a-z0-9]+/i.test(part)) return part;
        const trimmed = part.trim();
        if (!trimmed || /^[💡⭐⚠️•>]+$/.test(trimmed)) return part;
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

  const translatedPs = await Promise.all(
    rawParagraphs.map(async (pText) => {
      const parts = pText.split(/(<\/?[a-z0-9]+\b[^>]*>)/gi);
      const translatedParts = await Promise.all(
        parts.map(async (part) => {
          if (!part || /^<\/?[a-z0-9]+/i.test(part)) return part;
          const trimmed = part.trim();
          if (!trimmed || /^[💡⭐⚠️•>]+$/.test(trimmed)) return part;
          const leadingSpace = part.match(/^\s*/)?.[0] || "";
          const trailingSpace = part.match(/\s*$/)?.[0] || "";
          const trans = await translateTextDirect(trimmed, "es", targetLang);
          return `${leadingSpace}${trans}${trailingSpace}`;
        })
      );
      return `<p>${translatedParts.join("")}</p>`;
    })
  );

  const fullHtml = translatedPs.join("\n");
  return targetLang === "en"
    ? normalizeToEnglishDescriptionHeaders(fullHtml)
    : targetLang === "pt"
    ? normalizeToPortugueseDescriptionHeaders(fullHtml)
    : normalizeToItalianDescriptionHeaders(fullHtml);
}

function buildSystemRefinePrompt(
  fieldType: FieldType,
  currentText: string,
  prompt: string,
  meta: { title?: string; publisherName?: string; category?: string; city?: string; country?: string; url?: string }
): string {
  const contextStr = [
    meta.title ? `Título: ${meta.title}` : "",
    meta.publisherName ? `Entidad/Oferente: ${meta.publisherName}` : "",
    meta.category ? `Categoría: ${meta.category}` : "",
    meta.city ? `Ubicación: ${meta.city}${meta.country ? `, ${meta.country}` : ""}` : "",
    meta.url ? `Web: ${meta.url}` : "",
  ].filter(Boolean).join(" | ");

  return `
Eres el Lead AI Editor y Copywriter Profesional de Travelgrin, una plataforma internacional de publicaciones y servicios auditados.

TU TAREA:
El usuario te proporciona un texto existente y un PROMPT O INSTRUCCIÓN para mejorarlo o personalizarlo.

IMPORTANTE SOBRE LA FORMA DE HABLAR Y EL PROMPT DEL USUARIO:
- El usuario puede escribirte una instrucción formal y detallada (ej: "Reestructurar destacando convenios universitarios y facilidades de pago") o una instrucción breve, coloquial, informal o "vaga" (ej: "hacelo mas corto broh", "sacale eso de los precios y ponele que es gratis", "ponele que queda cerca del centro", "hacelo mas canchero", "mas directo", "arriba ponele solo el nombre").
- DEBES COMPRENDER con inteligencia la intención del usuario independientemente de cómo lo exprese, y aplicar el cambio con máxima calidad y redacción profesional adecuada a la publicación de Travelgrin.

CONTEXTO INSTITUCIONAL:
${contextStr || "Sin contexto adicional"}

TIPO DE CAMPO A MODIFICAR: "${fieldType}"
TEXTO ACTUAL:
"""
${currentText || "(campo actualmente vacío o nuevo)"}
"""

PROMPT / INSTRUCCIÓN DEL USUARIO:
"""
${prompt}
"""

REGLAS ESPECÍFICAS SEGÚN EL TIPO DE CAMPO:

1. SI fieldType === "title":
   - Devuelve un JSON con: {"title": "Nuevo título optimizado"}
   - Título limpio, conciso y atractivo. SIN sufijos de navegación como "- Home", "| Inicio", etc.

2. SI fieldType === "description":
   - Devuelve un JSON con: {"description": "Nuevo HTML de descripción"}
   - La descripción DEBE respetar RIGUROSAMENTE los 4 párrafos HTML estándar con sus iconos y negritas:
     <p><strong>Vigencia:</strong> [Texto]. <strong>Precio:</strong> [Texto].</p>
     <p>💡 <strong>Propuesta de valor:</strong> [Texto modificado según el prompt]. <strong>¿Para quién?:</strong> [Texto]. <strong>Documentación requerida:</strong> [Texto]. <strong>Permanencia:</strong> [Texto].</p>
     <p>⭐ <strong>Diferencial:</strong> <em>Idiomas de atención:</em> [Texto]. <em>Experiencia y soporte:</em> [Texto]. <em>Diferencial vs. alternativas:</em> [Texto].</p>
     <p>⚠️ <strong>Exclusiones:</strong> [Texto].</p>
   - Aplica los cambios solicitados en el prompt en los párrafos correspondientes manteniendo impecable la estructura HTML.

3. SI fieldType === "provider_info":
   - Devuelve un JSON con: {"providerInfo": "Texto de síntesis institucional del oferente"}
   - Una o dos frases claras sobre la trayectoria, alcance y rol del oferente en su ciudad.

4. SI fieldType === "extra_block" O fieldType === "new_extra_block":
   - Devuelve un JSON con: {"title": "Título del bloque", "body": "Cuerpo del bloque con formato HTML o párrafos <p>..."}
   - Si es el Score Scout, respeta la estructura de auditoría y puntajes, modificando lo que pida el usuario.
   - Si es un bloque temático (ej: Requisitos, Horarios, Financiación, Preguntas frecuentes), crea un título representativo y un cuerpo informativo claro.

RESPONDE ÚNICAMENTE CON UN OBJETO JSON VÁLIDO SIN TEXTO NI MARKDOWN ADICIONAL.
`;
}

export async function POST(req: Request) {
  try {
    const body: RefineFieldRequest = await req.json();
    const { fieldType, currentText = "", prompt, currentTitle = "", publisherName = "", category = "", city = "", country = "", url = "", autoTranslate = true, apiKey } = body;

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

    const systemPrompt = buildSystemRefinePrompt(fieldType, currentText, prompt, {
      title: currentTitle,
      publisherName,
      category,
      city,
      country,
      url,
    });

    let aiResult: any = null;

    // 1. Try Gemini
    if (geminiKey) {
      const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
      for (const model of models) {
        try {
          const resp = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: {
                  temperature: 0.2,
                  responseMimeType: "application/json",
                },
              }),
            },
            7000
          );
          if (resp.ok) {
            const data = await resp.json();
            const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const cleaned = rawJson.replace(/```json\s*|```/gi, "").trim();
            aiResult = JSON.parse(cleaned);
            break;
          }
        } catch {}
      }
    }

    // 2. Try OpenAI
    if (!aiResult && openaiKey) {
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
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: "Eres el Lead AI Editor de Travelgrin. Responde únicamente en JSON." },
                { role: "user", content: systemPrompt },
              ],
              response_format: { type: "json_object" },
              temperature: 0.2,
            }),
          },
          7000
        );
        if (resp.ok) {
          const data = await resp.json();
          const rawContent = data.choices?.[0]?.message?.content || "{}";
          const cleaned = rawContent.replace(/```json\s*|```/gi, "").trim();
          aiResult = JSON.parse(cleaned);
        }
      } catch {}
    }

    // 3. Heuristic fallback if no keys configured
    if (!aiResult) {
      if (fieldType === "title") {
        let newTitle = currentText || currentTitle || publisherName || "Publicación";
        if (/corto|breve|directo/i.test(prompt)) {
          newTitle = cleanTitleString(publisherName || newTitle);
        } else if (/atractivo|comercial/i.test(prompt)) {
          newTitle = `${cleanTitleString(publisherName || newTitle)} - Servicios Oficiales`;
        }
        aiResult = { title: newTitle };
      } else if (fieldType === "description") {
        aiResult = {
          description: currentText || `<p><strong>Vigencia:</strong> Activo; sitio oficial actualizado. <strong>Precio:</strong> A consultar.</p>\n<p>💡 <strong>Propuesta de valor:</strong> Propuesta de servicios con respaldo en ${city || "Argentina"}. <strong>¿Para quién?:</strong> Clientes y usuarios interesados. <strong>Documentación requerida:</strong> DNI o pasaporte. <strong>Permanencia:</strong> Según modalidad contratada.</p>\n<p>⭐ <strong>Diferencial:</strong> <em>Idiomas de atención:</em> Español, Inglés. <em>Experiencia y soporte:</em> Información oficial verificada. <em>Diferencial vs. alternativas:</em> Contacto directo institucional.</p>\n<p>⚠️ <strong>Exclusiones:</strong> Confirmar disponibilidad y tarifas vigentes en el sitio oficial antes de contratar.</p>`,
        };
      } else if (fieldType === "provider_info") {
        aiResult = { providerInfo: currentText || `Institución y prestador de servicios en ${city || "Argentina"}.` };
      } else {
        aiResult = { title: "Información adicional", body: `<p>${prompt}: Información y condiciones informadas por el prestador.</p>` };
      }
    }

    // Handle translations if autoTranslate is requested
    let translations: Record<string, any> = {};
    if (autoTranslate) {
      if (fieldType === "title" && aiResult.title) {
        const tEs = aiResult.title;
        const [en, pt, it] = await Promise.all([
          translateTextDirect(tEs, "es", "en"),
          translateTextDirect(tEs, "es", "pt"),
          translateTextDirect(tEs, "es", "it"),
        ]);
        translations = { es: tEs, en, pt, it };
      } else if (fieldType === "description" && aiResult.description) {
        const dEs = aiResult.description;
        const [en, pt, it] = await Promise.all([
          translateFullHtml(dEs, "en"),
          translateFullHtml(dEs, "pt"),
          translateFullHtml(dEs, "it"),
        ]);
        translations = { es: dEs, en, pt, it };
      } else if (fieldType === "provider_info" && aiResult.providerInfo) {
        const pEs = aiResult.providerInfo;
        const [en, pt, it] = await Promise.all([
          translateTextDirect(pEs, "es", "en"),
          translateTextDirect(pEs, "es", "pt"),
          translateTextDirect(pEs, "es", "it"),
        ]);
        translations = { es: pEs, en, pt, it };
      } else if ((fieldType === "extra_block" || fieldType === "new_extra_block") && aiResult.title && aiResult.body) {
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
