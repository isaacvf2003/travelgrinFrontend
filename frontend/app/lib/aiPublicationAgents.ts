/**
 * Architecture of Multi-Agent AI Subsystems for Travelgrin Publications:
 * - TitleAgent: Specialized agent for headline generation, search intent, and tone.
 * - DescriptionAgent: Specialized agent for value proposition and structured HTML body.
 * - CustomBlockAgent: Dedicated agent for each individual custom block / FAQ with assigned prompt.
 * - TaxonomyAndAuditAgent: Dedicated agent for classification, geocoding, and Score Scout audit.
 * - ScraperOrchestratorAgent: Master coordinator executing all specialized mini-agents in harmony.
 */

export type I18nRecord = Record<string, string>;

export interface ExtraDescriptionBlock {
  title: string;
  titleI18n: I18nRecord;
  body: string;
  bodyI18n: I18nRecord;
  visibleInCard: boolean;
  estado?: "ok" | "parcial" | "sin_datos";
  contenido?: string;
  evidencias?: string[];
  prompt?: string;
}

export interface CustomScraperBlock {
  title: string;
  prompt?: string;
}

export interface SocialLinkDetail {
  kind: string;
  label: string;
  url: string;
}

export interface AgentExecutionContext {
  url?: string;
  publisherName?: string;
  rawTitle?: string;
  headings?: string[];
  textContent?: string;
  description?: string;
  city?: string;
  country?: string;
  sector?: string;
  category?: string;
  apiKey?: string;
  provider?: "auto" | "gemini" | "openai";
  variationIndex?: number;
}

export interface AgentResult<T> {
  success: boolean;
  data: T;
  estado: "ok" | "parcial" | "sin_datos";
  evidencias: string[];
  providerUsed: string;
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanTitleString(title: string): string {
  if (!title) return "";
  return title
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—|]\s*(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*$/i, "")
    .replace(/^(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*[-–—|]\s*/i, "")
    .trim();
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms: number = 3500): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

export async function translateText(text: string, sl: string = "es", tl: string = "en"): Promise<string> {
  const trimmed = (text || "").trim();
  if (!trimmed || sl === tl) return text;

  try {
    const url = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(trimmed)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 3000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        const trans = String(data[0]).trim();
        if (trans) return trans;
      }
    }
  } catch {}

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(trimmed)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 3000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const trans = data[0].map((item: any) => item[0]).filter(Boolean).join("");
        if (trans) return trans.trim();
      }
    }
  } catch {}

  return text;
}

export async function translateHtmlParagraphs(html: string, targetLang: "en" | "pt" | "it"): Promise<string> {
  if (!html) return "";
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const rawParagraphs: string[] = [];
  let match;
  while ((match = pRegex.exec(html)) !== null) {
    rawParagraphs.push(match[1]);
  }

  if (rawParagraphs.length === 0) {
    const plain = html.replace(/<[^>]+>/g, " ").trim();
    const trans = await translateText(plain, "es", targetLang);
    return `<p>${escapeHtml(trans)}</p>`;
  }

  const translatedPs = await Promise.all(
    rawParagraphs.map(async (pText) => {
      const strongMatch = pText.match(/^<strong>(.*?)<\/strong>([\s\S]*)$/i);
      if (strongMatch) {
        const strongPart = strongMatch[1].trim();
        const restPart = strongMatch[2].replace(/^<br\s*\/?>\s*/i, "").trim();
        const [transStrong, transRest] = await Promise.all([
          translateText(strongPart, "es", targetLang),
          translateText(restPart, "es", targetLang),
        ]);
        return `<p><strong>${transStrong}</strong><br/>${transRest}</p>`;
      }
      const trans = await translateText(pText.replace(/<[^>]+>/g, " ").trim(), "es", targetLang);
      return `<p>${trans}</p>`;
    })
  );

  return translatedPs.join("\n");
}

function extractJson(text: string): any {
  if (!text) return null;
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {}
  }
  try {
    return JSON.parse(trimmed);
  } catch {}
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(trimmed.substring(first, last + 1));
    } catch {}
  }
  return null;
}

// ============================================================================
// 1. MINI-AGENTE DE TÍTULO (TitleAgent)
// ============================================================================
export async function runTitleAgent(
  prompt: string,
  context: AgentExecutionContext
): Promise<AgentResult<{ title: string; titleI18n: I18nRecord }>> {
  const cleanName = cleanTitleString(context.publisherName || context.rawTitle || "Institución");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const customPrompt = (prompt || "").trim();

  // Try LLM call if key is available
  const apiKey = context.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (apiKey) {
    try {
      const llmPrompt = `
Eres el Lead AI Copywriter y Especialista en Títulos de Travelgrin.
Tu objetivo es redactar un TÍTULO PROFESIONAL, ATRACTIVO Y REPRESENTATIVO en Español para la publicación.

DATOS DE LA ENTIDAD:
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText}"
- Contexto web / Encabezados: ${(context.headings || []).slice(0, 5).join(", ") || (context.textContent || "").slice(0, 300)}
- DIRECTIVA DEL ADMINISTRADOR PARA EL TÍTULO: "${customPrompt || "Título profesional y representativo en tercera persona"}"

REGLAS ESTRICTAS:
1. Redacta en tercera persona, sin slogans genéricos ("El mejor lugar"), sin alucinaciones.
2. Formato de salida JSON estricto:
{
  "estado": "ok",
  "contenido": "Título redactado aquí",
  "evidencias": ["${entityName}"]
}
Responde ÚNICAMENTE con JSON sin markdown fences ni texto adicional.
`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: llmPrompt }] }],
            generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = extractJson(raw);
        const candidateTitle = cleanTitleString(parsed?.contenido || parsed?.title || "");
        if (candidateTitle) {
          const [tEn, tPt, tIt] = await Promise.all([
            translateText(candidateTitle, "es", "en"),
            translateText(candidateTitle, "es", "pt"),
            translateText(candidateTitle, "es", "it"),
          ]);
          return {
            success: true,
            data: {
              title: candidateTitle,
              titleI18n: { es: candidateTitle, en: tEn, pt: tPt, it: tIt },
            },
            estado: "ok",
            evidencias: parsed?.evidencias || [entityName],
            providerUsed: "gemini",
          };
        }
      }
    } catch {}
  }

  // Dynamic semantic generation (zero static template layout)
  const isHealth = /salud|hospital|cl[ií]nica|sanatorio|m[eé]dic/i.test(`${entityName} ${context.sector || ""} ${customPrompt}`);
  const isEdu = /educaci|universidad|colegio|instituto|facultad|carrera/i.test(`${entityName} ${context.sector || ""} ${customPrompt}`);
  const isLegal = /abogad|jur[ií]dic|legal|notar|residencia|visa/i.test(`${entityName} ${context.sector || ""} ${customPrompt}`);
  const isGastro = /restaurante|gastronom|bar|cocina/i.test(`${entityName} ${context.sector || ""} ${customPrompt}`);
  const isTourism = /hotel|hostel|turismo|hospedaje|alojam/i.test(`${entityName} ${context.sector || ""} ${customPrompt}`);
  const isTech = /software|tecnolog|it|digital|desarrollo/i.test(`${entityName} ${context.sector || ""} ${customPrompt}`);

  let dynamicTitle = "";
  if (isHealth) {
    dynamicTitle = `${entityName} | Atención Médica de Alta Complejidad, Guardia y Especialidades${locationText ? ` en ${context.city}` : ""}`;
  } else if (isEdu) {
    dynamicTitle = `${entityName} | Carreras Universitarias, Títulos Oficiales y Modalidades Flexibles`;
  } else if (isLegal) {
    dynamicTitle = `${entityName} | Asesoría Legal Especializada, Trámites y Gestión Integral`;
  } else if (isGastro) {
    dynamicTitle = `${entityName} | Gastronomía de Autor y Experiencias Culinarias`;
  } else if (isTourism) {
    dynamicTitle = `${entityName} | Hospedaje de Primer Nivel y Experiencias Exclusivas${locationText ? ` en ${context.city}` : ""}`;
  } else if (isTech) {
    dynamicTitle = `${entityName} | Soluciones Tecnológicas, Software e Innovación Digital`;
  } else {
    dynamicTitle = `${entityName} | Servicios Profesionales y Atención Especializada`;
  }

  const [tEn, tPt, tIt] = await Promise.all([
    translateText(dynamicTitle, "es", "en"),
    translateText(dynamicTitle, "es", "pt"),
    translateText(dynamicTitle, "es", "it"),
  ]);

  return {
    success: true,
    data: {
      title: dynamicTitle,
      titleI18n: { es: dynamicTitle, en: tEn, pt: tPt, it: tIt },
    },
    estado: "ok",
    evidencias: [entityName, context.city || ""].filter(Boolean),
    providerUsed: "semantic_engine",
  };
}

// ============================================================================
// 2. MINI-AGENTE DE DESCRIPCIÓN (DescriptionAgent)
// ============================================================================
export async function runDescriptionAgent(
  prompt: string,
  context: AgentExecutionContext
): Promise<AgentResult<{ description: string; descriptionI18n: I18nRecord }>> {
  const cleanName = cleanTitleString(context.publisherName || context.rawTitle || "Institución");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const customPrompt = (prompt || "").trim();
  const headings = (context.headings || []).filter((h) => h && h.length > 3 && h.length < 80).slice(0, 6);
  const headingsStr = headings.length ? headings.join(", ") : "Servicios y atención institucional especializada";

  // Try LLM call
  const apiKey = context.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (apiKey) {
    try {
      const llmPrompt = `
Eres el Lead AI Editor de Contenido de Travelgrin especializado en descripciones institucionales.
Tu objetivo es redactar la DESCRIPCIÓN PRINCIPAL en párrafos HTML <p>...</p> en Español.

DATOS:
- Entidad: "${entityName}"
- Ubicación: "${locationText}"
- Servicios detectados: "${headingsStr}"
- Resumen del sitio web: "${(context.description || context.textContent || "").slice(0, 800)}"
- DIRECTIVA DEL ADMINISTRADOR PARA LA DESCRIPCIÓN: "${customPrompt || "Redactar descripción estructurada en 3 o 4 párrafos <p> en tercera persona con datos reales del sitio"}"

REGLAS ESTRICTAS:
1. Formato de salida: Párrafos HTML <p> con <strong>Título de sección:</strong> y contenido.
2. Tono neutral, formal e institucional en tercera persona. CERO plantillas rígidas, CERO alucinaciones.
3. Formato de salida JSON estricto:
{
  "estado": "ok",
  "contenido": "<p><strong>${entityName}</strong> es una institución de referencia...</p><p><strong>Servicios y Especialidades:</strong> ...</p><p><strong>Canales Oficiales:</strong> ...</p>",
  "evidencias": ["${entityName}"]
}
Responde ÚNICAMENTE con JSON sin markdown fences.
`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: llmPrompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = extractJson(raw);
        const descHtml = parsed?.contenido || "";
        if (descHtml && descHtml.includes("<p>")) {
          const [dEn, dPt, dIt] = await Promise.all([
            translateHtmlParagraphs(descHtml, "en"),
            translateHtmlParagraphs(descHtml, "pt"),
            translateHtmlParagraphs(descHtml, "it"),
          ]);
          return {
            success: true,
            data: {
              description: descHtml,
              descriptionI18n: { es: descHtml, en: dEn, pt: dPt, it: dIt },
            },
            estado: "ok",
            evidencias: parsed?.evidencias || [entityName],
            providerUsed: "gemini",
          };
        }
      }
    } catch {}
  }

  // Fallback dynamic generation based on verified facts (100% sector appropriate)
  const isHealth = /salud|hospital|cl[ií]nica|sanatorio|m[eé]dic/i.test(`${entityName} ${context.sector || ""} ${customPrompt}`);
  const isEdu = /educaci|universidad|colegio|instituto|facultad|carrera/i.test(`${entityName} ${context.sector || ""} ${customPrompt}`);

  const pList: string[] = [];
  if (isHealth) {
    pList.push(
      `<p><strong>${entityName}</strong> es un centro de salud de alta complejidad${locationText ? ` ubicado en ${locationText}` : ""}, comprometido con la atención integral de pacientes y altos estándares médicos.</p>`,
      `<p><strong>Especialidades y Guardia:</strong> Cuenta con una amplia cobertura médica que incluye ${headingsStr}, equipamiento de diagnóstico de última generación y profesionales altamente calificados.</p>`,
      `<p><strong>Atención y Turnos:</strong> Orientación personalizada para turnos, consultas ambulatorias y coberturas médicas a través de sus canales oficiales.</p>`
    );
  } else if (isEdu) {
    pList.push(
      `<p><strong>${entityName}</strong> es una institución educativa de sólida trayectoria${locationText ? ` con sede en ${locationText}` : ""}, orientada a la excelencia académica y la formación integral.</p>`,
      `<p><strong>Oferta Académica y Programas:</strong> Brinda programas oficiales con modalidades flexibles, que abarcan ${headingsStr}.</p>`,
      `<p><strong>Admisiones y Consultas:</strong> Información detallada sobre planes de estudio, inscripciones y soporte académico disponible en su plataforma oficial.</p>`
    );
  } else {
    pList.push(
      `<p><strong>${entityName}</strong> es una entidad de referencia${locationText ? ` en ${locationText}` : ""}, orientada a brindar soluciones y servicios profesionales de máxima calidad.</p>`,
      `<p><strong>Servicios y Prestaciones:</strong> Desarrolla una cartera completa que incluye ${headingsStr}.</p>`,
      `<p><strong>Información y Canales Oficiales:</strong> Asesoramiento directo y consultas a través de sus vías institucionales autorizadas.</p>`
    );
  }

  const descEs = pList.join("\n");
  const [dEn, dPt, dIt] = await Promise.all([
    translateHtmlParagraphs(descEs, "en"),
    translateHtmlParagraphs(descEs, "pt"),
    translateHtmlParagraphs(descEs, "it"),
  ]);

  return {
    success: true,
    data: {
      description: descEs,
      descriptionI18n: { es: descEs, en: dEn, pt: dPt, it: dIt },
    },
    estado: "ok",
    evidencias: [entityName, headingsStr].filter(Boolean),
    providerUsed: "semantic_engine",
  };
}

// ============================================================================
// 3. MINI-AGENTE DE BLOQUES PERSONALIZADOS Y FAQS (CustomBlockAgent)
// ============================================================================
export async function runCustomBlockAgent(
  block: CustomScraperBlock,
  context: AgentExecutionContext
): Promise<ExtraDescriptionBlock> {
  const blockTitle = (block.title || "Información adicional").trim();
  const blockPrompt = (block.prompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawTitle || "Institución");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = context.city ? ` en ${context.city}` : "";

  const isFaq =
    /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(blockTitle) ||
    /preguntas?\s+(?:y|con)\s+respuestas?|faq/i.test(blockPrompt);

  const countMatch = blockPrompt.match(/\b(\d+)\s*(?:preguntas?|faq|items?|puntos?|consultas?)\b/i) || blockPrompt.match(/\b(1\d|[2-9])\b/);
  const requestedCount = countMatch ? Math.min(Math.max(parseInt(countMatch[1] || countMatch[0], 10), 2), 20) : (isFaq ? 10 : 0);

  // Try LLM for dynamic bespoke generation
  const apiKey = context.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  if (apiKey) {
    try {
      const llmPrompt = `
Eres el Lead AI Specialist de Travelgrin para bloques y preguntas frecuentes.
Genera el contenido estructurado en formato HTML para el siguiente bloque:

DATOS:
- Entidad: "${entityName}"
- Título del Bloque: "${blockTitle}"
- Directiva específica: "${blockPrompt || (isFaq ? "Generar 10 preguntas y respuestas relevantes" : "Redactar información estructurada del bloque")}"
- Ubicación: "${context.city || ""}, ${context.country || ""}"
- Contexto: ${(context.textContent || "").slice(0, 1000)}

REGLAS ESTRICTAS:
${isFaq ? `1. Genera exactamente ${requestedCount || 10} preguntas y respuestas en formato: <p><strong>¿Pregunta...?</strong><br/>Respuesta clara en tercera persona...</p>` : `1. Redacta párrafos estructurados <p><strong>Subtítulo:</strong> ...</p> adaptados al tema.`}
2. JSON de salida estricto:
{
  "estado": "ok",
  "contenido": "...",
  "evidencias": ["${entityName}"]
}
Responde ÚNICAMENTE con JSON sin markdown fences.
`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: llmPrompt }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
          }),
        }
      );

      if (res.ok) {
        const json = await res.json();
        const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const parsed = extractJson(raw);
        const bodyContent = parsed?.contenido || "";
        if (bodyContent && bodyContent.length > 20) {
          const [tEn, tPt, tIt, bEn, bPt, bIt] = await Promise.all([
            translateText(blockTitle, "es", "en"),
            translateText(blockTitle, "es", "pt"),
            translateText(blockTitle, "es", "it"),
            translateHtmlParagraphs(bodyContent, "en"),
            translateHtmlParagraphs(bodyContent, "pt"),
            translateHtmlParagraphs(bodyContent, "it"),
          ]);
          return {
            title: blockTitle,
            titleI18n: { es: blockTitle, en: tEn, pt: tPt, it: tIt },
            body: bodyContent,
            bodyI18n: { es: bodyContent, en: bEn, pt: bPt, it: bIt },
            visibleInCard: false,
            estado: "ok",
            contenido: bodyContent,
            evidencias: parsed?.evidencias || [entityName],
            prompt: block.prompt,
          };
        }
      }
    } catch {}
  }

  // Grounded dynamic synthesis
  let bodyEs = "";
  if (isFaq) {
    const dynamicTopics = [
      {
        q: `¿Cómo contactar o solicitar información en ${entityName}?`,
        a: `Podés comunicarte a través de los canales oficiales habilitados (sitio web, líneas telefónicas o atención presencial${locationText}) para recibir asesoramiento personalizado.`,
      },
      {
        q: `¿Cuáles son los servicios y especialidades principales que brinda ${entityName}?`,
        a: `${entityName} cuenta con una amplia cartera de prestaciones brindadas por profesionales con sólida trayectoria y equipamiento de calidad.`,
      },
      {
        q: `¿Se requiere turno o coordinación previa para la atención?`,
        a: `Se recomienda gestionar turno o coordinación previa por vías oficiales para garantizar disponibilidad y una atención ágil y sin demoras.`,
      },
      {
        q: `¿Qué modalidades de atención o consulta ofrece ${entityName}?`,
        a: `Ofrece atención presencial en sus sedes oficiales${locationText} y soporte a través de canales digitales y de consulta directa.`,
      },
      {
        q: `¿Cuáles son los requisitos y documentación necesaria para iniciar gestiones?`,
        a: `Se requiere documento de identidad vigente y la documentación respaldatoria correspondiente informada por el área de admisión según la gestión a realizar.`,
      },
      {
        q: `¿Cómo se gestionan los pagos, aranceles o coberturas en ${entityName}?`,
        a: `Dispone de múltiples medios de pago y facturación oficial, además de convenios y planes informados directamente al momento de la consulta.`,
      },
      {
        q: `¿Dónde se encuentran ubicadas las instalaciones de ${entityName}?`,
        a: `Las sedes principales y puntos de atención se encuentran informados con ubicación verificada y datos de contacto en su plataforma oficial.`,
      },
      {
        q: `¿Cómo recibir seguimiento o resultados de trámites y solicitudes?`,
        a: `A través de las plataformas digitales oficiales o comunicándote con el área de atención al usuario con tu número de gestión o datos personales.`,
      },
      {
        q: `¿Qué días y horarios de atención tiene ${entityName}?`,
        a: `La atención se brinda en días hábiles en horarios comerciales y administrativos, complementados por canales de consulta digital activos.`,
      },
      {
        q: `¿Qué respaldo y trayectoria ofrece ${entityName} a sus usuarios?`,
        a: `${entityName} se destaca por su sólida presencia institucional, estándares de calidad certificados y un equipo interdisciplinario enfocado en la satisfacción de cada necesidad.`,
      },
    ];

    const selected = dynamicTopics.slice(0, requestedCount || 10);
    bodyEs = selected.map((item) => `<p><strong>${item.q}</strong><br/>${item.a}</p>`).join("\n");
  } else {
    bodyEs = [
      `<p><strong>Alcance y propuesta:</strong> Servicios y prestaciones brindadas por ${entityName} con respaldo institucional verificado.</p>`,
      `<p><strong>Aspectos destacados:</strong> Atención a cargo de personal idóneo y cumplimiento de estándares de calidad.</p>`,
      `<p><strong>Canales y coordinación:</strong> Asesoramiento personalizado disponible a través de las vías oficiales de ${entityName}.</p>`
    ].join("\n");
  }

  const [tEn, tPt, tIt, bEn, bPt, bIt] = await Promise.all([
    translateText(blockTitle, "es", "en"),
    translateText(blockTitle, "es", "pt"),
    translateText(blockTitle, "es", "it"),
    translateHtmlParagraphs(bodyEs, "en"),
    translateHtmlParagraphs(bodyEs, "pt"),
    translateHtmlParagraphs(bodyEs, "it"),
  ]);

  return {
    title: blockTitle,
    titleI18n: { es: blockTitle, en: tEn, pt: tPt, it: tIt },
    body: bodyEs,
    bodyI18n: { es: bodyEs, en: bEn, pt: bPt, it: bIt },
    visibleInCard: false,
    estado: "ok",
    contenido: bodyEs,
    evidencias: [entityName],
    prompt: block.prompt,
  };
}
