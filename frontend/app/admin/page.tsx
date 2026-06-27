import AdminPanel from "./ui/AdminPanel";
import AdminControlLayout, { type AdminSection } from "./ui/AdminControlLayout";
import { getAdminFromCookie } from "@/app/api/_lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type AdminPageProps = {
  searchParams: Promise<{
    section?: string | string[];
  }>;
};

const allowedSections: AdminSection[] = ["panel", "usuarios", "categorias", "publicaciones", "feedback", "como-funciona", "configuracion", "contacto"];

function resolveSection(raw: string | string[] | undefined): AdminSection {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && allowedSections.includes(value as AdminSection)) {
    return value as AdminSection;
  }
  return "panel";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const admin = await getAdminFromCookie();
  if (!admin) {
    redirect("/admin/login?next=/admin");
  }

  const params = await searchParams;
  const activeSection = resolveSection(params?.section);

  return (
    <AdminControlLayout activeSection={activeSection}>
      <AdminPanel section={activeSection} />
    </AdminControlLayout>
  );
}
