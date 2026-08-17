import type { Metadata } from "next";
import Contact from "@/views/Contact";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Contact",
  description: "How to reach the newsroom, including for confidential tips.",
  path: "/contact",
});

export default function ContactRoute() {
  return <Contact />;
}