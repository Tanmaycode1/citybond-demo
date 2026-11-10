"use client";
/* eslint-disable @next/next/no-img-element */
import Link from "./SiteLink";
import type { BlogView } from "@/lib/blog";
import { blogPagePath, blogPath } from "@/lib/blog";
import type { SiteContent, BlogPost } from "@/lib/cms/schema";
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));
const readTime = (post: BlogPost) =>
  Math.max(
    1,
    Math.ceil(
      post.body
        .map((b) => b.text)
        .join(" ")
        .split(/\s+/).length / 200,
    ),
  );
export function Blog({
  view,
  c,
  preview = false,
}: {
  view: BlogView;
  c: SiteContent;
  preview?: boolean;
}) {
  const href = (path: string) =>
    preview ? path + (path.includes("?") ? "&" : "?") + "preview=1" : path;
  if (view.kind === "post") {
    const p = view.post;
    return (
      <article className="blog-article">
        <header className="wrap blog-article-head">
          <Link className="text-link" href={href("/blog/")}>
            ← All stories
          </Link>
          <div className="blog-meta">
            <Link href={href(`/blog/category/${p.categorySlug}/`)}>
              {p.category}
            </Link>
            {p.example && <span className="example-label">Sample article</span>}
            {p.status === "draft" && <span>Draft preview</span>}
          </div>
          <h1>{p.title}</h1>
          <p className="blog-deck">{p.description}</p>
          <div className="blog-byline">
            <Link href={href(`/blog/author/${p.authorSlug}/`)}>{p.author}</Link>
            <time dateTime={p.publishedAt}>{dateLabel(p.publishedAt)}</time>
            <span>{readTime(p)} min read</span>
          </div>
        </header>
        {p.image && (
          <figure className="wrap blog-cover">
            <img src={p.image} alt={p.imageAlt} />
          </figure>
        )}
        <div className="wrap blog-reading-layout">
          <aside>
            <p className="eyebrow">In this story</p>
            {p.body.map(
              (b, i) =>
                b.title && (
                  <a key={i} href={`#section-${i + 1}`}>
                    {b.title}
                  </a>
                ),
            )}
          </aside>
          <div className="blog-body">
            {p.body.map((b, i) => (
              <section id={`section-${i + 1}`} key={i}>
                {b.title && <h2>{b.title}</h2>}
                {b.text.split(/\n\s*\n/).map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
                {b.image && (
                  <figure>
                    <img src={b.image} alt={b.imageAlt} />
                  </figure>
                )}
              </section>
            ))}
          </div>
        </div>
        <div className="wrap blog-end">
          <span>Continue exploring.</span>
          <Link className="text-link" href={href("/blog/")}>
            Back to all stories ↗
          </Link>
        </div>
      </article>
    );
  }
  const pageNumbers = [
    ...new Set([1, view.page - 1, view.page, view.page + 1, view.totalPages]),
  ]
    .filter((n) => n >= 1 && n <= view.totalPages)
    .sort((a, b) => a - b);
  return (
    <>
      <section className="wrap blog-intro">
        <p className="eyebrow">The CityBond journal</p>
        <h1>{view.title}</h1>
        <p>{c.blog.description}</p>
        <div className="blog-list-meta">
          <Link href={href("/blog/")}>All stories</Link>
          <span>
            {view.total} {view.total === 1 ? "article" : "articles"}
            {view.page > 1 ? ` · Page ${view.page}` : ""}
          </span>
        </div>
      </section>
      <section className="wrap blog-grid" aria-label="Articles">
        {view.posts.map((p) => (
          <article className="blog-card" key={p.slug}>
            <Link href={href(blogPath(p.slug))} className="blog-card-image">
              {p.image && <img src={p.image} alt={p.imageAlt} loading="lazy" />}
              <span aria-hidden="true">↗</span>
            </Link>
            <div className="blog-meta">
              <span>{p.category}</span>
              {p.example && (
                <span className="example-label">Sample article</span>
              )}
            </div>
            <h2>
              <Link href={href(blogPath(p.slug))}>{p.title}</Link>
            </h2>
            <p>{p.description}</p>
            <div className="blog-byline">
              <time dateTime={p.publishedAt}>{dateLabel(p.publishedAt)}</time>
              <span>{readTime(p)} min read</span>
            </div>
          </article>
        ))}
      </section>
      {!view.posts.length && (
        <section className="wrap blog-empty">
          <h2>{c.blog.emptyTitle}</h2>
          <p>{c.blog.emptyDescription}</p>
          <Link className="button" href={href("/blog/")}>
            Explore the latest stories <span>↗</span>
          </Link>
        </section>
      )}
      <nav className="wrap blog-pagination" aria-label="Blog pagination">
        {view.page > 1 && (
          <Link
            href={href(
              blogPagePath(
                view.base,
                Math.min(view.page - 1, view.totalPages),
                view.query,
              ),
            )}
          >
            ← Previous
          </Link>
        )}
        {pageNumbers.map((n) => (
          <Link
            key={n}
            href={href(blogPagePath(view.base, n, view.query))}
            aria-current={n === view.page ? "page" : undefined}
          >
            {n}
          </Link>
        ))}
        {view.page < view.totalPages && (
          <Link href={href(blogPagePath(view.base, view.page + 1, view.query))}>
            Next →
          </Link>
        )}
      </nav>
    </>
  );
}
