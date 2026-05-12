export function slugifyPublicationTitle(title: string) {
  return String(title ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function publicationPath(id: string, title: string, basePath: "publicacion" | "prestaciones" = "publicacion") {
  const slug = slugifyPublicationTitle(title);
  return `/${basePath}/${slug ? `${slug}-` : ""}${id}`;
}

export function extractPublicationIdFromParam(param: string) {
  const raw = String(param ?? "").trim();
  if (!raw) return "";
  const parts = raw.split("-");
  const last = parts[parts.length - 1] ?? "";
  return last || raw;
}
