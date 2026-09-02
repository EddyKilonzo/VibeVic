import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminAccounts from "@/views/admin/AdminAccounts";
import { RoleWall } from "@/components/admin/RoleWall";
import { currentSession } from "@/lib/newsroom-auth";
import { can } from "@/lib/newsroom-scopes";

export const metadata: Metadata = { title: "Accounts" };

/** Dev-side, like diagnostics. Checked here as well as at the API. */
export default async function AccountsRoute() {
  const session = await currentSession();
  if (!session) redirect("/newsroom-access");

  if (!can(session.role, "system:accounts")) {
    return <RoleWall role={session.role} scope="system:accounts" what="Accounts" />;
  }

  return <AdminAccounts />;
}
