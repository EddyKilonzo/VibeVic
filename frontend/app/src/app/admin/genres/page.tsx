import type { Metadata } from "next";
import AdminBeats from "@/views/admin/AdminBeats";

export const metadata: Metadata = { title: "Beats" };

export default function GenresRoute() {
  return <AdminBeats />;
}
