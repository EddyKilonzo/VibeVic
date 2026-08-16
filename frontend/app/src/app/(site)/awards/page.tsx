import type { Metadata } from "next";
import Awards from "@/views/Awards";

export const metadata: Metadata = {
  title: "Recognition",
  description: "Recognition for the reporting.",
};

export default function AwardsRoute() {
  return <Awards />;
}
