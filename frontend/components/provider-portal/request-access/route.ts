import { NextResponse } from "next/server";
import { ensureSameOriginRequest } from "@/app/api/_lib/auth";
import { sendProviderPortalMagicLinkEmail } from "@/app/api/_lib/adminMail";
import { createProviderPortalMagicLink, getProviderPortalProfileName, portalEmailExists } from "@/app/api/_lib/providerPortal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProviderPortalLocale = keyof typeof messages;

function normalizeLocale(value: unknown): ProviderPortalLocale {
  const locale = String(value ?? "es").trim().toLowerCase().split("-")[0];
  return ["es", "en", "pt", "it"].includes(locale) ? locale as ProviderPortalLocale : "es";
}

const messages = {
  es: {
    invalidEmail: "Email invalido.",
    linkSent: "Si encontramos tu email, te enviamos un enlace seguro para entrar al mini panel.",
  },
  en: {
    invalidEmail: "Invalid email.",
    linkSent: "If we find your email, we will send you a secure link to access your mini panel.",
  },
  pt: {
    invalidEmail: "Email invalido.",
    linkSent: "Se encontrarmos seu email, enviaremos um link seguro para entrar no mini painel.",
  },
  it: {
    invalidEmail: "Email non valida.",
    linkSent: "Se troviamo la tua email, ti invieremo un link sicuro per accedere al mini pannello.",
  },
} as const;

export async function POST(req: Request) {
  try {
    await ensureSameOriginRequest();
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const locale = normalizeLocale(body?.locale);
    const copy = messages[locale];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: copy.invalidEmail }, { status: 400 });
    }

    const exists = await portalEmailExists(email);
    if (exists) {
      const result = await createProviderPortalMagicLink(email);
      if (!result.throttled && result.link) {
        const recipientName = await getProviderPortalProfileName(email).catch(() => "");
        await sendProviderPortalMagicLinkEmail({ email, locale, magicLink: result.link, recipientName });
      }
    }

    return NextResponse.json({
      ok: true,
      message: copy.linkSent,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
