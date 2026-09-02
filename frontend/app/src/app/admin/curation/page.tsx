import type { Metadata } from "next";
import AdminCuration from "@/views/admin/AdminCuration";

export const metadata: Metadata = { title: "Curation" };

export default function CurationRoute() {
  return <AdminCuration />;
}
