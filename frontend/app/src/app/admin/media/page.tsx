import type { Metadata } from "next";
import AdminPlaceholder from "@/views/admin/AdminPlaceholder";

export const metadata: Metadata = { title: "Media" };

/**
 * Routed but not yet built. The nav links here on purpose — a dead link in a
 * sidebar is worse than a screen that says plainly what is coming.
 */
export default function MediaRoute() {
  return <AdminPlaceholder title="Media" />;
}
