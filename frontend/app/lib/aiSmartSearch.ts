/**
 * AI Smart Search Engine for Travelgrin Frontend
 * Multi-layer hybrid NLP & LLM semantic query analyzer
 * Supports Gemini 2.0/1.5 Flash, OpenAI GPT-4o-mini/GPT-4o, and Zero-Latency Compound Disambiguation
 */

export interface ParsedSearchIntent {
  intent: "telephony" | "health" | "education" | "migration" | "housing" | "work" | "language" | "business" | "tourism" | "general";
  secondaryIntents?: string[];
  targetCategories: string[];
  targetSubcategories: string[];
  targetKeywords: string[];
  negativeKeywords: string[];
  targetLocation?: string | null;
  targetCountry?: string | null;
  targetCity?: string | null;
  targetPassport?: string | null;
  isPrestacionQuery?: boolean;
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
  // Spanish
  "estoy", "estas", "esta", "estamos", "estan", "busco", "buscando", "buscar", "buscamos", "buscan",
  "necesito", "necesitamos", "necesita", "necesitan", "quiero", "queremos", "quisiera", "quisieramos",
  "me", "te", "se", "nos", "les", "le", "mi", "tu", "su", "mis", "tus", "sus", "mio", "mia", "tuyo",
  "gustaria", "gustaría", "interesa", "interesaria", "interesaría", "ando", "andamos", "deseo", "deseamos",
  "esto", "esta", "este", "estos", "estas", "eso", "esa", "ese", "esos", "esas", "aquel", "aquello",
  "algo", "asi", "así", "tipo", "tal", "tales", "como", "cosa", "cosas", "tema", "temas", "servicio",
  "lugar", "lugares", "sitio", "sitios", "para", "por", "sobre", "entre", "hacia", "desde", "hasta",
  "sin", "tras", "durante", "mediante", "segun", "según", "contra",
  "un", "una", "unos", "unas", "el", "la", "los", "las", "lo", "al", "del", "de", "en", "a", "con",
  "que", "qué", "quien", "quién", "quienes", "quiénes", "cual", "cuál", "cuales", "cuáles",
  "donde", "dónde", "cuando", "cuándo", "como", "cómo", "cuanto", "cuánto", "cuanta", "cuánta",
  "y", "e", "o", "u", "pero", "sino", "mas", "más", "ademas", "además", "tambien", "también",
  "si", "no", "ni", "ya", "muy", "mucho", "mucha", "muchos", "muchas", "poco", "poca",
  "viaje", "viajes", "viajar", "viajero", "viajeros", "viajera", "viajeras",
  "hola", "buen", "buenos", "buenas", "dias", "tardes", "noches", "gracias", "porfavor", "favor",
  // English
  "i", "you", "we", "they", "he", "she", "it", "my", "your", "our", "their",
  "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "looking", "search", "searching", "find", "finding", "need", "needs", "want", "wants",
  "would", "like", "for", "to", "in", "at", "by", "from", "with", "about",
  "a", "an", "the", "this", "that", "some", "any", "something", "somewhere", "please", "help",
  // Portuguese
  "eu", "voce", "voces", "nos", "eles", "elas", "meu", "minha", "meus", "minhas",
  "estou", "procurando", "preciso", "quero", "gostaria", "para", "com", "em", "um", "uma",
  // Italian
  "io", "tu", "noi", "voi", "loro", "mio", "mia", "miei", "mie",
  "sto", "cercando", "cerco", "bisogno", "vorrei", "voglio", "per", "con", "in", "un", "una",
  // German
  "ich", "du", "wir", "sie", "mein", "meine", "suche", "mochte", "brauche", "will", "fur", "mit", "in",
  // French
  "je", "tu", "nous", "vous", "ils", "mon", "ma", "mes", "cherche", "veux", "besoin", "pour", "avec", "dans"
]);

// Worldwide and Regional Geographies Map
const KNOWN_LOCATIONS: Array<{
  names: string[];
  city?: string;
  country: string;
}> = [
  // Argentina & Provinces / Cities
  { names: ["mendoza"], city: "mendoza", country: "argentina" },
  { names: ["cordoba"], city: "cordoba", country: "argentina" },
  { names: ["buenos aires", "caba", "capital federal", "bs as"], city: "buenos aires", country: "argentina" },
  { names: ["rosario"], city: "rosario", country: "argentina" },
  { names: ["salta"], city: "salta", country: "argentina" },
  { names: ["bariloche", "san carlos de bariloche"], city: "bariloche", country: "argentina" },
  { names: ["la plata"], city: "la plata", country: "argentina" },
  { names: ["mar del plata"], city: "mar del plata", country: "argentina" },
  { names: ["san juan"], city: "san juan", country: "argentina" },
  { names: ["tucuman", "san miguel de tucuman"], city: "tucuman", country: "argentina" },
  { names: ["neuquen"], city: "neuquen", country: "argentina" },
  { names: ["santa fe"], city: "santa fe", country: "argentina" },
  { names: ["san luis"], city: "san luis", country: "argentina" },
  { names: ["jujuy", "san salvador de jujuy"], city: "jujuy", country: "argentina" },
  { names: ["corrientes"], city: "corrientes", country: "argentina" },
  { names: ["posadas", "misiones"], city: "posadas", country: "argentina" },
  { names: ["argentina", "argentine", "argentinien"], country: "argentina" },

  // Spain
  { names: ["madrid"], city: "madrid", country: "espana" },
  { names: ["barcelona"], city: "barcelona", country: "espana" },
  { names: ["valencia"], city: "valencia", country: "espana" },
  { names: ["sevilla"], city: "sevilla", country: "espana" },
  { names: ["malaga"], city: "malaga", country: "espana" },
  { names: ["bilbao"], city: "bilbao", country: "espana" },
  { names: ["granada"], city: "granada", country: "espana" },
  { names: ["salamanca"], city: "salamanca", country: "espana" },
  { names: ["espana", "spain", "spanien", "espagne", "espanha"], country: "espana" },

  // Italy
  { names: ["roma", "rome"], city: "roma", country: "italia" },
  { names: ["milan", "milano"], city: "milan", country: "italia" },
  { names: ["florencia", "florence", "firenze"], city: "florencia", country: "italia" },
  { names: ["bologna", "bolonia"], city: "bologna", country: "italia" },
  { names: ["turin", "torino"], city: "turin", country: "italia" },
  { names: ["napoles", "napoli", "naples"], city: "napoles", country: "italia" },
  { names: ["venecia", "venezia", "venice"], city: "venecia", country: "italia" },
  { names: ["italia", "italy", "italien", "italie"], country: "italia" },

  // Germany
  { names: ["berlin"], city: "berlin", country: "alemania" },
  { names: ["munich", "munchen"], city: "munich", country: "alemania" },
  { names: ["frankfurt"], city: "frankfurt", country: "alemania" },
  { names: ["hamburgo", "hamburg"], city: "hamburgo", country: "alemania" },
  { names: ["alemania", "germany", "deutschland", "allemagne", "alemanha"], country: "alemania" },

  // France
  { names: ["paris"], city: "paris", country: "francia" },
  { names: ["lyon"], city: "lyon", country: "francia" },
  { names: ["francia", "france", "frankreich"], country: "francia" },

  // Portugal
  { names: ["lisboa", "lisbon"], city: "lisboa", country: "portugal" },
  { names: ["porto", "oporto"], city: "porto", country: "portugal" },
  { names: ["portugal"], country: "portugal" },

  // Brazil
  { names: ["sao paulo", "san pablo"], city: "sao paulo", country: "brasil" },
  { names: ["rio de janeiro"], city: "rio de janeiro", country: "brasil" },
  { names: ["florianopolis", "floripa"], city: "florianopolis", country: "brasil" },
  { names: ["brasil", "brazil", "brasilien", "bresil"], country: "brasil" },

  // Americas
  { names: ["santiago", "santiago de chile"], city: "santiago", country: "chile" },
  { names: ["chile"], country: "chile" },
  { names: ["bogota"], city: "bogota", country: "colombia" },
  { names: ["medellin"], city: "medellin", country: "colombia" },
  { names: ["colombia"], country: "colombia" },
  { names: ["lima"], city: "lima", country: "peru" },
  { names: ["peru"], country: "peru" },
  { names: ["ciudad de mexico", "cdmx"], city: "ciudad de mexico", country: "mexico" },
  { names: ["mexico"], country: "mexico" },
  { names: ["montevideo"], city: "montevideo", country: "uruguay" },
  { names: ["uruguay"], country: "uruguay" },
  { names: ["miami"], city: "miami", country: "estados unidos" },
  { names: ["nueva york", "new york", "nyc"], city: "nueva york", country: "estados unidos" },
  { names: ["estados unidos", "usa", "eeuu", "united states"], country: "estados unidos" },
  { names: ["londres", "london"], city: "londres", country: "reino unido" },
  { names: ["reino unido", "uk", "england", "inglaterra"], country: "reino unido" },
];

export function extractLocationEntities(q: string): { country: string | null; city: string | null; location: string | null } {
  for (const loc of KNOWN_LOCATIONS) {
    for (const name of loc.names) {
      const regex = new RegExp(`\\b${name}\\b`, "i");
      if (regex.test(q)) {
        return {
          country: loc.country,
          city: loc.city || null,
          location: loc.city || loc.country,
        };
      }
    }
  }
  return { country: null, city: null, location: null };
}

export function extractPassportEntities(q: string): string | null {
  if (/(pasaporte\s+aleman|aleman|alemana|ciudadano\s+aleman|germany\s+passport|german)/i.test(q)) return "alemania";
  if (/(pasaporte\s+italiano|italiano|italiana|ciudadania\s+italiana|italian\s+passport)/i.test(q)) return "italia";
  if (/(pasaporte\s+espanol|espanol|espanola|spanish\s+passport)/i.test(q)) return "espana";
  if (/(pasaporte\s+argentino|argentino|argentina)/i.test(q)) return "argentina";
  if (/(pasaporte\s+brasileno|brasileno|brasileiro|brazilian\s+passport)/i.test(q)) return "brasil";
  if (/(pasaporte\s+chileno|chileno|chilena)/i.test(q)) return "chile";
  if (/(pasaporte\s+colombiano|colombiano|colombiana)/i.test(q)) return "colombia";
  if (/(pasaporte\s+peruano|peruano|peruana)/i.test(q)) return "peru";
  if (/(pasaporte\s+frances|frances|francesa|french\s+passport)/i.test(q)) return "francia";
  return null;
}

/**
 * Universal NLP Intent Analyzer (Tier 1 Offline Analyzer)
 * Covers extensive multilingual vocabulary for education, health, telephony, migration, housing, work, languages.
 */
export function parseContextualIntent(queryRaw: string): ParsedSearchIntent {
  const q = normalizeSearchText(queryRaw);
  const loc = extractLocationEntities(q);
  const passport = extractPassportEntities(q);

  const matchedCategories: string[] = [];
  const matchedSubcategories: string[] = [];
  const targetKeywords: string[] = [];
  const negativeKeywords: string[] = [];
  let primaryIntent: ParsedSearchIntent["intent"] = "general";
  let isPrestacion = false;

  // 1. Telephony, eSIM, Mobile Data & SIM Connectivity
  const isTelephony =
    /(movil|celular|telefono|telefonica|telefonia|esim|chip|sim\s*card|datos\s*moviles|roaming|internet\s*movil|linea\s*movil|conectividad|5g|4g|gigas|mobile\s*data|cellphone|scheda\s*sim|cartao\s*sim|dados\s*moveis|handytarif|sim\s*karte|forfait\s*mobile)/.test(q) ||
    (/(cobertura|plan|servicio|pack)/.test(q) && /(movil|celular|telefono|datos|chip|esim|sim)/.test(q));

  if (isTelephony) {
    primaryIntent = "telephony";
    isPrestacion = true;
    matchedCategories.push("telefonia e internet", "telefonia", "internet", "prestacion");
    matchedSubcategories.push("telefonia movil", "esim", "conectividad", "chip", "datos moviles");
    targetKeywords.push(
      "telefonia", "internet", "datos", "esim", "chip", "celular", "movil", "conectividad",
      "roaming", "linea", "telefonia e internet", "datos moviles", "sim", "sim card", "comunicacion"
    );
    negativeKeywords.push(
      "salud", "medicina", "obra social", "osep", "sanatorio", "clinica", "prepaga", "hospital",
      "doctor", "guardia", "consulta medica", "cobertura medica", "seguro de salud"
    );
  }

  // 2. Health, Medical & Life Insurance, Obra Social, Prepagas
  const isHealth =
    /(salud|medicina|medico|medica|hospital|clinica|sanatorio|obra\s*social|prepaga|osep|osde|swiss\s*medical|galeno|doctor|guardia|sanitaria|cobertura\s*medica|cobertura\s*salud|cobertura\s*de\s*vida|seguro\s*de\s*vida|seguro\s*medico|seguro\s*de\s*salud|seguro\s*de\s*viaje|asistencia\s*al\s*viajero|asistencia\s*medica|atencion\s*medica|farmacia|odontologia|psicologia|health\s*insurance|medical\s*coverage|life\s*insurance|sanita|assicurazione\s*sanitaria|plano\s*de\s*saude|krankenversicherung|mutuelle)/.test(q);

  if (isHealth) {
    if (primaryIntent === "general") primaryIntent = "health";
    matchedCategories.push("salud", "salud y bienestar", "medicina", "obra social", "prestacion", "atencion medica");
    matchedSubcategories.push("obra social", "prepaga", "seguro de salud", "cobertura medica", "seguro de vida", "asistencia medica");
    targetKeywords.push(
      "salud", "medicina", "medico", "medica", "hospital", "clinica", "sanatorio", "obra social",
      "prepaga", "osep", "osde", "atencion", "asistencia", "doctor", "guardia", "consulta",
      "seguro de vida", "cobertura medica", "cobertura de vida", "seguro medico", "seguro", "bienestar"
    );
    if (!isTelephony) {
      negativeKeywords.push("telefonia", "esim", "chip", "datos moviles", "celular", "linea movil");
    }
  }

  // 3. Education, Universities, Academic Degrees, Medicine & Specializations
  const isEducation =
    /(estudiar|estudio|estudios|estudiante|estudiantes|universidad|universidades|facultad|facultades|carrera|carreras|grado|licenciatura|posgrado|master|maestria|doctorado|academico|academica|formacion|instituto|colegio|escuela|study|studying|student|university|college|degree|universita|studente|laurea|faculdade|estudante|studieren|universitat|etudier|etudiant)/.test(q) ||
    (/(carrera|facultad|estudiar|universidad|carreras)/.test(q) && /(medicina|abogacia|derecho|ingenieria|arquitectura|psicologia|enfermeria|diseno|administracion|marketing|economia)/.test(q)) ||
    /(medicina|abogacia|ingenieria|licenciatura)/.test(q);

  if (isEducation) {
    if (primaryIntent === "general" || primaryIntent === "health") primaryIntent = "education";
    matchedCategories.push("educacion y centros de estudios", "universidad y posgrado", "educacion", "carreras");
    matchedSubcategories.push("universidades", "carreras de grado", "posgrado", "centros de estudio");
    targetKeywords.push(
      "educacion", "universidad", "estudios", "instituto", "facultad", "carrera", "carreras",
      "academico", "formacion", "licenciatura", "grado", "posgrado", "master", "maestria",
      "estudiante", "ingreso", "inscripcion", "siglo 21", "kennedy", "unc", "uba", "unam"
    );

    // Specific Career Enrichment
    if (/(medicina|medico|medica|ciencias\s*medicas|doctor|enfermeria|salud)/.test(q)) {
      matchedSubcategories.push("medicina", "ciencias medicas", "enfermeria");
      targetKeywords.push("medicina", "medico", "medica", "salud", "doctor", "ciencias medicas", "anatomia", "hospital escuela", "clinica");
    }
    if (/(abogacia|derecho|leyes|juridico)/.test(q)) {
      matchedSubcategories.push("abogacia", "derecho", "ciencias juridicas");
      targetKeywords.push("abogacia", "derecho", "leyes", "juridico", "abogado");
    }
    if (/(ingenieria|sistemas|software|programacion|informatica|civil|industrial)/.test(q)) {
      matchedSubcategories.push("ingenieria", "sistemas", "tecnologia");
      targetKeywords.push("ingenieria", "ingeniero", "sistemas", "software", "programacion", "tecnologia");
    }
  }

  // 4. Migration, Visas, Passports & Citizenship
  const isMigration =
    /(visa|visas|visado|visados|ciudadania|pasaporte|migratorio|migraciones|radicacion|residencia|consulado|embajada|abogado\s*migratorio|juridico|leyes|nacionalidad|dni|working\s*holiday|nomada\s*digital|visto|cittadinanza|cidadania|visum|staatsburgerschaft)/.test(q);

  if (isMigration) {
    if (primaryIntent === "general") primaryIntent = "migration";
    matchedCategories.push("gestiones migratorias y visas", "legal", "tramites");
    matchedSubcategories.push("visas", "ciudadania", "radicacion", "residencia", "tramites migratorios");
    targetKeywords.push(
      "visa", "visas", "visado", "ciudadania", "pasaporte", "migratorio", "migraciones",
      "radicacion", "residencia", "consulado", "embajada", "abogado", "legal", "juridico",
      "leyes", "tramite", "nacionalidad", "documentacion"
    );
  }

  // 5. Housing & Accommodation
  const isHousing =
    /(alojamiento|hospedaje|residencia\s*estudiantil|habitacion|cuarto|departamento|depto|hotel|hostel|alquiler|vivienda|piso|apartment|housing|accommodation|alloggio|affitto|aluguel|wohnung|unterkunft)/.test(q);

  if (isHousing) {
    if (primaryIntent === "general") primaryIntent = "housing";
    matchedCategories.push("alojamiento y vivienda", "hospedaje", "alquiler");
    matchedSubcategories.push("residencia estudiantil", "departamentos", "alquiler temporario", "hostels");
    targetKeywords.push(
      "alojamiento", "hospedaje", "hotel", "hostel", "residencia", "habitacion",
      "departamento", "depto", "alquiler", "estudiantes", "vivienda", "piso"
    );
  }

  // 6. Work & Internships
  const isWork =
    /(trabajo|empleo|pasantia|pasantias|practica|practicas|voluntariado|laboral|remunerado|sueldo|work|job|internship|volunteer|lavoro|stage|trabalho|estagio|arbeit|praktikum)/.test(q);

  if (isWork) {
    if (primaryIntent === "general") primaryIntent = "work";
    matchedCategories.push("trabajo y pasantias", "voluntariado", "empleo");
    matchedSubcategories.push("pasantias", "trabajo", "voluntariado");
    targetKeywords.push(
      "trabajo", "empleo", "pasantia", "voluntariado", "laboral", "voluntario",
      "ong", "social", "intercambio", "practica", "profesional", "remunerado"
    );
  }

  // 7. Languages
  const isLanguage =
    /(idioma|idiomas|ingles|english|italiano|portugues|aleman|frances|aprender\s*idioma|clases\s*de\s*ingles|curso\s*de\s*ingles|curso\s*de\s*italiano|toefl|ielts|dele|cils|language|sprachkurs)/.test(q);

  if (isLanguage) {
    if (primaryIntent === "general") primaryIntent = "language";
    matchedCategories.push("idiomas", "educacion y centros de estudios", "cursos");
    matchedSubcategories.push("clases de ingles", "clases de italiano", "cursos de idiomas");
    targetKeywords.push(
      "idioma", "idiomas", "ingles", "italiano", "portugues", "aleman", "frances",
      "curso", "aprender", "profesor", "clases", "toefl", "ielts", "cils"
    );
  }

  // 8. Business, Entrepreneurship & Companies
  const isBusiness = /(negocios|emprendimiento|empresa|inversion|sociedad|comercio|negocio|business|company)/.test(q);
  if (isBusiness) {
    if (primaryIntent === "general") primaryIntent = "business";
    matchedCategories.push("negocios y emprendimientos", "empresas", "emprendimientos");
    targetKeywords.push("negocios", "emprendimiento", "empresa", "inversion", "comercio", "startup");
  }

  // Fallback raw tokens
  const cleanTokens = q.split(/\s+/).filter((t) => t.length >= 2 && !CONVERSATIONAL_STOPWORDS.has(t));
  cleanTokens.forEach((token) => {
    if (!targetKeywords.includes(token)) targetKeywords.push(token);
  });

  return {
    intent: primaryIntent,
    targetCategories: Array.from(new Set(matchedCategories)),
    targetSubcategories: Array.from(new Set(matchedSubcategories)),
    targetKeywords: Array.from(new Set(targetKeywords)),
    negativeKeywords: Array.from(new Set(negativeKeywords)),
    targetLocation: loc.location,
    targetCountry: loc.country,
    targetCity: loc.city,
    targetPassport: passport,
    isPrestacionQuery: isPrestacion,
  };
}

/**
 * Universal Multilingual LLM Query Expander
 * Uses Gemini 2.0/1.5 Flash (via REST) or OpenAI GPT-4o-mini with local memory cache.
 */
export async function expandQueryWithAI(queryRaw: string, customApiKey?: string): Promise<ParsedSearchIntent> {
  const cleanQ = normalizeSearchText(queryRaw);
  if (!cleanQ) return parseContextualIntent(queryRaw);

  // 1. Check in-memory LRU cache
  const cached = AI_INTENT_CACHE.get(cleanQ);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.intent;
  }

  // 2. Base Tier-1 contextual NLP parsing
  const baseIntent = parseContextualIntent(queryRaw);

  // 3. Check for API keys
  const geminiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const openAiKey = customApiKey?.startsWith("sk-") ? customApiKey : process.env.OPENAI_API_KEY;

  if (!geminiKey && !openAiKey) {
    AI_INTENT_CACHE.set(cleanQ, { intent: baseIntent, timestamp: Date.now() });
    return baseIntent;
  }

  try {
    const systemPrompt = `You are the master intelligent search engine for Travelgrin, a global travel & relocation marketplace.
Marketplace Categories:
- "Educación y centros de estudios" (Universities, degrees, medicine, law, engineering, careers, student programs)
- "Telefonía e Internet" (eSIM, mobile data, SIM cards, chips, roaming, mobile coverage)
- "Salud y Bienestar" (Medical coverage, hospitals, clinics, OSEP, obra social, prepagas, life insurance, medical insurance)
- "Gestiones migratorias y visas" (Visas, citizenship, passports, residency, immigration lawyers)
- "Alojamiento y vivienda" (Student residences, apartments, flats, hotels, hostels, rentals)
- "Trabajo y pasantías" (Jobs, internships, volunteering, remunerated work)
- "Idiomas" (English, Italian, Spanish, language courses, language tests)
- "Negocios y emprendimientos" (Business, investments, companies)

Given the user query in ANY language: "${cleanQ}", parse the user's intent and extract entities.
Return ONLY a valid JSON object matching this schema:
{
  "intent": "telephony" | "health" | "education" | "migration" | "housing" | "work" | "language" | "business" | "tourism" | "general",
  "secondaryIntents": ["telephony", "health"],
  "targetCategories": ["Exact matching category names"],
  "targetSubcategories": ["Specific fields e.g. Medicina, Universidades, eSIM, Obra Social, etc."],
  "targetKeywords": ["Extensive list of Spanish keywords, synonyms, career branches, and related terms"],
  "negativeKeywords": ["Terms from conflicting verticals that must NOT be matched e.g. if telephony exclude obra social/hospital"],
  "targetCountry": "Argentina" | "España" | "Italia" | "Alemania" | null,
  "targetCity": "Mendoza" | "Córdoba" | "Buenos Aires" | "Madrid" | "Roma" | null,
  "targetPassport": "Alemania" | "Italia" | "España" | null,
  "isPrestacionQuery": true | false
}`;

    let parsed: any = null;

    if (geminiKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
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
      const timeoutId = setTimeout(() => controller.abort(), 2000);
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

    if (parsed) {
      const aiIntent: ParsedSearchIntent = {
        intent: parsed.intent || baseIntent.intent,
        secondaryIntents: Array.isArray(parsed.secondaryIntents) ? parsed.secondaryIntents : [],
        targetCategories: Array.from(new Set([
          ...baseIntent.targetCategories,
          ...(Array.isArray(parsed.targetCategories) ? parsed.targetCategories.map(normalizeSearchText) : [])
        ])),
        targetSubcategories: Array.from(new Set([
          ...baseIntent.targetSubcategories,
          ...(Array.isArray(parsed.targetSubcategories) ? parsed.targetSubcategories.map(normalizeSearchText) : [])
        ])),
        targetKeywords: Array.from(new Set([
          ...baseIntent.targetKeywords,
          ...(Array.isArray(parsed.targetKeywords) ? parsed.targetKeywords.map(normalizeSearchText) : [])
        ])),
        negativeKeywords: Array.from(new Set([
          ...baseIntent.negativeKeywords,
          ...(Array.isArray(parsed.negativeKeywords) ? parsed.negativeKeywords.map(normalizeSearchText) : [])
        ])),
        targetLocation: parsed.targetCity ? normalizeSearchText(parsed.targetCity) : (parsed.targetCountry ? normalizeSearchText(parsed.targetCountry) : baseIntent.targetLocation),
        targetCountry: parsed.targetCountry ? normalizeSearchText(parsed.targetCountry) : baseIntent.targetCountry,
        targetCity: parsed.targetCity ? normalizeSearchText(parsed.targetCity) : baseIntent.targetCity,
        targetPassport: parsed.targetPassport ? normalizeSearchText(parsed.targetPassport) : baseIntent.targetPassport,
        isPrestacionQuery: typeof parsed.isPrestacionQuery === "boolean" ? parsed.isPrestacionQuery : baseIntent.isPrestacionQuery,
      };
      AI_INTENT_CACHE.set(cleanQ, { intent: aiIntent, timestamp: Date.now() });
      return aiIntent;
    }
  } catch {
    // Graceful fallback to base contextual intent
  }

  AI_INTENT_CACHE.set(cleanQ, { intent: baseIntent, timestamp: Date.now() });
  return baseIntent;
}

/**
 * Universal Scoring function with Multi-dimensional Semantic Relevance,
 * Intent Disambiguation, Location Matching, and Prestaciones Routing.
 */
export function calculateSmartSearchScore(
  p: any,
  queryRaw: string,
  preParsedIntent?: ParsedSearchIntent | null
): number {
  const qClean = normalizeSearchText(queryRaw);
  if (!qClean) return 1;

  const rawTokens = qClean.split(/\s+/).filter(Boolean);
  if (!rawTokens.length) return 1;

  // 1. Get parsed semantic intent
  const intent = preParsedIntent || parseContextualIntent(queryRaw);

  // Extract all target fields from the publication
  const fields = ((p as any)?.fields ?? {}) as Record<string, unknown>;
  const titleI18nValues = Object.values((p as any).titleI18n ?? {}).map(String);
  const descI18nValues = Object.values((p as any).descriptionI18n ?? {}).map(String);
  const catI18nValues = Object.values((p as any).categoryI18n ?? {}).map(String);
  const subcatI18nValues = Object.values((p as any).subcategoryI18n ?? {}).map(String);

  const titleText = normalizeSearchText([p.title, ...titleI18nValues].filter(Boolean).join(" "));
  const publisherText = normalizeSearchText((p as any).publisherName || "");
  const categoryText = normalizeSearchText([
    p.category,
    ...catI18nValues,
    p.subcategory,
    ...subcatI18nValues,
    (p as any).primaryGroupKey
  ].filter(Boolean).join(" "));

  const travelDestinations = Array.isArray(fields.travelDestinations) ? fields.travelDestinations : [];
  const headquarterLocations = Array.isArray(fields.headquarterLocations) ? fields.headquarterLocations : [];
  const destinationCountries = Array.isArray(fields.destinationCountries) ? fields.destinationCountries : [];
  const locationText = normalizeSearchText([
    p.country,
    p.city,
    ...destinationCountries,
    ...travelDestinations.flatMap((d: any) => [d?.country, d?.city]),
    ...headquarterLocations.flatMap((d: any) => [d?.country, d?.city]),
  ].filter(Boolean).join(" "));

  const descText = normalizeSearchText([p.description, ...descI18nValues].filter(Boolean).join(" "));

  const filterOptionLabels = (p.filterOptions ?? []).flatMap((entry: any) => [
    String(entry?.filterOption?.label ?? ""),
    String(entry?.filterOption?.value ?? ""),
    String(entry?.filterOption?.group?.label ?? ""),
    String(entry?.filterOption?.group?.key ?? ""),
    ...Object.values(entry?.filterOption?.labelI18n ?? {}).map(String),
  ]);
  const categorySelections = Array.isArray(fields.categorySelections) ? fields.categorySelections : [];
  const subcategorySelections = Array.isArray(fields.subcategorySelections) ? fields.subcategorySelections : [];
  const prestacionesList = Array.isArray(fields.prestaciones) ? fields.prestaciones : [];
  const extraDescriptions = Array.isArray(fields.extraDescriptions) ? fields.extraDescriptions.flatMap((e: any) => [e?.title, e?.body]) : [];

  const tagsText = normalizeSearchText([
    ...filterOptionLabels,
    ...categorySelections,
    ...subcategorySelections,
    ...prestacionesList,
    ...extraDescriptions,
  ].filter(Boolean).join(" "));

  const isPrestacionItem = (p as any).primaryGroupKey === "prestacion" || tagsText.includes("prestacion") || categoryText.includes("prestacion");
  const fullHaystack = `${titleText} ${publisherText} ${categoryText} ${locationText} ${descText} ${tagsText}`;

  // 2. Disambiguation Negative Conflict Check
  if (intent.negativeKeywords.length > 0) {
    let hasNegativeConflict = false;
    for (const neg of intent.negativeKeywords) {
      if (titleText.includes(neg) || categoryText.includes(neg) || publisherText.includes(neg)) {
        hasNegativeConflict = true;
        break;
      }
    }
    // If the publication conflicts and has NO direct positive keyword matches, drop score to 0
    if (hasNegativeConflict) {
      const hasDirectPositive = intent.targetKeywords.some((pos) => fullHaystack.includes(pos));
      if (!hasDirectPositive) {
        return 0;
      }
    }
  }

  let score = 0;

  // 3. Exact full query phrase match bonus
  if (fullHaystack.includes(qClean)) {
    score += 300;
    if (titleText.includes(qClean)) score += 200;
    if (publisherText.includes(qClean)) score += 150;
    if (categoryText.includes(qClean)) score += 120;
  }

  // 4. Category & Subcategory Semantic Intent Match
  if (intent.targetCategories.length > 0) {
    for (const targetCat of intent.targetCategories) {
      if (categoryText.includes(targetCat) || tagsText.includes(targetCat)) {
        score += 250;
        break;
      }
    }
  }

  if (intent.targetSubcategories && intent.targetSubcategories.length > 0) {
    for (const targetSub of intent.targetSubcategories) {
      if (categoryText.includes(targetSub) || tagsText.includes(targetSub) || titleText.includes(targetSub)) {
        score += 180;
        break;
      }
    }
  }

  // 5. Geographic Entity Match
  if (intent.targetCity) {
    const cityMatches = locationText.includes(intent.targetCity);
    if (cityMatches) {
      score += 350;
    }
  } else if (intent.targetCountry) {
    const countryMatches = locationText.includes(intent.targetCountry);
    if (countryMatches) {
      score += 250;
    }
  } else if (intent.targetLocation) {
    if (locationText.includes(intent.targetLocation)) {
      score += 200;
    }
  }

  // 6. Prestaciones Specific Routing
  if (intent.isPrestacionQuery || intent.intent === "telephony") {
    if (isPrestacionItem) {
      score += 400;
    }
  }

  // 7. Meaningful tokens + target intent keywords scoring
  const searchTokens = Array.from(new Set([
    ...rawTokens.filter((t) => t.length >= 2 && !CONVERSATIONAL_STOPWORDS.has(t)),
    ...intent.targetKeywords,
  ]));

  let matchedCount = 0;

  for (const token of searchTokens) {
    let tokenScore = 0;

    if (titleText.includes(token)) tokenScore += 60;
    if (publisherText.includes(token)) tokenScore += 50;
    if (categoryText.includes(token)) tokenScore += 45;
    if (tagsText.includes(token)) tokenScore += 40;
    if (locationText.includes(token)) tokenScore += 30;
    if (descText.includes(token)) tokenScore += 15;

    if (tokenScore > 0) {
      matchedCount++;
      score += tokenScore;
    }
  }

  // Multi-term synergy bonus
  if (matchedCount > 1) {
    score += matchedCount * 30;
  }

  return score;
}
