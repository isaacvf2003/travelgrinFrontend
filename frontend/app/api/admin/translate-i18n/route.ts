import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body.text || "").trim();
    const sourceLang = String(body.sourceLang || "es").trim();
    const targetLangs: string[] = Array.isArray(body.targetLangs) && body.targetLangs.length
      ? body.targetLangs
      : ["en", "pt", "it"];
    const isHtml = Boolean(body.isHtml);

    if (!text) {
      return NextResponse.json({
        success: true,
        translations: {
          en: "",
          pt: "",
          it: "",
        },
      });
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
1. Debes PRESERVAR EXACTAMENTE todas las etiquetas HTML, estructura, atributos, enlaces y emojis.
2. Traduce COMPLETAMENTE tanto las etiquetas o títulos en negrita (ej: 'Propuesta de valor' -> 'Value proposition' / 'Proposta de valor' / 'Proposta di valore', '¿Para quién?' -> 'Who is it for?' / 'Para quem?' / 'Per chi?', 'Documentación requerida' -> 'Required documents' / 'Documentação necessária' / 'Documentazione richiesta', 'Vigencia' -> 'Validity' / 'Validade' / 'Validità', 'Precio' -> 'Price' / 'Preço' / 'Prezzo', 'Diferencial' -> 'Differentiator' / 'Diferencial' / 'Differenziale', 'Exclusiones' -> 'Exclusions' / 'Exclusões' / 'Esclusioni') como TODO el contenido textual descriptivo interno.
3. No dejes párrafos o frases en español dentro de las traducciones a inglés, portugués o italiano. Todo el texto debe estar 100% traducido de forma natural al idioma correspondiente.`
    : `Traduce el texto manteniendo el tono profesional, natural y preciso en cada idioma.`
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
          const resp = await fetch(
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
            }
          );
          if (resp.ok) {
            const data = await resp.json();
            const rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
            const cleaned = rawJsonText.replace(/```json\s*|```/gi, "").trim();
            const parsed = JSON.parse(cleaned);
            return NextResponse.json({
              success: true,
              translations: {
                en: parsed.en || (targetLangs.includes("en") ? text : undefined),
                pt: parsed.pt || (targetLangs.includes("pt") ? text : undefined),
                it: parsed.it || (targetLangs.includes("it") ? text : undefined),
                ...parsed,
              },
            });
          }
        } catch (e) {
          console.warn(`Gemini translation attempt (${model}) failed:`, e);
        }
      }
    }

    // 2. Try OpenAI fallback
    if (openaiKey) {
      try {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
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
        });
        if (resp.ok) {
          const data = await resp.json();
          const rawContent = data.choices?.[0]?.message?.content || "{}";
          const cleaned = rawContent.replace(/```json\s*|```/gi, "").trim();
          const parsed = JSON.parse(cleaned);
          return NextResponse.json({
            success: true,
            translations: {
              en: parsed.en || (targetLangs.includes("en") ? text : undefined),
              pt: parsed.pt || (targetLangs.includes("pt") ? text : undefined),
              it: parsed.it || (targetLangs.includes("it") ? text : undefined),
              ...parsed,
            },
          });
        }
      } catch (e) {
        console.warn("OpenAI translation attempt failed:", e);
      }
    }

    // 3. Fallback: Return original text if no AI provider succeeded
    const fallbackTranslations: Record<string, string> = {};
    for (const lang of targetLangs) {
      fallbackTranslations[lang] = text;
    }
    return NextResponse.json({
      success: true,
      translations: fallbackTranslations,
    });
  } catch (error: any) {
    console.error("translate-i18n Route Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al traducir contenido." },
      { status: 500 }
    );
  }
}
