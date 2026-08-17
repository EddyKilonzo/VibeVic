import type { Metadata } from "next";
import AdminMedia from "@/views/admin/AdminMedia";

export const metadata: Metadata = { title: "Media" };

export default function MediaRoute() {
  return <AdminMedia />;
}
