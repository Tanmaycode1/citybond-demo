/** New pages start at the top; same-page anchors retain an intentional target. */
export function navigationTarget(href: string, current: string) {
  const from = new URL(current);
  const to = new URL(href, from);
  if (to.origin !== from.origin) return null;
  return {
    pathname: to.pathname,
    hash: to.hash,
    samePage: to.pathname === from.pathname && to.search === from.search,
  };
}
export function storyProgress(
  top: number,
  height: number,
  viewport: number,
  header = 80,
) {
  const travel = Math.max(1, height - (viewport - header));
  const progress = Math.max(0, Math.min(1, (header - top) / travel));
  const linear = Math.max(0, Math.min(1, (progress - 0.08) / 0.7));
  return {
    progress,
    assembly: linear * linear * (3 - 2 * linear),
    chapter: Math.min(2, Math.floor(progress * 3)),
  };
}
/** Keep authenticated draft navigation in the same revision without altering downloads. */
export function previewHref(href: string, preview: boolean) {
  if (!preview || !href.startsWith("/") || href.startsWith("//")) return href;
  const url = new URL(href, "https://preview.local");
  if (/^\/(?:api|studio-7c9e|assets|stock|images|citybond)(?:\/|$)/.test(url.pathname)
    || /\.(?:pdf|zip|jpg|jpeg|png|webp|avif|svg)$/i.test(url.pathname)) return href;
  url.searchParams.set("preview", "1");
  return url.pathname + url.search + url.hash;
}
