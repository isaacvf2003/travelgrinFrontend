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
  documentContext: string;
  documentFileName: string;
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
 * Specialized AI Agent: Knowledge-Base & Document-Driven Block Updater.
 * Strictly grounds block content in the uploaded official document (Excel, CSV, regulations),
 * mapping laws, requirements, costs, and procedures directly to the specific publication.
 * CERO templates, CERO hallucinations.
 */
export async function runDocumentBlockAgent(
  input: DocumentBlockAgentInput
): Promise<DocumentBlockAgentOutput> {
  const {
    blockTitle,
    currentBody = "",
    documentContext,
    documentFileName,
    updatePrompt = "",
    publication,
    apiKeyParam,
  } = input;

  const cleanTitle = cleanGenericBlockTitle(blockTitle || "Requisitos y Trámites", updatePrompt);
  const entityName = publication.publisherName || publication.title || "El establecimiento";
  const destinationCountry = publication.country || "Argentina";
  const destinationCity = publication.city || "";
  const locationText = [destinationCity, destinationCountry].filter(Boolean).join(", ");

  const systemPrompt = `Eres un asesor editorial y experto en normativas oficiales, trámites y contenidos para Travelgrin.
Tu misión es redactar y actualizar con máxima fidelidad el bloque descriptivo "${cleanTitle}" para la publicación "${publication.title}" de la entidad "${entityName}" (${locationText}), BASÁNDOTE ESTRICTAMENTE EN EL DOCUMENTO OFICIAL ADJUNTO ("${documentFileName}").

Tu respuesta debe ser EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "title": "${cleanTitle}",
  "body": "<p>Contenido actualizado en formato HTML...</p>",
  "evidencias": ["Fila/Dato del documento utilizado 1", "Fila/Dato del documento utilizado 2"]
}

REGLAS DE ORO DE FIDELIDAD FACTUAL (MÁXIMA PRIORIDAD):
1. FIDELIDAD TOTAL AL DOCUMENTO (CERO ALUCINACIONES):
   - Extrae los requisitos, trámites, visas, aranceles, plazos o normativas estrictamente del documento oficial adjunto.
   - Aplica los datos que corresponden específicamente al país ("${destinationCountry}"), entidad ("${entityName}") o categoría ("${publication.category || ""}") de esta publicación.
   - Si el documento no especifica un dato secundario, indica que se debe consultar con las autoridades o canales oficiales; NUNCA inventes leyes, números de decretos, plazos ni aranceles que no figuren en el documento.

2. CERO PLANTILLAS RÍGIDAS Y CERO CLICHÉS:
   - Queda TERMINANTEMENTE PROHIBIDO usar plantillas fijas, frases de relleno o clichés como "En el mundo actual...", "A continuación se detalla...", "Es fundamental tener en cuenta que...", o estructuras acartonadas.
   - Redacta de forma clara, directa, humana y profesional, orientada al viajero o postulante extranjero.

3. AUTORIDAD DE LA DIRECTIVA DEL ADMINISTRADOR:
   - Si el administrador incluyó una directiva o prompt (ej: destacar estudiantes, enfatizar aranceles o estructurar con preguntas), CUMPLE fielmente con su enfoque editorial y de estilo.

4. FORMATO HTML LIMPIO Y PROFESIONAL:
   - Utiliza exclusivamente etiquetas HTML estándar: <p>, <strong>, <ul>, <li>, <br/>.
   - Si la directiva pide colores específicos, aplícalos con estilos en línea (ej: <strong style="color: #0b8fa3;">...</strong>).
   - Asegura párrafos legibles con buena jerarquía visual (encabezados en negrita o viñetas según corresponda).

5. IDIOMA Y EXTENSIÓN:
   - Idioma: Español neutro y profesional.
   - Extensión sustancial y completa: normalmente de 2 a 4 párrafos o lista estructurada de requisitos claros.`;

  const userPrompt = `=== CONTEXTO DE LA PUBLICACIÓN ESPECÍFICA ===
- Título: "${publication.title}"
- Entidad / Oferente: "${entityName}"
- Ubicación / País de Destino: "${locationText}"
- Categoría / Área: "${publication.category || "General"} ${publication.subcategory ? `> ${publication.subcategory}` : ""}"
${publication.mainDescription ? `- Resumen de la propuesta: "${publication.mainDescription.replace(/<[^>]+>/g, " ").slice(0, 500)}"` : ""}

=== BLOQUE A ACTUALIZAR ===
- Título del Bloque: "${cleanTitle}"
${currentBody ? `- Contenido previo del bloque (para referencia de estilo o estructura anterior):\n${currentBody.replace(/<[^>]+>/g, " ").slice(0, 600)}\n` : ""}
${updatePrompt ? `=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR ===\n"${updatePrompt}"\n` : ""}

=== DATOS DEL DOCUMENTO OFICIAL ADJUNTO ("${documentFileName}") ===
${documentContext}

Instrucción final: Devuelve el objeto JSON con "title", "body" (HTML) y "evidencias", aplicando las normativas reales del documento a la publicación de ${entityName} en ${destinationCountry}.`;

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
      throw new Error("El contenido generado por la IA es insuficiente.");
    }

    if (!updatedBody.includes("<p>")) {
      updatedBody = updatedBody
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("\n");
    }

    if (updatePrompt) {
      updatedBody = applyPromptColorStyles(updatedBody, updatePrompt);
    }

    const outputTitle = String(parsed.title || cleanTitle).trim();
    const evidencias = Array.isArray(parsed.evidencias)
      ? parsed.evidencias.map((e: any) => String(e).trim()).filter(Boolean)
      : [documentFileName];

    return {
      success: true,
      blockTitle: outputTitle,
      updatedBodyHtml: updatedBody,
      evidencias,
      providerUsed,
    };
  } catch (err: any) {
    console.error(`[aiDocumentBlockAgent] Error updating block "${cleanTitle}":`, err?.message);
    return {
      success: false,
      blockTitle: cleanTitle,
      updatedBodyHtml: currentBody,
      evidencias: [],
      providerUsed: "none",
      error: err?.message || "Error al procesar el documento con IA",
    };
  }
}
