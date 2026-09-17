import { NextResponse } from "next/server";

export const maxDuration = 45;

export async function POST(request: Request) {
  try {
    const { text, targetLangs = ["en", "pt", "it"], sourceLang = "es", isHtml = false } = await request.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ translations: {} });
    }

    const geminiKey =
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";

    const openaiKey =
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      "";

    if (!geminiKey && !openaiKey) {
      // Fallback simple echo if no AI key configured
      const fallback: Record<string, string> = {};
      targetLangs.forEach((l: string) => { fallback[l] = text; });
      return NextResponse.json({ translations: fallback });
    }

    const prompt = `You are a professional translator for travel, medical, and services directory listings.
Translate the following ${isHtml ? "HTML snippet / text with HTML tags" : "text"} from Spanish ("es") into all 3 target languages: "en" (English), "pt" (Portuguese), and "it" (Italian).

CRITICAL RULES:
1. Maintain exact HTML markup/tags if any are present (${isHtml ? "yes" : "no"}). Do NOT strip formatting like <b>, <i>, <ul>, etc.
2. Produce natural, high-quality localization for each target language.
3. You MUST provide translations for all 3 languages: "en", "pt", and "it".
4. Return ONLY a valid JSON object with exactly these 3 keys: "en", "pt", "it". Example format: {"en": "...", "pt": "...", "it": "..."}.

Source text to translate:
"""
${text}
"""`;

    let responseText = "";

    if (geminiKey) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
        }
      );
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    }

    if (!responseText && openaiKey) {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You output raw valid JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      });
      if (openaiRes.ok) {
        const data = await openaiRes.json();
        responseText = data.choices?.[0]?.message?.content || "";
      }
    }

    if (!responseText) {
      const fallback: Record<string, string> = {};
      targetLangs.forEach((l: string) => { fallback[l] = text; });
      return NextResponse.json({ translations: fallback });
    }

    const cleanJson = responseText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed: Record<string, string> = {};
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      console.error("[Translate API Error] Could not parse AI response JSON:", responseText);
    }

    const translations: Record<string, string> = {};
    // Normalize keys: maps "en", "english", "inglés", etc. to standard ISO keys
    Object.entries(parsed).forEach(([k, val]) => {
      if (typeof val !== "string") return;
      const lk = k.toLowerCase().trim();
      if (lk === "en" || lk.includes("english") || lk.includes("ingl")) translations["en"] = val;
      else if (lk === "pt" || lk.includes("portug") || lk.includes("portuguese")) translations["pt"] = val;
      else if (lk === "it" || lk.includes("ital")) translations["it"] = val;
      else translations[lk] = val;
    });

    // Fallback missing keys to source text if empty
    targetLangs.forEach((l: string) => {
      if (!translations[l]) {
        translations[l] = text;
      }
    });

    return NextResponse.json({ translations });
  } catch (error: any) {
    console.error("[Translate API Error]:", error);
    return NextResponse.json({ error: "Failed to translate text" }, { status: 500 });
  }
}
