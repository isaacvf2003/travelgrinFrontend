import prisma from "@/app/lib/prisma";
import { translations } from "@/app/lib/translations";

/**
 * Base categories (ES) that power the HOME/TOP search dropdown.
 *
 * Notes:
 * - These are ROOT categories (parentId = null).
 * - Admin can create extra categories/subcategories; those will show in /buscar filters,
 *   but the HOME/TOP search keeps showing only these (it is hard-limited in the UI).
 */
export const BASE_CATEGORIES_ES = [
  "Educación y Centros de Estudios",
  "Voluntariados y Centros de Ayuda",
  "Gestiones migratorias y Visas",
  "Salud y Centros Médicos",
  "Emprendimientos y Negocios",
  "Empleos Temporales",
  "Deportes y Entrenamientos",
] as const;

const BASE_CATEGORY_KEYS: Record<(typeof BASE_CATEGORIES_ES)[number], keyof typeof translations.es> = {
  "Educación y Centros de Estudios": "educacion_y_centros_de_estudios_name",
  "Voluntariados y Centros de Ayuda": "voluntariados_y_centros_de_ayuda_name",
  "Gestiones migratorias y Visas": "gestiones_migratorias_y_visas_name",
  "Salud y Centros Médicos": "salud_y_centros_medicos_name",
  "Emprendimientos y Negocios": "emprendimientos_y_negocios_name",
  "Empleos Temporales": "empleos_temporales_name",
  "Deportes y Entrenamientos": "deportes_y_entrenamientos_name",
};

function buildCategoryI18n(label: (typeof BASE_CATEGORIES_ES)[number]) {
  const key = BASE_CATEGORY_KEYS[label];
  const out: Record<string, string> = {};
  for (const [locale, dict] of Object.entries(translations)) {
    const value = (dict as Record<string, string>)[key];
    if (value) out[locale] = value;
  }
  if (!out.es) out.es = label;
  return out;
}

function normalize(input: string): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeLoose(input: string): string {
  const base = normalize(input);
  return base
    .split(" ")
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w))
    .join(" ");
}

export async function ensureBaseCategories(): Promise<void> {
  const roots = await prisma.category.findMany({ where: { parentId: null } });

  const byLoose = new Map<string, typeof roots>();
  for (const r of roots) {
    const key = normalizeLoose(r.description);
    const list = byLoose.get(key) ?? [];
    list.push(r);
    byLoose.set(key, list);
  }

  for (const label of BASE_CATEGORIES_ES) {
    const key = normalizeLoose(label);
    const match = byLoose.get(key)?.[0];

    if (!match) {
      await prisma.category.create({
        data: {
          description: label,
          descriptionI18n: buildCategoryI18n(label),
          taxonomyType: "default",
          parentId: null,
        },
      });
      continue;
    }

    const nextI18n = buildCategoryI18n(label);
    if (match.description !== label || !match.descriptionI18n) {
      await prisma.category.update({
        where: { id: match.id },
        data: { description: label, descriptionI18n: nextI18n },
      });
    }
  }
}
