import { NextResponse } from "next/server";

// Placeholder. Acá después conectamos Mercado Pago / dLocal Go.
// La idea es que este endpoint reciba el evento, lo valide (firma),
// y actualice PublicationPayment + Publication.featured/status.

export async function POST(req: Request) {
  const raw = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, received: raw });
}
