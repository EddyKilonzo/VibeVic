import type { Metadata } from "next";
import AdminIdeas from "@/views/admin/AdminIdeas";

export const metadata: Metadata = { title: "Ideas" };

export default function IdeasRoute() {
  return <AdminIdeas />;
}
