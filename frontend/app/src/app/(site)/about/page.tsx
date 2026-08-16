import type { Metadata } from "next";
import About from "@/views/About";
import { PROFILE } from "@/data/content";

export const metadata: Metadata = {
  title: "About",
  description: `${PROFILE.name}, ${PROFILE.role} based in ${PROFILE.base}. ${PROFILE.education}.`,
};

export default function AboutRoute() {
  return <About />;
}
