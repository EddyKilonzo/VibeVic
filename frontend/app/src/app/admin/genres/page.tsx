import type { Metadata } from "next";
import AdminPlaceholder from "@/views/admin/AdminPlaceholder";

export const metadata: Metadata = { title: "Genres & tags" };

/**
 * Routed but not yet built. The nav links here on purpose — a dead link in a
 * sidebar is worse than a screen that says plainly what is coming.
 */
export default function GenresRoute() {
  return <AdminPlaceholder title="Genres & tags" />;
}
