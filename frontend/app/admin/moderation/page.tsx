import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { getAccountBySessionToken, sessionCookie } from "@/lib/auth";
import "../admin.css";

export const runtime = "nodejs";

export default async function AdminModerationPage() {
  const token = (await cookies()).get(sessionCookie)?.value;
  const account = await getAccountBySessionToken(token);
  if (!account) redirect("/?auth=login&admin=1");
  if ((account.role !== "admin" && account.role !== "staff") || account.status !== "verified") {
    redirect("/?authError=admin_access");
  }
  return <AdminDashboard adminName={account.full_name} initialTab="MODERATION" role={account.role} />;
}
