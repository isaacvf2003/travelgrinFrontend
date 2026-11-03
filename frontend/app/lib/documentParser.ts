import * as XLSX from "xlsx";

export interface ParsedSheet {
  name: string;
  rowCount: number;
  markdownTable: string;
  headers: string[];
  rows: Array<Record<string, any>>;
  rawMatrix: string[][];
}

export interface ParsedDocumentResult {
  fileName: string;
  format: "excel" | "csv" | "text" | "json";
  sheets: ParsedSheet[];
  fullText: string;
  summary: string;
}

export interface PublicationDocumentMatch {
  contextText: string;
  excelInstructions: string;
  matchedRowsText: string[];
  hasExactPublicationMatch: boolean;
}

/**
 * Parses uploaded document buffer (Excel, CSV, TXT, JSON) into clean structured text.
 */
export function parseUploadedDocument(
  buffer: Buffer | Uint8Array,
  fileName: string,
  mimeType?: string
): ParsedDocumentResult {
  const ext = (fileName.split(".").pop() || "").toLowerCase();

  if (
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "xlsm" ||
    ext === "ods" ||
    mimeType?.includes("spreadsheet") ||
    mimeType?.includes("excel")
  ) {
    return parseExcelBuffer(buffer, fileName);
  }

  if (ext === "csv" || mimeType?.includes("csv")) {
    return parseCsvBuffer(buffer, fileName);
  }

  if (ext === "json" || mimeType?.includes("json")) {
    return parseJsonBuffer(buffer, fileName);
  }

  // Fallback to text / markdown
  return parseTextBuffer(buffer, fileName);
}

function isLikelyHeaderRow(row: string[], maxCols: number): boolean {
  const nonEmpty = row.filter((c) => c.trim().length > 0);
  if (nonEmpty.length === 0) return false;
  // A single-cell instruction row in a multi-column sheet is NOT the table header
  if (maxCols >= 2 && nonEmpty.length === 1) return false;
  if (nonEmpty.some((c) => c.length > 65)) return false;
  if (nonEmpty.some((c) => /^(?:instrucci[oó]n(?:es)?|prompt|indicaci[oó]n|nota)\s*[:\-–—]/i.test(c))) return false;
  const headerKeywords =
    /\b(?:nombre|publicaci[oó]n|t[ií]tulo|oferente|instituci[oó]n|empresa|entidad|info|informaci[oó]n|descripci[oó]n|contenido|detalle|texto|bloque|instrucci[oó]n|instrucciones|prompt|indicaci[oó]n|observaci[oó]n|pa[ií]s|ciudad|sede|url|web|link|requisitos?|orientaci[oó]n)\b/i;
  return nonEmpty.some((c) => headerKeywords.test(c));
}

function buildParsedSheetFromRawRows(sheetName: string, rawRows: any[][]): ParsedSheet | null {
  const nonEmptyRows: string[][] = (rawRows || [])
    .filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""))
    .map((r) => r.map((c) => (c !== undefined && c !== null ? String(c).trim() : "")));

  if (nonEmptyRows.length === 0) return null;

  const maxCols = Math.max(...nonEmptyRows.map((r) => r.length), 1);

  // Find the true header row within the first 3 rows (in case row 0 is a general instruction or sheet title)
  let headerRowIndex = -1;
  if (nonEmptyRows.length > 1) {
    for (let rIdx = 0; rIdx < Math.min(3, nonEmptyRows.length - 1); rIdx++) {
      if (isLikelyHeaderRow(nonEmptyRows[rIdx], maxCols)) {
        headerRowIndex = rIdx;
        break;
      }
    }
  }

  const headers: string[] = [];
  for (let i = 0; i < maxCols; i++) {
    const hVal = headerRowIndex >= 0 ? (nonEmptyRows[headerRowIndex][i] || "").trim() : "";
    headers.push(hVal || `Columna_${i + 1}`);
  }

  // Include all rows except the header row itself (so pre-header instruction rows and all publication rows are preserved)
  const dataRows =
    headerRowIndex >= 0
      ? nonEmptyRows.filter((_, idx) => idx !== headerRowIndex)
      : nonEmptyRows;

  const objectRows: Array<Record<string, any>> = [];
  const mdLines: string[] = [];

  mdLines.push(`| ${headers.join(" | ")} |`);
  mdLines.push(`| ${headers.map(() => "---").join(" | ")} |`);

  for (const row of dataRows) {
    const obj: Record<string, any> = {};
    const rowCols = headers.map((h, i) => {
      const val = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
      obj[h] = val;
      return val.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
    });
    objectRows.push(obj);
    mdLines.push(`| ${rowCols.join(" | ")} |`);
  }

  return {
    name: sheetName,
    rowCount: objectRows.length,
    markdownTable: mdLines.join("\n"),
    headers,
    rows: objectRows,
    rawMatrix: nonEmptyRows,
  };
}

function parseExcelBuffer(buffer: Buffer | Uint8Array, fileName: string): ParsedDocumentResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets: ParsedSheet[] = [];
  const textParts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
    const parsedSheet = buildParsedSheetFromRawRows(sheetName, rawRows);
    if (!parsedSheet) continue;

    sheets.push(parsedSheet);
    textParts.push(`=== HOJA EXCEL: "${sheetName}" (${parsedSheet.rowCount} filas) ===\n${parsedSheet.markdownTable}`);
  }

  const fullText = textParts.join("\n\n");
  const summary = `Archivo Excel "${fileName}" con ${sheets.length} hoja(s) y ${sheets.reduce((acc, s) => acc + s.rowCount, 0)} filas en total.`;

  return {
    fileName,
    format: "excel",
    sheets,
    fullText,
    summary,
  };
}

function parseCsvBuffer(buffer: Buffer | Uint8Array, fileName: string): ParsedDocumentResult {
  const rawText = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : new TextDecoder("utf8").decode(buffer);
  const workbook = XLSX.read(rawText, { type: "string" });
  const sheetName = workbook.SheetNames[0] || "CSV";
  const sheet = workbook.Sheets[sheetName];

  if (sheet) {
    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
    const parsedSheet = buildParsedSheetFromRawRows(sheetName, rawRows);
    if (parsedSheet) {
      return {
        fileName,
        format: "csv",
        sheets: [parsedSheet],
        fullText: `=== ARCHIVO CSV: "${fileName}" ===\n${parsedSheet.markdownTable}`,
        summary: `Archivo CSV "${fileName}" con ${parsedSheet.rowCount} filas.`,
      };
    }
  }

  return {
    fileName,
    format: "csv",
    sheets: [],
    fullText: rawText,
    summary: `Archivo CSV "${fileName}" con ${rawText.split("\n").length} líneas.`,
  };
}

function parseJsonBuffer(buffer: Buffer | Uint8Array, fileName: string): ParsedDocumentResult {
  const raw = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : new TextDecoder("utf8").decode(buffer);
  try {
    const parsed = JSON.parse(raw);
    const formatted = JSON.stringify(parsed, null, 2);
    return {
      fileName,
      format: "json",
      sheets: [],
      fullText: `=== DOCUMENTO JSON: "${fileName}" ===\n${formatted}`,
      summary: `Documento JSON "${fileName}".`,
    };
  } catch {
    return parseTextBuffer(buffer, fileName);
  }
}

function parseTextBuffer(buffer: Buffer | Uint8Array, fileName: string): ParsedDocumentResult {
  const rawText = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : new TextDecoder("utf8").decode(buffer);
  const clean = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");

  return {
    fileName,
    format: "text",
    sheets: [],
    fullText: `=== DOCUMENTO TEXTUAL OFICIAL: "${fileName}" ===\n${clean}`,
    summary: `Documento de texto "${fileName}" (${clean.length} caracteres).`,
  };
}

function normalizeForMatch(s?: string | null): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.(?:com|org|net|edu|gob|gov|ar|cl|uy|br|es|io|co)+/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_STOP_WORDS = new Set([
  "de", "del", "la", "las", "el", "los", "en", "y", "e", "o", "u", "para", "por", "con", "sin",
  "una", "uno", "unos", "unas", "tu", "tus", "su", "sus", "al", "lo", "mas", "como", "que",
  "argentina", "chile", "uruguay", "brasil", "espana", "mexico", "buenos", "aires", "mendoza", "cordoba", "rosario",
]);

function getDistinctiveTokens(s?: string | null): string[] {
  const norm = normalizeForMatch(s);
  if (!norm) return [];
  return norm.split(" ").filter((w) => w.length >= 3 && !GENERIC_STOP_WORDS.has(w));
}

/**
 * Matches a single Excel/CSV row against a target publication (by title, publisherName, or URL/brand)
 * and returns a relevance score.
 */
function scoreRowAgainstPublication(
  rowCells: string[],
  pub: { title?: string; publisherName?: string; country?: string; city?: string }
): number {
  const nonEmptyCells = rowCells.map((c) => c.trim()).filter(Boolean);
  if (nonEmptyCells.length === 0) return 0;

  const pubTitleNorm = normalizeForMatch(pub.title);
  const pubBrandNorm = normalizeForMatch(pub.publisherName);
  const brandTokens = getDistinctiveTokens(pub.publisherName);
  const titleTokens = getDistinctiveTokens(pub.title);

  let bestScore = 0;

  // Check first 3 columns (where publication name / oferente name is typically placed) and full row
  for (let i = 0; i < nonEmptyCells.length; i++) {
    const cellNorm = normalizeForMatch(nonEmptyCells[i]);
    if (!cellNorm || cellNorm.length < 2) continue;
    const isNameColumn = i <= 2 && cellNorm.length <= 90;

    // 1. Exact match on publisherName or publication title
    if (pubBrandNorm && pubBrandNorm.length >= 3) {
      if (cellNorm === pubBrandNorm) {
        bestScore = Math.max(bestScore, isNameColumn ? 200 : 140);
      } else if (isNameColumn && (cellNorm.includes(pubBrandNorm) || (cellNorm.length >= 4 && pubBrandNorm.includes(cellNorm)))) {
        bestScore = Math.max(bestScore, 160);
      } else if (cellNorm.includes(pubBrandNorm)) {
        bestScore = Math.max(bestScore, 110);
      }
    }

    if (pubTitleNorm && pubTitleNorm.length >= 4) {
      if (cellNorm === pubTitleNorm) {
        bestScore = Math.max(bestScore, isNameColumn ? 200 : 140);
      } else if (isNameColumn && (cellNorm.includes(pubTitleNorm) || (cellNorm.length >= 6 && pubTitleNorm.includes(cellNorm)))) {
        bestScore = Math.max(bestScore, 155);
      } else if (cellNorm.includes(pubTitleNorm)) {
        bestScore = Math.max(bestScore, 105);
      }
    }

    // 2. Token overlap on brandTokens (e.g., "Universidad Siglo 21" vs "Siglo 21", "Hospital Italiano de Mendoza" vs "Hospital Italiano")
    if (brandTokens.length > 0 && isNameColumn) {
      const cellWords = new Set(cellNorm.split(" "));
      const matchedBrandTokens = brandTokens.filter((t) => cellWords.has(t) || cellNorm.includes(t));
      if (matchedBrandTokens.length > 0) {
        const ratio = matchedBrandTokens.length / brandTokens.length;
        if (ratio >= 0.6 || (matchedBrandTokens.length >= 2 && matchedBrandTokens.some((t) => t.length >= 5))) {
          bestScore = Math.max(bestScore, Math.round(95 + ratio * 50));
        } else if (matchedBrandTokens.length === 1 && matchedBrandTokens[0].length >= 5 && !/^(?:universidad|instituto|hospital|clinica|colegio|fundacion|centro|servicio|estudio|agencia)$/i.test(matchedBrandTokens[0])) {
          bestScore = Math.max(bestScore, 120);
        }
      }
    }

    // 3. Token overlap on publication titleTokens
    if (titleTokens.length >= 2 && isNameColumn) {
      const cellWords = new Set(cellNorm.split(" "));
      const matchedTitleTokens = titleTokens.filter((t) => cellWords.has(t));
      const ratio = matchedTitleTokens.length / titleTokens.length;
      if (matchedTitleTokens.length >= 2 && ratio >= 0.5) {
        bestScore = Math.max(bestScore, Math.round(85 + ratio * 50));
      }
    }
  }

  return bestScore;
}

const INSTRUCTION_HEADER_REGEX =
  /\b(?:instrucci[oó]n(?:es)?|prompt|indicaci[oó]n(?:es)?|directiva(?:s)?|regla(?:s)?\s*(?:para\s*la\s*ia|de\s*redacci[oó]n)?|como\s+redactar|estilo|formato\s+ia|nota\s+para\s+la\s+ia)\b/i;

const INSTRUCTION_CELL_PREFIX_REGEX =
  /^(?:instrucci[oó]n(?:es)?(?:\s+para\s+la\s+ia)?|prompt(?:\s+para\s+la\s+ia)?|indicaci[oó]n(?:es)?|nota\s+para\s+la\s+ia|directiva)\s*[:\-–—]/i;

const IMPERATIVE_AI_INSTRUCTION_REGEX =
  /\b(?:actu[aá]\s+como|redact[aá]|gener[aá]|escrib[ií]|us[aá]\s+(?:un\s+)?tono|en\s+\d+\s+p[aá]rrafos?|m[aá]ximo\s+\d+\s+palabras|color\s+(?:azul|rojo|verde|gris|negro|naranja|violeta)|t[ií]tulos?\s+en\s+(?:azul|negrita|color)|sin\s+emojis|con\s+vi[ñn]etas|para\s+todas\s+las\s+publicaciones)\b/i;

/**
 * Extracts publication-specific rows AND embedded AI instructions from an uploaded Excel/CSV/Document.
 */
export function extractPublicationSpecificContext(
  doc: ParsedDocumentResult,
  context: {
    title?: string;
    publisherName?: string;
    country?: string;
    city?: string;
    blockTitle?: string;
    totalTargetPublications?: number;
    publicationIndex?: number;
  }
): PublicationDocumentMatch {
  const globalInstructions: string[] = [];
  const rowSpecificInstructions: string[] = [];
  const matchedRowsFormatted: string[] = [];
  let hasExactPublicationMatch = false;

  if (doc.sheets.length > 0) {
    for (const sheet of doc.sheets) {
      const headers = sheet.headers || Object.keys(sheet.rows[0] || {});

      // Identify which columns are explicitly instruction/prompt columns
      const instructionColKeys = headers.filter((h) => INSTRUCTION_HEADER_REGEX.test(h));

      // Score every row in this sheet against the current publication
      const scoredRows = sheet.rows.map((rowObj, idx) => {
        const values = headers.map((h) => String(rowObj[h] ?? "").trim());
        const score = scoreRowAgainstPublication(values, context);
        return { rowObj, values, idx, score };
      });

      // Detect global instruction rows (rows that don't match a specific publication or explicitly declare global AI instructions)
      for (const item of scoredRows) {
        const nonEmptyVals = item.values.filter(Boolean);
        const joinedRow = nonEmptyVals.join(" — ");
        if (!joinedRow) continue;

        const firstCell = nonEmptyVals[0] || "";
        const isExplicitInstructionRow =
          INSTRUCTION_CELL_PREFIX_REGEX.test(firstCell) ||
          (nonEmptyVals.length <= 2 && INSTRUCTION_HEADER_REGEX.test(firstCell)) ||
          (item.score < 80 && nonEmptyVals.length === 1 && IMPERATIVE_AI_INSTRUCTION_REGEX.test(firstCell));

        if (isExplicitInstructionRow) {
          const cleanedInstr = joinedRow.replace(INSTRUCTION_CELL_PREFIX_REGEX, "").trim();
          if (cleanedInstr && !globalInstructions.includes(cleanedInstr)) {
            globalInstructions.push(cleanedInstr);
          }
        }
      }

      // Also check if headers themselves contained an instruction phrase
      for (const rawRow of sheet.rawMatrix.slice(0, 2)) {
        for (const cell of rawRow) {
          if (INSTRUCTION_CELL_PREFIX_REGEX.test(cell) || (cell.length > 35 && IMPERATIVE_AI_INSTRUCTION_REGEX.test(cell))) {
            const cleanCell = cell.replace(INSTRUCTION_CELL_PREFIX_REGEX, "").trim();
            if (cleanCell && !globalInstructions.includes(cleanCell)) {
              globalInstructions.push(cleanCell);
            }
          }
        }
      }

      // Filter rows that match THIS publication (score >= 85)
      const bestMatchedForPub = scoredRows
        .filter((r) => r.score >= 85)
        .sort((a, b) => b.score - a.score);

      if (bestMatchedForPub.length > 0) {
        hasExactPublicationMatch = true;
        const topScore = bestMatchedForPub[0].score;
        // Keep rows within top tier for this publication
        const relevantPubRows = bestMatchedForPub.filter((r) => r.score >= Math.max(85, topScore - 35));

        for (const matched of relevantPubRows) {
          const details: string[] = [];
          for (const h of headers) {
            const val = String(matched.rowObj[h] ?? "").trim();
            if (!val) continue;
            if (instructionColKeys.includes(h) || INSTRUCTION_CELL_PREFIX_REGEX.test(val)) {
              const cleanVal = val.replace(INSTRUCTION_CELL_PREFIX_REGEX, "").trim();
              if (cleanVal && !rowSpecificInstructions.includes(cleanVal)) {
                rowSpecificInstructions.push(cleanVal);
              }
            }
            const displayHeader = /^Columna_\d+$|^Col_\d+$/i.test(h) ? "" : `${h}: `;
            details.push(`${displayHeader}${val}`);
          }
          if (details.length > 0) {
            matchedRowsFormatted.push(`• ${details.join(" | ")}`);
          }
        }
      }
    }
  } else {
    // Plain text / JSON document: look for lines with instructions and paragraphs matching publication name
    const lines = doc.fullText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (INSTRUCTION_CELL_PREFIX_REGEX.test(line) || IMPERATIVE_AI_INSTRUCTION_REGEX.test(line)) {
        const cleanLine = line.replace(INSTRUCTION_CELL_PREFIX_REGEX, "").trim();
        if (cleanLine && !globalInstructions.includes(cleanLine)) {
          globalInstructions.push(cleanLine);
        }
      }
      const lineScore = scoreRowAgainstPublication([line], context);
      if (lineScore >= 100) {
        hasExactPublicationMatch = true;
        matchedRowsFormatted.push(`• ${line}`);
      }
    }
  }

  const allExcelInstructions = [...rowSpecificInstructions, ...globalInstructions].filter(Boolean).join("\n");

  const contextSections: string[] = [];

  if (matchedRowsFormatted.length > 0) {
    contextSections.push(
      `=== DATOS ESPECÍFICOS ENCONTRADOS EN EL EXCEL PARA "${context.publisherName || context.title}" ===\n` +
      `IMPORTANTE: Usa EXCLUSIVAMENTE esta información que corresponde a "${context.publisherName || context.title}" (NO mezcles datos de otras publicaciones del Excel):\n` +
      matchedRowsFormatted.join("\n")
    );
  }

  if (allExcelInstructions) {
    contextSections.push(
      `=== INSTRUCCIONES PARA LA IA INCLUIDAS DENTRO DEL EXCEL ===\n${allExcelInstructions}`
    );
  }

  // If no specific row matched by publication name (e.g., the Excel is a general country/normative table),
  // fall back to country/city/topic filtering or full document text.
  if (matchedRowsFormatted.length === 0) {
    const fallbackText = filterDocumentByGeneralContext(doc, context);
    contextSections.push(fallbackText);
  } else if (doc.fullText.length <= 6000) {
    contextSections.push(`=== TABLA COMPLETA DEL ARCHIVO (REFERENCIA GENERAL - NO MEZCLAR OTRAS PUBLICACIONES) ===\n${doc.fullText}`);
  }

  return {
    contextText: contextSections.join("\n\n"),
    excelInstructions: allExcelInstructions,
    matchedRowsText: matchedRowsFormatted,
    hasExactPublicationMatch,
  };
}

function filterDocumentByGeneralContext(
  doc: ParsedDocumentResult,
  context: { title?: string; country?: string; city?: string; publisherName?: string; blockTitle?: string }
): string {
  if (doc.fullText.length <= 12000) {
    return doc.fullText;
  }

  const queryTerms = [
    context.publisherName,
    context.title,
    context.country,
    context.city,
    context.blockTitle,
  ]
    .filter(Boolean)
    .map((t) => (t as string).toLowerCase().trim());

  if (doc.sheets.length > 0) {
    const matchingParts: string[] = [];
    for (const sheet of doc.sheets) {
      const matchingRows = sheet.rows.filter((row) => {
        const rowStr = Object.values(row).join(" ").toLowerCase();
        return queryTerms.some((term) => term.length > 3 && rowStr.includes(term));
      });

      if (matchingRows.length > 0) {
        const headers = Object.keys(matchingRows[0]);
        const mdLines = [
          `| ${headers.join(" | ")} |`,
          `| ${headers.map(() => "---").join(" | ")} |`,
          ...matchingRows.map((r) => `| ${headers.map((h) => String(r[h] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`),
        ];
        matchingParts.push(`=== HOJA: "${sheet.name}" (Filas coincidentes) ===\n${mdLines.join("\n")}`);
      }
    }

    if (matchingParts.length > 0) {
      return matchingParts.join("\n\n");
    }
  }

  const paragraphs = doc.fullText.split("\n\n");
  const relevantParas = paragraphs.filter((p) => {
    const pLower = p.toLowerCase();
    return queryTerms.some((term) => term.length > 3 && pLower.includes(term));
  });

  if (relevantParas.length > 0) {
    return `=== EXTRACTO DE DOCUMENTO OFICIAL PARA ${context.publisherName || context.title || context.country || "LA PUBLICACIÓN"} ===\n\n${relevantParas.slice(0, 25).join("\n\n")}`;
  }

  return doc.fullText.slice(0, 10000);
}

/**
 * Backwards-compatible wrapper used by document-block-update route.
 */
export function filterDocumentForContext(
  doc: ParsedDocumentResult,
  context: { title?: string; country?: string; city?: string; publisherName?: string; blockTitle?: string }
): string {
  return extractPublicationSpecificContext(doc, context).contextText;
}
