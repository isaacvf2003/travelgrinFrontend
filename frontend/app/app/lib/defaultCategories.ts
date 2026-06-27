// Auto-seeded categories that power the HOME and TOP search dropdowns.
// IMPORTANT:
// - These MUST always exist in the DB (option B). If an admin deletes them, we re-create them automatically.
// - New admin categories are allowed, but they will ONLY appear in the /buscar filters (not in the home/top search dropdowns).

export const BASE_CATEGORIES: string[] = [
  "Educación y Centros de Estudios",
  "Voluntariados y Centros de Ayuda",
  "Gestiones migratorias y Visas",
  "Salud y Centros Médicos",
  "Empleos Temporales",
  "Emprendimientos y Negocios",
  "Deportes y Entrenamientos"
];

export function isBaseCategory(label: string) {
  return BASE_CATEGORIES.includes(label);
}
