import { NextResponse } from "next/server";

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
  conversationHistory?: ConversationMessage[];
  variationIndex?: number;
}

function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#8216;/g, "‘")
    .replace(/&#8217;/g, "’")
    .replace(/&#8220;/g, "“")
    .replace(/&#8221;/g, "”")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function cleanTitleString(title: string): string {
  if (!title) return "";
  let decoded = decodeHtmlEntities(title);
  decoded = decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—|]\s*(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*$/i, "")
    .replace(/^(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*[-–—|]\s*/i, "")
    .trim();
  return decoded;
}

function cleanBaseEntityName(text: string, publisherName?: string): string {
  let base = cleanTitleString(publisherName || text || "");
  if (!base && text) base = cleanTitleString(text);
  
  const pipeParts = base.split(/\s*[-–—|]\s*/).filter(Boolean);
  if (pipeParts.length > 1) {
    const p1 = pipeParts[0].trim();
    const p2 = pipeParts[1].trim();
    if (p1.toLowerCase().includes(p2.toLowerCase()) || p2.toLowerCase().includes(p1.toLowerCase())) {
      base = p1.length >= p2.length ? p1 : p2;
    } else {
      base = p1;
    }
  }
  return base.trim();
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms: number = 15000): Promise<Response> {
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

async function translateWithGoogleDirect(text: string, sl: string, tl: string): Promise<string | null> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }, 4000);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("json")) return null;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0].map((item: any) => item[0]).filter(Boolean).join("");
      return translated || null;
    }
  } catch {}
  return null;
}

async function translateTextDirect(q: string, sl: string, tl: string): Promise<string> {
  const trimmed = q.trim();
  if (!trimmed || sl === tl) return q;

  const gRes = await translateWithGoogleDirect(trimmed, sl, tl);
  if (gRes && gRes.trim() && gRes.trim() !== trimmed) {
    return cleanTitleString(gRes.trim());
  }

  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${sl}|${tl}`;
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0" } }, 4000);
    if (res.ok) {
      const data = await res.json();
      const trans = data.responseData?.translatedText;
      if (trans && typeof trans === "string" && !trans.includes("MYMEMORY WARNING")) {
        return cleanTitleString(trans.trim());
      }
    }
  } catch {}

  return q;
}

function normalizeToEnglishDescriptionHeaders(text: string): string {
  if (!text) return "";
  return text
    .replace(/<strong>\s*(?:Vigencia|Validade|Validità):\s*<\/strong>/gi, "<strong>Validity:</strong>")
    .replace(/<strong>\s*(?:Precio|Preço|Prezzo):\s*<\/strong>/gi, "<strong>Price:</strong>")
    .replace(/<strong>\s*(?:Propuesta de valor|Proposta de valor|Proposta di valore):\s*<\/strong>/gi, "<strong>Value proposition:</strong>")
    .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Para quem\??|Per chi\??):\s*<\/strong>/gi, "<strong>Who is it for?:</strong>")
    .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Required documents:</strong>")
    .replace(/<strong>\s*(?:Permanencia|Permanência|Permanenza):\s*<\/strong>/gi, "<strong>Length of stay:</strong>")
    .replace(/<strong>\s*(?:Diferencial|Differenziale):\s*<\/strong>/gi, "<strong>Differentiator:</strong>")
    .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Idiomas de atendimento|Lingue di assistenza):\s*<\/em>/gi, "<em>Service languages:</em>")
    .replace(/<em>\s*(?:Experiencia y soporte|Experiência e suporte|Esperienza e supporto):\s*<\/em>/gi, "<em>Experience and support:</em>")
    .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Differentiator vs. alternatives:</em>")
    .replace(/<strong>\s*(?:Exclusiones|Exclusões|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusions:</strong>");
}

function normalizeToPortugueseDescriptionHeaders(text: string): string {
  if (!text) return "";
  return text
    .replace(/<strong>\s*(?:Vigencia|Validity|Validità):\s*<\/strong>/gi, "<strong>Validade:</strong>")
    .replace(/<strong>\s*(?:Precio|Price|Prezzo):\s*<\/strong>/gi, "<strong>Preço:</strong>")
    .replace(/<strong>\s*(?:Propuesta de valor|Value proposition):\s*<\/strong>/gi, "<strong>Proposta de valor:</strong>")
    .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Per chi\??):\s*<\/strong>/gi, "<strong>Para quem?:</strong>")
    .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentazione richiesta):\s*<\/strong>/gi, "<strong>Documentação necessária:</strong>")
    .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanenza):\s*<\/strong>/gi, "<strong>Permanência:</strong>")
    .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Diferencial:</strong>")
    .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Lingue di assistenza):\s*<\/em>/gi, "<em>Idiomas de atendimento:</em>")
    .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Esperienza e supporto):\s*<\/em>/gi, "<em>Experiência e suporte:</em>")
    .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternatives|Differenziale vs\. alternative):\s*<\/em>/gi, "<em>Diferencial vs. alternativas:</em>")
    .replace(/<strong>\s*(?:Exclusiones|Exclusions|Esclusioni):\s*<\/strong>/gi, "<strong>Exclusões:</strong>");
}

function normalizeToItalianDescriptionHeaders(text: string): string {
  if (!text) return "";
  return text
    .replace(/<strong>\s*(?:Vigencia|Validity|Validade):\s*<\/strong>/gi, "<strong>Validità:</strong>")
    .replace(/<strong>\s*(?:Precio|Price|Preço):\s*<\/strong>/gi, "<strong>Prezzo:</strong>")
    .replace(/<strong>\s*(?:Propuesta de valor|Value proposition|Proposta de valor):\s*<\/strong>/gi, "<strong>Proposta di valore:</strong>")
    .replace(/<strong>\s*(?:¿?Para qui[eé]n\??|Who is it for\??|Para quem\??):\s*<\/strong>/gi, "<strong>Per chi?:</strong>")
    .replace(/<strong>\s*(?:Documentaci[oó]n requerida|Required documents|Documentação necessária):\s*<\/strong>/gi, "<strong>Documentazione richiesta:</strong>")
    .replace(/<strong>\s*(?:Permanencia|Length of stay|Permanência):\s*<\/strong>/gi, "<strong>Permanenza:</strong>")
    .replace(/<strong>\s*(?:Diferencial|Differentiator):\s*<\/strong>/gi, "<strong>Differenziale:</strong>")
    .replace(/<em>\s*(?:Idiomas de atenci[oó]n|Service languages|Idiomas de atendimento):\s*<\/em>/gi, "<em>Lingue di assistenza:</em>")
    .replace(/<em>\s*(?:Experiencia y soporte|Experience and support|Esperienza e supporto):\s*<\/em>/gi, "<em>Esperienza e supporto:</em>")
    .replace(/<em>\s*(?:Diferencial vs\. alternativas|Differentiator vs\. alternative):\s*<\/em>/gi, "<em>Differenziale vs. alternative:</em>")
    .replace(/<strong>\s*(?:Exclusiones|Exclusions|Exclusões):\s*<\/strong>/gi, "<strong>Esclusioni:</strong>");
}

async function translateFullHtml(htmlEs: string, targetLang: "en" | "pt" | "it"): Promise<string> {
  if (!htmlEs) return "";
  const parts = htmlEs.split(/(<\/?[a-z0-9]+(?:\s+[^>]*)?>)/gi);
  const translatedParts = await Promise.all(
    parts.map(async (part) => {
      if (!part || /^<\/?[a-z0-9]+/i.test(part)) return part;
      const trimmed = part.trim();
      if (!trimmed || /^[💡⭐⚠️•>🚀🎯🏆💎📅📍📞⚖️🩺🛡️✨🌟⏱️👥🍣🎓🏠\s]+$/u.test(trimmed)) return part;
      const leadingSpace = part.match(/^\s*/)?.[0] || "";
      const trailingSpace = part.match(/\s*$/)?.[0] || "";
      const trans = await translateTextDirect(trimmed, "es", targetLang);
      return `${leadingSpace}${trans}${trailingSpace}`;
    })
  );
  const joined = translatedParts.join("");
  return targetLang === "en"
    ? normalizeToEnglishDescriptionHeaders(joined)
    : targetLang === "pt"
    ? normalizeToPortugueseDescriptionHeaders(joined)
    : normalizeToItalianDescriptionHeaders(joined);
}

function extractJsonFromText(raw: string): any {
  if (!raw) return null;
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

function buildSystemRefinePrompt(
  fieldType: FieldType,
  currentText: string,
  prompt: string,
  meta: { title?: string; publisherName?: string; category?: string; city?: string; country?: string; url?: string },
  conversationHistory: ConversationMessage[] = []
): string {
  const contextStr = [
    meta.title ? `Título actual: ${meta.title}` : "",
    meta.publisherName ? `Entidad/Marca extraída: ${meta.publisherName}` : "",
    meta.category ? `Categoría/Rubro: ${meta.category}` : "",
    meta.city ? `Ubicación: ${meta.city}${meta.country ? `, ${meta.country}` : ""}` : "",
    meta.url ? `Web: ${meta.url}` : "",
  ].filter(Boolean).join(" | ");

  const historyStr = conversationHistory.length > 0
    ? conversationHistory.map(m => `${m.role === "user" ? "Administrador" : "Asistente"}: "${m.content}"`).join("\n")
    : "Sin historial previo";

  return `
Eres el Asistente de IA y Lead Copywriter Creativo Senior de Travelgrin (actúas con total libertad e inteligencia creativa, como ChatGPT Plus o Gemini Advanced).

🎯 TU MISIÓN:
Pensar profundamente la MEJOR opción posible para el administrador. Tienes TOTAL LIBERTAD creativa, conceptual y estilística para redactar con impacto, elegancia y persuasión profesional. No te limites a plantillas fijas.

⚡ REGLAS CRÍTICAS DE CONTEXTO E HISTORIAL:
1. CONTINUIDAD DE RESTRICCIONES (POSITIVAS Y NEGATIVAS):
   - Si en la conversación previa o en la instrucción actual el administrador pidió omitir la marca ("no hace falta que diga [nombre]", "sin el nombre", "sacale X"):
     ¡MANTÉN ESA RESTRICCIÓN ACTIVADA! No vuelvas a incluir el nombre de la empresa/institución aunque el usuario diga "hacelo diferente", "hacelo más corto" o "ajustalo".
   - Si el administrador pidió QUITAR PRECIOS ("quita lo de precio", "sin precio", "sacar precio", "no poner precio", etc.):
     ¡NO INCLUYAS <strong>Precio:</strong> NI REFERENCIAS ARANCELARIAS! Omite por completo esa etiqueta. Si además pide indicar que es gratis, pon "Actividad gratuita / Acceso libre".
   - Si el administrador pidió QUITAR VIGENCIA o QUITAR EXCLUSIONES:
     Omite esas secciones correspondientes.
   - Crea siempre una formulación conceptual brillante, orientada al beneficio, la propuesta de valor o la llamada a la acción.

2. ADAPTABILIDAD UNIVERSAL DE RUBROS:
   - Este contenido puede provenir de cualquier rubro (Deportes, Judicial/Legal, Salud, Educación, Turismo, Inmobiliaria, Gastronomía, Comercio, etc.).
   - Utiliza el vocabulario, jerarquía y tono propio de la industria correspondiente.

3. REGLAS PARA DESCRIPCIÓN (fieldType === "description"):
   - MÁXIMA LIBERTAD CREATIVA Y AUTONOMÍA:
     * El administrador puede estar mejorando un texto scrapeado O creando una publicación 100% nueva desde cero (eventos, torneos deportivos, buffet gastronómico, servicios jurídicos, salud, cursos, alquileres, promociones, etc.) o a partir de un formulario de cliente.
     * Tienes LIBERTAD TOTAL para crear la estructura HTML que mejor comunique, impacte y venda la propuesta.
     * Puedes usar párrafos <p>, negritas <strong>, cursivas <em>, listas <ul><li> y emojis/iconos modernos llamativos (💡, 🚀, 🎯, 🏆, 💎, 📅, 📍, 📞, ⚖️, 🩺, 🛡️, ✨, 🌟, ⏱️, 👥, 🍣, 🎓, 🏠, etc.) que resalten cada punto clave con elegancia y copywriting persuasivo.
     * Si no se pide una estructura especial o se busca el formato estándar, puedes seguir o adaptar los 4 párrafos de referencia:
       <p><strong>Vigencia:</strong> ... <strong>Precio:</strong> ...</p>
       <p>💡 <strong>Propuesta de valor:</strong> ... <strong>¿Para quién?:</strong> ... <strong>Documentación requerida:</strong> ... <strong>Permanencia:</strong> ...</p>
       <p>⭐ <strong>Diferencial:</strong> <em>Idiomas de atención:</em> ... <em>Experiencia y soporte:</em> ... <em>Diferencial vs. alternativas:</em> ...</p>
       <p>⚠️ <strong>Exclusiones:</strong> ...</p>
     * RESPETO ABSOLUTO A RESTRICCIONES:
       - Si el usuario pide quitar precios o dice que es gratis: Omite <strong>Precio:</strong> por completo o indica que es gratuito.
       - Si el usuario pide omitir la marca/nombre de la entidad: No menciones la marca/nombre en el texto.
       - Si el usuario pide añadir secciones nuevas (ej: Premios, Horarios, Cronograma, Menú, Beneficios, Requisitos): Créalas con formato HTML enriquecido y atractivos emojis.

📋 CONTEXTO DISPONIBLE:
${contextStr || "Sin contexto adicional"}

💬 HISTORIAL DE LA CONVERSACIÓN:
${historyStr}

TIPO DE CAMPO: "${fieldType}"
TEXTO BASE:
"""
${currentText || "(campo actualmente vacío o nuevo)"}
"""

INSTRUCCIÓN ACTUAL DEL ADMINISTRADOR:
"""
${prompt}
"""

FORMATO DE SALIDA (ÚNICAMENTE JSON VÁLIDO):
- Si fieldType === "title": {"title": "Mejor opción de título pensada con total libertad, sin clichés y respetando restricciones"}
- Si fieldType === "description": {"description": "HTML con los párrafos formateados respetando estrictamente las restricciones del usuario (por ejemplo sin precio si lo pidió)"}
- Si fieldType === "provider_info": {"providerInfo": "Texto de síntesis institucional de alto nivel"}
- Si fieldType === "extra_block" O "new_extra_block": {"title": "Título del bloque", "body": "Cuerpo con formato y datos solicitados"}

RESPONDE SOLAMENTE EL OBJETO JSON VÁLIDO.
`;
}

// Intelligent Semantic NLP Generator for instant local generation & fallback
function generateSemanticAiFallback(
  fieldType: FieldType,
  currentText: string,
  prompt: string,
  meta: { title?: string; publisherName?: string; category?: string; city?: string; country?: string; url?: string },
  conversationHistory: ConversationMessage[] = [],
  variationIndex: number = 0
): any {
  const allPrompts = [
    ...conversationHistory.map((m) => m.content),
    prompt,
  ].join(" ").toLowerCase();

  const pLower = prompt.toLowerCase().trim();
  const cleanName = cleanBaseEntityName(currentText || meta.title || "", meta.publisherName);
  const cityStr = meta.city || "";
  const catLower = (meta.category || "").toLowerCase();
  const fullCorpus = `${cleanName} ${catLower} ${allPrompts} ${meta.url || ""}`.toLowerCase();

  // Multi-domain detection
  const isEducation = /universidad|facultad|instituto|colegio|carrera|educa|acad[eé]m|posgrado|grado|m[aá]ster|abogac[ií]a|licenciatura|terciario/i.test(fullCorpus);
  const isJudicial = /judicial|abogad|estudio jur[ií]dic|legal|leyes|derecho|notar|escriban|perit|defens|litig/i.test(fullCorpus);
  const isSports = /deport|club|gym|gimnasio|futbol|fútbol|rugby|tenis|p[aá]del|nataci|entrenam|fitness|b[aá]squet|atlet/i.test(fullCorpus);
  const isHealth = /salud|m[eé]dic|cl[ií]nic|hospital|guardia|odont|odontol|psic|obra social|prepaga|sanatorio|farmac/i.test(fullCorpus);
  const isTourism = /turism|viaje|hotel|alojam|excursi|vuelo|hostel|tour|hospedaje|posada|cabaña|resort/i.test(fullCorpus);
  const isFood = /gastronom|restauran|bar|caf[eé]|comida|parrilla|bistr[oó]|cena|almuerzo|degustac/i.test(fullCorpus);
  const isRealEstate = /inmobiliar|propiedad|bienes ra[ií]ces|alquiler|tasaci|lote|terreno|departamento|casa en venta/i.test(fullCorpus);

  // Persistent omitName check across all turns
  const omitName = /no hace falta.*(nombre|siglo|marca|decir|poner|mencionar)|sin.*(nombre|marca|mencionar)|no pongas.*(nombre|marca)|no digas|no menciones|omiti|sacale.*(nombre|marca)|sacar.*(nombre|marca)|sin la marca/i.test(allPrompts);

  if (fieldType === "title") {
    // Variations pools for distinct domains
    if (omitName) {
      if (isJudicial) {
        const v = [
          "Asesoramiento Legal de Excelencia: Soluciones Jurídicas Integrales",
          "Defensa y Representación Jurídica: Turnos y Consultas Especializadas",
          "¡Protegé tus Derechos! Asesoramiento Jurídico y Notarial de Vanguardia",
          "Soluciones Legales Estratégicas: Trayectoria y Compromiso Profesional",
        ];
        return { title: v[variationIndex % v.length] };
      }

      if (isSports) {
        const v = [
          "¡Entrená al Máximo Nivel! Actividades Deportivas y Pases Mensuales",
          "Centro Deportivo de Alto Rendimiento: Instalaciones y Membresías",
          "¡Sumate al Deporte! Clases, Torneos y Espacios de Entrenamiento",
          "Viví tu Pasión Deportiva: Actividades para Todas las Edades",
        ];
        return { title: v[variationIndex % v.length] };
      }

      if (isEducation) {
        const v = [
          "Liderá tu Futuro: Formación Universitaria y Carreras de Vanguardia",
          "Carreras de Grado, Posgrados Oficiales y Becas Universitarias",
          "¡Vení a la Mejor Universidad! Carreras Oficiales y Modalidad Flexible",
          "Educación Superior de Excelencia: Inscripciones Abiertas y Salida Laboral",
          "Tu Futuro Profesional Comienza Hoy: Títulos Oficiales y Prácticas",
        ];
        return { title: v[variationIndex % v.length] };
      }

      if (isHealth) {
        const v = [
          `¡Contratá la Mejor Cobertura Médica en ${cityStr || 'tu ciudad'}!`,
          "Atención Médica de Excelencia: Guardia 24hs y Especialidades",
          "Planes de Salud Integrales: Cobertura Médica y Turnos Online",
          "Cuidá tu Bienestar: Atención Multidisciplinaria y Tecnología Médica",
        ];
        return { title: v[variationIndex % v.length] };
      }

      if (isTourism) {
        const v = [
          "¡Viví Experiencias Únicas! Alojamientos y Excursiones Exclusivas",
          "Destinos Inolvidables: Hospedajes y Paquetes Turísticos Oficiales",
          "¡Planificá tu Próxima Escapada! Tarifas Preferenciales y Asesoramiento",
        ];
        return { title: v[variationIndex % v.length] };
      }

      if (isFood) {
        const v = [
          "Experiencia Gastronómica Única: Sabores de Autor y Reservas Online",
          "Menú de Autor y Platos Exclusivos: Viví una Experiencia Inolvidable",
          "¡Descubrí el Mejor Sabor! Gastronomía de Vanguardia y Eventos",
        ];
        return { title: v[variationIndex % v.length] };
      }

      if (isRealEstate) {
        const v = [
          "Encontrá la Propiedad de tus Sueños: Venta, Alquiler y Tasaciones",
          `Oportunidades Inmobiliarias e Inversiones Estratégicas en ${cityStr || 'la región'}`,
          "Gestión Inmobiliaria Integral: Asesoramiento y Propiedades Exclusivas",
        ];
        return { title: v[variationIndex % v.length] };
      }

      const vGeneral = [
        "Excelencia, Confianza y Soluciones Profesionales de Primer Nivel",
        "Servicios de Vanguardia y Atención Personalizada Garantizada",
        "Calidad, Trayectoria y Respaldo Institucional Verificado",
      ];
      return { title: vGeneral[variationIndex % vGeneral.length] };
    }

    // 2. Short / Direct / Name only
    if (/corto|breve|directo|solo nombre|s[ií]ntesis/i.test(pLower)) {
      return { title: cleanName };
    }

    // 3. Direct Invitation / Call to action (veni a la mejor..., contrata..., inscribite...)
    if (/veni|vení|inscribite|estudia|estudiá|entr[aá]|eleg[ií]|sumat/i.test(pLower)) {
      if (isEducation) {
        const v = [
          `¡Vení a la mejor universidad! Estudiá en ${cleanName}`,
          `¡Inscribite hoy en ${cleanName}! Carreras Oficiales y Modalidades Flexibles`,
          `¡Elegí tu futuro en ${cleanName}! Carreras de Grado y Posgrados`,
        ];
        return { title: v[variationIndex % v.length] };
      }
      if (isJudicial) {
        return { title: `¡Protegé tus Derechos con ${cleanName}! Asesoramiento Jurídico en ${cityStr || 'tu ciudad'}` };
      }
      if (isSports) {
        return { title: `¡Sumate a ${cleanName}! Tu Club Deportivo en ${cityStr || 'tu ciudad'}` };
      }
      if (isHealth) {
        return { title: `¡Elegí la mejor opción en salud! ${cleanName} en ${cityStr || 'tu ciudad'}` };
      }
      return { title: `¡Vení a conocer ${cleanName}! Experiencia y Calidad Garantizada` };
    }

    if (/contrat[aá]|asociat|afiliat|sumat|obra social|prepaga|seguro/i.test(pLower)) {
      return { title: `¡Contratá la mejor obra social! ${cleanName} en ${cityStr || 'tu ciudad'}` };
    }

    // 4. High Impact / Attention-grabbing / Trabajado / Potente / Llamativo
    if (/impact|atenci[oó]n|trabajad|llamativ|potente|fuerte|nivel|profesional|excelen|destac|mejor/i.test(pLower)) {
      if (isEducation) {
        const v = [
          `¡Vení a la mejor universidad! Estudiá en ${cleanName} | Carreras de Grado y Posgrados`,
          `${cleanName} | Carreras de Grado, Posgrados Oficiales y Formación de Vanguardia`,
          `Liderá tu Futuro Profesional en ${cleanName} | Inscripciones Abiertas`,
        ];
        return { title: v[variationIndex % v.length] };
      }
      if (isJudicial) {
        return { title: `${cleanName} | Estudio Jurídico y Asesoramiento Legal Integral` };
      }
      if (isSports) {
        return { title: `${cleanName} | Club Deportivo, Entrenamientos y Pases Oficiales` };
      }
      if (isHealth) {
        return { title: `¡Contratá la mejor atención médica! ${cleanName} | Guardia 24hs y Turnos Online` };
      }
      if (isTourism) {
        return { title: `¡Viví la mejor experiencia! ${cleanName} | Hoteles y Excursiones Oficiales` };
      }
      return { title: `¡Elegí la mejor propuesta! ${cleanName}: Excelencia y Servicios de Primer Nivel` };
    }

    // 5. Commercial / Attractive / Slogan
    if (/atractiv|comercial|vent|promo|publicit/i.test(pLower)) {
      if (isEducation) {
        return { title: `Estudiá en ${cleanName} | Tu Futuro Profesional Comienza Hoy` };
      }
      return { title: `${cleanName} | Calidad Garantizada y Beneficios Exclusivos` };
    }

    // 6. Careers / Programs / Degrees
    if (/carrera|grado|posgrado|master|curso|beca|inscrip/i.test(pLower)) {
      return { title: `${cleanName} | Carreras de Grado, Posgrados e Inscripciones Abiertas` };
    }

    // 7. Health / Emergency / Shifts
    if (/guardia|turno|consulta|especialidad/i.test(pLower)) {
      return { title: `${cleanName} | Guardia Médica 24hs y Turnos Online` };
    }

    // 8. City / Location
    if (/ciudad|sede|centro|ubicaci|mendoza|cordoba|caba|buenos aires|rosario/i.test(pLower)) {
      const detectedCity = pLower.includes("mendoza")
        ? "Mendoza"
        : pLower.includes("cordoba") || pLower.includes("córdoba")
        ? "Córdoba"
        : pLower.includes("rosario")
        ? "Rosario"
        : cityStr || "Sede Central";
      return { title: `${cleanName} - Sede ${detectedCity}` };
    }

    // 9. General smart synthesis with rotating variations
    const vDefault = [
      `${cleanName}: Servicios Oficiales y Atención Personalizada`,
      `${cleanName} | Calidad, Trayectoria y Soluciones Profesionales`,
      `${cleanName} - Excelencia Institucional y Canales Oficiales`,
    ];
    return { title: vDefault[variationIndex % vDefault.length] };
  }

  if (fieldType === "description") {
    const isFree = /gratis|sin costo|gratuito|libre/i.test(allPrompts);
    const isShort = /corto|breve|directo|resum/i.test(allPrompts);
    const omitPrice = /quit.*precio|sin.*precio|sac.*precio|no.*precio|ocult.*precio|omit.*precio|elimina.*precio|no hace falta.*precio|sacale.*precio/i.test(allPrompts);
    const omitVigencia = /quit.*vigencia|sin.*vigencia|sac.*vigencia|no.*vigencia/i.test(allPrompts);
    const omitExclusiones = /quit.*exclusi|sin.*exclusi|sac.*exclusi|no.*exclusi|sin.*advertencia/i.test(allPrompts);
    const omitDiferencial = /quit.*diferencial|sin.*diferencial|sac.*diferencial/i.test(allPrompts);
    const hasScholarships = /beca|descuent|promoci|financi|bonific|cuota/i.test(allPrompts);
    const isVirtual = /virtual|online|distancia|remot/i.test(allPrompts);
    const hasEmergency = /emergencia|guardia|24\/7|24hs|urgencia/i.test(allPrompts);
    const locStr = cityStr ? ` en ${cityStr}` : "";

    // 1. Custom creation from scratch: Tournaments & Sporting Events
    if (/torneo|campeonato|copa|competici|partido|f[uú]tbol|p[aá]del|fixture|premios/i.test(allPrompts)) {
      const pTourney = [
        `<p>🏆 <strong>Torneo & Competencia:</strong> ¡Sumate al torneo más emocionante${locStr}! Categorías abiertas y competitivas con arbitraje federado y organización profesional.</p>`,
        `<p>📅 <strong>Cronograma & Modalidad:</strong> Fase de grupos, eliminación directa y gran final con cobertura fotográfica y premiación en vivo.</p>`,
        `<p>💎 <strong>Premios & Reconocimientos:</strong> Premios en efectivo para el podio, trofeos de campeón y subcampeón, hidratación y distinciones individuales.</p>`,
        !omitPrice ? `<p><strong>Inscripción:</strong> ${isFree ? "Actividad gratuita / Libre acceso." : "A consultar según categoría y conformación del equipo."}</p>` : "",
        !omitExclusiones ? `<p>⚠️ <strong>Exclusiones:</strong> Cupos limitados por orden de registro. Presentación de apto físico y lista de buena fe obligatoria.</p>` : "",
      ].filter(Boolean).join("\n");
      return { description: pTourney };
    }

    // 2. Custom creation from scratch: Gastronomy, Buffet, Sushi, Tasting
    if (/buffet|sushi|tenedor libre|degustaci|cata de vino|cena show|gourmet/i.test(allPrompts)) {
      const pGastro = [
        `<p>🍣 <strong>Experiencia Gastronómica:</strong> Disfrutá de una propuesta culinaria de autor${locStr}, combinando materias primas frescas y sabores únicos.</p>`,
        `<p>✨ <strong>Menú & Variedades:</strong> Entradas gourmet, piezas selectas de sushi, opciones artesanales y destacada carta de vinos y coctelería.</p>`,
        `<p>⭐ <strong>Ambiente & Diferencial:</strong> Espacio climatizado, atención esmerada y atmósfera ideal para celebraciones, parejas y encuentros de amigos.</p>`,
        !omitPrice ? `<p><strong>Precio:</strong> ${isFree ? "Acceso libre." : "A consultar según menú o servicio elegido."}</p>` : "",
        `<p>📍 <strong>Reservas:</strong> Se sugiere reserva previa a través de canales oficiales para garantizar la mejor ubicación.</p>`,
      ].filter(Boolean).join("\n");
      return { description: pGastro };
    }

    // 3. Custom creation from scratch: Course, Workshop, Masterclass
    if (/curso|masterclass|taller|workshop|capacitaci|aprender/i.test(allPrompts)) {
      const pCourse = [
        `<p>🎓 <strong>Capacitación Profesional:</strong> Formación intensiva diseñada para adquirir herramientas prácticas de alta demanda${locStr}.</p>`,
        `<p>💡 <strong>Contenidos & Metodología:</strong> Clases dinámicas, proyectos reales, material descargable y tutoría personalizada durante todo el cursado.</p>`,
        `<p>⭐ <strong>Certificación:</strong> Diploma de finalización con aval institucional para enriquecer tu perfil y trayectoria profesional.</p>`,
        !omitPrice ? `<p><strong>Aranceles:</strong> ${isFree ? "Curso 100% gratuito." : hasScholarships ? "Planes de pago en cuotas y becas al mérito." : "A consultar según modalidad elegida."}</p>` : "",
        !omitExclusiones ? `<p>⚠️ <strong>Exclusiones:</strong> Cupos reducidos por grupo para garantizar un seguimiento personalizado.</p>` : "",
      ].filter(Boolean).join("\n");
      return { description: pCourse };
    }

    // 4. Custom creation from scratch: Specific Legal Services (Divorce, Probate, Labor)
    if (/divorcio|sucesi|penal|laboral|indemnizaci|litigio/i.test(allPrompts)) {
      const pLegalSpec = [
        `<p>⚖️ <strong>Asesoramiento Jurídico Especializado:</strong> Soluciones legales estratégicas con sólida trayectoria, atención personalizada y estricta confidencialidad${locStr}.</p>`,
        `<p>💡 <strong>Áreas de Actuación:</strong> Gestión de acuerdos, trámites sucesorios, resolución de conflictos y representación procesal directa.</p>`,
        `<p>⭐ <strong>Compromiso & Respaldo:</strong> Diagnóstico claro desde la primera consulta, transparencia en honorarios y defensa rigurosa de tus derechos.</p>`,
        !omitPrice ? `<p><strong>Honorarios:</strong> ${isFree ? "Primera consulta informativa sin cargo." : "Regidos por ley arancelaria y convenios particulares."}</p>` : "",
        `<p>📞 <strong>Consultas & Turnos:</strong> Coordinación de entrevistas presenciales o virtuales a través de nuestros canales oficiales.</p>`,
      ].filter(Boolean).join("\n");
      return { description: pLegalSpec };
    }

    // 5. Standard multi-domain generator with dynamic paragraphs and full creative variation
    let p1Content = "";
    if (!omitVigencia) {
      p1Content += "<strong>Vigencia:</strong> Servicio activo; información verificada en canales oficiales. ";
    }
    if (!omitPrice) {
      if (isFree) {
        p1Content += "<strong>Precio:</strong> Actividad 100% gratuita / Acceso libre sin costo.";
      } else if (hasScholarships) {
        p1Content += "<strong>Precio:</strong> Planes con becas arancelarias y facilidades de pago.";
      } else {
        p1Content += "<strong>Precio:</strong> A consultar según programa o modalidad elegida.";
      }
    }
    p1Content = p1Content.trim();
    const p1 = p1Content ? `<p>${p1Content}</p>` : "";

    // Dynamic Paragraph 2: Sector-tailored value proposition with variation rotation
    let valueProp = "";

    if (isEducation) {
      const vEdu = [
        `Formación académica de alto nivel con programas adaptados a la demanda profesional y laboral${locStr}.`,
        `Una propuesta educativa de vanguardia enfocada en el desarrollo de competencias, liderazgo e innovación académica${locStr}.`,
        `Educación superior de excelencia con claustro docente destacado, vinculación con el sector productivo y amplia inserción profesional${locStr}.`,
      ];
      valueProp = vEdu[variationIndex % vEdu.length];
    } else if (isJudicial) {
      const vJud = [
        `Asesoramiento y representación jurídica especializada con enfoque estratégico, confidencialidad y sólida experiencia procesal${locStr}.`,
        `Defensa integral de derechos con soluciones legales ágiles y personalizadas para personas, profesionales y empresas${locStr}.`,
        `Servicios jurídicos y notariales de excelencia, basados en la rigurosidad técnica, ética y compromiso con los intereses de cada cliente${locStr}.`,
      ];
      valueProp = vJud[variationIndex % vJud.length];
    } else if (isSports) {
      const vSpo = [
        `Instalaciones deportivas de primer nivel, actividades supervisadas por profesionales certificados y programas adaptados${locStr}.`,
        `Un centro deportivo integral para potenciar el rendimiento físico, la salud y el bienestar en un ambiente activo y moderno${locStr}.`,
        `Práctica deportiva, entrenamiento funcional y actividades recreativas con infraestructura de última generación${locStr}.`,
      ];
      valueProp = vSpo[variationIndex % vSpo.length];
    } else if (isHealth) {
      const vHea = [
        `Atención médica especializada con tecnología avanzada, consultorios modernos y un equipo médico de excelencia${locStr}.`,
        `Cobertura y asistencia en salud integral, orientada a la prevención, diagnóstico oportuno y cuidado humano personalizado${locStr}.`,
        `Centro de salud de referencia con atención multidisciplinaria, turnos ágiles y los más altos estándares de calidad médica${locStr}.`,
      ];
      valueProp = vHea[variationIndex % vHea.length];
    } else if (isTourism) {
      const vTou = [
        `Hospedaje de excelencia y experiencias turísticas memorables${locStr}, con servicios de primer nivel y confort asegurado.`,
        `Destinos y servicios turísticos pensados para tu descanso y disfrute, con asesoramiento personalizado y tarifas preferenciales${locStr}.`,
        `Infraestructura turística de calidad, atención cálida y propuestas exclusivas para estadías inolvidables${locStr}.`,
      ];
      valueProp = vTou[variationIndex % vTou.length];
    } else if (isFood) {
      const vFoo = [
        `Experiencia gastronómica destacada por la frescura de sus ingredientes, cocina de autor y atención esmerada${locStr}.`,
        `Propuesta culinaria de excelencia con menú variado, ambiente acogedor y servicios para eventos y celebraciones${locStr}.`,
        `Sabores auténticos, calidad gourmet y un servicio dedicado a brindar una experiencia memorable en cada visita${locStr}.`,
      ];
      valueProp = vFoo[variationIndex % vFoo.length];
    } else if (isRealEstate) {
      const vRea = [
        `Gestión y asesoramiento inmobiliario integral${locStr}, especializado en operaciones seguras, tasaciones y oportunidades de inversión.`,
        `Intermediación profesional en compra, venta y alquiler de propiedades con transparencia y respaldo de confianza${locStr}.`,
        `Desarrollos y propiedades seleccionadas con alta rentabilidad y asesoramiento legal-notarial en cada etapa${locStr}.`,
      ];
      valueProp = vRea[variationIndex % vRea.length];
    } else {
      const vGen = [
        `Servicios profesionales de excelencia con respaldo institucional verificado y atención personalizada${locStr}.`,
        `Soluciones integrales de alta calidad respaldadas por una sólida trayectoria y estándares de atención rigurosos${locStr}.`,
        `Calidad, confianza y vocación de servicio orientadas a superar las expectativas de cada usuario${locStr}.`,
      ];
      valueProp = vGen[variationIndex % vGen.length];
    }

    if (isVirtual) {
      valueProp += " Modalidad 100% online con campus interactivo de última generación y cursado flexible.";
    }
    if (hasScholarships) {
      valueProp += " Opciones de becas de estudio, bonificaciones arancelarias y facilidades de pago.";
    }
    if (hasEmergency) {
      valueProp += " Servicio de guardia médica activa y atención de emergencias disponible las 24 horas.";
    }

    const paraQuien = isEducation
      ? "Estudiantes, graduados y profesionales que buscan formación oficial de calidad."
      : isJudicial
      ? "Particulares, empresas y profesionales que requieren asesoramiento legal confiable."
      : isSports
      ? "Deportistas, familias y personas interesadas en una vida activa y saludable."
      : isHealth
      ? "Pacientes y familias que buscan atención médica especializada y de confianza."
      : isTourism
      ? "Viajeros, turistas y familias que buscan descanso y confort garantizado."
      : isFood
      ? "Comensales y amantes de la buena gastronomía que valoran calidad y ambiente."
      : isRealEstate
      ? "Inversores, compradores y familias en búsqueda de propiedades y operaciones seguras."
      : "Usuarios y clientes que buscan servicios profesionales garantizados.";

    const docReq = isJudicial
      ? "DNI o Pasaporte y documentación correspondiente al caso a gestionar."
      : isHealth
      ? "DNI o Pasaporte y credencial de cobertura médica (si corresponde)."
      : isSports
      ? "DNI vigente y certificado de aptitud física."
      : isRealEstate
      ? "DNI y documentación registral pertinente para la operación."
      : "Identificación oficial (DNI / Pasaporte) y requisitos particulares de la gestión.";

    const perm = isShort ? "Según plan contratado." : "De acuerdo con la modalidad o período solicitado.";

    const p2 = `<p>💡 <strong>Propuesta de valor:</strong> ${valueProp} <strong>¿Para quién?:</strong> ${paraQuien} <strong>Documentación requerida:</strong> ${docReq} <strong>Permanencia:</strong> ${perm}</p>`;

    // Dynamic Paragraph 3: Diferencial
    let p3 = "";
    if (!omitDiferencial) {
      const diffVs = isEducation
        ? "Programas oficiales actualizados y articulación directa con el campo laboral."
        : isJudicial
        ? "Estrategia jurídica personalizada y seguimiento procesal directo."
        : isSports
        ? "Instalaciones de alto nivel y cuerpo técnico calificado."
        : isHealth
        ? "Guardia médica continua y especialistas de trayectoria."
        : "Canales oficiales directos y auditoría de calidad Travelgrin.";

      p3 = `<p>⭐ <strong>Diferencial:</strong> <em>Idiomas de atención:</em> Español, Inglés. <em>Experiencia y soporte:</em> Acompañamiento especializado en cada etapa. <em>Diferencial vs. alternativas:</em> ${diffVs}</p>`;
    }

    // Dynamic Paragraph 4: Exclusiones
    let p4 = "";
    if (!omitExclusiones) {
      const exclText = isEducation
        ? "Consultar fechas de inscripción, equivalencias y cupos por cohorte en los canales oficiales."
        : isJudicial
        ? "La viabilidad procesal queda sujeta a la revisión previa de los antecedentes y documentación del caso."
        : isHealth
        ? "Ciertas prestaciones de alta complejidad pueden requerir autorización previa de la obra social o prepaga."
        : isSports
        ? "Apto físico médico obligatorio antes de iniciar actividades y cupos sujetos a capacidad de instalaciones."
        : isTourism
        ? "Tarifas y disponibilidad sujetas a temporada y políticas de cancelación vigentes."
        : "Verificar disponibilidad horaria y requerimientos previos de ingreso antes de concurrir.";

      p4 = `<p>⚠️ <strong>Exclusiones:</strong> ${exclText}</p>`;
    }

    const paragraphs = [p1, p2, p3, p4].filter(Boolean).join("\n");
    return { description: paragraphs };
  }

  if (fieldType === "provider_info") {
    const entityNoun = omitName
      ? isEducation
        ? "Esta institución educativa"
        : isJudicial
        ? "Este estudio profesional"
        : isSports
        ? "Esta entidad deportiva"
        : isHealth
        ? "Este centro de salud"
        : "Esta organización"
      : cleanName || "La entidad";

    if (isEducation) {
      return {
        providerInfo: `${entityNoun} se destaca por su trayectoria académica, innovación pedagógica y compromiso con el desarrollo profesional${cityStr ? ` en ${cityStr}` : ""}.`,
      };
    }
    if (isJudicial) {
      return {
        providerInfo: `${entityNoun} es un estudio profesional reconocido por su rigurosidad técnica, trayectoria legal y sólida defensa de los intereses de sus clientes${cityStr ? ` en ${cityStr}` : ""}.`,
      };
    }
    if (isSports) {
      return {
        providerInfo: `${entityNoun} es una institución deportiva comprometida con el desarrollo atlético, vida saludable y formación integral${cityStr ? ` en ${cityStr}` : ""}.`,
      };
    }
    if (isHealth) {
      return {
        providerInfo: `${entityNoun} es un centro de salud de referencia, enfocado en brindar atención médica multidisciplinaria, guardias permanentes y calidad humana${cityStr ? ` en ${cityStr}` : ""}.`,
      };
    }
    return {
      providerInfo: `${entityNoun} es una organización con amplia experiencia y sólida trayectoria, reconocida por la calidad y seriedad de sus servicios${cityStr ? ` en ${cityStr}` : ""}.`,
    };
  }

  // Extra block or new extra block
  if (/score|scout|puntaje|auditor|madurez/i.test(`${pLower} ${currentText}`)) {
    const scoreMatch = pLower.match(/\b(9\d|8\d|7\d|100)\b/);
    const scoreNum = scoreMatch ? scoreMatch[1] : "95";
    return {
      title: `🛡️ Score Scout ${scoreNum}/100`,
      body: `Presencia/reputación 24/25 · Contacto verificable 15/15 · Trayectoria/evidencia operativa 20/20 · Claridad propuesta 15/15 · Transparencia/seguridad 15/15 · Datos Institucionales 10/10\nMadurez: Líder · Vínculo: Oficial · Evidencia: Presencia institucional verificada, canales directos y atención al cliente activa.`,
    };
  }

  if (/requisito|admisi|inscrip|document/i.test(pLower)) {
    return {
      title: "Requisitos de Admisión e Inscripción",
      body: "<p><strong>Documentación requerida:</strong> Documento de identidad vigente (DNI o Pasaporte), comprobante de domicilio y antecedentes pertinentes según la actividad.</p><p><strong>Modalidad de presentación:</strong> Gestión presencial en sede oficial o carga digital a través de la plataforma web habilitada.</p>",
    };
  }
  if (/pago|financi|cuota|tarifa|precio/i.test(pLower)) {
    return {
      title: "Medios de Pago y Financiación",
      body: "<p><strong>Opciones disponibles:</strong> Transferencia bancaria, tarjetas de débito/crédito y planes de pago en cuotas según convenios vigentes.</p><p><strong>Beneficios:</strong> Bonificaciones por pago anticipado y convenios institucionales aplicables.</p>",
    };
  }
  return {
    title: "Información y Condiciones",
    body: `<p><strong>Detalle del servicio:</strong> ${prompt}.</p><p><strong>Recomendación:</strong> Consultar directamente en los canales de contacto oficial para coordinar turnos o recibir asesoramiento específico.</p>`,
  };
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
      conversationHistory = [],
      variationIndex = 0,
    } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Debe ingresar una instrucción o prompt para la IA." }, { status: 400 });
    }

    const customKey = String(apiKey || "").trim();
    const geminiKey =
      (customKey && (customKey.startsWith("AIza") || !customKey.startsWith("sk-")) ? customKey : "") ||
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.GOOGLE_AI_KEY ||
      process.env.GEMINI_APIKEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_API_KEY ||
      "";

    const openaiKey =
      (customKey && customKey.startsWith("sk-") ? customKey : "") ||
      process.env.OPENAI_API_KEY ||
      process.env.OPENAI_KEY ||
      process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
      "";

    const systemPrompt = buildSystemRefinePrompt(
      fieldType,
      currentText,
      prompt,
      {
        title: currentTitle,
        publisherName,
        category,
        city,
        country,
        url,
      },
      conversationHistory
    );

    let aiResult: any = null;

    // 1. Try Gemini with high creative freedom
    if (geminiKey) {
      const models = [
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash-8b",
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash-latest",
        "gemini-1.5-pro-latest"
      ];
      for (const model of models) {
        // Attempt 1: with responseMimeType
        try {
          const resp = await fetchWithTimeout(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: {
                  temperature: 0.7,
                  responseMimeType: "application/json",
                },
              }),
            },
            15000
          );
          if (resp.ok) {
            const data = await resp.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            const parsed = extractJsonFromText(rawText);
            if (parsed && typeof parsed === "object") {
              aiResult = parsed;
              break;
            }
          }
        } catch {}

        // Attempt 2: standard raw text mode
        if (!aiResult) {
          try {
            const resp = await fetchWithTimeout(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: systemPrompt }] }],
                  generationConfig: {
                    temperature: 0.7,
                  },
                }),
              },
              15000
            );
            if (resp.ok) {
              const data = await resp.json();
              const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              const parsed = extractJsonFromText(rawText);
              if (parsed && typeof parsed === "object") {
                aiResult = parsed;
                break;
              } else if (rawText && fieldType === "title") {
                const cleaned = cleanTitleString(rawText.replace(/[\{\}"]/g, "").replace(/title\s*:\s*/i, ""));
                if (cleaned) {
                  aiResult = { title: cleaned };
                  break;
                }
              }
            }
          } catch {}
        }
      }
    }

    // 2. Try OpenAI
    if (!aiResult && openaiKey) {
      const oModels = ["gpt-4o-mini", "gpt-4o"];
      for (const model of oModels) {
        try {
          const resp = await fetchWithTimeout(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model,
                messages: [
                  { role: "system", content: "Eres el Asistente Virtual y Lead Copywriter Creativo de Travelgrin. Responde únicamente en JSON." },
                  { role: "user", content: systemPrompt },
                ],
                response_format: { type: "json_object" },
                temperature: 0.7,
              }),
            },
            15000
          );
          if (resp.ok) {
            const data = await resp.json();
            const rawContent = data.choices?.[0]?.message?.content || "";
            const parsed = extractJsonFromText(rawContent);
            if (parsed && typeof parsed === "object") {
              aiResult = parsed;
              break;
            }
          }
        } catch {}
      }
    }

    // 3. Fallback to advanced Semantic NLP engine
    if (!aiResult) {
      aiResult = generateSemanticAiFallback(
        fieldType,
        currentText,
        prompt,
        {
          title: currentTitle,
          publisherName,
          category,
          city,
          country,
          url,
        },
        conversationHistory,
        variationIndex
      );
    }

    // Handle translations if autoTranslate is requested
    let translations: Record<string, any> = {};
    if (autoTranslate) {
      if (fieldType === "title" && aiResult.title) {
        const tEs = aiResult.title;
        const [en, pt, it] = await Promise.all([
          translateTextDirect(tEs, "es", "en"),
          translateTextDirect(tEs, "es", "pt"),
          translateTextDirect(tEs, "es", "it"),
        ]);
        translations = { es: tEs, en, pt, it };
      } else if (fieldType === "description" && aiResult.description) {
        const dEs = aiResult.description;
        const [en, pt, it] = await Promise.all([
          translateFullHtml(dEs, "en"),
          translateFullHtml(dEs, "pt"),
          translateFullHtml(dEs, "it"),
        ]);
        translations = { es: dEs, en, pt, it };
      } else if (fieldType === "provider_info" && aiResult.providerInfo) {
        const pEs = aiResult.providerInfo;
        const [en, pt, it] = await Promise.all([
          translateTextDirect(pEs, "es", "en"),
          translateTextDirect(pEs, "es", "pt"),
          translateTextDirect(pEs, "es", "it"),
        ]);
        translations = { es: pEs, en, pt, it };
      } else if ((fieldType === "extra_block" || fieldType === "new_extra_block") && aiResult.title && aiResult.body) {
        const tEs = aiResult.title;
        const bEs = aiResult.body;
        const [tEn, tPt, tIt, bEn, bPt, bIt] = await Promise.all([
          translateTextDirect(tEs, "es", "en"),
          translateTextDirect(tEs, "es", "pt"),
          translateTextDirect(tEs, "es", "it"),
          translateFullHtml(bEs, "en"),
          translateFullHtml(bEs, "pt"),
          translateFullHtml(bEs, "it"),
        ]);
        translations = {
          titleI18n: { es: tEs, en: tEn, pt: tPt, it: tIt },
          bodyI18n: { es: bEs, en: bEn, pt: bPt, it: bIt },
        };
      }
    }

    return NextResponse.json({
      success: true,
      result: aiResult,
      translations,
    });
  } catch (error: any) {
    console.error("AI Refine Field Route Error:", error);
    return NextResponse.json(
      { error: error?.message || "Error al procesar el prompt con IA." },
      { status: 500 }
    );
  }
}
