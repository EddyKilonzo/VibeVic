import type { Metadata } from "next";
import { ResetForm } from "@/components/admin/ResetForm";

export const metadata: Metadata = {
  title: "Choose a password",
  /*
   * `noindex` for the same reason as the rest of this route, and `nofollow`
   * carries extra weight here: the address in a crawler's queue would be one
   * containing a live reset token.
   */
  robots: { index: false, follow: false },
};

export default async function ChoosePassword({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main
      id="main"
      className="honeycomb honeycomb-strong flex min-h-screen items-center justify-center px-5 py-16"
    >
      {/*
        The token is handed to the form and never validated here. Checking it
        on render would mean a page that says "expired" before anyone has
        typed anything — and, more to the point, it would be a second place
        that knows how a reset token is judged. The API is the only one.
      */}
      <ResetForm token={token} />
    </main>
  );
}
