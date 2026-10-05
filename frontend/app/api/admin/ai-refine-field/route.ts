import { NextResponse } from "next/server";
import { getBackendApiUrl } from "../auth/_lib/backend";
import {
  type CleanScrapedContext,
  runTitleAgent,
  runDescriptionAgent,
  runCustomBlockAgent,
  runProviderInfoAgent,
  cleanTitleString,
  cleanScrapedHtmlText,
} from "@/app/lib/aiPublicationAgents";

export const maxDuration = 60;

type FieldType = "title" | "description" | "provider_info" | "extra_block" | "new_extra_block";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

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
  conversationHistory?: ConversationMessage[];
  variationIndex?: number;
}

async function quickInvestigateUrl(url: string): Promise<{ headings: string[]; paragraphs: string[]; mainText: string; pageTitle?: string }> {
  try {
    const formattedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(formattedUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return { headings: [], paragraphs: [], mainText: "" };
    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch ? cleanTitleString(titleMatch[1]) : undefined;
    const cleanedData = cleanScrapedHtmlText(html);
    return {
      pageTitle,
      headings: cleanedData.headings,
      paragraphs: cleanedData.paragraphs,
      mainText: cleanedData.mainText,
    };
  } catch {
    return { headings: [], paragraphs: [], mainText: "" };
  }
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
      autoTranslate = true,
      apiKey,
      provider = "auto",
      conversationHistory = [],
      variationIndex = 0,
    } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "Debe ingresar una instrucción o prompt para la IA." },
        { status: 400 }
      );
    }

    const customKey = String(apiKey || "").trim();
    const hasLocalKey = Boolean(
      customKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_KEY
    );

    if (!hasLocalKey) {
      const backendUrl = getBackendApiUrl();
      console.log(`[AI Refine Field Frontend] Sin claves locales. Reenviando al backend: ${backendUrl}/api/admin/ai-refine-field`);
      try {
        const backendRes = await fetch(`${backendUrl}/api/admin/ai-refine-field`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(req.headers.get("cookie") ? { cookie: req.headers.get("cookie")! } : {}),
            ...(req.headers.get("authorization") ? { authorization: req.headers.get("authorization")! } : {}),
          },
          body: JSON.stringify(body),
        });
        const backendData = await backendRes.json();
        return NextResponse.json(backendData, { status: backendRes.status });
      } catch (fwdErr: any) {
        console.error("[AI Refine Field Frontend] Error al reenviar al backend:", fwdErr);
      }
    }

    // 1. Live web investigation if URL is present
    let webContext: { headings: string[]; paragraphs: string[]; mainText: string; pageTitle?: string } | null = null;
    if (url && url.trim()) {
      webContext = await quickInvestigateUrl(url.trim());
    }

    const cleanPubName = cleanTitleString(
      publisherName || currentTitle || webContext?.pageTitle || "Establecimiento"
    );

    // Build unified CleanScrapedContext
    const context: CleanScrapedContext = {
      url: url || "",
      publisherName: cleanPubName,
      rawPageTitle: currentTitle || webContext?.pageTitle || cleanPubName,
      metaDescription: currentText.slice(0, 300) || "",
      headings: webContext?.headings || [],
      paragraphs: currentText
        ? [currentText, ...(webContext?.paragraphs || [])]
        : webContext?.paragraphs || [],
      mainText: [currentText, webContext?.mainText].filter(Boolean).join("\n\n"),
      city,
      country,
      apiKey,
      provider,
      variationIndex,
      autoTranslate: Boolean(autoTranslate),
    };

    // Construct the admin's effective prompt including conversation history if applicable
    let effectivePrompt = prompt.trim();
    if (conversationHistory && conversationHistory.length > 0) {
      const priorHistory = conversationHistory
        .map((m) => `${m.role === "user" ? "Instrucción previa" : "Respuesta previa"}: ${m.content}`)
        .join("\n");
      effectivePrompt = `${priorHistory}\nNueva instrucción del administrador: ${prompt.trim()}`;
    }

    console.log(`\n[AI-REFINE-FIELD: ${fieldType.toUpperCase()}]`);
    console.log(`- Publisher: ${cleanPubName}`);
    console.log(`- Prompt: "${prompt}"`);

    // 2. Dispatch to the dedicated Mini-Agent based on fieldType
    if (fieldType === "title") {
      const agentRes = await runTitleAgent(context, effectivePrompt);
      if (!agentRes.success || !agentRes.data) {
        return NextResponse.json(
          { error: agentRes.error || "No se pudo generar el título con IA. Verifique su clave o intente nuevamente." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        result: {
          title: agentRes.data.title,
          text: agentRes.data.title,
        },
        translations: autoTranslate ? agentRes.data.titleI18n : { es: agentRes.data.title },
      });
    }

    if (fieldType === "description") {
      const agentRes = await runDescriptionAgent(context, effectivePrompt);
      if (!agentRes.success || !agentRes.data) {
        return NextResponse.json(
          { error: agentRes.error || "No se pudo generar la descripción con IA. Verifique su clave o intente nuevamente." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        result: {
          description: agentRes.data.description,
          text: agentRes.data.description,
        },
        translations: autoTranslate ? agentRes.data.descriptionI18n : { es: agentRes.data.description },
      });
    }

    if (fieldType === "provider_info") {
      const agentRes = await runProviderInfoAgent(context, effectivePrompt);
      if (!agentRes.success || !agentRes.data) {
        return NextResponse.json(
          { error: agentRes.error || "No se pudo generar la información del oferente con IA. Verifique su clave o intente nuevamente." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        result: {
          providerInfo: agentRes.data.providerInfo,
          text: agentRes.data.providerInfo,
        },
        translations: autoTranslate ? agentRes.data.providerInfoI18n : { es: agentRes.data.providerInfo },
      });
    }

    if (fieldType === "extra_block" || fieldType === "new_extra_block") {
      const blockTitle = currentTitle || "Información Adicional";
      const blockRes = await runCustomBlockAgent(context, blockTitle, effectivePrompt, currentText);
      if (blockRes.estado === "sin_datos" || !blockRes.body) {
        return NextResponse.json(
          { error: "No se pudo generar el bloque con IA. Verifique su clave o intente nuevamente." },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        result: {
          title: blockRes.title,
          body: blockRes.body,
          text: blockRes.body,
        },
        translations: autoTranslate
          ? { titleI18n: blockRes.titleI18n, bodyI18n: blockRes.bodyI18n }
          : { titleI18n: { es: blockRes.title }, bodyI18n: { es: blockRes.body } },
      });
    }

    return NextResponse.json({ error: `Tipo de campo no soportado: ${fieldType}` }, { status: 400 });
  } catch (error: any) {
    console.error("AI Refine Field Route Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar el prompt con IA." },
      { status: 500 }
    );
  }
}
