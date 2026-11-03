import {
  executeModelCall,
  cleanGenericBlockTitle,
  applyPromptColorStyles,
  enforceDescriptionParagraphCount,
  enforceParagraphWordLimit,
} from "./aiPublicationAgents";

export interface PublicationContextForBlockUpdate {
  id?: string;
  title: string;
  publisherName?: string;
  country?: string;
  city?: string;
  category?: string;
  subcategory?: string;
  mainDescription?: string;
}

export interface DocumentBlockAgentInput {
  blockTitle: string;
  currentBody?: string;
  documentContext?: string;
  documentFileName?: string;
  updatePrompt?: string;
  excelInstructions?: string;
  matchedRowsText?: string[];
  publication: PublicationContextForBlockUpdate;
  apiKeyParam?: string;
}

export interface DocumentBlockAgentOutput {
  success: boolean;
  blockTitle: string;
  updatedBodyHtml: string;
  evidencias: string[];
  providerUsed: string;
  error?: string;
}

function buildDeterministicBlockFromExcelRows(
  matchedRowsText: string[],
  documentContext: string,
  entityName: string,
  pubTitle: string,
  locationText: string,
  currentBody: string,
  effectivePrompt: string
): { bodyHtml: string; evidencias: string[] } {
  const evidencias: string[] = [];

  if (matchedRowsText.length > 0) {
    const paragraphs: string[] = [];
    for (const rowLine of matchedRowsText) {
      const cleanedLine = rowLine.replace(/^[•\-*]\s*/, "").trim();
      evidencias.push(cleanedLine.slice(0, 140));
      const segments = cleanedLine
        .split(/\s*\|\s*/)
        .map((s) => s.trim())
        .filter(Boolean);

      // Filter out segments that are just the publication/entity name or instruction column
      const infoSegments = segments.filter((seg) => {
        const valOnly = seg.replace(/^[^:]{1,30}:\s*/, "").trim();
        const vLower = valOnly.toLowerCase();
        if (vLower === entityName.toLowerCase() || vLower === pubTitle.toLowerCase()) return false;
        if (/^(?:nombre|publicaci[oó]n|t[ií]tulo|oferente|instituci[oó]n|empresa|entidad|instrucci[oó]n|prompt)[^:]{0,25}:/i.test(seg)) return false;
        return valOnly.length > 2;
      });

      if (infoSegments.length > 0) {
        for (const seg of infoSegments) {
          const colonMatch = seg.match(/^([^:]{2,35}):\s*(.+)$/);
          if (colonMatch) {
            const label = colonMatch[1].trim();
            const val = colonMatch[2].trim();
            if (/^(?:info|informaci[oó]n|contenido|descripci[oó]n|texto|detalle|bloque)$/i.test(label)) {
              paragraphs.push(`<p>${val}</p>`);
            } else {
              paragraphs.push(`<p><strong>${label}:</strong> ${val}</p>`);
            }
          } else {
            paragraphs.push(`<p>${seg}</p>`);
          }
        }
      } else if (cleanedLine.length > 10) {
        paragraphs.push(`<p>${cleanedLine}</p>`);
      }
    }

    if (paragraphs.length > 0) {
      let html = paragraphs.join("\n");
      if (effectivePrompt) {
        html = enforceDescriptionParagraphCount(html, effectivePrompt);
        html = enforceParagraphWordLimit(html, effectivePrompt);
        html = applyPromptColorStyles(html, effectivePrompt);
      }
      return { bodyHtml: html, evidencias };
    }
  }

  // Fallback if no specific row was isolated
  const baseText = currentBody
    ? currentBody
    : `<p><strong>${entityName}</strong> (${locationText}) ofrece atención e información actualizada para "${pubTitle}".</p>`;
  let html = baseText.includes("<p>") ? baseText : `<p>${baseText}</p>`;
  if (effectivePrompt) {
    html = applyPromptColorStyles(html, effectivePrompt);
  }
  return {
    bodyHtml: html,
    evidencias: [documentContext ? "Datos extraídos del archivo adjunto" : "Actualización según instrucciones"],
  };
}

/**
 * Specialized Content Block Updater Agent.
 * Supports:
 * 1. Excel / Document-Driven Grounding with per-publication row matching AND embedded Excel instructions.
 * 2. Prompt-Driven Editorial Redaction.
 */
export async function runDocumentBlockAgent(
  input: DocumentBlockAgentInput
): Promise<DocumentBlockAgentOutput> {
  const {
    blockTitle,
    currentBody = "",
    documentContext = "",
    documentFileName = "instrucciones_redaccion",
    updatePrompt = "",
    excelInstructions = "",
    matchedRowsText = [],
    publication,
    apiKeyParam,
  } = input;

  const hasDocument = Boolean(documentContext && documentContext.trim().length > 0);
  const combinedPrompt = [updatePrompt.trim(), excelInstructions.trim()].filter(Boolean).join("\n");
  const cleanTitle = cleanGenericBlockTitle(blockTitle || "Orientación y Requisitos", combinedPrompt);
  const entityName = publication.publisherName || publication.title || "El establecimiento";
  const destinationCountry = publication.country || "Argentina";
  const destinationCity = publication.city || "";
  const locationText = [destinationCity, destinationCountry].filter(Boolean).join(", ");

  const systemPrompt = hasDocument
    ? `Eres un asesor editorial y redactor profesional para Travelgrin.
Tu misión es redactar y actualizar con máxima fidelidad el bloque descriptivo "${cleanTitle}" para la publicación "${publication.title}" de la entidad "${entityName}" (${locationText}), BASÁNDOTE EN EL ARCHIVO EXCEL / DOCUMENTO ADJUNTO ("${documentFileName}").

Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "title": "${cleanTitle}",
  "body": "<p>Contenido actualizado en formato HTML...</p>",
  "evidencias": ["Fila o dato concreto del Excel utilizado 1", "Instrucción o dato aplicado 2"]
}

REGLAS ESTRICTAS DE RECONOCIMIENTO DE EXCEL E INSTRUCCIONES:
1. ASOCIACIÓN EXACTA POR PUBLICACIÓN / OFERENTE:
   - El archivo Excel puede contener varias publicaciones (por su nombre de publicación o nombre del oferente).
   - Utiliza EXCLUSIVAMENTE la fila o información que corresponde a "${entityName}" / "${publication.title}".
   - PROHIBIDO mezclar o incluir datos que pertenezcan a otra publicación distinta del Excel.
2. OBEDIENCIA A INSTRUCCIONES DENTRO DEL EXCEL Y DEL ADMIN:
   - Si el Excel incluye una columna, fila o nota con instrucciones para la IA (o si el administrador escribió instrucciones complementarias), CÚMPLELAS AL 100% (estructura, cantidad de párrafos, extensión, tono, subtítulos, colores, viñetas, etc.).
3. FIDELIDAD Y CERO PLANTILLAS:
   - Toma toda la información real provista en el Excel para esta publicación y desarróllala de forma clara, humana y profesional.
   - Queda PROHIBIDO usar frases cliché ("En el mundo actual...", "A continuación...").
4. FORMATO HTML LIMPIO:
   - Usa etiquetas HTML limpias: <p>, <strong>, <ul>, <li>, <br/>.`
    : `Eres un redactor y editor especializado de Travelgrin.
Tu misión es redactar y actualizar el bloque descriptivo "${cleanTitle}" para la publicación "${publication.title}" de "${entityName}" (${locationText}), SIGUIENDO LAS INSTRUCCIONES ESPECÍFICAS DEL ADMINISTRADOR.

Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "title": "${cleanTitle}",
  "body": "<p>Contenido actualizado en formato HTML...</p>",
  "evidencias": ["Aspecto clave 1 abordado", "Aspecto clave 2 abordado"]
}

REGLAS DE REDACCIÓN:
1. CUMPLIMIENTO DE INSTRUCCIONES DEL ADMINISTRADOR:
   - Desarrolla y enriquece el bloque según lo solicitado en las instrucciones ("${combinedPrompt}").
   - Adapta el contenido a la realidad de la publicación ("${publication.title}"), en ${locationText}.
2. CERO PLANTILLAS Y CERO FRASES CLICHÉ:
   - Escribe con tono natural, profesional y útil para quien lee la publicación. Nada de introducciones vacías o textos genéricos de IA.
3. FORMATO HTML:
   - Estructura con <p>, <strong>, <ul>, <li> para que sea agradable de leer.`;

  const userPrompt = `=== INFORMACIÓN DE LA PUBLICACIÓN A ACTUALIZAR ===
- Título de la Publicación: "${publication.title}"
- Nombre del Oferente / Entidad: "${entityName}"
- Destino / País: "${locationText}"
- Categoría: "${publication.category || "General"} ${publication.subcategory ? `> ${publication.subcategory}` : ""}"
${publication.mainDescription ? `- Descripción general actual:\n"${publication.mainDescription.replace(/<[^>]+>/g, " ").slice(0, 400)}"\n` : ""}

=== BLOQUE OBJETIVO A ACTUALIZAR ===
- Título del Bloque: "${cleanTitle}"
${currentBody ? `- Texto anterior de este bloque (para mejorar o reemplazar):\n"${currentBody.replace(/<[^>]+>/g, " ").slice(0, 600)}"\n` : "(Este bloque aún no existía en esta publicación; redáctalo desde cero con la info del Excel/instrucciones)"}

${combinedPrompt ? `=== INSTRUCCIONES DEL ADMINISTRADOR (MODAL + EXCEL) ===\n"${combinedPrompt}"\n` : ""}

${hasDocument ? `=== CONTENIDO DEL EXCEL / DOCUMENTO ADJUNTO ("${documentFileName}") ===\n${documentContext}\n` : ""}

Instrucción final: Devuelve únicamente el JSON con "title", "body" (HTML enriquecido con la información de "${entityName}" / "${publication.title}") y "evidencias".`;

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      apiKeyParam,
      "auto",
      3000
    );

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("La IA no devolvió un formato JSON válido.");
      }
    }

    let updatedBody = String(parsed.body || parsed.contenido || "").trim();
    if (!updatedBody || updatedBody.length < 15) {
      throw new Error("El contenido generado es insuficiente.");
    }

    if (!updatedBody.includes("<p>") && !updatedBody.includes("<ul>")) {
      updatedBody = updatedBody
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("\n");
    }

    // Apply paragraph, word limit, and color directives from BOTH modal prompt and Excel instructions
    if (combinedPrompt) {
      updatedBody = enforceDescriptionParagraphCount(updatedBody, combinedPrompt);
      updatedBody = enforceParagraphWordLimit(updatedBody, combinedPrompt);
      updatedBody = applyPromptColorStyles(updatedBody, combinedPrompt);
    }

    const finalTitle = String(parsed.title || cleanTitle).trim();
    const evidencias = Array.isArray(parsed.evidencias)
      ? parsed.evidencias.map((e: any) => String(e).trim()).filter(Boolean)
      : [];

    return {
      success: true,
      blockTitle: finalTitle,
      updatedBodyHtml: updatedBody,
      evidencias,
      providerUsed,
    };
  } catch (error: any) {
    console.warn("[runDocumentBlockAgent] Using deterministic Excel/prompt builder fallback:", error?.message);
    if (hasDocument || matchedRowsText.length > 0) {
      const fallback = buildDeterministicBlockFromExcelRows(
        matchedRowsText,
        documentContext,
        entityName,
        publication.title,
        locationText,
        currentBody,
        combinedPrompt
      );
      return {
        success: true,
        blockTitle: cleanTitle,
        updatedBodyHtml: fallback.bodyHtml,
        evidencias: fallback.evidencias,
        providerUsed: "excel-extractor",
      };
    }

    return {
      success: false,
      blockTitle: cleanTitle,
      updatedBodyHtml: "",
      evidencias: [],
      providerUsed: "none",
      error: error?.message || "Error al procesar el bloque con el agente de contenido.",
    };
  }
}
