import { NextRequest, NextResponse } from "next/server";
import {
  parseUploadedDocument,
  extractPublicationSpecificContext,
  type ParsedDocumentResult,
} from "@/app/lib/documentParser";
import { runDocumentBlockAgent } from "@/app/lib/aiDocumentBlockAgent";

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
  mainDescription?: string;
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

    // PROCESS PUBLICATIONS IN PARALLEL BATCHES OF 4
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

    const BATCH_SIZE = 4;
    for (let i = 0; i < targetPublications.length; i += BATCH_SIZE) {
      const batch = targetPublications.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (pub, bIdx) => {
          try {
            const pubMatch = parsedDoc
              ? extractPublicationSpecificContext(parsedDoc, {
                  title: pub.title,
                  publisherName: pub.publisherName,
                  country: pub.country,
                  city: pub.city,
                  blockTitle: targetBlockTitle,
                  totalTargetPublications: targetPublications.length,
                  publicationIndex: i + bIdx,
                })
              : {
                  contextText: rawDocumentText,
                  excelInstructions: "",
                  matchedRowsText: [],
                  hasExactPublicationMatch: false,
                };

            const agentOutput = await runDocumentBlockAgent({
              blockTitle: targetBlockTitle,
              currentBody: pub.currentBody,
              documentContext: pubMatch.contextText,
              documentFileName,
              updatePrompt,
              excelInstructions: pubMatch.excelInstructions,
              matchedRowsText: pubMatch.matchedRowsText,
              publication: {
                id: pub.id,
                title: pub.title,
                publisherName: pub.publisherName,
                country: pub.country,
                city: pub.city,
                category: pub.category,
                subcategory: pub.subcategory,
                mainDescription: pub.mainDescription,
              },
              apiKeyParam: apiKey || undefined,
            });

            if (!agentOutput.success) {
              return {
                publicationId: pub.id,
                publicationTitle: pub.title,
                publisherName: pub.publisherName,
                country: pub.country,
                originalBody: pub.currentBody,
                blockTitle: targetBlockTitle,
                success: false,
                error: agentOutput.error || "No se pudo generar el contenido con el agente.",
              };
            }

            return {
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
            };
          } catch (err: any) {
            return {
              publicationId: pub.id,
              publicationTitle: pub.title,
              publisherName: pub.publisherName,
              country: pub.country,
              originalBody: pub.currentBody,
              blockTitle: targetBlockTitle,
              success: false,
              error: err?.message || "Error al procesar esta publicación",
            };
          }
        })
      );
      results.push(...batchResults);
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
