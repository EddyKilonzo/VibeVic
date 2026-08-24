import type { Metadata } from "next";
import About from "@/views/About";
import { PROFILE } from "@/data/content";
import { getPublications } from "@/data/server";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description: `${PROFILE.name}, ${PROFILE.role} based in ${PROFILE.base} and a ${PROFILE.educationStatus} at ${PROFILE.education}.`,
  path: "/about",
});

export default async function AboutRoute() {
  const publications = await getPublications();
  return <About publications={publications} />;
}