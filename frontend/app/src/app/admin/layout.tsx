import type { Metadata } from "next";
import type { ReactNode } from "react";
import AdminLayout from "@/views/admin/AdminLayout";

export const metadata: Metadata = {
  title: { default: "Newsroom", template: "%s — Newsroom" },
  // The workspace is private working space, not published work.
  robots: { index: false, follow: false },
};

export default function AdminRouteLayout({ children }: { children: ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
