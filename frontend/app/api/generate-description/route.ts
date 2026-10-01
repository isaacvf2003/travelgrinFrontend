// frontend/app/api/generate-description/route.ts
import { NextResponse } from "next/server";

export const maxDuration = 30;

function cleanText(value: unknown) {
  return (value || "").toString().trim();
}

function truncateText(text: string, max = 500) {
  const clean = cleanText(text).replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  const cutPoint = clean.lastIndexOf(".", max - 3);
  if (cutPoint > 250) return clean.substring(0, cutPoint + 1);
  return `${clean.substring(0, max - 3)}...`;
}

function buildTemplateContent({
  typeProfile,
  selectedCategory,
  actingAs,
  userMessage,
  currentDescription,
  language,
  fieldTarget,
  destinationCountry,
}: {
  typeProfile?: string;
  selectedCategory?: string;
  actingAs?: string;
  userMessage?: string;
  currentDescription?: string;
  language?: string;
  fieldTarget?: string;
  destinationCountry?: string;
  baseDescription?: string;
}) {
  const profile = cleanText(typeProfile) || "oferente";
  const category = cleanText(selectedCategory) || "servicios para viajeros";
  const role = cleanText(actingAs) || "de forma directa";
  const baseText = cleanText(userMessage);
  const existing = cleanText(currentDescription);
  const destination = cleanText(destinationCountry);
  const target = cleanText(fieldTarget) || "description";
  const locale = cleanText(language).toLowerCase();

  if (target === "included") {
    if (locale === "en") {
      return `✔ Dedicated personalized guidance in ${category}${destination ? ` for travelers to ${destination}` : ""}.\n✔ Full assistance and direct support throughout the process.\n✔ ${baseText || existing || "Clear communication and all necessary preparation materials included."}`;
    }
    if (locale === "pt") {
      return `✔ Acompanhamento personalizado em ${category}${destination ? ` para viajantes com destino a ${destination}` : ""}.\n✔ Suporte direto e assistência em todas as etapas.\n✔ ${baseText || existing || "Comunicação clara e orientações completas para sua estadia."}`;
    }
    if (locale === "it") {
      return `✔ Accompagnamento personalizzato in ${category}${destination ? ` per viaggiatori diretti a ${destination}` : ""}.\n✔ Supporto continuo e assistenza diretta.\n✔ ${baseText || existing || "Comunicazione trasparente e materiale informativo completo."}`;
    }
    return `✔ Acompañamiento personalizado en ${category}${destination ? ` para tu estadía o viaje a ${destination}` : ""}.\n✔ Asistencia directa y respuesta a todas tus consultas.\n✔ ${baseText || existing || "Información clara, gestión profesional y soporte continuo en destino."}`;
  }

  if (target === "notIncluded") {
    if (locale === "en") {
      return `• International flight tickets or personal transportation unless agreed.\n• Government or consular visa fees.\n• Personal expenses not specified in the package.\n• ${baseText || "Any third-party services not explicitly mentioned."}`;
    }
    if (locale === "pt") {
      return `• Passagens aéreas ou traslados não especificados.\n• Taxas consulares ou governamentais.\n• Despesas pessoais fora da proposta.\n• ${baseText || "Serviços de terceiros não inclusos expressamente."}`;
    }
    if (locale === "it") {
      return `• Biglietti aerei o trasferimenti non specificati.\n• Tasse consolari o governative.\n• Spese personali non indicate nella proposta.\n• ${baseText || "Servizi di terzi non inclusi esplicitamente."}`;
    }
    return `• Pasajes aéreos o traslados no detallados en la propuesta.\n• Tasas consulares o aranceles gubernamentales.\n• Gastos personales y consumos adicionales.\n• ${baseText || "Servicios de terceros no especificados expresamente."}`;
  }

  if (target === "title") {
    if (locale === "en") {
      return destination
        ? `${category} in ${destination} | Professional Guidance`
        : `${category} | Services & Assistance for Travelers`;
    }
    if (locale === "pt") {
      return destination
        ? `${category} em ${destination} | Acompanhamento Profissional`
        : `${category} | Serviços e Assessoria para Viajantes`;
    }
    if (locale === "it") {
      return destination
        ? `${category} a ${destination} | Assistenza Professionale`
        : `${category} | Servizi e Supporto per Viaggiatori`;
    }
    if (destination) {
      return `${category} en ${destination} | Acompañamiento Profesional`;
    }
    return `${category} | Asistencia y Servicios para Viajeros`;
  }

  // Target: "description"
  if (locale === "en") {
    const opening = `We are ${profile} acting ${role} in ${category}${destination ? ` for travelers heading to ${destination}` : ""}.`;
    const body = existing ? `${existing} ${baseText}` : baseText;
    const closing = "We provide clear guidance, verified expertise, and dedicated support for international travelers.";
    return truncateText(`${opening} ${body} ${closing}`);
  }
  if (locale === "pt") {
    const opening = `Somos ${profile} e atuamos ${role} em ${category}${destination ? ` para viajantes com destino a ${destination}` : ""}.`;
    const body = existing ? `${existing} ${baseText}` : baseText;
    const closing = "Oferecemos informações claras e acompanhamento responsável para gerar total confiança em viajantes internacionais.";
    return truncateText(`${opening} ${body} ${closing}`);
  }
  if (locale === "it") {
    const opening = `Siamo ${profile} e operiamo ${role} in ${category}${destination ? ` per viaggiatori diretti a ${destination}` : ""}.`;
    const body = existing ? `${existing} ${baseText}` : baseText;
    const closing = "Offriamo informazioni trasparenti e assistenza continua per garantire la massima serenità ai viaggiatori internazionali.";
    return truncateText(`${opening} ${body} ${closing}`);
  }

  const opening = `Somos ${profile} y actuamos ${role} en ${category}${destination ? ` para viajeros que van a ${destination}` : ""}.`;
  const body = existing ? `${existing} ${baseText}` : baseText;
  const closing = "Brindamos información clara y acompañamiento responsable para generar confianza en viajeros internacionales.";
  return truncateText(`${opening} ${body} ${closing}`);
}

export async function POST(request: Request) {
  try {
    const {
      typeProfile,
      selectedCategory,
      actingAs,
      userMessage,
      currentDescription,
      language,
      fieldTarget,
      destinationCountry,
      baseDescription,
    } = await request.json();

    if (!userMessage && !currentDescription && !baseDescription && !selectedCategory) {
      return NextResponse.json(
        { error: "Service information is required" },
        { status: 400 }
      );
    }

    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const openAiKey = process.env.OPENAI_API_KEY;
    const target = cleanText(fieldTarget) || "description";
    const lang = cleanText(language).toLowerCase() || "es";
    const langName =
      lang === "en" ? "English" : lang === "pt" ? "Portuguese" : lang === "it" ? "Italian" : "Spanish";

    // 1. PRIMARY OPTION: REAL AI GENERATION (Gemini or OpenAI)
    if (geminiKey || openAiKey) {
      const prompt = `You are an expert copywriting AI assistant for Travelgrin (a global marketplace for travel, education, health, and relocation services).
Task: Generate or improve the content for the field: "${target}".
Target Language: ${langName} (${lang}) - CRITICAL: YOU MUST WRITE THE ENTIRE RESPONSE EXCLUSIVELY IN ${langName.toUpperCase()}.
Context:
- Category: ${selectedCategory || "General"}
- Provider Type: ${typeProfile || "Professional Provider"}
- Acting as: ${actingAs || "Direct provider"}
- Destination Country: ${destinationCountry || "Global"}
- Existing/Current text: "${currentDescription || ""}"
- Base summary: "${baseDescription || ""}"
- User raw input / notes: "${userMessage || ""}"

Requirements based on field target:
1. If field is "included": Return a well-structured list using '✔ ' bullet points with key benefits, deliverables, and support provided. Keep it concise, high-value, and easy to read (max 450 chars). Do not repeat the same item.
2. If field is "notIncluded": Return clear, honest exclusions using '• ' bullets to set realistic expectations (e.g. flight tickets, consular fees, personal expenses). Max 350 chars.
3. If field is "title": Return ONE catchy, professional, high-converting title for the publication (under 80 characters, no quotes).
4. If field is "description": Return a warm, professional, engaging description for travelers (max 480 chars).

CRITICAL RULES:
- The output language must be strictly ${langName}.
- Output ONLY the plain generated text. Do NOT wrap in quotes, markdown code fences, or add conversational prefixes.`;

      try {
        if (geminiKey) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          // Try gemini-2.0-flash first
          let res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
              }),
              signal: controller.signal,
            }
          );

          // If 2.0 fails, fallback to gemini-1.5-flash
          if (!res.ok) {
            res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: prompt }] }],
                }),
                signal: controller.signal,
              }
            );
          }

          clearTimeout(timeoutId);
          if (res.ok) {
            const json = await res.json();
            const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) {
              return NextResponse.json({
                description: text,
                characterCount: text.length,
                generatedWith: "gemini",
              });
            }
          }
        }

        if (openAiKey) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openAiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [{ role: "user", content: prompt }],
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const json = await res.json();
            const text = json?.choices?.[0]?.message?.content?.trim();
            if (text) {
              return NextResponse.json({
                description: text,
                characterCount: text.length,
                generatedWith: "openai",
              });
            }
          }
        }
      } catch (err) {
        console.warn("AI generation failed, falling back to local template:", err);
      }
    }

    // 2. SECONDARY OPTION (FALLBACK): LOCAL TEMPLATES ONLY WHEN AI IS UNAVAILABLE
    const description = buildTemplateContent({
      typeProfile,
      selectedCategory,
      actingAs,
      userMessage,
      currentDescription,
      language,
      fieldTarget,
      destinationCountry,
      baseDescription,
    });

    return NextResponse.json({
      description,
      characterCount: description.length,
      generatedWith: "local-template",
    });
  } catch (error) {
    console.error("Error generating description:", error);
    return NextResponse.json(
      { error: "Could not generate content. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}
