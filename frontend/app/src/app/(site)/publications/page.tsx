import type { Metadata } from "next";
import Publications from "@/views/Publications";

export const metadata: Metadata = {
  title: "Platforms",
  description: "Where the work is published and how to reach it.",
};

export default function PublicationsRoute() {
  return <Publications />;
}
