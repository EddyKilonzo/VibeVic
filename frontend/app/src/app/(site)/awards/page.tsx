import type { Metadata } from "next";
import Awards from "@/views/Awards";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Recognition",
  description: "Recognition for the reporting.",
  path: "/awards",
});

export default function AwardsRoute() {
  return <Awards />;
}