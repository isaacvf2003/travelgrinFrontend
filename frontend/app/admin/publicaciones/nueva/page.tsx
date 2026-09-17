import AdminControlLayout from "@/app/tgn-panel-control/ui/AdminControlLayout";
import AdminPanel from "@/app/tgn-panel-control/ui/AdminPanel";
import { getAdminFromCookie } from "@/app/api/_lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewPublicationPage() {
  const admin = await getAdminFromCookie();
  if (!admin) {
    redirect("/tgn-panel-control/login?next=/tgn-panel-control/publicaciones/nueva");
  }

  return (
    <AdminControlLayout activeSection="publicaciones">
      <AdminPanel section="publicaciones" publicationsView="new" />
    </AdminControlLayout>
  );
}
