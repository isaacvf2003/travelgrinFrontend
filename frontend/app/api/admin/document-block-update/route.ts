import { NextRequest, NextResponse } from "next/server";
import { parseUploadedDocument, filterDocumentForContext, type ParsedDocumentResult } from "@/app/lib/documentParser";
import { runDocumentBlockAgent, type PublicationContextForBlockUpdate } from "@/app/lib/aiDocumentBlockAgent";

export const maxDuration = 120; // 2 minutes execution window for bulk processing

interface UpdateRequestItem {
  id: string;
  title: string;
  publisherName?: string;
  country?: string;
  city?: string;
  category?: string;
  subcategory?: string;
  currentBody?: string;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let targetBlockTitle = "";
    let updatePrompt = "";
    let apiKey = "";
    let parsedDoc: ParsedDocumentResult | null = null;
    let rawDocumentText = "";
    let documentFileName = "instrucciones";
    let targetPublications: UpdateRequestItem[] = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      targetBlockTitle = String(formData.get("targetBlockTitle") || formData.get("blockTitle") || "").trim();
      updatePrompt = String(formData.get("updatePrompt") || formData.get("prompt") || "").trim();
      apiKey = String(formData.get("apiKey") || "").trim();

      const pubsRaw = formData.get("publications");
      if (pubsRaw) {
        try {
          targetPublications = JSON.parse(String(pubsRaw));
        } catch {
          targetPublications = [];
        }
      }

      if (file && file.size > 0) {
        documentFileName = file.name || "documento_adjunto";
        const buffer = Buffer.from(await file.arrayBuffer());
        parsedDoc = parseUploadedDocument(buffer, documentFileName, file.type);
        rawDocumentText = parsedDoc.fullText;
      } else {
        rawDocumentText = String(formData.get("documentText") || "").trim();
      }
    } else {
      // JSON payload
      const body = await req.json();
      targetBlockTitle = String(body.targetBlockTitle || body.blockTitle || "").trim();
      updatePrompt = String(body.updatePrompt || body.prompt || "").trim();
      apiKey = String(body.apiKey || "").trim();
      documentFileName = body.documentFileName || "instrucciones";
      rawDocumentText = String(body.documentText || "").trim();

      if (body.documentBase64) {
        const buffer = Buffer.from(body.documentBase64, "base64");
        parsedDoc = parseUploadedDocument(buffer, documentFileName);
        rawDocumentText = parsedDoc.fullText;
      }

      if (Array.isArray(body.publications)) {
        targetPublications = body.publications;
      }
    }

    // VALIDATION
    if (!targetBlockTitle) {
      return NextResponse.json(
        { ok: false, error: "Debes especificar el título del bloque que deseas actualizar." },
        { status: 400 }
      );
    }

    if (!rawDocumentText.trim() && !updatePrompt.trim()) {
      return NextResponse.json(
        { ok: false, error: "Debes subir un archivo o ingresar instrucciones / prompt de redacción." },
        { status: 400 }
      );
    }

    if (!Array.isArray(targetPublications) || targetPublications.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No se recibieron publicaciones para procesar." },
        { status: 400 }
      );
    }

    // PROCESS PUBLICATIONS WITH AGENT
    const results: Array<{
      publicationId: string;
      publicationTitle: string;
      publisherName?: string;
      country?: string;
      originalBody?: string;
      updatedBodyHtml?: string;
      blockTitle: string;
      evidencias?: string[];
      providerUsed?: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const pub of targetPublications) {
      try {
        // If a parsed document is available and large, extract pertinent context
        const contextDocText = parsedDoc
          ? filterDocumentForContext(parsedDoc, {
              country: pub.country,
              city: pub.city,
              publisherName: pub.publisherName,
              blockTitle: targetBlockTitle,
            })
          : rawDocumentText;

        const agentOutput = await runDocumentBlockAgent({
          blockTitle: targetBlockTitle,
          currentBody: pub.currentBody,
          documentContext: contextDocText,
          documentFileName,
          updatePrompt,
          publication: {
            id: pub.id,
            title: pub.title,
            publisherName: pub.publisherName,
            country: pub.country,
            city: pub.city,
            category: pub.category,
            subcategory: pub.subcategory,
          },
          apiKeyParam: apiKey || undefined,
        });

        if (!agentOutput.success) {
          results.push({
            publicationId: pub.id,
            publicationTitle: pub.title,
            publisherName: pub.publisherName,
            country: pub.country,
            originalBody: pub.currentBody,
            blockTitle: targetBlockTitle,
            success: false,
            error: agentOutput.error || "No se pudo generar el contenido con el agente.",
          });
          continue;
        }

        results.push({
          publicationId: pub.id,
          publicationTitle: pub.title,
          publisherName: pub.publisherName,
          country: pub.country,
          originalBody: pub.currentBody,
          updatedBodyHtml: agentOutput.updatedBodyHtml,
          blockTitle: agentOutput.blockTitle,
          evidencias: agentOutput.evidencias,
          providerUsed: agentOutput.providerUsed,
          success: true,
        });
      } catch (err: any) {
        results.push({
          publicationId: pub.id,
          publicationTitle: pub.title,
          publisherName: pub.publisherName,
          country: pub.country,
          originalBody: pub.currentBody,
          blockTitle: targetBlockTitle,
          success: false,
          error: err?.message || "Error al procesar esta publicación",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      targetBlockTitle,
      total: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      documentFileName,
      documentSummary: parsedDoc?.summary || undefined,
      results,
    });
  } catch (error: any) {
    console.error("[document-block-update API Error]:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Error interno al procesar la actualización" },
      { status: 500 }
    );
  }
}
