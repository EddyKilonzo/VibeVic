import type { Metadata } from "next";
import AdminStories from "@/views/admin/AdminStories";

export const metadata: Metadata = { title: "Stories" };

export default function AdminStoriesRoute() {
  return <AdminStories />;
}
