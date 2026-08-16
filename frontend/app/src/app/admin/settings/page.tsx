import type { Metadata } from "next";
import AdminPlaceholder from "@/views/admin/AdminPlaceholder";

export const metadata: Metadata = { title: "Settings" };

/**
 * Routed but not yet built. The nav links here on purpose — a dead link in a
 * sidebar is worse than a screen that says plainly what is coming.
 */
export default function SettingsRoute() {
  return <AdminPlaceholder title="Settings" />;
}
