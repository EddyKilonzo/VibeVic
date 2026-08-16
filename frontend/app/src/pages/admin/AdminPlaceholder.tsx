"use client";

import Link from "next/link";
import { Construction } from "lucide-react";
import { Reveal } from "@/components/motion";
import { EmptyState } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

/**
 * Admin sections that are routed but not yet built.
 *
 * Shown as an honest "not built yet" rather than a mocked-up screen, so
 * nothing in the admin implies a capability that does not exist.
 */
export default function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-[900px]">
      <Reveal variant="fade-up">
        <p className="rule-label">Admin</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
      </Reveal>

      <div className="mt-8">
        <EmptyState
          icon={<Construction className="h-5 w-5" aria-hidden />}
          title={`${title} isn't built yet`}
          description="This section is routed and ready for its screen. Stories and the dashboard are the parts that work today."
          action={
            <Button as={Link} href="/admin/stories" variant="outline" size="sm">
              Go to stories
            </Button>
          }
        />
      </div>
    </div>
  );
}
