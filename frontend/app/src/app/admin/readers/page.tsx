import type { Metadata } from "next";
import AdminReaders from "@/views/admin/AdminReaders";

export const metadata: Metadata = { title: "Readers" };

export default function ReadersRoute() {
  return <AdminReaders />;
}
