import type { SiteContent, BlogPost } from "./cms/schema";
export const blogPath = (slug: string, kind: "article" | "story" = "article") => `/blog/${kind === "story" ? "web-stories/" : ""}${slug}/`;
export type BlogView =
  | { kind: "post"; post: BlogPost }
  | { kind: "index"; page: number; base: string; query: string; title: string; posts: BlogPost[]; total: number; totalPages: number };
export function publicBlogs(c: SiteContent, preview = false) {
  return c.blogs.filter(p => preview || p.status === "published")
    .sort((a,b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug));
}
export function blogPagePath(base: string, page: number, query = "") {
  return `${base}${page === 1 ? "" : `page/${page}/`}${query}`;
}
export function resolveBlog(route: string, c: SiteContent, q: Record<string, string | string[] | undefined> = {}, preview = false): BlogView | null {
  route = route.replace(/^\/+|\/+$/g, "");
  if (route === "blog/best-acp-sheets-for-petrol-pump-canopies") route = "blog/web-stories/best-acp-sheets-for-petrol-pump-canopies-durable-weather-resistant";
  if (route !== "blog" && !route.startsWith("blog/")) return null;
  let parts = route.split("/").slice(1);
  let page = 1;
  if (parts.at(-2) === "page") {
    if (!/^[1-9]\d{0,3}$/.test(parts.at(-1)!)) return null;
    page = Number(parts.at(-1)); parts = parts.slice(0,-2);
  }
  let posts = publicBlogs(c, preview);
  let base = "/blog/", title = c.blog.title, query = "";
  const filter = q.post_type;
  if (filter !== undefined && (typeof filter !== "string" || !["we", "web-story"].includes(filter))) return null;
  const story = parts[0] === "web-stories" || filter === "web-story";
  posts = posts.filter(p => p.kind === (story ? "story" : "article"));
  if (typeof q.p === "string" && /^\d+$/.test(q.p)) { const post = posts.find(p => p.sourceId === Number(q.p)); return post ? {kind:"post",post} : null; }
  if (filter !== undefined) query = `?post_type=${encodeURIComponent(filter as string)}`;
  if (story) title = "Web stories";
  if (parts[0] === "web-stories") { base += "web-stories/"; parts = parts.slice(1); }
  if (parts.length === 2 && ["author", "category", "tag"].includes(parts[0])) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[1])) return null;
    const [kind, slug] = parts;
    // Keep the two source author slugs and their actual article assignments.
    const authorSlug = slug;
    posts = posts.filter(p => kind === "author" ? p.authorSlug === authorSlug : kind === "tag" ? p.tags.some(t => t.slug === slug) : p.categorySlug === slug || p.categories.some(t => t.slug === slug));
    title = posts[0] ? kind === "author" ? posts[0].author : kind === "tag" ? posts[0].tags.find(t => t.slug === slug)?.name || slug : posts[0].categories.find(t => t.slug === slug)?.name || posts[0].category : slug.replaceAll("-", " ");
    base += `${kind}/${slug}/`;
  } else if (parts.length === 2 && /^\d{4}$/.test(parts[0]) && /^(0[1-9]|1[0-2])$/.test(parts[1])) {
    posts = posts.filter(p => p.publishedAt.startsWith(`${parts[0]}-${parts[1]}`));
    title = `Archive · ${parts[0]} / ${parts[1]}`; base += parts.join("/") + "/";
  } else if (parts.length === 1 && page === 1 && !query) {
    const post = posts.find(p => p.slug === parts[0]);
    return post ? {kind: "post", post} : null;
  } else if (parts.length) return null;
  const total = posts.length, totalPages = Math.max(1, Math.ceil(total / c.blog.postsPerPage));
  // Keep known historical archives available, but don't invent infinite empty pages.
  const historicalMax = base.includes("web-stories") || filter === "web-story" ? 3 : base.includes("author/") ? 7 : base === "/blog/" ? 10 : 1;
  if (page > Math.max(totalPages,historicalMax)) return null;
  return {kind: "index", page, base, query, title, posts: posts.slice((page-1)*c.blog.postsPerPage,page*c.blog.postsPerPage), total,totalPages};
}
export function blogRoutes(c: SiteContent) {
  const posts = publicBlogs(c);
  const bases = new Map<string, number>([["blog/",10],["blog/web-stories/",3],["blog/author/b-k-narayanan/",7],["blog/author/bk-narayanan/",1],["blog/2023/05/",1],["blog/2023/06/",1],["blog/2023/09/",1]]);
  for (const p of posts) {
    const paths = p.kind === "story" ? ["blog/web-stories/"] : ["blog/",`blog/author/${p.authorSlug}/`,`blog/category/${p.categorySlug}/`,...p.categories.map(t=>`blog/category/${t.slug}/`),...p.tags.map(t=>`blog/tag/${t.slug}/`),`blog/${p.publishedAt.slice(0,7).replace("-","/")}/`];
    for (const path of paths) {
      const view = resolveBlog(path,c);
      bases.set(path, Math.max(bases.get(path) || 1, view?.kind === "index" ? view.totalPages : 1));
    }
  }
  return [...bases].flatMap(([base,count]) => Array.from({length:count},(_,i)=>blogPagePath(base,i+1)));
}
