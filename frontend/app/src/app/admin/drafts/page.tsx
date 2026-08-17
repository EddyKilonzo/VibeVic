import type { Metadata } from "next";
import AdminDrafts from "@/views/admin/AdminDrafts";

export const metadata: Metadata = { title: "Drafts" };

export default function DraftsRoute() {
  return <AdminDrafts />;
}
