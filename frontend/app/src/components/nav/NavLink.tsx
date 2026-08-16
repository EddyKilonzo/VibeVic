"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface RenderArgs {
  isActive: boolean;
}

export interface NavLinkProps {
  href: string;
  /** Match the path exactly instead of by prefix. */
  end?: boolean;
  onClick?: () => void;
  "aria-label"?: string;
  className?: string | ((args: RenderArgs) => string);
  children: ReactNode | ((args: RenderArgs) => ReactNode);
}

/**
 * A link that knows whether it points at the current page.
 *
 * Next has no built-in equivalent, and both navigations in this product need
 * the active flag in two places at once — to colour the label, and to decide
 * which link renders the shared sliding indicator. Passing it through a render
 * prop keeps that decision at the call site rather than duplicating the
 * pathname comparison in every nav.
 */
export function NavLink({
  href,
  end = false,
  onClick,
  className,
  children,
  ...rest
}: NavLinkProps) {
  const pathname = usePathname() ?? "/";
  const isActive = end
    ? pathname === href
    : href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={typeof className === "function" ? className({ isActive }) : className}
      {...rest}
    >
      {typeof children === "function" ? children({ isActive }) : children}
    </Link>
  );
}
