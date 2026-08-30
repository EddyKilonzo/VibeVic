import type { Metadata } from "next";
import { ForgotForm } from "@/components/admin/ForgotForm";

export const metadata: Metadata = {
  title: "Forgotten password",
  robots: { index: false, follow: false },
};

export default function ForgottenPassword() {
  return (
    <main
      id="main"
      className="honeycomb honeycomb-strong flex min-h-screen items-center justify-center px-5 py-16"
    >
      <ForgotForm />
    </main>
  );
}
