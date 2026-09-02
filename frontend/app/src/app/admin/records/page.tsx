import type { Metadata } from "next";
import AdminRecords from "@/views/admin/AdminRecords";

export const metadata: Metadata = { title: "Records" };

export default function RecordsRoute() {
  return <AdminRecords />;
}
