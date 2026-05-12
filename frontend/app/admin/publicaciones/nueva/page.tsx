import AdminControlLayout from "@/app/admin/ui/AdminControlLayout";
import AdminPanel from "@/app/admin/ui/AdminPanel";
import { getAdminFromCookie } from "@/app/api/_lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewPublicationPage() {
  const admin = await getAdminFromCookie();
  if (!admin) {
    redirect("/admin/login?next=/admin/publicaciones/nueva");
  }

  return (
    <AdminControlLayout activeSection="publicaciones">
      <AdminPanel section="publicaciones" publicationsView="new" />
    </AdminControlLayout>
  );
}
