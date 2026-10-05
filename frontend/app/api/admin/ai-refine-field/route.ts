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
    const timer = setTimeout(() => controller.abort(), 6000);
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
      autoTranslate = false,
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
    const hasLocalKey =
      Boolean(customKey) ||
      Boolean(process.env.GEMINI_API_KEY) ||
      Boolean(process.env.GEMINI_KEY) ||
      Boolean(process.env.GOOGLE_API_KEY) ||
      Boolean(process.env.GOOGLE_GEMINI_API_KEY) ||
      Boolean(process.env.OPENAI_API_KEY);

    // If frontend does not have AI API keys in environment, forward to backend where keys are set in Vercel
    if (!hasLocalKey) {
      const backendUrl = getBackendApiUrl();
      if (backendUrl) {
        console.log(`[ai-refine-field] Frontend has no local keys. Forwarding to backend: ${backendUrl}/api/admin/ai-refine-field`);
        try {
          const fwdRes = await fetch(`${backendUrl}/api/admin/ai-refine-field`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const fwdData = await fwdRes.json().catch(() => ({}));
          return NextResponse.json(fwdData, { status: fwdRes.status });
        } catch (fwdErr: any) {
          console.error(`[ai-refine-field] Failed forwarding to backend:`, fwdErr);
        }
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
      currentText,
    };

    // Construct the admin's effective prompt including conversation history if applicable
    let effectivePrompt = prompt.trim();
    if (conversationHistory && conversationHistory.length > 0) {
      const priorHistory = conversationHistory
        .map((m) => `${m.role === "user" ? "Instrucción previa" : "Respuesta previa"}: ${m.content}`)
        .join("\n");
      effectivePrompt = `${priorHistory}\nNueva instrucción del administrador: ${prompt.trim()}`;
    }

    console.log(`\n[FRONTEND AI-REFINE-FIELD: ${fieldType.toUpperCase()}]`);
    console.log(`- Publisher: ${cleanPubName}`);
    console.log(`- Prompt: "${prompt}"`);
    console.log(`- CurrentText: "${currentText.slice(0, 80)}..."`);
    console.log(`- VariationIndex: ${variationIndex}`);

    // 2. Dispatch to the dedicated Mini-Agent based on fieldType
    if (fieldType === "title") {
      const agentRes = await runTitleAgent(context, effectivePrompt, currentText);
      if (!agentRes.success || !agentRes.data) {
        return NextResponse.json(
          { error: agentRes.error || "No se pudo reformular el título con IA. Verifique su clave o intente nuevamente." },
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
      const agentRes = await runDescriptionAgent(context, effectivePrompt, currentText);
      if (!agentRes.success || !agentRes.data) {
        return NextResponse.json(
          { error: agentRes.error || "No se pudo reformular la descripción con IA. Verifique su clave o intente nuevamente." },
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
      const agentRes = await runProviderInfoAgent(context, effectivePrompt, currentText);
      if (!agentRes.success || !agentRes.data) {
        return NextResponse.json(
          { error: agentRes.error || "No se pudo reformular la información del oferente con IA. Verifique su clave o intente nuevamente." },
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
    console.error("Frontend AI Refine Field Route Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar el prompt con IA." },
      { status: 500 }
    );
  }
}
