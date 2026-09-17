import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await Promise.resolve(ctx.params);

  const item = await prisma.publication.findUnique({
    where: { id },
    include: {
      filterOptions: {
        include: {
          filterOption: {
            include: {
              group: {
                select: { taxonomyType: true },
              },
            },
          },
        },
      },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}
