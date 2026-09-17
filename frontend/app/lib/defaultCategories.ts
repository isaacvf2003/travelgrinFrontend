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
