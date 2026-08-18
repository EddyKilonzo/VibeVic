import type { Metadata } from "next";
import AdminSettings from "@/views/admin/AdminSettings";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsRoute() {
  return <AdminSettings />;
}
