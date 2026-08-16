import type { Metadata } from "next";
import Contact from "@/views/Contact";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the newsroom, including for confidential tips.",
};

export default function ContactRoute() {
  return <Contact />;
}
