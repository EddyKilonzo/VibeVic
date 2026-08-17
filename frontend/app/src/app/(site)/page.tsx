import type { Metadata } from "next";
import Home from "@/views/Home";
import { PROFILE } from "@/data/content";
import { CHANNEL } from "@/data/videos";
import { pageMetadata } from "@/lib/seo";

// The home page inherited the root layout's metadata, which gave it a title
// and a description and no canonical at all — so every tracking or referral
// variant of "/" was a separate address as far as a crawler was concerned.
export const metadata: Metadata = {
  ...pageMetadata({
    title: `${PROFILE.name} — ${PROFILE.role}`,
    description: `Reporting from ${PROFILE.base}: campus systems, Kenyan culture and student life, published as video on ${CHANNEL.handle} and written up here.`,
    path: "/",
  }),
  // The root template appends the name to every title; the home page already
  // is the name, and "Victor Kiplimo — Journalist — Victor Kiplimo" is what
  // happens if you let a template run over a title that does not need it.
  title: { absolute: `${PROFILE.name} — ${PROFILE.role}` },
};

export default function HomeRoute() {
  return <Home />;
}