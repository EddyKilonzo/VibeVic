import type { Metadata } from "next";
import Awards from "@/views/Awards";
import { getAwards } from "@/data/server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Recognition",
  description: "Recognition for the reporting.",
  path: "/awards",
});

export default async function AwardsRoute() {
  const awards = await getAwards();
  return <Awards awards={awards} />;
}