import { prisma } from "@/app/lib/prisma";

const PRICE_BLOCK_KEY = "price";

const DEFAULT_PRICE_OPTIONS = [
  { value: "150000-250000", label: "ARS 150.000 - 250.000", order: 10 },
  { value: "250000-350000", label: "ARS 250.000 - 350.000", order: 20 },
  { value: "350000-650000", label: "ARS 350.000 - 650.000", order: 30 },
  { value: "800000+", label: "+800.000", order: 40 },
  { value: "negotiable", label: "Precio a convenir", order: 50 },
] as const;

export async function ensurePriceBlock() {
  const group = await prisma.filterGroup.upsert({
    where: { key: PRICE_BLOCK_KEY },
    update: {
      label: "Precio",
      labelI18n: { es: "Precio" },
      type: "range",
      taxonomyType: "price",
      isProfileBlock: false,
      isPublicVisible: true,
    },
    create: {
      key: PRICE_BLOCK_KEY,
      label: "Precio",
      labelI18n: { es: "Precio" },
      type: "range",
      taxonomyType: "price",
      isProfileBlock: false,
      isPublicVisible: true,
      order: 999,
    },
  });

  const existingOptions = await prisma.filterOption.findMany({
    where: { groupId: group.id },
    select: { id: true, value: true },
  });

  const existingValueSet = new Set(existingOptions.map((option) => String(option.value ?? "").trim().toLowerCase()));
  const missingOptions = DEFAULT_PRICE_OPTIONS.filter(
    (option) => !existingValueSet.has(String(option.value).toLowerCase())
  );

  if (missingOptions.length) {
    await prisma.filterOption.createMany({
      data: missingOptions.map((option) => ({
        groupId: group.id,
        value: option.value,
        label: option.label,
        labelI18n: { es: option.label },
        order: option.order,
      })),
    });
  }

  return group;
}

export async function isPriceGroupId(groupId: string | null | undefined) {
  if (!groupId) return false;
  const group = await prisma.filterGroup.findUnique({
    where: { id: groupId },
    select: { key: true },
  });
  return group?.key === PRICE_BLOCK_KEY;
}
