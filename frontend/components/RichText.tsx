const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "br",
  "p",
  "div",
  "span",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "blockquote",
]);

const ALLOWED_STYLES = new Set([
  "color",
  "font-size",
  "font-style",
  "font-weight",
  "text-align",
  "text-decoration",
  "text-decoration-line",
]);

function normalizeVisibleText(value: string) {
  const raw = String(value ?? "");
  if (!raw) return "";

  let normalized = raw
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã¼/g, "ü")
    .replace(/Ã/g, "Á")
    .replace(/Ã‰/g, "É")
    .replace(/Ã/g, "Í")
    .replace(/Ã“/g, "Ó")
    .replace(/Ãš/g, "Ú")
    .replace(/Ã‘/g, "Ñ")
    .replace(/Â¿/g, "¿")
    .replace(/Â¡/g, "¡")
    .replace(/â†/g, "←")
    .replace(/â†’/g, "→")
    .replace(/â€”/g, "—")
    .replace(/â€“/g, "–")
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”")
    .replace(/â€˜/g, "‘")
    .replace(/â€™/g, "’");

  if (/[ÃÂâ]/.test(normalized)) {
    try {
      const bytes = Uint8Array.from(normalized, (char) => char.charCodeAt(0));
      const decoded = new TextDecoder("utf-8").decode(bytes);
      if (decoded && decoded !== normalized) normalized = decoded;
    } catch {
      // keep best effort text
    }
  }

  return normalized;
}

function escapeHtml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeColor(value: string) {
  const color = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) return color;
  const rgbMatch = color.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) return "";
  const parts = rgbMatch[1].split(",").map((part) => part.trim());
  if (![3, 4].includes(parts.length)) return "";
  const [r, g, b, a] = parts;
  const validChannel = (part: string) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255;
  const validAlpha = (part: string | undefined) => part === undefined || (/^(0|1|0?\.\d+)$/.test(part) && Number(part) >= 0 && Number(part) <= 1);
  if (!validChannel(r) || !validChannel(g) || !validChannel(b) || !validAlpha(a)) return "";
  return parts.length === 4 ? `rgba(${r}, ${g}, ${b}, ${a})` : `rgb(${r}, ${g}, ${b})`;
}

function sanitizeStyle(value: string) {
  return value
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [rawName, ...rawValueParts] = chunk.split(":");
      const name = String(rawName ?? "").trim().toLowerCase();
      const styleValue = rawValueParts.join(":").trim().toLowerCase();
      if (!ALLOWED_STYLES.has(name)) return "";
      if (name === "color") {
        const safeColor = sanitizeColor(styleValue);
        return safeColor ? `${name}: ${safeColor}` : "";
      }
      if (name === "font-size" && !/^(12|14|16|18|20|24|28|32)px$/.test(styleValue)) return "";
      if (name === "font-style" && !/^(normal|italic)$/.test(styleValue)) return "";
      if (name === "font-weight" && !/^(normal|bold|[1-9]00)$/.test(styleValue)) return "";
      if (name === "text-align" && !/^(left|center|right|justify)$/.test(styleValue)) return "";
      if (["text-decoration", "text-decoration-line"].includes(name) && !/^(none|underline)$/.test(styleValue)) return "";
      return `${name}: ${styleValue}`;
    })
    .filter(Boolean)
    .join("; ");
}

export function sanitizeRichText(value: string) {
  const input = normalizeVisibleText(String(value ?? ""));
  if (!/<\/?[a-z][\s\S]*>/i.test(input)) return escapeHtml(input).replace(/\n/g, "<br />");

  return input.replace(/<\/?[^>]+>/g, (tag) => {
    const isClosing = /^<\//.test(tag);
    const tagMatch = tag.match(/^<\/?\s*([a-z0-9]+)/i);
    const tagName = tagMatch?.[1]?.toLowerCase() ?? "";
    if (!ALLOWED_TAGS.has(tagName)) return "";
    if (isClosing) return `</${tagName}>`;
    if (tagName === "br") return "<br />";

    const styleMatch = tag.match(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i);
    const safeStyle = sanitizeStyle(styleMatch?.[2] ?? styleMatch?.[3] ?? "");
    return safeStyle ? `<${tagName} style="${safeStyle}">` : `<${tagName}>`;
  });
}

export default function RichText({ value, className = "" }: { value?: string | null; className?: string }) {
  const html = sanitizeRichText(String(value ?? ""));
  if (!String(value ?? "").trim()) return null;
  return <div className={`rich-text-content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
