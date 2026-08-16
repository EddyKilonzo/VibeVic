import type { Metadata } from "next";
import Dashboard from "@/views/admin/Dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardRoute() {
  return <Dashboard />;
}
