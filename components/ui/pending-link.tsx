"use client";

import clsx from "clsx";
import Link, { type LinkProps } from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

type PendingLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  LinkProps & {
    children: ReactNode;
    pendingClassName?: string;
  };

function hrefToString(href: LinkProps["href"]) {
  if (typeof href === "string") {
    return href;
  }

  const pathname = href.pathname ?? "";
  const query = href.query
    ? Object.entries(href.query)
        .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
        .join("&")
    : "";

  return query ? `${pathname}?${query}` : pathname;
}

function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

export function PendingLink({ children, className, pendingClassName, href, onClick, onMouseEnter, onFocus, onTouchStart, ...props }: PendingLinkProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);
  const hrefString = useMemo(() => hrefToString(href), [href]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsPending(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams]);

  function prefetch() {
    if (hrefString.startsWith("/") && hrefString !== `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`) {
      router.prefetch(hrefString);
    }
  }

  return (
    <Link
      {...props}
      href={href}
      className={clsx(className, isPending && pendingClassName, isPending && "is-pending")}
      aria-busy={isPending || undefined}
      data-pending={isPending ? "true" : undefined}
      onMouseEnter={(event) => {
        prefetch();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetch();
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        prefetch();
        onTouchStart?.(event);
      }}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented && !isModifiedClick(event) && hrefString.startsWith("/")) {
          setIsPending(true);
        }
      }}
    >
      {children}
    </Link>
  );
}
