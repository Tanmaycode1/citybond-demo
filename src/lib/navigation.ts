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
