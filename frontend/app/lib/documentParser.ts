import * as XLSX from "xlsx";

export interface ParsedSheet {
  name: string;
  rowCount: number;
  markdownTable: string;
  rows: Array<Record<string, any>>;
}

export interface ParsedDocumentResult {
  fileName: string;
  format: "excel" | "csv" | "text" | "json";
  sheets: ParsedSheet[];
  fullText: string;
  summary: string;
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

  if (ext === "xlsx" || ext === "xls" || ext === "xlsm" || ext === "ods" || mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) {
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

function parseExcelBuffer(buffer: Buffer | Uint8Array, fileName: string): ParsedDocumentResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheets: ParsedSheet[] = [];
  const textParts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert to raw row arrays
    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
    if (!rawRows || rawRows.length === 0) continue;

    // Filter empty rows
    const nonEmptyRows = rawRows.filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ""));
    if (nonEmptyRows.length === 0) continue;

    // Build header and row objects
    const headers = (nonEmptyRows[0] || []).map((h: any, idx: number) => String(h).trim() || `Columna_${idx + 1}`);
    const dataRows = nonEmptyRows.slice(1);

    const objectRows: Array<Record<string, any>> = [];
    const mdLines: string[] = [];

    // Markdown Table Header
    mdLines.push(`| ${headers.join(" | ")} |`);
    mdLines.push(`| ${headers.map(() => "---").join(" | ")} |`);

    for (const row of dataRows) {
      const obj: Record<string, any> = {};
      const rowCols = headers.map((h, i) => {
        const val = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
        obj[h] = val;
        // Escape pipes for markdown table
        return val.replace(/\|/g, "\\|");
      });
      objectRows.push(obj);
      mdLines.push(`| ${rowCols.join(" | ")} |`);
    }

    const markdownTable = mdLines.join("\n");
    sheets.push({
      name: sheetName,
      rowCount: objectRows.length,
      markdownTable,
      rows: objectRows,
    });

    textParts.push(`=== HOJA EXCEL: "${sheetName}" (${objectRows.length} filas) ===\n${markdownTable}`);
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
    const nonEmptyRows = (rawRows || []).filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ""));
    if (nonEmptyRows.length > 0) {
      const headers = (nonEmptyRows[0] || []).map((h: any, idx: number) => String(h).trim() || `Col_${idx + 1}`);
      const dataRows = nonEmptyRows.slice(1);
      const objectRows: Array<Record<string, any>> = [];
      const mdLines: string[] = [];

      mdLines.push(`| ${headers.join(" | ")} |`);
      mdLines.push(`| ${headers.map(() => "---").join(" | ")} |`);

      for (const row of dataRows) {
        const obj: Record<string, any> = {};
        const cols = headers.map((h, i) => {
          const val = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : "";
          obj[h] = val;
          return val.replace(/\|/g, "\\|");
        });
        objectRows.push(obj);
        mdLines.push(`| ${cols.join(" | ")} |`);
      }

      const mdTable = mdLines.join("\n");
      return {
        fileName,
        format: "csv",
        sheets: [{ name: sheetName, rowCount: objectRows.length, markdownTable: mdTable, rows: objectRows }],
        fullText: `=== ARCHIVO CSV: "${fileName}" ===\n${mdTable}`,
        summary: `Archivo CSV "${fileName}" con ${objectRows.length} filas.`,
      };
    }
  }

  // Fallback to plain text
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

/**
 * Intelligent filter: If document is very large, filters sections/rows strictly
 * pertinent to the publication's country, entity name, or block topic to prevent
 * context overflow and ensure maximum grounding accuracy.
 */
export function filterDocumentForContext(
  doc: ParsedDocumentResult,
  context: { country?: string; city?: string; publisherName?: string; blockTitle?: string }
): string {
  // If text is under 12,000 characters, pass full text for complete holistic knowledge
  if (doc.fullText.length <= 12000) {
    return doc.fullText;
  }

  const queryTerms = [
    context.country,
    context.city,
    context.publisherName,
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
        matchingParts.push(`=== HOJA: "${sheet.name}" (Filas coincidentes con ${context.country || "el contexto"}) ===\n${mdLines.join("\n")}`);
      }
    }

    if (matchingParts.length > 0) {
      return matchingParts.join("\n\n");
    }
  }

  // Fallback: search paragraphs in full text
  const paragraphs = doc.fullText.split("\n\n");
  const relevantParas = paragraphs.filter((p) => {
    const pLower = p.toLowerCase();
    return queryTerms.some((term) => term.length > 3 && pLower.includes(term));
  });

  if (relevantParas.length > 0) {
    return `=== EXTRACTO DE DOCUMENTO OFICIAL PARA ${context.country || context.publisherName || "LA PUBLICACIÓN"} ===\n\n${relevantParas.slice(0, 25).join("\n\n")}`;
  }

  // If no specific keyword match, return first 10,000 chars
  return doc.fullText.slice(0, 10000);
}
