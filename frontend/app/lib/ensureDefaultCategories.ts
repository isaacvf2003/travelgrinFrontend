import type { PrismaClient } from "@prisma/client";
import { BASE_CATEGORIES } from "./defaultCategories";

export async function ensureDefaultCategories(prisma: PrismaClient) {
  const existing = await prisma.category.findMany({
    where: {
      parentId: null,
      description: { in: BASE_CATEGORIES },
      taxonomyType: "default",
    },
    select: { description: true },
  });

  const existingSet = new Set(existing.map((c) => c.description));

  for (const description of BASE_CATEGORIES) {
    if (existingSet.has(description)) continue;
    await prisma.category.create({
      data: { description, taxonomyType: "default", parentId: null },
    });
  }
}
