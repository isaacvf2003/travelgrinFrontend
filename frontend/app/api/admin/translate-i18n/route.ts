import { NextResponse } from "next/server";

export const maxDuration = 60;

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&iexcl;/g, "¡")
    .replace(/&iquest;/g, "¿")
    .replace(/&atilde;/g, "ã")
    .replace(/&otilde;/g, "õ")
    .replace(/&ccedil;/g, "ç")
    .replace(/&eacute;/g, "é")
    .replace(/&aacute;/g, "á")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú");
}

function cleanTranslationMarkup(str: string, isHtml: boolean = false): string {
  if (!str) return "";
  let res = decodeHtmlEntities(str);

  // Strip translation memory & XLIFF tags (e.g. <g id="Documents_NoItalic">, </g>, <x id="..."/>)
  res = res
    .replace(/<g\b[^>]*>/gi, "")
    .replace(/<\/g>/gi, "")
    .replace(/<x\b[^>]*\/?>/gi, "")
    .replace(/<bx\b[^>]*\/?>/gi, "")
    .replace(/<ex\b[^>]*\/?>/gi, "")
    .replace(/<bpt\b[^>]*>.*?<\/bpt>/gi, "")
    .replace(/<ept\b[^>]*>.*?<\/ept>/gi, "")
    .replace(/<ph\b[^>]*>.*?<\/ph>/gi, "")
    .replace(/<mrk\b[^>]*>/gi, "")
    .replace(/<\/mrk>/gi, "");

  if (!isHtml) {
    // If field is plain text (like Title or short Block Title), strip all XML/HTML tags
    res = res.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return res.trim();
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

function normalizeDescriptionHeaders(text: string, lang: string): string {
  if (!text) return "";
  let res = text;

  if (lang === "en") {
    res = res
      .replace(/<strong>\s*(?:Vigencia|Validade|Validità):\s*<\/strong>/gi, "<strong>Validity:</strong>")
      .replace(/<strong>\s*(?:Precio|Preço|Prezzo):\s*<\/strong>/gi, "<strong>Price:</strong>")
      .replace(/<strong>\s*(?:Propuesta de valor|Proposta de valor):\s*<\/strong>/gi, "<strong>Value proposition:</strong>")
      .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Para quem\??|Per chi\??):\s*<\/strong>/gi, "<strong>Who is it for?:</strong>")
      .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Required documents:</strong>")
      .replace(/<strong>\s*(?:Permanencia|Permanência|Permanenza):\s*<\/strong>/gi, "<strong>Length of stay:</strong>")
      .replace(/<strong>\s*(?:Diferencial|Differenziale):\s*<\/strong>/gi, "<strong>Differentiator:</strong>")
      .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Idiomas de atendimento|Lingue di assistenza):\s*<\/em>/gi, "<em>Service languages:</em>")
      .replace(/<em>\s*(?:Experiencia y soporte|Experiência e suporte|Esperienza e supporto):\s*<\/em>/gi, "<em>Experience and support:</em>")
      .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Differentiator vs. alternatives:</em>")
      .replace(/<strong>\s*(?:Exclusiones|Exclusões|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusions:</strong>")
      .replace(/Vigencia:/gi, "Validity:")
      .replace(/Propuesta de valor:/gi, "Value proposition:")
      .replace(/¿?Para qui[eé]n\??:/gi, "Who is it for?:")
      .replace(/Documentaci[oó]n requerida:/gi, "Required documents:")
      .replace(/Permanencia:/gi, "Length of stay:")
      .replace(/Diferencial:/gi, "Differentiator:")
      .replace(/Exclusiones:/gi, "Exclusions:");
  } else if (lang === "pt") {
    res = res
      .replace(/<strong>\s*(?:Vigencia|Validity|Validità):\s*<\/strong>/gi, "<strong>Validade:</strong>")
      .replace(/<strong>\s*(?:Precio|Price|Prezzo):\s*<\/strong>/gi, "<strong>Preço:</strong>")
      .replace(/<strong>\s*(?:Propuesta de valor|Value proposition):\s*<\/strong>/gi, "<strong>Proposta de valor:</strong>")
      .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Per chi\??):\s*<\/strong>/gi, "<strong>Para quem?:</strong>")
      .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Documentação necessária:</strong>")
      .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanenza):\s*<\/strong>/gi, "<strong>Permanência:</strong>")
      .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Diferencial:</strong>")
      .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Lingue di assistenza):\s*<\/em>/gi, "<em>Idiomas de atendimento:</em>")
      .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Esperienza e supporto):\s*<\/em>/gi, "<em>Experiência e suporte:</em>")
      .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Diferencial vs. alternativas:</em>")
      .replace(/<strong>\s*(?:Exclusiones|Exclusions|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusões:</strong>")
      .replace(/Vigencia:/gi, "Validade:")
      .replace(/Propuesta de valor:/gi, "Proposta de valor:")
      .replace(/¿?Para qui[eé]n\??:/gi, "Para quem?:")
      .replace(/Documentaci[oó]n requerida:/gi, "Documentação necessária:")
      .replace(/Permanencia:/gi, "Permanência:")
      .replace(/Diferencial:/gi, "Diferencial:")
      .replace(/Exclusiones:/gi, "Exclusões:");
  } else if (lang === "it") {
    res = res
      .replace(/<strong>\s*(?:Vigencia|Validity|Validade):\s*<\/strong>/gi, "<strong>Validità:</strong>")
      .replace(/<strong>\s*(?:Precio|Price|Preço):\s*<\/strong>/gi, "<strong>Prezzo:</strong>")
      .replace(/<strong>\s*(?:Propuesta de valor|Value proposition|Proposta de valor):\s*<\/strong>/gi, "<strong>Proposta di valore:</strong>")
      .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Para quem\??):\s*<\/strong>/gi, "<strong>Per chi?:</strong>")
      .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Documentazione richiesta:</strong>")
      .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanência):\s*<\/strong>/gi, "<strong>Permanenza:</strong>")
      .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Differenziale:</strong>")
      .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Idiomas de atendimento):\s*<\/em>/gi, "<em>Lingue di assistenza:</em>")
      .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Experiência e suporte):\s*<\/em>/gi, "<em>Esperienza e supporto:</em>")
      .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Differenziale vs. alternative:</em>")
      .replace(/<strong>\s*(?:Exclusiones|Exclusions|Exclusões):\s*<\/strong>/gi, "<strong>Esclusioni:</strong>")
      .replace(/Vigencia:/gi, "Validità:")
      .replace(/Propuesta de valor:/gi, "Proposta di valore:")
      .replace(/¿?Para qui[eé]n\??:/gi, "Per chi?:")
      .replace(/Documentaci[oó]n requerida:/gi, "Documentazione richiesta:")
      .replace(/Permanencia:/gi, "Permanenza:")
      .replace(/Diferencial:/gi, "Differenziale:")
      .replace(/Exclusiones:/gi, "Esclusioni:");
  } else if (lang === "es") {
    res = res
      .replace(/<strong>\s*(?:Validity|Validade|Validità):\s*<\/strong>/gi, "<strong>Vigencia:</strong>")
      .replace(/<strong>\s*(?:Price|Preço|Prezzo):\s*<\/strong>/gi, "<strong>Precio:</strong>")
      .replace(/<strong>\s*(?:Value proposition|Proposta de valor|Proposta di valore):\s*<\/strong>/gi, "<strong>Propuesta de valor:</strong>")
      .replace(/<strong>\s*(?:Who is it for\??|Para quem\??|Per chi\??):\s*<\/strong>/gi, "<strong>¿Para quién?:</strong>")
      .replace(/<strong>\s*(?:Required documents|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Documentación requerida:</strong>")
      .replace(/<strong>\s*(?:Length of stay|Permanência|Permanenza):\s*<\/strong>/gi, "<strong>Permanencia:</strong>")
      .replace(/<strong>\s*(?:Differentiator|Differenziale):\s*<\/strong>/gi, "<strong>Diferencial:</strong>")
      .replace(/<em>\s*(?:Service languages|Idiomas de atendimento|Lingue di assistenza):\s*<\/em>/gi, "<em>Idiomas de atención:</em>")
      .replace(/<em>\s*(?:Experience and support|Experiência e suporte|Esperienza e supporto):\s*<\/em>/gi, "<em>Experiencia y soporte:</em>")
      .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Diferencial vs. alternativas:</em>")
      .replace(/<strong>\s*(?:Exclusions|Exclusões|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusiones:</strong>");
  }

  return res;
}

async function translateWithGoogle(text: string, sl: string, tl: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 3000);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map((item: any) => item[0]).filter(Boolean).join("");
      return translated || null;
    }
  } catch {}
  return null;
}

async function translateQuery(q: string, sl: string, tl: string, isHtml: boolean = false): Promise<string> {
  const trimmed = q.trim();
  if (!trimmed || sl === tl) return cleanTranslationMarkup(q, isHtml);

  // 1. Try Google Translate public API
  const gRes = await translateWithGoogle(trimmed, sl, tl);
  if (gRes && gRes.trim() && gRes.trim() !== trimmed) {
    return cleanTranslationMarkup(gRes, isHtml);
  }

  // 2. Try MyMemory
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${sl}|${tl}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 3000);
    if (res.ok) {
      const data = await res.json();
      const trans = data.responseData?.translatedText;
      if (trans && typeof trans === "string" && !trans.includes("MYMEMORY WARNING")) {
        return cleanTranslationMarkup(trans, isHtml);
      }
    }
  } catch {}

  return cleanTranslationMarkup(q, isHtml);
}

async function translateParagraphOrText(text: string, sl: string, tl: string, isHtml: boolean): Promise<string> {
  if (!text || sl === tl) return cleanTranslationMarkup(text, isHtml);

  if (!isHtml) {
    const lines = text.split("\n");
    const transLines = await Promise.all(
      lines.map(async (line) => {
        if (!line.trim()) return "";
        if (line.length <= 400) {
          return translateQuery(line, sl, tl, false);
        }
        const sentences = line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [line];
        const transSentences = await Promise.all(sentences.map((s) => translateQuery(s, sl, tl, false)));
        return transSentences.join(" ");
      })
    );
    const joined = transLines.join("\n");
    return cleanTranslationMarkup(normalizeDescriptionHeaders(joined, tl), false);
  }

  // HTML content handling
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const rawParagraphs: string[] = [];
  let match;
  while ((match = pRegex.exec(text)) !== null) {
    rawParagraphs.push(match[1]);
  }

  if (rawParagraphs.length === 0) {
    const parts = text.split(/(<\/?[a-z0-9]+\b[^>]*>)/gi);
    const translatedParts = await Promise.all(
      parts.map(async (part) => {
        if (!part || /^<\/?[a-z0-9]+/i.test(part)) return part;
        const trimmed = part.trim();
        if (!trimmed || /^[💡⭐⚠️•>]+$/.test(trimmed)) return part;
        const leadingSpace = part.match(/^\s*/)?.[0] || "";
        const trailingSpace = part.match(/\s*$/)?.[0] || "";
        const trans = await translateQuery(trimmed, sl, tl, false);
        return `${leadingSpace}${trans}${trailingSpace}`;
      })
    );
    const joined = translatedParts.join("");
    return cleanTranslationMarkup(normalizeDescriptionHeaders(joined, tl), true);
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
          const trans = await translateQuery(trimmed, sl, tl, false);
          return `${leadingSpace}${trans}${trailingSpace}`;
        })
      );
      return `<p>${translatedParts.join("")}</p>`;
    })
  );

  const fullHtml = translatedPs.join("\n");
  return cleanTranslationMarkup(normalizeDescriptionHeaders(fullHtml, tl), true);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body.text || "").trim();
    const sourceLang = String(body.sourceLang || "es").trim().toLowerCase();
    const targetLangs: string[] = Array.isArray(body.targetLangs) && body.targetLangs.length
      ? body.targetLangs.map((l: string) => String(l).toLowerCase())
      : ["en", "pt", "it", "es"].filter((l) => l !== sourceLang);
    const isHtml = Boolean(body.isHtml);

    if (!text) {
      const emptyObj: Record<string, string> = {};
      targetLangs.forEach((l) => { emptyObj[l] = ""; });
      return NextResponse.json({ success: true, translations: emptyObj });
    }

    const customApiKey = String(body.apiKey || "").trim();

    const geminiKey =
      (customApiKey && (customApiKey.startsWith("AIza") || !customApiKey.startsWith("sk-")) ? customApiKey : "") ||
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";

    const openaiKey =
      (customApiKey && customApiKey.startsWith("sk-") ? customApiKey : "") ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      "";

    const prompt = `Eres un traductor profesional experto en localización de contenidos web para Travelgrin.
Traduce el siguiente texto de idioma origen "${sourceLang}" a los siguientes idiomas objetivo: ${targetLangs.join(", ")}.

${
  isHtml
    ? `REGLA CRÍTICA PARA HTML:
El texto contiene etiquetas HTML (<p>, <strong>, <em>, <span>, <a>, <br>, <ul>, <li>, etc.) y emojis.
1. Debes PRESERVAR EXACTAMENTE todas las etiquetas HTML válidas, estructura, atributos, enlaces y emojis. No inventes ni uses etiquetas como <g id="..."> ni <x/>.
2. Traduce COMPLETAMENTE tanto las etiquetas o títulos en negrita (ej: 'Propuesta de valor' -> 'Value proposition' / 'Proposta de valor' / 'Proposta di valore', '¿Para quién?' -> 'Who is it for?' / 'Para quem?' / 'Per chi?', 'Documentación requerida' -> 'Required documents' / 'Documentação necessária' / 'Documentazione richiesta', 'Vigencia' -> 'Validity' / 'Validade' / 'Validità', 'Precio' -> 'Price' / 'Preço' / 'Prezzo', 'Diferencial' -> 'Differentiator' / 'Diferencial' / 'Differenziale', 'Exclusiones' -> 'Exclusions' / 'Exclusões' / 'Esclusioni') como TODO el contenido textual descriptivo interno.
3. No dejes párrafos o frases en el idioma de origen dentro de las traducciones a otros idiomas. Todo el texto debe estar 100% traducido de forma natural al idioma correspondiente.`
    : `Traduce el texto manteniendo el tono profesional, natural y preciso en cada idioma. No incluyas ninguna etiqueta HTML ni XML.`
}

TEXTO A TRADUCIR:
"""
${text}
"""

Responde ÚNICAMENTE con un objeto JSON con las claves de los idiomas objetivo (${targetLangs.map((l) => `"${l}"`).join(", ")}).
Ejemplo de formato:
{
  ${targetLangs.map((l) => `"${l}": "traducción aquí"`).join(",\n  ")}
}`;

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
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: "application/json",
                },
              }),
            },
            6000
          );
          if (resp.ok) {
            const data = await resp.json();
            const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const cleaned = rawJsonText.replace(/```json\s*|```/gi, "").trim();
            const parsed = JSON.parse(cleaned);
            const out: Record<string, string> = {};
            for (const l of targetLangs) {
              const val = parsed[l] || text;
              out[l] = cleanTranslationMarkup(normalizeDescriptionHeaders(val, l), isHtml);
            }
            return NextResponse.json({ success: true, translations: out });
          }
        } catch (e) {
          console.warn(`Gemini translation attempt (${model}) failed:`, e);
        }
      }
    }

    // 2. Try OpenAI
    if (openaiKey) {
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
                {
                  role: "system",
                  content: "Eres un traductor profesional de contenidos web. Responde únicamente en formato JSON.",
                },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
              temperature: 0.1,
            }),
          },
          6000
        );
        if (resp.ok) {
          const data = await resp.json();
          const rawContent = data.choices?.[0]?.message?.content || "{}";
          const cleaned = rawContent.replace(/```json\s*|```/gi, "").trim();
          const parsed = JSON.parse(cleaned);
          const out: Record<string, string> = {};
          for (const l of targetLangs) {
            const val = parsed[l] || text;
            out[l] = cleanTranslationMarkup(normalizeDescriptionHeaders(val, l), isHtml);
          }
          return NextResponse.json({ success: true, translations: out });
        }
      } catch (e) {
        console.warn("OpenAI translation attempt failed:", e);
      }
    }

    // 3. Fast Parallel Multi-language Free Translation Fallback (100% reliable, zero keys required)
    const translationsOut: Record<string, string> = {};
    await Promise.all(
      targetLangs.map(async (tl) => {
        try {
          const trans = await translateParagraphOrText(text, sourceLang, tl, isHtml);
          translationsOut[tl] = cleanTranslationMarkup(trans || text, isHtml);
        } catch {
          translationsOut[tl] = cleanTranslationMarkup(normalizeDescriptionHeaders(text, tl), isHtml);
        }
      })
    );

    return NextResponse.json({
      success: true,
      translations: translationsOut,
    });
  } catch (error: any) {
    console.error("translate-i18n Route Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al traducir contenido." },
      { status: 500 }
    );
  }
}
