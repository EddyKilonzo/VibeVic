import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminDiagnostics from "@/views/admin/AdminDiagnostics";
import { RoleWall } from "@/components/admin/RoleWall";
import { currentSession } from "@/lib/newsroom-auth";
import { can } from "@/lib/newsroom-scopes";

export const metadata: Metadata = { title: "Diagnostics" };

/**
 * Dev-side. The rail does not offer this row to a writer; this is what stops
 * one who types the path, and the API refuses the call underneath regardless.
 */
export default async function DiagnosticsRoute() {
  const session = await currentSession();
  if (!session) redirect("/newsroom-access");

  if (!can(session.role, "system:diagnostics")) {
    return <RoleWall role={session.role} scope="system:diagnostics" what="Diagnostics" />;
  }

  return <AdminDiagnostics />;
}
