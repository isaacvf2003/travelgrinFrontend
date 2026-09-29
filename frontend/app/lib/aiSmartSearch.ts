/**
 * AI Smart Search Engine for Travelgrin
 * Multi-layer hybrid NLP & LLM semantic query analyzer
 * Supports Gemini 2.0/1.5 Flash, OpenAI GPT-4o-mini/GPT-4o, and Zero-Latency Compound Disambiguation
 */

export interface ParsedSearchIntent {
  intent: "telephony" | "health" | "education" | "migration" | "housing" | "work" | "language" | "general";
  targetCategories: string[];
  targetKeywords: string[];
  negativeKeywords: string[];
  targetLocation?: string | null;
}

// In-Memory LRU Cache for AI query interpretations (24-hour TTL)
const AI_INTENT_CACHE = new Map<string, { intent: ParsedSearchIntent; timestamp: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeSearchText(input: unknown): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const CONVERSATIONAL_STOPWORDS = new Set([
  "estoy", "estas", "esta", "estamos", "estan", "busco", "buscando", "buscar", "buscamos", "buscan",
  "necesito", "necesitamos", "necesita", "necesitan", "quiero", "queremos", "quisiera", "quisieramos",
  "me", "te", "se", "nos", "les", "le", "mi", "tu", "su", "mis", "tus", "sus", "mio", "mia", "tuyo",
  "gustaria", "gustaría", "interesa", "interesaria", "interesaría", "ando", "andamos",
  "esto", "esta", "este", "estos", "estas", "eso", "esa", "ese", "esos", "esas", "aquel", "aquello",
  "algo", "asi", "así", "tipo", "tal", "tales", "como", "cosa", "cosas", "tema", "temas",
  "lugar", "lugares", "sitio", "sitios", "para", "por", "sobre", "entre", "hacia", "desde", "hasta",
  "sin", "tras", "durante", "mediante", "segun", "según", "contra",
  "un", "una", "unos", "unas", "el", "la", "los", "las", "lo", "al", "del", "de", "en", "a", "con",
  "que", "qué", "quien", "quién", "quienes", "quiénes", "cual", "cuál", "cuales", "cuáles",
  "donde", "dónde", "cuando", "cuándo", "como", "cómo", "cuanto", "cuánto", "cuanta", "cuánta",
  "y", "e", "o", "u", "pero", "sino", "mas", "más", "ademas", "además", "tambien", "también",
  "si", "no", "ni", "ya", "muy", "mucho", "mucha", "muchos", "muchas", "poco", "poca",
  "viaje", "viajes", "viajar", "viajero", "viajeros", "viajera",
  "i", "you", "we", "they", "he", "she", "it", "my", "your", "our", "their",
  "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "looking", "search", "searching", "find", "finding", "need", "needs", "want", "wants",
  "would", "like", "for", "to", "in", "at", "by", "from", "with", "about",
  "a", "an", "the", "this", "that", "some", "any", "something", "somewhere",
  "estou", "procurando", "preciso", "quero", "sto", "cercando", "cerco", "bisogno"
]);

/**
 * Contextual Compound Rules:
 * Disambiguates phrases like "cobertura para mi movil" (telephony) vs "cobertura medica" (health),
 * "curso de ingles" (languages) vs "carrera universitaria" (education), etc.
 */
export function parseContextualIntent(queryRaw: string): ParsedSearchIntent {
  const q = normalizeSearchText(queryRaw);

  // 1. Telephony, Cellular & Mobile Data ("cobertura para mi movil", "chip", "esim", "datos moviles", "celular")
  const isTelephony =
    /(movil|celular|telefono|telefonica|telefonia|esim|chip|datos moviles|roaming|sim card|internet movil|linea)/.test(q) ||
    (/(cobertura|plan|servicio)/.test(q) && /(movil|celular|telefono|datos|chip|esim)/.test(q));

  if (isTelephony) {
    return {
      intent: "telephony",
      targetCategories: ["telefonia e internet", "telefonia", "internet", "prestacion"],
      targetKeywords: ["telefonia", "internet", "datos", "esim", "chip", "celular", "movil", "conectividad", "roaming", "linea", "telefonia e internet", "datos moviles"],
      negativeKeywords: ["salud", "medicina", "obra social", "osep", "sanatorio", "clinica", "prepaga", "hospital", "doctor", "guardia", "consulta medica"],
      targetLocation: extractLocationFromQuery(q),
    };
  }

  // 2. Health & Medical ("obra social", "cobertura medica", "medico", "salud", "hospital", "osep", "clinica")
  const isHealth =
    /(salud|medicina|medico|medica|hospital|clinica|sanatorio|obra social|prepaga|osep|doctor|guardia|sanitaria|cobertura medica|cobertura salud|atencion medica)/.test(q);

  if (isHealth) {
    return {
      intent: "health",
      targetCategories: ["salud", "medicina", "obra social", "atencion medica"],
      targetKeywords: ["salud", "medicina", "medico", "medica", "hospital", "clinica", "sanatorio", "obra social", "prepaga", "osep", "atencion", "asistencia", "doctor", "guardia", "consulta"],
      negativeKeywords: ["telefonia", "esim", "chip", "datos moviles", "celular", "linea movil"],
      targetLocation: extractLocationFromQuery(q),
    };
  }

  // 3. Languages ("aprender ingles", "curso de italiano", "idiomas")
  const isLanguage =
    /(idioma|idiomas|ingles|english|italiano|portugues|aleman|frances|aprender idioma|clases de ingles|curso de ingles|curso de italiano)/.test(q);

  if (isLanguage) {
    return {
      intent: "language",
      targetCategories: ["idiomas", "educacion y centros de estudios", "cursos"],
      targetKeywords: ["idioma", "idiomas", "ingles", "italiano", "portugues", "aleman", "frances", "curso", "aprender", "profesor", "clases", "toefl", "ielts"],
      negativeKeywords: ["ingenieria", "posgrado", "maestria", "abogacia", "medicina"],
      targetLocation: extractLocationFromQuery(q),
    };
  }

  // 4. Education & Universities ("estudiar", "universidad", "carrera", "facultad", "ingenieria", "escuela", "colegio", "abogacia")
  const isEducation =
    /(estudiar|estudio|estudios|universidad|facultad|carrera|carreras|ingenieria|abogacia|psicologia|administracion|marketing|diseno|escuela|colegio|instituto|licenciatura|posgrado|master|maestria|grado|academico)/.test(q);

  if (isEducation) {
    return {
      intent: "education",
      targetCategories: ["educacion y centros de estudios", "universidad y posgrado", "educacion", "carreras"],
      targetKeywords: ["educacion", "universidad", "estudios", "instituto", "facultad", "carrera", "carreras", "academico", "formacion", "licenciatura", "grado", "posgrado", "master", "maestria", "siglo 21", "kennedy"],
      negativeKeywords: ["salud", "hospital", "osep", "obra social", "esim", "chip"],
      targetLocation: extractLocationFromQuery(q),
    };
  }

  // 5. Visas, Citizenship & Migration ("ciudadania", "visa", "pasaporte", "abogado migratorio", "radicacion")
  const isMigration =
    /(visa|visas|ciudadania|pasaporte|migratorio|migraciones|radicacion|residencia|consulado|embajada|abogado|juridico|leyes|nacionalidad)/.test(q);

  if (isMigration) {
    return {
      intent: "migration",
      targetCategories: ["gestiones migratorias y visas", "legal", "tramites"],
      targetKeywords: ["visa", "visas", "ciudadania", "pasaporte", "migratorio", "migraciones", "radicacion", "residencia", "consulado", "embajada", "abogado", "legal", "juridico", "leyes", "tramite"],
      negativeKeywords: ["salud", "hospital", "osep", "esim", "chip"],
      targetLocation: extractLocationFromQuery(q),
    };
  }

  // 6. Housing & Accommodation ("alojamiento", "hospedaje", "hotel", "hostel", "departamento", "depto", "alquiler")
  const isHousing =
    /(alojamiento|hospedaje|residencia estudiantil|habitacion|departamento|depto|hotel|hostel|alquiler|vivienda)/.test(q);

  if (isHousing) {
    return {
      intent: "housing",
      targetCategories: ["alojamiento y vivienda", "hospedaje", "alquiler"],
      targetKeywords: ["alojamiento", "hospedaje", "hotel", "hostel", "residencia", "habitacion", "departamento", "depto", "alquiler", "estudiantes", "vivienda"],
      negativeKeywords: ["salud", "hospital", "osep", "esim", "chip"],
      targetLocation: extractLocationFromQuery(q),
    };
  }

  // 7. Work & Internships ("trabajo", "empleo", "pasantia", "voluntariado", "laboral")
  const isWork =
    /(trabajo|empleo|pasantia|voluntariado|laboral|remunerado|work|internship)/.test(q);

  if (isWork) {
    return {
      intent: "work",
      targetCategories: ["trabajo y pasantias", "voluntariado", "empleo"],
      targetKeywords: ["trabajo", "empleo", "pasantia", "voluntariado", "laboral", "voluntario", "ong", "social", "intercambio", "practica"],
      negativeKeywords: ["salud", "hospital", "osep", "esim", "chip"],
      targetLocation: extractLocationFromQuery(q),
    };
  }

  // Default general intent
  return {
    intent: "general",
    targetCategories: [],
    targetKeywords: q.split(/\s+/).filter((t) => t.length >= 2 && !CONVERSATIONAL_STOPWORDS.has(t)),
    negativeKeywords: [],
    targetLocation: extractLocationFromQuery(q),
  };
}

function extractLocationFromQuery(q: string): string | null {
  if (/(mendoza)/.test(q)) return "mendoza";
  if (/(cordoba)/.test(q)) return "cordoba";
  if (/(buenos aires|caba)/.test(q)) return "buenos aires";
  if (/(argentina)/.test(q)) return "argentina";
  if (/(italia|roma|milan)/.test(q)) return "italia";
  if (/(espana|madrid|barcelona)/.test(q)) return "espana";
  return null;
}

/**
 * Optional LLM query expander using Gemini 2.0/1.5 Flash or OpenAI GPT-4o-mini.
 * Runs with a 1.2s timeout and caches results in memory for 0ms subsequent lookups.
 */
export async function expandQueryWithAI(queryRaw: string, customApiKey?: string): Promise<ParsedSearchIntent> {
  const cleanQ = normalizeSearchText(queryRaw);
  if (!cleanQ) return parseContextualIntent(queryRaw);

  // 1. Check in-memory cache
  const cached = AI_INTENT_CACHE.get(cleanQ);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.intent;
  }

  // 2. Base contextual parsing (Tier 1)
  const baseIntent = parseContextualIntent(queryRaw);

  // 3. Try LLM expansion if API key is present
  const geminiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const openAiKey = customApiKey?.startsWith("sk-") ? customApiKey : process.env.OPENAI_API_KEY;

  if (!geminiKey && !openAiKey) {
    AI_INTENT_CACHE.set(cleanQ, { intent: baseIntent, timestamp: Date.now() });
    return baseIntent;
  }

  try {
    const systemPrompt = `You are a search query intent parser for Travelgrin travel/relocation marketplace.
Available categories:
- "Telefonía e Internet" (eSIM, mobile data, SIM card, chip, roaming, phone coverage)
- "Salud y Bienestar" (Medical, hospitals, clinics, OSEP, obra social, medical coverage)
- "Educación y centros de estudios" (Universities, degrees, careers, courses)
- "Gestiones migratorias y visas" (Visas, citizenship, passports, legal, residency)
- "Alojamiento y vivienda" (Hotels, hostels, apartments, residences)
- "Trabajo y pasantías" (Jobs, internships, volunteering)
- "Idiomas" (English, Italian, language courses)

Given the user query: "${cleanQ}", return a valid JSON object ONLY with:
{
  "intent": "telephony" | "health" | "education" | "migration" | "housing" | "work" | "language" | "general",
  "targetCategories": ["exact matching categories"],
  "targetKeywords": ["specific semantic keywords in spanish"],
  "negativeKeywords": ["unrelated conflicting terms to exclude"],
  "targetLocation": "Country or City name if mentioned, else null"
}`;

    let parsed: any = null;

    if (geminiKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) parsed = JSON.parse(rawText);
        }
      } catch {
        clearTimeout(timeoutId);
      }
    }

    if (!parsed && openAiKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: systemPrompt }],
            response_format: { type: "json_object" },
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          const rawText = json?.choices?.[0]?.message?.content;
          if (rawText) parsed = JSON.parse(rawText);
        }
      } catch {
        clearTimeout(timeoutId);
      }
    }

    if (parsed && Array.isArray(parsed.targetKeywords) && parsed.targetKeywords.length > 0) {
      const aiIntent: ParsedSearchIntent = {
        intent: parsed.intent || baseIntent.intent,
        targetCategories: Array.isArray(parsed.targetCategories) ? parsed.targetCategories.map(normalizeSearchText) : baseIntent.targetCategories,
        targetKeywords: Array.from(new Set([...baseIntent.targetKeywords, ...parsed.targetKeywords.map(normalizeSearchText)])),
        negativeKeywords: Array.isArray(parsed.negativeKeywords) ? parsed.negativeKeywords.map(normalizeSearchText) : baseIntent.negativeKeywords,
        targetLocation: parsed.targetLocation ? normalizeSearchText(parsed.targetLocation) : baseIntent.targetLocation,
      };
      AI_INTENT_CACHE.set(cleanQ, { intent: aiIntent, timestamp: Date.now() });
      return aiIntent;
    }
  } catch (e) {
    // Graceful fallback to base contextual intent
  }

  AI_INTENT_CACHE.set(cleanQ, { intent: baseIntent, timestamp: Date.now() });
  return baseIntent;
}

/**
 * Universal Scoring function with Context Disambiguation & Negative Penalties
 */
export function calculateSmartSearchScore(p: any, queryRaw: string, customApiKey?: string): number {
  const qClean = normalizeSearchText(queryRaw);
  if (!qClean) return 1;

  const rawTokens = qClean.split(/\s+/).filter(Boolean);
  if (!rawTokens.length) return 1;

  // 1. Get parsed semantic intent (with context-aware disambiguation)
  const intent = parseContextualIntent(queryRaw);

  // Extract target fields
  const fields = ((p as any)?.fields ?? {}) as Record<string, unknown>;
  const titleI18nValues = Object.values((p as any).titleI18n ?? {}).map(String);
  const descI18nValues = Object.values((p as any).descriptionI18n ?? {}).map(String);
  const catI18nValues = Object.values((p as any).categoryI18n ?? {}).map(String);
  const subcatI18nValues = Object.values((p as any).subcategoryI18n ?? {}).map(String);

  const titleText = normalizeSearchText([p.title, ...titleI18nValues].filter(Boolean).join(" "));
  const publisherText = normalizeSearchText((p as any).publisherName || "");
  const categoryText = normalizeSearchText([p.category, ...catI18nValues, p.subcategory, ...subcatI18nValues, (p as any).primaryGroupKey].filter(Boolean).join(" "));
  
  const travelDestinations = Array.isArray(fields.travelDestinations) ? fields.travelDestinations : [];
  const headquarterLocations = Array.isArray(fields.headquarterLocations) ? fields.headquarterLocations : [];
  const locationText = normalizeSearchText([
    p.country,
    p.city,
    ...travelDestinations.flatMap((d: any) => [d?.country, d?.city]),
    ...headquarterLocations.flatMap((d: any) => [d?.country, d?.city]),
  ].filter(Boolean).join(" "));
  
  const descText = normalizeSearchText([p.description, ...descI18nValues].filter(Boolean).join(" "));

  const filterOptionLabels = (p.filterOptions ?? []).flatMap((entry: any) => [
    String(entry?.filterOption?.label ?? ""),
    String(entry?.filterOption?.value ?? ""),
    ...Object.values(entry?.filterOption?.labelI18n ?? {}).map(String),
  ]);
  const categorySelections = Array.isArray(fields.categorySelections) ? fields.categorySelections : [];
  const subcategorySelections = Array.isArray(fields.subcategorySelections) ? fields.subcategorySelections : [];
  const extraDescriptions = Array.isArray(fields.extraDescriptions) ? fields.extraDescriptions.flatMap((e: any) => [e?.title, e?.body]) : [];

  const tagsText = normalizeSearchText([
    ...filterOptionLabels,
    ...categorySelections,
    ...subcategorySelections,
    ...extraDescriptions,
  ].filter(Boolean).join(" "));

  const fullHaystack = `${titleText} ${publisherText} ${categoryText} ${locationText} ${descText} ${tagsText}`;

  // Check for negative keyword conflicts (Disambiguation penalty)
  if (intent.negativeKeywords.length > 0) {
    let hasNegativeConflict = false;
    for (const neg of intent.negativeKeywords) {
      if (titleText.includes(neg) || categoryText.includes(neg) || publisherText.includes(neg)) {
        hasNegativeConflict = true;
        break;
      }
    }
    // If the publication is in a conflicting vertical and has NO direct positive keyword matches, drop score to 0
    if (hasNegativeConflict) {
      const hasDirectPositive = intent.targetKeywords.some((pos) => fullHaystack.includes(pos));
      if (!hasDirectPositive) {
        return 0;
      }
    }
  }

  let score = 0;

  // 1. Exact full phrase match bonus
  if (fullHaystack.includes(qClean)) {
    score += 200;
    if (titleText.includes(qClean)) score += 160;
    if (publisherText.includes(qClean)) score += 120;
    if (categoryText.includes(qClean)) score += 100;
  }

  // 2. Category intent match
  if (intent.targetCategories.length > 0) {
    for (const targetCat of intent.targetCategories) {
      if (categoryText.includes(targetCat) || tagsText.includes(targetCat)) {
        score += 150;
        break;
      }
    }
  }

  // 3. Location match bonus if mentioned
  if (intent.targetLocation) {
    if (locationText.includes(intent.targetLocation)) {
      score += 80;
    }
  }

  // 4. Meaningful tokens + target intent keywords scoring
  const searchTokens = Array.from(new Set([...rawTokens.filter((t) => t.length >= 2 && !CONVERSATIONAL_STOPWORDS.has(t)), ...intent.targetKeywords]));
  let matchedCount = 0;

  for (const token of searchTokens) {
    let tokenScore = 0;

    if (titleText.includes(token)) tokenScore += 50;
    if (publisherText.includes(token)) tokenScore += 45;
    if (categoryText.includes(token)) tokenScore += 40;
    if (locationText.includes(token)) tokenScore += 30;
    if (tagsText.includes(token)) tokenScore += 25;
    if (descText.includes(token)) tokenScore += 15;

    if (tokenScore > 0) {
      matchedCount++;
      score += tokenScore;
    }
  }

  if (matchedCount > 1) {
    score += matchedCount * 25;
  }

  return score;
}
