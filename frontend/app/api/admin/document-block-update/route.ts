import { NextRequest, NextResponse } from "next/server";
import { parseUploadedDocument, filterDocumentForContext, type ParsedDocumentResult } from "@/app/lib/documentParser";
import { runDocumentBlockAgent, type PublicationContextForBlockUpdate } from "@/app/lib/aiDocumentBlockAgent";
import { prisma } from "@/app/lib/prisma";

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
    let action: "preview" | "apply" | "save-approved" = "preview";
    let apiKey = "";
    let parsedDoc: ParsedDocumentResult | null = null;
    let rawDocumentText = "";
    let documentFileName = "documento_adjunto";
    let targetPublications: UpdateRequestItem[] = [];
    let approvedUpdates: Array<{ publicationId: string; blockTitle: string; updatedBodyHtml: string }> = [];

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      targetBlockTitle = String(formData.get("targetBlockTitle") || formData.get("blockTitle") || "").trim();
      updatePrompt = String(formData.get("updatePrompt") || formData.get("prompt") || "").trim();
      action = (String(formData.get("action") || "preview").trim().toLowerCase() as any);
      apiKey = String(formData.get("apiKey") || "").trim();

      const pubIdsRaw = formData.get("publicationIds");
      let publicationIds: string[] = [];
      if (pubIdsRaw) {
        try {
          publicationIds = JSON.parse(String(pubIdsRaw));
        } catch {
          publicationIds = String(pubIdsRaw).split(",").map((s) => s.trim()).filter(Boolean);
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

      // Fetch publications from DB if IDs provided
      if (publicationIds.length > 0) {
        const dbPubs = await prisma.publication.findMany({
          where: { id: { in: publicationIds } },
          select: {
            id: true,
            title: true,
            publisherName: true,
            country: true,
            city: true,
            category: true,
            subcategory: true,
            fields: true,
          },
        });

        targetPublications = dbPubs.map((p: any) => {
          const fields = (p.fields as Record<string, any>) || {};
          const extraDescriptions = Array.isArray(fields.extraDescriptions) ? fields.extraDescriptions : [];
          const existingBlock = extraDescriptions.find((d: any) =>
            String(d?.title || "").trim().toLowerCase() === targetBlockTitle.toLowerCase()
          );
          return {
            id: p.id,
            title: p.title || "",
            publisherName: p.publisherName || "",
            country: p.country || "",
            city: p.city || "",
            category: p.category || "",
            subcategory: p.subcategory || "",
            currentBody: existingBlock?.body || "",
          };
        });
      }
    } else {
      // JSON payload
      const body = await req.json();
      targetBlockTitle = String(body.targetBlockTitle || body.blockTitle || "").trim();
      updatePrompt = String(body.updatePrompt || body.prompt || "").trim();
      action = body.action || "preview";
      apiKey = String(body.apiKey || "").trim();
      documentFileName = body.documentFileName || "documento_adjunto";
      rawDocumentText = String(body.documentText || "").trim();
      approvedUpdates = Array.isArray(body.approvedUpdates) ? body.approvedUpdates : [];

      if (body.documentBase64) {
        const buffer = Buffer.from(body.documentBase64, "base64");
        parsedDoc = parseUploadedDocument(buffer, documentFileName);
        rawDocumentText = parsedDoc.fullText;
      }

      if (Array.isArray(body.publications) && body.publications.length > 0) {
        targetPublications = body.publications;
      } else if (Array.isArray(body.publicationIds) && body.publicationIds.length > 0) {
        const dbPubs = await prisma.publication.findMany({
          where: { id: { in: body.publicationIds } },
          select: {
            id: true,
            title: true,
            publisherName: true,
            country: true,
            city: true,
            category: true,
            subcategory: true,
            fields: true,
          },
        });

        targetPublications = dbPubs.map((p: any) => {
          const fields = (p.fields as Record<string, any>) || {};
          const extraDescriptions = Array.isArray(fields.extraDescriptions) ? fields.extraDescriptions : [];
          const existingBlock = extraDescriptions.find((d: any) =>
            String(d?.title || "").trim().toLowerCase() === targetBlockTitle.toLowerCase()
          );
          return {
            id: p.id,
            title: p.title || "",
            publisherName: p.publisherName || "",
            country: p.country || "",
            city: p.city || "",
            category: p.category || "",
            subcategory: p.subcategory || "",
            currentBody: existingBlock?.body || "",
          };
        });
      }
    }

    // MODE 1: Save previously approved previews
    if (action === "save-approved" && approvedUpdates.length > 0) {
      const saveResults: Array<{ publicationId: string; success: boolean; error?: string }> = [];

      for (const item of approvedUpdates) {
        try {
          const pub = await prisma.publication.findUnique({
            where: { id: item.publicationId },
            select: { id: true, fields: true },
          });

          if (!pub) {
            saveResults.push({ publicationId: item.publicationId, success: false, error: "Publicación no encontrada" });
            continue;
          }

          const fields = (pub.fields as Record<string, any>) || {};
          const extraDescriptions: any[] = Array.isArray(fields.extraDescriptions)
            ? [...fields.extraDescriptions]
            : [];

          const existingIdx = extraDescriptions.findIndex((d) =>
            String(d?.title || "").trim().toLowerCase() === item.blockTitle.trim().toLowerCase()
          );

          if (existingIdx >= 0) {
            extraDescriptions[existingIdx] = {
              ...extraDescriptions[existingIdx],
              body: item.updatedBodyHtml,
              bodyI18n: {
                ...(extraDescriptions[existingIdx].bodyI18n || {}),
                es: item.updatedBodyHtml,
              },
            };
          } else {
            extraDescriptions.push({
              title: item.blockTitle,
              body: item.updatedBodyHtml,
              titleI18n: { es: item.blockTitle },
              bodyI18n: { es: item.updatedBodyHtml },
              visibleInCard: false,
            });
          }

          await prisma.publication.update({
            where: { id: item.publicationId },
            data: {
              fields: {
                ...fields,
                extraDescriptions,
              },
            },
          });

          saveResults.push({ publicationId: item.publicationId, success: true });
        } catch (err: any) {
          saveResults.push({ publicationId: item.publicationId, success: false, error: err?.message || "Error al guardar" });
        }
      }

      return NextResponse.json({
        ok: true,
        action: "save-approved",
        total: saveResults.length,
        succeeded: saveResults.filter((r) => r.success).length,
        failed: saveResults.filter((r) => !r.success).length,
        results: saveResults,
      });
    }

    // VALIDATION FOR GENERATION (preview or apply)
    if (!targetBlockTitle) {
      return NextResponse.json(
        { ok: false, error: "Debe especificar el título del bloque a actualizar (ej: 'Requisitos Migratorios')." },
        { status: 400 }
      );
    }

    if (!rawDocumentText && !updatePrompt) {
      return NextResponse.json(
        { ok: false, error: "Debe subir un documento (Excel, CSV, texto) o proporcionar instrucciones de actualización." },
        { status: 400 }
      );
    }

    if (targetPublications.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No se seleccionaron publicaciones para actualizar." },
        { status: 400 }
      );
    }

    // PROCESS PUBLICATIONS WITH DEDICATED AI AGENT
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
        // Context-aware document slice: extract strictly relevant rows/sections if document is large
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

        // If action === "apply", save immediately to database
        if (action === "apply") {
          const dbPub = await prisma.publication.findUnique({
            where: { id: pub.id },
            select: { id: true, fields: true },
          });

          if (dbPub) {
            const fields = (dbPub.fields as Record<string, any>) || {};
            const extraDescriptions: any[] = Array.isArray(fields.extraDescriptions)
              ? [...fields.extraDescriptions]
              : [];

            const existingIdx = extraDescriptions.findIndex((d) =>
              String(d?.title || "").trim().toLowerCase() === targetBlockTitle.toLowerCase()
            );

            if (existingIdx >= 0) {
              extraDescriptions[existingIdx] = {
                ...extraDescriptions[existingIdx],
                title: agentOutput.blockTitle,
                body: agentOutput.updatedBodyHtml,
                titleI18n: {
                  ...(extraDescriptions[existingIdx].titleI18n || {}),
                  es: agentOutput.blockTitle,
                },
                bodyI18n: {
                  ...(extraDescriptions[existingIdx].bodyI18n || {}),
                  es: agentOutput.updatedBodyHtml,
                },
              };
            } else {
              extraDescriptions.push({
                title: agentOutput.blockTitle,
                body: agentOutput.updatedBodyHtml,
                titleI18n: { es: agentOutput.blockTitle },
                bodyI18n: { es: agentOutput.updatedBodyHtml },
                visibleInCard: false,
              });
            }

            await prisma.publication.update({
              where: { id: pub.id },
              data: {
                fields: {
                  ...fields,
                  extraDescriptions,
                },
              },
            });
          }
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
          error: err?.message || "Error inesperado al procesar",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      action,
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
      { ok: false, error: error?.message || "Error interno del servidor al procesar la actualización" },
      { status: 500 }
    );
  }
}
