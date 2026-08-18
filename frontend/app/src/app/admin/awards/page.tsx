import type { Metadata } from "next";
import AdminAwards from "@/views/admin/AdminAwards";

export const metadata: Metadata = { title: "Awards" };

export default function AwardsRoute() {
  return <AdminAwards />;
}
