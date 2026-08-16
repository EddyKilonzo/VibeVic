"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Read and write URL query state.
 *
 * Next's `useSearchParams` is read-only, and filtering needs both halves. The
 * important detail is `scroll: false`: changing a filter is not navigation,
 * and yanking the reader back to the top of the page every time they pick a
 * genre is the single most common way filter UI gets this wrong.
 */
export function useQueryParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  // Both are nullable in Next's types — during static prerender there is no
  // router yet. Falling back to "/" keeps the URL builder total.
  const path = pathname ?? "/";

  const setParams = useCallback(
    (next: Record<string, string | null>, options?: { replace?: boolean }) => {
      const search = new URLSearchParams(params?.toString() ?? "");

      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === "") search.delete(key);
        else search.set(key, value);
      }

      const query = search.toString();
      const url = query ? `${path}?${query}` : path;

      if (options?.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [params, path, router],
  );

  const get = useCallback(
    (key: string, fallback = "") => params?.get(key) ?? fallback,
    [params],
  );

  return { params, get, setParams } as const;
}
