"use client";
import NextLink from "next/link";
import { useLayoutEffect, type ComponentProps } from "react";
import { navigationTarget } from "@/lib/navigation";
import { canonicalHref } from "@/lib/routes";
import { journeyHref } from "@/lib/journey";
import { useJourneyRole } from "./JourneyContext";
let pending: ReturnType<typeof navigationTarget> = null;
function scrollToDestination(hash: string) {
  const target = hash
    ? document.getElementById(decodeURIComponent(hash.slice(1)))
    : null;
  if (target) target.scrollIntoView({ behavior: "instant", block: "start" });
  else window.scrollTo({ left: 0, top: 0, behavior: "instant" });
}
export function usePageScroll(route: string) {
  useLayoutEffect(() => {
    if (!pending || pending.pathname !== location.pathname) return;
    const hash = pending.hash;
    pending = null;
    scrollToDestination(hash);
  }, [route]);
}
export default function SiteLink({
  onNavigate,
  ...props
}: ComponentProps<typeof NextLink>) {
  const role = useJourneyRole();
  const href =
    typeof props.href === "string" ? journeyHref(canonicalHref(props.href), role) : props.href;
  return (
    <NextLink
      {...props}
      href={href}
      scroll={false}
      onNavigate={(event) => {
        onNavigate?.(event);
        const next = navigationTarget(
          typeof href === "string" ? href : href.pathname || "",
          location.href,
        );
        if (!next) return;
        if (next.samePage) {
          pending = null;
          requestAnimationFrame(() => scrollToDestination(next.hash));
        } else pending = next;
      }}
    />
  );
}
