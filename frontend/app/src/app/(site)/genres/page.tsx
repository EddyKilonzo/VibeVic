import type { Metadata } from "next";
import Genres from "@/views/Genres";

export const metadata: Metadata = {
  title: "Beats",
  description: "The four subjects the reporting keeps returning to.",
};

export default function GenresRoute() {
  return <Genres />;
}
