import type { Metadata } from "next";
import AdminAnalytics from "@/views/admin/AdminAnalytics";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsRoute() {
  return <AdminAnalytics />;
}
