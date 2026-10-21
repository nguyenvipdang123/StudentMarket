import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { getAccountBySessionToken, sessionCookie } from "@/lib/auth";
import "./admin.css";
import type { AdminTab } from "@/components/AdminOverview";

export const runtime = "nodejs";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const token = (await cookies()).get(sessionCookie)?.value;
  const account = await getAccountBySessionToken(token);
  if (!account) redirect("/?auth=login&admin=1");
  if (account.role !== "admin" || account.status !== "verified") redirect("/?authError=admin_access");
  const tab = (await searchParams).tab;
  const initialTab: AdminTab = tab === "ACCOUNTS" || tab === "REPORTS" || tab === "SUPPORT" ? tab : "OVERVIEW";
  return <AdminDashboard adminName={account.full_name} initialTab={initialTab} />;
}
