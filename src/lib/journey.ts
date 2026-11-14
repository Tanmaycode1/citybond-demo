export function resolveJourneyRole(route: string, requested: unknown, roles: { id: string }[]): string {
  const candidate = route.startsWith("for/") ? route.slice(4) : typeof requested === "string" ? requested : "";
  return roles.some(role => role.id === candidate) ? candidate : "";
}

// Carry an explicitly chosen perspective through browsing without storing it in a cookie.
export function journeyHref(href: string, role: string): string {
  if (!role || !href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://journey.local");
  if (url.pathname === "/" || url.pathname === "/architects" || url.pathname.startsWith("/for/")
    || /^\/(?:api|studio-7c9e)(?:\/|$)/.test(url.pathname)
    || /\.(?:pdf|jpg|jpeg|png|webp|avif)$/i.test(url.pathname)) return href;
  if (!url.searchParams.has("role")) url.searchParams.set("role", role);
  return url.pathname + url.search + url.hash;
}
