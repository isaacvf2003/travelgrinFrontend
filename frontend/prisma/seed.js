/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Seed mínimo para TravelGrin:
 * - SOLO crea el bloque fijo de Precio (price) con sus opciones.
 * - El resto de bloques (Modalidad, Tipo de oferente, etc.) los crea el admin.
 */
async function main() {
  const priceGroup = await prisma.filterGroup.upsert({
    where: { key: "price" },
    update: {
      label: "Precio",
      type: "range",
      order: 999,
    },
    create: {
      key: "price",
      label: "Precio",
      type: "range",
      order: 999,
    },
  });

  // Opciones fijas (checkbox) para el bloque de Precio
  const options = [
    { value: "0-100000", label: "Hasta $100.000" },
    { value: "200000-300000", label: "De $200.000 a $300.000" },
    { value: "300001-999999999", label: "Más $300.000" },
    { value: "negotiable", label: "Precio a convenir" },
  ];

  // Limpiar opciones anteriores (solo de price) y recrear
  await prisma.filterOption.deleteMany({ where: { groupId: priceGroup.id } });
  await prisma.filterOption.createMany({
    data: options.map((o, idx) => ({
      groupId: priceGroup.id,
      value: o.value,
      label: o.label,
      order: idx,
    })),
  });

  // ------------------------------------------------------------
  // Categorías base (las que aparecen en el buscador del inicio)
  // ------------------------------------------------------------
  // Importante: el admin puede crear MÁS categorías/subcategorías para filtros,
  // pero el buscador principal sigue mostrando solo este set "principal".
  const baseRootCategories = [
    "Educación y Centros de Estudios",
    "Voluntariados y Centros de Ayuda",
    "Gestiones migratorias y Visas",
    "Salud y Centros Médicos",
    "Emprendimientos y Negocios",
    "Empleos Temporales",
    "Deportes y Entrenamientos",
  ];

  for (const description of baseRootCategories) {
    const existing = await prisma.category.findFirst({
      where: { description, parentId: null },
      select: { id: true, taxonomyType: true },
    });

    if (!existing) {
      await prisma.category.create({
        data: {
          description,
          taxonomyType: "default",
          parentId: null,
        },
      });
    } else if (existing.taxonomyType !== "default") {
      await prisma.category.update({
        where: { id: existing.id },
        data: { taxonomyType: "default" },
      });
    }
  }

  console.log("✅ Seed listo: bloque Precio + categorías base");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
