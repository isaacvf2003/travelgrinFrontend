/**
 * Travelgrin AI Publication Agents Architecture
 * 
 * Hierarchy of Authority:
 * 1. Admin Custom Prompt (Primary Editorial Authority)
 * 2. Real Scraped Web Facts
 * 3. Technical System Rules (Valid JSON schema, safety)
 * 4. Internal Travelgrin Rules (Only when they DO NOT contradict the Admin prompt)
 * 
 * Rules:
 * - Pure technical SYSTEM prompts.
 * - Admin prompts are never altered, hidden or diluted.
 * - Provider chain: Gemini -> OpenAI -> Controlled Error (Zero invented filler content).
 * - Full debug logs tracing input -> prompt -> raw output -> normalized validation.
 */

export type I18nRecord = Record<string, string>;

function escapeRegExp(str: string): string {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function checkPromptOmitEntityName(prompt?: string): boolean {
  if (!prompt) return false;
  return /\b(?:que\s+no\s+(?:contenga|tenga|incluya|mencione|diga)|sin\s+(?:el\s+)?nombre|no\s+(?:incluir|poner|mencionar|usar|coloques?|pongas?)\s+(?:el\s+)?nombre|omitir\s+(?:el\s+)?nombre|omitiendo\s+(?:el\s+)?nombre|sin\s+(?:mencionar|nombrar)\s+(?:la\s+)?(?:instituci[oó]n|empresa|marca|entidad|oferente|universidad|hospital|colegio))\b/i.test(prompt);
}

export function cleanTitleOmitEntity(
  title: string,
  baseEntityName: string,
  publisherName?: string
): string {
  if (!title) return "";
  let res = title;

  const rawNames = [publisherName, baseEntityName]
    .filter(Boolean)
    .map((n) => n!.trim())
    .filter((n) => n.length >= 3);

  const namesToStrip: string[] = [];
  for (const n of rawNames) {
    if (!namesToStrip.includes(n)) namesToStrip.push(n);
    const withoutPrefix = n.replace(/^(?:universidad|instituto(?:\s+universitario)?|hospital|sanatorio|cl[ií]nica|colegio|fundaci[oó]n|asociaci[oó]n|empresa)\s+/i, "").trim();
    if (withoutPrefix && withoutPrefix.length >= 4 && !namesToStrip.includes(withoutPrefix)) {
      namesToStrip.push(withoutPrefix);
    }
  }

  namesToStrip.sort((a, b) => b.length - a.length);

  for (const name of namesToStrip) {
    const esc = escapeRegExp(name);

    // 1. Remove at beginning followed by delimiter: e.g. "Universidad Siglo 21 | ", "Universidad Siglo 21: "
    res = res.replace(new RegExp(`^${esc}\\s*[:|–—\\-•]\\s*`, "i"), "");

    // 2. Remove at ending preceded by delimiter: e.g. " | Universidad Siglo 21", " - Universidad Siglo 21"
    res = res.replace(new RegExp(`\\s*[:|–—\\-•]\\s*${esc}$`, "i"), "");

    // 3. Remove prepositional phrases: e.g. " en Universidad Siglo 21", " de Universidad Siglo 21"
    res = res.replace(new RegExp(`\\s+(?:en|de|del|para|por|con)\\s+${esc}\\b`, "gi"), "");

    // 4. Remove standalone occurrences
    res = res.replace(new RegExp(`\\b${esc}\\b`, "gi"), "");
  }

  res = res
    .replace(/^[\s:|–—\-•,;.]+/g, "")
    .replace(/[\s:|–—\-•,;.]+$/g, "")
    .replace(/\s*[:|–—\-•]\s*[:|–—\-•]\s*/g, " | ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return res;
}

export function extractRequestedCount(prompt?: string): number | null {
  if (!prompt) return null;
  const p = prompt.toLowerCase();
  const wordMap: Record<string, number> = {
    un: 1, una: 1, uno: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
  };
  const wordMatch = p.match(/\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*(?:preguntas?|faq|items?|puntos?|consultas?|p[aá]rrafos?)\b/i);
  if (wordMatch && wordMatch[1] && wordMap[wordMatch[1]]) {
    return wordMap[wordMatch[1]];
  }
  const digitMatch = p.match(/\b(\d+)\s*(?:preguntas?|faq|items?|puntos?|consultas?|p[aá]rrafos?)\b/i);
  if (digitMatch && digitMatch[1]) {
    return parseInt(digitMatch[1], 10);
  }
  const broadMatch = p.match(/\b(1\d|[1-9])\b/);
  if (broadMatch && broadMatch[1]) {
    return parseInt(broadMatch[1], 10);
  }
  return null;
}

export function detectPromptColors(prompt: string): { titleColor?: string; bodyColor?: string } {
  const p = (prompt || "").toLowerCase();
  let titleColor: string | undefined;
  let bodyColor: string | undefined;

  const colorMap: Record<string, string> = {
    azul: "#0066cc",
    azules: "#0066cc",
    celeste: "#0284c7",
    celestes: "#0284c7",
    rojo: "#dc2626",
    rojos: "#dc2626",
    roja: "#dc2626",
    rojas: "#dc2626",
    verde: "#16a34a",
    verdes: "#16a34a",
    violeta: "#9333ea",
    violetas: "#9333ea",
    morado: "#9333ea",
    morados: "#9333ea",
    púrpura: "#9333ea",
    purpura: "#9333ea",
    naranja: "#ea580c",
    naranjas: "#ea580c",
    amarillo: "#ca8a04",
    amarillos: "#ca8a04",
    amarilla: "#ca8a04",
    amarillas: "#ca8a04",
    dorado: "#d97706",
    dorados: "#d97706",
    dorada: "#d97706",
    doradas: "#d97706",
    negro: "#000000",
    negros: "#000000",
    negra: "#000000",
    negras: "#000000",
    gris: "#4b5563",
    grises: "#4b5563",
    blanco: "#ffffff",
    blancos: "#ffffff",
  };

  const COLOR_NAMES_PATTERN = "rojo|rojos|roja|rojas|azul|azules|celeste|celestes|verde|verdes|violeta|violetas|morado|morados|p[uú]rpura|purpura|naranja|naranjas|amarillo|amarillos|amarilla|amarillas|dorado|dorados|dorada|doradas|negro|negros|negra|negras|gris|grises|blanco|blancos";

  // Specific question/title target match:
  const titleColorMatch =
    p.match(new RegExp(`(?:preguntas?|t[ií]tulos?|subt[ií]tulos?)\\s+(?:en|de|con)?\\s*(?:color|letras?|texto)?\\s*(${COLOR_NAMES_PATTERN})`, "i")) ||
    p.match(new RegExp(`(?:letras?|texto)?\\s*(${COLOR_NAMES_PATTERN})\\s+(?:para|en)\\s+(?:las?\\s+preguntas?|el\\s+t[ií]tulo|los\\s+t[ií]tulos?|subt[ií]tulos?)`, "i")) ||
    p.match(new RegExp(`(?:en|de|con)\\s+(?:color\\s+)?(${COLOR_NAMES_PATTERN})\\s+(?:para\\s+)?(?:el\\s+t[ií]tulo|los\\s+t[ií]tulos?|las?\\s+preguntas?|subt[ií]tulos?)`, "i")) ||
    p.match(new RegExp(`(?:t[ií]tulos?|subt[ií]tulos?)\\s+en\\s+letras?\\s+(${COLOR_NAMES_PATTERN})`, "i"));

  if (titleColorMatch && titleColorMatch[1]) {
    titleColor = colorMap[titleColorMatch[1].toLowerCase()];
  }

  // Specific answer/body target match:
  const bodyColorMatch =
    p.match(new RegExp(`(?:respuestas?|su\\s+respuesta|cuerpo|texto|explicaci[oó]n)\\s+(?:en|de|con)?\\s*(?:color|letras?|texto)?\\s*(${COLOR_NAMES_PATTERN})`, "i")) ||
    p.match(new RegExp(`(?:letras?|texto)?\\s*(${COLOR_NAMES_PATTERN})\\s+(?:para|en)\\s+(?:las?\\s+respuestas?|el\\s+cuerpo|el\\s+texto|la\\s+explicaci[oó]n)`, "i")) ||
    p.match(new RegExp(`(?:en|de|con)\\s+(?:color\\s+)?(${COLOR_NAMES_PATTERN})\\s+(?:para\\s+)?(?:la\\s+respuesta|las?\\s+respuestas?|el\\s+texto|el\\s+cuerpo|la\\s+explicaci[oó]n)`, "i"));

  if (bodyColorMatch && bodyColorMatch[1]) {
    bodyColor = colorMap[bodyColorMatch[1].toLowerCase()];
  }

  // Fallback broad matching if not targeted:
  if (!titleColor) {
    if (/\b(?:de\s+)?azul(?:es)?\b|color\s+azul|en\s+azul|celeste/i.test(p)) titleColor = "#0066cc";
    else if (/\brojo[as]?\b|color\s+rojo|en\s+rojo/i.test(p)) titleColor = "#dc2626";
    else if (/\bamarill[oas]?\b|color\s+amarillo|en\s+amarillo|dorad[oas]?/i.test(p)) titleColor = "#ca8a04";
    else if (/\bverde[s]?\b|color\s+verde|en\s+verde/i.test(p)) titleColor = "#16a34a";
    else if (/\bvioleta[s]?\b|morado|p[uú]rpura/i.test(p)) titleColor = "#9333ea";
    else if (/\bnaranja\b/i.test(p)) titleColor = "#ea580c";
  }

  if (!bodyColor) {
    if (/(?:respuesta|texto|cuerpo|letras?)\s+(?:en\s+|de\s+)?negr[oas]+/i.test(p) || /\ben\s+negr[oas]+/i.test(p)) bodyColor = "#000000";
    else if (/(?:respuesta|texto)\s+(?:en\s+|de\s+)?azul/i.test(p)) bodyColor = "#0066cc";
    else if (/(?:respuesta|texto)\s+(?:en\s+|de\s+)?rojo/i.test(p)) bodyColor = "#dc2626";
    else if (/(?:respuesta|texto)\s+(?:en\s+|de\s+)?amarill[oas]/i.test(p)) bodyColor = "#ca8a04";
  }

  return { titleColor, bodyColor };
}

export function applyPromptColorStyles(html: string, prompt?: string): string {
  if (!html || !prompt) return html;
  const { titleColor, bodyColor } = detectPromptColors(prompt);
  if (!titleColor && !bodyColor) return html;

  let res = html;

  // 1. Title/Question/Heading Color Styling
  if (titleColor) {
    if (/<(strong|b)[\s>]/i.test(res)) {
      res = res.replace(/<(strong|b)(?:\s+style="([^"]*)")?>(.*?)<\/\1>/gi, (match, tag, existingStyle, content) => {
        const cleanStyle = (existingStyle || "").replace(/color\s*:\s*[^;]+;?/gi, "").trim();
        const newStyle = cleanStyle ? `color: ${titleColor}; ${cleanStyle}` : `color: ${titleColor};`;
        return `<${tag} style="${newStyle}">${content}</${tag}>`;
      });
    } else {
      res = res.replace(/(<p[^>]*>)?(¿[^?]+\?|(?:\d+\.|\*|-)?\s*[A-ZÁÉÍÓÚÑ][^?\n\r]+?\?)/gi, (match, pTag, question) => {
        return `${pTag || ""}<strong style="color: ${titleColor};">${question}</strong>`;
      });
    }
  }

  // 2. Body/Answer/Explanation Color Styling
  if (bodyColor) {
    if (/<br\s*\/?>/i.test(res)) {
      res = res.replace(/(<p[^>]*>[\s\S]*?<br\s*\/?>)([\s\S]*?)(<\/p>)/gi, (match, before, answer, after) => {
        const cleanAnswer = answer.replace(/<span\s+style="color\s*:\s*[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, "$1").trim();
        return `${before}<span style="color: ${bodyColor};">${cleanAnswer}</span>${after}`;
      });
    } else if (/<(?:strong|b)[\s>]/i.test(res)) {
      res = res.replace(/(<p[^>]*>[\s\S]*?<\/(?:strong|b)>)([\s\S]*?)(<\/p>)/gi, (match, before, answer, after) => {
        if (!answer.trim()) return match;
        const cleanAnswer = answer.replace(/<span\s+style="color\s*:\s*[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, "$1").trim();
        return `${before} <span style="color: ${bodyColor};">${cleanAnswer}</span>${after}`;
      });
    } else {
      res = res.replace(/(<p[^>]*>)([\s\S]*?)(<\/p>)/gi, (match, before, content, after) => {
        if (/<(?:strong|b)[^>]*>.*<\/(?:strong|b)>/i.test(content)) {
          return match;
        }
        return `${before}<span style="color: ${bodyColor};">${content}</span>${after}`;
      });
    }
  }

  return res;
}

export function enforceFaqCountAndFilter(html: string, prompt?: string): string {
  if (!html || !prompt) return html;
  const requestedCount = extractRequestedCount(prompt);
  if (!requestedCount || requestedCount <= 0) return html;

  const UI_TRASH_REGEX =
    /¿QUÉ ESTÁS BUSCANDO|¿En qué momento|¿Cuál va a ser tu próximo paso|¿Dónde querés estudiar|¿Buscás algo más|¿Tenés dudas\?|cookies|iniciar sesión|tipo de formación|de \d+ a \d+ años|elegir|registrate/i;

  const pBlocks = html.match(/<p[\s\S]*?<\/p>/gi) || [];
  if (pBlocks.length === 0) return html;

  const validBlocks: string[] = [];
  const seenQuestions = new Set<string>();

  for (const block of pBlocks) {
    if (UI_TRASH_REGEX.test(block)) continue;
    const qMatch = block.match(/¿[^?]+\?/);
    const qKey = qMatch ? qMatch[0].toLowerCase().replace(/[^a-záéíóúñ]/g, "") : "";
    if (qKey && seenQuestions.has(qKey)) continue;
    if (qKey) seenQuestions.add(qKey);
    validBlocks.push(block);
  }

  if (validBlocks.length > 0) {
    return validBlocks.slice(0, requestedCount).join("\n");
  }

  // Fallback: If all blocks matched UI_TRASH_REGEX, clean out the trash sentences and slice to requested count
  const sanitizedBlocks = pBlocks
    .map((b) => b.replace(UI_TRASH_REGEX, "").trim())
    .filter((b) => b.length > 15);

  if (sanitizedBlocks.length > 0) {
    return sanitizedBlocks.slice(0, requestedCount).join("\n");
  }

  return pBlocks.slice(0, requestedCount).join("\n");
}

export function extractParagraphCount(prompt?: string): number | null {
  if (!prompt) return null;
  const p = prompt.toLowerCase();
  const wordMap: Record<string, number> = {
    un: 1, una: 1, uno: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
  };
  const wordMatch = p.match(/\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*p[aá]rrafos?\b/i);
  if (wordMatch && wordMatch[1] && wordMap[wordMatch[1]]) {
    return wordMap[wordMatch[1]];
  }
  const digitMatch = p.match(/\b(\d+)\s*p[aá]rrafos?\b/i);
  if (digitMatch && digitMatch[1]) {
    return parseInt(digitMatch[1], 10);
  }
  return null;
}

export function enforceDescriptionParagraphCount(descHtml: string, prompt?: string): string {
  if (!descHtml) return "";
  const count = extractParagraphCount(prompt);
  let resHtml = descHtml;

  if (count && count > 0) {
    let paragraphs: string[] = Array.from(descHtml.match(/<p[\s\S]*?<\/p>/gi) || []);
    if (paragraphs.length === 0) {
      paragraphs = descHtml
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`);
    }

    if (paragraphs.length > count) {
      resHtml = paragraphs.slice(0, count).join("\n");
    } else if (paragraphs.length < count) {
      const result = [...paragraphs];
      while (result.length < count) {
        let longestIdx = 0;
        let maxLen = 0;
        result.forEach((p, idx) => {
          const len = p.replace(/<[^>]+>/g, "").length;
          if (len > maxLen) {
            maxLen = len;
            longestIdx = idx;
          }
        });

        if (maxLen < 60) break;

        const targetP = result[longestIdx];
        const innerContent = targetP.replace(/^<p[^>]*>|<\/p>$/gi, "").trim();
        const sentences = innerContent.split(/(?<=[.?!])\s+/);
        if (sentences.length >= 2) {
          const mid = Math.ceil(sentences.length / 2);
          const firstPart = sentences.slice(0, mid).join(" ");
          const secondPart = sentences.slice(mid).join(" ");
          result.splice(longestIdx, 1, `<p>${firstPart}</p>`, `<p>${secondPart}</p>`);
        } else {
          break;
        }
      }
      resHtml = result.slice(0, count).join("\n");
    } else {
      resHtml = paragraphs.join("\n");
    }
  }

  // Always enforce word limit across paragraphs
  return enforceParagraphWordLimit(resHtml, prompt);
}

export function extractParagraphWordLimit(prompt?: string): number | null {
  if (!prompt) return null;
  const p = prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const spanishWordNumberMap: Record<string, number> = {
    cinco: 5, diez: 10, quince: 15, veinte: 20, veinticinco: 25,
    treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60,
    setenta: 70, ochenta: 80, noventa: 90, cien: 100,
  };

  // 1. Explicit paragraph context pattern: "(con un / un)? (maximo / limite / hasta / tope / menos de / no mas de) X palabras (en / por / cada) parrafo"
  const pContextMatch =
    p.match(/\b(?:(?:con\s+)?(?:un\s+)?|de\s+)?(?:maximo(?:\s+de)?|limite(?:\s+de)?|hasta|tope(?:\s+de)?|menos(?:\s+de)?|no\s+mas\s+de)\s*(\d{1,3})\s*palabras?\s*(?:en\s+|por\s+)?(?:cada\s+)?p[aá]rrafo/i) ||
    p.match(/p[aá]rrafos?\s*(?:con\s+|de\s+)?(?:(?:un\s+)?(?:maximo(?:\s+de)?|limite(?:\s+de)?|hasta|tope(?:\s+de)?|menos(?:\s+de)?|no\s+mas\s+de))?\s*(\d{1,3})\s*palabras/i) ||
    p.match(/\b(\d{1,3})\s*palabras?\s*(?:como\s+|de\s+)?(?:maximo|limite|tope)?\s*(?:en\s+|por\s+)?(?:cada\s+)?p[aá]rrafo/i);

  if (pContextMatch && pContextMatch[1]) {
    const num = parseInt(pContextMatch[1], 10);
    if (num >= 5 && num <= 400) return num;
  }

  // 2. Word number with paragraph context: e.g. "cincuenta palabras en cada parrafo"
  const wordKeys = Object.keys(spanishWordNumberMap).join("|");
  const wordRegex = new RegExp(`\\b(?:(?:con\\s+)?(?:un\\s+)?|de\\s+)?(?:maximo(?:\\s+de)?|limite(?:\\s+de)?|hasta|tope(?:\\s+de)?|menos(?:\\s+de)?|de)?\\s*(${wordKeys})\\s*palabras?\\s*(?:en\\s+|por\\s+)?(?:cada\\s+)?p[aá]rrafo`, "i");
  const wordMatch = p.match(wordRegex);
  if (wordMatch && wordMatch[1]) {
    const num = spanishWordNumberMap[wordMatch[1].toLowerCase()];
    if (num) return num;
  }

  // 3. General word limit in prompt (e.g. "con un maximo de 50 palabras", "un limite de 50 palabras", "maximo 50 palabras"):
  const generalMatch =
    p.match(/\b(?:(?:con\s+)?(?:un\s+)?|de\s+)?(?:maximo(?:\s+de)?|limite(?:\s+de)?|hasta|tope(?:\s+de)?|menos(?:\s+de)?|no\s+mas\s+de)\s*(\d{1,3})\s*palabras?\b/i) ||
    p.match(/\b(\d{1,3})\s*palabras?\s*(?:como\s+|de\s+)?(?:maximo|limite|tope)\b/i);

  if (generalMatch && generalMatch[1]) {
    const num = parseInt(generalMatch[1], 10);
    if (num >= 5 && num <= 400) return num;
  }

  const generalWordRegex = new RegExp(`\\b(?:(?:con\\s+)?(?:un\\s+)?|de\\s+)?(?:maximo(?:\\s+de)?|limite(?:\\s+de)?|hasta|tope(?:\\s+de)?|menos(?:\\s+de)?|de)?\\s*(${wordKeys})\\s*palabras?\\b`, "i");
  const generalWordMatch = p.match(generalWordRegex);
  if (generalWordMatch && generalWordMatch[1]) {
    const num = spanishWordNumberMap[generalWordMatch[1].toLowerCase()];
    if (num) return num;
  }

  return null;
}

export function enforceParagraphWordLimit(html: string, prompt?: string): string {
  if (!html) return "";
  const maxWords = extractParagraphWordLimit(prompt);
  if (!maxWords || maxWords <= 0) return html;

  return html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
    // Check inner text words
    const plainText = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const words = plainText.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return match;

    // Check if there is a heading like <strong ...>...</strong> or <b ...>...</b> or <span ...>...</span>
    const headingMatch = inner.match(/^(\s*<(?:strong|b|span)(?:\s+style="[^"]*")?[^>]*>[\s\S]*?<\/(?:strong|b|span)>\s*[:\-–]?\s*)([\s\S]*)$/i);
    if (headingMatch) {
      const headingTag = headingMatch[1].trim();
      const headingPlain = headingTag.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const headingWordCount = headingPlain.split(/\s+/).filter(Boolean).length;
      const remainingWords = Math.max(3, maxWords - headingWordCount);

      const restPlain = headingMatch[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const restWords = restPlain.split(/\s+/).filter(Boolean);
      let trimmedRest = restWords.slice(0, remainingWords).join(" ");
      trimmedRest = trimmedRest
        .replace(/[\s,:;|\-–—.]+$/, "")
        .replace(/\b(?:y|e|o|u|de|del|en|con|para|por|a|al|sin|sobre|hacia|desde|hasta|un|una|el|la|los|las|sus|su)\s*$/i, "")
        .replace(/[\s,:;|\-–—.]+$/, "")
        .trim();
      if (trimmedRest && !trimmedRest.endsWith(".")) {
        trimmedRest += ".";
      }
      return `<p${attrs}>${headingTag} ${trimmedRest}</p>`;
    }

    let trimmed = words.slice(0, maxWords).join(" ");
    trimmed = trimmed
      .replace(/[\s,:;|\-–—.]+$/, "")
      .replace(/\b(?:y|e|o|u|de|del|en|con|para|por|a|al|sin|sobre|hacia|desde|hasta|un|una|el|la|los|las|sus|su)\s*$/i, "")
      .replace(/[\s,:;|\-–—.]+$/, "")
      .trim();
    if (trimmed && !trimmed.endsWith(".")) {
      trimmed += ".";
    }
    return `<p${attrs}>${trimmed}</p>`;
  });
}

export function extractTitleWordLimit(prompt?: string): number | null {
  if (!prompt) return null;
  const p = prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const spanishWordNumberMap: Record<string, number> = {
    un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
    seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
    trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
    dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22,
    veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
    veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
    cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
    noventa: 90, cien: 100,
  };

  // 1. Prefix pattern: "(con un / un / con / de)? (maximo / hasta / menos de / no mas de / max / tope / limite / de) X palabras"
  const prefixMatch = p.match(/\b(?:(?:con\s+)?(?:un\s+)?|de\s+)?(?:maximo|max|hasta|menos\s+de|no\s+mas\s+de|tope(?:\s+de)?|limite(?:\s+de)?|longitud(?:\s+maxima)?(?:\s+de)?|de\s+hasta)\s*(\d+)\s*palabras?\b/i);
  if (prefixMatch && prefixMatch[1]) {
    const val = parseInt(prefixMatch[1], 10);
    if (val > 0 && val < 500) return val;
  }

  // 2. Suffix pattern: "X palabras (como / de)? (maximo / max / tope / limite)"
  const suffixMatch = p.match(/\b(\d+)\s*palabras?\s*(?:como\s+|de\s+)?(?:maximo|max|tope|limite)\b/i);
  if (suffixMatch && suffixMatch[1]) {
    const val = parseInt(suffixMatch[1], 10);
    if (val > 0 && val < 500) return val;
  }

  // 3. Simple count: "(en / de / con) X palabras"
  const simpleMatch = p.match(/\b(?:en|de|con)\s*(\d+)\s*palabras?\b/i);
  if (simpleMatch && simpleMatch[1]) {
    const val = parseInt(simpleMatch[1], 10);
    if (val > 0 && val < 500) return val;
  }

  // 4. Word number patterns:
  const wordKeys = Object.keys(spanishWordNumberMap).join("|");
  const wordRegex = new RegExp(`\\b(?:(?:con\\s+)?(?:un\\s+)?|de\\s+)?(?:maximo|max|hasta|menos\\s+de|no\\s+mas\\s+de|tope(?:\\s+de)?|limite(?:\\s+de)?|de|en|con)\\s*(${wordKeys})\\s*palabras?\\b`, "i");
  const wordMatch = p.match(wordRegex);
  if (wordMatch && wordMatch[1]) {
    const num = spanishWordNumberMap[wordMatch[1].toLowerCase()];
    if (num) return num;
  }

  const wordNumSuffixRegex = new RegExp(`\\b(${wordKeys})\\s*palabras?\\s*(?:como\\s+|de\\s+)?(?:maximo|max|tope|limite)\\b`, "i");
  const wordNumSuffixMatch = p.match(wordNumSuffixRegex);
  if (wordNumSuffixMatch && wordNumSuffixMatch[1]) {
    const num = spanishWordNumberMap[wordNumSuffixMatch[1].toLowerCase()];
    if (num) return num;
  }

  return null;
}

export function extractTitleCharLimit(prompt?: string): number | null {
  if (!prompt) return null;
  const p = prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const match = p.match(/\b(?:con\s+(?:un\s+)?)?(?:maximo|max|hasta|menos\s+de|no\s+mas\s+de|tope(?:\s+de)?|limite(?:\s+de)?|longitud(?:\s+maxima)?(?:\s+de)?|de)\s*(\d+)\s*(?:caracteres?|letras?)\b/i);
  if (match && match[1]) {
    const val = parseInt(match[1], 10);
    if (val > 0 && val < 1000) return val;
  }
  return null;
}

export function enforceTitleConstraints(title: string, prompt?: string): string {
  if (!title) return "";
  let clean = cleanTitleString(title);
  if (!prompt) return clean;

  const maxWords = extractTitleWordLimit(prompt);
  if (maxWords && maxWords > 0) {
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length > maxWords) {
      clean = words.slice(0, maxWords).join(" ");
      // Clean up any trailing punctuation or dangling prepositions/determiners
      for (let i = 0; i < 2; i++) {
        clean = clean
          .replace(/[\s,:;|\-–—.]+$/, "")
          .replace(/\b(?:y|e|o|u|de|del|en|con|para|por|a|al|sin|sobre|hacia|desde|hasta|un|una|el|la|los|las|toda|todo|todas|todos)\s*$/i, "")
          .replace(/[\s,:;|\-–—.]+$/, "")
          .trim();
      }
    }
  }

  const maxChars = extractTitleCharLimit(prompt);
  if (maxChars && maxChars > 0 && clean.length > maxChars) {
    clean = clean.slice(0, maxChars);
    const lastSpace = clean.lastIndexOf(" ");
    if (lastSpace > maxChars * 0.7) {
      clean = clean.slice(0, lastSpace);
    }
    clean = clean
      .replace(/[\s,:;|\-–—.]+$/, "")
      .replace(/\b(?:y|e|o|u|de|del|en|con|para|por|a|al|sin|sobre|hacia|desde|hasta|un|una|el|la|los|las)\s*$/i, "")
      .replace(/[\s,:;|\-–—.]+$/, "")
      .trim();
  }

  return clean;
}

export function synthesizeMarketingTitle(
  entityName: string,
  context: CleanScrapedContext,
  prompt?: string
): string {
  const p = (prompt || "").trim();
  const omitName = checkPromptOmitEntityName(p);

  // 1. Explicit quotes in prompt
  const quotedMatch = p.match(/["'«“]([^"'»”]{5,120})["'»”]/);
  if (quotedMatch && quotedMatch[1]) {
    const custom = cleanTitleString(quotedMatch[1]);
    const res = omitName ? cleanTitleOmitEntity(custom, entityName, context.publisherName) : (custom.toLowerCase().includes(entityName.toLowerCase()) ? custom : `${entityName} | ${custom}`);
    return enforceTitleConstraints(res, prompt);
  }

  // 2. Extract best heading or service from actual scraped website
  const allHeadings = (context.headings || [])
    .map((h) => cleanTitleString(h))
    .filter((h) => h.length > 8 && h.length < 90 && !/¿|\?|menu|login|buscar|inicio|cookies|sesi[oó]n|bienvenidos?|error/i.test(h));

  const allServices = (context.servicesList || [])
    .map((s) => cleanTitleString(s))
    .filter((s) => s.length > 5 && s.length < 80);

  let highlight = allHeadings.find((h) => !h.toLowerCase().includes(entityName.toLowerCase())) ||
                  allServices.find((s) => !s.toLowerCase().includes(entityName.toLowerCase())) ||
                  "";

  if (!highlight && context.metaDescription && context.metaDescription.length > 15) {
    const metaSentences = context.metaDescription.split(/[.;]\s+/).map((s) => cleanTitleString(s)).filter((s) => s.length > 15 && s.length < 80);
    if (metaSentences.length > 0) {
      highlight = metaSentences[0];
    }
  }

  const rawTitleClean = cleanTitleString(context.rawPageTitle || "");
  let baseTitle = highlight || (rawTitleClean && !rawTitleClean.toLowerCase().includes(entityName.toLowerCase()) ? rawTitleClean : "");

  if (!baseTitle && p) {
    const fullCorpus = `${context.rawPageTitle || ""} ${context.headings?.join(" ") || ""} ${context.paragraphs?.join(" ") || ""} ${context.mainText || ""}`.toLowerCase();
    const isHospital = /hospital|sanatorio|cl[ií]nica|salud|m[eé]dico/i.test(`${entityName} ${context.url || ""} ${fullCorpus}`);
    const isEdu = !isHospital && /universidad|facultad|carrera|estudiant|posgrado/i.test(`${entityName} ${context.url || ""} ${fullCorpus}`);
    const isSports = /gimnasio|fitness|deporte|club/i.test(`${entityName} ${context.url || ""} ${fullCorpus}`);
    const isLegal = /abogad|jur[ií]dico|legal|notari/i.test(`${entityName} ${context.url || ""} ${fullCorpus}`);
    const isTourism = /hotel|hostel|turismo|alojam|posada/i.test(`${entityName} ${context.url || ""} ${fullCorpus}`);

    if (isHospital) {
      baseTitle = "Atención Médica de Excelencia, Especialidades y Cuidado de la Salud";
    } else if (isEdu) {
      baseTitle = "Formación Profesional de Excelencia, Carreras e Innovación Académica";
    } else if (isSports) {
      baseTitle = "Entrenamiento Integral, Salud y Acondicionamiento Físico";
    } else if (isLegal) {
      baseTitle = "Asesoramiento Legal Integral y Soluciones Profesionales";
    } else if (isTourism) {
      baseTitle = "Hospitalidad, Confort y Experiencias de Primer Nivel";
    } else {
      baseTitle = "Propuestas de Valor, Servicios Integrales y Atención de Calidad";
    }
  }

  let finalRes = "";
  if (omitName) {
    finalRes = baseTitle ? cleanTitleOmitEntity(baseTitle, entityName, context.publisherName) : "Servicios y Prestaciones";
  } else if (!baseTitle) {
    finalRes = entityName;
  } else if (baseTitle.toLowerCase().includes(entityName.toLowerCase())) {
    finalRes = baseTitle;
  } else {
    finalRes = `${entityName} | ${baseTitle}`;
  }

  return enforceTitleConstraints(finalRes, prompt);
}

export function buildRichProviderInfo(
  publisherName: string,
  city: string,
  country: string,
  extractedData?: any,
  mainDescription?: string
): string {
  let cleanName = (publisherName || "")
    .split(/\s*[:|–—\-]\s*/)[0]
    .replace(/(?:haz|crea|gener[aá]|pon|redacta|escribe|se\s+un|especialista|experto|marketing|conversi[oó]n|llamativ|impactante|vendedor)[\s\S]*/i, "")
    .trim() || publisherName;
  const locStr = [city, country].filter(Boolean).join(", ");

  const plainDesc = (mainDescription || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const textCorpus = `${plainDesc} ${extractedData?.textContent || ""}`.toLowerCase();
  const headings = Array.isArray(extractedData?.headings)
    ? extractedData.headings.filter((h: string) => h && h.length > 3 && h.length < 80 && !/menu|login|buscar|cookies|inicio/i.test(h))
    : [];

  const isHealth = /hospital|sanatorio|cl[ií]nica\s+m[eé]dica|centro\s+m[eé]dico|policl[ií]nic|guardia\s+m[eé]dica|urgencias?\s+m[eé]dicas?|atenci[oó]n\s+m[eé]dica|consultorios?\s+externos?/i.test(`${cleanName} ${textCorpus}`);
  const isExplicitEdu = !isHealth && /universidad|facultad|instituto\s+universitario|campus/i.test(cleanName);
  const isEdu = !isHealth && (isExplicitEdu || /universidad|facultad|instituto|colegio|educaci[oó]n|carrera|estudio|grado|posgrado|licenciatura/i.test(textCorpus));
  const isTourism = !isEdu && !isHealth && /hotel|hostel|turismo|alojam|posada|cabaña|resort/i.test(textCorpus);
  const isLegal = !isEdu && !isHealth && /traduct|abogad|legal|notari|escriban|jur[ií]dic/i.test(textCorpus);

  // Helper to pick randomly from varied narrative angles
  const pickRandom = (arr: string[]): string => arr[Math.floor(Math.random() * arr.length)];

  // 1. If website metaDescription or intro sentence describes the entity cleanly without templates
  if (extractedData?.metaDescription && extractedData.metaDescription.length > 35 && extractedData.metaDescription.length < 260) {
    const meta = extractedData.metaDescription.trim();
    if (!/cookies|javascript|sesi[oó]n|portal|ingres[oa]/i.test(meta) && (!isEdu || !/m[eé]dic|paciente|cl[ií]nic/i.test(meta))) {
      // 30% chance to use natural meta if good, otherwise vary with rich angles
      if (Math.random() < 0.3) {
        return meta;
      }
    }
  }

  // 2. Dynamic, non-template, randomized descriptions tailored to the entity's real activity
  if (isEdu) {
    const academicAreas = headings.length > 0 ? ` en áreas como ${headings.slice(0, 3).join(", ")}` : "";
    const eduAngles = [
      `${cleanName} es una institución de educación superior${locStr ? ` con sede en ${locStr}` : ""}, dedicada a la formación académica y profesional a través de carreras de grado, posgrados y programas de capacitación continua${academicAreas}.`,
      `Reconocida por su excelencia pedagógica${locStr ? ` en ${locStr}` : ""}, ${cleanName} ofrece una sólida oferta formativa en modalidades presencial y virtual, preparando profesionales líderes con visión de futuro.`,
      `${cleanName} se destaca como polo de conocimiento e innovación académica${locStr ? ` en ${locStr}` : ""}, impulsando la investigación, el pensamiento crítico y programas de estudio actualizados${academicAreas}.`,
      `Comprometida con la formación integral y el desarrollo profesional de sus estudiantes, ${cleanName} brinda carreras universitarias y cursos especializados con altos estándares académicos y moderna infraestructura.`,
    ];
    return pickRandom(eduAngles);
  }

  if (isHealth) {
    const healthAreas = headings.length > 0 ? ` en áreas como ${headings.slice(0, 3).join(", ")}` : "";
    const healthAngles = [
      `${cleanName} es una prestigiosa institución médica${locStr ? ` de ${locStr}` : ""}, equipada con tecnología de avanzada y servicios asistenciales integrales de alta complejidad${healthAreas}.`,
      `Con una sólida trayectoria en el cuidado de la salud${locStr ? ` en ${locStr}` : ""}, ${cleanName} brinda atención médica especializada, diagnóstico clínico confiable y guardia permanente comprometida con el bienestar de la comunidad.`,
      `${cleanName} se distingue por la excelencia de su equipo profesional y la calidez en el trato humano, ofreciendo prestaciones médicas integrales, consultas diagnósticas y tratamientos de vanguardia${healthAreas}.`,
      `Referente en atención sanitaria integral${locStr ? ` en ${locStr}` : ""}, ${cleanName} cuenta con un calificado cuerpo médico multidisciplinario dedicado al cuidado preventivo y terapéutico de pacientes.`,
      `Como centro asistencial y médico moderno${locStr ? ` con sede en ${locStr}` : ""}, ${cleanName} combina equipamiento de última generación, atención ambulatoria y servicios de internación enfocados en el cuidado de la salud.`,
    ];
    return pickRandom(healthAngles);
  }

  if (isTourism) {
    const tourismAngles = [
      `${cleanName} es un referente en hospitalidad y turismo${locStr ? ` en ${locStr}` : ""}, orientado a brindar estadías confortables, calidez en el servicio y experiencias memorables.`,
      `Ubicado estratégicamente${locStr ? ` en ${locStr}` : ""}, ${cleanName} ofrece modernas instalaciones, confort y atención personalizada pensada para el descanso y disfrute de sus visitantes.`,
      `Con un estándar de excelencia en atención al huésped, ${cleanName} se distingue por sus cuidados ambientes y una propuesta de hospitalidad integral pensada para cada viajero.`,
    ];
    return pickRandom(tourismAngles);
  }

  if (isLegal) {
    const legalAngles = [
      `${cleanName} es un prestador de servicios profesionales y consultoría${locStr ? ` con sede en ${locStr}` : ""}, enfocado en brindar asesoramiento técnico, soporte integral y soluciones a medida con los más altos estándares de excelencia.`,
      `Con amplia trayectoria y solvencia técnica${locStr ? ` en ${locStr}` : ""}, ${cleanName} asesora a personas y organizaciones con rigor profesional, confidencialidad y ética.`,
      `${cleanName} ofrece servicios de consultoría especializada${locStr ? ` en ${locStr}` : ""}, brindando acompañamiento integral, gestión eficiente y respuestas estratégicas personalizadas.`,
    ];
    return pickRandom(legalAngles);
  }

  const generalAreas = headings.length > 0 ? ` destacándose en ${headings.slice(0, 3).join(", ")}` : "";
  const generalAngles = [
    `${cleanName} es una entidad de referencia${locStr ? ` con base en ${locStr}` : ""}, orientada a brindar prestaciones y soluciones profesionales${generalAreas} con sólida trayectoria y atención personalizada.`,
    `Dedicada a ofrecer respuestas confiables y atención personalizada, ${cleanName} se posiciona como una organización destacada${locStr ? ` en ${locStr}` : ""}.`,
    `Con un equipo enfocado en la satisfacción y la excelencia operativa, ${cleanName} desarrolla prestaciones de calidad adaptadas a las necesidades reales de su comunidad.`,
    `${cleanName} se distingue por su constante compromiso con la calidad y la innovación${locStr ? ` en ${locStr}` : ""}, brindando servicios especializados con atención personalizada.`,
  ];
  return pickRandom(generalAngles);
}

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

export interface CleanScrapedContext {
  url: string;
  publisherName: string;
  rawPageTitle?: string;
  metaDescription?: string;
  headings?: string[];
  servicesList?: string[];
  paragraphs?: string[];
  mainText?: string;
  city?: string;
  country?: string;
  address?: string;
  foundingYear?: string;
  rating?: string;
  reviewCount?: string;
  commentsUrl?: string;
  logo?: string;
  images?: string[];
  socialLinks?: Array<{ kind: string; label: string; url: string }>;
  apiKey?: string;
  provider?: "auto" | "gemini" | "openai";
  variationIndex?: number;
  autoTranslate?: boolean;
  currentText?: string;
  mainDescription?: string;
  previousBlocks?: Array<{ title: string; body: string }>;
}

export interface AgentResult<T> {
  success: boolean;
  data: T | null;
  estado: "ok" | "parcial" | "sin_datos";
  evidencias: string[];
  providerUsed: string;
  error?: string;
}

function escapeHtml(str: string): string {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function cleanTitleString(title: string): string {
  if (!title) return "";
  let raw = String(title).trim();
  // Strip JSON formatting residue like {"title": "...", "title":, title":, etc.
  raw = raw
    .replace(/^[\s"'{}\[\],:]*(?:title|titulo|nombre|resultado)[\s"']*:\s*"?/i, "")
    .replace(/["'\s,:{}]+$/, "")
    .trim();
  if (!raw || /^(?:title|titulo|nombre|resultado)[\s"':]*$/i.test(raw) || /^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo|home(?:\s*page)?|homepage|inicio|portada|bienvenidos?|principal)$/i.test(raw)) {
    return "";
  }
  let cleaned = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[-–—|]\s*(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*$/i, "")
    .replace(/^(?:Home|Inicio|Portada|Bienvenidos?|Sitio Oficial|Página Oficial|Web Oficial|Portal Oficial|Principal|Oficial)\s*[-–—|]\s*/i, "")
    .trim();
  cleaned = cleaned
    .replace(/^[\s"'{}\[\],:]*(?:title|titulo|nombre|resultado)[\s"']*:\s*"?/i, "")
    .replace(/["'\s,:{}]+$/, "")
    .trim();
  if (!cleaned || /^(?:title|titulo|nombre|resultado)[\s"':]*$/i.test(cleaned) || /^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo|home(?:\s*page)?|homepage|inicio|portada|bienvenidos?|principal)$/i.test(cleaned)) {
    return "";
  }
  return cleaned;
}

export function cleanGenericBlockTitle(title: string, prompt?: string): string {
  let t = cleanTitleString(title || "").trim();
  const isFaq =
    /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(t) ||
    /preguntas?\s+(?:y|con)\s+respuestas?|faq/i.test(prompt || "");

  if (isFaq) {
    return "Preguntas Frecuentes";
  }

  t = t
    .replace(/\s*(?:[-–—|]|(?:\b(?:en|de|del|para|sobre|con)\s+(?:la|el|los|las)?))\s*(?:Universidad|Colegio|Instituto|Hospital|Clínica|Fundación|Empresa|Incutex|Kennedy).*$/i, "")
    .trim();

  return t || "Información Adicional";
}

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms: number = 4000): Promise<Response> {
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
  const clean = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(clean);
  } catch {}

  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const sub = clean.substring(first, last + 1);
    try {
      return JSON.parse(sub);
    } catch {}
    try {
      const sanitized = sub.replace(/:\s*"([\s\S]*?)"(?=\s*[,}\]])/g, (_, p1) => {
        return `: "${p1.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`;
      });
      return JSON.parse(sanitized);
    } catch {}
  }

  const res: any = {};
  const titleM = clean.match(/"(?:title|titulo|contenido)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
  if (titleM) {
    try {
      res.title = JSON.parse(`"${titleM[1]}"`);
    } catch {
      res.title = titleM[1].replace(/\\"/g, '"');
    }
    res.contenido = res.title;
  }

  const descM = clean.match(/"(?:description|descripcion|contenido)"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*})/i);
  if (descM) {
    res.description = descM[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
    if (!res.contenido) res.contenido = res.description;
  }

  const bodyM = clean.match(/"(?:body|cuerpo|contenido)"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"|"\s*})/i);
  if (bodyM) {
    res.body = bodyM[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
    if (!res.contenido) res.contenido = res.body;
  }

  return Object.keys(res).length > 0 ? res : null;
}

// ----------------------------------------------------------------------------
let cachedWorkingGeminiModel: string | null = "gemini-2.0-flash";

// ----------------------------------------------------------------------------
// Provider Dispatcher (Gemini -> OpenAI -> Controlled Error)
// ----------------------------------------------------------------------------
async function executeModelCall(
  systemPrompt: string,
  userPrompt: string,
  apiKeyParam?: string,
  preferredProvider: "auto" | "gemini" | "openai" = "auto",
  maxOutputTokens: number = 1000
): Promise<{ rawText: string; providerUsed: string }> {
  const customKey = String(apiKeyParam || "").trim();
  const rawGemini =
    (customKey && (customKey.startsWith("AIza") || !customKey.startsWith("sk-")) ? customKey : "") ||
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    "";
  const geminiKey = rawGemini.trim();

  const rawOpenai =
    (customKey && customKey.startsWith("sk-") ? customKey : "") ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    process.env.NEXT_PUBLIC_OPENAI_API_KEY ||
    "";
  const openaiKey = rawOpenai.trim();

  if (!geminiKey && !openaiKey) {
    throw new Error("No hay ninguna API Key de IA configurada. Ingresá tu clave de Gemini (AIza...) u OpenAI (sk-...) en el modal o en la configuración para continuar.");
  }

  const executeGemini = async (): Promise<string> => {
    if (!geminiKey) throw new Error("GEMINI_API_KEY no disponible.");

    const callModel = async (model: string): Promise<string | null> => {
      const payload: any = {
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.85,
          maxOutputTokens,
          responseMimeType: "application/json",
        },
      };

      try {
        let res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(8500),
            body: JSON.stringify(payload),
          }
        );

        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 400));
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(5000),
              body: JSON.stringify(payload),
            }
          );
        }

        if (res.status === 400) {
          const fallbackPayload = {
            contents: payload.contents,
            generationConfig: { temperature: 0.85, maxOutputTokens },
          };
          res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(5000),
              body: JSON.stringify(fallbackPayload),
            }
          );
        }

        if (res.ok) {
          const json = await res.json();
          const raw = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (raw) return raw.replace(/```json\s*|```/gi, "").trim();
        } else {
          const errDetail = await res.text().catch(() => "");
          console.warn(`[Gemini ${model} HTTP ${res.status}]: ${errDetail.slice(0, 200)}`);
        }
      } catch (e: any) {
        console.warn(`[Gemini ${model} fetch error]:`, e.message);
      }
      return null;
    };

    // 1. Fast-path: Usar modelo en caché directamente en ~1s
    if (cachedWorkingGeminiModel) {
      try {
        const result = await callModel(cachedWorkingGeminiModel);
        if (result) return result;
        cachedWorkingGeminiModel = null;
      } catch {
        cachedWorkingGeminiModel = null;
      }
    }

    // 2. Probar candidatos estables (gemini-2.0-flash y gemini-1.5-flash primero)
    const candidateModels = [
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
    ];

    let lastErr: any = null;
    const errorsList: string[] = [];

    for (const model of candidateModels) {
      try {
        const result = await callModel(model);
        if (result) {
          cachedWorkingGeminiModel = model;
          return result;
        }
        errorsList.push(`${model} (falló generación)`);
      } catch (e: any) {
        errorsList.push(`${model} (${e.message})`);
        lastErr = e;
      }
    }

    // 3. Descubrimiento dinámico de modelos vía ListModels si los fijos no responden
    try {
      const listRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (listRes.ok) {
        const listData = await listRes.json();
        const availableModels = (listData.models || [])
          .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m: any) => m.name.replace(/^models\//, ""))
          .filter((m: string) => m.includes("gemini"));

        for (const model of availableModels) {
          try {
            const result = await callModel(model);
            if (result) {
              cachedWorkingGeminiModel = model;
              return result;
            }
          } catch (e: any) {
            lastErr = e;
          }
        }
      }
    } catch {}

    throw lastErr || new Error(`Gemini no pudo responder: ${errorsList.join(" | ")}`);
  };

  const executeOpenAI = async (): Promise<string> => {
    if (!openaiKey) throw new Error("OPENAI_API_KEY no disponible.");
    const models = ["gpt-4o-mini", "gpt-4o"];
    let lastErr: any = null;
    for (const model of models) {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.75,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const json = await res.json();
          const raw = json.choices?.[0]?.message?.content || "";
          if (raw) return raw;
        } else {
          const errDetail = await res.text().catch(() => "");
          lastErr = new Error(`OpenAI ${model} (HTTP ${res.status}): ${errDetail || res.statusText}`);
        }
      } catch (e: any) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("OpenAI falló.");
  };

  if (preferredProvider === "openai") {
    if (openaiKey) {
      try {
        const raw = await executeOpenAI();
        return { rawText: raw, providerUsed: "openai" };
      } catch (err: any) {
        if (geminiKey) {
          const raw = await executeGemini();
          return { rawText: raw, providerUsed: "gemini" };
        }
        throw err;
      }
    } else if (geminiKey) {
      const raw = await executeGemini();
      return { rawText: raw, providerUsed: "gemini" };
    }
  } else {
    // preferredProvider === "auto" or "gemini"
    if (geminiKey) {
      try {
        const raw = await executeGemini();
        return { rawText: raw, providerUsed: "gemini" };
      } catch (geminiErr: any) {
        if (openaiKey) {
          try {
            const raw = await executeOpenAI();
            return { rawText: raw, providerUsed: "openai" };
          } catch (openAiErr: any) {
            throw new Error(`Gemini falló [${geminiErr.message}] y OpenAI falló [${openAiErr.message}]`);
          }
        }
        throw geminiErr;
      }
    } else if (openaiKey) {
      const raw = await executeOpenAI();
      return { rawText: raw, providerUsed: "openai" };
    }
  }
  throw new Error("No se pudo contactar a ningún proveedor de IA.");
}

// ============================================================================
// 1. MINI-AGENTE DE TÍTULO (TitleAgent)
// ============================================================================
export async function runTitleAgent(
  context: CleanScrapedContext,
  adminTitlePrompt?: string
): Promise<AgentResult<{ title: string; titleI18n: I18nRecord }>> {
  const prompt = (adminTitlePrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const isReformulation = Boolean(context.variationIndex && context.variationIndex >= 1);
  const currentTitleToReplace = cleanTitleString(context.rawPageTitle || context.currentText || "");
  const variationDirective = isReformulation
    ? `\n\n=== DIRECTIVA OBLIGATORIA DE REFORMULACIÓN (NUEVA VARIACIÓN #${context.variationIndex}) ===
El administrador pulsó "Reformular con IA" para obtener una versión NUEVA, DIFERENTE y FRESCA.
${currentTitleToReplace ? `- TÍTULO ANTERIOR A REEMPLAZAR (PROHIBIDO REPETIR EXACTAMENTE): "${currentTitleToReplace}"` : ""}
REGLAS MANDATORIAS DE REFORMULACIÓN:
1. NO devuelvas el mismo título ni una copia casi idéntica. Debe ser una alternativa claramente diferente.
2. Basándote SIEMPRE en la directiva del administrador y en los datos reales del establecimiento, utiliza otra estructura sintáctica, otro orden de palabras o destaca otro beneficio/aspecto relevante de la web.`
    : "";

  const omitName = checkPromptOmitEntityName(prompt);
  const wantsMarketingOrLong = /(?:marketing|conversi[oó]n|llamativ|atenci[oó]n|bastante\s+largo|largo|impactante|vendedor)/i.test(prompt);

  const systemPrompt = `Eres un director creativo y especialista en marketing, conversión y copywriting publicitario para Travelgrin.
Tu objetivo primordial es generar un TÍTULO PUBLICITARIO Y COMERCIAL DE ALTO IMPACTO cumpliendo rigurosamente la directiva editorial del administrador.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "title": "Título comercial y de impacto en español"
}
REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: La instrucción del administrador es la regla NÚMERO UNO:
   - REGLA ESTRICTA DE LÍMITE DE PALABRAS Y EXTENSIÓN: Si el administrador indica un límite de palabras (ej: "máximo 25 palabras", "un límite de 25 palabras", "hasta 20 palabras", "menos de 15 palabras", "tope de 25 palabras"): CUMPLE ESTRICTAMENTE Y NO SUPERES esa cantidad de palabras bajo ninguna circunstancia. Cuenta las palabras con exactitud antes de emitir la respuesta. Además, redacta un titular completo, llamativo y atractivo que aproveche bien la extensión solicitada (ej: si pide hasta 25 palabras, aprovecha una extensión sustancial de 15 a 25 palabras; no devuelvas un título de solo 5 palabras).
   - MÁXIMA LIBERTAD Y CERO PLANTILLAS: Adáptate 100% a lo que pide el administrador sin recurrir a plantillas fijas, clichés o frases hechas. Redacta un titular original, único y fresco basado estrictamente en el contenido real de la página web y en el estilo pedido por el administrador.
   - Si el administrador pide especialista en marketing, conversión, llamar la atención o estilo publicitario, redacta un titular creativo de alto impacto. Si NO pidió omitir el nombre, puedes integrar el nombre si encaja naturalmente, pero el gancho comercial y la instrucción del usuario son prioritarios.
   - ESTÁ TERMINANTEMENTE PROHIBIDO devolver únicamente el nombre de la institución a secas (ej: "${entityName}") o copiar textualmente el encabezado o etiqueta title cruda de la web si se pidió marketing o impacto.
2. CERO PLANTILLAS RÍGIDAS: Queda TERMINANTEMENTE PROHIBIDO usar fórmulas fijas, clichés o plantillas vacías. El titular debe ser 100% fresco, único y a medida basado en la actividad real comprobada de la entidad y en la directiva del administrador.
3. REGLA ESTRICTA DE RESTRICCIÓN NEGATIVA: Si el administrador pide que el título NO contenga el nombre de la institución (ej: 'que no contenga el nombre de la institucion', 'sin el nombre', 'no incluir el nombre'), ESTÁ ESTRICTAMENTE PROHIBIDO incluir '${entityName}' o el nombre de la entidad en el título; genera únicamente la propuesta comercial o titular de alto impacto.
4. REGLA DE IDIOMA: Redacta EXCLUSIVAMENTE en ESPAÑOL. No traduzcas a inglés, portugués ni italiano.
5. Fidelidad factual: Basa las especialidades y propuestas en los datos reales de la web de "${entityName}".
6. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
"${prompt || "Crear un título claro, comercial, atractivo y representativo que presente al establecimiento y su propuesta principal."}"${variationDirective}
${omitName ? "\n--> REGLA CRÍTICA OBLIGATORIA: El administrador ha solicitado expresamente que el título NO contenga el nombre de la institución. ESTÁ TERMINANTEMENTE PROHIBIDO poner '" + entityName + "' en el título; genera únicamente el titular/eslogan de alto impacto.\n" : ""}
=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 10).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 8).join(" | ") || "N/A"}
- Resumen y párrafos de la web: "${(context.metaDescription || context.paragraphs?.slice(0, 3).join(" ") || context.mainText?.slice(0, 600) || "").slice(0, 800)}"

GENERA EL TÍTULO CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT-DEBUG: TitleAgent]`);
  console.log(`1. URL: ${context.url}`);
  console.log(`2. Admin Title Prompt: "${prompt || "(Sin prompt personalizado, usando instrucción básica)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto",
      500
    );

    console.log(`3. Provider Used: ${providerUsed}`);
    console.log(`4. Raw Model Response: ${rawText}`);

    const parsed = extractJson(rawText);
    let rawTitle = String(
      parsed?.title ||
      parsed?.titleI18n?.es ||
      parsed?.titulo ||
      parsed?.contenido ||
      parsed?.nombre ||
      parsed?.text ||
      parsed?.resultado ||
      ""
    ).trim();

    rawTitle = rawTitle.replace(/^[\s"'{}\[\],:]*(?:title|titulo|nombre)[\s"']*:\s*"?/i, "").replace(/["'\s,:{}]+$/, "").trim();

    if (/^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo|title|titulo)$/i.test(rawTitle)) {
      rawTitle = "";
    }

    if (!rawTitle) {
      // Direct regex match for "title": "..." across full text
      const titleMatch = rawText.match(/"(?:title|titulo|nombre)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/i);
      if (titleMatch && titleMatch[1]) {
        rawTitle = titleMatch[1].trim();
      }
    }

    if (!rawTitle) {
      const cleanedRaw = rawText
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .replace(/^["'{}\s]+|["'{}\s]+$/g, "")
        .trim();
      const validLines = cleanedRaw.split("\n")
        .map(l => l.trim().replace(/^[\s"'{}\[\],:]*(?:title|titulo|nombre)[\s"']*:\s*"?/i, "").replace(/["'\s,:{}]+$/, "").trim())
        .filter(l => l.length >= 3 && !/^(?:title|titulo|nombre|resultado|sin[-_\s]*datos|no[-_\s]*disponible|n\/?a)$/i.test(l));
      if (validLines.length > 0 && validLines[0].length <= 160) {
        rawTitle = validLines[0];
      }
    }

    let cleanTitle = cleanTitleString(rawTitle);

    if (omitName) {
      cleanTitle = cleanTitleOmitEntity(cleanTitle, entityName, context.publisherName);
    }

    // Only fallback if the model returned nothing valid
    if (!cleanTitle) {
      cleanTitle = synthesizeMarketingTitle(entityName, context, prompt);
    }

    cleanTitle = enforceTitleConstraints(cleanTitle, prompt);

    console.log(`5. Normalized Title Output: "${cleanTitle}"`);

    const tI18n: I18nRecord = {
      es: cleanTitle,
      en: "",
      pt: "",
      it: "",
    };



    return {
      success: true,
      data: {
        title: cleanTitle,
        titleI18n: tI18n,
      },
      estado: "ok",
      evidencias: parsed?.evidencias || [entityName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: TitleAgent] ERROR: ${err.message}`);
    const fallbackTitle = synthesizeMarketingTitle(entityName, context, prompt);
    return {
      success: true,
      data: {
        title: fallbackTitle,
        titleI18n: { es: fallbackTitle, en: "", pt: "", it: "" },
      },
      estado: "ok",
      evidencias: [entityName],
      providerUsed: "synthesizer",
    };
  }
}

// ============================================================================
// 2. MINI-AGENTE DE DESCRIPCIÓN (DescriptionAgent)
// ============================================================================
export async function runDescriptionAgent(
  context: CleanScrapedContext,
  adminDescriptionPrompt?: string
): Promise<AgentResult<{ description: string; descriptionI18n: I18nRecord }>> {
  const prompt = (adminDescriptionPrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const isReformulation = Boolean(context.variationIndex && context.variationIndex >= 1);
  const currentTextToReplace = (context.currentText || "").trim();
  const variationDirective = isReformulation
    ? `\n\n=== DIRECTIVA OBLIGATORIA DE REFORMULACIÓN (NUEVA VARIACIÓN #${context.variationIndex}) ===
El administrador ha solicitado REFORMULAR la descripción para presentar una propuesta NUEVA, DIFERENTE y FRESCA, pero SIEMPRE CUMPLIENDO RIGUROSAMENTE EL PROMPT Y DIRECTIVAS DEL ADMINISTRADOR.
${currentTextToReplace ? `\n--- DESCRIPCIÓN ANTERIOR A REEMPLAZAR (PROHIBIDO REPETIR EXACTAMENTE) ---\n"${currentTextToReplace.replace(/<[^>]+>/g, " ").slice(0, 1000)}"\n----------------------------------------------------------\n` : ""}
REGLAS MANDATORIAS DE REFORMULACIÓN:
1. NO devuelvas el mismo texto ni repitas la misma apertura o la misma estructura idéntica de párrafos.
2. Utiliza una redacción fresca y alternativa, cambiando los inicios de párrafos, el enfoque y los conectores.
3. Extrae y destaca otros servicios, propuestas, detalles o beneficios reales del contenido de la web provisto.
4. Cumple rigurosamente con todas las directivas de formato, cantidad de párrafos, estilo y exclusiones pedidas por el administrador.`
    : "";

  const systemPrompt = `Eres un redactor publicitario senior y especialista en marketing para Travelgrin.
Tu objetivo primordial es redactar la DESCRIPCIÓN PRINCIPAL de la publicación cumpliendo fielmente la directiva editorial del administrador.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "description": "<p>Primer párrafo en español...</p><p>Segundo párrafo en español...</p>"
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: La directiva del administrador es la regla NÚMERO UNO:
   - Si el administrador pide una cantidad exacta de párrafos (ej: "2 párrafos", "5 párrafos"), REDACTA EXACTAMENTE ESA CANTIDAD DE PÁRRAFOS en HTML <p>...</p>.
   - FORMATO, SUBTÍTULOS Y COLORES EXACTOS: Si el administrador pide subtítulos con su explicación o pide colores (ej: "con los títulos en letras azules y su explicación", "letras rojas", etc.), aplica el estilo inline EXACTO pedido: si pide azul usa <p><strong style="color: #0066cc;">Subtítulo:</strong> Explicación persuasiva...</p>, si pide rojo usa style="color: #dc2626;", si pide amarillo usa style="color: #ca8a04;". Si no especifica color pero pide subtítulos, usa <p><strong>Subtítulo:</strong> Explicación...</p>.
   - REGLA ESTRICTA DE LÍMITE DE PALABRAS Y DESARROLLO DE CONTENIDO: Si el administrador pide un límite de palabras por párrafo (ej: "con un máximo de 50 palabras en cada párrafo", "un límite de 50 palabras", "hasta 50 palabras"): DESARROLLA Y EXPLAYA el contenido de cada párrafo con información real, clara, descriptiva y persuasiva para aproximarte al límite solicitado (ej: entre 40 y 50 palabras por párrafo), de modo que sea un párrafo bien desarrollado y sustancial. NUNCA devuelvas párrafos mínimos o telegráficos de 15 o 20 palabras si el límite es 50 palabras. Y NUNCA SUPERES bajo ninguna circunstancia la cantidad máxima de palabras fijada por el administrador en ningún párrafo.
   - Si el administrador pide tono de marketing, enfoque de conversión, SEO, empatía, o incluir emojis o íconos, APLÍCALO AL 100% sin censurar ni alterar lo pedido.
2. CERO PLANTILLAS RÍGIDAS: Queda TERMINANTEMENTE PROHIBIDO usar plantillas fijas o esquemas prearmados. Cada publicación debe redactarse a medida según la actividad real de la entidad y las instrucciones del administrador.
3. REGLA DE IDIOMA: Redacta EXCLUSIVAMENTE en ESPAÑOL. No traduzcas a inglés, portugués ni italiano durante el scraping.
4. Formato HTML limpio: Estructura el texto en etiquetas <p>...</p>, <strong>...</strong>, <br/>.
5. Fidelidad factual: Basa el contenido en los servicios, infraestructura, propuestas y datos reales de "${entityName}".
6. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
"${prompt || "Escribir una descripción profesional en párrafos HTML <p> en tercera persona explicando qué ofrece, su alcance y vías oficiales."}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 12).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 10).join(" | ") || "N/A"}
- Párrafos de información extraídos de la web:
${(context.paragraphs || []).slice(0, 8).join("\n\n") || (context.mainText?.slice(0, 2000) || context.metaDescription || "N/A")}
- Contacto y canales: ${(context.socialLinks || []).map((s) => `${s.label}: ${s.url}`).join(" | ") || "N/A"}

GENERA LA DESCRIPCIÓN CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT-DEBUG: DescriptionAgent]`);
  console.log(`1. URL: ${context.url}`);
  console.log(`2. Admin Description Prompt: "${prompt || "(Sin prompt personalizado, usando instrucción básica)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto",
      1500
    );

    console.log(`3. Provider Used: ${providerUsed}`);
    console.log(`4. Raw Model Response: ${rawText}`);

    const parsed = extractJson(rawText);
    let descHtml = String(
      parsed?.description ||
      parsed?.descriptionI18n?.es ||
      parsed?.descripcion ||
      parsed?.contenido ||
      parsed?.texto ||
      parsed?.body ||
      ""
    ).trim();

    if (!descHtml) {
      const cleanedRaw = rawText
        .replace(/```(?:json|html)?/gi, "")
        .replace(/```/g, "")
        .trim();
      if (cleanedRaw.length >= 5 && !cleanedRaw.startsWith("{")) {
        descHtml = cleanedRaw;
      }
    }

    if (!descHtml || descHtml.length < 5) {
      throw new Error("El modelo devolvió una descripción vacía o no estructurada.");
    }

    if (!descHtml.includes("<p>")) {
      descHtml = descHtml
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("\n");
    }

    if (prompt) {
      descHtml = enforceDescriptionParagraphCount(descHtml, prompt);
      descHtml = enforceParagraphWordLimit(descHtml, prompt);
      descHtml = applyPromptColorStyles(descHtml, prompt);
    }

    console.log(`5. Normalized Description Output:\n${descHtml}`);

    const dI18n: I18nRecord = {
      es: descHtml,
      en: "",
      pt: "",
      it: "",
    };

    return {
      success: true,
      data: {
        description: descHtml,
        descriptionI18n: dI18n,
      },
      estado: "ok",
      evidencias: parsed?.evidencias || [entityName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: DescriptionAgent] ERROR: ${err.message}`);
    const headings = (context.headings || []).filter((h) => h && h.length > 3 && h.length < 80).slice(0, 6);
    const services = (context.servicesList || []).slice(0, 5);
    const locationText = [context.city, context.country].filter(Boolean).join(", ");
    const reqCount = extractParagraphCount(prompt) || 2;
    
    const paragraphs: string[] = [];
    const leadHighlights = services.length ? services.slice(0, 3).join(", ") : headings.slice(0, 3).join(", ");
    paragraphs.push(`<p><strong>${entityName}</strong>${locationText ? ` con sede en ${locationText}` : ""} ofrece soluciones y servicios de excelencia en su actividad principal${leadHighlights ? `, destacándose en ${leadHighlights}` : ""}.</p>`);

    if (reqCount === 1) {
      // Just 1 paragraph
    } else if (reqCount === 2) {
      // Exactly 2 paragraphs!
      const secDetail = context.metaDescription || (headings.length > 1 ? headings.slice(1, 4).join(" | ") : "Atención personalizada y servicios integrales");
      paragraphs.push(`<p><strong>Propuesta y Canales de Atención:</strong> ${secDetail}. Asesoramiento, consultas y gestión directa a través de su sitio oficial.</p>`);
    } else {
      // 3 or more paragraphs
      if (context.metaDescription && context.metaDescription.length > 20) {
        paragraphs.push(`<p><strong>Propuesta y Alcance:</strong> ${context.metaDescription}</p>`);
      }
      if (headings.length > 0 || services.length > 0) {
        const highlights = services.length ? services.join(", ") : headings.join(", ");
        paragraphs.push(`<p><strong>Servicios y Especialidades:</strong> Entre sus principales áreas destacadas se encuentran: ${highlights}.</p>`);
      }
      paragraphs.push(`<p><strong>Información Oficial y Canales de Atención:</strong> Asesoramiento, consultas y gestión directa a través de su sitio oficial.</p>`);
    }

    let fallbackDesc = paragraphs.join("\n");
    if (prompt) {
      fallbackDesc = enforceDescriptionParagraphCount(fallbackDesc, prompt);
      fallbackDesc = applyPromptColorStyles(fallbackDesc, prompt);
    }
    return {
      success: true,
      data: {
        description: fallbackDesc,
        descriptionI18n: { es: fallbackDesc, en: "", pt: "", it: "" },
      },
      estado: "ok",
      evidencias: [entityName],
      providerUsed: "synthesizer",
    };
  }
}

// ============================================================================
// 3. MINI-AGENTE DE BLOQUES PERSONALIZADOS Y FAQS (CustomBlockAgent)
// ============================================================================
export async function runCustomBlockAgent(
  context: CleanScrapedContext,
  blockTitle: string,
  blockPrompt?: string,
  currentBody?: string
): Promise<ExtraDescriptionBlock> {
  const bPrompt = (blockPrompt || "").trim();
  let bTitle = cleanGenericBlockTitle(blockTitle || "Información Adicional", bPrompt);
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;

  if (entityName && bTitle.toLowerCase().includes(entityName.toLowerCase())) {
    try {
      bTitle = bTitle.replace(new RegExp(`\\s*(?:[-–—|]|(?:\\b(?:en|de|del|para|sobre|con)\\s+(?:la|el|los|las)?))\\s*${escapeRegExp(entityName)}.*$`, "i"), "").trim();
    } catch {}
  }
  if (!bTitle) bTitle = "Información Adicional";
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const variationDirective = context.variationIndex && context.variationIndex > 1
    ? `\n\nVARIACIÓN ALTERNATIVA #${context.variationIndex}:\nGenerar una propuesta diferente y alternativa a las anteriores (otra redacción y estructura), manteniendo rigurosamente la directiva editorial del administrador.`
    : "";

  const isFaq =
    /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(bTitle) ||
    /preguntas?\s+(?:y|con)\s+respuestas?|faq/i.test(bPrompt);

  const requestedCount = extractRequestedCount(bPrompt) || (isFaq ? 10 : 0);

  const mainDescSection = context.mainDescription && context.mainDescription.trim()
    ? `\n=== DESCRIPCIÓN PRINCIPAL DE LA PUBLICACIÓN (CONTEXTO EDITORIAL DE REFERENCIA) ===\n${context.mainDescription.replace(/<[^>]+>/g, " ").slice(0, 1500)}\n`
    : "";

  const previousBlocksSection = context.previousBlocks && context.previousBlocks.length
    ? `\n=== BLOQUES ANTERIORES GENERADOS (CONTEXTO DE CONTINUIDAD) ===\n${context.previousBlocks.map((b) => `[Bloque: "${b.title}"]\n${b.body.replace(/<[^>]+>/g, " ").slice(0, 500)}`).join("\n\n")}\n`
    : "";

  const currentBlockSection = currentBody && currentBody.trim()
    ? `\n=== PROPUESTA ACTUAL DEL BLOQUE QUE EL ADMINISTRADOR DESEA AJUSTAR ===
- Título actual: "${bTitle}"
- Contenido actual a modificar o complementar:
${currentBody.slice(0, 3000)}

INSTRUCCIONES CLAVE PARA EL AJUSTE:
- Si el administrador solicita cambiar el título (ej. "Cambiá el título a Requisitos"), actualiza el campo "title" con el nuevo título solicitado.
- Si el administrador solicita agregar o modificar datos, realiza el ajuste sobre el contenido manteniendo la coherencia factual.\n`
    : "";

  const countDirective = requestedCount > 0
    ? `DEBES GENERAR EXACTAMENTE ${requestedCount} ${isFaq ? "preguntas y sus correspondientes respuestas" : "puntos / párrafos"}. NI UNO MÁS NI UNO MENOS.`
    : "";

  const systemPrompt = `Eres un redactor editorial experto para Travelgrin.
Tu tarea es generar el bloque opcional "${bTitle}" para la publicación de la entidad "${entityName}".
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato:
{
  "title": "${bTitle}",
  "body": "<p>Contenido del bloque en español...</p>"
}

REGLAS DE MÁXIMA PRIORIDAD:
1. AUTORIDAD EDITORIAL SUPREMA: Cumple fielmente y al pie de la letra la directiva del administrador para este bloque:
   - ${countDirective || "Si el administrador pide una cantidad exacta (ej: '2 preguntas'), GENERA EXACTAMENTE esa cantidad (ni más ni menos)."}
   - TÍTULO TEMÁTICO: El título '${bTitle}' define la temática central del bloque si el prompt del administrador solo indica formato, estilo o colores (ej: si el título es "Preguntas Frecuentes" y el prompt dice "2 preguntas en rojo y su respuesta en negro", genera 2 preguntas frecuentes reales con sus respuestas sobre la entidad).
   - CONTEXTO ANTERIOR: Si el administrador pide que tengas en cuenta la descripción o bloques anteriores, revísalos e integra la información manteniendo total coherencia.
   - FORMATO Y COLORES: Si pide colores específicos (ej: "preguntas en rojo y su respuesta en negro" o "de azul el título"), aplica el estilo en línea exacto: <p><strong style="color: #dc2626;">¿Pregunta en rojo?</strong><br/><span style="color: #000000;">Respuesta en negro...</span></p>. Si no pide color, usa formato estándar (<p><strong>¿Pregunta?</strong><br/>Respuesta...</p>).
   - EMOJIS O ÍCONOS: Si pide incluir emojis, viñetas o símbolos, inclúyelos con libertad.
2. CERO BASURA DE FORMULARIOS: ESTÁ ESTRICTAMENTE PROHIBIDO copiar botones de navegación, menús o wizards de filtros interactivos de la web (como '¿Qué estás buscando?' o '¿Cuál va a ser tu próximo paso?'). Formula preguntas informativas reales sobre carreras, servicios, admisiones, requisitos, horarios o atención de la entidad.
3. REGLA DE IDIOMA: Redacta EXCLUSIVAMENTE en ESPAÑOL. No traduzcas a inglés, portugués ni italiano.
4. TÍTULO LIMPIO: Mantén el título conceptual del bloque ('${bTitle}') sin agregar nombres de la entidad.
5. Fidelidad factual: Usa los datos reales del sitio web de "${entityName}" (servicios, carreras, propuestas, requisitos).
6. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `TÍTULO DEL BLOQUE: "${bTitle}"
${mainDescSection}${previousBlocksSection}${currentBlockSection}
=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR PARA ESTE BLOQUE (MÁXIMA PRIORIDAD) ===
"${bPrompt || (isFaq ? `Generar preguntas frecuentes con sus respuestas pertinentes basadas en los servicios, turnos, atención y datos del sitio.` : "Redactar información estructurada y útil para este bloque.")}"${variationDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- Nombre oficial: "${entityName}"
- Ubicación: "${locationText || "No informada"}"
- Encabezados principales: ${(context.headings || []).slice(0, 10).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 8).join(" | ") || "N/A"}
- Párrafos destacados: ${(context.paragraphs || []).slice(0, 6).join("\n") || (context.metaDescription || "")}

GENERA EL CONTENIDO EN HTML DENTRO DEL JSON CUMPLIENDO ESTRICTAMENTE LA DIRECTIVA DEL ADMINISTRADOR.`;

  console.log(`\n[AI-AGENT-DEBUG: CustomBlockAgent - ${bTitle}]`);
  console.log(`1. Block Prompt: "${bPrompt || "(Sin prompt específico)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto",
      1200
    );

    console.log(`2. Provider Used: ${providerUsed}`);
    console.log(`3. Raw Response: ${rawText}`);

    const parsed = extractJson(rawText);
    let bodyContent = String(
      parsed?.body ||
      parsed?.bodyI18n?.es ||
      parsed?.contenido ||
      parsed?.description ||
      ""
    ).trim();

    if (!bodyContent) {
      const cleanedRaw = rawText
        .replace(/```(?:json|html)?/gi, "")
        .replace(/```/g, "")
        .trim();
      if (cleanedRaw.length >= 5 && !cleanedRaw.startsWith("{")) {
        bodyContent = cleanedRaw;
      }
    }

    if (!bodyContent || bodyContent.length < 5) {
      throw new Error("El modelo devolvió un bloque vacío.");
    }

    if (!bodyContent.includes("<p>")) {
      bodyContent = bodyContent
        .split(/\n\s*\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("\n");
    }

    // Prioritize clean bTitle unless explicitly adjusted
    let genTitle = (bTitle && bTitle.toLowerCase() !== "información adicional")
      ? bTitle
      : cleanTitleString(String(parsed?.titulo || parsed?.title || parsed?.nombre || bTitle).trim()) || bTitle;

    genTitle = cleanGenericBlockTitle(genTitle, bPrompt);
    if (entityName && genTitle.toLowerCase().includes(entityName.toLowerCase())) {
      try {
        genTitle = genTitle.replace(new RegExp(`\\s*(?:[-–—|]|(?:\\b(?:en|de|del|para|sobre|con)\\s+(?:la|el|los|las)?))\\s*${escapeRegExp(entityName)}.*$`, "i"), "").trim();
      } catch {}
    }
    if (!genTitle) genTitle = bTitle || "Información Adicional";

    const filtered = enforceFaqCountAndFilter(bodyContent, bPrompt);
    const finalBody = applyPromptColorStyles(filtered, bPrompt);

    const bI18n: I18nRecord = {
      es: finalBody,
      en: "",
      pt: "",
      it: "",
    };

    return {
      title: genTitle,
      titleI18n: { es: genTitle, en: "", pt: "", it: "" },
      body: finalBody,
      bodyI18n: bI18n,
      visibleInCard: false,
      estado: "ok",
      contenido: finalBody,
      evidencias: parsed?.evidencias || [entityName],
      prompt: blockPrompt,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: CustomBlockAgent - ${bTitle}] ERROR: ${err.message}`);
    const isFaq = /faq|preguntas?\s+frecuentes?|dudas?|consultas?/i.test(bTitle) || /pregunt/i.test(blockPrompt || "");
    let fallbackBody = "";
    if (isFaq) {
      const hList = (context.headings || []).filter((h) => h && h.length > 3 && h.length < 80 && !/cookies|men[uú]|login|iniciar/i.test(h));
      const sList = (context.servicesList || []).filter(Boolean);
      const items: string[] = [];
      const targetCount = requestedCount || 4;

      if (hList.length > 0) {
        for (const h of hList.slice(0, Math.min(targetCount, hList.length))) {
          items.push(`<p><strong>¿Qué ofrece ${entityName} en relación a ${h}?</strong><br/>En ${h}, ${entityName} brinda soluciones y servicios específicos detallados con información actualizada en su plataforma oficial.</p>`);
        }
      }
      if (sList.length > 0 && items.length < targetCount) {
        for (const s of sList.slice(0, targetCount - items.length)) {
          items.push(`<p><strong>¿Cómo acceder a los servicios de ${s}?</strong><br/>Es posible consultar requisitos, modalidades y disponibilidad para ${s} directamente a través de sus canales oficiales habilitados.</p>`);
        }
      }
      if (items.length === 0) {
        items.push(`<p><strong>¿Qué servicios y propuestas brinda ${entityName}?</strong><br/>${context.metaDescription || `${entityName} ofrece soluciones y prestaciones de calidad detalladas en su sitio oficial.`}</p>`);
        items.push(`<p><strong>¿Cómo contactar o solicitar información oficial?</strong><br/>Podés comunicarte a través de los canales de atención y vías oficiales del establecimiento.</p>`);
      }
      fallbackBody = items.join("\n");
    } else {
      const pText = (context.paragraphs || []).slice(0, 3).join("\n\n") || context.metaDescription || `Información y detalles oficiales de ${entityName}.`;
      fallbackBody = pText.split(/\n\s*\n+/).filter(Boolean).map((p) => `<p>${p.trim()}</p>`).join("\n");
    }

    fallbackBody = applyPromptColorStyles(fallbackBody, blockPrompt);

    return {
      title: bTitle,
      titleI18n: { es: bTitle, en: "", pt: "", it: "" },
      body: fallbackBody,
      bodyI18n: { es: fallbackBody, en: "", pt: "", it: "" },
      visibleInCard: false,
      estado: "ok",
      contenido: fallbackBody,
      evidencias: [entityName],
      prompt: blockPrompt,
    };
  }
}

// ============================================================================
// 4. MINI-AGENTE DE INFORMACIÓN DEL PROVEEDOR (ProviderInfoAgent)
// ============================================================================
export interface ProviderInfoResult {
  providerInfo: string;
  providerInfoI18n: I18nRecord;
  detectedPublisherName?: string;
  detectedAddress?: string;
  detectedCity?: string;
  detectedCountry?: string;
}

export async function runProviderInfoAgent(
  context: CleanScrapedContext,
  adminPrompt?: string
): Promise<AgentResult<ProviderInfoResult>> {
  const prompt = (adminPrompt || "").trim();
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const variationDirective = context.variationIndex && context.variationIndex > 1
    ? `\n\nVARIACIÓN ALTERNATIVA #${context.variationIndex}:\nGenerar una propuesta diferente y alternativa (otra redacción concisa), manteniendo rigurosamente la directiva editorial del administrador.`
    : "";

  const systemPrompt = `Eres un redactor e investigador institucional experto para Travelgrin.
Tu objetivo primordial es identificar con rigurosa precisión al oferente / institución / empresa real y redactar un perfil informativo verídico y conciso basado en la web provista.
Tu tarea es devolver EXCLUSIVAMENTE un objeto JSON válido con este formato exacto:
{
  "estado": "ok",
  "nombreOferente": "Nombre oficial y verdadero de la empresa o institución (si el sitio usa una sigla o acrónimo como CTPPC, UTN, UBA, CPCE, OSEP, OSDE, etc., investiga y escribe obligatoriamente el NOMBRE INSTITUCIONAL COMPLETO desplegado)",
  "direccionVigente": "Dirección física operativa actual extraída del pie de página (footer) o sección de contacto (descartando notas viejas o artículos de prensa históricos archivados en el cuerpo)",
  "ciudad": "Ciudad de la sede principal",
  "pais": "País",
  "contenido": "Breve descripción del oferente o institución aquí (1 o 2 oraciones profesionales basadas en datos reales de la web)",
  "evidencias": ["frase o dato de la web"]
}

REGLAS DE MÁXIMA PRIORIDAD:
1. IDENTIFICACIÓN PRECISA DEL OFERENTE Y RESOLUCIÓN OBLIGATORIA DE SIGLAS:
   - Determina con total precisión el nombre oficial y verdadero de la entidad, empresa u organización responsable.
   - Si el título de la página, nombre preliminar o dominio es una SIGLA o ACRÓNIMO (ej: "CTPPC", "UBA", "UTN", "OSDE", "CPCE", etc.), OBLIGATORIAMENTE investiga y escribe el NOMBRE INSTITUCIONAL COMPLETO desplegado (ej: "Colegio de Traductores Públicos de la Provincia de Córdoba" en lugar de "CTPPC"). NUNCA dejes la sigla sola si el nombre completo institucional se menciona en la web o en la realidad.
   - Si el título de la página es un programa, evento, convocatoria o curso (por ejemplo: "Córdoba GovTech", "Programa Talento", "Becas 2024", etc.), identifica cuál es la institución o empresa responsable matriz.
2. DIRECCIÓN FÍSICA VIGENTE VS HISTÓRICA:
   - Identifica la dirección operativa actual del pie de página (footer) o contacto oficial en "direccionVigente". NUNCA tomes direcciones de noticias viejas o artículos archivados del cuerpo.
3. CERO PLANTILLAS GENÉRICAS Y ALEATORIEDAD OBLIGATORIA:
   - Prohibido terminantemente usar frases clichés vacías como "Institución y prestador de servicios en Córdoba". Describe la actividad concreta, funciones o propósito real del oferente.
   - VARIEDAD EN CADA SCRAPING: Cada perfil debe tener un enfoque diferente y aleatorio (en algunas ocasiones destaca su tecnología o equipamiento, en otras su trayectoria y prestigio profesional, en otras la calidez y atención de su equipo multidisciplinario, o su liderazgo regional).
4. Concisión: Redacta 1 o 2 oraciones concisas y profesionales en tercera persona.
5. Formato estricto: Devuelve únicamente el objeto JSON sin texto fuera del JSON.`;

  const userPrompt = `=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- URL: "${context.url}"
- Nombre preliminar detectado: "${entityName}"
- Título original de la página: "${context.rawPageTitle || entityName}"
- Ubicación: "${locationText || "No informada"}"
- Dirección preliminar detectada: "${context.address || "No informada"}"
- Resumen y párrafos de la web:
"${(context.metaDescription || context.paragraphs?.slice(0, 5).join(" ") || context.mainText?.slice(0, 1200) || "").slice(0, 1500)}"

=== DIRECTIVA EDITORIAL DEL ADMINISTRADOR (SI APLICA) ===
"${prompt || `Describir con precisión factual y profesional a ${entityName} y su alcance real.`}"${variationDirective}

GENERA EL OBJETO JSON IDENTIFICANDO EL NOMBRE OFICIAL COMPLETO DEL OFERENTE, SU DIRECCIÓN VIGENTE Y SU DESCRIPCIÓN FACTUAL.`;

  console.log(`\n[AI-AGENT-DEBUG: ProviderInfoAgent]`);
  console.log(`1. Admin Prompt: "${prompt || "(Sin prompt específico)"}"`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto"
    );

    const parsed = extractJson(rawText);
    let pInfo = String(
      parsed?.contenido ||
      parsed?.providerInfo ||
      parsed?.informacion ||
      parsed?.texto ||
      ""
    ).trim();

    const detectedPubName = cleanTitleString(
      String(parsed?.nombreOferente || parsed?.nombre || parsed?.oferente || "").trim()
    );
    const detectedAddr = cleanTitleString(
      String(parsed?.direccionVigente || parsed?.direccion || "").trim()
    );
    const detectedCityVal = cleanTitleString(
      String(parsed?.ciudad || "").trim()
    );
    const detectedCountryVal = cleanTitleString(
      String(parsed?.pais || "").trim()
    );

    if (!pInfo) {
      const cleanedRaw = rawText
        .replace(/```(?:json)?/gi, "")
        .replace(/```/g, "")
        .trim();
      if (cleanedRaw.length >= 5 && !cleanedRaw.startsWith("{")) {
        pInfo = cleanedRaw;
      }
    }

    if (!pInfo || pInfo.includes("es un establecimiento y prestador de servicios") || pInfo.length < 20) {
      pInfo = buildRichProviderInfo(entityName, context.city || "", context.country || "", context);
    }

    const pEn = "";
    const pPt = "";
    const pIt = "";

    return {
      success: true,
      data: {
        providerInfo: pInfo,
        providerInfoI18n: { es: pInfo, en: pEn, pt: pPt, it: pIt },
        detectedPublisherName: detectedPubName || undefined,
        detectedAddress: detectedAddr || undefined,
        detectedCity: detectedCityVal || undefined,
        detectedCountry: detectedCountryVal || undefined,
      },
      estado: "ok",
      evidencias: parsed?.evidencias || [entityName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: ProviderInfoAgent] ERROR: ${err.message}`);
    return {
      success: false,
      data: null,
      estado: "sin_datos",
      evidencias: [],
      providerUsed: "none",
      error: `Error al generar información del oferente: ${err.message}`,
    };
  }
}

// ============================================================================
// 5. TAXONOMY AGENT (ESTRICTO CATÁLOGO CERRADO - CERO ALUCINACIONES)
// ============================================================================
export interface TaxonomyAgentData {
  category: string;
  subcategory: string;
  categorySelections: string[];
  subcategorySelections: string[];
  providerActivities: string[];
  providerTypes: string[];
  providerModalities: string[];
  prestaciones?: string[];
  languages: string[];
}

function matchToCatalogPool(items: string[], pool: string[]): string[] {
  if (!pool || pool.length === 0) return items.filter(Boolean);
  const poolWithNorm = pool.map((p) => ({
    original: p,
    norm: p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(),
  }));
  const matched = new Set<string>();
  for (const item of items) {
    const itemNorm = String(item || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!itemNorm) continue;
    // Ignorar frases de relleno o placeholders
    if (/^(?:categoria|actividad|tipo|modalidad|ninguna|ninguno|n\/?a|vacio|sin\s*categoria|sin\s*datos)$/i.test(itemNorm)) continue;

    const exact = poolWithNorm.find((p) => p.norm === itemNorm);
    if (exact) {
      matched.add(exact.original);
      continue;
    }
    // Strict word-boundary matching: never match a partial word like "cultura" inside "agricultura"!
    const escapedItem = itemNorm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const substring = poolWithNorm.find((p) => {
      const escapedP = p.norm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return (
        new RegExp(`\\b${escapedItem}\\b`, "i").test(p.norm) ||
        new RegExp(`\\b${escapedP}\\b`, "i").test(itemNorm)
      );
    });
    if (substring) {
      matched.add(substring.original);
      continue;
    }
    // Token matching: requerir tokens distintivos (longitud >= 5 y no palabras genéricas)
    const itemTokens = itemNorm.split(/\s+/).filter((t) => t.length >= 5 && !/^(?:para|sobre|centro|centros|servicio|servicios|general|generales|opcion|opciones|requisito|requisitos|previo|previos|explorando|explorar|paso|pasos|nivel|niveles|inicio|inicios|bienvenida|bienvenido|bienvenidos|etapa|etapas|plan|planes|especializado|especializada|especializados|especializadas|gestiones|tramites)$/i.test(t));
    if (itemTokens.length > 0) {
      const tokenMatch = poolWithNorm.find((p) => {
        const poolTokens = p.norm.split(/\s+/).filter((t) => t.length >= 5);
        return itemTokens.some((t) => {
          const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`\\b${escaped}\\b`, "i").test(p.norm);
        }) && poolTokens.some((pt) => {
          const escapedPt = pt.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`\\b${escapedPt}\\b`, "i").test(itemNorm);
        });
      });
      if (tokenMatch) {
        matched.add(tokenMatch.original);
      }
    }
  }
  return Array.from(matched);
}

export async function runTaxonomyAgent(
  context: CleanScrapedContext,
  taxonomies: {
    categoryTree?: Array<{ blockName: string; parentCategories: Array<{ name: string; subcategories: string[] }> }>;
    categories?: string[];
    subcategories?: string[];
    activities?: string[];
    types?: string[];
    modalities?: string[];
    prestaciones?: string[];
    languages?: string[];
  }
): Promise<AgentResult<TaxonomyAgentData>> {
  const allParentCategoriesFromTree = (taxonomies?.categoryTree || []).flatMap((b) => b.parentCategories.map((p) => p.name));
  const categoriesPool = Array.from(new Set([...(taxonomies?.categories || []), ...allParentCategoriesFromTree].filter(Boolean)));

  const allSubcategoriesFromTree = (taxonomies?.categoryTree || []).flatMap((b) => b.parentCategories.flatMap((p) => p.subcategories));
  const subcategoriesPool = Array.from(new Set([...(taxonomies?.subcategories || []), ...allSubcategoriesFromTree].filter(Boolean)));

  const activitiesPool = taxonomies?.activities || [];
  const typesPool = taxonomies?.types || [];
  const modalitiesPool = taxonomies?.modalities || [];
  const prestacionesPool = taxonomies?.prestaciones || [];
  const languagesPool = (taxonomies?.languages && taxonomies.languages.length > 0)
    ? taxonomies.languages
    : ["Español", "Inglés", "Portugués", "Italiano", "Alemán", "Francés"];

  const categoryTreeFormat = (taxonomies?.categoryTree || []).length
    ? taxonomies.categoryTree!
        .map(
          (block: any) =>
            `=== BLOQUE: "${block.blockName}" (Propósito / Taxonomía: ${block.blockTaxonomy || "general"}) ===\n` +
            block.parentCategories
              .map(
                (cat: any) =>
                  `  - Categoría: "${cat.name}" ${cat.categoryTaxonomy && cat.categoryTaxonomy !== "categoria" ? `[Taxonomía específica: ${cat.categoryTaxonomy}]` : ""}\n` +
                  (cat.subcategories && cat.subcategories.length
                    ? `    Subcategorías: ${cat.subcategories.map((s: string) => `"${s}"`).join(", ")}`
                    : `    Subcategorías: (ninguna)`)
              )
              .join("\n")
        )
        .join("\n\n")
    : categoriesPool.map((c) => `- "${c}"`).join("\n");

  const systemPrompt = `Eres el Lead AI Auditor y Clasificador de Taxonomías de Travelgrin.
Tu objetivo es clasificar con máxima precisión el contenido de un sitio web dentro del CATÁLOGO OFICIAL Y CERRADO de categorías y taxonomías del sistema.

REGLAS CRÍTICAS Y OBLIGATORIAS:
1. CATÁLOGO ESTRICTAMENTE CERRADO (CERO ALUCINACIONES):
   - Está TERMINANTEMENTE PROHIBIDO crear, inventar, traducir o proponer nombres de categorías, subcategorías, actividades, tipos de perfil o modalidades que NO figuren explícitamente en el catálogo suministrado.
   - Debes elegir ÚNICAMENTE elementos existentes en las listas provistas a continuación.
2. CATEGORÍAS Y SUBCATEGORÍAS PERTINENTES (SELECCIÓN MÚLTIPLE):
   - 'categorySelections': Array con 1 o más categorías padre del catálogo oficial cerrado que correspondan genuinamente al oferente y a lo que ofrece según la web. Debes seleccionar las que sean verdaderamente relevantes.
   - 'subcategorySelections': Array con las subcategorías válidas (hijas de las categorías padre seleccionadas) que correspondan a sus servicios o actividad según la web. Si ninguna subcategoría aplica a lo que ofrece la web, devuelve array vacío []. NO inventes ni fuerces subcategorías que no correspondan.
   - 'category': La categoría principal (primer elemento de 'categorySelections').
   - 'subcategory': La subcategoría principal (primer elemento de 'subcategorySelections' o "" si no aplica ninguna).
3. SECTOR DE QUIEN OFRECE / ACTIVIDAD ('providerActivities'):
   - Selecciona 1 o más actividades ÚNICAMENTE de la lista 'SECCIÓN ACTIVIDADES' del catálogo de abajo (correspondiente a la actividad o sector económico real del sitio web). Si ninguna opción del catálogo aplica, devuelve array vacío []. NUNCA inventes nombres de actividad.
   - PROHIBIDO TERMINANTEMENTE colocar tipos de oferente como "Empresa", "Institución privada" u "Organismo público" en actividades. "Empresa" NO es una actividad; es un tipo de perfil.
4. QUIÉN LO OFRECE / TIPO DE OFERENTE ('providerTypes'):
   - Selecciona ÚNICAMENTE de la lista 'SECCIÓN TIPO DE OFERENTE' del catálogo de abajo analizando quién es el propietario o responsable del sitio web. Si ninguna opción del catálogo aplica, devuelve array vacío [].
5. MODALIDADES DE ATENCIÓN ('providerModalities'):
   - Selecciona ÚNICAMENTE de la lista 'SECCIÓN MODALIDAD' del catálogo de abajo según cómo ofrece o presta sus servicios el sitio web. Si ninguna opción del catálogo aplica, devuelve array vacío [].
8. PREVENCIÓN ESTRICTA DE FALSAS ONGs (REGLA MANDATORIA):
   - NUNCA clasifiques un sitio web como "ONG", "Fundación", "Organización sin fines de lucro" o tipo "ONG" a menos que demuestre explícitamente personería jurídica y condición estatutaria de entidad sin fines de lucro (ej. dominio .org no comercial con misión social comprobada).
   - Las universidades, empresas comerciales, startups, plataformas digitales, comercios, clínicas y academias privadas NO SON ONGs. Está TERMINANTEMENTE PROHIBIDO asignarles categorías, subcategorías o tipos de perfil de ONG.

9. COMPRENSIÓN DINÁMICA DE BLOQUES Y TAXONOMÍAS DEL ADMINISTRADOR:
   - El administrador crea BLOQUES y les asigna un tipo de taxonomía (actividad, tipo, modalidad, categoría, idiomas).
   - Cada bloque contiene categorías y subcategorías creadas por el admin (SIN PLANTILLAS FIJAS).
   - Analiza la información de CADA bloque con sus opciones correspondientes y clasifica con máxima precisión:
     a) 'providerActivities': Opciones pertenecientes a bloques/categorías de actividad del catálogo que coincidan genuinamente con la entidad (o [] si ninguna aplica).
     b) 'providerTypes': Opciones pertenecientes a bloques/categorías de tipo del catálogo (o [] si ninguna aplica).
     c) 'providerModalities': Opciones pertenecientes a bloques/categorías de modalidad del catálogo (o [] si ninguna aplica).
     d) 'categorySelections' y 'subcategorySelections': Opciones pertenecientes a los bloques de categorías del catálogo (o [] si ninguna aplica).
   - ESTÁ TERMINANTEMENTE PROHIBIDO inventar opciones o categorías fuera del catálogo oficial suministrado. Si no hay opciones aplicables, devuelve array vacío [].

${buildTaxonomyCatalogPromptSection(taxonomies)}

Responde ÚNICAMENTE con un JSON con esta estructura exacta:
{
  "category": "...",
  "subcategory": "...",
  "categorySelections": ["..."],
  "subcategorySelections": ["..."],
  "providerActivities": ["..."],
  "providerTypes": ["..."],
  "providerModalities": ["..."],
  "prestaciones": ["..."],
  "languages": ["..."]
}`;

  const snippet = [
    (context.headings || []).slice(0, 15).join(" | "),
    (context.paragraphs || []).slice(0, 12).join("\n"),
    (context.mainText || "").slice(0, 4500),
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = `Lee con detenimiento e infórmate a fondo sobre lo que ofrece esta entidad en su web para clasificarla con máxima precisión en el catálogo cerrado:
- URL: ${context.url}
- Nombre Oferente / Organización: ${context.publisherName}
- Título Detectado: ${context.rawPageTitle || ""}
- Meta Descripción: ${context.metaDescription || ""}
- Ubicación: ${[context.city, context.country].filter(Boolean).join(", ")}
- Contenido relevante y servicios detectados:
${snippet}

INSTRUCCIONES CLAVE DE SELECCIÓN:
1. 'providerActivities': Selecciona la actividad o sector económico REAL de la organización de la lista de ACTIVIDADES DISPONIBLES EN BD (NUNCA pongas "Empresa", "Institución privada" ni tipos de perfil aquí).
2. 'providerTypes': Selecciona el tipo de entidad REAL de la lista de TIPOS DE PERFIL DISPONIBLES EN BD.
3. 'providerModalities': Selecciona la o las modalidades REALES ("Atención presencial" si tiene sede o local físico, "Atención online" si opera de forma digital o remota, o ambas).
4. 'categorySelections': Selecciona la/s categoría/s del catálogo que mejor correspondan a lo que ofrece la entidad según su web.
5. 'subcategorySelections': Selecciona ÚNICAMENTE las subcategorías (hijas de las categorías seleccionadas) que apliquen de verdad a sus servicios. Si ninguna subcategoría aplica, devuelve array vacío []. NO inventes ni fuerces subcategorías innecesarias.
Recuerda: Elige ÚNICAMENTE nombres exactos de las listas provistas.`;

  try {
    let parsed: any = null;
    let providerUsed = "semantic-catalog-engine";

    try {
      const res = await executeModelCall(
        systemPrompt,
        userPrompt,
        context.apiKey,
        context.provider || "auto"
      );
      providerUsed = res.providerUsed;
      parsed = extractJson(res.rawText);
    } catch (errCall: any) {
      console.warn(`[AI-AGENT-DEBUG: TaxonomyAgent] LLM call failed or unavailable, falling back to dynamic catalog evaluation: ${errCall.message}`);
    }

    if (!parsed) {
      parsed = {
        categorySelections: [],
        subcategorySelections: [],
        category: "",
        subcategory: "",
        providerActivities: [],
        providerTypes: [],
        providerModalities: [],
        prestaciones: [],
        languages: ["Español"],
      };
    }

    const fullTextCorpus = `${context.rawPageTitle || ""} ${context.headings?.join(" ") || ""} ${context.paragraphs?.join(" ") || ""} ${context.mainText || ""} ${context.url} ${context.publisherName || ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const isHealthEntity =
      /\b(salud|medico|medica|medicos|medicas|medicina|clinica|hospital|sanatorio|obra social|prepaga|paciente|pacientes|enfermeria|atencion medica|consultorio|consultorios|asistencial|prestaciones medicas|farmacia|odontologia|psicologia|pediatria|traumatologia|cardiologia|osep|ioma|pami|osde|swiss medical)\b/i.test(fullTextCorpus) ||
      /osep|hospital|clinica|sanatorio|salud/i.test(context.url || "");

    const isMediaOrSportsOrEntertainment =
      /\b(deportv|televisi[oó]n|streaming|transmisi[oó]n|transmisiones|canal de tv|deportes?|f[uú]tbol|automovilismo|boxeo|tenis|b[aá]squet|torneo|liga profesional|espect[aá]culos?|teatro|cine)\b/i.test(fullTextCorpus) ||
      /deportv|tv|deporte|streaming/i.test(context.url || "");

    const isEducationalEntity =
      !isMediaOrSportsOrEntertainment &&
      !isHealthEntity &&
      (/\b(universidad|facultad|carrera universitaria|carreras universitarias|licenciatura|tecnicatura|alumnos?|estudiantes?|vida estudiantil|campus universitario|matr[ií]cula acad[eé]mica|aranceles acad[eé]micos|inscripciones a carreras|ingreso universitario|becas de estudio|docentes? universitarios?|profesorado|instituto superior|colegio|escuela|centro de estudios|siglo 21)\b/i.test(fullTextCorpus) ||
      (/\.edu(?:\.[a-z]{2})?/i.test(context.url || "") && !isHealthEntity));

    const isLegalOrConsulting =
      /\b(abogado|abogada|abogados|estudio juridico|notario|notaria|escribano|escribania|derecho|legal|migratorio|migracion|visas|visa|ciudadania|residencia|contable|auditoria|consultoria|asesoria fiscal|traduccion publica|cbi argentina|allende|brea)\b/i.test(fullTextCorpus) ||
      /legal|migra|visas|estudio/i.test(context.url || "");

    const isFashionOrDesign =
      /\b(moda|modas|diseno de indumentaria|indumentaria|textil|textiles|vestimenta|ropa|calzado|alta costura|fashion|prendas|confeccion|desfile|coleccion primavera|tendencias de moda|marcas de ropa)\b/i.test(fullTextCorpus);

    const isEntertainmentOrCulture =
      /\b(entretenimiento|espectaculo|espectaculos|teatro|cine|musica|concierto|conciertos|arte|cultura|cultural|eventos culturales|festival|festivales|recreacion|audiovisual|productora|producciones|galeria de arte|museo|museos|discoteca|boliche|ocio)\b/i.test(fullTextCorpus);

    const isRealEstate =
      /\b(inmobiliaria|inmobiliario|bienes raices|alquiler de propiedades|venta de casas|inmuebles|real estate|desarrollos inmobiliarios|lotes|terrenos)\b/i.test(fullTextCorpus) &&
      !isLegalOrConsulting;

    const isSportsOrGym =
      /\b(gimnasio|gym|fitness|crossfit|calistenia|musculacion|entrenamiento\s+funcional|complejo\s+deportivo|polideportivo|club\s+deportivo|natatorio|pileta\s+climatizada|artes\s+marciales|boxeo|padel|paddle|tenis|futbol|hockey|rugby|basket|baloncesto|voleibol|atletismo|deporte|deportes|deportivo|deportiva|acondicionamiento\s+fisico)\b/i.test(fullTextCorpus) ||
      /\b(gimnasio|gym|fitness|deporte|deportes|deportivo|polideportivo)\b/i.test(context.url || "");

    const isTourismEntity =
      !isEducationalEntity &&
      !isHealthEntity &&
      !isLegalOrConsulting &&
      !isSportsOrGym &&
      /\b(hotel|hostel|alojamiento|hospedaje|posada|cabaña|cabañas|resort|turismo|viajes|excursion|excursiones|agencia de viajes|tour|tours)\b/i.test(fullTextCorpus);

    const isTechEntity =
      /\b(software|tecnologia|tecnologias|app|aplicacion|sistemas|desarrollo web|programacion|informatica|it|ciberseguridad|telecomunicaciones|saas|plataforma digital)\b/i.test(fullTextCorpus);

    const isAuthenticOng =
      (/\.org(?:\.[a-z]{2})?|\.ngo(?:\.[a-z]{2})?/i.test(context.url || "")) &&
      /\b(sin fines de lucro|organismo no gubernamental|asociacion civil sin fines de lucro|fundacion sin fines de lucro|donaciones para la fundacion)\b/i.test(fullTextCorpus) &&
      !isEducationalEntity &&
      !isHealthEntity &&
      !/\b(empresa s\.a\.|empresa s\.r\.l\.|sociedad anonima|startup|e-commerce|tienda online|hotel|agencia de viajes|clinica privada|sanatorio privado)\b/i.test(fullTextCorpus);

    const isOngMatch = (name: string): boolean => {
      const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return /\b(?:ong|sin fines de lucro|fundaci[oó]n|asociaci[oó]n civil|tercer sector|voluntariado|ayuda social)\b/i.test(n) ||
        /sin fines de lucro|organismo no gubernamental|asociacion civil|voluntariado|ayuda social/i.test(n);
    };

    const isStudentEduMatch = (name: string): boolean => {
      const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      return /\b(?:estudiant|universi|educa|carrera|alumno|academ|formaci|posgrado|grado|beca|colegio|instituto|facultad|intercambio|convocatoria|programa)\w*/i.test(n) ||
        /estudiante|universidad|educacion|carrera|formacion|posgrado|grado|beca|colegio|instituto|programa|intercambio|convocatoria/i.test(n);
    };

    // Strict multi-select category validation against DB pool
    const rawCategories: string[] = [
      ...(Array.isArray(parsed.categorySelections) ? parsed.categorySelections : []),
      parsed.category,
    ]
      .map((c) => String(c || "").trim())
      .filter(Boolean)
      .filter((c) => isAuthenticOng || !isOngMatch(c));

    let matchedCats = matchToCatalogPool(rawCategories, categoriesPool);

    // Filter out ONG categories if not an authentic ONG
    if (!isAuthenticOng) {
      matchedCats = matchedCats.filter((c) => !isOngMatch(c));
    }

    // Safety guardrail: Medical and health entities must NEVER contain visa, migration, course, training, or job convocatoria categories
    if (isHealthEntity) {
      matchedCats = matchedCats.filter((c) => {
        const cNorm = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|guardia/i.test(cNorm)) return true;
        if (/curso|formaci|capacitaci|convocatoria|empleo|beca|visa|migra/i.test(cNorm)) return false;
        return false;
      });
    }

    const nonOngPool = isAuthenticOng ? categoriesPool : categoriesPool.filter((c) => !isOngMatch(c));

    // Dynamic semantic matching across all available DB categories if AI did not return a valid exact match
    if (matchedCats.length === 0 && nonOngPool.length > 0) {
      const scoredCats: { cat: string; score: number }[] = [];
      for (const catName of nonOngPool) {
        const cNorm = catName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const cTokens = cNorm.split(/\s+/).filter((t) => t.length > 3 && !/^(?:para|sobre|centro|centros|servicio|servicios|general|generales|opcion|opciones|requisito|requisitos|previo|previos|explorando|explorar|paso|pasos|nivel|niveles|inicio|inicios|bienvenida|bienvenido|bienvenidos|etapa|etapas|plan|planes|especializado|especializada|especializados|especializadas)$/i.test(t));
        let score = 0;

        // Hard negative constraint: If entity is medical/health, NEVER match visa/migration, course, or job categories!
        if (isHealthEntity && /curso|formaci|capacitaci|convocatoria|empleo|beca|visa|migra/i.test(cNorm) && !/salud|medic|asistenc|hospital|clinica|sanatori|odontolog|farmaci/i.test(cNorm)) {
          continue;
        }
        if (isHealthEntity && !/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|obra\s*social|prepaga|guardia/i.test(cNorm)) {
          continue;
        }
        // If entity is university/education, NEVER match visa/migration categories
        if (isEducationalEntity && /visa|migra/i.test(cNorm)) {
          continue;
        }
        // Gym/Sports: never match false onboarding or generic categories
        if (isSportsOrGym && /explorando\s*opciones|servicio\s*especializado|requisitos?\s*previos?/i.test(cNorm)) {
          continue;
        }

        if (fullTextCorpus.includes(cNorm)) score += 50;
        for (const tok of cTokens) {
          const escapedTok = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (new RegExp(`\\b${escapedTok}\\b`, "i").test(fullTextCorpus)) score += 15;
        }

        // Check child subcategories belonging to this category in the categoryTree
        if (taxonomies?.categoryTree?.length) {
          const allParentNodes = taxonomies.categoryTree.flatMap((b) => b.parentCategories);
          const matchedNode = allParentNodes.find((p) => p.name.toLowerCase() === catName.toLowerCase());
          if (matchedNode && Array.isArray(matchedNode.subcategories)) {
            for (const sub of matchedNode.subcategories) {
              const sNorm = sub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
              if (isSportsOrGym && /explorando\s*opciones|servicio\s*especializado|requisitos?\s*previos?/i.test(sNorm)) continue;
              if (isHealthEntity && /curso|formaci|capacitaci|convocatoria|empleo|beca|visa|migra/i.test(sNorm) && !/salud|medic|asistenc|hospital|clinica|sanatori|odontolog|farmaci/i.test(sNorm)) continue;
              const sTokens = sNorm.split(/\s+/).filter((t) => t.length > 3 && !/^(?:para|sobre|centro|centros|servicio|servicios|general|generales|opcion|opciones|requisito|requisitos|previo|previos|explorando|explorar|paso|pasos|nivel|niveles|inicio|inicios|bienvenida|bienvenido|bienvenidos|etapa|etapas|plan|planes|especializado|especializada|especializados|especializadas)$/i.test(t));
              if (fullTextCorpus.includes(sNorm)) score += 35;
              for (const tok of sTokens) {
                const escapedTok = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                if (new RegExp(`\\b${escapedTok}\\b`, "i").test(fullTextCorpus)) score += 10;
              }
            }
          }
        }

        if (isEducationalEntity && isStudentEduMatch(catName)) score += 60;
        if (isHealthEntity && /salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|obra\s*social|prepaga/i.test(cNorm)) score += 80;

        if (score >= 25) {
          scoredCats.push({ cat: catName, score });
        }
      }

      scoredCats.sort((a, b) => b.score - a.score);
      if (scoredCats.length > 0) {
        matchedCats = [scoredCats[0].cat];
        if (scoredCats[1] && scoredCats[1].score >= 35 && scoredCats[1].score >= scoredCats[0].score * 0.7) {
          matchedCats.push(scoredCats[1].cat);
        }
      }
    }

    // Safety guardrail: Medical entities must NEVER contain visa, immigration, course, or job categories
    if (isHealthEntity) {
      matchedCats = matchedCats.filter((c) => {
        const cNorm = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|guardia/i.test(cNorm)) return true;
        if (/curso|formaci|capacitaci|convocatoria|empleo|beca|visa|migra/i.test(cNorm)) return false;
        return false;
      });
    }

    // Never output "General" if not explicitly part of the categories pool in DB
    let finalCategories = matchedCats.filter((c) => c !== "General" || categoriesPool.includes("General"));
    const finalCat = finalCategories[0] || "";

    // Collect all valid subcategories belonging to any of the selected categories
    let validSubcatPool: string[] = [];
    if (taxonomies?.categoryTree?.length) {
      const allParentNodes = taxonomies.categoryTree.flatMap((b) => b.parentCategories);
      finalCategories.forEach((catName) => {
        const matchedNode = allParentNodes.find((p) => p.name.toLowerCase() === catName.toLowerCase());
        if (matchedNode && Array.isArray(matchedNode.subcategories) && matchedNode.subcategories.length > 0) {
          validSubcatPool.push(...matchedNode.subcategories);
        }
      });
    }
    if (validSubcatPool.length === 0 && finalCategories.length === 0) {
      validSubcatPool = subcategoriesPool;
    }
    validSubcatPool = Array.from(new Set(validSubcatPool.filter(Boolean)));
    if (!isAuthenticOng) {
      validSubcatPool = validSubcatPool.filter((s) => !isOngMatch(s));
    }

    // Strict multi-select subcategory validation
    const rawSubcategories: string[] = [
      ...(Array.isArray(parsed.subcategorySelections) ? parsed.subcategorySelections : []),
      parsed.subcategory,
    ]
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .filter((s) => isAuthenticOng || !isOngMatch(s));

    let matchedSubs = matchToCatalogPool(rawSubcategories, validSubcatPool);

    // Only if the AI returned no subcategories at all, check if an exact subcategory phrase exists in the text
    if (matchedSubs.length === 0 && rawSubcategories.length === 0 && validSubcatPool.length > 0) {
      for (const sub of validSubcatPool) {
        if (matchedSubs.includes(sub)) continue;
        if (!isAuthenticOng && isOngMatch(sub)) continue;

        const sNorm = sub.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (isHealthEntity && /curso|formaci|capacitaci|convocatoria|empleo|beca|visa|migra/i.test(sNorm) && !/salud|medic|asistenc|hospital|clinica|sanatori|odontolog|farmaci/i.test(sNorm)) continue;
        if (isEducationalEntity && /visa|migra/i.test(sNorm)) continue;

        // Require genuine presence of the full subcategory name in scraped text
        if (sNorm.length >= 4 && fullTextCorpus.includes(sNorm)) {
          matchedSubs.push(sub);
        }
      }
    }

    if (!isAuthenticOng) {
      matchedSubs = matchedSubs.filter((s) => !isOngMatch(s));
    }
    if (isHealthEntity) {
      matchedSubs = matchedSubs.filter((s) => {
        const sNorm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|guardia/i.test(sNorm)) return true;
        if (/curso|formaci|capacitaci|convocatoria|empleo|beca|visa|migra/i.test(sNorm)) return false;
        return false;
      });
    }

    // Strip phantom "General" if not explicitly in subcategories catalog
    matchedSubs = matchedSubs.filter((s) => s !== "General" || subcategoriesPool.includes("General"));

    // Completely remove blind fallback to validSubcatPool[0]: If no subcategory legitimately matches, leave empty
    const finalSub = matchedSubs[0] || "";

    // Activities: strictly match against activitiesPool and NEVER allow items from typesPool (e.g. Empresa)
    const rawActivities = Array.isArray(parsed.providerActivities) ? parsed.providerActivities : [parsed.providerActivities];
    const matchedActivities = matchToCatalogPool(rawActivities, activitiesPool);
    let cleanActivities = matchedActivities.filter((a) => !typesPool.includes(a));

    if (isEducationalEntity) {
      cleanActivities = cleanActivities.filter((a) => !/hosteler|turism|alojam|profesional|tecnic|agricult|ganader|pesca|miner|comercio/i.test(a));
    }

    if (isHealthEntity) {
      cleanActivities = cleanActivities.filter((a) => !/educaci|formaci|ensenan/i.test(a));
      const healthAct = activitiesPool.find((a) => /salud|asistencia|social|medic/i.test(a));
      if (healthAct && !cleanActivities.includes(healthAct)) {
        cleanActivities = [healthAct, ...cleanActivities];
      }
      if (healthAct) {
        cleanActivities = [healthAct];
      }
    }

    if (isFashionOrDesign) {
      const fashionAct = activitiesPool.find((a) => /moda|dise[nñ]o|textil/i.test(a));
      if (fashionAct && !cleanActivities.includes(fashionAct)) {
        cleanActivities = [fashionAct, ...cleanActivities];
      }
    }

    if (isEntertainmentOrCulture) {
      const entAct = activitiesPool.find((a) => /entretenimiento|cultura|arte|medio/i.test(a));
      if (entAct && !cleanActivities.includes(entAct)) {
        cleanActivities = [entAct, ...cleanActivities];
      }
    }

    if (isSportsOrGym) {
      cleanActivities = cleanActivities.filter((a) => !/hosteler|turism|alojam|agricult|ganader|pesca|miner|construcci|inmobiliari|manufactura/i.test(a));
      const sportsAct = activitiesPool.find((a) => /deporte|fitness|bienestar|gimnasio|actividad\s+f[ií]sica|recreaci/i.test(a)) ||
                        activitiesPool.find((a) => /cultura|entretenimiento|medio/i.test(a));
      if (sportsAct && !cleanActivities.includes(sportsAct)) {
        cleanActivities = [sportsAct, ...cleanActivities];
      }
      if (cleanActivities.length === 0 && sportsAct) {
        cleanActivities = [sportsAct];
      }
      finalCategories = finalCategories.filter((c) => !/explorando\s*opciones|servicio\s*especializado|sin\s*requisitos/i.test(c));
      matchedSubs = matchedSubs.filter((s) => !/explorando\s*opciones|servicio\s*especializado|sin\s*requisitos/i.test(s));
    }

    if (isLegalOrConsulting) {
      const legalAct = activitiesPool.find((a) => /profesional|tecnico|legal|consult|jurid/i.test(a));
      if (legalAct && !cleanActivities.includes(legalAct)) {
        cleanActivities = [legalAct, ...cleanActivities];
      }
      // Strictly prevent false real estate assignment
      cleanActivities = cleanActivities.filter((a) => !/bienes\s*ra[ií]ces|inmobiliari/i.test(a));
    }

    if (cleanActivities.length === 0 && activitiesPool.length > 0) {
      const sanitizedPool = activitiesPool.filter((a) => !typesPool.includes(a));
      const poolToUse = sanitizedPool.length > 0 ? sanitizedPool : activitiesPool;
      const scoredActsList: { act: string; score: number }[] = [];
      for (const act of poolToUse) {
        const aNorm = act.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const aTokens = aNorm.split(/\s+/).filter((t) => t.length > 3 && !/para|sobre|servicios/i.test(t));
        let score = 0;
        if (fullTextCorpus.includes(aNorm)) score += 40;
        for (const tok of aTokens) {
          if (fullTextCorpus.includes(tok)) score += 15;
        }
        if (isHealthEntity && /salud|asistencia|social|medic/i.test(aNorm)) {
          score += 60;
        }
        if (isEducationalEntity && /educaci|formaci/i.test(aNorm)) {
          score += 60;
        }
        if (isLegalOrConsulting && /profesional|tecnico|legal|consult/i.test(aNorm)) {
          score += 70;
        }
        if (isLegalOrConsulting && /bienes\s*ra[ií]ces|inmobiliari/i.test(aNorm)) {
          continue; // NEVER score real estate for legal consultancies!
        }
        if (isFashionOrDesign && /moda|dise[nñ]o|textil/i.test(aNorm)) {
          score += 70;
        }
        if (isEntertainmentOrCulture && /entretenimiento|cultura|arte|medio/i.test(aNorm)) {
          score += 70;
        }
        if (isTechEntity && /tecnolog|informaci|comunicaci/i.test(aNorm)) {
          score += 50;
        }
        if (isTourismEntity && /hosteler|alojam|turism/i.test(aNorm)) {
          score += 50;
        }
        if (score > 0) scoredActsList.push({ act, score });
      }
      scoredActsList.sort((a, b) => b.score - a.score);
      if (scoredActsList.length > 0) {
        cleanActivities.push(scoredActsList[0].act);
        if (!isHealthEntity && scoredActsList[1] && scoredActsList[1].score >= 25 && scoredActsList[1].score >= scoredActsList[0].score * 0.6) {
          cleanActivities.push(scoredActsList[1].act);
        }
      }
    }

    let matchedTypes = matchToCatalogPool(
      Array.isArray(parsed.providerTypes) ? parsed.providerTypes : [parsed.providerTypes],
      typesPool
    );

    if (isAuthenticOng) {
      const ongType = typesPool.find(isOngMatch);
      if (ongType && !matchedTypes.includes(ongType)) {
        matchedTypes = [ongType, ...matchedTypes.filter((t) => !/empresa|privada/i.test(t))];
      }
    } else {
      matchedTypes = matchedTypes.filter((t) => !isOngMatch(t));
    }

    const isPublicGov =
      /\b(\.gov|\.gob|\.mil)\b/i.test(context.url || "") ||
      /\b(uncuyo|uba|unlp|unc|utn|unr|universidad nacional|hospital publico|hospital nacional|hospital universitario|organismo publico|ministerio|gobierno|estatal|comuna|municipalidad)\b/i.test(fullTextCorpus);

    if (isPublicGov) {
      matchedTypes = matchedTypes.filter((t) => !/privad|empresa/i.test(t));
      if (matchedTypes.length === 0 && typesPool.length > 0) {
        const pub = typesPool.find((t) => /p[uú]blico|estatal/i.test(t));
        if (pub) matchedTypes = [pub];
      }
    } else {
      matchedTypes = matchedTypes.filter((t) => !/p[uú]blic|estatal|gobiern|municipal/i.test(t));
      if (matchedTypes.length === 0 && typesPool.length > 0) {
        const priv = typesPool.find((t) => /privada|empresa/i.test(t));
        if (priv) matchedTypes = [priv];
      }
    }

    if (matchedTypes.length === 0 && typesPool.length > 0) {
      const chosenType = isPublicGov
        ? typesPool.find((t) => /p[uú]blico|estatal/i.test(t))
        : typesPool.find((t) => /privada|empresa/i.test(t));
      if (chosenType) matchedTypes.push(chosenType);
    }

    if (isSportsOrGym) {
      const isMunicipalOrGov = /\b(municipal|municipalidad|comuna|gobierno|estatal|p[uú]blico)\b/i.test(
        `${context.rawPageTitle || ""} ${context.publisherName || ""} ${context.url || ""}`
      );
      if (isMunicipalOrGov) {
        const pubType = typesPool.find((t) => /p[uú]blic|estatal|gobiern|municipal/i.test(t));
        if (pubType && !matchedTypes.includes(pubType)) {
          matchedTypes = [pubType, ...matchedTypes.filter((t) => !/privad|empresa/i.test(t))];
        }
      }
    }

    // Strict single primary type resolution
    if (matchedTypes.length > 1) {
      matchedTypes = [matchedTypes[0]];
    }

    const matchedModalities = matchToCatalogPool(
      Array.isArray(parsed.providerModalities) ? parsed.providerModalities : [parsed.providerModalities],
      modalitiesPool
    );

    let finalMatchedModalities = [...matchedModalities];

    if (finalMatchedModalities.length === 0 && modalitiesPool.length > 0) {
      const presencial = modalitiesPool.find((m) => /presencial/i.test(m));
      const online = modalitiesPool.find((m) => /online|virtual/i.test(m));
      const hasTelemedicine = /\b(telemedicina|teleconsulta|consulta\s+virtual|videoconsulta|atenci[oó]n\s+(?:m[eé]dica\s+)?virtual)\b/i.test(fullTextCorpus);
      const hasOnlineMention = !isHealthEntity && /online|virtual|remoto|a distancia|zoom|meet/i.test(fullTextCorpus);
      const hasPresencialMention = /sede|sedes|sucursal|sucursales|consultorio|consultorios|campus|ubicacion|direccion|atencion presencial|visitanos|delegacion|delegaciones/i.test(fullTextCorpus) || isHealthEntity;
      if (hasPresencialMention && presencial) finalMatchedModalities.push(presencial);
      if ((hasOnlineMention || hasTelemedicine) && online) finalMatchedModalities.push(online);
      if (finalMatchedModalities.length === 0 && presencial) {
        finalMatchedModalities.push(presencial);
      }
    }

    if (isHealthEntity) {
      const hasTelemedicine = /\b(telemedicina|teleconsulta|consulta\s+virtual|videoconsulta|atenci[oó]n\s+(?:m[eé]dica\s+)?virtual)\b/i.test(fullTextCorpus);
      if (!hasTelemedicine) {
        finalMatchedModalities = finalMatchedModalities.filter((m) => !/online|virtual|remoto|distancia/i.test(m));
        if (finalMatchedModalities.length === 0 && modalitiesPool.length > 0) {
          const pres = modalitiesPool.find((m) => /presencial/i.test(m));
          if (pres) finalMatchedModalities = [pres];
        }
      }
    }

    if (isSportsOrGym) {
      const presMod = modalitiesPool.find((m) => /presencial/i.test(m));
      if (presMod && !finalMatchedModalities.includes(presMod)) {
        finalMatchedModalities.unshift(presMod);
      }
    }

    const matchedPrestaciones = matchToCatalogPool(
      Array.isArray(parsed.prestaciones) ? parsed.prestaciones : [parsed.prestaciones],
      prestacionesPool
    );

    let matchedLanguages = matchToCatalogPool(
      Array.isArray(parsed.languages) ? parsed.languages : [parsed.languages],
      languagesPool
    );
    if (/\b(english|ingl[eé]s|international|exchange|intercambio|study abroad|toefl|ielts|admissions)\b/i.test(fullTextCorpus) || /\b(\.edu|\.gov)\b/i.test(context.url || "")) {
      const eng = languagesPool.find((l) => /ingl[eé]s|english/i.test(l));
      if (eng && !matchedLanguages.includes(eng)) matchedLanguages.push(eng);
    }
    if (/\b(portugu[eêé]s|falamos|brasil|brazil)\b/i.test(fullTextCorpus) || /\.br(?:\/|$)/i.test(context.url || "")) {
      const pt = languagesPool.find((l) => /portugu[eéè]s/i.test(l));
      if (pt && !matchedLanguages.includes(pt)) matchedLanguages.push(pt);
    }
    if (matchedLanguages.length === 0) {
      matchedLanguages = ["Español"];
    }

    return {
      success: true,
      data: {
        category: finalCat,
        subcategory: finalSub,
        categorySelections: finalCategories,
        subcategorySelections: matchedSubs,
        providerActivities: cleanActivities,
        providerTypes: matchedTypes,
        providerModalities: finalMatchedModalities,
        prestaciones: matchedPrestaciones,
        languages: matchedLanguages.length ? matchedLanguages : ["Español"],
      },
      estado: "ok",
      evidencias: [context.url, context.publisherName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: TaxonomyAgent] ERROR: ${err.message}`);
    return {
      success: false,
      data: null,
      estado: "sin_datos",
      evidencias: [],
      providerUsed: "none",
      error: `Error al clasificar taxonomía con IA: ${err.message}`,
    };
  }
}

// ============================================================================
// 6. HELPER PARA LIMPIEZA DE CONTENIDO SCRAPEADO
// ============================================================================
export function cleanScrapedHtmlText(html: string): {
  headings: string[];
  paragraphs: string[];
  mainText: string;
} {
  if (!html) return { headings: [], paragraphs: [], mainText: "" };

  function decodeEntities(str: string): string {
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

  // Strip scripts, styles, iframes, nav, footer, headers, cookies notices, etc.
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Extract headings h1, h2, h3
  const headings: string[] = [];
  const hRegex = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let hMatch: RegExpExecArray | null;
  while ((hMatch = hRegex.exec(cleaned)) !== null) {
    const text = decodeEntities(hMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length > 3 && text.length < 120 && !/cookies|men[uú]|login|iniciar|buscar|search/i.test(text)) {
      headings.push(text);
    }
  }

  // Extract paragraphs
  const paragraphs: string[] = [];
  const pRegex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = pRegex.exec(cleaned)) !== null) {
    const text = decodeEntities(pMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
    if (text.length > 25 && !/cookies|pol[ií]tica de privacidad|todos los derechos reservados|copyright/i.test(text)) {
      paragraphs.push(text);
    }
  }

  const plainText = decodeEntities(cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

  return {
    headings: Array.from(new Set(headings)).slice(0, 15),
    paragraphs: Array.from(new Set(paragraphs)).slice(0, 15),
    mainText: plainText.slice(0, 4000),
  };
}

export function buildTaxonomyCatalogPromptSection(taxonomies: any): string {
  if (!taxonomies) return "Sin catálogo de taxonomías cargado.";

  const blocks: Array<{
    blockName: string;
    blockTaxonomy?: string;
    parentCategories: Array<{
      name: string;
      categoryTaxonomy?: string;
      subcategories: string[];
    }>;
  }> = Array.isArray(taxonomies.categoryTree) ? taxonomies.categoryTree : [];

  const norm = (s: any) => String(s || "").trim().toLowerCase();
  const actBlocks = blocks.filter((b) => norm(b.blockTaxonomy) === "actividad" || norm(b.blockName).includes("actividad") || norm(b.blockName).includes("sector"));
  const typeBlocks = blocks.filter((b) => {
    const bTax = norm(b.blockTaxonomy);
    const bName = norm(b.blockName);
    if (bName.includes("soluci") || bName.includes("publicaci") || bName.includes("recurso")) return false;
    if (["tipo", "tipos"].includes(bTax)) return true;
    return /\b(?:tipo\s+de\s+(?:oferente|perfil|entidad|instituci[oó]n|proveedor)|perfil)\b/i.test(bName) || bName === "tipo" || bName === "tipos";
  });
  const modBlocks = blocks.filter((b) => norm(b.blockTaxonomy) === "modalidad" || norm(b.blockName).includes("modalidad"));
  const catBlocks = blocks.filter((b) => !actBlocks.includes(b) && !typeBlocks.includes(b) && !modBlocks.includes(b));
  const otherBlocks: typeof blocks = [];

  const allActOptions = new Set<string>();
  actBlocks.forEach((b) => (b.parentCategories || []).forEach((c) => { if (c.name) allActOptions.add(c.name); }));
  (taxonomies.activities || []).forEach((a: string) => { if (a) allActOptions.add(a); });

  const allTypeOptions = new Set<string>();
  typeBlocks.forEach((b) => (b.parentCategories || []).forEach((c) => { if (c.name) allTypeOptions.add(c.name); }));
  (taxonomies.types || []).forEach((t: string) => { if (t) allTypeOptions.add(t); });

  const allModOptions = new Set<string>();
  modBlocks.forEach((b) => (b.parentCategories || []).forEach((c) => { if (c.name) allModOptions.add(c.name); }));
  (taxonomies.modalities || []).forEach((m: string) => { if (m) allModOptions.add(m); });

  const languages: string[] = Array.isArray(taxonomies.languages) && taxonomies.languages.length
    ? taxonomies.languages
    : ["Español", "Inglés", "Portugués", "Italiano", "Alemán", "Francés"];

  const lines: string[] = [];

  lines.push("======================================================================");
  lines.push("CATÁLOGO OFICIAL Y CERRADO DE BLOQUES Y CATEGORÍAS (DEFINIDO POR EL ADMINISTRADOR):");
  lines.push("El administrador define y clasifica los bloques del sistema según su tipo de filtro/taxonomía.");
  lines.push("Cada categoría y subcategoría ha sido creada por el administrador. Todo es 100% dinámico.");
  lines.push("");
  lines.push("REGLA FUNDAMENTAL DE EXACTITUD ESTRICTA Y PERTINENCIA SEMÁNTICA (CERO ALUCINACIONES / CERO PLANTILLAS):");
  lines.push("1. RECONOCIMIENTO PREVIO DEL SITIO: Determina primero la identidad, sector y núcleo real de servicios de la web analizada a partir del título, encabezados y contenido extraído (ej: si es un gimnasio o club deportivo, hospital o centro de salud, estudio de abogados, universidad, escuela, hotel, etc.).");
  lines.push("2. PERTINENCIA ESTRICTA: Selecciona ÚNICAMENTE opciones del catálogo cuya temática y sector coincidan GENUINA Y DIRECTAMENTE con ese núcleo.");
  lines.push("3. COMPRENSIÓN SEMÁNTICA CONTEXTUAL DE CANALES Y FUNCIONALIDADES (NO CONFUNDIR EL MEDIO CON LA ACTIVIDAD):");
  lines.push("   - Si la web menciona 'consulta online', 'portal online', 'portal del paciente', 'turnos online', 'plataforma web' o 'trámites digitales':");
  lines.push("     * En un hospital, clínica, sanatorio o centro médico: 'consulta online' o 'portal online' es telemedicina o gestión de turnos para pacientes. NO convierte la actividad en 'Tecnologías de la información y comunicación' ni en informática. Su actividad nuclear sigue siendo Salud / Atención médica, y su modalidad incluye 'Atención online' o 'Híbrido' si existe en el catálogo.");
  lines.push("     * En un gimnasio o club deportivo: tener turnos online o portal web es un medio de gestión deportiva, jamás una empresa de software.");
  lines.push("     * En un hospital universitario (ej: Hospital Universitario UNCUYO): su servicio real para el público es atención hospitalaria y salud para pacientes; jamás lo clasifiques como carreras de grado ni pongas categorías como 'Estudiante'.");
  lines.push("4. OBJETO SOCIAL Y SERVICIOS PRINCIPALES VS NOTICIAS/BLOG ACCESORIO (REGLA FUNDAMENTAL):");
  lines.push("   - Clasifica a la entidad por su ACTIVIDAD ECONÓMICA Y PROPÓSITO CENTRAL (lo que ofrece como establecimiento o institución), NUNCA por artículos de noticias, publicaciones de prensa o convocatorias internas.");
  lines.push("   - EN UN HOSPITAL, CLÍNICA O SANATORIO: Su propósito es brindar ATENCIÓN MÉDICA Y SALUD. Si la web contiene notas de prensa o avisos sobre 'Convocatoria laboral para médicos', 'Concurso de cargos', 'Curso de suturas', 'Talleres' o 'Formación continua':");
  lines.push("     * El hospital NO es una academia de cursos, ni un portal de convocatorias laborales, ni una agencia de empleo.");
  lines.push("     * ESTÁ TERMINANTEMENTE PROHIBIDO clasificarlo en categorías como 'Curso o formación', 'Convocatoria', 'Empleo' o 'Becas'.");
  lines.push("     * En 'providerActivities', su actividad nuclear es ÚNICAMENTE 'Salud y asistencia social' (o la actividad médica afín del catálogo). ESTÁ TERMINANTEMENTE PROHIBIDO agregar 'Educación y formación' a un hospital.");
  lines.push("     * Si el catálogo del administrador no tiene una categoría de Salud/Atención médica, devuelve array vacío [] en 'categorySelections' y 'subcategorySelections'. NUNCA selecciones 'Curso o formación' ni 'Convocatoria'.");
  lines.push("5. MUTUA EXCLUSIVIDAD DE TIPO DE OFERENTE ('providerTypes'):");
  lines.push("   - Una entidad NUNCA puede ser 'Organismo público' e 'Institución privada' / 'Empresa' a la vez. Elige solo una según la naturaleza legal real.");
  lines.push("   - Si pertenece a una universidad pública nacional o ente estatal (ej: Hospital Universitario UNCUYO, UBA, etc.), su tipo es EXCLUSIVAMENTE 'Organismo público'. NUNCA incluyas 'Institución privada' ni 'Empresa'.");
  lines.push("   - Si es privada, es 'Institución privada' o 'Empresa', nunca 'Organismo público'.");
  lines.push("6. PROHIBIDO VINCULAR CATEGORÍAS NO AFINES POR PALABRAS AISLADAS: Si una página de deportes o gimnasio menciona 'trámites' o 'gestiones' en su menú municipal, ESTÁ TERMINANTEMENTE PROHIBIDO seleccionar 'Gestiones migratorias y Visas' o ramas legales. De igual modo, jamás asignes 'Agricultura, ganadería y pesca' a un gimnasio, hospital, escuela o estudio jurídico.");
  lines.push("7. INDEPENDENCIA ABSOLUTA DE LA URL: La URL sirve únicamente para la descarga técnica del sitio. No clasifiques por la extensión o palabras del dominio (.edu, .gob, .org, etc.) si el contenido real del sitio es un hospital, clínica, gimnasio o comercio.");
  lines.push("8. CATÁLOGO ESTRICTAMENTE CERRADO Y CERO INVENCIÓN: Trabaja SIEMPRE con las taxonomías, bloques y categorías que se encuentran en el catálogo oficial de abajo (creadas por el administrador en la base de datos).");
  lines.push("   - Si el catálogo administrado por el usuario no contiene categorías o actividades afines para la web analizada, DEBES DEVOLVER ARRAY VACÍO [] en 'categorySelections' y 'subcategorySelections' (y cadena vacía '' en 'category' y 'subcategory'). ESTÁ PROHIBIDO inventar nombres o forzar categorías de otros rubros.");
  lines.push("9. PUEDES SELECCIONAR MÁS DE UNA OPCIÓN cuando el sitio web analizado genuinamente abarque varias opciones válidas del catálogo.");
  lines.push("");

  lines.push("1. SECCIÓN ACTIVIDADES ('providerActivities' - Array de strings):");
  lines.push("Examina los bloques de actividad y selecciona ÚNICAMENTE la/s actividad/es reales creadas en el catálogo que definan el núcleo económico de la entidad (o [] si ninguna aplica):");
  if (actBlocks.length > 0) {
    actBlocks.forEach((b) => {
      lines.push(`  Bloque: "${b.blockName}"`);
      (b.parentCategories || []).forEach((c) => {
        lines.push(`   - "${c.name}"`);
      });
    });
  } else if (allActOptions.size > 0) {
    allActOptions.forEach((a) => lines.push(`   - "${a}"`));
  } else {
    lines.push('   (No hay actividades definidas en el catálogo. Si no aplica ninguna, devuelve array vacío [])');
  }
  lines.push("");

  lines.push("2. SECCIÓN TIPO DE OFERENTE / PERFIL ('providerTypes' - Array de strings):");
  lines.push("Examina los bloques de tipo y selecciona el/los perfiles según las opciones creadas en el catálogo (ej: Organismo público para entes estatales/municipales, Institución privada/Empresa para privados):");
  if (typeBlocks.length > 0) {
    typeBlocks.forEach((b) => {
      lines.push(`  Bloque: "${b.blockName}"`);
      (b.parentCategories || []).forEach((c) => {
        lines.push(`   - "${c.name}"`);
      });
    });
  } else if (allTypeOptions.size > 0) {
    allTypeOptions.forEach((t) => lines.push(`   - "${t}"`));
  } else {
    lines.push('   (No hay tipos definidos en el catálogo. Si no aplica ninguno, devuelve array vacío [])');
  }
  lines.push("");

  lines.push("3. SECCIÓN MODALIDAD DE SERVICIO ('providerModalities' - Array de strings):");
  lines.push("Examina los bloques de modalidad y selecciona las modalidades reales del catálogo que ofrezca la web:");
  if (modBlocks.length > 0) {
    modBlocks.forEach((b) => {
      lines.push(`  Bloque: "${b.blockName}"`);
      (b.parentCategories || []).forEach((c) => {
        lines.push(`   - "${c.name}"`);
      });
    });
  } else if (allModOptions.size > 0) {
    allModOptions.forEach((m) => lines.push(`   - "${m}"`));
  } else {
    lines.push('   (No hay modalidades definidas en el catálogo. Si no aplica ninguna, devuelve array vacío [])');
  }
  lines.push("");

  lines.push("4. SECCIÓN PROPUESTA O PUBLICACIÓN - CATEGORÍAS Y SUBCATEGORÍAS ('categorySelections' y 'subcategorySelections'):");
  lines.push("Examina cada bloque de categoría, el nombre del bloque, el nombre de la categoría y las subcategorías.");
  lines.push("");
  lines.push("*** REGLA SUPREMA DE EXACTITUD Y CERO ALUCINACIONES ***:");
  lines.push("1. El catálogo de categorías y subcategorías es ESTRICTAMENTE CERRADO y administrado por el usuario.");
  lines.push("2. Examina CADA BLOQUE disponible en el catálogo de abajo y selecciona TODAS las opciones que apliquen DIRECTAMENTE a los servicios reales de la web analizada:");
  lines.push("   - Selecciona ÚNICAMENTE categorías y subcategorías que existan explícitamente en el catálogo oficial de abajo.");
  lines.push("   - ESTÁ TERMINANTEMENTE PROHIBIDO crear o inventar nombres de categorías, actividades o subcategorías que no existan en la lista.");
  lines.push("   - Si ninguna categoría o subcategoría aplica a los servicios reales de la web analizada, devuelve array vacío [] en 'categorySelections' y 'subcategorySelections'. NUNCA fuerces categorías de otros rubros.");
  lines.push("");
  lines.push("Estructura de Bloques de Categorías disponibles:");
  if (catBlocks.length > 0) {
    catBlocks.forEach((b) => {
      lines.push(`=== BLOQUE: "${b.blockName}" (Taxonomía: ${b.blockTaxonomy || "categoria"}) ===`);
      (b.parentCategories || []).forEach((cat) => {
        lines.push(`  - Categoría: "${cat.name}"${cat.categoryTaxonomy && cat.categoryTaxonomy !== "categoria" ? ` [Taxonomía propia: ${cat.categoryTaxonomy}]` : ""}`);
        if (cat.subcategories && cat.subcategories.length) {
          lines.push(`    Subcategorías: ${cat.subcategories.map((s) => `"${s}"`).join(", ")}`);
        } else {
          lines.push("    Subcategorías: (ninguna)");
        }
      });
      lines.push("");
    });
  } else if (taxonomies.categories && taxonomies.categories.length) {
    taxonomies.categories.forEach((c: string) => lines.push(`  - Categoría: "${c}"`));
  }
  if (otherBlocks.length > 0) {
    lines.push("OTROS BLOQUES Y CATEGORÍAS DISPONIBLES:");
    otherBlocks.forEach((b) => {
      lines.push(`=== BLOQUE: "${b.blockName}" (Taxonomía: ${b.blockTaxonomy}) ===`);
      (b.parentCategories || []).forEach((c) => lines.push(`  - "${c.name}"`));
    });
  }
  lines.push("");

  lines.push("5. SECCIÓN IDIOMAS ('languages' - Array de strings):");
  lines.push("Examina los idiomas comprobados de atención en la web:");
  languages.forEach((l) => lines.push(`  - "${l}"`));
  lines.push("======================================================================");

  return lines.join("\n");
}

// ============================================================================
// 7. UNIFIED PUBLICATION AGENT (UN SOLO LLAMADO DE IA INTEGRAL DE MÁXIMA EFICIENCIA)
// ============================================================================
export interface UnifiedPublicationInput {
  context: CleanScrapedContext;
  customTitlePrompt?: string;
  customDescriptionPrompt?: string;
  customBlocks?: CustomScraperBlock[];
  taxonomies?: any;
  includeScoreScout?: boolean;
}

export interface UnifiedPublicationOutput {
  title: string;
  titleI18n: I18nRecord;
  description: string;
  descriptionI18n: I18nRecord;
  extraDescriptions: ExtraDescriptionBlock[];
  providerInfo: string;
  providerInfoI18n: I18nRecord;
  detectedPublisherName?: string;
  detectedAddress?: string;
  detectedCity?: string;
  detectedCountry?: string;
  detectedRating?: string;
  detectedReviewCount?: string;
  detectedFoundingYear?: string;
  detectedCommentsUrl?: string;
  taxonomyData: TaxonomyAgentData;
  providerUsed: string;
}

export async function runUnifiedPublicationAgent(
  input: UnifiedPublicationInput
): Promise<AgentResult<UnifiedPublicationOutput>> {
  const { context, taxonomies } = input;
  const cleanName = cleanTitleString(context.publisherName || context.rawPageTitle || "Establecimiento");
  const entityName = cleanName.split(/\s*[-–—|]\s*/)[0].trim() || cleanName;
  const cleanPublisher = cleanTitleString(context.publisherName || entityName);
  const locationText = [context.city, context.country].filter(Boolean).join(", ");
  const titlePrompt = (input.customTitlePrompt || "").trim();
  const descPrompt = (input.customDescriptionPrompt || "").trim();
  const customBlocksList = Array.isArray(input.customBlocks)
    ? input.customBlocks.filter((b) => b && b.title && b.title.trim())
    : [];

  const allParentCategoriesFromTree = (taxonomies?.categoryTree || []).flatMap((b: any) => (b.parentCategories || []).map((p: any) => p.name));
  const catPool: string[] = Array.from(new Set([...(taxonomies?.categories || []), ...allParentCategoriesFromTree].filter(Boolean)));

  const allSubcategoriesFromTree = (taxonomies?.categoryTree || []).flatMap((b: any) => (b.parentCategories || []).flatMap((p: any) => p.subcategories || []));
  const subPool: string[] = Array.from(new Set([...(taxonomies?.subcategories || []), ...allSubcategoriesFromTree].filter(Boolean)));

  const activitiesPool: string[] = taxonomies?.activities || [];
  const typesPool: string[] = taxonomies?.types || [];
  const modalitiesPool: string[] = taxonomies?.modalities || [];
  const languagesPool: string[] = taxonomies?.languages || ["Español", "Inglés", "Portugués", "Italiano", "Alemán", "Francés"];

  let customBlocksDirective = "";
  if (customBlocksList.length > 0) {
    customBlocksDirective =
      `\n=== BLOQUES PERSONALIZADOS OBLIGATORIOS (DEBES GENERAR CADA UNO EN "customBlocks") ===\n` +
      customBlocksList
        .map(
          (b, i) =>
            `[Bloque ${i + 1}] Título: "${b.title}"\nDirectiva del administrador: "${b.prompt || "Generar contenido estructurado y relevante para este bloque."}"`
        )
        .join("\n\n");
  }

  const taxonomySectionPrompt = buildTaxonomyCatalogPromptSection(taxonomies);

  const systemPrompt = `Eres el Director Editorial y Clasificador de Taxonomías Senior de Travelgrin.
Tu objetivo es auditar el sitio web y generar una publicación completa, atractiva y de alta calidad para la entidad, CUMPLIENDO RIGUROSAMENTE LAS DIRECTIVAS EDITORIALES DEL ADMINISTRADOR Y CLASIFICANDO CORRECTAMENTE SUS TAXONOMÍAS.

HIERARQUÍA DE AUTORIDAD EDITORIAL (REGLAS SUPREMAS):
1. AUTORIDAD EDITORIAL SUPREMA: Las instrucciones del administrador son la regla NÚMERO UNO:
   - TÍTULO: Si el administrador proporcionó una directiva para el título ("${titlePrompt}"), DEBES ADAPTARTE DIRECTAMENTE A LO QUE PIDIÓ (incluso si pide emojis, palabras clave de alto impacto o estilo libre). Si pidió un ángulo, enfoque o palabras clave específicas (ej: inscripciones, innovación, calidad, tecnología, etc.), ese ángulo DEBE SER EL CORAZÓN DEL TÍTULO redactado de manera 100% original, creativa y vendedora.
     * REGLA ESTRICTA DE LÍMITE DE PALABRAS Y EXTENSIÓN: Si el administrador indica un límite de palabras (ej: "máximo 25 palabras", "un límite de 25 palabras", "hasta 20 palabras", "menos de 15 palabras", "tope de 25 palabras"): CUMPLE ESTRICTAMENTE Y NO SUPERES esa cantidad de palabras bajo ninguna circunstancia. Cuenta las palabras con exactitud antes de emitir la respuesta. Además, redacta un titular completo, llamativo y atractivo que aproveche bien la extensión solicitada (ej: si pide hasta 25 palabras, aprovecha una extensión sustancial de 15 a 25 palabras; no devuelvas un título telegráfico de solo 5 palabras).
     * MÁXIMA LIBERTAD Y CERO PLANTILLAS: El administrador puede pedir cualquier estilo, extensión, enfoque o instrucción en el prompt de título. Adáptate 100% a lo que pide sin recurrir a plantillas fijas. Redacta un titular original, único y fresco basado estrictamente en el contenido real de la página web y en el estilo pedido por el administrador.
     * PROHIBIDO COPIAR EL TÍTULO ORIGINAL: Si el administrador dio una instrucción de título, ESTÁ TERMINANTEMENTE PROHIBIDO devolver el título original de la web o una copia textual de la etiqueta title. Redacta un nuevo titular comercial según lo pedido.
     * REGLA ESTRICTA DE RESTRICCIÓN NEGATIVA DE NOMBRE: Si el administrador pide que el título NO contenga el nombre de la institución (ej: 'que no contenga el nombre de la institucion', 'sin el nombre', 'no incluir el nombre', 'sin mencionar la institucion'), ESTÁ TERMINANTEMENTE PROHIBIDO incluir '${entityName}' o el nombre de la institución en el título. Genera ÚNICAMENTE el titular o eslogan publicitario/comercial de alto impacto, enfocado directamente en la propuesta de valor sin mencionar a la entidad.
     * Si NO pidió omitir el nombre, puedes integrar el nombre de la institución si encaja armónicamente con la propuesta atractiva de valor, o enfocar el titular comercialmente según lo pedido.
     * JAMÁS devuelvas las palabras de la instrucción como parte del título (ej: si pide "Especialista en marketing y haz un título...", NO escribas "Especialista en marketing..." en el título). NUNCA devuelvas solo el nombre seco si se pidió impacto.
   - DESCRIPCIÓN PRINCIPAL: Si el administrador pide una cantidad exacta de párrafos (ej: "2 párrafos", "5 párrafos"), REDACTA EXACTAMENTE ESA CANTIDAD DE PÁRRAFOS en HTML <p>...</p>. FORMATO, SUBTÍTULOS Y COLORES EXACTOS: Si el administrador pide subtítulos con su explicación o pide colores (ej: "letras azules", "rojo", etc.), aplica el estilo inline EXACTO pedido: si pide azul usa style="color: #0066cc;", si pide rojo usa style="color: #dc2626;", si pide amarillo usa style="color: #ca8a04;". Si no pide color, usa <p><strong>Subtítulo:</strong> Explicación...</p>.
     * REGLA ESTRICTA DE LÍMITE DE PALABRAS EN CADA PÁRRAFO: Si el administrador pide un límite de palabras en cada párrafo (ej: "máximo 50 palabras en cada párrafo", "un límite de 50 palabras", "hasta 50 palabras", "menos de 50 palabras"): CUMPLE ESTRICTAMENTE Y NO SUPERES esa cantidad en ningún párrafo. Además, DESARROLLA Y EXPLAYA el contenido con riqueza de vocabulario para acercarte al límite solicitado (ej: si pide hasta 50 palabras por párrafo, redacta párrafos sustanciales y explicativos de entre 38 y 50 palabras cada uno; NO escribas párrafos telegráficos o pobres de solo 15-20 palabras). Cuenta las palabras con exactitud antes de emitir la respuesta.
     * CADA PÁRRAFO DEBE TENER UN CONTENIDO ÚNICO Y DIFERENTE. ESTÁ TOTALMENTE PROHIBIDO REPETIR ORACIONES O FRASES GENÉRICAS ENTRE PÁRRAFOS. Si pide emojis, íconos o estilo específico, aplícalo libremente. CERO PLANTILLAS RÍGIDAS. Si la entidad es una universidad o institución educativa, habla EXCLUSIVAMENTE de su propuesta académica, carreras, campus y admisiones; JAMÁS menciones hospitales a menos que sea un centro de salud.
   - BLOQUES PERSONALIZADOS: Genera cada bloque solicitado en el array "customBlocks".
     * TÍTULO TEMÁTICO: El Título del bloque define la temática central si el prompt solo especifica formato, estilo o colores (ej: si el título es "Preguntas Frecuentes", el contenido DEBE ser de preguntas frecuentes sobre los servicios y ofertas reales del sitio).
     * CONTEXTO Y CONTINUIDAD: Si el administrador pide tener en cuenta la descripción o bloques anteriores, revísalos e integra la información manteniendo total coherencia.
     * PREGUNTAS FRECUENTES Y CANTIDAD: Formula preguntas inteligentes y respuestas claras sobre los servicios del sitio en formato HTML. Respeta RIGUROSAMENTE la CANTIDAD de preguntas pedidas (ej: si pide "2 preguntas", genera EXACTAMENTE 2 preguntas y 2 respuestas, NI UNA MÁS NI UNA MENOS).
     * PROHIBIDO WIZARDS/BOTONES: ESTÁ ESTRICTAMENTE PROHIBIDO tomar botones o etiquetas de filtros/wizards de formularios de la web (como "¿Qué estás buscando?", "¿Cuál va a ser tu próximo paso?").
     * COLORES Y FORMATO: Si el administrador pide colores específicos (ej: "preguntas en rojo y su respuesta en negro" o "de azul el título"), APLICA EL ESTILO EN LÍNEA: <p><strong style="color: #dc2626;">¿Pregunta en rojo?</strong><br/><span style="color: #000000;">Respuesta en negro...</span></p>. Si pide emojis o íconos, inclúyelos libremente.
   - INFORMACIÓN DEL OFERENTE ('providerInfo'): Resumen institucional conciso de 1 o 2 oraciones (máximo 40 palabras) pero MUY rico, concreto y personalizado. REGLA DE ALEATORIEDAD Y VARIEDAD: En cada scraping, redacta una descripción institucional única, fresca y con un enfoque narrativo diferente y aleatorio (a veces enfocado en la tecnología y equipamiento moderno, a veces en la trayectoria y prestigio, a veces en la calidez humana y atención de su equipo multidisciplinario, o en el liderazgo regional). TOTALMENTE PROHIBIDO usar plantillas clichés vacías como "es un establecimiento y prestador de servicios en...".
2. CERO PLANTILLAS RÍGIDAS FIJAS: No uses esquemas estáticos repetitivos. Cada publicación debe redactarse a medida según la actividad real de la entidad y las instrucciones del administrador.
3. Fidelidad factual y Reputación en Google Maps:
   - Basa los textos en los servicios, ofertas, propuestas y datos reales de la web de "${entityName}".
   - 'detectedFoundingYear': Año real y verdadero en que se fundó la institución o comenzó sus actividades históricas SOLO si se menciona explícitamente en el texto del sitio web analizado o si es un hecho institucional histórico comprobado (ej: "1987", "1969", "1903", "1995", "1821"). NUNCA inventes, calcules ni estimes años arbitrarios. Si no existe un año real de fundación comprobado en la web o registro institucional verificado, DEBES DEVOLVER UNA CADENA VACÍA "". TOTALMENTE PROHIBIDO tomar el año de copyright del pie de página de la web (como "2024", "2025" o "2026").
   - 'detectedRating': Calificación numérica exacta de 1.0 a 5.0 que tiene el establecimiento en Google Maps de su SEDE PRINCIPAL. Si ya viene informada en los datos reales de referencia ("Calificación verificada"), DEVUÉLVELA EXACTAMENTE SIN CAMBIARLA NI INVENTAR (ej: "4.3"). Si no posee o no hay datos, pon "0". NUNCA inventes números ficticios.
   - 'detectedReviewCount': Cantidad exacta de reseñas / opiniones en Google Maps de esa sede principal. Si ya viene informada en los datos reales de referencia ("Reseñas verificadas"), DEVUÉLVELA EXACTAMENTE SIN CAMBIARLA NI INVENTAR (ej: si tiene 776, pon "776"). Si no posee o no hay datos, pon "0". NUNCA inventes números redondos ficticios como 500 o 200.
   - 'detectedCommentsUrl': Enlace directo o de búsqueda a las opiniones en Google Maps de su sede principal.
4. CLASIFICACIÓN TAXONÓMICA DINÁMICA Y FIDELIDAD AL CONTENIDO RASPADO (CERO PLANTILLAS):
   - El administrador crea los bloques con taxonomías: actividad, modalidad, tipos, categoria, idiomas.
   - Basa la categorización en lo que la página web REALMENTE hace y ofrece según el scraping.
   - 'providerActivities': Selecciona en array las actividades nucleares centrales EXCLUSIVAMENTE de la sección ACTIVIDADES del catálogo de abajo que definan el sector económico real. Si ninguna actividad del catálogo aplica, devuelve array vacío []. NUNCA inventes nombres ni selecciones actividades no afines (como agricultura para deportes, etc.).
   - 'providerTypes': Array de tipos EXCLUSIVAMENTE de la sección TIPO DE OFERENTE del catálogo de abajo que concuerden con la entidad (ej: "Organismo público" para entes municipales/estatales, "Empresa" o "Institución privada" para negocios privados, "ONG" para fundaciones). Si ninguno aplica, devuelve array vacío [].
   - 'providerModalities': Array de modalidades EXCLUSIVAMENTE de la sección MODALIDAD del catálogo según cómo preste sus servicios la web ("Atención presencial", "Atención online", etc.).
   - 'categorySelections': Array con las categorías de los bloques de categoría del catálogo que correspondan DIRECTAMENTE a los servicios de la web. Si ninguna categoría del catálogo coincide con la temática real del sitio, devuelve array vacío []. NUNCA pongas categorías no relacionadas como "Gestiones migratorias y Visas" en sitios deportivos o de salud.
   - 'subcategorySelections': Array con las subcategorías específicas hijas del catálogo que apliquen (o array vacío [] si ninguna aplica).
   - 'languages': Array con los idiomas comprobados de atención en la web.
5. REGLA DE IDIOMA Y TRADUCCIÓN (ESTRICTA):
   - Redacta TODOS los campos (título, descripción principal, bloques personalizados e información del proveedor) EXCLUSIVAMENTE en ESPAÑOL.
   - NO generes ni traduzcas a inglés, portugués ni italiano. Los campos se traducirán posteriormente desde el panel de control.
6. Formato estricto: Devuelve EXCLUSIVAMENTE un objeto JSON válido con esta estructura:
{
  "title": "Título comercial y atractivo en español",
  "description": "<p>Primer párrafo en español...</p><p>Segundo párrafo en español...</p>",
  "customBlocks": [
    {
      "title": "Nombre del bloque",
      "body": "<p>Contenido HTML en español...</p>"
    }
  ],
  "providerInfo": "Resumen institucional conciso y rico en español de 1 o 2 oraciones (tomando lo mejor de la descripción sin plantillas genéricas)",
  "detectedPublisherName": "Nombre oficial completo de la entidad (resolviendo siglas si aplica)",
  "detectedAddress": "Dirección física vigente del pie de página o contacto",
  "detectedFoundingYear": "",
  "detectedRating": "4.8",
  "detectedReviewCount": "35",
  "detectedCommentsUrl": "https://www.google.com/maps/search/?api=1&query=...",
  "category": "Nombre de la categoría principal afín seleccionada (o \"\" si ninguna aplica)",
  "subcategory": "Nombre de la subcategoría afín seleccionada (o \"\" si ninguna aplica)",
  "categorySelections": ["Categoría coincidente 1 (o [] si ninguna categoría del catálogo aplica)"],
  "subcategorySelections": ["Subcategoría coincidente 1 (o [] si ninguna subcategoría del catálogo aplica)"],
  "providerActivities": ["Actividad económica correspondiente (o [] si ninguna aplica)"],
  "providerTypes": ["Tipo de entidad correspondiente (o [] si ninguno aplica)"],
  "providerModalities": ["Atención presencial (o las modalidades que apliquen)"],
  "languages": ["Español"]
}`;

  const omitUnifiedTitleName = checkPromptOmitEntityName(titlePrompt);

  const userPrompt = `=== DIRECTIVAS EDITORIALES DEL ADMINISTRADOR (MÁXIMA PRIORIDAD) ===
1. DIRECTIVA PARA EL TÍTULO:
"${titlePrompt || "Crear un título claro, comercial, atractivo y representativo que presente al establecimiento y su propuesta principal."}"
${omitUnifiedTitleName ? "\n--> REGLA CRÍTICA OBLIGATORIA: El administrador ha exigido que el título NO contenga el nombre de la institución. ESTÁ TERMINANTEMENTE PROHIBIDO poner '" + entityName + "' en el título; genera únicamente el eslogan publicitario o titular comercial de alto impacto.\n" : ""}
${titlePrompt ? "\n--> REGLA OBLIGATORIA: Redacta un titular publicitario y comercial nuevo acorde a esta directiva. ESTÁ TOTALMENTE PROHIBIDO copiar textualmente el 'Título original de la web' o devolver solo el nombre.\n" : ""}
2. DIRECTIVA PARA LA DESCRIPCIÓN PRINCIPAL:
"${descPrompt || "Escribir una descripción profesional en párrafos HTML <p> explicando qué ofrece, su alcance y vías oficiales."}"
${customBlocksDirective}

=== DATOS REALES DE REFERENCIA DEL SITIO WEB ===
- URL: "${context.url}"
- Nombre preliminar detectado: "${entityName}"
- Título original de la web: "${context.rawPageTitle || entityName}"
- Meta descripción de la web: "${context.metaDescription || "N/A"}"
- Ubicación: "${locationText || "No informada"}"
- Dirección física detectada: "${context.address || "No informada"}"
- Google Maps (Sede Principal): Calificación verificada: "${context.rating && context.rating !== "0" ? context.rating : "No disponible"}" | Reseñas verificadas: "${context.reviewCount && context.reviewCount !== "0" ? context.reviewCount : "No disponible"}" | Link: "${context.commentsUrl || "N/A"}"
- Encabezados principales del sitio: ${(context.headings || []).slice(0, 12).join(" | ") || "N/A"}
- Servicios detectados: ${(context.servicesList || []).slice(0, 10).join(" | ") || "N/A"}
- Párrafos de texto extraídos de la web:
${(context.paragraphs || []).slice(0, 8).join("\n\n") || (context.mainText?.slice(0, 2500) || "N/A")}

${taxonomySectionPrompt}

GENERA EL OBJETO JSON COMPLETO CUMPLIENDO ESTRICTAMENTE TODAS LAS DIRECTIVAS EDITORIALES DEL ADMINISTRADOR Y LA CLASIFICACIÓN TAXONÓMICA EXACTA (SELECCIONANDO MÁS DE UNA OPCIÓN EN CADA SECCIÓN SI CORRESPONDE A LA WEB).`;

  console.log(`\n[AI-AGENT-DEBUG: UnifiedPublicationAgent] URL: ${context.url}`);
  console.log(`- Title Prompt: "${titlePrompt || "(estándar)"}"`);
  console.log(`- Desc Prompt: "${descPrompt || "(estándar)"}"`);
  console.log(`- Custom Blocks: ${customBlocksList.length}`);

  try {
    const { rawText, providerUsed } = await executeModelCall(
      systemPrompt,
      userPrompt,
      context.apiKey,
      context.provider || "auto",
      2200
    );

    const parsed = extractJson(rawText);
    if (!parsed) {
      throw new Error("No se pudo parsear el JSON de la respuesta unificada.");
    }

    // 1. TÍTULO
    let rawTitle = String(parsed.title || parsed.titleI18n?.es || parsed.titulo || "").trim();
    rawTitle = rawTitle.replace(/^[\s"'{}\[\],:]*(?:title|titulo|nombre)[\s"']*:\s*"?/i, "").replace(/["'\s,:{}]+$/, "").trim();
    if (/^(?:sin[-_\s]*datos|no[-_\s]*disponible|n\/?a|untitled|sin[-_\s]*t[ií]tulo|title|titulo)$/i.test(rawTitle)) {
      rawTitle = "";
    }
    let cleanTitle = cleanTitleString(rawTitle);

    // Si el usuario dio un prompt de título pero el modelo devolvió textualmente el título crudo de la web o el nombre:
    const rawWebTitle = cleanTitleString(context.rawPageTitle || "");
    const isModelEcho = Boolean(
      titlePrompt &&
      cleanTitle &&
      rawWebTitle &&
      (cleanTitle.toLowerCase() === rawWebTitle.toLowerCase() ||
       cleanTitle.toLowerCase() === entityName.toLowerCase() ||
       cleanTitle.toLowerCase() === cleanPublisher.toLowerCase())
    );

    if (isModelEcho) {
      console.log(`[UnifiedPublicationAgent] El modelo unificado devolvió el título web crudo (${cleanTitle}). Invocando Agente de Título dedicado con prompt: "${titlePrompt}"`);
      try {
        const dedicatedTitleRes = await runTitleAgent(context, titlePrompt);
        if (dedicatedTitleRes?.success && dedicatedTitleRes.data?.title) {
          cleanTitle = dedicatedTitleRes.data.title;
        }
      } catch (err: any) {
        console.warn(`[UnifiedPublicationAgent] Fallback a runTitleAgent falló:`, err?.message);
      }
    }

    if (titlePrompt) {
      const wantsMarketing = /(?:marketing|conversi[oó]n|llamativ|atenci[oó]n|bastante\s+largo|largo|impactante|vendedor)/i.test(titlePrompt);
      const isBare = cleanTitle.trim().toLowerCase() === entityName.toLowerCase() || cleanTitle.trim().toLowerCase() === cleanPublisher.toLowerCase();
      if (omitUnifiedTitleName) {
        cleanTitle = cleanTitleOmitEntity(cleanTitle, entityName, cleanPublisher);
        if (!cleanTitle || cleanTitle.length < 8) {
          cleanTitle = synthesizeMarketingTitle(entityName, context, titlePrompt);
        }
      } else if (!cleanTitle || isBare) {
        cleanTitle = synthesizeMarketingTitle(entityName, context, titlePrompt);
      }
      cleanTitle = enforceTitleConstraints(cleanTitle, titlePrompt);
    } else if (!cleanTitle) {
      cleanTitle = entityName;
    }
    const titleI18n: I18nRecord = {
      es: cleanTitle,
      en: "",
      pt: "",
      it: "",
    };

    // 2. DESCRIPCIÓN PRINCIPAL
    let rawDesc = String(parsed.description || parsed.descriptionI18n?.es || parsed.descripcion || parsed.contenido || "").trim();
    if (!rawDesc.includes("<p>") && rawDesc) {
      rawDesc = rawDesc
        .split(/\n\s*\n+/)
        .map((p: string) => p.trim())
        .filter(Boolean)
        .map((p: string) => `<p>${p}</p>`)
        .join("\n");
    }
    if (!rawDesc || rawDesc.length < 10) {
      throw new Error("Descripción unificada vacía o inválida.");
    }
    if (descPrompt && rawDesc) {
      rawDesc = enforceDescriptionParagraphCount(rawDesc, descPrompt);
      rawDesc = enforceParagraphWordLimit(rawDesc, descPrompt);
      rawDesc = applyPromptColorStyles(rawDesc, descPrompt);
    }
    const descriptionI18n: I18nRecord = {
      es: rawDesc,
      en: "",
      pt: "",
      it: "",
    };

    // 3. BLOQUES PERSONALIZADOS
    const extraDescriptions: ExtraDescriptionBlock[] = [];
    const parsedBlocks = Array.isArray(parsed.customBlocks) ? parsed.customBlocks : [];

    for (let i = 0; i < customBlocksList.length; i++) {
      const cb = customBlocksList[i];
      const bTitle = cleanGenericBlockTitle(cb.title, cb.prompt);
      const matched =
        parsedBlocks.find((pb: any) =>
          pb &&
          typeof pb.title === "string" &&
          (pb.title.toLowerCase().includes(bTitle.toLowerCase()) || bTitle.toLowerCase().includes(pb.title.toLowerCase()))
        ) || parsedBlocks[i];

      let bodyHtml = String(matched?.body || matched?.contenido || matched?.description || "").trim();
      if (!bodyHtml.includes("<p>") && bodyHtml) {
        bodyHtml = bodyHtml
          .split(/\n\s*\n+/)
          .map((p: string) => p.trim())
          .filter(Boolean)
          .map((p: string) => `<p>${p}</p>`)
          .join("\n");
      }

      if (!bodyHtml || bodyHtml.length < 10) {
        // Fallback a generación individual
        try {
          const indiv = await runCustomBlockAgent(context, cb.title, cb.prompt);
          bodyHtml = indiv.body;
        } catch {
          bodyHtml = `<p>Información detallada sobre ${bTitle} disponible en el sitio oficial.</p>`;
        }
      }

      bodyHtml = enforceFaqCountAndFilter(bodyHtml, cb.prompt);
      bodyHtml = applyPromptColorStyles(bodyHtml, cb.prompt);

      extraDescriptions.push({
        title: bTitle,
        titleI18n: {
          es: bTitle,
          en: "",
          pt: "",
          it: "",
        },
        body: bodyHtml,
        bodyI18n: {
          es: bodyHtml,
          en: "",
          pt: "",
          it: "",
        },
        visibleInCard: false,
        estado: "ok",
        prompt: cb.prompt,
      });
    }

    // 4. INFORMACIÓN DEL PROVEEDOR
    let pInfo = String(parsed.providerInfo || parsed.providerInfoI18n?.es || "").trim();
    if (!pInfo || pInfo.includes("es un establecimiento y prestador de servicios") || pInfo.length < 20) {
      pInfo = buildRichProviderInfo(entityName, context.city || "", context.country || "", context, rawDesc);
    }
    const providerInfoI18n: I18nRecord = {
      es: pInfo,
      en: "",
      pt: "",
      it: "",
    };

    // 5. TAXONOMÍA (PRESERVANDO SELECCIÓN MÚLTIPLE DE LA IA)
    const rawCats = Array.isArray(parsed.categorySelections) && parsed.categorySelections.length > 0
      ? parsed.categorySelections
      : (parsed.category ? [parsed.category] : []);
    const matchedCats = matchToCatalogPool(rawCats, catPool);

    const rawSubs = Array.isArray(parsed.subcategorySelections) && parsed.subcategorySelections.length > 0
      ? parsed.subcategorySelections
      : (parsed.subcategory ? [parsed.subcategory] : []);
    let matchedSubs = matchToCatalogPool(rawSubs, subPool);

    const rawActs = Array.isArray(parsed.providerActivities) && parsed.providerActivities.length > 0
      ? parsed.providerActivities
      : (parsed.providerActivity ? [parsed.providerActivity] : []);
    const matchedActs = matchToCatalogPool(rawActs, activitiesPool);

    const rawTypes = Array.isArray(parsed.providerTypes) && parsed.providerTypes.length > 0
      ? parsed.providerTypes
      : (parsed.providerType ? [parsed.providerType] : []);
    const matchedTypes = matchToCatalogPool(rawTypes, typesPool);

    const rawMods = Array.isArray(parsed.providerModalities) && parsed.providerModalities.length > 0
      ? parsed.providerModalities
      : (parsed.providerModality ? [parsed.providerModality] : []);
    const matchedModalities = matchToCatalogPool(rawMods, modalitiesPool);

    const rawLangs = Array.isArray(parsed.languages) && parsed.languages.length > 0
      ? parsed.languages
      : (typeof parsed.languages === "string" ? parsed.languages.split(",").map((s: string) => s.trim()) : ["Español"]);
    const matchedLanguages = matchToCatalogPool(rawLangs, languagesPool);

    let finalMatchedCats = [...matchedCats];
    let finalMatchedActs = [...matchedActs];
    let finalMatchedTypes = [...matchedTypes];
    let finalMatchedLangs = [...matchedLanguages];

    // Sanity negative checks: Prevent absurd hallucinations on non-matching sectors
    const fullTextNorm = `${context.rawPageTitle || ""} ${context.headings?.join(" ") || ""} ${context.paragraphs?.join(" ") || ""} ${context.mainText || ""}`.toLowerCase();
    const isActuallyAgri = /\b(agricult|agronom|agropecu|ganader|cultivo|cosecha|pesca|pesquer|piscicultur)\b/i.test(fullTextNorm);
    if (!isActuallyAgri) {
      finalMatchedActs = finalMatchedActs.filter((a) => !/agricultura|ganader|pesca/i.test(a));
    }

    const isActuallyMigration = /\b(visas?|migratori|migraci[oó]n|residencia\s*legal|ciudadan[ií]a\s*legal|tr[aá]mites?\s*consulares?)\b/i.test(fullTextNorm);
    if (!isActuallyMigration) {
      finalMatchedCats = finalMatchedCats.filter((c) => !/visa|migra|residencia\s*y\s*ciudadan/i.test(c));
      matchedSubs = matchedSubs.filter((s) => !/visa|migra|residencia\s*y\s*ciudadan/i.test(s));
    }

    const isHealthEntity =
      /\b(salud|medico|medica|medicos|medicas|medicina|clinica|hospital|sanatorio|obra social|prepaga|paciente|pacientes|enfermeria|atencion medica|consultorio|consultorios|asistencial|prestaciones medicas|farmacia|odontologia|psicologia|pediatria|traumatologia|cardiologia|osep|ioma|pami|osde|swiss medical)\b/i.test(fullTextNorm) ||
      /hospital|clinica|sanatorio|salud/i.test(context.url || "");

    if (isHealthEntity) {
      // 1. A hospital's activity is strictly health; never include education
      finalMatchedActs = finalMatchedActs.filter((a) => !/educaci|formaci|ensenan/i.test(a));
      const healthAct = activitiesPool.find((a) => /salud|asistencia|social|medic/i.test(a));
      if (healthAct && !finalMatchedActs.includes(healthAct)) {
        finalMatchedActs = [healthAct, ...finalMatchedActs];
      }
      if (healthAct) {
        finalMatchedActs = [healthAct];
      }
      // 2. A hospital is NOT a course academy or job convocatoria. Only allow genuine health categories
      finalMatchedCats = finalMatchedCats.filter((c) => {
        const cNorm = c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|guardia|obra\s*social|prepaga/i.test(cNorm)) return true;
        return false;
      });
      matchedSubs = matchedSubs.filter((s) => {
        const sNorm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        if (/salud|medic|asistenc|hospital|clinica|sanatori|farmaci|odontolog|guardia|obra\s*social|prepaga/i.test(sNorm)) return true;
        return false;
      });
    }

    // Mutual exclusivity for providerTypes: An entity cannot be both public and private!
    const isPublicGov =
      /\b(\.gov|\.gob|\.mil)\b/i.test(context.url || "") ||
      /\b(uncuyo|uba|unlp|unc|utn|unr|universidad nacional|hospital publico|hospital nacional|hospital universitario|organismo publico|ministerio|gobierno|estatal|comuna|municipalidad)\b/i.test(fullTextNorm);

    if (isPublicGov) {
      finalMatchedTypes = finalMatchedTypes.filter((t) => !/privad|empresa/i.test(t));
    } else {
      finalMatchedTypes = finalMatchedTypes.filter((t) => !/p[uú]blic|estatal|gobiern|municipal/i.test(t));
    }
    if (finalMatchedTypes.length === 0 && typesPool.length > 0) {
      const fallback = isPublicGov
        ? typesPool.find((t) => /p[uú]blico|estatal/i.test(t))
        : typesPool.find((t) => /privada|empresa/i.test(t));
      if (fallback) finalMatchedTypes = [fallback];
    }
    if (finalMatchedTypes.length > 1) {
      finalMatchedTypes = [finalMatchedTypes[0]];
    }

    let finalMatchedModalities = [...matchedModalities];
    if (isHealthEntity) {
      const hasTelemedicine = /\b(telemedicina|teleconsulta|consulta\s+virtual|videoconsulta|atenci[oó]n\s+(?:m[eé]dica\s+)?virtual)\b/i.test(fullTextNorm);
      if (!hasTelemedicine) {
        finalMatchedModalities = finalMatchedModalities.filter((m) => !/online|virtual|remoto|distancia/i.test(m));
        if (finalMatchedModalities.length === 0 && modalitiesPool.length > 0) {
          const pres = modalitiesPool.find((m) => /presencial/i.test(m));
          if (pres) finalMatchedModalities = [pres];
        }
      }
    }

    if (finalMatchedLangs.length === 0) {
      finalMatchedLangs = ["Español"];
    }

    const taxonomyData: TaxonomyAgentData = {
      category: finalMatchedCats[0] || "",
      subcategory: matchedSubs[0] || "",
      categorySelections: finalMatchedCats,
      subcategorySelections: matchedSubs,
      providerActivities: finalMatchedActs,
      providerTypes: finalMatchedTypes,
      providerModalities: finalMatchedModalities,
      prestaciones: Array.isArray(parsed.prestaciones) ? parsed.prestaciones : [],
      languages: finalMatchedLangs.length ? finalMatchedLangs : ["Español"],
    };

    let detectedFoundingYear = parsed.detectedFoundingYear ? String(parsed.detectedFoundingYear).trim() : undefined;
    if (detectedFoundingYear) {
      const yrNum = parseInt(detectedFoundingYear, 10);
      const currYr = new Date().getFullYear();
      const textCorpus = `${context.mainText || ""} ${context.headings?.join(" ") || ""} ${context.paragraphs?.join(" ") || ""} ${context.rawPageTitle || ""}`;
      const isContextFounding = textCorpus.includes(detectedFoundingYear) || (Boolean(context.foundingYear) && context.foundingYear === detectedFoundingYear);
      if (isNaN(yrNum) || yrNum < 1600 || yrNum > currYr - 1 || yrNum === 2010 || yrNum === 2015) {
        detectedFoundingYear = undefined;
      } else if (!isContextFounding && !context.foundingYear) {
        detectedFoundingYear = undefined;
      }
    }

    let detectedRating = (context.rating && context.rating !== "0")
      ? context.rating
      : (parsed.detectedRating ? String(parsed.detectedRating).trim() : undefined);
    if (detectedRating && !isNaN(parseFloat(detectedRating))) {
      const rNum = parseFloat(detectedRating);
      if (rNum >= 1 && rNum <= 5) detectedRating = rNum.toFixed(1);
      else if (rNum === 0) detectedRating = "0";
    }

    let detectedReviewCount = (context.reviewCount && context.reviewCount !== "0")
      ? context.reviewCount
      : (parsed.detectedReviewCount ? String(parsed.detectedReviewCount).replace(/[^0-9]/g, "").trim() : undefined);
    let detectedCommentsUrl = context.commentsUrl || (parsed.detectedCommentsUrl ? String(parsed.detectedCommentsUrl).trim() : undefined);

    return {
      success: true,
      data: {
        title: cleanTitle,
        titleI18n,
        description: rawDesc,
        descriptionI18n,
        extraDescriptions,
        providerInfo: pInfo,
        providerInfoI18n,
        detectedPublisherName: cleanTitleString(String(parsed.detectedPublisherName || "").trim()) || undefined,
        detectedAddress: cleanTitleString(String(parsed.detectedAddress || "").trim()) || undefined,
        detectedCity: cleanTitleString(String(parsed.city || "").trim()) || undefined,
        detectedCountry: cleanTitleString(String(parsed.country || "").trim()) || undefined,
        detectedRating,
        detectedReviewCount,
        detectedFoundingYear,
        detectedCommentsUrl,
        taxonomyData,
        providerUsed,
      },
      estado: "ok",
      evidencias: [entityName],
      providerUsed,
    };
  } catch (err: any) {
    console.warn(`[AI-AGENT-DEBUG: UnifiedPublicationAgent] ERROR: ${err.message}`);
    return {
      success: false,
      data: null,
      estado: "sin_datos",
      evidencias: [],
      providerUsed: "none",
      error: `Error en agente unificado: ${err.message}`,
    };
  }
}

