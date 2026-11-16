import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEditorState, getPublicContent } from "@/lib/cms/content";
import { isEditor } from "@/lib/cms/auth";
import { resolveRoute, canonicalPath } from "@/lib/routes";
import { resolveBlog, blogPagePath, blogPath } from "@/lib/blog";
import { Website } from "@/components/site/Website";
import { catalogueEntries } from "@/lib/product-filters";
import { resolveJourneyRole } from "@/lib/journey";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function pageData({ params, searchParams }: Props) {
  const raw = (await params).path?.join("/") || "";
  const q = await searchParams;
  const preview = q.preview === "1";
  if (preview && !(await isEditor())) notFound();
  const stored = preview
    ? (await getEditorState()).content
    : await getPublicContent();
  // Draft posts must not be serialized into the public React payload.
  const c = preview
    ? stored
    : {
        ...stored,
        blogs: stored.blogs.filter((p) => p.status === "published"),
      };
  const blog = resolveBlog(raw, c, q, preview);
  const route = resolveRoute(raw, c);
  if (!blog && route === null) notFound();
  return {
    raw,
    q,
    preview,
    catalogueThicknesses: route === "products" || route === "collections"
      ? Object.fromEntries(catalogueEntries(c).map(({ product, thicknesses }) => [product.slug, thicknesses]))
      : undefined,
    c: {
      ...c,
      originalPages: c.originalPages.filter((p) => p.route === route),
    },
    blog,
    route: route ?? "blog",
  };
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { route, c, blog, preview } = await pageData(props);
  const original = c.originalPages.find((p) => p.route === route);
  const item =
    c.pages.find((p) => p.slug === route) ||
    c.products.find((p) => "products/" + p.slug === route) ||
    c.projects.find((p) => "projects/" + p.slug === route) ||
    c.resources.find((p) => "resources/" + p.slug === route) ||
    c.roles.find((p) => "for/" + p.id === route);
  const title = blog
    ? blog.kind === "post"
      ? blog.post.title
      : blog.title + (blog.page > 1 ? ` · Page ${blog.page}` : "")
    : item
      ? "name" in item
        ? item.name
        : item.title + ("accent" in item ? " " + item.accent : "")
      : c.home.title + " " + c.home.accent;
  const canonical = blog
    ? blog.kind === "post"
      ? blogPath(blog.post.slug)
      : blogPagePath(blog.base, blog.page, blog.query)
    : canonicalPath(route);
  const noindex =
    preview ||
    route === "thank-you" ||
    (blog &&
      (blog.kind === "post"
        ? blog.post.example || blog.post.status === "draft"
        : blog.posts.length === 0));
  return {
    title: original?.metaTitle || `${title} | ${c.site.name}`,
    description:
      original?.metaDescription ||
      (blog
        ? blog.kind === "post"
          ? blog.post.description
          : c.blog.description
        : item?.description || c.home.description),
    alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: !preview } } : {}),
    ...(blog?.kind === "post"
      ? {
          openGraph: {
            type: "article",
            title: blog.post.title,
            description: blog.post.description,
            publishedTime: blog.post.publishedAt,
            ...(blog.post.image
              ? { images: [{ url: blog.post.image, alt: blog.post.imageAlt }] }
              : {}),
          },
        }
      : {}),
  };
}
export default async function Page(props: Props) {
  const { raw, q, preview, c, blog, route, catalogueThicknesses } = await pageData(props);
  const p = blog?.kind === "post" ? blog.post : null;
  return (
    <>
      {p && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: p.title,
              description: p.description,
              datePublished: p.publishedAt,
              author: {
                "@type":
                  p.author === "CityBond Editorial" ? "Organization" : "Person",
                name: p.author,
              },
              mainEntityOfPage: new URL(
                blogPath(p.slug),
                process.env.SITE_URL || "https://citybond.in",
              ).href,
              ...(p.image
                ? {
                    image: new URL(
                      p.image,
                      process.env.SITE_URL || "https://citybond.in",
                    ).href,
                  }
                : {}),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <Website
        key={raw + JSON.stringify(q)}
        content={c}
        catalogueThicknesses={catalogueThicknesses}
        journeyRole={resolveJourneyRole(route, q.role, c.roles)}
        exploreHome={q.explore === "1"}
        enquiryProject={typeof q.project === "string" && c.projects.some(project => project.slug === q.project) ? q.project : undefined}
        route={route}
        requestPath={raw}
        blogView={blog ?? undefined}
        preview={preview}
        product={typeof q.product === "string" && c.products.some(product => product.slug === q.product) ? q.product : undefined}
      />
    </>
  );
}
