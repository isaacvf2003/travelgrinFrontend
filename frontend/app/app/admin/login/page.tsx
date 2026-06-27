import { redirect } from "next/navigation";
import { getAdminFromCookie } from "@/app/api/_lib/auth";
import AdminLoginForm from "./AdminLoginForm";
import { getDefaultAdminEmail } from "@/app/lib/adminSecurity";

export const dynamic = "force-dynamic";

type AdminLoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const admin = await getAdminFromCookie();
  if (admin) {
    redirect("/admin");
  }

  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  return <AdminLoginForm nextPath={next} defaultEmail={getDefaultAdminEmail()} />;
}
