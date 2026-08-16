import type { Metadata } from "next";
import { AccessForm } from "@/components/admin/AccessForm";

export const metadata: Metadata = {
  title: "Newsroom access",
  // Never index the door to the private workspace.
  robots: { index: false, follow: false },
};

export default async function NewsroomAccess({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; unconfigured?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main
      id="main"
      className="honeycomb honeycomb-strong flex min-h-screen items-center justify-center px-5 py-16"
    >
      <AccessForm
        next={params.next}
        unconfigured={params.unconfigured === "1"}
        failed={params.error === "1"}
      />
    </main>
  );
}
