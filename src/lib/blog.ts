import type { SiteContent, BlogPost } from "./cms/schema";
export const blogPath = (slug: string) => `/blog/${slug}/`;
export type BlogView =
  | { kind: "post"; post: BlogPost }
  | {
      kind: "index";
      page: number;
      base: string;
      query: string;
      title: string;
      posts: BlogPost[];
      total: number;
      totalPages: number;
    };
export function publicBlogs(c: SiteContent, preview = false) {
  return c.blogs
    .filter((p) => preview || p.status === "published")
    .sort(
      (a, b) =>
        b.publishedAt.localeCompare(a.publishedAt) ||
        a.slug.localeCompare(b.slug),
    );
}
export function blogPagePath(base: string, page: number, query = "") {
  return `${base}${page === 1 ? "" : `page/${page}/`}${query}`;
}
export function resolveBlog(
  route: string,
  c: SiteContent,
  q: Record<string, string | string[] | undefined> = {},
  preview = false,
): BlogView | null {
  if (route !== "blog" && !route.startsWith("blog/")) return null;
  let parts = route.split("/").filter(Boolean).slice(1);
  let page = 1;
  if (parts.at(-2) === "page") {
    if (!/^[1-9]\d{0,3}$/.test(parts.at(-1)!)) return null;
    page = Number(parts.at(-1));
    parts = parts.slice(0, -2);
  }
  let posts = publicBlogs(c, preview);
  let base = "/blog/";
  let title = c.blog.title;
  let query = "";
  const filter = q.post_type;
  if (filter !== undefined) {
    if (typeof filter !== "string" || !["we", "web-story"].includes(filter))
      return null;
    query = `?post_type=${encodeURIComponent(filter)}`;
    posts = [];
    title = "Web stories";
  }
  if (parts.length === 1 && parts[0] === "web-stories") {
    posts = [];
    base += "web-stories/";
    title = "Web stories";
  } else if (parts.length === 2 && ["author", "category"].includes(parts[0])) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[1])) return null;
    const [kind, slug] = parts;
    const matching = posts.filter((p) =>
      kind === "author" ? p.authorSlug === slug : p.categorySlug === slug,
    );
    title = matching[0]
      ? kind === "author"
        ? matching[0].author
        : matching[0].category
      : slug.split("-").join(" ");
    posts = matching;
    base += `${kind}/${slug}/`;
  } else if (
    parts.length === 2 &&
    /^\d{4}$/.test(parts[0]) &&
    /^(0[1-9]|1[0-2])$/.test(parts[1])
  ) {
    posts = posts.filter((p) =>
      p.publishedAt.startsWith(`${parts[0]}-${parts[1]}`),
    );
    title = `Archive · ${parts[0]} / ${parts[1]}`;
    base += parts.join("/") + "/";
  } else if (parts.length === 1 && page === 1 && !query) {
    const post = posts.find((p) => p.slug === parts[0]);
    return post ? { kind: "post", post } : null;
  } else if (parts.length) return null;
  const total = posts.length;
  const totalPages = Math.max(1, Math.ceil(total / c.blog.postsPerPage));
  return {
    kind: "index",
    page,
    base,
    query,
    title,
    posts: posts.slice(
      (page - 1) * c.blog.postsPerPage,
      page * c.blog.postsPerPage,
    ),
    total,
    totalPages,
  };
}
export function blogRoutes(c: SiteContent) {
  const pages = Math.max(
    9,
    Math.ceil(publicBlogs(c).length / c.blog.postsPerPage),
  );
  return [
    "blog/",
    ...Array.from({ length: pages - 1 }, (_, i) => `blog/page/${i + 2}/`),
    "blog/2023/05/",
    "blog/2023/06/",
    "blog/2023/09/",
    "blog/author/b-k-narayanan/",
    ...Array.from(
      { length: 6 },
      (_, i) => `blog/author/b-k-narayanan/page/${i + 2}/`,
    ),
    "blog/author/bk-narayanan/",
    "blog/web-stories/",
    "blog/web-stories/page/2/",
  ];
}
