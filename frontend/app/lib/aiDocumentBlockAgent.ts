import { executeModelCall, cleanGenericBlockTitle, applyPromptColorStyles } from "./aiPublicationAgents";

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

/**
 * Specialized Content Block Updater Agent.
 * Supports two operational modes:
 * 1. Document-Driven Grounding: When official documents (Excel, CSV, laws) are uploaded.
 * 2. Prompt-Driven Editorial Redaction: When updating or expanding blocks purely from administrator instructions.
 * ZERO rigid templates, ZERO clichés, real context awareness.
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
    publication,
    apiKeyParam,
  } = input;

  const hasDocument = Boolean(documentContext && documentContext.trim().length > 0);
  const cleanTitle = cleanGenericBlockTitle(blockTitle || "Orientación y Requisitos", updatePrompt);
  const entityName = publication.publisherName || publication.title || "El establecimiento";
  const destinationCountry = publication.country || "Argentina";
  const destinationCity = publication.city || "";
  const locationText = [destinationCity, destinationCountry].filter(Boolean).join(", ");

  const systemPrompt = hasDocument
    ? `Eres un asesor editorial y redactor profesional para Travelgrin.
Tu misión es redactar y actualizar con máxima fidelidad el bloque descriptivo "${cleanTitle}" para la publicación "${publication.title}" de la entidad "${entityName}" (${locationText}), BASÁNDOTE EN EL DOCUMENTO OFICIAL ADJUNTO ("${documentFileName}").

Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "title": "${cleanTitle}",
  "body": "<p>Contenido actualizado en formato HTML...</p>",
  "evidencias": ["Fila o dato concreto del documento utilizado 1", "Fila o dato del documento 2"]
}

REGLAS DE REDACCIÓN:
1. FIDELIDAD AL DOCUMENTO (CERO ALUCINACIONES):
   - Extrae los requisitos, trámites, visas, aranceles, plazos o normativas estrictamente del documento adjunto.
   - Aplica los datos que corresponden específicamente al país ("${destinationCountry}"), entidad ("${entityName}") o área ("${publication.category || ""}") de esta publicación.
   - NUNCA inventes leyes ni números de decreto que no figuren en el documento.
2. CERO PLANTILLAS Y CERO CLICHÉS:
   - Queda PROHIBIDO usar plantillas acartonadas o frases de relleno ("En el mundo actual...", "A continuación...", "Es fundamental...").
   - Redacta de forma clara, directa, humana y profesional para el viajero o postulante.
3. DIRECTIVA DEL ADMINISTRADOR:
   - Cumple fielmente con el enfoque o las directivas de estilo dadas por el administrador.
4. FORMATO HTML LIMPIO:
   - Usa etiquetas HTML limpias: <p>, <strong>, <ul>, <li>, <br/>.
   - Extensión sustancial y clara: entre 2 a 4 párrafos legibles.`
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
   - Desarrolla y enriquece el bloque según lo solicitado en las instrucciones ("${updatePrompt}").
   - Adapta el contenido a la realidad de la publicación ("${publication.title}"), en ${locationText}.
2. CERO PLANTILLAS Y CERO FRASES CLICHÉ:
   - Escribe con tono natural, profesional y útil para quien lee la publicación. Nada de introducciones vacías o textos genéricos de IA.
3. FORMATO HTML:
   - Estructura con <p>, <strong>, <ul>, <li> para que sea agradable de leer.
   - Entre 2 a 4 párrafos claros con información de alto valor práctico.`;

  const userPrompt = `=== INFORMACIÓN DE LA PUBLICACIÓN ===
- Publicación: "${publication.title}"
- Oferente / Entidad: "${entityName}"
- Destino / País: "${locationText}"
- Categoría: "${publication.category || "General"} ${publication.subcategory ? `> ${publication.subcategory}` : ""}"
${publication.mainDescription ? `- Descripción general actual:\n"${publication.mainDescription.replace(/<[^>]+>/g, " ").slice(0, 400)}"\n` : ""}

=== BLOQUE OBJETIVO A ACTUALIZAR ===
- Título del Bloque: "${cleanTitle}"
${currentBody ? `- Texto anterior de este bloque (para mejorar o reemplazar):\n"${currentBody.replace(/<[^>]+>/g, " ").slice(0, 600)}"\n` : "(Este bloque aún no existía en esta publicación; redáctalo desde cero)"}

${updatePrompt ? `=== INSTRUCCIONES DEL ADMINISTRADOR ===\n"${updatePrompt}"\n` : ""}

${hasDocument ? `=== DATOS DEL DOCUMENTO ADJUNTO ("${documentFileName}") ===\n${documentContext}\n` : ""}

Instrucción final: Devuelve el JSON con "title", "body" (HTML enriquecido) y "evidencias".`;

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
    if (!updatedBody || updatedBody.length < 20) {
      throw new Error("El contenido generado es insuficiente.");
    }

    if (!updatedBody.includes("<p>")) {
      updatedBody = updatedBody
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("\n");
    }

    // Apply color directives if requested in updatePrompt
    updatedBody = applyPromptColorStyles(updatedBody, updatePrompt);

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
    console.error("[runDocumentBlockAgent Error]:", error);
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
